import test from "node:test";
import assert from "node:assert/strict";
import { shopHandler } from "../handlers/shop.js";
import { Routes } from "../Routes.js";

function createShopCtx({
  data = "buy_coffee",
  money = 100,
  energy = 0,
  energyMax = 20,
  inv = {},
  shopBuyMode = "buy_use",
  newbiePath = null,
} = {}) {
  const saves = [];
  const goes = [];
  const answers = [];
  return {
    saves,
    goes,
    answers,
    ctx: {
      data,
      u: {
        lang: "ru",
        money,
        energy,
        energy_max: energyMax,
        inv: { ...inv },
        settings: { shopBuyMode },
        flags: { onboardingDone: true },
        newbiePath: newbiePath || { step: 4, pending: false, completed: false, ctx: {}, updatedAt: 0 }
      },
      cb: { id: "1" },
      async answer(id, text = "") {
        answers.push({ id, text });
      },
      users: {
        async save(u) {
          saves.push(JSON.parse(JSON.stringify(u)));
        }
      },
      async goTo(u, route, intro = "") {
        goes.push({ u: JSON.parse(JSON.stringify(u)), route, intro });
      },
      quests: {
        markNewbieAction(u, action, ctx) {
          if (action === "shop_buy" && ctx?.key === "coffee") {
            u.newbiePath.pending = true;
            return true;
          }
          return false;
        }
      }
    }
  };
}

test("shop handler: buying coffee marks newbie coffee step as pending", async () => {
  const { saves, goes, ctx } = createShopCtx();

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.money, 88);
  assert.equal(ctx.u.newbiePath.pending, true);
  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.BAR_NEWBIE_TASKS);
});

test("shop handler: buy mode stores coffee in inventory", async () => {
  const { ctx, saves, goes } = createShopCtx({ shopBuyMode: "buy", energy: 20, energyMax: 20, inv: {} });

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.money, 88);
  assert.equal(ctx.u.energy, 20);
  assert.equal(ctx.u.inv.coffee, 1);
  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, Routes.BAR_NEWBIE_TASKS);
});

test("shop handler: buy mode allows coffee purchase at full energy", async () => {
  const { ctx, answers } = createShopCtx({ shopBuyMode: "buy", energy: 20, energyMax: 20, inv: {} });

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.inv.coffee, 1);
  assert.equal(ctx.u.money, 88);
  assert.equal(answers.length, 0);
});

test("shop handler: buy_use mode applies coffee immediately", async () => {
  const { ctx } = createShopCtx({ shopBuyMode: "buy_use", energy: 0, energyMax: 20, inv: {} });

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.energy, 10);
  assert.equal(ctx.u.money, 88);
  assert.equal(ctx.u.inv.coffee || 0, 0);
});

test("shop handler: buy_use mode blocks coffee purchase at full energy", async () => {
  const { ctx, answers, saves } = createShopCtx({ shopBuyMode: "buy_use", energy: 20, energyMax: 20, inv: {} });

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.money, 100);
  assert.equal(ctx.u.inv.coffee || 0, 0);
  assert.equal(saves.length, 0);
  assert.ok(answers.length >= 1);
});

test("shop handler: mode toggle switches buy_use to buy", async () => {
  const { ctx, saves } = createShopCtx({ data: "shop:mode:toggle", shopBuyMode: "buy_use" });

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.settings.shopBuyMode, "buy");
  assert.equal(saves.length, 1);
});
