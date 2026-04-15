import test from "node:test";
import assert from "node:assert/strict";
import { workHandler } from "../handlers/work.js";

test("work handler: newbie work step blocks jobs other than flyers", async () => {
  const answers = [];
  const goes = [];
  const ctx = {
    data: "work:start:waiter",
    u: {
      lang: "ru",
      flags: { onboarding: false, onboardingDone: true },
      newbiePath: { step: 2, pending: false, completed: false },
      jobs: { active: [] }
    },
    cb: { id: "1" },
    async answer(id, text) {
      answers.push({ id, text });
    },
    users: { async save() {} },
    now() { return 1710000000000; },
    social: null,
    clans: null,
    labour: null,
    referrals: null,
    achievements: null,
    quests: null,
    async goTo(u, route, intro) {
      goes.push({ u, route, intro });
    },
    orders: null,
    send: null
  };

  await workHandler.handle(ctx);

  assert.equal(answers.length, 1);
  assert.match(String(answers[0].text || ""), /первого задания|first/i);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, "Work");
});
