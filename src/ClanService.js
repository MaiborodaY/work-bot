
import { CONFIG } from "./GameConfig.js";
import { EconomyService } from "./EconomyService.js";
import { normalizeLang, t } from "./i18n/index.js";

const CLAN_INDEX_KEY = "clan:index";
const CLAN_STATE_WEEK_KEY = "clan:state:weekKey";
const CLAN_KEY_PREFIX = "clan:item:";
const CLAN_WEEK_SNAPSHOT_PREFIX = "clan:rank:week:";

export class ClanService {
  constructor({ db, users, now, economy, achievements = null }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.economy = economy || new EconomyService();
    this.achievements = achievements || null;

    this._ensurePromise = null;
    this._ensuredWeek = "";
  }

  _cfg() {
    return CONFIG?.CLANS || {};
  }

  _contractsMap() {
    return this._cfg().CONTRACTS || {};
  }

  _weekRewardTable() {
    return this._cfg().WEEKLY_REWARDS || {};
  }

  _eligibilityCfg() {
    return this._cfg().ELIGIBILITY || {};
  }

  _maxMembers() {
    return Math.max(1, Number(this._cfg().MAX_MEMBERS) || 20);
  }

  _contractSlots() {
    return Math.max(1, Number(this._cfg().CONTRACTS_PER_WEEK) || 3);
  }

  _alwaysContractId() {
    return String(this._cfg().ALWAYS_CONTRACT || "work_money");
  }

  _lang(u, lang = null) {
    return normalizeLang(lang || u?.lang || "ru");
  }

  _t(u, key, vars = {}, lang = null) {
    return t(key, this._lang(u, lang), vars);
  }

  _contractTitle(u, contract) {
    const id = String(contract?.id || "");
    const key = `clan.contract.${id}.title`;
    const translated = this._t(u, key);
    if (translated !== key) return translated;
    return String(contract?.title || id || this._t(u, "clan.default_name"));
  }

  _contractHint(u, contract) {
    const id = String(contract?.id || "");
    const key = `clan.contract.${id}.hint`;
    const translated = this._t(u, key);
    if (translated !== key) return translated;
    return String(contract?.hint || "");
  }

  _contractUnit(u, contract) {
    const id = String(contract?.id || "");
    const key = `clan.contract.${id}.unit`;
    const translated = this._t(u, key);
    if (translated !== key) return translated;
    return String(contract?.unit || "");
  }

  _dateStr(offsetMs = 0) {
    const d = new Date(this.now() + offsetMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _weekKey(ts = this.now()) {
    const d = new Date(ts);
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    const thursday = new Date(tmp);
    thursday.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    const diffDays = Math.floor((thursday.getTime() - firstThursday.getTime()) / 86400000);
    const week = 1 + Math.floor(diffDays / 7);
    return `${thursday.getUTCFullYear()}${String(week).padStart(2, "0")}`;
  }

  _nextWeekKey() {
    const now = new Date(this.now());
    const dayNum = (now.getUTCDay() + 6) % 7;
    const daysToNextMonday = 7 - dayNum;
    const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToNextMonday));
    return this._weekKey(nextMonday.getTime());
  }

