import { CONFIG } from "../../GameConfig.js";
import { Routes, toGoCallback } from "../../Routes.js";

export async function clearBackToIfNeeded(ctx, user, route) {
  if (route === Routes.SHOP || route === Routes.HOME || route === Routes.HOME_BED_UPGRADES || route === Routes.GYM) return;
  if (!user?.nav?.backTo) return;
  try {
    user.nav.backTo = null;
    if (ctx.users && typeof ctx.users.save === "function") {
      await ctx.users.save(user);
    }
  } catch {}
}

export async function renderSquareRoute(ctx, user, { header = "", lang = "ru", onboardingStage = "" } = {}) {
  if (user?.flags?.onboarding) {
    const goGym = onboardingStage === "go_gym" || onboardingStage === "gym_started";
    const goWorkForClaim = onboardingStage === "job_claim";
    const kbOnboarding = [[{
      text: goGym
        ? ctx._t(user, "loc.onboarding.to_gym")
        : (goWorkForClaim ? ctx._t(user, "loc.onboarding.claim_shift") : ctx._t(user, "loc.onboarding.start_first_shift")),
      callback_data: goGym ? toGoCallback(Routes.GYM) : toGoCallback(Routes.WORK)
    }]];

    const caption = (header || "") + (goGym
      ? (onboardingStage === "gym_started"
        ? ctx._t(user, "loc.onboarding.caption_finish_gym")
        : ctx._t(user, "loc.onboarding.caption_gym"))
      : (goWorkForClaim
        ? ctx._t(user, "loc.onboarding.caption_claim_shift")
        : ctx._t(user, "loc.onboarding.caption_first_shift")));

    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.SQUARE,
      caption,
      keyboard: kbOnboarding,
      policy: "photo",
    });
    ctx._sourceMsg = null;
    ctx._route = Routes.SQUARE;
    return;
  }

  const kb = ctx.ui.square(lang);

  let yesterdayBlock = "";
  if (ctx.social && typeof ctx.social.getDailyWinnersSnapshot === "function") {
    try {
      const winners = await ctx.social.getDailyWinnersSnapshot();
      if (Array.isArray(winners) && winners.length) {
        const medals = ["🥇", "🥈", "🥉"];
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
            ? ctx._t(user, "loc.square.player_fallback_id", { id: key.slice(-4).padStart(4, "0") })
            : ctx._t(user, "loc.square.player_fallback");
          if (key) nameCache.set(key, fallback);
          return fallback;
        };

        const lines = [ctx._t(user, "loc.square.yesterday_top")];
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
            ? ctx._t(user, "loc.square.reward_received", { reward: rewardParts.join(" + ") })
            : "";
          lines.push(`${mark} ${name} — $${earned}${rewardText}`);
        }
        yesterdayBlock = lines.join("\n");
      }
    } catch {}
  }

  const captionBase =
    (header || "") +
    ctx._t(user, "loc.square.caption") + "\n" +
    ctx._getSquareHint(user);
  const captionSquare = yesterdayBlock ? `${captionBase}\n\n${yesterdayBlock}` : captionBase;

  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.SQUARE,
    caption: captionSquare,
    keyboard: kb,
    policy: "photo",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.SQUARE;
}

export async function renderFallbackSquareRoute(ctx, user, { header = "", lang = "ru" } = {}) {
  const kb = ctx.ui.square(lang);
  await ctx.media.show({
    sourceMsg: ctx._sourceMsg,
    place: Routes.SQUARE,
    caption: header + ctx._t(user, "loc.square.fallback"),
    keyboard: kb,
    policy: "photo",
  });
  ctx._sourceMsg = null;
  ctx._route = Routes.SQUARE;
}
