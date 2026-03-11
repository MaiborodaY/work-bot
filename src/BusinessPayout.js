export function getTodayUTC(ts = Date.now()) {
  return new Date(Number(ts) || Date.now()).toISOString().slice(0, 10);
}

export function normalizeBusinessEntry(entry, bizId = "") {
  const out = (entry && typeof entry === "object") ? entry : { id: String(bizId || "") };
  if (typeof out.id !== "string") out.id = String(bizId || out.id || "");
  if (typeof out.boughtAt !== "number" || !Number.isFinite(out.boughtAt)) out.boughtAt = 0;
  if (typeof out.lastClaimDayUTC !== "string") out.lastClaimDayUTC = "";
  if (typeof out.pendingTheftAmount !== "number" || !Number.isFinite(out.pendingTheftAmount)) {
    out.pendingTheftAmount = 0;
  } else {
    out.pendingTheftAmount = Math.max(0, Math.floor(Number(out.pendingTheftAmount) || 0));
  }
  // Legacy thief fields. Kept for safe migration from older data.
  if (typeof out.stolenDayUTC !== "string") out.stolenDayUTC = "";
  if (typeof out.stolenAmountToday !== "number" || !Number.isFinite(out.stolenAmountToday)) out.stolenAmountToday = 0;
  out.stolenAmountToday = Math.max(0, Math.floor(Number(out.stolenAmountToday) || 0));
  return out;
}

export function getBusinessPendingTheft(entry, daily) {
  const e = normalizeBusinessEntry(entry);
  const safeDaily = Math.max(0, Math.floor(Number(daily) || 0));
  const pending = Math.max(0, Math.floor(Number(e.pendingTheftAmount) || 0));
  return Math.max(0, Math.min(safeDaily, pending));
}

export function getBusinessAvailableToday(entry, daily, todayUTC = getTodayUTC()) {
  const e = normalizeBusinessEntry(entry);
  if (String(e.lastClaimDayUTC || "") === String(todayUTC || "")) return 0;
  const base = Math.max(0, Math.floor(Number(daily) || 0));
  const pending = getBusinessPendingTheft(e, base);
  return Math.max(0, base - pending);
}

export function getBusinessStealableForNextClaim(entry, daily, ownerRemainPct = 0.5) {
  const e = normalizeBusinessEntry(entry);
  const safeDaily = Math.max(0, Math.floor(Number(daily) || 0));
  const ownerPct = Math.max(0, Math.min(1, Number(ownerRemainPct) || 0));
  const pending = getBusinessPendingTheft(e, safeDaily);
  const nextClaimReward = Math.max(0, safeDaily - pending);
  const ownerMinReward = Math.max(0, Math.floor(safeDaily * ownerPct));
  return Math.max(0, nextClaimReward - ownerMinReward);
}

export function addBusinessPendingTheft(entry, daily, amount, ownerRemainPct = 0.5) {
  const e = normalizeBusinessEntry(entry);
  const safeDaily = Math.max(0, Math.floor(Number(daily) || 0));
  const addAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const ownerPct = Math.max(0, Math.min(1, Number(ownerRemainPct) || 0));
  const maxPending = Math.max(0, safeDaily - Math.floor(safeDaily * ownerPct));
  const current = getBusinessPendingTheft(e, safeDaily);
  const next = Math.max(0, Math.min(maxPending, current + addAmount));
  e.pendingTheftAmount = next;
  return next - current;
}

export function applyBusinessClaim(entry, daily, todayUTC = getTodayUTC()) {
  const e = normalizeBusinessEntry(entry);
  const reward = getBusinessAvailableToday(e, daily, todayUTC);
  e.lastClaimDayUTC = String(todayUTC || "");
  e.pendingTheftAmount = 0;
  // Keep legacy fields clean.
  e.stolenDayUTC = "";
  e.stolenAmountToday = 0;
  return reward;
}
