import test from "node:test";
import assert from "node:assert/strict";
import { AdminCommands } from "../AdminCommands.js";

function makeDb(rows) {
  const map = new Map(rows.map((u) => [`u:${u.id}`, JSON.stringify(u)]));
  return {
    async list() {
      return { keys: Array.from(map.keys()).map((name) => ({ name })), list_complete: true };
    },
    async get(key) {
      return map.get(key) ?? null;
    }
  };
}

test("admin_market reports period stats", async () => {
  const sent = [];
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 3, 30, 12, 0, 0); // 2026-04-30
  try {
    const users = [
      {
        id: "u1",
        displayName: "Alpha",
        stats: {
          marketSalesTotal: 5,
          marketGrossTotal: 2600,
          marketNetTotal: 900,
          marketUnitsTotal: 7,
          marketDays: [
            { day: "2026-04-30", sales: 2, gross: 1000, net: 350, units: 3 },
            { day: "2026-04-29", sales: 1, gross: 500, net: 150, units: 1 }
          ],
          farmIncomeDays: [{ day: "2026-04-30", amount: 350 }]
        }
      },
      {
        id: "u2",
        displayName: "Bravo",
        stats: {
          marketSalesTotal: 0,
          marketGrossTotal: 0,
          marketNetTotal: 0,
          marketUnitsTotal: 0,
          marketDays: []
        }
      },
      { id: "admin_user", displayName: "Boss", stats: {} }
    ];
    const admin = new AdminCommands({
      users: { db: makeDb(users) },
      send: async (text) => sent.push(String(text)),
      isAdmin: (id) => String(id) === "admin" || String(id) === "admin_user",
      botToken: "test-token"
    });

    const handled = await admin.tryHandle("/admin_market 7d", { fromId: "admin" });
    assert.equal(handled, true);
    assert.equal(sent.length, 2);
    assert.match(sent[0], /Market stats started/);
    assert.match(sent[1], /Market analytics/);
    assert.match(sent[1], /Last 7 days/);
    assert.match(sent[1], /Users with market activity: 1/);
    assert.match(sent[1], /Transactions: 3/);
    assert.match(sent[1], /Gross sold: \$1,500/);
    assert.match(sent[1], /Net profit: \$500/);
    assert.match(sent[1], /Excluded admins: 1/);
  } finally {
    Date.now = realNow;
  }
});

test("admin_supply reports all-time totals", async () => {
  const sent = [];
  const users = [
    {
      id: "u1",
      displayName: "Alpha",
      stats: {
        supplyOrdersTotal: 4,
        supplyUnlocksTotal: 1,
        supplySlotsBoughtTotal: 1,
        supplySpentTotal: 12000
      }
    },
    {
      id: "u2",
      displayName: "Bravo",
      stats: {
        supplyOrdersTotal: 2,
        supplyUnlocksTotal: 0,
        supplySlotsBoughtTotal: 0,
        supplySpentTotal: 0
      }
    }
  ];
  const admin = new AdminCommands({
    users: { db: makeDb(users) },
    send: async (text) => sent.push(String(text)),
    isAdmin: (id) => String(id) === "admin",
    botToken: "test-token"
  });

  const handled = await admin.tryHandle("/admin_supply all", { fromId: "admin" });
  assert.equal(handled, true);
  assert.equal(sent.length, 2);
  assert.match(sent[0], /Supply stats started/);
  assert.match(sent[1], /Business supply analytics/);
  assert.match(sent[1], /All time/);
  assert.match(sent[1], /Users with supply activity: 2/);
  assert.match(sent[1], /Orders submitted: 6/);
  assert.match(sent[1], /Supply unlocks: 1/);
  assert.match(sent[1], /Slots bought: 1/);
  assert.match(sent[1], /Money spent: \$12,000/);
});

