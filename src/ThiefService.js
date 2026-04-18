import { CONFIG } from "./GameConfig.js";
import { getBusinessTitle } from "./I18nCatalog.js";
import {
  addBusinessPendingTheft,
  getBusinessStealableForNextClaim,
  getTodayUTC,
  normalizeBusinessEntry
} from "./BusinessPayout.js";
import { formatMoney, normalizeLang, t } from "./i18n/index.js";
import { EnergyService } from "./EnergyService.js";
import {
  combatDefenseOptions,
  combatZoneDamage,
  decideCombatWinner,
  isCombatSelectionValid,
  isCombatZone,
  resolveCombatRound
} from "./CombatEngine.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export class ThiefService {
  constructor({ db, users, now, bot, achievements = null, ratings = null, quests = null }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.achievements = achievements || null;
    this.ratings = ratings || null;
    this.quests = quests || null;
  }

  _cfg() {
    return CONFIG?.THIEF || {};
  }

  _bizCfg(bizId) {
    const id = String(bizId || "");
    return this._cfg()?.BUSINESS?.[id] || null;
  }

  _protectionCfg() {
    return this._cfg()?.PROTECTION || {};
  }

  _guardCfg() {
    return this._protectionCfg()?.GUARD || {};
  }

  _immunityCfg() {
    return this._protectionCfg()?.IMMUNITY || {};
  }

  _guardDurationMs() {
    return Math.max(60_000, Math.floor(Number(this._guardCfg()?.DURATION_MS) || DAY_MS));
  }

  _guardSuccessReductionPct() {
    return Math.max(0, Math.min(1, Number(this._guardCfg()?.SUCCESS_REDUCTION_PCT) || 0));
  }

  _guardSuccessMultiplier() {
    return Math.max(0, 1 - this._guardSuccessReductionPct());
  }

  _guardExtraWindowMs() {
    return Math.max(0, Math.floor(Number(this._guardCfg()?.EXTRA_WINDOW_MS) || 0));
  }

  _defenseCfg() {
    return this._cfg()?.DEFENSE_BATTLE || {};
  }

  _reactionWindowMs() {
    return Math.max(60_000, Math.floor(Number(this._defenseCfg()?.REACTION_WINDOW_MS) || (10 * 60_000)));
  }

  _defenseRounds() {
    return Math.max(1, Math.floor(Number(this._defenseCfg()?.ROUNDS) || 3));
  }

  _defenseRoundWindowMs() {
    return Math.max(10_000, Math.floor(Number(this._defenseCfg()?.ROUND_WINDOW_SEC) || 60) * 1000);
  }

  _defenseBattleTtlSec() {
    return Math.max(60, Math.floor(Number(this._defenseCfg()?.BATTLE_TTL_SEC) || (2 * DAY_MS / 1000)));
  }

  _guardPrice(bizId) {
    const id = String(bizId || "");
    const daily = Math.max(0, Math.floor(Number(CONFIG?.BUSINESS?.[id]?.daily) || 0));
    if (daily > 0) {
      return Math.max(1, Math.floor(daily * 0.10));
    }
    return Math.max(0, Math.floor(Number(this._guardCfg()?.PRICES?.[id]) || 0));
  }

  _immunityOptions() {
    const options = this._immunityCfg()?.OPTIONS || {};
    const out = [];
    for (const [hoursRaw, gemsRaw] of Object.entries(options)) {
      const hours = Math.max(1, Math.floor(Number(hoursRaw) || 0));
      const gems = Math.max(1, Math.floor(Number(gemsRaw) || 0));
      if (hours > 0 && gems > 0) out.push({ hours, gems });
    }
    out.sort((a, b) => a.hours - b.hours);
    return out;
  }

  _immunityPrice(hours) {
    const h = Math.max(1, Math.floor(Number(hours) || 0));
    return Math.max(0, Math.floor(Number(this._immunityCfg()?.OPTIONS?.[String(h)]) || 0));
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _t(source, key, vars = {}) {
    return t(key, this._lang(source), vars);
  }

  _money(source, amount) {
    return formatMoney(amount, this._lang(source));
  }

  _bizTitle(bizId, source) {
    return getBusinessTitle(bizId, this._lang(source)) || String(bizId || "");
  }

  _userName(user, source) {
    const name = String(user?.displayName || "").trim();
    if (name) return name;
    return this._t(source, "thief.player_fallback", {
      id: String(user?.id || "").slice(-4).padStart(4, "0")
    });
  }

  _ensureThiefState(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;
    if (!u.thief || typeof u.thief !== "object") {
      u.thief = { level: 0, activeAttackId: "", cooldowns: {}, totalStolen: 0 };
      return true;
    }
    const maxLevel = Math.max(0, Number(this._cfg().MAX_LEVEL) || 5);
    const level = Math.max(0, Math.floor(Number(u.thief.level) || 0));
    const boundedLevel = Math.min(maxLevel, level);
    if (boundedLevel !== u.thief.level) {
      u.thief.level = boundedLevel;
      dirty = true;
    }
    if (typeof u.thief.activeAttackId !== "string") {
      u.thief.activeAttackId = "";
      dirty = true;
    }
    if (!u.thief.cooldowns || typeof u.thief.cooldowns !== "object") {
      u.thief.cooldowns = {};
      dirty = true;
    }
    const totalStolen = Math.max(0, Math.floor(Number(u.thief.totalStolen) || 0));
    if (totalStolen !== Number(u.thief.totalStolen)) {
      u.thief.totalStolen = totalStolen;
      dirty = true;
    }
    return dirty;
  }

  _cleanupCooldowns(u) {
    this._ensureThiefState(u);
    const nowTs = this.now();
    const map = u.thief.cooldowns || {};
    const next = {};
    for (const [bizId, endAtRaw] of Object.entries(map)) {
      const endAt = Math.max(0, Math.floor(Number(endAtRaw) || 0));
      if (endAt > nowTs) next[String(bizId)] = endAt;
    }
    const prevKeys = Object.keys(map);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length || prevKeys.some((k) => Number(map[k]) !== Number(next[k]))) {
      u.thief.cooldowns = next;
      return true;
    }
    return false;
  }

  _cooldownMinutes(level) {
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    return Math.max(1, Math.floor(Number(this._cfg()?.LEVEL_COOLDOWN_MINUTES?.[lvl]) || 30));
  }

  _successChance(level) {
    const lvl = Math.max(1, Math.floor(Number(level) || 1));
    return Math.min(1, Math.max(0, Number(this._cfg()?.LEVEL_SUCCESS?.[lvl]) || 0));
  }

  _upgradeCost(nextLevel) {
    const lvl = Math.max(1, Math.floor(Number(nextLevel) || 1));
    return Math.max(0, Math.floor(Number(this._cfg()?.LEVEL_COSTS?.[lvl]) || 0));
  }

  _minAccountAgeMs() {
    const hours = Math.max(0, Number(this._cfg()?.MIN_ACCOUNT_AGE_HOURS) || 0);
    return hours * 60 * 60 * 1000;
  }

  _minTargetCash() {
    return Math.max(1, Math.floor(Number(this._cfg()?.MIN_AVAILABLE_TO_TARGET) || 1));
  }

  _attackPctRange() {
    const min = Number(this._cfg()?.ATTACK_PCT_MIN) || 0.2;
    const max = Number(this._cfg()?.ATTACK_PCT_MAX) || 0.35;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  _ownerRemainPct() {
    return Math.max(0, Math.min(1, Number(this._cfg()?.OWNER_MIN_DAILY_REMAIN_PCT) || 0.5));
  }

  _dailyAttemptsLimit() {
    return Math.max(1, Math.floor(Number(this._cfg()?.DAILY_ATTEMPTS_PER_TARGET) || 2));
  }

  _revealCost() {
    return Math.max(1, Math.floor(Number(this._cfg()?.REVEAL_COST) || 100));
  }

  _theftLogMax() {
    return Math.max(1, Math.floor(Number(this._cfg()?.LOG_MAX) || 20));
  }

  _newRevealEventId() {
    const a = Math.floor(this.now()).toString(36);
    const b = Math.random().toString(36).slice(2, 8);
    return `${a}${b}`;
  }

  _dueBucketMs() {
    return Math.max(1000, Math.floor(Number(this._cfg()?.DUE_BUCKET_MS) || 60_000));
  }

  _dueBucket(ts) {
    return Math.floor((Number(ts) || 0) / this._dueBucketMs());
  }

  _dueKey(bucket, attackId) {
    return `thief:due:${bucket}:${String(attackId || "")}`;
  }

  _defenseKey(attackId) {
    return `thief:defense:${String(attackId || "")}`;
  }

  _defenseDueKey(bucket, attackId) {
    return `thief:defense_due:${bucket}:${String(attackId || "")}`;
  }

  _protectionDueKey(bucket, kind, ownerId, bizId) {
    return `thief:protect_due:${bucket}:${String(kind || "")}:${String(ownerId || "")}:${String(bizId || "")}`;
  }

  _parseDueAttackId(key) {
    const parts = String(key || "").split(":");
    return parts.length >= 4 ? String(parts[3] || "") : "";
  }

  _parseDefenseDueAttackId(key) {
    const parts = String(key || "").split(":");
    return parts.length >= 4 ? String(parts[3] || "") : "";
  }

  _parseProtectionDueKey(key) {
    const parts = String(key || "").split(":");
    if (parts.length < 6) return null;
    return {
      bucket: Number(parts[2]) || 0,
      kind: String(parts[3] || ""),
      ownerId: String(parts[4] || ""),
      bizId: String(parts[5] || "")
    };
  }

  _attackKey(attackId) {
    return `thief:attack:${String(attackId || "")}`;
  }

  _activeTargetKey(ownerId, bizId) {
    return `thief:active_target:${String(ownerId || "")}:${String(bizId || "")}`;
  }

  _attemptKey(dayUTC, ownerId, bizId) {
    return `thief:attempts:${String(dayUTC || "")}:${String(ownerId || "")}:${String(bizId || "")}`;
  }

  _ownersIndexKey(bizId) {
    return `thief:owners:${String(bizId || "")}`;
  }

  _dailyStolenKey(dayUTC) {
    return `thief:daily_stolen:${String(dayUTC || "")}`;
  }

  _dailyStolenLimit() {
    return Math.max(1, Math.floor(Number(this._cfg()?.DAILY_LB_LIMIT) || 20));
  }

  _dailyStolenTtlSec() {
    return Math.max(60, Math.floor(Number(this._cfg()?.DAILY_LB_TTL_SEC) || (8 * DAY_MS / 1000)));
  }

  _attackTtlSec(attack) {
    const nowTs = this.now();
    const resolveAt = Math.max(nowTs, Number(attack?.resolveAt) || nowTs);
    return Math.max(60, Math.ceil((resolveAt - nowTs) / 1000) + 2 * DAY_MS / 1000);
  }

  _safeJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  async _recordDailyStolen(user, amount, dayUTC = getTodayUTC(this.now())) {
    const uid = String(user?.id || "").trim();
    const gain = Math.max(0, Math.floor(Number(amount) || 0));
    const day = String(dayUTC || "").trim();
    if (!uid || !day || gain <= 0) return;

    const key = this._dailyStolenKey(day);
    const raw = await this.db.get(key);
    const list = this._safeJson(raw, []);
    const arr = Array.isArray(list) ? list : [];
    const idx = arr.findIndex((x) => String(x?.userId || "") === uid);
    const name = String(user?.displayName || "").trim() || `Player #${uid.slice(-4).padStart(4, "0")}`;
    if (idx >= 0) {
      arr[idx] = {
        userId: uid,
        name,
        stolen: Math.max(0, Math.floor(Number(arr[idx]?.stolen) || 0)) + gain
      };
    } else {
      arr.push({ userId: uid, name, stolen: gain });
    }
    arr.sort((a, b) => Math.max(0, Number(b?.stolen) || 0) - Math.max(0, Number(a?.stolen) || 0));
    const trimmed = arr.slice(0, this._dailyStolenLimit());
    await this.db.put(key, JSON.stringify(trimmed), { expirationTtl: this._dailyStolenTtlSec() });
  }

  async getDailyTopStolen(dayUTC = getTodayUTC(this.now()), limit = 10) {
    const day = String(dayUTC || "").trim();
    if (!day) return [];
    const raw = await this.db.get(this._dailyStolenKey(day));
    const arr = this._safeJson(raw, []);
    if (!Array.isArray(arr)) return [];
    const out = arr
      .map((row) => ({
        userId: String(row?.userId || "").trim(),
        name: String(row?.name || "").trim(),
        stolen: Math.max(0, Math.floor(Number(row?.stolen) || 0))
      }))
      .filter((row) => row.userId && row.stolen > 0)
      .sort((a, b) => b.stolen - a.stolen);
    return out.slice(0, Math.max(1, Math.floor(Number(limit) || 10)));
  }

  async getDailyBestStolen(dayUTC = getTodayUTC(this.now())) {
    const top = await this.getDailyTopStolen(dayUTC, 1);
    return top[0] || null;
  }

  async _saveAttack(attack) {
    if (!attack?.id) return;
    const ttl = this._attackTtlSec(attack);
    await this.db.put(this._attackKey(attack.id), JSON.stringify(attack), { expirationTtl: ttl });
  }

  async _saveDefenseBattle(battle) {
    const attackId = String(battle?.attackId || battle?.id || "").trim();
    if (!attackId) return;
    await this.db.put(this._defenseKey(attackId), JSON.stringify(battle), { expirationTtl: this._defenseBattleTtlSec() });
  }

  async _loadDefenseBattle(attackId) {
    const id = String(attackId || "").trim();
    if (!id) return null;
    const raw = await this.db.get(this._defenseKey(id));
    const data = this._safeJson(raw, null);
    if (!data || typeof data !== "object") return null;
    if (!String(data.attackId || "").trim()) data.attackId = id;
    return data;
  }

  async _loadAttack(attackId) {
    const id = String(attackId || "").trim();
    if (!id) return null;
    const raw = await this.db.get(this._attackKey(id));
    const data = this._safeJson(raw, null);
    if (!data || typeof data !== "object") return null;
    if (String(data.id || "") !== id) data.id = id;
    return data;
  }

  async _deleteAttack(attack) {
    const id = String(attack?.id || "");
    if (!id) return;
    const ownerId = String(attack?.ownerId || "");
    const bizId = String(attack?.bizId || "");
    await this.db.delete(this._attackKey(id)).catch(() => {});
    if (ownerId && bizId) {
      await this.db.delete(this._activeTargetKey(ownerId, bizId)).catch(() => {});
    }
  }

  async _markDueAttack(attackId, resolveAt) {
    const id = String(attackId || "").trim();
    if (!id) return;
    const bucket = this._dueBucket(resolveAt);
    const ttlSec = Math.max(60, Math.ceil((Number(resolveAt) - this.now()) / 1000) + 2 * DAY_MS / 1000);
    await this.db.put(this._dueKey(bucket, id), "1", { expirationTtl: ttlSec }).catch(() => {});
  }

  async _markDueDefenseBattle(attackId, dueAt) {
    const id = String(attackId || "").trim();
    if (!id) return;
    const bucket = this._dueBucket(dueAt);
    const ttlSec = Math.max(60, Math.ceil((Number(dueAt) - this.now()) / 1000) + (2 * DAY_MS / 1000));
    await this.db.put(this._defenseDueKey(bucket, id), "1", { expirationTtl: ttlSec }).catch(() => {});
  }

  async _markProtectionDue(kind, ownerId, bizId, resolveAt) {
    const k = String(kind || "").trim();
    const oid = String(ownerId || "").trim();
    const bid = String(bizId || "").trim();
    const at = Math.max(0, Math.floor(Number(resolveAt) || 0));
    if (!k || !oid || !bid || !at) return;
    const bucket = this._dueBucket(at);
    const ttlSec = Math.max(60, Math.ceil((at - this.now()) / 1000) + 2 * DAY_MS / 1000);
    await this.db.put(this._protectionDueKey(bucket, k, oid, bid), "1", { expirationTtl: ttlSec }).catch(() => {});
  }

  async _collectDueAttackIds({ nowTs = this.now(), lookbackMinutes = 10 } = {}) {
    const result = new Set();
    const endBucket = this._dueBucket(nowTs);
    const buckets = Math.max(0, Math.ceil((Math.max(0, Number(lookbackMinutes) || 0) * 60_000) / this._dueBucketMs()));
    const startBucket = endBucket - buckets;
    for (let b = startBucket; b <= endBucket; b++) {
      const prefix = `thief:due:${b}:`;
      let cursor = undefined;
      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;
        for (const key of page?.keys || []) {
          const id = this._parseDueAttackId(key?.name);
          if (id) result.add(id);
        }
      } while (cursor);
    }
    return [...result];
  }

  async _collectDueDefenseBattleIds({ nowTs = this.now(), lookbackMinutes = 15 } = {}) {
    const result = new Set();
    const endBucket = this._dueBucket(nowTs);
    const buckets = Math.max(0, Math.ceil((Math.max(0, Number(lookbackMinutes) || 0) * 60_000) / this._dueBucketMs()));
    const startBucket = endBucket - buckets;
    for (let b = startBucket; b <= endBucket; b++) {
      const prefix = `thief:defense_due:${b}:`;
      let cursor = undefined;
      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;
        for (const key of page?.keys || []) {
          const id = this._parseDefenseDueAttackId(key?.name);
          if (id) result.add(id);
        }
      } while (cursor);
    }
    return [...result];
  }

  async _collectDueProtectionEvents({ nowTs = this.now(), lookbackMinutes = 30 } = {}) {
    const result = new Map();
    const endBucket = this._dueBucket(nowTs);
    const buckets = Math.max(0, Math.ceil((Math.max(0, Number(lookbackMinutes) || 0) * 60_000) / this._dueBucketMs()));
    const startBucket = endBucket - buckets;
    for (let b = startBucket; b <= endBucket; b++) {
      const prefix = `thief:protect_due:${b}:`;
      let cursor = undefined;
      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;
        for (const key of page?.keys || []) {
          const parsed = this._parseProtectionDueKey(key?.name);
          if (!parsed?.kind || !parsed?.ownerId || !parsed?.bizId) continue;
          const uniq = `${parsed.kind}:${parsed.ownerId}:${parsed.bizId}`;
          if (!result.has(uniq)) result.set(uniq, parsed);
        }
      } while (cursor);
    }
    return [...result.values()];
  }

  _allBusinessIds() {
    const byPrice = Object.values(CONFIG?.BUSINESS || {}).filter(Boolean);
    byPrice.sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));
    return byPrice.map((x) => String(x.id || "")).filter(Boolean);
  }

  _bizUnlocked(level, bizId) {
    const cfg = this._bizCfg(bizId);
    if (!cfg) return false;
    return Math.max(0, Number(level) || 0) >= Math.max(1, Number(cfg.unlockLevel) || 1);
  }

  _unlockedBizIds(level) {
    return this._allBusinessIds().filter((bizId) => this._bizUnlocked(level, bizId));
  }

  _attackEnergy(bizId) {
    return Math.max(1, Math.floor(Number(this._bizCfg(bizId)?.attackEnergy) || 1));
  }

  _defendEnergy(bizId) {
    return Math.max(1, Math.floor(Number(this._bizCfg(bizId)?.defendEnergy) || 1));
  }

  _attackWindowMs(bizId) {
    return Math.max(1, Math.floor(Number(this._bizCfg(bizId)?.attackMs) || 60_000));
  }

  _ownedArray(u) {
    if (!u.biz || typeof u.biz !== "object") u.biz = {};
    if (!Array.isArray(u.biz.owned)) u.biz.owned = [];
    return u.biz.owned;
  }

  _findOwnedEntry(u, bizId) {
    const arr = this._ownedArray(u);
    const id = String(bizId || "");
    const idx = arr.findIndex((it) => (typeof it === "string" ? it === id : String(it?.id || "") === id));
    if (idx < 0) return { idx: -1, entry: null, arr };

    let entry = arr[idx];
    if (typeof entry === "string") {
      entry = { id: entry, boughtAt: 0, lastClaimDayUTC: "", pendingTheftAmount: 0 };
    }
    entry = normalizeBusinessEntry(entry, id);
    arr[idx] = entry;
    return { idx, entry, arr };
  }

  _availableForOwner(owner, bizId, todayUTC = getTodayUTC(this.now())) {
    const B = CONFIG?.BUSINESS?.[String(bizId || "")];
    if (!B) return { available: 0, daily: 0, entry: null, arr: null, pending: 0 };
    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) {
      return { available: 0, daily: Math.max(0, Number(B.daily) || 0), entry: null, arr: found.arr, pending: 0 };
    }
    const daily = Math.max(0, Number(B.daily) || 0);
    const available = getBusinessStealableForNextClaim(found.entry, daily, this._ownerRemainPct());
    const pending = Math.max(0, Math.floor(Number(found.entry.pendingTheftAmount) || 0));
    return { available, daily, entry: found.entry, arr: found.arr, pending };
  }

  _appendTheftLog(owner, bizId, { thiefId, amount, ts, revealed = false, eventId = "" } = {}) {
    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) return "";
    const eid = String(eventId || this._newRevealEventId()).trim();
    const thief = String(thiefId || "").trim();
    const biz = String(bizId || found.entry.id || "").trim();
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
    const safeTs = Math.max(0, Math.floor(Number(ts) || this.now()));
    if (!eid || !thief || !biz || !safeAmount || !safeTs) return "";

    const prev = Array.isArray(found.entry.theftLog) ? found.entry.theftLog : [];
    const next = [];
    for (const raw of prev) {
      if (!raw || typeof raw !== "object") continue;
      const rowEventId = String(raw.eventId || "").trim();
      const rowThiefId = String(raw.thiefId || "").trim();
      const rowAmount = Math.max(0, Math.floor(Number(raw.amount) || 0));
      const rowTs = Math.max(0, Math.floor(Number(raw.ts) || 0));
      const rowBizId = String(raw.bizId || biz).trim();
      if (!rowEventId || !rowThiefId || !rowAmount || !rowTs || !rowBizId) continue;
      next.push({
        eventId: rowEventId,
        thiefId: rowThiefId,
        amount: rowAmount,
        bizId: rowBizId,
        ts: rowTs,
        revealed: !!raw.revealed
      });
    }
    next.push({ eventId: eid, thiefId: thief, amount: safeAmount, bizId: biz, ts: safeTs, revealed: !!revealed });
    next.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
    found.entry.theftLog = next.slice(0, this._theftLogMax());
    found.arr[found.idx] = found.entry;
    owner.biz = owner.biz || {};
    owner.biz.owned = found.arr;
    return eid;
  }

  _findTheftLog(owner, eventId) {
    const id = String(eventId || "").trim();
    if (!id) return null;
    const arr = this._ownedArray(owner);
    for (let i = 0; i < arr.length; i++) {
      const raw = arr[i];
      if (!raw || typeof raw !== "object") continue;
      const entry = normalizeBusinessEntry(raw, String(raw.id || ""));
      const log = Array.isArray(entry.theftLog) ? entry.theftLog : [];
      for (let j = 0; j < log.length; j++) {
        const row = log[j];
        if (!row || typeof row !== "object") continue;
        if (String(row.eventId || "").trim() !== id) continue;
        return { arr, idx: i, entry, logIndex: j, row };
      }
    }
    return null;
  }

  _buildRevealProfileView(owner, thief) {
    const earned = thief?.achievements?.earned;
    const achCount = Array.isArray(earned)
      ? earned.length
      : (earned && typeof earned === "object" ? Object.keys(earned).length : 0);
    const owned = Array.isArray(thief?.biz?.owned) ? thief.biz.owned : [];
    let bizCount = 0;
    for (const b of owned) {
      const id = String(typeof b === "string" ? b : b?.id || "").trim();
      if (id) bizCount += 1;
    }
    const caption = this._t(owner, "thief.reveal.profile.caption", {
      name: this._userName(thief, owner),
      level: Math.max(0, Math.floor(Number(thief?.thief?.level) || 0)),
      energy: Math.max(0, Math.floor(Number(thief?.energy) || 0)),
      energyMax: EnergyService.effectiveEnergyMax(thief, this.now()),
      bizCount,
      achCount: Math.max(0, Math.floor(Number(achCount) || 0))
    });
    return {
      caption,
      keyboard: [[{ text: this._t(owner, "thief.btn.back"), callback_data: "go:Business" }]]
    };
  }

  async buildRevealEntryView(owner, eventId) {
    const found = this._findTheftLog(owner, eventId);
    if (!found) {
      return {
        caption: this._t(owner, "thief.reveal.err.stale"),
        keyboard: [[{ text: this._t(owner, "thief.btn.back"), callback_data: "go:Business" }]]
      };
    }
    if (found.row.revealed) {
      const thief = await this.users.load(String(found.row.thiefId || "")).catch(() => null);
      if (!thief) {
        return {
          caption: this._t(owner, "thief.reveal.err.thief_missing"),
          keyboard: [[{ text: this._t(owner, "thief.btn.back"), callback_data: "go:Business" }]]
        };
      }
      return this._buildRevealProfileView(owner, thief);
    }
    const bizTitle = this._bizTitle(found.row.bizId || found.entry?.id || "", owner);
    const cost = this._money(owner, this._revealCost());
    return {
      caption: this._t(owner, "thief.reveal.confirm.caption", { cost, bizTitle }),
      keyboard: [
        [{ text: this._t(owner, "thief.btn.reveal_confirm"), callback_data: `thief:reveal:confirm:${found.row.eventId}` }],
        [{ text: this._t(owner, "thief.btn.reveal_cancel"), callback_data: "go:Business" }]
      ]
    };
  }

  async confirmReveal(ownerId, eventId) {
    const uid = String(ownerId || "").trim();
    const eid = String(eventId || "").trim();
    const cost = this._revealCost();
    if (!uid || !eid) {
      const fallbackOwner = { lang: "ru" };
      return {
        caption: this._t(fallbackOwner, "thief.reveal.err.stale"),
        keyboard: [[{ text: this._t(fallbackOwner, "thief.btn.back"), callback_data: "go:Business" }]]
      };
    }

    let outcome = { status: "stale", thief: null, owner: null, have: 0 };
    await this.users.update(uid, async (owner) => {
      outcome.owner = owner;
      const found = this._findTheftLog(owner, eid);
      if (!found) {
        outcome.status = "stale";
        return owner;
      }

      const thiefId = String(found.row.thiefId || "").trim();
      if (found.row.revealed) {
        outcome.status = "already";
        if (thiefId) outcome.thief = await this.users.load(thiefId).catch(() => null);
        return owner;
      }

      const thief = thiefId ? await this.users.load(thiefId).catch(() => null) : null;
      if (!thief) {
        outcome.status = "thief_missing";
        return owner;
      }

      const have = Math.max(0, Math.floor(Number(owner?.money) || 0));
      if (have < cost) {
        outcome.status = "not_enough";
        outcome.have = have;
        return owner;
      }

      owner.money = have - cost;
      found.row.revealed = true;
      found.entry.theftLog[found.logIndex] = found.row;
      found.arr[found.idx] = found.entry;
      owner.biz = owner.biz || {};
      owner.biz.owned = found.arr;
      outcome.status = "paid";
      outcome.thief = thief;
      return owner;
    });

    const owner = outcome.owner || (await this.users.load(uid).catch(() => null));
    const safeOwner = owner || { lang: "ru" };

    if (outcome.status === "paid" || outcome.status === "already") {
      if (!outcome.thief) {
        return {
          caption: this._t(safeOwner, "thief.reveal.err.thief_missing"),
          keyboard: [[{ text: this._t(safeOwner, "thief.btn.back"), callback_data: "go:Business" }]]
        };
      }
      return this._buildRevealProfileView(safeOwner, outcome.thief);
    }

    if (outcome.status === "not_enough") {
      return {
        caption: this._t(safeOwner, "thief.reveal.err.not_enough", {
          cost: this._money(safeOwner, cost),
          have: this._money(safeOwner, outcome.have)
        }),
        keyboard: [[{ text: this._t(safeOwner, "thief.btn.back"), callback_data: "go:Business" }]]
      };
    }

    if (outcome.status === "thief_missing") {
      return {
        caption: this._t(safeOwner, "thief.reveal.err.thief_missing"),
        keyboard: [[{ text: this._t(safeOwner, "thief.btn.back"), callback_data: "go:Business" }]]
      };
    }

    return {
      caption: this._t(safeOwner, "thief.reveal.err.stale"),
      keyboard: [[{ text: this._t(safeOwner, "thief.btn.back"), callback_data: "go:Business" }]]
    };
  }

  _rand(min, max) {
    const lo = Number(min) || 0;
    const hi = Number(max) || lo;
    return lo + Math.random() * (hi - lo);
  }

  async _sendInline(chatId, text, keyboard = null) {
    if (!this.bot || !chatId) return;
    try {
      await this.bot.sendWithInline(chatId, text, keyboard || [[{ text: "🧭 Menu", callback_data: "go:Square" }]]);
    } catch {}
  }

  async _loadOwnersIndex(bizId) {
    const raw = await this.db.get(this._ownersIndexKey(bizId));
    const arr = this._safeJson(raw, []);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x || "")).filter(Boolean);
  }

  async _saveOwnersIndex(bizId, ownerIds) {
    const uniq = [...new Set((Array.isArray(ownerIds) ? ownerIds : []).map((x) => String(x || "").trim()).filter(Boolean))];
    await this.db.put(this._ownersIndexKey(bizId), JSON.stringify(uniq.slice(0, 2000)));
  }

  async upsertBizOwner(ownerId, bizId) {
    const id = String(ownerId || "").trim();
    const biz = String(bizId || "").trim();
    if (!id || !biz || !this._bizCfg(biz)) return;
    const arr = await this._loadOwnersIndex(biz);
    if (!arr.includes(id)) {
      arr.push(id);
      await this._saveOwnersIndex(biz, arr);
    }
  }

  async rebuildBizOwnersIndex(bizId, { limit = 2000 } = {}) {
    const biz = String(bizId || "").trim();
    if (!biz || !this._bizCfg(biz)) return [];
    const max = Math.max(1, Math.floor(Number(limit) || 2000));

    const found = [];
    let cursor = undefined;
    do {
      const page = await this.db.list({ prefix: "u:", cursor });
      cursor = page?.cursor;
      for (const key of page?.keys || []) {
        if (found.length >= max) break;
        const raw = await this.db.get(key.name);
        const user = this._safeJson(raw, null);
        if (!user || typeof user !== "object") continue;
        const owned = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
        const isOwned = owned.some((it) => (typeof it === "string" ? it === biz : String(it?.id || "") === biz));
        if (!isOwned) continue;
        const id = String(user?.id || key.name.replace(/^u:/, "") || "").trim();
        if (!id) continue;
        found.push(id);
      }
      if (found.length >= max) break;
    } while (cursor);

    await this._saveOwnersIndex(biz, found);
    return found;
  }

  async _attemptsToday(ownerId, bizId, dayUTC = getTodayUTC(this.now())) {
    const raw = await this.db.get(this._attemptKey(dayUTC, ownerId, bizId));
    return Math.max(0, Math.floor(Number(raw) || 0));
  }

  async _increaseAttemptsToday(ownerId, bizId, dayUTC = getTodayUTC(this.now())) {
    const key = this._attemptKey(dayUTC, ownerId, bizId);
    const current = Math.max(0, Math.floor(Number(await this.db.get(key)) || 0));
    const next = current + 1;
    await this.db.put(key, String(next), { expirationTtl: 3 * 24 * 60 * 60 });
    return next;
  }

  async getOwnerActiveAttack(ownerId) {
    const oid = String(ownerId || "").trim();
    if (!oid) return null;

    const nowTs = this.now();
    const bizIds = Object.keys(this._cfg()?.BUSINESS || {});
    let best = null;

    for (const bizId of bizIds) {
      const lockKey = this._activeTargetKey(oid, bizId);
      const attackId = String(await this.db.get(lockKey).catch(() => "") || "").trim();
      if (!attackId) continue;

      const attack = await this._loadAttack(attackId);
      const invalid =
        !attack ||
        !["active", "battle"].includes(String(attack.status || "")) ||
        String(attack.ownerId || "") !== oid ||
        String(attack.bizId || "") !== String(bizId);

      if (invalid) {
        await this.db.delete(lockKey).catch(() => {});
        continue;
      }

      if (String(attack.status || "") === "battle") {
        const battle = await this._loadDefenseBattle(attackId);
        if (battle && Number(battle.roundDeadline || 0) <= nowTs) {
          await this._resolveDefenseBattleTimeout(attackId, { source: "lazy" }).catch(() => {});
          continue;
        }
      } else if (Number(attack.resolveAt || 0) <= nowTs) {
        await this._resolveAttack(attack, { source: "lazy" }).catch(() => {});
        continue;
      }

      const leftMs = Math.max(0, Number(attack.resolveAt || 0) - nowTs);
      const battle = String(attack.status || "") === "battle" ? await this._loadDefenseBattle(attackId) : null;
      const dueAt = battle?.roundDeadline || attack.resolveAt;
      const row = {
        attackId,
        bizId: String(bizId),
        resolveAt: Number(dueAt || 0),
        minsLeft: this._formatMinutes(Math.max(0, Number(dueAt || 0) - nowTs)),
        inBattle: String(attack.status || "") === "battle",
        currentRound: Math.max(1, Math.floor(Number(battle?.currentRound) || 1))
      };

      if (!best || row.resolveAt < best.resolveAt) best = row;
    }

    return best;
  }

  async _ensureAttackerState(attacker) {
    if (!attacker) return attacker;
    let dirty = false;
    dirty = this._ensureThiefState(attacker) || dirty;
    dirty = this._cleanupCooldowns(attacker) || dirty;

    const activeId = String(attacker?.thief?.activeAttackId || "").trim();
    if (activeId) {
      const attack = await this._loadAttack(activeId);
      if (!attack || String(attack.attackerId || "") !== String(attacker.id || "")) {
        attacker.thief.activeAttackId = "";
        dirty = true;
      } else if (String(attack.status || "") === "battle") {
        const battle = await this._loadDefenseBattle(activeId);
        if (battle && Number(battle.roundDeadline || 0) <= this.now()) {
          await this._resolveDefenseBattleTimeout(activeId, { source: "lazy" });
          const fresh = await this.users.load(attacker.id).catch(() => attacker);
          return fresh;
        }
      } else if (Number(attack.resolveAt || 0) <= this.now()) {
        await this._resolveAttack(attack, { source: "lazy" });
        const fresh = await this.users.load(attacker.id).catch(() => attacker);
        return fresh;
      }
    }

    if (dirty) await this.users.save(attacker);
    return attacker;
  }

  _cooldownLeftMs(u, bizId) {
    this._ensureThiefState(u);
    const endAt = Math.max(0, Number(u?.thief?.cooldowns?.[String(bizId || "")]) || 0);
    return Math.max(0, endAt - this.now());
  }

  _formatMinutes(ms) {
    return Math.max(1, Math.ceil((Math.max(0, Number(ms) || 0)) / 60000));
  }

  _protectionState(entry, nowTs = this.now()) {
    const guardUntil = Math.max(0, Math.floor(Number(entry?.guardUntil) || 0));
    const immunityUntil = Math.max(0, Math.floor(Number(entry?.immunityUntil) || 0));
    const guardActive = guardUntil > nowTs;
    const immunityActive = immunityUntil > nowTs;
    return {
      guardUntil,
      immunityUntil,
      guardActive,
      immunityActive,
      guardLeftMs: guardActive ? (guardUntil - nowTs) : 0,
      immunityLeftMs: immunityActive ? (immunityUntil - nowTs) : 0
    };
  }

  _formatHoursLeft(ms) {
    return Math.max(1, Math.ceil((Math.max(0, Number(ms) || 0)) / (60 * 60 * 1000)));
  }

  getProtectionUiModel(owner, bizId) {
    const biz = String(bizId || "");
    const B = CONFIG?.BUSINESS?.[biz];
    if (!B) return { ok: false, error: "biz_unavailable" };
    const found = this._findOwnedEntry(owner, biz);
    if (found.idx < 0 || !found.entry) return { ok: false, error: "not_owned" };

    const state = this._protectionState(found.entry);
    return {
      ok: true,
      bizId: biz,
      guardPrice: this._guardPrice(biz),
      guardDurationHours: Math.round(this._guardDurationMs() / (60 * 60 * 1000)),
      guardActive: state.guardActive,
      guardLeftMs: state.guardLeftMs,
      guardLeftHours: this._formatHoursLeft(state.guardLeftMs),
      immunityActive: state.immunityActive,
      immunityLeftMs: state.immunityLeftMs,
      immunityLeftHours: this._formatHoursLeft(state.immunityLeftMs),
      immunityOptions: this._immunityOptions(),
      guardBlocked: Math.max(0, Math.floor(Number(found.entry.guardBlocked) || 0))
    };
  }

  async buyGuard(owner, bizId, { forceReset = false } = {}) {
    const biz = String(bizId || "");
    const B = CONFIG?.BUSINESS?.[biz];
    if (!B) return { ok: false, error: this._t(owner, "thief.err.biz_unavailable") };

    const found = this._findOwnedEntry(owner, biz);
    if (found.idx < 0 || !found.entry) return { ok: false, error: this._t(owner, "handler.business.not_owned") };

    const state = this._protectionState(found.entry);
    if (state.immunityActive) {
      return { ok: false, error: this._t(owner, "biz.protect.err.immunity_active") };
    }
    if (state.guardActive && !forceReset) {
      return { ok: false, needConfirm: true, leftMs: state.guardLeftMs, leftHours: this._formatHoursLeft(state.guardLeftMs) };
    }

    const price = this._guardPrice(biz);
    const money = Math.max(0, Math.floor(Number(owner?.money) || 0));
    if (money < price) {
      return { ok: false, error: this._t(owner, "handler.business.not_enough_money") };
    }

    owner.money = money - price;
    found.entry.guardUntil = this.now() + this._guardDurationMs();
    found.entry.immunityUntil = 0;
    found.arr[found.idx] = found.entry;
    owner.biz = owner.biz || {};
    owner.biz.owned = found.arr;
    await this.users.save(owner);
    await this._markProtectionDue("guard", owner.id, biz, found.entry.guardUntil);

    return {
      ok: true,
      price,
      guardUntil: found.entry.guardUntil,
      guardHours: Math.round(this._guardDurationMs() / (60 * 60 * 1000)),
      wasReset: state.guardActive
    };
  }

  async buyImmunity(owner, bizId, hours, { confirmGuardReset = false } = {}) {
    const biz = String(bizId || "");
    const B = CONFIG?.BUSINESS?.[biz];
    if (!B) return { ok: false, error: this._t(owner, "thief.err.biz_unavailable") };

    const found = this._findOwnedEntry(owner, biz);
    if (found.idx < 0 || !found.entry) return { ok: false, error: this._t(owner, "handler.business.not_owned") };

    const safeHours = Math.max(1, Math.floor(Number(hours) || 0));
    const priceGems = this._immunityPrice(safeHours);
    if (priceGems <= 0) {
      return { ok: false, error: this._t(owner, "biz.protect.err.bad_option") };
    }

    const state = this._protectionState(found.entry);
    if (state.guardActive && !confirmGuardReset) {
      return {
        ok: false,
        needConfirmGuardReset: true,
        leftMs: state.guardLeftMs,
        leftHours: this._formatHoursLeft(state.guardLeftMs),
        hours: safeHours,
        gems: priceGems
      };
    }

    const gems = Math.max(0, Math.floor(Number(owner?.premium) || 0));
    if (gems < priceGems) {
      return { ok: false, error: this._t(owner, "handler.upgrades.not_enough_gems", { emoji: CONFIG?.PREMIUM?.emoji || "💎", need: priceGems }) };
    }

    owner.premium = gems - priceGems;
    const durationMs = safeHours * 60 * 60 * 1000;
    found.entry.immunityUntil = this.now() + durationMs;
    found.entry.guardUntil = 0;
    found.arr[found.idx] = found.entry;
    owner.biz = owner.biz || {};
    owner.biz.owned = found.arr;
    await this.users.save(owner);
    await this._markProtectionDue("immunity", owner.id, biz, found.entry.immunityUntil);

    return {
      ok: true,
      hours: safeHours,
      gems: priceGems,
      immunityUntil: found.entry.immunityUntil,
      guardCanceled: state.guardActive
    };
  }

  async buildMainView(attacker) {
    attacker = await this._ensureAttackerState(attacker);
    const level = Math.max(0, Math.floor(Number(attacker?.thief?.level) || 0));
    const maxLevel = Math.max(0, Number(this._cfg()?.MAX_LEVEL) || 5);
    const nextLevel = Math.min(maxLevel, level + 1);
    const lines = [
      this._t(attacker, "thief.view.title"),
      "",
      this._t(attacker, "thief.view.level", { level, maxLevel }),
      this._t(attacker, "thief.view.rule", { mins: this._formatMinutes(this._reactionWindowMs()) })
    ];

    const activeId = String(attacker?.thief?.activeAttackId || "");
    if (activeId) {
      const attack = await this._loadAttack(activeId);
      if (attack) {
        const bizTitle = this._bizTitle(attack.bizId, attacker);
        if (String(attack.status || "") === "battle") {
          const battle = await this._loadDefenseBattle(activeId);
          lines.push(this._t(attacker, "thief.view.active_battle", {
            bizTitle,
            round: Math.max(1, Math.floor(Number(battle?.currentRound) || 1)),
            totalRounds: Math.max(1, Math.floor(Number(battle?.totalRounds) || this._defenseRounds()))
          }));
        } else {
          const leftMin = this._formatMinutes(Number(attack.resolveAt || 0) - this.now());
          lines.push(this._t(attacker, "thief.view.active_attack", { bizTitle, leftMin }));
        }
      }
    }

    const kb = [];
    if (level < maxLevel) {
      const cost = this._upgradeCost(nextLevel);
      kb.push([{ text: this._t(attacker, "thief.btn.upgrade", { nextLevel, cost: this._money(attacker, cost) }), callback_data: "thief:upgrade" }]);
    } else {
      lines.push(this._t(attacker, "thief.view.max_level"));
    }

    const unlocked = this._unlockedBizIds(level);
    if (!unlocked.length) {
      lines.push("");
      lines.push(this._t(attacker, "thief.view.unlock_hint"));
    } else {
      lines.push("");
      lines.push(this._t(attacker, "thief.view.targets_title"));
      for (const bizId of unlocked) {
        const B = CONFIG?.BUSINESS?.[bizId];
        const title = this._bizTitle(bizId, attacker);
        const leftMs = this._cooldownLeftMs(attacker, bizId);
        const cdPart = leftMs > 0
          ? ` (${this._t(attacker, "thief.view.cooldown_short", { mins: this._formatMinutes(leftMs) })})`
          : "";
        kb.push([{ text: `${B?.emoji || "🏢"} ${title}${cdPart}`, callback_data: `thief:targets:${bizId}` }]);
      }
    }

    kb.push([{ text: this._t(attacker, "thief.btn.help"), callback_data: "thief:help" }]);
    kb.push([{ text: this._t(attacker, "thief.btn.refresh"), callback_data: "go:Thief" }]);
    kb.push([{ text: this._t(attacker, "thief.btn.back_city"), callback_data: "go:City" }]);

    return { caption: lines.join("\n"), keyboard: kb };
  }

  async buildHelpView(user) {
    const helpAsset = String(this._cfg()?.HELP_ASSET || "").trim();
    const maxLevel = Math.max(1, Number(this._cfg()?.MAX_LEVEL) || 5);
    const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
    const energyMultiplier = 2;
    const cooldownUnit = this._lang(user) === "en" ? "m" : (this._lang(user) === "uk" ? "хв" : "мин");
    const cooldownByLevel = levels.map((lvl) => `${lvl}→${this._cooldownMinutes(lvl)}${cooldownUnit}`).join(", ");
    const costsByLevel = levels.map((lvl) => `${lvl}→${this._money(user, this._upgradeCost(lvl))}`).join(", ");
    const pct = this._attackPctRange();
    const stealPctMin = Math.round(Number(pct.min || 0) * 100);
    const stealPctMax = Math.round(Number(pct.max || 0) * 100);
    const ownerMinPct = Math.round(this._ownerRemainPct() * 100);
    const attempts = this._dailyAttemptsLimit();
    const protectHours = Math.round(this._minAccountAgeMs() / (60 * 60 * 1000));
    const minTarget = this._money(user, this._minTargetCash());
    const baseReactionMins = this._formatMinutes(this._reactionWindowMs());
    const guardReactionMins = this._formatMinutes(this._reactionWindowMs() + this._guardExtraWindowMs());

    const lines = [
      this._t(user, "thief.help.title"),
      "",
      this._t(user, "thief.help.line1"),
      this._t(user, "thief.help.line2", { energyMultiplier }),
      this._t(user, "thief.help.line3"),
      this._t(user, "thief.help.line4", { mins: this._formatMinutes(this._reactionWindowMs()) }),
      this._t(user, "thief.help.line5", { stealPctMin, stealPctMax }),
      this._t(user, "thief.help.line6", { ownerMinPct }),
      this._t(user, "thief.help.line7"),
      this._t(user, "thief.help.line8", { energyMultiplier }),
      this._t(user, "thief.help.line9"),
      this._t(user, "thief.help.line10", { cooldownByLevel }),
      this._t(user, "thief.help.line11", { attempts }),
      this._t(user, "thief.help.line12"),
      this._t(user, "thief.help.line13", { protectHours }),
      this._t(user, "thief.help.line14", { minTarget }),
      this._t(user, "thief.help.line15", { costsByLevel }),
      "",
      this._t(user, "thief.help.line16")
    ];

    for (const bizId of this._allBusinessIds()) {
      const cfg = this._bizCfg(bizId);
      const B = CONFIG?.BUSINESS?.[bizId];
      if (!cfg || !B) continue;
      lines.push(this._t(user, "thief.help.biz_line", {
        emoji: B.emoji || "🏢",
        bizTitle: this._bizTitle(bizId, user),
        unlock: Math.max(1, Math.floor(Number(cfg.unlockLevel) || 1)),
        attack: this._attackEnergy(bizId),
        mins: baseReactionMins,
        guardMins: guardReactionMins
      }));
    }

    return {
      caption: lines.join("\n"),
      asset: helpAsset || undefined,
      keyboard: [[{ text: this._t(user, "thief.btn.back"), callback_data: "go:Thief" }]]
    };
  }

  async buildTargetsView(attacker, bizId) {
    attacker = await this._ensureAttackerState(attacker);
    const biz = String(bizId || "");
    const bizCfg = this._bizCfg(biz);
    const B = CONFIG?.BUSINESS?.[biz];
    if (!bizCfg || !B) {
      return {
        caption: this._t(attacker, "thief.err.biz_unavailable"),
        keyboard: [[{ text: this._t(attacker, "thief.btn.back"), callback_data: "go:Thief" }]]
      };
    }

    const level = Math.max(0, Number(attacker?.thief?.level) || 0);
    if (!this._bizUnlocked(level, biz)) {
      return {
        caption: this._t(attacker, "thief.err.level_too_low", { level: bizCfg.unlockLevel }),
        keyboard: [[{ text: this._t(attacker, "thief.btn.back"), callback_data: "go:Thief" }]]
      };
    }

    const activeAttackId = String(attacker?.thief?.activeAttackId || "");
    if (activeAttackId) {
      const attack = await this._loadAttack(activeAttackId);
      if (attack) {
        return {
          caption: this._t(attacker, "thief.err.active_attack_exists"),
          keyboard: [[{ text: this._t(attacker, "thief.btn.back"), callback_data: "go:Thief" }]]
        };
      }
    }

    const cooldownMs = this._cooldownLeftMs(attacker, biz);
    if (cooldownMs > 0) {
      return {
        caption: this._t(attacker, "thief.err.on_cooldown", { mins: this._formatMinutes(cooldownMs) }),
        keyboard: [[{ text: this._t(attacker, "thief.btn.back"), callback_data: "go:Thief" }]]
      };
    }

    let ownerIds = await this._loadOwnersIndex(biz);
    if (!ownerIds.length) {
      ownerIds = await this.rebuildBizOwnersIndex(biz, { limit: 1000 });
    }

    const todayUTC = getTodayUTC(this.now());
    const minAvailable = this._minTargetCash();
    const attemptsLimit = this._dailyAttemptsLimit();
    const minCreatedAt = this.now() - this._minAccountAgeMs();
    const lines = [
      this._t(attacker, "thief.targets.title", { bizTitle: this._bizTitle(biz, attacker) }),
      this._t(attacker, "thief.targets.energy_cost", {
        attackEnergy: this._attackEnergy(biz),
        startNeed: this._attackEnergy(biz) * 2
      }),
      ""
    ];
    const kb = [];

    let shown = 0;
    for (const ownerId of ownerIds) {
      if (shown >= 12) break;
      if (String(ownerId) === String(attacker?.id || "")) continue;

      const owner = await this.users.load(ownerId).catch(() => null);
      if (!owner) continue;
      if (Number(owner.createdAt || 0) > minCreatedAt) continue;

      const lock = await this.db.get(this._activeTargetKey(ownerId, biz)).catch(() => "");
      if (String(lock || "").trim()) continue;

      const attempts = await this._attemptsToday(ownerId, biz, todayUTC);
      if (attempts >= attemptsLimit) continue;

      const availableInfo = this._availableForOwner(owner, biz, todayUTC);
      if (this._protectionState(availableInfo.entry).immunityActive) continue;
      if (availableInfo.available < minAvailable) continue;

      const ownerName = this._userName(owner, attacker);
      const pctRange = this._attackPctRange();
      const stealMinRaw = Math.max(1, Math.floor(availableInfo.daily * pctRange.min));
      const stealMaxRaw = Math.max(1, Math.floor(availableInfo.daily * pctRange.max));
      const stealMin = Math.max(0, Math.min(stealMinRaw, availableInfo.available));
      const stealMax = Math.max(0, Math.min(stealMaxRaw, availableInfo.available));
      lines.push(this._t(attacker, "thief.targets.row", {
        ownerName,
        available: this._money(attacker, availableInfo.available),
        stealMin: this._money(attacker, stealMin),
        stealMax: this._money(attacker, stealMax)
      }));
      kb.push([{
        text: this._t(attacker, "thief.btn.attack", { ownerName }),
        callback_data: `thief:attack:${biz}:${ownerId}`
      }]);
      shown += 1;
    }

    if (!shown) {
      lines.push(this._t(attacker, "thief.targets.empty"));
    }

    kb.push([{ text: this._t(attacker, "thief.btn.back"), callback_data: "go:Thief" }]);
    return { caption: lines.join("\n"), keyboard: kb };
  }

  async upgradeLevel(u) {
    this._ensureThiefState(u);
    const level = Math.max(0, Math.floor(Number(u?.thief?.level) || 0));
    const maxLevel = Math.max(0, Number(this._cfg()?.MAX_LEVEL) || 5);
    if (level >= maxLevel) {
      return { ok: false, error: this._t(u, "thief.err.max_level") };
    }

    const nextLevel = level + 1;
    const cost = this._upgradeCost(nextLevel);
    const money = Math.max(0, Math.floor(Number(u?.money) || 0));
    if (money < cost) {
      return {
        ok: false,
        error: this._t(u, "thief.err.not_enough_money", { cost: this._money(u, cost) })
      };
    }

    u.money = money - cost;
    u.thief.level = nextLevel;
    await this.users.save(u);
    return { ok: true, level: nextLevel, cost };
  }

  async startAttack(attacker, bizId, ownerId) {
    attacker = await this._ensureAttackerState(attacker);
    this._ensureThiefState(attacker);

    const biz = String(bizId || "");
    const ownerUserId = String(ownerId || "");
    const bizCfg = this._bizCfg(biz);
    if (!bizCfg || !CONFIG?.BUSINESS?.[biz]) {
      return { ok: false, error: this._t(attacker, "thief.err.biz_unavailable") };
    }
    if (!ownerUserId || ownerUserId === String(attacker?.id || "")) {
      return { ok: false, error: this._t(attacker, "thief.err.invalid_target") };
    }

    const level = Math.max(0, Math.floor(Number(attacker?.thief?.level) || 0));
    if (!this._bizUnlocked(level, biz)) {
      return { ok: false, error: this._t(attacker, "thief.err.level_too_low", { level: bizCfg.unlockLevel }) };
    }

    if (String(attacker?.thief?.activeAttackId || "").trim()) {
      return { ok: false, error: this._t(attacker, "thief.err.active_attack_exists") };
    }

    const cooldownMs = this._cooldownLeftMs(attacker, biz);
    if (cooldownMs > 0) {
      return { ok: false, error: this._t(attacker, "thief.err.on_cooldown", { mins: this._formatMinutes(cooldownMs) }) };
    }

    const attackEnergy = this._attackEnergy(biz);
    const requiredEnergy = attackEnergy * 2;
    if (Math.max(0, Number(attacker?.energy) || 0) < requiredEnergy) {
      return {
        ok: false,
        code: "not_enough_energy",
        needEnergy: Math.max(0, Number(requiredEnergy) || 0),
        haveEnergy: Math.max(0, Number(attacker?.energy) || 0),
        error: this._t(attacker, "thief.err.not_enough_energy", { need: requiredEnergy })
      };
    }

    const owner = await this.users.load(ownerUserId).catch(() => null);
    if (!owner) {
      return { ok: false, error: this._t(attacker, "thief.err.target_not_found") };
    }

    const minCreatedAt = this.now() - this._minAccountAgeMs();
    if (Number(owner?.createdAt || 0) > minCreatedAt) {
      return { ok: false, error: this._t(attacker, "thief.err.target_protected") };
    }

    const lockKey = this._activeTargetKey(ownerUserId, biz);
    const existingLock = String(await this.db.get(lockKey).catch(() => "") || "").trim();
    if (existingLock) {
      return { ok: false, error: this._t(attacker, "thief.err.target_busy") };
    }

    const todayUTC = getTodayUTC(this.now());
    const attempts = await this._attemptsToday(ownerUserId, biz, todayUTC);
    if (attempts >= this._dailyAttemptsLimit()) {
      return { ok: false, error: this._t(attacker, "thief.err.attempts_limit") };
    }

    const availableInfo = this._availableForOwner(owner, biz, todayUTC);
    const protection = this._protectionState(availableInfo.entry);
    if (protection.immunityActive) {
      return { ok: false, error: this._t(attacker, "thief.err.target_immune") };
    }
    if (availableInfo.available < this._minTargetCash()) {
      return { ok: false, error: this._t(attacker, "thief.err.not_enough_cash_in_target") };
    }

    const createdAt = this.now();
    const guardApplied = protection.guardActive;
    const resolveAt = createdAt + this._reactionWindowMs() + (guardApplied ? this._guardExtraWindowMs() : 0);
    const attackId = `${createdAt}_${String(attacker.id)}_${Math.floor(Math.random() * 1_000_000)}`;
    const attack = {
      id: attackId,
      status: "active",
      createdAt,
      resolveAt,
      attackerId: String(attacker.id),
      ownerId: ownerUserId,
      bizId: biz,
      levelAtStart: level,
      attackEnergy,
      cooldownMinutes: this._cooldownMinutes(level)
    };

    attacker.energy = Math.max(0, Math.floor(Number(attacker.energy) || 0) - attackEnergy);
    attacker.thief.activeAttackId = attackId;
    let questStartRes = null;
    if (this.quests?.onEvent) {
      try {
        questStartRes = await this.quests.onEvent(attacker, "thief_attempt", { bizId: biz }, {
          persist: false,
          notify: false
        });
      } catch {}
    }
    await this.users.save(attacker);
    if (questStartRes?.events?.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(attacker, questStartRes.events);
    }

    await this._saveAttack(attack);
    await this.db.put(lockKey, attackId, { expirationTtl: Math.max(60, Math.ceil((resolveAt - this.now()) / 1000) + 2 * 60 * 60) });
    await this._increaseAttemptsToday(ownerUserId, biz, todayUTC);
    await this._markDueAttack(attackId, resolveAt);

    if (owner?.chatId) {
      const mins = this._formatMinutes(resolveAt - this.now());
      const bizTitleOwner = this._bizTitle(biz, owner);
      await this._sendInline(
        owner.chatId,
        this._t(owner, "thief.notify.owner_attack_started", { bizTitle: bizTitleOwner, mins }),
        [[{ text: this._t(owner, "thief.btn.defend"), callback_data: `thief:defend:${attackId}` }]]
      );
    }

    return {
      ok: true,
      attackId,
      resolveAt,
      mins: this._formatMinutes(resolveAt - this.now())
    };
  }

  async defend(owner, attackId) {
    const id = String(attackId || "").trim();
    if (!id) return { ok: false, error: this._t(owner, "thief.err.attack_not_found") };

    const attack = await this._loadAttack(id);
    if (!attack || !["active", "battle"].includes(String(attack.status || ""))) {
      return { ok: false, error: this._t(owner, "thief.err.attack_not_found") };
    }
    if (String(attack.ownerId || "") !== String(owner?.id || "")) {
      return { ok: false, error: this._t(owner, "thief.err.not_your_attack") };
    }
    if (String(attack.status || "") === "active" && Number(attack.resolveAt || 0) <= this.now()) {
      return { ok: false, error: this._t(owner, "thief.err.attack_already_resolved") };
    }
    const existingBattle = await this._loadDefenseBattle(id);
    if (existingBattle && String(existingBattle.status || "") === "active") {
      return { ok: true, battleStarted: false, attackId: id };
    }

    const battle = {
      id: id,
      attackId: id,
      bizId: String(attack.bizId || ""),
      ownerId: String(attack.ownerId || ""),
      thiefId: String(attack.attackerId || ""),
      status: "active",
      currentRound: 1,
      totalRounds: this._defenseRounds(),
      roundDeadline: this.now() + this._defenseRoundWindowMs(),
      ownerScore: 0,
      thiefScore: 0,
      rounds: [],
      selections: {
        owner: { attack: "", defense: "", submittedAt: 0 },
        thief: { attack: "", defense: "", submittedAt: 0 }
      },
      result: { winnerSide: "", reason: "" },
      createdAt: this.now(),
      updatedAt: this.now(),
      finishedAt: 0
    };

    attack.status = "battle";
    attack.battleStartedAt = this.now();
    attack.battleRoundDeadline = battle.roundDeadline;
    await this._saveAttack(attack);
    await this._saveDefenseBattle(battle);
    await this._markDueDefenseBattle(id, battle.roundDeadline);

    const attacker = await this.users.load(attack.attackerId).catch(() => null);
    if (attacker?.chatId) {
      const bizTitle = this._bizTitle(attack.bizId, attacker);
      await this._sendInline(
        attacker.chatId,
        this._t(attacker, "thief.notify.defense_battle_started_thief", { bizTitle }),
        [[{ text: this._t(attacker, "thief.btn.open_battle"), callback_data: `thief:def:open:${id}` }]]
      );
    }

    if (owner?.chatId) {
      const bizTitle = this._bizTitle(attack.bizId, owner);
      await this._sendInline(
        owner.chatId,
        this._t(owner, "thief.notify.defense_battle_started_owner", { bizTitle }),
        [[{ text: this._t(owner, "thief.btn.open_battle"), callback_data: `thief:def:open:${id}` }]]
      );
    }

    return { ok: true, battleStarted: true, attackId: id };
  }

  _battleSideForUser(battle, userId) {
    const uid = String(userId || "");
    if (uid && uid === String(battle?.ownerId || "")) return "owner";
    if (uid && uid === String(battle?.thiefId || "")) return "thief";
    return "";
  }

  _battleOpponentSide(side) {
    return side === "owner" ? "thief" : "owner";
  }

  _emptyBattleSelection() {
    return { attack: "", defense: "", submittedAt: 0 };
  }

  _sanitizeBattleSelection(raw) {
    const attack = String(raw?.attack || "");
    const defense = String(raw?.defense || "");
    const submittedAt = Math.max(0, Math.floor(Number(raw?.submittedAt) || 0));
    if (isCombatZone(attack) && !defense) {
      return { attack, defense: "", submittedAt: 0 };
    }
    if (!isCombatSelectionValid(attack, defense)) return this._emptyBattleSelection();
    return { attack, defense, submittedAt };
  }

  _battleRoundReady(battle) {
    const ownerSel = this._sanitizeBattleSelection(battle?.selections?.owner);
    const thiefSel = this._sanitizeBattleSelection(battle?.selections?.thief);
    return !!ownerSel.submittedAt && !!thiefSel.submittedAt;
  }

  _battlePlayerLabel(user, battle, side) {
    if (side === "owner") return this._userName(user, user);
    return this._userName(user, user);
  }

  _zoneLabel(user, zone) {
    const safeZone = String(zone || "").trim();
    if (!safeZone) return "—";
    return this._t(user, `colosseum.zone_${safeZone}`);
  }

  _zoneAttackButton(user, zone) {
    return this._t(user, `colosseum.btn_atk_${String(zone || "")}`);
  }

  _zoneDefenseButton(user, zone) {
    return this._t(user, `colosseum.btn_def_${String(zone || "")}`);
  }

  _battleLinesForRound(user, round, side) {
    const me = side === "owner" ? round.owner : round.thief;
    const them = side === "owner" ? round.thief : round.owner;
    const rawOutcome = String(round?.outcome || "draw");
    const perspectiveOutcome = side === "owner"
      ? rawOutcome
      : (rawOutcome === "win" ? "lose" : (rawOutcome === "lose" ? "win" : "draw"));
    return [
      this._t(user, "thief.defense.round_title", { round: round.round }),
      this._t(user, "thief.defense.round_line_you", {
        attack: this._zoneLabel(user, me.attack),
        defense: this._zoneLabel(user, me.defense),
        damage: me.dealt
      }),
      this._t(user, "thief.defense.round_line_enemy", {
        attack: this._zoneLabel(user, them.attack),
        defense: this._zoneLabel(user, them.defense),
        damage: them.dealt
      }),
      this._t(user, `thief.defense.round_outcome_${perspectiveOutcome}`)
    ];
  }

  async buildDefenseBattleView(user, attackId) {
    const attack = await this._loadAttack(attackId);
    const battle = await this._loadDefenseBattle(attackId);
    const battleAsset = String(this._defenseCfg()?.ASSET || "").trim();
    if (!battle) {
      return {
        caption: this._t(user, "thief.err.attack_not_found"),
        keyboard: [[{ text: this._t(user, "thief.btn.back"), callback_data: "go:Business" }]]
      };
    }

    const side = this._battleSideForUser(battle, user?.id);
    if (!side) {
      return {
        caption: this._t(user, "thief.err.not_your_attack"),
        keyboard: [[{ text: this._t(user, "thief.btn.back"), callback_data: "go:Business" }]]
      };
    }

    const ownerUser = await this.users.load(battle.ownerId).catch(() => null);
    const thiefUser = await this.users.load(battle.thiefId).catch(() => null);
    const ownerName = this._userName(ownerUser || { id: battle.ownerId }, user);
    const thiefName = this._userName(thiefUser || { id: battle.thiefId }, user);
    const bizTitle = this._bizTitle(battle.bizId, user);
    const lines = [
      this._t(user, "thief.defense.title", { bizTitle }),
      "",
      this._t(user, "thief.defense.vs", { ownerName, thiefName }),
      this._t(user, "thief.defense.score", { owner: battle.ownerScore || 0, thief: battle.thiefScore || 0 })
    ];

    for (const round of Array.isArray(battle.rounds) ? battle.rounds : []) {
      lines.push("");
      lines.push(...this._battleLinesForRound(user, round, side));
    }

    const kb = [];
    if (String(battle.status || "") === "finished") {
      lines.push("");
      lines.push(this._t(user, `thief.defense.result_${battle?.result?.winnerSide === "thief" ? "thief" : "owner"}`));
      kb.push([{ text: this._t(user, "thief.btn.back"), callback_data: "go:Business" }]);
      return { caption: lines.join("\n"), asset: battleAsset || undefined, keyboard: kb };
    }

    const me = this._sanitizeBattleSelection(battle?.selections?.[side]);
    const timeLeftSec = Math.max(0, Math.ceil((Number(battle.roundDeadline || 0) - this.now()) / 1000));
    lines.push("");
    lines.push(this._t(user, "thief.defense.round_header", {
      round: battle.currentRound || 1,
      totalRounds: battle.totalRounds || this._defenseRounds()
    }));
    lines.push(this._t(user, "thief.defense.deadline", { secs: timeLeftSec }));

    if (!me.attack) {
      lines.push("");
      lines.push(this._t(user, "thief.defense.pick_attack"));
      kb.push([
        { text: this._zoneAttackButton(user, "head"), callback_data: `thief:def:atk:${attackId}:head` },
        { text: this._zoneAttackButton(user, "body"), callback_data: `thief:def:atk:${attackId}:body` }
      ]);
      kb.push([
        { text: this._zoneAttackButton(user, "legs"), callback_data: `thief:def:atk:${attackId}:legs` }
      ]);
    } else if (!me.defense) {
      lines.push("");
      lines.push(this._t(user, "thief.defense.pick_defense", { attack: this._zoneLabel(user, me.attack) }));
      const options = combatDefenseOptions(me.attack);
      kb.push(options.map((zone) => ({
        text: this._zoneDefenseButton(user, zone),
        callback_data: `thief:def:def:${attackId}:${zone}`
      })));
    } else {
      lines.push("");
      lines.push(this._t(user, "thief.defense.waiting"));
    }

    kb.push([{ text: this._t(user, "thief.btn.refresh"), callback_data: `thief:def:open:${attackId}` }]);
    kb.push([{ text: this._t(user, "thief.btn.back"), callback_data: "go:Business" }]);
    return { caption: lines.join("\n"), asset: battleAsset || undefined, keyboard: kb };
  }

  async pickDefenseBattleAttack(user, attackId, zone) {
    const attack = await this._loadAttack(attackId);
    const battle = await this._loadDefenseBattle(attackId);
    if (!attack || !battle || String(battle.status || "") !== "active") {
      return { ok: false, error: this._t(user, "thief.err.attack_not_found") };
    }
    const side = this._battleSideForUser(battle, user?.id);
    if (!side) return { ok: false, error: this._t(user, "thief.err.not_your_attack") };
    const safeZone = String(zone || "");
    if (!isCombatZone(safeZone)) return { ok: false, error: this._t(user, "thief.err.bad_zone") };

    const current = this._sanitizeBattleSelection(battle.selections?.[side]);
    current.attack = safeZone;
    current.defense = "";
    current.submittedAt = 0;
    battle.selections = battle.selections || {};
    battle.selections[side] = current;
    battle.updatedAt = this.now();
    await this._saveDefenseBattle(battle);
    return { ok: true, needDefense: true };
  }

  async pickDefenseBattleDefense(user, attackId, zone) {
    const attack = await this._loadAttack(attackId);
    const battle = await this._loadDefenseBattle(attackId);
    if (!attack || !battle || String(battle.status || "") !== "active") {
      return { ok: false, error: this._t(user, "thief.err.attack_not_found") };
    }
    const side = this._battleSideForUser(battle, user?.id);
    if (!side) return { ok: false, error: this._t(user, "thief.err.not_your_attack") };
    const safeZone = String(zone || "");
    const current = this._sanitizeBattleSelection(battle.selections?.[side]);
    if (!isCombatSelectionValid(current.attack, safeZone)) {
      return { ok: false, error: this._t(user, "thief.err.bad_zone") };
    }

    current.defense = safeZone;
    current.submittedAt = this.now();
    battle.selections = battle.selections || {};
    battle.selections[side] = current;
    battle.updatedAt = this.now();
    await this._saveDefenseBattle(battle);

    if (this._battleRoundReady(battle)) {
      return await this._resolveDefenseRoundIfReady(attack, battle, { source: "click" });
    }
    return { ok: true, waiting: true };
  }

  async _resolveDefenseRoundIfReady(attack, battle, { source = "click", forceTimeout = false } = {}) {
    if (!attack || !battle || String(battle.status || "") !== "active") {
      return { ok: false, skipped: true };
    }

    const ownerSel = forceTimeout
      ? this._sanitizeBattleSelection(battle?.selections?.owner)
      : this._sanitizeBattleSelection(battle?.selections?.owner);
    const thiefSel = forceTimeout
      ? this._sanitizeBattleSelection(battle?.selections?.thief)
      : this._sanitizeBattleSelection(battle?.selections?.thief);

    const ready = this._battleRoundReady(battle) || forceTimeout;
    if (!ready) return { ok: false, skipped: true };

    const round = resolveCombatRound(ownerSel, thiefSel);
    const ownerDealt = round.left.dealt;
    const thiefDealt = round.right.dealt;
    battle.ownerScore = Math.max(0, Math.floor(Number(battle.ownerScore) || 0) + ownerDealt);
    battle.thiefScore = Math.max(0, Math.floor(Number(battle.thiefScore) || 0) + thiefDealt);
    const outcome = ownerDealt > thiefDealt ? "win" : (ownerDealt < thiefDealt ? "lose" : "draw");
    battle.rounds = Array.isArray(battle.rounds) ? battle.rounds : [];
    battle.rounds.push({
      round: Math.max(1, Math.floor(Number(battle.currentRound) || 1)),
      owner: { attack: ownerSel.attack, defense: ownerSel.defense, dealt: ownerDealt, taken: round.left.taken },
      thief: { attack: thiefSel.attack, defense: thiefSel.defense, dealt: thiefDealt, taken: round.right.taken },
      outcome
    });

    if ((battle.currentRound || 1) >= (battle.totalRounds || this._defenseRounds())) {
      return await this._finalizeDefenseBattle(attack, battle, { source });
    }

    battle.currentRound = Math.max(1, Math.floor(Number(battle.currentRound) || 1)) + 1;
    battle.roundDeadline = this.now() + this._defenseRoundWindowMs();
    battle.selections = { owner: this._emptyBattleSelection(), thief: this._emptyBattleSelection() };
    battle.updatedAt = this.now();
    await this._saveDefenseBattle(battle);
    await this._markDueDefenseBattle(attack.id, battle.roundDeadline);
    return { ok: true, advanced: true };
  }

  async _resolveAttackSuccess(attack, { source = "cron" } = {}) {
    const attacker = await this.users.load(attack.attackerId).catch(() => null);
    const owner = await this.users.load(attack.ownerId).catch(() => null);
    const bizId = String(attack.bizId || "");
    const todayUTC = getTodayUTC(this.now());

    let success = false;
    let stolen = 0;
    let revealEventId = "";
    if (owner && CONFIG?.BUSINESS?.[bizId]) {
      const avail = this._availableForOwner(owner, bizId, todayUTC);
      const available = Math.max(0, Math.floor(Number(avail.available) || 0));
      if (available >= this._minTargetCash() && avail.entry) {
        const daily = Math.max(0, Number(avail.daily) || 0);
        const range = this._attackPctRange();
        const percent = this._rand(range.min, range.max);
        const rawStolen = Math.max(1, Math.floor(daily * percent));
        stolen = Math.max(0, Math.min(rawStolen, available));
        if (stolen > 0) {
          const applied = addBusinessPendingTheft(avail.entry, daily, stolen, this._ownerRemainPct());
          stolen = Math.max(0, applied);
          success = stolen > 0;
          if (success) {
            revealEventId = this._appendTheftLog(owner, bizId, {
              thiefId: String(attack.attackerId || ""),
              amount: stolen,
              ts: this.now(),
              revealed: false
            });
            await this.users.save(owner);
          }
        }
      }
    }

    if (attacker) {
      this._ensureThiefState(attacker);
      if (String(attacker.thief.activeAttackId || "") === String(attack.id || "")) {
        attacker.thief.activeAttackId = "";
      }

      let attackerAch = null;
      let attackerQuest = null;
      if (success) {
        attacker.money = Math.max(0, Math.floor(Number(attacker.money) || 0) + stolen);
        attacker.thief.totalStolen = Math.max(0, Math.floor(Number(attacker.thief.totalStolen) || 0) + Math.max(0, Math.floor(Number(stolen) || 0)));
        if (this.achievements?.onEvent) {
          try {
            attackerAch = await this.achievements.onEvent(attacker, "thief_success", { amount: stolen, bizId }, { persist: false, notify: false });
          } catch {}
        }
        if (this.quests?.onEvent) {
          try {
            attackerQuest = await this.quests.onEvent(attacker, "thief_success", { amount: stolen, bizId }, { persist: false, notify: false });
          } catch {}
        }
      } else {
        const attackEnergy = Math.max(1, Math.floor(Number(attack.attackEnergy) || this._attackEnergy(bizId)));
        attacker.energy = Math.max(0, Math.floor(Number(attacker.energy) || 0) - attackEnergy);
        const cooldownUntil = this.now() + Math.max(1, Math.floor(Number(attack.cooldownMinutes) || 0)) * 60_000;
        attacker.thief.cooldowns = attacker.thief.cooldowns || {};
        attacker.thief.cooldowns[bizId] = cooldownUntil;
        if (this.achievements?.onEvent) {
          try {
            attackerAch = await this.achievements.onEvent(attacker, "thief_fail", { bizId, reason: "resolve_fail" }, { persist: false, notify: false });
          } catch {}
        }
      }

      await this.users.save(attacker);
      if (success && stolen > 0) await this._recordDailyStolen(attacker, stolen, todayUTC);
      if (success && this.ratings?.updateUser) {
        try { await this.ratings.updateUser(attacker, ["thief"]); } catch {}
      }
      if (attackerAch?.newlyEarned?.length && this.achievements?.notifyEarned) {
        await this.achievements.notifyEarned(attacker, attackerAch.newlyEarned);
      }
      if (attackerQuest?.events?.length && this.quests?.notifyEvents) {
        await this.quests.notifyEvents(attacker, attackerQuest.events);
      }
    }

    await this._deleteAttack(attack);

    if (success) {
      if (owner?.chatId && !String(source || "").startsWith("battle")) {
        const bizTitle = this._bizTitle(bizId, owner);
        const cost = this._money(owner, this._revealCost());
        const revealKb = revealEventId
          ? [[{ text: this._t(owner, "thief.btn.reveal", { cost }), callback_data: `thief:reveal:${revealEventId}` }]]
          : [[{ text: this._t(owner, "thief.btn.business"), callback_data: "go:Business" }]];
        await this._sendInline(owner.chatId, this._t(owner, "thief.notify.owner_robbed_unknown", { bizTitle, amount: this._money(owner, stolen) }), revealKb);
      }
      if (attacker?.chatId) {
        const bizTitle = this._bizTitle(bizId, attacker);
        await this._sendInline(attacker.chatId, this._t(attacker, "thief.notify.attacker_success", { bizTitle, amount: this._money(attacker, stolen) }), [[{ text: this._t(attacker, "thief.btn.menu"), callback_data: "go:Square" }]]);
      }
      return { ok: true, resolved: true, success: true, stolen, source };
    }

    if (owner?.chatId) {
      const bizTitle = this._bizTitle(bizId, owner);
      await this._sendInline(owner.chatId, this._t(owner, "thief.notify.owner_failed", { bizTitle }), [[{ text: this._t(owner, "thief.btn.business"), callback_data: "go:Business" }]]);
    }
    if (attacker?.chatId) {
      const bizTitle = this._bizTitle(bizId, attacker);
      await this._sendInline(attacker.chatId, this._t(attacker, "thief.notify.attacker_failed", { bizTitle }), [[{ text: this._t(attacker, "thief.btn.menu"), callback_data: "go:Square" }]]);
    }

    return { ok: true, resolved: true, success: false, stolen: 0, source };
  }

  async _resolveAttackBlocked(attack, { source = "battle" } = {}) {
    const owner = await this.users.load(attack.ownerId).catch(() => null);
    const attacker = await this.users.load(attack.attackerId).catch(() => null);
    const defenseRewardGems = 1;

    let ownerAch = null;
    if (owner) {
      const ownerFound = this._findOwnedEntry(owner, attack.bizId);
      if (ownerFound.idx >= 0 && ownerFound.entry) {
        ownerFound.entry.guardBlocked = Math.max(0, Math.floor(Number(ownerFound.entry.guardBlocked) || 0)) + 1;
        ownerFound.arr[ownerFound.idx] = ownerFound.entry;
        owner.biz = owner.biz || {};
        owner.biz.owned = ownerFound.arr;
      }
      owner.premium = Math.max(0, Math.floor(Number(owner?.premium) || 0)) + defenseRewardGems;
      if (this.achievements?.onEvent) {
        try {
          ownerAch = await this.achievements.onEvent(owner, "thief_defense_success", { bizId: attack.bizId }, { persist: false, notify: false });
        } catch {}
      }
      await this.users.save(owner);
      if (ownerAch?.newlyEarned?.length && this.achievements?.notifyEarned) {
        await this.achievements.notifyEarned(owner, ownerAch.newlyEarned);
      }
    }

    if (attacker) {
      this._ensureThiefState(attacker);
      if (String(attacker.thief.activeAttackId || "") === String(attack.id || "")) {
        attacker.thief.activeAttackId = "";
      }
      const cooldownUntil = this.now() + Math.max(1, Math.floor(Number(attack.cooldownMinutes) || 0)) * 60_000;
      attacker.thief.cooldowns = attacker.thief.cooldowns || {};
      attacker.thief.cooldowns[String(attack.bizId || "")] = cooldownUntil;
      if (this.achievements?.onEvent) {
        try {
          await this.achievements.onEvent(attacker, "thief_fail", { bizId: attack.bizId, reason: "blocked" }, { persist: false, notify: false });
        } catch {}
      }
      await this.users.save(attacker);
    }

    await this._deleteAttack(attack);

    if (owner?.chatId) {
      const bizTitle = this._bizTitle(attack.bizId, owner);
      await this._sendInline(
        owner.chatId,
        this._t(owner, "thief.notify.defense_owner_won", {
          bizTitle,
          emoji: CONFIG?.PREMIUM?.emoji || "💎",
          reward: defenseRewardGems
        }),
        [[{ text: this._t(owner, "thief.btn.business"), callback_data: "go:Business" }]]
      );
    }
    if (attacker?.chatId) {
      const bizTitle = this._bizTitle(attack.bizId, attacker);
      await this._sendInline(attacker.chatId, this._t(attacker, "thief.notify.defense_thief_lost", { bizTitle }), [[{ text: this._t(attacker, "thief.btn.menu"), callback_data: "go:Square" }]]);
    }

    return { ok: true, resolved: true, success: false, blocked: true, source };
  }

  async _finalizeDefenseBattle(attack, battle, { source = "click" } = {}) {
    const winner = decideCombatWinner(battle.ownerScore || 0, battle.thiefScore || 0, { tieWinner: "owner" });
    battle.status = "finished";
    battle.finishedAt = this.now();
    battle.updatedAt = this.now();
    battle.result = {
      winnerSide: winner === "left" ? "owner" : (winner === "right" ? "thief" : String(winner || "owner")),
      reason: source
    };
    await this._saveDefenseBattle(battle);

    const battleSource = String(source || "").startsWith("battle")
      ? String(source || "battle")
      : `battle:${String(source || "resolve")}`;
    if (battle.result.winnerSide === "owner") {
      return await this._resolveAttackBlocked(attack, { source: battleSource });
    }
    return await this._resolveAttackSuccess(attack, { source: battleSource });
  }

  async _resolveDefenseBattleTimeout(attackId, { source = "cron" } = {}) {
    const attack = await this._loadAttack(attackId);
    const battle = await this._loadDefenseBattle(attackId);
    if (!attack || !battle || String(battle.status || "") !== "active") return { ok: false, skipped: true };
    if (Number(battle.roundDeadline || 0) > this.now()) return { ok: false, skipped: true };
    return await this._resolveDefenseRoundIfReady(attack, battle, { source, forceTimeout: true });
  }

  async _resolveAttack(attackOrId, { source = "cron" } = {}) {
    const attack = (typeof attackOrId === "string")
      ? await this._loadAttack(attackOrId)
      : attackOrId;
    if (!attack) return { ok: false, skipped: true };
    if (String(attack.status || "") === "battle") return { ok: false, skipped: true };
    if (String(attack.status || "") !== "active") return { ok: false, skipped: true };
    if (Number(attack.resolveAt || 0) > this.now()) return { ok: false, skipped: true };
    return await this._resolveAttackSuccess(attack, { source });
  }

  async _resolveProtectionExpiryEvent(evt) {
    const kind = String(evt?.kind || "");
    const ownerId = String(evt?.ownerId || "");
    const bizId = String(evt?.bizId || "");
    if (!kind || !ownerId || !bizId) return { checked: 0, expired: 0 };

    const owner = await this.users.load(ownerId).catch(() => null);
    if (!owner) return { checked: 1, expired: 0 };

    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) return { checked: 1, expired: 0 };

    const nowTs = this.now();
    let expired = false;
    let notifyKey = "";
    if (kind === "guard") {
      const until = Math.max(0, Math.floor(Number(found.entry.guardUntil) || 0));
      if (until > 0 && until <= nowTs) {
        found.entry.guardUntil = 0;
        expired = true;
        notifyKey = "thief.notify.guard_expired";
      }
    }
    if (kind === "immunity") {
      const until = Math.max(0, Math.floor(Number(found.entry.immunityUntil) || 0));
      if (until > 0 && until <= nowTs) {
        found.entry.immunityUntil = 0;
        expired = true;
        notifyKey = "thief.notify.immunity_expired";
      }
    }
    if (!expired) return { checked: 1, expired: 0 };

    found.arr[found.idx] = found.entry;
    owner.biz = owner.biz || {};
    owner.biz.owned = found.arr;
    await this.users.save(owner);

    if (owner?.chatId && notifyKey) {
      const bizTitle = this._bizTitle(bizId, owner);
      await this._sendInline(
        owner.chatId,
        this._t(owner, notifyKey, { bizTitle }),
        [[{ text: this._t(owner, "thief.btn.business"), callback_data: "go:Business" }]]
      );
    }
    return { checked: 1, expired: 1 };
  }

  async resolveProtectionExpirations({ limit } = {}) {
    const lookback = Math.max(
      1,
      Math.floor(Number(this._protectionCfg()?.EXPIRE_LOOKBACK_MINUTES) || 30)
    );
    const events = await this._collectDueProtectionEvents({ nowTs: this.now(), lookbackMinutes: lookback });
    if (!events.length) return { checked: 0, expired: 0 };

    const max = Math.max(
      1,
      Math.floor(Number(limit) || Number(this._protectionCfg()?.EXPIRE_RESOLVE_LIMIT_PER_RUN) || 200)
    );
    let checked = 0;
    let expired = 0;
    for (const evt of events) {
      if (checked >= max) break;
      const res = await this._resolveProtectionExpiryEvent(evt);
      checked += Number(res?.checked || 0);
      expired += Number(res?.expired || 0);
    }
    return { checked, expired };
  }

  async resolveExpired({ limit } = {}) {
    const ids = await this._collectDueAttackIds({ nowTs: this.now(), lookbackMinutes: 15 });
    const battleIds = await this._collectDueDefenseBattleIds({ nowTs: this.now(), lookbackMinutes: 15 });
    if (!ids.length && !battleIds.length) return { checked: 0, resolved: 0, processed: 0 };
    let checked = 0;
    let resolved = 0;
    const max = Math.max(1, Math.floor(Number(limit) || Number(this._cfg()?.RESOLVE_LIMIT_PER_RUN) || 200));
    for (const id of ids) {
      if (checked >= max) break;
      checked += 1;
      const res = await this._resolveAttack(id, { source: "cron" });
      if (res?.resolved) resolved += 1;
    }
    for (const id of battleIds) {
      if (checked >= max) break;
      checked += 1;
      const res = await this._resolveDefenseBattleTimeout(id, { source: "cron" });
      if (res?.resolved) resolved += 1;
    }
    return { checked, resolved, processed: checked };
  }
}
