import test from "node:test";
import assert from "node:assert/strict";
import { businessSupplyHandler } from "../handlers/businessSupply.js";
import { UiFactory } from "../UiFactory.js";

function createCtx(overrides = {}) {
  const answers = [];
  const saves = [];
  const sends = [];
  const mediaCalls = [];
  const u = {
    id: "u-supply",
    lang: "en",
    money: 20000,
    inv: {},
    biz: { owned: [{ id: "shawarma", boughtAt: 1, lastClaimDayUTC: "" }] },
    ...overrides.u
  };
  if (overrides.u?.biz) u.biz = overrides.u.biz;
  if (overrides.u?.inv) u.inv = overrides.u.inv;

  const ctx = {
    data: overrides.data || "supply:open",
    u,
    cb: { id: "cb1", message: { message_id: 1 } },
    async answer(id, text = "") {
      answers.push({ id, text });
    },
    async send(text) {
      sends.push(text);
    },
    users: {
      async save(user) {
        saves.push(JSON.parse(JSON.stringify(user)));
      }
    },
    locations: {
      _sourceMsg: null,
      media: {
        async show(payload) {
          mediaCalls.push(payload);
        }
      },
      setSourceMessage() {}
    }
  };

  return { ctx, answers, saves, sends, mediaCalls };
}

test("business supply ui: earn menu shows supplies only after owning a business", () => {
  const ui = new UiFactory();
  const emptyButtons = ui.earn({ lang: "en", biz: { owned: [] } }, "en").flat();
  const ownerButtons = ui.earn({ lang: "en", biz: { owned: [{ id: "shawarma" }] } }, "en").flat();

  assert.equal(emptyButtons.some((btn) => btn.callback_data === "supply:open"), false);
  assert.equal(ownerButtons.some((btn) => btn.callback_data === "supply:open"), true);
});

test("business supply handler: open locked supplies shows unlock CTA", async () => {
  const { ctx, mediaCalls } = createCtx();

  await businessSupplyHandler.handle(ctx);

  assert.equal(mediaCalls.length, 1);
  assert.match(mediaCalls[0].caption, /Business supplies/);
  assert.match(mediaCalls[0].caption, /Unlock price: \$10000/);
  assert.equal(
    mediaCalls[0].keyboard.flat().some((btn) => btn.callback_data === "supply:unlock:shawarma"),
    true
  );
});

test("business supply handler: unlock charges money and refreshes view", async () => {
  const { ctx, answers, saves, mediaCalls } = createCtx({ data: "supply:unlock:shawarma" });

  await businessSupplyHandler.handle(ctx);

  assert.equal(ctx.u.money, 10000);
  assert.equal(ctx.u.biz.owned[0].supply.unlocked, true);
  assert.equal(saves.length, 1);
  assert.match(answers.at(-1)?.text || "", /Supplies unlocked/);
  assert.equal(mediaCalls.length, 1);
  assert.match(mediaCalls[0].caption, /Ready to supply|Gather ingredients/);
});

test("business supply handler: submit consumes ingredients, saves, sends separate notice", async () => {
  const { ctx, answers, saves, sends, mediaCalls } = createCtx({
    data: "supply:submit:shawarma",
    u: {
      inv: { crop_carrot: 2, crop_tomato: 1 },
      biz: { owned: [{ id: "shawarma", supply: { unlocked: true, slots: 1 } }] }
    }
  });

  await businessSupplyHandler.handle(ctx);

  assert.equal(ctx.u.inv.crop_carrot || 0, 0);
  assert.equal(ctx.u.inv.crop_tomato || 0, 0);
  assert.equal(ctx.u.biz.owned[0].supply.pendingMultiplier, 2);
  assert.equal(ctx.u.biz.owned[0].supply.progress, 1);
  assert.equal(saves.length, 1);
  assert.match(answers.at(-1)?.text || "", /Supply completed/);
  assert.equal(sends.length, 1);
  assert.match(sends[0], /Next shawarma payout will be x2/);
  assert.equal(mediaCalls.length, 1);
  assert.match(mediaCalls[0].caption, /Supply completed|Claim shawarma payout first/);
});

test("business supply handler: missing ingredients does not list shortages or send notice", async () => {
  const { ctx, answers, saves, sends, mediaCalls } = createCtx({
    data: "supply:submit:shawarma",
    u: {
      inv: { crop_carrot: 1 },
      biz: { owned: [{ id: "shawarma", supply: { unlocked: true, slots: 1 } }] }
    }
  });

  await businessSupplyHandler.handle(ctx);

  assert.equal(saves.length, 0);
  assert.equal(sends.length, 0);
  assert.match(answers.at(-1)?.text || "", /cannot be completed/);
  assert.equal(mediaCalls.length, 1);
  assert.doesNotMatch(mediaCalls[0].caption, /missing|need|short/i);
});

test("business supply handler: full progress shows and buys next order slot", async () => {
  const { ctx, answers, saves, mediaCalls } = createCtx({
    data: "supply:buy_slot:shawarma",
    u: {
      money: 30000,
      biz: { owned: [{ id: "shawarma", supply: { unlocked: true, slots: 1, progress: 5 } }] }
    }
  });

  await businessSupplyHandler.handle(ctx);

  assert.equal(ctx.u.money, 5000);
  assert.equal(ctx.u.biz.owned[0].supply.slots, 2);
  assert.equal(ctx.u.biz.owned[0].supply.progress, 0);
  assert.equal(saves.length, 1);
  assert.match(answers.at(-1)?.text || "", /Order slot unlocked: 2/);
  assert.equal(mediaCalls.length, 1);
  assert.match(mediaCalls[0].caption, /Order slots: 2\/3/);
});

test("business supply handler: buy slot button appears only when progress is full", async () => {
  const ready = createCtx({
    u: {
      biz: { owned: [{ id: "shawarma", supply: { unlocked: true, slots: 1, progress: 5 } }] }
    }
  });
  await businessSupplyHandler.handle(ready.ctx);

  assert.equal(
    ready.mediaCalls[0].keyboard.flat().some((btn) => btn.callback_data === "supply:buy_slot:shawarma"),
    true
  );
  assert.match(ready.mediaCalls[0].caption, /New order slot is ready to buy: \$25000/);

  const notReady = createCtx({
    u: {
      biz: { owned: [{ id: "shawarma", supply: { unlocked: true, slots: 1, progress: 4 } }] }
    }
  });
  await businessSupplyHandler.handle(notReady.ctx);

  assert.equal(
    notReady.mediaCalls[0].keyboard.flat().some((btn) => btn.callback_data === "supply:buy_slot:shawarma"),
    false
  );
  assert.match(notReady.mediaCalls[0].caption, /Next slot progress: 4\/5/);
});

test("business supply handler: buy slot fails without enough money", async () => {
  const { ctx, answers, saves, mediaCalls } = createCtx({
    data: "supply:buy_slot:shawarma",
    u: {
      money: 24000,
      biz: { owned: [{ id: "shawarma", supply: { unlocked: true, slots: 1, progress: 5 } }] }
    }
  });

  await businessSupplyHandler.handle(ctx);

  assert.equal(ctx.u.money, 24000);
  assert.equal(ctx.u.biz.owned[0].supply.slots, 1);
  assert.equal(saves.length, 0);
  assert.match(answers.at(-1)?.text || "", /Not enough money/);
  assert.equal(mediaCalls.length, 1);
});
