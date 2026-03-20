export function getTodayUTC(ts = Date.now()) {
  return new Date(Number(ts) || Date.now()).toISOString().slice(0, 10);
}

export function normalizeBusinessEntry(entry, bizId = "") {
  const out = (entry && typeof entry === "object") ? entry : { id: String(bizId || "") };
  if (typeof out.id !== "string") out.id = String(bizId || out.id || "");
  if (typeof out.boughtAt !== "number" || !Number.isFinite(out.boughtAt)) out.boughtAt = 0;
  if (typeof out.lastClaimDayUTC !== "string") out.lastClaimDayUTC = "";
  const pendingParsed = Number(out.pendingTheftAmount);
  out.pendingTheftAmount = Number.isFinite(pendingParsed)
    ? Math.max(0, Math.floor(pendingParsed))
    : 0;
  const guardUntilParsed = Number(out.guardUntil);
  out.guardUntil = Number.isFinite(guardUntilParsed)
    ? Math.max(0, Math.floor(guardUntilParsed))
    : 0;
  const immunityUntilParsed = Number(out.immunityUntil);
  out.immunityUntil = Number.isFinite(immunityUntilParsed)
    ? Math.max(0, Math.floor(immunityUntilParsed))
    : 0;
  const guardBlockedParsed = Number(out.guardBlocked);
  out.guardBlocked = Number.isFinite(guardBlockedParsed)
    ? Math.max(0, Math.floor(guardBlockedParsed))
    : 0;
  if (!Array.isArray(out.theftLog)) {
    out.theftLog = [];
  } else {
    const normLog = [];
    for (const raw of out.theftLog) {
      if (!raw || typeof raw !== "object") continue;
      const eventId = String(raw.eventId || "").trim();
      const thiefId = String(raw.thiefId || "").trim();
      const amount = Math.max(0, Math.floor(Number(raw.amount) || 0));
      const ts = Math.max(0, Math.floor(Number(raw.ts) || 0));
      const biz = String(raw.bizId || out.id || bizId || "").trim();
      const revealed = !!raw.revealed;
      if (!eventId || !thiefId || !amount || !ts || !biz) continue;
      normLog.push({ eventId, thiefId, amount, bizId: biz, ts, revealed });
    }
    out.theftLog = normLog;
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
