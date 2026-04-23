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

test("home ui: keeps bed status out of keyboard and shows bed-upgrades button", () => {
  const ui = new UiFactory();
  const user = makeUser(["bed1"]);

  const kb = ui.home(user, { backTo: Routes.CITY }, "en");
  const currentButton = kb.find((row) => String(row?.[0]?.text || "").includes("Current bed"));
  const upgradeBtn = kb.find((row) => row?.[0]?.callback_data === `go:${Routes.HOME_BED_UPGRADES}`);

  assert.equal(currentButton, undefined);
  assert.ok(upgradeBtn);
});

test("home bed status caption: shows current bed bonus", () => {
  const ui = new UiFactory();
  const user = makeUser(["bed1"]);

  const caption = ui.homeBedStatusCaption(user, "en");

  assert.match(caption, /Current bed/i);
  assert.match(caption, /\+50%/i);
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
