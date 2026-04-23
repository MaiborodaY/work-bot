import { StudyService } from "../StudyService.js";
import { FastForwardService } from "../FastForwardService.js";
import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";
import { Routes } from "../Routes.js";
import { showEnergyChoicePanel } from "./energy.js";

export const studyHandler = {
  match: (data) => data === "study:start" || data === "study:skip" || data === "study:finish",

  async handle(ctx) {
    const { u, cb, answer, users, locations, now, send, goTo, orders, social, achievements, quests } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const study = new StudyService({ users, send, now, social });
    const ff = new FastForwardService({ users, orders, now, send });

    // ✅ обычное завершение, когда время вышло
    if (ctx.data === "study:finish") {
      await answer(cb.id);
      const fin = await study.finish(u);
      if (!fin.ok) {
        await goTo(u, "Study");
        return;
      }
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "study_finish", { level: fin.level, source: "finish" });
        }
      } catch {}
      try {
        if (quests?.onEvent) {
          await quests.onEvent(u, "study_finish", { level: fin.level, source: "finish" });
        }
      } catch {}
      await goTo(u, "Study", tt("handler.study.finish_ok", { level: fin.level }));
      return;
    }

    // ⏩ мгновенное завершение за кристаллы
    if (ctx.data === "study:skip") {
      const res = await ff.finishNow(u, "study");
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.study.skip_failed"));
        await goTo(u, "Study");
        return;
      }
      const fin = await study.finish(u);
      if (!fin.ok) {
        await answer(cb.id, tt("handler.study.finish_failed"));
        await goTo(u, "Study");
        return;
      }
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "study_finish", { level: fin.level, source: "skip" });
        }
      } catch {}
      try {
        if (quests?.onEvent) {
          await quests.onEvent(u, "study_finish", { level: fin.level, source: "skip" });
        }
      } catch {}
      await answer(cb.id, tt("handler.study.skip_ok", { gems: CONFIG.PREMIUM.emoji, cost: res.cost }));
      await goTo(u, "Study", tt("handler.study.finish_ok", { level: fin.level }));
      return;
    }

    // Автозавершение отключено — не проверяем maybeFinish здесь

    // Старт
// Пытаемся запустить обучение
const studyLevel = Math.max(0, Number(u?.study?.level) || 0);
const studyNeedEnergy = Math.max(0, Number(study?._paramsForLevel?.(studyLevel)?.costEnergy) || 0);
const res = await study.start(u);
if (!res.ok) {
  const lowEnergy = res.code === "not_enough_energy" || /energy/i.test(String(res.error || ""));
  if (lowEnergy) {
    await answer(cb.id);
    await showEnergyChoicePanel(ctx, {
      origin: Routes.STUDY,
      need: Math.max(0, Number(res?.needEnergy) || studyNeedEnergy)
    });
    return;
  }

  await answer(cb.id, res.error || tt("handler.study.start_failed"));
  await goTo(u, "Study");
  return;
}

    const mins = Math.ceil(res.timeMs / 60000);
    const intro = tt("handler.study.started_intro", {
      costMoney: res.costMoney,
      costEnergy: res.costEnergy,
      mins
    });
    let newbieCompleted = false;
    try {
      if (!!u?.flags?.onboardingDone && quests?.maybeCompleteNewbieStep) {
        newbieCompleted = !!quests.maybeCompleteNewbieStep(u);
          if (!newbieCompleted && quests?.maybeCompleteNewbieStep2) newbieCompleted = !!quests.maybeCompleteNewbieStep2(u);
        if (newbieCompleted) {
          await users.save(u);
        }
      }
    } catch {}
    await answer(cb.id, tt("handler.study.started_ok"));
    if (newbieCompleted) {
      await goTo(u, Routes.BAR_NEWBIE_TASKS, intro);
      return;
    }
    await goTo(u, "Study", intro);
  }
};
