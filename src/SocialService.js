// SocialService.js — один ключ на период: agg:day / agg:week / agg:all и lb:day.
// Без датированных ключей и шардов. Есть авто-ролловер при смене дня/недели.

import { CONFIG } from "./GameConfig.js";
import { EconomyService } from "./EconomyService.js";

export class SocialService {
  constructor({ db, users, now, economy, isAdmin = null }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.economy = economy || new EconomyService();
    this.isAdmin = (typeof isAdmin === "function") ? isAdmin : (() => false);
    this._periodEnsured = false;
    this._periodEnsurePromise = null;
  }

  _isAdminUserId(userId) {
    const id = String(userId ?? "").trim();
    if (!id) return false;
    try {
      return !!this.isAdmin(id);
    } catch {
      return false;
    }
  }

  _filterOutAdmins(rows) {
    const arr = Array.isArray(rows) ? rows : [];
    return arr.filter((row) => !this._isAdminUserId(row?.userId));
  }

  // ====== периодные ключи (UTC) ======
  _dateKey() {
    const d = new Date(this.now());
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`; // YYYYMMDD
  }

  _dateStr(offsetMs = 0) {
    const d = new Date(this.now() + offsetMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // YYYY-MM-DD
  }

  _dayKeyToDateStr(dayKey) {
    const raw = String(dayKey || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    return "";
  }

  _dailyWinnersKey(dayStr) {
    return `DAILY_WINNERS:${dayStr}`;
  }

  _dailyBizTopKey(dayStr) {
    return `DAILY_BIZ_TOP:${dayStr}`;
  }

  _rewardForPlace(place) {
    const table = CONFIG?.DAILY_TOP_REWARDS || {};
    const cfg = table?.[place] || table?.[String(place)] || {};
    return {
      stars: Math.max(0, Number(cfg?.stars) || 0),
      money: Math.max(0, Number(cfg?.money) || 0),
    };
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
    if (this._periodEnsured) return;
    if (this._periodEnsurePromise) {
      await this._periodEnsurePromise;
      return;
    }

    this._periodEnsurePromise = (async () => {
      const { dayKey: curDay, weekKey: curWeek } = this.getCurrentKeys();
      const storedDay = (await this.db.get("state:dayKey")) || "";
      const storedWeek = (await this.db.get("state:weekKey")) || "";

      if (storedDay !== curDay) {
        if (storedDay) {
          let prevTop = [];
          try {
            const rawTop = await this.db.get("lb:day");
            prevTop = rawTop ? JSON.parse(rawTop) : [];
          } catch {}
          let prevBizTop = [];
          try {
            const rawBizTop = await this.db.get("lb:biz_day");
            prevBizTop = rawBizTop ? JSON.parse(rawBizTop) : [];
          } catch {}
          try {
            await this.distributeDailyTopRewards({ rewardDayKey: storedDay, topList: prevTop });
          } catch (e) {
            console.error("daily_top_reward.error", e?.message || e);
            throw e;
          }
          try {
            const prevDay = this._dayKeyToDateStr(storedDay);
            if (prevDay) {
              await this.saveDailyBizTopSnapshot(prevDay, prevBizTop);
            }
          } catch {}
        }
        await this.db.put("agg:day", "0");
        await this.db.put("lb:day", "[]");
        await this.db.put("lb:biz_day", "[]");
        await this.db.put("lb:farm_day", "[]");
        await this.db.put("state:dayKey", curDay);
      }
      if (storedWeek !== curWeek) {
        await this.db.put("agg:week", "0");
        await this.db.put("lb:week", "[]");          // ← очищаем недельный топ
        await this.db.put("lb:farm_week", "[]");
        await this.db.put("state:weekKey", curWeek);
      }

      this._periodEnsured = true;
    })();

    try {
      await this._periodEnsurePromise;
    } finally {
      this._periodEnsurePromise = null;
    }
  }
  // ====== агрегаты / топ ======
  async distributeDailyTopRewards({ rewardDayKey, rewardDayStr, topList } = {}) {
    const rewardDay = this._dayKeyToDateStr(rewardDayStr || rewardDayKey || "");
    if (!rewardDay) return { ok: false, reason: "invalid_day" };

    let list = Array.isArray(topList) ? [...topList] : [];
    if (!topList) {
      try {
        const raw = await this.db.get("lb:day");
        list = raw ? JSON.parse(raw) : [];
      } catch {
        list = [];
      }
    }

    if (!Array.isArray(list)) list = [];
    list = this._filterOutAdmins([...list]);
    list.sort((a, b) => (Number(b?.total) || 0) - (Number(a?.total) || 0));
    const top = list.slice(0, 10);

    const snapshot = [];
    for (let i = 0; i < top.length; i++) {
      const entry = top[i] || {};
      const uidRaw = entry.userId ?? entry.id;
      if (uidRaw == null) continue;
      const place = i + 1;
      const reward = this._rewardForPlace(place);
      const userId = /^\d+$/.test(String(uidRaw)) ? Number(uidRaw) : uidRaw;
      const earned = Number(entry.total || 0);
      const name = (typeof entry.name === "string" && entry.name.trim()) ? entry.name.trim() : "";

      snapshot.push({ userId, place, earned, reward, name });
      await this._applyDailyReward({ userId, rewardDay, place, reward });
    }

    await this.saveDailyWinnersSnapshot(rewardDay, snapshot);
    return { ok: true, snapshot, rewardDay };
  }

  async _applyDailyReward({ userId, rewardDay, place, reward }) {
    if (!this.users || typeof this.users.load !== "function" || typeof this.users.save !== "function") return;

    const u = await this.users.load(userId).catch(() => null);
    if (!u || u.lastDailyRewardDay === rewardDay) return;

    const stars = Math.max(0, Number(reward?.stars) || 0);
    const money = Math.max(0, Number(reward?.money) || 0);

    if (this.economy && typeof this.economy.applyReward === "function") {
      this.economy.applyReward(u, { money, premium: stars, reason: "daily_top_reward" });
    } else {
      if (money) u.money = (u.money || 0) + money;
      if (stars) u.premium = (u.premium || 0) + stars;
    }

    if (!u.stats || typeof u.stats !== "object") {
      u.stats = { dailyTop1Count: 0, dailyTop3Count: 0, dailyTop10Count: 0 };
    }
    if (place === 1) {
      u.stats.dailyTop1Count = (u.stats.dailyTop1Count || 0) + 1;
      u.stats.dailyTop3Count = (u.stats.dailyTop3Count || 0) + 1;
      u.stats.dailyTop10Count = (u.stats.dailyTop10Count || 0) + 1;
    } else if (place <= 3) {
      u.stats.dailyTop3Count = (u.stats.dailyTop3Count || 0) + 1;
      u.stats.dailyTop10Count = (u.stats.dailyTop10Count || 0) + 1;
    } else if (place <= 10) {
      u.stats.dailyTop10Count = (u.stats.dailyTop10Count || 0) + 1;
    }

    u.lastDailyRewardDay = rewardDay;
    await this.users.save(u);
  }

  async saveDailyWinnersSnapshot(dayStr, winners) {
    const day = this._dayKeyToDateStr(dayStr);
    if (!day || !this.db) return;
    const arr = Array.isArray(winners) ? winners : [];
    await this.db.put(this._dailyWinnersKey(day), JSON.stringify(arr));
  }

  async getDailyWinnersSnapshot(dayStr = null) {
    const day = this._dayKeyToDateStr(dayStr || this._dateStr(-24 * 60 * 60 * 1000));
    if (!day || !this.db) return [];
    const raw = await this.db.get(this._dailyWinnersKey(day));
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return this._filterOutAdmins(Array.isArray(arr) ? arr : []);
    } catch {
      return [];
    }
  }

  async saveDailyBizTopSnapshot(dayStr, rows) {
    const day = this._dayKeyToDateStr(dayStr);
    if (!day || !this.db) return;
    const arr = this._filterOutAdmins(Array.isArray(rows) ? rows : []);
    const normalized = arr
      .map((x) => ({
        userId: String(x?.userId ?? x?.id ?? "").trim(),
        name: String(x?.name || "").trim(),
        total: Math.max(0, Number(x?.total || x?.money || 0))
      }))
      .filter((x) => !!x.userId)
      .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
      .slice(0, 10);
    await this.db.put(this._dailyBizTopKey(day), JSON.stringify(normalized));
  }

  async getDailyBizTopSnapshot(dayStr = null) {
    const day = this._dayKeyToDateStr(dayStr || this._dateStr(-24 * 60 * 60 * 1000));
    if (!day || !this.db) return [];
    const raw = await this.db.get(this._dailyBizTopKey(day));
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return this._filterOutAdmins(Array.isArray(arr) ? arr : []);
    } catch {
      return [];
    }
  }

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
    const list = this._filterOutAdmins(JSON.parse(raw));
    const idStr = String(userId);
    if (this._isAdminUserId(idStr)) {
      const cleaned = list.filter((x) => String(x.userId) !== idStr);
      cleaned.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put("lb:day", JSON.stringify(trimmed));
      return trimmed;
    }

    const idx = list.findIndex(x => String(x.userId) === idStr);
    if (idx >= 0) {
      list[idx].name = displayName || idStr;
      list[idx].total = total;
    } else {
      list.push({ userId: idStr, name: displayName || idStr, total });
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
    const list = this._filterOutAdmins(JSON.parse(raw));
    const idStr = String(userId);
    if (this._isAdminUserId(idStr)) {
      const cleaned = list.filter((x) => String(x.userId) !== idStr);
      cleaned.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put("lb:week", JSON.stringify(trimmed));
      return trimmed;
    }

    const idx = list.findIndex(x => String(x.userId) === idStr);
    if (idx >= 0) {
      list[idx].name = displayName || idStr;
      list[idx].total = total;
    } else {
      list.push({ userId: idStr, name: displayName || idStr, total });
    }

    list.sort((a, b) => b.total - a.total);
    const trimmed = list.slice(0, 10);
    await this.db.put("lb:week", JSON.stringify(trimmed));
    return trimmed;
  }

  async getWeeklyTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:week")) || "[]";
    return this._filterOutAdmins(JSON.parse(raw));
  }

  // ====== Топ фермы: доход (неделя / all-time) ======
  async _updateFarmTopKey(key, { userId, displayName, total }) {
    const raw = (await this.db.get(key)) || "[]";
    /** @type {{userId:string,name:string,total:number}[]} */
    const list = this._filterOutAdmins(JSON.parse(raw));
    const idStr = String(userId);
    if (this._isAdminUserId(idStr)) {
      const cleaned = list.filter((x) => String(x.userId) !== idStr);
      cleaned.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put(key, JSON.stringify(trimmed));
      return trimmed;
    }

    const safeTotal = Math.max(0, Number(total) || 0);
    const idx = list.findIndex(x => String(x.userId) === idStr);
    if (idx >= 0) {
      list[idx].name = displayName || idStr;
      list[idx].total = safeTotal;
    } else {
      list.push({ userId: idStr, name: displayName || idStr, total: safeTotal });
    }

    list.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    const trimmed = list.slice(0, 10);
    await this.db.put(key, JSON.stringify(trimmed));
    return trimmed;
  }

  async maybeUpdateFarmTop({ userId, displayName, dayTotal, weekTotal, allTotal }) {
    await this.ensurePeriod();
    const safeDay = Math.max(0, Number(dayTotal) || 0);
    const safeWeek = Math.max(0, Number(weekTotal) || 0);
    const safeAll = Math.max(0, Number(allTotal) || 0);
    await this._updateFarmTopKey("lb:farm_day", { userId, displayName, total: safeDay });
    await this._updateFarmTopKey("lb:farm_week", { userId, displayName, total: safeWeek });
    await this._updateFarmTopKey("lb:farm_all", { userId, displayName, total: safeAll });
  }

  async getFarmDayTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:farm_day")) || "[]";
    return this._filterOutAdmins(JSON.parse(raw));
  }

  async getFarmWeekTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:farm_week")) || "[]";
    return this._filterOutAdmins(JSON.parse(raw));
  }

  async getFarmAllTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:farm_all")) || "[]";
    return this._filterOutAdmins(JSON.parse(raw));
  }
  // === Топ умников (уровень, all-time) ===
  async maybeUpdateSmartTop({ userId, displayName, level }) {
    // all-time — ролловер не нужен, но ensurePeriod() оставим для единообразия
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:smart")) || "[]";
    /** @type {{userId:string,name:string,level:number}[]} */
    const list = this._filterOutAdmins(JSON.parse(raw));

    const idStr = String(userId);
    if (this._isAdminUserId(idStr)) {
      const cleaned = list.filter(x => String(x.userId) !== idStr);
      cleaned.sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put("lb:smart", JSON.stringify(trimmed));
      return trimmed;
    }
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
    return this._filterOutAdmins(JSON.parse(raw));
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
    return this._filterOutAdmins(JSON.parse(raw));
  }

  // ====== Топ по сбору с бизнесов (день) ======
  async maybeUpdateBizDayTop({ userId, displayName, total }) {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:biz_day")) || "[]";
    /** @type {{userId:string,name:string,total:number}[]} */
    const list = this._filterOutAdmins(JSON.parse(raw));
    const idStr = String(userId);
    if (this._isAdminUserId(idStr)) {
      const cleaned = list.filter((x) => String(x.userId) !== idStr);
      cleaned.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put("lb:biz_day", JSON.stringify(trimmed));
      return trimmed;
    }

    const safeTotal = Math.max(0, Number(total) || 0);
    const idx = list.findIndex((x) => String(x.userId) === idStr);
    if (idx >= 0) {
      list[idx].name = displayName || idStr;
      list[idx].total = safeTotal;
    } else {
      list.push({ userId: idStr, name: displayName || idStr, total: safeTotal });
    }

    list.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    const trimmed = list.slice(0, 10);
    await this.db.put("lb:biz_day", JSON.stringify(trimmed));
    return trimmed;
  }

  async getBizDayTop() {
    await this.ensurePeriod();
    const raw = (await this.db.get("lb:biz_day")) || "[]";
    return this._filterOutAdmins(JSON.parse(raw));
  }

  // ДОБАВЬ в конец класса SocialService

  // ====== Топ силачей (всё время) ======
  async maybeUpdateStrongTop({ userId, displayName, energyMax, gymLevel }) {
    // читаем текущий список
    const raw = (await this.db.get("lb:gym_all")) || "[]";
    /** @type {{userId:string,name:string,energyMax:number,level?:number}[]} */
    const list = this._filterOutAdmins(JSON.parse(raw));

    const idStr = String(userId);
    if (this._isAdminUserId(idStr)) {
      const cleaned = list.filter(x => String(x.userId) !== idStr);
      cleaned.sort((a, b) => (Number(b.energyMax) || 0) - (Number(a.energyMax) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put("lb:gym_all", JSON.stringify(trimmed));
      return trimmed;
    }
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
    return this._filterOutAdmins(JSON.parse(raw));
  }

  // ------ Lucky (max single spin win) ------
  _luckyKey() { return `lb:lucky_all`; }

  async getLuckyTop(limit = 10) {
    const raw = await this.db.get(this._luckyKey());
    const arr = raw ? JSON.parse(raw) : [];
    return this._filterOutAdmins(Array.isArray(arr) ? arr : []).slice(0, limit);
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
    arr = this._filterOutAdmins(arr);

    const id = String(userId);
    if (this._isAdminUserId(id)) {
      const cleaned = arr.filter((x) => String(x.userId) !== id);
      cleaned.sort((a, b) => (Number(b.best) || 0) - (Number(a.best) || 0));
      const trimmed = cleaned.slice(0, 10);
      await this.db.put(key, JSON.stringify(trimmed));
      return trimmed;
    }
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
