import { CONFIG } from "../GameConfig.js";
import { HomeService } from "../HomeService.js";
import { EnergyService } from "../EnergyService.js";
import { normalizeLang, t } from "../i18n/index.js";
import { getShopTitle } from "../I18nCatalog.js";

export const shopHandler = {
  match: (data) => data.startsWith("buy_"),

  async handle(ctx) {
    const { data, u, cb, answer, users, goTo, quests } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    const key = data.replace("buy_","").trim();
    const it = CONFIG.SHOP[key];
    if (!it) { await answer(cb.id, tt("handler.shop.unknown_item")); return; }
    const itemTitle = getShopTitle(key, lang) || it.title;

    // ===== Покупка за обычные $ (еда — моменталка) =====
    if (typeof it.price === "number") {
      // Блокируем покупку, если уже полный кап энергии
      const effectiveEnergyMax = EnergyService.effectiveEnergyMax(u);
      if ((u.energy || 0) >= effectiveEnergyMax) {
        await answer(cb.id, tt("handler.shop.energy_full_skip"));
        return;
      }
      if ((u.money || 0) < it.price) {
        await answer(cb.id, tt("handler.shop.not_enough_money"));
        return;
      }

      u.money -= it.price;

      // Моментальное применение энергии с авто-стопом отдыха - АВТОСТОП ВЫКЛЮЧЕН FALSE
      const res = HomeService.applyEnergy(u, it.heal, { autoStopRest: false });
      void res;

      if (quests?.markNewbieAction) {
        try {
          quests.markNewbieAction(u, "shop_buy", { key });
        } catch {}
      }

      await users.save(u);
      await goTo(
        u,
        "Shop",
        tt("handler.shop.bought_money_ok", { title: itemTitle })
      );
      return;
    }

    // ===== Покупка за 💎 (премиум) =====
    if (typeof it.price_premium === "number") {
      const need = it.price_premium;
      if ((u.premium || 0) < need) { await answer(cb.id, tt("handler.shop.not_enough_gems", { emoji: CONFIG.PREMIUM.emoji, need })); return; }

      // Спец-логика для Coca-Cola Zero (полный рефил, 3/день UTC, блок при полном капе)
      if (key === "coke_zero") {
        // Блокируем, если уже полный кап
        const effectiveEnergyMax = EnergyService.effectiveEnergyMax(u);
        if ((u.energy || 0) >= effectiveEnergyMax) {
          await answer(cb.id, tt("handler.shop.energy_full_no_gems"));
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
          await answer(cb.id, tt("handler.shop.coke_limit_reached"));
          return;
        }

        // Списание и эффект полного рефила
        u.premium -= need;
              // Моментальное применение энергии с авто-стопом отдыха - АВТОСТОП ВЫКЛЮЧЕН FALSE
        const toMax = effectiveEnergyMax - (u.energy || 0);
        HomeService.applyEnergy(u, toMax, { autoStopRest: false });
        u.premiumDaily.coke = (u.premiumDaily.coke || 0) + 1;

        await users.save(u);

        await goTo(
          u,
          "Shop",
          tt("handler.shop.coke_drink_ok", {
            title: itemTitle,
            energy: u.energy,
            energyMax: effectiveEnergyMax,
            emoji: CONFIG.PREMIUM.emoji,
            premium: u.premium
          })
        );
        return;
      }

      // На будущее: другие прем-товары — дефолтная покупка без энергии
      u.premium -= need;
      await users.save(u);
      await goTo(u, "Shop", tt("handler.shop.bought_gems_ok", {
        emoji: CONFIG.PREMIUM.emoji,
        need,
        title: itemTitle,
        premium: u.premium
      }));
      return;
    }

    await answer(cb.id, tt("handler.shop.unavailable"));
  }
};
