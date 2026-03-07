import { StudyService } from "../StudyService.js";
import { FastForwardService } from "../FastForwardService.js";
import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";

export const studyHandler = {
  match: (data) => data === "study:start" || data === "study:skip" || data === "study:finish",

  async handle(ctx) {
    const { u, cb, answer, users, locations, now, send, goTo, orders, social } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const study = new StudyService({ users, send, now, social });
    const ff = new FastForwardService({ users, orders, now, send });

    // ✅ обычное завершение, когда время вышло
    if (ctx.data === "study:finish") {
      await answer(cb.id);
      const fin = await study.finish(u);
      if (!fin.ok) {
        await goTo(u, "Study");
        return;
      }
      await goTo(u, "Study", tt("handler.study.finish_ok", { level: fin.level }));
      return;
    }

    // ⏩ мгновенное завершение за кристаллы
    if (ctx.data === "study:skip") {
      const res = await ff.finishNow(u, "study");
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.study.skip_failed"));
        await goTo(u, "Study");
        return;
      }
      const fin = await study.finish(u);
      if (!fin.ok) {
        await answer(cb.id, tt("handler.study.finish_failed"));
        await goTo(u, "Study");
        return;
      }
      await answer(cb.id, tt("handler.study.skip_ok", { gems: CONFIG.PREMIUM.emoji, cost: res.cost }));
      await goTo(u, "Study", tt("handler.study.finish_ok", { level: fin.level }));
      return;
    }

    // Автозавершение отключено — не проверяем maybeFinish здесь

    // Старт
// Пытаемся запустить обучение
const res = await study.start(u);
if (!res.ok) {
  const lowEnergy = String(res.error || "").toLowerCase().includes("энерг");
  if (lowEnergy) {
    // записываем «куда вернуться» в БД
    u.nav = typeof u.nav === "object" && u.nav ? u.nav : {};
    u.nav.backTo = "Study";
    await users.save(u);

    await answer(cb.id, tt("handler.study.low_energy_to_shop"));
    await goTo(u, "Shop", tt("handler.common.shop_energy_intro"));
    return;
  }

  await answer(cb.id, res.error || tt("handler.study.start_failed"));
  await goTo(u, "Study");
  return;
}

    const mins = Math.ceil(res.timeMs / 60000);
    const intro = tt("handler.study.started_intro", {
      costMoney: res.costMoney,
      costEnergy: res.costEnergy,
      mins
    });
    await answer(cb.id, tt("handler.study.started_ok"));
    await goTo(u, "Study", intro);
  }
};
