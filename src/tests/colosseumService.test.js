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

class FakeAchievements {
  constructor() {
    this.events = [];
  }

  async onEvent(user, event) {
    this.events.push({ userId: String(user?.id || ""), event: String(event || "") });
    if (!user.achievements) user.achievements = { progress: {} };
    if (!user.achievements.progress) user.achievements.progress = {};
    if (event === "colosseum_battle_played") {
      user.achievements.progress.colosseumBattlesTotal = Math.max(0, Number(user.achievements.progress.colosseumBattlesTotal || 0)) + 1;
    }
    if (event === "colosseum_win") {
      user.achievements.progress.colosseumWinsTotal = Math.max(0, Number(user.achievements.progress.colosseumWinsTotal || 0)) + 1;
    }
    return { ok: true, changed: true };
  }
}

function makeUser(id, name, energyMax = 120) {
  return {
    id: String(id),
    displayName: String(name),
    chatId: Number(String(id).replace(/\D/g, "").slice(0, 6) || 1000),
    lang: "en",
    energy_max: energyMax,
    money: 0,
    premium: 0,
    achievements: {
      progress: {
        colosseumBattlesTotal: 0,
        colosseumWinsTotal: 0
      }
    },
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

test("colosseum service: starting battle triggers quest event for both players", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  const achievements = new FakeAchievements();
  const questCalls = [];
  const quests = {
    async onEvent(user, event) {
      questCalls.push({ userId: String(user?.id || ""), event: String(event || "") });
      return { ok: true, changed: false, events: [] };
    }
  };
  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 12, 6, 0),
    bot: { async sendWithInline() {} },
    quests,
    achievements
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));
  await service.accept(await users.load("u2"));

  assert.deepEqual(
    questCalls.sort((a, b) => String(a.userId).localeCompare(String(b.userId))),
    [
      { userId: "u1", event: "colosseum_battle_played" },
      { userId: "u2", event: "colosseum_battle_played" }
    ]
  );
  assert.deepEqual(
    achievements.events.sort((a, b) => String(a.userId).localeCompare(String(b.userId))),
    [
      { userId: "u1", event: "colosseum_battle_played" },
      { userId: "u2", event: "colosseum_battle_played" }
    ]
  );
  assert.equal((await users.load("u1")).achievements.progress.colosseumBattlesTotal, 1);
  assert.equal((await users.load("u2")).achievements.progress.colosseumBattlesTotal, 1);
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
  assert.equal(s1.premium, 1);
  assert.equal(s2.premium, 0);

  const battle = await loadBattle(db, battleId);
  assert.equal(battle.status, "finished");
  assert.equal(battle.result.reason, "surrender");
  assert.equal(battle.result.winnerId, "u1");

  const open = await loadOpenBattles(db);
  assert.equal(open.includes(battleId), false);
});

test("colosseum service: winner gets 1 gem after normal battle finish", async () => {
  const db = new FakeDb();
  const achievements = new FakeAchievements();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  let nowTs = Date.UTC(2026, 2, 30, 12, 40, 0);
  const service = new ColosseumService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    achievements
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));
  await service.accept(await users.load("u2"));

  await service.pickAttack(await users.load("u1"), "head");
  await service.pickDefense(await users.load("u1"), "body");
  await service.pickAttack(await users.load("u2"), "legs");
  await service.pickDefense(await users.load("u2"), "body");

  let battle = await loadBattle(db, (await users.load("u1")).colosseum.activeBattleId);
  nowTs = Number(battle.roundDeadline) + 1000;
  await service.runTick();

  battle = await loadBattle(db, battle.id);
  await service.pickAttack(await users.load("u1"), "head");
  await service.pickDefense(await users.load("u1"), "body");
  await service.pickAttack(await users.load("u2"), "legs");
  await service.pickDefense(await users.load("u2"), "body");
  nowTs = Number(battle.roundDeadline) + 1000;
  await service.runTick();

  battle = await loadBattle(db, battle.id);
  await service.pickAttack(await users.load("u1"), "head");
  await service.pickDefense(await users.load("u1"), "body");
  await service.pickAttack(await users.load("u2"), "legs");
  await service.pickDefense(await users.load("u2"), "body");
  nowTs = Number(battle.roundDeadline) + 1000;
  await service.runTick();

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  assert.equal(s1.colosseum.weekWins, 1);
  assert.equal(s2.colosseum.weekWins, 0);
  assert.equal(s1.premium, 1);
  assert.equal(s2.premium, 0);
  assert.equal(s1.achievements.progress.colosseumWinsTotal, 1);
  assert.equal(s2.achievements.progress.colosseumWinsTotal, 0);
});

