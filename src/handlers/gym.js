import { GymService } from "../GymService.js";
import { FastForwardService } from "../FastForwardService.js";
import { normalizeLang, t } from "../i18n/index.js";

export const gymHandler = {
  match: (data) =>
  data === "gym:start" ||
  data === "gym:finish" ||   // ← без вопроса
  data === "gym:skip",


  async handle(ctx) {
    const { u, cb, answer, users, locations, now, send, orders, social, labour } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    const gym = new GymService({ users, send, now, social, labour });
    const ff  = new FastForwardService({ users, orders, now, send });

    // старт тренировки
    if (ctx.data === "gym:start") {
      const res = await gym.start(u);
      if (!res.ok) {
        const lowEnergy = String(res.error || "").toLowerCase().includes("энерг");
        if (lowEnergy) {
          // записываем «куда вернуться» в БД
          u.nav = typeof u.nav === "object" && u.nav ? u.nav : {};
          u.nav.backTo = "Gym";
          await users.save(u);
    
          await answer(cb.id, tt("handler.gym.low_energy_to_shop"));
          await ctx.goTo(u, "Shop", tt("handler.common.shop_energy_intro"));
          return;
        }
    
        await answer(cb.id, res.error || tt("handler.gym.start_failed"));
        await locations.show(u, null, "Gym");
        return;
      }
    
      const mins = Math.max(1, Math.round(res.timeMs / 60000));
      const intro = tt("handler.gym.started_intro", {
        costMoney: res.costMoney,
        costEnergy: res.costEnergy,
        mins
      });
      await answer(cb.id, tt("handler.gym.started_ok"));
      await locations.show(u, intro, "Gym");
      return;
    }
    

    if (ctx.data === "gym:skip") {
      const res = await ff.finishNow(u, "gym");
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.gym.skip_failed"));
        await locations.show(u, null, "Gym");
        return;
      }
      await answer(cb.id, tt("handler.gym.skip_ok", { cost: res.cost }));
      await locations.show(u, null, "Gym");
      return;
    }
    

// ручное завершение после окончания таймера
if (ctx.data === "gym:finish") {
  // защита от раннего клика
  const endAt = u?.gym?.endAt || 0;
  if (!u?.gym?.active) {
    await answer(cb.id, tt("handler.gym.not_active"));
    await locations.show(u, null, "Gym");
    return;
  }
  if (now() < endAt) {
    await answer(cb.id, tt("handler.gym.not_ready"));
    return;
  }

  // завершаем стандартным путём (как раньше делал автофиниш)
  const finished = await gym.maybeFinish(u, async (_u, place, intro) => {
    // всегда остаёмся в экране Gym, показывая итог
    await locations.show(_u, intro || tt("handler.gym.finished_intro"), "Gym");
  });

  if (!finished) {
    await answer(cb.id, tt("handler.gym.finish_failed"));
    return;
  }

  await answer(cb.id, tt("handler.gym.finish_ok"));
  return;
}

  }
};
