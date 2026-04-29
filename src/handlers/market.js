import { normalizeLang, t } from "../i18n/index.js";
import { Routes } from "../Routes.js";

export const marketHandler = {
  match: (data) =>
    data === "market:open" ||
    data === "market:refresh" ||
    data.startsWith("market:item:") ||
    data.startsWith("market:sell:") ||
    data.startsWith("market:sellall:"),

  async handle(ctx) {
    const { data, u, cb, answer, market, locations, goTo } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!market) {
      await answer(cb.id, tt("handler.market.unavailable"));
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: Routes.MARKET,
        caption: String(view?.caption || ""),
        keyboard: Array.isArray(view?.keyboard) ? view.keyboard : [[{ text: tt("market.btn.back_earn"), callback_data: "go:Earn" }]],
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "market:open" || data === "market:refresh") {
      await answer(cb.id);
      await goTo(u, Routes.MARKET);
      return;
    }

    if (data.startsWith("market:item:")) {
      await answer(cb.id);
      const itemId = String(data.split(":")[2] || "").trim();
      const view = await market.buildItemView(u, itemId);
      await show(view);
      return;
    }

    if (data.startsWith("market:sellall:")) {
      const itemId = String(data.split(":")[2] || "").trim();
      const res = await market.sellAll(u, itemId);
      await answer(cb.id, String(res?.ok ? res.toast : (res?.error || tt("handler.common.unknown_command"))).slice(0, 180));
      await goTo(u, Routes.MARKET);
      return;
    }

    if (data.startsWith("market:sell:")) {
      const parts = data.split(":");
      const itemId = String(parts[2] || "").trim();
      const qty = Number(parts[3] || 0);
      const res = await market.sell(u, itemId, qty);
      await answer(cb.id, String(res?.ok ? res.toast : (res?.error || tt("handler.common.unknown_command"))).slice(0, 180));
      if (!res?.ok) {
        const view = await market.buildItemView(u, itemId);
        await show(view);
        return;
      }
      await goTo(u, Routes.MARKET);
    }
  }
};

