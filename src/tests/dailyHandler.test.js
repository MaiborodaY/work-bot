import test from "node:test";
import assert from "node:assert/strict";
import { dailyHandler } from "../handlers/daily.js";

test("daily handler: newbie step 1 redirects back to newbie tasks after claim", async () => {
  const shows = [];
  const saves = [];
  const questEvents = [];
  const ctx = {
    u: {
      lang: "ru",
      flags: { onboardingDone: true },
      newbiePath: { step: 1, pending: false, completed: false, ctx: {}, updatedAt: 0 },
      bonus: { last: "", streak: 0 }
    },
    data: "daily:claim",
    cb: { id: "1" },
    async answer() {},
    daily: {
      async claim(u) {
        u.bonus.last = "2026-03-13";
        return { ok: true, amount: 45, streak: 1 };
      }
    },
    locations: {
      async show(u, intro, route) {
        shows.push({ u, intro, route });
      }
    },
    clans: { async recordActiveAction() {} },
    users: { async save(u) { saves.push(u); } },
    quests: {
      async onEvent(u, event) {
        questEvents.push(event);
        return { changed: true, events: [] };
      },
      async ensureCycles() { return { changed: false }; },
      maybeCompleteNewbieStep(u) {
        u.newbiePath.pending = true;
        return true;
      }
    }
  };

  await dailyHandler.handle(ctx);

  assert.deepEqual(questEvents, ["daily_claim"]);
  assert.equal(saves.length, 1);
  assert.equal(ctx.u.newbiePath.pending, true);
  assert.equal(shows.length, 1);
  assert.equal(shows[0].route, "BarNewbieTasks");
});

test("daily handler: regular player stays on default daily claim flow", async () => {
  const shows = [];
  const questEvents = [];
  const ctx = {
    u: {
      lang: "ru",
      flags: { onboardingDone: true },
      newbiePath: { step: 10, pending: false, completed: true, ctx: null, updatedAt: 0 },
      bonus: { last: "", streak: 0 }
    },
    data: "daily:claim",
    cb: { id: "2" },
    async answer() {},
    daily: {
      async claim() {
        return { ok: true, amount: 45, streak: 1 };
      }
    },
    locations: {
      async show(u, intro, route) {
        shows.push({ u, intro, route });
      }
    },
    clans: { async recordActiveAction() {} },
    users: { async save() {} },
    quests: {
      async onEvent(u, event) {
        questEvents.push(event);
        return { changed: true, events: [] };
      },
      async ensureCycles() { return { changed: false }; },
      maybeCompleteNewbieStep() { return false; }
    }
  };

  await dailyHandler.handle(ctx);

  assert.deepEqual(questEvents, ["daily_claim"]);
  assert.equal(shows.length, 1);
  assert.equal(shows[0].route, undefined);
});
