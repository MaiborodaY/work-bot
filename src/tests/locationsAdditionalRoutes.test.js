import test from "node:test";
import assert from "node:assert/strict";
import { Locations } from "../Locations.js";
import { Routes } from "../Routes.js";

function createLocations({ nowTs = Date.now(), maybeFinishStudy = async () => false } = {}) {
  const mediaCalls = [];

  const media = {
    async show(payload) {
      mediaCalls.push(payload);
    }
  };

  const ui = {
    studyIdle: () => [[{ text: "study-idle", callback_data: "noop" }]],
    studyActive: () => [[{ text: "study-active", callback_data: "noop" }]],
    casinoMenu: () => [[{ text: "casino", callback_data: "noop" }]],
    barTasks: () => [[{ text: "tasks", callback_data: "noop" }]],
    square: () => [[{ text: "square", callback_data: "noop" }]],
    workV2: () => [[{ text: "work", callback_data: "noop" }]],
    cityBoard: () => [[{ text: "board", callback_data: "noop" }]],
    earn: () => [[{ text: "earn", callback_data: "noop" }]],
    progress: () => [[{ text: "progress", callback_data: "noop" }]],
    city: () => [[{ text: "city", callback_data: "noop" }]],
    shopHub: () => [[{ text: "shop", callback_data: "noop" }]],
    miniGames: () => [[{ text: "mini", callback_data: "noop" }]],
    gym: () => [[{ text: "gym", callback_data: "noop" }]],
    upgradesCaption: () => "upgrades",
    upgrades: () => [[{ text: "upgrade", callback_data: "noop" }]],
    bar: () => [[{ text: "bar", callback_data: "noop" }]],
    home: () => [[{ text: "home", callback_data: "noop" }]],
    homeBedStatusCaption: () => "current bed status",
    homeBedUpgradesCaption: () => "bed-upgrades",
    homeBedUpgrades: () => [[{ text: "bed", callback_data: "noop" }]],
    shopDailyDealCaption: () => "deal",
    shop: () => [[{ text: "shop", callback_data: "noop" }]],
    inventoryCaption: () => "inventory caption",
    inventory: () => [[{ text: "Использовать ☕ Кофе", callback_data: "inv:use:coffee" }], [{ text: "Назад", callback_data: "profile:back" }]]
  };

  const locations = new Locations({
    media,
    ui,
    economy: {
      fmtStudyEffects: () => ""
    },
    formatters: {
      balance: () => "balance",
      studyLine: () => "study",
      moneyLine: () => "money",
      workPerks: () => "perks"
    },
    pct: () => 0,
    now: () => nowTs,
    maybeFinishStudy
  });

  return { locations, mediaCalls };
}

function baseUser() {
  return {
    id: "u-additional",
    lang: "en",
    nav: {},
    flags: { onboarding: false, onboardingStep: "" },
    jobs: { active: [] },
    study: { level: 0, active: false },
    casino: { day: "", spins: 0, free: { day: "", lastPrize: null } },
    bar: { tasks: [] },
    biz: { owned: [] },
    gym: { active: false, level: 0 },
    energy: 10,
    clan: {}
  };
}

test("study route idle: renders Study with auto policy", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";

  await locations.show(u, null, Routes.STUDY);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.STUDY);
  assert.equal(mediaCalls[0].policy, "auto");
});

test("study route ready: auto-finishes instead of rendering finish button", async () => {
  let autoFinishCalls = 0;
  const { locations, mediaCalls } = createLocations({
    nowTs: 2000,
    maybeFinishStudy: async (u) => {
      autoFinishCalls += 1;
      u.study.active = false;
      u.study.level += 1;
      return true;
    }
  });
  const u = baseUser();
  u.displayName = "Tester";
  u.study = { level: 2, active: true, startAt: 1000, endAt: 1500 };

  await locations.show(u, null, Routes.STUDY);

  assert.equal(autoFinishCalls, 1);
  assert.equal(u.study.active, false);
  assert.equal(u.study.level, 3);
  assert.equal(mediaCalls.length, 0);
});

test("casino route: shows standard casino menu when arcana is unlocked", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";
  u.study.level = 5;

  await locations.show(u, null, Routes.CASINO);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.CASINO);
  assert.equal(mediaCalls[0].policy, "auto");
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.callback_data, "noop");
});

test("casino route: shows locked gate below required study level", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";
  u.study.level = 4;

  await locations.show(u, null, Routes.CASINO);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.CASINO);
  assert.equal(mediaCalls[0].policy, "auto");
  assert.match(String(mediaCalls[0].caption || ""), /Arcana Hall unlocks at Study level 5/i);
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.callback_data, "go:Bar");
});

test("bar tasks route: renders tasks screen", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";
  u.bar.tasks = [{ status: "claimed" }];

  await locations.show(u, null, Routes.BAR_TASKS);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.BAR);
  assert.equal(mediaCalls[0].policy, "auto");
});

test("square onboarding job_claim: shows CTA to Work", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";
  u.flags.onboarding = true;
  u.flags.onboardingStep = "job_claim";

  await locations.show(u, null, Routes.SQUARE);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.SQUARE);
  assert.equal(mediaCalls[0].policy, "photo");
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.callback_data, "go:Work");
});

test("home bed upgrades route: renders home place with bed upgrades keyboard", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";

  await locations.show(u, null, Routes.HOME_BED_UPGRADES);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.HOME);
  assert.equal(mediaCalls[0].policy, "auto");
  assert.match(String(mediaCalls[0].caption || ""), /bed-upgrades/i);
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.callback_data, "noop");
});

test("home route: renders bed status in caption", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";

  await locations.show(u, null, Routes.HOME);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.HOME);
  assert.match(String(mediaCalls[0].caption || ""), /current bed status/i);
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.text, "home");
});

test("inventory route: renders inventory caption and keyboard", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";
  u.inv = { coffee: 3 };

  await locations.show(u, null, "Inventory");

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, "Inventory");
  assert.match(String(mediaCalls[0].caption || ""), /inventory caption/i);
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.callback_data, "inv:use:coffee");
});
