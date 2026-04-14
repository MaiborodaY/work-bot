import test from "node:test";
import assert from "node:assert/strict";
import { UserStore } from "../UserStore.js";
import { UiFactory } from "../UiFactory.js";

function makeDb() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    }
  };
}

test("UserStore: new user starts with active newbie path", async () => {
  const users = new UserStore(makeDb());

  const u = await users.getOrCreate("newbie-1");

  assert.equal(u.newbiePath.step, 1);
  assert.equal(u.newbiePath.pending, false);
  assert.equal(u.newbiePath.completed, false);
});

test("UserStore: old onboardingDone user gets newbie path completed by default", async () => {
  const users = new UserStore(makeDb());
  const legacy = users._newUser("old-1");
  legacy.flags.onboardingDone = true;
  delete legacy.newbiePath;

  const u = await users.load("old-1", JSON.stringify(legacy));

  assert.equal(u.newbiePath.completed, true);
  assert.equal(u.newbiePath.step, 9);
  assert.equal(u.newbiePath.pending, false);
});

test("UiFactory: bar shows newbie tasks button for incomplete newbie path", () => {
  const ui = new UiFactory();
  const user = {
    lang: "ru",
    flags: { onboarding: false, onboardingDone: true },
    newbiePath: { completed: false },
    bar: {},
    study: { level: 0 },
    subReward: { day: "" }
  };

  const kb = ui.bar(user, Date.UTC(2026, 2, 13, 12, 0, 0), "ru");
  const buttons = kb.flat();
  assert.equal(buttons.some((btn) => btn.callback_data === "bar:newbie"), true);
});

test("UiFactory: bar hides newbie tasks button after completion", () => {
  const ui = new UiFactory();
  const user = {
    lang: "ru",
    flags: { onboarding: false, onboardingDone: true },
    newbiePath: { completed: true },
    bar: {},
    study: { level: 0 },
    subReward: { day: "" }
  };

  const kb = ui.bar(user, Date.UTC(2026, 2, 13, 12, 0, 0), "ru");
  const buttons = kb.flat();
  assert.equal(buttons.some((btn) => btn.callback_data === "bar:newbie"), false);
});
