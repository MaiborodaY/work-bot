import { CONFIG } from "./GameConfig.js";

export const DAILY_DEAL_ITEM_IDS = ["coffee", "sandwich", "lunch", "borscht"];
export const DAILY_DEAL_DISCOUNTS = [
  { percent: 10, weight: 25 },
  { percent: 20, weight: 30 },
  { percent: 30, weight: 25 },
  { percent: 40, weight: 15 },
  { percent: 50, weight: 5 }
];

function toInt(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function dayKeyUTC(nowTs = Date.now()) {
  return new Date(nowTs).toISOString().slice(0, 10);
}

function hashString(s) {
  let h = 2166136261;
  const text = String(s || "");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weightedDiscount(seed) {
  const total = DAILY_DEAL_DISCOUNTS.reduce((sum, row) => sum + toInt(row.weight, 0), 0);
  let roll = total > 0 ? hashString(seed) % total : 0;
  for (const row of DAILY_DEAL_DISCOUNTS) {
    roll -= toInt(row.weight, 0);
    if (roll < 0) return toInt(row.percent, 0);
  }
  return 10;
}

export function getDailyShopDeal(nowTs = Date.now()) {
  const day = dayKeyUTC(nowTs);
  const idx = hashString(`${day}:shop:item`) % DAILY_DEAL_ITEM_IDS.length;
  return {
    day,
    itemId: DAILY_DEAL_ITEM_IDS[idx],
    discountPercent: weightedDiscount(`${day}:shop:discount`)
  };
}

export function getShopItemPricing(itemId, nowTs = Date.now()) {
  const key = String(itemId || "").trim();
  const item = CONFIG?.SHOP?.[key] || null;
  const basePrice = Math.max(0, Math.round(Number(item?.price) || 0));
  const deal = getDailyShopDeal(nowTs);
  const isDailyDeal = basePrice > 0 && key === deal.itemId;
  const discountPercent = isDailyDeal ? deal.discountPercent : 0;
  const finalPrice = isDailyDeal
    ? Math.max(1, Math.floor(basePrice * (100 - discountPercent) / 100))
    : basePrice;
  return {
    itemId: key,
    basePrice,
    finalPrice,
    isDailyDeal,
    discountPercent,
    deal
  };
}
