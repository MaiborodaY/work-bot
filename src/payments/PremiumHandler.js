import { CONFIG } from "../GameConfig.js";

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

    try {
      const packs = Array.isArray(CONFIG.PREMIUM?.PACKS) ? CONFIG.PREMIUM.PACKS : [];

      // Открытие магазина
      if (data === "go:Premium" || data === "premium:open") {
        await answer(cb.id);
      
        if (!packs.length) {
          await locations.media.show({
            sourceMsg: cb.message,
            place: "Premium", // 🆕 баннер из ASSETS.Premium
            caption: "💎 Магазин временно недоступен.",
            keyboard: [[{ text: "⬅️ Назад", callback_data: "go:ShopHub" }]], // 🆕 назад в хаб магазинов
            policy: "photo",
          });
          return;
        }
      
        const firstX2Active = !u.firstPurchaseBonusUsed;
        const headLines = [
          "💎 Кристаллы",
          "Редкая валюта — только из заданий и топов.",
          "Нужны для премиум-покупок и слотов наёмников.",
          "Не трать на мелочи — копи на слоты.",
          "",
          `Баланс: ${CONFIG.PREMIUM.emoji}${u.premium || 0}`,
          `Выбери пакет:`,
        ];
        if (firstX2Active) headLines.splice(1, 0, "🎁 Первая покупка — ×2 к выдаче!");
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
        keyboard.push([{ text: "⬅️ Назад", callback_data: "go:ShopHub" }]); // 🆕
      
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
            "💎 Пакеты недоступны.",
            [[{ text: "⬅️ На Площадь", callback_data: "go:Square" }]]
          );
          return;
        }

        const packId = data.split(":")[2];
        const pack = packs.find(p => String(p.id) === String(packId));
        if (!pack) {
          await sendWithInline(
            "Пакет не найден.",
            [[{ text: "⬅️ Назад", callback_data: "go:Premium" }]]
          );
          return;
        }

        const { base, pct, bonus, credited } = packCreditedWithPct(pack);
        const isFirst = !u.firstPurchaseBonusUsed;
        const totalGet = isFirst ? credited * 2 : credited;

        // Stars-цена — как и раньше
        const amount = Number(pack.price_stars || pack.gems) || 0;

        const descLines = [
          `Пакет: ${CONFIG.PREMIUM.emoji}${base}`,
          pct > 0 ? `Бонус пакета: +${pct}% → +${bonus}` : `Бонус пакета: нет`,
          `Итого получите сейчас: ${CONFIG.PREMIUM.emoji}${credited}`,
        ];
        if (isFirst) descLines.push(`🎁 Первая покупка ×2 → ИТОГО: ${CONFIG.PREMIUM.emoji}${totalGet}`);

        await stars.sendStarsInvoice({
          chatId,
          title: `${CONFIG.PREMIUM.emoji} Кристаллы`,
          description: descLines.join("\n"),
          payload: stars.buildPayload({ packId: pack.id, userId: u.id }),
          currency: "XTR",
          prices: [{ label: `⭐ ${amount}`, amount }]
        });
        return;
      }
    } catch {
      try { await answer(cb.id, "Ошибка магазина. Попробуй позже."); } catch {}
      return;
    }
  }
};
