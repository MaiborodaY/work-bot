import { CONFIG } from "../../GameConfig.js";
import { NameService } from "../../NameService.js";
import { Routes, toGoCallback } from "../../Routes.js";

export async function renderStudyRoute(ctx, user, { header = "", lang = "ru" } = {}) {
  const backTo = (user?.nav?.backTo || null) || Routes.PROGRESS;
  if (!user.displayName || !String(user.displayName).trim()) {
    if (ctx.users && typeof ctx.users.save === "function") {
      user.awaitingName = true;
      user.afterNameRoute = toGoCallback(Routes.STUDY);
      await ctx.users.save(user);
    }

    const ns = new NameService({ users: ctx.users });
    await ns.prompt(async (text, extra) => {
      await ctx.media.show({
        sourceMsg: ctx._sourceMsg,
        place: Routes.STUDY,
        caption: text,
        keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: ctx._t(user, "ui.back.default"), callback_data: toGoCallback(backTo) }]],
        policy: "photo",
      });
      ctx.setSourceMessage(null);
    });
    ctx._route = Routes.STUDY;
    return;
  }

  if (user.study?.active && ctx.now() >= (user.study.endAt || 0) && typeof ctx.maybeFinishStudy === "function") {
    const finished = await ctx.maybeFinishStudy(user);
    if (finished) {
      ctx._sourceMsg = null;
      ctx._route = Routes.STUDY;
      return;
    }
  }

  if (user.study?.active) {
    const startAt = user.study.startAt || 0;
    const endAt = user.study.endAt || 1;
    const now = ctx.now();
    const elapsed = Math.max(0, now - startAt);
    const need = Math.max(1, endAt - startAt);
    const progress = Math.min(100, ctx.pct(elapsed, need));
    const ready = now >= endAt;

    let ffCost = null;
    try {
      if (ctx.fastForward && !ready) {
        const q = ctx.fastForward.quote(user, "study");
        if (q?.ok) ffCost = q.cost;
      }
    } catch {}

    const leftMin = Math.max(1, Math.ceil((endAt - now) / 60000));
    const studyAsset = CONFIG?.ASSETS?.StudyActive || CONFIG?.ASSETS?.Study;

    const title = ready
      ? ctx._t(user, "loc.study.ready_title")
      : ctx._t(user, "loc.study.active_title", { mins: leftMin });

    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.STUDY,
      asset: studyAsset,
      caption:
        title +
        "\n\n" + ctx.formatters.balance(user) +
        "\n" + ctx.formatters.studyLine(user),
      keyboard: ctx.ui.studyActive(progress, { ready, ffCost, backTo }, lang),
      policy: "photo",
    });
  } else {
    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.STUDY,
      caption: header +
        ctx._t(user, "loc.study.caption_intro") + "\n\n" +
        ctx.formatters.balance(user) + "\n" + ctx.formatters.studyLine(user),
      keyboard: ctx.ui.studyIdle(ctx.economy.fmtStudyEffects(user), { backTo }, lang),
      policy: "auto",
    });
  }
  ctx._sourceMsg = null;
  ctx._route = Routes.STUDY;
}
