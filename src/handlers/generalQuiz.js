import { Routes } from "../Routes.js";
import { normalizeLang, t } from "../i18n/index.js";

export const generalQuizHandler = {
  match: (data) =>
    data === "gquiz:open" ||
    data === "gquiz:start" ||
    data === "gquiz:next" ||
    data.startsWith("gquiz:answer:"),

  async handle(ctx) {
    const { data, u, cb, answer, locations, generalQuiz } = ctx;
    const lang = normalizeLang(u?.lang || "en");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!generalQuiz) {
      await answer(cb.id, tt("loc.quiz_general.unavailable"));
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: Routes.BAR,
        caption: String(view?.caption || ""),
        keyboard: Array.isArray(view?.keyboard) ? view.keyboard : [[{ text: "⬅️", callback_data: "go:Bar" }]],
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "gquiz:open") {
      await answer(cb.id);
      const view = await generalQuiz.buildOpenView(u);
      await show(view);
      return;
    }

    if (data === "gquiz:start" || data === "gquiz:next") {
      await answer(cb.id);
      const view = await generalQuiz.buildQuestionView(u);
      await show(view);
      return;
    }

    if (data.startsWith("gquiz:answer:")) {
      const shownIndex = Number(data.split(":")[2] || -1);
      const res = await generalQuiz.answer(u, shownIndex);
      if (!res?.ok) {
        await answer(cb.id, res?.error || tt("loc.quiz_general.unavailable"));
        return;
      }
      await answer(cb.id);
      await show(res.view);
    }
  }
};

