import { CONFIG } from "./GameConfig.js";
import { normalizeLang, t } from "./i18n/index.js";

const STOCK_STATE_KEY = "stocks:state:v1";
const STOCK_ACTIVITY_PREFIX = "stocks:activity:";

export class StockService {
  constructor({ db, users, now, achievements = null }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.achievements = achievements || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _t(source, key, vars = {}) {
    return t(key, this._lang(source), vars);
  }

  _cfg() {
    return CONFIG?.STOCKS || {};
  }

  _companies() {
    return this._cfg().COMPANIES || {};
  }

  _tickers() {
    return Object.keys(this._companies());
  }

  _dateStr(ts = this.now()) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _activityKey(day) {
    return `${STOCK_ACTIVITY_PREFIX}${day}`;
  }

  _safeJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  _round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  _newState(day = this._dateStr()) {
    const companies = {};
    for (const [ticker, c] of Object.entries(this._companies())) {
      const base = Math.max(1, Number(c.basePrice) || 1);
      companies[ticker] = {
        ticker,
        price: this._round2(base),
        prevPrice: this._round2(base),
        changePct: 0,
        changeAbs: 0,
        history: [{ day, close: this._round2(base) }]
      };
    }
    return { lastUpdateDay: "", companies };
  }

  _ensureStateShape(state) {
    const day = this._dateStr();
    if (!state || typeof state !== "object") state = this._newState(day);
    if (typeof state.lastUpdateDay !== "string") state.lastUpdateDay = "";
    if (!state.companies || typeof state.companies !== "object") state.companies = {};

    for (const [ticker, c] of Object.entries(this._companies())) {
      const base = Math.max(1, Number(c.basePrice) || 1);
      const cur = state.companies[ticker] || {};
      const price = Math.max(1, Number(cur.price) || base);
      const prevPrice = Math.max(1, Number(cur.prevPrice) || price);
      const changeAbs = Number(cur.changeAbs) || 0;
      const changePct = Number(cur.changePct) || 0;
      const history = Array.isArray(cur.history) ? cur.history : [];
      state.companies[ticker] = {
        ticker,
        price: this._round2(price),
        prevPrice: this._round2(prevPrice),
        changePct,
        changeAbs: this._round2(changeAbs),
        history: history
      };
      if (!state.companies[ticker].history.length) {
        state.companies[ticker].history.push({ day, close: this._round2(price) });
      }
    }
    return state;
  }

  async loadState() {
    const raw = await this.db.get(STOCK_STATE_KEY);
    const parsed = this._safeJson(raw, null);
    const state = this._ensureStateShape(parsed);
    if (!raw) {
      await this.db.put(STOCK_STATE_KEY, JSON.stringify(state));
    }
    return state;
  }

  async saveState(state) {
    await this.db.put(STOCK_STATE_KEY, JSON.stringify(state));
  }

  async recordCasinoSpin(count = 1) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return;
    const day = this._dateStr();
    const key = this._activityKey(day);
    const raw = await this.db.get(key);
    const current = Math.max(0, Number(raw) || 0);
    await this.db.put(key, String(current + n));
  }

  _computeLuckyActivityImpact(spinsYesterday) {
    const cfg = this._cfg().LUCKY_ACTIVITY || {};
    const maxBonus = Math.max(0, Number(cfg.MAX_BONUS) || 0.05);
    const spinsForMax = Math.max(1, Number(cfg.SPINS_FOR_MAX) || 100);
    const curve = String(cfg.CURVE || "sqrt").toLowerCase();
    const ratio = Math.max(0, Number(spinsYesterday) || 0) / spinsForMax;
    if (ratio <= 0) return 0;

    if (curve === "linear") return Math.min(maxBonus, maxBonus * ratio);
    return Math.min(maxBonus, maxBonus * Math.sqrt(ratio));
  }

