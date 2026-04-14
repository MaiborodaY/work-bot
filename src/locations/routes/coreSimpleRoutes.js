import { CONFIG } from "../../GameConfig.js";
import { BarService } from "../../BarService.js";
import { Routes, toGoCallback } from "../../Routes.js";
import { EnergyService } from "../../EnergyService.js";

export async function renderCityBoardRoute(ctx, user, { header = "", lang = "ru" } = {}) {
  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.CITY_BOARD,
    caption: header + ctx._t(user, "loc.cityboard.caption"),
    keyboard: ctx.ui.cityBoard(lang),
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.CITY_BOARD;
}

export async function renderHomeRoute(ctx, user, { lang = "ru" } = {}) {
  const backTo = (user?.nav?.backTo || null) || Routes.CITY;
  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.HOME,
    caption: ctx._t(user, "loc.home.caption")
      + "\n\n" + ctx._t(user, "loc.home.hint")
      + "\n\n" + ctx.formatters.balance(user),
    keyboard: ctx.ui.home(user, { backTo }, lang),
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.HOME;
}

export async function renderShopRoute(ctx, user, { header = "", lang = "ru" } = {}) {
  const backToShop = (user?.nav?.backTo || null) || Routes.SHOP_HUB;
  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.SHOP,
    caption: header + ctx._t(user, "loc.shop.caption") + "\n\n" + ctx.formatters.balance(user),
    keyboard: ctx.ui.shop({ backTo: backToShop }, lang),
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.SHOP;
}

export async function renderCasinoRoute(ctx, user, { lang = "ru" } = {}) {
  const minStudy = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
  const studyLevel = Math.max(0, Number(user?.study?.level) || 0);
  if (studyLevel < minStudy) {
    const finalCaption =
      `${ctx._t(user, "loc.casino.locked_gate", { level: minStudy })}\n\n${ctx.formatters.moneyLine(user)}`;
    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.CASINO,
      caption: finalCaption,
      keyboard: [[{ text: ctx._t(user, "ui.casino.to_bar"), callback_data: "go:Bar" }]],
      policy: "auto",
    });
    ctx._sourceMsg = null;
    ctx._route = Routes.CASINO;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const spinsToday = (user.casino?.day === today) ? (user.casino?.spins || 0) : 0;
  const statusLine = ctx._t(user, "loc.casino.status_line", { spins: spinsToday, limit: CONFIG.CASINO.daily_limit });
  const statsLines =
    typeof ctx.formatters?.casinoStatsLines === "function"
      ? ctx.formatters.casinoStatsLines(user)
      : "";

  const bestLine =
    typeof ctx.formatters?.casinoBestLine === "function"
      ? ctx.formatters.casinoBestLine(user)
      : "";

  const casinoKb = ctx.ui.casinoMenu(user, lang);

  const captionCore =
    ctx._t(user, "loc.casino.caption_intro") + "\n\n" +
    `${statusLine}`;
  const captionWithStats = statsLines ? `${captionCore}\n\n${statsLines}` : captionCore;
  const captionStatsBest = bestLine ? `${captionWithStats}\n${bestLine}` : captionWithStats;
  const finalCaption = `${captionStatsBest}\n\n${ctx.formatters.moneyLine(user)}`;

  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.CASINO,
    caption: finalCaption,
    keyboard: casinoKb,
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.CASINO;
}

export async function renderBarRoute(ctx, user, { lang = "ru" } = {}) {
  const barmanQuote = BarService.getBarmanQuote(user, ctx.now());
  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.BAR,
    caption:
      ctx._t(user, "loc.bar.caption_intro") + "\n\n" +
      `${barmanQuote}\n\n` +
      ctx.formatters.balance(user),
    keyboard: ctx.ui.bar(user, ctx.now(), lang),
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.BAR;
}

