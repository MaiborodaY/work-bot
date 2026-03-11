export function getTodayUTC(ts = Date.now()) {
  return new Date(Number(ts) || Date.now()).toISOString().slice(0, 10);
}

export function normalizeBusinessEntry(entry, bizId = "") {
  const out = (entry && typeof entry === "object") ? entry : { id: String(bizId || "") };
  if (typeof out.id !== "string") out.id = String(bizId || out.id || "");
  if (typeof out.boughtAt !== "number" || !Number.isFinite(out.boughtAt)) out.boughtAt = 0;
  if (typeof out.lastClaimDayUTC !== "string") out.lastClaimDayUTC = "";
  if (typeof out.stolenDayUTC !== "string") out.stolenDayUTC = "";
  if (typeof out.stolenAmountToday !== "number" || !Number.isFinite(out.stolenAmountToday)) {
    out.stolenAmountToday = 0;
  } else {
    out.stolenAmountToday = Math.max(0, Math.floor(Number(out.stolenAmountToday) || 0));
  }
  return out;
}

export function getStolenToday(entry, todayUTC = getTodayUTC()) {
  const e = normalizeBusinessEntry(entry);
  if (String(e.stolenDayUTC || "") !== String(todayUTC || "")) return 0;
  return Math.max(0, Math.floor(Number(e.stolenAmountToday) || 0));
}

export function getBusinessAvailableToday(entry, daily, todayUTC = getTodayUTC()) {
  const e = normalizeBusinessEntry(entry);
  if (String(e.lastClaimDayUTC || "") === String(todayUTC || "")) return 0;
  const base = Math.max(0, Math.floor(Number(daily) || 0));
  const stolen = getStolenToday(e, todayUTC);
  return Math.max(0, base - stolen);
}

export function addBusinessStolenToday(entry, daily, amount, todayUTC = getTodayUTC()) {
  const e = normalizeBusinessEntry(entry);
  const safeDaily = Math.max(0, Math.floor(Number(daily) || 0));
  const addAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const current = getStolenToday(e, todayUTC);
  const next = Math.max(0, Math.min(safeDaily, current + addAmount));
  e.stolenDayUTC = String(todayUTC || "");
  e.stolenAmountToday = next;
  return next - current;
}

export function applyBusinessClaim(entry, daily, todayUTC = getTodayUTC()) {
  const e = normalizeBusinessEntry(entry);
  const reward = getBusinessAvailableToday(e, daily, todayUTC);
  e.lastClaimDayUTC = String(todayUTC || "");
  e.stolenDayUTC = String(todayUTC || "");
  e.stolenAmountToday = 0;
  return reward;
}

