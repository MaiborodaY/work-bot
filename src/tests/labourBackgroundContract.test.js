import test from "node:test";
import assert from "node:assert/strict";
import { LabourService } from "../LabourService.js";

function makeDb() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(String(key), String(value));
    },
    async delete(key) {
      store.delete(String(key));
    },
    async list({ prefix = "", cursor } = {}) {
      if (cursor) return { keys: [], list_complete: true };
      const keys = [];
      for (const k of store.keys()) {
        if (String(k).startsWith(String(prefix))) keys.push({ name: k });
      }
      return { keys, list_complete: true };
    }
  };
}

function makeUsers(db, usersById) {
  const map = new Map(Object.entries(usersById).map(([id, u]) => [String(id), structuredClone(u)]));
  return {
    db,
    async load(id) {
      const u = map.get(String(id));
      if (!u) throw new Error("not found");
      return structuredClone(u);
    },
    async save(u) {
      map.set(String(u.id), structuredClone(u));
    },
    async update(id, mutator) {
      const current = map.get(String(id));
      if (!current) throw new Error("not found");
      const next = await mutator(structuredClone(current));
      map.set(String(id), structuredClone(next));
      return structuredClone(next);
    }
  };
}

function makeFixture() {
  const owner = {
    id: "owner1",
    displayName: "Owner",
    money: 100000,
    premium: 100,
    energy_max: 120,
    biz: {
      owned: [{
        id: "shawarma",
        boughtAt: 0,
        lastClaimDayUTC: "",
        slots: [{
          purchased: true,
          employeeId: "",
          contractStart: 0,
          contractEnd: 0,
          earnedTotal: 0,
          lastEmployeeId: "",
          ownerPct: 0.03,
          bonusCarry: 0
        }]
      }]
    }
  };
  const employee = {
    id: "emp1",
    displayName: "Worker",
    money: 500,
    premium: 0,
    energy_max: 40,
    employment: { active: false }
  };
  return { owner, employee };
}

test("labour bg: hire creates fixed snapshot and ignores work claim side effects", async () => {
  const db = makeDb();
  const { owner, employee } = makeFixture();
  const users = makeUsers(db, { [owner.id]: owner, [employee.id]: employee });

  let nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const labour = new LabourService({ db, users, now: () => nowTs, bot: null });

  const ownerLoaded = await users.load(owner.id);
  const res = await labour.hire(ownerLoaded, "shawarma", 0, employee.id);
  assert.equal(res.ok, true);
  assert.equal(res.plan.totalShifts, 24);
  assert.equal(res.plan.shiftPay, 37.5);
  assert.equal(res.plan.employeeTotal, 900);
  assert.equal(res.plan.ownerMoneyTotal, 54);
  assert.equal(res.plan.ownerGemsTotal, 1);

  const empAfterHire = await users.load(employee.id);
  assert.equal(empAfterHire.employment.active, true);
  assert.equal(empAfterHire.employment.model, "bg_fixed_v1");

  const ownerBeforeClaim = await users.load(owner.id);
  const ownerMoneyBeforeClaim = ownerBeforeClaim.money;
  const onPaid = await labour.onEmployeePaid(empAfterHire, 500, nowTs);
  assert.equal(onPaid.applied, false);
  assert.equal(onPaid.mode, "bg_fixed_v1");
  const ownerAfterClaim = await users.load(owner.id);
  assert.equal(ownerAfterClaim.money, ownerMoneyBeforeClaim);
});

test("labour bg: pays employee+owner at contract end exactly once", async () => {
  const db = makeDb();
  const { owner, employee } = makeFixture();
  const users = makeUsers(db, { [owner.id]: owner, [employee.id]: employee });

  let nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const labour = new LabourService({ db, users, now: () => nowTs, bot: null });

  const ownerLoaded = await users.load(owner.id);
  const res = await labour.hire(ownerLoaded, "shawarma", 0, employee.id);
  assert.equal(res.ok, true);

  nowTs = Number(res.contractEnd) + 1;
  const empLoaded = await users.load(employee.id);
  await labour.ensureEmploymentFresh(empLoaded);

  const empAfter = await users.load(employee.id);
  const ownerAfter = await users.load(owner.id);
  assert.equal(empAfter.money, 500 + 900);
  assert.equal(ownerAfter.money, 100000 + 54);
  assert.equal(ownerAfter.premium, 100 + 1);
  assert.equal(empAfter.employment.active, false);
  assert.equal(ownerAfter.biz.owned[0].slots[0].employeeId, "");

  await labour.ensureEmploymentFresh(await users.load(employee.id));
  const empAfterSecond = await users.load(employee.id);
  const ownerAfterSecond = await users.load(owner.id);
  assert.equal(empAfterSecond.money, empAfter.money);
  assert.equal(ownerAfterSecond.money, ownerAfter.money);
  assert.equal(ownerAfterSecond.premium, ownerAfter.premium);
});

