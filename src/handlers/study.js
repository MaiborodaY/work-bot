import { StudyService } from "../StudyService.js";
import { FastForwardService } from "../FastForwardService.js";
import { CONFIG } from "../GameConfig.js";

export const studyHandler = {
  match: (data) => data === "study:start" || data === "study:skip" || data === "study:finish",

  async handle(ctx) {
    const { u, cb, answer, users, locations, now, send, goTo, orders, social } = ctx;
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
      await goTo(u, "Study", `🎓 Обучение завершено! Уровень: ${fin.level}.`);
      return;
    }

    // ⏩ мгновенное завершение за кристаллы
    if (ctx.data === "study:skip") {
      const res = await ff.finishNow(u, "study");
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось завершить мгновенно.");
        await goTo(u, "Study");
        return;
      }
      const fin = await study.finish(u);
      if (!fin.ok) {
        await answer(cb.id, "Не удалось завершить обучение.");
        await goTo(u, "Study");
        return;
      }
      await answer(cb.id, `⏩ Мгновенно завершено (−${CONFIG.PREMIUM.emoji}${res.cost}).`);
      await goTo(u, "Study", `🎓 Обучение завершено! Уровень: ${fin.level}.`);
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

    await answer(cb.id, "⚡ Не хватает энергии — открыл магазин.");
    await goTo(u, "Shop", "Пополнить энергию можно здесь:");
    return;
  }

  await answer(cb.id, res.error || "Не удалось начать обучение.");
  await goTo(u, "Study");
  return;
}

    const mins = Math.ceil(res.timeMs / 60000);
    const intro = `🎓 Учёба начата: −$${res.costMoney}, −${res.costEnergy}⚡, ~${mins} мин.\nМожешь заняться другими делами`;
    await answer(cb.id, "📘 Запустил обучение.");
    await goTo(u, "Study", intro);
  }
};
