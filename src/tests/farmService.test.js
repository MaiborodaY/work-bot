import test from "node:test";
import assert from "node:assert/strict";
import { FarmService } from "../FarmService.js";

class MockDb {
  constructor() {
    this.map = new Map();
  }

  async put(key, value) {
    this.map.set(String(key), String(value));
  }

  async list({ prefix = "" } = {}) {
    const keys = [];
    for (const name of this.map.keys()) {
      if (String(name).startsWith(prefix)) keys.push({ name });
    }
    return { keys, list_complete: true };
  }
}

function makeUser() {
  return {
    id: "u1",
    chatId: 1001,
    lang: "ru",
    money: 10_000,
    energy: 100,
    energy_max: 100,
    biz: { owned: [] },
    farm: { plotCount: 1, plots: [{ id: 1, status: "empty", cropId: "", plantedAt: 0, readyAt: 0, notifiedReady: false }] }
  };
}

test("farm: plant deducts money, stores growing state and due key", async () => {
  let nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const saves = [];
  const users = {
    db,
    async save(u) {
      saves.push(JSON.parse(JSON.stringify(u)));
    }
  };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();

  const res = await svc.plant(u, 1, "carrot");
  assert.equal(res.ok, true);
  assert.equal(u.money, 9750);
  assert.equal(u.energy, 92);
  assert.equal(u.farm.plots[0].status, "growing");
  assert.equal(u.farm.plots[0].cropId, "carrot");
  assert.ok(u.farm.plots[0].readyAt > nowTs);
  assert.equal(saves.length, 1);

  const dueKeys = [...db.map.keys()].filter((k) => k.startsWith("farm:due:"));
  assert.equal(dueKeys.length, 1);
});

test("farm: harvest resets plot and pays money", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 15, 0, 0);
  const db = new MockDb();
  let questEvents = 0;
  let achEvents = 0;
  let saved = 0;
  const users = {
    db,
    async save() { saved += 1; }
  };
  const quests = {
    async onEvent() {
      questEvents += 1;
      return { events: [] };
    },
    async notifyEvents() {}
  };
  const achievements = {
    async onEvent() {
      achEvents += 1;
      return { newlyEarned: [] };
    },
    async notifyEarned() {}
  };
  const svc = new FarmService({ db, users, now: () => nowTs, quests, achievements });
  const u = makeUser();
  u.money = 0;
  u.farm.plots[0] = {
    id: 1,
    status: "growing",
    cropId: "tomato",
    plantedAt: nowTs - 3600_000,
    readyAt: nowTs - 1000,
    notifiedReady: false
  };

  const res = await svc.harvest(u, 1);
  assert.equal(res.ok, true);
  assert.equal(u.money, 1000);
  assert.equal(u.farm.plots[0].status, "empty");
  assert.equal(u.farm.plots[0].cropId, "");
  assert.equal(u.stats.farmMoneyTotal, 300);
  assert.equal(u.stats.farmMoneyWeek, 300);
  assert.equal(questEvents, 1);
  assert.equal(achEvents, 1);
  assert.equal(saved, 1);
});

test("farm: harvest to inventory resets plot and does not pay money", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 15, 0, 0);
  const db = new MockDb();
  let questEvents = 0;
  let achEvents = 0;
  let saved = 0;
  const users = {
    db,
    async save() { saved += 1; }
  };
  const quests = {
    async onEvent(u, event, payload) {
      questEvents += 1;
      assert.equal(event, "farm_harvest");
      assert.equal(payload.cropId, "tomato");
      assert.equal(payload.money, 0);
      assert.equal(payload.toInventory, true);
      return { events: [] };
    },
    async notifyEvents() {}
  };
  const achievements = {
    async onEvent() {
      achEvents += 1;
      return { newlyEarned: [] };
    },
    async notifyEarned() {}
  };
  const svc = new FarmService({ db, users, now: () => nowTs, quests, achievements });
  const u = makeUser();
  u.money = 0;
  u.farm.plots[0] = {
    id: 1,
    status: "growing",
    cropId: "tomato",
    plantedAt: nowTs - 3600_000,
    readyAt: nowTs - 1000,
    notifiedReady: false
  };

  const res = await svc.harvestToInventory(u, 1);

  assert.equal(res.ok, true);
  assert.equal(res.itemId, "crop_tomato");
  assert.equal(u.money, 0);
  assert.equal(u.inv.crop_tomato, 1);
  assert.equal(u.farm.plots[0].status, "empty");
  assert.equal(u.farm.plots[0].cropId, "");
  assert.equal(u.stats.farmHarvestCount, 1);
  assert.equal(u.stats.farmMoneyTotal, 0);
  assert.equal(u.stats.farmMoneyWeek, 0);
  assert.equal(questEvents, 1);
  assert.equal(achEvents, 1);
  assert.equal(saved, 1);
});