test("labour bg: stale employee read right after hire does not clear active slot", async () => {
  const db = makeDb();
  const { owner, employee } = makeFixture();

  const map = new Map([
    [String(owner.id), structuredClone(owner)],
    [String(employee.id), structuredClone(employee)]
  ]);
  let staleEmployeeReadsLeft = 1;

  const users = {
    db,
    async load(id) {
      const key = String(id);
      const cur = map.get(key);
      if (!cur) throw new Error("not found");
      if (key === String(employee.id) && staleEmployeeReadsLeft > 0) {
        staleEmployeeReadsLeft -= 1;
        return {
          ...structuredClone(cur),
          employment: {
            active: false,
            ownerId: "",
            bizId: "",
            ownerPct: 0,
            contractEnd: 0,
            slotIndex: -1
          }
        };
      }
      return structuredClone(cur);
    },
    async save(u) {
      map.set(String(u.id), structuredClone(u));
    },
    async update(id, mutator) {
      const key = String(id);
      const current = map.get(key);
      if (!current) throw new Error("not found");
      const next = await mutator(structuredClone(current));
      map.set(key, structuredClone(next));
      return structuredClone(next);
    }
  };

  let nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const labour = new LabourService({ db, users, now: () => nowTs, bot: null });

  const ownerLoaded = await users.load(owner.id);
  const res = await labour.hire(ownerLoaded, "shawarma", 0, employee.id);
  assert.equal(res.ok, true);

  await labour.buildBizView(ownerLoaded, "shawarma");

  const ownerAfter = await users.load(owner.id);
  const slot = ownerAfter.biz?.owned?.[0]?.slots?.[0];
  assert.equal(String(slot?.employeeId || ""), String(employee.id));
  assert.ok(Number(slot?.contractEnd || 0) > nowTs);
});

test("labour bg: reconcileOwnerSlots does not reload owner from KV on dirty save", async () => {
  const db = makeDb();
  const owner = {
    id: "owner-stale",
    displayName: "Owner",
    money: 1000,
    premium: 10,
    biz: {
      owned: [{
        id: "shawarma",
        boughtAt: 0,
        lastClaimDayUTC: "",
        // Legacy shape forces dirty path inside reconcile (_ensureSlots migration).
        slot: {
          purchased: true,
          employeeId: "",
          contractStart: 0,
          contractEnd: 0,
          earnedTotal: 0,
          lastEmployeeId: "",
          ownerPct: 0.06
        }
      }]
    }
  };

  const map = new Map([[String(owner.id), structuredClone(owner)]]);
  let ownerLoadCalls = 0;
  const users = {
    db,
    async load(id) {
      if (String(id) === String(owner.id)) ownerLoadCalls += 1;
      const u = map.get(String(id));
      if (!u) throw new Error("not found");
      return structuredClone(u);
    },
    async save(u) {
      map.set(String(u.id), structuredClone(u));
    },
    async update(id, mutator) {
      const current = map.get(String(id));
      if (!current) throw new Error("not found");
      const next = await mutator(structuredClone(current));
      map.set(String(id), structuredClone(next));
      return structuredClone(next);
    }
  };

  const labour = new LabourService({ db, users, now: () => Date.UTC(2026, 2, 15, 12, 0, 0), bot: null });
  const ownerInMemory = structuredClone(owner);
  const after = await labour.reconcileOwnerSlots(ownerInMemory);

  assert.equal(ownerLoadCalls, 0);
  assert.ok(Array.isArray(after?.biz?.owned?.[0]?.slots));
  assert.equal(Boolean(after?.biz?.owned?.[0]?.slots?.[0]?.purchased), true);
});

test("labour bg: expiry payout survives legacy string totals", async () => {
  const db = makeDb();
  const { owner, employee } = makeFixture();
  const users = makeUsers(db, { [owner.id]: owner, [employee.id]: employee });

  let nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const labour = new LabourService({ db, users, now: () => nowTs, bot: null });

  const hireRes = await labour.hire(await users.load(owner.id), "shawarma", 0, employee.id);
  assert.equal(hireRes.ok, true);

  const empAfterHire = await users.load(employee.id);
  empAfterHire.employment.bgEmployeeTotal = "900";
  empAfterHire.employment.bgOwnerMoneyTotal = "54";
  empAfterHire.employment.bgOwnerGemsTotal = "1";
  empAfterHire.employment.bgShiftPay = "37.5";
  empAfterHire.employment.bgTotalShifts = "24";
  empAfterHire.employment.ownerPct = "0.06";
  await users.save(empAfterHire);

  const ownerAfterHire = await users.load(owner.id);
  ownerAfterHire.biz.owned[0].slots[0].bgOwnerMoneyTotal = "54";
  ownerAfterHire.biz.owned[0].slots[0].bgOwnerGemsTotal = "1";
  await users.save(ownerAfterHire);

  nowTs = Number(hireRes.contractEnd) + 1;
  await labour.ensureEmploymentFresh(await users.load(employee.id));

  const empAfter = await users.load(employee.id);
  const ownerAfter = await users.load(owner.id);
  assert.equal(empAfter.money, 500 + 900);
  assert.equal(ownerAfter.money, 100000 + 54);
  assert.equal(ownerAfter.premium, 100 + 1);
});
