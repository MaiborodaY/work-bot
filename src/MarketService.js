import { CONFIG } from "./GameConfig.js";
import { InventoryService } from "./InventoryService.js";
import { markUsefulActivity, recordMarketStats } from "./PlayerStats.js";
import { normalizeLang, t } from "./i18n/index.js";

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function isDayStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export class MarketService {
  constructor({ users, now, social = null }) {
    this.users = users || null;
    this.now = now || (() => Date.now());
    this.social = social || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _t(source, key, vars = {}) {
    return t(key, this._lang(source), vars);
  }

  _farmCfg() {
    return CONFIG?.FARM || {};
  }

  _farmCrops() {
    const crops = this._farmCfg()?.CROPS;
    return crops && typeof crops === "object" ? crops : {};
  }

  _cropIds() {
    return Object.keys(this._farmCrops());
  }

  _cropById(cropId) {
    const raw = this._farmCrops()?.[String(cropId || "")];
    if (!raw || typeof raw !== "object") return null;
    return {
      id: String(cropId || ""),
      emoji: String(raw.emoji || "🌾"),
      seedPrice: Math.max(0, toInt(raw.seedPrice, 0)),
      sellPrice: Math.max(0, toInt(raw.sellPrice, 0))
    };
  }

  _cropIdFromItemId(itemId) {
    const id = String(itemId || "");
    if (!id.startsWith("crop_")) return "";
    const cropId = id.slice(5);
    return this._cropById(cropId) ? cropId : "";
  }

  _itemIdByCrop(cropId) {
    return `crop_${String(cropId || "")}`;
  }

  _itemName(source, itemId) {
    const key = `market.item.${String(itemId || "")}`;
    const translated = this._t(source, key);
    return translated === key ? String(itemId || "") : translated;
  }

  _money(n) {
    return Math.max(0, toInt(n, 0)).toLocaleString("en-US");
  }

  _weekKey(ts = this.now()) {
    const d = new Date(Number(ts) || this.now());
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const diffDays = Math.floor((dt.getTime() - yearStart.getTime()) / 86400000);
    const week = 1 + Math.floor(diffDays / 7);
    return `${dt.getUTCFullYear()}${String(week).padStart(2, "0")}`;
  }

  _todayUTC(ts = this.now()) {
    return new Date(Number(ts) || this.now()).toISOString().slice(0, 10);
  }

  _ensureFarmStats(u) {
    if (!u || typeof u !== "object") return false;
    let changed = false;
    if (!u.stats || typeof u.stats !== "object") {
      u.stats = {};
      changed = true;
    }
    if (typeof u.stats.farmHarvestCount !== "number" || !Number.isFinite(u.stats.farmHarvestCount)) {
      u.stats.farmHarvestCount = 0;
      changed = true;
    }
    if (typeof u.stats.farmMoneyTotal !== "number" || !Number.isFinite(u.stats.farmMoneyTotal)) {
      u.stats.farmMoneyTotal = 0;
      changed = true;
    }
    if (typeof u.stats.farmWeekKey !== "string") {
      u.stats.farmWeekKey = "";
      changed = true;
    }
    if (typeof u.stats.farmMoneyWeek !== "number" || !Number.isFinite(u.stats.farmMoneyWeek)) {
      u.stats.farmMoneyWeek = 0;
      changed = true;
    }
    if (!Array.isArray(u.stats.farmIncomeDays)) {
      u.stats.farmIncomeDays = [];
      changed = true;
    }
    return changed;
  }

  _addFarmIncomeDay(u, amount, nowTs = this.now()) {
    this._ensureFarmStats(u);
    const add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return;
    const today = this._todayUTC(nowTs);
    const raw = Array.isArray(u?.stats?.farmIncomeDays) ? u.stats.farmIncomeDays : [];
    const map = new Map();
    for (const row of raw) {
      const day = String(row?.day || "");
      if (!isDayStr(day)) continue;
      const amt = Math.max(0, Math.floor(Number(row?.amount) || 0));
      if (amt <= 0) continue;
      map.set(day, (map.get(day) || 0) + amt);
    }
    map.set(today, (map.get(today) || 0) + add);
    u.stats.farmIncomeDays = [...map.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .slice(-35)
      .map(([day, amt]) => ({ day, amount: amt }));
  }

  _marketGrossToday(u, nowTs = this.now()) {
    const day = this._todayUTC(nowTs);
    const rows = Array.isArray(u?.stats?.marketDays) ? u.stats.marketDays : [];
    for (const row of rows) {
      if (String(row?.day || "") !== day) continue;
      return Math.max(0, Math.floor(Number(row?.gross) || 0));
    }
    return 0;
  }

  _farmIncomeToday(u, nowTs = this.now()) {
    this._ensureFarmStats(u);
    const day = this._todayUTC(nowTs);
    const rows = Array.isArray(u?.stats?.farmIncomeDays) ? u.stats.farmIncomeDays : [];
    for (const row of rows) {
      if (String(row?.day || "") !== day) continue;
      return Math.max(0, Math.floor(Number(row?.amount) || 0));
    }
    return 0;
  }

  _sellableItems(u) {
    const out = [];
    for (const cropId of this._cropIds()) {
      const crop = this._cropById(cropId);
      if (!crop) continue;
      const itemId = this._itemIdByCrop(cropId);
      const qty = Math.max(0, toInt(InventoryService.count(u, itemId), 0));
      if (qty <= 0) continue;
      out.push({
        itemId,
        cropId,
        emoji: crop.emoji,
        qty,
        sellPrice: crop.sellPrice,
        seedPrice: crop.seedPrice,
        total: crop.sellPrice * qty
      });
    }
    return out;
  }

  _buildSummaryLines(source, item) {
    const name = this._itemName(source, item.itemId);
    return this._t(source, "market.line_item", {
      emoji: item.emoji,
      name,
      qty: this._money(item.qty),
      price: this._money(item.sellPrice),
      total: this._money(item.total)
    });
  }

  async buildMainView(u) {
    const lines = [
      this._t(u, "market.title"),
      "",
      this._t(u, "market.subtitle"),
      ""
    ];
    const items = this._sellableItems(u);
    const kb = [];

    if (!items.length) {
      lines.push(this._t(u, "market.empty"));
    } else {
      for (const item of items) {
        lines.push(this._buildSummaryLines(u, item));
        kb.push([{
          text: this._t(u, "market.btn.open_item", {
            emoji: item.emoji,
            name: this._itemName(u, item.itemId),
            qty: this._money(item.qty),
            total: this._money(item.total)
          }),
          callback_data: `market:item:${item.itemId}`
        }]);
      }
    }

    kb.push([{ text: this._t(u, "market.btn.back_earn"), callback_data: "go:Earn" }]);
    return { caption: lines.join("\n"), keyboard: kb };
  }

  async buildItemView(u, itemIdRaw) {
    const itemId = String(itemIdRaw || "").trim();
    const cropId = this._cropIdFromItemId(itemId);
    const crop = this._cropById(cropId);
    const qty = Math.max(0, toInt(InventoryService.count(u, itemId), 0));
    if (!crop || qty <= 0) {
      return {
        caption: this._t(u, "market.item.missing"),
        keyboard: [[{ text: this._t(u, "market.btn.back_market"), callback_data: "market:open" }]]
      };
    }

    const name = this._itemName(u, itemId);
    const total = crop.sellPrice * qty;
    const lines = [
      `${crop.emoji} ${name}`,
      "",
      this._t(u, "market.item.detail", {
        qty: this._money(qty),
        price: this._money(crop.sellPrice),
        total: this._money(total)
      }),
      this._t(u, "market.item.hint")
    ];

    const kb = [
      [{ text: this._t(u, "market.btn.sell_1", { price: this._money(crop.sellPrice) }), callback_data: `market:sell:${itemId}:1` }]
    ];
    if (qty >= 5) {
      kb.push([{ text: this._t(u, "market.btn.sell_5", { price: this._money(crop.sellPrice * 5) }), callback_data: `market:sell:${itemId}:5` }]);
    }
    if (qty >= 10) {
      kb.push([{ text: this._t(u, "market.btn.sell_10", { price: this._money(crop.sellPrice * 10) }), callback_data: `market:sell:${itemId}:10` }]);
    }
    kb.push([
      {
        text: this._t(u, "market.btn.sell_all", { qty: this._money(qty), price: this._money(total) }),
        callback_data: `market:sellall:${itemId}`
      }
    ]);
    kb.push([{ text: this._t(u, "market.btn.back_market"), callback_data: "market:open" }]);
    return { caption: lines.join("\n"), keyboard: kb };
  }

  async _applyFarmProfit(u, netProfit, nowTs = this.now()) {
    this._ensureFarmStats(u);
    const net = Math.max(0, toInt(netProfit, 0));
    const weekKey = this._weekKey(nowTs);
    if (String(u.stats.farmWeekKey || "") !== weekKey) {
      u.stats.farmWeekKey = weekKey;
      u.stats.farmMoneyWeek = 0;
    }
    u.stats.farmMoneyTotal = Math.max(0, toInt(u?.stats?.farmMoneyTotal, 0)) + net;
    u.stats.farmMoneyWeek = Math.max(0, toInt(u?.stats?.farmMoneyWeek, 0)) + net;
    this._addFarmIncomeDay(u, net, nowTs);
  }

  async sell(u, itemIdRaw, qtyRaw) {
    const itemId = String(itemIdRaw || "").trim();
    const qtyReq = Math.max(1, toInt(qtyRaw, 1));
    const cropId = this._cropIdFromItemId(itemId);
    const crop = this._cropById(cropId);
    if (!crop) return { ok: false, error: this._t(u, "market.err.not_found") };

    const have = Math.max(0, toInt(InventoryService.count(u, itemId), 0));
    if (have <= 0) return { ok: false, error: this._t(u, "market.err.not_found") };
    if (have < qtyReq) return { ok: false, error: this._t(u, "market.err.not_enough") };

    const qty = qtyReq;
    const moneyGain = Math.max(0, toInt(crop.sellPrice, 0)) * qty;
    const netProfit = Math.max(0, toInt(crop.sellPrice, 0) - toInt(crop.seedPrice, 0)) * qty;

    InventoryService.remove(u, itemId, qty);
    u.money = Math.max(0, toInt(u?.money, 0)) + moneyGain;
    await this._applyFarmProfit(u, netProfit, this.now());
    recordMarketStats(u, { gross: moneyGain, net: netProfit, units: qty, nowTs: this.now() });
    markUsefulActivity(u, this.now());
    await this.users.save(u);

    if (this.social?.maybeUpdateFarmTop) {
      await this.social.maybeUpdateFarmTop({
        userId: u.id,
        displayName: String(u?.displayName || "").trim(),
        dayTotal: this._farmIncomeToday(u, this.now()),
        weekTotal: Math.max(0, toInt(u?.stats?.farmMoneyWeek, 0)),
        allTotal: Math.max(0, toInt(u?.stats?.farmMoneyTotal, 0))
      }).catch(() => {});
    }
    if (this.social?.maybeUpdateMarketDayTop) {
      await this.social.maybeUpdateMarketDayTop({
        userId: u.id,
        displayName: String(u?.displayName || "").trim(),
        total: this._marketGrossToday(u, this.now())
      }).catch(() => {});
    }
    if (this.social?.maybeUpdateCityDayTop) {
      await this.social.maybeUpdateCityDayTop({
        userId: u.id,
        displayName: String(u?.displayName || "").trim(),
        cat: "market",
        amount: this._marketGrossToday(u, this.now())
      }).catch(() => {});
    }

    return {
      ok: true,
      itemId,
      qty,
      money: moneyGain,
      toast: this._t(u, "market.toast.sold", {
        qty: this._money(qty),
        name: this._itemName(u, itemId),
        money: this._money(moneyGain)
      })
    };
  }

  async sellAll(u, itemIdRaw) {
    const itemId = String(itemIdRaw || "").trim();
    const have = Math.max(0, toInt(InventoryService.count(u, itemId), 0));
    if (have <= 0) return { ok: false, error: this._t(u, "market.err.not_found") };
    return this.sell(u, itemId, have);
  }
}
