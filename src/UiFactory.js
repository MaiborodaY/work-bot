// UiFactory.js
import { CONFIG } from "./GameConfig.js";
import { GymService } from "./GymService.js";
import { normalizeLang, t } from "./i18n/index.js";
import { getJobTitle, getShopTitle, getUpgradeDesc, getUpgradeTitle } from "./I18nCatalog.js";
import { Routes, toGoCallback } from "./Routes.js";
import { EnergyService } from "./EnergyService.js";
import { ProgressionService } from "./ProgressionService.js";

export class UiFactory {
  _lang(lang) {
    return normalizeLang(lang || "en");
  }

  _t(lang, key, vars = {}) {
    return t(key, this._lang(lang), vars);
  }

  _go(route) {
    return toGoCallback(route);
  }

  _workTimeLabel(durationMs, lang = "en") {
    const l = this._lang(lang);
    const mins = Math.max(1, Math.round((Number(durationMs) || 0) / 60000));
    if (mins >= 24 * 60 && mins % (24 * 60) === 0) {
      const days = mins / (24 * 60);
      return l === "en" ? `${days}d` : `${days} дн`;
    }
    if (mins >= 60 && mins % 60 === 0) {
      const hours = mins / 60;
      return l === "en" ? `${hours}h` : `${hours} ч`;
    }
    return l === "en" ? `${mins} min` : (l === "uk" ? `${mins} хв` : `${mins} мин`);
  }

  _workPayLabel(job) {
    const min = Math.max(0, Math.floor(Number(job?.payMin) || 0));
    const max = Math.max(min, Math.floor(Number(job?.payMax) || 0));
    if (min > 0 || max > 0) return `${min}-${max}`;
    return Math.max(0, Math.round(Number(job?.pay) || 0));
  }

  _hasAnyBusiness(user) {
    const owned = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
    return owned.some((x) => {
      if (!x) return false;
      if (typeof x === "string") return x.trim().length > 0;
      return String(x?.id || "").trim().length > 0;
    });
  }

  _hasPendingNewbieTasks(user) {
    if (user?.flags?.onboarding) return true;
    if (!user?.flags?.onboardingDone) return false;
    return user?.newbiePath?.completed !== true;
  }

  mainReply(lang = "en") {
    const l = this._lang(lang);
    return {
      keyboard: [
        [
          { text: this._t(l, "ui.reply.square") },
          { text: this._t(l, "ui.reply.city") },
          { text: this._t(l, "ui.reply.earn") },
          { text: this._t(l, "ui.reply.bar") }
        ],
        [
          { text: this._t(l, "ui.reply.profile") }
        ]
      ],
      resize_keyboard: true,
    };
  }

