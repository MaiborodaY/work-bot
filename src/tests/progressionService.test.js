import test from "node:test";
import assert from "node:assert/strict";

import { ProgressionService } from "../ProgressionService.js";
import { Formatters } from "../Formatters.js";

function makeUser(overrides = {}) {
  return {
    id: "u1",
    lang: "ru",
    money: 0,
    energy: 20,
    energy_max: 20,
    premium: 0,
    displayName: "Tester",
    upgrades: [],
    jobs: { active: [] },
    clan: { clanId: "" },
    gymPass: { endAt: 0, notifiedEndAt: 0 },
    study: { level: 0 },
    gym: { level: 0 },
    achievements: {
      progress: {
        totalShifts: 0,
        totalEarned: 0,
        farmHarvestTotal: 0,
        quizPerfectTotal: 0,
        stockBuysTotal: 0,
        employeesHiredTotal: 0,
        colosseumBattlesTotal: 0,
        colosseumWinsTotal: 0,
        theftSuccessTotal: 0,
        defensesSuccess: 0,
        referralsDone: 0,
        clanContractsByUser: 0
      }
    },
    progression: {
      rewardLevelClaimed: 1,
      rewardInitDone: true
    },
    stats: {
      dailyTop1Count: 0,
      dailyTop3Count: 0,
      dailyTop10Count: 0
    },
    ...overrides
  };
}

test("progression: veteran user gets retroactive level from accumulated stats", () => {
  const u = makeUser({
    achievements: {
      progress: {
        totalShifts: 120,
        totalEarned: 250000,
        farmHarvestTotal: 30,
        quizPerfectTotal: 12,
        stockBuysTotal: 20,
        employeesHiredTotal: 6,
        colosseumBattlesTotal: 12,
        colosseumWinsTotal: 7,
        theftSuccessTotal: 10,
        defensesSuccess: 8,
        referralsDone: 3,
        clanContractsByUser: 15
      }
    },
    study: { level: 12 },
    gym: { level: 8 }
  });

  const info = ProgressionService.getLevelInfo(u);
  assert.ok(info.level > 1);
  assert.ok(info.xp > 0);
  assert.equal(info.level <= info.maxLevel, true);
});

test("progression: reward baseline backfills old player to current level with no retro reward", () => {
  const u = makeUser({
    achievements: {
      progress: {
        totalShifts: 120,
        totalEarned: 250000,
        farmHarvestTotal: 30,
        quizPerfectTotal: 12,
        stockBuysTotal: 20,
        employeesHiredTotal: 6,
        colosseumBattlesTotal: 12,
        colosseumWinsTotal: 7,
        theftSuccessTotal: 10,
        defensesSuccess: 8,
        referralsDone: 3,
        clanContractsByUser: 15
      }
    },
    study: { level: 12 },
    gym: { level: 8 },
    progression: {
      rewardLevelClaimed: 0,
      rewardInitDone: false
    }
  });

  const info = ProgressionService.getLevelInfo(u);
  const changed = ProgressionService.ensureRewardBaseline(u);
  const pending = ProgressionService.getPendingReward(u);

  assert.equal(changed, true);
  assert.equal(u.progression.rewardLevelClaimed, info.level);
  assert.equal(u.progression.rewardInitDone, true);
  assert.equal(pending, null);
});

test("progression: notify baseline backfills old player to current level with no fake notification", () => {
  const u = makeUser({
    achievements: {
      progress: {
        totalShifts: 120,
        totalEarned: 250000,
        farmHarvestTotal: 30,
        quizPerfectTotal: 12,
        stockBuysTotal: 20,
        employeesHiredTotal: 6,
        colosseumBattlesTotal: 12,
        colosseumWinsTotal: 7,
        theftSuccessTotal: 10,
        defensesSuccess: 8,
        referralsDone: 3,
        clanContractsByUser: 15
      }
    },
    study: { level: 12 },
    gym: { level: 8 },
    progression: {
      rewardLevelClaimed: 0,
      rewardInitDone: false,
      notifiedLevel: 0,
      notifyInitDone: false
    }
  });

  const info = ProgressionService.getLevelInfo(u);
  const changed = ProgressionService.ensureNotifyBaseline(u);
  const levelUp = ProgressionService.consumeLevelUpNotification(u);

  assert.equal(changed, true);
  assert.equal(u.progression.notifiedLevel, info.level);
  assert.equal(u.progression.notifyInitDone, true);
  assert.equal(levelUp, null);
});

