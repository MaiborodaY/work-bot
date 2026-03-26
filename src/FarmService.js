import { CONFIG } from "./GameConfig.js";
import { normalizeLang } from "./i18n/index.js";
import { markUsefulActivity } from "./PlayerStats.js";

function n(raw) {
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

function toInt(raw, fallback = 0) {
  return Math.max(0, Math.floor(n(raw) || fallback));
}

function isDayStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export class FarmService {
  constructor({ db, users, now, bot = null, quests = null, achievements = null, social = null }) {
    this.db = db || users?.db || null;
    this.users = users || null;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.quests = quests || null;
    this.achievements = achievements || null;
    this.social = social || null;
  }

  _cfg() {
    return CONFIG?.FARM || {};
  }

  _notifyCfg() {
    return this._cfg().NOTIFY || {};
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _s(source) {
    const lang = this._lang(source);
    if (lang === "en") {
      return {
        title: "🌱 Uncle Vova's Farm",
        plotsLine: "Plots opened: {{opened}}/{{max}}",
        cropCarrot: "Carrot",
        cropTomato: "Tomato",
        cropCorn: "Corn",
        plotReady: "{{emoji}} Plot {{num}} — ready!",
        plotGrowing: "⏳ Plot {{num}} — {{emoji}} {{name}}\nReady in {{left}}",
        plotEmpty: "🟫 Plot {{num}} — empty",
        plotLocked: "🔒 Plot {{num}} — locked",
        btnPlant: "🌱 Plant (plot {{num}})",
        btnBuyPlot: "💳 Buy plot {{num}} — ${{price}}",
        btnHarvest: "🧺 Harvest & sell {{emoji}} {{name}} — ${{price}}",
        btnRefresh: "🔄 Refresh",
        btnHelp: "ℹ️ How farm works",
        btnBackCity: "⬅️ Back",
        plantMenuTitle: "🟫 Plot {{num}} — empty\n\nWhat to plant?",
        plantOption: "{{emoji}} {{name}} - ${{seed}} | {{time}} | {{energy}} energy",
        btnCancel: "⬅️ Cancel",
        plantOk: "🌱 {{emoji}} {{name}} planted on plot {{num}}.\nReady in {{time}}.",
        harvestOk: "{{emoji}} {{name}} harvested and sold!\n+${{money}}",
        buyPlotOk: "💳 Plot {{num}} purchased for ${{price}}.",
        errNoMoney: "Not enough money.",
        errNoEnergy: "Not enough energy. Need {{need}} energy.",
        errPlotBusy: "This plot is already occupied.",
        errPlotOrder: "You can buy only the next plot in order.",
        errPlotMax: "All plots are already purchased.",
        errPlotInvalid: "Plot not found.",
        errCropInvalid: "Crop not found.",
        errNotReady: "The crop is not ready yet.",
        errEmpty: "Nothing to harvest here.",
        toastOk: "Done.",
        notifySingle: "🌱 {{emoji}} {{name}} on plot #{{num}} is ready — harvest now!",
        notifyMany: "🌱 {{count}} farm plots are ready — harvest now!",
        btnOpenFarm: "🌱 Open farm",
        helpTitle: "ℹ️ How farm works",
        helpIntro: "Buy seeds, wait for growth, then harvest and sell.",
        helpPlots: "Plots: {{free}} free at start. Next plots are bought with money (max {{max}}).",
        helpPlotPriceLine: "Plot {{num}} — ${{price}}",
        helpCropsHeader: "🌾 Crops:",
        helpPlotsHeader: "🧱 Plot prices:",
        helpCropLine: "{{emoji}} {{name}}: seed ${{seed}}, grow {{time}}, sell ${{sell}} (profit +${{profit}}), plant cost {{energy}} energy",
        helpPush: "Push: you'll get a notification when crop is ready.",
        helpRule: "Harvest does not disappear: it waits until you collect it.",
        timeMin: "min",
        timeHour: "h",
        timeDay: "d"
      };
    }
    if (lang === "uk") {
      return {
        title: "🌱 Uncle Vova's Farm",
        plotsLine: "Відкрито грядок: {{opened}}/{{max}}",
        cropCarrot: "Морква",
        cropTomato: "Помідор",
        cropCorn: "Кукурудза",
        plotReady: "{{emoji}} Грядка {{num}} — готово!",
        plotGrowing: "⏳ Грядка {{num}} — {{emoji}} {{name}}\nГотово через {{left}}",
        plotEmpty: "🟫 Грядка {{num}} — порожня",
        plotLocked: "🔒 Грядка {{num}} — не куплена",
        btnPlant: "🌱 Посадити (грядка {{num}})",
        btnBuyPlot: "💳 Купити грядку {{num}} — ${{price}}",
        btnHarvest: "🧺 Зібрати й продати {{emoji}} {{name}} — ${{price}}",
        btnRefresh: "🔄 Оновити",
        btnHelp: "ℹ️ Як працює ферма",
        btnBackCity: "⬅️ Назад",
        plantMenuTitle: "🟫 Грядка {{num}} — порожня\n\nЩо посадити?",
        plantOption: "{{emoji}} {{name}} - ${{seed}} | {{time}} | {{energy}}\u26A1",
        btnCancel: "⬅️ Скасувати",
        plantOk: "🌱 {{emoji}} {{name}} посаджено на грядці {{num}}.\nБуде готово через {{time}}.",
        harvestOk: "{{emoji}} {{name}} зібрано і продано!\n+${{money}}",
        buyPlotOk: "💳 Грядку {{num}} куплено за ${{price}}.",
        errNoMoney: "Недостатньо коштів.",
        errNoEnergy: "Not enough energy. Need {{need}} energy.",
        errPlotBusy: "Ця грядка вже зайнята.",
        errPlotOrder: "Можна купити тільки наступну грядку по порядку.",
        errPlotMax: "Усі грядки вже куплені.",
        errPlotInvalid: "Грядку не знайдено.",
        errCropInvalid: "Культуру не знайдено.",
        errNotReady: "Урожай ще не готовий.",
        errEmpty: "Тут нічого збирати.",
        toastOk: "Готово.",
        notifySingle: "🌱 {{emoji}} {{name}} на грядці №{{num}} дозріла — можна збирати!",
        notifyMany: "🌱 Готово {{count}} грядок — можна збирати врожай!",
        btnOpenFarm: "🌱 До ферми",
        helpTitle: "ℹ️ Як працює ферма",
        helpIntro: "Купуй насіння, дочекайся росту та збирай урожай для продажу.",
        helpPlots: "Грядки: {{free}} безкоштовна на старті. Наступні купуються за гроші (макс {{max}}).",
        helpPlotPriceLine: "Грядка {{num}} — ${{price}}",
        helpCropsHeader: "🌾 Культури:",
        helpPlotsHeader: "🧱 Ціни грядок:",
        helpCropLine: "{{emoji}} {{name}}: seed ${{seed}}, grow {{time}}, sell ${{sell}} (profit +${{profit}}), plant cost {{energy}} energy",
        helpPush: "Пуш: коли врожай дозріє, прийде повідомлення.",
        helpRule: "Врожай не зникає — чекатиме, доки ти його не збереш.",
        timeMin: "хв",
        timeHour: "год",
        timeDay: "д"
      };
    }
    return {
      title: "🌱 Ферма дяди Вовы",
      plotsLine: "Открыто грядок: {{opened}}/{{max}}",
      cropCarrot: "Морковь",
      cropTomato: "Помидор",
      cropCorn: "Кукуруза",
      plotReady: "{{emoji}} Грядка {{num}} — готово!",
      plotGrowing: "⏳ Грядка {{num}} — {{emoji}} {{name}}\nГотово через {{left}}",
      plotEmpty: "🟫 Грядка {{num}} — пустая",
      plotLocked: "🔒 Грядка {{num}} — не куплена",
      btnPlant: "🌱 Посадить (грядка {{num}})",
      btnBuyPlot: "💳 Купить грядку {{num}} — ${{price}}",
      btnHarvest: "🧺 Собрать и продать {{emoji}} {{name}} — ${{price}}",
      btnRefresh: "🔄 Обновить",
      btnHelp: "ℹ️ Как работает ферма",
      btnBackCity: "⬅️ Назад",
      plantMenuTitle: "🟫 Грядка {{num}} — пустая\n\nЧто посадить?",
      plantOption: "{{emoji}} {{name}} - ${{seed}} | {{time}} | {{energy}}\u26A1",
      btnCancel: "⬅️ Отмена",
      plantOk: "🌱 {{emoji}} {{name}} посажена на грядке {{num}}.\nГотово через {{time}}.",
      harvestOk: "{{emoji}} {{name}} собрана и продана!\n+${{money}}",
      buyPlotOk: "💳 Грядка {{num}} куплена за ${{price}}.",
      errNoMoney: "Недостаточно средств.",
      errNoEnergy: "Not enough energy. Need {{need}} energy.",
      errPlotBusy: "Эта грядка уже занята.",
      errPlotOrder: "Можно купить только следующую грядку по порядку.",
      errPlotMax: "Все грядки уже куплены.",
      errPlotInvalid: "Грядка не найдена.",
      errCropInvalid: "Культура не найдена.",
      errNotReady: "Урожай еще не готов.",
      errEmpty: "Здесь нечего собирать.",
      toastOk: "Готово.",
      notifySingle: "🌱 {{emoji}} {{name}} на грядке №{{num}} выросла — можно собирать!",
      notifyMany: "🌱 Готово {{count}} грядок — можно собирать урожай!",
      btnOpenFarm: "🌱 Открыть ферму",
      helpTitle: "ℹ️ Как работает ферма",
      helpIntro: "Покупай семена, дождись роста и собирай урожай на продажу.",
      helpPlots: "Грядки: {{free}} бесплатная на старте. Следующие покупаются за деньги (макс {{max}}).",
      helpPlotPriceLine: "Грядка {{num}} — ${{price}}",
      helpCropsHeader: "🌾 Культуры:",
      helpPlotsHeader: "🧱 Цены грядок:",
      helpCropLine: "{{emoji}} {{name}}: seed ${{seed}}, grow {{time}}, sell ${{sell}} (profit +${{profit}}), plant cost {{energy}} energy",
      helpPush: "Пуш: когда урожай созреет, придёт уведомление.",
      helpRule: "Урожай не пропадает — ждёт, пока ты его соберёшь.",
      timeMin: "мин",
      timeHour: "ч",
      timeDay: "д"
    };
  }

  _fmt(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));
  }

  _freePlots() {
    return Math.max(1, toInt(this._cfg().FREE_PLOTS, 1));
  }

  _maxPlots() {
    const free = this._freePlots();
    return Math.max(free, toInt(this._cfg().MAX_PLOTS, 6));
  }

  _plantEnergyCost(cropId = "") {
    const crop = this._cfg()?.CROPS?.[String(cropId || "")];
    const cropCost = Math.max(0, toInt(crop?.plantEnergy, 0));
    if (cropCost > 0) return cropCost;
    return Math.max(0, toInt(this._cfg().PLANT_ENERGY_COST, 20));
  }

  _plotPriceByIndex(plotIndex) {
    const idx = Math.max(1, Math.floor(Number(plotIndex) || 1));
    if (idx <= this._freePlots()) return 0;
    const prices = Array.isArray(this._cfg().PLOT_PRICES) ? this._cfg().PLOT_PRICES : [];
    const arrIndex = idx - this._freePlots() - 1;
    const direct = toInt(prices[arrIndex], 0);
    if (direct > 0) return direct;
    const fallback = [5000, 15000, 35000, 75000, 150000];
    return toInt(fallback[Math.max(0, Math.min(fallback.length - 1, arrIndex))], 5000);
  }

  _plotLimit(u) {
    const maxPlots = this._maxPlots();
    const raw = toInt(u?.farm?.plotCount, this._freePlots());
    return Math.max(this._freePlots(), Math.min(maxPlots, raw));
  }

  _defaultPlot(id) {
    return {
      id,
      status: "empty",
      cropId: "",
      seedSpent: 0,
      plantedAt: 0,
      readyAt: 0,
      notifiedReady: false
    };
  }

  _cropRaw(cropId) {
    const id = String(cropId || "");
    const item = this._cfg()?.CROPS?.[id];
    if (!item || typeof item !== "object") return null;
    return {
      id,
      emoji: String(item.emoji || "🌱"),
      seedPrice: Math.max(1, toInt(item.seedPrice, 1)),
      growMs: Math.max(60_000, toInt(item.growMs, 60_000)),
      sellPrice: Math.max(1, toInt(item.sellPrice, 1)),
      plantEnergy: this._plantEnergyCost(id)
    };
  }

  _cropIds() {
    const crops = this._cfg()?.CROPS;
    if (!crops || typeof crops !== "object") return [];
    return Object.keys(crops).filter((id) => !!this._cropRaw(id));
  }

  _cropInfo(source, cropId) {
    const s = this._s(source);
    const crop = this._cropRaw(cropId);
    if (!crop) return null;
    const names = {
      carrot: s.cropCarrot,
      tomato: s.cropTomato,
      corn: s.cropCorn
    };
    return {
      ...crop,
      name: names[crop.id] || crop.id
    };
  }

  _isReady(plot, nowTs = this.now()) {
    return !!plot && String(plot.status || "") === "growing" && toInt(plot.readyAt, 0) <= nowTs;
  }

  _normalizeModel(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;
    if (!u.farm || typeof u.farm !== "object") {
      u.farm = { plotMode: "purchase_v1", plots: [], plotCount: this._freePlots() };
      dirty = true;
    }
    if (typeof u.farm.plotMode !== "string" || !u.farm.plotMode) {
      u.farm.plotMode = "purchase_v1";
      dirty = true;
    }
    const hadPlotCount = Number.isFinite(Number(u?.farm?.plotCount));
    if (!Array.isArray(u.farm.plots)) {
      u.farm.plots = [];
      dirty = true;
    }
    if (!hadPlotCount) {
      u.farm.plotCount = this._freePlots();
      dirty = true;
    }

    const maxPlots = this._maxPlots();
    const normalizedOpen = Math.max(this._freePlots(), Math.min(maxPlots, toInt(u.farm.plotCount, this._freePlots())));
    if (normalizedOpen !== u.farm.plotCount) {
      u.farm.plotCount = normalizedOpen;
      dirty = true;
    }
    for (let i = 0; i < maxPlots; i += 1) {
      if (!u.farm.plots[i] || typeof u.farm.plots[i] !== "object") {
        u.farm.plots[i] = this._defaultPlot(i + 1);
        dirty = true;
      }
      const p = u.farm.plots[i];
      if (toInt(p.id, 0) !== i + 1) {
        p.id = i + 1;
        dirty = true;
      }
      const status = String(p.status || "");
      if (status !== "empty" && status !== "growing") {
        p.status = "empty";
        dirty = true;
      }
      if (typeof p.cropId !== "string") { p.cropId = ""; dirty = true; }
      if (!Number.isFinite(Number(p.seedSpent))) { p.seedSpent = 0; dirty = true; }
      if (!Number.isFinite(Number(p.plantedAt))) { p.plantedAt = 0; dirty = true; }
      if (!Number.isFinite(Number(p.readyAt))) { p.readyAt = 0; dirty = true; }
      if (typeof p.notifiedReady !== "boolean") { p.notifiedReady = false; dirty = true; }

      if (p.status === "growing") {
        const crop = this._cropRaw(p.cropId);
        if (!crop) {
          Object.assign(p, this._defaultPlot(i + 1));
          dirty = true;
        } else {
          if (toInt(p.seedSpent, 0) <= 0) {
            p.seedSpent = Math.max(0, toInt(crop.seedPrice, 0));
            dirty = true;
          }
          if (toInt(p.readyAt, 0) <= 0) {
            const plantedAt = toInt(p.plantedAt, this.now());
            p.plantedAt = plantedAt;
            p.readyAt = plantedAt + crop.growMs;
            dirty = true;
          }
        }
      } else {
        if (p.cropId || toInt(p.seedSpent, 0) || toInt(p.plantedAt, 0) || toInt(p.readyAt, 0) || p.notifiedReady) {
          Object.assign(p, this._defaultPlot(i + 1));
          dirty = true;
        }
      }
    }
    if (u.farm.plots.length > maxPlots) {
      u.farm.plots = u.farm.plots.slice(0, maxPlots);
      dirty = true;
    }
    if (u.farm.plots.length < 1) {
      u.farm.plots = [this._defaultPlot(1)];
      dirty = true;
    }
    return dirty;
  }

  _durationLabel(source, ms) {
    const s = this._s(source);
    const totalMin = Math.max(1, Math.ceil((toInt(ms, 0)) / 60000));
    const days = Math.floor(totalMin / (24 * 60));
    const hours = Math.floor((totalMin % (24 * 60)) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days}${s.timeDay} ${hours}${s.timeHour}`;
    if (hours > 0) return `${hours}${s.timeHour} ${mins}${s.timeMin}`;
    return `${mins}${s.timeMin}`;
  }

  _weekKey(ts = this.now()) {
    const d = new Date(Number(ts) || this.now());
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6, 0=Monday
    const thursday = new Date(tmp);
    thursday.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
    const diffDays = Math.floor((thursday.getTime() - firstThursday.getTime()) / 86400000);
    const week = 1 + Math.floor(diffDays / 7);
    return `${thursday.getUTCFullYear()}${String(week).padStart(2, "0")}`;
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

  _todayUTC(ts = this.now()) {
    return new Date(Number(ts) || this.now()).toISOString().slice(0, 10);
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

  _leftLabel(source, msLeft) {
    return this._durationLabel(source, Math.max(0, toInt(msLeft, 0)));
  }

  _netProfit(sellPrice, seedSpent) {
    const sell = Math.max(0, Math.floor(Number(sellPrice) || 0));
    const seed = Math.max(0, Math.floor(Number(seedSpent) || 0));
    return Math.max(0, sell - seed);
  }

  _harvestAllButtonText(source, count, money) {
    const lang = this._lang(source);
    if (lang === "en") return `🧺 Harvest all ready (${toInt(count, 0)}) — $${toInt(money, 0)}`;
    if (lang === "uk") return `🧺 Зібрати все готове (${toInt(count, 0)}) — $${toInt(money, 0)}`;
    return `🧺 Собрать всё готовое (${toInt(count, 0)}) — $${toInt(money, 0)}`;
  }

  _harvestAllResultCaption(source, count, money) {
    const lang = this._lang(source);
    if (lang === "en") return `🧺 Harvested and sold ${toInt(count, 0)} plot(s).\n+$${toInt(money, 0)}`;
    if (lang === "uk") return `🧺 Зібрано і продано ${toInt(count, 0)} грядок.\n+$${toInt(money, 0)}`;
    return `🧺 Собрано и продано ${toInt(count, 0)} грядок.\n+$${toInt(money, 0)}`;
  }

  _plotByIndex(u, plotIndex) {
    const idxRaw = Number(plotIndex);
    if (!Number.isFinite(idxRaw)) return { ok: false, index: -1, plot: null };
    const idx = Math.max(1, Math.floor(idxRaw));
    const arr = Array.isArray(u?.farm?.plots) ? u.farm.plots : [];
    const p = arr[idx - 1] || null;
    return { ok: !!p, index: idx, plot: p };
  }

  async buildMainView(u) {
    this._normalizeModel(u);
    const s = this._s(u);
    const nowTs = this.now();
    const plotsCount = this._plotLimit(u);
    const maxPlots = this._maxPlots();
    const plots = Array.isArray(u?.farm?.plots) ? u.farm.plots : [];

    const lines = [s.title, "", this._fmt(s.plotsLine, { opened: plotsCount, max: maxPlots }), ""];
    const kb = [];
    let readyCount = 0;
    let readyTotalMoney = 0;

    for (let i = 1; i <= maxPlots; i += 1) {
      if (i > plotsCount) {
        lines.push(this._fmt(s.plotLocked, { num: i }), "");
        if (i === plotsCount + 1) {
          kb.push([{
            text: this._fmt(s.btnBuyPlot, { num: i, price: this._plotPriceByIndex(i) }),
            callback_data: `farm:buy_plot:${i}`
          }]);
        }
        continue;
      }
      const p = plots[i - 1] || this._defaultPlot(i);
      if (String(p.status || "") === "growing") {
        const crop = this._cropInfo(u, p.cropId);
        if (!crop) {
          lines.push(this._fmt(s.plotEmpty, { num: i }), "");
          kb.push([{ text: this._fmt(s.btnPlant, { num: i }), callback_data: `farm:plant_menu:${i}` }]);
          continue;
        }
        if (this._isReady(p, nowTs)) {
          readyCount += 1;
          readyTotalMoney += crop.sellPrice;
          lines.push(this._fmt(s.plotReady, { emoji: crop.emoji, num: i }), "");
          kb.push([{
            text: this._fmt(s.btnHarvest, { emoji: crop.emoji, name: crop.name.toLowerCase(), price: crop.sellPrice }),
            callback_data: `farm:harvest:${i}`
          }]);
        } else {
          const left = this._leftLabel(u, toInt(p.readyAt, 0) - nowTs);
          lines.push(this._fmt(s.plotGrowing, { num: i, emoji: crop.emoji, name: crop.name, left }), "");
        }
      } else {
        lines.push(this._fmt(s.plotEmpty, { num: i }), "");
        kb.push([{ text: this._fmt(s.btnPlant, { num: i }), callback_data: `farm:plant_menu:${i}` }]);
      }
    }

    if (readyCount >= 2) {
      kb.push([{
        text: this._harvestAllButtonText(u, readyCount, readyTotalMoney),
        callback_data: "farm:harvest_all"
      }]);
    }

    kb.push([{ text: s.btnRefresh, callback_data: "farm:refresh" }]);
    kb.push([{ text: s.btnHelp, callback_data: "farm:help" }]);
    kb.push([{ text: s.btnBackCity, callback_data: "go:Earn" }]);

    return {
      caption: lines.join("\n").trim(),
      keyboard: kb
    };
  }

  async buildPlantMenuView(u, plotIndex) {
    this._normalizeModel(u);
    const s = this._s(u);
    const limit = this._plotLimit(u);
    const target = this._plotByIndex(u, plotIndex);
    if (!target.ok || target.index < 1 || target.index > limit) {
      return {
        caption: `${s.title}\n\n${s.errPlotInvalid}`,
        keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
      };
    }

    const p = target.plot;
    if (String(p.status || "") === "growing") {
      return this.buildMainView(u);
    }

    const caption = this._fmt(s.plantMenuTitle, { num: target.index });
    const kb = [];
    for (const cropId of this._cropIds()) {
      const crop = this._cropInfo(u, cropId);
      if (!crop) continue;
      kb.push([{
        text: this._fmt(s.plantOption, {
          emoji: crop.emoji,
          name: crop.name,
          seed: crop.seedPrice,
          time: this._durationLabel(u, crop.growMs),
          energy: crop.plantEnergy
        }),
        callback_data: `farm:plant:${target.index}:${crop.id}`
      }]);
    }
    kb.push([{ text: s.btnCancel, callback_data: "go:Farm" }]);
    return { caption, keyboard: kb };
  }

  async buildHelpView(u) {
    this._normalizeModel(u);
    const s = this._s(u);
    const maxPlots = this._maxPlots();
    const freePlots = this._freePlots();
    const lines = [
      s.helpTitle,
      "",
      s.helpIntro,
      this._fmt(s.helpPlots, { free: freePlots, max: maxPlots }),
      "",
      s.helpPlotsHeader,
    ];
    for (let i = freePlots + 1; i <= maxPlots; i += 1) {
      lines.push(this._fmt(s.helpPlotPriceLine, { num: i, price: this._plotPriceByIndex(i) }));
    }
    lines.push(
      "",
      s.helpCropsHeader
    );
    for (const cropId of this._cropIds()) {
      const crop = this._cropInfo(u, cropId);
      if (!crop) continue;
      const time = this._durationLabel(u, crop.growMs);
      const profit = Math.max(0, crop.sellPrice - crop.seedPrice);
      lines.push(this._fmt(s.helpCropLine, {
        emoji: crop.emoji,
        name: crop.name,
        seed: crop.seedPrice,
        time,
        sell: crop.sellPrice,
        profit,
        energy: crop.plantEnergy
      }));
    }
    lines.push("", s.helpPush, s.helpRule);

    return {
      caption: lines.join("\n").trim(),
      keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
    };
  }

  async buyPlot(u, plotIndex) {
    this._normalizeModel(u);
    const s = this._s(u);
    const maxPlots = this._maxPlots();
    const open = this._plotLimit(u);
    const idx = Math.max(1, Math.floor(Number(plotIndex) || 0));
    if (idx < 1 || idx > maxPlots) return { ok: false, error: s.errPlotInvalid };
    if (open >= maxPlots) return { ok: false, error: s.errPlotMax };
    if (idx !== open + 1) return { ok: false, error: s.errPlotOrder };
    const price = this._plotPriceByIndex(idx);
    const money = toInt(u?.money, 0);
    if (money < price) return { ok: false, error: s.errNoMoney };

    u.money = money - price;
    u.farm.plotMode = "purchase_v1";
    u.farm.plotCount = idx;
    markUsefulActivity(u, this.now());
    await this.users.save(u);
    return { ok: true, plotIndex: idx, price };
  }

  buildPlantResultView(u, data = {}) {
    const s = this._s(u);
    const crop = this._cropInfo(u, data.cropId);
    const caption = crop
      ? this._fmt(s.plantOk, {
        emoji: crop.emoji,
        name: crop.name,
        num: toInt(data.plotIndex, 1),
        time: this._durationLabel(u, toInt(data.growMs, crop.growMs))
      })
      : s.toastOk;
    return {
      caption,
      keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
    };
  }

  buildHarvestResultView(u, data = {}) {
    const s = this._s(u);
    const crop = this._cropInfo(u, data.cropId);
    const caption = crop
      ? this._fmt(s.harvestOk, {
        emoji: crop.emoji,
        name: crop.name,
        money: toInt(data.sellPrice, crop.sellPrice)
      })
      : s.toastOk;
    return {
      caption,
      keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
    };
  }

  buildHarvestAllResultView(u, data = {}) {
    const s = this._s(u);
    return {
      caption: this._harvestAllResultCaption(u, data.count, data.totalMoney),
      keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
    };
  }

  buildBuyPlotResultView(u, data = {}) {
    const s = this._s(u);
    return {
      caption: this._fmt(s.buyPlotOk, {
        num: toInt(data.plotIndex, 1),
        price: toInt(data.price, 0)
      }),
      keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
    };
  }

  async plant(u, plotIndex, cropId) {
    this._normalizeModel(u);
    const s = this._s(u);
    const crop = this._cropInfo(u, cropId);
    if (!crop) return { ok: false, error: s.errCropInvalid };

    const limit = this._plotLimit(u);
    const target = this._plotByIndex(u, plotIndex);
    if (!target.ok || target.index < 1 || target.index > limit) {
      return { ok: false, error: s.errPlotInvalid };
    }
    const p = target.plot;
    if (String(p.status || "") === "growing") {
      return { ok: false, error: s.errPlotBusy };
    }
    const money = toInt(u?.money, 0);
    if (money < crop.seedPrice) {
      return { ok: false, error: s.errNoMoney };
    }
    const plantEnergyCost = Math.max(0, toInt(crop?.plantEnergy, this._plantEnergyCost(crop?.id)));
    const energy = toInt(u?.energy, 0);
    if (energy < plantEnergyCost) {
      return {
        ok: false,
        code: "not_enough_energy",
        needEnergy: plantEnergyCost,
        error: this._fmt(s.errNoEnergy || s.errNoMoney, { need: plantEnergyCost })
      };
    }

    u.money = money - crop.seedPrice;
    u.energy = Math.max(0, energy - plantEnergyCost);
    const nowTs = this.now();
    p.status = "growing";
    p.cropId = crop.id;
    p.seedSpent = crop.seedPrice;
    p.plantedAt = nowTs;
    p.readyAt = nowTs + crop.growMs;
    p.notifiedReady = false;

    markUsefulActivity(u, nowTs);
    await this._markDue(u?.id, p.readyAt);
    let qRes = null;
    if (this.quests?.onEvent) {
      qRes = await this.quests.onEvent(u, "farm_plant", { cropId: crop.id, cost: crop.seedPrice }, {
        persist: false,
        notify: false
      }).catch(() => null);
    }
    await this.users.save(u);
    if (qRes?.events?.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(u, qRes.events).catch(() => {});
    }
    return { ok: true, plotIndex: target.index, cropId: crop.id, growMs: crop.growMs };
  }

  async harvest(u, plotIndex) {
    this._normalizeModel(u);
    this._ensureFarmStats(u);
    const s = this._s(u);
    const limit = this._plotLimit(u);
    const target = this._plotByIndex(u, plotIndex);
    if (!target.ok || target.index < 1 || target.index > limit) {
      return { ok: false, error: s.errPlotInvalid };
    }
    const p = target.plot;
    if (String(p.status || "") !== "growing") {
      return { ok: false, error: s.errEmpty };
    }
    if (!this._isReady(p, this.now())) {
      return { ok: false, error: s.errNotReady };
    }

    const crop = this._cropInfo(u, p.cropId);
    if (!crop) {
      Object.assign(p, this._defaultPlot(target.index));
      await this.users.save(u);
      return { ok: false, error: s.errCropInvalid };
    }

    const sellPrice = crop.sellPrice;
    const netProfit = this._netProfit(sellPrice, toInt(p.seedSpent, crop.seedPrice));
    u.money = toInt(u?.money, 0) + sellPrice;
    const nowTs = this.now();
    const wk = this._weekKey(nowTs);
    if (String(u.stats.farmWeekKey || "") !== wk) {
      u.stats.farmWeekKey = wk;
      u.stats.farmMoneyWeek = 0;
    }
    u.stats.farmHarvestCount = toInt(u?.stats?.farmHarvestCount, 0) + 1;
    u.stats.farmMoneyTotal = toInt(u?.stats?.farmMoneyTotal, 0) + netProfit;
    u.stats.farmMoneyWeek = toInt(u?.stats?.farmMoneyWeek, 0) + netProfit;
    this._addFarmIncomeDay(u, netProfit, nowTs);

    Object.assign(p, this._defaultPlot(target.index));
    markUsefulActivity(u, nowTs);

    let qRes = null;
    if (this.quests?.onEvent) {
      qRes = await this.quests.onEvent(u, "farm_harvest", { cropId: crop.id, money: netProfit }, {
        persist: false,
        notify: false
      }).catch(() => null);
    }
    let aRes = null;
    if (this.achievements?.onEvent) {
      aRes = await this.achievements.onEvent(u, "farm_harvest", { cropId: crop.id, money: netProfit }, {
        persist: false,
        notify: false
      }).catch(() => null);
    }

    await this.users.save(u);
    if (this.social?.maybeUpdateFarmTop) {
      await this.social.maybeUpdateFarmTop({
        userId: u.id,
        displayName: String(u?.displayName || "").trim(),
        dayTotal: this._farmIncomeToday(u, nowTs),
        weekTotal: toInt(u?.stats?.farmMoneyWeek, 0),
        allTotal: toInt(u?.stats?.farmMoneyTotal, 0)
      }).catch(() => {});
    }
    if (qRes?.events?.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(u, qRes.events).catch(() => {});
    }
    if (aRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, aRes.newlyEarned).catch(() => {});
    }

    return { ok: true, plotIndex: target.index, cropId: crop.id, sellPrice };
  }

  async harvestAll(u) {
    this._normalizeModel(u);
    this._ensureFarmStats(u);
    const s = this._s(u);
    const nowTs = this.now();
    const limit = this._plotLimit(u);
    const plots = Array.isArray(u?.farm?.plots) ? u.farm.plots : [];
    const harvestable = [];

    for (let i = 1; i <= limit; i += 1) {
      const p = plots[i - 1];
      if (!p || String(p.status || "") !== "growing") continue;
      if (!this._isReady(p, nowTs)) continue;
      const crop = this._cropInfo(u, p.cropId);
      if (!crop) continue;
      harvestable.push({ index: i, crop, plot: p });
    }

    if (!harvestable.length) {
      return { ok: false, error: s.errEmpty };
    }

    const wk = this._weekKey(nowTs);
    if (String(u.stats.farmWeekKey || "") !== wk) {
      u.stats.farmWeekKey = wk;
      u.stats.farmMoneyWeek = 0;
    }

    let totalMoney = 0;
    let totalProfit = 0;
    let totalCount = 0;
    const questEvents = [];
    const newlyEarned = [];

    for (const item of harvestable) {
      const sellPrice = item.crop.sellPrice;
      const netProfit = this._netProfit(sellPrice, toInt(item?.plot?.seedSpent, item.crop.seedPrice));
      totalMoney += sellPrice;
      totalProfit += netProfit;
      totalCount += 1;
      u.stats.farmHarvestCount = toInt(u?.stats?.farmHarvestCount, 0) + 1;
      u.stats.farmMoneyTotal = toInt(u?.stats?.farmMoneyTotal, 0) + netProfit;
      u.stats.farmMoneyWeek = toInt(u?.stats?.farmMoneyWeek, 0) + netProfit;
      Object.assign(item.plot, this._defaultPlot(item.index));

      if (this.quests?.onEvent) {
        const qRes = await this.quests.onEvent(u, "farm_harvest", { cropId: item.crop.id, money: netProfit }, {
          persist: false,
          notify: false
        }).catch(() => null);
        if (Array.isArray(qRes?.events) && qRes.events.length) {
          questEvents.push(...qRes.events);
        }
      }

      if (this.achievements?.onEvent) {
        const aRes = await this.achievements.onEvent(u, "farm_harvest", { cropId: item.crop.id, money: netProfit }, {
          persist: false,
          notify: false
        }).catch(() => null);
        if (Array.isArray(aRes?.newlyEarned) && aRes.newlyEarned.length) {
          newlyEarned.push(...aRes.newlyEarned);
        }
      }
    }

    u.money = toInt(u?.money, 0) + totalMoney;
    this._addFarmIncomeDay(u, totalProfit, nowTs);
    markUsefulActivity(u, nowTs);

    await this.users.save(u);
    if (this.social?.maybeUpdateFarmTop) {
      await this.social.maybeUpdateFarmTop({
        userId: u.id,
        displayName: String(u?.displayName || "").trim(),
        dayTotal: this._farmIncomeToday(u, nowTs),
        weekTotal: toInt(u?.stats?.farmMoneyWeek, 0),
        allTotal: toInt(u?.stats?.farmMoneyTotal, 0)
      }).catch(() => {});
    }
    if (questEvents.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(u, questEvents).catch(() => {});
    }
    if (newlyEarned.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, newlyEarned).catch(() => {});
    }

    return { ok: true, count: totalCount, totalMoney };
  }

  _dueBucket(ts) {
    const bucketMs = Math.max(60_000, toInt(this._notifyCfg().DUE_BUCKET_MS, 5 * 60_000));
    return Math.floor((Number(ts) || 0) / bucketMs);
  }

  _dueKey(bucket, userId) {
    return `farm:due:${bucket}:${String(userId || "")}`;
  }

  _parseDueUserId(key) {
    const parts = String(key || "").split(":");
    if (parts.length < 4) return "";
    return String(parts[3] || "").trim();
  }

  async _markDue(userId, dueTs) {
    if (!this.db || typeof this.db.put !== "function") return;
    const id = String(userId || "").trim();
    const ts = Number(dueTs) || 0;
    if (!id || ts <= 0) return;
    const bucket = this._dueBucket(ts);
    const ttlSec = Math.max(60, Math.ceil((ts - this.now()) / 1000) + 3 * 24 * 60 * 60);
    await this.db.put(this._dueKey(bucket, id), "1", { expirationTtl: ttlSec });
  }

  async _collectDueUserIds(nowTs = this.now()) {
    if (!this.db || typeof this.db.list !== "function") return [];
    const bucketMs = Math.max(60_000, toInt(this._notifyCfg().DUE_BUCKET_MS, 5 * 60_000));
    const lookbackMinutes = Math.max(0, toInt(this._notifyCfg().DUE_LOOKBACK_MINUTES, 30));
    const lookbackBuckets = Math.max(0, Math.ceil((lookbackMinutes * 60_000) / bucketMs));
    const endBucket = this._dueBucket(nowTs);
    const startBucket = endBucket - lookbackBuckets;
    const ids = new Set();

    for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
      const prefix = `farm:due:${bucket}:`;
      let cursor = undefined;
      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;
        for (const k of page?.keys || []) {
          const id = this._parseDueUserId(k?.name);
          if (id) ids.add(id);
        }
      } while (cursor);
    }
    return [...ids];
  }

  _readyUnnotifiedPlots(u, nowTs) {
    const out = [];
    const plots = Array.isArray(u?.farm?.plots) ? u.farm.plots : [];
    const limit = this._plotLimit(u);
    for (let i = 0; i < limit; i += 1) {
      const p = plots[i];
      if (!p || String(p.status || "") !== "growing") continue;
      if (toInt(p.readyAt, 0) > nowTs) continue;
      if (p.notifiedReady) continue;
      out.push(i + 1);
    }
    return out;
  }

  async _notifyReady(u, plotNumbers) {
    if (!this.bot || !u?.chatId || !Array.isArray(plotNumbers) || !plotNumbers.length) {
      return { sent: false };
    }
    const s = this._s(u);
    let text = "";
    if (plotNumbers.length === 1) {
      const idx = plotNumbers[0];
      const p = u?.farm?.plots?.[idx - 1];
      const crop = this._cropInfo(u, p?.cropId);
      if (!crop) return { sent: false };
      text = this._fmt(s.notifySingle, { emoji: crop.emoji, name: crop.name, num: idx });
    } else {
      text = this._fmt(s.notifyMany, { count: plotNumbers.length });
    }

    try {
      await this.bot.sendWithInline(u.chatId, text, [[{ text: s.btnOpenFarm, callback_data: "go:Farm" }]]);
      for (const idx of plotNumbers) {
        const p = u?.farm?.plots?.[idx - 1];
        if (!p) continue;
        if (String(p.status || "") === "growing" && toInt(p.readyAt, 0) <= this.now()) {
          p.notifiedReady = true;
        }
      }
      return { sent: true };
    } catch {
      return { sent: false };
    }
  }

  async dailyTick() {
    const ids = await this._collectDueUserIds(this.now());
    const max = Math.max(1, toInt(this._notifyCfg().MAX_PROCESS_PER_RUN, 500));
    let processed = 0;
    let notified = 0;
    for (const id of ids) {
      if (processed >= max) break;
      const u = await this.users.load(id).catch(() => null);
      if (!u) continue;
      const changed = this._normalizeModel(u);
      const readyPlots = this._readyUnnotifiedPlots(u, this.now());
      processed += 1;
      if (!readyPlots.length) {
        if (changed) await this.users.save(u);
        continue;
      }
      const sent = await this._notifyReady(u, readyPlots);
      if (sent?.sent) {
        notified += 1;
      }
      if (changed || sent?.sent) {
        await this.users.save(u);
      }
    }
    return { processed, notified };
  }
}
