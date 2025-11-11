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
  async load(id) {
    const raw = await this.db.get(this._key(id));
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
    u.awaitingName = !!u.awaitingName;
    if (typeof u.afterNameRoute !== "string") { u.afterNameRoute = ""; dirty = true; }

    // Соц-табло суммы
    if (typeof u.dayTotal  !== "number") { u.dayTotal  = 0; dirty = true; }
    if (typeof u.dayKey    !== "string") { u.dayKey    = ""; dirty = true; }
    if (typeof u.weekTotal !== "number") { u.weekTotal = 0; dirty = true; }
    if (typeof u.weekKey   !== "string") { u.weekKey   = ""; dirty = true; }

    // Прем-валюта
    if (typeof u.premium !== "number") { u.premium = 0; dirty = true; }

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

    // ===== ЛЕГАСИ — мягко удаляем устаревшие ключи =====
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
      awaitingName: true,
      afterNameRoute: "",

      dayTotal: 0,
      dayKey: "",
      weekTotal: 0,
      weekKey: "",

      premium: 20,

      // FastForward дневной лимит
      fastForwardDaily: { day: "", n: 0 },

      // дневные лимиты магазина
      premiumDaily: { day: "", coke: 0 },

      // Бар
      bar: { day: "", assigned: false, tasks: [] }
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
    return this.load(id);
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
    const re = /^[A-Za-z0-9 А-Яа-яЁёІіЇїЄєҐґ_.-]+$/u;
    if (!re.test(s)) return { ok: false, error: "Разрешены буквы/цифры/пробел/._- (лат/кирилл/укр)." };
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

