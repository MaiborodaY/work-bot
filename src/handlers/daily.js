// handlers/daily.js
import { normalizeLang, t } from "../i18n/index.js";

export const dailyHandler = {
  match: (data) => data === "daily:claim",

  async handle(ctx) {
    const { u, cb, answer, daily, locations, clans } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    await answer(cb.id, "");

    const res = await daily.claim(u);
    if (res.ok) {
      try {
        if (clans?.recordActiveAction) {
          await clans.recordActiveAction(u, 1, 1);
        }
      } catch {}

      await locations.show(
        u,
        tt("handler.daily.claim_ok", { amount: res.amount, streak: res.streak })
      );
    } else {
      await locations.show(u, tt("handler.daily.already_claimed"));
    }
  }
};

