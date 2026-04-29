import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../GameConfig.js";
import { UiFactory } from "../UiFactory.js";
import { DAILY_DEAL_DISCOUNTS, DAILY_DEAL_ITEM_IDS, getDailyShopDeal, getShopItemPricing } from "../ShopPricingService.js";

const TEST_NOW = Date.UTC(2026, 3, 29, 12, 0, 0);

test("shop pricing: base food prices and energy values match balance table", () => {
  assert.equal(CONFIG.SHOP.coffee.price, 100);
  assert.equal(CONFIG.SHOP.coffee.heal, 10);
  assert.equal(CONFIG.SHOP.sandwich.price, 220);
  assert.equal(CONFIG.SHOP.sandwich.heal, 25);
  assert.equal(CONFIG.SHOP.lunch.price, 400);
  assert.equal(CONFIG.SHOP.lunch.heal, 50);
  assert.equal(CONFIG.SHOP.borscht.price, 600);
  assert.equal(CONFIG.SHOP.borscht.heal, 80);
});

test("shop pricing: daily deal is stable for the same UTC day", () => {
  const a = getDailyShopDeal(TEST_NOW);
  const b = getDailyShopDeal(TEST_NOW + 6 * 60 * 60_000);

  assert.deepEqual(a, b);
  assert.ok(DAILY_DEAL_ITEM_IDS.includes(a.itemId));
  assert.ok(DAILY_DEAL_DISCOUNTS.some((row) => row.percent === a.discountPercent));
});

test("shop pricing: deal item receives discount and other items keep base price", () => {
  const deal = getDailyShopDeal(TEST_NOW);
  const dealPricing = getShopItemPricing(deal.itemId, TEST_NOW);
  const regularId = DAILY_DEAL_ITEM_IDS.find((id) => id !== deal.itemId);
  const regularPricing = getShopItemPricing(regularId, TEST_NOW);

  assert.equal(dealPricing.isDailyDeal, true);
  assert.equal(dealPricing.discountPercent, deal.discountPercent);
  assert.equal(dealPricing.finalPrice, Math.floor(dealPricing.basePrice * (100 - deal.discountPercent) / 100));
  assert.equal(regularPricing.isDailyDeal, false);
  assert.equal(regularPricing.finalPrice, regularPricing.basePrice);
});

test("shop ui: daily deal is shown in caption and item button", () => {
  const ui = new UiFactory();
  const user = {
    lang: "ru",
    settings: { shopBuyMode: "buy" },
    achievements: { progress: { totalEarned: 10_000_000 } }
  };
  const deal = getDailyShopDeal(TEST_NOW);
  const caption = ui.shopDailyDealCaption("en", TEST_NOW);
  const buttons = ui.shop({ user, now: TEST_NOW }, "en").flat();
  const dealButton = buttons.find((btn) => String(btn.callback_data || "") === `buy_${deal.itemId}`);

  assert.match(caption, /Deal of the day/i);
  assert.match(caption, new RegExp(`-${deal.discountPercent}%`));
  assert.ok(dealButton);
  assert.match(String(dealButton.text || ""), /🔥/);
  assert.match(String(dealButton.text || ""), new RegExp(`-${deal.discountPercent}%`));
});
