import { CONFIG } from "./GameConfig.js";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function ensureProgressionShape(u) {
  if (!u.progression || typeof u.progression !== "object") {
    u.progression = {
      rewardLevelClaimed: 0,
      rewardInitDone: false
    };
    return true;
  }
  let dirty = false;
  if (!Number.isFinite(Number(u.progression.rewardLevelClaimed))) {
    u.progression.rewardLevelClaimed = 0;
    dirty = true;
  } else {
    const fixed = Math.max(0, Math.floor(Number(u.progression.rewardLevelClaimed) || 0));
    if (fixed !== u.progression.rewardLevelClaimed) {
      u.progression.rewardLevelClaimed = fixed;
      dirty = true;
    }
  }
  if (typeof u.progression.rewardInitDone !== "boolean") {
    u.progression.rewardInitDone = false;
    dirty = true;
  }
  return dirty;
}

export const ProgressionService = {
  ensureShape(u) {
    return ensureProgressionShape(u);
  },

  calcXP(u) {
    const p = u?.achievements?.progress || {};
    const earned = Math.max(0, n(p.totalEarned));
    return Math.max(0, Math.floor(
      (n(p.totalShifts) * 8) +
      (Math.sqrt(earned) * 2) +
      (n(p.farmHarvestTotal) * 12) +
      (n(p.quizPerfectTotal) * 25) +
      (n(p.stockBuysTotal) * 4) +
      (n(p.employeesHiredTotal) * 20) +
      (n(p.theftSuccessTotal) * 15) +
      (n(p.defensesSuccess) * 15) +
      (n(p.referralsDone) * 100) +
      (n(p.clanContractsByUser) * 15) +
      (n(u?.study?.level) * 60) +
      (n(u?.gym?.level) * 50)
    ));
  },

  getLevelInfo(u) {
    const xp = this.calcXP(u);
    const table = Array.isArray(CONFIG?.PLAYER_LEVELS?.XP_TABLE) ? CONFIG.PLAYER_LEVELS.XP_TABLE : [0];
    const maxLevel = Math.max(1, Math.min(Number(CONFIG?.PLAYER_LEVELS?.MAX_LEVEL) || 50, table.length));

    let level = 1;
    for (let idx = table.length - 1; idx >= 0; idx -= 1) {
      if (xp >= Number(table[idx] || 0)) {
        level = Math.min(idx + 1, maxLevel);
        break;
      }
    }

    const currentLevelXp = Number(table[level - 1] || 0);
    const isMax = level >= maxLevel;
    const nextLevelXp = isMax ? currentLevelXp : Number(table[level] || currentLevelXp);
    const xpIntoLevel = Math.max(0, xp - currentLevelXp);
    const xpSpan = Math.max(1, nextLevelXp - currentLevelXp);
    const progressPct = isMax ? 100 : Math.max(0, Math.min(100, Math.floor((xpIntoLevel / xpSpan) * 100)));

    return {
      xp,
      level,
      maxLevel,
      isMax,
      currentLevelXp,
      nextLevelXp,
      xpIntoLevel,
      xpToNext: isMax ? 0 : Math.max(0, nextLevelXp - xp),
      progressPct
    };
  },

  ensureRewardBaseline(u) {
    let dirty = ensureProgressionShape(u);
    if (u.progression.rewardInitDone) return dirty;
    const info = this.getLevelInfo(u);
    u.progression.rewardLevelClaimed = Math.max(0, info.level);
    u.progression.rewardInitDone = true;
    return true;
  },

  getPendingReward(u) {
    ensureProgressionShape(u);
    const info = this.getLevelInfo(u);
    const claimed = Math.max(0, Math.floor(Number(u?.progression?.rewardLevelClaimed) || 0));
    if (claimed >= info.level) return null;

    const rewards = CONFIG?.PLAYER_LEVELS?.REWARDS || {};
    let gems = 0;
    const fromLevel = claimed + 1;
    const toLevel = info.level;
    for (let level = fromLevel; level <= toLevel; level += 1) {
      gems += Math.max(0, Math.floor(Number(rewards[level]) || 0));
    }
    if (gems <= 0) return null;
    return { fromLevel, toLevel, gems };
  },

  claimPendingRewards(u) {
    ensureProgressionShape(u);
    const pending = this.getPendingReward(u);
    if (!pending) return { ok: false, gems: 0 };

    u.premium = Math.max(0, Math.floor(Number(u?.premium) || 0)) + pending.gems;
    u.progression.rewardLevelClaimed = pending.toLevel;
    u.progression.rewardInitDone = true;
    return { ok: true, ...pending };
  }
};

