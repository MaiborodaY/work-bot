// SocialService.js — один ключ на период: agg:day / agg:week / agg:all и lb:day.
// Без датированных ключей и шардов. Есть авто-ролловер при смене дня/недели.

export class SocialService {
  constructor({ db, users, now }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
  }

  // ====== периодные ключи (UTC) ======
  _dateKey() {
    const d = new Date(this.now());
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`; // YYYYMMDD
  }

  _weekKey() {
    const d = new Date(this.now());
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6, 0=понедельник
    const thursday = new Date(tmp);
    thursday.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    const diffDays = Math.floor((thursday.getTime() - firstThursday.getTime()) / 86400000);
    const week = 1 + Math.floor(diffDays / 7);
    return `${thursday.getUTCFullYear()}${String(week).padStart(2, "0")}`; // YYYYWW
  }

  getCurrentKeys() {
    return { dayKey: this._dateKey(), weekKey: this._weekKey() };
  }

  async ensurePeriod() {
    const { dayKey: curDay, weekKey: curWeek } = this.getCurrentKeys();
    const storedDay = (await this.db.get("state:dayKey")) || "";
    const storedWeek = (await this.db.get("state:weekKey")) || "";

    if (storedDay !== curDay) {
      await this.db.put("agg:day", "0");
      await this.db.put("lb:day", "[]");
      await this.db.put("state:dayKey", curDay);
    }
    if (storedWeek !== curWeek) {
      await this.db.put("agg:week", "0");
      await this.db.put("lb:week", "[]");          // ← очищаем недельный топ
      await this.db.put("state:weekKey", curWeek);
    }    
  }

  // ====== агрегаты / топ ======
  async _incr(key, by) {
    const cur = parseInt((await this.db.get(key)) || "0", 10) || 0;
    await this.db.put(key, String(cur + Math.max(0, by)));
  }

  async incrementTotals({ amount /*, userId*/ }) {
    await this.ensurePeriod();
    await this._incr("agg:day", amount);
    await this._incr("agg:week", amount);
    await this._incr("agg:all", amount);
  }

  async maybeUpdateDailyTop({ userId, displayName, total }) {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:day")) || "[]";
    /** @type {{userId:string,name:string,total:number}[]} */
    const list = JSON.parse(raw);

    const idx = list.findIndex(x => String(x.userId) === String(userId));
    if (idx >= 0) {
      list[idx].name = displayName || String(userId);
      list[idx].total = total;
    } else {
      list.push({ userId, name: displayName || String(userId), total });
    }

    list.sort((a, b) => b.total - a.total);
    const trimmed = list.slice(0, 10);
    await this.db.put("lb:day", JSON.stringify(trimmed));
    return trimmed;
  }

  async maybeUpdateWeeklyTop({ userId, displayName, total }) {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:week")) || "[]";
    /** @type {{userId:string,name:string,total:number}[]} */
    const list = JSON.parse(raw);

    const idx = list.findIndex(x => String(x.userId) === String(userId));
    if (idx >= 0) {
      list[idx].name = displayName || String(userId);
      list[idx].total = total;
    } else {
      list.push({ userId, name: displayName || String(userId), total });
    }

    list.sort((a, b) => b.total - a.total);
    const trimmed = list.slice(0, 10);
    await this.db.put("lb:week", JSON.stringify(trimmed));
    return trimmed;
  }

  async getWeeklyTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:week")) || "[]";
    return JSON.parse(raw);
  }
  // === Топ умников (уровень, all-time) ===
  async maybeUpdateSmartTop({ userId, displayName, level }) {
    // all-time — ролловер не нужен, но ensurePeriod() оставим для единообразия
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:smart")) || "[]";
    /** @type {{userId:string,name:string,level:number}[]} */
    const list = JSON.parse(raw);

    const idStr = String(userId);
    const idx = list.findIndex(x => String(x.userId) === idStr);
    if (idx >= 0) {
      // апдейтим имя и уровень, если вырос
      list[idx].name = displayName || idStr;
      if (typeof level === "number" && level > (list[idx].level || 0)) {
        list[idx].level = level;
      }
    } else {
      list.push({ userId: idStr, name: displayName || idStr, level: Math.max(0, level|0) });
    }

    // Стабильная сортировка V8 сохранит порядок “кто раньше попал — тот выше” при равенстве уровней
    list.sort((a, b) => (b.level - a.level));
    const trimmed = list.slice(0, 10);
    await this.db.put("lb:smart", JSON.stringify(trimmed));
    return trimmed;
  }

  async getSmartTop() {
    // all-time
    const raw = (await this.db.get("lb:smart")) || "[]";
    return JSON.parse(raw);
  }


  async getTotals() {
    await this.ensurePeriod();
    const day  = parseInt((await this.db.get("agg:day"))  || "0", 10) || 0;
    const week = parseInt((await this.db.get("agg:week")) || "0", 10) || 0;
    const all  = parseInt((await this.db.get("agg:all"))  || "0", 10) || 0;
    return { day, week, all };
  }

  async getDailyTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:day")) || "[]";
    return JSON.parse(raw);
  }

  // ДОБАВЬ в конец класса SocialService

  // ====== Топ силачей (всё время) ======
  async maybeUpdateStrongTop({ userId, displayName, energyMax, gymLevel }) {
    // читаем текущий список
    const raw = (await this.db.get("lb:gym_all")) || "[]";
    /** @type {{userId:string,name:string,energyMax:number,level?:number}[]} */
    const list = JSON.parse(raw);

    const idStr = String(userId);
    const idx = list.findIndex(x => String(x.userId) === idStr);

    if (idx >= 0) {
      // обновляем имя/метрику
      list[idx].name = (displayName && String(displayName).trim()) || idStr;
      list[idx].energyMax = Number(energyMax) || 0;
      list[idx].level = Number.isFinite(gymLevel) ? gymLevel : list[idx].level;
    } else {
      list.push({
        userId: idStr,
        name: (displayName && String(displayName).trim()) || idStr,
        energyMax: Number(energyMax) || 0,
        level: Number.isFinite(gymLevel) ? gymLevel : undefined
      });
    }

    // сортировка: по energyMax desc, без доп. тай-брейков (как просил)
    list.sort((a, b) => (b.energyMax - a.energyMax));

    const trimmed = list.slice(0, 10);
    await this.db.put("lb:gym_all", JSON.stringify(trimmed));
    return trimmed;
  }

  async getStrongTop() {
    const raw = (await this.db.get("lb:gym_all")) || "[]";
    return JSON.parse(raw);
  }

  // ------ Lucky (max single spin win) ------
  _luckyKey() { return `lb:lucky_all`; }

  async getLuckyTop(limit = 10) {
    const raw = await this.db.get(this._luckyKey());
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, limit) : [];
  }

  /**
   * Поднимает игрока в «Самый везучий палец...» если его best вырос.
   * @param {{userId:string|number, displayName:string, best:number}} p
   */
  async maybeUpdateLuckyTop({ userId, displayName, best }) {
    const key = this._luckyKey();
    const raw = await this.db.get(key);
    /** @type {{userId:number|string,name:string,best:number,ts:number}[]} */
    let arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) arr = [];

    const id = String(userId);
    const safeName = (displayName && String(displayName).trim()) || `Игрок #${id.slice(-4)}`;

    const i = arr.findIndex(x => String(x.userId) === id);
    if (i >= 0) {
      if ((arr[i].best || 0) >= best) return; // не улучшается — выходим
      arr[i].best = best;
      arr[i].name = safeName;
      arr[i].ts = this.now();
    } else {
      arr.push({ userId: id, name: safeName, best: best, ts: this.now() });
    }

    // сортировка: по best desc, tie-break — прежний порядок (без доп. полей)
    arr.sort((a, b) => (b.best || 0) - (a.best || 0));
    if (arr.length > 10) arr = arr.slice(0, 10);

    await this.db.put(key, JSON.stringify(arr));
  }
}