  square(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.square.earn"), callback_data: this._go(Routes.EARN) }],
      [{ text: this._t(l, "ui.square.progress"), callback_data: this._go(Routes.PROGRESS) }],
      [{ text: this._t(l, "ui.square.minigames"), callback_data: this._go(Routes.MINI_GAMES) }],
      [{ text: this._t(l, "ui.square.city"), callback_data: this._go(Routes.CITY) }],
      [{ text: this._t(l, "ui.square.shop"), callback_data: this._go(Routes.SHOP_HUB) }],
    ];
  }
  
  miniGames(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.minigames.td"), callback_data: "game:td" }],
      [{ text: this._t(l, "ui.minigames.runner"), callback_data: "game:runner" }],
      [{ text: this._t(l, "ui.back.square"), callback_data: this._go(Routes.SQUARE) }],
    ];
  }
  
  earn(userOrLang = "ru", langMaybe = "ru") {
    const user = (userOrLang && typeof userOrLang === "object") ? userOrLang : null;
    const lang = user ? (langMaybe || user?.lang || "ru") : String(userOrLang || "ru");
    const l = this._lang(lang);

    const kb = [
      [{ text: this._t(l, "ui.earn.work"), callback_data: this._go(Routes.WORK) }],
      [{ text: this._t(l, "ui.earn.bar"), callback_data: this._go(Routes.BAR) }],
      [{ text: this._t(l, "ui.earn.business"), callback_data: this._go(Routes.BUSINESS) }],
      [{ text: this._t(l, "ui.earn.farm"), callback_data: this._go(Routes.FARM) }],
    ];

    // Hide hires menu for players without any purchased business (prevents early confusion).
    // If user isn't provided (legacy call sites), keep showing the button to avoid behavior change.
    if (!user || this._hasAnyBusiness(user)) {
      kb.push([{ text: this._t(l, "ui.earn.labour"), callback_data: this._go(Routes.LABOUR) }]);
    }

    const earnPlayerLevel = user ? Math.max(1, ProgressionService.getLevelInfo(user)?.level || 1) : 99;
    if (earnPlayerLevel >= 5) {
      kb.push([{ text: this._t(l, "ui.earn.stocks"),    callback_data: this._go(Routes.STOCKS) }]);
      kb.push([{ text: this._t(l, "ui.city.syndicate"), callback_data: this._go(Routes.SYNDICATE) }]);
    }
    kb.push(
      [{ text: this._t(l, "ui.earn.fishing"), callback_data: this._go(Routes.FISHING) }],
      [{ text: this._t(l, "ui.back.city"),    callback_data: this._go(Routes.SQUARE) }],
    );

    return kb;
  }
  progress(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.progress.study"), callback_data: this._go(Routes.STUDY) }],
      [{ text: this._t(l, "ui.progress.gym"), callback_data: this._go(Routes.GYM) }],
      [{ text: this._t(l, "ui.progress.upgrades"), callback_data: this._go(Routes.UPGRADES) }],
      [{ text: this._t(l, "ui.back.city"), callback_data: this._go(Routes.SQUARE) }],
    ];
  }
  city(userOrLang = "ru", langMaybe = "ru") {
    const user = (userOrLang && typeof userOrLang === "object") ? userOrLang : null;
    const lang = user ? (langMaybe || user?.lang || "ru") : String(userOrLang || "ru");
    const l = this._lang(lang);

    const cityPlayerLevel = user ? Math.max(1, ProgressionService.getLevelInfo(user)?.level || 1) : 99;
    const kb = [
      [{ text: this._t(l, "ui.city.home"),    callback_data: this._go(Routes.HOME) }],
      [{ text: this._t(l, "ui.city.board"),   callback_data: this._go(Routes.CITY_BOARD) }],
      [{ text: this._t(l, "ui.city.ratings"), callback_data: this._go(Routes.RATINGS) }],
      [{ text: this._t(l, "ui.city.clans"),   callback_data: this._go(Routes.CLAN) }],
      ...(cityPlayerLevel >= 5 ? [[{ text: this._t(l, "ui.city.colosseum"), callback_data: this._go(Routes.COLOSSEUM) }]] : []),
    ];

    // Hide theft menu for players without any purchased business (prevents early confusion).
    // If user isn't provided (legacy call sites), keep showing the button to avoid behavior change.
    if (!user || this._hasAnyBusiness(user)) {
      kb.push([{ text: this._t(l, "ui.city.thief"), callback_data: this._go(Routes.THIEF) }]);
    }

    kb.push(
      [{ text: this._t(l, "ui.city.referral"), callback_data: this._go(Routes.REFERRAL) }],
      [{ text: this._t(l, "ui.back.city"), callback_data: this._go(Routes.SQUARE) }],
    );

    return kb;
  }
  shopHub(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.shophub.food"), callback_data: this._go(Routes.SHOP) }],
      [{ text: this._t(l, "ui.shophub.premium"), callback_data: "premium:open" }],
      [{ text: this._t(l, "ui.back.city"), callback_data: this._go(Routes.SQUARE) }],
    ];
  }
       

  bar(user, now = Date.now(), lang = null) {
    const l = this._lang(lang || user?.lang);
    const kb = [];
    const bar = user.bar || {};
    const tasks = Array.isArray(bar.tasks) ? bar.tasks : [];
    const minStudy = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
    const studyLevel = Math.max(0, Number(user?.study?.level) || 0);
    const canOpenArcana = studyLevel >= minStudy;
  
    // Onboarding: keep bar menu focused on newbie tasks only.
    if (user?.flags?.onboarding) {
      kb.push([{ text: this._t(l, "ui.bar.newbie_tasks"), callback_data: "bar:newbie" }]);
      kb.push([{ text: this._t(l, "ui.back.earn"), callback_data: this._go(Routes.EARN) }]);
      return kb;
    }

    const today = new Date().toISOString().slice(0,10);
    const bonusDay = String(user?.bonus?.last || "");
    const showDailyBonus = bonusDay !== today;
    if (showDailyBonus) {
      kb.push([{ text: this._t(l, "loc.daily_bonus"), callback_data: "daily:claim" }]);
    }

    kb.push([{ text: this._t(l, "ui.bar.tasks"), callback_data: "bar:tasks" }]);
    if (this._hasPendingNewbieTasks(user)) {
      kb.push([{ text: this._t(l, "ui.bar.newbie_tasks"), callback_data: "bar:newbie" }]);
    }
    kb.push([{ text: this._t(l, "ui.bar.quiz"), callback_data: "quiz:open" }]);
    kb.push([{ text: this._t(l, "ui.bar.quiz_general"), callback_data: "gquiz:open" }]);
    if (canOpenArcana) {
      kb.push([{ text: this._t(l, "ui.bar.arcana"), callback_data: this._go(Routes.CASINO) }]);
    }
  
    const subDay = user?.subReward?.day || "";
    const showSubBtn = subDay !== today;
    if (showSubBtn) {
      kb.push([{ text: this._t(l, "ui.bar.sub_reward"), callback_data: "bar:sub" }]);
    }
  
    kb.push([{ text: this._t(l, "ui.back.earn"), callback_data: this._go(Routes.EARN) }]);
    return kb;
  }

  barTasks(user, lang = null) {
    const l = this._lang(lang || user?.lang);
    return [
      [{ text: this._t(l, "ui.back.default"), callback_data: this._go(Routes.BAR) }]
    ];
  }
  
  

