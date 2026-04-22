import test from "node:test";
import assert from "node:assert/strict";
import { FishingService } from "../FishingService.js";

class FakeDb {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  async put(key, value) { this.map.set(String(key), String(value)); }
  async delete(key) { this.map.delete(String(key)); }
  async list({ prefix = "" } = {}) {
    const keys = [];
    for (const key of this.map.keys()) {
      if (String(key).startsWith(String(prefix))) keys.push({ name: String(key) });
    }
    return { keys, list_complete: true };
  }
}

class FakeUsers {
  constructor(seed = {}) {
    this.store = new Map(
      Object.entries(seed).map(([id, row]) => [String(id), JSON.parse(JSON.stringify(row))])
    );
  }
  async load(id) {
    const row = this.store.get(String(id));
    return row ? JSON.parse(JSON.stringify(row)) : null;
  }
  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    this.store.set(String(clone.id), clone);
    return clone;
  }
}

class FakeAchievements {
  constructor() { this.events = []; }
  async onEvent(user, event, ctx = {}) {
    this.events.push({ userId: String(user?.id || ""), event: String(event || "") });
    return { changed: true };
  }
}

function makeUser(id, name, level = 10) {
  return {
    id: String(id),
    chatId: Number(String(id).replace(/\D/g, "").slice(-6) || 1000),
    displayName: String(name),
    lang: "en",
    money: 10000,
    study: { level, active: false },
    gym: { level: 0, active: false },
    achievements: { progress: {} }
  };
}

function makeService({ db, users, achievements, nowTs } = {}) {
  let ts = nowTs || Date.UTC(2026, 3, 20, 10, 0, 0);
  return new FishingService({
    db: db || new FakeDb(),
    users,
    achievements: achievements || new FakeAchievements(),
    now: () => ts,
    bot: { async sendWithInline() {} },
    isAdmin: () => false,
    _setNow: (v) => { ts = v; }
  });
}

// ── Test 1: create + join + resolve (CC) ────────────────────────────────────

test("fishing: create + join + resolve CC updates both users", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alice"),
    u2: makeUser("u2", "Bob")
  });
  const achievements = new FakeAchievements();
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);

  const svc = new FishingService({
    db, users, achievements,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  const created = await svc.createSession(u1, "pond");
  assert.equal(created.ok, true, "create should succeed");
  assert.equal(u1.money, 9700, "stake $300 deducted from creator");
  const sessionId = created.sessionId;
  assert.ok(sessionId, "sessionId returned");

  const u2 = await users.load("u2");
  svc._ensureUserState(u2);
  const joined = await svc.joinSession(u2, sessionId);
  assert.equal(joined.ok, true, "join should succeed");
  assert.equal(u2.money, 9700, "stake $300 deducted from partner");

  const session = await svc._loadDeal(sessionId);
  assert.equal(session.state, "active");
  assert.equal(session.creatorId, "u1");
  assert.equal(session.partnerId, "u2");

  // Both choose honestly
  const c1 = await svc.submitChoice(u1, sessionId, "C");
  assert.equal(c1.ok, true);
  const c2 = await svc.submitChoice(u2, sessionId, "C");
  assert.equal(c2.ok, true);

  // Fast-forward past endAt
  nowTs = Number(session.endAt) + 1;
  const tick = await svc.runTick();
  assert.equal(tick.resolved, 1, "one session resolved");

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  // CC pond: stake $300 back + profit $600 = $900 total return; started with 9700 → 10600
  assert.equal(s1.money, 10600, "u1 CC payout correct");
  assert.equal(s2.money, 10600, "u2 CC payout correct");
  assert.equal(s1.fishing.completedTotal, 1);
  assert.equal(s2.fishing.completedTotal, 1);
  assert.equal(s1.fishing.ccStreak, 1);
  assert.equal(s2.fishing.ccStreak, 1);
  assert.equal(s1.fishing.activeSession, "");
  assert.equal(s2.fishing.activeSession, "");

  const finished = await svc._loadDeal(sessionId);
  assert.equal(finished.state, "finished");
  assert.equal(finished.result.creatorProfit, 600);
  assert.equal(finished.result.partnerProfit, 600);

  assert.ok(achievements.events.some((e) => e.event === "fishing_session_completed"), "achievement fired");
  assert.ok(achievements.events.some((e) => e.event === "fishing_cc_result"), "CC achievement fired");
});

