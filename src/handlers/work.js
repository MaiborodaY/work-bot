// handlers/work.js
import { JobService } from "../JobService.js";
import { FastForwardService } from "../FastForwardService.js";
import { CONFIG } from "../GameConfig.js";
import { normalizeLang, t } from "../i18n/index.js";
import { getJobTitle } from "../I18nCatalog.js";
import { safeCall } from "../SafeCall.js";
import { Routes } from "../Routes.js";
import { showEnergyChoicePanel } from "./energy.js";
import { EnergyService } from "../EnergyService.js";

export async function applyWorkClaimSideEffects(ctx, pay, endAt) {
  const { clans, labour, referrals, u, logger } = ctx || {};

  await safeCall("work.side_effect.clan", async () => {
    if (clans?.recordWorkMoney) {
      await clans.recordWorkMoney(u, pay);
    }
  }, { logger });

  await safeCall("work.side_effect.labour", async () => {
    if (labour?.onEmployeePaid) {
      await labour.onEmployeePaid(u, pay, endAt);
    }
  }, { logger });

  await safeCall("work.side_effect.referral", async () => {
    if (referrals?.tryRewardReferral) {
      await referrals.tryRewardReferral(u);
    }
  }, { logger });
}

export const workHandler = {
  match: (data) =>
    data === "work:open" ||
    data.startsWith("work:start:") ||
    data === "work:claim" ||
    data === "work:cancel" ||
    data === "work:skip" ||
    data === "work:skip_free" ||
    data === "work:goto:home" ||
    data === "work:goto:shop",

  async handle(ctx) {
    const { data, u, cb, answer, users, now, social, clans, labour, referrals, achievements, quests, goTo, orders, send } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const fmtWorkTime = (ms) => {
      const mins = Math.max(1, Math.ceil(Number(ms || 0) / 60000));
      if (mins >= 24 * 60 && mins % (24 * 60) === 0) {
        const days = mins / (24 * 60);
        return lang === "en" ? `${days}d` : `${days} дн`;
      }
      if (mins >= 60 && mins % 60 === 0) {
        const hours = mins / 60;
        return lang === "en" ? `${hours}h` : `${hours} ч`;
      }
      return lang === "en" ? `${mins} min` : (lang === "uk" ? `${mins} хв` : `${mins} мин`);
    };

    const jobs = new JobService({ users, now, social, achievements, quests });
    const ff = new FastForwardService({ users, orders, now, send });

    async function render(intro) {
      await goTo(u, "Work", intro || null);
    }

    async function advanceOnboardingAfterClaimIfNeeded() {
      if (u?.flags?.onboarding && String(u?.flags?.onboardingStep || "") === "job_claim") {
        u.flags.onboardingStep = "go_gym";
        await users.save(u);
      }
    }

    if (data === "work:open") {
      await answer(cb.id);
      await render();
      return;
    }

    // Доп. проверка для онбординга: разрешаем только первое задание
    const newbieWorkOnly = !!(
      u?.flags?.onboardingDone &&
      !u?.flags?.onboarding &&
      u?.newbiePath?.completed !== true &&
      u?.newbiePath?.pending !== true &&
      Number(u?.newbiePath?.step || 0) === 2
    );
    if (data.startsWith("work:start:") && (u?.flags?.onboarding || newbieWorkOnly)) {
      const typeId = data.split(":")[2];
      const firstType = Object.keys(CONFIG.JOBS || {})[0];
      if (firstType && typeId !== firstType) {
        await answer(cb.id, tt("handler.work.onboarding_first_only"));
        await render();
        return;
      }
    }

    if (data.startsWith("work:start:")) {
      const typeId = data.split(":")[2];
      const jobType = (CONFIG && CONFIG.JOBS) ? CONFIG.JOBS[typeId] : null;
      const hasCoffee = Array.isArray(u?.upgrades) && u.upgrades.includes("coffee");
      const requiredEnergy = jobType ? (hasCoffee ? Math.ceil(jobType.energy * 0.95) : jobType.energy) : 0;

      // Если максимальной энергии не хватает для выбранной работы — сразу ведём в зал
      const redirectedToGym = await safeCall("work.start.energy_cap_gate", async () => {
        const energyCap = EnergyService.effectiveEnergyMax(u);
        if (requiredEnergy == null || energyCap >= requiredEnergy) return false;

        u.nav = typeof u.nav === "object" && u.nav ? u.nav : {};
        u.nav.backTo = "Work";
        await users.save(u);
        await safeCall("work.start.energy_cap_gate.answer", async () => {
          await answer(cb.id, tt("handler.work.need_energy_cap_to_gym"));
        }, { logger: console });
        await ctx.goTo(u, "Gym", tt("handler.work.gym_intro_need_cap"));
        return true;
      }, { logger: console, fallback: false });
      if (redirectedToGym) return;

      const res = await jobs.start(u, typeId);
      if (!res.ok) {
        const lowEnergy = res.code === "not_enough_energy" || /energy/i.test(String(res.error || ""));
        if (lowEnergy) {
          await answer(cb.id);
          await showEnergyChoicePanel(ctx, {
            origin: Routes.WORK,
            need: Math.max(0, Number(res?.needEnergy) || Number(requiredEnergy) || 0)
          });
          return;
        }
        await answer(cb.id, res.error || tt("handler.work.start_failed"));
        return;
      }

      // Обновляем шаг онбординга после запуска первой смены
      await safeCall("work.start.onboarding_step", async () => {
        if (u?.flags?.onboarding && String(u?.flags?.onboardingStep || "") === "first_job") {
          u.flags.onboardingStep = "job_claim";
          const spent = Math.max(0, Number(res?.inst?.energySpent) || 0);
          if (spent > 0) {
            const energyMax = EnergyService.effectiveEnergyMax(u);
            u.energy = Math.min(energyMax, Math.max(0, Number(u?.energy) || 0) + spent);
          }
          await users.save(u);
        }
      }, { logger: console });

      let newbieCompleted = false;
      await safeCall("work.start.newbie_path", async () => {
        if (!!u?.flags?.onboardingDone && quests?.maybeCompleteNewbieStep) {
          newbieCompleted = !!quests.maybeCompleteNewbieStep(u);
          if (!newbieCompleted && quests?.maybeCompleteNewbieStep2) newbieCompleted = !!quests.maybeCompleteNewbieStep2(u);
          if (newbieCompleted) {
            await users.save(u);
          }
        }
      }, { logger: console });

      const startedTitle = getJobTitle(res?.inst?.typeId, lang) || tt("handler.work.shift_fallback");
      await answer(
        cb.id,
        tt("handler.work.started", {
          title: startedTitle,
          time: fmtWorkTime(res.inst.endAt - now()),
          mins: Math.ceil((res.inst.endAt - now()) / 60000)
        })
      );
      if (newbieCompleted) {
        await goTo(u, Routes.BAR_NEWBIE_TASKS);
        return;
      }
      await render();
      return;
    }

    if (data === "work:goto:home") {
      ctx.locations.setBack("Work");
      await ctx.goTo(u, "Home", tt("handler.work.goto_home_intro"));
      return;
    }

    if (data === "work:goto:shop") {
      ctx.locations.setBack("Work");
      await ctx.goTo(u, "Shop", tt("handler.work.goto_shop_intro"));
      return;
    }

    if (data === "work:claim") {
      const res = await jobs.claim(u);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.work.claim_failed"));
        return;
      }
      await applyWorkClaimSideEffects({ clans, labour, referrals, u }, res.pay, res.endAt);
      await advanceOnboardingAfterClaimIfNeeded();
      await answer(cb.id, tt("handler.work.claim_ok", { pay: res.pay }));
      await render();
      return;
    }

    if (data === "work:skip") {
      if (u?.flags?.onboarding) {
        await answer(cb.id, tt("handler.work.onboarding_use_free_skip"));
        await render();
        return;
      }
      const res = await ff.finishNow(u, "work");
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.work.skip_failed"));
        await render();
        return;
      }

      // Вариант A: сразу начисляем выплату через JobService.claim (social передан в JobService)
      const claim = await jobs.claim(u);
      if (!claim.ok) {
        await answer(cb.id, claim.error || tt("handler.work.claim_failed"));
        await render();
        return;
      }
      await applyWorkClaimSideEffects({ clans, labour, referrals, u }, claim.pay, claim.endAt);

      await answer(cb.id, tt("handler.work.skip_ok", { cost: res.cost, pay: claim.pay }));
      await render();
      return;
    }

    if (data === "work:skip_free") {
      const onboardingStep = String(u?.flags?.onboardingStep || "");
      if (!u?.flags?.onboarding || onboardingStep !== "job_claim" || u?.flags?.freeSkipUsed_work) {
        await answer(cb.id, tt("handler.work.skip_free_unavailable"));
        await render();
        return;
      }
      const active = u?.jobs?.active?.[0];
      if (!active) {
        await answer(cb.id, tt("handler.work.skip_free_unavailable"));
        await render();
        return;
      }

      u.flags.freeSkipUsed_work = true;
      active.endAt = Math.min(Number(active.endAt) || now(), now());
      await users.save(u);

      const claim = await jobs.claim(u);
      if (!claim.ok) {
        await answer(cb.id, claim.error || tt("handler.work.claim_failed"));
        await render();
        return;
      }
      await applyWorkClaimSideEffects({ clans, labour, referrals, u }, claim.pay, claim.endAt);
      await advanceOnboardingAfterClaimIfNeeded();

      await answer(cb.id, tt("handler.work.skip_free_ok", { pay: claim.pay }));
      await render();
      return;
    }

    if (data === "work:cancel") {
      const res = await jobs.cancel(u);
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.work.cancel_failed"));
        return;
      }
      if (u?.flags?.onboarding && String(u?.flags?.onboardingStep || "") === "job_claim") {
        u.flags.onboardingStep = "first_job";
        await users.save(u);
      }
      await answer(cb.id, tt("handler.work.cancel_ok"));
      await render();
      return;
    }
  }
};
