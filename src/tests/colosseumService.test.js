import test from "node:test";
import assert from "node:assert/strict";
import { ColosseumService } from "../ColosseumService.js";

class FakeDb {
  constructor() {
    this.map = new Map();
  }

  async get(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }

  async put(key, value) {
    this.map.set(String(key), String(value));
  }

  async delete(key) {
    this.map.delete(String(key));
  }
}

class FakeUsers {
  constructor(seed = {}) {
    this.store = new Map(
      Object.entries(seed).map(([id, u]) => [String(id), JSON.parse(JSON.stringify(u))])
    );
  }

  async load(id) {
    const u = this.store.get(String(id));
    if (!u) return null;
    return JSON.parse(JSON.stringify(u));
  }

  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    this.store.set(String(clone.id), clone);
    return clone;
  }
}

function makeUser(id, name, energyMax = 120) {
  return {
    id: String(id),
    displayName: String(name),
    chatId: Number(String(id).replace(/\D/g, "").slice(0, 6) || 1000),
    lang: "en",
    energy_max: energyMax,
    createdAt: Date.UTC(2026, 2, 30, 10, 0, 0),
    colosseum: {
      dayKey: "",
      battlesToday: 0,
      weekKey: "",
      weekWins: 0,
      activeBattleId: "",
      inQueue: false
    }
  };
}

async function loadBattle(db, battleId) {
  const raw = await db.get(`colosseum:battle:${battleId}`);
  return raw ? JSON.parse(raw) : null;
}

async function loadOpenBattles(db) {
  const raw = await db.get("colosseum:open:v1");
  return raw ? JSON.parse(raw) : [];
}

test("colosseum service: two queue joins create one pending battle", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });

  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 12, 0, 0),
    bot: { async sendWithInline() {} }
  });

  const u1 = await users.load("u1");
  const q1 = await service.joinQueue(u1);
  assert.equal(q1.ok, true);
  assert.equal(q1.matched, false);

  const u2 = await users.load("u2");
  const q2 = await service.joinQueue(u2);
  assert.equal(q2.ok, true);
  assert.equal(q2.matched, true);

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  assert.ok(s1.colosseum.activeBattleId);
  assert.equal(s1.colosseum.activeBattleId, s2.colosseum.activeBattleId);
  assert.equal(s1.colosseum.inQueue, false);
  assert.equal(s2.colosseum.inQueue, false);

  const battle = await loadBattle(db, s1.colosseum.activeBattleId);
  assert.equal(battle.status, "pending_accept");
  assert.deepEqual(battle.players.sort(), ["u1", "u2"]);

  const open = await loadOpenBattles(db);
  assert.ok(open.includes(s1.colosseum.activeBattleId));
});

test("colosseum service: both accepts start battle and consume daily attempts", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });

  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 12, 5, 0),
    bot: { async sendWithInline() {} }
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));

  const a1 = await users.load("u1");
  const a2 = await users.load("u2");
  const r1 = await service.accept(a1);
  assert.equal(r1.ok, true);
  const r2 = await service.accept(a2);
  assert.equal(r2.ok, true);

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  assert.equal(s1.colosseum.battlesToday, 1);
  assert.equal(s2.colosseum.battlesToday, 1);

  const battle = await loadBattle(db, s1.colosseum.activeBattleId);
  assert.equal(battle.status, "active_round");
  assert.equal(battle.currentRound, 1);
  assert.ok(Number(battle.roundDeadline) > Date.UTC(2026, 2, 30, 12, 5, 0));
});

test("colosseum service: defense cannot be the same zone as selected attack", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 12, 10, 0),
    bot: { async sendWithInline() {} }
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));
  await service.accept(await users.load("u2"));

  const u1 = await users.load("u1");
  const atk = await service.pickAttack(u1, "head");
  assert.equal(atk.ok, true);

  const badDef = await service.pickDefense(u1, "head");
  assert.equal(badDef.ok, false);
});

test("colosseum service: pending accept timeout expires battle and requeues accepter", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  let nowTs = Date.UTC(2026, 2, 30, 12, 20, 0);
  const service = new ColosseumService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} }
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));

  const before = await users.load("u1");
  const battleId = before.colosseum.activeBattleId;
  const pending = await loadBattle(db, battleId);
  nowTs = Number(pending.acceptDeadline) + 1000;
  await service.runTick();

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  assert.equal(s1.colosseum.activeBattleId, "");
  assert.equal(s2.colosseum.activeBattleId, "");
  assert.equal(s1.colosseum.inQueue, true);
  assert.equal(s2.colosseum.inQueue, false);

  const expired = await loadBattle(db, battleId);
  assert.equal(expired.status, "expired");
  assert.equal(expired.result.reason, "accept_timeout");
  const open = await loadOpenBattles(db);
  assert.equal(open.includes(battleId), false);
});

test("colosseum service: surrender finalizes battle, clears state and updates weekly rating", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 12, 30, 0),
    bot: { async sendWithInline() {} }
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));
  await service.accept(await users.load("u2"));

  const loser = await users.load("u2");
  const battleId = loser.colosseum.activeBattleId;
  const out = await service.surrender(loser);
  assert.equal(out.ok, true);

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  assert.equal(s1.colosseum.activeBattleId, "");
  assert.equal(s2.colosseum.activeBattleId, "");
  assert.equal(s1.colosseum.weekWins, 1);
  assert.equal(s2.colosseum.weekWins, 0);

  const battle = await loadBattle(db, battleId);
  assert.equal(battle.status, "finished");
  assert.equal(battle.result.reason, "surrender");
  assert.equal(battle.result.winnerId, "u1");

  const open = await loadOpenBattles(db);
  assert.equal(open.includes(battleId), false);
});

test("colosseum service: main view syncs weekly wins with rating row for current user", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });

  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 14, 0, 0),
    bot: { async sendWithInline() {} }
  });

  const weekKey = service._nowWeekKey();
  await db.put(
    service._ratingKey(weekKey),
    JSON.stringify([
      { userId: "u1", name: "Alpha", wins: 2, reachedAt: Date.UTC(2026, 2, 30, 13, 0, 0) },
      { userId: "u2", name: "Bravo", wins: 1, reachedAt: Date.UTC(2026, 2, 30, 13, 5, 0) }
    ])
  );

  const me = await users.load("u1");
  me.colosseum.weekKey = weekKey;
  me.colosseum.weekWins = 1;
  await users.save(me);

  const view = await service.buildMainView(await users.load("u1"));
  assert.match(String(view.caption || ""), /Weekly wins: 2/);

  const saved = await users.load("u1");
  assert.equal(saved.colosseum.weekWins, 2);
});
