// handlers/minigames.js
export const miniGamesHandler = {
  match: (data) => data === "game:runner" || data === "game:td",

  async handle(ctx) {
    const { data, cb, env, chatId, bot, answer, send } = ctx;

    const isTowerDefense = data === "game:td";
    const shortName = isTowerDefense ? env.TD_GAME_SHORT_NAME : env.GAME_SHORT_NAME;
    const fallbackCmd = isTowerDefense ? "/td" : "/play";

    await answer(cb.id);

    if (!shortName) {
      await send("Мини-игра временно недоступна. Попробуй позже.");
      return;
    }

    try {
      await bot.sendGame(chatId, shortName);
    } catch {
      await send(`Не удалось открыть игру. Попробуй команду ${fallbackCmd}.`);
    }
  }
};
