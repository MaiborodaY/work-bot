import { CONFIG } from "./GameConfig.js";
import { formatMoney, normalizeLang, t } from "./i18n/index.js";
import { EnergyService } from "./EnergyService.js";
import { ensurePlayerStatsShape } from "./PlayerStats.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function n(raw) {
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

function toInt(raw, min = 0) {
  return Math.max(min, Math.floor(n(raw)));
}

function dayStr(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayToMs(day) {
  const s = String(day || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  return Date.UTC(y, mm - 1, dd);
}

function dayDiff(a, b) {
  const da = parseDayToMs(a);
  const db = parseDayToMs(b);
  if (!da || !db) return 0;
  return Math.floor((db - da) / DAY_MS);
}

function isoWeekKey(ts) {
  const d = new Date(ts);
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const diff = Math.floor((tmp.getTime() - firstThu.getTime()) / DAY_MS);
  const week = 1 + Math.floor(diff / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function seed() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seed) {
  const seedFn = xmur3(String(seed || ""));
  return mulberry32(seedFn());
}

function shuffleDeterministic(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DIFF_SCORE = { easy: 1, medium: 2, hard: 3 };

export class QuestService {
  constructor({ users, now, bot = null }) {
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _cfg() {
    return CONFIG?.QUESTS || {};
  }

  _dailyPool() {
    return Array.isArray(this._cfg().DAILY_POOL) ? this._cfg().DAILY_POOL : [];
  }

  _weeklyPool() {
    return Array.isArray(this._cfg().WEEKLY_POOL) ? this._cfg().WEEKLY_POOL : [];
  }

  _dailyCount() {
    return Math.max(1, toInt(this._cfg().DAILY_COUNT, 1));
  }

  _weeklyCount() {
    return Math.max(1, toInt(this._cfg().WEEKLY_COUNT, 1));
  }

  _dailyBonusGems() {
    return Math.max(0, toInt(this._cfg().DAILY_BONUS_GEMS, 0));
  }

  _weeklyBonusGems() {
    return Math.max(0, toInt(this._cfg().WEEKLY_BONUS_GEMS, 0));
  }

  _subBonusRewardMoney() {
    return Math.max(0, toInt(this._cfg().SUB_BONUS_REWARD_MONEY, 0));
  }

  _petBuyGuideRewardMoney() {
    return Math.max(0, toInt(this._cfg().PET_BUY_GUIDE_REWARD_MONEY, 0));
  }

  _firstBizGuideRewardMoney() {
    return Math.max(0, toInt(this._cfg().FIRST_BIZ_GUIDE_REWARD_MONEY, 0));
  }

  _studyGuideRewardMoney() {
    return Math.max(0, toInt(this._cfg().STUDY5_GUIDE_REWARD_MONEY, 0));
  }

  _studyGuideRewardGems() {
    return Math.max(0, toInt(this._cfg().STUDY5_GUIDE_REWARD_GEMS, 0));
  }

  _clanJoinGuideRewardMoney() {
    return Math.max(0, toInt(this._cfg().CLAN_JOIN_GUIDE_REWARD_MONEY, 0));
  }

  _newbiePathDefs() {
    return Array.isArray(this._cfg().NEWBIE_PATH) ? this._cfg().NEWBIE_PATH : [];
  }

  _newbieFinalRewardMoney() {
    return Math.max(0, toInt(this._cfg().NEWBIE_FINAL_REWARD_MONEY, 0));
  }

  _newbieFinalRewardGems() {
    return Math.max(0, toInt(this._cfg().NEWBIE_FINAL_REWARD_GEMS, 0));
  }

  _dailyCounterDefaults() {
    return {
      workShifts: 0,
      workEarn: 0,
      gymTrains: 0,
      petFeeds: 0,
      farmHarvests: 0,
      fortuneSpins: 0,
      quizPlays: 0,
      dailyClaims: 0,
      bizClaims: 0,
      bizCollectAll: 0,
      bizGuard: 0,
      labourHires: 0,
      stocksBuys: 0,
      stocksSells: 0,
      stocksHoldings3: 0,
      stocksInvested: 0,
      stocksPortfolioMax: 0,
      thiefAttempts: 0,
      thiefSuccesses: 0
    };
  }

  _weeklyCounterDefaults() {
    return {
      workShifts: 0,
      workEarn: 0,
      gymTrains: 0,
      colosseumBattles: 0,
      farmPlants: 0,
      farmHarvestCarrot: 0,
      farmHarvestTomato: 0,
      farmHarvestCorn: 0,
      bizClaimDays: 0,
      bizExpands: 0,
      labourHires: 0,
      labourOwnerContractFinishes: 0,
      stocksProfitSells: 0,
      stocksHoldings5: 0,
      stocksInvested: 0,
      thiefAttempts: 0,
      thiefStolen: 0
    };
  }

  _ensureCounters(target, defaults) {
    let dirty = false;
    if (!target || typeof target !== "object") return { value: { ...defaults }, dirty: true };
    for (const [k, v] of Object.entries(defaults)) {
      if (typeof target[k] !== "number" || !Number.isFinite(target[k])) {
        target[k] = v;
        dirty = true;
      }
    }
    return { value: target, dirty };
  }

  _ensureModel(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;

    if (!u.flags || typeof u.flags !== "object") {
      u.flags = {};
      dirty = true;
    }
    if (typeof u.flags.subBonusClaimed !== "boolean") {
      u.flags.subBonusClaimed = false;
      dirty = true;
    }
    if (typeof u.flags.petBuyGuideClaimed !== "boolean") {
      u.flags.petBuyGuideClaimed = false;
      dirty = true;
    }
    if (typeof u.flags.firstBizGuideClaimed !== "boolean") {
      u.flags.firstBizGuideClaimed = false;
      dirty = true;
    }
    if (typeof u.flags.studyLevel5GuideClaimed !== "boolean") {
      u.flags.studyLevel5GuideClaimed = false;
      dirty = true;
    }
    if (typeof u.flags.clanJoinGuideClaimed !== "boolean") {
      u.flags.clanJoinGuideClaimed = false;
      dirty = true;
    }

    if (!u.quests || typeof u.quests !== "object") {
      u.quests = {};
      dirty = true;
    }
    if (!u.quests.daily || typeof u.quests.daily !== "object") {
      u.quests.daily = {};
      dirty = true;
    }
    if (!u.quests.weekly || typeof u.quests.weekly !== "object") {
      u.quests.weekly = {};
      dirty = true;
    }

    const d = u.quests.daily;
    if (typeof d.day !== "string") { d.day = ""; dirty = true; }
    if (!Array.isArray(d.list)) { d.list = []; dirty = true; }
    if (typeof d.bonusPaid !== "boolean") { d.bonusPaid = false; dirty = true; }
    const dRes = this._ensureCounters(d.counters, this._dailyCounterDefaults());
    d.counters = dRes.value;
    dirty = dirty || dRes.dirty;

    const w = u.quests.weekly;
    if (typeof w.week !== "string") { w.week = ""; dirty = true; }
    if (!Array.isArray(w.list)) { w.list = []; dirty = true; }
    if (typeof w.bonusPaid !== "boolean") { w.bonusPaid = false; dirty = true; }
    if (typeof w.bizStreakCurrent !== "number" || !Number.isFinite(w.bizStreakCurrent)) {
      w.bizStreakCurrent = 0;
      dirty = true;
    }
    if (typeof w.lastBizClaimDay !== "string") {
      w.lastBizClaimDay = "";
      dirty = true;
    }
    const wRes = this._ensureCounters(w.counters, this._weeklyCounterDefaults());
    w.counters = wRes.value;
    dirty = dirty || wRes.dirty;

    for (const group of [d.list, w.list]) {
      for (const q of group) {
        if (!q || typeof q !== "object") continue;
        if (typeof q.id !== "string") { q.id = ""; dirty = true; }
        if (typeof q.type !== "string") { q.type = "daily"; dirty = true; }
        if (typeof q.category !== "string") { q.category = "work"; dirty = true; }
        if (typeof q.difficulty !== "string") { q.difficulty = "easy"; dirty = true; }
        if (typeof q.rewardMoney !== "number" || !Number.isFinite(q.rewardMoney)) { q.rewardMoney = 0; dirty = true; }
        if (typeof q.target !== "number" || !Number.isFinite(q.target)) { q.target = 1; dirty = true; }
        if (typeof q.progress !== "number" || !Number.isFinite(q.progress)) { q.progress = 0; dirty = true; }
        if (typeof q.done !== "boolean") { q.done = false; dirty = true; }
        if (typeof q.paid !== "boolean") { q.paid = false; dirty = true; }
      }
    }

    return dirty;
  }

  _ensureNewbiePathModel(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;
    const completedStep = this._newbiePathDefs().length + 1;
    const defs = this._newbiePathDefs();
    if (!u.newbiePath || typeof u.newbiePath !== "object") {
      const completed = !!u?.flags?.onboardingDone;
      const stepDef = !completed ? (defs[0] || null) : null;
      u.newbiePath = {
        step: completed ? completedStep : 1,
        pending: false,
        completed,
        ctx: !completed && stepDef ? this.initNewbieStepContext(u) : null,
        updatedAt: 0
      };
      return true;
    }
    const fixedStep = Math.max(1, Math.floor(Number(u.newbiePath.step) || 1));
    if (fixedStep !== u.newbiePath.step) { u.newbiePath.step = fixedStep; dirty = true; }
    if (typeof u.newbiePath.pending !== "boolean") { u.newbiePath.pending = false; dirty = true; }
    if (typeof u.newbiePath.completed !== "boolean") { u.newbiePath.completed = false; dirty = true; }
    if (u.newbiePath.ctx !== null && typeof u.newbiePath.ctx !== "object") { u.newbiePath.ctx = null; dirty = true; }
    if (typeof u.newbiePath.updatedAt !== "number" || !Number.isFinite(u.newbiePath.updatedAt)) {
      u.newbiePath.updatedAt = 0;
      dirty = true;
    }
    if (u?.flags?.onboardingDone && !u?.flags?.onboarding && !u.newbiePath.completed && u.newbiePath.step > defs.length) {
      u.newbiePath.step = completedStep;
      u.newbiePath.pending = false;
      u.newbiePath.completed = true;
      u.newbiePath.ctx = null;
      dirty = true;
    }
    if (!u.newbiePath.completed && !u.newbiePath.pending && u.newbiePath.ctx == null) {
      const currentDef = defs[Math.max(1, toInt(u.newbiePath.step, 1)) - 1] || null;
      if (currentDef) {
        u.newbiePath.ctx = this.initNewbieStepContext(u);
        dirty = true;
      }
    }
    return dirty;
  }

  _hasAnyBusiness(u) {
    const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    for (const x of arr) {
      const id = String(typeof x === "string" ? x : x?.id || "");
      if (id) return true;
    }
    return false;
  }

  _isNewbieQuestProfile(u) {
    return !this._hasAnyBusiness(u);
  }

  _iterBizOwnedObjects(u) {
    const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    const out = [];
    for (const x of arr) {
      if (x && typeof x === "object") out.push(x);
    }
    return out;
  }

  _allBusinessIds() {
    const cfg = CONFIG?.BUSINESS;
    if (!cfg || typeof cfg !== "object") return [];
    return Object.keys(cfg).filter((id) => !!String(id || "").trim());
  }

  _maxSlotCountByBizId(bizId) {
    const levels = CONFIG?.LABOUR_MARKET?.SLOTS?.[String(bizId || "")]?.levels;
    if (Array.isArray(levels) && levels.length > 0) return levels.length;
    return 1;
  }

  _countPurchasedBizSlots(entry) {
    if (!entry || typeof entry !== "object") return 0;

    const slots = Array.isArray(entry?.slots) ? entry.slots : [];
    if (slots.length > 0) {
      let count = 0;
      for (const slot of slots) {
        if (slot?.purchased) count += 1;
      }
      return count;
    }

    return entry?.slot?.purchased ? 1 : 0;
  }

  _hasAnyBusinessOrSlotExpansion(u) {
    const owned = this._iterBizOwnedObjects(u);
    const allBizIds = this._allBusinessIds();
    if (!allBizIds.length) return this._hasAnyBusiness(u);

    const ownedIds = new Set(
      owned.map((e) => String(e?.id || "").trim()).filter(Boolean)
    );
    for (const bizId of allBizIds) {
      if (!ownedIds.has(bizId)) return true;
    }

    for (const entry of owned) {
      const bizId = String(entry?.id || "").trim();
      if (!bizId) continue;
      const maxSlots = this._maxSlotCountByBizId(bizId);
      const purchasedSlots = this._countPurchasedBizSlots(entry);
      if (purchasedSlots < maxSlots) return true;
    }

    return false;
  }

  _slotIsActive(slot) {
    if (!slot || typeof slot !== "object") return false;
    if (!slot.purchased) return false;
    const endAt = toInt(slot.contractEnd, 0);
    const employeeId = String(slot.employeeId || "").trim();
    return !!employeeId && endAt > this.now();
  }

  _hasAnyFreeLabourSlot(u) {
    for (const biz of this._iterBizOwnedObjects(u)) {
      const slots = Array.isArray(biz?.slots) ? biz.slots : [];
      for (const slot of slots) {
        if (!slot?.purchased) continue;
        if (!this._slotIsActive(slot)) return true;
      }
    }
    return false;
  }

  _hasAnyBusyLabourSlot(u) {
    for (const biz of this._iterBizOwnedObjects(u)) {
      const slots = Array.isArray(biz?.slots) ? biz.slots : [];
      for (const slot of slots) {
        if (this._slotIsActive(slot)) return true;
      }
    }
    return false;
  }

  _holdingsCount(u) {
    const h = u?.stocks?.holdings;
    if (!h || typeof h !== "object") return 0;
    let c = 0;
    for (const v of Object.values(h)) {
      if (toInt(v?.shares, 0) > 0) c += 1;
    }
    return c;
  }

  _canDoGymQuest(u) {
    const maxCap = Math.max(0, toInt(CONFIG?.GYM?.MAX_ENERGY_CAP, 0));
    const energyMax = Math.max(0, toInt(u?.energy_max, 0));
    if (!maxCap) return true;
    return energyMax < maxCap;
  }

  _canAccessArcana(u) {
    const minStudy = Math.max(0, toInt(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID, 5));
    const studyLevel = Math.max(0, toInt(u?.study?.level, 0));
    return studyLevel >= minStudy;
  }

  _canAccessColosseum(u) {
    const minEnergyMax = Math.max(0, toInt(CONFIG?.COLOSSEUM?.MIN_ENERGY_MAX, 50));
    return EnergyService.effectiveEnergyMax(u, this.now()) >= minEnergyMax;
  }

  _forcedDailyQuestIds(u) {
    void u;
    return [];
  }

  _dailyQuestAvailable(u, id) {
    switch (id) {
      case "fortune_spin":
        return this._canAccessArcana(u);
      case "gym_train":
      case "gym_2trains":
        return this._canDoGymQuest(u);
      case "pet_feed":
        return !!(u?.pet && typeof u.pet === "object" && String(u.pet.status || "") !== "dead");
      case "biz_collect":
      case "biz_collect_all":
      case "biz_guard":
        return this._hasAnyBusiness(u);
      case "labour_hire":
        return this._hasAnyFreeLabourSlot(u);
      case "stocks_sell":
        return this._holdingsCount(u) > 0;
      case "thief_attempt":
      case "thief_success":
        return toInt(u?.thief?.level, 0) >= 1;
      case "colosseum_battles_5":
        return this._canAccessColosseum(u);
      default:
        return true;
    }
  }

  _weeklyQuestAvailable(u, id) {
    switch (id) {
      case "w_gym_7trains":
        return this._canDoGymQuest(u);
      case "w_colosseum_10battles":
        return this._canAccessColosseum(u);
      case "w_biz_streak":
        return this._hasAnyBusiness(u);
      case "w_biz_expand":
        return this._hasAnyBusinessOrSlotExpansion(u);
      case "w_labour_hire":
        return this._hasAnyFreeLabourSlot(u);
      case "w_labour_finish_contracts":
        return this._hasAnyBusyLabourSlot(u);
      case "w_stocks_profit":
        return this._holdingsCount(u) > 0;
      case "w_thief_3attempts":
      case "w_thief_total":
        return toInt(u?.thief?.level, 0) >= 1;
      default:
        return true;
    }
  }

  _resolveTarget(u, id, fallbackTarget) {
    const cfg = this._cfg();
    const newbie = this._isNewbieQuestProfile(u);

    if (id === "work_earn") return newbie ? 300 : Math.max(1, toInt(cfg.DAILY_WORK_EARN_TARGET, 500));
    if (id === "stocks_invest_daily") {
      const cfgTarget = toInt(cfg.DAILY_STOCKS_INVEST_TARGET, toInt(cfg.DAILY_STOCKS_PORTFOLIO_TARGET, 5000));
      return newbie ? 1000 : Math.max(1, cfgTarget);
    }
    if (id === "w_work_earn") return newbie ? 5000 : Math.max(1, toInt(cfg.WEEKLY_WORK_EARN_TARGET, 20000));
    if (id === "w_stocks_invest") return newbie ? 5000 : Math.max(1, toInt(cfg.WEEKLY_STOCKS_INVEST_TARGET, 50000));
    if (id === "w_thief_total") return newbie ? 2000 : Math.max(1, toInt(cfg.WEEKLY_THIEF_TOTAL_TARGET, 10000));

    if (id === "work_2shifts") return newbie ? 1 : 2;
    if (id === "gym_2trains") return newbie ? 1 : 2;
    if (id === "stocks_buy3") return newbie ? 2 : 3;
    if (id === "w_work_10shifts") return newbie ? 6 : 10;
    if (id === "w_gym_7trains") return newbie ? 4 : 7;
    if (id === "w_biz_streak") return newbie ? 3 : 5;
    if (id === "w_labour_finish_contracts") return newbie ? 1 : 2;
    if (id === "w_stocks_5companies") return newbie ? 3 : 5;
    if (id === "w_thief_3attempts") return newbie ? 2 : 3;

    return Math.max(1, toInt(fallbackTarget, 1));
  }

  _resolveRewardMoney(u, def) {
    const base = Math.max(0, toInt(def?.rewardMoney, 0));
    if (!this._isNewbieQuestProfile(u)) return base;
    const scaled = Math.round((base * 0.85) / 50) * 50;
    return Math.max(100, scaled);
  }

  _toQuest(u, def) {
    const id = String(def?.id || "");
    return {
      id,
      type: String(def?.type || "daily"),
      category: String(def?.category || "work"),
      difficulty: String(def?.difficulty || "easy"),
      rewardMoney: this._resolveRewardMoney(u, def),
      target: this._resolveTarget(u, id, def?.target),
      progress: 0,
      done: false,
      paid: false
    };
  }

  _pickDailyQuests(u, pool, seed) {
    const desired = ["easy", "easy", "hard"];
    const rng = rngFromSeed(seed);
    const shuffled = shuffleDeterministic(pool, rng);
    const available = [...shuffled];
    const selected = [];

    const pickOne = (diff) => {
      const fallbackOrder = diff === "hard"
        ? ["hard", "medium", "easy"]
        : ["easy", "medium", "hard"];
      for (const d of fallbackOrder) {
        const idx = available.findIndex((q) => String(q?.difficulty || "") === d);
        if (idx >= 0) {
          const [one] = available.splice(idx, 1);
          return one;
        }
      }
      return null;
    };

    for (const diff of desired) {
      const one = pickOne(diff);
      if (one) selected.push(one);
      if (selected.length >= this._dailyCount()) break;
    }
    while (selected.length < this._dailyCount() && available.length) {
      selected.push(available.shift());
    }

    selected.sort((a, b) => {
      const da = DIFF_SCORE[String(a?.difficulty || "easy")] || 1;
      const db = DIFF_SCORE[String(b?.difficulty || "easy")] || 1;
      if (da !== db) return da - db;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    return selected.slice(0, this._dailyCount()).map((q) => this._toQuest(u, q));
  }

  _pickWeeklyQuests(u, pool, seed, count = this._weeklyCount()) {
    const rng = rngFromSeed(seed);
    const shuffled = shuffleDeterministic(pool, rng);
    shuffled.sort((a, b) => {
      const da = DIFF_SCORE[String(a?.difficulty || "easy")] || 1;
      const db = DIFF_SCORE[String(b?.difficulty || "easy")] || 1;
      if (da !== db) return db - da;
      return 0;
    });

    const selected = [];
    for (const q of shuffled) {
      if (selected.length >= count) break;
      if (!selected.length) {
        selected.push(q);
        continue;
      }
      const cat = String(q?.category || "");
      const duplicateCategory = selected.some((x) => String(x?.category || "") === cat);
      if (!duplicateCategory) selected.push(q);
    }
    for (const q of shuffled) {
      if (selected.length >= count) break;
      if (selected.some((x) => String(x?.id || "") === String(q?.id || ""))) continue;
      selected.push(q);
    }
    selected.sort((a, b) => {
      const da = DIFF_SCORE[String(a?.difficulty || "easy")] || 1;
      const db = DIFF_SCORE[String(b?.difficulty || "easy")] || 1;
      if (da !== db) return db - da;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    return selected.slice(0, count).map((q) => this._toQuest(u, q));
  }

  _pickRandomWeeklyQuest(u, pool, seed) {
    if (!Array.isArray(pool) || !pool.length) return null;
    const rng = rngFromSeed(seed);
    const shuffled = shuffleDeterministic(pool, rng);
    const one = shuffled[0] || null;
    return one ? this._toQuest(u, one) : null;
  }

  _generateDaily(u, day) {
    const count = this._dailyCount();
    const allDaily = this._dailyPool();
    const forcedIds = new Set(this._forcedDailyQuestIds(u));
    const forced = allDaily
      .filter((q) => forcedIds.has(String(q?.id || "")) && this._dailyQuestAvailable(u, q?.id))
      .map((q) => this._toQuest(u, q));
    if (forced.length >= count) return forced.slice(0, count);

    const pool = allDaily.filter((q) => !forcedIds.has(String(q?.id || "")) && this._dailyQuestAvailable(u, q?.id));
    const picked = this._pickDailyQuests(u, pool, `${u?.id || ""}:${day}:daily`);

    const byId = new Map();
    for (const q of [...forced, ...picked]) byId.set(q.id, q);
    if (byId.size < count) {
      const fallbackWork = allDaily.filter((q) => String(q?.category || "") === "work");
      const add = this._pickDailyQuests(u, fallbackWork, `${u?.id || ""}:${day}:daily:fallback`);
      for (const q of add) byId.set(q.id, q);
    }

    return [...byId.values()]
      .sort((a, b) => {
        const da = DIFF_SCORE[String(a?.difficulty || "easy")] || 1;
        const db = DIFF_SCORE[String(b?.difficulty || "easy")] || 1;
        if (da !== db) return da - db;
        return String(a?.id || "").localeCompare(String(b?.id || ""));
      })
      .slice(0, count);
  }

  _generateWeekly(u, week) {
    const count = this._weeklyCount();
    const baseSeed = `${u?.id || ""}:${week}:weekly`;
    const pool = this._weeklyPool().filter((q) => this._weeklyQuestAvailable(u, q?.id));
    const farmPool = pool.filter((q) => String(q?.category || "") === "farm");
    const nonFarmPool = pool.filter((q) => String(q?.category || "") !== "farm");

    const selected = [];
    const forcedFarm = this._pickRandomWeeklyQuest(u, farmPool, `${baseSeed}:farm`);
    if (forcedFarm) selected.push(forcedFarm);

    const needMain = Math.max(0, count - selected.length);
    if (needMain > 0) {
      const main = this._pickWeeklyQuests(u, nonFarmPool, `${baseSeed}:main`, needMain);
      selected.push(...main);
    }
    if (selected.length >= count) return selected.slice(0, count);

    const fallbackPool = this._weeklyPool().filter((q) => this._weeklyQuestAvailable(u, q?.id));
    const add = this._pickWeeklyQuests(u, fallbackPool, `${baseSeed}:fallback`, count);
    const byId = new Map();
    for (const q of [...selected, ...add]) byId.set(q.id, q);
    return [...byId.values()].slice(0, count);
  }

  _normalizeQuestList(list, type) {
    if (!Array.isArray(list)) return [];
    const remapId = (rawId) => {
      const id = String(rawId || "");
      if (id === "stocks_portfolio") return "stocks_invest_daily";
      return id;
    };
    return list
      .filter((q) => q && typeof q === "object" && String(q.id || ""))
      .map((q) => ({
        id: remapId(q.id),
        type: String(q.type || type),
        category: String(q.category || "work"),
        difficulty: String(q.difficulty || "easy"),
        rewardMoney: Math.max(0, toInt(q.rewardMoney, 0)),
        target: Math.max(1, toInt(q.target, 1)),
        progress: Math.max(0, toInt(q.progress, 0)),
        done: !!q.done,
        paid: !!q.paid
      }));
  }

  _progressByQuestId(u, scope, id) {
    const daily = u?.quests?.daily || {};
    const weekly = u?.quests?.weekly || {};
    const d = daily.counters || {};
    const w = weekly.counters || {};
    if (scope === "daily") {
      const colosseumDay = String(u?.colosseum?.dayKey || "");
      const colosseumToday = dayStr(this.now());
      const colosseumBattlesToday = colosseumDay === colosseumToday
        ? toInt(u?.colosseum?.battlesToday, 0)
        : 0;
      switch (id) {
        case "work_1shift":
        case "work_2shifts":
          return toInt(d.workShifts, 0);
        case "work_earn":
          return toInt(d.workEarn, 0);
        case "gym_train":
        case "gym_2trains":
          return toInt(d.gymTrains, 0);
        case "pet_feed":
          return toInt(d.petFeeds, 0);
        case "farm_harvest":
          return toInt(d.farmHarvests, 0);
        case "fortune_spin":
          return toInt(d.fortuneSpins, 0);
        case "quiz_play":
          return toInt(d.quizPlays, 0);
        case "daily_bonus":
          return toInt(d.dailyClaims, 0);
        case "biz_collect":
          return toInt(d.bizClaims, 0);
        case "biz_collect_all":
          return toInt(d.bizCollectAll, 0);
        case "biz_guard":
          return toInt(d.bizGuard, 0);
        case "labour_hire":
          return toInt(d.labourHires, 0);
        case "stocks_buy":
          return toInt(d.stocksBuys, 0);
        case "stocks_buy3":
          return Math.max(toInt(d.stocksHoldings3, 0), this._holdingsCount(u));
        case "stocks_sell":
          return toInt(d.stocksSells, 0);
        case "stocks_invest_daily":
          return toInt(d.stocksInvested, 0);
        case "thief_attempt":
          return toInt(d.thiefAttempts, 0);
        case "thief_success":
          return toInt(d.thiefSuccesses, 0);
        case "colosseum_battles_5":
          return colosseumBattlesToday;
        default:
          return 0;
      }
    }

    switch (id) {
      case "w_work_10shifts":
        return toInt(w.workShifts, 0);
      case "w_work_earn":
        return toInt(w.workEarn, 0);
      case "w_gym_7trains":
        return toInt(w.gymTrains, 0);
      case "w_colosseum_10battles":
        return toInt(w.colosseumBattles, 0);
      case "w_farm_plant_seeds":
        return toInt(w.farmPlants, 0);
      case "w_farm_harvest_carrot":
        return toInt(w.farmHarvestCarrot, 0);
      case "w_farm_harvest_tomato":
        return toInt(w.farmHarvestTomato, 0);
      case "w_farm_harvest_corn":
        return toInt(w.farmHarvestCorn, 0);
      case "w_biz_streak":
        return toInt(weekly.bizStreakCurrent, 0);
      case "w_biz_expand":
        return toInt(w.bizExpands, 0);
      case "w_labour_hire":
        return toInt(w.labourHires, 0);
      case "w_labour_finish_contracts":
        return toInt(w.labourOwnerContractFinishes, 0);
      case "w_stocks_profit":
        return toInt(w.stocksProfitSells, 0);
      case "w_stocks_5companies":
        return Math.max(toInt(w.stocksHoldings5, 0), this._holdingsCount(u));
      case "w_stocks_invest":
        return toInt(w.stocksInvested, 0);
      case "w_thief_3attempts":
        return toInt(w.thiefAttempts, 0);
      case "w_thief_total":
        return toInt(w.thiefStolen, 0);
      default:
        return 0;
    }
  }

  _applyQuestCompletion(u, scope, outEvents) {
    const state = scope === "daily" ? u.quests.daily : u.quests.weekly;
    let changed = false;
    for (const q of state.list) {
      if (!q || typeof q !== "object") continue;
      const progressRaw = this._progressByQuestId(u, scope, q.id);
      const progress = Math.min(Math.max(0, progressRaw), Math.max(1, q.target));
      if (progress !== q.progress) {
        q.progress = progress;
        changed = true;
      }
      const done = progressRaw >= q.target;
      if (done && !q.done) {
        q.done = true;
        changed = true;
      }
      if (q.done && !q.paid) {
        const reward = Math.max(0, toInt(q.rewardMoney, 0));
        if (reward > 0) {
          u.money = Math.max(0, toInt(u.money, 0)) + reward;
        }
        q.paid = true;
        changed = true;
        outEvents.push({ kind: "quest_done", scope, id: q.id, rewardMoney: reward });
      }
    }

    const allDone = state.list.length > 0 && state.list.every((q) => q && q.done);
    if (allDone && !state.bonusPaid) {
      const gems = scope === "daily" ? this._dailyBonusGems() : this._weeklyBonusGems();
      if (gems > 0) {
        u.premium = Math.max(0, toInt(u.premium, 0)) + gems;
      }
      state.bonusPaid = true;
      changed = true;
      outEvents.push({ kind: "bonus_done", scope, rewardGems: gems });
    }
    return changed;
  }

  _updateBizStreakOnClaim(u, today) {
    const w = u?.quests?.weekly;
    if (!w || typeof w !== "object") return false;
    if (String(w.lastBizClaimDay || "") === today) return false;
    const prev = String(w.lastBizClaimDay || "");
    const diff = prev ? dayDiff(prev, today) : 0;
    if (!prev) {
      w.bizStreakCurrent = 1;
    } else if (diff === 1) {
      w.bizStreakCurrent = Math.max(1, toInt(w.bizStreakCurrent, 0) + 1);
    } else {
      w.bizStreakCurrent = 1;
    }
    w.lastBizClaimDay = today;
    w.counters.bizClaimDays = Math.max(0, toInt(w.counters.bizClaimDays, 0)) + 1;
    return true;
  }

  _applyEventCounters(u, event, ctx = {}) {
    const d = u.quests.daily.counters;
    const w = u.quests.weekly.counters;
    const today = dayStr(this.now());
    let changed = false;
    switch (String(event || "")) {
      case "work_claim": {
        const pay = Math.max(0, toInt(ctx?.pay, 0));
        d.workShifts += 1;
        d.workEarn += pay;
        w.workShifts += 1;
        w.workEarn += pay;
        changed = true;
        break;
      }
      case "gym_finish":
        d.gymTrains += 1;
        w.gymTrains += 1;
        changed = true;
        break;
      case "colosseum_battle_played":
        w.colosseumBattles += 1;
        changed = true;
        break;
      case "pet_feed":
        d.petFeeds += 1;
        changed = true;
        break;
      case "farm_plant":
        w.farmPlants += 1;
        changed = true;
        break;
      case "farm_harvest": {
        d.farmHarvests += 1;
        const cropId = String(ctx?.cropId || "");
        if (cropId === "carrot") w.farmHarvestCarrot += 1;
        else if (cropId === "tomato") w.farmHarvestTomato += 1;
        else if (cropId === "corn") w.farmHarvestCorn += 1;
        changed = true;
        break;
      }
      case "fortune_spin":
        d.fortuneSpins += 1;
        changed = true;
        break;
      case "quiz_play":
        d.quizPlays += 1;
        changed = true;
        break;
      case "daily_claim":
        d.dailyClaims += 1;
        changed = true;
        break;
      case "biz_claim": {
        const count = Math.max(0, toInt(ctx?.count, 1));
        d.bizClaims += count;
        if (ctx?.allClaim) d.bizCollectAll += 1;
        changed = true;
        if (count > 0) changed = this._updateBizStreakOnClaim(u, today) || changed;
        break;
      }
      case "biz_expand":
        w.bizExpands += 1;
        changed = true;
        break;
      case "guard_buy":
        d.bizGuard += 1;
        changed = true;
        break;
      case "labour_hire":
        d.labourHires += 1;
        w.labourHires += 1;
        changed = true;
        break;
      case "labour_owner_contract_finish":
        w.labourOwnerContractFinishes += Math.max(1, toInt(ctx?.count, 1));
        changed = true;
        break;
      case "stocks_buy": {
        d.stocksBuys += 1;
        const holdingsCount = Math.max(0, toInt(ctx?.holdingsCount, this._holdingsCount(u)));
        d.stocksHoldings3 = Math.max(toInt(d.stocksHoldings3, 0), holdingsCount);
        w.stocksHoldings5 = Math.max(toInt(w.stocksHoldings5, 0), holdingsCount);
        const buyCost = Math.max(0, toInt(ctx?.cost, 0));
        d.stocksInvested += buyCost;
        const portfolioValue = Math.max(0, toInt(ctx?.portfolioValue, 0));
        if (portfolioValue > d.stocksPortfolioMax) d.stocksPortfolioMax = portfolioValue;
        w.stocksInvested += buyCost;
        changed = true;
        break;
      }
      case "stocks_sell": {
        d.stocksSells += 1;
        const pnl = n(ctx?.pnl || 0);
        if (pnl > 0) w.stocksProfitSells += 1;
        changed = true;
        break;
      }
      case "thief_attempt":
        d.thiefAttempts += 1;
        w.thiefAttempts += 1;
        changed = true;
        break;
      case "thief_success": {
        const amount = Math.max(0, toInt(ctx?.amount, 0));
        d.thiefSuccesses += 1;
        w.thiefStolen += amount;
        changed = true;
        break;
      }
      case "sub_bonus_claim":
        changed = true;
        break;
      default:
        break;
    }
    return changed;
  }

  _dailyToNextMs(nowTs) {
    const d = new Date(nowTs);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
    return Math.max(0, next - nowTs);
  }

  _weeklyToNextMs(nowTs) {
    const d = new Date(nowTs);
    const weekday = (d.getUTCDay() + 6) % 7;
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - weekday, 0, 0, 0, 0);
    const next = start + 7 * DAY_MS;
    return Math.max(0, next - nowTs);
  }

  _formatLeft(source, ms) {
    const l = this._lang(source);
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    if (l === "en") {
      if (days > 0) return `${days}d ${hours}h`;
      return `${hours}h ${minutes}m`;
    }
    if (l === "uk") {
      if (days > 0) return `${days}д ${hours}год`;
      return `${hours}год ${minutes}хв`;
    }
    if (days > 0) return `${days}д ${hours}ч`;
    return `${hours}ч ${minutes}мин`;
  }

  _questTitle(source, id, target) {
    const lang = this._lang(source);
    const l = lang === "en" ? "en" : (lang === "uk" ? "uk" : "ru");
    if (id === "colosseum_battles_5") {
      if (l === "en") return `Play ${target} arena battles`;
      if (l === "uk") return `Зіграти ${target} боїв на арені`;
      return `Сыграть ${target} боёв на арене`;
    }
    if (id === "farm_harvest") {
      if (l === "en") return "Harvest and sell any farm crop";
      if (l === "uk") return "Зібрати й продати будь-який врожай на фермі";
      return "Собрать и продать любой урожай на ферме";
    }
    if (id === "fortune_spin") {
      if (l === "en") return "Test yourself in Arcana Hall";
      if (l === "uk") return "Спробуй себе в Залі аркани";
      return "Испытай себя в Зале арканы";
    }
    const map = {
      ru: {
        work_1shift: "Завершить 1 работу",
        work_2shifts: `Завершить ${target} работ(ы)`,
        work_earn: `Получить выплатами с работ $${target} за сегодня`,
        gym_train: "Сделать 1 тренировку",
        gym_2trains: `Сделать ${target} тренировк(и)`,
        pet_feed: "Покормить питомца",
        fortune_spin: "Крутануть колесо фортуны",
        quiz_play: "Пройти викторину дня (3 вопроса в баре)",
        daily_bonus: "Забрать ежедневный бонус",
        pet_buy_first: "Купить питомца (Площадь → Город → Дом → Питомец)",
        biz_buy_first: "Купить первый бизнес (Площадь → Заработок → Бизнес)",
        study_level_5: "Дойти до 5 уровня учёбы (Прогресс → Учёба → Начать учёбу)",
        clan_join_first: "Вступить в клан или создать свой (Город → Кланы)",
        biz_collect: "Забрать доход с любого бизнеса",
        biz_collect_all: "Забрать доход со всех бизнесов",
        biz_guard: "Поставить охрану на любой бизнес",
        labour_hire: "Нанять наёмника в свободный слот",
        stocks_buy: "Купить акции любой компании",
        stocks_buy3: `Держать акции ${target} компаний одновременно`,
        stocks_sell: "Продать любые акции (любое количество)",
        stocks_invest_daily: `Купить акций суммарно на $${target} за сегодня`,
        thief_attempt: "Совершить 1 попытку воровства",
        thief_success: "Успешно украсть",
        w_work_10shifts: `Завершить ${target} работ за неделю`,
        w_work_earn: `Получить выплатами с работ $${target} за неделю`,
        w_gym_7trains: `Сделать ${target} тренировок за неделю`,
        w_colosseum_10battles: `Сыграть ${target} боёв на арене за неделю`,
        w_biz_streak: `Собирать доход с бизнеса ${target} дней подряд`,
        w_biz_expand: "Купить новый бизнес или слот",
        w_labour_hire: "Нанять наёмника",
        w_labour_finish_contracts: `Завершить ${target} контракт(а) как владелец`,
        w_stocks_profit: "Сделать 1 продажу акций в плюс (продажа выше твоей средней цены покупки)",
        w_stocks_5companies: `Держать акции ${target} компаний одновременно`,
        w_stocks_invest: `Купить акций суммарно на $${target} за неделю`,
        w_farm_harvest_carrot: `Собрать и продать ${target} моркови`,
        w_farm_harvest_tomato: `Собрать и продать ${target} помидоров`,
        w_farm_harvest_corn: `Собрать и продать ${target} кукурузы`,
        w_farm_plant_seeds: `Посадить ${target} семян`,
        w_thief_3attempts: `Совершить ${target} попытк(и) кражи за неделю`,
        w_thief_total: `Украсть суммарно $${target}`
      },
      uk: {
        work_1shift: "Завершити 1 роботу",
        work_2shifts: `Завершити ${target} робіт`,
        work_earn: `Отримати виплатами з робіт $${target} за сьогодні`,
        gym_train: "Зробити 1 тренування",
        gym_2trains: `Зробити ${target} тренуванн(я)`,
        pet_feed: "Погодувати улюбленця",
        fortune_spin: "Прокрутити колесо фортуни",
        quiz_play: "Пройти вікторину дня (3 питання в барі)",
        daily_bonus: "Забрати щоденний бонус",
        pet_buy_first: "Купити улюбленця (Площа → Місто → Дім → Улюбленець)",
        biz_buy_first: "Купити перший бізнес (Площа → Заробіток → Бізнес)",
        study_level_5: "Дійти до 5 рівня навчання (Прогрес → Навчання → Почати навчання)",
        clan_join_first: "Вступити в клан або створити свій (Місто → Клани)",
        biz_collect: "Забрати дохід з будь-якого бізнесу",
        biz_collect_all: "Забрати дохід з усіх бізнесів",
        biz_guard: "Поставити охорону на будь-який бізнес",
        labour_hire: "Найняти найманця у вільний слот",
        stocks_buy: "Купити акції будь-якої компанії",
        stocks_buy3: `Тримати акції ${target} компаній одночасно`,
        stocks_sell: "Продати будь-які акції (будь-яку кількість)",
        stocks_invest_daily: `Купити акцій сумарно на $${target} за сьогодні`,
        thief_attempt: "Здійснити 1 спробу крадіжки",
        thief_success: "Успішно вкрасти",
        w_work_10shifts: `Завершити ${target} робіт за тиждень`,
        w_work_earn: `Отримати виплатами з робіт $${target} за тиждень`,
        w_gym_7trains: `Зробити ${target} тренувань за тиждень`,
        w_colosseum_10battles: `Зіграти ${target} боїв на арені за тиждень`,
        w_biz_streak: `Збирати дохід з бізнесу ${target} днів поспіль`,
        w_biz_expand: "Купити новий бізнес або слот",
        w_labour_hire: "Найняти найманця",
        w_labour_finish_contracts: `Завершити ${target} контракт(и) як власник`,
        w_stocks_profit: "Зробити 1 продаж акцій у плюс (продаж вище твоєї середньої ціни покупки)",
        w_stocks_5companies: `Тримати акції ${target} компаній одночасно`,
        w_stocks_invest: `Купити акцій сумарно на $${target} за тиждень`,
        w_farm_harvest_carrot: `Зібрати і продати ${target} морквин`,
        w_farm_harvest_tomato: `Зібрати і продати ${target} помідорів`,
        w_farm_harvest_corn: `Зібрати і продати ${target} кукурудзи`,
        w_farm_plant_seeds: `Посадити ${target} насінин`,
        w_thief_3attempts: `Здійснити ${target} спроб(и) крадіжки за тиждень`,
        w_thief_total: `Вкрасти сумарно $${target}`
      },
      en: {
        work_1shift: "Complete 1 job",
        work_2shifts: `Complete ${target} job(s)`,
        work_earn: `Get $${target} from job payouts today`,
        gym_train: "Do 1 workout",
        gym_2trains: `Do ${target} workout(s)`,
        pet_feed: "Feed your pet",
        fortune_spin: "Spin the wheel of fortune",
        quiz_play: "Complete the daily quiz (3 questions in the bar)",
        daily_bonus: "Claim daily bonus",
        pet_buy_first: "Buy a pet (Square -> City -> Home -> Pet)",
        biz_buy_first: "Buy your first business (Square -> Earnings -> Business)",
        study_level_5: "Reach Study level 5 (Progress → Study → Start study)",
        clan_join_first: "Join a clan or create your own (City -> Clans)",
        biz_collect: "Collect income from any business",
        biz_collect_all: "Collect income from all businesses",
        biz_guard: "Buy guard for any business",
        labour_hire: "Hire a worker to a free slot",
        stocks_buy: "Buy shares of any company",
        stocks_buy3: `Hold shares of ${target} companies at once`,
        stocks_sell: "Sell any shares (any amount)",
        stocks_invest_daily: `Buy shares for total $${target} today`,
        thief_attempt: "Make 1 theft attempt",
        thief_success: "Steal successfully",
        w_work_10shifts: `Complete ${target} jobs this week`,
        w_work_earn: `Get $${target} from job payouts this week`,
        w_gym_7trains: `Do ${target} workouts this week`,
        w_colosseum_10battles: `Play ${target} arena battles this week`,
        w_biz_streak: `Collect business income ${target} days in a row`,
        w_biz_expand: "Buy a new business or slot",
        w_labour_hire: "Hire a worker",
        w_labour_finish_contracts: `Finish ${target} contract(s) as owner`,
        w_stocks_profit: "Make 1 profitable share sale (sale price above your average buy price)",
        w_stocks_5companies: `Hold shares of ${target} companies at once`,
        w_stocks_invest: `Buy shares for total $${target} this week`,
        w_farm_harvest_carrot: `Harvest and sell ${target} carrots`,
        w_farm_harvest_tomato: `Harvest and sell ${target} tomatoes`,
        w_farm_harvest_corn: `Harvest and sell ${target} corn`,
        w_farm_plant_seeds: `Plant ${target} seeds`,
        w_thief_3attempts: `Make ${target} theft attempt(s) this week`,
        w_thief_total: `Steal total $${target}`
      }
    };
    return map[l]?.[id] || map.ru[id] || id;
  }

  _strings(source) {
    const l = this._lang(source);
    if (l === "en") {
      return {
        barTitle: "🍺 Bar",
        dailyTitle: "📋 Daily quests",
        weeklyTitle: "📅 Weekly quests",
        updateIn: "⏳ Refresh in",
        bonusDaily: `🎯 Complete all three -> +💎${this._dailyBonusGems()}`,
        bonusWeekly: `🎯 Complete all weekly quests -> +💎${this._weeklyBonusGems()}`,
        doneLine: "Completed · reward received",
        none: "No quests yet.",
        subTitle: "⭐ Special quest",
        subText: "Claim subscription reward",
        petBuyGuideHint: "Tip: Square -> City -> Home -> Pet.",
        firstBizGuideHint: "Tip: Square -> Earnings -> Business.",
        studyGuideHint: "Tip: after Study, go to Jobs and run jobs for income.",
        clanGuideHint: "Tip: open City -> Clans and join any open clan or create your own.",
        back: "⬅️ Back",
        refresh: "🔄 Refresh",
        donePrefix: "✅",
        todoPrefix: "⬜",
        questDoneTitle: "🏆 Quest completed!",
        bonusDoneTitle: "🎉 Quest set completed!"
      };
    }
    if (l === "uk") {
      return {
        barTitle: "🍺 Бар",
        dailyTitle: "📋 Завдання на сьогодні",
        weeklyTitle: "📅 Завдання на тиждень",
        updateIn: "⏳ Оновлення через",
        bonusDaily: `🎯 Виконай усі три -> +💎${this._dailyBonusGems()}`,
        bonusWeekly: `🎯 Виконай усі тижневі -> +💎${this._weeklyBonusGems()}`,
        doneLine: "Виконано · нагороду отримано",
        none: "Поки немає завдань.",
        subTitle: "⭐ Спец-завдання",
        subText: "Забрати нагороду за підписку",
        petBuyGuideHint: "Порада: Площа -> Місто -> Дім -> Улюбленець.",
        firstBizGuideHint: "Порада: Площа -> Заробіток -> Бізнес.",
        studyGuideHint: "Порада: після навчання повернись у Роботи й запускай роботи для доходу.",
        clanGuideHint: "Порада: відкрий Місто -> Клани та вступи у відкритий клан або створи свій.",
        back: "⬅️ Назад",
        refresh: "🔄 Оновити",
        donePrefix: "✅",
        todoPrefix: "⬜",
        questDoneTitle: "🏆 Завдання виконано!",
        bonusDoneTitle: "🎉 Увесь блок завдань виконано!"
      };
    }
    return {
      barTitle: "🍺 Бар",
      dailyTitle: "📋 Задания на сегодня",
      weeklyTitle: "📅 Задания на неделю",
      updateIn: "⏳ Обновление через",
      bonusDaily: `🎯 Выполни все три -> +💎${this._dailyBonusGems()}`,
      bonusWeekly: `🎯 Выполни все недельные -> +💎${this._weeklyBonusGems()}`,
      doneLine: "Выполнено · награда получена",
      none: "Пока заданий нет.",
      subTitle: "⭐ Спец-задача",
      subText: "Забрать награду за подписку",
      petBuyGuideHint: "Подсказка: Площадь -> Город -> Дом -> Питомец.",
      firstBizGuideHint: "Подсказка: Площадь -> Заработок -> Бизнес.",
      studyGuideHint: "Подсказка: после учёбы вернись в Работы и запускай работы для дохода.",
      clanGuideHint: "Подсказка: открой Город -> Кланы и вступи в открытый клан или создай свой.",
      back: "⬅️ Назад",
      refresh: "🔄 Обновить",
      donePrefix: "✅",
      todoPrefix: "⬜",
      questDoneTitle: "🏆 Задание выполнено!",
      bonusDoneTitle: "🎉 Весь набор заданий закрыт!"
    };
  }

  async ensureCycles(u, { persist = true } = {}) {
    let dirty = this._ensureModel(u);
    dirty = this._ensureNewbiePathModel(u) || dirty;
    const nowTs = this.now();
    const day = dayStr(nowTs);
    const week = isoWeekKey(nowTs);

    if (u.quests.daily.day !== day) {
      u.quests.daily.day = day;
      u.quests.daily.list = this._generateDaily(u, day);
      u.quests.daily.bonusPaid = false;
      u.quests.daily.counters = this._dailyCounterDefaults();
      dirty = true;
    } else {
      const normalized = this._normalizeQuestList(u.quests.daily.list, "daily");
      if (normalized.length !== u.quests.daily.list.length) dirty = true;
      u.quests.daily.list = normalized;
    }

    if (u.quests.weekly.week !== week) {
      u.quests.weekly.week = week;
      u.quests.weekly.list = this._generateWeekly(u, week);
      u.quests.weekly.bonusPaid = false;
      u.quests.weekly.counters = this._weeklyCounterDefaults();
      u.quests.weekly.bizStreakCurrent = 0;
      u.quests.weekly.lastBizClaimDay = "";
      dirty = true;
    } else {
      const normalized = this._normalizeQuestList(u.quests.weekly.list, "weekly");
      if (normalized.length !== u.quests.weekly.list.length) dirty = true;
      u.quests.weekly.list = normalized;
    }

    const events = [];
    dirty = this._applyQuestCompletion(u, "daily", events) || dirty;
    dirty = this._applyQuestCompletion(u, "weekly", events) || dirty;

    if (dirty && persist) {
      await this.users.save(u);
    }
    return { changed: dirty, events };
  }

  async onEvent(u, event, ctx = {}, options = {}) {
    const persist = options.persist !== false;
    const notify = options.notify !== false;
    let dirty = this._ensureModel(u);
    dirty = this._ensureNewbiePathModel(u) || dirty;

    const cycleRes = await this.ensureCycles(u, { persist: false });
    dirty = dirty || !!cycleRes?.changed;

    dirty = this._applyEventCounters(u, event, ctx) || dirty;

    const events = [];
    dirty = this._applyQuestCompletion(u, "daily", events) || dirty;
    dirty = this._applyQuestCompletion(u, "weekly", events) || dirty;

    // Legacy special guide rewards are intentionally disabled.
    // The newbie journey is now handled by u.newbiePath with manual claim in the Bar.

    if (dirty && persist) {
      await this.users.save(u);
    }
    if (notify && events.length) {
      await this.notifyEvents(u, events);
    }
    return { ok: true, changed: dirty, events };
  }

  async notifyEvents(u, events = []) {
    if (!this.bot || !u?.chatId || !Array.isArray(events) || !events.length) return;
    const s = this._strings(u);
    for (const ev of events) {
      if (!ev || typeof ev !== "object") continue;
      if (ev.kind === "quest_done") {
        const title = ev.id === "sub_bonus"
          ? s.subText
          : this._questTitle(u, ev.id, ev.target || 1);
        const rewardMoney = Math.max(0, toInt(ev.rewardMoney, 0));
        const rewardGems = Math.max(0, toInt(ev.rewardGems, 0));
        const rewardParts = [];
        if (rewardMoney > 0) rewardParts.push(`+${formatMoney(rewardMoney, this._lang(u))}`);
        if (rewardGems > 0) rewardParts.push(`+💎${rewardGems}`);
        const rewardLine = rewardParts.length ? rewardParts.join("  ") : "+$0";
        const text = `${s.questDoneTitle}\n${title}\n${rewardLine}`;
        try {
          await this.bot.sendMessage(u.chatId, text);
        } catch {}
      } else if (ev.kind === "bonus_done") {
        const gems = Math.max(0, toInt(ev.rewardGems, 0));
        const text = `${s.bonusDoneTitle}\n+💎${gems}`;
        try {
          await this.bot.sendMessage(u.chatId, text);
        } catch {}
      }
    }
  }

  _questLine(source, q) {
    const s = this._strings(source);
    const title = this._questTitle(source, q.id, q.target);
    const rewardText = formatMoney(q.rewardMoney, this._lang(source));
    if (q.done) {
      return `${s.donePrefix} ${title} — ${rewardText}\n   ${s.doneLine}`;
    }
    const progress = `${Math.max(0, toInt(q.progress, 0))}/${Math.max(1, toInt(q.target, 1))}`;
    return `${s.todoPrefix} ${title} — ${rewardText}\n   ${progress}`;
  }

  _newbieTitle(source) {
    const l = this._lang(source);
    if (l === "en") return "🧭 Newbie quests";
    if (l === "uk") return "🧭 Завдання для новачків";
    return "🧭 Задания для новичков";
  }

  _newbieUnlocksHint(source) {
    const l = this._lang(source);
    if (l === "en") return "ℹ️ As you progress, new locations will unlock.";
    if (l === "uk") return "ℹ️ У міру розвитку відкриватимуться нові локації.";
    return "ℹ️ По мере развития персонажа открываются новые локации.";
  }

  _newbieDoneLine(source) {
    const l = this._lang(source);
    if (l === "en") return "All newbie quests are completed.";
    if (l === "uk") return "Усі завдання для новачків виконано.";
    return "Все задания для новичков выполнены.";
  }

  _getNewbieStepDef(u) {
    this._ensureNewbiePathModel(u);
    const defs = this._newbiePathDefs();
    const step = Math.max(1, toInt(u?.newbiePath?.step, 1));
    return defs[step - 1] || null;
  }

  _newbieStepTitle(u, id) {
    return t(`newbie.${id}.title`, this._lang(u));
  }

  _newbieStepDesc(u, id) {
    return t(`newbie.${id}.desc`, this._lang(u));
  }

  _newbieStepWhere(u, id) {
    return t(`newbie.${id}.where`, this._lang(u));
  }

  _newbieStepCta(u, id) {
    return t(`newbie.${id}.cta`, this._lang(u));
  }

  _newbieProgressBar(current, total) {
    const filled = Math.max(0, Math.min(total, current));
    return `${"█".repeat(filled)}${"░".repeat(Math.max(0, total - filled))}`;
  }

  _ensureNewbieStatsShape(u) {
    ensurePlayerStatsShape(u);
    return (u?.stats && typeof u.stats === "object" && u.stats.newbie && typeof u.stats.newbie === "object")
      ? u.stats.newbie
      : null;
  }

  _recordNewbieStepSeen(u, step) {
    const nb = this._ensureNewbieStatsShape(u);
    const stepKey = String(Math.max(1, toInt(step, 1)));
    if (!nb) return false;
    const today = dayStr(this.now());
    let changed = false;
    if (!nb.openedDay) {
      nb.openedDay = today;
      changed = true;
    }
    if (!nb.stepsSeen[stepKey]) {
      nb.stepsSeen[stepKey] = today;
      changed = true;
    }
    if (toInt(nb.maxStepSeen, 0) < toInt(stepKey, 0)) {
      nb.maxStepSeen = toInt(stepKey, 0);
      changed = true;
    }
    if (nb.lastStepSeenDay !== today) {
      nb.lastStepSeenDay = today;
      changed = true;
    }
    return changed;
  }

  _recordNewbieStepClaimed(u, step) {
    const nb = this._ensureNewbieStatsShape(u);
    const stepKey = String(Math.max(1, toInt(step, 1)));
    if (!nb) return false;
    const today = dayStr(this.now());
    let changed = false;
    if (!nb.openedDay) {
      nb.openedDay = today;
      changed = true;
    }
    if (!nb.stepsClaimed[stepKey]) {
      nb.stepsClaimed[stepKey] = today;
      changed = true;
    }
    if (toInt(nb.maxStepClaimed, 0) < toInt(stepKey, 0)) {
      nb.maxStepClaimed = toInt(stepKey, 0);
      changed = true;
    }
    if (nb.lastStepClaimedDay !== today) {
      nb.lastStepClaimedDay = today;
      changed = true;
    }
    return changed;
  }

  touchNewbieView(u) {
    this._ensureNewbiePathModel(u);
    if (!u?.flags?.onboardingDone) return false;
    if (u?.newbiePath?.completed) return false;
    return this._recordNewbieStepSeen(u, Math.max(1, toInt(u?.newbiePath?.step, 1)));
  }

  initNewbieStepContext(u) {
    return {
      startedAt: this.now(),
      totalShiftsStart: Math.max(0, toInt(u?.achievements?.progress?.totalShifts, 0)),
      gymLevelStart: Math.max(0, toInt(u?.gym?.level, 0))
    };
  }

  isNewbieStepComplete(u, stepId, ctx = {}) {
    const today = dayStr(this.now());
    switch (String(stepId || "")) {
      case "daily_bonus":
        return String(u?.bonus?.last || "") === today;
      case "work_job":
        return (
          Math.max(0, toInt(u?.achievements?.progress?.totalShifts, 0)) >= (Math.max(0, toInt(ctx.totalShiftsStart, 0)) + 1) ||
          (!!u?.jobs?.active?.[0] && Math.max(0, toInt(u.jobs.active[0]?.startAt, 0)) >= Math.max(0, toInt(ctx.startedAt, 0)))
        );
      case "start_study":
        return !!u?.study?.active || Math.max(0, toInt(u?.study?.level, 0)) >= 1;
      case "buy_coffee":
        return !!ctx?.completedByEvent;
      case "buy_pet":
        return String(u?.pet?.type || "").trim().length > 0;
      case "gym_train":
        return (
          Math.max(0, toInt(u?.gym?.level, 0)) >= (Math.max(0, toInt(ctx.gymLevelStart, 0)) + 1) ||
          (!!u?.gym?.active && Math.max(0, toInt(u?.gym?.startAt, 0)) >= Math.max(0, toInt(ctx.startedAt, 0)))
        );
      case "plant_carrot":
        return !!ctx?.completedByEvent || !!(Array.isArray(u?.farm?.plots) && u.farm.plots.some((p) =>
          String(p?.cropId || "") === "carrot" && (String(p?.status || "") === "growing" || String(p?.status || "") === "ready")
        ));
      case "energy_50":
        return EnergyService.effectiveEnergyMax(u, this.now()) >= 50;
      case "buy_business":
        return this._hasAnyBusiness(u);
      default:
        return false;
    }
  }

  maybeCompleteNewbieStep(u) {
    this._ensureNewbiePathModel(u);
    if (!u?.flags?.onboardingDone) return false;
    if (u?.newbiePath?.completed || u?.newbiePath?.pending) return false;
    const stepDef = this._getNewbieStepDef(u);
    if (!stepDef) return false;
    const ctx = (u?.newbiePath?.ctx && typeof u.newbiePath.ctx === "object") ? u.newbiePath.ctx : {};
    if (!this.isNewbieStepComplete(u, stepDef.id, ctx)) return false;
    u.newbiePath.pending = true;
    u.newbiePath.updatedAt = this.now();
    this._recordNewbieStepSeen(u, Math.max(1, toInt(u?.newbiePath?.step, 1)));
    return true;
  }

  markNewbieAction(u, action, ctx = {}) {
    this._ensureNewbiePathModel(u);
    if (!u?.flags?.onboardingDone) return false;
    if (u?.newbiePath?.completed || u?.newbiePath?.pending) return false;
    const stepDef = this._getNewbieStepDef(u);
    if (!stepDef) return false;

    if (String(stepDef.id) === "buy_coffee" && String(action || "") === "shop_buy" && String(ctx?.key || "") === "coffee") {
      u.newbiePath.pending = true;
      u.newbiePath.ctx = {
        ...(u?.newbiePath?.ctx && typeof u.newbiePath.ctx === "object" ? u.newbiePath.ctx : {}),
        completedByEvent: true,
        completedAt: this.now()
      };
      u.newbiePath.updatedAt = this.now();
      return true;
    }

    if (String(stepDef.id) === "plant_carrot" && String(action || "") === "farm_plant" && String(ctx?.cropId || "") === "carrot") {
      u.newbiePath.pending = true;
      u.newbiePath.ctx = {
        ...(u?.newbiePath?.ctx && typeof u.newbiePath.ctx === "object" ? u.newbiePath.ctx : {}),
        completedByEvent: true,
        completedAt: this.now()
      };
      u.newbiePath.updatedAt = this.now();
      return true;
    }

    return false;
  }

  claimNewbieStep(u) {
    this._ensureNewbiePathModel(u);
    if (!u?.newbiePath?.pending) return { ok: false };

    const defs = this._newbiePathDefs();
    const idx = Math.max(0, toInt(u.newbiePath.step, 1) - 1);
    const currentStep = idx + 1;
    const def = defs[idx];
    if (!def) return { ok: false };

    this._recordNewbieStepSeen(u, currentStep);
    this._recordNewbieStepClaimed(u, currentStep);
    u.money = Math.max(0, toInt(u?.money, 0)) + Math.max(0, toInt(def.rewardMoney, 0));
    u.premium = Math.max(0, toInt(u?.premium, 0)) + Math.max(0, toInt(def.rewardGems, 0));
    u.newbiePath.step = idx + 2;
    u.newbiePath.pending = false;
    u.newbiePath.completed = u.newbiePath.step > defs.length;
    u.newbiePath.ctx = null;
    u.newbiePath.updatedAt = this.now();

    if (u.newbiePath.completed) {
      u.money += this._newbieFinalRewardMoney();
      u.premium += this._newbieFinalRewardGems();
      const nb = this._ensureNewbieStatsShape(u);
      if (nb && !nb.completedDay) {
        nb.completedDay = dayStr(this.now());
      }
      return { ok: true, completed: true };
    }

    const nextDef = defs[u.newbiePath.step - 1];
    u.newbiePath.ctx = nextDef ? this.initNewbieStepContext(u) : null;
    return { ok: true, completed: false, step: u.newbiePath.step };
  }

  _newbieActionButton(u, stepDef) {
    if (!stepDef) return null;
    const route = String(stepDef.targetRoute || "").trim();
    if (!route) return null;
    return { text: this._newbieStepCta(u, stepDef.id), callback_data: `bar:newbie:go:${route}` };
  }

  _buildSpecialQuestLines(u) {
    const s = this._strings(u);
    const specialLines = [];
    if (!u?.flags?.subBonusClaimed) {
      specialLines.push(`⬜ ${s.subText} — ${formatMoney(this._subBonusRewardMoney(), this._lang(u))}`);
    }
    if (!u?.flags?.petBuyGuideClaimed && u?.pet == null) {
      const specialTitle = this._questTitle(u, "pet_buy_first", 1);
      const rewardMoney = this._petBuyGuideRewardMoney();
      specialLines.push(`⬜ ${specialTitle} — ${formatMoney(rewardMoney, this._lang(u))}`);
      specialLines.push(`   ${s.petBuyGuideHint}`);
    }
    if (!u?.flags?.firstBizGuideClaimed && !this._hasAnyBusiness(u)) {
      const specialTitle = this._questTitle(u, "biz_buy_first", 1);
      const rewardMoney = this._firstBizGuideRewardMoney();
      specialLines.push(`⬜ ${specialTitle} — ${formatMoney(rewardMoney, this._lang(u))}`);
      specialLines.push(`   ${s.firstBizGuideHint}`);
    }
    const studyLevel = Math.max(0, toInt(u?.study?.level, 0));
    if (!u?.flags?.studyLevel5GuideClaimed && studyLevel < 5) {
      const specialTitle = this._questTitle(u, "study_level_5", 5);
      const rewardParts = [];
      const rewardMoney = this._studyGuideRewardMoney();
      const rewardGems = this._studyGuideRewardGems();
      if (rewardMoney > 0) rewardParts.push(formatMoney(rewardMoney, this._lang(u)));
      if (rewardGems > 0) rewardParts.push(`💎${rewardGems}`);
      const rewardText = rewardParts.length ? rewardParts.join(" + ") : "$0";
      specialLines.push(`⬜ ${specialTitle} — ${rewardText}`);
      specialLines.push(`   ${studyLevel}/5`);
      specialLines.push(`   ${s.studyGuideHint}`);
    }
    const hasClan = !!String(u?.clan?.clanId || "").trim();
    if (!u?.flags?.clanJoinGuideClaimed && !hasClan) {
      const specialTitle = this._questTitle(u, "clan_join_first", 1);
      const rewardMoney = this._clanJoinGuideRewardMoney();
      specialLines.push(`⬜ ${specialTitle} — ${formatMoney(rewardMoney, this._lang(u))}`);
      specialLines.push(`   ${s.clanGuideHint}`);
    }
    return specialLines;
  }

  hasPendingNewbieQuests(u) {
    this._ensureNewbiePathModel(u);
    return !!u?.flags?.onboardingDone && u?.newbiePath?.completed !== true;
  }

  async buildBarTasksView(u) {
    await this.ensureCycles(u, { persist: false });
    const s = this._strings(u);
    const nowTs = this.now();
    const dailyLeft = this._formatLeft(u, this._dailyToNextMs(nowTs));
    const weeklyLeft = this._formatLeft(u, this._weeklyToNextMs(nowTs));

    const daily = Array.isArray(u?.quests?.daily?.list) ? u.quests.daily.list : [];
    const weekly = Array.isArray(u?.quests?.weekly?.list) ? u.quests.weekly.list : [];

    const lines = [
      s.barTitle,
      "",
      s.dailyTitle,
      `${s.updateIn} ${dailyLeft}`,
      ""
    ];
    if (daily.length) {
      for (const q of daily) lines.push(this._questLine(u, q), "");
    } else {
      lines.push(s.none, "");
    }
    lines.push(s.bonusDaily, "");
    lines.push("━━━━━━━━━━━━━━━━", "");
    lines.push(s.weeklyTitle, `${s.updateIn} ${weeklyLeft}`, "");
    if (weekly.length) {
      for (const q of weekly) lines.push(this._questLine(u, q), "");
    } else {
      lines.push(s.none, "");
    }
    lines.push(s.bonusWeekly);

    const keyboard = [
      [{ text: s.back, callback_data: "go:Bar" }]
    ];
    return { caption: lines.join("\n").trim(), keyboard };
  }

  async buildBarNewbieTasksView(u) {
    await this.ensureCycles(u, { persist: false });
    const s = this._strings(u);
    this._ensureNewbiePathModel(u);
    const defs = this._newbiePathDefs();
    const total = defs.length;

    if (u?.newbiePath?.completed) {
      const rewardParts = [];
      if (this._newbieFinalRewardMoney() > 0) rewardParts.push(formatMoney(this._newbieFinalRewardMoney(), this._lang(u)));
      if (this._newbieFinalRewardGems() > 0) rewardParts.push(`💎${this._newbieFinalRewardGems()}`);
      return {
        caption: [
          s.barTitle,
          "",
          t("newbie.complete.title", this._lang(u)),
          "",
          t("newbie.complete.desc", this._lang(u)),
          "",
          t("newbie.reward", this._lang(u), { reward: rewardParts.join(" + ") || "$0" })
        ].join("\n").trim(),
        keyboard: [
          [{ text: t("newbie.complete.cta", this._lang(u)), callback_data: "bar:tasks" }],
          [{ text: s.back, callback_data: "go:Bar" }]
        ]
      };
    }

    const step = Math.max(1, toInt(u?.newbiePath?.step, 1));
    const current = defs[step - 1] || null;
    if (!current) {
      return {
        caption: `${s.barTitle}\n\n${this._newbieDoneLine(u)}`,
        keyboard: [[{ text: s.back, callback_data: "go:Bar" }]]
      };
    }

    const rewardParts = [];
    if (Math.max(0, toInt(current.rewardMoney, 0)) > 0) rewardParts.push(formatMoney(current.rewardMoney, this._lang(u)));
    if (Math.max(0, toInt(current.rewardGems, 0)) > 0) rewardParts.push(`💎${toInt(current.rewardGems, 0)}`);

    const lines = [
      s.barTitle,
      "",
      this._newbieTitle(u),
      t("newbie.progress", this._lang(u), {
        step,
        total,
        bar: this._newbieProgressBar(step, total)
      }),
      "",
      `${t("newbie.icon.current", this._lang(u))} ${this._newbieStepTitle(u, current.id)}`,
      this._newbieStepDesc(u, current.id),
      "",
      t("newbie.reward", this._lang(u), { reward: rewardParts.join(" + ") || "$0" })
    ];

    const keyboard = [];
    if (u?.newbiePath?.pending) {
      lines.push("", t("newbie.pending", this._lang(u)));
      keyboard.push([{ text: t("newbie.claim", this._lang(u)), callback_data: "bar:newbie:claim" }]);
    } else {
      lines.push(
        "",
        t("newbie.where", this._lang(u)),
        this._newbieStepWhere(u, current.id),
        "",
        t("newbie.return_hint", this._lang(u))
      );
      const actionBtn = this._newbieActionButton(u, current);
      if (actionBtn) keyboard.push([actionBtn]);
    }
    keyboard.push([{ text: s.back, callback_data: "go:Bar" }]);
    return { caption: lines.join("\n").trim(), keyboard };
  }
}
