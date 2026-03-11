import { CONFIG } from "../../GameConfig.js";
import { BarService } from "../../BarService.js";
import { Routes, toGoCallback } from "../../Routes.js";

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
  const paidLocked = studyLevel < minStudy;

  const today = new Date().toISOString().slice(0, 10);
  const spinsToday = (user.casino?.day === today) ? (user.casino?.spins || 0) : 0;
  const freeUsedToday = (user.casino?.free?.day === today);
  const freeLine = freeUsedToday ? ctx._t(user, "loc.casino.free_tomorrow") : ctx._t(user, "loc.casino.free_today");
  const statusLine = ctx._t(user, "loc.casino.status_line", { spins: spinsToday, limit: CONFIG.CASINO.daily_limit });
  const lastPrizeLine = (user.casino?.free?.lastPrize ?? null) != null
    ? `\n${ctx._t(user, "loc.casino.last_free_prize", { prize: user.casino.free.lastPrize || 0 })}`
    : "";

  const statsLines =
    typeof ctx.formatters?.casinoStatsLines === "function"
      ? ctx.formatters.casinoStatsLines(user)
      : "";

  const bestLine =
    typeof ctx.formatters?.casinoBestLine === "function"
      ? ctx.formatters.casinoBestLine(user)
      : "";

  let casinoKb = ctx.ui.casinoMenu(user, lang);
  if (!freeUsedToday) {
    casinoKb = [[{ text: ctx._t(user, "loc.casino.free_btn"), callback_data: "casino_free" }], ...casinoKb];
  }

  const captionCore =
    ctx._t(user, "loc.casino.caption_intro") + "\n\n" +
    `${freeLine}\n${statusLine}${lastPrizeLine}`;
  const captionWithStats = statsLines ? `${captionCore}\n\n${statsLines}` : captionCore;
  const captionWithLocks = paidLocked
    ? `${captionWithStats}\n\n${ctx._t(user, "loc.casino.locked_more", { level: minStudy })}`
    : captionWithStats;
  const captionStatsBest = bestLine ? `${captionWithLocks}\n${bestLine}` : captionWithLocks;
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
    defaultTitle = ctx._t(user, "loc.gym.caption_intro");
  }

  const titleOrHeader = (introText && introText.trim()) ? introText.trim() : defaultTitle;

  if (user?.gym?.active) {
    const gymActiveAsset = (CONFIG.ASSETS?.GymActive || CONFIG.ASSETS?.Gym);
    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.GYM,
      asset: gymActiveAsset,
      caption: titleOrHeader + "\n\n" + ctx.formatters.balance(user),
      keyboard: kb,
      policy: "photo",
    });
  } else {
    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.GYM,
      caption: titleOrHeader + "\n\n" + ctx.formatters.balance(user),
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
  const title = ctx._t(user, "loc.bartasks.title");
  const tasks = Array.isArray(user?.bar?.tasks) ? user.bar.tasks : [];
  const hasTasks = tasks.length > 0;
  const allClaimed = hasTasks && tasks.every((task) => task?.status === "claimed");

  let caption = title;
  if (!hasTasks) {
    caption = `${title}\n\n${ctx._t(user, "loc.bartasks.empty")}`;
  } else if (allClaimed) {
    caption = `${title}\n\n${ctx._t(user, "loc.bartasks.done")}`;
  }

  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.BAR,
    caption,
    keyboard: ctx.ui.barTasks(user, lang),
    policy: "auto",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.BAR_TASKS;
}
