import { CONFIG } from "./GameConfig.js";
import { NameService } from "./NameService.js";
import { ASSETS, JOB_ASSETS } from "./Assets.js";
import { BarService } from "./BarService.js";
import { normalizeLang, t } from "./i18n/index.js";
import { getBusinessNote, getBusinessTitle, getJobTitle } from "./I18nCatalog.js";

export class Locations {
  /**
   * @param {{
   *  media:any, ui:any, economy:any, formatters:any,
   *  pct:(a:number,b:number)=>number, now:()=>number,
   *  maybeFinishStudy:(u:any)=>Promise<boolean>,
   *  maybeFinishGym?:(u:any, goTo:(u:any,place:string,intro?:string)=>Promise<void>)=>Promise<boolean>,
   *  daily?:any,
   *  fastForward?: { quote:(u:any, kind:"work"|"study"|"gym")=>{ok:boolean,cost?:number} }
   *  users?:any
   *  clans?:any
   *  stocks?:any,
   *  labour?:any,
   *  referrals?:any
   * }} deps
   */
  constructor({ media, ui, economy, formatters, pct, now, maybeFinishStudy, daily, fastForward, users, social, clans, stocks, labour, referrals }) {
    this.media = media;
    this.ui = ui;
    this.economy = economy;
    this.formatters = formatters;
    this.pct = pct;
    this.now = now;
    this.maybeFinishStudy = maybeFinishStudy;
    this.daily = daily;
    this.fastForward = fastForward || null;
    this.users = users || null; // ← понадобится для await users.save(u)
    this.social = social || null;
    this.clans = clans || null;
    this.stocks = stocks || null;
    this.labour = labour || null;
    this.referrals = referrals || null;


    this._sourceMsg = null;
    this._route = "Square";
    this._backToRoute = null;
  }

  setSourceMessage(msg) { this._sourceMsg = msg || null; }
  setRoute(route) {
    this._route = typeof route === "string" && route ? route : this._route;
  }
  setBack(to) {
    this._backToRoute = (typeof to === "string" && to) ? to : null;
  }

  _lang(user) {
    return normalizeLang(user?.lang || "ru");
  }

  _t(user, key, vars = {}) {
    return t(key, this._lang(user), vars);
  }

  _getSquareHint(u) {
    const now = this.now();
    const active = Array.isArray(u?.jobs?.active) && u.jobs.active.length ? u.jobs.active[0] : null;
    const hasActiveJob = !!active;
    const jobReady = hasActiveJob && Number(active?.endAt || 0) <= now;

    if (jobReady) return this._t(u, "loc.hint.job_ready");
    if (hasActiveJob) return this._t(u, "loc.hint.job_active");
    if ((Number(u?.energy) || 0) <= 0) return this._t(u, "loc.hint.no_energy");
    if (!String(u?.clan?.clanId || "").trim()) return this._t(u, "loc.hint.no_clan");
    if (!hasActiveJob && (Number(u?.energy) || 0) > 0) return this._t(u, "loc.hint.default");
    return this._t(u, "loc.hint.default");
  }

