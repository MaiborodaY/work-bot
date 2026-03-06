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
    data.startsWith("clan:join:"),

  async handle(ctx) {
    const { data, u, cb, answer, users, locations, clans, goTo } = ctx;

    const show = async (view, place = "CityBoard") => {
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
        await answer(cb.id, "Сначала выйди из текущего клана.");
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
        caption:
          "Введи название клана одним сообщением.\n" +
          "Длина: 2-24 символа.\n" +
          "Можно буквы, цифры, пробел, _ . -",
        keyboard: [[{ text: "Назад", callback_data: "go:Clan" }]]
      });
      return;
    }

    if (data.startsWith("clan:join:")) {
      await answer(cb.id);
      const clanId = data.split(":")[2] || "";
      const res = await clans.joinClan(u, clanId);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось вступить в клан.");
        await goTo(u, "Clan");
        return;
      }
      await answer(cb.id, `Ты вступил в клан: ${res.clan?.name || ""}`);
      await goTo(u, "Clan");
      return;
    }

    if (data === "clan:leave") {
      await answer(cb.id);
      const res = await clans.leaveClan(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось выйти из клана.");
        await goTo(u, "Clan");
        return;
      }
      const note =
        "Ты вышел из клана.\n" +
        `Вступить в новый можно после недельных выплат: ${res.nextWeekStart}.`;
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
      const view = await clans.buildWeeklyTopView();
      await show(view);
      return;
    }

    if (data === "clan:all_time") {
      await answer(cb.id);
      const view = await clans.buildAllTimeTopView();
      await show(view);
      return;
    }

    if (data === "clan:rating_info") {
      await answer(cb.id);
      const view = clans.buildRatingInfoView();
      await show(view);
      return;
    }
  }
};
