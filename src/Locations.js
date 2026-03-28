import { CONFIG } from "./GameConfig.js";
import { ASSETS, JOB_ASSETS } from "./Assets.js";
import { normalizeLang, t } from "./i18n/index.js";
import { getJobTitle } from "./I18nCatalog.js";
import { Routes, toGoCallback } from "./Routes.js";
import { safeCall } from "./SafeCall.js";
import { clearBackToIfNeeded, renderFallbackSquareRoute, renderSquareRoute } from "./locations/routes/squareRoutes.js";
import { renderStudyRoute } from "./locations/routes/studyRoute.js";
import {
  renderBarRoute,
  renderBarTasksRoute,
  renderCasinoRoute,
  renderCityBoardRoute,
  renderGymRoute,
  renderHomeRoute,
  renderShopRoute,
  renderUpgradesRoute
} from "./locations/routes/coreSimpleRoutes.js";
import { renderBusinessRoute } from "./locations/routes/businessRoute.js";

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
   *  farm?:any,
   *  pet?:any,
   *  ratings?:any,
   *  thief?:any,
   *  referrals?:any,
   *  quests?:any
   * }} deps
   */
  constructor({ media, ui, economy, formatters, pct, now, maybeFinishStudy, daily, fastForward, users, social, clans, stocks, labour, farm, pet, ratings, thief, referrals, quests }) {
    this.media = media;
    this.ui = ui;
    this.economy = economy;
    this.formatters = formatters;
    this.pct = pct;
    this.now = now;
    this.maybeFinishStudy = maybeFinishStudy;
    this.daily = daily;
    this.fastForward = fastForward || null;
    this.users = users || null; // в†ђ РїРѕРЅР°РґРѕР±РёС‚СЃСЏ РґР»СЏ await users.save(u)
    this.social = social || null;
    this.clans = clans || null;
    this.stocks = stocks || null;
    this.labour = labour || null;
    this.farm = farm || null;
    this.pet = pet || null;
    this.ratings = ratings || null;
    this.thief = thief || null;
    this.referrals = referrals || null;
    this.quests = quests || null;


    this._sourceMsg = null;
    this._route = Routes.SQUARE;
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

  _hasStocksClanAccess(user) {
    const clanId = String(user?.clan?.clanId || "").trim();
    if (clanId) return true;
    const joinPenalty = String(user?.clan?.joinAvailableFromWeek || "").trim();
    return !!joinPenalty;
  }

  async _renderServiceRoute({
    user,
    header = "",
    routeName,
    place,
    policy = "auto",
    buildView,
    fallbackCaptionKey,
    fallbackBackTextKey,
    fallbackBackCb
  }) {
    let view = await safeCall("locations.service.build_view", async () => {
      if (typeof buildView === "function") {
        return await buildView();
      }
      return null;
    }, { fallback: null });

    if (!view) {
      view = {
        caption: this._t(user, fallbackCaptionKey),
        keyboard: [[{ text: this._t(user, fallbackBackTextKey), callback_data: fallbackBackCb }]]
      };
    }

    const caption = (header || "") + (view.caption || "");
    await this.media.show({
      sourceMsg: this._sourceMsg,
      place,
      caption,
      keyboard: view.keyboard || [[{ text: this._t(user, fallbackBackTextKey), callback_data: fallbackBackCb }]],
      asset: view.asset || undefined,
      policy,
    });
    this._sourceMsg = null;
    this._route = routeName;
  }

  async _renderStaticRoute({
    routeName,
    place,
    caption,
    keyboard,
    policy = "auto"
  }) {
    await this.media.show({
      sourceMsg: this._sourceMsg,
      place,
      caption,
      keyboard,
      policy,
    });
    this._sourceMsg = null;
    this._route = routeName;
  }

  _buildServiceRouteRegistry(user, header) {
    return {
      [Routes.STOCKS]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.STOCKS,
        place: Routes.STOCKS,
        policy: "auto",
        buildView: async () => {
          if (!this._hasStocksClanAccess(user)) {
            return {
              caption: this._t(user, "loc.stocks.clan_required"),
              keyboard: [
                [{ text: this._t(user, "ui.city.clans"), callback_data: toGoCallback(Routes.CLAN) }],
                [{ text: this._t(user, "ui.back.earn"), callback_data: toGoCallback(Routes.EARN) }]
              ]
            };
          }
          if (this.stocks && typeof this.stocks.buildMarketView === "function") {
            return this.stocks.buildMarketView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.stocks.unavailable",
        fallbackBackTextKey: "ui.back.earn",
        fallbackBackCb: toGoCallback(Routes.EARN)
      }),

      [Routes.LABOUR]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.LABOUR,
        place: Routes.LABOUR,
        policy: "auto",
        buildView: async () => {
          if (this.labour && typeof this.labour.buildMainView === "function") {
            return this.labour.buildMainView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.labour.unavailable",
        fallbackBackTextKey: "ui.back.earn",
        fallbackBackCb: toGoCallback(Routes.EARN)
      }),
      [Routes.FARM]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.FARM,
        place: Routes.FARM,
        policy: "auto",
        buildView: async () => {
          if (this.farm && typeof this.farm.buildMainView === "function") {
            return this.farm.buildMainView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.farm.unavailable",
        fallbackBackTextKey: "ui.back.earn",
        fallbackBackCb: toGoCallback(Routes.EARN)
      }),
      [Routes.PET]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.PET,
        place: Routes.HOME,
        policy: "auto",
        buildView: async () => {
          if (this.pet && typeof this.pet.buildView === "function") {
            return this.pet.buildView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.home.caption",
        fallbackBackTextKey: "ui.back.default",
        fallbackBackCb: toGoCallback(Routes.HOME)
      }),

      [Routes.CLAN]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.CLAN,
        place: Routes.CLAN,
        policy: "auto",
        buildView: async () => {
          if (this.clans && typeof this.clans.buildMainView === "function") {
            return this.clans.buildMainView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.clan.unavailable",
        fallbackBackTextKey: "ui.back.default",
        fallbackBackCb: toGoCallback(Routes.CITY)
      }),
      [Routes.RATINGS]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.RATINGS,
        place: Routes.CITY_BOARD,
        policy: "auto",
        buildView: async () => {
          if (this.ratings && typeof this.ratings.buildView === "function") {
            return this.ratings.buildView(user, "biz");
          }
          return null;
        },
        fallbackCaptionKey: "loc.rating.unavailable",
        fallbackBackTextKey: "ui.back.default",
        fallbackBackCb: toGoCallback(Routes.CITY)
      }),

      [Routes.THIEF]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.THIEF,
        place: Routes.THIEF,
        policy: "auto",
        buildView: async () => {
          if (this.thief && typeof this.thief.buildMainView === "function") {
            return this.thief.buildMainView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.thief.unavailable",
        fallbackBackTextKey: "ui.back.default",
        fallbackBackCb: toGoCallback(Routes.CITY)
      }),

      [Routes.REFERRAL]: async () => this._renderServiceRoute({
        user,
        header,
        routeName: Routes.REFERRAL,
        place: Routes.CITY_BOARD,
        policy: "auto",
        buildView: async () => {
          if (this.referrals && typeof this.referrals.buildView === "function") {
            return this.referrals.buildView(user);
          }
          return null;
        },
        fallbackCaptionKey: "loc.referral.unavailable",
        fallbackBackTextKey: "ui.back.default",
        fallbackBackCb: toGoCallback(Routes.CITY)
      })
    };
  }

  _buildStaticRouteRegistry(user, header, lang) {
    return {
      [Routes.EARN]: async () => this._renderStaticRoute({
        routeName: Routes.EARN,
        place: Routes.SQUARE,
        caption: (header || "") + this._t(user, "loc.earn.caption"),
        keyboard: this.ui.earn(lang),
        policy: "photo",
      }),

      [Routes.PROGRESS]: async () => this._renderStaticRoute({
        routeName: Routes.PROGRESS,
        place: Routes.SQUARE,
        caption: (header || "") + this._t(user, "loc.progress.caption"),
        keyboard: this.ui.progress(lang),
        policy: "photo",
      }),

      [Routes.CITY]: async () => this._renderStaticRoute({
        routeName: Routes.CITY,
        place: Routes.SQUARE,
        caption: (header || "") + this._t(user, "loc.city.caption"),
        keyboard: this.ui.city(lang),
        policy: "photo",
      }),

      [Routes.SHOP_HUB]: async () => this._renderStaticRoute({
        routeName: Routes.SHOP_HUB,
        place: Routes.SQUARE,
        caption: (header || "") + this._t(user, "loc.shophub.caption"),
        keyboard: this.ui.shopHub(lang),
        policy: "photo",
      }),

      [Routes.MINI_GAMES]: async () => this._renderStaticRoute({
        routeName: Routes.MINI_GAMES,
        place: Routes.SQUARE,
        caption: (header || "") + this._t(user, "loc.minigames.caption"),
        keyboard: this.ui.miniGames(lang),
        policy: "photo",
      })
    };
  }

  async _renderWorkRoute(user, { header = "", lang = "ru", onboardingStage = "" } = {}) {
    // Onboarding: first open of jobs list
    if (user?.flags?.onboarding && !(user.jobs?.active?.[0])) {
      if (onboardingStage === "go_gym" || onboardingStage === "gym_started") {
        const kbGym = [[{ text: this._t(user, "loc.onboarding.to_gym"), callback_data: toGoCallback(Routes.GYM) }]];
        const captionGym = (header || "") + this._t(user, "loc.work.onboarding_to_gym");
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: Routes.WORK,
          caption: captionGym,
          keyboard: kbGym,
          policy: "auto",
        });
        this._sourceMsg = null;
        this._route = Routes.WORK;
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
        place: Routes.WORK,
        caption,
        keyboard: kb,
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = Routes.WORK;
      return;
    }

    // Work main mode
    const active = user.jobs?.active?.[0] || null;
    const onboarding = !!(user?.flags?.onboarding);

    if (active) {
      const leftMin = Math.max(0, Math.ceil((active.endAt - this.now()) / 60000));
      const ready = this.now() >= active.endAt;

      const ffCost = await safeCall("locations.work.ff_quote", async () => {
        const shouldQuotePaidSkip = !onboarding || onboardingStage !== "job_claim";
        if (this.fastForward && !ready && shouldQuotePaidSkip) {
          const q = this.fastForward.quote(user, "work");
          if (q?.ok) return q.cost;
        }
        return null;
      }, { fallback: null });

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
        place: Routes.WORK,
        asset: fileId,
        caption,
        keyboard: this.ui.workV2(user, { active, ready, ffCost, onboardingStep: onboardingStage }, lang),
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
        place: Routes.WORK,
        caption,
        keyboard: kb,
        policy: "photo",
      });
    }

    this._sourceMsg = null;
    this._route = Routes.WORK;
  }

  _buildCoreRouteRegistry(user, { header = "", lang = "ru", onboardingStage = "", introText = null } = {}) {
    return {
      [Routes.SQUARE]: async () => this._renderSquareRoute(user, { header, lang, onboardingStage }),
      [Routes.WORK]: async () => this._renderWorkRoute(user, { header, lang, onboardingStage }),
      [Routes.CITY_BOARD]: async () => this._renderCityBoardRoute(user, { header, lang }),
      [Routes.STUDY]: async () => this._renderStudyRoute(user, { header, lang }),
      [Routes.HOME]: async () => this._renderHomeRoute(user, { lang }),
      [Routes.SHOP]: async () => this._renderShopRoute(user, { header, lang }),
      [Routes.CASINO]: async () => this._renderCasinoRoute(user, { lang }),
      [Routes.BAR]: async () => this._renderBarRoute(user, { lang }),
      [Routes.GYM]: async () => this._renderGymRoute(user, { introText, lang, onboardingStage }),
      [Routes.UPGRADES]: async () => this._renderUpgradesRoute(user, { lang }),
      [Routes.BAR_TASKS]: async () => this._renderBarTasksRoute(user, { lang }),
      [Routes.BUSINESS]: async () => this._renderBusinessRoute(user, { header, lang, route: Routes.BUSINESS }),
    };
  }

  async _clearBackToIfNeeded(user, route) {
    return clearBackToIfNeeded(this, user, route);
  }

  async _renderSquareRoute(user, opts = {}) {
    return renderSquareRoute(this, user, opts);
  }

  async _renderCityBoardRoute(user, opts = {}) {
    return renderCityBoardRoute(this, user, opts);
  }

  async _renderStudyRoute(user, opts = {}) {
    return renderStudyRoute(this, user, opts);
  }

  async _renderHomeRoute(user, opts = {}) {
    return renderHomeRoute(this, user, opts);
  }

  async _renderShopRoute(user, opts = {}) {
    return renderShopRoute(this, user, opts);
  }

  async _renderCasinoRoute(user, opts = {}) {
    return renderCasinoRoute(this, user, opts);
  }

  async _renderBarRoute(user, opts = {}) {
    return renderBarRoute(this, user, opts);
  }

  async _renderGymRoute(user, opts = {}) {
    return renderGymRoute(this, user, opts);
  }

  async _renderUpgradesRoute(user, opts = {}) {
    return renderUpgradesRoute(this, user, opts);
  }

  async _renderBarTasksRoute(user, opts = {}) {
    return renderBarTasksRoute(this, user, opts);
  }

  async _renderBusinessRoute(user, opts = {}) {
    return renderBusinessRoute(this, user, opts);
  }

  async _renderFallbackSquareRoute(user, opts = {}) {
    return renderFallbackSquareRoute(this, user, opts);
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
    const route = routeOverride || this._route || Routes.SQUARE;
    const lang = this._lang(user);
    const onboardingStage = user?.flags?.onboardingStep || "";

    await this._clearBackToIfNeeded(user, route);

    const header = introText ? introText + "\n\n" : "";
    const serviceRoutes = this._buildServiceRouteRegistry(user, header);
    if (serviceRoutes[route]) {
      await serviceRoutes[route]();
      return;
    }

    const staticRoutes = this._buildStaticRouteRegistry(user, header, lang);
    if (staticRoutes[route]) {
      await staticRoutes[route]();
      return;
    }

    const coreRoutes = this._buildCoreRouteRegistry(user, { header, lang, onboardingStage, introText });
    if (coreRoutes[route]) {
      await coreRoutes[route]();
      return;
    }

    if (typeof route === "string" && route.startsWith("Biz_")) {
      const handled = await this._renderBusinessRoute(user, { header, lang, route });
      if (handled) return;
    }

    await this._renderFallbackSquareRoute(user, { header, lang });
  }
}
