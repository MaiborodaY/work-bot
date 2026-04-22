// handlers/daily.js
import { normalizeLang, t } from "../i18n/index.js";

export const dailyHandler = {
  match: (data) => data === "daily:claim",

  async handle(ctx) {
    const { u, cb, answer, daily, locations, clans, users, quests } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    await answer(cb.id, "");

    const res = await daily.claim(u);
    const syncNewbieStepIfNeeded = async (initialNeedSave = false) => {
      let needSave = !!initialNeedSave;
      if (quests?.ensureCycles) {
        const qRes = await quests.ensureCycles(u, { persist: false });
        needSave = needSave || !!qRes?.changed;
      }
      if (quests?.maybeCompleteNewbieStep) {
        needSave = quests.maybeCompleteNewbieStep(u) || needSave;
      }
      if (needSave) await users.save(u);
    };

    if (res.ok) {
      let questDirty = false;
      try {
        if (clans?.recordActiveAction) {
          await clans.recordActiveAction(u, 1, 1);
        }
      } catch {}

      await syncNewbieStepIfNeeded(questDirty);
      if (!!u?.flags?.onboardingDone && u?.newbiePath?.completed !== true) {
        await locations.show(u, tt("handler.daily.claim_ok", { amount: res.amount, streak: res.streak }), "BarNewbieTasks");
        return;
      }

      await locations.show(
        u,
        tt("handler.daily.claim_ok", { amount: res.amount, streak: res.streak })
      );
    } else {
      await syncNewbieStepIfNeeded();
      if (!!u?.flags?.onboardingDone && u?.newbiePath?.completed !== true) {
        await locations.show(u, tt("handler.daily.already_claimed"), "BarNewbieTasks");
        return;
      }
      await locations.show(u, tt("handler.daily.already_claimed"));
    }
  }
};
