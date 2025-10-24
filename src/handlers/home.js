import { CONFIG } from "../GameConfig.js";
import { HomeService } from "../HomeService.js";

export const homeHandler = {
  match: (data) =>
    data === "rest:start" ||
    data === "rest:stop"  ||
    data.startsWith("eat_"),

  async handle(ctx) {
    const { data, u, cb, answer, users, now, goTo, random } = ctx;

    // === ОТДЫХ ===
    if (data === "rest:start") {
      await answer(cb.id, "Начинаю отдых…");

      try {
        if (random && typeof random.maybeOnRestStart === "function") {
          await random.maybeOnRestStart(u);
        }
      } catch {}

      u.rest = u.rest || {};
      u.rest.active = true;
      u.rest.last = now();
      await users.save(u);

      await goTo(u, "Home", "🛏️ Ты начал отдыхать.");
      return;
    }

    if (data === "rest:stop") {
      if (!u.rest?.active) {
        await answer(cb.id, "Сейчас ты не отдыхаешь.");
        return;
      }
      await answer(cb.id, "Останавливаю отдых…");

      const elapsed = now() - (u.rest.last || now());
      const perEnergyMs = CONFIG.REST_RECOVER_MS;
      let gain = Math.floor(elapsed / perEnergyMs);

      // множитель сна из сервиса
      const mult = HomeService.currentRestMultiplier(u);
      gain = Math.floor(gain * mult);

      // применяем энергию (здесь авто-стоп не нужен — мы сами стопаем ниже)
      const res = HomeService.applyEnergy(u, gain, { autoStopRest: false });

      u.rest.active = false;
      await users.save(u);

      await goTo(u, "Home", `🛌 Отдых прерван: +${res.gained}⚡ (${u.energy}/${u.energy_max}).`);
      return;
    }

    // === ЕДА (из старого инвентаря) ===
    if (data.startsWith("eat_")) {
      const key = data.replace("eat_", "");
      const it = CONFIG.SHOP[key];
      if (!it || (u.inv?.[key] || 0) <= 0) {
        await answer(cb.id, "Такой еды нет.");
        return;
      }

      const res = HomeService.applyEnergy(u, it.heal, { autoStopRest: true });
      u.inv[key] -= 1;
      await users.save(u);

      const extra = res.stopped ? " Отдых остановлен — полная энергия." : "";
      await goTo(u, "Home", `🍽️ Ты съел: ${it.title}. Энергия: ${u.energy}/${u.energy_max}.${extra}`);
      return;
    }
  }
};
