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
  const total = u.quizGeneral.questionIds.length;

  for (let i = 0; i < total; i += 1) {
    const q = svc._questionFor(u, u.quizGeneral.currentIndex);
    const shownCorrect = q.order.findIndex((orig) => orig === q.correctIndex);
    const res = await svc.answer(u, shownCorrect);
    assert.equal(res.ok, true);
  }

  assert.equal(u.quizGeneral.done, true);
  assert.equal(u.quizGeneral.correctTotal, total);
  assert.equal(u.money, (100 * total) + 200);
  assert.equal(u.premium, 0);
  assert.equal(u.quizGeneral.playedTotal, 1);
  assert.equal(u.quizGeneral.perfectTotal, 1);
});

