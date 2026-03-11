import test from "node:test";
import assert from "node:assert/strict";
import { ThiefService } from "../ThiefService.js";

class FakeDb {
  constructor() {
    this.map = new Map();
  }

  async get(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  async put(key, value) {
    this.map.set(String(key), String(value));
  }

  async delete(key) {
    this.map.delete(String(key));
  }

  async list({ prefix = "" } = {}) {
    const keys = [...this.map.keys()]
      .filter((k) => String(k).startsWith(prefix))
      .map((name) => ({ name }));
    return { keys, cursor: undefined };
  }
}

class FakeUsers {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed).map(([id, u]) => [String(id), JSON.parse(JSON.stringify(u))]));
  }

  async load(id) {
    const v = this.store.get(String(id));
    if (!v) return null;
    return JSON.parse(JSON.stringify(v));
  }

  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    this.store.set(String(clone.id), clone);
    return clone;
  }
}

test("thief service: upgrade level spends money", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    a1: { id: "a1", lang: "en", money: 20000, thief: { level: 0, activeAttackId: "", cooldowns: {} } }
  });
  const service = new ThiefService({ db, users, now: () => Date.now(), bot: null });
  const u = await users.load("a1");

  const res = await service.upgradeLevel(u);
  assert.equal(res.ok, true);
  assert.equal(res.level, 1);

  const saved = await users.load("a1");
  assert.equal(saved.thief.level, 1);
  assert.equal(saved.money, 10000);
});

test("thief service: start attack fails when energy below double attack cost", async () => {
  const nowTs = Date.now();
  const db = new FakeDb();
  const users = new FakeUsers({
    attacker: {
      id: "attacker",
      lang: "en",
      money: 50000,
      energy: 10,
      createdAt: nowTs - 10 * 24 * 60 * 60 * 1000,
      thief: { level: 1, activeAttackId: "", cooldowns: {} },
      biz: { owned: [] }
    },
    owner: {
      id: "owner",
      lang: "en",
      chatId: 1,
      createdAt: nowTs - 10 * 24 * 60 * 60 * 1000,
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", stolenDayUTC: "", stolenAmountToday: 0 }] }
    }
  });
  const service = new ThiefService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} }
  });
  const attacker = await users.load("attacker");
  const res = await service.startAttack(attacker, "shawarma", "owner");

  assert.equal(res.ok, false);
  assert.match(String(res.error || ""), /need at least|Нужно минимум|Потрібно мінімум/i);
});

test("thief service: start attack creates active attempt and deducts energy", async () => {
  const nowTs = Date.now();
  const db = new FakeDb();
  const users = new FakeUsers({
    attacker: {
      id: "attacker",
      lang: "en",
      money: 50000,
      energy: 30,
      createdAt: nowTs - 10 * 24 * 60 * 60 * 1000,
      thief: { level: 1, activeAttackId: "", cooldowns: {} },
      biz: { owned: [] }
    },
    owner: {
      id: "owner",
      lang: "en",
      chatId: 1,
      createdAt: nowTs - 10 * 24 * 60 * 60 * 1000,
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", stolenDayUTC: "", stolenAmountToday: 0 }] }
    }
  });
  const service = new ThiefService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} }
  });
  const attacker = await users.load("attacker");
  const res = await service.startAttack(attacker, "shawarma", "owner");

  assert.equal(res.ok, true);
  assert.ok(res.attackId);

  const savedAttacker = await users.load("attacker");
  assert.equal(savedAttacker.energy, 20);
  assert.equal(savedAttacker.thief.activeAttackId, res.attackId);

  const rawAttack = await db.get(`thief:attack:${res.attackId}`);
  assert.ok(rawAttack);
});

