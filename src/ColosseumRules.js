function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function safeDayKey(dayKey) {
  return String(dayKey || "").trim();
}

function safeWeekKey(weekKey) {
  return String(weekKey || "").trim();
}

function ensureColosseumShape(u) {
  if (!u || typeof u !== "object") return false;
  if (!u.colosseum || typeof u.colosseum !== "object") {
    u.colosseum = {
      dayKey: "",
      battlesToday: 0,
      weekKey: "",
      weekWins: 0,
      activeBattleId: "",
      inQueue: false
    };
    return true;
  }

  let changed = false;
  const c = u.colosseum;

  if (typeof c.dayKey !== "string") {
    c.dayKey = "";
    changed = true;
  }
  if (typeof c.weekKey !== "string") {
    c.weekKey = "";
    changed = true;
  }
  const battlesToday = Math.max(0, toInt(c.battlesToday, 0));
  if (battlesToday !== c.battlesToday) {
    c.battlesToday = battlesToday;
    changed = true;
  }
  const weekWins = Math.max(0, toInt(c.weekWins, 0));
  if (weekWins !== c.weekWins) {
    c.weekWins = weekWins;
    changed = true;
  }
  if (typeof c.activeBattleId !== "string") {
    c.activeBattleId = "";
    changed = true;
  }
  if (typeof c.inQueue !== "boolean") {
    c.inQueue = false;
    changed = true;
  }
  return changed;
}

function rollDailyCounterIfNeeded(u, todayDayKey) {
  ensureColosseumShape(u);
  const c = u.colosseum;
  const today = safeDayKey(todayDayKey);
  if (!today) return false;
  if (safeDayKey(c.dayKey) === today) return false;
  c.dayKey = today;
  c.battlesToday = 0;
  return true;
}

export function canQueueByDailyLimit(u, todayDayKey, dailyLimit = 10) {
  ensureColosseumShape(u);
  rollDailyCounterIfNeeded(u, todayDayKey);
  const limit = Math.max(1, toInt(dailyLimit, 10));
  return Math.max(0, toInt(u.colosseum.battlesToday, 0)) < limit;
}

export function canStartByDailyLimit(u, todayDayKey, dailyLimit = 10) {
  return canQueueByDailyLimit(u, todayDayKey, dailyLimit);
}

export function isRoundSelectionValid(attackZone, defenseZone) {
  const a = String(attackZone || "").trim();
  const d = String(defenseZone || "").trim();
  if (!a || !d) return false;
  return a !== d;
}

export function nextDefenseZones(attackZone) {
  const zones = ["head", "body", "legs"];
  const attack = String(attackZone || "").trim();
  return zones.filter((z) => z !== attack);
}

export function shouldResetQueueAtMidnight(prevDayKey, currentDayKey) {
  const prev = safeDayKey(prevDayKey);
  const cur = safeDayKey(currentDayKey);
  if (!prev || !cur) return false;
  return prev !== cur;
}

export function applyWeeklyKeyReset(u, currentWeekKey) {
  ensureColosseumShape(u);
  const current = safeWeekKey(currentWeekKey);
  if (!current) return false;
  if (safeWeekKey(u.colosseum.weekKey) === current) return false;
  u.colosseum.weekKey = current;
  u.colosseum.weekWins = 0;
  return true;
}

export function clearBattleStateOnFinish(u) {
  ensureColosseumShape(u);
  u.colosseum.activeBattleId = "";
  u.colosseum.inQueue = false;
}

