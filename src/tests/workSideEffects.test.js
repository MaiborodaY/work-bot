import test from "node:test";
import assert from "node:assert/strict";
import { applyWorkClaimSideEffects } from "../handlers/work.js";

test("work claim side effects continue when one dependency throws", async () => {
  const calls = [];
  const logs = [];

  const ctx = {
    u: { id: "42" },
    clans: {
      async recordWorkMoney() {
        calls.push("clan");
      }
    },
    labour: {
      async onEmployeePaid() {
        calls.push("labour");
        throw new Error("labour failed");
      }
    },
    referrals: {
      async tryRewardReferral() {
        calls.push("referral");
      }
    },
    logger: {
      error(msg) {
        logs.push(String(msg || ""));
      }
    }
  };

  await applyWorkClaimSideEffects(ctx, 100, Date.now());

  assert.deepEqual(calls, ["clan", "labour", "referral"]);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /\[safeCall:work\.side_effect\.labour\]/);
});

