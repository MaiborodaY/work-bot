import test from "node:test";
import assert from "node:assert/strict";
import { Locations } from "../Locations.js";
import { Routes } from "../Routes.js";

function createLocations({ nowTs = Date.now() } = {}) {
  const mediaCalls = [];
  const workV2Calls = [];

  const media = {
    async show(payload) {
      mediaCalls.push(payload);
    }
  };

  const ui = {
    workV2(user, opts, lang) {
      workV2Calls.push({ user, opts, lang });
      return [[{ text: "work-kb", callback_data: "noop" }]];
    },
    square: () => [[{ text: "square", callback_data: "noop" }]],
    cityBoard: () => [[{ text: "board", callback_data: "noop" }]],
    earn: () => [[{ text: "earn", callback_data: "noop" }]],
    progress: () => [[{ text: "progress", callback_data: "noop" }]],
    city: () => [[{ text: "city", callback_data: "noop" }]],
    shopHub: () => [[{ text: "shop", callback_data: "noop" }]],
    miniGames: () => [[{ text: "mini", callback_data: "noop" }]]
  };

  const locations = new Locations({
    media,
    ui,
    economy: {},
    formatters: {
      balance: () => "balance",
      workPerks: () => "perks"
    },
    pct: () => 0,
    now: () => nowTs,
    maybeFinishStudy: async () => false
  });

  return { locations, mediaCalls, workV2Calls };
}

function baseUser() {
  return {
    id: "u-work",
    lang: "en",
    nav: {},
    flags: { onboarding: false, onboardingStep: "" },
    jobs: { active: [] }
  };
}

test("work route idle: renders Work with photo policy", async () => {
  const { locations, mediaCalls, workV2Calls } = createLocations();
  const u = baseUser();

  await locations.show(u, null, Routes.WORK);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.WORK);
  assert.equal(mediaCalls[0].policy, "photo");
  assert.equal(workV2Calls.length, 1);
  assert.deepEqual(workV2Calls[0].opts, { backTo: Routes.EARN });
});

test("work route active: passes active state to ui.workV2", async () => {
  const nowTs = Date.now();
  const { locations, mediaCalls, workV2Calls } = createLocations({ nowTs });
  const u = baseUser();
  u.jobs.active = [{
    typeId: "flyers",
    title: "Flyers",
    plannedPay: 7,
    endAt: nowTs + 60_000
  }];

  await locations.show(u, null, Routes.WORK);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.WORK);
  assert.equal(mediaCalls[0].policy, "photo");
  assert.equal(workV2Calls.length, 1);
  assert.equal(!!workV2Calls[0].opts.active, true);
  assert.equal(workV2Calls[0].opts.ready, false);
});

test("work route onboarding go_gym: renders auto policy with Gym CTA", async () => {
  const { locations, mediaCalls, workV2Calls } = createLocations();
  const u = baseUser();
  u.flags.onboarding = true;
  u.flags.onboardingStep = "go_gym";

  await locations.show(u, null, Routes.WORK);

  assert.equal(mediaCalls.length, 1);
  assert.equal(mediaCalls[0].place, Routes.WORK);
  assert.equal(mediaCalls[0].policy, "auto");
  assert.equal(workV2Calls.length, 0);

  const firstBtn = mediaCalls[0]?.keyboard?.[0]?.[0];
  assert.equal(firstBtn?.callback_data, "go:Gym");
});
