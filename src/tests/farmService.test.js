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
  assert.equal(u.money, 9800);
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
  assert.equal(u.money, 900);
  assert.equal(u.farm.plots[0].status, "empty");
  assert.equal(u.farm.plots[0].cropId, "");
  assert.equal(questEvents, 1);
  assert.equal(achEvents, 1);
  assert.equal(saved, 1);
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
  assert.match(help.caption, /\$200/);
  assert.match(help.caption, /\$350/);
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
