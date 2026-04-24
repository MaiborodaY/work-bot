import { CONFIG } from "../GameConfig.js";
import { HomeService } from "../HomeService.js";
import { EnergyService } from "../EnergyService.js";
import { normalizeLang, t } from "../i18n/index.js";
import { getShopTitle } from "../I18nCatalog.js";
import { Routes } from "../Routes.js";
import { InventoryService } from "../InventoryService.js";

export const shopHandler = {
  match: (data) => String(data || "").startsWith("buy_") || data === "shop:mode:toggle",

  async handle(ctx) {
    const { data, u, cb, answer, users, goTo, quests } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!u.settings || typeof u.settings !== "object") u.settings = {};
    if (!u.settings.shopBuyMode) u.settings.shopBuyMode = "buy_use";

    if (data === "shop:mode:toggle") {
      u.settings.shopBuyMode = u.settings.shopBuyMode === "buy_use" ? "buy" : "buy_use";
      await users.save(u);
      await answer(cb.id, tt(u.settings.shopBuyMode === "buy" ? "handler.shop.mode_changed_buy" : "handler.shop.mode_changed_buy_use"));
      return;
    }

    const key = String(data || "").replace("buy_", "").trim();
    const it = CONFIG.SHOP[key];
    if (!it) {
      await answer(cb.id, tt("handler.shop.unknown_item"));
      return;
    }
    const itemTitle = getShopTitle(key, lang) || it.title;

    if (typeof it.price === "number") {
      const effectiveEnergyMax = EnergyService.effectiveEnergyMax(u);
      const buyMode = String(u?.settings?.shopBuyMode || "buy_use");
      const buyToInventory = buyMode === "buy" && InventoryService.isUsable(key);

      if (!buyToInventory && (u.energy || 0) >= effectiveEnergyMax) {
        await answer(cb.id, tt("handler.shop.energy_full_skip"));
        return;
      }
      if ((u.money || 0) < it.price) {
        await answer(cb.id, tt("handler.shop.not_enough_money"));
        return;
      }

      u.money -= it.price;
      if (buyToInventory) {
        InventoryService.add(u, key, 1);
      } else {
        HomeService.applyEnergy(u, it.heal, { autoStopRest: false });
      }

      let newbieCompleted = false;
      if (quests?.markNewbieAction) {
        try {
          newbieCompleted = !!quests.markNewbieAction(u, "shop_buy", { key });
        } catch {}
      }

      await users.save(u);
      await goTo(
        u,
        newbieCompleted ? Routes.BAR_NEWBIE_TASKS : Routes.SHOP,
        tt(buyToInventory ? "handler.shop.bought_to_inventory" : "handler.shop.bought_money_ok", { title: itemTitle })
      );
      return;
    }

    if (typeof it.price_premium === "number") {
      const need = it.price_premium;
      if ((u.premium || 0) < need) {
        await answer(cb.id, tt("handler.shop.not_enough_gems", { emoji: CONFIG.PREMIUM.emoji, need }));
        return;
      }

      if (key === "coke_zero") {
        const effectiveEnergyMax = EnergyService.effectiveEnergyMax(u);
        if ((u.energy || 0) >= effectiveEnergyMax) {
          await answer(cb.id, tt("handler.shop.energy_full_no_gems"));
          return;
        }

        const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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

        u.premium -= need;
        const toMax = effectiveEnergyMax - (u.energy || 0);
        HomeService.applyEnergy(u, toMax, { autoStopRest: false });
        u.premiumDaily.coke = (u.premiumDaily.coke || 0) + 1;

        await users.save(u);
        await goTo(
          u,
          Routes.SHOP,
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

      u.premium -= need;
      await users.save(u);
      await goTo(u, Routes.SHOP, tt("handler.shop.bought_gems_ok", {
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
