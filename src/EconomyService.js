import { CONFIG } from "./GameConfig.js";
import { normalizeLang, t } from "./i18n/index.js";

export class EconomyService {
  _lang(u, lang = null) {
    return normalizeLang(lang || u?.lang || "ru");
  }

  _t(u, key, vars = {}, lang = null) {
    return t(key, this._lang(u, lang), vars);
  }

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
    // Base multiplier: car shortens shift time
    let mult = u.upgrades?.includes("car") ? 0.9 : 1;

    // Permanent study bonus: level = +1% speed per level (cap 50)
    const studyLevel = Math.min(u?.study?.level || 0, CONFIG.STUDY.MAX_LEVEL);
    mult *= (1 - studyLevel / 100);

    // One-off buffs are not applied anymore (work_shift_mul removed)
    return CONFIG.SHIFT_MS * mult;
  }

  // Text for the "Start studying" button - for the next level
  fmtStudyEffects(u, lang = null) {
    const L = Math.max(0, u?.study?.level || 0);
    if (L >= CONFIG.STUDY.MAX_LEVEL) {
      return this._t(u, "eco.study.max_reached", { max: CONFIG.STUDY.MAX_LEVEL }, lang);
    }

    const FACTOR =
      CONFIG.STUDY && typeof CONFIG.STUDY.GROWTH_FACTOR === "number"
        ? CONFIG.STUDY.GROWTH_FACTOR
        : 1.1;

    const pow = Math.pow(FACTOR, L);
    const costMoney = Math.round(CONFIG.STUDY.BASE_COST_MONEY * pow);
    const costEnergy = Math.round(CONFIG.STUDY.BASE_COST_ENERGY * pow);
    const mins = Math.round((CONFIG.STUDY.BASE_TIME_MS * pow) / 60000);

    return this._t(u, "eco.study.effects", { costMoney, costEnergy, mins }, lang);
  }

  fmtWorkEffects(u) {
    const lvl = { bonus: 0 }; // Career bonuses removed
    const pay = this.effectivePay(u, lvl);
    const cost = this.effectiveEnergyCost(u);
    const mins = Math.round(this.effectiveShift(u) / 60000);
    return `+${pay}, -${cost} energy, ~${mins} min`;
  }

  applyReward(u, { money = 0, premium = 0, reason = "reward" } = {}) {
    const addMoney = Math.max(0, Math.round(Number(money) || 0));
    const addPremium = Math.max(0, Math.round(Number(premium) || 0));
    if (addMoney) u.money = (u.money || 0) + addMoney;
    if (addPremium) u.premium = (u.premium || 0) + addPremium;
    try {
      console.log(`economy.reward reason=${reason} user=${u?.id ?? "?"} money=${addMoney} premium=${addPremium}`);
    } catch {}
    return { money: addMoney, premium: addPremium, reason };
  }
}
