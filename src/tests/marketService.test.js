import test from "node:test";
import assert from "node:assert/strict";
import { MarketService } from "../MarketService.js";

function makeUser(overrides = {}) {
  return {
    id: "u-market",
    lang: "en",
    money: 0,
    inv: {},
    stats: {
      farmHarvestCount: 0,
      farmMoneyTotal: 0,
      farmWeekKey: "",
      farmMoneyWeek: 0,
      farmIncomeDays: []
    },
    ...overrides
  };
}

test("market service: build main view shows sellable crop rows", async () => {
  const svc = new MarketService({
    users: { async save() {} },
    now: () => Date.parse("2026-04-30T10:00:00Z")
  });
  const u = makeUser({ inv: { crop_carrot: 2, crop_tomato: 1 } });

  const view = await svc.buildMainView(u);

  assert.match(String(view.caption || ""), /Farm Market/i);
  assert.match(String(view.caption || ""), /Carrot/i);
  assert.match(String(view.caption || ""), /Tomato/i);
  assert.equal(
    view.keyboard.flat().some((btn) => String(btn.callback_data || "").startsWith("market:item:crop_carrot")),
    true
  );
});

test("market service: sell updates inventory, money, and farm net-profit stats", async () => {
  const saves = [];
  const socialCalls = [];
  const svc = new MarketService({
    users: {
      async save(u) {
        saves.push(JSON.parse(JSON.stringify(u)));
      }
    },
    now: () => Date.parse("2026-04-30T10:00:00Z"),
    social: {
      async maybeUpdateFarmTop(payload) {
        socialCalls.push(payload);
      }
    }
  });
  const u = makeUser({
    money: 100,
    inv: { crop_carrot: 3 }
  });

  const res = await svc.sell(u, "crop_carrot", 2);

  assert.equal(res.ok, true);
  assert.equal(u.money, 900); // +$800 from 2 carrots at $400 each
  assert.equal(u.inv.crop_carrot, 1);
  assert.equal(u.stats.farmMoneyTotal, 300); // net: (400-250)*2
  assert.equal(u.stats.farmMoneyWeek, 300);
  assert.equal(Array.isArray(u.stats.farmIncomeDays), true);
  assert.equal(saves.length, 1);
  assert.equal(socialCalls.length, 1);
});

test("market service: sellAll fails when item is missing", async () => {
  const svc = new MarketService({
    users: { async save() {} },
    now: () => Date.parse("2026-04-30T10:00:00Z")
  });
  const u = makeUser({ inv: {} });

  const res = await svc.sellAll(u, "crop_carrot");

  assert.equal(res.ok, false);
  assert.match(String(res.error || ""), /not found|не найден|не знайдено/i);
});

