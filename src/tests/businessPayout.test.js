import test from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessPendingTheft,
  applyBusinessClaim,
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

  const available = getBusinessAvailableToday(entry, 500, today);
  assert.equal(available, 380);
});

test("business payout: stealable amount respects owner minimum remain percent", () => {
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    pendingTheftAmount: 140
  }, "shawarma");
  const stealable = getBusinessStealableForNextClaim(entry, 500, 0.5);
  // daily 500, owner must keep at least 250, pending 140 => stealable 110
  assert.equal(stealable, 110);
});

test("business payout: pending theft add is capped to owner protection budget", () => {
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    pendingTheftAmount: 200
  }, "shawarma");

  const applied = addBusinessPendingTheft(entry, 500, 100, 0.5);
  // max pending for 50% owner protection is 250
  assert.equal(applied, 50);
  assert.equal(entry.pendingTheftAmount, 250);
});

test("business payout: claim applies available reward and resets pending theft", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    pendingTheftAmount: 200
  }, "shawarma");

  const reward = applyBusinessClaim(entry, 500, today);
  assert.equal(reward, 300);
  assert.equal(entry.lastClaimDayUTC, today);
  assert.equal(entry.pendingTheftAmount, 0);
});

test("business payout: getTodayUTC returns YYYY-MM-DD", () => {
  const day = getTodayUTC(Date.UTC(2026, 2, 11, 15, 10, 0));
  assert.equal(day, "2026-03-11");
});
