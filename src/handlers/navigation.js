// handlers/navigation.js
export const navigationHandler = {
  match: (data) => data.startsWith("go:"),

  async handle(ctx) {
    const { data, u, goTo } = ctx;
    const place = data.split(":")[1] || "Square";

    // Разрешаем свободную навигацию без проверок занятости.
    // Активности (работа/учёба/отдых…) продолжаются в фоне,
    // а их прогресс и возможное авто-завершение уже обрабатываются в Locations.show().
    if (u?.flags?.onboarding) {
      const step = u.flags.onboardingStep || "";
      const allowed =
        step === "go_gym"
          ? new Set(["Square", "Work", "Gym"])
          : new Set(["Square", "Work"]);
      if (!allowed.has(place)) {
        await goTo(u, "Square");
        return;
      }
    }
    await goTo(u, place);
  }
};