// ── Test 2: DC outcome (creator greedy, partner honest) ─────────────────────

test("fishing: DC outcome — greedy takes more, honest gets zero profit", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alice"),
    u2: makeUser("u2", "Bob")
  });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  await svc.createSession(u1, "pond");
  const sessionId = u1.fishing.activeSession;

  const u2 = await users.load("u2");
  svc._ensureUserState(u2);
  await svc.joinSession(u2, sessionId);

  await svc.submitChoice(u1, sessionId, "D"); // creator greedy
  await svc.submitChoice(u2, sessionId, "C"); // partner honest

  const session = await svc._loadDeal(sessionId);
  nowTs = Number(session.endAt) + 1;
  const tick = await svc.runTick();
  assert.equal(tick.resolved, 1);

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  // DC: creator gets stake $300 + profit $1000 = $1300; started with 9700 → 11000
  assert.equal(s1.money, 11000, "greedy creator gets DC payout");
  // CD honest: partner gets stake $300 + $0 profit = $300; started with 9700 → 10000
  assert.equal(s2.money, 10000, "honest partner gets only stake back");
  assert.equal(s1.fishing.ccStreak, 0, "greedy breaks CC streak");
  assert.equal(s2.fishing.ccStreak, 0);
});

// ── Test 3: open session expires and refunds creator ────────────────────────

test("fishing: open session expires and refunds creator", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({ u1: makeUser("u1", "Alice") });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  const created = await svc.createSession(u1, "pond");
  assert.equal(created.ok, true);
  assert.equal(u1.money, 9700);

  const session = await svc._loadDeal(created.sessionId);
  assert.equal(session.state, "open");

  nowTs = Number(session.expiresAt) + 1;
  const tick = await svc.runTick();
  assert.equal(tick.expired, 1);

  const refreshed = await users.load("u1");
  assert.equal(refreshed.money, 10000, "stake refunded on expiry");
  assert.equal(refreshed.fishing.activeSession, "");

  const expired = await svc._loadDeal(created.sessionId);
  assert.equal(expired.state, "expired");
});

// ── Test 4: DD outcome — both get zero profit ────────────────────────────────

test("fishing: DD outcome — both greedy, both get zero profit", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alice"),
    u2: makeUser("u2", "Bob")
  });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  await svc.createSession(u1, "pond");
  const sessionId = u1.fishing.activeSession;

  const u2 = await users.load("u2");
  svc._ensureUserState(u2);
  await svc.joinSession(u2, sessionId);
  await svc.submitChoice(u1, sessionId, "D");
  await svc.submitChoice(u2, sessionId, "D");

  const session = await svc._loadDeal(sessionId);
  nowTs = Number(session.endAt) + 1;
  await svc.runTick();

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  // DD: both get stake back only → 9700 + 300 = 10000
  assert.equal(s1.money, 10000, "DD: u1 gets only stake back");
  assert.equal(s2.money, 10000, "DD: u2 gets only stake back");
});

// ── Test 5: auto-Честно when no choice made ──────────────────────────────────

test("fishing: no choice made defaults to Честно (C)", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alice"),
    u2: makeUser("u2", "Bob")
  });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  await svc.createSession(u1, "pond");
  const sessionId = u1.fishing.activeSession;

  const u2 = await users.load("u2");
  svc._ensureUserState(u2);
  await svc.joinSession(u2, sessionId);
  // Neither submits a choice → both default to C → CC outcome

  const session = await svc._loadDeal(sessionId);
  nowTs = Number(session.endAt) + 1;
  await svc.runTick();

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  // CC payout: 9700 + 300 + 600 = 10600
  assert.equal(s1.money, 10600, "auto-C defaults to CC for u1");
  assert.equal(s2.money, 10600, "auto-C defaults to CC for u2");
});

