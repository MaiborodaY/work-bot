import test from "node:test";
import assert from "node:assert/strict";
import { shopHandler } from "../handlers/shop.js";

test("shop handler: buying coffee marks newbie coffee step as pending", async () => {
  const saves = [];
  const goes = [];
  const ctx = {
    data: "buy_coffee",
    u: {
      lang: "ru",
      money: 100,
      energy: 0,
      energy_max: 20,
      flags: { onboardingDone: true },
      newbiePath: { step: 4, pending: false, completed: false, ctx: {}, updatedAt: 0 }
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
  };

  await shopHandler.handle(ctx);

  assert.equal(ctx.u.money, 88);
  assert.equal(ctx.u.newbiePath.pending, true);
  assert.equal(saves.length, 1);
  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, "Shop");
});
