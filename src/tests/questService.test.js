import test from "node:test";
import assert from "node:assert/strict";
import { QuestService } from "../QuestService.js";

function makeService() {
  return new QuestService({
    users: { async save() {} },
    now: () => Date.UTC(2026, 2, 13, 12, 0, 0),
    bot: null
  });
}

function makeUser({ withBusiness = false } = {}) {
  return {
    id: withBusiness ? "u-mid" : "u-new",
    lang: "ru",
    flags: { subBonusClaimed: true },
    biz: {
      owned: withBusiness
        ? [{ id: "shawarma", boughtAt: 0, lastClaimDayUTC: "" }]
        : []
    },
    stocks: { holdings: {} },
    thief: { level: 1 },
    gym: { level: 0, active: false },
    energy_max: 20,
    quests: {
      daily: { day: "", list: [], bonusPaid: false, counters: {} },
      weekly: { week: "", list: [], bonusPaid: false, counters: {}, bizStreakCurrent: 0, lastBizClaimDay: "" }
    }
  };
}

test("quest targets: newbie with 0 businesses gets soft weekly stocks invest target", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  const target = qs._resolveTarget(u, "w_stocks_invest", 50000);
  const reward = qs._resolveRewardMoney(u, { rewardMoney: 7000 });

  assert.equal(target, 5000);
  assert.equal(reward, 5950);
});

test("quest targets: user with business keeps standard weekly stocks invest target", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: true });
  const target = qs._resolveTarget(u, "w_stocks_invest", 50000);
  const reward = qs._resolveRewardMoney(u, { rewardMoney: 7000 });

  assert.equal(target, 50000);
  assert.equal(reward, 7000);
});

test("bar tasks view: does not render refresh button", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const view = await qs.buildBarTasksView(u);
  assert.ok(Array.isArray(view.keyboard));
  assert.equal(view.keyboard.length, 1);
  assert.equal(view.keyboard[0]?.[0]?.callback_data, "go:Bar");
});

