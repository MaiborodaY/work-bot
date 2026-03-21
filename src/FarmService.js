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

export class FarmService {
  constructor({ db, users, now, bot = null, quests = null, achievements = null }) {
    this.db = db || users?.db || null;
    this.users = users || null;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.quests = quests || null;
    this.achievements = achievements || null;
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
        title: "🌱 Farm",
        plotsLine: "Plots: {{plots}} (businesses: {{biz}})",
        cropCarrot: "Carrot",
        cropTomato: "Tomato",
        cropCorn: "Corn",
        plotReady: "{{emoji}} Plot {{num}} — ready!",
        plotGrowing: "⏳ Plot {{num}} — {{emoji}} {{name}}\nReady in {{left}}",
        plotEmpty: "🟫 Plot {{num}} — empty",
        btnPlant: "🌱 Plant (plot {{num}})",
        btnHarvest: "🧺 Harvest & sell {{emoji}} {{name}} — ${{price}}",
        btnRefresh: "🔄 Refresh",
        btnHelp: "ℹ️ How farm works",
        btnBackCity: "⬅️ Back",
        plantMenuTitle: "🟫 Plot {{num}} — empty\n\nWhat to plant?",
        plantOption: "{{emoji}} {{name}} — ${{seed}} · {{time}}",
        btnCancel: "⬅️ Cancel",
        plantOk: "🌱 {{emoji}} {{name}} planted on plot {{num}}.\nReady in {{time}}.",
        harvestOk: "{{emoji}} {{name}} harvested and sold!\n+${{money}}",
        errNoMoney: "Not enough money.",
        errPlotBusy: "This plot is already occupied.",
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
        helpPlots: "Plots: 1 free for everyone +1 per purchased business (max {{max}}).",
        helpCropsHeader: "🌾 Crops:",
        helpCropLine: "{{emoji}} {{name}}: seed ${{seed}}, grow {{time}}, sell ${{sell}} (profit +${{profit}})",
        helpPush: "Push: you'll get a notification when crop is ready.",
        helpRule: "Harvest does not disappear: it waits until you collect it.",
        timeMin: "min",
        timeHour: "h",
        timeDay: "d"
      };
    }
    if (lang === "uk") {
      return {
        title: "🌱 Ферма",
        plotsLine: "Грядок: {{plots}} (бізнесів: {{biz}})",
        cropCarrot: "Морква",
        cropTomato: "Помідор",
        cropCorn: "Кукурудза",
        plotReady: "{{emoji}} Грядка {{num}} — готово!",
        plotGrowing: "⏳ Грядка {{num}} — {{emoji}} {{name}}\nГотово через {{left}}",
        plotEmpty: "🟫 Грядка {{num}} — порожня",
        btnPlant: "🌱 Посадити (грядка {{num}})",
        btnHarvest: "🧺 Зібрати й продати {{emoji}} {{name}} — ${{price}}",
        btnRefresh: "🔄 Оновити",
        btnHelp: "ℹ️ Як працює ферма",
        btnBackCity: "⬅️ Назад",
        plantMenuTitle: "🟫 Грядка {{num}} — порожня\n\nЩо посадити?",
        plantOption: "{{emoji}} {{name}} — ${{seed}} · {{time}}",
        btnCancel: "⬅️ Скасувати",
        plantOk: "🌱 {{emoji}} {{name}} посаджено на грядці {{num}}.\nБуде готово через {{time}}.",
        harvestOk: "{{emoji}} {{name}} зібрано і продано!\n+${{money}}",
        errNoMoney: "Недостатньо коштів.",
        errPlotBusy: "Ця грядка вже зайнята.",
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
        helpPlots: "Грядки: 1 безкоштовна для всіх +1 за кожен куплений бізнес (макс {{max}}).",
        helpCropsHeader: "🌾 Культури:",
        helpCropLine: "{{emoji}} {{name}}: насіння ${{seed}}, ріст {{time}}, продаж ${{sell}} (прибуток +${{profit}})",
        helpPush: "Пуш: коли врожай дозріє, прийде повідомлення.",
        helpRule: "Врожай не зникає — чекатиме, доки ти його не збереш.",
        timeMin: "хв",
        timeHour: "год",
        timeDay: "д"
      };
    }
    return {
      title: "🌱 Ферма",
      plotsLine: "Грядок: {{plots}} (бизнесов: {{biz}})",
      cropCarrot: "Морковь",
      cropTomato: "Помидор",
      cropCorn: "Кукуруза",
      plotReady: "{{emoji}} Грядка {{num}} — готово!",
      plotGrowing: "⏳ Грядка {{num}} — {{emoji}} {{name}}\nГотово через {{left}}",
      plotEmpty: "🟫 Грядка {{num}} — пустая",
      btnPlant: "🌱 Посадить (грядка {{num}})",
      btnHarvest: "🧺 Собрать и продать {{emoji}} {{name}} — ${{price}}",
      btnRefresh: "🔄 Обновить",
      btnHelp: "ℹ️ Как работает ферма",
      btnBackCity: "⬅️ Назад",
      plantMenuTitle: "🟫 Грядка {{num}} — пустая\n\nЧто посадить?",
      plantOption: "{{emoji}} {{name}} — ${{seed}} · {{time}}",
      btnCancel: "⬅️ Отмена",
      plantOk: "🌱 {{emoji}} {{name}} посажена на грядке {{num}}.\nГотово через {{time}}.",
      harvestOk: "{{emoji}} {{name}} собрана и продана!\n+${{money}}",
      errNoMoney: "Недостаточно средств.",
      errPlotBusy: "Эта грядка уже занята.",
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
      helpPlots: "Грядки: 1 бесплатная для всех +1 за каждый купленный бизнес (макс {{max}}).",
      helpCropsHeader: "🌾 Культуры:",
      helpCropLine: "{{emoji}} {{name}}: семя ${{seed}}, рост {{time}}, продажа ${{sell}} (прибыль +${{profit}})",
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

  _ownedBusinessesCount(u) {
    const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    let count = 0;
    for (const item of arr) {
      const id = String(typeof item === "string" ? item : item?.id || "");
      if (id && CONFIG?.BUSINESS?.[id]) count += 1;
    }
    return count;
  }

  _plotLimit(u) {
    const base = Math.max(1, toInt(this._cfg().BASE_PLOTS, 1));
    const perBiz = Math.max(0, toInt(this._cfg().PLOTS_PER_BUSINESS, 1));
    const maxPlots = Math.max(base, toInt(this._cfg().MAX_PLOTS, 6));
    const total = base + perBiz * this._ownedBusinessesCount(u);
    return Math.max(base, Math.min(maxPlots, total));
  }

  _maxPlots() {
    const base = Math.max(1, toInt(this._cfg().BASE_PLOTS, 1));
    return Math.max(base, toInt(this._cfg().MAX_PLOTS, 6));
  }

  _defaultPlot(id) {
    return {
      id,
      status: "empty",
      cropId: "",
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
      sellPrice: Math.max(1, toInt(item.sellPrice, 1))
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
      u.farm = { plots: [] };
      dirty = true;
    }
    if (!Array.isArray(u.farm.plots)) {
      u.farm.plots = [];
      dirty = true;
    }

    const maxPlots = this._maxPlots();
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
      if (!Number.isFinite(Number(p.plantedAt))) { p.plantedAt = 0; dirty = true; }
      if (!Number.isFinite(Number(p.readyAt))) { p.readyAt = 0; dirty = true; }
      if (typeof p.notifiedReady !== "boolean") { p.notifiedReady = false; dirty = true; }

      if (p.status === "growing") {
        const crop = this._cropRaw(p.cropId);
        if (!crop) {
          Object.assign(p, this._defaultPlot(i + 1));
          dirty = true;
        } else {
          if (toInt(p.readyAt, 0) <= 0) {
            const plantedAt = toInt(p.plantedAt, this.now());
            p.plantedAt = plantedAt;
            p.readyAt = plantedAt + crop.growMs;
            dirty = true;
          }
        }
      } else {
        if (p.cropId || toInt(p.plantedAt, 0) || toInt(p.readyAt, 0) || p.notifiedReady) {
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

  _leftLabel(source, msLeft) {
    return this._durationLabel(source, Math.max(0, toInt(msLeft, 0)));
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
    const bizCount = this._ownedBusinessesCount(u);
    const plotsCount = this._plotLimit(u);
    const plots = Array.isArray(u?.farm?.plots) ? u.farm.plots : [];

    const lines = [s.title, "", this._fmt(s.plotsLine, { plots: plotsCount, biz: bizCount }), ""];
    const kb = [];

    for (let i = 1; i <= plotsCount; i += 1) {
      const p = plots[i - 1] || this._defaultPlot(i);
      if (String(p.status || "") === "growing") {
        const crop = this._cropInfo(u, p.cropId);
        if (!crop) {
          lines.push(this._fmt(s.plotEmpty, { num: i }), "");
          kb.push([{ text: this._fmt(s.btnPlant, { num: i }), callback_data: `farm:plant_menu:${i}` }]);
          continue;
        }
        if (this._isReady(p, nowTs)) {
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

    kb.push([{ text: s.btnRefresh, callback_data: "farm:refresh" }]);
    kb.push([{ text: s.btnHelp, callback_data: "farm:help" }]);
    kb.push([{ text: s.btnBackCity, callback_data: "go:City" }]);

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
          time: this._durationLabel(u, crop.growMs)
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
    const lines = [
      s.helpTitle,
      "",
      s.helpIntro,
      this._fmt(s.helpPlots, { max: maxPlots }),
      "",
      s.helpCropsHeader
    ];
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
        profit
      }));
    }
    lines.push("", s.helpPush, s.helpRule);

    return {
      caption: lines.join("\n").trim(),
      keyboard: [[{ text: s.btnBackCity, callback_data: "go:Farm" }]]
    };
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

    u.money = money - crop.seedPrice;
    const nowTs = this.now();
    p.status = "growing";
    p.cropId = crop.id;
    p.plantedAt = nowTs;
    p.readyAt = nowTs + crop.growMs;
    p.notifiedReady = false;

    markUsefulActivity(u, nowTs);
    await this._markDue(u?.id, p.readyAt);
    await this.users.save(u);
    return { ok: true, plotIndex: target.index, cropId: crop.id, growMs: crop.growMs };
  }

  async harvest(u, plotIndex) {
    this._normalizeModel(u);
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
    u.money = toInt(u?.money, 0) + sellPrice;
    Object.assign(p, this._defaultPlot(target.index));
    markUsefulActivity(u, this.now());

    let qRes = null;
    if (this.quests?.onEvent) {
      qRes = await this.quests.onEvent(u, "farm_harvest", { cropId: crop.id, money: sellPrice }, {
        persist: false,
        notify: false
      }).catch(() => null);
    }
    let aRes = null;
    if (this.achievements?.onEvent) {
      aRes = await this.achievements.onEvent(u, "farm_harvest", { cropId: crop.id, money: sellPrice }, {
        persist: false,
        notify: false
      }).catch(() => null);
    }

    await this.users.save(u);
    if (qRes?.events?.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(u, qRes.events).catch(() => {});
    }
    if (aRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, aRes.newlyEarned).catch(() => {});
    }

    return { ok: true, plotIndex: target.index, cropId: crop.id, sellPrice };
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
