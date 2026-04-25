import test from "node:test";
import assert from "node:assert/strict";
import { UiFactory } from "../UiFactory.js";

test("study active ui: ready state does not render manual finish button", () => {
  const ui = new UiFactory();

  const kb = ui.studyActive(100, { ready: true }, "en");
  const flat = kb.flat();

  assert.equal(flat.some((btn) => btn?.callback_data === "study:finish"), false);
  assert.equal(flat.some((btn) => /finish study/i.test(String(btn?.text || ""))), false);
});
