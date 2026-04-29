import test from "node:test";
import assert from "node:assert/strict";
import { BusinessSupplyService } from "../BusinessSupplyService.js";

const today = "2026-04-29";

test("business supply: default shawarma state is locked with one slot", () => {
  const entry = { id: "shawarma" };

  const vm = BusinessSupplyService.buildViewModel({ inv: {} }, entry, "shawarma", today);

  assert.equal(vm.supported, true);
  assert.equal(vm.unlocked, false);
  assert.equal(vm.slots, 1);
  assert.equal(vm.maxSlots, 3);
  assert.deepEqual(vm.recipe, { crop_carrot: 2, crop_tomato: 1 });
  assert.equal(vm.progressTarget, 5);
});

test("business supply: unlock charges configured price", () => {
  const u = { money: 12000 };
  const entry = { id: "shawarma" };

  const res = BusinessSupplyService.unlock(u, entry, "shawarma");

  assert.equal(res.ok, true);
  assert.equal(res.price, 10000);
  assert.equal(u.money, 2000);
  assert.equal(entry.supply.unlocked, true);
});

test("business supply: unlock fails without enough money", () => {
  const u = { money: 9999 };
  const entry = { id: "shawarma" };

  const res = BusinessSupplyService.unlock(u, entry, "shawarma");

  assert.equal(res.ok, false);
  assert.equal(res.code, "not_enough_money");
  assert.equal(u.money, 9999);
  assert.equal(entry.supply.unlocked, false);
});

test("business supply: submit consumes ingredients, sets x2 bonus and adds progress", () => {
  const u = { inv: { crop_carrot: 3, crop_tomato: 1 } };
  const entry = { id: "shawarma", supply: { unlocked: true } };

  const res = BusinessSupplyService.submitOrder(u, entry, "shawarma", today);

  assert.equal(res.ok, true);
  assert.equal(res.multiplier, 2);
  assert.equal(res.progress, 1);
  assert.equal(res.progressTarget, 5);
  assert.deepEqual(u.inv, { crop_carrot: 1 });
  assert.equal(entry.supply.ordersToday, 1);
  assert.equal(entry.supply.pendingMultiplier, 2);
  assert.equal(entry.supply.pendingBonusDayUTC, today);
});

test("business supply: submit fails when locked or ingredients are missing", () => {
  const lockedUser = { inv: { crop_carrot: 2, crop_tomato: 1 } };
  const lockedEntry = { id: "shawarma" };
  assert.equal(BusinessSupplyService.submitOrder(lockedUser, lockedEntry, "shawarma", today).code, "locked");

  const missingUser = { inv: { crop_carrot: 2 } };
  const entry = { id: "shawarma", supply: { unlocked: true } };
  assert.equal(BusinessSupplyService.submitOrder(missingUser, entry, "shawarma", today).code, "missing_ingredients");
  assert.deepEqual(missingUser.inv, { crop_carrot: 2 });
});

test("business supply: one-slot order cannot be repeated on the same day", () => {
  const u = { inv: { crop_carrot: 4, crop_tomato: 2 } };
  const entry = { id: "shawarma", supply: { unlocked: true, slots: 1 } };

  assert.equal(BusinessSupplyService.submitOrder(u, entry, "shawarma", today).ok, true);
  const second = BusinessSupplyService.submitOrder(u, entry, "shawarma", today);

  assert.equal(second.ok, false);
  assert.equal(second.code, "daily_limit");
  assert.deepEqual(u.inv, { crop_carrot: 2, crop_tomato: 1 });
});

test("business supply: pending bonus does not carry over to the next day", () => {
  const entry = {
    id: "shawarma",
    supply: {
      unlocked: true,
      slots: 1,
      lastOrderDayUTC: "2026-04-28",
      ordersToday: 1,
      pendingMultiplier: 2,
      pendingBonusDayUTC: "2026-04-28"
    }
  };

  assert.equal(BusinessSupplyService.claimMultiplier(entry, "shawarma", today), 1);
  assert.equal(entry.supply.ordersToday, 0);
  assert.equal(entry.supply.pendingMultiplier, 0);
  assert.equal(entry.supply.pendingBonusDayUTC, "");
});

test("business supply: progress unlocks slot purchase and slot purchase resets progress", () => {
  const u = { money: 30000 };
  const entry = { id: "shawarma", supply: { unlocked: true, slots: 1, progress: 5 } };

  const canBuy = BusinessSupplyService.canBuySlot(entry, "shawarma");
  assert.equal(canBuy.ok, true);
  assert.equal(canBuy.price, 25000);
  assert.equal(canBuy.nextSlot, 2);

  const bought = BusinessSupplyService.buySlot(u, entry, "shawarma");
  assert.equal(bought.ok, true);
  assert.equal(u.money, 5000);
  assert.equal(entry.supply.slots, 2);
  assert.equal(entry.supply.progress, 0);
  assert.equal(BusinessSupplyService.progressTarget(entry, "shawarma"), 10);
});

test("business supply: multiple slots upgrade multiplier by orders today", () => {
  const u = { inv: { crop_carrot: 6, crop_tomato: 3 } };
  const entry = { id: "shawarma", supply: { unlocked: true, slots: 3 } };

  assert.equal(BusinessSupplyService.submitOrder(u, entry, "shawarma", today).multiplier, 2);
  assert.equal(BusinessSupplyService.submitOrder(u, entry, "shawarma", today).multiplier, 3);
  assert.equal(BusinessSupplyService.submitOrder(u, entry, "shawarma", today).multiplier, 5);

  const fourth = BusinessSupplyService.submitOrder(u, entry, "shawarma", today);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.code, "daily_limit");
  assert.deepEqual(u.inv, {});
});
