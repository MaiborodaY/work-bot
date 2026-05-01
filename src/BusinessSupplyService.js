import { CONFIG } from "./GameConfig.js";
import { InventoryService } from "./InventoryService.js";

function toInt(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function normalizeDay(raw) {
  const value = String(raw || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function addUTCDays(dayRaw, delta) {
  const day = normalizeDay(dayRaw);
  if (!day) return "";
  const ts = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts + (Math.trunc(Number(delta) || 0) * 86_400_000)).toISOString().slice(0, 10);
}

function cleanRecipe(recipe) {
  const out = {};
  if (!recipe || typeof recipe !== "object") return out;
  for (const [itemId, qtyRaw] of Object.entries(recipe)) {
    const key = String(itemId || "").trim();
    const qty = toInt(qtyRaw, 0);
    if (key && qty > 0) out[key] = qty;
  }
  return out;
}

export class BusinessSupplyService {
  static config(bizId) {
    const id = String(bizId || "").trim();
    const cfg = CONFIG?.BUSINESS_SUPPLY?.[id] || null;
    return cfg && cfg.enabled ? cfg : null;
  }

  static normalize(entry, bizId = "", todayUTC = "") {
    const target = (entry && typeof entry === "object") ? entry : {};
    const id = String(bizId || target?.id || "").trim();
    const cfg = this.config(id);
    const raw = (target.supply && typeof target.supply === "object") ? target.supply : {};

    const maxSlots = Math.max(1, toInt(cfg?.maxSlots, 1));
    const slots = Math.max(1, Math.min(maxSlots, toInt(raw.slots, 1)));
    const lastOrderDayUTC = normalizeDay(raw.lastOrderDayUTC);
    const pendingBonusDayUTC = normalizeDay(raw.pendingBonusDayUTC);

    target.supply = {
      unlocked: !!raw.unlocked,
      slots,
      progress: toInt(raw.progress, 0),
      lastOrderDayUTC,
      ordersToday: toInt(raw.ordersToday, 0),
      pendingMultiplier: toInt(raw.pendingMultiplier, 0),
      pendingBonusDayUTC
    };

    this.expireDailyState(target, id, todayUTC);
    return target.supply;
  }

  static expireDailyState(entry, bizId = "", todayUTC = "") {
    const supply = (entry?.supply && typeof entry.supply === "object") ? entry.supply : null;
    if (!supply) return null;
    const day = normalizeDay(todayUTC);
    if (!day) return supply;

    if (supply.lastOrderDayUTC && supply.lastOrderDayUTC !== day) {
      supply.ordersToday = 0;
      supply.lastOrderDayUTC = "";
    }

    if (supply.pendingBonusDayUTC && supply.pendingBonusDayUTC < day) {
      supply.pendingMultiplier = 0;
      supply.pendingBonusDayUTC = "";
    }

    void bizId;
    return supply;
  }

  static progressTarget(entry, bizId = "") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    const supply = this.normalize(entry, id);
    const nextSlot = Math.max(1, toInt(supply?.slots, 1)) + 1;
    if (!cfg || nextSlot > toInt(cfg.maxSlots, 1)) return 0;
    return toInt(cfg?.slotProgressTargets?.[nextSlot], 0);
  }

  static slotPrice(entry, bizId = "") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    const supply = this.normalize(entry, id);
    const nextSlot = Math.max(1, toInt(supply?.slots, 1)) + 1;
    if (!cfg || nextSlot > toInt(cfg.maxSlots, 1)) return 0;
    return toInt(cfg?.slotPrices?.[nextSlot], 0);
  }

  static unlock(u, entry, bizId = "shawarma") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    if (!cfg) return { ok: false, code: "unsupported" };
    const supply = this.normalize(entry, id);
    if (supply.unlocked) return { ok: false, code: "already_unlocked" };

    const price = toInt(cfg.unlockPrice, 0);
    const money = toInt(u?.money, 0);
    if (money < price) return { ok: false, code: "not_enough_money", price };

    u.money = money - price;
    supply.unlocked = true;
    supply.slots = Math.max(1, toInt(supply.slots, 1));
    return { ok: true, price, money: u.money, supply };
  }

  static canSubmit(u, entry, bizId = "shawarma", todayUTC = "") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    if (!cfg) return { ok: false, code: "unsupported" };
    const supply = this.normalize(entry, id, todayUTC);
    if (!supply.unlocked) return { ok: false, code: "locked" };
    if (toInt(supply.ordersToday, 0) >= toInt(supply.slots, 1)) {
      return { ok: false, code: "daily_limit" };
    }

    const recipe = cleanRecipe(cfg.recipe);
    for (const [itemId, qty] of Object.entries(recipe)) {
      if (!InventoryService.has(u, itemId, qty)) {
        return { ok: false, code: "missing_ingredients" };
      }
    }

    return { ok: true, recipe, supply };
  }

  static submitOrder(u, entry, bizId = "shawarma", todayUTC = "") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    if (!cfg) return { ok: false, code: "unsupported" };
    const check = this.canSubmit(u, entry, id, todayUTC);
    if (!check.ok) return check;

    const day = normalizeDay(todayUTC);
    const supply = this.normalize(entry, id, day);
    const recipe = check.recipe || cleanRecipe(cfg.recipe);
    for (const [itemId, qty] of Object.entries(recipe)) {
      InventoryService.remove(u, itemId, qty);
    }

    const nextOrders = toInt(supply.ordersToday, 0) + 1;
    supply.ordersToday = nextOrders;
    if (day) supply.lastOrderDayUTC = day;
    const multiplier = toInt(cfg?.multipliersByOrders?.[nextOrders], 1);
    supply.pendingMultiplier = Math.max(1, multiplier);
    if (day) supply.pendingBonusDayUTC = addUTCDays(day, 1);

    const target = this.progressTarget(entry, id);
    const activeSupply = this.normalize(entry, id, day);
    const nextProgress = toInt(supply.progress, 0) + 1;
    activeSupply.progress = target > 0 ? Math.min(target, nextProgress) : nextProgress;

    return {
      ok: true,
      recipe,
      ordersToday: activeSupply.ordersToday,
      multiplier: activeSupply.pendingMultiplier,
      progress: activeSupply.progress,
      progressTarget: target,
      supply: activeSupply
    };
  }

  static claimMultiplier(entry, bizId = "shawarma", todayUTC = "") {
    const id = String(bizId || entry?.id || "").trim();
    const supply = this.normalize(entry, id, todayUTC);
    const day = normalizeDay(todayUTC);
    if (!supply?.unlocked) return 1;
    if (!day || supply.pendingBonusDayUTC !== day) return 1;
    return Math.max(1, toInt(supply.pendingMultiplier, 1));
  }

  static consumeClaimBonus(entry, bizId = "shawarma") {
    const id = String(bizId || entry?.id || "").trim();
    const supply = this.normalize(entry, id);
    supply.pendingMultiplier = 0;
    supply.pendingBonusDayUTC = "";
    return supply;
  }

  static canBuySlot(entry, bizId = "shawarma") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    if (!cfg) return { ok: false, code: "unsupported" };
    const supply = this.normalize(entry, id);
    if (!supply.unlocked) return { ok: false, code: "locked" };
    const maxSlots = Math.max(1, toInt(cfg.maxSlots, 1));
    if (supply.slots >= maxSlots) return { ok: false, code: "max_slots" };
    const target = this.progressTarget(entry, id);
    if (target <= 0 || supply.progress < target) {
      return { ok: false, code: "progress_required", progress: supply.progress, target };
    }
    return { ok: true, price: this.slotPrice(entry, id), nextSlot: supply.slots + 1, target };
  }

  static buySlot(u, entry, bizId = "shawarma") {
    const id = String(bizId || entry?.id || "").trim();
    const check = this.canBuySlot(entry, id);
    if (!check.ok) return check;
    const money = toInt(u?.money, 0);
    const price = toInt(check.price, 0);
    if (money < price) return { ok: false, code: "not_enough_money", price };

    const supply = this.normalize(entry, id);
    u.money = money - price;
    supply.slots = Math.max(1, toInt(supply.slots, 1)) + 1;
    supply.progress = 0;
    return { ok: true, price, money: u.money, slots: supply.slots, supply };
  }

  static buildViewModel(u, entry, bizId = "shawarma", todayUTC = "") {
    const id = String(bizId || entry?.id || "").trim();
    const cfg = this.config(id);
    const supply = this.normalize(entry, id, todayUTC);
    const canSubmit = this.canSubmit(u, entry, id, todayUTC);
    const canBuySlot = this.canBuySlot(entry, id);
    return {
      bizId: id,
      supported: !!cfg,
      unlocked: !!supply?.unlocked,
      slots: toInt(supply?.slots, 1),
      maxSlots: toInt(cfg?.maxSlots, 1),
      recipe: cleanRecipe(cfg?.recipe),
      ordersToday: toInt(supply?.ordersToday, 0),
      multiplier: this.claimMultiplier(entry, id, todayUTC),
      progress: toInt(supply?.progress, 0),
      progressTarget: this.progressTarget(entry, id),
      nextSlotPrice: this.slotPrice(entry, id),
      pendingMultiplier: toInt(supply?.pendingMultiplier, 0),
      pendingBonusDayUTC: normalizeDay(supply?.pendingBonusDayUTC),
      tomorrowUTC: addUTCDays(todayUTC, 1),
      canSubmit: !!canSubmit.ok,
      canBuySlot: !!canBuySlot.ok,
      submitBlockCode: canSubmit.ok ? "" : canSubmit.code,
      slotBlockCode: canBuySlot.ok ? "" : canBuySlot.code
    };
  }
}