test("progression: claim pending rewards grants gems for missed new levels", () => {
  const u = makeUser({
    achievements: {
      progress: {
        totalShifts: 50,
        totalEarned: 150000,
        farmHarvestTotal: 10,
        quizPerfectTotal: 4,
        stockBuysTotal: 10,
        employeesHiredTotal: 2,
        colosseumBattlesTotal: 6,
        colosseumWinsTotal: 3,
        theftSuccessTotal: 4,
        defensesSuccess: 3,
        referralsDone: 1,
        clanContractsByUser: 6
      }
    },
    study: { level: 7 },
    gym: { level: 5 },
    premium: 2,
    progression: {
      rewardLevelClaimed: 3,
      rewardInitDone: true
    }
  });

  const pending = ProgressionService.getPendingReward(u);
  assert.ok(pending);

  const result = ProgressionService.claimPendingRewards(u);
  assert.equal(result.ok, true);
  assert.equal(u.progression.rewardLevelClaimed, result.toLevel);
  assert.equal(u.premium, 2 + result.gems);
});

test("progression: consume level-up notification fires once for newly reached level", () => {
  const u = makeUser({
    achievements: {
      progress: {
        totalShifts: 8,
        totalEarned: 10000,
        farmHarvestTotal: 2,
        quizPerfectTotal: 1,
        stockBuysTotal: 1,
        employeesHiredTotal: 0,
        colosseumBattlesTotal: 1,
        colosseumWinsTotal: 1,
        theftSuccessTotal: 0,
        defensesSuccess: 0,
        referralsDone: 0,
        clanContractsByUser: 0
      }
    },
    progression: {
      rewardLevelClaimed: 1,
      rewardInitDone: true,
      notifiedLevel: 1,
      notifyInitDone: true
    }
  });

  const levelUp = ProgressionService.consumeLevelUpNotification(u);
  const second = ProgressionService.consumeLevelUpNotification(u);

  assert.ok(levelUp);
  assert.ok(levelUp.level > 1);
  assert.equal(u.progression.notifiedLevel, levelUp.level);
  assert.equal(second, null);
});

test("progression: colosseum totals add XP", () => {
  const base = makeUser();
  const withColosseum = makeUser({
    achievements: {
      progress: {
        totalShifts: 0,
        totalEarned: 0,
        farmHarvestTotal: 0,
        quizPerfectTotal: 0,
        stockBuysTotal: 0,
        employeesHiredTotal: 0,
        colosseumBattlesTotal: 10,
        colosseumWinsTotal: 4,
        theftSuccessTotal: 0,
        defensesSuccess: 0,
        referralsDone: 0,
        clanContractsByUser: 0
      }
    }
  });

  assert.equal(ProgressionService.calcXP(withColosseum), 98);
  assert.ok(ProgressionService.calcXP(withColosseum) > ProgressionService.calcXP(base));
});

test("formatters: profile text shows level progress and pending reward line", () => {
  const u = makeUser({
    achievements: {
      progress: {
        totalShifts: 50,
        totalEarned: 150000,
        farmHarvestTotal: 10,
        quizPerfectTotal: 4,
        stockBuysTotal: 10,
        employeesHiredTotal: 2,
        theftSuccessTotal: 4,
        defensesSuccess: 3,
        referralsDone: 1,
        clanContractsByUser: 6
      }
    },
    study: { level: 7 },
    gym: { level: 5 },
    progression: {
      rewardLevelClaimed: 3,
      rewardInitDone: true
    }
  });

  const text = Formatters.status(u, {}, "ru");
  assert.match(text, /⭐ Уровень:/);
  assert.match(text, /XP:/);
  assert.match(text, /█|░/);
  assert.match(text, /🎁 Доступна награда/);
});
