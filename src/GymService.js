// GymService.js
import { CONFIG } from "./GameConfig.js";
import { NotifyDueIndex } from "./NotifyDueIndex.js";
import { markFunnelStep, markUsefulActivity } from "./PlayerStats.js";

/**
 * Сервис тренажёрного зала:
 * - растущие длительность, цена ($), расход ⚡ по уровню "gym.level"
 * - по завершении +1 к капу энергии (или другой шаг из конфига), до лимита
 * - состояние тренировки хранится в u.gym { level, active, startAt, endAt }
 */
export class GymService {
  constructor({ users, send, now, social = null, labour = null }) {
    this.users  = users;
    this.send   = typeof send === "function" ? send : async () => {};
    this.now    = now || (() => Date.now());
    this.social = social; // ← добавили, аналогично StudyService
    this.labour = labour;
    this.dueIndex = (this.users?.db) ? new NotifyDueIndex({ db: this.users.db, now: this.now }) : null;
  }

  /** Нормализованный конфиг с дефолтами и капами */
  static cfg() {
    return {
      // время
      BASE_TIME_MS:     CONFIG.GYM?.BASE_TIME_MS     ?? (10 * 60 * 1000),
      TIME_GROWTH:      CONFIG.GYM?.TIME_GROWTH      ?? 1.18,
      MAX_TIME_MS:      CONFIG.GYM?.MAX_TIME_MS      ?? (45 * 60 * 1000),

      // деньги
      BASE_COST_MONEY:  CONFIG.GYM?.BASE_COST_MONEY  ?? 20,
      MONEY_GROWTH:     CONFIG.GYM?.MONEY_GROWTH     ?? 1.15,
      MAX_COST_MONEY:   CONFIG.GYM?.MAX_COST_MONEY   ?? 120,

      // энергия
      BASE_COST_ENERGY: CONFIG.GYM?.BASE_COST_ENERGY ?? 8,
      ENERGY_GROWTH:    CONFIG.GYM?.ENERGY_GROWTH    ?? 1.08,
      MAX_COST_ENERGY:  CONFIG.GYM?.MAX_COST_ENERGY  ?? 20,

      // награда
      REWARD_ENERGY_MAX: CONFIG.GYM?.REWARD_ENERGY_MAX ?? 5,
      MAX_ENERGY_CAP:    CONFIG.GYM?.MAX_ENERGY_CAP    ?? 150,
    };
  }

  /** Чистая “формула” для текущей тренировки игрока */
  static computeForUser(u) {
    const C = this.cfg();
    const L = Math.max(0, u?.gym?.level || 0);

    const timeMs     = Math.min(C.MAX_TIME_MS,      Math.round(C.BASE_TIME_MS     * Math.pow(C.TIME_GROWTH,   L)));
    const costMoney  = Math.min(C.MAX_COST_MONEY,   Math.round(C.BASE_COST_MONEY  * Math.pow(C.MONEY_GROWTH,  L)));
    const costEnergy = Math.min(C.MAX_COST_ENERGY,  Math.round(C.BASE_COST_ENERGY * Math.pow(C.ENERGY_GROWTH, L)));

    return { timeMs, costMoney, costEnergy, level: L };
  }

  /** Запуск тренировки */
  async start(u) {
    u.gym = u.gym || { level: 0, active: false, startAt: 0, endAt: 0 };

    if (u.gym.active) {
      return { ok: false, error: "Тренировка уже идет." };
    }

    const { timeMs, costMoney, costEnergy, level } = GymService.computeForUser(u);

    if ((u.money || 0) < costMoney)  return { ok: false, error: "Недостаточно денег." };
    if ((u.energy || 0) < costEnergy) {
      return {
        ok: false,
        code: "not_enough_energy",
        needEnergy: Math.max(0, Number(costEnergy) || 0),
        haveEnergy: Math.max(0, Number(u.energy) || 0),
        error: "Недостаточно энергии."
      };
    }

    // списания
    u.money  = (u.money  || 0) - costMoney;
    u.energy = Math.max(0, (u.energy || 0) - costEnergy);

    // состояние тренировки
    const startAt = this.now();
    const endAt   = startAt + timeMs;
    u.gym.active  = true;
    u.gym.startAt = startAt;
    u.gym.endAt   = endAt;
    u.gym.notified = false; // чтобы по завершении крон прислал пуш

    await this.users.save(u);

    // best-effort индекс готовности уведомлений для крона
    try {
      if (this.dueIndex) {
        await this.dueIndex.markDue({ userId: u.id, activity: "gym", endAt });
      }
    } catch {}

    return { ok: true, timeMs, costMoney, costEnergy, level, endAt };
  }

  /**
   * Завершение, если срок вышел.
   * Если передан goTo, покажем экран Gym с интро; иначе просто отправим сообщение.
   * Возвращает true, если завершили.
   */
  async maybeFinish(u, goTo = null) {
    if (!u?.gym?.active) return false;

    const now = this.now();
    if (now < (u.gym.endAt || 0)) return false;

    const C = GymService.cfg();

    // ап уровня и награда к капу энергии
    const prevLevel = Math.max(0, u.gym.level || 0);
    u.gym.level  = prevLevel + 1;
    u.gym.active = false;
    u.gym.startAt = 0;
    u.gym.endAt   = 0;

    u.energy_max = Math.min(
      C.MAX_ENERGY_CAP,
      (u.energy_max || CONFIG.ENERGY_MAX || 100) + (C.REWARD_ENERGY_MAX || 5)
    );
    markFunnelStep(u, "didGym");
    markUsefulActivity(u, now);
    await this.users.save(u);

    // обновляем "Топ силачей" (best effort), как в study для умников
    try {
      if (this.social && typeof this.social.maybeUpdateStrongTop === "function") {
        await this.social.maybeUpdateStrongTop({
          userId: u.id,
          displayName: u.displayName || String(u.id),
          energyMax: u.energy_max,
          level: u.gym.level,
        });
      }
    } catch {}

    // Обновляем индекс свободных кандидатов для рынка наемников
    try {
      if (this.labour && typeof this.labour.upsertFreePlayer === "function") {
        await this.labour.upsertFreePlayer(u);
      }
    } catch {}

    const intro = `💪 Тренировка завершена! Энергокап: ${u.energy_max}. (Уровень зала: ${u.gym.level})`;

    if (typeof goTo === "function") {
      await goTo(u, "Gym", intro);
    } else {
      await this.send(intro);
    }
    return true;
  }
}
