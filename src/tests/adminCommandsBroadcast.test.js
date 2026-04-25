import test from "node:test";
import assert from "node:assert/strict";
import { AdminCommands } from "../AdminCommands.js";

function makeUsersAndDb(rows = [], extraEntries = []) {
  const map = new Map(rows.map((u) => [`u:${u.id}`, JSON.stringify(u)]));
  for (const [key, value] of extraEntries) {
    map.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  const db = {
    async list({ prefix } = {}) {
      const keys = Array.from(map.keys())
        .filter((name) => !prefix || String(name).startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
    async get(key) {
      return map.get(key) ?? null;
    },
    async put(key, value) {
      map.set(key, String(value));
    },
    async delete(key) {
      map.delete(key);
    }
  };
  return {
    db,
    async save(u) {
      await db.put(`u:${u.id}`, JSON.stringify(u));
      return u;
    }
  };
}

test("broadcast_status marks stale run and broadcast_send asks for reset", async () => {
  const sent = [];
  const users = makeUsersAndDb(
    [{ id: "admin-1", premium: 0 }],
    [[
      "admin:broadcast:active",
      {
        runId: "bc_1774887592183",
        status: "running",
        startedAt: "2026-03-30T16:19:52.183Z",
        processed: 150,
        total: 577,
        sent: 91,
        failed: 59,
        blocked: 58
      }
    ]]
  );
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 3, 25, 12, 0, 0);
  try {
    const admin = new AdminCommands({
      users,
      send: async (text) => { sent.push(String(text)); },
      isAdmin: (id) => String(id) === "admin-1",
      botToken: "test-token"
    });

    const handledStatus = await admin.tryHandle("/broadcast_status", { fromId: "admin-1" });
    const handledSend = await admin.tryHandle("/broadcast_send", { fromId: "admin-1" });

    assert.equal(handledStatus, true);
    assert.equal(handledSend, true);
    assert.match(sent[0], /Broadcast status: stale/i);
    assert.match(sent[0], /Reset required: \/broadcast_reset confirm/i);
    assert.match(sent[1], /stale broadcast lock/i);
    assert.match(sent[1], /broadcast_reset confirm/i);
  } finally {
    Date.now = realNow;
  }
});

test("broadcast_reset confirm clears active run and writes history entry", async () => {
  const sent = [];
  const users = makeUsersAndDb(
    [{ id: "admin-1", premium: 0 }],
    [[
      "admin:broadcast:active",
      {
        runId: "bc_1774887592183",
        status: "running",
        startedAt: "2026-03-30T16:19:52.183Z",
        processed: 150,
        total: 577,
        sent: 91,
        failed: 59,
        blocked: 58
      }
    ]]
  );
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 3, 25, 12, 0, 0);
  try {
    const admin = new AdminCommands({
      users,
      send: async (text) => { sent.push(String(text)); },
      isAdmin: (id) => String(id) === "admin-1",
      botToken: "test-token"
    });

    const handled = await admin.tryHandle("/broadcast_reset confirm", { fromId: "admin-1" });

    assert.equal(handled, true);
    assert.match(sent[0], /Broadcast reset done/i);
    assert.match(sent[0], /Previous state: stale/i);
    assert.match(sent[0], /Saved to history as: failed/i);
    assert.equal(await users.db.get("admin:broadcast:active"), null);
    const rawHistory = await users.db.get("admin:broadcast:history");
    assert.ok(rawHistory);
    const history = JSON.parse(rawHistory);
    assert.equal(Array.isArray(history), true);
    assert.equal(history[0].runId, "bc_1774887592183");
    assert.equal(history[0].status, "failed");
    assert.match(String(history[0].lastError || ""), /stale broadcast reset/i);
  } finally {
    Date.now = realNow;
  }
});
