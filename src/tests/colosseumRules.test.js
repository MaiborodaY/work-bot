import test from "node:test";
import assert from "node:assert/strict";

let rules = null;
try {
  rules = await import("../ColosseumRules.js");
} catch {
  rules = null;
}

if (!rules) {
  test.todo("colosseum rules module exists (ColosseumRules.js)");
  test.todo("daily limit is checked before queue join");
  test.todo("daily limit is checked again before battle start");
  test.todo("defense zone cannot be the same as attack zone");
  test.todo("queue is reset at 00:00 UTC");
  test.todo("weekly wins are reset lazily by weekKey mismatch");
  test.todo("battle finish clears activeBattleId and inQueue for both players");
} else {
  const {
    canQueueByDailyLimit,
    canStartByDailyLimit,
    isRoundSelectionValid,
    nextDefenseZones,
    shouldResetQueueAtMidnight,
    applyWeeklyKeyReset,
    clearBattleStateOnFinish
  } = rules;

  test("colosseum: daily limit blocks queue join at 10/10", () => {
    const u = { colosseum: { dayKey: "2026-03-30", battlesToday: 10 } };
    assert.equal(canQueueByDailyLimit(u, "2026-03-30", 10), false);
  });

  test("colosseum: daily limit allows queue join below 10", () => {
    const u = { colosseum: { dayKey: "2026-03-30", battlesToday: 9 } };
    assert.equal(canQueueByDailyLimit(u, "2026-03-30", 10), true);
  });

  test("colosseum: daily limit blocks battle start at 10/10", () => {
    const u = { colosseum: { dayKey: "2026-03-30", battlesToday: 10 } };
    assert.equal(canStartByDailyLimit(u, "2026-03-30", 10), false);
  });

  test("colosseum: same attack/defense zone is invalid", () => {
    assert.equal(isRoundSelectionValid("head", "head"), false);
    assert.equal(isRoundSelectionValid("body", "body"), false);
    assert.equal(isRoundSelectionValid("legs", "legs"), false);
  });

  test("colosseum: defense options hide selected attack zone", () => {
    assert.deepEqual(nextDefenseZones("head"), ["body", "legs"]);
    assert.deepEqual(nextDefenseZones("body"), ["head", "legs"]);
    assert.deepEqual(nextDefenseZones("legs"), ["head", "body"]);
  });

  test("colosseum: queue reset happens on day change at 00:00 UTC", () => {
    assert.equal(shouldResetQueueAtMidnight("2026-03-29", "2026-03-30"), true);
    assert.equal(shouldResetQueueAtMidnight("2026-03-30", "2026-03-30"), false);
  });

  test("colosseum: week wins are lazily reset by weekKey mismatch", () => {
    const u = { colosseum: { weekKey: "202613", weekWins: 7 } };
    const changed = applyWeeklyKeyReset(u, "202614");
    assert.equal(changed, true);
    assert.equal(u.colosseum.weekKey, "202614");
    assert.equal(u.colosseum.weekWins, 0);
  });

  test("colosseum: finish clears activeBattleId and queue flag", () => {
    const p1 = { colosseum: { activeBattleId: "b1", inQueue: true } };
    const p2 = { colosseum: { activeBattleId: "b1", inQueue: true } };
    clearBattleStateOnFinish(p1);
    clearBattleStateOnFinish(p2);
    assert.equal(p1.colosseum.activeBattleId, "");
    assert.equal(p2.colosseum.activeBattleId, "");
    assert.equal(p1.colosseum.inQueue, false);
    assert.equal(p2.colosseum.inQueue, false);
  });
}

