import test from "node:test";
import assert from "node:assert/strict";
import { Locations } from "../Locations.js";
import { Routes } from "../Routes.js";

function createLocations({ nowTs = Date.now() } = {}) {
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
    shop: () => [[{ text: "shop", callback_data: "noop" }]]
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
    maybeFinishStudy: async () => false
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

test("casino route: prepends free spin button when daily free is available", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();
  u.displayName = "Tester";

  await locations.show(u, null, Routes.CASINO);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.CASINO);
  assert.equal(mediaCalls[0].policy, "auto");
  assert.equal(mediaCalls[0]?.keyboard?.[0]?.[0]?.callback_data, "casino_free");
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