test("farm: plant fails when not enough energy", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.energy = 7;

  const res = await svc.plant(u, 1, "carrot");
  assert.equal(res.ok, false);
  assert.equal(res.code, "not_enough_energy");
  assert.equal(res.needEnergy, 8);
  assert.equal(u.money, 10_000);
  assert.equal(u.farm.plots[0].status, "empty");
});

test("farm: dailyTick sends push for ready unnotified plots", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 18, 0, 0);
  const db = new MockDb();
  const u = makeUser();
  u.farm.plots[0] = {
    id: 1,
    status: "growing",
    cropId: "corn",
    plantedAt: nowTs - 8_000_000,
    readyAt: nowTs - 1000,
    notifiedReady: false
  };
  const userMap = new Map([[u.id, u]]);
  const users = {
    db,
    async load(id) {
      return userMap.get(String(id));
    },
    async save() {}
  };
  const bot = {
    async sendWithInline() {}
  };
  const svc = new FarmService({ db, users, now: () => nowTs, bot });

  await svc._markDue(u.id, nowTs - 500);
  const out = await svc.dailyTick();
  assert.equal(out.notified, 1);
  assert.equal(u.farm.plots[0].notifiedReady, true);
});

test("farm: main view contains help button and help view shows crop economics", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 18, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();

  const main = await svc.buildMainView(u);
  const helpBtn = (main.keyboard || []).flat().find((x) => x.callback_data === "farm:help");
  assert.ok(helpBtn);

  const help = await svc.buildHelpView(u);
  assert.match(help.caption, /Морковь/);
  assert.match(help.caption, /\$250/);
  assert.match(help.caption, /\$400/);
});

test("farm: buy next plot deducts money and unlocks new plot", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 18, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.money = 10_000;

  const res = await svc.buyPlot(u, 2);
  assert.equal(res.ok, true);
  assert.equal(u.money, 5_000);
  assert.equal(u.farm.plotCount, 2);

  const main = await svc.buildMainView(u);
  const buyNext = (main.keyboard || []).flat().find((x) => x.callback_data === "farm:buy_plot:3");
  assert.ok(buyNext);
});

test("farm: main view shows harvest-all button when 2+ plots are ready", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 18, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.farm.plotCount = 2;
  u.farm.plots = [
    { id: 1, status: "growing", cropId: "carrot", plantedAt: nowTs - 60_000, readyAt: nowTs - 1_000, notifiedReady: false },
    { id: 2, status: "growing", cropId: "tomato", plantedAt: nowTs - 60_000, readyAt: nowTs - 1_000, notifiedReady: false }
  ];

  const main = await svc.buildMainView(u);
  const harvestAllBtn = (main.keyboard || []).flat().find((x) => x.callback_data === "farm:harvest_all");
  assert.ok(harvestAllBtn);
});

test("farm: main view opens plot menus and keeps harvest-all bulk action", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 18, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.inv = { fertilizer: 2 };
  u.farm.plotCount = 2;
  u.farm.plots = [
    { id: 1, status: "growing", cropId: "carrot", plantedAt: nowTs - 60_000, readyAt: nowTs - 1_000, notifiedReady: false },
    { id: 2, status: "growing", cropId: "tomato", plantedAt: nowTs - 60_000, readyAt: nowTs - 1_000, notifiedReady: false }
  ];

  const main = await svc.buildMainView(u);
  const buttons = (main.keyboard || []).flat();

  assert.ok(buttons.find((x) => x.callback_data === "farm:plot:1"));
  assert.ok(buttons.find((x) => x.callback_data === "farm:plot:2"));
  assert.ok(buttons.find((x) => x.callback_data === "farm:harvest_all"));
  assert.equal(buttons.some((x) => String(x.callback_data || "").startsWith("farm:fertilize:")), false);
  assert.equal(buttons.some((x) => String(x.callback_data || "").startsWith("farm:harvest:")), false);
});

test("farm: plot menu shows fertilizer only for growing crop with fertilizer", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.inv = { fertilizer: 1 };
  u.farm.plots[0] = {
    id: 1,
    status: "growing",
    cropId: "carrot",
    seedSpent: 250,
    plantedAt: nowTs - 60_000,
    readyAt: nowTs + 3600_000,
    notifiedReady: false
  };

  const view = await svc.buildPlotMenuView(u, 1);
  const buttons = (view.keyboard || []).flat();

  assert.ok(buttons.find((x) => x.callback_data === "farm:fertilize:1"));
  assert.match(String(view.caption || ""), /Fertilizer: 1/i);

  u.inv = {};
  const noFertilizerView = await svc.buildPlotMenuView(u, 1);
  const noFertilizerButtons = (noFertilizerView.keyboard || []).flat();
  assert.equal(noFertilizerButtons.some((x) => x.callback_data === "farm:fertilize:1"), false);
});

