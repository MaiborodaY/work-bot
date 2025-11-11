// handlers/navigation.js
export const navigationHandler = {
  match: (data) => data.startsWith("go:"),

  async handle(ctx) {
    const { data, u, goTo } = ctx;
    const place = data.split(":")[1] || "Square";

    // Разрешаем свободную навигацию без проверок занятости.
    // Активности (работа/учёба/отдых) продолжаются в фоне,
    // а их прогресс и возможное авто-завершение уже обрабатываются в Locations.show().
    if (u?.flags?.onboarding && place !== "Square" && place !== "Work") {
      await goTo(u, "Square");
      return;
    }
    await goTo(u, place);
  }
};
