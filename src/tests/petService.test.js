import test from "node:test";
import assert from "node:assert/strict";
import { PetService } from "../PetService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStr(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeService(nowTs) {
  return new PetService({
    db: null,
    users: { async save() {} },
    now: () => nowTs,
    bot: null,
    quests: null,
    achievements: null
  });
}

function makeUser(nowTs) {
  return {
    id: "u-pet",
    lang: "ru",
    money: 100000,
    premium: 20,
    pet: {
      type: "cat",
      name: "Мурка",
      status: "healthy",
      streak: 0,
      lastFedDay: dayStr(nowTs),
      sickSince: "",
      boughtAt: nowTs,
      notifyDay: "",
      notifyPriority: 0
    },
    petDraft: { type: "", name: "" },
    awaitingPetName: false
  };
}

test("pet: status transitions by missed days (1->hungry, 3->sick, 5->dead)", async () => {
  const nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const svc = makeService(nowTs);
  const u = makeUser(nowTs);

  u.pet.lastFedDay = dayStr(nowTs - 1 * DAY_MS);
  await svc._syncState(u, { persist: false });
  assert.equal(u.pet.status, "hungry");

  u.pet.lastFedDay = dayStr(nowTs - 3 * DAY_MS);
  await svc._syncState(u, { persist: false });
  assert.equal(u.pet.status, "sick");

  u.pet.lastFedDay = dayStr(nowTs - 5 * DAY_MS);
  await svc._syncState(u, { persist: false });
  assert.equal(u.pet.status, "dead");
});

test("pet: heal resets baseline day and keeps hungry status", async () => {
  const nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const svc = makeService(nowTs);
  const u = makeUser(nowTs);
  const today = dayStr(nowTs);

  u.pet.status = "sick";
  u.pet.sickSince = dayStr(nowTs - 1 * DAY_MS);
  u.pet.lastFedDay = dayStr(nowTs - 4 * DAY_MS);
  u.pet.streak = 15;
  u.premium = 10;

  const res = await svc.heal(u);
  assert.equal(res.ok, true);
  assert.equal(u.pet.status, "hungry");
  assert.equal(u.pet.sickSince, "");
  assert.equal(u.pet.lastFedDay, today);
  assert.equal(u.pet.streak, 0);
  assert.equal(u.premium, 7);
});

test("pet: feeding from hungry restarts streak from 1 and gives gems", async () => {
  const nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const svc = makeService(nowTs);
  const u = makeUser(nowTs);

  u.pet.status = "hungry";
  u.pet.streak = 9;
  u.pet.lastFedDay = dayStr(nowTs - 2 * DAY_MS);
  u.premium = 0;

  const res = await svc.feed(u);
  assert.equal(res.ok, true);
  assert.equal(u.pet.status, "healthy");
  assert.equal(u.pet.streak, 1);
  assert.equal(u.premium, 1);
});

test("pet: consecutive daily feeding keeps and increments streak", async () => {
  const nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const svc = makeService(nowTs);
  const u = makeUser(nowTs);

  u.pet.status = "healthy";
  u.pet.streak = 3;
  u.pet.lastFedDay = dayStr(nowTs - 1 * DAY_MS);
  u.premium = 0;

  const res = await svc.feed(u);
  assert.equal(res.ok, true);
  assert.equal(u.pet.status, "healthy");
  assert.equal(u.pet.streak, 4);
  assert.equal(u.premium, 1);
});

test("pet: draft confirmation is shown before type picker when name is set", async () => {
  const nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const svc = makeService(nowTs);
  const u = {
    id: "u-draft",
    lang: "ru",
    money: 100000,
    premium: 0,
    pet: null,
    petDraft: { type: "dog", name: "Бобик" },
    awaitingPetName: false
  };

  const view = await svc.buildView(u);
  const cb = view?.keyboard?.[0]?.[0]?.callback_data || "";
  assert.equal(cb, "pet:confirm_buy");
});

test("pet: owned pet view includes image asset by type", async () => {
  const nowTs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const svc = makeService(nowTs);
  const u = makeUser(nowTs);
  u.pet.type = "dog";

  const view = await svc.buildView(u);
  assert.equal(typeof view.asset, "string");
  assert.ok(view.asset.length > 10);
});
