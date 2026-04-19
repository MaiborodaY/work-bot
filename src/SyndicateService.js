import { CONFIG } from "./GameConfig.js";
import { getBusinessTitle } from "./I18nCatalog.js";
import { normalizeLang } from "./i18n/index.js";
import { getSyndicateStrings } from "./i18n/syndicate.js";
import { markUsefulActivity } from "./PlayerStats.js";
import { ProgressionService } from "./ProgressionService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, toInt(value, min)));
}

function shortName(id, displayName) {
  const name = String(displayName || "").trim();
  if (name) return name;
  const suffix = String(id || "").slice(-4).padStart(4, "0");
  return `u${suffix}`;
}

function todayKeyUtc(ts) {
  const d = new Date(Number(ts) || Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekKey(ts) {
  const d = new Date(Number(ts) || Date.now());
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / DAY_MS) + 1) / 7);
  return `${dt.getUTCFullYear()}${String(week).padStart(2, "0")}`;
}

function makeDealId(nowTs) {
  const a = Math.max(0, toInt(nowTs, Date.now())).toString(36);
  const b = Math.random().toString(36).slice(2, 8);
  return `syn_${a}_${b}`;
}

export class SyndicateService {
  constructor({ db, users, now, bot = null, isAdmin = null, achievements = null }) {
    this.db = db || users?.db || null;
    this.users = users || null;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.isAdmin = (typeof isAdmin === "function") ? isAdmin : (() => false);
    this.achievements = achievements || null;
  }