  async show(user, introText = null, routeOverride = null) {
    const route = routeOverride || this._route || "Square";
    const lang = this._lang(user);
    const onboardingStage = user?.flags?.onboardingStep || "";

    // backTo храним в БД: уходим с Shop/Home — очищаем u.nav.backTo и сохраняем
    if (route !== "Shop" && route !== "Home" && route !== "Gym") {
      if (user?.nav?.backTo) {
        try {
          user.nav.backTo = null;
          if (this.users && typeof this.users.save === "function") {
            await this.users.save(user);
          }
        } catch {}
      }
    }

    const header = introText ? introText + "\n\n" : "";

    // ---------- Square ----------
    // Onboarding: single CTA for first job, then gym
    if (route === "Square" && user?.flags?.onboarding) {
      const goGym = onboardingStage === "go_gym";
      const kbOnboarding = [[{
        text: goGym ? this._t(user, "loc.onboarding.to_gym") : this._t(user, "loc.onboarding.start_first_shift"),
        callback_data: goGym ? "go:Gym" : "go:Work"
      }]];

      const caption = (header || "") + (goGym
        ? this._t(user, "loc.onboarding.caption_gym")
        : this._t(user, "loc.onboarding.caption_first_shift"));

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption,
        keyboard: kbOnboarding,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Square";
      return;
    }

    // ---------- Square (основной режим) ----------
    if (route === "Square") {
      const kbBase = this.ui.square(lang);
      const kb = (this.daily && this.daily.canClaim(user))
        ? [[{ text: this._t(user, "loc.daily_bonus"), callback_data: "daily:claim" }], ...kbBase]
        : kbBase;

      let yesterdayBlock = "";
      if (this.social && typeof this.social.getDailyWinnersSnapshot === "function") {
        try {
          const winners = await this.social.getDailyWinnersSnapshot();
          if (Array.isArray(winners) && winners.length) {
            const medals = ["🥇","🥈","🥉"];
            const nameCache = new Map();
            const resolveName = (w) => {
              const key = String(w?.userId ?? "");
              if (key && nameCache.has(key)) return nameCache.get(key);
              const fromSnap = (w && typeof w.name === "string" && w.name.trim()) ? w.name.trim() : "";
              if (fromSnap) {
                if (key) nameCache.set(key, fromSnap);
                return fromSnap;
              }
              const fallback = key
                ? this._t(user, "loc.square.player_fallback_id", { id: key.slice(-4).padStart(4, "0") })
                : this._t(user, "loc.square.player_fallback");
              if (key) nameCache.set(key, fallback);
              return fallback;
            };

            const lines = [this._t(user, "loc.square.yesterday_top")];
            for (const w of winners) {
              const mark = medals[(w?.place || 0) - 1] || `${w.place}.`;
              const name = resolveName(w);
              const earned = Math.max(0, Math.round(Number(w?.earned) || 0));
              const stars = Math.max(0, Number(w?.reward?.stars) || 0);
              const money = Math.max(0, Number(w?.reward?.money) || 0);
              const rewardParts = [];
              if (stars) rewardParts.push(`${stars}${CONFIG.PREMIUM?.emoji || "💎"}`);
              if (money) rewardParts.push(`$${money}`);
              const rewardText = rewardParts.length
                ? this._t(user, "loc.square.reward_received", { reward: rewardParts.join(" + ") })
                : "";
              lines.push(`${mark} ${name} — $${earned}${rewardText}`);
            }
            yesterdayBlock = lines.join("\n");
          }
        } catch {}
      }

      const captionBase =
        (header || "") +
        this._t(user, "loc.square.caption") + "\n" +
        this._getSquareHint(user);
      const captionSquare = yesterdayBlock ? `${captionBase}\n\n${yesterdayBlock}` : captionBase;

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: captionSquare,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Square";
      return;
    }

    if (route === "Earn")  {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (introText ? introText + "\n\n" : "") + this._t(user, "loc.earn.caption"),
        keyboard: this.ui.earn(lang),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Earn";
      return;
    }

    // ---------- Stocks ----------
    if (route === "Stocks") {
      let view = null;
      try {
        if (this.stocks && typeof this.stocks.buildMarketView === "function") {
          view = await this.stocks.buildMarketView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: this._t(user, "loc.stocks.unavailable"),
          keyboard: [[{ text: this._t(user, "ui.back.earn"), callback_data: "go:Earn" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Stocks",
        caption,
        keyboard: view.keyboard || [[{ text: this._t(user, "ui.back.earn"), callback_data: "go:Earn" }]],
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Stocks";
      return;
    }

    // ---------- Labour ----------
    if (route === "Labour") {
      let view = null;
      try {
        if (this.labour && typeof this.labour.buildMainView === "function") {
          view = await this.labour.buildMainView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: this._t(user, "loc.labour.unavailable"),
          keyboard: [[{ text: this._t(user, "ui.back.earn"), callback_data: "go:Earn" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        caption,
        keyboard: view.keyboard || [[{ text: this._t(user, "ui.back.earn"), callback_data: "go:Earn" }]],
        policy: "auto"
      });
      this._sourceMsg = null;
      this._route = "Labour";
      return;
    }


    // ---------- Progress ----------
    if (route === "Progress") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + this._t(user, "loc.progress.caption"),
        keyboard: this.ui.progress(lang),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Progress";
      // Keep onboarding active when viewing Progress; it ends after first job start
      return;
    }
    // ---------- City ----------
    if (route === "City") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + this._t(user, "loc.city.caption"),
        keyboard: this.ui.city(lang),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "City";
      return;
    }
    // ---------- Clan ----------
    if (route === "Clan") {
      let view = null;
      try {
        if (this.clans && typeof this.clans.buildMainView === "function") {
          view = await this.clans.buildMainView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: this._t(user, "loc.clan.unavailable"),
          keyboard: [[{ text: this._t(user, "ui.back.default"), callback_data: "go:City" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Clan",
        caption,
        keyboard: view.keyboard || [[{ text: this._t(user, "ui.back.default"), callback_data: "go:City" }]],
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Clan";
      return;
    }
    // ---------- Referral ----------
    if (route === "Referral") {
      let view = null;
      try {
        if (this.referrals && typeof this.referrals.buildView === "function") {
          view = await this.referrals.buildView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: this._t(user, "loc.referral.unavailable"),
          keyboard: [[{ text: this._t(user, "ui.back.default"), callback_data: "go:City" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "CityBoard",
        caption,
        keyboard: view.keyboard || [[{ text: this._t(user, "ui.back.default"), callback_data: "go:City" }]],
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Referral";
      return;
    }
    // ---------- CityBoard ----------
    if (route === "CityBoard") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "CityBoard", 
        caption: header + this._t(user, "loc.cityboard.caption"),
        keyboard: this.ui.cityBoard(lang),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "CityBoard";
      return;
    }
    // ---------- ShopHub ----------
    if (route === "ShopHub") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + this._t(user, "loc.shophub.caption"),
        keyboard: this.ui.shopHub(lang),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "ShopHub";
      return;
    }

    // ---------- MiniGames ----------
    if (route === "MiniGames") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + this._t(user, "loc.minigames.caption"),
        keyboard: this.ui.miniGames(lang),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "MiniGames";
      return;
    }


    // ---------- Work ----------
    // Онбординг: первое открытие списка заданий
    if (route === "Work" && user?.flags?.onboarding && !(user.jobs?.active?.[0])) {
      if (onboardingStage === "go_gym") {
        const kbGym = [[{ text: this._t(user, "loc.onboarding.to_gym"), callback_data: "go:Gym" }]];
        const captionGym = (header || "") + this._t(user, "loc.work.onboarding_to_gym");
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          caption: captionGym,
          keyboard: kbGym,
          policy: "auto",
        });
        this._sourceMsg = null;
        this._route = "Work";
        return;
      }

      const kb = this.ui.workV2(user, {}, lang);
      const caption =
        (header || "") +
        this._t(user, "loc.work.onboarding_step1") + "\n\n" +
        this.formatters.balance(user) + "\n\n" +
        this._t(user, "loc.work.onboarding_hint");

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Work",
        caption,
        keyboard: kb,
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Work";
      return;
    }

    // ---------- Work (основной режим) ----------
    if (route === "Work") {
      const active = user.jobs?.active?.[0] || null;
      const onboarding = !!(user?.flags?.onboarding);

      if (active) {
        const leftMin = Math.max(0, Math.ceil((active.endAt - this.now()) / 60000));
        const ready = this.now() >= active.endAt;

        let ffCost = null;
        try {
          if (this.fastForward && !ready) {
            const q = this.fastForward.quote(user, "work");
            if (q?.ok) ffCost = q.cost;
          }
        } catch {}

        const typeId = active.typeId;
        const fileId = JOB_ASSETS[typeId] || ASSETS.WorkDefault;
        const activeTitle = getJobTitle(typeId, lang) || active.title || this._t(user, "loc.work.shift_fallback");

        const caption = ready
          ? this._t(user, "loc.work.active_ready", { title: activeTitle, pay: active.plannedPay })
          : this._t(user, "loc.work.active_running", { title: activeTitle, mins: leftMin }) + "\n\n" +
            this._t(user, "loc.work.active_tip") + "\n\n" +
            this.formatters.balance(user);

        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          asset: fileId,
          caption,
          keyboard: this.ui.workV2(user, { active, ready, ffCost }, lang),
          policy: "photo",
        });
      } else {
        const perks = this.formatters.workPerks(user, { hints: true });
        const caption =
          (header || "") +
          this._t(user, "loc.work.caption_intro") + "\n\n" +
          this.formatters.balance(user) + "\n\n" +
          this._t(user, "loc.work.bonuses") + "\n" + perks;

        const kb = this.ui.workV2(user, {}, lang);

        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          caption,
          keyboard: kb,
          policy: "photo",
        });
      }

      this._sourceMsg = null;
      this._route = "Work";
      return;
    }

    // ---------- Study ----------
    if (route === "Study") {
      if (!user.displayName || !String(user.displayName).trim()) {
        // помечаем ожидание ника и куда вернуться после него
        if (this.users && typeof this.users.save === "function") {
          user.awaitingName = true;
          user.afterNameRoute = "go:Study";
          await this.users.save(user);
        }

        // показываем тот же промпт ника, что и в табло
        const ns = new NameService({ users: this.users });
        await ns.prompt(async (text, extra) => {
          await this.media.show({
            sourceMsg: this._sourceMsg,
            place: "Study",
            caption: text,
            keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: this._t(user, "ui.back.square"), callback_data: "go:Square" }]],
            policy: "photo",
          });
          this.setSourceMessage(null);
        });
        this._route = "Study";
        return;
      }

      if (user.study?.active) {
        const startAt = user.study.startAt || 0;
        const endAt   = user.study.endAt   || 1;
        const now     = this.now();
        const elapsed  = Math.max(0, now - startAt);
        const need     = Math.max(1, endAt - startAt);
        const progress = Math.min(100, this.pct(elapsed, need));
        const ready    = now >= endAt;
        
        let ffCost = null;
        try {
          if (this.fastForward && !ready) {           // цену FF считаем только если НЕ готово
            const q = this.fastForward.quote(user, "study");
            if (q?.ok) ffCost = q.cost;
          }
        } catch {}
        
        const leftMin = Math.max(1, Math.ceil((endAt - now) / 60000));
        const studyAsset = CONFIG?.ASSETS?.StudyActive || CONFIG?.ASSETS?.Study;
        
        const title = ready
          ? this._t(user, "loc.study.ready_title")
          : this._t(user, "loc.study.active_title", { mins: leftMin });
        
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Study",
          asset: studyAsset,
          caption:
            title +
            "\n\n" + this.formatters.balance(user) +
            "\n" + this.formatters.studyLine(user),
          keyboard: this.ui.studyActive(progress, { ready, ffCost }, lang),
          policy: "photo",
        });
      } else {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Study",
          caption: header +
            this._t(user, "loc.study.caption_intro") + "\n\n" +
            this.formatters.balance(user) + "\n" + this.formatters.studyLine(user),
          keyboard: this.ui.studyIdle(this.economy.fmtStudyEffects(user), lang),
          policy: "auto",
        });
      }
      this._sourceMsg = null;
      this._route = "Study";
      return;
    }

    // ---------- Home ----------
    if (route === "Home") {
      const backTo = (user?.nav?.backTo || null) || "City";
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Home",
        caption: this._t(user, "loc.home.caption")
        + "\n\n" + this._t(user, "loc.home.hint")
        + "\n\n" + this.formatters.balance(user),
        keyboard: this.ui.home(user, { backTo }, lang),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Home";
      return;
    }

    // ---------- Shop ----------
    if (route === "Shop") {
      const backToShop = (user?.nav?.backTo || null) || "ShopHub";
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Shop",
        caption: header + this._t(user, "loc.shop.caption") + "\n\n" + this.formatters.balance(user),
        keyboard: this.ui.shop({ backTo: backToShop }, lang),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Shop";
      return;
    }

    // ---------- Casino ----------
    if (route === "Casino") {
      const minStudy = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
      const studyLevel = Math.max(0, Number(user?.study?.level) || 0);
      const paidLocked = studyLevel < minStudy;

      const today = new Date().toISOString().slice(0,10);
      const spinsToday = (user.casino?.day === today) ? (user.casino?.spins || 0) : 0;
      const freeUsedToday = (user.casino?.free?.day === today);
      const freeLine = freeUsedToday ? this._t(user, "loc.casino.free_tomorrow") : this._t(user, "loc.casino.free_today");
      const statusLine = this._t(user, "loc.casino.status_line", { spins: spinsToday, limit: CONFIG.CASINO.daily_limit });
      const lastPrizeLine = (user.casino?.free?.lastPrize ?? null) != null
        ? `\n${this._t(user, "loc.casino.last_free_prize", { prize: user.casino.free.lastPrize || 0 })}`
        : "";

      // Казино (день+неделя); если форматтера нет — просто пустая строка
      const statsLines =
        typeof this.formatters?.casinoStatsLines === "function"
          ? this.formatters.casinoStatsLines(user)
          : "";

      const bestLine =
        typeof this.formatters?.casinoBestLine === "function"
          ? this.formatters.casinoBestLine(user)
          : "";

      let casinoKb = this.ui.casinoMenu(user, lang);
      if (!freeUsedToday) {
        casinoKb = [[{ text: this._t(user, "loc.casino.free_btn"), callback_data: "casino_free" }], ...casinoKb];
      }

      const captionCore =
        this._t(user, "loc.casino.caption_intro") + "\n\n" +
        `${freeLine}\n${statusLine}${lastPrizeLine}`;
      const captionWithStats = statsLines ? `${captionCore}\n\n${statsLines}` : captionCore;
      const captionWithLocks = paidLocked
        ? `${captionWithStats}\n\n${this._t(user, "loc.casino.locked_more", { level: minStudy })}`
        : captionWithStats;
      const captionStatsBest = bestLine ? `${captionWithLocks}\n${bestLine}` : captionWithLocks;
      const finalCaption = `${captionStatsBest}\n\n${this.formatters.moneyLine(user)}`;

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Casino",
        caption: finalCaption,
        keyboard: casinoKb,
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Casino";
      return;
    }

    // ---------- Bar ----------
    if (route === "Bar") {
      const barmanQuote = BarService.getBarmanQuote(user, this.now());
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Bar",
        caption:
          this._t(user, "loc.bar.caption_intro") + "\n\n" +
          `${barmanQuote}\n\n` +
          this.formatters.balance(user),
        keyboard: this.ui.bar(user, this.now(), lang),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Bar";
      return;
    }

    // ---------- Gym ----------
    if (route === "Gym") {
      if (user?.flags?.onboarding && onboardingStage === "go_gym") {
        user.flags.onboarding = false;
        user.flags.onboardingStep = "done";
        try { if (this.users && typeof this.users.save === "function") { await this.users.save(user); } } catch {}
      }

      let ffCost = null;
      try {
        if (this.fastForward && user?.gym?.active) {
          const q = this.fastForward.quote(user, "gym");
          if (q?.ok) ffCost = q.cost;
        }
      } catch {}

      let kb = this.ui.gym(user, this.now(), ffCost, lang);
      try {
        const backToGym = (user?.nav?.backTo || null) || "Progress";
        const backText =
          backToGym === "Work"  ? this._t(user, "loc.gym.back_work") :
          backToGym === "Study" ? this._t(user, "loc.gym.back_study") :
          this._t(user, "ui.back.default");
        const backCb = "go:" + (backToGym === "Gym" ? "Progress" : backToGym);
        if (Array.isArray(kb) && kb.length > 0) {
          kb[kb.length - 1] = [{ text: backText, callback_data: backCb }];
        }
      } catch {}

      let defaultTitle;
      if (user?.gym?.active) {
        const now = this.now();
        const end = user.gym.endAt || 0;
        if (now >= end) {
          defaultTitle = this._t(user, "loc.gym.ready_title");
        } else {
          const leftMin = Math.max(1, Math.ceil((end - now) / 60000));
          defaultTitle = this._t(user, "loc.gym.active_title", { mins: leftMin });
        }
      } else {
        defaultTitle = this._t(user, "loc.gym.caption_intro");
      }
      
      const titleOrHeader = (introText && introText.trim()) ? introText.trim() : defaultTitle;

      if (user?.gym?.active) {
        const gymActiveAsset = (CONFIG.ASSETS?.GymActive || CONFIG.ASSETS?.Gym);
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Gym",
          asset: gymActiveAsset,
          caption: titleOrHeader + "\n\n" + this.formatters.balance(user),
          keyboard: kb,
          policy: "photo",
        });
      } else {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Gym",
          caption: titleOrHeader + "\n\n" + this.formatters.balance(user),
          keyboard: kb,
          policy: "auto",
        });
      }

      this._sourceMsg = null;
      this._route = "Gym";
      return;
    }

    // ---------- Upgrades ----------
    if (route === "Upgrades") {
      const caption = this.ui.upgradesCaption(user, lang);
      const kbRows  = this.ui.upgrades(user, lang);

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Upgrades",
        caption: caption + "\n\n" + this.formatters.balance(user),
        keyboard: kbRows,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Upgrades";
      return;
    }

    // ---------- BarTasks ----------
    if (route === "BarTasks") {
      const title = this._t(user, "loc.bartasks.title");
      const tasks = Array.isArray(user?.bar?.tasks) ? user.bar.tasks : [];
      const hasTasks = tasks.length > 0;
      const allClaimed = hasTasks && tasks.every(t => t?.status === "claimed");

      let caption = title;
      if (!hasTasks) {
        caption = `${title}\n\n${this._t(user, "loc.bartasks.empty")}`;
      } else if (allClaimed) {
        caption = `${title}\n\n${this._t(user, "loc.bartasks.done")}`;
      }

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Bar",
        caption,
        keyboard: this.ui.barTasks(user, lang),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "BarTasks";
      return;
    }

    // ---------- Business (i18n-first) ----------
    {
      const bizRouteMeta = {
        Biz_shawarma: {
          id: "shawarma",
          asset: ASSETS?.BusinessShawarma || JOB_ASSETS?.shawarma_seller || ASSETS?.Business,
        },
        Biz_stomatology: {
          id: "stomatology",
          asset: ASSETS?.BusinessStomatology || JOB_ASSETS?.dentist || ASSETS?.Business,
        },
        Biz_restaurant: {
          id: "restaurant",
          asset: ASSETS?.BusinessRestaurant || JOB_ASSETS?.waiter || ASSETS?.Business,
        },
        Biz_courier_service: {
          id: "courier_service",
          asset: ASSETS?.BusinessCourier || JOB_ASSETS?.courier || ASSETS?.Business,
        },
        Biz_fitness_club: {
          id: "fitness_club",
          asset: ASSETS?.BusinessFitness || ASSETS?.Gym || ASSETS?.Business,
        },
      };

      const renderBusinessCard = async (B, options = {}) => {
        const opts = options || {};
        if (!B) {
          await this.media.show({
            sourceMsg: this._sourceMsg,
            place: "Business",
            caption: (header || "") + this._t(user, "loc.business.unavailable"),
            keyboard: [[{ text: this._t(user, "loc.business.btn.back"), callback_data: "go:Business" }]],
            policy: "auto",
          });
          this._sourceMsg = null;
          this._route = "Business";
          return;
        }

        const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
        const ownedObj = ownedArr.find((it) => (typeof it === "string" ? it === B.id : it?.id === B.id));
        const isOwned = !!ownedObj;
        const todayUTC = new Date().toISOString().slice(0, 10);
        const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
        const availableToday = isOwned && !claimedToday ? (Number(B.daily) || 0) : 0;
        const bizTitle = getBusinessTitle(B.id, lang) || B.title;
        const bizNote = getBusinessNote(B.id, lang) || B.note;

        const statusLine = !isOwned
          ? this._t(user, "loc.business.status_unowned")
          : (claimedToday
              ? this._t(user, "loc.business.status_claimed_today")
              : this._t(user, "loc.business.status_available_today", { amount: availableToday }));

        const kb = [];
        if (!isOwned) {
          kb.push([{ text: this._t(user, "loc.business.btn.buy_for", { price: B.price }), callback_data: `biz:buy:${B.id}` }]);
        } else if (!claimedToday) {
          const claimKey = opts.claimKey || "loc.business.btn.claim";
          kb.push([{ text: this._t(user, claimKey, { amount: B.daily }), callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: this._t(user, "loc.business.btn.claimed_today"), callback_data: "noop" }]);
        }

        if (opts.showBackToBusinesses) {
          kb.push([{ text: this._t(user, "loc.business.btn.back_businesses"), callback_data: "go:Business" }]);
        }
        kb.push([{ text: this._t(user, "loc.business.btn.back_earn"), callback_data: "go:Earn" }]);

        const intro = opts.includeIntro ? this._t(user, "loc.business.caption_intro") + "\n\n" : "";
        const modeLine = opts.useManualClaim
          ? this._t(user, "loc.business.manual_claim")
          : this._t(user, "loc.business.no_accumulation");

        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Business",
          asset: opts.asset || ASSETS?.Business,
          caption:
            (header || "") +
            intro +
            `${B.emoji} ${bizTitle}\n` +
            this._t(user, "loc.business.price", { price: B.price }) + "\n" +
            this._t(user, "loc.business.daily_income", { daily: B.daily }) + "\n" +
            modeLine + "\n" +
            statusLine +
            (bizNote ? `\n\nℹ️ ${bizNote}` : ""),
          keyboard: kb,
          policy: "photo",
        });
        this._sourceMsg = null;
        this._route = opts.routeName || "Business";
      };

      if (route === "Business") {
        const items = Object.values(CONFIG?.BUSINESS || {}).filter(Boolean);
        if (items.length > 1) {
          const caption =
            (header || "") +
            this._t(user, "loc.business.caption_intro") +
            "\n\n" +
            this._t(user, "loc.business.choose");
          const kb = items.map((B) => [{
            text: `${B.emoji} ${getBusinessTitle(B.id, lang) || B.title}`,
            callback_data: `go:Biz_${B.id}`,
          }]);
          kb.push([{ text: this._t(user, "loc.business.btn.back_earn"), callback_data: "go:Earn" }]);
          await this.media.show({
            sourceMsg: this._sourceMsg,
            place: "Business",
            caption,
            keyboard: kb,
            policy: "photo",
          });
          this._sourceMsg = null;
          this._route = "Business";
          return;
        }

        const B = items[0] || CONFIG?.BUSINESS?.shawarma;
        await renderBusinessCard(B, {
          includeIntro: true,
          useManualClaim: true,
          claimKey: "loc.business.btn.claim_today",
        });
        return;
      }

      if (route.startsWith("Biz_")) {
        const bizId = String(route.slice(4) || "").trim();
        const B = CONFIG?.BUSINESS?.[bizId] || null;
        const meta = Object.values(bizRouteMeta).find((it) => it.id === bizId);
        await renderBusinessCard(B, {
          routeName: route,
          asset: meta?.asset || ASSETS?.Business,
          showBackToBusinesses: true,
          useManualClaim: false,
        });
        return;
      }
    }

    // ---------- Fallback → Square ----------
    let kb = this.ui.square(lang);
    if (this.daily && this.daily.canClaim(user)) {
      kb = [[{ text: this._t(user, "loc.daily_bonus"), callback_data: "daily:claim" }], ...kb];
    }
    await this.media.show({
      sourceMsg: this._sourceMsg,
      place: "Square",
      caption: header + this._t(user, "loc.square.fallback"),
      keyboard: kb,
      policy: "photo",
    });
    this._sourceMsg = null;
    this._route = "Square";
  }
}
