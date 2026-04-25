import test from "node:test";
import assert from "node:assert/strict";
import { AdminCommands } from "../AdminCommands.js";

function makeUsers(rows) {
  const map = new Map(rows.map((u) => [`u:${u.id}`, JSON.stringify(u)]));
  const db = {
    async get(key) {
      return map.get(key) ?? null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
    async list({ prefix } = {}) {
      const keys = Array.from(map.keys())
        .filter((name) => !prefix || name.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    }
  };
  return {
    db,
    async getOrCreate(id) {
      const key = `u:${id}`;
      const raw = await db.get(key);
      if (raw) return JSON.parse(raw);
      return { id, study: { level: 0, active: false } };
    },
    async save(u) {
      await db.put(`u:${u.id}`, JSON.stringify(u));
      return u;
    },
    async load(id) {
      const raw = await db.get(`u:${id}`);
      return raw ? JSON.parse(raw) : null;
    }
  };
}

test("admin_study_ready makes active study due now and updates due index", async () => {
  const sent = [];
  const realNow = Date.now;
  Date.now = () => 10_000;
  try {
    const users = makeUsers([
      {
        id: 101,
        study: { level: 7, active: true, startAt: 1000, endAt: 999_999, notified: true }
      }
    ]);
    const admin = new AdminCommands({
      users,
      send: async (text) => { sent.push(String(text)); },
      isAdmin: (id) => String(id) === "admin-1",
      botToken: "test-token"
    });

    const handled = await admin.tryHandle("/admin_study_ready 101", { fromId: "admin-1" });

    assert.equal(handled, true);
    const u = await users.load(101);
    assert.equal(u.study.active, true);
    assert.equal(u.study.endAt, 9000);
    assert.equal(u.study.notified, false);
    assert.match(sent[0], /Study marked ready/i);
    assert.match(sent[0], /cron-run/i);

    const duePage = await users.db.list({ prefix: "due:" });
    assert.equal(duePage.keys.length, 1);
    assert.match(duePage.keys[0].name, /:study:101$/);
  } finally {
    Date.now = realNow;
  }
});

test("admin_study_ready skips user without active study", async () => {
  const sent = [];
  const users = makeUsers([
    { id: 102, study: { level: 3, active: false, startAt: 0, endAt: 0 } }
  ]);
  const admin = new AdminCommands({
    users,
    send: async (text) => { sent.push(String(text)); },
    isAdmin: (id) => String(id) === "admin-1",
    botToken: "test-token"
  });

  const handled = await admin.tryHandle("/admin_study_ready 102", { fromId: "admin-1" });

  assert.equal(handled, true);
  assert.match(sent[0], /no active study/i);
  const u = await users.load(102);
  assert.equal(u.study.active, false);
  assert.equal(u.study.level, 3);
});
