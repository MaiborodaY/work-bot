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
    flags: {
      subBonusClaimed: true,
      petBuyGuideClaimed: false,
      firstBizGuideClaimed: false,
      studyLevel5GuideClaimed: false,
      clanJoinGuideClaimed: false
    },
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

test("newbie tasks view: shows study level 5 special quest for newbies", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const view = await qs.buildBarNewbieTasksView(u);
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

test("newbie tasks view: shows clan join special quest when user has no clan", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const view = await qs.buildBarNewbieTasksView(u);
  const text = String(view?.caption || "");

  assert.match(text, /Вступить в клан или создать свой/);
  assert.match(text, /\$(1000|1к|1k)/);
});

test("clan join special quest: awards money once", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const first = await qs.onEvent(u, "clan_join", { clanId: "clan_1" }, { persist: false, notify: false });
  assert.equal(u.flags.clanJoinGuideClaimed, true);
  assert.equal(u.money, 1000);
  assert.ok(first.events.some((ev) => ev.id === "clan_join_first"));

  const second = await qs.onEvent(u, "clan_join", { clanId: "clan_1" }, { persist: false, notify: false });
  assert.equal(u.money, 1000);
  assert.equal(second.events.some((ev) => ev.id === "clan_join_first"), false);
});

test("newbie tasks view: shows pet buy special quest when pet is missing", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.lang = "en";
  u.flags.subBonusClaimed = true;
  u.flags.studyLevel5GuideClaimed = true;
  u.flags.clanJoinGuideClaimed = true;
  u.pet = null;

  const view = await qs.buildBarNewbieTasksView(u);
  const text = String(view?.caption || "");

  assert.match(text, /Buy a pet \(Square -> City -> Home -> Pet\)/);
  assert.match(text, /\$500/);
});

test("pet buy special quest: awards money once and does not repeat", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.flags.petBuyGuideClaimed = false;

  const first = await qs.onEvent(u, "pet_buy", { type: "dog" }, { persist: false, notify: false });
  assert.equal(u.flags.petBuyGuideClaimed, true);
  assert.equal(u.money, 500);
  assert.ok(first.events.some((ev) => ev.id === "pet_buy_first"));

  const second = await qs.onEvent(u, "pet_buy", { type: "cat" }, { persist: false, notify: false });
  assert.equal(u.money, 500);
  assert.equal(second.events.some((ev) => ev.id === "pet_buy_first"), false);
});

test("bar tasks view: hides pet buy special quest for users with existing pet", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.lang = "en";
  u.flags.subBonusClaimed = true;
  u.flags.studyLevel5GuideClaimed = true;
  u.flags.clanJoinGuideClaimed = true;
  u.flags.petBuyGuideClaimed = false;
  u.pet = {
    type: "cat",
    name: "Murka",
    status: "healthy",
    streak: 0,
    lastFedDay: "",
    sickSince: "",
    boughtAt: Date.UTC(2026, 2, 12, 12, 0, 0)
  };

  const view = await qs.buildBarTasksView(u);
  const text = String(view?.caption || "");

  assert.doesNotMatch(text, /Buy a pet \(Square -> City -> Home -> Pet\)/);
});

test("newbie tasks view: shows first business special quest when user has 0 businesses", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });
  u.lang = "en";
  u.flags.subBonusClaimed = true;
  u.flags.petBuyGuideClaimed = true;
  u.flags.studyLevel5GuideClaimed = true;
  u.flags.clanJoinGuideClaimed = true;

  const view = await qs.buildBarNewbieTasksView(u);
  const text = String(view?.caption || "");

  assert.match(text, /Buy your first business \(Square -> Earnings -> Business\)/);
  assert.match(text, /\$(1000|1к|1k)/);
});

test("first business special quest: awards money once on business buy only", async () => {
  const qs = makeService();
  const u = makeUser({ withBusiness: false });

  const slotEvent = await qs.onEvent(u, "biz_expand", { bizId: "shawarma", kind: "slot" }, { persist: false, notify: false });
  assert.equal(u.flags.firstBizGuideClaimed, false);
  assert.equal(u.money, 0);
  assert.equal(slotEvent.events.some((ev) => ev.id === "biz_buy_first"), false);

  const first = await qs.onEvent(u, "biz_expand", { bizId: "shawarma", kind: "business" }, { persist: false, notify: false });
  assert.equal(u.flags.firstBizGuideClaimed, true);
  assert.equal(u.money, 1000);
  assert.ok(first.events.some((ev) => ev.id === "biz_buy_first"));

  const second = await qs.onEvent(u, "biz_expand", { bizId: "dent", kind: "business" }, { persist: false, notify: false });
  assert.equal(u.money, 1000);
  assert.equal(second.events.some((ev) => ev.id === "biz_buy_first"), false);
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
