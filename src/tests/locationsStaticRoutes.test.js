import test from "node:test";
import assert from "node:assert/strict";
import { Locations } from "../Locations.js";
import { Routes } from "../Routes.js";

function makeLocations(overrides = {}) {
  const calls = [];
  const media = {
    async show(payload) {
      calls.push(payload);
    }
  };
  const ui = {
    earn: () => [[{ text: "earn", callback_data: "noop" }]],
    city: () => [[{ text: "city", callback_data: "noop" }]],
    miniGames: () => [[{ text: "mini", callback_data: "noop" }]],
    progress: () => [[{ text: "progress", callback_data: "noop" }]],
    shopHub: () => [[{ text: "shopHub", callback_data: "noop" }]],
    square: () => [[{ text: "square", callback_data: "noop" }]]
  };

  const locations = new Locations({
    media,
    ui,
    economy: {},
    formatters: {},
    pct: () => 0,
    now: () => Date.now(),
    maybeFinishStudy: async () => false,
    ...overrides
  });

  return { locations, calls };
}

function makeUser() {
  return {
    id: "u1",
    lang: "en",
    flags: { onboarding: false, onboardingStep: "" },
    jobs: { active: [] }
  };
}

test("locations static route: Earn uses static registry", async () => {
  const { locations, calls } = makeLocations();
  await locations.show(makeUser(), null, Routes.EARN);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.SQUARE);
  assert.equal(calls[0].policy, "photo");
  assert.deepEqual(calls[0].keyboard, [[{ text: "earn", callback_data: "noop" }]]);
});

test("locations static route: City uses static registry", async () => {
  const { locations, calls } = makeLocations();
  await locations.show(makeUser(), null, Routes.CITY);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.SQUARE);
  assert.equal(calls[0].policy, "photo");
  assert.deepEqual(calls[0].keyboard, [[{ text: "city", callback_data: "noop" }]]);
});

test("locations static route: MiniGames uses static registry", async () => {
  const { locations, calls } = makeLocations();
  await locations.show(makeUser(), null, Routes.MINI_GAMES);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.SQUARE);
  assert.equal(calls[0].policy, "photo");
  assert.deepEqual(calls[0].keyboard, [[{ text: "mini", callback_data: "noop" }]]);
});

test("locations service route: Ratings uses rating service view", async () => {
  const ratings = {
    async buildView() {
      return {
        caption: "Rating view",
        keyboard: [[{ text: "back", callback_data: "go:City" }]]
      };
    }
  };
  const { locations, calls } = makeLocations({ ratings });
  await locations.show(makeUser(), null, Routes.RATINGS);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.CITY_BOARD);
  assert.equal(calls[0].policy, "auto");
  assert.equal(calls[0].caption, "Rating view");
  assert.deepEqual(calls[0].keyboard, [[{ text: "back", callback_data: "go:City" }]]);
});

test("locations service route: Colosseum uses colosseum service view", async () => {
  const colosseum = {
    async buildMainView() {
      return {
        caption: "Colosseum view",
        keyboard: [[{ text: "find", callback_data: "col:queue:join" }]]
      };
    }
  };
  const { locations, calls } = makeLocations({ colosseum });
  await locations.show(makeUser(), null, Routes.COLOSSEUM);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].place, Routes.COLOSSEUM);
  assert.equal(calls[0].policy, "auto");
  assert.equal(calls[0].caption, "Colosseum view");
  assert.deepEqual(calls[0].keyboard, [[{ text: "find", callback_data: "col:queue:join" }]]);
});