  _priceBoundsForTicker(ticker) {
    const cfg = this._cfg();
    const c = this._companies()[ticker] || {};
    const base = Math.max(1, Number(c.basePrice) || 1);
    const floor = Math.max(1, Number(cfg.PRICE_FLOOR) || 1);
    const ceilingMult = Math.max(1, Number(cfg.PRICE_CEILING_MULT) || 20);
    const ceil = Math.max(floor, this._round2(base * ceilingMult));
    return { floor, ceil };
  }

  _clampPrice(ticker, p) {
    const { floor, ceil } = this._priceBoundsForTicker(ticker);
    const x = this._round2(p);
    if (!Number.isFinite(x)) return floor;
    if (x < floor) return floor;
    if (x > ceil) return ceil;
    return x;
  }

  async runDailyUpdate() {
    const cfg = this._cfg();
    const nowTs = this.now();
    const nowDate = new Date(nowTs);
    const updateHour = Math.max(0, Math.min(23, Number(cfg.UPDATE_HOUR_UTC) || 0));
    if (nowDate.getUTCHours() !== updateHour) {
      return { ok: true, skipped: true, reason: "not_update_hour" };
    }

    const day = this._dateStr(nowTs);
    const state = await this.loadState();
    if (state.lastUpdateDay === day) {
      return { ok: true, skipped: true, reason: "already_updated" };
    }

    const yesterday = this._dateStr(nowTs - 86400000);
    const rawSpins = await this.db.get(this._activityKey(yesterday));
    const spinsYesterday = Math.max(0, Number(rawSpins) || 0);
    const historyDays = Math.max(1, Number(cfg.HISTORY_DAYS) || 7);

    for (const ticker of this._tickers()) {
      const cCfg = this._companies()[ticker] || {};
      const item = state.companies[ticker];
      if (!item) continue;

      const currentPrice = Math.max(1, Number(item.price) || Number(cCfg.basePrice) || 1);
      const basePrice = Math.max(1, Number(cCfg.basePrice) || currentPrice);
      const volatility = Math.max(0, Number(cCfg.volatility) || 0);
      const reversion = Math.max(0, Number(cCfg.reversion) || 0);
      const random = (Math.random() * 2 - 1) * volatility;
      const meanReversion = reversion * (basePrice - currentPrice) / basePrice;

      let activityImpact = 0;
      if (cCfg.casinoLinked) {
        activityImpact = this._computeLuckyActivityImpact(spinsYesterday);
      }

      const delta = random + activityImpact + meanReversion;
      const nextPrice = this._clampPrice(ticker, currentPrice * (1 + delta));
      const changeAbs = this._round2(nextPrice - currentPrice);
      const changePct = currentPrice > 0 ? (changeAbs / currentPrice) : 0;

      item.prevPrice = this._round2(currentPrice);
      item.price = this._round2(nextPrice);
      item.changeAbs = changeAbs;
      item.changePct = changePct;

      const history = Array.isArray(item.history) ? item.history : [];
      history.push({ day, close: item.price });
      while (history.length > historyDays) history.shift();
      item.history = history;
    }

    state.lastUpdateDay = day;
    await this.saveState(state);
    await this._applyDailyDividends(state, day);

    return { ok: true, skipped: false, spinsYesterday };
  }

  _ensureUserStocks(u) {
    if (!u.stocks || typeof u.stocks !== "object") {
      u.stocks = { holdings: {}, lastDividendDay: "", lastDividendAmount: 0 };
    }
    if (!u.stocks.holdings || typeof u.stocks.holdings !== "object") {
      u.stocks.holdings = {};
    }
    if (typeof u.stocks.lastDividendDay !== "string") u.stocks.lastDividendDay = "";
    if (typeof u.stocks.lastDividendAmount !== "number") u.stocks.lastDividendAmount = 0;
    return u.stocks;
  }

  _getHolding(u, ticker) {
    const stocks = this._ensureUserStocks(u);
    const h = stocks.holdings[ticker];
    if (!h || typeof h !== "object") return { shares: 0, avgPrice: 0 };
    return {
      shares: Math.max(0, Math.floor(Number(h.shares) || 0)),
      avgPrice: Math.max(0, Number(h.avgPrice) || 0)
    };
  }

