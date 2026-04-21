import test from "node:test";
import assert from "node:assert/strict";
import { SocialService } from "../SocialService.js";

class FakeDb {
  constructor() {
    this.map = new Map();
  }

  async get(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }

  async put(key, value) {
    this.map.set(String(key), String(value));
  }
}

test("social service: weekly theft top stores sorted rows", async () => {
  const db = new FakeDb();
  const service = new SocialService({
    db,
    users: null,
    now: () => Date.UTC(2026, 3, 22, 12, 0, 0)
  });

  await service.maybeUpdateTheftWeekTop({ userId: "u2", displayName: "Bravo", total: 700 });
  await service.maybeUpdateTheftWeekTop({ userId: "u1", displayName: "Alpha", total: 1200 });
  await service.maybeUpdateTheftWeekTop({ userId: "u3", displayName: "Charlie", total: 300 });

  const top = await service.getTheftWeekTop();
  assert.equal(top.length, 3);
  assert.equal(top[0].userId, "u1");
  assert.equal(top[0].total, 1200);
  assert.equal(top[1].userId, "u2");
  assert.equal(top[1].total, 700);
  assert.equal(top[2].userId, "u3");
  assert.equal(top[2].total, 300);
});
