const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_DAYS_LIMIT = 45;
const FARM_INCOME_DAYS_LIMIT = 35;
const NEWBIE_STEP_KEYS = ["1","2","3","4","5","6","7","8","9"];

export function dayStrUtc(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDayStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function parseDayUtc(day) {
  const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function dayDiffUtc(fromDay, toDay) {
  const a = parseDayUtc(fromDay);
  const b = parseDayUtc(toDay);
  if (!a || !b) return 0;
  return Math.floor((b - a) / DAY_MS);
}

export function addDaysUtc(day, deltaDays = 0) {
  const base = parseDayUtc(day);
  if (!base) return "";
  return dayStrUtc(base + Math.floor(Number(deltaDays) || 0) * DAY_MS);
}

export function ensurePlayerStatsShape(u) {
  if (!u || typeof u !== "object") return false;
  let changed = false;
  if (!u.stats || typeof u.stats !== "object") {
    u.stats = {};
    changed = true;
  }
  const s = u.stats;
  if (typeof s.dailyTop1Count !== "number" || !Number.isFinite(s.dailyTop1Count)) {
    s.dailyTop1Count = 0;
    changed = true;
  }
  if (typeof s.dailyTop3Count !== "number" || !Number.isFinite(s.dailyTop3Count)) {
    s.dailyTop3Count = 0;
    changed = true;
  }
  if (typeof s.dailyTop10Count !== "number" || !Number.isFinite(s.dailyTop10Count)) {
    s.dailyTop10Count = 0;
    changed = true;
  }

  if (!isDayStr(s.lastActiveDay)) {
    if (s.lastActiveDay !== "") {
      s.lastActiveDay = "";
      changed = true;
    } else if (typeof s.lastActiveDay !== "string") {
      s.lastActiveDay = "";
      changed = true;
    }
  }
  if (!isDayStr(s.firstActiveDay)) {
    if (s.firstActiveDay !== "") {
      s.firstActiveDay = "";
      changed = true;
    } else if (typeof s.firstActiveDay !== "string") {
      s.firstActiveDay = "";
      changed = true;
    }
  }

  const oldDays = Array.isArray(s.activeDays) ? s.activeDays : [];
  const daySet = new Set();
  for (const d of oldDays) {
    if (isDayStr(d)) daySet.add(String(d));
  }
  const normalizedDays = [...daySet].sort().slice(-ACTIVE_DAYS_LIMIT);
  if (!Array.isArray(s.activeDays) || normalizedDays.length !== oldDays.length ||
      normalizedDays.some((d, i) => d !== oldDays[i])) {
    s.activeDays = normalizedDays;
    changed = true;
  }

  const funnelFlags = ["didFirstShift", "didFirstClaim", "didGym", "didBar", "didBusiness"];
  for (const f of funnelFlags) {
    if (typeof s[f] !== "boolean") {
      s[f] = false;
      changed = true;
    }
  }

  const numFields = [
    "farmHarvestCount",
    "farmMoneyTotal",
    "farmMoneyWeek",
    "bizClaimDayTotal",
    "gquizDayEarned",
    "labourDayMoney",
    "labourDayGems"
  ];
  for (const f of numFields) {
    if (typeof s[f] !== "number" || !Number.isFinite(s[f])) {
      s[f] = 0;
      changed = true;
    }
  }
  if (typeof s.farmWeekKey !== "string") {
    s.farmWeekKey = "";
    changed = true;
  }
  if (!isDayStr(s.bizClaimDayKey)) {
    if (s.bizClaimDayKey !== "") {
      s.bizClaimDayKey = "";
      changed = true;
    } else if (typeof s.bizClaimDayKey !== "string") {
      s.bizClaimDayKey = "";
      changed = true;
    }
  }
  if (!isDayStr(s.gquizDayKey)) {
    if (s.gquizDayKey !== "") {
      s.gquizDayKey = "";
      changed = true;
    } else if (typeof s.gquizDayKey !== "string") {
      s.gquizDayKey = "";
      changed = true;
    }
  }
  if (!isDayStr(s.labourDayKey)) {
    if (s.labourDayKey !== "") {
      s.labourDayKey = "";
      changed = true;
    } else if (typeof s.labourDayKey !== "string") {
      s.labourDayKey = "";
      changed = true;
    }
  }
  const rawFarmIncomeDays = Array.isArray(s.farmIncomeDays) ? s.farmIncomeDays : [];
  const dayMap = new Map();
  for (const row of rawFarmIncomeDays) {
    const day = String(row?.day || "");
    if (!isDayStr(day)) continue;
    const amount = Math.max(0, Math.floor(Number(row?.amount) || 0));
    if (amount <= 0) continue;
    dayMap.set(day, (dayMap.get(day) || 0) + amount);
  }
  const normalizedFarmIncomeDays = [...dayMap.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .slice(-FARM_INCOME_DAYS_LIMIT)
    .map(([day, amount]) => ({ day, amount }));
  if (
    !Array.isArray(s.farmIncomeDays) ||
    normalizedFarmIncomeDays.length !== rawFarmIncomeDays.length ||
    normalizedFarmIncomeDays.some((row, i) => {
      const prev = rawFarmIncomeDays[i] || {};
      return String(prev?.day || "") !== row.day || Math.max(0, Math.floor(Number(prev?.amount) || 0)) !== row.amount;
    })
  ) {
    s.farmIncomeDays = normalizedFarmIncomeDays;
    changed = true;
  }

  if (!s.newbie || typeof s.newbie !== "object") {
    s.newbie = {};
    changed = true;
  }
  const nb = s.newbie;
  const dayFields = ["openedDay", "completedDay", "lastStepSeenDay", "lastStepClaimedDay"];
  for (const f of dayFields) {
    if (!isDayStr(nb[f])) {
      if (nb[f] !== "") {
        nb[f] = "";
        changed = true;
      } else if (typeof nb[f] !== "string") {
        nb[f] = "";
        changed = true;
      }
    }
  }
  if (typeof nb.maxStepSeen !== "number" || !Number.isFinite(nb.maxStepSeen)) {
    nb.maxStepSeen = 0;
    changed = true;
  }
  if (typeof nb.maxStepClaimed !== "number" || !Number.isFinite(nb.maxStepClaimed)) {
    nb.maxStepClaimed = 0;
    changed = true;
  }
  if (!nb.stepsSeen || typeof nb.stepsSeen !== "object" || Array.isArray(nb.stepsSeen)) {
    nb.stepsSeen = {};
    changed = true;
  }
  if (!nb.stepsClaimed || typeof nb.stepsClaimed !== "object" || Array.isArray(nb.stepsClaimed)) {
    nb.stepsClaimed = {};
    changed = true;
  }
  for (const key of NEWBIE_STEP_KEYS) {
    if (!isDayStr(nb.stepsSeen[key])) {
      if (nb.stepsSeen[key] !== "") {
        nb.stepsSeen[key] = "";
        changed = true;
      } else if (typeof nb.stepsSeen[key] !== "string") {
        nb.stepsSeen[key] = "";
        changed = true;
      }
    }
    if (!isDayStr(nb.stepsClaimed[key])) {
      if (nb.stepsClaimed[key] !== "") {
        nb.stepsClaimed[key] = "";
        changed = true;
      } else if (typeof nb.stepsClaimed[key] !== "string") {
        nb.stepsClaimed[key] = "";
        changed = true;
      }
    }
  }
  return changed;
}

export function markUsefulActivity(u, nowTs = Date.now()) {
  let changed = ensurePlayerStatsShape(u);
  const s = u.stats;
  const today = dayStrUtc(nowTs);
  if (!s.firstActiveDay) {
    const createdAt = Number(u?.createdAt || 0);
    const createdDay = createdAt > 0 ? dayStrUtc(createdAt) : "";
    s.firstActiveDay = isDayStr(createdDay) ? createdDay : today;
    changed = true;
  }
  if (s.lastActiveDay !== today) {
    s.lastActiveDay = today;
    changed = true;
  }
  const curr = Array.isArray(s.activeDays) ? s.activeDays : [];
  if (!curr.includes(today)) {
    const next = [...curr, today].filter(isDayStr).sort().slice(-ACTIVE_DAYS_LIMIT);
    s.activeDays = next;
    changed = true;
  }
  return changed;
}

export function markFunnelStep(u, stepKey) {
  let changed = ensurePlayerStatsShape(u);
  const s = u.stats;
  if (!s[stepKey]) {
    s[stepKey] = true;
    changed = true;
  }
  return changed;
}

export function hasActivityOnDay(u, day) {
  const s = u?.stats;
  if (!s || typeof s !== "object") return false;
  const target = String(day || "");
  if (!isDayStr(target)) return false;
  const days = Array.isArray(s.activeDays) ? s.activeDays : [];
  if (days.includes(target)) return true;
  return String(s.lastActiveDay || "") === target;
}
