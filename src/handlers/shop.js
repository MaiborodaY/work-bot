import { CONFIG } from "../GameConfig.js";
import { HomeService } from "../HomeService.js";

export const shopHandler = {
  match: (data) => data.startsWith("buy_"),

  async handle(ctx) {
    const { data, u, cb, answer, users, goTo } = ctx;

    const key = data.replace("buy_","").trim();
    const it = CONFIG.SHOP[key];
    if (!it) { await answer(cb.id,"Неизвестный товар."); return; }

    // ===== Покупка за обычные $ (еда — моменталка) =====
    if (typeof it.price === "number") {
      // Блокируем покупку, если уже полный кап энергии
      if ((u.energy || 0) >= (u.energy_max || CONFIG.ENERGY_MAX)) {
        await answer(cb.id, "Энергия уже полная — покупать не нужно.");
        return;
      }
      if ((u.money || 0) < it.price) {
        await answer(cb.id,"Недостаточно денег 💸");
        return;
      }

      u.money -= it.price;

      // Моментальное применение энергии с авто-стопом отдыха - АВТОСТОП ВЫКЛЮЧЕН FALSE
      const res = HomeService.applyEnergy(u, it.heal, { autoStopRest: false });

      await users.save(u);
      await goTo(
        u,
        "Shop",
        `✅ Куплено: ${it.title}`
      );
      return;
    }

    // ===== Покупка за 💎 (премиум) =====
    if (typeof it.price_premium === "number") {
      const need = it.price_premium;
      if ((u.premium || 0) < need) { await answer(cb.id, `Недостаточно ${CONFIG.PREMIUM.emoji}${need}.`); return; }

      // Спец-логика для Coca-Cola Zero (полный рефил, 3/день UTC, блок при полном капе)
      if (key === "coke_zero") {
        // Блокируем, если уже полный кап
        if ((u.energy || 0) >= (u.energy_max || CONFIG.ENERGY_MAX)) {
          await answer(cb.id, "Энергия уже полная — не трать кристаллы.");
          return;
        }

        const dayKey = new Date().toISOString().slice(0,10).replace(/-/g,"");
        if (!u.premiumDaily || typeof u.premiumDaily !== "object") {
          u.premiumDaily = { day: "", coke: 0 };
        }
        if (u.premiumDaily.day !== dayKey) {
          u.premiumDaily.day = dayKey;
          u.premiumDaily.coke = 0;
        }
        if ((u.premiumDaily.coke || 0) >= 3) {
          await answer(cb.id, "Лимит Coca-Cola Zero на сегодня исчерпан (3/день, UTC).");
          return;
        }

        // Списание и эффект полного рефила
        u.premium -= need;
              // Моментальное применение энергии с авто-стопом отдыха - АВТОСТОП ВЫКЛЮЧЕН FALSE
        const toMax = (u.energy_max || CONFIG.ENERGY_MAX) - (u.energy || 0);
        HomeService.applyEnergy(u, toMax, { autoStopRest: false });
        u.premiumDaily.coke = (u.premiumDaily.coke || 0) + 1;

        await users.save(u);

        await goTo(
          u,
          "Shop",
          `✅ Выпито: ${it.title}.\n⚡ ${u.energy}/${u.energy_max}\nБаланс: ${CONFIG.PREMIUM.emoji}${u.premium}`
        );
        return;
      }

      // На будущее: другие прем-товары — дефолтная покупка без энергии
      u.premium -= need;
      await users.save(u);
      await goTo(u, "Shop", `✅ Куплено за ${CONFIG.PREMIUM.emoji}${need}: ${it.title}. Баланс: ${CONFIG.PREMIUM.emoji}${u.premium}`);
      return;
    }

    await answer(cb.id,"Товар недоступен для покупки.");
  }
};
