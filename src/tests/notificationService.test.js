import test from "node:test";
import assert from "node:assert/strict";
import { NotificationService } from "../NotificationService.js";

function makeUsers(rows) {
  const saved = [];
  return {
    saved,
    async listAll() {
      return rows;
    },
    async save(u) {
      saved.push(JSON.parse(JSON.stringify(u)));
      return u;
    }
  };
}

test("notification service: ready study auto-finishes without player action", async () => {
  const nowTs = 2000;
  const sent = [];
  const achievementEvents = [];
  const questEvents = [];
  const user = {
    id: "u-study-auto",
    chatId: 123,
    lang: "en",
    displayName: "Student",
    study: { level: 2, active: true, startAt: 1000, endAt: 1500, notified: false }
  };
  const users = makeUsers([user]);
  const svc = new NotificationService({
    users,
    bot: {
      async sendWithInline(chatId, text, keyboard) {
        sent.push({ chatId, text: String(text), keyboard });
      }
    },
    now: () => nowTs,
    achievements: {
      async onEvent(u, event, payload) {
        achievementEvents.push({ id: u.id, event, payload });
      }
    },
    quests: {
      async onEvent(u, event, payload) {
        questEvents.push({ id: u.id, event, payload });
      }
    }
  });

  await svc.run();

  assert.equal(user.study.active, false);
  assert.equal(user.study.level, 3);
  assert.equal(user.study.startAt, 0);
  assert.equal(user.study.endAt, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, 123);
  assert.match(sent[0].text, /3/);
  assert.equal(achievementEvents[0].event, "study_finish");
  assert.deepEqual(achievementEvents[0].payload, { level: 3, source: "cron" });
  assert.equal(questEvents[0].event, "study_finish");
  assert.deepEqual(questEvents[0].payload, { level: 3, source: "cron" });
  assert.ok(users.saved.length >= 1);
});

test("notification service: ready study auto-finishes even without chat id", async () => {
  const user = {
    id: "u-study-no-chat",
    lang: "en",
    displayName: "Quiet Student",
    study: { level: 4, active: true, startAt: 1000, endAt: 1500, notified: true }
  };
  const users = makeUsers([user]);
  const sent = [];
  const svc = new NotificationService({
    users,
    bot: {
      async sendWithInline(chatId, text, keyboard) {
        sent.push({ chatId, text, keyboard });
      }
    },
    now: () => 2000
  });

  await svc.run();

  assert.equal(user.study.active, false);
  assert.equal(user.study.level, 5);
  assert.equal(sent.length, 0);
});
