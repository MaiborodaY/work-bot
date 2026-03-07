import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";

function packCreditedWithPct(pack) {
  const base = Number(pack.gems) || 0;
  const pct  = Number(pack.bonusPct || 0);
  const bonus = Math.ceil(base * pct / 100);
  return { base, pct, bonus, credited: base + bonus };
}

export const premiumHandler = {
  match: (data) =>
    typeof data === "string" &&
    (data === "go:Premium" || data === "premium:open" || data.startsWith("premium:buy:")),

  async handle(ctx) {
    const { data, cb, answer, sendWithInline, stars, chatId, u, locations  } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    try {
      const packs = Array.isArray(CONFIG.PREMIUM?.PACKS) ? CONFIG.PREMIUM.PACKS : [];

      // Открытие магазина
      if (data === "go:Premium" || data === "premium:open") {
        await answer(cb.id);
      
        if (!packs.length) {
          await locations.media.show({
            sourceMsg: cb.message,
            place: "Premium", // 🆕 баннер из ASSETS.Premium
            caption: tt("premium.shop.unavailable"),
            keyboard: [[{ text: tt("worker.btn.back"), callback_data: "go:ShopHub" }]], // 🆕 назад в хаб магазинов
            policy: "photo",
          });
          return;
        }
      
        const firstX2Active = !u.firstPurchaseBonusUsed;
        const headLines = [
          tt("premium.shop.title"),
          tt("premium.shop.line1"),
          tt("premium.shop.line2"),
          tt("premium.shop.line3"),
          "",
          tt("premium.shop.balance", { emoji: CONFIG.PREMIUM.emoji, amount: u.premium || 0 }),
          tt("premium.shop.choose"),
        ];
        if (firstX2Active) headLines.splice(1, 0, tt("premium.shop.first_x2"));
        const caption = headLines.join("\n");
      
        const keyboard = packs.map(p => {
          const { credited, pct } = packCreditedWithPct(p);
          const pctLabel = pct > 0 ? ` (+${pct}%)` : "";
          const priceStars = Number(p.price_stars ?? p.gems) || 0;
          return [{
            text: `⭐ ${priceStars} → ${CONFIG.PREMIUM.emoji}${credited}${pctLabel}`,
            callback_data: `premium:buy:${p.id}`
          }];
        });
        keyboard.push([{ text: tt("worker.btn.back"), callback_data: "go:ShopHub" }]); // 🆕
      
        await locations.media.show({
          sourceMsg: cb.message,
          place: "Premium",   // 🆕 баннер
          caption,
          keyboard,
          policy: "photo",
        });
        return;
      }
      

      // Покупка
      if (data.startsWith("premium:buy:")) {
        await answer(cb.id);

        if (!packs.length) {
          await sendWithInline(
            tt("premium.buy.packs_unavailable"),
            [[{ text: tt("ui.back.square"), callback_data: "go:Square" }]]
          );
          return;
        }

        const packId = data.split(":")[2];
        const pack = packs.find(p => String(p.id) === String(packId));
        if (!pack) {
          await sendWithInline(
            tt("premium.buy.pack_not_found"),
            [[{ text: tt("worker.btn.back"), callback_data: "go:Premium" }]]
          );
          return;
        }

        const { base, pct, bonus, credited } = packCreditedWithPct(pack);
        const isFirst = !u.firstPurchaseBonusUsed;
        const totalGet = isFirst ? credited * 2 : credited;

        // Stars-цена — как и раньше
        const amount = Number(pack.price_stars || pack.gems) || 0;

        const descLines = [
          tt("premium.invoice.pack", { emoji: CONFIG.PREMIUM.emoji, base }),
          pct > 0
            ? tt("premium.invoice.bonus_yes", { pct, bonus })
            : tt("premium.invoice.bonus_no"),
          tt("premium.invoice.total_now", { emoji: CONFIG.PREMIUM.emoji, credited }),
        ];
        if (isFirst) descLines.push(tt("premium.invoice.first_x2_total", { emoji: CONFIG.PREMIUM.emoji, totalGet }));

        await stars.sendStarsInvoice({
          chatId,
          title: tt("premium.invoice.title", { emoji: CONFIG.PREMIUM.emoji }),
          description: descLines.join("\n"),
          payload: stars.buildPayload({ packId: pack.id, userId: u.id }),
          currency: "XTR",
          prices: [{ label: `⭐ ${amount}`, amount }]
        });
        return;
      }
    } catch {
      try { await answer(cb.id, tt("premium.error.try_later")); } catch {}
      return;
    }
  }
};
