import { Routes } from "../Routes.js";
import { normalizeLang, t } from "../i18n/index.js";

export const ratingsHandler = {
  match: (data) => data.startsWith("rating:tab:"),

  async handle(ctx) {
    const { data, u, cb, answer, locations, ratings } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!ratings || typeof ratings.buildView !== "function") {
      await answer(cb.id, tt("loc.rating.unavailable"));
      return;
    }

    const cat = String(data.split(":")[2] || "biz").trim() || "biz";
    const view = await ratings.buildView(u, cat);

    await locations.media.show({
      sourceMsg: locations._sourceMsg || cb?.message || null,
      place: Routes.CITY_BOARD,
      caption: view.caption,
      keyboard: view.keyboard,
      policy: "auto"
    });
    locations.setSourceMessage(null);
    await answer(cb.id);
  }
};

