import test from "node:test";
import assert from "node:assert/strict";
import { farmHandler } from "../handlers/farm.js";
import { Routes } from "../Routes.js";

test("farm handler: planting carrot for newbie step returns to newbie tasks", async () => {
  const goes = [];
  const saves = [];
  const answers = [];
  const shows = [];
  const ctx = {
    data: "farm:plant:1:carrot",
    u: {
      lang: "ru",
      flags: { onboardingDone: true },
      newbiePath: { step: 7, pending: false, completed: false, ctx: {}, updatedAt: 0 }
    },
    cb: { id: "1" },
    async answer(id, text) {
      answers.push({ id, text });
    },
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
      media: {
        async show(payload) {
          shows.push(payload);
        }
      },
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
  assert.equal(goes[0].intro, "carrot planted");
  assert.equal(answers.length, 1);
  assert.match(String(answers[0].text || ""), /carrot planted/i);
  assert.equal(shows.length, 0);
});

test("farm handler: successful plant returns to Farm without intermediate result card", async () => {
  const goes = [];
  const answers = [];
  const shows = [];
  const ctx = {
    data: "farm:plant:1:carrot",
    u: {
      lang: "en",
      flags: { onboardingDone: true },
      newbiePath: { step: 7, pending: false, completed: false, ctx: {}, updatedAt: 0 }
    },
    cb: { id: "2" },
    async answer(id, text) {
      answers.push({ id, text });
    },
    farm: {
      async plant() {
        return { ok: true, plotIndex: 1, cropId: "carrot", growMs: 3600000 };
      },
      buildPlantResultView() {
        return { caption: "Carrot planted on plot 1.", keyboard: [] };
      },
      async buildPlantMenuView() {
        return { caption: "menu", keyboard: [] };
      }
    },
    locations: {
      media: {
        async show(payload) {
          shows.push(payload);
        }
      },
      _sourceMsg: null,
      setSourceMessage() {}
    },
    async goTo(u, route, intro) {
      goes.push({ u, route, intro });
    },
    quests: {
      markNewbieAction() {
        return false;
      }
    },
    users: {
      async save() {}
    }
  };

  await farmHandler.handle(ctx);

  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.FARM);
  assert.equal(goes[0].intro, undefined);
  assert.equal(answers.length, 1);
  assert.match(String(answers[0].text || ""), /carrot planted/i);
  assert.equal(shows.length, 0);
});

test("farm handler: fertilize returns to plot menu with short toast", async () => {
  const goes = [];
  const answers = [];
  const shows = [];
  const ctx = {
    data: "farm:fertilize:1",
    u: { lang: "ru" },
    cb: { id: "3" },
    async answer(id, text) {
      answers.push({ id, text });
    },
    farm: {
      async fertilize() {
        return { ok: true, plotIndex: 1, message: "🧪 Удобрение применено. Грядка 1 готова!" };
      },
      async buildPlotMenuView() {
        return { caption: "plot menu ready", keyboard: [] };
      }
    },
    locations: {
      media: {
        async show(payload) {
          shows.push(payload);
        }
      },
      _sourceMsg: null,
      setSourceMessage() {}
    },
    async goTo(u, route, intro) {
      goes.push({ u, route, intro });
    },
    quests: null,
    users: null
  };

  await farmHandler.handle(ctx);

  assert.equal(answers.length, 1);
  assert.match(String(answers[0].text || ""), /удобрение применено/i);
  assert.equal(goes.length, 0);
  assert.equal(shows.length, 1);
  assert.equal(shows[0].caption, "plot menu ready");
});
