import test from "node:test";
import assert from "node:assert/strict";
import { QuestService } from "../QuestService.js";
import { CONFIG } from "../GameConfig.js";

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
    flags: {
      onboarding: false,
      onboardingDone: true,
      subBonusClaimed: true,
      petBuyGuideClaimed: false,
      firstBizGuideClaimed: false,
      studyLevel5GuideClaimed: false,
      clanJoinGuideClaimed: false
    },
    money: 0,
    premium: 0,
    bonus: { last: "", streak: 0 },
    rest: { active: false, last: 0 },
    study: { level: 0, active: false },
    biz: {
      owned: withBusiness
        ? [{ id: "shawarma", boughtAt: 0, lastClaimDayUTC: "" }]
        : []
    },
    stocks: { holdings: {} },
    thief: { level: 1 },
    pet: null,
    achievements: { progress: { totalShifts: 0 } },
    gym: { level: 0, active: false, startAt: 0 },
    energy_max: 20,
    newbiePath: { step: 1, pending: false, completed: false, ctx: null, updatedAt: 0 },
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

test("newbie tasks view: starts from daily bonus with bar navigation and no next-step block", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const view = await qs.buildBarNewbieTasksView(u);
  const text = String(view?.caption || "");

  assert.equal(Array.isArray(view.keyboard), true);
  assert.equal(view.keyboard.length, 2);
  assert.equal(/\u{1F512}/u.test(text), false);
  assert.equal(view.keyboard[0]?.[0]?.callback_data, "bar:newbie:go:Bar");
  assert.equal(typeof u.newbiePath.ctx, "object");
});

test("newbie path: daily bonus completion becomes pending after claim", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.bonus.last = "2026-03-13";

  const changed = qs.maybeCompleteNewbieStep(u);

  assert.equal(changed, true);
  assert.equal(u.newbiePath.pending, true);
});

test("newbie path: claiming step reward advances to next step and stores context", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.newbiePath.pending = true;

  const res = qs.claimNewbieStep(u);

  assert.equal(res.ok, true);
  assert.equal(u.money, 300);
  assert.equal(u.newbiePath.step, 2);
  assert.equal(u.newbiePath.pending, false);
  assert.equal(typeof u.newbiePath.ctx, "object");
  assert.equal(u.newbiePath.ctx.totalShiftsStart, 0);
});

test("newbie path: work step completes on new job start without waiting for payout", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.newbiePath = {
    step: 2,
    pending: false,
    completed: false,
    ctx: { startedAt: Date.UTC(2026, 2, 13, 11, 0, 0), totalShiftsStart: 0, gymLevelStart: 0 },
    updatedAt: 0
  };
  u.jobs = { active: [{ startAt: Date.UTC(2026, 2, 13, 11, 30, 0) }] };

  const changed = qs.maybeCompleteNewbieStep(u);

  assert.equal(changed, true);
  assert.equal(u.newbiePath.pending, true);
});

test("newbie path: missing ctx is restored for current step before checks", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.newbiePath = { step: 2, pending: false, completed: false, ctx: null, updatedAt: 0 };

  const changed = qs._ensureNewbiePathModel(u);

  assert.equal(changed, true);
  assert.equal(typeof u.newbiePath.ctx, "object");
  assert.equal(u.newbiePath.ctx.totalShiftsStart, 0);
});

test("newbie tasks view: pending state shows claim button", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.newbiePath.pending = true;

  const view = await qs.buildBarNewbieTasksView(u);
  const text = String(view?.caption || "");

  assert.match(text, /Задание выполнено/);
  assert.equal(view.keyboard[0]?.[0]?.callback_data, "bar:newbie:claim");
});

test("newbie path: completed state renders final screen", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.newbiePath = { step: 9, pending: false, completed: true, ctx: null, updatedAt: 0 };

  const view = await qs.buildBarNewbieTasksView(u);
  const text = String(view?.caption || "");

  assert.match(text, /Путь новичка пройден/);
  assert.equal(view.keyboard[0]?.[0]?.callback_data, "bar:tasks");
});

