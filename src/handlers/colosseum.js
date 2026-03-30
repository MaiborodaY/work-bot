import { Routes } from "../Routes.js";
import { normalizeLang, t } from "../i18n/index.js";

export const colosseumHandler = {
  match: (data) =>
    data === "col:help" ||
    data === "col:status" ||
    data === "col:queue:join" ||
    data === "col:queue:leave" ||
    data === "col:battle:open" ||
    data === "col:accept" ||
    data === "col:decline" ||
    data === "col:surrender" ||
    data.startsWith("col:battle:atk:") ||
    data.startsWith("col:pick:attack:") ||
    data.startsWith("col:pick:defense:"),

  async handle(ctx) {
    const { data, u, cb, answer, locations, colosseum } = ctx;
    const lang = normalizeLang(u?.lang || "en");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!colosseum) {
      await answer(cb.id, tt("loc.city.caption"));
      return;
    }

    const show = async (view, place = Routes.COLOSSEUM) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place,
        caption: String(view?.caption || ""),
        keyboard: Array.isArray(view?.keyboard) ? view.keyboard : [[{ text: "⬅️", callback_data: "go:City" }]],
        asset: view?.asset || undefined,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    if (data === "col:help") {
      await answer(cb.id);
      const view = await colosseum.buildHelpView(u);
      await show(view);
      return;
    }

    if (data === "col:status") {
      await answer(cb.id);
      const view = await colosseum.buildStatusView(u);
      await show(view);
      return;
    }

    if (data === "col:queue:join") {
      const res = await colosseum.joinQueue(u);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      await show(res?.view || (await colosseum.buildMainView(u)));
      return;
    }

    if (data === "col:queue:leave") {
      const res = await colosseum.leaveQueue(u);
      await answer(cb.id, String(res?.toast || ""));
      await show(res?.view || (await colosseum.buildMainView(u)));
      return;
    }

    if (data === "col:battle:open") {
      await answer(cb.id);
      const view = await colosseum.buildBattleView(u);
      await show(view);
      return;
    }

    if (data === "col:accept") {
      const res = await colosseum.accept(u);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      if (res?.noRender) {
        locations.setSourceMessage(null);
        return;
      }
      await show(res?.view || (await colosseum.buildBattleView(u)));
      return;
    }

    if (data === "col:decline") {
      const res = await colosseum.decline(u);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id, String(res?.toast || ""));
      }
      await show(res?.view || (await colosseum.buildMainView(u)));
      return;
    }

    if (data === "col:surrender") {
      const res = await colosseum.surrender(u);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id);
      }
      await show(res?.view || (await colosseum.buildMainView(u)));
      return;
    }

    if (data.startsWith("col:pick:attack:") || data.startsWith("col:battle:atk:")) {
      const zone = String(data.split(":")[3] || "");
      const res = await colosseum.pickAttack(u, zone);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id);
      }
      await show(res?.view || (await colosseum.buildBattleView(u)));
      return;
    }

    if (data.startsWith("col:pick:defense:")) {
      const zone = String(data.split(":")[3] || "");
      const res = await colosseum.pickDefense(u, zone);
      if (!res?.ok) {
        await answer(cb.id, String(res?.error || "Error"));
      } else {
        await answer(cb.id);
      }
      if (res?.noRender) {
        locations.setSourceMessage(null);
        return;
      }
      await show(res?.view || (await colosseum.buildBattleView(u)));
    }
  }
};
