import test from "node:test";
import assert from "node:assert/strict";
import { QuizService } from "../QuizService.js";

class FakeUsers {
  async save(u) {
    return JSON.parse(JSON.stringify(u));
  }
}

function makeUser(id = "u1") {
  return {
    id,
    lang: "en",
    money: 0,
    premium: 0,
    quiz: null,
    achievements: { earned: {}, progress: {}, retroDone: true },
    quests: {
      daily: { day: "", list: [], bonusPaid: false, counters: {} },
      weekly: { week: "", list: [], bonusPaid: false, counters: {}, bizStreakCurrent: 0, lastBizClaimDay: "" }
    }
  };
}

test("quiz: same UTC day gives same questions/options for everyone", async () => {
  const svc = new QuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 15, 12, 0, 0)
  });
  const u1 = makeUser("u1");
  const u2 = makeUser("u2");

  await svc.ensureSession(u1, { persist: false });
  await svc.ensureSession(u2, { persist: false });

  assert.deepEqual(u1.quiz.questionIds, u2.quiz.questionIds);
  assert.deepEqual(u1.quiz.optionOrder, u2.quiz.optionOrder);
});

test("quiz: perfect run pays all money rewards and gem bonus once", async () => {
  const questCalls = [];
  const achCalls = [];
  const svc = new QuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 15, 12, 0, 0),
    quests: {
      async onEvent(u, event, ctx) {
        questCalls.push({ event, ctx: { ...ctx } });
        return { events: [] };
      },
      async notifyEvents() {}
    },
    achievements: {
      async onEvent(u, event, ctx) {
        achCalls.push({ event, ctx: { ...ctx } });
        return { newlyEarned: [] };
      },
      async notifyEarned() {}
    }
  });

  const u = makeUser("u-perfect");
  await svc.ensureSession(u, { persist: false });
  const total = u.quiz.questionIds.length;

  for (let i = 0; i < total; i += 1) {
    const q = svc._questionFor(u, u.quiz.currentIndex);
    const shownCorrect = q.order.findIndex((orig) => orig === q.correctIndex);
    const res = await svc.answer(u, shownCorrect);
    assert.equal(res.ok, true);
  }

  assert.equal(u.quiz.done, true);
  assert.equal(u.quiz.correctTotal, total);
  assert.equal(u.money, 300 * total);
  assert.equal(u.premium, 1);
  assert.equal(u.quiz.streak, 1);
  assert.equal(u.quiz.playedTotal, 1);
  assert.equal(u.quiz.perfectTotal, 1);
  assert.equal(questCalls.length, 1);
  assert.equal(questCalls[0].event, "quiz_play");
  assert.equal(questCalls[0].ctx.perfect, true);
  assert.equal(achCalls.length, 1);
  assert.equal(achCalls[0].event, "quiz_play");
  assert.equal(achCalls[0].ctx.streak, 1);
});

test("quiz: non-perfect completion resets perfect streak", async () => {
  const svc = new QuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 15, 12, 0, 0)
  });
  const u = makeUser("u-non-perfect");
  await svc.ensureSession(u, { persist: false });
  u.quiz.streak = 5;
  u.quiz.lastPerfectDay = "2026-03-14";

  const firstQ = svc._questionFor(u, u.quiz.currentIndex);
  const shownWrong = firstQ.order.findIndex((orig) => orig !== firstQ.correctIndex);
  await svc.answer(u, shownWrong);

  while (!u.quiz.done) {
    const q = svc._questionFor(u, u.quiz.currentIndex);
    const shownCorrect = q.order.findIndex((orig) => orig === q.correctIndex);
    await svc.answer(u, shownCorrect);
  }

  assert.equal(u.quiz.done, true);
  assert.equal(u.quiz.correctTotal < u.quiz.questionIds.length, true);
  assert.equal(u.quiz.streak, 0);
  assert.equal(u.premium, 0);
});

