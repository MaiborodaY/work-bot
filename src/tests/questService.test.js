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
    flags: { subBonusClaimed: true, studyLevel5GuideClaimed: false },
    money: 0,
    premium: 0,
    study: { level: 0, active: false },
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

test("bar tasks view: shows study level 5 special quest for newbies", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const view = await qs.buildBarTasksView(u);
  const text = String(view?.caption || "");

  assert.match(text, /Дойти до 5 уровня учёбы/);
  assert.match(text, /0\/5/);
});

test("study level 5 special quest: auto-awards money and gems once", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const first = await qs.onEvent(u, "study_finish", { level: 5 });
  assert.equal(u.flags.studyLevel5GuideClaimed, true);
  assert.equal(u.money, 800);
  assert.equal(u.premium, 2);
  assert.ok(first.events.some((ev) => ev.id === "study_level_5"));

  const second = await qs.onEvent(u, "study_finish", { level: 5 });
  assert.equal(u.money, 800);
  assert.equal(u.premium, 2);
  assert.equal(second.events.some((ev) => ev.id === "study_level_5"), false);
});
