import { Routes } from "../Routes.js";
import { normalizeLang } from "../i18n/index.js";

export const syndicateHandler = {
  match: (data) =>
    data === "syn:open" ||
    data === "syn:refresh" ||
    data === "syn:help" ||
    data === "syn:odds" ||
    data === "syn:rating:week" ||
    data === "syn:rating:all" ||
    data.startsWith("syn:biz:") ||
    data.startsWith("syn:createask:") ||
    data.startsWith("syn:createconfirm:") ||
    data.startsWith("syn:create:") ||
    data.startsWith("syn:accept:") ||
    data.startsWith("syn:cancel:") ||
    data === "syn:noop",

  async handle(ctx) {
    const { data, u, cb, answer, locations, goTo, syndicate } = ctx;
    if (!syndicate) {
      await answer(cb.id);
      return;
    }
    const lang = normalizeLang(u?.lang || "en");
    void lang;

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: Routes.SYNDICATE,
        caption: String(view?.caption || ""),
        keyboard: Array.isArray(view?.keyboard) ? view.keyboard : [[{ text: "⬅️", callback_data: "go:City" }]],
        asset: view?.asset || undefined,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "syn:noop") {
      await answer(cb.id);
      return;
    }

    if (data === "syn:open") {
      await answer(cb.id);
      await goTo(u, Routes.SYNDICATE);
      return;
    }

    if (data === "syn:refresh") {
      await answer(cb.id);
      const view = await syndicate.buildMainView(u);
      await show(view);
      return;
    }

    if (data === "syn:help") {
      await answer(cb.id);
      const view = await syndicate.buildHelpView(u);
      await show(view);
      return;
    }

    if (data === "syn:odds") {
      await answer(cb.id);
      const view = await syndicate.buildOddsView(u);
      await show(view);
      return;
    }

    if (data === "syn:rating:week" || data === "syn:rating:all") {
      await answer(cb.id);
      const period = data.endsWith(":all") ? "all" : "week";
      const view = await syndicate.buildRatingView(u, period);
      await show(view);
      return;
    }

    if (data.startsWith("syn:biz:")) {
      await answer(cb.id);
      const bizId = String(data.split(":")[2] || "").trim();
      const view = await syndicate.buildBusinessView(u, bizId);
      await show(view);
      return;
    }

    if (data.startsWith("syn:create:")) {
      const parts = data.split(":");
      const bizId = String(parts[2] || "").trim();
      const tierId = String(parts[3] || "").trim().toLowerCase();
      const res = await syndicate.createDeal(u, bizId, tierId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      const view = await syndicate.buildBusinessView(u, bizId);
      await show(view);
      return;
    }

    if (data.startsWith("syn:createask:")) {
      await answer(cb.id);
      const parts = data.split(":");
      const bizId = String(parts[2] || "").trim();
      const tierId = String(parts[3] || "").trim().toLowerCase();
      const view = await syndicate.buildCreateConfirmView(u, bizId, tierId);
      await show(view);
      return;
    }

    if (data.startsWith("syn:createconfirm:")) {
      const parts = data.split(":");
      const bizId = String(parts[2] || "").trim();
      const tierId = String(parts[3] || "").trim().toLowerCase();
      const res = await syndicate.createDeal(u, bizId, tierId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      const view = await syndicate.buildBusinessView(u, bizId);
      await show(view);
      return;
    }

    if (data.startsWith("syn:accept:")) {
      const dealId = String(data.split(":")[2] || "").trim();
      const res = await syndicate.acceptDeal(u, dealId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      const deal = await syndicate._loadDeal(dealId);
      const bizId = String(deal?.bizId || "");
      if (bizId) {
        const view = await syndicate.buildBusinessView(u, bizId);
        await show(view);
      } else {
        const view = await syndicate.buildMainView(u);
        await show(view);
      }
      return;
    }

    if (data.startsWith("syn:cancel:")) {
      const dealId = String(data.split(":")[2] || "").trim();
      const deal = await syndicate._loadDeal(dealId);
      const bizId = String(deal?.bizId || "");
      const res = await syndicate.cancelDeal(u, dealId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      if (bizId) {
        const view = await syndicate.buildBusinessView(u, bizId);
        await show(view);
      } else {
        const view = await syndicate.buildMainView(u);
        await show(view);
      }
    }
  }
};