test("farm: plot menu shows plant choices for empty plot and harvest for ready crop", async () => {
  let nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();

  const emptyView = await svc.buildPlotMenuView(u, 1);
  let buttons = (emptyView.keyboard || []).flat();
  assert.ok(buttons.find((x) => x.callback_data === "farm:plant:1:carrot"));

  u.farm.plots[0] = {
    id: 1,
    status: "growing",
    cropId: "carrot",
    seedSpent: 250,
    plantedAt: nowTs - 3600_000,
    readyAt: nowTs - 1000,
    notifiedReady: false
  };
  const readyView = await svc.buildPlotMenuView(u, 1);
  buttons = (readyView.keyboard || []).flat();
  assert.ok(buttons.find((x) => x.callback_data === "farm:harvest:1"));
  assert.ok(buttons.find((x) => x.callback_data === "farm:harvest_inv:1"));
  assert.equal(buttons.some((x) => x.callback_data === "farm:fertilize:1"), false);
});

test("farm: harvestAll collects all ready plots with single save", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 15, 0, 0);
  const db = new MockDb();
  let questEvents = 0;
  let achEvents = 0;
  let saved = 0;
  const users = {
    db,
    async save() { saved += 1; }
  };
  const quests = {
    async onEvent() {
      questEvents += 1;
      return { events: [] };
    },
    async notifyEvents() {}
  };
  const achievements = {
    async onEvent() {
      achEvents += 1;
      return { newlyEarned: [] };
    },
    async notifyEarned() {}
  };
  const svc = new FarmService({ db, users, now: () => nowTs, quests, achievements });
  const u = makeUser();
  u.money = 0;
  u.farm.plotCount = 2;
  u.farm.plots = [
    { id: 1, status: "growing", cropId: "carrot", plantedAt: nowTs - 3600_000, readyAt: nowTs - 1000, notifiedReady: false },
    { id: 2, status: "growing", cropId: "tomato", plantedAt: nowTs - 3600_000, readyAt: nowTs - 1000, notifiedReady: false }
  ];

  const res = await svc.harvestAll(u);
  assert.equal(res.ok, true);
  assert.equal(res.count, 2);
  assert.equal(u.money, 400 + 1000);
  assert.equal(u.farm.plots[0].status, "empty");
  assert.equal(u.farm.plots[1].status, "empty");
  assert.equal(u.stats.farmMoneyTotal, 150 + 300);
  assert.equal(u.stats.farmMoneyWeek, 150 + 300);
  assert.equal(questEvents, 2);
  assert.equal(achEvents, 2);
  assert.equal(saved, 1);
});

test("farm: mango plant requires mango seed", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();

  const res = await svc.plant(u, 1, "mango");

  assert.equal(res.ok, false);
  assert.equal(res.code, "not_enough_seeds");
  assert.equal(u.farm.plots[0].status, "empty");
});

test("farm: planting mango spends one seed and harvest sells for 5000", async () => {
  let nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.money = 5000;
  u.inv = { mango_seed: 1 };

  const plantRes = await svc.plant(u, 1, "mango");

  assert.equal(plantRes.ok, true);
  assert.equal(u.inv.mango_seed || 0, 0);
  assert.equal(u.farm.plots[0].cropId, "mango");
  assert.equal(u.farm.plots[0].readyAt, nowTs + 12 * 60 * 60_000);

  nowTs = u.farm.plots[0].readyAt + 1;
  const harvestRes = await svc.harvest(u, 1);

  assert.equal(harvestRes.ok, true);
  assert.equal(harvestRes.sellPrice, 5000);
  assert.equal(u.money, 10000);
});

test("farm: fertilize instantly finishes growing crop and spends fertilizer", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  let saved = 0;
  const users = { db, async save() { saved += 1; } };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.inv = { fertilizer: 1 };
  u.farm.plots[0] = {
    id: 1,
    status: "growing",
    cropId: "carrot",
    seedSpent: 250,
    plantedAt: nowTs - 60_000,
    readyAt: nowTs + 3600_000,
    notifiedReady: false
  };

  const res = await svc.fertilize(u, 1);

  assert.equal(res.ok, true);
  assert.equal(u.inv.fertilizer || 0, 0);
  assert.equal(u.farm.plots[0].readyAt, nowTs);
  assert.equal(saved, 1);
});

test("farm: fertilize fails on empty plot", async () => {
  const nowTs = Date.UTC(2026, 2, 21, 12, 0, 0);
  const db = new MockDb();
  const users = { db, async save() {} };
  const svc = new FarmService({ db, users, now: () => nowTs });
  const u = makeUser();
  u.inv = { fertilizer: 1 };

  const res = await svc.fertilize(u, 1);

  assert.equal(res.ok, false);
  assert.match(String(res.error || ""), /Удобрять можно только растущую грядку/i);
  assert.equal(u.inv.fertilizer, 1);
});
