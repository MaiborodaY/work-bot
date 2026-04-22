import { Routes } from "../Routes.js";
import { normalizeLang } from "../i18n/index.js";

export const fishingHandler = {
  match: (data) =>
    data === "fish:main" ||
    data === "fish:refresh" ||
    data.startsWith("fish:spot:") ||
    data.startsWith("fish:create:") ||
    data.startsWith("fish:joinspot:") ||
    data.startsWith("fish:join:") ||
    data.startsWith("fish:choice:") ||
    data === "fish:noop",

  async handle(ctx) {
    const { data, u, cb, answer, locations, goTo, fishing } = ctx;
    if (!fishing) {
      await answer(cb.id);
      return;
    }
    void normalizeLang(u?.lang || "en");

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: Routes.FISHING,
        caption: String(view?.caption || ""),
        keyboard: Array.isArray(view?.keyboard) ? view.keyboard : [[{ text: "⬅️", callback_data: "go:City" }]],
        asset: view?.asset || undefined,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "fish:noop") {
      await answer(cb.id);
      return;
    }

    if (data === "fish:main" || data === "fish:refresh") {
      await answer(cb.id);
      const view = await fishing.buildMainView(u);
      await show(view);
      return;
    }

    if (data.startsWith("fish:spot:")) {
      await answer(cb.id);
      const spotId = String(data.split(":")[2] || "").trim();
      const view = await fishing.buildSpotView(u, spotId);
      await show(view);
      return;
    }

    if (data.startsWith("fish:create:")) {
      const spotId = String(data.split(":")[2] || "").trim();
      const res = await fishing.createSession(u, spotId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      const view = await fishing.buildSpotView(u, spotId);
      await show(view);
      return;
    }

    if (data.startsWith("fish:joinspot:")) {
      const spotId = String(data.split(":")[2] || "").trim();
      const res = await fishing.joinFirstOpenSession(u, spotId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
        const view = await fishing.buildSpotView(u, spotId);
        await show(view);
      } else {
        await answer(cb.id, String(res?.toast || ""));
        // Show choice screen immediately for partner (player 2)
        const session = res.session;
        const partnerId = String(session?.creatorId || "");
        const partnerUser = partnerId ? await ctx.users?.load(partnerId).catch(() => null) : null;
        const choiceBlock = fishing.buildChoiceBlock(u, session, partnerUser);
        const sessionId = String(session?.id || "");
        const s = fishing._s(u);
        const view = {
          caption: [s.matchFoundTitle, "", choiceBlock].join("\n"),
          keyboard: [[
            { text: s.btnChoiceHonest, callback_data: `fish:choice:${sessionId}:C` },
            { text: s.btnChoiceGreedy, callback_data: `fish:choice:${sessionId}:D` }
          ]]
        };
        await show(view);
      }
      return;
    }

    if (data.startsWith("fish:join:")) {
      const sessionId = String(data.split(":")[2] || "").trim();
      const res = await fishing.joinSession(u, sessionId);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
        const view = await fishing.buildMainView(u);
        await show(view);
      } else {
        await answer(cb.id, String(res?.toast || ""));
        const session = res.session;
        const partnerId = String(session?.creatorId || "");
        const partnerUser = partnerId ? await ctx.users?.load(partnerId).catch(() => null) : null;
        const choiceBlock = fishing.buildChoiceBlock(u, session, partnerUser);
        const sid = String(session?.id || "");
        const s = fishing._s(u);
        const view = {
          caption: [s.matchFoundTitle, "", choiceBlock].join("\n"),
          keyboard: [[
            { text: s.btnChoiceHonest, callback_data: `fish:choice:${sid}:C` },
            { text: s.btnChoiceGreedy, callback_data: `fish:choice:${sid}:D` }
          ]]
        };
        await show(view);
      }
      return;
    }

    if (data.startsWith("fish:choice:")) {
      const parts = data.split(":");
      const sessionId = String(parts[2] || "").trim();
      const choice    = String(parts[3] || "C").toUpperCase();
      const res = await fishing.submitChoice(u, sessionId, choice);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      const view = await fishing.buildMainView(u);
      await show(view);
      return;
    }
  }
};
