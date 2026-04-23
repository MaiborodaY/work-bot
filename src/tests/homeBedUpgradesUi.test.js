import test from "node:test";
import assert from "node:assert/strict";
import { UiFactory } from "../UiFactory.js";
import { Routes } from "../Routes.js";
import { getUpgradeTitle } from "../I18nCatalog.js";

function makeUser(upgrades = []) {
  return {
    id: "u-home-bed",
    lang: "en",
    upgrades: [...upgrades],
    rest: { active: false, last: 0 },
    inv: {},
  };
}

test("home ui: shows current bed bonus and bed-upgrades button", () => {
  const ui = new UiFactory();
  const user = makeUser(["bed1"]);

  const kb = ui.home(user, { backTo: Routes.CITY }, "en");
  const current = kb.find((row) => row?.[0]?.callback_data === "noop");
  const upgradeBtn = kb.find((row) => row?.[0]?.callback_data === `go:${Routes.HOME_BED_UPGRADES}`);

  assert.ok(current);
  assert.match(String(current[0].text || ""), /\+50%/i);
  assert.ok(upgradeBtn);
});

test("home bed upgrades ui: strict tier order and unified statuses", () => {
  const ui = new UiFactory();
  const user = makeUser(["bed1"]);

  const rows = ui.homeBedUpgrades(user, { backTo: Routes.HOME }, "en");
  const bedRows = rows.slice(0, 3).map((row) => row[0]);
  const expectedTitles = [
    getUpgradeTitle("bed1", "en"),
    getUpgradeTitle("bed2", "en"),
    getUpgradeTitle("bed3", "en"),
  ];

  assert.ok(String(bedRows[0]?.text || "").includes("Purchased"));
  assert.equal(bedRows[0]?.callback_data, "noop");
  assert.ok(String(bedRows[1]?.text || "").includes("Available"));
  assert.equal(bedRows[1]?.callback_data, "upg:buy:bed2");
  assert.ok(String(bedRows[2]?.text || "").includes("Locked"));
  assert.equal(bedRows[2]?.callback_data, "noop");

  for (let i = 0; i < 3; i++) {
    assert.match(String(bedRows[i]?.text || ""), /\$/);
    assert.ok(String(bedRows[i]?.text || "").includes(expectedTitles[i]));
  }
});

