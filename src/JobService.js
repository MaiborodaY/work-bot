// JobService.js
import { CONFIG } from "./GameConfig.js";
import { HomeService } from "./HomeService.js";
import { BarService } from "./BarService.js";
import { NotifyDueIndex } from "./NotifyDueIndex.js";

export class JobService {
  constructor({ users, now, social, achievements = null }) {
    this.users = users;
    this.now = now || (() => Date.now());
    this.social = social || null;
    this.achievements = achievements || null;
    this.dueIndex = (this.users?.db) ? new NotifyDueIndex({ db: this.users.db, now: this.now }) : null;
  }

  _has(u, key) { return Array.isArray(u.upgrades) && u.upgrades.includes(key); }
  _ensureJobs(u) {
    if (!u.jobs) u.jobs = { slotMax: 1, active: [] };
    if (!Array.isArray(u.jobs.active)) u.jobs.active = [];
  }
  getActive(u) {
    this._ensureJobs(u);
    return u.jobs.active[0] || null;
  }

  _applyStartModifiers(u, base) {
    let duration = base.durationMs;
    let energy = base.energy;

    if (this._has(u, "car")) duration = Math.floor(duration * 0.9);
    if (this._has(u, "coffee")) energy = Math.ceil(energy * 0.95);

    // Перманентный бонус от учёбы: уровень = +1% скорости (уменьшаем длительность)
    const studyLevel = Math.min(u?.study?.level || 0, CONFIG.STUDY.MAX_LEVEL);
    duration = Math.floor(duration * (1 - studyLevel / 100));

    return { duration, energy };
  }

  _applyFinishModifiers(u, basePay) {
    let pay = basePay;
    if (this._has(u, "laptop")) pay = Math.round(pay * 1.10);
    return pay;
  }

  async start(u, typeId) {
    this._ensureJobs(u);
    const type = CONFIG.JOBS[typeId];
    if (!type) return { ok: false, error: "Неизвестный тип работы." };
    if (this.getActive(u)) return { ok: false, error: "У тебя уже есть активная работа." };

    const mod = this._applyStartModifiers(u, type);
    const startAt = this.now();
    let endAt = startAt + mod.duration;

    if ((u.energy || 0) < mod.energy) return { ok: false, error: "Недостаточно энергии." };

    // списываем энергию через HomeService (на случай, если игрок отдыхает)
    HomeService.applyEnergy(u, -mod.energy, { autoStopRest: true });

    const inst = {
      id: String(startAt) + ":" + typeId,
      typeId,
      startAt,
      endAt,
      energySpent: mod.energy,
      plannedPay: type.pay,
      claimed: false,
      notified: false,
      effects: {},
    };

    u.jobs.active = [inst];
    let achRes = null;
    if (this.achievements?.onEvent) {
      try {
        achRes = await this.achievements.onEvent(u, "work_claim", { pay }, {
          persist: false,
          notify: false
        });
      } catch {}
    }

    await this.users.save(u);
    if (achRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, achRes.newlyEarned);
    }

    // best-effort индекс готовности уведомлений для крона
    try {
      if (this.dueIndex) {
        await this.dueIndex.markDue({ userId: u.id, activity: "work", endAt });
      }
    } catch {}

    return { ok: true, inst };
  }

  async claim(u) {
    if (!u.displayName) {
      u.awaitingName = true;
      u.afterNameRoute = "work:claim";
      await this.users.save(u);
      return {
        ok: false,
        error:
          "Сначала укажи никнейм для игры (2–16 символов). Напиши его одним сообщением.",
      };
    }

    const inst = this.getActive(u);
    if (!inst) return { ok: false, error: "Активной работы нет." };
    const now = this.now();
    if (now < inst.endAt) return { ok: false, error: "Слишком рано. Работа ещё не завершена." };
    if (inst.claimed) return { ok: false, error: "Выплата уже получена." };
    const shiftEndAt = Number(inst.endAt || 0);

    let pay = this._applyFinishModifiers(u, inst.plannedPay);
    pay = Math.max(0, Math.round(pay));

    // Сначала фиксируем период, затем синхронизируем ключи у пользователя
    if (this.social && typeof this.social.ensurePeriod === "function") {
      await this.social.ensurePeriod();
      if (typeof this.social.getCurrentKeys === "function") {
        const { dayKey, weekKey } = this.social.getCurrentKeys();
        if (u.dayKey !== dayKey) { u.dayKey = dayKey; u.dayTotal = 0; }
        if (u.weekKey !== weekKey) { u.weekKey = weekKey; u.weekTotal = 0; }
      }
    }

    // Начисляем деньги и закрываем работу
    u.money = (u.money || 0) + pay;
    inst.claimed = true;
    u.jobs.active = [];
    u.dayTotal  = (u.dayTotal  || 0) + pay;
    u.weekTotal = (u.weekTotal || 0) + pay;

    await this.users.save(u);

    // BAR-квесты (best-effort)
    try {
      await BarService.onWorkClaim({ u, users: this.users, now: this.now, pay });
    } catch {}

    // Агрегаты и топ (best-effort)
    try {
      if (this.social) {
        await this.social.incrementTotals({ amount: pay });

        // дневной топ — как и раньше
        await this.social.maybeUpdateDailyTop({
          userId: u.id,
          displayName: u.displayName || String(u.id),
          total: u.dayTotal
        });

        // НОВОЕ: недельный топ
        await this.social.maybeUpdateWeeklyTop({
          userId: u.id,
          displayName: u.displayName || String(u.id),
          total: u.weekTotal
        });
      }
    } catch {}

    return { ok: true, pay, endAt: shiftEndAt };
  }

  async cancel(u) {
    const inst = this.getActive(u);
    if (!inst) return { ok: false, error: "Активной работы нет." };
    const now = this.now();
    if (inst.claimed) return { ok: false, error: "Работа уже закрыта." };
    if (now >= inst.endAt) return { ok: false, error: "Работа уже завершена — забери выплату." };

    const penalty = 5;
    HomeService.applyEnergy(u, -penalty, { autoStopRest: true });

    u.jobs.active = [];
    await this.users.save(u);
    return { ok: true, penalty };
  }
}
