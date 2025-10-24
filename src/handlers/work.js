// handlers/work.js
import { JobService } from "../JobService.js";
import { FastForwardService } from "../FastForwardService.js";

export const workHandler = {
  match: (data) =>
  data === "work:open" ||
  data.startsWith("work:start:") ||
  data === "work:claim" ||
  data === "work:cancel" ||
  data === "work:skip" ||
  data === "work:goto:home" ||
  data === "work:goto:shop",

  async handle(ctx) {
    const { data, u, cb, answer, users, now, social, goTo, orders, send, sendWithInline } = ctx;

    const jobs = new JobService({ users, now, social });
    const ff = new FastForwardService({ users, orders, now, send });

    async function render(intro) {
      await goTo(u, "Work", intro || null);
    }

    if (data === "work:open") {
      await answer(cb.id);
      await render();
      return;
    }

    if (data.startsWith("work:start:")) {
      const typeId = data.split(":")[2];
      const res = await jobs.start(u, typeId);
      if (!res.ok) {
        const lowEnergy = String(res.error || "").toLowerCase().includes("энерг");
        if (lowEnergy) {
          // Пишем флаг в БД
          u.nav = typeof u.nav === "object" && u.nav ? u.nav : {};
          u.nav.backTo = "Work";
          await users.save(u);
    
          await answer(cb.id, "⚡ Не хватает энергии — открыл магазин.");
          await ctx.goTo(u, "Shop", "Пополнить энергию можно здесь:");
          return;
        }
        await answer(cb.id, res.error || "Не удалось начать работу.");
        return;
      }
      await answer(cb.id, `▶️ Начал: ${res.inst.title} (~${Math.ceil((res.inst.endAt - now()) / 60000)} мин)`);
      await render();
      return;
    }
    
    
    
    
    
    if (data === "work:goto:home") {
      ctx.locations.setBack("Work");
      await ctx.goTo(u, "Home", "⚡ Восстанови энергию и вернёмся к работе.");
      return;
    }
    
    if (data === "work:goto:shop") {
      ctx.locations.setBack("Work");
      await ctx.goTo(u, "Shop", "🛒 Купи что-нибудь для энергии и вернёмся к работе.");
      return;
    }

    if (data === "work:claim") {
      const res = await jobs.claim(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось выдать выплату.");
        return;
      }
      await answer(cb.id, `✅ Готово: +$${res.pay}`);
      await render();
      return;
    }

    if (data === "work:skip") {
      const res = await ff.finishNow(u, "work");
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось завершить мгновенно.");
        await render();
        return;
      }

      // Вариант A: сразу начисляем выплату через JobService.claim (social передан в JobService)
      const claim = await jobs.claim(u);
      if (!claim.ok) {
        await answer(cb.id, claim.error || "Не удалось выдать выплату.");
        await render();
        return;
      }

      await answer(cb.id, `⏩ Мгновенно завершено (−💎${res.cost}). +$${claim.pay}`);
      await render();
      return;
    }

    if (data === "work:cancel") {
      const res = await jobs.cancel(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось отменить.");
        return;
      }
      await answer(cb.id, `⏹️ Работа отменена (штраф −5⚡).`);
      await render();
      return;
    }
  }
};
