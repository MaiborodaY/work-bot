import test from "node:test";
import assert from "node:assert/strict";
import { upgradesHandler } from "../handlers/upgrades.js";
import { Routes } from "../Routes.js";
import { t } from "../i18n/index.js";

test("upgrades handler: bed purchase returns home with short bed toast", async () => {
  const answers = [];
  const goes = [];
  const saves = [];
  const ctx = {
    data: "upg:buy:bed1",
    u: {
      lang: "ru",
      money: 1000,
      premium: 0,
      upgrades: [],
    },
    cb: { id: "1" },
    async answer(id, text) {
      answers.push({ id, text });
    },
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      },
    },
    async goTo(u, route) {
      goes.push({ u, route });
    },
    locations: { _route: Routes.HOME_BED_UPGRADES },
  };

  await upgradesHandler.handle(ctx);

  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.HOME);
  assert.equal(String(answers[0]?.text || ""), t("handler.upgrades.bed_upgraded_toast", "ru"));
  assert.equal(ctx.u.upgrades.includes("bed1"), true);
});