test("legacy special rewards stay disabled for pet_buy", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const res = await qs.onEvent(u, "pet_buy", { type: "dog" }, { persist: false, notify: false });

  assert.equal(u.money, 0);
  assert.equal(Array.isArray(res.events), true);
  assert.equal(res.events.some((ev) => ev.id === "pet_buy_first"), false);
});

test("legacy special rewards stay disabled for study level 5", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const res = await qs.onEvent(u, "study_finish", { level: 5 }, { persist: false, notify: false });

  assert.equal(u.money, 0);
  assert.equal(u.premium, 0);
  assert.equal(Array.isArray(res.events), true);
  assert.equal(res.events.some((ev) => ev.id === "study_level_5"), false);
});

test("stocks_buy3 progress uses holdings count, not binary flag", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  await qs.ensureCycles(u, { persist: false });
  u.quests.daily.list = [
    {
      id: "stocks_buy3",
      type: "daily",
      category: "stocks",
      difficulty: "hard",
      rewardMoney: 700,
      target: 3,
      progress: 0,
      done: false,
      paid: false
    }
  ];

  const res = await qs.onEvent(u, "stocks_buy", { holdingsCount: 3, cost: 100, portfolioValue: 1000 }, { persist: false, notify: false });

  assert.equal(u.quests.daily.list[0].progress, 3);
  assert.equal(u.quests.daily.list[0].done, true);
  assert.ok(res.events.some((ev) => ev.id === "stocks_buy3"));
});

test("stocks_buy3 stale counter is recovered from current holdings on cycle ensure", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.stocks.holdings = {
    shawarma: { shares: 1, avgPrice: 100 },
    dent: { shares: 1, avgPrice: 180 },
    fitlife: { shares: 1, avgPrice: 220 }
  };
  u.quests.daily.day = "2026-03-13";
  u.quests.daily.list = [
    {
      id: "stocks_buy3",
      type: "daily",
      category: "stocks",
      difficulty: "hard",
      rewardMoney: 700,
      target: 3,
      progress: 0,
      done: false,
      paid: false
    }
  ];
  u.quests.daily.counters.stocksHoldings3 = 0;

  await qs.ensureCycles(u, { persist: false });

  assert.equal(u.quests.daily.list[0].progress, 3);
  assert.equal(u.quests.daily.list[0].done, true);
});

test("weekly generation: always includes exactly one farm weekly quest and total is 3", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  await qs.ensureCycles(u, { persist: false });

  const weekly = Array.isArray(u?.quests?.weekly?.list) ? u.quests.weekly.list : [];
  assert.equal(weekly.length, 3);
  const farmCount = weekly.filter((q) => String(q?.category || "") === "farm").length;
  assert.equal(farmCount, 1);
});

test("weekly farm planting quest progresses on farm_plant events", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  await qs.ensureCycles(u, { persist: false });
  u.quests.weekly.list = [
    {
      id: "w_farm_plant_seeds",
      type: "weekly",
      category: "farm",
      difficulty: "medium",
      rewardMoney: 500,
      target: 2,
      progress: 0,
      done: false,
      paid: false
    }
  ];

  await qs.onEvent(u, "farm_plant", { cropId: "carrot" }, { persist: false, notify: false });
  assert.equal(u.quests.weekly.list[0].progress, 1);
  assert.equal(u.quests.weekly.list[0].done, false);

  await qs.onEvent(u, "farm_plant", { cropId: "tomato" }, { persist: false, notify: false });
  assert.equal(u.quests.weekly.list[0].progress, 2);
  assert.equal(u.quests.weekly.list[0].done, true);
  assert.equal(u.money, 500);
});

