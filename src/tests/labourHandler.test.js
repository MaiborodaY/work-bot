import test from "node:test";
import assert from "node:assert/strict";
import { labourHandler } from "../handlers/labour.js";

test("labour handler: buy_slot uses in-memory user and does not reload stale user", async () => {
  let loadCalls = 0;
  let shownCaption = "";
  const u = {
    id: "u1",
    lang: "ru",
    money: 100000,
    premium: 100,
    biz: { owned: [{ id: "shawarma", boughtAt: 0, lastClaimDayUTC: "", slots: [] }] }
  };

  await labourHandler.handle({
    data: "labour:buy_slot:shawarma:0",
    u,
    cb: { id: "cb1", message: { message_id: 1 } },
    answer: async () => {},
    goTo: async () => {},
    users: {
      load: async () => {
        loadCalls += 1;
        return { id: "u1", lang: "ru" };
      }
    },
    locations: {
      _sourceMsg: null,
      media: {
        show: async (view) => {
          shownCaption = String(view?.caption || "");
        }
      },
      setSourceMessage: () => {}
    },
    labour: {
      buySlot: async (ownerArg) => {
        ownerArg.__slotBought = true;
        return { ok: true, slotIndex: 0 };
      },
      buildBizView: async (ownerArg) => ({
        caption: ownerArg.__slotBought ? "slot bought" : "slot missing",
        keyboard: []
      })
    },
    thief: null,
    achievements: null,
    ratings: null,
    quests: null
  });

  assert.equal(loadCalls, 0);
  assert.equal(shownCaption, "slot bought");
});

