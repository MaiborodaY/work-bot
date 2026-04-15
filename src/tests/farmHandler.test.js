import test from "node:test";
import assert from "node:assert/strict";
import { farmHandler } from "../handlers/farm.js";
import { Routes } from "../Routes.js";

test("farm handler: planting carrot for newbie step returns to newbie tasks", async () => {
  const goes = [];
  const saves = [];
  const ctx = {
    data: "farm:plant:1:carrot",
    u: {
      lang: "ru",
      flags: { onboardingDone: true },
      newbiePath: { step: 7, pending: false, completed: false, ctx: {}, updatedAt: 0 }
    },
    cb: { id: "1" },
    async answer() {},
    farm: {
      async plant() {
        return { ok: true, plotIndex: 1, cropId: "carrot", growMs: 3600000 };
      },
      buildPlantResultView() {
        return { caption: "carrot planted", keyboard: [] };
      },
      async buildPlantMenuView() {
        return { caption: "menu", keyboard: [] };
      }
    },
    locations: {
      media: { async show() {} },
      _sourceMsg: null,
      setSourceMessage() {}
    },
    async goTo(u, route, intro) {
      goes.push({ u, route, intro });
    },
    quests: {
      markNewbieAction(u, action, eventCtx) {
        if (action === "farm_plant" && eventCtx?.cropId === "carrot") {
          u.newbiePath.pending = true;
          return true;
        }
        return false;
      }
    },
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      }
    }
  };

  await farmHandler.handle(ctx);

  assert.equal(ctx.u.newbiePath.pending, true);
  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.BAR_NEWBIE_TASKS);
});
