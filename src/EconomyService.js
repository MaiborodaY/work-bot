import { CONFIG } from "./GameConfig.js";

export class EconomyService {
  effectivePay(u, lvl) {
    let pay = CONFIG.PAY_BASE + (lvl?.bonus || 0);
    if (u.upgrades?.includes("laptop")) pay *= 1.1;
    return Math.round(pay);
  }

  effectiveEnergyCost(u) {
    return Math.ceil(
      CONFIG.ENERGY_COST_SHIFT * (u.upgrades?.includes("coffee") ? 0.95 : 1)
    );
  }

  effectiveShift(u) {
    // Базовый множитель: машина сокращает время
    let mult = u.upgrades?.includes("car") ? 0.9 : 1;

    // Перманентный бонус от учёбы: уровень = +1% скорость на уровень (кап 50)
    const studyLevel = Math.min(u?.study?.level || 0, CONFIG.STUDY.MAX_LEVEL);
    mult *= (1 - studyLevel / 100);

    // ⚠️ Больше НЕ учитываем одноразовые баффы (work_shift_mul удалён)
    return CONFIG.SHIFT_MS * mult;
  }

  // Текст для кнопки «Начать обучение» — для СЛЕДУЮЩЕГО уровня
  fmtStudyEffects(u) {
    const L = Math.max(0, u?.study?.level || 0);
    if (L >= CONFIG.STUDY.MAX_LEVEL) {
      return `максимум уровня (${CONFIG.STUDY.MAX_LEVEL}) достигнут`;
    }

    const FACTOR =
      CONFIG.STUDY && typeof CONFIG.STUDY.GROWTH_FACTOR === "number"
        ? CONFIG.STUDY.GROWTH_FACTOR
        : 1.1;

    const pow = Math.pow(FACTOR, L);
    const costMoney  = Math.round(CONFIG.STUDY.BASE_COST_MONEY  * pow);
    const costEnergy = Math.round(CONFIG.STUDY.BASE_COST_ENERGY * pow);
    const mins = Math.round((CONFIG.STUDY.BASE_TIME_MS * pow) / 60000);

    return `−$${costMoney}, −${costEnergy}⚡, +1% к скорости, ~${mins} мин`;
  }

  fmtWorkEffects(u) {
    const lvl = { bonus: 0 }; // карьера вырезана, бонусов нет
    const pay = this.effectivePay(u, lvl);
    const cost = this.effectiveEnergyCost(u);
    const mins = Math.round(this.effectiveShift(u) / 60000);
    return `+$${pay}, −${cost}⚡, ~${mins} мин`;
  }
}
