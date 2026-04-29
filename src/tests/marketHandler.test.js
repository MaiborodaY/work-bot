import test from "node:test";
import assert from "node:assert/strict";
import { marketHandler } from "../handlers/market.js";
import { Routes } from "../Routes.js";

test("market handler: open redirects to Market route", async () => {
  const goes = [];
  const answers = [];
  const ctx = {
    data: "market:open",
    u: { lang: "en" },
    cb: { id: "cb-open" },
    market: {},
    async answer(id, text) {
      answers.push({ id, text });
    },
    async goTo(u, route) {
      goes.push(route);
    },
    locations: {
      media: { async show() {} },
      _sourceMsg: null,
      setSourceMessage() {}
    }
  };

  await marketHandler.handle(ctx);

  assert.equal(answers.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0], Routes.MARKET);
});

test("market handler: successful sell answers toast and returns to Market", async () => {
  const goes = [];
  const answers = [];
  const shows = [];
  const ctx = {
    data: "market:sell:crop_carrot:1",
    u: { lang: "en" },
    cb: { id: "cb-sell", message: { message_id: 1 } },
    market: {
      async sell() {
        return { ok: true, toast: "Sold: 1 x Carrot · +$400" };
      }
    },
    async answer(id, text) {
      answers.push({ id, text });
    },
    async goTo(_u, route) {
      goes.push(route);
    },
    locations: {
      media: {
        async show(payload) {
          shows.push(payload);
        }
      },
      _sourceMsg: null,
      setSourceMessage() {}
    }
  };

  await marketHandler.handle(ctx);

  assert.equal(answers.length, 1);
  assert.match(String(answers[0].text || ""), /Sold/i);
  assert.equal(goes.length, 1);
  assert.equal(goes[0], Routes.MARKET);
  assert.equal(shows.length, 0);
});

test("market handler: failed sell shows item card and does not redirect", async () => {
  const goes = [];
  const answers = [];
  const shows = [];
  const ctx = {
    data: "market:sell:crop_carrot:10",
    u: { lang: "en" },
    cb: { id: "cb-sell-fail", message: { chat: { id: 1 }, message_id: 2 } },
    market: {
      async sell() {
        return { ok: false, error: "Not enough items to sell." };
      },
      async buildItemView() {
        return {
          caption: "Carrot",
          keyboard: [[{ text: "Back", callback_data: "market:open" }]]
        };
      }
    },
    async answer(id, text) {
      answers.push({ id, text });
    },
    async goTo(_u, route) {
      goes.push(route);
    },
    locations: {
      media: {
        async show(payload) {
          shows.push(payload);
        }
      },
      _sourceMsg: null,
      setSourceMessage() {}
    }
  };

  await marketHandler.handle(ctx);

  assert.equal(answers.length, 1);
  assert.match(String(answers[0].text || ""), /Not enough/i);
  assert.equal(goes.length, 0);
  assert.equal(shows.length, 1);
  assert.equal(shows[0].place, Routes.MARKET);
});

