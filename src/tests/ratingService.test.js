import test from "node:test";
import assert from "node:assert/strict";
import { RatingService } from "../RatingService.js";

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

test("rating service: buildView appends clan tag to player names", async () => {
  const db = new FakeDb();
  const key = "rating:v1:biz:top";
  await db.put(key, JSON.stringify([
    { userId: "u1", name: "Alpha", score: 3, reachedAt: 1 },
    { userId: "u2", name: "Bravo", score: 2, reachedAt: 2 }
  ]));

  await db.put("u:u1", JSON.stringify({ id: "u1", clan: { clanId: "c1" } }));
  await db.put("u:u2", JSON.stringify({ id: "u2", clan: { clanId: "c2" } }));
  await db.put("clan:item:c1", JSON.stringify({ id: "c1", name: "Wolves" }));
  await db.put("clan:item:c2", JSON.stringify({ id: "c2", name: "Dragons" }));

  const service = new RatingService({
    db,
    users: { db },
    now: () => Date.UTC(2026, 3, 22, 12, 0, 0)
  });

  const me = { id: "u1", displayName: "Alpha", lang: "en", biz: { owned: [] }, achievements: { earned: {} }, thief: { totalStolen: 0 } };
  const view = await service.buildView(me, "biz");
  const caption = String(view?.caption || "");
  const profileButtonText = String(view?.keyboard?.[1]?.[0]?.text || "");

  assert.match(caption, /Alpha \[Wolves\]/);
  assert.match(caption, /Bravo \[Dragons\]/);
  assert.match(profileButtonText, /Wolves/);
});
