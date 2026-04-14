import test from "node:test";
import assert from "node:assert/strict";
import { barHandler } from "../handlers/bar.js";
import { Routes } from "../Routes.js";

test("bar handler: newbie go route stores backTo and redirects", async () => {
  const saves = [];
  const goes = [];
  const ctx = {
    data: "bar:newbie:go:Home",
    u: {
      lang: "ru",
      nav: {}
    },
    cb: { id: "1" },
    async answer() {},
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      }
    },
    async goTo(u, route) {
      goes.push({ u, route });
    }
  };

  await barHandler.handle(ctx);

  assert.equal(ctx.u.nav.backTo, Routes.BAR_NEWBIE_TASKS);
  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, "Home");
});
