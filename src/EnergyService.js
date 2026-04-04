import { CONFIG } from "./GameConfig.js";

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class EnergyService {
  static passCfg() {
    const raw = CONFIG?.GYM_PASS || {};
    return {
      bonusEnergyMax: Math.max(0, toInt(raw.BONUS_ENERGY_MAX, 20)),
      priceGems: Math.max(0, toInt(raw.PRICE_GEMS, 10)),
      durationMs: Math.max(60_000, toInt(raw.DURATION_MS, 7 * 24 * 60 * 60 * 1000))
    };
  }

  static gymBaseCap() {
    return Math.max(0, toInt(CONFIG?.GYM?.MAX_ENERGY_CAP, 160));
  }

  static ensureGymPassModel(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;
    if (!u.gymPass || typeof u.gymPass !== "object") {
      u.gymPass = {
        endAt: 0,
        notifiedEndAt: 0
      };
      return true;
    }
    if (typeof u.gymPass.endAt !== "number" || !Number.isFinite(u.gymPass.endAt)) {
      u.gymPass.endAt = 0;
      dirty = true;
    }
    if (typeof u.gymPass.notifiedEndAt !== "number" || !Number.isFinite(u.gymPass.notifiedEndAt)) {
      u.gymPass.notifiedEndAt = 0;
      dirty = true;
    }
    if (u.gymPass.endAt < 0) {
      u.gymPass.endAt = 0;
      dirty = true;
    }
    if (u.gymPass.notifiedEndAt < 0) {
      u.gymPass.notifiedEndAt = 0;
      dirty = true;
    }
    return dirty;
  }

  static isGymPassActive(u, nowTs = Date.now()) {
    this.ensureGymPassModel(u);
    return toInt(u?.gymPass?.endAt, 0) > toInt(nowTs, Date.now());
  }

  static gymPassState(u, nowTs = Date.now()) {
    this.ensureGymPassModel(u);
    const endAt = Math.max(0, toInt(u?.gymPass?.endAt, 0));
    const now = toInt(nowTs, Date.now());
    const active = endAt > now;
    const leftMs = active ? Math.max(0, endAt - now) : 0;
    const notifiedEndAt = Math.max(0, toInt(u?.gymPass?.notifiedEndAt, 0));
    const expiredNeedsNotify = endAt > 0 && endAt <= now && notifiedEndAt !== endAt;
    return {
      endAt,
      active,
      leftMs,
      notifiedEndAt,
      expiredNeedsNotify
    };
  }

  static effectiveEnergyMax(u, nowTs = Date.now()) {
    const base = Math.max(0, toInt(u?.energy_max, toInt(CONFIG?.ENERGY_MAX, 0)));
    const pass = this.gymPassState(u, nowTs);
    if (!pass.active) return base;
    const bonus = this.passCfg().bonusEnergyMax;
    return base + bonus;
  }

  static clampEnergy(u, nowTs = Date.now()) {
    if (!u || typeof u !== "object") return false;
    const max = this.effectiveEnergyMax(u, nowTs);
    const current = Math.max(0, toInt(u?.energy, 0));
    const next = clamp(current, 0, max);
    if (next === u.energy) return false;
    u.energy = next;
    return true;
  }

  static activateGymPass(u, nowTs = Date.now()) {
    this.ensureGymPassModel(u);
    const now = toInt(nowTs, Date.now());
    const durationMs = this.passCfg().durationMs;
    const endAt = now + durationMs;
    u.gymPass.endAt = endAt;
    u.gymPass.notifiedEndAt = 0;
    return endAt;
  }

  static markGymPassExpiredNotified(u, endAt) {
    this.ensureGymPassModel(u);
    const targetEndAt = Math.max(0, toInt(endAt, 0));
    if (!targetEndAt) return false;
    if (u.gymPass.notifiedEndAt === targetEndAt) return false;
    u.gymPass.notifiedEndAt = targetEndAt;
    return true;
  }
}

