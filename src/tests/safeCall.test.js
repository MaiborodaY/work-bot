import test from "node:test";
import assert from "node:assert/strict";
import { safeCall } from "../SafeCall.js";

test("safeCall returns result on success", async () => {
  const value = await safeCall("ok.case", async () => 123);
  assert.equal(value, 123);
});

test("safeCall returns fallback and logs error tag", async () => {
  const logs = [];
  const logger = {
    error(msg) {
      logs.push(String(msg || ""));
    }
  };

  const value = await safeCall(
    "fail.case",
    async () => {
      throw new Error("boom");
    },
    { fallback: "fallback", logger }
  );

  assert.equal(value, "fallback");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[safeCall:fail\.case\]/);
  assert.match(logs[0], /boom/);
});

