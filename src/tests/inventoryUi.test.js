import test from "node:test";
import assert from "node:assert/strict";
import { UiFactory } from "../UiFactory.js";

function makeUser(inv = {}) {
  return {
    id: "u-inventory-ui",
    lang: "ru",
    inv: { ...inv },
    rest: { active: false, last: 0 },
    upgrades: [],
  };
}

test("inventory ui: empty inventory shows empty state and back button only", () => {
  const ui = new UiFactory();
  const user = makeUser({});

  const caption = ui.inventoryCaption(user, "ru");
  const kb = ui.inventory(user, {}, "ru");

  assert.match(String(caption || ""), /Инвентарь пуст/i);
  assert.equal(kb.length, 1);
  assert.match(String(kb[0]?.[0]?.text || ""), /Назад/i);
  assert.equal(
    kb.some((row) => String(row?.[0]?.text || "").includes("Использовать")),
    false
  );
});

test("inventory ui: crop item is rendered as supply ingredient without use button", () => {
  const ui = new UiFactory();
  const user = makeUser({ crop_tomato: 3 });

  const caption = ui.inventoryCaption(user, "en");
  const kb = ui.inventory(user, {}, "en");

  assert.match(String(caption || ""), /Tomato x3/);
  assert.match(String(caption || ""), /business supply ingredient/);
  assert.equal(
    kb.some((row) => String(row?.[0]?.callback_data || "") === "inv:use:crop_tomato"),
    false
  );
});

test("inventory ui: coffee item is rendered in caption with quantity and energy effect", () => {
  const ui = new UiFactory();
  const user = makeUser({ coffee: 3 });

  const caption = ui.inventoryCaption(user, "ru");

  assert.match(String(caption || ""), /☕ Кофе x3 — \+10 ⚡/i);
});

test("inventory ui: coffee item has use button with exact label", () => {
  const ui = new UiFactory();
  const user = makeUser({ coffee: 3 });

  const kb = ui.inventory(user, {}, "ru");
  const coffeeBtn = kb.find((row) => String(row?.[0]?.text || "") === "Использовать ☕ Кофе");

  assert.ok(coffeeBtn);
});

test("inventory ui: multiple usable items render in stable order", () => {
  const ui = new UiFactory();
  const user = makeUser({ coffee: 3, sandwich: 2, lunch: 1 });

  const caption = ui.inventoryCaption(user, "ru");
  const kb = ui.inventory(user, {}, "ru");
  const useRows = kb.filter((row) => String(row?.[0]?.text || "").startsWith("Использовать"));

  assert.match(String(caption || ""), /☕ Кофе x3 — \+10 ⚡/i);
  assert.match(String(caption || ""), /🥪 Сэндвич x2 — \+25 ⚡/i);
  assert.match(String(caption || ""), /🍲 Бизнес-ланч x1 — \+50 ⚡/i);
  assert.equal(useRows[0]?.[0]?.text, "Использовать ☕ Кофе");
  assert.equal(useRows[1]?.[0]?.text, "Использовать 🥪 Сэндвич");
  assert.equal(useRows[2]?.[0]?.text, "Использовать 🍲 Бизнес-ланч");
});

test("inventory ui: zero-count items are not shown", () => {
  const ui = new UiFactory();
  const user = makeUser({ coffee: 0, sandwich: 2 });

  const caption = ui.inventoryCaption(user, "ru");

  assert.doesNotMatch(String(caption || ""), /Кофе/i);
  assert.match(String(caption || ""), /Сэндвич x2/i);
});

test("inventory ui: mango seed is rendered as material without use button", () => {
  const ui = new UiFactory();
  const user = makeUser({ mango_seed: 2 });

  const caption = ui.inventoryCaption(user, "ru");
  const kb = ui.inventory(user, {}, "ru");

  assert.match(String(caption || ""), /Семя манго x2 — для фермы/i);
  assert.equal(
    kb.some((row) => String(row?.[0]?.text || "").includes("Манго")),
    false
  );
});

test("inventory ui: fertilizer is rendered as material without use button", () => {
  const ui = new UiFactory();
  const user = makeUser({ fertilizer: 2 });

  const caption = ui.inventoryCaption(user, "ru");
  const kb = ui.inventory(user, {}, "ru");

  assert.match(String(caption || ""), /Удобрение x2 — мгновенно завершает рост/i);
  assert.equal(
    kb.some((row) => String(row?.[0]?.text || "").includes("Удобрение")),
    false
  );
});