export async function renderGymRoute(ctx, user, { introText = null, lang = "ru", onboardingStage = "" } = {}) {
  let ffCost = null;
  try {
    const shouldQuotePaidSkip = !(user?.flags?.onboarding && onboardingStage === "gym_started");
    if (ctx.fastForward && user?.gym?.active && shouldQuotePaidSkip) {
      const q = ctx.fastForward.quote(user, "gym");
      if (q?.ok) ffCost = q.cost;
    }
  } catch {}

  let kb = ctx.ui.gym(user, ctx.now(), ffCost, lang);
  try {
    const backToGym = (user?.nav?.backTo || null) || Routes.PROGRESS;
    const backText =
      backToGym === Routes.WORK ? ctx._t(user, "loc.gym.back_work") :
      backToGym === Routes.STUDY ? ctx._t(user, "loc.gym.back_study") :
      ctx._t(user, "ui.back.default");
    const backCb = toGoCallback(backToGym === Routes.GYM ? Routes.PROGRESS : backToGym);
    if (Array.isArray(kb) && kb.length > 0) {
      kb[kb.length - 1] = [{ text: backText, callback_data: backCb }];
    }
  } catch {}

  let defaultTitle;
  if (user?.gym?.active) {
    const now = ctx.now();
    const end = user.gym.endAt || 0;
    if (now >= end) {
      defaultTitle = ctx._t(user, "loc.gym.ready_title");
    } else {
      const leftMin = Math.max(1, Math.ceil((end - now) / 60000));
      defaultTitle = ctx._t(user, "loc.gym.active_title", { mins: leftMin });
    }
  } else {
    defaultTitle = user?.flags?.onboarding
      ? ctx._t(user, "loc.gym.caption_intro_onboarding")
      : ctx._t(user, "loc.gym.caption_intro");
  }

  const titleOrHeader = (introText && introText.trim()) ? introText.trim() : defaultTitle;
  const balanceText = user?.flags?.onboarding
    ? ctx.formatters.balance(user, { showGems: false }, lang)
    : ctx.formatters.balance(user, lang);
  // Avoid extra noise while a training is running.
  // The gym pass info is relevant on idle screen, not during an active training.
  let captionText = `${titleOrHeader}\n\n${balanceText}`;
  if (!user?.gym?.active && !user?.flags?.onboarding) {
    const passCfg = EnergyService.passCfg();
    const passState = EnergyService.gymPassState(user, ctx.now());
    const gymCap = Math.max(0, Number(CONFIG?.GYM?.MAX_ENERGY_CAP) || 160);
    const baseEnergyMax = Math.max(0, Number(user?.energy_max) || 0);
    let passLine = "";
    if (passState.active) {
      const leftMin = Math.max(1, Math.ceil(passState.leftMs / 60000));
      const d = Math.floor(leftMin / (24 * 60));
      const h = Math.floor((leftMin % (24 * 60)) / 60);
      const m = leftMin % 60;
      passLine = ctx._t(user, "loc.gym.pass_active_line", { bonus: passCfg.bonusEnergyMax, d, h, m });
    } else if (baseEnergyMax >= gymCap) {
      passLine = ctx._t(user, "loc.gym.pass_available_line", { bonus: passCfg.bonusEnergyMax, gems: passCfg.priceGems });
    } else {
      passLine = ctx._t(user, "loc.gym.pass_locked_line", { need: gymCap, have: baseEnergyMax });
    }
    captionText = passLine
      ? `${titleOrHeader}\n\n${passLine}\n\n${balanceText}`
      : `${titleOrHeader}\n\n${balanceText}`;
  }

  if (user?.gym?.active) {
    const gymActiveAsset = (CONFIG.ASSETS?.GymActive || CONFIG.ASSETS?.Gym);
    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.GYM,
      asset: gymActiveAsset,
      caption: captionText,
      keyboard: kb,
      policy: "photo",
    });
  } else {
    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.GYM,
      caption: captionText,
      keyboard: kb,
      policy: "auto",
    });
  }

  ctx._sourceMsg = null;
  ctx._route = Routes.GYM;
}

export async function renderUpgradesRoute(ctx, user, { lang = "ru" } = {}) {
  const caption = ctx.ui.upgradesCaption(user, lang);
  const kbRows = ctx.ui.upgrades(user, lang);

  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.UPGRADES,
    caption: caption + "\n\n" + ctx.formatters.balance(user),
    keyboard: kbRows,
    policy: "photo",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.UPGRADES;
}

export async function renderBarTasksRoute(ctx, user, { lang = "ru" } = {}) {
  let caption = `${ctx._t(user, "loc.bartasks.title")}\n\n${ctx._t(user, "loc.bartasks.empty")}`;
  let keyboard = ctx.ui.barTasks(user, lang);
  if (ctx.quests?.buildBarTasksView) {
    const view = await ctx.quests.buildBarTasksView(user);
    if (view && typeof view === "object") {
      caption = String(view.caption || caption);
      if (Array.isArray(view.keyboard)) keyboard = view.keyboard;
    }
  }

  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.BAR,
    caption,
    keyboard,
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.BAR_TASKS;
}

export async function renderBarNewbieTasksRoute(ctx, user, { lang = "ru" } = {}) {
  let caption = "🧭 Newbie quests";
  let keyboard = ctx.ui.barTasks(user, lang);
  if (ctx.quests?.buildBarNewbieTasksView) {
    const view = await ctx.quests.buildBarNewbieTasksView(user);
    if (view && typeof view === "object") {
      caption = String(view.caption || caption);
      if (Array.isArray(view.keyboard)) keyboard = view.keyboard;
    }
  }

  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.BAR,
    caption,
    keyboard,
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.BAR_NEWBIE_TASKS;
}
