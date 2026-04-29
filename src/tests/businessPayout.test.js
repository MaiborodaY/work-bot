import test from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessPendingTheft,
  applyBusinessClaim,
  getBusinessClaimMultiplier,
  getBusinessAvailableToday,
  getBusinessStealableForNextClaim,
  getTodayUTC,
  normalizeBusinessEntry
} from "../BusinessPayout.js";

test("business payout: available today subtracts pending theft for next claim", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    pendingTheftAmount: 120
  }, "shawarma");

  const available = getBusinessAvailableToday(entry, 1000, today);
  assert.equal(available, 880);
});

test("business payout: stealable amount respects owner minimum remain percent", () => {
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    pendingTheftAmount: 140
  }, "shawarma");
  const stealable = getBusinessStealableForNextClaim(entry, 1000, 0.5);
  // daily 1000, owner must keep at least 500, pending 140 => stealable 360
  assert.equal(stealable, 360);
});

test("business payout: pending theft add is capped to owner protection budget", () => {
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    pendingTheftAmount: 200
  }, "shawarma");

  const applied = addBusinessPendingTheft(entry, 1000, 400, 0.5);
  // max pending for 50% owner protection is 500
  assert.equal(applied, 300);
  assert.equal(entry.pendingTheftAmount, 500);
});

test("business payout: claim applies available reward and resets pending theft", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    pendingTheftAmount: 200
  }, "shawarma");

  const reward = applyBusinessClaim(entry, 1000, today);
  assert.equal(reward, 800);
  assert.equal(entry.lastClaimDayUTC, today);
  assert.equal(entry.pendingTheftAmount, 0);
});

test("business payout: supply multiplier boosts next claim and is consumed", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    pendingTheftAmount: 100,
    supply: {
      unlocked: true,
      slots: 1,
      pendingMultiplier: 2,
      pendingBonusDayUTC: today
    }
  }, "shawarma");

  assert.equal(getBusinessClaimMultiplier(entry, today), 2);
  assert.equal(getBusinessAvailableToday(entry, 1000, today), 1800);

  const reward = applyBusinessClaim(entry, 1000, today);
  assert.equal(reward, 1800);
  assert.equal(entry.lastClaimDayUTC, today);
  assert.equal(entry.pendingTheftAmount, 0);
  assert.equal(entry.supply.pendingMultiplier, 0);
  assert.equal(entry.supply.pendingBonusDayUTC, "");
});

test("business payout: getTodayUTC returns YYYY-MM-DD", () => {
  const day = getTodayUTC(Date.UTC(2026, 2, 11, 15, 10, 0));
  assert.equal(day, "2026-03-11");
});
