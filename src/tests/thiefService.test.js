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
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0 }] }
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
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0 }] }
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

test("thief service: attack can start even if owner already claimed today", async () => {
  const nowTs = Date.now();
  const todayUTC = new Date(nowTs).toISOString().slice(0, 10);
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
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: todayUTC, pendingTheftAmount: 0 }] }
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
});

test("thief service: guard purchase sets timer and requires confirm on refresh", async () => {
  const nowTs = Date.now();
  const db = new FakeDb();
  const users = new FakeUsers({
    owner: {
      id: "owner",
      lang: "en",
      money: 1000,
      premium: 10,
      createdAt: nowTs - 10 * 24 * 60 * 60 * 1000,
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0 }] }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const owner = await users.load("owner");

  const first = await service.buyGuard(owner, "shawarma");
  assert.equal(first.ok, true);
  assert.equal(first.price, 100);

  const saved = await users.load("owner");
  assert.equal(saved.money, 900);
  assert.ok(Number(saved?.biz?.owned?.[0]?.guardUntil) > nowTs);

  const second = await service.buyGuard(saved, "shawarma");
  assert.equal(second.ok, false);
  assert.equal(second.needConfirm, true);
});

test("thief service: immunity blocks attack start", async () => {
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
      biz: {
        owned: [{
          id: "shawarma",
          boughtAt: nowTs,
          lastClaimDayUTC: "",
          pendingTheftAmount: 0,
          immunityUntil: nowTs + 24 * 60 * 60 * 1000
        }]
      }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const attacker = await users.load("attacker");
  const res = await service.startAttack(attacker, "shawarma", "owner");

  assert.equal(res.ok, false);
  assert.match(String(res.error || ""), /immun/i);
});

test("thief service: active guard increases owner reaction window", async () => {
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
      biz: {
        owned: [{
          id: "shawarma",
          boughtAt: nowTs,
          lastClaimDayUTC: "",
          pendingTheftAmount: 0,
          guardUntil: nowTs + 24 * 60 * 60 * 1000
        }]
      }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const attacker = await users.load("attacker");
  const res = await service.startAttack(attacker, "shawarma", "owner");
  assert.equal(res.ok, true);

  const rawAttack = await db.get(`thief:attack:${res.attackId}`);
  assert.ok(rawAttack);
  const attack = JSON.parse(rawAttack);
  assert.equal(Number(attack.resolveAt), nowTs + (2 * 60 * 1000) + (20 * 60 * 1000));
});

test("thief service: defend starts battle without spending owner energy", async () => {
  const nowTs = Date.now();
  const db = new FakeDb();
  const users = new FakeUsers({
    attacker: {
      id: "attacker",
      lang: "en",
      chatId: 2,
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
      energy: 5,
      createdAt: nowTs - 10 * 24 * 60 * 60 * 1000,
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0 }] }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const attacker = await users.load("attacker");
  const owner = await users.load("owner");
  const started = await service.startAttack(attacker, "shawarma", "owner");

  const beforeOwner = await users.load("owner");
  const res = await service.defend(beforeOwner, started.attackId);

  assert.equal(res.ok, true);
  assert.equal(res.battleStarted, true);
  const afterOwner = await users.load("owner");
  assert.equal(afterOwner.energy, 5);
  const rawBattle = await db.get(`thief:defense:${started.attackId}`);
  assert.ok(rawBattle);
});

test("thief service: unresolved attack auto succeeds when owner does not defend", async () => {
  let nowTs = Date.UTC(2026, 3, 16, 12, 0, 0);
  const db = new FakeDb();
  const users = new FakeUsers({
    attacker: {
      id: "attacker",
      lang: "en",
      chatId: 2,
      money: 0,
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
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0 }] }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const started = await service.startAttack(await users.load("attacker"), "shawarma", "owner");
  nowTs = nowTs + (2 * 60 * 1000) + 1000;

  const out = await service.resolveExpired();

  assert.equal(out.processed > 0, true);
  const savedAttacker = await users.load("attacker");
  const savedOwner = await users.load("owner");
  assert.equal(savedAttacker.money > 0, true);
  assert.equal(savedOwner.biz.owned[0].pendingTheftAmount > 0, true);
  assert.equal(savedAttacker.thief.activeAttackId, "");
  const rawAttack = await db.get(`thief:attack:${started.attackId}`);
  assert.equal(rawAttack, null);
});

test("thief service: defense battle tie blocks theft in owner's favor", async () => {
  const nowTs = Date.UTC(2026, 3, 16, 13, 0, 0);
  const db = new FakeDb();
  const users = new FakeUsers({
    attacker: {
      id: "attacker",
      lang: "en",
      chatId: 2,
      money: 0,
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
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0, guardBlocked: 0 }] }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const started = await service.startAttack(await users.load("attacker"), "shawarma", "owner");
  await service.defend(await users.load("owner"), started.attackId);

  for (let round = 0; round < 3; round += 1) {
    await service.pickDefenseBattleAttack(await users.load("owner"), started.attackId, "head");
    await service.pickDefenseBattleAttack(await users.load("attacker"), started.attackId, "head");
    await service.pickDefenseBattleDefense(await users.load("owner"), started.attackId, "legs");
    await service.pickDefenseBattleDefense(await users.load("attacker"), started.attackId, "legs");
  }

  const savedAttacker = await users.load("attacker");
  const savedOwner = await users.load("owner");
  assert.equal(savedAttacker.money, 0);
  assert.equal(savedOwner.biz.owned[0].pendingTheftAmount, 0);
  assert.equal(savedOwner.biz.owned[0].guardBlocked, 1);
  const rawBattle = await db.get(`thief:defense:${started.attackId}`);
  const battle = JSON.parse(rawBattle);
  assert.equal(battle.status, "finished");
  assert.equal(battle.result.winnerSide, "owner");
});

test("thief service: defense battle thief win guarantees theft", async () => {
  const nowTs = Date.UTC(2026, 3, 16, 14, 0, 0);
  const db = new FakeDb();
  const users = new FakeUsers({
    attacker: {
      id: "attacker",
      lang: "en",
      chatId: 2,
      money: 0,
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
      biz: { owned: [{ id: "shawarma", boughtAt: nowTs, lastClaimDayUTC: "", pendingTheftAmount: 0 }] }
    }
  });
  const service = new ThiefService({ db, users, now: () => nowTs, bot: { async sendWithInline() {} } });
  const started = await service.startAttack(await users.load("attacker"), "shawarma", "owner");
  await service.defend(await users.load("owner"), started.attackId);

  for (let round = 0; round < 3; round += 1) {
    await service.pickDefenseBattleAttack(await users.load("owner"), started.attackId, "legs");
    await service.pickDefenseBattleAttack(await users.load("attacker"), started.attackId, "head");
    await service.pickDefenseBattleDefense(await users.load("owner"), started.attackId, "body");
    await service.pickDefenseBattleDefense(await users.load("attacker"), started.attackId, "body");
  }

  const savedAttacker = await users.load("attacker");
  const savedOwner = await users.load("owner");
  assert.equal(savedAttacker.money > 0, true);
  assert.equal(savedOwner.biz.owned[0].pendingTheftAmount > 0, true);
});

test("thief service: help view includes configured image asset", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({});
  const service = new ThiefService({ db, users, now: () => Date.now(), bot: null });
  const view = await service.buildHelpView({ id: "u1", lang: "ru" });

  assert.equal(
    view.asset,
    "AgACAgIAAxkBAAJ6y2m2n9iHnqm7tr1kXVm2g-1eQl9NAAKZFGsby1KwSXEibtL1lMpfAQADAgADeQADOgQ"
  );
});
