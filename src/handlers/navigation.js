// handlers/navigation.js
import { parseGoRoute, Routes } from "../Routes.js";

export const navigationHandler = {
  match: (data) => data.startsWith("go:"),

  async handle(ctx) {
    const { data, u, goTo } = ctx;
    const place = parseGoRoute(data) || Routes.SQUARE;

    // Разрешаем свободную навигацию без проверок занятости.
    // Активности (работа/учёба/отдых…) продолжаются в фоне,
    // а их прогресс и возможное авто-завершение уже обрабатываются в Locations.show().
    if (u?.flags?.onboarding) {
      const step = u.flags.onboardingStep || "";
      const allowed =
        (step === "go_gym" || step === "gym_started")
          ? new Set([Routes.SQUARE, Routes.WORK, Routes.GYM])
          : new Set([Routes.SQUARE, Routes.WORK]);
      if (!allowed.has(place)) {
        await goTo(u, Routes.SQUARE);
        return;
      }
    }
    await goTo(u, place);
  }
};

