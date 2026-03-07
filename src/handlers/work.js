// handlers/work.js
import { JobService } from "../JobService.js";
import { FastForwardService } from "../FastForwardService.js";
import { CONFIG } from "../GameConfig.js";

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
    const { data, u, cb, answer, users, now, social, clans, labour, goTo, orders, send, sendWithInline } = ctx;

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

    // Доп. проверка для онбординга: разрешаем только первое задание
    if (data.startsWith("work:start:") && u?.flags?.onboarding) {
      const typeId = data.split(":")[2];
      const firstType = Object.keys(CONFIG.JOBS || {})[0];
      if (firstType && typeId !== firstType) {
        await answer(cb.id, "Для знакомства с игрой можно начать только с первого задания.");
        await render();
        return;
      }
    }

    if (data.startsWith("work:start:")) {
      const typeId = data.split(":")[2];

      // Если максимальной энергии не хватает для выбранной работы — сразу ведём в зал
      try {
        const jobType = (CONFIG && CONFIG.JOBS) ? CONFIG.JOBS[typeId] : null;
        const hasCoffee = Array.isArray(u?.upgrades) && u.upgrades.includes("coffee");
        const requiredEnergy = jobType ? (hasCoffee ? Math.ceil(jobType.energy * 0.95) : jobType.energy) : null;
        const energyCap = typeof u?.energy_max === "number" ? u.energy_max : (CONFIG?.ENERGY_MAX ?? 100);
        if (requiredEnergy != null && energyCap < requiredEnergy) {
          u.nav = typeof u.nav === "object" && u.nav ? u.nav : {};
          u.nav.backTo = "Work";
          await users.save(u);
          try { await answer(cb.id, "Сначала прокачай максимум энергии — загляни в зал."); } catch {}
          await ctx.goTo(u, "Gym", "Прокачай максимум энергии, чтобы взять смену.");
          return;
        }
      } catch {}

      const res = await jobs.start(u, typeId);
      if (!res.ok) {
        const lowEnergy = String(res.error || "").toLowerCase().includes("энерг");
        if (lowEnergy) {
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

      // Обновляем шаг онбординга после запуска первой смены
      try {
        if (u?.flags?.onboarding) {
          u.flags.onboardingStep = "go_gym";
          await users.save(u);
        }
      } catch {}

      await answer(
        cb.id,
        `▶️ Начало: ${res.inst.title} (~${Math.ceil((res.inst.endAt - now()) / 60000)} мин)`
      );
      await render();
      return;
    }

    if (data === "work:goto:home") {
      ctx.locations.setBack("Work");
      await ctx.goTo(u, "Home", "Восстанови энергию и вернемся к работе.");
      return;
    }

    if (data === "work:goto:shop") {
      ctx.locations.setBack("Work");
      await ctx.goTo(u, "Shop", "Купи что-то для энергии и вернемся к работе.");
      return;
    }

    if (data === "work:claim") {
      const res = await jobs.claim(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось выдать выплату.");
        return;
      }
      try {
        if (clans?.recordWorkMoney) {
          await clans.recordWorkMoney(u, res.pay);
        }
      } catch {}
      try {
        if (labour?.onEmployeePaid) {
          await labour.onEmployeePaid(u, res.pay, res.endAt);
        }
      } catch {}
      await answer(cb.id, `Готово: +$${res.pay}`);
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
      try {
        if (clans?.recordWorkMoney) {
          await clans.recordWorkMoney(u, claim.pay);
        }
      } catch {}
      try {
        if (labour?.onEmployeePaid) {
          await labour.onEmployeePaid(u, claim.pay, claim.endAt);
        }
      } catch {}

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
      await answer(cb.id, `⏹ Работа отменена (штраф −5⚡).`);
      await render();
      return;
    }
  }
};
