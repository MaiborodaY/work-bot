import { normalizeLang, t } from "../i18n/index.js";
import { Routes } from "../Routes.js";
import { showEnergyChoicePanel } from "./energy.js";

export const thiefHandler = {
  match: (data) =>
    data === "thief:help" ||
    data === "thief:upgrade" ||
    data.startsWith("thief:targets:") ||
    data.startsWith("thief:attack:") ||
    data.startsWith("thief:def:open:") ||
    data.startsWith("thief:def:atk:") ||
    data.startsWith("thief:def:def:") ||
    data.startsWith("thief:reveal:confirm:") ||
    data.startsWith("thief:reveal:") ||
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
        if (res.code === "not_enough_energy") {
          await answer(cb.id);
          await showEnergyChoicePanel(ctx, {
            origin: Routes.THIEF,
            need: Math.max(0, Number(res?.needEnergy) || 0)
          });
          return;
        }
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

    if (data.startsWith("thief:reveal:confirm:")) {
      const eventId = String(data.split(":")[3] || "");
      await answer(cb.id);
      const view = await thief.confirmReveal(u.id, eventId);
      await reloadSelf();
      await show(view);
      return;
    }

    if (data.startsWith("thief:reveal:")) {
      const eventId = String(data.split(":")[2] || "");
      await answer(cb.id);
      const view = await thief.buildRevealEntryView(u, eventId);
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
      }
      await answer(cb.id, tt("handler.thief.defend_ok"));
      await reloadSelf();
      const view = await thief.buildDefenseBattleView(u, attackId);
      await show(view);
      return;
    }

    if (data.startsWith("thief:def:open:")) {
      const attackId = String(data.split(":")[3] || "");
      await answer(cb.id);
      const view = await thief.buildDefenseBattleView(u, attackId);
      await show(view);
      return;
    }

    if (data.startsWith("thief:def:atk:")) {
      const parts = data.split(":");
      const attackId = String(parts[3] || "");
      const zone = String(parts[4] || "");
      const res = await thief.pickDefenseBattleAttack(u, attackId, zone);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.thief.defend_failed"));
      } else {
        await answer(cb.id);
      }
      await reloadSelf();
      const view = await thief.buildDefenseBattleView(u, attackId);
      await show(view);
      return;
    }

    if (data.startsWith("thief:def:def:")) {
      const parts = data.split(":");
      const attackId = String(parts[3] || "");
      const zone = String(parts[4] || "");
      const res = await thief.pickDefenseBattleDefense(u, attackId, zone);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.thief.defend_failed"));
      } else {
        await answer(cb.id);
      }
      await reloadSelf();
      const view = await thief.buildDefenseBattleView(u, attackId);
      await show(view);
      return;
    }
  }
};
