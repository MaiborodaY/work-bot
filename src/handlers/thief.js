import { normalizeLang, t } from "../i18n/index.js";

export const thiefHandler = {
  match: (data) =>
    data === "thief:help" ||
    data === "thief:upgrade" ||
    data.startsWith("thief:targets:") ||
    data.startsWith("thief:attack:") ||
    data.startsWith("thief:defend:"),

  async handle(ctx) {
    const { data, u, cb, answer, goTo, users, locations, thief } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (!thief) {
      await answer(cb.id, tt("handler.thief.unavailable"));
      return;
    }

    const show = async (view) => {
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Thief",
        caption: view.caption,
        keyboard: view.keyboard,
        asset: view.asset || undefined,
        policy: "auto"
      });
      locations.setSourceMessage(null);
    };

    const reloadSelf = async () => {
      const fresh = await users.load(u.id).catch(() => null);
      if (!fresh) return;
      for (const k of Object.keys(u)) delete u[k];
      Object.assign(u, fresh);
    };

    if (data === "thief:help") {
      await answer(cb.id);
      const view = await thief.buildHelpView(u);
      await show(view);
      return;
    }

    if (data === "thief:upgrade") {
      const res = await thief.upgradeLevel(u);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.thief.upgrade_failed"));
      } else {
        await answer(cb.id, tt("handler.thief.upgrade_ok", { level: res.level }));
      }
      await reloadSelf();
      const view = await thief.buildMainView(u);
      await show(view);
      return;
    }

    if (data.startsWith("thief:targets:")) {
      await answer(cb.id);
      const bizId = String(data.split(":")[2] || "");
      const view = await thief.buildTargetsView(u, bizId);
      await show(view);
      return;
    }

    if (data.startsWith("thief:attack:")) {
      const parts = data.split(":");
      const bizId = String(parts[2] || "");
      const ownerId = String(parts[3] || "");
      const res = await thief.startAttack(u, bizId, ownerId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.thief.attack_failed"));
        await reloadSelf();
        const view = await thief.buildTargetsView(u, bizId);
        await show(view);
        return;
      } else {
        await answer(cb.id, tt("handler.thief.attack_started", { mins: res.mins }));
      }
      await reloadSelf();
      const view = await thief.buildMainView(u);
      await show(view);
      return;
    }

    if (data.startsWith("thief:defend:")) {
      const attackId = String(data.split(":")[2] || "");
      const res = await thief.defend(u, attackId);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.thief.defend_failed"));
        await reloadSelf();
        await goTo(u, "Business");
        return;
      } else {
        await answer(cb.id, tt("handler.thief.defend_ok"));
      }
      await reloadSelf();
      await goTo(u, "Business", tt("handler.thief.defend_done_intro"));
      return;
    }
  }
};
