import { GymService } from "../GymService.js";
import { FastForwardService } from "../FastForwardService.js";

export const gymHandler = {
  match: (data) =>
  data === "gym:start" ||
  data === "gym:finish" ||   // ← без вопроса
  data === "gym:skip",


  async handle(ctx) {
    const { u, cb, answer, users, locations, now, send, orders, social } = ctx;

    const gym = new GymService({ users, send, now, social });
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
    
          await answer(cb.id, "⚡ Не хватает энергии — открыл магазин.");
          await ctx.goTo(u, "Shop", "Пополнить энергию можно здесь:");
          return;
        }
    
        await answer(cb.id, res.error || "Не удалось начать тренировку.");
        await locations.show(u, null, "Gym");
        return;
      }
    
      const mins = Math.max(1, Math.round(res.timeMs / 60000));
      const intro = `🏋️ Тренировка начата: −$${res.costMoney}, −${res.costEnergy}⚡, ~${mins} мин.\nМожешь заняться другими делами`;
      await answer(cb.id, "🏁 Запустил тренировку.");
      await locations.show(u, intro, "Gym");
      return;
    }
    

    if (ctx.data === "gym:skip") {
      const res = await ff.finishNow(u, "gym");
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось завершить мгновенно.");
        await locations.show(u, null, "Gym");
        return;
      }
      await answer(cb.id, `⏩ Мгновенно завершено (−💎${res.cost}).`);
      await locations.show(u, null, "Gym");
      return;
    }
    

// ручное завершение после окончания таймера
if (ctx.data === "gym:finish") {
  // защита от раннего клика
  const endAt = u?.gym?.endAt || 0;
  if (!u?.gym?.active) {
    await answer(cb.id, "Тренировка не идёт.");
    await locations.show(u, null, "Gym");
    return;
  }
  if (now() < endAt) {
    await answer(cb.id, "Ещё не закончено.");
    return;
  }

  // завершаем стандартным путём (как раньше делал автофиниш)
  const finished = await gym.maybeFinish(u, async (_u, place, intro) => {
    // всегда остаёмся в экране Gym, показывая итог
    await locations.show(_u, intro || "🏋️ Тренировка завершена.", "Gym");
  });

  if (!finished) {
    await answer(cb.id, "Не удалось завершить.");
    return;
  }

  await answer(cb.id, "✅ Завершено.");
  return;
}

  }
};