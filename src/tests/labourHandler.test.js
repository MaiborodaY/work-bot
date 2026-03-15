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

test("labour handler: hire ignores stale owner snapshot without target business", async () => {
  let shownCaption = "";
  const u = {
    id: "u1",
    lang: "ru",
    money: 100000,
    premium: 100,
    biz: { owned: [{ id: "courier_service", boughtAt: 0, lastClaimDayUTC: "", slots: [] }] }
  };

  await labourHandler.handle({
    data: "labour:hire:courier_service:0:emp1",
    u,
    cb: { id: "cb2", message: { message_id: 2 } },
    answer: async () => {},
    goTo: async () => {},
    users: { load: async () => null },
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
      hire: async () => ({
        ok: true,
        // stale snapshot: business list missing courier_service
        owner: { id: "u1", lang: "ru", biz: { owned: [] } }
      }),
      buildBizView: async (ownerArg, bizId) => {
        const owned = Array.isArray(ownerArg?.biz?.owned) ? ownerArg.biz.owned : [];
        const has = owned.some((it) => (typeof it === "string" ? it === bizId : it?.id === bizId));
        return { caption: has ? "biz owned" : "biz missing", keyboard: [] };
      }
    },
    thief: null,
    achievements: null,
    ratings: null,
    quests: null
  });

  assert.equal(shownCaption, "biz owned");
});