  _nextWeekStartDateStr() {
    const now = new Date(this.now());
    const dayNum = (now.getUTCDay() + 6) % 7;
    const daysToNextMonday = 7 - dayNum;
    const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToNextMonday));
    const y = nextMonday.getUTCFullYear();
    const m = String(nextMonday.getUTCMonth() + 1).padStart(2, "0");
    const d = String(nextMonday.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  _clanKey(id) {
    return `${CLAN_KEY_PREFIX}${id}`;
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

  async _readIndex() {
    const raw = await this.db.get(CLAN_INDEX_KEY);
    const arr = this._safeJson(raw, []);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === "string" && x.trim());
  }

  async _writeIndex(ids) {
    const uniq = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x)).filter(Boolean))];
    await this.db.put(CLAN_INDEX_KEY, JSON.stringify(uniq));
    return uniq;
  }

  async _readClan(clanId) {
    if (!clanId) return null;
    const raw = await this.db.get(this._clanKey(clanId));
    return this._safeJson(raw, null);
  }

  async _saveClan(clan) {
    if (!clan || !clan.id) return;
    await this.db.put(this._clanKey(clan.id), JSON.stringify(clan));
  }

  _newMemberWeekStat() {
    return {
      points: 0,
      usefulEvents: 0,
      metrics: {
        work_money: 0,
        business_money: 0,
        fortune_net_profit: 0,
        active_actions: 0,
        daily_presence: 0
      },
      lastPresenceDay: ""
    };
  }

  _pickContractsForWeek() {
    const defs = this._contractsMap();
    const allIds = Object.keys(defs);
    const always = this._alwaysContractId();
    const slots = this._contractSlots();

    const selected = [];
    if (defs[always]) selected.push(always);

    const pool = allIds.filter((id) => id !== always);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    const need = Math.max(0, slots - selected.length);
    selected.push(...pool.slice(0, need));

    return selected.map((id) => {
      const d = defs[id] || {};
      const points = Math.max(1, Number(d.points) || 100);
      return {
        id,
        title: d.title || id,
        hint: d.hint || "",
        target: Math.max(1, Number(d.target) || 1),
        unit: d.unit || "",
        points,
        value: 0,
        score: 0,
        completed: false
      };
    });
  }

  _newWeekState(weekKey) {
    const contracts = this._pickContractsForWeek();
    const maxScore = contracts.reduce((sum, c) => sum + (Number(c.points) || 0), 0);
    return {
      weekKey,
      contracts,
      score: 0,
      maxScore,
      completedContracts: 0,
      scoreUpdatedAt: 0,
      members: {}
    };
  }

  _newClan({ id, name, ownerId, weekKey }) {
    const now = this.now();
    return {
      id,
      name,
      createdAt: now,
      createdBy: String(ownerId),
      open: true,
      maxMembers: this._maxMembers(),
      members: [String(ownerId)],
      week: this._newWeekState(weekKey),
      allTime: {
        score: 0,
        completedContracts: 0,
        weeksPlayed: 0,
        top1: 0,
        top3: 0
      },
      cosmetic: null,
      lastWeekResult: null
    };
  }
  _ensureClanShape(clan) {
    if (!clan || typeof clan !== "object") return null;
    if (!Array.isArray(clan.members)) clan.members = [];
    clan.members = [...new Set(clan.members.map((x) => String(x)).filter(Boolean))];
    if (typeof clan.name !== "string") clan.name = "Clan";
    if (typeof clan.open !== "boolean") clan.open = true;
    clan.maxMembers = this._maxMembers();

    if (!clan.allTime || typeof clan.allTime !== "object") {
      clan.allTime = { score: 0, completedContracts: 0, weeksPlayed: 0, top1: 0, top3: 0 };
    }
    if (typeof clan.allTime.score !== "number") clan.allTime.score = 0;
    if (typeof clan.allTime.completedContracts !== "number") clan.allTime.completedContracts = 0;
    if (typeof clan.allTime.weeksPlayed !== "number") clan.allTime.weeksPlayed = 0;
    if (typeof clan.allTime.top1 !== "number") clan.allTime.top1 = 0;
    if (typeof clan.allTime.top3 !== "number") clan.allTime.top3 = 0;

    if (!clan.week || typeof clan.week !== "object") {
      clan.week = this._newWeekState(this._weekKey());
    }
    if (!clan.week.members || typeof clan.week.members !== "object") clan.week.members = {};

    return clan;
  }

  _syncWeekContractsFromConfig(week) {
    if (!week || typeof week !== "object" || !Array.isArray(week.contracts)) return false;
    const defs = this._contractsMap();
    let changed = false;

    for (const contract of week.contracts) {
      if (!contract || typeof contract !== "object") continue;
      const id = String(contract.id || "");
      const def = defs[id];
      if (!def) continue;

      const nextTarget = Math.max(1, Number(def.target) || 1);
      const nextPoints = Math.max(1, Number(def.points) || 100);
      const nextTitle = String(def.title || id);
      const nextHint = String(def.hint || "");
      const nextUnit = String(def.unit || "");

      if (Number(contract.target) !== nextTarget) {
        contract.target = nextTarget;
        changed = true;
      }
      if (Number(contract.points) !== nextPoints) {
        contract.points = nextPoints;
        changed = true;
      }
      if (String(contract.title || "") !== nextTitle) {
        contract.title = nextTitle;
        changed = true;
      }
      if (String(contract.hint || "") !== nextHint) {
        contract.hint = nextHint;
        changed = true;
      }
      if (String(contract.unit || "") !== nextUnit) {
        contract.unit = nextUnit;
        changed = true;
      }
    }

    if (changed) {
      this._recomputeWeekScore(week);
    }
    return changed;
  }

  _ensureClanWeek(clan, weekKey) {
    this._ensureClanShape(clan);
    if (clan.week?.weekKey !== weekKey) {
      clan.week = this._newWeekState(weekKey);
    }
    if (!clan.week.members || typeof clan.week.members !== "object") {
      clan.week.members = {};
    }
    this._syncWeekContractsFromConfig(clan.week);
    return clan.week;
  }

  _ensureMemberWeek(clan, userId) {
    const week = clan.week;
    const uid = String(userId);
    if (!week.members[uid] || typeof week.members[uid] !== "object") {
      week.members[uid] = this._newMemberWeekStat();
    }
    const m = week.members[uid];
    if (typeof m.points !== "number") m.points = 0;
    if (typeof m.usefulEvents !== "number") m.usefulEvents = 0;
    if (!m.metrics || typeof m.metrics !== "object") {
      m.metrics = this._newMemberWeekStat().metrics;
    }
    if (typeof m.lastPresenceDay !== "string") m.lastPresenceDay = "";

    for (const key of ["work_money", "business_money", "fortune_net_profit", "active_actions", "daily_presence"]) {
      if (typeof m.metrics[key] !== "number") m.metrics[key] = 0;
    }
    return m;
  }

  _recomputeWeekScore(week) {
    const contracts = Array.isArray(week?.contracts) ? week.contracts : [];
    let totalScore = 0;
    let completed = 0;
    let maxScore = 0;

    for (const c of contracts) {
      const target = Math.max(1, Number(c.target) || 1);
      const points = Math.max(1, Number(c.points) || 100);
      const value = Math.max(0, Number(c.value) || 0);
      const ratio = Math.min(1, value / target);
      const score = Math.min(points, Math.floor(ratio * points));

      c.score = score;
      c.completed = score >= points;
      maxScore += points;
      totalScore += score;
      if (c.completed) completed += 1;
    }

    week.maxScore = maxScore;
    week.completedContracts = completed;
    week.score = totalScore;
  }

  _applyMetricDelta(clan, metricId, delta) {
    if (!delta) return { scoreDelta: 0 };
    const week = clan.week;
    const contracts = Array.isArray(week?.contracts) ? week.contracts : [];
    const c = contracts.find((x) => x?.id === metricId);
    if (!c) return { scoreDelta: 0 };

    const before = Math.max(0, Number(c.score) || 0);
    c.value = Math.max(0, Math.round((Number(c.value) || 0) + delta));

    this._recomputeWeekScore(week);

    const after = Math.max(0, Number(c.score) || 0);
    const scoreDelta = Math.max(0, after - before);
    if (scoreDelta > 0) {
      week.scoreUpdatedAt = this.now();
    }
    return { scoreDelta };
  }

  _makeClanId() {
    const t = this.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 8);
    return `c${t}${rnd}`.slice(0, 14);
  }

  validateClanName(raw, u = null) {
    if (typeof raw !== "string") return { ok: false, error: this._t(u, "clan.err.name_text") };
    const s = raw.trim();
    if (s.length < 2 || s.length > 24) {
      return { ok: false, error: this._t(u, "clan.err.name_len") };
    }
    if (s.includes("http") || s.includes("://") || s.includes("t.me/") || s.includes("@")) {
      return { ok: false, error: this._t(u, "clan.err.name_links") };
    }
    const re = /^[A-Za-z0-9 А-Яа-яЁёІіЇїЄєҐґ_.-]+$/u;
    if (!re.test(s)) {
      return { ok: false, error: this._t(u, "clan.err.name_chars") };
    }
    return { ok: true, value: s };
  }

  _isMember(clan, userId) {
    const uid = String(userId);
    return Array.isArray(clan?.members) && clan.members.some((x) => String(x) === uid);
  }

  async _loadAllClans() {
    const ids = await this._readIndex();
    const clans = [];
    const missing = [];

    for (const id of ids) {
      const clan = await this._readClan(id);
      if (!clan) {
        missing.push(id);
        continue;
      }
      this._ensureClanShape(clan);
      clans.push(clan);
    }

    if (missing.length) {
      const filtered = ids.filter((id) => !missing.includes(id));
      await this._writeIndex(filtered);
    }

    return clans;
  }

  _weeklyEntry(clan, weekKey) {
    const week = clan?.week?.weekKey === weekKey ? clan.week : null;
    const score = Math.max(0, Number(week?.score) || 0);
    const maxScore = Math.max(1, Number(week?.maxScore) || 1);
    const completedContracts = Math.max(0, Number(week?.completedContracts) || 0);
    const scoreUpdatedAt = Math.max(0, Number(week?.scoreUpdatedAt) || 0);

    return {
      clanId: String(clan.id),
      name: clan.name || "Clan",
      score,
      maxScore,
      completedContracts,
      scoreUpdatedAt,
      membersCount: Array.isArray(clan.members) ? clan.members.length : 0,
      cosmetic: clan.cosmetic || null,
      createdAt: Math.max(0, Number(clan.createdAt) || 0)
    };
  }

  _sortWeeklyEntries(entries) {
    entries.sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      if ((b.completedContracts || 0) !== (a.completedContracts || 0)) {
        return (b.completedContracts || 0) - (a.completedContracts || 0);
      }
      const at = a.scoreUpdatedAt > 0 ? a.scoreUpdatedAt : Number.MAX_SAFE_INTEGER;
      const bt = b.scoreUpdatedAt > 0 ? b.scoreUpdatedAt : Number.MAX_SAFE_INTEGER;
      if (at !== bt) return at - bt;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    return entries;
  }

  _sortAllTimeEntries(entries) {
    entries.sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      if ((b.completedContracts || 0) !== (a.completedContracts || 0)) {
        return (b.completedContracts || 0) - (a.completedContracts || 0);
      }
      if ((b.top1 || 0) !== (a.top1 || 0)) return (b.top1 || 0) - (a.top1 || 0);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    return entries;
  }

  _cosmeticLabel(tier, u = null) {
    if (tier === "top1") return this._t(u, "clan.cosmetic.top1");
    if (tier === "top2") return this._t(u, "clan.cosmetic.top2");
    if (tier === "top3") return this._t(u, "clan.cosmetic.top3");
    return "";
  }
  async ensureWeek() {
    const curWeek = this._weekKey();
    if (this._ensuredWeek === curWeek) return curWeek;

    if (this._ensurePromise) {
      await this._ensurePromise;
      return this._weekKey();
    }

    this._ensurePromise = (async () => {
      const storedWeek = (await this.db.get(CLAN_STATE_WEEK_KEY)) || "";

      if (!storedWeek) {
        await this.db.put(CLAN_STATE_WEEK_KEY, curWeek);
        this._ensuredWeek = curWeek;
        return;
      }

      if (storedWeek !== curWeek) {
        await this._finalizeWeek(storedWeek, curWeek);
        await this.db.put(CLAN_STATE_WEEK_KEY, curWeek);
      }

      this._ensuredWeek = curWeek;
    })();

    try {
      await this._ensurePromise;
    } finally {
      this._ensurePromise = null;
    }

    return this._weekKey();
  }

  _eligibleMemberIdsForReward(clan) {
    const cfg = this._eligibilityCfg();
    const minShare = Math.max(0, Number(cfg.MIN_SHARE) || 0.01);
    const minUseful = Math.max(0, Number(cfg.MIN_USEFUL_EVENTS) || 3);

    const week = clan?.week;
    const score = Math.max(0, Number(week?.score) || 0);
    const members = Array.isArray(clan?.members) ? clan.members.map((x) => String(x)) : [];
    const res = [];

    for (const uid of members) {
      const m = week?.members?.[uid] || this._newMemberWeekStat();
      const points = Math.max(0, Number(m.points) || 0);
      const useful = Math.max(0, Number(m.usefulEvents) || 0);
      const share = score > 0 ? points / score : 0;
      if (share >= minShare || useful >= minUseful) {
        res.push(uid);
      }
    }

    return res;
  }

  _memberCompletedContractsCount(clan, userId) {
    const uid = String(userId || "");
    if (!uid) return 0;
    const week = clan?.week;
    const contracts = Array.isArray(week?.contracts) ? week.contracts : [];
    const metrics = week?.members?.[uid]?.metrics || {};
    let done = 0;
    for (const c of contracts) {
      if (!c?.completed) continue;
      const metricId = String(c.id || "");
      if (!metricId) continue;
      const personal = Math.max(0, Number(metrics?.[metricId]) || 0);
      if (personal > 0) done += 1;
    }
    return done;
  }

  async _applyClanRewardToUser(userId, reward) {
    const u = await this.users.load(userId).catch(() => null);
    if (!u) return false;

    const money = Math.max(0, Number(reward?.money) || 0);
    const premium = Math.max(0, Number(reward?.premium) || 0);

    if (money || premium) {
      if (this.economy && typeof this.economy.applyReward === "function") {
        this.economy.applyReward(u, { money, premium, reason: "clan_weekly_reward" });
      } else {
        if (money) u.money = (u.money || 0) + money;
        if (premium) u.premium = (u.premium || 0) + premium;
      }
    }

    const cosmeticTier = String(reward?.cosmeticTier || "");
    if (cosmeticTier) {
      u.clanCosmetic = {
        tier: cosmeticTier,
        weekKey: this._weekKey(),
        label: this._cosmeticLabel(cosmeticTier, u)
      };
    }

    if (money || premium || cosmeticTier) {
      await this.users.save(u);
    }

    return true;
  }

  async _finalizeWeek(oldWeek, newWeek) {
    const clans = await this._loadAllClans();
    if (!clans.length) return;

    const byId = new Map();
    const memberIds = new Set();
    for (const clan of clans) {
      byId.set(String(clan.id), clan);
      this._ensureClanShape(clan);
      clan.cosmetic = null;
      for (const uid of clan.members || []) {
        memberIds.add(String(uid));
      }
    }

    for (const uid of memberIds) {
      const u = await this.users.load(uid).catch(() => null);
      if (!u || !u.clanCosmetic) continue;
      u.clanCosmetic = null;
      await this.users.save(u);
    }

    const weekly = this._sortWeeklyEntries(
      clans.map((c) => this._weeklyEntry(c, oldWeek))
    );

    const rewards = this._weekRewardTable();
    const snapshot = [];

    for (let i = 0; i < weekly.length; i++) {
      const place = i + 1;
      const entry = weekly[i];
      const clan = byId.get(entry.clanId);
      if (!clan) continue;

      const reward = rewards?.[place] || rewards?.[String(place)] || null;
      const eligible = reward ? this._eligibleMemberIdsForReward(clan) : [];

      if (reward?.cosmeticTier) {
        clan.cosmetic = {
          tier: reward.cosmeticTier,
          weekKey: newWeek,
          label: ""
        };
      }

      if (reward && eligible.length) {
        for (const uid of eligible) {
          await this._applyClanRewardToUser(uid, reward);
        }
      }

      if (this.achievements?.onEvent && (entry.completedContracts || 0) > 0) {
        for (const uid of clan.members || []) {
          const completedByUser = this._memberCompletedContractsCount(clan, uid);
          if (completedByUser <= 0) continue;
          const member = await this.users.load(uid).catch(() => null);
          if (!member) continue;
          try {
            await this.achievements.onEvent(member, "clan_contracts_completed", { count: completedByUser });
          } catch {}
        }
      }

      clan.allTime.score = (clan.allTime.score || 0) + (entry.score || 0);
      clan.allTime.completedContracts = (clan.allTime.completedContracts || 0) + (entry.completedContracts || 0);
      clan.allTime.weeksPlayed = (clan.allTime.weeksPlayed || 0) + 1;
      if (place === 1) clan.allTime.top1 = (clan.allTime.top1 || 0) + 1;
      if (place <= 3) clan.allTime.top3 = (clan.allTime.top3 || 0) + 1;

      clan.lastWeekResult = {
        weekKey: oldWeek,
        place,
        score: entry.score,
        completedContracts: entry.completedContracts,
        reward: reward ? {
          money: Math.max(0, Number(reward.money) || 0),
          premium: Math.max(0, Number(reward.premium) || 0),
          cosmeticTier: reward.cosmeticTier || ""
        } : null
      };

      snapshot.push({
        place,
        clanId: entry.clanId,
        name: entry.name,
        score: entry.score,
        maxScore: entry.maxScore,
        completedContracts: entry.completedContracts,
        reward: reward ? {
          money: Math.max(0, Number(reward.money) || 0),
          premium: Math.max(0, Number(reward.premium) || 0),
          cosmeticTier: reward.cosmeticTier || ""
        } : null,
        rewardedMembers: eligible.length
      });
    }

    for (const clan of clans) {
      clan.week = this._newWeekState(newWeek);
      await this._saveClan(clan);
    }

    await this.db.put(`${CLAN_WEEK_SNAPSHOT_PREFIX}${oldWeek}`, JSON.stringify(snapshot));
  }

  async getClanById(clanId) {
    await this.ensureWeek();
    const curWeek = this._weekKey();
    const clan = await this._readClan(clanId);
    if (!clan) return null;
    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, curWeek);
    return clan;
  }

  async getClanForUser(u) {
    await this.ensureWeek();
    const clanId = String(u?.clan?.clanId || "");
    if (!clanId) return null;

    const curWeek = this._weekKey();
    const clan = await this._readClan(clanId);
    if (!clan) {
      u.clan.clanId = "";
      u.clan.joinedAt = 0;
      u.clan.lastPresenceDay = "";
      u.clanCosmetic = null;
      await this.users.save(u);
      return null;
    }

    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, curWeek);
    if (!this._isMember(clan, u.id)) {
      u.clan.clanId = "";
      u.clan.joinedAt = 0;
      u.clan.lastPresenceDay = "";
      u.clanCosmetic = null;
      await this.users.save(u);
      return null;
    }

    return clan;
  }

  canJoinNow(u) {
    const curWeek = this._weekKey();
    if (String(u?.clan?.clanId || "")) {
      return { ok: false, error: this._t(u, "clan.err.leave_current") };
    }

    const blocked = String(u?.clan?.joinAvailableFromWeek || "");
    if (blocked && curWeek < blocked) {
      return {
        ok: false,
        error: this._t(u, "clan.err.join_next_week")
      };
    }

    return { ok: true };
  }

  async createClan(u, rawName) {
    await this.ensureWeek();

    const canJoin = this.canJoinNow(u);
    if (!canJoin.ok) return canJoin;

    const valid = this.validateClanName(rawName, u);
    if (!valid.ok) return valid;

    const weekKey = this._weekKey();
    const ids = await this._readIndex();

    let clanId = this._makeClanId();
    const exists = new Set(ids);
    while (exists.has(clanId)) {
      clanId = this._makeClanId();
    }

    const clan = this._newClan({
      id: clanId,
      name: valid.value,
      ownerId: u.id,
      weekKey
    });

    this._ensureMemberWeek(clan, u.id);

    await this._saveClan(clan);
    await this._writeIndex([...ids, clanId]);

    u.clan.clanId = clanId;
    u.clan.joinedAt = this.now();
    u.clan.lastPresenceDay = "";
    u.awaitingClanName = false;
    await this.users.save(u);

    await this.touchDailyPresence(u);

    return { ok: true, clan };
  }
  async joinClan(u, clanId) {
    await this.ensureWeek();

    const canJoin = this.canJoinNow(u);
    if (!canJoin.ok) return canJoin;

    const clan = await this._readClan(clanId);
    if (!clan) return { ok: false, error: this._t(u, "clan.err.not_found") };

    const weekKey = this._weekKey();
    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, weekKey);

    if (!clan.open) return { ok: false, error: this._t(u, "clan.err.closed") };

    const uid = String(u.id);
    if (this._isMember(clan, uid)) {
      u.clan.clanId = String(clan.id);
      u.clan.joinedAt = this.now();
      u.clan.lastPresenceDay = "";
      await this.users.save(u);
      return { ok: true, clan };
    }

    if ((clan.members?.length || 0) >= Math.max(1, Number(clan.maxMembers) || this._maxMembers())) {
      return { ok: false, error: this._t(u, "clan.err.full") };
    }

    clan.members.push(uid);
    this._ensureMemberWeek(clan, uid);
    await this._saveClan(clan);

    u.clan.clanId = String(clan.id);
    u.clan.joinedAt = this.now();
    u.clan.lastPresenceDay = "";
    u.awaitingClanName = false;
    await this.users.save(u);

    await this.touchDailyPresence(u);

    return { ok: true, clan };
  }

  async leaveClan(u) {
    await this.ensureWeek();

    const clanId = String(u?.clan?.clanId || "");
    if (!clanId) return { ok: false, error: this._t(u, "clan.err.not_member") };

    const clan = await this._readClan(clanId);
    if (clan) {
      this._ensureClanShape(clan);
      clan.members = clan.members.filter((id) => String(id) !== String(u.id));
      await this._saveClan(clan);
    }

    const nextWeek = this._nextWeekKey();
    const nextWeekStart = this._nextWeekStartDateStr();

    u.clan.clanId = "";
    u.clan.joinedAt = 0;
    u.clan.joinAvailableFromWeek = nextWeek;
    u.clan.lastPresenceDay = "";
    u.clanCosmetic = null;
    u.awaitingClanName = false;
    await this.users.save(u);

    return { ok: true, nextWeek, nextWeekStart };
  }

  async touchDailyPresence(u) {
    await this.ensureWeek();

    const clanId = String(u?.clan?.clanId || "");
    if (!clanId) return { ok: false, reason: "no_clan" };

    const today = this._dateStr();
    if (u?.clan?.lastPresenceDay === today) {
      return { ok: true, changed: false };
    }

    const clan = await this._readClan(clanId);
    if (!clan) return { ok: false, reason: "clan_not_found" };

    const weekKey = this._weekKey();
    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, weekKey);

    if (!this._isMember(clan, u.id)) return { ok: false, reason: "not_member" };

    const m = this._ensureMemberWeek(clan, u.id);
    if (m.lastPresenceDay === today) {
      if (u?.clan) {
        u.clan.lastPresenceDay = today;
        await this.users.save(u);
      }
      return { ok: true, changed: false };
    }

    m.lastPresenceDay = today;
    m.metrics.daily_presence = (m.metrics.daily_presence || 0) + 1;

    this._applyMetricDelta(clan, "daily_presence", 1);

    await this._saveClan(clan);

    if (u?.clan) {
      u.clan.lastPresenceDay = today;
      await this.users.save(u);
    }

    return { ok: true, changed: true };
  }

  async _recordEvent(u, { metrics = {}, usefulEvents = 0 } = {}) {
    await this.ensureWeek();

    const clanId = String(u?.clan?.clanId || "");
    if (!clanId) return { ok: false, reason: "no_clan" };

    const clan = await this._readClan(clanId);
    if (!clan) return { ok: false, reason: "clan_not_found" };

    const weekKey = this._weekKey();
    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, weekKey);
    if (!this._isMember(clan, u.id)) return { ok: false, reason: "not_member" };

    const m = this._ensureMemberWeek(clan, u.id);

    let totalScoreDelta = 0;
    for (const [metricId, rawDelta] of Object.entries(metrics || {})) {
      const delta = Math.max(0, Math.round(Number(rawDelta) || 0));
      if (!delta) continue;

      m.metrics[metricId] = Math.max(0, Math.round((Number(m.metrics[metricId]) || 0) + delta));
      const { scoreDelta } = this._applyMetricDelta(clan, metricId, delta);
      totalScoreDelta += scoreDelta;
    }

    if (totalScoreDelta > 0) {
      m.points = (m.points || 0) + totalScoreDelta;
      clan.week.scoreUpdatedAt = this.now();
    }

    if (usefulEvents > 0) {
      m.usefulEvents = (m.usefulEvents || 0) + Math.max(0, Math.round(usefulEvents));
    }

    await this._saveClan(clan);
    return { ok: true, scoreDelta: totalScoreDelta };
  }

  async recordWorkMoney(u, amount) {
    const val = Math.max(0, Math.round(Number(amount) || 0));
    if (!val) return { ok: false, reason: "empty" };
    return this._recordEvent(u, {
      metrics: { work_money: val, active_actions: 1 },
      usefulEvents: 1
    });
  }

  async recordBusinessMoney(u, amount) {
    const val = Math.max(0, Math.round(Number(amount) || 0));
    if (!val) return { ok: false, reason: "empty" };
    return this._recordEvent(u, {
      metrics: { business_money: val, active_actions: 1 },
      usefulEvents: 1
    });
  }

  async recordFortuneSpin(u, { bet = 0, win = 0 } = {}) {
    const safeBet = Math.max(0, Math.round(Number(bet) || 0));
    const safeWin = Math.max(0, Math.round(Number(win) || 0));
    const net = Math.max(0, safeWin - safeBet);

    const metrics = { active_actions: 1 };
    if (net > 0) metrics.fortune_net_profit = net;

    return this._recordEvent(u, { metrics, usefulEvents: 1 });
  }

  async recordActiveAction(u, count = 1, usefulEvents = 1) {
    const n = Math.max(0, Math.round(Number(count) || 0));
    if (!n) return { ok: false, reason: "empty" };
    return this._recordEvent(u, {
      metrics: { active_actions: n },
      usefulEvents: Math.max(0, Math.round(Number(usefulEvents) || 0))
    });
  }

  async getWeeklyRating(limit = 10) {
    await this.ensureWeek();
    const curWeek = this._weekKey();
    const clans = await this._loadAllClans();

    const entries = this._sortWeeklyEntries(
      clans.map((c) => {
        this._ensureClanShape(c);
        this._ensureClanWeek(c, curWeek);
        return this._weeklyEntry(c, curWeek);
      })
    );

    return entries.slice(0, Math.max(1, Number(limit) || 10)).map((x, idx) => ({ ...x, place: idx + 1 }));
  }

  async getAllTimeRating(limit = 10) {
    await this.ensureWeek();
    const clans = await this._loadAllClans();

    const entries = this._sortAllTimeEntries(
      clans.map((clan) => ({
        clanId: String(clan.id),
        name: clan.name || "Clan",
        score: Math.max(0, Number(clan?.allTime?.score) || 0),
        completedContracts: Math.max(0, Number(clan?.allTime?.completedContracts) || 0),
        weeksPlayed: Math.max(0, Number(clan?.allTime?.weeksPlayed) || 0),
        top1: Math.max(0, Number(clan?.allTime?.top1) || 0),
        top3: Math.max(0, Number(clan?.allTime?.top3) || 0),
        membersCount: Array.isArray(clan.members) ? clan.members.length : 0,
        createdAt: Math.max(0, Number(clan.createdAt) || 0),
        cosmetic: clan.cosmetic || null
      }))
    );

    return entries.slice(0, Math.max(1, Number(limit) || 10)).map((x, idx) => ({ ...x, place: idx + 1 }));
  }

  async listOpenClans(limit = 20) {
    await this.ensureWeek();
    const curWeek = this._weekKey();
    const clans = await this._loadAllClans();

    const list = clans
      .filter((clan) => !!clan.open)
      .map((clan) => {
        this._ensureClanShape(clan);
        this._ensureClanWeek(clan, curWeek);
        const e = this._weeklyEntry(clan, curWeek);
        return {
          clanId: e.clanId,
          name: e.name,
          membersCount: e.membersCount,
          maxMembers: Math.max(1, Number(clan.maxMembers) || this._maxMembers()),
          score: e.score,
          completedContracts: e.completedContracts,
          maxScore: e.maxScore,
          joinable: e.membersCount < Math.max(1, Number(clan.maxMembers) || this._maxMembers())
        };
      });

    list.sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      if ((b.completedContracts || 0) !== (a.completedContracts || 0)) {
        return (b.completedContracts || 0) - (a.completedContracts || 0);
      }
      return (b.membersCount || 0) - (a.membersCount || 0);
    });

    return list.slice(0, Math.max(1, Number(limit) || 20));
  }
  async buildMainView(u) {
    await this.ensureWeek();

    const canJoin = this.canJoinNow(u);
    const clan = await this.getClanForUser(u);

    if (!clan) {
      const lines = [this._t(u, "clan.main.no_clan_caption")];

      if (!canJoin.ok) {
        lines.push(`\n⚠️ ${canJoin.error}`);
      }

      return {
        caption: lines.join("\n"),
        keyboard: [
          [{ text: this._t(u, "clan.btn.create"), callback_data: "clan:create_prompt" }],
          [{ text: this._t(u, "clan.btn.open"), callback_data: "clan:list" }],
          [{ text: this._t(u, "clan.btn.weekly"), callback_data: "clan:weekly_top" }],
          [{ text: this._t(u, "clan.btn.all_time"), callback_data: "clan:all_time" }],
          [{ text: this._t(u, "clan.btn.rating_info"), callback_data: "clan:rating_info" }],
          [{ text: this._t(u, "worker.btn.back"), callback_data: "go:City" }]
        ]
      };
    }

    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, this._weekKey());

    const week = clan.week;
    const membersCount = Array.isArray(clan.members) ? clan.members.length : 0;
    const maxMembers = Math.max(1, Number(clan.maxMembers) || this._maxMembers());
    const contractsCount = Array.isArray(week.contracts) ? week.contracts.length : 0;
    const cosmetic = this._cosmeticLabel(clan?.cosmetic?.tier, u) || "";

    const lines = [
      this._t(u, "clan.main.clan", { name: clan.name }),
      this._t(u, "clan.main.members", { count: membersCount, max: maxMembers }),
      this._t(u, "clan.main.week_score", { score: week.score, max: week.maxScore }),
      this._t(u, "clan.main.contracts", { done: week.completedContracts, total: contractsCount })
    ];

    if (cosmetic) {
      lines.push(this._t(u, "clan.main.week_status", { cosmetic }));
    }

    if (clan.lastWeekResult && clan.lastWeekResult.weekKey) {
      lines.push("");
      lines.push(this._t(u, "clan.main.last_week", {
        name: clan.name,
        weekKey: clan.lastWeekResult.weekKey,
        place: clan.lastWeekResult.place || "-",
        score: clan.lastWeekResult.score || 0
      }));
    }

    return {
      caption: lines.join("\n"),
      keyboard: [
        [{ text: this._t(u, "clan.btn.contracts"), callback_data: "clan:contracts" }],
        [{ text: this._t(u, "clan.btn.members"), callback_data: "clan:members" }],
        [{ text: this._t(u, "clan.btn.weekly"), callback_data: "clan:weekly_top" }],
        [{ text: this._t(u, "clan.btn.all_time"), callback_data: "clan:all_time" }],
        [{ text: this._t(u, "clan.btn.rating_info"), callback_data: "clan:rating_info" }],
        [{ text: this._t(u, "clan.btn.leave"), callback_data: "clan:leave" }],
        [{ text: this._t(u, "worker.btn.back"), callback_data: "go:City" }]
      ]
    };
  }

  async buildContractsView(u) {
    await this.ensureWeek();
    const clan = await this.getClanForUser(u);
    if (!clan) {
      return {
        caption: this._t(u, "clan.view.no_membership"),
        keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
      };
    }

    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, this._weekKey());

    const lines = [
      this._t(u, "clan.contracts.title", { name: clan.name }),
      this._t(u, "clan.contracts.score", { score: clan.week.score, max: clan.week.maxScore }),
      ""
    ];

    for (const c of clan.week.contracts || []) {
      const target = Math.max(1, Number(c.target) || 1);
      const value = Math.max(0, Number(c.value) || 0);
      const pct = Math.min(100, Math.floor((value / target) * 100));
      const unitRaw = this._contractUnit(u, c);
      const unit = unitRaw ? ` ${unitRaw}` : "";
      const done = c.completed ? this._t(u, "clan.contract.done") : this._t(u, "clan.contract.in_progress");
      const title = this._contractTitle(u, c);
      const hint = this._contractHint(u, c);

      lines.push(`${done} ${title}`);
      lines.push(this._t(u, "clan.contract.target", { target, unit }));
      lines.push(this._t(u, "clan.contract.progress", { value, target, unit, pct }));
      lines.push(this._t(u, "clan.contract.points", { score: c.score, points: c.points }));
      if (hint) lines.push(this._t(u, "clan.contract.how_counted", { hint }));
      lines.push("");
    }

    return {
      caption: lines.join("\n").trim(),
      keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
    };
  }

  async buildMembersView(u) {
    await this.ensureWeek();
    const clan = await this.getClanForUser(u);
    if (!clan) {
      return {
        caption: this._t(u, "clan.view.no_membership"),
        keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
      };
    }

    this._ensureClanShape(clan);
    this._ensureClanWeek(clan, this._weekKey());

    const weekScore = Math.max(0, Number(clan.week.score) || 0);
    const lines = [this._t(u, "clan.members.title", { name: clan.name }), ""];

    for (const uid of clan.members || []) {
      const user = await this.users.load(uid).catch(() => null);
      const m = clan.week?.members?.[String(uid)] || this._newMemberWeekStat();
      const name = user?.displayName && String(user.displayName).trim()
        ? String(user.displayName).trim()
        : this._t(u, "clan.members.player_fallback", { id: String(uid).slice(-4).padStart(4, "0") });
      const tier = String(user?.clanCosmetic?.tier || "");
      const cosmeticPrefix = tier === "top1"
        ? "🥇"
        : tier === "top2"
          ? "🥈"
          : tier === "top3"
            ? "🥉"
            : "";
      const shownName = cosmeticPrefix ? `${cosmeticPrefix} ${name}` : name;

      const pts = Math.max(0, Number(m.points) || 0);
      const useful = Math.max(0, Number(m.usefulEvents) || 0);
      const share = weekScore > 0 ? Math.floor((pts / weekScore) * 1000) / 10 : 0;

      lines.push(`${shownName}`);
      lines.push(this._t(u, "clan.members.contribution", { pts, share }));
      lines.push(this._t(u, "clan.members.useful_events", { useful }));
      lines.push("");
    }

    return {
      caption: lines.join("\n").trim(),
      keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
    };
  }

  async buildOpenClansView(u) {
    await this.ensureWeek();
    const list = await this.listOpenClans(15);

    const lines = [this._t(u, "clan.open.title"), ""];
    if (!list.length) {
      lines.push(this._t(u, "clan.open.empty"));
    } else {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        lines.push(`${i + 1}. ${c.name}`);
        lines.push(this._t(u, "clan.open.members", { count: c.membersCount, max: c.maxMembers }));
        lines.push(this._t(u, "clan.open.score", { score: c.score, max: c.maxScore }));
        lines.push(this._t(u, "clan.open.contracts", { done: c.completedContracts, total: this._contractSlots() }));
        lines.push("");
      }
    }

    const kb = [];
    const canJoin = this.canJoinNow(u);
    if (canJoin.ok) {
      for (const c of list) {
        if (!c.joinable) continue;
        kb.push([{ text: this._t(u, "clan.open.join_btn", { name: c.name }), callback_data: `clan:join:${c.clanId}` }]);
      }
    }

    kb.push([{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]);

    if (!canJoin.ok) {
      lines.push(`⚠️ ${canJoin.error}`);
    }

    return {
      caption: lines.join("\n").trim(),
      keyboard: kb
    };
  }

  async buildWeeklyTopView(u = null) {
    await this.ensureWeek();
    const list = await this.getWeeklyRating(10);
    const lines = [this._t(u, "clan.top.weekly.title"), ""];

    if (!list.length) {
      lines.push(this._t(u, "clan.top.empty"));
    } else {
      const medals = ["1.", "2.", "3."];
      for (let i = 0; i < list.length; i++) {
        const x = list[i];
        const mark = medals[i] || `${i + 1}.`;
        const badgeLabel = this._cosmeticLabel(x?.cosmetic?.tier, u);
        const badge = badgeLabel ? ` ${badgeLabel}` : "";
        lines.push(`${mark} ${x.name}${badge}`);
        lines.push(this._t(u, "clan.top.weekly.line", {
          score: x.score,
          max: x.maxScore,
          done: x.completedContracts,
          total: this._contractSlots()
        }));
      }
    }

    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
    };
  }

  async buildAllTimeTopView(u = null) {
    await this.ensureWeek();
    const list = await this.getAllTimeRating(10);
    const lines = [this._t(u, "clan.top.alltime.title"), ""];

    if (!list.length) {
      lines.push(this._t(u, "clan.top.empty"));
    } else {
      const medals = ["1.", "2.", "3."];
      for (let i = 0; i < list.length; i++) {
        const x = list[i];
        const mark = medals[i] || `${i + 1}.`;
        lines.push(`${mark} ${x.name}`);
        lines.push(this._t(u, "clan.top.alltime.line1", { score: x.score, contracts: x.completedContracts }));
        lines.push(this._t(u, "clan.top.alltime.line2", { weeks: x.weeksPlayed, top1: x.top1 }));
      }
    }

    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
    };
  }

  buildRatingInfoView(u = null) {
    const lines = [
      this._t(u, "clan.rating.title"),
      "",
      this._t(u, "clan.rating.caption")
    ];

    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: this._t(u, "worker.btn.back"), callback_data: "go:Clan" }]]
    };
  }

  async getLastWeekSnapshot(weekKey) {
    const key = `${CLAN_WEEK_SNAPSHOT_PREFIX}${weekKey}`;
    const raw = await this.db.get(key);
    const arr = this._safeJson(raw, []);
    return Array.isArray(arr) ? arr : [];
  }
}
