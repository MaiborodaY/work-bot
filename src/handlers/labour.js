import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";

export const labourHandler = {
  match: (data) =>
    data === "labour:help" ||
    data.startsWith("labour:biz:") ||
    data.startsWith("labour:buy_biz:") ||
    data.startsWith("labour:buy_slot:") ||
    data.startsWith("labour:hire_list:") ||
    data.startsWith("labour:hire:") ||
    data.startsWith("labour:rehire:"),

  async handle(ctx) {
    const { data, u, cb, answer, goTo, users, locations, labour, thief, achievements, ratings, quests } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    if (!labour) {
      await answer(cb.id, tt("handler.labour.unavailable"));
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Labour",
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    const applyFreshOwner = (freshOwner) => {
      if (!freshOwner || typeof freshOwner !== "object") return;
      for (const k of Object.keys(u)) delete u[k];
      Object.assign(u, freshOwner);
    };

    const showBiz = async (bizId, options = {}) => {
      const view = await labour.buildBizView(u, bizId, options);
      await show(view);
    };

    if (data === "labour:help") {
      await answer(cb.id);
      const view = await labour.buildHelpView(u);
      await show(view);
      return;
    }

    if (data.startsWith("labour:biz:")) {
      await answer(cb.id);
      const bizId = String(data.split(":")[2] || "");
      await showBiz(bizId);
      return;
    }

    if (data.startsWith("labour:buy_biz:")) {
      await answer(cb.id);
      const bizId = String(data.split(":")[2] || "");
      const B = CONFIG?.BUSINESS?.[bizId] || null;
      if (!B) {
        await answer(cb.id, tt("handler.business.not_found"));
        await showBiz(bizId);
        return;
      }

      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      const isOwned = ownedArr.some((it) => (typeof it === "string" ? it === B.id : it?.id === B.id));
      if (!isOwned) {
        const price = Number(B.price) || 0;
        const money = Math.max(0, Number(u?.money) || 0);
        if (money < price) {
          await answer(cb.id, tt("handler.business.not_enough_money"));
          await showBiz(bizId);
          return;
        }

        u.money = money - price;
        if (!u.biz) u.biz = {};
        if (!Array.isArray(u.biz.owned)) u.biz.owned = [];
        u.biz.owned.push({
          id: B.id,
          boughtAt: Date.now(),
          lastClaimDayUTC: "",
          pendingTheftAmount: 0,
          guardUntil: 0,
          immunityUntil: 0,
          guardBlocked: 0
        });
        await users.save(u);
        try {
          if (achievements?.onEvent) {
            await achievements.onEvent(u, "business_buy", { bizId: B.id });
          }
        } catch {}
        try {
          if (quests?.onEvent) {
            await quests.onEvent(u, "biz_expand", { bizId: B.id });
          }
        } catch {}
        try {
          if (thief?.upsertBizOwner) {
            await thief.upsertBizOwner(u.id, B.id);
          }
        } catch {}
        try {
          if (ratings?.updateUser) {
            await ratings.updateUser(u, ["biz"]);
          }
        } catch {}
      }

      await showBiz(bizId);
      return;
    }

    if (data.startsWith("labour:buy_slot:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const bizId = String(parts[2] || "");
      const slotIndex = Number(parts[3]);
      const res = await labour.buySlot(u, bizId, Number.isFinite(slotIndex) ? slotIndex : -1);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.buy_slot_failed"));
        await showBiz(bizId);
        return;
      }
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "slot_buy", {
            bizId,
            slotIndex: Number.isFinite(slotIndex) ? slotIndex : -1
          });
        }
      } catch {}
      try {
        if (quests?.onEvent) {
          await quests.onEvent(u, "biz_expand", {
            bizId,
            slotIndex: Number.isFinite(slotIndex) ? slotIndex : -1
          });
        }
      } catch {}
      try {
        if (ratings?.updateUser) {
          await ratings.updateUser(u, ["biz"]);
        }
      } catch {}
      await showBiz(bizId);
      return;
    }

    if (data.startsWith("labour:hire_list:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const bizId = String(parts[2] || "");
      const slotIndex = Number(parts[3]);
      const view = await labour.buildHireListView(u, bizId, Number.isFinite(slotIndex) ? slotIndex : -1);
      await show(view);
      return;
    }

    if (data.startsWith("labour:hire:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const bizId = String(parts[2] || "");
      let slotIndex = -1;
      let employeeId = "";
      if (parts.length >= 5) {
        slotIndex = Number(parts[3]);
        employeeId = String(parts[4] || "");
      } else {
        employeeId = String(parts[3] || "");
      }
      const res = await labour.hire(u, bizId, Number.isFinite(slotIndex) ? slotIndex : -1, employeeId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.hire_failed"));
        await showBiz(bizId);
        return;
      }
      applyFreshOwner(res?.owner);
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "labour_hire", {
            bizId,
            employeeId: String(res?.employeeId || employeeId || ""),
            slotIndex: Number.isFinite(slotIndex) ? slotIndex : Number(res?.slotIndex || -1)
          });
        }
      } catch {}
      await showBiz(bizId, { reconcile: false });
      return;
    }

    if (data.startsWith("labour:rehire:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const bizId = String(parts[2] || "");
      const slotIndex = Number(parts[3]);
      const res = await labour.hireLast(u, bizId, Number.isFinite(slotIndex) ? slotIndex : -1);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.rehire_failed"));
        await showBiz(bizId);
        return;
      }
      applyFreshOwner(res?.owner);
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "labour_hire", {
            bizId,
            employeeId: String(res?.employeeId || ""),
            slotIndex: Number.isFinite(slotIndex) ? slotIndex : Number(res?.slotIndex || -1)
          });
        }
      } catch {}
      await showBiz(bizId, { reconcile: false });
      return;
    }
  }
};
