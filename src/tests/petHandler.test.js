import test from "node:test";
import assert from "node:assert/strict";
import { petHandler } from "../handlers/pet.js";
import { Routes } from "../Routes.js";

test("pet handler: confirming newbie pet purchase returns to newbie tasks", async () => {
  const saves = [];
  const goes = [];
  const ctx = {
    data: "pet:confirm_buy",
    u: {
      lang: "ru",
      flags: { onboardingDone: true },
      newbiePath: { step: 5, pending: false, completed: false, ctx: {}, updatedAt: 0 }
    },
    cb: { id: "1" },
    async answer() {},
    async goTo(u, route) {
      goes.push({ u, route });
    },
    pet: {
      async confirmBuy(u) {
        u.pet = { type: "dog", name: "Bobik", status: "healthy" };
        return { ok: true };
      }
    },
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      }
    },
    quests: {
      maybeCompleteNewbieStep(u) {
        u.newbiePath.pending = true;
        return true;
      }
    },
    locations: null
  };

  await petHandler.handle(ctx);

  assert.equal(ctx.u.newbiePath.pending, true);
  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.BAR_NEWBIE_TASKS);
});
