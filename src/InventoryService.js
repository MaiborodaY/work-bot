import { CONFIG } from "./GameConfig.js";
import { HomeService } from "./HomeService.js";
import { EnergyService } from "./EnergyService.js";

const USABLE_ITEM_IDS = ["coffee", "sandwich", "lunch", "borscht"];
const MATERIAL_ITEM_IDS = ["mango_seed", "fertilizer"];

function toInt(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export class InventoryService {
  static ensure(u) {
    if (!u || typeof u !== "object") return;
    if (!u.inv || typeof u.inv !== "object") u.inv = {};
  }

  static count(u, itemId) {
    this.ensure(u);
    return toInt(u?.inv?.[String(itemId || "")], 0);
  }

  static has(u, itemId, qty = 1) {
    return this.count(u, itemId) >= Math.max(1, toInt(qty, 1));
  }

  static add(u, itemId, qty = 1) {
    this.ensure(u);
    const key = String(itemId || "").trim();
    if (!key) return 0;
    const next = this.count(u, key) + Math.max(1, toInt(qty, 1));
    u.inv[key] = next;
    return next;
  }

  static remove(u, itemId, qty = 1) {
    this.ensure(u);
    const key = String(itemId || "").trim();
    if (!key) return 0;
    const next = Math.max(0, this.count(u, key) - Math.max(1, toInt(qty, 1)));
    if (next > 0) u.inv[key] = next;
    else delete u.inv[key];
    return next;
  }

  static isUsable(itemId) {
    return USABLE_ITEM_IDS.includes(String(itemId || "").trim());
  }

  static isMaterial(itemId) {
    return MATERIAL_ITEM_IDS.includes(String(itemId || "").trim());
  }

  static itemConfig(itemId) {
    const key = String(itemId || "").trim();
    return CONFIG?.SHOP?.[key] || null;
  }

  static usableItems(u) {
    this.ensure(u);
    return USABLE_ITEM_IDS
      .map((id) => ({ id, qty: this.count(u, id), cfg: this.itemConfig(id) }))
      .filter((item) => item.qty > 0 && item.cfg && typeof item.cfg.heal === "number");
  }

  static materialItems(u) {
    this.ensure(u);
    return MATERIAL_ITEM_IDS
      .map((id) => ({ id, qty: this.count(u, id) }))
      .filter((item) => item.qty > 0);
  }

  static visibleItems(u) {
    return [...this.usableItems(u), ...this.materialItems(u)];
  }

  static use(u, itemId) {
    this.ensure(u);
    const key = String(itemId || "").trim();
    if (!this.isUsable(key)) {
      return { ok: false, code: "not_usable" };
    }
    if (!this.has(u, key, 1)) {
      return { ok: false, code: "not_found" };
    }
    const it = this.itemConfig(key);
    if (!it || typeof it.heal !== "number") {
      return { ok: false, code: "not_usable" };
    }

    const max = EnergyService.effectiveEnergyMax(u);
    const current = toInt(u?.energy, 0);
    if (current >= max) {
      return { ok: false, code: "full_energy" };
    }

    const res = HomeService.applyEnergy(u, it.heal, { autoStopRest: true });
    this.remove(u, key, 1);
    return {
      ok: true,
      itemId: key,
      heal: toInt(it.heal, 0),
      energy: toInt(u?.energy, 0),
      energyMax: max,
      stopped: !!res?.stopped,
    };
  }
}
