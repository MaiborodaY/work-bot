import test from "node:test";
import assert from "node:assert/strict";
import { Locations } from "../Locations.js";
import { Routes } from "../Routes.js";

function createLocations() {
  const mediaCalls = [];
  const media = {
    async show(payload) {
      mediaCalls.push(payload);
    }
  };

  const ui = {
    gym: () => [[{ text: "gym", callback_data: "noop" }]],
    square: () => [[{ text: "square", callback_data: "noop" }]],
    earn: () => [[{ text: "earn", callback_data: "noop" }]],
    progress: () => [[{ text: "progress", callback_data: "noop" }]],
    city: () => [[{ text: "city", callback_data: "noop" }]],
    shopHub: () => [[{ text: "shop", callback_data: "noop" }]],
    miniGames: () => [[{ text: "mini", callback_data: "noop" }]]
  };

  const locations = new Locations({
    media,
    ui,
    economy: { fmtStudyEffects: () => "" },
    formatters: {
      balance: () => "balance",
      moneyLine: () => "money",
      workPerks: () => "perks",
      studyLine: () => "study"
    },
    pct: () => 0,
    now: () => Date.now(),
    maybeFinishStudy: async () => false
  });

  return { locations, mediaCalls };
}

function baseUser() {
  return {
    id: "u-core",
    lang: "en",
    nav: {},
    flags: { onboarding: false, onboardingStep: "" },
    jobs: { active: [] },
    gym: { active: false, level: 0 },
    study: { level: 0, active: false },
    casino: { day: "", spins: 0, free: { day: "", lastPrize: null } },
    bar: { tasks: [] },
    biz: { owned: [] }
  };
}

test("core route registry: Gym route renders gym screen", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();

  await locations.show(u, null, Routes.GYM);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.GYM);
  assert.equal(mediaCalls[0].policy, "auto");
});

test("core route registry: Business route renders business menu", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();

  await locations.show(u, null, Routes.BUSINESS);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.BUSINESS);
  assert.equal(mediaCalls[0].policy, "photo");
});

test("core route dynamic: Biz_* route renders business card", async () => {
  const { locations, mediaCalls } = createLocations();
  const u = baseUser();

  await locations.show(u, null, "Biz_shawarma");

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.BUSINESS);
  assert.equal(mediaCalls[0].policy, "photo");
});
