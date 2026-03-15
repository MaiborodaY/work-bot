import { GymService } from "../GymService.js";
import { FastForwardService } from "../FastForwardService.js";
import { normalizeLang, t } from "../i18n/index.js";
import { markFunnelStep } from "../PlayerStats.js";

export const gymHandler = {
  match: (data) =>
    data === "gym:start" ||
    data === "gym:finish" ||
    data === "gym:skip" ||
    data === "gym:skip_free",

  async handle(ctx) {
    const { u, cb, answer, users, locations, now, send, orders, social, labour, achievements, quests } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    const gym = new GymService({ users, send, now, social, labour });
    const ff = new FastForwardService({ users, orders, now, send });

    async function finishOnboardingIfNeeded() {
      const step = String(u?.flags?.onboardingStep || "");
      if (!u?.flags?.onboarding || step !== "gym_started") return false;
      u.flags.onboarding = false;
      u.flags.onboardingDone = true;
      u.flags.onboardingStep = "done";
      await users.save(u);
      return true;
    }

    if (ctx.data === "gym:start") {
      const onboardingStep = String(u?.flags?.onboardingStep || "");
      if (u?.flags?.onboarding && onboardingStep === "go_gym") {
        // Keep onboarding deterministic: guarantee resources for the first gym run.
        try {
          const q = GymService.computeForUser(u);
          let touched = false;
          if ((Number(u?.money) || 0) < q.costMoney) {
            u.money = q.costMoney;
            touched = true;
          }
          if ((Number(u?.energy) || 0) < q.costEnergy) {
            u.energy = q.costEnergy;
            touched = true;
          }
          if (touched) await users.save(u);
        } catch {}
      }

      const res = await gym.start(u);
      if (!res.ok) {
        const lowEnergy = /энерг|energy/i.test(String(res.error || ""));
        if (lowEnergy) {
          u.nav = typeof u.nav === "object" && u.nav ? u.nav : {};
          u.nav.backTo = "Gym";
          await users.save(u);

          await answer(cb.id, tt("handler.gym.low_energy_to_shop"));
          await ctx.goTo(u, "Shop", tt("handler.common.shop_energy_intro"));
          return;
        }

        await answer(cb.id, res.error || tt("handler.gym.start_failed"));
        await locations.show(u, null, "Gym");
        return;
      }

      try {
        if (u?.flags?.onboarding && onboardingStep === "go_gym") {
          u.flags.onboardingStep = "gym_started";
          await users.save(u);
        }
      } catch {}

      const mins = Math.max(1, Math.round(res.timeMs / 60000));
      const intro = tt("handler.gym.started_intro", {
        costMoney: res.costMoney,
        costEnergy: res.costEnergy,
        mins
      });
      await answer(cb.id, tt("handler.gym.started_ok"));
      await locations.show(u, intro, "Gym");
      return;
    }

    if (ctx.data === "gym:skip") {
      if (u?.flags?.onboarding) {
        await answer(cb.id, tt("handler.gym.onboarding_use_free_skip"));
        await locations.show(u, null, "Gym");
        return;
      }
      const res = await ff.finishNow(u, "gym");
      if (!res.ok) {
        await answer(cb.id, res.error || tt("handler.gym.skip_failed"));
        await locations.show(u, null, "Gym");
        return;
      }
      await answer(cb.id, tt("handler.gym.skip_ok", { cost: res.cost }));
      await locations.show(u, null, "Gym");
      return;
    }

    if (ctx.data === "gym:skip_free") {
      const onboardingStep = String(u?.flags?.onboardingStep || "");
      if (!u?.flags?.onboarding || onboardingStep !== "gym_started" || u?.flags?.freeSkipUsed_gym) {
        await answer(cb.id, tt("handler.gym.skip_free_unavailable"));
        await locations.show(u, null, "Gym");
        return;
      }
      if (!u?.gym?.active) {
        await answer(cb.id, tt("handler.gym.not_active"));
        await locations.show(u, null, "Gym");
        return;
      }

      u.flags.freeSkipUsed_gym = true;
      u.gym.endAt = Math.min(Number(u?.gym?.endAt) || now(), now());
      await users.save(u);

      const finished = await gym.maybeFinish(u, async () => {});
      if (!finished) {
        await answer(cb.id, tt("handler.gym.finish_failed"));
        await locations.show(u, null, "Gym");
        return;
      }
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "gym_finish", { source: "skip_free" });
        }
      } catch {}
      try {
        if (quests?.onEvent) {
          await quests.onEvent(u, "gym_finish", { source: "skip_free" });
        }
      } catch {}

      const onboardingDone = await finishOnboardingIfNeeded();
      await answer(cb.id, tt("handler.gym.skip_free_ok"));
      if (onboardingDone) {
        if (markFunnelStep(u, "didBar")) {
          await users.save(u);
        }
        await ctx.goTo(u, "Bar", tt("worker.onboarding.done"));
      } else {
        await locations.show(u, null, "Gym");
      }
      return;
    }

    if (ctx.data === "gym:finish") {
      const endAt = u?.gym?.endAt || 0;
      if (!u?.gym?.active) {
        await answer(cb.id, tt("handler.gym.not_active"));
        await locations.show(u, null, "Gym");
        return;
      }
      if (now() < endAt) {
        await answer(cb.id, tt("handler.gym.not_ready"));
        return;
      }

      const onboardingFinish = !!(u?.flags?.onboarding && String(u?.flags?.onboardingStep || "") === "gym_started");
      const finished = onboardingFinish
        ? await gym.maybeFinish(u, async () => {})
        : await gym.maybeFinish(u, async (_u, _place, intro) => {
            await locations.show(_u, intro || tt("handler.gym.finished_intro"), "Gym");
          });

      if (!finished) {
        await answer(cb.id, tt("handler.gym.finish_failed"));
        return;
      }
      try {
        if (achievements?.onEvent) {
          await achievements.onEvent(u, "gym_finish", { source: "finish" });
        }
      } catch {}
      try {
        if (quests?.onEvent) {
          await quests.onEvent(u, "gym_finish", { source: "finish" });
        }
      } catch {}

      const onboardingDone = onboardingFinish ? await finishOnboardingIfNeeded() : false;
      await answer(cb.id, tt("handler.gym.finish_ok"));
      if (onboardingDone) {
        if (markFunnelStep(u, "didBar")) {
          await users.save(u);
        }
        await ctx.goTo(u, "Bar", tt("worker.onboarding.done"));
      }
      return;
    }
  }
};
