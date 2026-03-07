// UserStore.js
import { CONFIG } from "./GameConfig.js";

export class UserStore {
  constructor(db) {
    this.db = db;
  }

  _key(id) {
    return `u:${id}`;
  }

  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    delete clone.__isNew;
    await this.db.put(this._key(u.id), JSON.stringify(clone));
    return clone;
  }

  /**
   * Мягкая миграция пользователя.
   */
  async load(id, rawOverride = undefined) {
    const raw = (typeof rawOverride === "string")
      ? rawOverride
      : await this.db.get(this._key(id));
    let u = raw ? JSON.parse(raw) : this._newUser(id);
    let dirty = false;

    // ===== Нормализация актуальных полей =====

    // Инвентарь / апгрейды
    if (!u.inv || typeof u.inv !== "object") { u.inv = { coffee: 0, sandwich: 0, lunch: 0 }; dirty = true; }
    if (!Array.isArray(u.upgrades)) { u.upgrades = []; dirty = true; }

    // Бонус дня
    if (!u.bonus || typeof u.bonus !== "object") { u.bonus = { last: "", streak: 0 }; dirty = true; }
    if (typeof u.bonus.last !== "string") { u.bonus.last = ""; dirty = true; }
    if (typeof u.bonus.streak !== "number") { u.bonus.streak = 0; dirty = true; }

    // Отдых
    if (!u.rest || typeof u.rest !== "object") { u.rest = { active: false, last: 0 }; dirty = true; }
    else {
      if (typeof u.rest.active !== "boolean") { u.rest.active = false; dirty = true; }
      if (typeof u.rest.last   !== "number")  { u.rest.last   = 0;     dirty = true; }
    }

    // Казино
    if (!u.casino || typeof u.casino !== "object") {
      u.casino = { last: 0, day: "", spins: 0, free: { day: "", lastPrize: 0 } };
      dirty = true;
    } else {
      if (typeof u.casino.last  !== "number") { u.casino.last  = 0; dirty = true; }
      if (typeof u.casino.day   !== "string") { u.casino.day   = ""; dirty = true; }
      if (typeof u.casino.spins !== "number") { u.casino.spins = 0; dirty = true; }
      if (!u.casino.free || typeof u.casino.free !== "object") {
        u.casino.free = { day: "", lastPrize: 0 }; dirty = true;
      } else {
        if (typeof u.casino.free.day       !== "string") { u.casino.free.day       = ""; dirty = true; }
        if (typeof u.casino.free.lastPrize !== "number") { u.casino.free.lastPrize = 0;  dirty = true; }
      }
    }

    // Учёба
    const maxLvl = CONFIG.STUDY.MAX_LEVEL;
    if (!u.study || typeof u.study !== "object") {
      u.study = { level: 0, active: false, startAt: 0, endAt: 0 };
      dirty = true;
    } else {
      if (typeof u.study.level !== "number") { u.study.level = 0; dirty = true; }
      u.study.level = Math.min(Math.max(u.study.level || 0, 0), maxLvl);
      if (typeof u.study.active !== "boolean") { u.study.active = false; dirty = true; }
      if (!u.study.active) {
        if (u.study.startAt !== 0 || u.study.endAt !== 0) dirty = true;
        u.study.startAt = 0;
        u.study.endAt   = 0;
      } else {
        if (typeof u.study.startAt !== "number") { u.study.startAt = 0; dirty = true; }
        if (typeof u.study.endAt   !== "number") { u.study.endAt   = 0; dirty = true; }
      }
    }

    // Зал (с прогрессией)
    if (!u.gym || typeof u.gym !== "object") {
      u.gym = { active: false, startAt: 0, endAt: 0, level: 0 };
      dirty = true;
    } else {
      if (typeof u.gym.level  !== "number")  { u.gym.level  = 0;     dirty = true; }
      if (typeof u.gym.active !== "boolean") { u.gym.active = false; dirty = true; }
      if (!u.gym.active) {
        if (u.gym.startAt !== 0 || u.gym.endAt !== 0) dirty = true;
        u.gym.startAt = 0;
        u.gym.endAt   = 0;
      } else {
        if (typeof u.gym.startAt !== "number") { u.gym.startAt = 0; dirty = true; }
        if (typeof u.gym.endAt   !== "number") { u.gym.endAt   = 0; dirty = true; }
      }
    }

    // Энергия
    if (typeof u.energy_max !== "number") { u.energy_max = CONFIG.ENERGY_MAX; dirty = true; }
    if (typeof u.energy     !== "number") { u.energy     = Math.min(u.energy_max, 30); dirty = true; }

    // Ник/онбординг
    if (typeof u.displayName !== "string") { u.displayName = ""; dirty = true; }
    if (typeof u.lang !== "string") { u.lang = ""; dirty = true; }
    if (u.lang && !["ru", "uk", "en"].includes(u.lang)) { u.lang = "ru"; dirty = true; }
    u.awaitingName = !!u.awaitingName;
    if (typeof u.afterNameRoute !== "string") { u.afterNameRoute = ""; dirty = true; }
    u.awaitingClanName = !!u.awaitingClanName;

    // Соц-табло суммы
    if (typeof u.dayTotal  !== "number") { u.dayTotal  = 0; dirty = true; }
    if (typeof u.dayKey    !== "string") { u.dayKey    = ""; dirty = true; }
    if (typeof u.weekTotal !== "number") { u.weekTotal = 0; dirty = true; }
    if (typeof u.weekKey   !== "string") { u.weekKey   = ""; dirty = true; }

    // Прем-валюта
    if (typeof u.premium !== "number") { u.premium = 0; dirty = true; }

    // Биржа
    if (!u.stocks || typeof u.stocks !== "object") {
      u.stocks = { holdings: {}, lastDividendDay: "", lastDividendAmount: 0 };
      dirty = true;
    } else {
      if (!u.stocks.holdings || typeof u.stocks.holdings !== "object") { u.stocks.holdings = {}; dirty = true; }
      if (typeof u.stocks.lastDividendDay !== "string") { u.stocks.lastDividendDay = ""; dirty = true; }
      if (typeof u.stocks.lastDividendAmount !== "number") { u.stocks.lastDividendAmount = 0; dirty = true; }
      for (const [ticker, h] of Object.entries(u.stocks.holdings)) {
        if (!h || typeof h !== "object") { delete u.stocks.holdings[ticker]; dirty = true; continue; }
        const shares = Math.max(0, Math.floor(Number(h.shares) || 0));
        const avgPrice = Math.max(0, Number(h.avgPrice) || 0);
        if (!shares) { delete u.stocks.holdings[ticker]; dirty = true; continue; }
        if (shares !== h.shares || avgPrice !== h.avgPrice) {
          u.stocks.holdings[ticker] = { shares, avgPrice };
          dirty = true;
        }
      }
    }

    // Лимит ускорений (UTC) — для FastForward
    if (!u.fastForwardDaily || typeof u.fastForwardDaily !== "object") {
      u.fastForwardDaily = { day: "", n: 0 }; dirty = true;
    } else {
      if (typeof u.fastForwardDaily.day !== "string") { u.fastForwardDaily.day = ""; dirty = true; }
      if (typeof u.fastForwardDaily.n   !== "number") { u.fastForwardDaily.n   = 0;  dirty = true; }
    }

    // Магазинные дневные лимиты (пример: Coke Zero)
    if (!u.premiumDaily || typeof u.premiumDaily !== "object") {
      u.premiumDaily = { day: "", coke: 0 }; dirty = true;
    } else {
      if (typeof u.premiumDaily.day  !== "string") { u.premiumDaily.day  = ""; dirty = true; }
      if (typeof u.premiumDaily.coke !== "number") { u.premiumDaily.coke = 0;  dirty = true; }
    }

    // Работа
    if (!u.jobs || typeof u.jobs !== "object") {
      u.jobs = { slotMax: 1, active: [] };
      dirty = true;
    } else {
      if (!Array.isArray(u.jobs.active)) { u.jobs.active = []; dirty = true; }
      if (typeof u.jobs.slotMax !== "number") { u.jobs.slotMax = 1; dirty = true; }
      const normalizedActive = [];
      for (const it of u.jobs.active) {
        if (!it || typeof it !== "object") { dirty = true; continue; }
        const inst = { ...it };
        if (typeof inst.typeId !== "string" || !inst.typeId) {
          const fromId = String(inst.id || "");
          const parts = fromId.split(":");
          inst.typeId = parts.length >= 2 ? String(parts[1] || "") : "";
          dirty = true;
        }
        if (Object.prototype.hasOwnProperty.call(inst, "title")) {
          delete inst.title;
          dirty = true;
        }
        if (!Number.isFinite(inst.plannedPay)) {
          const cfgPay = inst.typeId ? Number(CONFIG?.JOBS?.[inst.typeId]?.pay) : NaN;
          inst.plannedPay = Number.isFinite(cfgPay) ? cfgPay : Math.max(0, Number(inst.plannedPay) || 0);
          dirty = true;
        }
        if (typeof inst.claimed !== "boolean") { inst.claimed = false; dirty = true; }
        if (typeof inst.notified !== "boolean") { inst.notified = false; dirty = true; }
        normalizedActive.push(inst);
      }
      if (normalizedActive.length !== u.jobs.active.length) dirty = true;
      u.jobs.active = normalizedActive;
    }

    // ==== Новый Бар ====
    if (!u.bar || typeof u.bar !== "object") {
      u.bar = { day: "", assigned: false, tasks: [] };
      dirty = true;
    } else {
      if (typeof u.bar.day !== "string") { u.bar.day = ""; dirty = true; }
      if (typeof u.bar.assigned !== "boolean") { u.bar.assigned = false; dirty = true; }
      if (!Array.isArray(u.bar.tasks)) { u.bar.tasks = []; dirty = true; }
      // жёстко чистим легаси
      if (u.bar.offered) { delete u.bar.offered; dirty = true; }
      if (u.bar.chosen)  { delete u.bar.chosen;  dirty = true; }
    }

    // Ежедневное право на бесплатный спин (после подписки в Баре)
    if (!u.subReward || typeof u.subReward !== "object") {
      u.subReward = { day: "", eligible: false }; dirty = true;
    } else {
      if (typeof u.subReward.day !== "string") { u.subReward.day = ""; dirty = true; }
      if (typeof u.subReward.eligible !== "boolean") { u.subReward.eligible = false; dirty = true; }
    }

    // Кланы
    if (!u.clan || typeof u.clan !== "object") {
      u.clan = { clanId: "", joinedAt: 0, joinAvailableFromWeek: "", lastPresenceDay: "" };
      dirty = true;
    } else {
      if (typeof u.clan.clanId !== "string") { u.clan.clanId = ""; dirty = true; }
      if (typeof u.clan.joinedAt !== "number") { u.clan.joinedAt = 0; dirty = true; }
      if (typeof u.clan.joinAvailableFromWeek !== "string") { u.clan.joinAvailableFromWeek = ""; dirty = true; }
      if (typeof u.clan.lastPresenceDay !== "string") { u.clan.lastPresenceDay = ""; dirty = true; }
    }
    if (u.clanCosmetic == null) {
      u.clanCosmetic = null;
    } else if (typeof u.clanCosmetic === "object") {
      const tier = String(u.clanCosmetic.tier || "");
      const weekKey = String(u.clanCosmetic.weekKey || "");
      const label = String(u.clanCosmetic.label || "");
      if (tier !== u.clanCosmetic.tier || weekKey !== u.clanCosmetic.weekKey || label !== u.clanCosmetic.label) {
        u.clanCosmetic = { tier, weekKey, label };
        dirty = true;
      }
    } else {
      u.clanCosmetic = null;
      dirty = true;
    }

    // Наемники (статус игрока как сотрудника)
    if (!u.employment || typeof u.employment !== "object") {
      u.employment = {
        active: false,
        ownerId: "",
        bizId: "",
        ownerPct: 0,
        contractEnd: 0
      };
      dirty = true;
    } else {
      if (typeof u.employment.active !== "boolean") { u.employment.active = false; dirty = true; }
      if (typeof u.employment.ownerId !== "string") { u.employment.ownerId = ""; dirty = true; }
      if (typeof u.employment.bizId !== "string") { u.employment.bizId = ""; dirty = true; }
      if (typeof u.employment.ownerPct !== "number") { u.employment.ownerPct = 0; dirty = true; }
      if (typeof u.employment.contractEnd !== "number") { u.employment.contractEnd = 0; dirty = true; }
    }

    // Рефералы
    if (!u.referral || typeof u.referral !== "object") {
      u.referral = { referredBy: "", rewarded: false, invited: [], totalGemsEarned: 0 };
      dirty = true;
    } else {
      if (typeof u.referral.referredBy !== "string") { u.referral.referredBy = ""; dirty = true; }
      if (typeof u.referral.rewarded !== "boolean") { u.referral.rewarded = false; dirty = true; }
      if (!Array.isArray(u.referral.invited)) { u.referral.invited = []; dirty = true; }
      if (typeof u.referral.totalGemsEarned !== "number") { u.referral.totalGemsEarned = 0; dirty = true; }

      const invitedNorm = [];
      for (const raw of u.referral.invited) {
        const idRef = String(raw?.id || "").trim();
        if (!idRef) { dirty = true; continue; }
        const rewardedAt = Math.max(0, Number(raw?.rewardedAt) || 0);
        invitedNorm.push({ id: idRef, rewardedAt });
      }
      if (invitedNorm.length !== u.referral.invited.length) dirty = true;
      invitedNorm.sort((a, b) => (Number(b.rewardedAt) || 0) - (Number(a.rewardedAt) || 0));
      u.referral.invited = invitedNorm.slice(0, 100);
      u.referral.totalGemsEarned = Math.max(0, Math.round(Number(u.referral.totalGemsEarned) || 0));
    }

    // ===== LEGACY — мягко удаляем устаревшие ключи =====
    const dropKeys = [
      "status","last_work_start","shifts","goals","last_daily",
      "streak","achievements","achv","ui","effects",
      "skipsToday" // старый суточный лимит скипов работы — больше не используется
    ];
    for (const k of dropKeys) {
      if (k in u) { delete u[k]; dirty = true; }
    }

    // Ensure flags presence and types (used for onboarding persistence)
    if (!u.flags || typeof u.flags !== "object") { u.flags = {}; dirty = true; }
    if (typeof u.flags.onboarding !== "boolean") { u.flags.onboarding = false; dirty = true; }
    if (typeof u.flags.onboardingStartedAt !== "number") { u.flags.onboardingStartedAt = 0; dirty = true; }
    if (typeof u.flags.onboardingStep !== "string") { u.flags.onboardingStep = ""; dirty = true; }
    if (typeof u.flags.firstJobGemGiven !== "boolean") { u.flags.firstJobGemGiven = false; dirty = true; }
    if (typeof u.flags.onboardingDone !== "boolean") { u.flags.onboardingDone = false; dirty = true; }
    if (typeof u.flags.onboardingFlowV2 !== "boolean") { u.flags.onboardingFlowV2 = false; dirty = true; }
    if (typeof u.flags.freeSkipUsed_work !== "boolean") { u.flags.freeSkipUsed_work = false; dirty = true; }
    if (typeof u.flags.freeSkipUsed_gym !== "boolean") { u.flags.freeSkipUsed_gym = false; dirty = true; }

    // Daily top stats and reward marker
    if (!u.stats || typeof u.stats !== "object") {
      u.stats = { dailyTop1Count: 0, dailyTop3Count: 0, dailyTop10Count: 0 };
      dirty = true;
    } else {
      if (typeof u.stats.dailyTop1Count !== "number") { u.stats.dailyTop1Count = 0; dirty = true; }
      if (typeof u.stats.dailyTop3Count !== "number") { u.stats.dailyTop3Count = 0; dirty = true; }
      if (typeof u.stats.dailyTop10Count !== "number") { u.stats.dailyTop10Count = 0; dirty = true; }
    }
    if (typeof u.lastDailyRewardDay !== "string") { u.lastDailyRewardDay = ""; dirty = true; }

    if (dirty) await this.save(u);
    return u;
  }

  _newUser(id) {
    return {
      id,
      money: 20,
      energy: 5,
      energy_max: CONFIG.ENERGY_MAX,

      inv: { coffee: 0, sandwich: 0, lunch: 0 },
      upgrades: [],

      bonus: { last: "", streak: 0 },

      rest: { active: false, last: 0 },

      casino: { last: 0, day: "", spins: 0, free: { day: "", lastPrize: 0 } },

      study: { level: 0, active: false, startAt: 0, endAt: 0 },

      gym: { active: false, startAt: 0, endAt: 0, level: 0 },

      subReward: { day: "", eligible: false },

      displayName: "",
      lang: "",
      awaitingName: true,
      afterNameRoute: "",
      awaitingClanName: false,

      dayTotal: 0,
      dayKey: "",
      weekTotal: 0,
      weekKey: "",

      stats: { dailyTop1Count: 0, dailyTop3Count: 0, dailyTop10Count: 0 },
      lastDailyRewardDay: "",

      premium: 20,

      stocks: { holdings: {}, lastDividendDay: "", lastDividendAmount: 0 },

      // FastForward дневной лимит
      fastForwardDaily: { day: "", n: 0 },

      // дневные лимиты магазина
      premiumDaily: { day: "", coke: 0 },

      // Бар
      bar: { day: "", assigned: false, tasks: [] },

      clan: { clanId: "", joinedAt: 0, joinAvailableFromWeek: "", lastPresenceDay: "" },
      clanCosmetic: null,
      employment: { active: false, ownerId: "", bizId: "", ownerPct: 0, contractEnd: 0 },
      referral: { referredBy: "", rewarded: false, invited: [], totalGemsEarned: 0 },

      // Flags
      flags: {
        onboarding: false,
        onboardingStartedAt: 0,
        onboardingStep: "",
        firstJobGemGiven: false,
        onboardingDone: false,
        onboardingFlowV2: false,
        freeSkipUsed_work: false,
        freeSkipUsed_gym: false
      }
    };
  }

  async getOrCreate(id) {
    const key = this._key(id);
    const raw = await this.db.get(key);
    if (!raw) {
      const u = this._newUser(id);
      // Mark as new in-memory (not persisted) to enable onboarding logic on first /start
      u.__isNew = true;
      await this.save(u);
      return u;
    }
    return this.load(id, raw);
  }

  async update(id, fn) {
    const u = await this.load(id);
    const updated = (await fn(u)) ?? u;
    return this.save(updated);
  }

  // ===== никнейм =====
  validateDisplayName(raw) {
    if (typeof raw !== "string") return { ok: false, error: "Отправь текст с никнеймом." };
    const s = raw.trim();
    if (s.length < 2 || s.length > 16) return { ok: false, error: "Ник должен быть 2–16 символов." };
    if (s.includes("http") || s.includes("://") || s.includes("t.me/") || s.includes("@")) {
      return { ok: false, error: "В нике не должно быть ссылок и @." };
    }
    // RU/UA/EN + цифры, пробел, _ . -
    const re = /^[A-Za-z0-9 А-Яа-яЁёІіЇїЄєҐґ_.-]+$/u;
    if (!re.test(s)) {
      return {
        ok: false,
        error: "Разрешены буквы/цифры/пробел/._- (латиница/кириллица/украинский).",
      };
    }
    return { ok: true, value: s };
  }

  /**
   * Санитайзер для авто-фолбэка из Telegram: вычищает лишнее и, при необходимости, обрезает до 16.
   * Возвращает "" если после очистки <2 символов.
   * @param {string} raw
   * @param {{truncate?: boolean}} [opt]
   */
  sanitizeForDisplayName(raw, opt = {}) {
    if (typeof raw !== "string") return "";
    const truncate = !!opt.truncate;
    
    // Нормализуем и чистим zero-width, чтобы не прятали символы
    raw = raw.normalize?.("NFKC") || raw; 
    let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, "");
    
    // Убираем URL и @
    s = s.replace(/https?:\/\/\S+|t\.me\/\S+|@/gi, " ");

    // Оставляем только разрешённые символы (буквы RU/UA/EN, цифры, пробел, _ . -)
    s = s.replace(/[^A-Za-z0-9 А-Яа-яЁёІіЇїЄєҐґ_.-]+/gu, " ");

    // Нормализуем пробелы и обрезаем края
    s = s.replace(/\s+/g, " ").trim();

    // Обрезка до 16, если нужно
    if (truncate && s.length > 16) s = s.slice(0, 16);

    // Минимальная длина после очистки
    if (s.length < 2) return "";
    return s;
  }

  async setDisplayName(u, name) {
    const v = this.validateDisplayName(name);
    if (!v.ok) return v;
    u.displayName = v.value;
    u.awaitingName = false;
    await this.save(u);
    return { ok: true, value: u.displayName };
  }
}
