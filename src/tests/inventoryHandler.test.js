import test from "node:test";
import assert from "node:assert/strict";

function makeCtx({ inv = { coffee: 1 }, energy = 0, energyMax = 20 } = {}) {
  const saves = [];
  const goes = [];
  const answers = [];
  return {
    saves,
    goes,
    answers,
    ctx: {
      data: "inv:use:coffee",
      u: {
        id: "u-inventory-handler",
        lang: "ru",
        inv: { ...inv },
        energy,
        energy_max: energyMax,
        rest: { active: false, last: 0 },
        upgrades: [],
      },
      cb: { id: "cb-inventory" },
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
      }
    }
  };
}

test("inventory handler: using coffee decrements stock by one", async () => {
  const { inventoryHandler } = await import("../handlers/inventory.js");
  const { ctx } = makeCtx({ inv: { coffee: 3 }, energy: 0, energyMax: 20 });

  await inventoryHandler.handle(ctx);

  assert.equal(ctx.u.inv.coffee, 2);
});

test("inventory handler: using coffee restores energy", async () => {
  const { inventoryHandler } = await import("../handlers/inventory.js");
  const { ctx } = makeCtx({ inv: { coffee: 1 }, energy: 5, energyMax: 20 });

  await inventoryHandler.handle(ctx);

  assert.equal(ctx.u.energy, 15);
});

test("inventory handler: using coffee with full energy does not spend item", async () => {
  const { inventoryHandler } = await import("../handlers/inventory.js");
  const { ctx, answers } = makeCtx({ inv: { coffee: 2 }, energy: 20, energyMax: 20 });

  await inventoryHandler.handle(ctx);

  assert.equal(ctx.u.inv.coffee, 2);
  assert.ok(answers.length >= 1);
});

test("inventory handler: after successful use returns to inventory screen", async () => {
  const { inventoryHandler } = await import("../handlers/inventory.js");
  const { ctx, goes } = makeCtx({ inv: { coffee: 1 }, energy: 0, energyMax: 20 });

  await inventoryHandler.handle(ctx);

  assert.equal(goes.length, 1);
  assert.equal(goes[0].route, "Inventory");
});
