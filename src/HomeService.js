// HomeService.js — доменная логика Дома: кровати, восстановление, энергия
import { CONFIG } from "./GameConfig.js";

export class HomeService {
  // --- Тиры кроватей ---
  static tierOf(key) {
    if (key === "bed3") return 3;
    if (key === "bed2") return 2;
    if (key === "bed1") return 1;
    return 0;
  }

  static restMultiplierOfTier(tier) {
    return tier === 3 ? 3 : tier === 2 ? 2 : tier === 1 ? 1.5 : 1;
  }

  static bestOwnedBedTier(u) {
    const up = Array.isArray(u?.upgrades) ? u.upgrades : [];
    if (up.includes("bed3")) return 3;
    if (up.includes("bed2")) return 2;
    if (up.includes("bed1")) return 1;
    return 0;
  }

  static currentRestMultiplier(u) {
    return this.restMultiplierOfTier(this.bestOwnedBedTier(u));
  }

  static gainLabelFor(key) {
    const t = this.tierOf(key);
    const mult = this.restMultiplierOfTier(t);
    return `(восст. x${mult})`;
  }

  // Показывать только кровати строго выше текущего тира
  static bedsToOffer(u) {
    const curTier = this.bestOwnedBedTier(u);
    const keys = ["bed1", "bed2", "bed3"];
    return keys.filter(k => this.tierOf(k) > curTier);
  }

  // --- Энергия ---
  /**
   * Применить прирост/убыль энергии с клампом и опц. авто-стопом отдыха.
   * @param {object} u - пользователь
   * @param {number} delta - +добавить/-снять энергии
   * @param {{autoStopRest?: boolean}} [opts]
   * @returns {{before:number, after:number, gained:number, stopped:boolean}}
   */
  static applyEnergy(u, delta, opts = {}) {
    const max = u?.energy_max || CONFIG.ENERGY_MAX;
    const before = Math.max(0, Number(u?.energy || 0));
    const afterRaw = before + Number(delta || 0);
    const after = Math.min(max, Math.max(0, afterRaw));
    u.energy = after;

    let stopped = false;
    if (opts.autoStopRest && u?.rest?.active && after >= max) {
      u.rest.active = false;
      stopped = true;
    }
    return { before, after, gained: after - before, stopped };
  }
}