test("weekly colosseum quest: progresses on colosseum_battle_played events", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.energy_max = 50;
  await qs.ensureCycles(u, { persist: false });
  u.quests.weekly.list = [
    {
      id: "w_colosseum_10battles",
      type: "weekly",
      category: "colosseum",
      difficulty: "hard",
      rewardMoney: 900,
      target: 2,
      progress: 0,
      done: false,
      paid: false
    }
  ];

  await qs.onEvent(u, "colosseum_battle_played", {}, { persist: false, notify: false });
  assert.equal(u.quests.weekly.list[0].progress, 1);
  assert.equal(u.quests.weekly.list[0].done, false);

  await qs.onEvent(u, "colosseum_battle_played", {}, { persist: false, notify: false });
  assert.equal(u.quests.weekly.list[0].progress, 2);
  assert.equal(u.quests.weekly.list[0].done, true);
  assert.equal(u.money, 900);
});

test("daily generation: colosseum quest is not forced when arena is unlocked", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.energy_max = 50;

  const forced = qs._forcedDailyQuestIds(u);
  assert.deepEqual(forced, []);
});

test("daily generation: colosseum quest is hidden when arena is locked", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.energy_max = 49;

  await qs.ensureCycles(u, { persist: false });

  const daily = Array.isArray(u?.quests?.daily?.list) ? u.quests.daily.list : [];
  assert.equal(daily.some((q) => String(q?.id || "") === "colosseum_battles_5"), false);
});

test("weekly quest availability: w_colosseum_10battles requires unlocked arena", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  u.energy_max = 49;
  assert.equal(qs._weeklyQuestAvailable(u, "w_colosseum_10battles"), false);

  u.energy_max = 50;
  assert.equal(qs._weeklyQuestAvailable(u, "w_colosseum_10battles"), true);
});

test("daily colosseum quest: completes from battlesToday for current UTC day (target 3)", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.quests.daily.day = "2026-03-13";
  u.quests.daily.list = [
    {
      id: "colosseum_battles_5",
      type: "daily",
      category: "colosseum",
      difficulty: "hard",
      rewardMoney: 500,
      target: 3,
      progress: 0,
      done: false,
      paid: false
    }
  ];
  u.colosseum = { dayKey: "2026-03-13", battlesToday: 3 };

  const res = await qs.onEvent(u, "sub_bonus_claim", {}, { persist: false, notify: false });

  assert.equal(u.quests.daily.list[0].progress, 3);
  assert.equal(u.quests.daily.list[0].done, true);
  assert.equal(u.money, 500);
  assert.ok(Array.isArray(res.events));
});

test("weekly quest availability: w_biz_expand is hidden when all businesses and all slots are already bought", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.biz.owned = Object.keys(CONFIG.BUSINESS || {}).map((bizId) => {
    const levelDefs = CONFIG?.LABOUR_MARKET?.SLOTS?.[bizId]?.levels;
    const slotsLen = Array.isArray(levelDefs) && levelDefs.length > 0 ? levelDefs.length : 1;
    return {
      id: bizId,
      boughtAt: 0,
      lastClaimDayUTC: "",
      slots: Array.from({ length: slotsLen }, () => ({ purchased: true }))
    };
  });

  assert.equal(qs._weeklyQuestAvailable(u, "w_biz_expand"), false);
});

test("weekly quest availability: w_biz_expand stays available when at least one slot is not bought", () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.biz.owned = Object.keys(CONFIG.BUSINESS || {}).map((bizId) => {
    const levelDefs = CONFIG?.LABOUR_MARKET?.SLOTS?.[bizId]?.levels;
    const slotsLen = Array.isArray(levelDefs) && levelDefs.length > 0 ? levelDefs.length : 1;
    const slots = Array.from({ length: slotsLen }, () => ({ purchased: true }));
    return {
      id: bizId,
      boughtAt: 0,
      lastClaimDayUTC: "",
      slots
    };
  });

  if (u.biz.owned[0] && Array.isArray(u.biz.owned[0].slots) && u.biz.owned[0].slots.length > 0) {
    u.biz.owned[0].slots[u.biz.owned[0].slots.length - 1].purchased = false;
  }

  assert.equal(qs._weeklyQuestAvailable(u, "w_biz_expand"), true);
});
