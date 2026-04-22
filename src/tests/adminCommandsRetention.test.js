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

function makeUser({
  id,
  name,
  startSource = "",
  startPayload = "",
  referredBy = "",
  firstActiveDay = "",
  lastActiveDay = "",
  activeDays = [],
  newbie = null
}) {
  return {
    id,
    displayName: name,
    referral: {
      startSource,
      startPayload,
      referredBy
    },
    stats: {
      firstActiveDay,
      lastActiveDay,
      activeDays,
      newbie: newbie || undefined
    }
  };
}

test("admin_retention includes newbie-path slice inside recent cohort", async () => {
  const sent = [];
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 3, 15, 12, 0, 0);
  try {
    const users = [
      makeUser({
        id: "ads-1",
        name: "Ads User",
        startSource: "ads",
        startPayload: "ads_en_20260410",
        firstActiveDay: "2026-04-10",
        lastActiveDay: "2026-04-13",
        activeDays: ["2026-04-10", "2026-04-11", "2026-04-13"],
        newbie: {
          openedDay: "2026-04-10",
          completedDay: ""
        }
      }),
      makeUser({
        id: "ref-1",
        name: "Ref User",
        startSource: "ref",
        startPayload: "ref_123",
        referredBy: "123",
        firstActiveDay: "2026-04-08",
        lastActiveDay: "2026-04-15",
        activeDays: ["2026-04-08", "2026-04-09", "2026-04-11", "2026-04-12", "2026-04-14", "2026-04-15"],
        newbie: {
          openedDay: "2026-04-08",
          completedDay: "2026-04-11"
        }
      }),
      makeUser({
        id: "org-1",
        name: "Organic User",
        firstActiveDay: "2026-04-15",
        lastActiveDay: "2026-04-15",
        activeDays: ["2026-04-15"],
        newbie: {
          openedDay: "",
          completedDay: ""
        }
      }),
      makeUser({
        id: "legacy-1",
        name: "Legacy User",
        lastActiveDay: "2026-04-15",
        activeDays: ["2026-04-15"]
      })
    ];

    const db = makeDb(users);
    const admin = new AdminCommands({
      users: { db },
      send: async (text) => { sent.push(String(text)); },
      isAdmin: (id) => String(id) === "admin-1",
      botToken: "test-token"
    });

    const handled = await admin.tryHandle("/admin_retention", { fromId: "admin-1" });

    assert.equal(handled, true);
    assert.equal(sent.length, 2);
    assert.match(sent[0], /Retention stats started/);
    assert.match(sent[1], /Retention \(last 30 days\)/);
    assert.match(sent[1], /New players \(first useful action\): 3/);
    assert.match(sent[1], /D1 retention: 2\/2 \(100%\)/);
    assert.match(sent[1], /D3 retention: 2\/2 \(100%\)/);
    assert.match(sent[1], /D7 retention: 1\/1 \(100%\)/);
    assert.match(sent[1], /Newbie path inside this cohort/);
    assert.match(sent[1], /Started path: 2\/3 \(67%\)/);
    assert.match(sent[1], /Completed path: 1\/3 \(33%\)/);
    assert.match(sent[1], /After path start: D1 2\/2 \(100%\) .* D3 2\/2 \(100%\) .* D7 1\/1 \(100%\)/);
    assert.match(sent[1], /After path complete: D1 1\/1 \(100%\) .* D3 1\/1 \(100%\) .* D7 0\/0 \(0%\)/);
    assert.match(sent[1], /Without firstActiveDay \(legacy users\): 1/);
  } finally {
    Date.now = realNow;
  }
});
