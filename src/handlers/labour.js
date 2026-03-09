import { normalizeLang, t } from "../i18n/index.js";

export const labourHandler = {
  match: (data) =>
    data === "labour:help" ||
    data.startsWith("labour:buy_slot:") ||
    data.startsWith("labour:hire_list:") ||
    data.startsWith("labour:hire:") ||
    data.startsWith("labour:rehire:"),

  async handle(ctx) {
    const { data, u, cb, answer, goTo, users, locations, labour } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    if (!labour) {
      await answer(cb.id, tt("handler.labour.unavailable"));
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Business",
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "text"
      });
      locations.setSourceMessage(null);
    };

    const reloadSelf = async () => {
      const fresh = await users.load(u.id).catch(() => null);
      if (!fresh) return;
      for (const k of Object.keys(u)) delete u[k];
      Object.assign(u, fresh);
    };

    if (data.startsWith("labour:buy_slot:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const bizId = String(parts[2] || "");
      const slotIndex = Number(parts[3]);
      const res = await labour.buySlot(u, bizId, Number.isFinite(slotIndex) ? slotIndex : -1);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.buy_slot_failed"));
        await goTo(u, "Labour");
        return;
      }
      await reloadSelf();
      await goTo(
        u,
        "Labour",
        tt("handler.labour.buy_slot_ok", {
          slotNum: res.slotNum,
          money: res.money,
          gems: res.gems,
          pct: Math.max(0, Math.floor((Number(res.ownerPct) || 0) * 100))
        })
      );
      return;
    }

    if (data === "labour:help") {
      await answer(cb.id);
      const view = await labour.buildHelpView(u);
      await show(view);
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
        await goTo(u, "Labour");
        return;
      }
      await reloadSelf();
      await goTo(u, "Labour", tt("handler.labour.hire_ok", { name: res.employeeName, slotNum: res.slotNum }));
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
        await goTo(u, "Labour");
        return;
      }
      await reloadSelf();
      await goTo(u, "Labour", tt("handler.labour.hire_ok", { name: res.employeeName, slotNum: res.slotNum }));
      return;
    }
  }
};
