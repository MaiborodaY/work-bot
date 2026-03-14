import test from "node:test";
import assert from "node:assert/strict";
import { stocksHandler } from "../handlers/stocks.js";

test("stocks handler: buy keeps user on ticker card", async () => {
  const calls = {
    answers: [],
    goTo: [],
    shown: null
  };

  const ctx = {
    data: "stocks:buy:shawarma:10",
    u: { lang: "en" },
    cb: { id: "cb-1", message: { message_id: 1 } },
    answer: async (id, text) => calls.answers.push({ id, text }),
    goTo: async (...args) => calls.goTo.push(args),
    stocks: {
      buy: async () => ({
        ok: true,
        sharesBought: 10,
        price: 100,
        cost: 1000
      }),
      buildTickerView: async () => ({
        caption: "Ticker View",
        keyboard: [[{ text: "Back", callback_data: "go:Stocks" }]]
      })
    },
    locations: {
      _sourceMsg: null,
      media: {
        show: async (view) => {
          calls.shown = view;
        }
      },
      setSourceMessage: () => {}
    }
  };

  await stocksHandler.handle(ctx);

  assert.equal(calls.goTo.length, 0);
  assert.equal(calls.answers.length, 1);
  assert.ok(calls.shown);
  assert.equal(calls.shown.place, "Stocks");
  assert.match(String(calls.shown.caption || ""), /Ticker View/);
});
