import test from "node:test";
import assert from "node:assert/strict";
import { AdminCommands } from "../AdminCommands.js";

function makeUsers(rows) {
  const map = new Map(rows.map((u) => [`u:${u.id}`, JSON.stringify(u)]));
  const db = {
    async list() {
      return {
        keys: Array.from(map.keys()).map((name) => ({ name })),
        list_complete: true
      };
    },
    async get(key) {
      return map.get(key) ?? null;
    },
    async put(key, value) {
      map.set(key, String(value));
    }
  };
  return {
    db,
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

test("givegem_all requires confirm and does not change balances without it", async () => {
  const sent = [];
  const users = makeUsers([
    { id: "admin-1", premium: 10 },
    { id: "u1", premium: 5 }
  ]);
  const admin = new AdminCommands({
    users,
    send: async (text) => { sent.push(String(text)); },
    isAdmin: (id) => String(id) === "admin-1",
    botToken: "test-token"
  });

  const handled = await admin.tryHandle("/givegem_all 50", { fromId: "admin-1" });

  assert.equal(handled, true);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /Bulk grant is protected/i);
  assert.match(sent[0], /givegem_all 50 confirm/i);
  assert.equal((await users.load("admin-1")).premium, 10);
  assert.equal((await users.load("u1")).premium, 5);
});

test("givegem_all adds gems to every user including admins", async () => {
  const sent = [];
  const users = makeUsers([
    { id: "admin-1", premium: 10 },
    { id: "u1", premium: 5 },
    { id: "u2", premium: 0 }
  ]);
  const admin = new AdminCommands({
    users,
    send: async (text) => { sent.push(String(text)); },
    isAdmin: (id) => String(id) === "admin-1",
    botToken: "test-token"
  });

  const handled = await admin.tryHandle("/givegem_all 50 confirm", { fromId: "admin-1" });

  assert.equal(handled, true);
  assert.equal(sent.length, 2);
  assert.match(sent[0], /Bulk gems grant started/i);
  assert.match(sent[1], /Bulk gems grant done/i);
  assert.match(sent[1], /Amount per user: 💎50/);
  assert.match(sent[1], /Scanned users: 3/);
  assert.match(sent[1], /Updated users: 3/);
  assert.match(sent[1], /Total granted: 💎150/);
  assert.equal((await users.load("admin-1")).premium, 60);
  assert.equal((await users.load("u1")).premium, 55);
  assert.equal((await users.load("u2")).premium, 50);
});
