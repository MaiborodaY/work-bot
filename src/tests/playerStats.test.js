import test from "node:test";
import assert from "node:assert/strict";
import {
  ensurePlayerStatsShape,
  hasActivityOnDay,
  markFunnelStep,
  markUsefulActivity
} from "../PlayerStats.js";

test("ensurePlayerStatsShape fills retention and funnel fields", () => {
  const u = { id: "u1", stats: { dailyTop1Count: 1 } };
  const changed = ensurePlayerStatsShape(u);
  assert.equal(changed, true);
  assert.equal(typeof u.stats.firstActiveDay, "string");
  assert.equal(typeof u.stats.lastActiveDay, "string");
  assert.ok(Array.isArray(u.stats.activeDays));
  assert.equal(typeof u.stats.didFirstShift, "boolean");
  assert.equal(typeof u.stats.didFirstClaim, "boolean");
  assert.equal(typeof u.stats.didGym, "boolean");
  assert.equal(typeof u.stats.didBar, "boolean");
  assert.equal(typeof u.stats.didBusiness, "boolean");
  assert.equal(typeof u.stats.newbie, "object");
  assert.equal(typeof u.stats.newbie.openedDay, "string");
  assert.equal(typeof u.stats.newbie.completedDay, "string");
  assert.equal(typeof u.stats.newbie.lastStepSeenDay, "string");
  assert.equal(typeof u.stats.newbie.lastStepClaimedDay, "string");
  assert.equal(typeof u.stats.newbie.maxStepSeen, "number");
  assert.equal(typeof u.stats.newbie.maxStepClaimed, "number");
  assert.equal(typeof u.stats.newbie.stepsSeen, "object");
  assert.equal(typeof u.stats.newbie.stepsClaimed, "object");
  assert.equal(typeof u.stats.newbie.stepsSeen["1"], "string");
  assert.equal(typeof u.stats.newbie.stepsClaimed["10"], "string");
});

test("markUsefulActivity sets firstActiveDay from createdAt and appends active day", () => {
  const u = {
    id: "u2",
    createdAt: Date.UTC(2026, 2, 10, 9, 0, 0),
    stats: {}
  };
  const nowTs = Date.UTC(2026, 2, 12, 12, 0, 0);
  const changed = markUsefulActivity(u, nowTs);
  assert.equal(changed, true);
  assert.equal(u.stats.firstActiveDay, "2026-03-10");
  assert.equal(u.stats.lastActiveDay, "2026-03-12");
  assert.ok(u.stats.activeDays.includes("2026-03-12"));
});

test("markUsefulActivity is idempotent on same day", () => {
  const u = {
    id: "u3",
    stats: {
      dailyTop1Count: 0,
      dailyTop3Count: 0,
      dailyTop10Count: 0,
      firstActiveDay: "2026-03-12",
      lastActiveDay: "2026-03-12",
      activeDays: ["2026-03-12"],
      didFirstShift: false,
      didFirstClaim: false,
      didGym: false,
      didBar: false,
      didBusiness: false,
      farmHarvestCount: 0,
      farmMoneyTotal: 0,
      farmMoneyWeek: 0,
      bizClaimDayTotal: 0,
      gquizDayEarned: 0,
      labourDayMoney: 0,
      labourDayGems: 0,
      farmWeekKey: "",
      bizClaimDayKey: "",
      gquizDayKey: "",
      labourDayKey: "",
      farmIncomeDays: [],
      newbie: {
        openedDay: "",
        completedDay: "",
        lastStepSeenDay: "",
        lastStepClaimedDay: "",
        maxStepSeen: 0,
        maxStepClaimed: 0,
        stepsSeen: { "1": "", "2": "", "3": "", "4": "", "5": "", "6": "", "7": "", "8": "", "9": "", "10": "" },
        stepsClaimed: { "1": "", "2": "", "3": "", "4": "", "5": "", "6": "", "7": "", "8": "", "9": "", "10": "" }
      }
    }
  };
  const nowTs = Date.UTC(2026, 2, 12, 18, 0, 0);
  const changed = markUsefulActivity(u, nowTs);
  assert.equal(changed, false);
});

test("markFunnelStep sets flag only once", () => {
  const u = { id: "u4", stats: {} };
  const first = markFunnelStep(u, "didBar");
  const second = markFunnelStep(u, "didBar");
  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(u.stats.didBar, true);
});

test("hasActivityOnDay reads activeDays and falls back to lastActiveDay", () => {
  const u = {
    id: "u5",
    stats: {
      activeDays: ["2026-03-10"],
      lastActiveDay: "2026-03-11"
    }
  };
  assert.equal(hasActivityOnDay(u, "2026-03-10"), true);
  assert.equal(hasActivityOnDay(u, "2026-03-11"), true);
  assert.equal(hasActivityOnDay(u, "2026-03-12"), false);
});
