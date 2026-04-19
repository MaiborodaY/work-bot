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
  firstActiveDay,
  lastActiveDay,
  activeDays,
  newbie,
  newbiePath
}) {
  return {
    id,
    displayName: name,
    flags: { onboardingDone: true },
    referral: {
      startSource,
      startPayload,
      referredBy
    },
    stats: {
      firstActiveDay,
      lastActiveDay,
      activeDays,
      newbie
    },
    newbiePath
  };
}

test("admin_newbie reports funnel, source split, retention and detail lists", async () => {
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
          completedDay: "",
          maxStepSeen: 2,
          maxStepClaimed: 1,
          stepsSeen: { "1": "2026-04-10", "2": "2026-04-10" },
          stepsClaimed: { "1": "2026-04-10" }
        },
        newbiePath: { step: 2, pending: false, completed: false }
      }),
      makeUser({
        id: "ref-1",
        name: "Ref User",
        startSource: "ref",
        startPayload: "ref_123",
        referredBy: "123",
        firstActiveDay: "2026-04-05",
        lastActiveDay: "2026-04-14",
        activeDays: ["2026-04-05", "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-12", "2026-04-14"],
        newbie: {
          openedDay: "2026-04-05",
          completedDay: "2026-04-07",
          maxStepSeen: 10,
          maxStepClaimed: 10,
          stepsSeen: {
            "1": "2026-04-05", "2": "2026-04-05", "3": "2026-04-05", "4": "2026-04-05",
            "5": "2026-04-05", "6": "2026-04-06", "7": "2026-04-06", "8": "2026-04-07", "9": "2026-04-07", "10": "2026-04-07"
          },
          stepsClaimed: {
            "1": "2026-04-05", "2": "2026-04-05", "3": "2026-04-05", "4": "2026-04-05",
            "5": "2026-04-06", "6": "2026-04-06", "7": "2026-04-06", "8": "2026-04-07", "9": "2026-04-07", "10": "2026-04-07"
          }
        },
        newbiePath: { step: 11, pending: false, completed: true }
      }),
      makeUser({
        id: "org-1",
        name: "Organic User",
        firstActiveDay: "2026-04-15",
        lastActiveDay: "2026-04-15",
        activeDays: ["2026-04-15"],
        newbie: {
          openedDay: "2026-04-15",
          completedDay: "",
          maxStepSeen: 3,
          maxStepClaimed: 2,
          stepsSeen: { "1": "2026-04-15", "2": "2026-04-15", "3": "2026-04-15" },
          stepsClaimed: { "1": "2026-04-15", "2": "2026-04-15" }
        },
        newbiePath: { step: 3, pending: true, completed: false }
      }),
      makeUser({
        id: "legacy-no-open",
        name: "Legacy No Open",
        firstActiveDay: "2026-04-01",
        lastActiveDay: "2026-04-12",
        activeDays: ["2026-04-01", "2026-04-12"],
        newbie: {
          openedDay: "",
          completedDay: "",
          maxStepSeen: 0,
          maxStepClaimed: 0,
          stepsSeen: {},
          stepsClaimed: {}
        },
        newbiePath: { step: 1, pending: false, completed: false }
      })
    ];
    const db = makeDb(users);
    const admin = new AdminCommands({
      users: { db },
      send: async (text) => { sent.push(String(text)); },
      isAdmin: (id) => String(id) === "admin-1",
      botToken: "test-token"
    });

    const handled = await admin.tryHandle("/admin_newbie", { fromId: "admin-1" });

    assert.equal(handled, true);
    assert.equal(sent.length, 4);
    assert.match(sent[0], /Newbie stats started/);
    assert.match(sent[1], /Newbie path analytics/);
    assert.match(sent[1], /Started: 3/);
    assert.match(sent[1], /Completed: 1 \(33%\)/);
    assert.match(sent[1], /ads_\*: started 1 · completed 0 \(0%\)/);
    assert.match(sent[1], /ref_\*: started 1 · completed 1 \(100%\)/);
    assert.match(sent[1], /organic: started 1 · completed 0 \(0%\)/);
    assert.match(sent[1], /1\. daily bonus — seen 3 · claimed 3 · active 0 · pending 0/);
    assert.match(sent[1], /2\. flyers job — seen 3 · claimed 2 · active 1 · pending 0/);
    assert.match(sent[1], /3\. start study — seen 2 · claimed 1 · active 0 · pending 1/);
    assert.match(sent[1], /Path started: D1 2\/2 \(100%\) · D3 2\/2 \(100%\) · D7 1\/1 \(100%\)/);
    assert.match(sent[1], /Step 3 claimed: D1 1\/1 \(100%\) · D3 1\/1 \(100%\) · D7 1\/1 \(100%\)/);
    assert.match(sent[1], /Step 5 claimed: D1 1\/1 \(100%\) · D3 1\/1 \(100%\) · D7 0\/1 \(0%\)/);
    assert.match(sent[1], /Path completed: D1 1\/1 \(100%\) · D3 1\/1 \(100%\) · D7 1\/1 \(100%\)/);
    assert.match(sent[2], /Stalled users/);
    assert.match(sent[2], /ads-1/);
    assert.match(sent[2], /flyers job \(active\) · inactive 2d · ads_\*/);
    assert.match(sent[3], /Recent completions/);
    assert.match(sent[3], /ref-1/);
    assert.match(sent[3], /completed 2026-04-07 · last 2026-04-14 · ref_\*/);
  } finally {
    Date.now = realNow;
  }
});
