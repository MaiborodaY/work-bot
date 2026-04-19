import test from "node:test";
import assert from "node:assert/strict";
import { AdminCommands } from "../AdminCommands.js";

function makeDb(rows) {
  const map = new Map(rows.map((u) => [`u:${u.id}`, JSON.stringify(u)]));
  return {
    async list() {
      return {
        keys: Array.from(map.keys()).map((name) => ({ name })),
        list_complete: true
      };
    },
    async get(key) {
      return map.get(key) ?? null;
    }
  };
}

function makeUser({ id, name, study = 0, gym = 0, lastActiveDay = "" }) {
  return {
    id,
    displayName: name,
    study: { level: study, active: false },
    gym: { level: gym, active: false },
    achievements: { progress: {} },
    stats: {
      lastActiveDay
    }
  };
}

test("admin_levels reports level snapshot, buckets, active windows and top list", async () => {
  const sent = [];
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 3, 19, 12, 0, 0); // 2026-04-19
  try {
    const users = [
      makeUser({ id: "boss", name: "Boss", study: 25, lastActiveDay: "2026-04-19" }),
      makeUser({ id: "u1", name: "Alpha", study: 0, lastActiveDay: "2026-04-19" }),
      makeUser({ id: "u2", name: "Bravo", study: 1, lastActiveDay: "2026-04-18" }),
      makeUser({ id: "u3", name: "Charlie", study: 8, lastActiveDay: "2026-04-11" }),
      makeUser({ id: "u4", name: "Delta", study: 20, lastActiveDay: "2026-03-31" })
    ];
    const db = makeDb(users);
    const admin = new AdminCommands({
      users: { db },
      send: async (text) => { sent.push(String(text)); },
      isAdmin: (id) => String(id) === "admin-1" || String(id) === "boss",
      botToken: "test-token"
    });

    const handled = await admin.tryHandle("/admin_levels", { fromId: "admin-1" });

    assert.equal(handled, true);
    assert.equal(sent.length, 2);
    assert.match(sent[0], /Levels stats started/);
    assert.match(sent[1], /Player levels snapshot/);
    assert.match(sent[1], /Scope: non-admin users/);
    assert.match(sent[1], /Scanned users \(non-admin\): 4/);
    assert.match(sent[1], /Active last 7d: 2/);
    assert.match(sent[1], /Active last 30d: 4/);
    assert.match(sent[1], /Avg level: 3\.8/);
    assert.match(sent[1], /Median: 3/);
    assert.match(sent[1], /P90: 8/);
    assert.match(sent[1], /Max: 8/);
    assert.match(sent[1], /1-5: 3/);
    assert.match(sent[1], /6-10: 1/);
    assert.match(sent[1], /Users >=15: 0/);
    assert.match(sent[1], /Top 15 by level/);
    assert.match(sent[1], /1\. Delta .*lvl 8/);
    assert.match(sent[1], /2\. Charlie .*lvl 4/);
    assert.match(sent[1], /Excluded admins: 1/);
  } finally {
    Date.now = realNow;
  }
});
