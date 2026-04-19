import test from "node:test";
import assert from "node:assert/strict";
import { businessHandler } from "../handlers/business.js";
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