// ── Test 6: cannot join own session ─────────────────────────────────────────

test("fishing: creator cannot join own session", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({ u1: makeUser("u1", "Alice") });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  const created = await svc.createSession(u1, "pond");
  const joined = await svc.joinSession(u1, created.sessionId);
  assert.equal(joined.ok, false);
  assert.match(joined.error, /own/i);
});

// ── Test 7: cannot submit choice twice ──────────────────────────────────────

test("fishing: cannot submit choice twice", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alice"),
    u2: makeUser("u2", "Bob")
  });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  await svc.createSession(u1, "pond");
  const sessionId = u1.fishing.activeSession;

  const u2 = await users.load("u2");
  svc._ensureUserState(u2);
  await svc.joinSession(u2, sessionId);

  await svc.submitChoice(u1, sessionId, "C");
  const second = await svc.submitChoice(u1, sessionId, "D");
  assert.equal(second.ok, false);
  assert.match(second.error, /already/i);
});

// ── Test 8: spot lock — cannot fish at lake without level 2 ─────────────────

test("fishing: locked spot rejects low-level fisher", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({ u1: makeUser("u1", "Alice") });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  // completedTotal = 0 → level 1 → lake requires level 2
  const res = await svc.createSession(u1, "lake");
  assert.equal(res.ok, false);
  assert.match(res.error, /unlock/i);
});

// ── Test 9: reputation and pair history update correctly ────────────────────

test("fishing: reputation and pair history updated after session", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alice"),
    u2: makeUser("u2", "Bob")
  });
  let nowTs = Date.UTC(2026, 3, 20, 10, 0, 0);
  const svc = new FishingService({
    db, users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  svc._ensureUserState(u1);
  await svc.createSession(u1, "pond");
  const sessionId = u1.fishing.activeSession;

  const u2 = await users.load("u2");
  svc._ensureUserState(u2);
  await svc.joinSession(u2, sessionId);
  await svc.submitChoice(u1, sessionId, "C");
  await svc.submitChoice(u2, sessionId, "D"); // u2 greedy

  const session = await svc._loadDeal(sessionId);
  nowTs = Number(session.endAt) + 1;
  await svc.runTick();

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");

  // recentOutcomes: u1 was C (honest), u2 was D (greedy)
  assert.deepEqual(s1.fishing.recentOutcomes, ["C"]);
  assert.deepEqual(s2.fishing.recentOutcomes, ["D"]);

  // partnerHistory: u1 sees {me:C, them:D}, u2 sees {me:D, them:C}
  assert.deepEqual(s1.fishing.partnerHistory["u2"], [{ me: "C", them: "D" }]);
  assert.deepEqual(s2.fishing.partnerHistory["u1"], [{ me: "D", them: "C" }]);
});

// ── Test 10: fishing level progression ──────────────────────────────────────

test("fishing: fishing level computed from completedTotal", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({ u1: makeUser("u1", "Alice") });
  const svc = new FishingService({ db, users, now: () => Date.now(), bot: { async sendWithInline() {} }, isAdmin: () => false });

  const u = await users.load("u1");
  svc._ensureUserState(u);

  u.fishing.completedTotal = 0;  assert.equal(svc._fishingLevel(u), 1);
  u.fishing.completedTotal = 4;  assert.equal(svc._fishingLevel(u), 1);
  u.fishing.completedTotal = 5;  assert.equal(svc._fishingLevel(u), 2);
  u.fishing.completedTotal = 19; assert.equal(svc._fishingLevel(u), 2);
  u.fishing.completedTotal = 20; assert.equal(svc._fishingLevel(u), 3);
  u.fishing.completedTotal = 50; assert.equal(svc._fishingLevel(u), 4);
  u.fishing.completedTotal = 100;assert.equal(svc._fishingLevel(u), 5);
});
