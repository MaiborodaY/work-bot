import test from "node:test";
import assert from "node:assert/strict";
import { GeneralQuizService } from "../GeneralQuizService.js";

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
    study: { level: 0 },
    quizGeneral: null
  };
}

test("general quiz: same UTC day gives same questions/options for everyone", async () => {
  const svc = new GeneralQuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 16, 12, 0, 0)
  });
  const u1 = makeUser("u1");
  const u2 = makeUser("u2");

  await svc.ensureSession(u1, { persist: false });
  await svc.ensureSession(u2, { persist: false });

  assert.deepEqual(u1.quizGeneral.questionIds, u2.quizGeneral.questionIds);
  assert.deepEqual(u1.quizGeneral.optionOrder, u2.quizGeneral.optionOrder);
});

test("general quiz: perfect run pays money only", async () => {
  const svc = new GeneralQuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 16, 12, 0, 0)
  });
  const u = makeUser("u-perfect");
  await svc.ensureSession(u, { persist: false });
  const picked = await svc.selectDifficulty(u, "easy");
  assert.equal(picked.ok, true);
  const total = u.quizGeneral.questionIds.length;

  for (let i = 0; i < total; i += 1) {
    const q = svc._questionFor(u, u.quizGeneral.currentIndex);
    const shownCorrect = q.order.findIndex((orig) => orig === q.correctIndex);
    const res = await svc.answer(u, shownCorrect);
    assert.equal(res.ok, true);
  }

  assert.equal(u.quizGeneral.done, true);
  assert.equal(u.quizGeneral.correctTotal, total);
  assert.equal(u.money, (60 * total) + 120);
  assert.equal(u.premium, 0);
  assert.equal(u.quizGeneral.playedTotal, 1);
  assert.equal(u.quizGeneral.perfectTotal, 1);
  assert.equal(u.quizGeneral.byDifficulty.easy.playedTotal, 1);
  assert.equal(u.quizGeneral.byDifficulty.easy.perfectTotal, 1);
});

test("general quiz: hard difficulty requires study level 15", async () => {
  const svc = new GeneralQuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 16, 12, 0, 0)
  });
  const low = makeUser("u-low");
  low.study.level = 10;
  await svc.ensureSession(low, { persist: false });
  const fail = await svc.selectDifficulty(low, "hard");
  assert.equal(fail.ok, false);

  const high = makeUser("u-high");
  high.study.level = 15;
  await svc.ensureSession(high, { persist: false });
  const ok = await svc.selectDifficulty(high, "hard");
  assert.equal(ok.ok, true);
});

test("general quiz: difficulty is fixed for the day after selection", async () => {
  const svc = new GeneralQuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 16, 12, 0, 0)
  });
  const u = makeUser("u-fixed");
  u.study.level = 20;
  await svc.ensureSession(u, { persist: false });
  const first = await svc.selectDifficulty(u, "easy");
  assert.equal(first.ok, true);
  const second = await svc.selectDifficulty(u, "hard");
  assert.equal(second.ok, false);
});

test("general quiz: hard perfect run pays 500 total", async () => {
  const svc = new GeneralQuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 16, 12, 0, 0)
  });
  const u = makeUser("u-hard");
  u.study.level = 25;
  await svc.ensureSession(u, { persist: false });
  const picked = await svc.selectDifficulty(u, "hard");
  assert.equal(picked.ok, true);
  const total = u.quizGeneral.questionIds.length;

  for (let i = 0; i < total; i += 1) {
    const q = svc._questionFor(u, u.quizGeneral.currentIndex);
    const shownCorrect = q.order.findIndex((orig) => orig === q.correctIndex);
    const res = await svc.answer(u, shownCorrect);
    assert.equal(res.ok, true);
  }

  assert.equal(u.money, 500);
  assert.equal(u.quizGeneral.byDifficulty.hard.playedTotal, 1);
  assert.equal(u.quizGeneral.byDifficulty.hard.perfectTotal, 1);
});

test("general quiz: medium difficulty uses medium pool ids", async () => {
  const svc = new GeneralQuizService({
    users: new FakeUsers(),
    now: () => Date.UTC(2026, 2, 16, 12, 0, 0)
  });
  const u = makeUser("u-medium");
  await svc.ensureSession(u, { persist: false });
  const picked = await svc.selectDifficulty(u, "medium");
  assert.equal(picked.ok, true);

  const view = await svc.buildOpenView(u);
  assert.ok(view && typeof view.caption === "string");
  assert.ok(Array.isArray(u.quizGeneral.questionIds));
  assert.ok(u.quizGeneral.questionIds.length > 0);
  assert.ok(u.quizGeneral.questionIds.every((id) => String(id).startsWith("gqm_")));
});
