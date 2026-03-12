import { normalizeLang, t } from "../i18n/index.js";

export const clanHandler = {
  match: (data) =>
    data === "clan:create_prompt" ||
    data === "clan:list" ||
    data === "clan:contracts" ||
    data === "clan:members" ||
    data === "clan:weekly_top" ||
    data === "clan:all_time" ||
    data === "clan:rating_info" ||
    data === "clan:leave" ||
    data === "clan:leave_confirm" ||
    data.startsWith("clan:join:"),

  async handle(ctx) {
    const { data, u, cb, answer, users, locations, clans, achievements, goTo } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    const show = async (view, place = "Clan") => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place,
        caption: view.caption,
        keyboard: view.keyboard,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "clan:create_prompt") {
      await answer(cb.id);
      if (u?.clan?.clanId) {
        await answer(cb.id, tt("clan.err.leave_current"));
        await goTo(u, "Clan");
        return;
      }
      const canJoin = clans.canJoinNow(u);
      if (!canJoin.ok) {
        await answer(cb.id, canJoin.error);
        await goTo(u, "Clan");
        return;
      }

      u.awaitingClanName = true;
      await users.save(u);

      await show({
        caption: tt("worker.clan.awaiting_name_caption"),
        keyboard: [[{ text: tt("worker.btn.back"), callback_data: "go:Clan" }]]
      });
      return;
    }

    if (data.startsWith("clan:join:")) {
      await answer(cb.id);
      const clanId = data.split(":")[2] || "";
      const res = await clans.joinClan(u, clanId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.clan.join_failed"));
        await goTo(u, "Clan");
        return;
      }
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "clan_join", { clanId: String(res?.clan?.id || clanId) });
        }
      } catch {}
      await answer(cb.id, tt("handler.clan.join_ok", { name: res.clan?.name || "" }));
      await goTo(u, "Clan");
      return;
    }

    if (data === "clan:leave") {
      await answer(cb.id);
      await show({
        caption: tt("handler.clan.leave_confirm_caption"),
        keyboard: [
          [{ text: tt("handler.clan.leave_confirm_btn"), callback_data: "clan:leave_confirm" }],
          [{ text: tt("worker.btn.cancel"), callback_data: "go:Clan" }]
        ]
      });
      return;
    }

    if (data === "clan:leave_confirm") {
      await answer(cb.id);
      const res = await clans.leaveClan(u);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.clan.leave_failed"));
        await goTo(u, "Clan");
        return;
      }
      const note = tt("handler.clan.leave_note", { date: res.nextWeekStart });
      await goTo(u, "Clan", note);
      return;
    }

    if (data === "clan:list") {
      await answer(cb.id);
      const view = await clans.buildOpenClansView(u);
      await show(view);
      return;
    }

    if (data === "clan:contracts") {
      await answer(cb.id);
      const view = await clans.buildContractsView(u);
      await show(view);
      return;
    }

    if (data === "clan:members") {
      await answer(cb.id);
      const view = await clans.buildMembersView(u);
      await show(view);
      return;
    }

    if (data === "clan:weekly_top") {
      await answer(cb.id);
      const view = await clans.buildWeeklyTopView(u);
      await show(view);
      return;
    }

    if (data === "clan:all_time") {
      await answer(cb.id);
      const view = await clans.buildAllTimeTopView(u);
      await show(view);
      return;
    }

    if (data === "clan:rating_info") {
      await answer(cb.id);
      const view = clans.buildRatingInfoView(u);
      await show(view);
      return;
    }
  }
};
