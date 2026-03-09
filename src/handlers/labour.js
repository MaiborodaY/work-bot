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
        policy: "auto"
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
      const bizId = String(data.split(":")[2] || "");
      const res = await labour.buySlot(u, bizId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.buy_slot_failed"));
        await goTo(u, "Labour");
        return;
      }
      await reloadSelf();
      await goTo(
        u,
        "Labour",
        tt("handler.labour.buy_slot_ok", { money: res.money, gems: res.gems })
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
      const bizId = String(data.split(":")[2] || "");
      const view = await labour.buildHireListView(u, bizId);
      await show(view);
      return;
    }

    if (data.startsWith("labour:hire:")) {
      await answer(cb.id);
      const bizId = String(data.split(":")[2] || "");
      const employeeId = String(data.split(":")[3] || "");
      const res = await labour.hire(u, bizId, employeeId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.hire_failed"));
        await goTo(u, "Labour");
        return;
      }
      await reloadSelf();
      await goTo(u, "Labour", tt("handler.labour.hire_ok", { name: res.employeeName }));
      return;
    }

    if (data.startsWith("labour:rehire:")) {
      await answer(cb.id);
      const bizId = String(data.split(":")[2] || "");
      const res = await labour.hireLast(u, bizId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.labour.rehire_failed"));
        await goTo(u, "Labour");
        return;
      }
      await reloadSelf();
      await goTo(u, "Labour", tt("handler.labour.hire_ok", { name: res.employeeName }));
      return;
    }
  }
};
