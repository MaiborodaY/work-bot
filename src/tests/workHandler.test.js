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
  assert.ok(String(answers[0].text || "").length > 0);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, "Work");
});

test("work handler: sends chat message when farmer finds mango seed on claim", async () => {
  const originalRandom = Math.random;
  Math.random = () => 0.1;
  const answers = [];
  const sent = [];
  const goes = [];
  try {
    const nowTs = Date.UTC(2026, 3, 20, 12, 0, 0);
    const ctx = {
      data: "work:claim",
      u: {
        id: "u-farmer-claim",
        lang: "ru",
        displayName: "Tester",
        money: 0,
        energy: 180,
        energy_max: 180,
        inv: {},
        upgrades: [],
        study: { level: 0 },
        flags: { onboarding: false, onboardingDone: true },
        jobs: {
          active: [{
            id: "job1",
            typeId: "farmer",
            startAt: nowTs - (24 * 60 * 60_000) - 1000,
            endAt: nowTs - 1000,
            energySpent: 180,
            plannedPay: 2000,
            claimed: false,
            notified: false,
            effects: {}
          }]
        }
      },
      cb: { id: "1" },
      async answer(id, text) {
        answers.push({ id, text });
      },
      users: { async save() {} },
      now() { return nowTs; },
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
      async send(text) {
        sent.push(String(text || ""));
      }
    };

    await workHandler.handle(ctx);

    assert.equal(goes.length, 1);
    assert.equal(goes[0].route, "Work");
    assert.ok(answers.some((x) => /семя манго/i.test(String(x.text || ""))));
    assert.ok(sent.some((x) => /семя манго/i.test(x)));
    assert.equal(ctx.u.inv.mango_seed, 1);
  } finally {
    Math.random = originalRandom;
  }
});
