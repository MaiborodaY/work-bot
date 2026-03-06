// handlers/daily.js
export const dailyHandler = {
  match: (data) => data === "daily:claim",

  async handle(ctx) {
    const { u, cb, answer, daily, locations, clans } = ctx;

    // отвечаем колбэку, чтобы Telegram не ретраил
    await answer(cb.id, "");

    const res = await daily.claim(u);
    if (res.ok) {
      try {
        if (clans?.recordActiveAction) {
          await clans.recordActiveAction(u, 1, 1);
        }
      } catch {}

      await locations.show(u, `Ежедневный бонус: +$${res.amount} (стрик: ${res.streak})`);
    } else {
      await locations.show(u, "Бонус уже забран сегодня. Возвращайся завтра!");
    }
  }
};
