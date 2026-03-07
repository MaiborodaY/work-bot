export const stocksHandler = {
  match: (data) =>
    data === "stocks:refresh" ||
    data === "stocks:info" ||
    data.startsWith("stocks:view:") ||
    data.startsWith("stocks:buy:") ||
    data.startsWith("stocks:sell:") ||
    data.startsWith("stocks:sellall:"),

  async handle(ctx) {
    const { data, u, cb, answer, goTo, stocks, locations } = ctx;
    if (!stocks) {
      await answer(cb.id, "Биржа временно недоступна.");
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Stocks",
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "stocks:refresh") {
      await answer(cb.id);
      await goTo(u, "Stocks");
      return;
    }

    if (data === "stocks:info") {
      await answer(cb.id);
      const view = stocks.buildInfoView();
      await show(view);
      return;
    }

    if (data.startsWith("stocks:view:")) {
      await answer(cb.id);
      const ticker = data.split(":")[2] || "";
      const view = await stocks.buildTickerView(u, ticker);
      if (!view) {
        await answer(cb.id, "Акция не найдена.");
        await goTo(u, "Stocks");
        return;
      }
      await show(view);
      return;
    }

    if (data.startsWith("stocks:buy:")) {
      const ticker = data.split(":")[2] || "";
      const qty = Number(data.split(":")[3] || 0);
      const res = await stocks.buy(u, ticker, qty);
      await answer(cb.id, res.ok ? "Покупка выполнена." : (res.error || "Не удалось купить."));
      await goTo(
        u,
        "Stocks",
        res.ok
          ? `✅ Куплено ${res.sharesBought} акц. ${ticker} по $${res.price}\nСписано: $${res.cost}`
          : `⚠️ ${res.error || "Не удалось купить акции."}`
      );
      return;
    }

    if (data.startsWith("stocks:sellall:")) {
      const ticker = data.split(":")[2] || "";
      const shares = stocks.getHoldingShares(u, ticker);
      if (!shares) {
        await answer(cb.id, "У тебя нет акций для продажи.");
        await goTo(u, "Stocks");
        return;
      }
      const res = await stocks.sell(u, ticker, shares);
      await answer(cb.id, res.ok ? "Продажа выполнена." : (res.error || "Не удалось продать."));
      await goTo(
        u,
        "Stocks",
        res.ok
          ? `✅ Продано ${res.sharesSold} акц. ${ticker}\nВыручка: $${res.gross}\nКомиссия: $${res.fee}\nНачислено: $${res.net}`
          : `⚠️ ${res.error || "Не удалось продать акции."}`
      );
      return;
    }

    if (data.startsWith("stocks:sell:")) {
      const ticker = data.split(":")[2] || "";
      const qty = Number(data.split(":")[3] || 0);
      const res = await stocks.sell(u, ticker, qty);
      await answer(cb.id, res.ok ? "Продажа выполнена." : (res.error || "Не удалось продать."));
      await goTo(
        u,
        "Stocks",
        res.ok
          ? `✅ Продано ${res.sharesSold} акц. ${ticker}\nВыручка: $${res.gross}\nКомиссия: $${res.fee}\nНачислено: $${res.net}`
          : `⚠️ ${res.error || "Не удалось продать акции."}`
      );
      return;
    }
  }
};
