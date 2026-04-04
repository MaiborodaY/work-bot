import test from "node:test";
import assert from "node:assert/strict";
import { EnergyService } from "../EnergyService.js";
import { GymService } from "../GymService.js";

test("energy service: active gym pass increases effective max energy", () => {
  const u = {
    id: "u1",
    energy_max: 160,
    gymPass: { endAt: Date.UTC(2026, 3, 10, 0, 0, 0), notifiedEndAt: 0 }
  };
  const nowTs = Date.UTC(2026, 3, 9, 12, 0, 0);
  const effective = EnergyService.effectiveEnergyMax(u, nowTs);
  assert.equal(effective, 180);
});

test("energy service: clamp after pass expiration trims energy to base max", () => {
  const u = {
    id: "u2",
    energy: 178,
    energy_max: 160,
    gymPass: { endAt: Date.UTC(2026, 3, 9, 0, 0, 0), notifiedEndAt: 0 }
  };
  const nowTs = Date.UTC(2026, 3, 9, 12, 0, 0);
  const changed = EnergyService.clampEnergy(u, nowTs);
  assert.equal(changed, true);
  assert.equal(u.energy, 160);
});

test("gym service: buyPass requires base cap and enough gems", async () => {
  let saved = 0;
  const users = { save: async () => { saved += 1; } };
  const nowTs = Date.UTC(2026, 3, 9, 12, 0, 0);
  const gym = new GymService({ users, now: () => nowTs });

  const low = { id: "u3", energy_max: 155, premium: 100, gymPass: { endAt: 0, notifiedEndAt: 0 } };
  const lowRes = await gym.buyPass(low);
  assert.equal(lowRes.ok, false);
  assert.equal(lowRes.code, "pass_requires_max_energy");

  const noGems = { id: "u4", energy_max: 160, premium: 9, gymPass: { endAt: 0, notifiedEndAt: 0 } };
  const gemRes = await gym.buyPass(noGems);
  assert.equal(gemRes.ok, false);
  assert.equal(gemRes.code, "pass_not_enough_gems");

  const ok = { id: "u5", energy_max: 160, premium: 10, gymPass: { endAt: 0, notifiedEndAt: 0 } };
  const okRes = await gym.buyPass(ok);
  assert.equal(okRes.ok, true);
  assert.equal(ok.premium, 0);
  assert.equal(ok.gymPass.endAt, nowTs + EnergyService.passCfg().durationMs);
  assert.equal(saved, 1);
});

test("gym service: start training is blocked when base max energy cap reached", async () => {
  const users = { save: async () => {} };
  const gym = new GymService({ users, now: () => Date.UTC(2026, 3, 9, 12, 0, 0) });
  const u = {
    id: "u6",
    money: 1000,
    energy: 100,
    energy_max: 160,
    gym: { level: 0, active: false, startAt: 0, endAt: 0 },
    gymPass: { endAt: 0, notifiedEndAt: 0 }
  };
  const res = await gym.start(u);
  assert.equal(res.ok, false);
  assert.equal(res.code, "max_energy_reached");
});