test("colosseum service: finished winner view shows gem reward", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  const service = new ColosseumService({
    db,
    users,
    now: () => Date.UTC(2026, 2, 30, 12, 45, 0),
    bot: { async sendWithInline() {} }
  });

  const battle = {
    id: "col_test",
    players: ["u1", "u2"],
    names: { u1: "Alpha", u2: "Bravo" },
    score: { u1: 5, u2: 2 },
    rounds: [],
    result: { winnerId: "u1", loserId: "u2", draw: false, reason: "normal" }
  };

  const view = await service._renderFinishedForUser(await users.load("u1"), battle);
  assert.match(String(view.caption || ""), /💎1/);
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

test("colosseum service: weekly rewards are paid on rollover for top-5 including admins", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo"),
    u3: makeUser("u3", "CharlieAdmin"),
    u4: makeUser("u4", "Delta"),
    u5: makeUser("u5", "Echo"),
    u6: makeUser("u6", "Foxtrot")
  });
  const sent = [];
  let nowTs = Date.UTC(2026, 2, 30, 12, 0, 0); // week A
  const service = new ColosseumService({
    db,
    users,
    now: () => nowTs,
    isAdmin: (id) => String(id) === "u3",
    bot: {
      async sendWithInline(chatId, text) {
        sent.push({ chatId: String(chatId), text: String(text || "") });
      }
    }
  });

  // First run arms current week only (no retro payout).
  await service.runTick();
  const armedA = await db.get(service._weeklyRewardsArmedWeekKey());
  assert.equal(String(armedA || ""), service._nowWeekKey());

  const weekA = String(armedA || "");
  await db.put(
    service._ratingKey(weekA),
    JSON.stringify([
      { userId: "u1", name: "Alpha", wins: 10, reachedAt: 1 },
      { userId: "u2", name: "Bravo", wins: 9, reachedAt: 2 },
      { userId: "u3", name: "CharlieAdmin", wins: 8, reachedAt: 3 },
      { userId: "u4", name: "Delta", wins: 7, reachedAt: 4 },
      { userId: "u5", name: "Echo", wins: 6, reachedAt: 5 },
      { userId: "u6", name: "Foxtrot", wins: 5, reachedAt: 6 }
    ])
  );

  // Move to next week -> payout for weekA.
  nowTs = Date.UTC(2026, 3, 6, 0, 5, 0); // week B
  await service.runTick();

  const u1 = await users.load("u1");
  const u2 = await users.load("u2");
  const u3 = await users.load("u3");
  const u4 = await users.load("u4");
  const u5 = await users.load("u5");
  const u6 = await users.load("u6");

  // Places from top list as-is:
  // 1:u1 2:u2 3:u3(admin) 4:u4 5:u5
  assert.equal(u1.money, 33000);
  assert.equal(u1.premium, 10);
  assert.equal(u2.money, 27000);
  assert.equal(u2.premium, 8);
  assert.equal(u3.money, 20000);
  assert.equal(u3.premium, 6);
  assert.equal(u4.money, 13000);
  assert.equal(u4.premium, 5);
  assert.equal(u5.money, 7000);
  assert.equal(u5.premium, 3);
  assert.equal(u6.money, 0);
  assert.equal(u6.premium, 0);

  assert.equal(sent.length, 5);

  // Idempotent: second run in same week must not duplicate rewards.
  await service.runTick();
  const u1Again = await users.load("u1");
  assert.equal(u1Again.money, 33000);
  assert.equal(u1Again.premium, 10);
});

test("colosseum service: timeout round advance keeps battle in open index", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  let nowTs = Date.UTC(2026, 2, 30, 15, 0, 0);
  const service = new ColosseumService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} }
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));
  await service.accept(await users.load("u2"));

  const me = await users.load("u1");
  const bid = String(me?.colosseum?.activeBattleId || "");
  const before = await loadBattle(db, bid);
  nowTs = Number(before.roundDeadline) + 1000;

  await service.runTick();

  const after = await loadBattle(db, bid);
  assert.equal(after.status, "active_round");
  assert.equal(after.currentRound, 2);
  assert.ok(Number(after.roundDeadline) > nowTs);
  const open = await loadOpenBattles(db);
  assert.equal(open.includes(bid), true);
});

test("colosseum service: buildBattleView self-heals lost open index and resolves timeout", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  let nowTs = Date.UTC(2026, 2, 30, 16, 0, 0);
  const service = new ColosseumService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} }
  });

  await service.joinQueue(await users.load("u1"));
  await service.joinQueue(await users.load("u2"));
  await service.accept(await users.load("u1"));
  await service.accept(await users.load("u2"));

  const me = await users.load("u1");
  const bid = String(me?.colosseum?.activeBattleId || "");
  const before = await loadBattle(db, bid);
  nowTs = Number(before.roundDeadline) + 1000;

  await db.put("colosseum:open:v1", JSON.stringify([]));
  await service.buildBattleView(await users.load("u1"));

  const after = await loadBattle(db, bid);
  assert.equal(after.status, "active_round");
  assert.equal(after.currentRound, 2);
  assert.ok(Number(after.roundDeadline) > nowTs);
  const open = await loadOpenBattles(db);
  assert.equal(open.includes(bid), true);
});
