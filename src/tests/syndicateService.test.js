import test from "node:test";
import assert from "node:assert/strict";
import { SyndicateService } from "../SyndicateService.js";

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

  async list({ prefix = "", cursor = undefined } = {}) {
    void cursor;
    const keys = [];
    for (const key of this.map.keys()) {
      if (!String(key).startsWith(String(prefix))) continue;
      keys.push({ name: String(key) });
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
    if (!row) return null;
    return JSON.parse(JSON.stringify(row));
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

  async onEvent(user, event, ctx = {}) {
    this.events.push({
      userId: String(user?.id || ""),
      event: String(event || ""),
      bizId: String(ctx?.bizId || "")
    });
    return { changed: true };
  }
}

function makeUser(id, name) {
  return {
    id: String(id),
    chatId: Number(String(id).replace(/\D/g, "").slice(-6) || 1000),
    displayName: String(name),
    lang: "en",
    money: 10000,
    study: { level: 30, active: false },
    gym: { level: 0, active: false },
    achievements: { progress: {} },
    biz: {
      owned: [{ id: "shawarma" }]
    }
  };
}

test("syndicate: create + accept + resolve updates users and ratings", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  const achievements = new FakeAchievements();
  let nowTs = Date.UTC(2026, 3, 19, 10, 0, 0);

  const service = new SyndicateService({
    db,
    users,
    achievements,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  const created = await service.createDeal(u1, "shawarma", "small");
  assert.equal(created.ok, true);
  assert.equal(u1.money, 9500);
  const dealId = String(u1?.syndicate?.activeDealByBiz?.shawarma || "");
  assert.ok(dealId);

  const u2 = await users.load("u2");
  const accepted = await service.acceptDeal(u2, dealId);
  assert.equal(accepted.ok, true);
  assert.equal(u2.money, 9500);

  const activeDeal = await service._loadDeal(dealId);
  assert.equal(activeDeal.state, "active");

  const realRandom = Math.random;
  Math.random = () => 0.0; // success branch
  try {
    nowTs = Number(activeDeal.endAt) + 1;
    const tick = await service.runTick();
    assert.equal(tick.resolved, 1);
  } finally {
    Math.random = realRandom;
  }

  const s1 = await users.load("u1");
  const s2 = await users.load("u2");
  assert.equal(s1.money, 10040);
  assert.equal(s2.money, 10040);
  assert.equal(s1.syndicate.completedTotal, 1);
  assert.equal(s2.syndicate.completedTotal, 1);
  assert.equal(s1.syndicate.weightedTotal, 1);
  assert.equal(s2.syndicate.weightedTotal, 1);
  assert.equal(s1.syndicate.activeDealByBiz.shawarma, "");
  assert.equal(s2.syndicate.activeDealByBiz.shawarma, "");

  const weekTop = await service._loadRating("week");
  assert.equal(weekTop.length, 2);
  assert.equal(weekTop[0].score, 1);
  assert.equal(weekTop[1].score, 1);

  assert.equal(
    achievements.events.filter((x) => x.event === "syndicate_deal_completed").length,
    2
  );
});

test("syndicate: open deal expires and refunds creator", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha")
  });
  let nowTs = Date.UTC(2026, 3, 19, 10, 0, 0);
  const service = new SyndicateService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  const created = await service.createDeal(u1, "shawarma", "small");
  assert.equal(created.ok, true);
  const dealId = String(u1?.syndicate?.activeDealByBiz?.shawarma || "");
  const deal = await service._loadDeal(dealId);
  assert.equal(deal.state, "open");

  nowTs = Number(deal.expiresAt) + 1;
  const tick = await service.runTick();
  assert.equal(tick.expired, 1);

  const refreshedUser = await users.load("u1");
  const expiredDeal = await service._loadDeal(dealId);
  assert.equal(refreshedUser.money, 10000);
  assert.equal(refreshedUser.syndicate.activeDealByBiz.shawarma, "");
  assert.equal(expiredDeal.state, "expired");
});

test("syndicate: business view shows transparent tier odds and payouts", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha")
  });
  const service = new SyndicateService({
    db,
    users,
    now: () => Date.UTC(2026, 3, 19, 10, 0, 0),
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  const view = await service.buildBusinessView(u1, "shawarma");
  const caption = String(view?.caption || "");

  assert.match(caption, /Small unlocked/i);
  assert.match(caption, /80%\s*→\s*\+\$40/i);
  assert.match(caption, /15%\s*→\s*\+\$75/i);
  assert.match(caption, /5%\s*→\s*-\$50/i);
});

test("syndicate: odds view shows all configured businesses and rules notes", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha")
  });
  const service = new SyndicateService({
    db,
    users,
    now: () => Date.UTC(2026, 3, 19, 10, 0, 0),
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const u1 = await users.load("u1");
  const view = await service.buildOddsView(u1);
  const caption = String(view?.caption || "");

  assert.match(caption, /Stakes & odds/i);
  assert.match(caption, /Shawarma/i);
  assert.match(caption, /Dental Clinic/i);
  assert.match(caption, /Restaurant/i);
  assert.match(caption, /Courier/i);
  assert.match(caption, /Fitness/i);
  assert.match(caption, /Small \/ Medium \/ Large differ only by stake size/i);
});

test("syndicate: rating view appends clan tag to names", async () => {
  const db = new FakeDb();
  const users = new FakeUsers({
    u1: makeUser("u1", "Alpha"),
    u2: makeUser("u2", "Bravo")
  });
  const nowTs = Date.UTC(2026, 3, 19, 10, 0, 0);
  const service = new SyndicateService({
    db,
    users,
    now: () => nowTs,
    bot: { async sendWithInline() {} },
    isAdmin: () => false
  });

  const weekKey = service._nowWeekKey();
  await db.put(service._ratingWeekKey(weekKey), JSON.stringify([
    { userId: "u1", name: "Alpha", score: 7, completed: 3, net: 200, reachedAt: 1 },
    { userId: "u2", name: "Bravo", score: 5, completed: 2, net: 100, reachedAt: 2 }
  ]));
  await db.put("u:u1", JSON.stringify({ id: "u1", clan: { clanId: "c1" } }));
  await db.put("u:u2", JSON.stringify({ id: "u2", clan: { clanId: "c2" } }));
  await db.put("clan:item:c1", JSON.stringify({ id: "c1", name: "Wolves" }));
  await db.put("clan:item:c2", JSON.stringify({ id: "c2", name: "Dragons" }));

  const view = await service.buildRatingView(await users.load("u1"), "week");
  const caption = String(view?.caption || "");

  assert.match(caption, /Alpha \[Wolves\]/);
  assert.match(caption, /Bravo \[Dragons\]/);
});
