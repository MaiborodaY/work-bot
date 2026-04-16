import test from "node:test";
import assert from "node:assert/strict";
import {
  isCombatZone,
  isCombatSelectionValid,
  combatDefenseOptions,
  combatZoneDamage,
  resolveCombatRound,
  decideCombatWinner
} from "../CombatEngine.js";

test("combat engine: attack and defense cannot target the same zone", () => {
  assert.equal(isCombatSelectionValid("head", "head"), false);
  assert.equal(isCombatSelectionValid("body", "body"), false);
  assert.equal(isCombatSelectionValid("legs", "legs"), false);
  assert.equal(isCombatSelectionValid("head", "body"), true);
});

test("combat engine: defense options hide selected attack zone", () => {
  assert.deepEqual(combatDefenseOptions("head"), ["body", "legs"]);
  assert.deepEqual(combatDefenseOptions("body"), ["head", "legs"]);
  assert.deepEqual(combatDefenseOptions("legs"), ["head", "body"]);
});

test("combat engine: zone damage matches design", () => {
  assert.equal(combatZoneDamage("head"), 3);
  assert.equal(combatZoneDamage("body"), 2);
  assert.equal(combatZoneDamage("legs"), 1);
  assert.equal(combatZoneDamage("bad"), 0);
  assert.equal(isCombatZone("head"), true);
  assert.equal(isCombatZone("bad"), false);
});

test("combat engine: resolves simultaneous round damage", () => {
  const res = resolveCombatRound(
    { attack: "head", defense: "legs" },
    { attack: "body", defense: "legs" }
  );

  assert.equal(res.left.dealt, 3);
  assert.equal(res.left.taken, 2);
  assert.equal(res.right.dealt, 2);
  assert.equal(res.right.taken, 3);
});

test("combat engine: blocked hit deals zero", () => {
  const res = resolveCombatRound(
    { attack: "head", defense: "legs" },
    { attack: "body", defense: "head" }
  );
  assert.equal(res.left.dealt, 0);
  assert.equal(res.right.taken, 0);

  const blocked = resolveCombatRound(
    { attack: "head", defense: "body" },
    { attack: "legs", defense: "head" }
  );
  assert.equal(blocked.left.dealt, 0);
  assert.equal(blocked.right.taken, 0);
});

test("combat engine: tie can be awarded to owner", () => {
  assert.equal(decideCombatWinner(5, 5, { tieWinner: "owner" }), "owner");
  assert.equal(decideCombatWinner(6, 5, { tieWinner: "owner" }), "left");
  assert.equal(decideCombatWinner(4, 7, { tieWinner: "owner" }), "right");
});
