import test from "node:test";
import assert from "node:assert/strict";
import { businessHandler } from "../handlers/business.js";
import { getTodayUTC } from "../BusinessPayout.js";
import { Routes } from "../Routes.js";

test("business handler: first business purchase returns newbie player to newbie tasks", async () => {
  const saves = [];
  const goes = [];
  const ctx = {
    data: "biz:buy:shawarma",
    u: {
      id: "u1",
      lang: "ru",
      money: 20000,
      flags: { onboardingDone: true },
      newbiePath: { step: 10, pending: false, completed: false, ctx: {}, updatedAt: 0 },
      biz: { owned: [] }
    },
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      }
    },
    async answer() {},
    async goTo(u, route, intro) {
      goes.push({ u, route, intro });
    },
    now() {
      return 1710000000000;
    },
    async send() {
      throw new Error("send should not be used for newbie business completion");
    },
    achievements: null,
    ratings: null,
    thief: null,
    quests: {
      maybeCompleteNewbieStep(u) {
        u.newbiePath.pending = true;
        return true;
      }
    },
    social: null,
    cb: { id: "1" },
    locations: null
  };

  await businessHandler.handle(ctx);

  assert.equal(ctx.u.biz.owned.length, 1);
  assert.equal(ctx.u.newbiePath.pending, true);
  assert.ok(saves.length >= 2);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.BAR_NEWBIE_TASKS);
});

test("business handler: supply bonus doubles shawarma claim and burns bonus", async () => {
  const today = getTodayUTC();
  const saves = [];
  const sends = [];
  const goes = [];
  const ctx = {
    data: "biz:claim:shawarma",
    u: {
      id: "u-claim-supply",
      lang: "en",
      money: 100,
      stats: {},
      biz: {
        owned: [{
          id: "shawarma",
          boughtAt: 1,
          lastClaimDayUTC: "",
          pendingTheftAmount: 0,
          supply: {
            unlocked: true,
            slots: 1,
            ordersToday: 1,
            pendingMultiplier: 2,
            pendingBonusDayUTC: today
          }
        }]
      }
    },
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      }
    },
    async answer() {},
    async goTo(u, route) {
      goes.push({ u, route });
    },
    now() {
      return Date.now();
    },
    async send(text) {
      sends.push(text);
    },
    clans: null,
    thief: null,
    achievements: null,
    ratings: null,
    quests: null,
    social: null,
    cb: { id: "cb1" },
    locations: null
  };

  await businessHandler.handle(ctx);

  assert.equal(ctx.u.money, 2100);
  assert.equal(ctx.u.biz.owned[0].lastClaimDayUTC, today);
  assert.equal(ctx.u.biz.owned[0].supply.pendingMultiplier, 0);
  assert.equal(ctx.u.biz.owned[0].supply.pendingBonusDayUTC, "");
  assert.equal(ctx.u.stats.bizClaimDayTotal, 2000);
  assert.equal(saves.length, 1);
  assert.match(sends[0], /\$2000/);
  assert.equal(goes[0].route, "Biz_shawarma");
});
