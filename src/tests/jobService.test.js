import test from "node:test";
import assert from "node:assert/strict";
import { JobService } from "../JobService.js";

class FakeUsers {
  constructor(seed = {}) {
    this.store = new Map(Object.entries(seed).map(([id, u]) => [String(id), JSON.parse(JSON.stringify(u))]));
    this.db = null;
  }

  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    this.store.set(String(clone.id), clone);
    return clone;
  }

  async load(id) {
    const v = this.store.get(String(id));
    return v ? JSON.parse(JSON.stringify(v)) : null;
  }
}

function baseUser(overrides = {}) {
  return {
    id: "u1",
    lang: "ru",
    displayName: "Tester",
    money: 0,
    energy: 180,
    energy_max: 180,
    upgrades: [],
    jobs: { slotMax: 1, active: [] },
    study: { level: 0 },
    ...overrides
  };
}

test("job service: farmer requires 180 max energy", async () => {
  const nowTs = Date.UTC(2026, 3, 16, 18, 0, 0);
  const users = new FakeUsers({ u1: baseUser({ energy: 180, energy_max: 160 }) });
  const jobs = new JobService({ users, now: () => nowTs, random: () => 0.5 });
  const u = await users.load("u1");

  const res = await jobs.start(u, "farmer");

  assert.equal(res.ok, false);
  assert.equal(res.code, "not_enough_energy_cap");
  assert.equal(res.needEnergyCap, 180);
  assert.equal(res.haveEnergyCap, 160);
});

test("job service: farmer start rolls planned pay inside configured range", async () => {
  const nowTs = Date.UTC(2026, 3, 16, 18, 30, 0);
  const users = new FakeUsers({ u1: baseUser() });
  const jobs = new JobService({ users, now: () => nowTs, random: () => 0.5 });
  const u = await users.load("u1");

  const res = await jobs.start(u, "farmer");

  assert.equal(res.ok, true);
  assert.equal(res.inst.typeId, "farmer");
  assert.equal(res.inst.energySpent, 180);
  assert.equal(res.inst.plannedPay >= 1500, true);
  assert.equal(res.inst.plannedPay <= 3500, true);
});

test("job service: farmer claim pays rolled amount in range", async () => {
  let nowTs = Date.UTC(2026, 3, 16, 19, 0, 0);
  const users = new FakeUsers({ u1: baseUser() });
  const jobs = new JobService({ users, now: () => nowTs, random: () => 0.9999 });
  const startUser = await users.load("u1");
  const started = await jobs.start(startUser, "farmer");
  assert.equal(started.ok, true);

  nowTs = started.inst.endAt + 1;
  const claimUser = await users.load("u1");
  const claim = await jobs.claim(claimUser);

  assert.equal(claim.ok, true);
  assert.equal(claim.pay, 3500);
  const saved = await users.load("u1");
  assert.equal(saved.money, 3500);
  assert.equal(Array.isArray(saved.jobs.active) && saved.jobs.active.length, 0);
});

test("job service: farmer claim can award mango seed bonus", async () => {
  let nowTs = Date.UTC(2026, 3, 16, 19, 0, 0);
  const users = new FakeUsers({ u1: baseUser({ inv: {} }) });
  const jobs = new JobService({ users, now: () => nowTs, random: () => 0.1 });
  const startUser = await users.load("u1");
  const started = await jobs.start(startUser, "farmer");
  assert.equal(started.ok, true);

  nowTs = started.inst.endAt + 1;
  const claimUser = await users.load("u1");
  const claim = await jobs.claim(claimUser);

  assert.equal(claim.ok, true);
  assert.equal(claim.guaranteedDrop?.itemId, "fertilizer");
  assert.equal(claim.guaranteedDrop?.qty, 1);
  assert.equal(claim.bonusDrop?.itemId, "mango_seed");
  assert.equal(claim.bonusDrop?.qty, 1);
  const saved = await users.load("u1");
  assert.equal(saved.inv.mango_seed, 1);
  assert.equal(saved.inv.fertilizer, 1);
});

test("job service: non-farmer jobs do not award mango seed", async () => {
  let nowTs = Date.UTC(2026, 3, 16, 19, 0, 0);
  const users = new FakeUsers({ u1: baseUser({ inv: {}, energy: 10, energy_max: 10 }) });
  const jobs = new JobService({ users, now: () => nowTs, random: () => 0.1 });
  const startUser = await users.load("u1");
  const started = await jobs.start(startUser, "flyers");
  assert.equal(started.ok, true);

  nowTs = started.inst.endAt + 1;
  const claimUser = await users.load("u1");
  const claim = await jobs.claim(claimUser);

  assert.equal(claim.ok, true);
  assert.equal(claim.bonusDrop || null, null);
  assert.equal(claim.guaranteedDrop || null, null);
  const saved = await users.load("u1");
  assert.equal(saved.inv?.mango_seed || 0, 0);
  assert.equal(saved.inv?.fertilizer || 0, 0);
});

test("job service: farmer claim always awards fertilizer", async () => {
  let nowTs = Date.UTC(2026, 3, 16, 19, 0, 0);
  const users = new FakeUsers({ u1: baseUser({ inv: {} }) });
  const jobs = new JobService({ users, now: () => nowTs, random: () => 0.95 });
  const startUser = await users.load("u1");
  const started = await jobs.start(startUser, "farmer");
  assert.equal(started.ok, true);

  nowTs = started.inst.endAt + 1;
  const claimUser = await users.load("u1");
  const claim = await jobs.claim(claimUser);

  assert.equal(claim.ok, true);
  assert.equal(claim.guaranteedDrop?.itemId, "fertilizer");
  assert.equal(claim.bonusDrop || null, null);
  const saved = await users.load("u1");
  assert.equal(saved.inv.fertilizer, 1);
});
