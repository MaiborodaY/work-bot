import { Routes } from "../Routes.js";
import { normalizeLang, t } from "../i18n/index.js";

export const quizHandler = {
  match: (data) =>
    data === "quiz:open" ||
    data === "quiz:start" ||
    data === "quiz:next" ||
    data.startsWith("quiz:answer:"),

  async handle(ctx) {
    const { data, u, cb, answer, locations, quiz } = ctx;
    const lang = normalizeLang(u?.lang || "en");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!quiz) {
      await answer(cb.id, tt("loc.quiz.unavailable"));
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

    if (data === "quiz:open") {
      await answer(cb.id);
      const view = await quiz.buildOpenView(u);
      await show(view);
      return;
    }

    if (data === "quiz:start" || data === "quiz:next") {
      await answer(cb.id);
      const view = await quiz.buildQuestionView(u);
      await show(view);
      return;
    }

    if (data.startsWith("quiz:answer:")) {
      const shownIndex = Number(data.split(":")[2] || -1);
      const res = await quiz.answer(u, shownIndex);
      if (!res?.ok) {
        await answer(cb.id, res?.error || tt("loc.quiz.unavailable"));
        return;
      }
      await answer(cb.id);
      await show(res.view);
    }
  }
};

