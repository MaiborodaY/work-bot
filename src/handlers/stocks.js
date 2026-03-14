import { normalizeLang, t } from "../i18n/index.js";

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
    const l = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, l, vars);
    if (!stocks) {
      await answer(cb.id, tt("handler.stocks.unavailable"));
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

    const showTickerWithNotice = async (ticker, notice) => {
      const view = await stocks.buildTickerView(u, ticker);
      if (!view) {
        await goTo(u, "Stocks", notice);
        return;
      }
      await show({
        caption: notice ? `${notice}\n\n${view.caption}` : view.caption,
        keyboard: view.keyboard
      });
    };

    if (data === "stocks:refresh") {
      await answer(cb.id);
      await goTo(u, "Stocks");
      return;
    }

    if (data === "stocks:info") {
      await answer(cb.id);
      const view = stocks.buildInfoView(u);
      await show(view);
      return;
    }

    if (data.startsWith("stocks:view:")) {
      await answer(cb.id);
      const ticker = data.split(":")[2] || "";
      const view = await stocks.buildTickerView(u, ticker);
      if (!view) {
        await answer(cb.id, tt("handler.stocks.not_found"));
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
      await answer(cb.id, res.ok ? tt("handler.stocks.buy_toast_ok") : (res.error || tt("handler.stocks.buy_toast_fail")));
      const notice = res.ok
        ? tt("handler.stocks.buy_ok", {
          shares: res.sharesBought,
          ticker,
          price: res.price,
          cost: res.cost
        })
        : tt("handler.stocks.buy_fail", { error: res.error || tt("handler.stocks.buy_default_error") });
      await showTickerWithNotice(ticker, notice);
      return;
    }

    if (data.startsWith("stocks:sellall:")) {
      const ticker = data.split(":")[2] || "";
      const shares = stocks.getHoldingShares(u, ticker);
      if (!shares) {
        await answer(cb.id, tt("handler.stocks.no_shares"));
        await goTo(u, "Stocks");
        return;
      }
      const res = await stocks.sell(u, ticker, shares);
      await answer(cb.id, res.ok ? tt("handler.stocks.sell_toast_ok") : (res.error || tt("handler.stocks.sell_toast_fail")));
      const notice = res.ok
        ? tt("handler.stocks.sell_ok", {
          shares: res.sharesSold,
          ticker,
          gross: res.gross,
          fee: res.fee,
          net: res.net
        })
        : tt("handler.stocks.sell_fail", { error: res.error || tt("handler.stocks.sell_default_error") });
      await showTickerWithNotice(ticker, notice);
      return;
    }

    if (data.startsWith("stocks:sell:")) {
      const ticker = data.split(":")[2] || "";
      const qty = Number(data.split(":")[3] || 0);
      const res = await stocks.sell(u, ticker, qty);
      await answer(cb.id, res.ok ? tt("handler.stocks.sell_toast_ok") : (res.error || tt("handler.stocks.sell_toast_fail")));
      const notice = res.ok
        ? tt("handler.stocks.sell_ok", {
          shares: res.sharesSold,
          ticker,
          gross: res.gross,
          fee: res.fee,
          net: res.net
        })
        : tt("handler.stocks.sell_fail", { error: res.error || tt("handler.stocks.sell_default_error") });
      await showTickerWithNotice(ticker, notice);
      return;
    }
  }
};
