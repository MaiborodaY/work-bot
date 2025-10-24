// handlers/bar.js
import { BarService } from "../BarService.js";
import { CONFIG } from "../GameConfig.js";

const CHANNEL_USERNAME = "WorldOfLifeGame"; // @WorldOfLifeGame

export const barHandler = {
  match: (data) =>
    data === "go:Bar" ||
    data === "bar:tasks" ||              // ← добавили новый маршрут
    data.startsWith("bar:claim:") ||
    data === "bar:sub" ||
    data === "bar:sub:check",

  async handle(ctx) {
    const {
      data,
      u,
      cb,
      answer,
      users,
      now,
      locations,
      env,
      sendPhoto,
      sendWithInline,
      editPhotoMedia,   // <-- фикс: деструктурируем editPhotoMedia
      deleteMsg
    } = ctx;

    const bar = new BarService({ users, now });

    // const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
    // const hasBar = !!u.bar && typeof u.bar === "object";
    // const alreadyAssignedToday =
    //   hasBar &&
    //   u.bar.day === today &&
    //   u.bar.assigned === true &&
    //   Array.isArray(u.bar.tasks) &&
    //   u.bar.tasks.length > 0;

    // --- helpers ---
    const showBarMain = async () => {
      await locations.show(u, null, "Bar");
    };

    // новый helper: показать экран ежедневных заданий
    const showBarTasks = async () => {
      await locations.show(u, null, "BarTasks");
    };

    // внутри handlers/bar.js, в функции showSubScreen замени формирование kb на ik
    const showSubScreen = async () => {
      const caption =
        "🎁 Ежедневная награда за подписку\n\n" +
        "Подпишись на канал — откроется 1 бесплатный спин сегодня.\n" +
        "После использования — право исчезает до завтра.";

      // ВАЖНО: передаём ЧИСТЫЙ массив inline_keyboard, БЕЗ обёртки { inline_keyboard: ... }
      const ik = [
        [{ text: "🔗 Подписаться", url: `https://t.me/${CHANNEL_USERNAME}` }],
        [{ text: "✅ Я подписался", callback_data: "bar:sub:check" }],
        [{ text: "🍻 Назад в бар «Две Лисы»", callback_data: "go:Bar" }]
      ];

      const fileId = CONFIG?.ASSETS?.Bar;
      const msg = cb?.message;
      const chatId = msg?.chat?.id;

      try {
        if (fileId && sendPhoto) {
          // если исходник — фото и есть editPhotoMedia, пробуем редактировать
          if (msg?.photo?.length && ctx.editPhotoMedia) {
            await ctx.editPhotoMedia(msg.chat.id, msg.message_id, fileId, caption, ik);
            return;
          }
          // иначе удалим старое и пришлём новое фото с клавиатурой
          if (deleteMsg) await deleteMsg(msg.chat.id, msg.message_id).catch(() => {});
          await sendPhoto(chatId, fileId, caption, ik);
          return;
        }
      } catch (e) {
        // если что-то пошло не так с фото — фолбэк на обычное сообщение
      }
      await sendWithInline(caption, ik);
    };

    const isChannelSubscriber = async (userId) => {
      // Требуется, чтобы бот был админом/мог читать подписчиков
      try {
        const resp = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: `@${CHANNEL_USERNAME}`, user_id: userId })
        });
        const json = await resp.json().catch(() => ({}));
        const status = json?.result?.status;
        // Статусы, означающие «подписан/в чате»
        return status === "member" || status === "creator" || status === "administrator";
      } catch {
        return false;
      }
    };

// ===== Вход в Бар =====
if (data === "go:Bar") {
  await answer(cb.id);
  await bar.open(u);           // всегда гарантируем свежий пакет
  await showBarMain();
  return;
}

// ===== Переход на экран «Ежедневные задания» =====
if (data === "bar:tasks") {
  await answer(cb.id);
  await bar.open(u);           // тоже гарантируем ресет на новый день
  await showBarTasks();
  return;
}


    // ===== Экран «Награда за подписку» =====
    if (data === "bar:sub") {
      await answer(cb.id);
      await showSubScreen();
      return;
    }

// ===== Кнопка «Я подписался» =====
if (data === "bar:sub:check") {
  const subscribed = await isChannelSubscriber(u.id);
  const todayDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  if (!subscribed) {
    await answer(cb.id, "Подписка не найдена. Подпишитесь на канал и попробуйте ещё раз.");
    return;
  }

  if (u.casino?.free?.day === todayDay) {
    u.subReward = u.subReward || { day: "", eligible: false };
    u.subReward.day = todayDay;
    u.subReward.eligible = false;
    await users.save(u);
    await answer(cb.id, "Сегодня награда уже получена. Приходите завтра!");
    return;
  }

  u.subReward = u.subReward || { day: "", eligible: false };
  u.subReward.day = todayDay;
  u.subReward.eligible = true;
  await users.save(u);

  await answer(cb.id, "Готово! Бесплатный спин доступен сегодня в Казино.");
  await showSubScreen();
  return;
}


    // ===== Сдать награду по задаче бара =====
    if (data.startsWith("bar:claim:")) {
      const taskId = data.split(":")[2];
      const res = await bar.claim(u, taskId);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось выдать награду.");
        return;
      }
      await answer(cb.id, "✅ Награда получена!");
      // остаёмся на экране заданий, как договорились
      await showBarTasks();
      return;
    }
  }
};
