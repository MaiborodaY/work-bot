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

test("broadcast_send stores recipients and completes through multiple batches", async () => {
  const sent = [];
  const recipients = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, chatId: 1000 + i }));
  const users = makeUsersAndDb(recipients, [[
    "admin:broadcast:draft:admin-1",
    { type: "text", text: "Hello batch", updatedAt: "2026-04-25T10:00:00.000Z" }
  ]]);
  const admin = new AdminCommands({
    users,
    send: async (text) => { sent.push(String(text)); },
    isAdmin: (id) => String(id) === "admin-1",
    botToken: "test-token"
  });
  const delivered = [];
  admin._sleep = async () => {};
  admin._sendDraft = async (chatId) => {
    delivered.push(chatId);
    return { ok: true };
  };

  const handled = await admin.tryHandle("/broadcast_send", { fromId: "admin-1" });

  assert.equal(handled, true);
  assert.equal(delivered.length, 50);
  let active = JSON.parse(await users.db.get("admin:broadcast:active"));
  assert.equal(active.total, 120);
  assert.equal(active.processed, 50);
  assert.equal(active.nextIndex, 50);
  assert.equal(active.sent, 50);
  assert.equal(active.recipients.length, 120);

  await admin.runBroadcastBatch();
  active = JSON.parse(await users.db.get("admin:broadcast:active"));
  assert.equal(delivered.length, 100);
  assert.equal(active.processed, 100);
  assert.equal(active.nextIndex, 100);

  await admin.runBroadcastBatch();
  assert.equal(delivered.length, 120);
  assert.equal(await users.db.get("admin:broadcast:active"), null);
  const history = JSON.parse(await users.db.get("admin:broadcast:history"));
  assert.equal(history[0].status, "done");
  assert.equal(history[0].sent, 120);
  assert.equal(history[0].total, 120);
});

test("broadcast_resume_legacy continues from processed index without duplicating earlier recipients", async () => {
  const sent = [];
  const recipients = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, chatId: 1000 + i }));
  const users = makeUsersAndDb(recipients, [
    [
      "admin:broadcast:active",
      {
        runId: "bc_1777108144067",
        status: "running",
        startedAt: "2026-04-25T09:09:04.067Z",
        startedBy: "admin-1",
        type: "text",
        total: 765,
        processed: 100,
        sent: 57,
        failed: 43,
        blocked: 41
      }
    ],
    [
      "admin:broadcast:draft:admin-1",
      { type: "text", text: "Legacy hello", updatedAt: "2026-04-25T09:00:00.000Z" }
    ]
  ]);
  const admin = new AdminCommands({
    users,
    send: async (text) => { sent.push(String(text)); },
    isAdmin: (id) => String(id) === "admin-1",
    botToken: "test-token"
  });
  const delivered = [];
  admin._sleep = async () => {};
  admin._sendDraft = async (chatId) => {
    delivered.push(chatId);
    return { ok: true };
  };

  const handled = await admin.tryHandle("/broadcast_resume_legacy confirm", { fromId: "admin-1" });

  assert.equal(handled, true);
  assert.match(sent[0], /Legacy broadcast resumed/i);
  assert.deepEqual(delivered, recipients.slice(100).map((u) => u.chatId));
  assert.equal(await users.db.get("admin:broadcast:active"), null);
  const history = JSON.parse(await users.db.get("admin:broadcast:history"));
  assert.equal(history[0].runId, "bc_1777108144067");
  assert.equal(history[0].status, "done");
  assert.equal(history[0].processed, 120);
  assert.equal(history[0].sent, 77);
  assert.equal(history[0].failed, 43);
  assert.equal(history[0].blocked, 41);
});
