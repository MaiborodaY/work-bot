import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBusinessClaim,
  getBusinessAvailableToday,
  getTodayUTC,
  normalizeBusinessEntry
} from "../BusinessPayout.js";

test("business payout: available today subtracts stolen amount for same UTC day", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    stolenDayUTC: today,
    stolenAmountToday: 120
  }, "shawarma");

  const available = getBusinessAvailableToday(entry, 500, today);
  assert.equal(available, 380);
});

test("business payout: stolen amount from previous day does not affect current day", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    stolenDayUTC: "2026-03-10",
    stolenAmountToday: 120
  }, "shawarma");

  const available = getBusinessAvailableToday(entry, 500, today);
  assert.equal(available, 500);
});

test("business payout: claim applies available reward and resets stolen fields", () => {
  const today = "2026-03-11";
  const entry = normalizeBusinessEntry({
    id: "shawarma",
    lastClaimDayUTC: "",
    stolenDayUTC: today,
    stolenAmountToday: 200
  }, "shawarma");

  const reward = applyBusinessClaim(entry, 500, today);
  assert.equal(reward, 300);
  assert.equal(entry.lastClaimDayUTC, today);
  assert.equal(entry.stolenDayUTC, today);
  assert.equal(entry.stolenAmountToday, 0);
});

test("business payout: getTodayUTC returns YYYY-MM-DD", () => {
  const day = getTodayUTC(Date.UTC(2026, 2, 11, 15, 10, 0));
  assert.equal(day, "2026-03-11");
});