  _cfg() {
    return CONFIG?.SYNDICATE || {};
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "en");
  }

  _fmt(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  }

  _s(source = "en") {
    return getSyndicateStrings(source);
  }

  _bizIds() {
    const deals = this._cfg()?.DEALS;
    if (!deals || typeof deals !== "object") return [];
    return Object.keys(deals).filter((id) => !!deals[id]);
  }

  _dealCfg(bizId) {
    const cfg = this._cfg()?.DEALS?.[String(bizId || "")];
    return (cfg && typeof cfg === "object") ? cfg : null;
  }

  _tierIds() {
    return ["small", "medium", "large"];
  }

  _tierUnlockCompleted(tierId) {
    const raw = this._cfg()?.TIER_UNLOCK_COMPLETED || {};
    return Math.max(0, toInt(raw?.[String(tierId || "")], 0));
  }

  _tierPoints(tierId) {
    const raw = this._cfg()?.RATING_POINTS || {};
    return Math.max(0, toInt(raw?.[String(tierId || "")], 0));
  }

  _tierLabel(tierId) {
    const id = String(tierId || "").toLowerCase();
    if (id === "small") return "Small";
    if (id === "medium") return "Medium";
    if (id === "large") return "Large";
    return id;
  }

  _typeLabel(bizId, lang = "en") {
    const l = this._lang(lang);
    const map = {
      ru: {
        shawarma: "Поставка ингредиентов",
        stomatology: "Закупка оборудования",
        restaurant: "Поставка продуктов",
        courier_service: "Логистический контракт",
        fitness_club: "Спортивная франшиза"
      },
      uk: {
        shawarma: "Поставка інгредієнтів",
        stomatology: "Закупівля обладнання",
        restaurant: "Поставка продуктів",
        courier_service: "Логістичний контракт",
        fitness_club: "Спортивна франшиза"
      },
      en: {
        shawarma: "Ingredient supply",
        stomatology: "Equipment purchase",
        restaurant: "Food supply",
        courier_service: "Logistics contract",
        fitness_club: "Fitness franchise"
      }
    };
    return map[l]?.[bizId] || map.en[bizId] || "Deal";
  }

  _openIndexKey() { return "syndicate:open:v1"; }
  _activeIndexKey() { return "syndicate:active:v1"; }
  _acceptLockKey(dealId) { return `syndicate:acceptlock:${String(dealId || "").trim()}:v1`; }
  _dealKey(dealId) { return `syndicate:deal:${String(dealId || "").trim()}`; }
  _ratingAllKey() { return "syndicate:rating:all:v1"; }
  _ratingWeekKey(weekKey) { return `syndicate:rating:week:${String(weekKey || "").trim()}:v1`; }
  _statsKey() { return "syndicate:stats:v1"; }
  _dealTtlSec() { return Math.max(24 * 60 * 60, toInt(this._cfg()?.DEAL_TTL_SEC, 30 * 24 * 60 * 60)); }
  _indexTtlSec() { return Math.max(24 * 60 * 60, toInt(this._cfg()?.INDEX_TTL_SEC, 14 * 24 * 60 * 60)); }
  _ratingTtlSec() { return Math.max(24 * 60 * 60, toInt(this._cfg()?.RATING_TTL_SEC, 35 * 24 * 60 * 60)); }
  _ratingLimit() { return Math.max(1, toInt(this._cfg()?.RATING_LIMIT, 15)); }
  _minLevel() { return Math.max(1, toInt(this._cfg()?.MIN_PLAYER_LEVEL, 10)); }
  _minBizOwned() { return Math.max(1, toInt(this._cfg()?.MIN_BUSINESS_OWNED, 1)); }
  _openTimeoutMs() { return Math.max(5 * 60 * 1000, toInt(this._cfg()?.OPEN_TIMEOUT_MS, 24 * 60 * 60 * 1000)); }
  _acceptLockTtlSec() { return Math.max(3, toInt(this._cfg()?.ACCEPT_LOCK_TTL_SEC, 8)); }
  _acceptLockSettleMs() { return Math.max(10, toInt(this._cfg()?.ACCEPT_LOCK_SETTLE_MS, 120)); }
  _nowWeekKey() { return isoWeekKey(this.now()); }

  async _sleep(ms) {
    const waitMs = Math.max(0, toInt(ms, 0));
    if (!waitMs) return;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  _money(value) {
    return Math.max(0, toInt(value, 0)).toLocaleString("en-US");
  }

  _durationLabel(ms, lang = "en") {
    const l = this._lang(lang);
    const totalMin = Math.max(1, Math.ceil((Number(ms) || 0) / 60000));
    const d = Math.floor(totalMin / (24 * 60));
    const h = Math.floor((totalMin % (24 * 60)) / 60);
    const m = totalMin % 60;
    if (d > 0) {
      if (l === "en") return `${d}d ${h}h`;
      if (l === "uk") return `${d}д ${h}год`;
      return `${d}д ${h}ч`;
    }
    if (h > 0) {
      if (l === "en") return `${h}h ${m}m`;
      if (l === "uk") return `${h}год ${m}хв`;
      return `${h}ч ${m}мин`;
    }
    if (l === "en") return `${m}m`;
    if (l === "uk") return `${m}хв`;
    return `${m}мин`;
  }

  _safeJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  async _loadJson(key, fallback) {
    if (!this.db) return fallback;
    const raw = await this.db.get(String(key || "")).catch(() => null);
    return this._safeJson(raw, fallback);
  }

  async _saveJson(key, value, ttlSec = 0) {
    if (!this.db) return;
    if (ttlSec > 0) {
      await this.db.put(String(key || ""), JSON.stringify(value), { expirationTtl: ttlSec });
      return;
    }
    await this.db.put(String(key || ""), JSON.stringify(value));
  }

  _cleanIndex(list) {
    const src = Array.isArray(list) ? list : [];
    const out = [];
    const seen = new Set();
    for (const row of src) {
      const id = String(row || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out.slice(0, 1000);
  }

  async _loadIndex(key) {
    const list = await this._loadJson(key, []);
    return this._cleanIndex(list);
  }

  async _saveIndex(key, list) {
    await this._saveJson(key, this._cleanIndex(list), this._indexTtlSec());
  }

  async _addToIndex(key, id) {
    const list = await this._loadIndex(key);
    if (list.includes(id)) return;
    list.push(id);
    await this._saveIndex(key, list);
  }

  async _removeFromIndex(key, id) {
    const list = await this._loadIndex(key);
    const next = list.filter((x) => x !== id);
    if (next.length === list.length) return;
    await this._saveIndex(key, next);
  }

  async _loadDeal(dealId) {
    const id = String(dealId || "").trim();
    if (!id) return null;
    return this._loadJson(this._dealKey(id), null);
  }

  async _saveDeal(deal) {
    if (!deal || typeof deal !== "object") return;
    const id = String(deal.id || "").trim();
    if (!id) return;
    await this._saveJson(this._dealKey(id), deal, this._dealTtlSec());
  }

  async _acquireAcceptLock(dealId, userId) {
    const id = String(dealId || "").trim();
    const uid = String(userId || "").trim();
    if (!id || !uid) return "";
    const token = `${uid}:${makeDealId(this.now())}`;
    const key = this._acceptLockKey(id);
    await this._saveJson(key, { token, uid, ts: this.now() }, this._acceptLockTtlSec());
    await this._sleep(this._acceptLockSettleMs());
    const check = await this._loadJson(key, null);
    if (!check || String(check?.token || "") !== token) return "";
    return token;
  }

  async _releaseAcceptLock(dealId, token) {
    const id = String(dealId || "").trim();
    const tkn = String(token || "").trim();
    if (!id || !tkn || !this.db) return;
    const key = this._acceptLockKey(id);
    const check = await this._loadJson(key, null);
    if (!check || String(check?.token || "") !== tkn) return;
    await this.db.delete(key).catch(() => null);
  }

  _isAdminUserId(userId) {
    const id = String(userId || "").trim();
    if (!id) return false;
    try {
      return !!this.isAdmin(id);
    } catch {
      return false;
    }
  }

  _ownedBizIds(u) {
    const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    const set = new Set();
    for (const row of owned) {
      const id = String(typeof row === "string" ? row : row?.id || "").trim();
      if (!id) continue;
      if (!this._dealCfg(id)) continue;
      set.add(id);
    }
    return [...set];
  }

  _playerLevel(u) {
    const info = ProgressionService.getLevelInfo(u);
    return Math.max(1, toInt(info?.level, 1));
  }

  _hasAccess(u) {
    const level = this._playerLevel(u);
    const owned = this._ownedBizIds(u).length;
    return level >= this._minLevel() && owned >= this._minBizOwned();
  }

  _ensureWeekState(u) {
    if (!u || typeof u !== "object") return false;
    let changed = false;
    const week = this._nowWeekKey();
    if (String(u?.syndicate?.weekKey || "") !== week) {
      if (!u.syndicate || typeof u.syndicate !== "object") u.syndicate = {};
      u.syndicate.weekKey = week;
      u.syndicate.completedWeek = 0;
      u.syndicate.weightedWeek = 0;
      u.syndicate.netWeek = 0;
      u.syndicate.outcomeWeek = { success: 0, lucky: 0, fail: 0 };
      changed = true;
    }
    return changed;
  }

  _ensureUserState(u) {
    if (!u || typeof u !== "object") return false;
    let changed = false;
    if (!u.syndicate || typeof u.syndicate !== "object") {
      u.syndicate = {
        weekKey: this._nowWeekKey(),
        completedWeek: 0,
        completedTotal: 0,
        weightedWeek: 0,
        weightedTotal: 0,
        netWeek: 0,
        netTotal: 0,
        outcomeWeek: { success: 0, lucky: 0, fail: 0 },
        outcomeTotal: { success: 0, lucky: 0, fail: 0 },
        byBiz: {},
        activeDealByBiz: {}
      };
      changed = true;
    }
    const s = u.syndicate;
    const numKeys = ["completedWeek", "completedTotal", "weightedWeek", "weightedTotal", "netWeek", "netTotal"];
    for (const key of numKeys) {
      const fixed = Math.max(0, toInt(s?.[key], 0));
      if (fixed !== s[key]) {
        s[key] = fixed;
        changed = true;
      }
    }
    if (!s.outcomeWeek || typeof s.outcomeWeek !== "object") { s.outcomeWeek = { success: 0, lucky: 0, fail: 0 }; changed = true; }
    if (!s.outcomeTotal || typeof s.outcomeTotal !== "object") { s.outcomeTotal = { success: 0, lucky: 0, fail: 0 }; changed = true; }
    for (const bucket of [s.outcomeWeek, s.outcomeTotal]) {
      for (const key of ["success", "lucky", "fail"]) {
        const fixed = Math.max(0, toInt(bucket?.[key], 0));
        if (fixed !== bucket[key]) {
          bucket[key] = fixed;
          changed = true;
        }
      }
    }
    if (!s.byBiz || typeof s.byBiz !== "object") { s.byBiz = {}; changed = true; }
    if (!s.activeDealByBiz || typeof s.activeDealByBiz !== "object") { s.activeDealByBiz = {}; changed = true; }
    for (const bizId of this._bizIds()) {
      if (!s.byBiz[bizId] || typeof s.byBiz[bizId] !== "object") {
        s.byBiz[bizId] = { completed: 0, success: 0, lucky: 0, fail: 0 };
        changed = true;
      } else {
        for (const key of ["completed", "success", "lucky", "fail"]) {
          const fixed = Math.max(0, toInt(s.byBiz[bizId][key], 0));
          if (fixed !== s.byBiz[bizId][key]) {
            s.byBiz[bizId][key] = fixed;
            changed = true;
          }
        }
      }
      if (typeof s.activeDealByBiz[bizId] !== "string") {
        s.activeDealByBiz[bizId] = "";
        changed = true;
      }
    }
    changed = this._ensureWeekState(u) || changed;
    return changed;
  }

  _getActiveDealId(u, bizId) {
    return String(u?.syndicate?.activeDealByBiz?.[String(bizId || "")] || "").trim();
  }

  _setActiveDealId(u, bizId, dealId) {
    this._ensureUserState(u);
    const id = String(bizId || "").trim();
    if (!id) return false;
    const next = String(dealId || "").trim();
    if (String(u.syndicate.activeDealByBiz[id] || "") === next) return false;
    u.syndicate.activeDealByBiz[id] = next;
    return true;
  }

  async _syncActiveDealRef(u, bizId) {
    const currentId = this._getActiveDealId(u, bizId);
    if (!currentId) return false;
    const deal = await this._loadDeal(currentId);
    const uid = String(u?.id || "");
    const valid = !!(
      deal &&
      String(deal.bizId || "") === String(bizId || "") &&
      (String(deal.state || "") === "open" || String(deal.state || "") === "active") &&
      (String(deal.createdBy || "") === uid || String(deal.acceptedBy || "") === uid)
    );
    if (valid) return false;
    return this._setActiveDealId(u, bizId, "");
  }

  _tierUnlocked(u, bizId, tierId) {
    const completed = Math.max(0, toInt(u?.syndicate?.byBiz?.[String(bizId || "")]?.completed, 0));
    return completed >= this._tierUnlockCompleted(tierId);
  }

  _buildDealSnapshot(bizId, tierId) {
    const cfg = this._dealCfg(bizId);
    const tier = String(tierId || "");
    return {
      durationMs: Math.max(60 * 1000, toInt(cfg?.durationMs, 60 * 60 * 1000)),
      stake: Math.max(1, toInt(cfg?.stakes?.[tier], 1)),
      tierId: tier,
      tierPoints: this._tierPoints(tier),
      oddsPct: {
        success: clampInt(cfg?.oddsPct?.success, 0, 100),
        lucky: clampInt(cfg?.oddsPct?.lucky, 0, 100),
        fail: clampInt(cfg?.oddsPct?.fail, 0, 100)
      },
      returnPct: {
        success: toInt(cfg?.returnPct?.success, 0),
        lucky: toInt(cfg?.returnPct?.lucky, 0),
        fail: toInt(cfg?.returnPct?.fail, 0)
      }
    };
  }

  _pickOutcome(snapshot) {
    const odds = snapshot?.oddsPct || {};
    const success = clampInt(odds?.success, 0, 100);
    const lucky = clampInt(odds?.lucky, 0, 100);
    const fail = clampInt(odds?.fail, 0, 100);
    const total = Math.max(1, success + lucky + fail);
    const roll = Math.floor(Math.random() * total) + 1;
    if (roll <= success) return "success";
    if (roll <= (success + lucky)) return "lucky";
    return "fail";
  }

  _calcReturn(stake, pct) {
    const amount = Math.floor((Math.max(0, toInt(stake, 0)) * (100 + Number(pct || 0))) / 100);
    return Math.max(0, amount);
  }

  _bizButtonLabel(u, bizId, openCount) {
    const emoji = String(CONFIG?.BUSINESS?.[String(bizId || "")]?.emoji || "🏢");
    const title = getBusinessTitle(bizId, this._lang(u));
    const active = this._getActiveDealId(u, bizId) ? " • ●" : "";
    return `${emoji} ${title} [${Math.max(0, toInt(openCount, 0))}]${active}`;
  }

  async _openDealsByBiz(excludeUserId = "") {
    const index = await this._loadIndex(this._openIndexKey());
    const out = {};
    for (const bizId of this._bizIds()) out[bizId] = [];
    for (const dealId of index) {
      const deal = await this._loadDeal(dealId);
      if (!deal) continue;
      if (String(deal.state || "") !== "open") continue;
      const bizId = String(deal.bizId || "");
      if (!out[bizId]) continue;
      if (excludeUserId && String(deal.createdBy || "") === String(excludeUserId || "")) continue;
      out[bizId].push(deal);
    }
    for (const list of Object.values(out)) {
      list.sort((a, b) => toInt(b?.createdAt, 0) - toInt(a?.createdAt, 0));
    }
    return out;
  }

  _ratingSort(list) {
    const arr = Array.isArray(list) ? list.slice() : [];
    arr.sort((a, b) => {
      const scoreDiff = toInt(b?.score, 0) - toInt(a?.score, 0);
      if (scoreDiff !== 0) return scoreDiff;
      const completedDiff = toInt(b?.completed, 0) - toInt(a?.completed, 0);
      if (completedDiff !== 0) return completedDiff;
      const netDiff = toInt(b?.net, 0) - toInt(a?.net, 0);
      if (netDiff !== 0) return netDiff;
      const reachDiff = toInt(a?.reachedAt, 0) - toInt(b?.reachedAt, 0);
      if (reachDiff !== 0) return reachDiff;
      return String(a?.userId || "").localeCompare(String(b?.userId || ""));
    });
    return arr;
  }

  async _loadRating(period = "week") {
    const key = period === "all" ? this._ratingAllKey() : this._ratingWeekKey(this._nowWeekKey());
    const raw = await this._loadJson(key, []);
    return this._ratingSort(Array.isArray(raw) ? raw : []).slice(0, this._ratingLimit());
  }

  async _saveRating(period = "week", list = []) {
    const key = period === "all" ? this._ratingAllKey() : this._ratingWeekKey(this._nowWeekKey());
    const clean = this._ratingSort(Array.isArray(list) ? list : []).slice(0, this._ratingLimit());
    await this._saveJson(key, clean, this._ratingTtlSec());
  }

  async _updateRatingForUser(u) {
    if (!u || typeof u !== "object") return;
    this._ensureUserState(u);
    const uid = String(u?.id || "").trim();
    if (!uid) return;
    const isAdmin = this._isAdminUserId(uid);
    const name = shortName(uid, u?.displayName);
    const nowTs = this.now();
    const updates = [
      {
        period: "all",
        score: isAdmin ? 0 : Math.max(0, toInt(u?.syndicate?.weightedTotal, 0)),
        completed: isAdmin ? 0 : Math.max(0, toInt(u?.syndicate?.completedTotal, 0)),
        net: isAdmin ? 0 : Math.max(0, toInt(u?.syndicate?.netTotal, 0))
      },
      {
        period: "week",
        score: isAdmin ? 0 : Math.max(0, toInt(u?.syndicate?.weightedWeek, 0)),
        completed: isAdmin ? 0 : Math.max(0, toInt(u?.syndicate?.completedWeek, 0)),
        net: isAdmin ? 0 : Math.max(0, toInt(u?.syndicate?.netWeek, 0))
      }
    ];
    for (const row of updates) {
      const list = await this._loadRating(row.period);
      const idx = list.findIndex((x) => String(x?.userId || "") === uid);
      if (row.score <= 0) {
        if (idx >= 0) {
          list.splice(idx, 1);
          await this._saveRating(row.period, list);
        }
        continue;
      }
      const entry = {
        userId: uid,
        name,
        score: row.score,
        completed: row.completed,
        net: row.net,
        reachedAt: nowTs
      };
      if (idx >= 0) {
        const prev = list[idx];
        const sameScore = toInt(prev?.score, 0) === row.score;
        entry.reachedAt = sameScore ? toInt(prev?.reachedAt, nowTs) : nowTs;
        list[idx] = entry;
      } else {
        list.push(entry);
      }
      await this._saveRating(row.period, list);
    }
  }

  _resultTitle(s, outcome) {
    if (outcome === "lucky") return s.finishedLucky;
    if (outcome === "fail") return s.finishedFail;
    return s.finishedSuccess;
  }

  async _sendInline(chatId, text, keyboard) {
    if (!this.bot || !chatId) return;
    try {
      if (typeof this.bot.sendWithInline === "function") {
        await this.bot.sendWithInline(chatId, text, keyboard);
        return;
      }
      if (typeof this.bot.sendMessage === "function") {
        await this.bot.sendMessage(chatId, text);
      }
    } catch {}
  }

  async _notifyDealStarted(user) {
    if (!user) return;
    const s = this._s(user);
    const chatId = String(user?.chatId || "").trim();
    if (!chatId) return;
    await this._sendInline(chatId, s.startedNotify, [[{ text: s.btnOpenSyndicate, callback_data: "go:Syndicate" }]]);
  }

  async _notifyOpenExpired(user) {
    if (!user) return;
    const s = this._s(user);
    const chatId = String(user?.chatId || "").trim();
    if (!chatId) return;
    await this._sendInline(chatId, s.expiredNotify, [[{ text: s.btnOpenSyndicate, callback_data: "go:Syndicate" }]]);
  }

  async _notifyDealFinished(user, deal, outcome, stake, returned, net) {
    if (!user) return;
    const s = this._s(user);
    const chatId = String(user?.chatId || "").trim();
    if (!chatId) return;
    const bizTitle = getBusinessTitle(String(deal?.bizId || ""), this._lang(user));
    const title = this._resultTitle(s, outcome);
    const line = this._fmt(s.finishedLine, {
      biz: bizTitle,
      tier: this._tierLabel(deal?.snapshot?.tierId || ""),
      stake: this._money(stake),
      ret: this._money(returned),
      net: this._money(Math.max(0, net))
    });
    await this._sendInline(chatId, `${title}\n${line}`, [[{ text: s.btnOpenSyndicate, callback_data: "go:Syndicate" }]]);
  }

  async _applyFinishedDealToUser(user, deal, outcome, returnedAmount) {
    if (!user || !deal) return;
    this._ensureUserState(user);
    this._setActiveDealId(user, deal.bizId, "");
    const stake = Math.max(0, toInt(deal?.snapshot?.stake, 0));
    const ret = Math.max(0, toInt(returnedAmount, 0));
    const net = Math.max(0, ret - stake);
    user.money = Math.max(0, toInt(user?.money, 0)) + ret;
    const tierId = String(deal?.snapshot?.tierId || "");
    const points = Math.max(0, toInt(deal?.snapshot?.tierPoints, this._tierPoints(tierId)));
    user.syndicate.completedTotal += 1;
    user.syndicate.completedWeek += 1;
    user.syndicate.weightedTotal += points;
    user.syndicate.weightedWeek += points;
    user.syndicate.netTotal += net;
    user.syndicate.netWeek += net;
    if (["success", "lucky", "fail"].includes(outcome)) {
      user.syndicate.outcomeTotal[outcome] = Math.max(0, toInt(user?.syndicate?.outcomeTotal?.[outcome], 0)) + 1;
      user.syndicate.outcomeWeek[outcome] = Math.max(0, toInt(user?.syndicate?.outcomeWeek?.[outcome], 0)) + 1;
      const bizStats = user.syndicate.byBiz[String(deal.bizId || "")] || { completed: 0, success: 0, lucky: 0, fail: 0 };
      bizStats.completed = Math.max(0, toInt(bizStats.completed, 0)) + 1;
      bizStats[outcome] = Math.max(0, toInt(bizStats[outcome], 0)) + 1;
      user.syndicate.byBiz[String(deal.bizId || "")] = bizStats;
    }
    markUsefulActivity(user, this.now());

    if (this.achievements?.onEvent) {
      try {
        await this.achievements.onEvent(
          user,
          "syndicate_deal_completed",
          { bizId: String(deal.bizId || ""), tierId, outcome },
          { persist: false, notify: true }
        );
      } catch {}
    }

    await this.users.save(user);
    await this._updateRatingForUser(user);
    await this._notifyDealFinished(user, deal, outcome, stake, ret, net);
  }

  async _resolveDeal(deal) {
    if (!deal || String(deal.state || "") !== "active") return false;
    const snapshot = deal.snapshot || {};
    const stake = Math.max(1, toInt(snapshot?.stake, 1));
    const outcome = this._pickOutcome(snapshot);
    const pct = toInt(snapshot?.returnPct?.[outcome], 0);
    const creatorReturn = this._calcReturn(stake, pct);
    const partnerReturn = this._calcReturn(stake, pct);

    const creator = await this.users.load(String(deal.createdBy || "")).catch(() => null);
    const partner = await this.users.load(String(deal.acceptedBy || "")).catch(() => null);
    if (creator) this._ensureWeekState(creator);
    if (partner) this._ensureWeekState(partner);

    if (creator) {
      await this._applyFinishedDealToUser(creator, deal, outcome, creatorReturn);
    }
    if (partner) {
      await this._applyFinishedDealToUser(partner, deal, outcome, partnerReturn);
    }

    deal.state = "finished";
    deal.finishedAt = this.now();
    deal.outcome = outcome;
    deal.result = {
      creatorReturn,
      partnerReturn,
      creatorNet: Math.max(0, creatorReturn - stake),
      partnerNet: Math.max(0, partnerReturn - stake)
    };
    await this._saveDeal(deal);
    await this._removeFromIndex(this._activeIndexKey(), String(deal.id || ""));
    return true;
  }

  async _expireOpenDeal(deal) {
    if (!deal || String(deal.state || "") !== "open") return false;
    const creator = await this.users.load(String(deal.createdBy || "")).catch(() => null);
    if (creator) {
      this._ensureUserState(creator);
      creator.money = Math.max(0, toInt(creator?.money, 0)) + Math.max(0, toInt(deal?.snapshot?.stake, 0));
      this._setActiveDealId(creator, deal.bizId, "");
      await this.users.save(creator);
      await this._notifyOpenExpired(creator);
    }
    deal.state = "expired";
    deal.finishedAt = this.now();
    deal.outcome = "expired";
    await this._saveDeal(deal);
    await this._removeFromIndex(this._openIndexKey(), String(deal.id || ""));
    return true;
  }

  async runTick() {
    let expired = 0;
    let resolved = 0;
    const nowTs = this.now();
    const openIds = await this._loadIndex(this._openIndexKey());
    for (const id of openIds) {
      const deal = await this._loadDeal(id);
      if (!deal) {
        await this._removeFromIndex(this._openIndexKey(), id);
        continue;
      }
      if (String(deal.state || "") !== "open") {
        await this._removeFromIndex(this._openIndexKey(), id);
        continue;
      }
      if (toInt(deal.expiresAt, 0) > nowTs) continue;
      if (await this._expireOpenDeal(deal)) expired += 1;
    }

    const activeIds = await this._loadIndex(this._activeIndexKey());
    for (const id of activeIds) {
      const deal = await this._loadDeal(id);
      if (!deal) {
        await this._removeFromIndex(this._activeIndexKey(), id);
        continue;
      }
      if (String(deal.state || "") !== "active") {
        await this._removeFromIndex(this._activeIndexKey(), id);
        continue;
      }
      if (toInt(deal.endAt, 0) > nowTs) continue;
      if (await this._resolveDeal(deal)) resolved += 1;
    }
    return { expired, resolved };
  }

  async buildMainView(u) {
    this._ensureUserState(u);
    const s = this._s(u);
    const level = this._playerLevel(u);
    const owned = this._ownedBizIds(u);
    const hasAccess = this._hasAccess(u);

    if (!hasAccess) {
      const lines = [
        s.title,
        "",
        s.locked,
        this._fmt(s.lockedReqLevel, { need: this._minLevel(), have: level }),
        s.lockedReqBiz
      ];
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: s.btnBackCity, callback_data: "go:City" }]]
      };
    }

    let changed = false;
    for (const bizId of owned) {
      const synced = await this._syncActiveDealRef(u, bizId);
      if (synced) changed = true;
    }
    if (changed) await this.users.save(u);

    const openByBiz = await this._openDealsByBiz(String(u?.id || ""));
    const lines = [s.title, s.subtitle, "", s.yourBiz];
    const kb = [];
    for (const bizId of owned) {
      const list = Array.isArray(openByBiz?.[bizId]) ? openByBiz[bizId] : [];
      lines.push(`• ${this._bizButtonLabel(u, bizId, list.length)}`);
      kb.push([{ text: this._bizButtonLabel(u, bizId, list.length), callback_data: `syn:biz:${bizId}` }]);
    }
    lines.push("");
    lines.push(`${s.yourStatus} ${s.statusNoDeal}`);
    kb.push([{ text: s.btnRatingWeek, callback_data: "syn:rating:week" }]);
    kb.push([{ text: s.btnRatingAll, callback_data: "syn:rating:all" }]);
    kb.push([{ text: s.btnHelp, callback_data: "syn:help" }]);
    kb.push([{ text: s.btnRefresh, callback_data: "syn:refresh" }]);
    kb.push([{ text: s.btnBackCity, callback_data: "go:City" }]);

    return {
      caption: lines.join("\n"),
      keyboard: kb
    };
  }

  async buildHelpView(u) {
    const s = this._s(u);
    return {
      caption: [
        s.helpTitle,
        "",
        s.helpLine1,
        s.helpLine2,
        s.helpLine3,
        s.helpLine4,
        s.helpLine5,
        s.helpLine6
      ].join("\n"),
      keyboard: [
        [{ text: s.btnBackMain, callback_data: "syn:refresh" }]
      ]
    };
  }

  async buildRatingView(u, period = "week") {
    this._ensureUserState(u);
    const s = this._s(u);
    const p = String(period || "week") === "all" ? "all" : "week";
    const top = await this._loadRating(p);
    const title = p === "all" ? s.ratingAllTitle : s.ratingWeekTitle;
    const lines = [title, ""];
    const medals = ["🥇", "🥈", "🥉"];
    if (!top.length) {
      lines.push(s.ratingEmpty);
    } else {
      for (let i = 0; i < top.length; i += 1) {
        const row = top[i];
        const place = medals[i] || `${i + 1}.`;
        lines.push(this._fmt(s.ratingLine, {
          place,
          name: shortName(row.userId, row.name),
          score: this._money(row.score),
          completed: this._money(row.completed)
        }));
      }
    }
    const uid = String(u?.id || "");
    const idx = top.findIndex((x) => String(x?.userId || "") === uid);
    const score = p === "all"
      ? Math.max(0, toInt(u?.syndicate?.weightedTotal, 0))
      : Math.max(0, toInt(u?.syndicate?.weightedWeek, 0));
    lines.push("");
    lines.push(idx >= 0
      ? this._fmt(s.ratingMeIn, { place: idx + 1, score: this._money(score) })
      : this._fmt(s.ratingMeOut, { score: this._money(score) }));

    const keyboard = [
      [
        { text: s.btnRatingWeek, callback_data: "syn:rating:week" },
        { text: s.btnRatingAll, callback_data: "syn:rating:all" }
      ],
      [{ text: s.btnBackMain, callback_data: "syn:refresh" }]
    ];
    return { caption: lines.join("\n"), keyboard };
  }

  async buildBusinessView(u, bizIdRaw) {
    this._ensureUserState(u);
    const s = this._s(u);
    const bizId = String(bizIdRaw || "").trim();
    const dealCfg = this._dealCfg(bizId);
    if (!dealCfg) {
      return {
        caption: s.locked,
        keyboard: [[{ text: s.btnBackMain, callback_data: "syn:refresh" }]]
      };
    }
    if (!this._ownedBizIds(u).includes(bizId)) {
      return {
        caption: s.lockedReqBiz,
        keyboard: [[{ text: s.btnBackMain, callback_data: "syn:refresh" }]]
      };
    }

    const changed = await this._syncActiveDealRef(u, bizId);
    if (changed) await this.users.save(u);

    const title = getBusinessTitle(bizId, this._lang(u));
    const type = this._typeLabel(bizId, u);
    const lines = [`🎯 ${title} — ${type}`, ""];
    const activeId = this._getActiveDealId(u, bizId);
    let activeDeal = null;
    if (activeId) activeDeal = await this._loadDeal(activeId);
    const nowTs = this.now();
    if (activeDeal && (String(activeDeal.state || "") === "open" || String(activeDeal.state || "") === "active")) {
      const left = String(activeDeal.state || "") === "open"
        ? this._durationLabel(Math.max(0, toInt(activeDeal.expiresAt, 0) - nowTs), u)
        : this._durationLabel(Math.max(0, toInt(activeDeal.endAt, 0) - nowTs), u);
      const stateLabel = String(activeDeal.state || "") === "open"
        ? this._fmt(s.statusOpenDeal, { left })
        : this._fmt(s.statusActiveDeal, { left });
      lines.push(this._fmt(s.yourDealLine, { state: stateLabel }));
    } else {
      lines.push(this._fmt(s.yourDealLine, { state: s.statusNoDeal }));
    }
    lines.push("");
    lines.push(s.sectionCreate);

    const kb = [];
    const byBiz = u?.syndicate?.byBiz?.[bizId] || { completed: 0 };
    const completed = Math.max(0, toInt(byBiz.completed, 0));
    for (const tierId of this._tierIds()) {
      const unlocked = this._tierUnlocked(u, bizId, tierId);
      const need = this._tierUnlockCompleted(tierId);
      if (unlocked) {
        lines.push(this._fmt(s.tierUnlocked, { tier: this._tierLabel(tierId) }));
        if (!activeDeal) {
          const stake = Math.max(1, toInt(dealCfg?.stakes?.[tierId], 1));
          kb.push([{
            text: this._fmt(s.btnCreateTier, { tier: this._tierLabel(tierId), stake: this._money(stake) }),
            callback_data: `syn:create:${bizId}:${tierId}`
          }]);
        }
      } else {
        lines.push(this._fmt(s.tierProgress, {
          tier: this._tierLabel(tierId),
          have: completed,
          need: need
        }));
      }
    }

    if (activeDeal && String(activeDeal.state || "") === "open" && String(activeDeal.createdBy || "") === String(u?.id || "")) {
      kb.push([{ text: s.btnCancelOpen, callback_data: `syn:cancel:${activeDeal.id}` }]);
    }

    lines.push("");
    lines.push(s.sectionOpenDeals);
    const openByBiz = await this._openDealsByBiz(String(u?.id || ""));
    const openDeals = (Array.isArray(openByBiz?.[bizId]) ? openByBiz[bizId] : []).slice(0, 10);
    if (!openDeals.length) {
      lines.push(s.noOpenDeals);
    } else {
      for (const deal of openDeals) {
        const creator = shortName(deal.createdBy, deal.createdName);
        const stake = this._money(deal?.snapshot?.stake || 0);
        const left = this._durationLabel(Math.max(0, toInt(deal.expiresAt, 0) - nowTs), u);
        lines.push(`• ${creator} · $${stake} · ${left}`);
        kb.push([{
          text: this._fmt(s.btnAcceptDeal, { stake, name: creator }),
          callback_data: `syn:accept:${deal.id}`
        }]);
      }
    }

    kb.push([{ text: s.btnRefresh, callback_data: `syn:biz:${bizId}` }]);
    kb.push([{ text: s.btnBackMain, callback_data: "syn:refresh" }]);
    return { caption: lines.join("\n"), keyboard: kb };
  }

  async createDeal(u, bizIdRaw, tierRaw) {
    this._ensureUserState(u);
    this._ensureWeekState(u);
    const s = this._s(u);
    if (!this._hasAccess(u)) return { ok: false, error: s.locked };

    const bizId = String(bizIdRaw || "").trim();
    const tierId = String(tierRaw || "").trim().toLowerCase();
    if (!this._dealCfg(bizId) || !this._tierIds().includes(tierId)) {
      return { ok: false, error: s.createTierLocked };
    }
    if (!this._ownedBizIds(u).includes(bizId)) {
      return { ok: false, error: s.lockedReqBiz };
    }
    if (!this._tierUnlocked(u, bizId, tierId)) {
      return { ok: false, error: s.createTierLocked };
    }

    const synced = await this._syncActiveDealRef(u, bizId);
    if (synced) await this.users.save(u);
    if (this._getActiveDealId(u, bizId)) {
      return { ok: false, error: s.createHasDeal };
    }

    const snapshot = this._buildDealSnapshot(bizId, tierId);
    const stake = Math.max(1, toInt(snapshot?.stake, 1));
    if (Math.max(0, toInt(u?.money, 0)) < stake) {
      return { ok: false, error: s.createNeedMoney };
    }

    u.money = Math.max(0, toInt(u.money, 0)) - stake;
    this._setActiveDealId(u, bizId, "");
    const id = makeDealId(this.now());
    this._setActiveDealId(u, bizId, id);
    markUsefulActivity(u, this.now());
    await this.users.save(u);

    const deal = {
      id,
      bizId,
      state: "open",
      createdBy: String(u.id || ""),
      createdName: shortName(u?.id, u?.displayName),
      createdAt: this.now(),
      expiresAt: this.now() + this._openTimeoutMs(),
      acceptedBy: "",
      acceptedName: "",
      acceptedAt: 0,
      startAt: 0,
      endAt: 0,
      snapshot,
      outcome: "",
      finishedAt: 0,
      result: null
    };
    await this._saveDeal(deal);
    await this._addToIndex(this._openIndexKey(), id);
    await this._incrementStats("created");
    return { ok: true, toast: s.createOk };
  }

  async cancelDeal(u, dealIdRaw) {
    this._ensureUserState(u);
    const s = this._s(u);
    const dealId = String(dealIdRaw || "").trim();
    if (!dealId) return { ok: false, error: s.cancelFail };
    const deal = await this._loadDeal(dealId);
    if (!deal) return { ok: false, error: s.cancelFail };
    if (String(deal.state || "") !== "open") return { ok: false, error: s.cancelFail };
    if (String(deal.createdBy || "") !== String(u?.id || "")) return { ok: false, error: s.cancelFail };

    const stake = Math.max(0, toInt(deal?.snapshot?.stake, 0));
    u.money = Math.max(0, toInt(u?.money, 0)) + stake;
    this._setActiveDealId(u, deal.bizId, "");
    await this.users.save(u);

    deal.state = "cancelled";
    deal.finishedAt = this.now();
    deal.outcome = "cancelled";
    deal.result = { creatorReturn: stake, partnerReturn: 0, creatorNet: 0, partnerNet: 0 };
    await this._saveDeal(deal);
    await this._removeFromIndex(this._openIndexKey(), dealId);
    await this._incrementStats("cancelled");
    return { ok: true, toast: s.cancelOk };
  }

  async acceptDeal(u, dealIdRaw) {
    this._ensureUserState(u);
    this._ensureWeekState(u);
    const s = this._s(u);
    if (!this._hasAccess(u)) return { ok: false, error: s.locked };

    const dealId = String(dealIdRaw || "").trim();
    if (!dealId) return { ok: false, error: s.acceptRace };
    const deal = await this._loadDeal(dealId);
    if (!deal || String(deal.state || "") !== "open") return { ok: false, error: s.acceptRace };
    if (String(deal.createdBy || "") === String(u?.id || "")) return { ok: false, error: s.acceptOwn };
    if (!this._dealCfg(deal.bizId)) return { ok: false, error: s.acceptRace };
    if (!this._ownedBizIds(u).includes(String(deal.bizId || ""))) return { ok: false, error: s.lockedReqBiz };

    const synced = await this._syncActiveDealRef(u, deal.bizId);
    if (synced) await this.users.save(u);
    if (this._getActiveDealId(u, deal.bizId)) return { ok: false, error: s.acceptHasDeal };

    const stake = Math.max(1, toInt(deal?.snapshot?.stake, 1));
    if (Math.max(0, toInt(u?.money, 0)) < stake) return { ok: false, error: s.acceptNoMoney };

    const lockToken = await this._acquireAcceptLock(dealId, u?.id);
    if (!lockToken) return { ok: false, error: s.acceptRace };

    try {
      const current = await this._loadDeal(dealId);
      if (!current || String(current.state || "") !== "open") return { ok: false, error: s.acceptRace };
      if (String(current.createdBy || "") === String(u?.id || "")) return { ok: false, error: s.acceptOwn };
      if (!this._dealCfg(current.bizId)) return { ok: false, error: s.acceptRace };
      if (!this._ownedBizIds(u).includes(String(current.bizId || ""))) return { ok: false, error: s.lockedReqBiz };

      const syncedCurrent = await this._syncActiveDealRef(u, current.bizId);
      if (syncedCurrent) await this.users.save(u);
      if (this._getActiveDealId(u, current.bizId)) return { ok: false, error: s.acceptHasDeal };

      const currentStake = Math.max(1, toInt(current?.snapshot?.stake, 1));
      if (Math.max(0, toInt(u?.money, 0)) < currentStake) return { ok: false, error: s.acceptNoMoney };

      u.money = Math.max(0, toInt(u?.money, 0)) - currentStake;
      this._setActiveDealId(u, current.bizId, current.id);
      markUsefulActivity(u, this.now());
      await this.users.save(u);

      const activeDeal = {
        ...current,
        state: "active",
        acceptedBy: String(u?.id || ""),
        acceptedName: shortName(u?.id, u?.displayName),
        acceptedAt: this.now(),
        startAt: this.now(),
        endAt: this.now() + Math.max(60 * 1000, toInt(current?.snapshot?.durationMs, 60 * 1000))
      };
      await this._saveDeal(activeDeal);

      await this._sleep(this._acceptLockSettleMs());
      const check = await this._loadDeal(dealId);
      if (!check || String(check.state || "") !== "active" || String(check.acceptedBy || "") !== String(u?.id || "")) {
        u.money = Math.max(0, toInt(u?.money, 0)) + currentStake;
        this._setActiveDealId(u, current.bizId, "");
        await this.users.save(u);
        return { ok: false, error: s.acceptRace };
      }

      await this._removeFromIndex(this._openIndexKey(), dealId);
      await this._addToIndex(this._activeIndexKey(), dealId);

      const creator = await this.users.load(String(check.createdBy || "")).catch(() => null);
      if (creator) {
        this._ensureUserState(creator);
        this._setActiveDealId(creator, check.bizId, dealId);
        await this.users.save(creator);
        await this._notifyDealStarted(creator);
      }
      await this._notifyDealStarted(u);
      await this._incrementStats("accepted");
      return { ok: true, toast: s.acceptOk };
    } finally {
      await this._releaseAcceptLock(dealId, lockToken);
    }
  }

  async _incrementStats(field) {
    const key = this._statsKey();
    const stats = await this._loadJson(key, {
      day: todayKeyUtc(this.now()),
      created: 0,
      accepted: 0,
      cancelled: 0,
      expired: 0,
      finished: 0,
      lucky: 0,
      success: 0,
      fail: 0
    });
    const today = todayKeyUtc(this.now());
    if (String(stats?.day || "") !== today) {
      stats.day = today;
      stats.created = 0;
      stats.accepted = 0;
      stats.cancelled = 0;
      stats.expired = 0;
      stats.finished = 0;
      stats.lucky = 0;
      stats.success = 0;
      stats.fail = 0;
    }
    const name = String(field || "").trim();
    if (!name) return;
    stats[name] = Math.max(0, toInt(stats?.[name], 0)) + 1;
    await this._saveJson(key, stats, this._indexTtlSec());
  }

  async getAdminStats() {
    const open = await this._loadIndex(this._openIndexKey());
    const active = await this._loadIndex(this._activeIndexKey());
    const todayStats = await this._loadJson(this._statsKey(), null);

    let cursor = undefined;
    let scannedUsers = 0;
    let excludedAdmins = 0;
    let participants = 0;
    let withAccess = 0;
    let totalCompleted = 0;
    let totalNet = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix: "u:", cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const key of keys) {
        const raw = await this.db.get(key.name);
        if (!raw) continue;
        let u;
        try {
          u = JSON.parse(raw);
        } catch {
          continue;
        }
        const uid = String(u?.id || "");
        if (!uid) continue;
        if (this._isAdminUserId(uid)) {
          excludedAdmins += 1;
          continue;
        }
        scannedUsers += 1;
        this._ensureUserState(u);
        if (this._hasAccess(u)) withAccess += 1;
        const completed = Math.max(0, toInt(u?.syndicate?.completedTotal, 0));
        const net = Math.max(0, toInt(u?.syndicate?.netTotal, 0));
        if (completed > 0) participants += 1;
        totalCompleted += completed;
        totalNet += net;
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    let dealsScanned = 0;
    let finishedDeals = 0;
    const outcomes = { success: 0, lucky: 0, fail: 0, expired: 0, cancelled: 0 };
    cursor = undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix: "syndicate:deal:", cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const key of keys) {
        const raw = await this.db.get(key.name);
        if (!raw) continue;
        let deal;
        try {
          deal = JSON.parse(raw);
        } catch {
          continue;
        }
        dealsScanned += 1;
        const state = String(deal?.state || "");
        const outcome = String(deal?.outcome || "");
        if (state === "finished") finishedDeals += 1;
        if (Object.prototype.hasOwnProperty.call(outcomes, outcome)) {
          outcomes[outcome] += 1;
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    const topWeek = await this._loadRating("week");
    const topAll = await this._loadRating("all");
    return {
      scannedUsers,
      excludedAdmins,
      withAccess,
      participants,
      totalCompletedDealsApprox: Math.floor(totalCompleted / 2),
      totalNetApprox: Math.floor(totalNet / 2),
      openCount: open.length,
      activeCount: active.length,
      dealsScanned,
      finishedDeals,
      outcomes,
      topWeek,
      topAll,
      todayStats
    };
  }
}