  getHoldingShares(u, ticker) {
    return this._getHolding(u, ticker).shares;
  }

  _setHolding(u, ticker, shares, avgPrice) {
    const stocks = this._ensureUserStocks(u);
    const safeShares = Math.max(0, Math.floor(Number(shares) || 0));
    if (!safeShares) {
      delete stocks.holdings[ticker];
      return;
    }
    stocks.holdings[ticker] = {
      shares: safeShares,
      avgPrice: this._round2(Math.max(0, Number(avgPrice) || 0))
    };
  }

  _portfolioValue(u, state) {
    let sum = 0;
    for (const ticker of this._tickers()) {
      const h = this._getHolding(u, ticker);
      if (!h.shares) continue;
      const px = Number(state?.companies?.[ticker]?.price) || 0;
      sum += px * h.shares;
    }
    return Math.max(0, sum);
  }

  async _applyDailyDividends(state, day) {
    const rate = Math.max(0, Number(this._cfg().DIVIDEND_RATE_DAILY) || 0);
    if (!rate) return { ok: true, paidUsers: 0, paidTotal: 0 };

    let cursor = undefined;
    let paidUsers = 0;
    let paidTotal = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix: "u:", cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        const raw = await this.db.get(k.name);
        if (!raw) continue;
        let u;
        try {
          u = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!u || typeof u !== "object" || (!("id" in u))) continue;

        const stocks = this._ensureUserStocks(u);
        const pv = this._portfolioValue(u, state);
        if (pv <= 0) continue;
        const div = Math.floor(pv * rate);
        stocks.lastDividendDay = day;
        stocks.lastDividendAmount = div;

        if (div > 0) {
          u.money = Math.max(0, Number(u.money) || 0) + div;
          paidUsers += 1;
          paidTotal += div;
        }
        let achRes = null;
        if (div > 0 && this.achievements?.onEvent) {
          try {
            achRes = await this.achievements.onEvent(u, "stocks_dividend", { amount: div }, {
              persist: false,
              notify: false
            });
          } catch {}
        }
        await this.users.save(u);
        if (achRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
          await this.achievements.notifyEarned(u, achRes.newlyEarned);
        }
      }

      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    return { ok: true, paidUsers, paidTotal };
  }

  _fmtSignedPct(v) {
    const n = Number(v) || 0;
    const pct = this._round2(n * 100);
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct}%`;
  }

  _fmtSignedMoney(v) {
    const n = this._round2(v);
    const sign = n > 0 ? "+" : "";
    return `${sign}$${n}`;
  }

  _arrow(v) {
    if (v > 0) return "↑";
    if (v < 0) return "↓";
    return "→";
  }

  async buildMarketView(u) {
    const state = await this.loadState();
    const lines = [
      this._t(u, "stocks.view.title"),
      this._t(u, "stocks.view.line1"),
      this._t(u, "stocks.view.line2"),
      this._t(u, "stocks.view.line3"),
      ""
    ];
    const portfolioValue = this._portfolioValue(u, state);
    const cash = Math.max(0, Number(u?.money) || 0);

    lines.push(this._t(u, "stocks.view.balance", { cash }));
    lines.push(this._t(u, "stocks.view.portfolio_value", { value: this._round2(portfolioValue) }));

    const stocks = this._ensureUserStocks(u);
    if (stocks.lastDividendDay) {
      lines.push(this._t(u, "stocks.view.last_dividend", {
        day: stocks.lastDividendDay,
        amount: Math.max(0, Number(stocks.lastDividendAmount) || 0)
      }));
    }
    lines.push("");

    for (const ticker of this._tickers()) {
      const cCfg = this._companies()[ticker] || {};
      const item = state.companies[ticker];
      if (!item) continue;
      const h = this._getHolding(u, ticker);
      lines.push(`${cCfg.emoji || "📊"} ${cCfg.title || ticker}`);
      lines.push(
        `$${item.price} ${this._arrow(item.changePct)} ${this._fmtSignedPct(item.changePct)} (${this._fmtSignedMoney(item.changeAbs)})`
      );
      lines.push(this._t(u, "stocks.view.your_shares", { shares: h.shares }));
      lines.push("");
    }

    const kb = this._tickers().map((t) => {
      const cCfg = this._companies()[t] || {};
      return [{ text: `${cCfg.emoji || "📊"} ${cCfg.title || t}`, callback_data: `stocks:view:${t}` }];
    });
    kb.push([{ text: this._t(u, "stocks.btn.info"), callback_data: "stocks:info" }]);
    kb.push([{ text: this._t(u, "stocks.btn.refresh"), callback_data: "stocks:refresh" }]);
    kb.push([{ text: this._t(u, "stocks.btn.back_earn"), callback_data: "go:Earn" }]);

    return { caption: lines.join("\n").trim(), keyboard: kb };
  }

  buildInfoView(source = "ru") {
    const cfg = this._cfg();
    const updateHour = Math.max(0, Math.min(23, Number(cfg.UPDATE_HOUR_UTC) || 0));
    const feePct = this._round2(Math.max(0, Number(cfg.SELL_FEE) || 0) * 100);
    const dividendPct = this._round2(Math.max(0, Number(cfg.DIVIDEND_RATE_DAILY) || 0) * 100);
    const historyDays = Math.max(1, Number(cfg.HISTORY_DAYS) || 7);

    const lines = [
      this._t(source, "stocks.info.title"),
      "",
      this._t(source, "stocks.info.line1"),
      this._t(source, "stocks.info.line2"),
      this._t(source, "stocks.info.line3", { hour: String(updateHour).padStart(2, "0") }),
      this._t(source, "stocks.info.line4", { feePct }),
      this._t(source, "stocks.info.line5", { dividendPct }),
      this._t(source, "stocks.info.line6"),
      this._t(source, "stocks.info.line7", { historyDays }),
      "",
      this._t(source, "stocks.info.risk")
    ];

    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: this._t(source, "stocks.btn.back_market"), callback_data: "go:Stocks" }]]
    };
  }

  async buildTickerView(u, ticker) {
    const cCfg = this._companies()[ticker];
    if (!cCfg) return null;
    const state = await this.loadState();
    const item = state.companies[ticker];
    if (!item) return null;

    const h = this._getHolding(u, ticker);
    const shares = h.shares;
    const avgPrice = h.avgPrice;
    const marketValue = this._round2(shares * item.price);
    const unrealized = this._round2((item.price - avgPrice) * shares);
    const unrealizedPct = avgPrice > 0
      ? ((item.price - avgPrice) / avgPrice)
      : 0;

    const lines = [
      `${cCfg.emoji || "📊"} ${cCfg.title || ticker}`,
      "",
      this._t(u, "stocks.ticker.price_line", {
        price: item.price,
        arrow: this._arrow(item.changePct),
        pct: this._fmtSignedPct(item.changePct),
        abs: this._fmtSignedMoney(item.changeAbs)
      }),
      this._t(u, "stocks.ticker.base_line", { base: Number(cCfg.basePrice) || 0 }),
      "",
      this._t(u, "stocks.ticker.your_shares", { shares }),
      this._t(u, "stocks.ticker.avg_price", { avg: this._round2(avgPrice) }),
      this._t(u, "stocks.ticker.market_value", { value: marketValue }),
      this._t(u, "stocks.ticker.pnl", {
        amount: this._fmtSignedMoney(unrealized),
        pct: this._fmtSignedPct(unrealizedPct)
      })
    ];

    const kb = [];
    kb.push([
      { text: this._t(u, "stocks.btn.buy_n", { n: 1 }), callback_data: `stocks:buy:${ticker}:1` },
      { text: this._t(u, "stocks.btn.buy_n", { n: 5 }), callback_data: `stocks:buy:${ticker}:5` },
      { text: this._t(u, "stocks.btn.buy_n", { n: 10 }), callback_data: `stocks:buy:${ticker}:10` }
    ]);
    kb.push([
      { text: this._t(u, "stocks.btn.sell_n", { n: 1 }), callback_data: `stocks:sell:${ticker}:1` },
      { text: this._t(u, "stocks.btn.sell_n", { n: 5 }), callback_data: `stocks:sell:${ticker}:5` },
      { text: this._t(u, "stocks.btn.sell_n", { n: 10 }), callback_data: `stocks:sell:${ticker}:10` }
    ]);
    kb.push([{ text: this._t(u, "stocks.btn.sell_all"), callback_data: `stocks:sellall:${ticker}` }]);
    kb.push([{ text: this._t(u, "stocks.btn.back_market"), callback_data: "go:Stocks" }]);

    return { caption: lines.join("\n"), keyboard: kb };
  }

  async buy(u, ticker, sharesRaw) {
    const cCfg = this._companies()[ticker];
    if (!cCfg) return { ok: false, error: this._t(u, "stocks.err.not_found") };
    const shares = Math.max(0, Math.floor(Number(sharesRaw) || 0));
    if (!shares) return { ok: false, error: this._t(u, "stocks.err.specify_amount") };

    const state = await this.loadState();
    const item = state.companies[ticker];
    if (!item) return { ok: false, error: this._t(u, "stocks.err.market_unavailable") };
    const price = Math.max(1, Number(item.price) || 1);
    const cost = Math.ceil(price * shares);
    const money = Math.max(0, Number(u.money) || 0);
    if (money < cost) return { ok: false, error: this._t(u, "stocks.err.not_enough_money") };

    const old = this._getHolding(u, ticker);
    const totalShares = old.shares + shares;
    const totalCost = (old.shares * old.avgPrice) + (shares * price);
    const avgPrice = totalShares > 0 ? (totalCost / totalShares) : 0;

    u.money = money - cost;
    this._setHolding(u, ticker, totalShares, avgPrice);
    let achRes = null;
    if (this.achievements?.onEvent) {
      try {
        achRes = await this.achievements.onEvent(u, "stocks_buy", { ticker, shares }, {
          persist: false,
          notify: false
        });
      } catch {}
    }
    await this.users.save(u);
    if (achRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, achRes.newlyEarned);
    }

    return {
      ok: true,
      cost,
      price: this._round2(price),
      sharesBought: shares,
      totalShares
    };
  }

  async sell(u, ticker, sharesRaw) {
    const cCfg = this._companies()[ticker];
    if (!cCfg) return { ok: false, error: this._t(u, "stocks.err.not_found") };
    const shares = Math.max(0, Math.floor(Number(sharesRaw) || 0));
    if (!shares) return { ok: false, error: this._t(u, "stocks.err.specify_amount") };

    const state = await this.loadState();
    const item = state.companies[ticker];
    if (!item) return { ok: false, error: this._t(u, "stocks.err.market_unavailable") };
    const price = Math.max(1, Number(item.price) || 1);
    const old = this._getHolding(u, ticker);
    if (old.shares < shares) return { ok: false, error: this._t(u, "stocks.err.not_enough_shares") };

    const feeRate = Math.max(0, Number(this._cfg().SELL_FEE) || 0);
    const gross = Math.floor(price * shares);
    const fee = Math.floor(gross * feeRate);
    const net = Math.max(0, gross - fee);

    u.money = Math.max(0, Number(u.money) || 0) + net;
    this._setHolding(u, ticker, old.shares - shares, old.avgPrice);
    await this.users.save(u);

    return {
      ok: true,
      price: this._round2(price),
      sharesSold: shares,
      gross,
      fee,
      net,
      leftShares: Math.max(0, old.shares - shares)
    };
  }
}