// ---------- Работа ----------
  workV2(user, options = {}, lang = null) {
    const l = this._lang(lang || user?.lang);
    const { active = null, ready = false } = options;
    const kb = [];
    const backTo = (options && typeof options.backTo === "string" && options.backTo) ? options.backTo : null;
    const backText = this._t(l, "ui.back.default");
    const backCb = this._go(backTo || Routes.EARN);
    const onboarding = !!(user?.flags?.onboarding);
    const onboardingStep = String(user?.flags?.onboardingStep || options.onboardingStep || "");
    const canUseFreeSkip = onboarding && onboardingStep === "job_claim" && !user?.flags?.freeSkipUsed_work;

    if (active) {
      if (ready) {
        kb.push([{ text: this._t(l, "ui.work.claim", { pay: active.plannedPay }), callback_data: "work:claim" }]);
        if (!onboarding) {
          kb.push([{ text: this._t(l, "ui.work.cancel_shift"), callback_data: "work:cancel" }]);
        }
      } else {
        if (canUseFreeSkip) {
          kb.push([{ text: this._t(l, "ui.work.skip_free"), callback_data: "work:skip_free" }]);
        } else {
          const costLabel = (typeof options.ffCost === "number" && options.ffCost > 0)
            ? `${CONFIG.PREMIUM.emoji}${options.ffCost}` : `${CONFIG.PREMIUM.emoji}?`;
          kb.push([{ text: this._t(l, "ui.work.skip_for", { cost: costLabel }), callback_data: "work:skip" }]);
        }
        if (!onboarding) {
          kb.push([{ text: this._t(l, "ui.work.cancel_penalty"), callback_data: "work:cancel" }]);
        }
      }
      kb.push([{ text: backText, callback_data: backCb }]);
      return kb;
    }

    const entries = Object.entries(CONFIG.JOBS || {});
    const newbieWorkOnly = (
      !!user?.flags?.onboardingDone &&
      !user?.flags?.onboarding &&
      user?.newbiePath?.completed !== true &&
      user?.newbiePath?.pending !== true &&
      Number(user?.newbiePath?.step || 0) === 2
    );
    const playerLevel = user ? Math.max(1, ProgressionService.getLevelInfo(user)?.level || 1) : 99;
    const LEVEL5_JOBS = new Set(["loader", "shawarma_seller", "dentist", "qa_engineer", "farmer"]);
    const allEntries = playerLevel >= 5 ? entries : entries.filter(([id]) => !LEVEL5_JOBS.has(id));
    const list = (user?.flags?.onboarding || newbieWorkOnly) ? allEntries.slice(0, 1) : allEntries;
    for (const [id, j] of list) {
      const time = this._workTimeLabel(j.durationMs, l);
      const pay = this._workPayLabel(j);
      const title = getJobTitle(id, l);
      kb.push([{
        text: this._t(l, "ui.work.entry", { title, time, pay, energy: j.energy }),
        callback_data: `work:start:${id}`
      }]);
    }

    kb.push([{ text: backText, callback_data: backCb }]);
    return kb;
  }

  // ---------- Учеба ----------
  studyIdle(effectsText, opts = {}, lang = "ru") {
    const l = this._lang(lang);
    const backTo = (opts && typeof opts.backTo === "string" && opts.backTo) ? opts.backTo : Routes.PROGRESS;
      return [
        [{ text: this._t(l, "ui.study.start", { effects: effectsText }), callback_data: "study:start" }],
        [{ text: this._t(l, "ui.back.default"), callback_data: this._go(backTo) }],
      ];
  }

  studyActive(progress, { ready = false, ffCost = null, backTo = Routes.PROGRESS } = {}, lang = "ru") {
    const l = this._lang(lang);
    if (ready) {
      return [
        [{ text: this._t(l, "ui.progress.line", { progress }), callback_data: "noop" }],
        [{ text: this._t(l, "ui.study.finish"), callback_data: "study:finish" }],
        [{ text: this._t(l, "ui.back.default"), callback_data: this._go(backTo) }],
      ];
    }

    const costLabel = (typeof ffCost === "number" && ffCost > 0)
      ? `${CONFIG.PREMIUM.emoji}${ffCost}`
      : `${CONFIG.PREMIUM.emoji}?`;
    return [
      [{ text: this._t(l, "ui.progress.line", { progress }), callback_data: "noop" }],
      [{ text: this._t(l, "ui.study.skip_for", { cost: costLabel }), callback_data: "study:skip" }],
      [{ text: this._t(l, "ui.back.default"), callback_data: this._go(backTo) }],
    ];
  }


  // ---------- Дом ----------
  home(user, opts = {}, lang = null) {
    const l = this._lang(lang || user?.lang);
    const owned = new Set(user.upgrades || []);
    const kb = [];

    const mult = user.upgrades.includes("bed3") ? 3
    : user.upgrades.includes("bed2") ? 2
    : user.upgrades.includes("bed1") ? 1.5
    : 1;

    if (!user.rest.active) {
      const approx = (mult === 1.5) ? "~1.5" : `${Math.round(1 * mult)}`;
      kb.push([{ text: this._t(l, "ui.home.rest_start", { approx }), callback_data: "rest:start" }]);
    } else {
      kb.push([{ text: this._t(l, "ui.home.rest_stop", { mult }), callback_data: "rest:stop" }]);
    }


    const eatButtons = Object.entries(CONFIG.SHOP)
      .filter(([k, v]) => (user.inv[k] || 0) > 0 && typeof v.price === "number")
      .map(([k, v]) => [{ text: `${getShopTitle(k, l)} x${user.inv[k]} (+${v.heal}⚡)`, callback_data: `eat_${k}` }]);
    if (eatButtons.length) kb.push(...eatButtons);

    const bedKeys = ["bed1", "bed2", "bed3"].filter(k => CONFIG.UPGRADES[k]);

    let currentIdx = -1;
    for (let i = bedKeys.length - 1; i >= 0; i--) {
      if (owned.has(bedKeys[i])) { currentIdx = i; break; }
    }
    const currentKey   = currentIdx >= 0 ? bedKeys[currentIdx] : null;
    const currentTitle = currentKey ? (getUpgradeTitle(currentKey, l) || this._t(l, "ui.home.bed.current_fallback")) : this._t(l, "ui.home.bed.none");
    
    kb.push([{ text: this._t(l, "ui.home.bed.current", { title: currentTitle, mult }), callback_data: "noop" }]);
    
    const nextKey = bedKeys[currentIdx + 1];
    if (nextKey) {
      const it = CONFIG.UPGRADES[nextKey];
      const nextTitle = getUpgradeTitle(nextKey, l) || it.title;
      const effect =
        nextKey === "bed1" ? this._t(l, "ui.home.bed.effect1") :
        nextKey === "bed2" ? this._t(l, "ui.home.bed.effect2") :
        nextKey === "bed3" ? this._t(l, "ui.home.bed.effect3") : (it?.desc || "");
      const row = [{ text: `${nextTitle} · ${effect} · $${it.price}`, callback_data: `upg:buy:${nextKey}` }];
      if (typeof it.price_premium === "number") {
        row.push({ text: `${CONFIG.PREMIUM.emoji}${it.price_premium}`, callback_data: `upg:buy_p:${nextKey}` });
      }
      kb.push(row);
    } else {
      kb.push([{ text: this._t(l, "ui.home.bed.all_bought"), callback_data: "noop" }]);
    }

    const petBtnText = l === "en"
      ? "🐾 Pet"
      : (l === "uk" ? "🐾 Улюбленець" : "🐾 Питомец");
    kb.push([{ text: petBtnText, callback_data: this._go(Routes.PET) }]);
    
    const back = (opts && typeof opts.backTo === "string" && opts.backTo) ? opts.backTo : Routes.CITY;
    kb.push([{ text: this._t(l, "ui.back.default"), callback_data: this._go(back) }]);
    return kb;
  }

  // ---------- Магазин ----------
  shop(opts = {}, lang = "ru") {
    const l = this._lang(lang);
    const user = opts?.user || null;
    const playerLevel = user ? Math.max(1, ProgressionService.getLevelInfo(user)?.level || 1) : 99;
    const LEVEL5_ITEMS = new Set(["sandwich", "lunch", "borscht"]);
    const items = Object.entries(CONFIG.SHOP)
      .filter(([k]) => playerLevel >= 5 || !LEVEL5_ITEMS.has(k))
      .map(([k, v]) => {
        const itemTitle = getShopTitle(k, l);
        const label = (typeof v.price === "number")
          ? this._t(l, "ui.shop.item_money", { title: itemTitle, price: v.price })
          : (typeof v.price_premium === "number")
            ? this._t(l, "ui.shop.item_gems", { title: itemTitle, gems: `${CONFIG.PREMIUM.emoji}${v.price_premium}` })
            : this._t(l, "ui.shop.item", { title: itemTitle });
        return [{ text: label, callback_data: `buy_${k}` }];
      });

    const backTo   = opts?.backTo || null;
    const backText =
      backTo === Routes.WORK  ? this._t(l, "ui.back.work_shifts") :
      backTo === Routes.STUDY ? this._t(l, "ui.back.study") :
      backTo === Routes.GYM   ? this._t(l, "ui.back.gym") :
                           this._t(l, "ui.back.default");
    const backCb = this._go(backTo || Routes.SHOP_HUB);
    items.push([{ text: backText, callback_data: backCb }]);
    return items;
  }



  // ---------- Казино ----------
  casinoMenu(user, lang = null) {
    const l = this._lang(lang || user?.lang);
    const minStudy = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
    const studyLevel = Math.max(0, Number(user?.study?.level) || 0);
    const allowPaid = studyLevel >= minStudy;

    if (!allowPaid) {
      return [
        [
          { text: this._t(l, "ui.casino.rules"), callback_data: "casino_info" },
          { text: this._t(l, "ui.casino.to_bar"), callback_data: this._go(Routes.BAR) }
        ]
      ];
    }

    const PRICES = Array.isArray(CONFIG.CASINO.prices) && CONFIG.CASINO.prices.length
      ? CONFIG.CASINO.prices
      : [CONFIG.CASINO.price_low, CONFIG.CASINO.price_high];

    const rows = [];
    for (let i = 0; i < PRICES.length; i += 2) {
      const row = [];
      const p1 = PRICES[i];
      row.push({ text: this._t(l, "ui.casino.spin_for", { price: p1 }), callback_data: `casino_spin:${p1}` });
      const p2 = PRICES[i + 1];
      if (p2 != null) row.push({ text: this._t(l, "ui.casino.spin_for", { price: p2 }), callback_data: `casino_spin:${p2}` });
      rows.push(row);
    }
    rows.push([{ text: this._t(l, "ui.casino.allin"), callback_data: "casino_allin:ask" }]);
    rows.push([
      { text: this._t(l, "ui.casino.rules"), callback_data: "casino_info" },
      { text: this._t(l, "ui.casino.to_bar"), callback_data: this._go(Routes.BAR) }
    ]);
    return rows;
  }

  // ===== Зал =====
  gym(user, now = Date.now(), ffCost = null, lang = null) {
    const l = this._lang(lang || user?.lang);
    const onboarding = !!(user?.flags?.onboarding);
    const onboardingStep = String(user?.flags?.onboardingStep || "");
    const canUseFreeSkip = onboarding && onboardingStep === "gym_started" && !user?.flags?.freeSkipUsed_gym;
    if (user?.gym?.active) {
      const startAt = user.gym.startAt || 0;
      const endAt   = user.gym.endAt   || 1;
      const elapsed = Math.max(0, now - startAt);
      const need    = Math.max(1, endAt - startAt);
      const progress= Math.min(100, Math.floor((elapsed / need) * 100));
      const ready   = now >= endAt;
    
      if (ready) {
        return [
          [{ text: this._t(l, "ui.progress.line", { progress }), callback_data: "noop" }],
          [{ text: this._t(l, "ui.gym.finish"), callback_data: "gym:finish" }],
          [{ text: this._t(l, "ui.back.progress"), callback_data: this._go(Routes.PROGRESS) }],
        ];
      }
    
      const costLabel = (typeof ffCost === "number" && ffCost > 0)
        ? `${CONFIG.PREMIUM.emoji}${ffCost}`
        : `${CONFIG.PREMIUM.emoji}?`;
      return [
        [{ text: this._t(l, "ui.progress.line", { progress }), callback_data: "noop" }],
        [{
          text: canUseFreeSkip
            ? this._t(l, "ui.gym.skip_free")
            : this._t(l, "ui.gym.skip_for", { cost: costLabel }),
          callback_data: canUseFreeSkip ? "gym:skip_free" : "gym:skip"
        }],
        [{ text: this._t(l, "ui.back.progress"), callback_data: this._go(Routes.PROGRESS) }],
      ];
    }
    

    const { timeMs, costMoney, costEnergy } = GymService.computeForUser(user);
    const mins = Math.max(1, Math.round(timeMs / 60000));
    const passCfg = EnergyService.passCfg();
    const passState = EnergyService.gymPassState(user, now);
    const gymCap = Math.max(0, Number(CONFIG?.GYM?.MAX_ENERGY_CAP) || 160);
    const baseEnergyMax = Math.max(0, Number(user?.energy_max) || 0);

    const out = [
      [{
        text: this._t(l, "ui.gym.start", { money: costMoney, energy: costEnergy, mins }),
        callback_data: "gym:start"
      }],
    ];

    // Onboarding: avoid extra noise and future mechanics like gym pass.
    if (onboarding) {
      out.push([{ text: this._t(l, "ui.back.progress"), callback_data: this._go(Routes.PROGRESS) }]);
      return out;
    }

    if (passState.active) {
      const leftMin = Math.max(1, Math.ceil(passState.leftMs / 60000));
      const d = Math.floor(leftMin / (24 * 60));
      const h = Math.floor((leftMin % (24 * 60)) / 60);
      const m = leftMin % 60;
      out.push([{
        text: this._t(l, "ui.gym.pass_active", { bonus: passCfg.bonusEnergyMax, d, h, m }),
        callback_data: "noop"
      }]);
    } else if (baseEnergyMax >= gymCap) {
      out.push([{
        text: this._t(l, "ui.gym.pass_buy", { bonus: passCfg.bonusEnergyMax, gems: passCfg.priceGems }),
        callback_data: "gym:pass:buy"
      }]);
    } else {
      out.push([{
        text: this._t(l, "ui.gym.pass_locked", { need: gymCap, have: baseEnergyMax }),
        callback_data: "noop"
      }]);
    }

    out.push([{ text: this._t(l, "ui.back.progress"), callback_data: this._go(Routes.PROGRESS) }]);
    return out;
  }

  // ---------- Улучшения ----------
  upgradesCaption(user, lang = null) {
    const l = this._lang(lang || user?.lang);
    const owned = new Set(user.upgrades || []);
    const lines = [this._t(l, "ui.upgrades.title")];

    for (const key of Object.keys(CONFIG.UPGRADES)) {
      if (key === "bed1" || key === "bed2" || key === "bed3") continue;
      const it = CONFIG.UPGRADES[key];
      const title = getUpgradeTitle(key, l) || it.title;
      const desc = getUpgradeDesc(key, l) || it.desc;
      const mark = owned.has(key) ? "✔" : "✖";
      const alt = (typeof it.price_premium === "number") ? ` / ${CONFIG.PREMIUM?.emoji || "💎"}${it.price_premium}` : "";
      lines.push(`${mark} ${title}: ${desc}${it.price ? ` · $${it.price}${alt}` : ""}`);
    }
    return lines.join("\n");
  }

  upgrades(user, lang = null) {
    const l = this._lang(lang || user?.lang);
    const owned = new Set(user.upgrades || []);
    const rows = [];
    for (const key of Object.keys(CONFIG.UPGRADES)) {
      if (key === "bed1" || key === "bed2" || key === "bed3") continue;
      const it = CONFIG.UPGRADES[key];
      const title = getUpgradeTitle(key, l) || it.title;
      if (owned.has(key)) {
        rows.push([{ text: this._t(l, "ui.upgrades.bought", { title }) , callback_data: "noop" }]);
      } else {
        const row = [{ text: this._t(l, "ui.upgrades.buy", { title, price: it.price }), callback_data: `upg:buy:${key}` }];
        if (typeof it.price_premium === "number") {
          row.push({ text: `${CONFIG.PREMIUM.emoji}${it.price_premium}`, callback_data: `upg:buy_p:${key}` });
        }
        rows.push(row);
      }
    }
    rows.push([{ text: this._t(l, "ui.back.default"), callback_data: this._go(Routes.PROGRESS) }]);
    return rows;
  }

  // ---------- Доска почета ----------
  cityBoard(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.cityboard.contribute"), callback_data: "city:contribute" }],
      [
        { text: this._t(l, "ui.cityboard.topday"),    callback_data: "city:topday" },
        { text: this._t(l, "ui.cityboard.topweek"), callback_data: "city:topweek" }
      ],
      [
        { text: this._t(l, "ui.cityboard.topsmart"), callback_data: "city:topsmart" },
        { text: this._t(l, "ui.cityboard.topstrong"),    callback_data: "city:topstrong" }
      ],
      [
        { text: this._t(l, "ui.cityboard.topfarmday"), callback_data: "city:topfarmday" },
        { text: this._t(l, "ui.cityboard.topbizday"), callback_data: "city:topbizday" }
      ],
      [{ text: this._t(l, "ui.cityboard.toptheftweek"), callback_data: "city:toptheftweek" }],
      [{ text: this._t(l, "ui.cityboard.rename"), callback_data: "social:name" }],
      [{ text: this._t(l, "ui.back.default"), callback_data: this._go(Routes.CITY) }],
    ];
  }
  
  cityTopStrong(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.back.default"), callback_data: this._go(Routes.CITY_BOARD) }],
    ];
  }

  cityTopDay(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.back.default"), callback_data: this._go(Routes.CITY_BOARD) }],
    ];
  }

  cityTopDayCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.day.empty");
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = [this._t(l, "ui.cityboard.day.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      lines.push(`${m} ${x.name} — $${x.total}`);
    });
    return lines.join("\n");
  }
  cityTopWeekCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.week.empty");
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = [this._t(l, "ui.cityboard.week.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      lines.push(`${m} ${x.name} — $${x.total}`);
    });
    return lines.join("\n");
  }
  cityTopSmartCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.smart.empty");
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = [this._t(l, "ui.cityboard.smart.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const total = Math.max(0, Number(x?.total || 0));
      lines.push(`${m} ${x.name} - $${total}`);
    });
    return lines.join("\n");
  }
  cityTopStrongCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.strong.empty");
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = [this._t(l, "ui.cityboard.strong.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const money = Math.max(0, Number(x?.money || 0));
      const gems = Math.max(0, Number(x?.gems || 0));
      lines.push(`${m} ${x.name} — $${money} + ${CONFIG?.PREMIUM?.emoji || "💎"}${gems}`);
    });
    return lines.join("\n");
  }

  cityTopLucky(lang = "ru") {
    const l = this._lang(lang);
    return [
      [{ text: this._t(l, "ui.back.default"), callback_data: this._go(Routes.CITY_BOARD) }],
    ];
  }

  cityTopLuckyCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.lucky.empty");
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = [this._t(l, "ui.cityboard.lucky.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const best = typeof x.best === "number" ? x.best : 0;
      lines.push(`${m} ${x.name} — $${best}`);
    });
    return lines.join("\n");
  }

  cityTopFarmWeekCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.farmweek.empty");
    }
    const medals = ["🥇", "🥈", "🥉"];
    const lines = [this._t(l, "ui.cityboard.farmweek.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i + 1}.`;
      const total = Math.max(0, Number(x?.total || x?.money || 0));
      lines.push(`${m} ${x.name} — $${total}`);
    });
    return lines.join("\n");
  }

  cityTopBizDayCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.bizday.empty");
    }
    const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
    const lines = [this._t(l, "ui.cityboard.bizday.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i + 1}.`;
      const total = Math.max(0, Number(x?.total || 0));
      lines.push(`${m} ${x.name} - $${total}`);
    });
    return lines.join("\n");
  }

  cityTopFarmDayCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.farmday.empty");
    }
    const medals = ["🥇", "🥈", "🥉"];
    const lines = [this._t(l, "ui.cityboard.farmday.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i + 1}.`;
      const total = Math.max(0, Number(x?.total || x?.money || 0));
      lines.push(`${m} ${x.name} — $${total}`);
    });
    return lines.join("\n");
  }

  cityTopTheftWeekCaption(list, lang = "ru") {
    const l = this._lang(lang);
    if (!Array.isArray(list) || !list.length) {
      return this._t(l, "ui.cityboard.theftweek.empty");
    }
    const medals = ["🥇", "🥈", "🥉"];
    const lines = [this._t(l, "ui.cityboard.theftweek.title")];
    list.forEach((x, i) => {
      const m = medals[i] || `${i + 1}.`;
      const total = Math.max(0, Number(x?.total || x?.stolen || 0));
      lines.push(`${m} ${x.name} — $${total}`);
    });
    return lines.join("\n");
  }

}
