// StudyService.js — учёба может идти параллельно с работой/отдыхом
import { CONFIG } from "./GameConfig.js";
import { HomeService } from "./HomeService.js";

export class StudyService {
  constructor({ users, send, now, social }) {
    this.users = users;
    this.send  = typeof send === "function" ? send : async () => {};
    this.now   = now || (() => Date.now());
    this.social = social || null; // для апдейта "умников"
  }


  _paramsForLevel(level) {
    const L      = Math.max(0, level || 0);
    const FACTOR = (CONFIG.STUDY && typeof CONFIG.STUDY.GROWTH_FACTOR === "number")
      ? CONFIG.STUDY.GROWTH_FACTOR
      : 1.1;

    const pow        = Math.pow(FACTOR, L);
    const timeMs     = Math.round((CONFIG.STUDY.BASE_TIME_MS || 10 * 60_000) * pow);
    const costMoney  = Math.round((CONFIG.STUDY.BASE_COST_MONEY  || 50) * pow);
    const costEnergy = Math.round((CONFIG.STUDY.BASE_COST_ENERGY || 10) * pow);

    return { timeMs, costMoney, costEnergy };
  }

  async start(u) {
    const level = Math.max(0, u?.study?.level || 0);
    const maxL  = (CONFIG.STUDY && CONFIG.STUDY.MAX_LEVEL) || 50;

    if (u.study?.active) return { ok: false, error: "Учёба уже идёт." };
    if (level >= maxL)   return { ok: false, error: `Максимальный уровень (${maxL}) уже достигнут.` };

    const { timeMs, costMoney, costEnergy } = this._paramsForLevel(level);

    if ((u.money || 0) < costMoney)  return { ok: false, error: "Недостаточно денег." };
    if ((u.energy || 0) < costEnergy) return { ok: false, error: "Недостаточно энергии." };

    u.money  = (u.money  || 0) - costMoney;
    HomeService.applyEnergy(u, -costEnergy, { autoStopRest: true });

    u.study = u.study || {};
    u.study.active  = true;
    u.study.startAt = this.now();
    u.study.endAt   = u.study.startAt + timeMs;
    u.study.notified = false;   // ← чтобы новый цикл пушей был возможен

    await this.users.save(u);


    return { ok: true, endAt: u.study.endAt, timeMs, costMoney, costEnergy };
  }

  async finish(u) {
    if (!u?.study?.active) return { ok: false, error: "Учёба не активна." };
  
    const maxL  = (CONFIG.STUDY && CONFIG.STUDY.MAX_LEVEL) || 50;
    const level = Math.max(0, u?.study?.level || 0);
    u.study.level   = Math.min(maxL, level + 1);
    u.study.active  = false;
    u.study.startAt = 0;
    u.study.endAt   = 0;
    u.study.notified = false; // сессия закрыта, флаг не нужен, но оставим в нуле
  
    await this.users.save(u);
  
    // best-effort апдейт «умников»
    try {
      if (this.social?.maybeUpdateSmartTop) {
        await this.social.maybeUpdateSmartTop({
          userId: u.id,
          displayName: u.displayName || String(u.id),
          level: u.study.level
        });
      }
    } catch {}
  
    return { ok: true, level: u.study.level };
  }
  

  async maybeFinish(u, goTo = null) {
    if (!u?.study?.active) return false;

    const now = this.now();
    if (now < (u.study.endAt || 0)) return false;

    const maxL  = (CONFIG.STUDY && CONFIG.STUDY.MAX_LEVEL) || 50;
    const level = Math.max(0, u?.study?.level || 0);
    u.study.level  = Math.min(maxL, level + 1);
    u.study.active = false;
    u.study.startAt = 0;
    u.study.endAt   = 0;

    await this.users.save(u);

    // Апдейтим "Топ умников" (best-effort), как в других топах
try {
  if (this.social && typeof this.social.maybeUpdateSmartTop === "function") {
    await this.social.maybeUpdateSmartTop({
      userId: u.id,
      displayName: u.displayName || String(u.id),
      level: u.study.level
    });
  }
} catch {}

    const doneText = `🎓 Обучение завершено! Уровень: ${u.study.level}. (+1% к скорости работ, максимум ${maxL}%)`;

    if (typeof goTo === "function") {
      await goTo(u, "Study", doneText);
    } else {
      await this.send(doneText);
    }
    return true;
  }
}
