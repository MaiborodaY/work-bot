import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";
import { getUpgradeTitle } from "../I18nCatalog.js";

function bedTier(key) {
  if (key === "bed3") return 3;
  if (key === "bed2") return 2;
  if (key === "bed1") return 1;
  return 0;
}

function maxOwnedBedTier(u) {
  const up = Array.isArray(u.upgrades) ? u.upgrades : [];
  if (up.includes("bed3")) return 3;
  if (up.includes("bed2")) return 2;
  if (up.includes("bed1")) return 1;
  return 0;
}

function purgeLowerBeds(u) {
  if (!Array.isArray(u.upgrades)) return;
  const t = maxOwnedBedTier(u);
  if (t <= 1) return;
  const keep = new Set(u.upgrades);
  if (t >= 2) keep.delete("bed1");
  if (t >= 3) { keep.delete("bed2"); keep.delete("bed1"); }
  u.upgrades = Array.from(keep);
}

export const upgradesHandler = {
  match: (data) =>
    data.startsWith("upg:buy:") ||
    data.startsWith("upg:buy_p:") ||
    data === "noop",

  async handle(ctx) {
    const { data, u, cb, answer, users, goTo, locations } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (data === "noop") {
      await answer(cb.id, tt("handler.upgrades.already_bought"));
      return;
    }

    const routeNow = (locations && locations._route) ? locations._route : "Upgrades";
    const key = (data.split(":")[2] || "").trim();
    const item = CONFIG.UPGRADES[key];
    if (!item) { await answer(cb.id, tt("handler.upgrades.unknown")); return; }
    const title = getUpgradeTitle(key, lang) || item.title || key;

    const isBed = bedTier(key) > 0;
    const backRoute = isBed ? "Home" : (routeNow === "Home" ? "Home" : "Upgrades");

    u.upgrades = Array.isArray(u.upgrades) ? u.upgrades : [];
    const owned = new Set(u.upgrades);

    if (owned.has(key)) {
      await answer(cb.id, tt("handler.upgrades.you_already_have"));
      return;
    }

    // запрет покупки кровати ниже текущего тира
    if (isBed) {
      const curTier = maxOwnedBedTier(u);
      const wantTier = bedTier(key);
      if (curTier > 0 && wantTier <= curTier) {
        await answer(cb.id, tt("handler.upgrades.bed_higher_owned"));
        return;
      }
    }

    // покупка за $
    if (data.startsWith("upg:buy:") && !data.startsWith("upg:buy_p:")) {
      if ((u.money || 0) < item.price) {
        await answer(cb.id, tt("handler.upgrades.not_enough_money", { price: item.price }));
        return;
      }
      u.money -= item.price;
      u.upgrades.push(key);
      if (isBed) purgeLowerBeds(u);
      await users.save(u);

      await answer(cb.id, tt("handler.upgrades.buy_money_ok", { title, price: item.price }));
      await goTo(u, backRoute);
      return;
    }

    // покупка за 💎
    if (data.startsWith("upg:buy_p:")) {
      const need = item.price_premium;
      if (typeof need !== "number") {
        await answer(cb.id, tt("handler.upgrades.cannot_buy_with_gems"));
        return;
      }
      if ((u.premium || 0) < need) {
        await answer(cb.id, tt("handler.upgrades.not_enough_gems", { emoji: CONFIG.PREMIUM.emoji, need }));
        return;
      }
      u.premium -= need;
      u.upgrades.push(key);
      if (isBed) purgeLowerBeds(u);
      await users.save(u);

      await answer(cb.id, tt("handler.upgrades.buy_gems_ok", { title, emoji: CONFIG.PREMIUM.emoji, need }));
      await goTo(u, backRoute);
      return;
    }
  }
};
