import test from "node:test";
import assert from "node:assert/strict";
import { AchievementService } from "../AchievementService.js";

class FakeUsers {
  constructor(seed = {}) {
    this.store = new Map(
      Object.entries(seed).map(([id, u]) => [String(id), JSON.parse(JSON.stringify(u))])
    );
  }

  async load(id) {
    const raw = this.store.get(String(id));
    if (!raw) return null;
    return JSON.parse(JSON.stringify(raw));
  }

  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    this.store.set(String(clone.id), clone);
    return clone;
  }
}

test("achievement service: work claim awards first shift and first thousand", async () => {
  const users = new FakeUsers({
    u1: { id: "u1", lang: "ru", premium: 0, money: 0 }
  });
  const svc = new AchievementService({ users, now: () => 1000, bot: null });
  const u = await users.load("u1");

  const res = await svc.onEvent(u, "work_claim", { pay: 1000 }, {
    persist: false,
    notify: false
  });

  assert.equal(res.changed, true);
  assert.equal(res.newlyEarned.length, 2);
  assert.equal(u.achievements.progress.totalShifts, 1);
  assert.equal(u.achievements.progress.totalEarned, 1000);
  assert.equal(u.premium, 2);
});

test("achievement service: theft streak resets on any fail", async () => {
  const users = new FakeUsers({
    u2: {
      id: "u2",
      lang: "ru",
      premium: 0,
      achievements: {
        earned: {},
        progress: {
          totalShifts: 0,
          totalEarned: 0,
          totalDividends: 0,
          successfulTheftsStreak: 9,
          theftSuccessTotal: 0,
          totalStolen: 0,
          defensesSuccess: 0,
          employeesHiredTotal: 0,
          clanContractsByUser: 0,
          stockBuysTotal: 0,
          referralsDone: 0,
          clanJoinedOnce: false,
          clanCreatedOnce: false
        },
        retroDone: true
      }
    }
  });
  const svc = new AchievementService({ users, now: () => 2000, bot: null });
  const u = await users.load("u2");

  const okRes = await svc.onEvent(u, "thief_success", { amount: 100 }, { persist: false, notify: false });
  assert.equal(okRes.newlyEarned.some((x) => x.id === "thief_streak_10"), true);
  assert.equal(u.achievements.progress.successfulTheftsStreak, 10);

  await svc.onEvent(u, "thief_fail", { reason: "blocked" }, { persist: false, notify: false });
  assert.equal(u.achievements.progress.successfulTheftsStreak, 0);
});

test("achievement service: retro check awards from existing state and marks done", async () => {
  const users = new FakeUsers({
    u3: {
      id: "u3",
      lang: "ru",
      premium: 0,
      biz: { owned: [{ id: "shawarma", boughtAt: Date.now(), slots: [] }] }
    }
  });
  const svc = new AchievementService({ users, now: () => 3000, bot: null });
  const u = await users.load("u3");

  const res = await svc.retroCheck(u);
  assert.equal(res.changed, true);
  assert.equal(res.earned >= 1, true);
  assert.equal(u.achievements.retroDone, true);
  assert.equal(typeof u.achievements.earned.biz_first, "number");
  assert.equal(u.premium >= 3, true);
});

test("achievement service: own/public views are built with earned achievements", async () => {
  const users = new FakeUsers({
    u4: {
      id: "u4",
      lang: "en",
      premium: 5,
      money: 1000,
      achievements: {
        earned: {
          work_first_shift: 100,
          biz_first: 200
        },
        progress: {
          totalShifts: 5,
          totalEarned: 5000,
          totalDividends: 0,
          successfulTheftsStreak: 0,
          theftSuccessTotal: 0,
          totalStolen: 0,
          defensesSuccess: 0,
          employeesHiredTotal: 0,
          clanContractsByUser: 0,
          stockBuysTotal: 0,
          referralsDone: 0,
          clanJoinedOnce: false,
          clanCreatedOnce: false
        },
        retroDone: true
      }
    }
  });
  const svc = new AchievementService({ users, now: () => 5000, bot: null });
  const u = await users.load("u4");

  const own = svc.buildOwnView(u);
  assert.match(own.caption, /Achievements/i);
  assert.match(own.caption, /First work day/i);

  const pub = svc.buildPublicSummary(u, "en", 8);
  assert.equal(pub.totalDone, 2);
  assert.equal(pub.lines.length, 2);
});
