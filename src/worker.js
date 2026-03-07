import { CONFIG } from "./GameConfig.js";
import { TelegramClient } from "./TelegramClient.js";
import { UserStore } from "./UserStore.js";
import { EconomyService } from "./EconomyService.js";
import { CasinoEngine } from "./CasinoEngine.js";
import { Locations } from "./Locations.js";
import { UiFactory } from "./UiFactory.js";
import { Formatters } from "./Formatters.js";
import { StudyService } from "./StudyService.js";
import { AdminCommands } from "./AdminCommands.js";
import { NotificationService } from "./NotificationService.js";
import { SocialService } from "./SocialService.js";
import { ClanService } from "./ClanService.js";
import { DailyBonusService } from "./DailyBonusService.js";
import { StockService } from "./StockService.js";
import { ASSETS, JOB_ASSETS } from "./Assets.js";

// handlers test comm
import { workHandler } from "./handlers/work.js";
import { studyHandler } from "./handlers/study.js";
import { homeHandler } from "./handlers/home.js";
import { shopHandler } from "./handlers/shop.js";
import { casinoHandler } from "./handlers/casino.js";
import { gymHandler } from "./handlers/gym.js";
import { navigationHandler } from "./handlers/navigation.js";
import { upgradesHandler } from "./handlers/upgrades.js";
import { socialHandler } from "./handlers/social.js";
import { dailyHandler } from "./handlers/daily.js";
import { barHandler } from "./handlers/bar.js"; // ДОБАВИТЬ
import { businessHandler } from "./handlers/business.js"; // ➕ НОВОЕ
import { miniGamesHandler } from "./handlers/minigames.js";
import { clanHandler } from "./handlers/clan.js";
import { stocksHandler } from "./handlers/stocks.js";

// платежи Stars
import { OrdersStore as StarsOrdersStore } from "./payments/OrdersStore.js";
import { StarsService as StarsPayService } from "./payments/StarsService.js";
import { premiumHandler as premiumShopHandler } from "./payments/PremiumHandler.js";

// ник-сервис
import { NameService } from "./NameService.js";

// Gym-сервис (с прогрессией)
import { GymService } from "./GymService.js";

// Новый сервис ускоренного завершения
import { FastForwardService } from "./FastForwardService.js";

// --- Public links (RU only) ---
const PRIVACY_URL = "https://sites.google.com/view/world-of-life-privacy/";

const HELP_TEXT = `🎮 World of Life — текстовая игра про развитие и карьеру.
💰 Нажимайте кнопки, чтобы зарабатывать, учиться и тренироваться.
🛠 Команды: /start /play /help /privacy
🤝 Поддержка: @WorldOfLifeGame`;

const PRIVACY_TEXT = `🔒 Мы храним только ваш Telegram ID и прогресс в игре.
Данные нужны для сохранения аккаунта и удаляются в течение 72 часов по запросу.
Политика: ${PRIVACY_URL}`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ручной запуск нотификатора
    if (url.pathname === "/cron-run" && request.method === "GET") {
      const bot = new TelegramClient(env.BOT_TOKEN);
      const users = new UserStore(env.DB);
      const economy = new EconomyService();
      const stocks = new StockService({ db: env.DB, users, now: () => Date.now() });
      const notifier = new NotificationService({
        users,
        bot,
        db: env.DB,
        now: () => Date.now(),
        kvPrefix: "u:",
        economy,
        debug: !!env.DEBUG
      });
      await stocks.runDailyUpdate().catch(() => {});
      await notifier.run();
      return new Response("ok");
    }

    if (url.pathname === "/") return new Response("OK");
    if (url.pathname !== `/tg/${env.WEBHOOK_SECRET}` || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const update = await request.json().catch(() => ({}));
    if (!update.message && !update.callback_query && !update.pre_checkout_query) {
      return new Response("ok");
    }

    const chatId =
      update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    const userId =
      update.message?.from?.id || update.callback_query?.from?.id;

    const ui = new UiFactory();
    const bot = new TelegramClient(env.BOT_TOKEN, ui.mainReply());
    const users = new UserStore(env.DB);
    const economy = new EconomyService();
    const casino = new CasinoEngine();
    const now = () => Date.now();
    const pct = (a, b) => Math.min(100, Math.floor((a / b) * 100));

    const social = new SocialService({ db: env.DB, users, now, economy });
    const clans = new ClanService({ db: env.DB, users, now, economy });
    const stocks = new StockService({ db: env.DB, users, now });

    const orders = new StarsOrdersStore(env.DB, now);
    const stars = new StarsPayService({ botToken: env.BOT_TOKEN, orders, now });

    const send = (text, extra = {}) => bot.sendMessage(chatId, text, extra);
    const sendWithInline = (text, inline_keyboard) =>
      bot.sendWithInline(chatId, text, inline_keyboard);
    const answer = (cbId, t) => bot.answerCallback(cbId, t);
    const edit = (cbMsg, t, inline_keyboard) =>
      bot.editMessage(cbMsg.chat.id, cbMsg.message_id, t, inline_keyboard);

    // медиахелперы
    const sendPhoto = bot.sendPhoto?.bind(bot);
    const editPhotoMedia = bot.editMessageMedia?.bind(bot);
    const editPhotoCaption = bot.editMessageCaption?.bind(bot);
    const deleteMsg = bot.deleteMessage?.bind(bot);

    // универсальный media-адаптер
    const media = {
      /**
       * @param {{
       *   sourceMsg?: any,
       *   place: string,
       *   caption: string,
       *   keyboard: any,
       *   policy: "photo"|"text"|"auto",
       *   asset?: string
       * }} p
       */
      show: async (p) => {
        const { sourceMsg, place, caption, keyboard, policy } = p;
        const fileId = (p && p.asset) ? p.asset : (CONFIG.ASSETS?.[place]);
        const wantPhoto =
          policy === "photo" ||
          (policy === "auto" &&
            fileId &&
            sendPhoto &&
            (editPhotoMedia || deleteMsg));
        const isPhotoMsg =
          !!(sourceMsg && sourceMsg.photo && sourceMsg.photo.length);

        if (wantPhoto) {
          if (sourceMsg) {
            try {
              if (isPhotoMsg && editPhotoMedia) {
                await editPhotoMedia(
                  sourceMsg.chat.id,
                  sourceMsg.message_id,
                  fileId,
                  caption,
                  keyboard
                );
                return;
              }
              if (!isPhotoMsg && deleteMsg && sendPhoto) {
                await deleteMsg(sourceMsg.chat.id, sourceMsg.message_id).catch(
                  () => {}
                );
                await sendPhoto(chatId, fileId, caption, keyboard);
                return;
              }
              await edit(sourceMsg, caption, keyboard);
              return;
            } catch {
              if (sendPhoto) {
                await sendPhoto(chatId, fileId, caption, keyboard);
                return;
              }
              await sendWithInline(caption, keyboard);
              return;
            }
          } else {
            if (sendPhoto) {
              await sendPhoto(chatId, fileId, caption, keyboard);
              return;
            }
            await sendWithInline(caption, keyboard);
            return;
          }
        }

        if (sourceMsg) {
          try {
            if (isPhotoMsg && deleteMsg) {
              await deleteMsg(sourceMsg.chat.id, sourceMsg.message_id).catch(
                () => {}
              );
              await sendWithInline(caption, keyboard);
              return;
            }
            await edit(sourceMsg, caption, keyboard);
            return;
          } catch {
            await sendWithInline(caption, keyboard);
            return;
          }
        } else {
          await sendWithInline(caption, keyboard);
          return;
        }
      }
    };

    const study = new StudyService({ users, send, now, social });
    const daily = new DailyBonusService({ users, now });
    const gym = new GymService({ users, send, now, social });
    const fastForward = new FastForwardService({ users, orders, now, send });

    const locations = new Locations({
      media,
      ui,
      economy,
      formatters: Formatters,
      pct,
      now,
      maybeFinishStudy: (u) => study.maybeFinish(u, goTo),
      daily,
      // проброс автодогона тренировки
      // maybeFinishGym: (u, goToFn) => gym.maybeFinish(u, goToFn),
      // новый сервис для динамической цены кнопок
      fastForward,
      users,
      social,
      clans,
      stocks
    });

    // статлесс переход — ничего не пишем в KV
    async function goTo(u, place, intro = null) {
      if (typeof locations.setRoute === "function") {
        locations.setRoute(place);
      }
      await locations.show(u, intro, place);
    }

    // Support multiple admin IDs via env variables: ADMIN_ID, ADMIN2, ADMIN_IDS (comma/space-separated)
    const __adminIdSet = new Set(
      [
        ...String(env.ADMIN_IDS || "")
          .split(/[\s,]+/)
          .map((s) => s && String(s))
          .filter(Boolean),
        ...[env.ADMIN_ID, env.ADMIN2].filter(Boolean).map(String)
      ]
    );
    const isAdmin = (id) => __adminIdSet.has(String(id));

    const admin = new AdminCommands({
      users,
      send: (text) => send(text),
      isAdmin,
      botToken: env.BOT_TOKEN
    });

    // ===== Минимальная телеметрия оплаты =====
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      await orders.incrAgg("pre_ok", 1);
      try {
        const p = JSON.parse(pcq.invoice_payload || "{}");
        if (p && p.packId) await orders.incrAgg(`pre_ok:${p.packId}`, 1);
      } catch {}
      try {
        await bot.answerPreCheckoutQuery(pcq.id, true);
      } catch {}
      return new Response("ok");
    }

    // ---------- MESSAGES ----------
    if (update.message) {
      const text = (update.message.text || "").trim();

      // /help
      if (/^\/help(?:@\w+)?$/i.test(text)) {
        await send(HELP_TEXT);
        return new Response("ok");
      }
      // /privacy
      if (/^\/privacy(?:@\w+)?$/i.test(text)) {
        await send(PRIVACY_TEXT);
        return new Response("ok");
      }

      // /play — send game card with configured game_short_name
      if (text === "/play") {
        try {
          await bot.sendGame(chatId, env.GAME_SHORT_NAME);
        } catch {}
        return new Response("ok");
      }

      // /td — send game card with configured td_game_short_name
      if (text === "/td") {
        try {
          await bot.sendGame(chatId, env.TD_GAME_SHORT_NAME);
        } catch {}
        return new Response("ok");
      }

      const u = await users.getOrCreate(userId);

      try {
        await clans.touchDailyPresence(u);
      } catch {}

      // chatId для пушей
      if (u.chatId !== chatId) {
        u.chatId = chatId;
        await users.save(u);
      }

      // 🔹 Легаси: если ник пуст и НЕ ждём ручной ввод (от Social) — тихо автоподставим
      if (!u.displayName && !u.awaitingName) {
        const from = update.message.from || {};
        const fn = (from.first_name || "").trim();
        const ln = (from.last_name || "").trim();
        const candidates = [
          (from.username || "").trim(),
          [fn, ln].filter(Boolean).join(" ").trim(),
          fn,
          `u${String(from.id || userId).slice(-8)}`
        ].filter(Boolean);

        for (const c of candidates) {
          const cleaned = users.sanitizeForDisplayName(c, { truncate: true });
          if (cleaned) {
            const res = await users.setDisplayName(u, cleaned);
            if (res?.ok) break;
          }
        }

        if (!u.displayName) {
          u.displayName = `u${String(userId).slice(-8)}`;
          await users.save(u);
        }
      }

      // === /start: поддержка deeplink-параметра и стерильный онбординг ===
      const mStart = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/i);
      if (mStart) {
        const startPayload = (mStart[1] || "").trim();

        u.flags = u.flags || {};
        if (/^ads_/i.test(startPayload) || u.__isNew) {
          u.flags.onboarding = true;
          u.flags.onboardingStartedAt = now();
          u.flags.firstJobGemGiven = false;
        }
        if (u.flags.onboarding && !u.flags.onboardingStep) {
          u.flags.onboardingStep = "first_job";
        }

        u.awaitingName = false;
        u.awaitingClanName = false;
        u.afterNameRoute = "";
        await users.save(u);

        try {
          await bot.sendMessage(chatId, " ", {
            reply_markup: { remove_keyboard: true }
          });
        } catch {}

        const onboardingWelcome =
          "👋 Привет! Это World of Life.\n\n" +
          "Первые шаги:\n" +
          "1) ▶️ Запусти первую минутную смену и получи $ и 1 кристалл.\n" +
          "2) 💰 Забери награду.\n" +
          "3) 🏋️ Зайди в зал и вложи награду в энергию.\n\n" +
          "✨ Пока ты новичок, показываем только нужные кнопки.";
        try {
          await bot.sendMessage(chatId, onboardingWelcome);
        } catch {}

        await goTo(u, "Square");
        return new Response("ok");
      }

      // Никнейм: если ждём ввода — перехватываем
      if (u.awaitingName) {
        const ns = new NameService({ users });
        const textMsg = (update.message.text || "").trim();

        if (!textMsg || textMsg.startsWith("/")) {
          await ns.prompt(send);
          return new Response("ok");
        }

        const res = await ns.tryHandleText(u, textMsg);
        if (!res.ok) {
          await ns.prompt(send, res.error);
          return new Response("ok");
        }

        const route = u.afterNameRoute || "Square";
        u.afterNameRoute = "";
        u.awaitingName = false;
        await users.save(u);

        await goTo(u, route, `✔ Ник установлен: ${u.displayName}`);
        return new Response("ok");
      }

      // Название клана: если ждём ввода — перехватываем
      if (u.awaitingClanName) {
        const textMsg = (update.message.text || "").trim();
        if (!textMsg || textMsg.startsWith("/")) {
          await send(
            "✍️ Введи название клана одним сообщением (2-24 символа). " +
              "Можно буквы, цифры, пробел, _ . -"
          );
          return new Response("ok");
        }

        const res = await clans.createClan(u, textMsg);
        if (!res.ok) {
          await send(`⚠️ ${res.error || "Не удалось создать клан."}`);
          return new Response("ok");
        }

        await goTo(u, "Clan", `✅ Клан создан: ${res.clan?.name || ""}`);
        return new Response("ok");
      }

      // успешная оплата Stars (с учётом бонусов пакета и First Purchase ×2)
      if (update.message.successful_payment) {
        const sp = update.message.successful_payment;
        const chargeId =
          sp.telegram_payment_charge_id ||
          sp.provider_payment_charge_id ||
          "";
        const payloadRaw = sp.invoice_payload || "";
        let parsed = null;
        try {
          parsed = JSON.parse(payloadRaw || "{}");
        } catch {}

        const existed = chargeId ? await orders.getTx(chargeId) : null;
        if (!existed) {
          // пытаемся найти пакет, чтобы понять базу и бонус %
          const packs = Array.isArray(CONFIG.PREMIUM?.PACKS)
            ? CONFIG.PREMIUM.PACKS
            : [];
          const pack = packs.find(
            (p) => String(p.id) === String(parsed?.packId)
          );
          let credited = 0;

          if (pack) {
            const base = Number(pack.gems) || 0;
            const pctBonus = Number(pack.bonusPct || 0);
            const bonus = Math.ceil((base * pctBonus) / 100);
            credited = base + bonus;
            if (!u.firstPurchaseBonusUsed) {
              credited *= 2;
              u.firstPurchaseBonusUsed = true;
            }
          } else {
            // Fallback: если пакет не нашли, кредитим "как раньше"
            credited = Number(sp.total_amount) || 0;
          }

          await orders.incrAgg("success_any", 1);
          if (credited > 0) await orders.incrAgg("gems_any", credited);
          if (parsed?.packId) {
            await orders.incrAgg(`success:${parsed.packId}`, 1);
            if (credited > 0)
              await orders.incrAgg(`gems:${parsed.packId}`, credited);
          }

          u.premium = (u.premium || 0) + credited;
          await users.save(u);

          await orders.saveTx({
            chargeId,
            userId: u.id,
            packId: parsed?.packId || "unknown",
            gems: credited,
            status: "applied",
            ts: now(),
            invoiceId: parsed?.nonce || ""
          });

          await send(
            `✔ Оплата прошла!\nЗачислено: ${CONFIG.PREMIUM.emoji}${credited}\nБаланс: ${CONFIG.PREMIUM.emoji}${u.premium}`
          );
        } else {
          await send("✔ Платёж уже был учтён. Спасибо!");
        }
        return new Response("ok");
      }


      // админ-команды
      if (
        await admin.tryHandle(text, {
          fromId: userId,
          chatId,
          message: update.message,
          waitUntil: (p) => ctx.waitUntil(p)
        })
      )
        return new Response("ok");

      if (text === "/reset") {
        await bot.sendMessage(chatId, "Сбрасываю клавиатуру…", {
          reply_markup: { remove_keyboard: true }
        });
        if (u.study) u.study.active = false;
        if (u.rest) u.rest.active = false;
        if (u.gym) u.gym.active = false;
        if (u.events) u.events.__workCycleHit = false;
        if (u.notify) u.notify.workCycleNotified = false;
        u.buffs = {};
        await users.save(u);
        await goTo(
          u,
          "Square",
          "Сброс: остановили таймеры, возвращаем на Площадь."
        );
        await bot.sendMessage(chatId, "Готово. Клавиатура обновлена.");
        return new Response("ok");
      }

      if (text === "Меню" || text === "🧭 Меню") {
        await goTo(u, "Square");
        return new Response("ok");
      }

      if (text === "Профиль" || text === "👤 Профиль") {
        const clan = await clans.getClanForUser(u).catch(() => null);
        const clanName = clan?.name ? String(clan.name) : "";
        const clanWeekKey = await clans.ensureWeek().catch(() => "");
        const statusText = Formatters.status(u, { economy, now, pct, clanName, clanWeekKey });
        await send(statusText);
        return new Response("ok");
      }

      await locations.show(u, "👇 Используйте кнопки ниже для действий.");
      return new Response("ok");
    }

    // ---------- CALLBACKS ----------
    if (update.callback_query) {
      const cb = update.callback_query;

      // Game callback: answer with URL to open the game on Pages
      if (
        cb.game_short_name &&
        cb.game_short_name === (env.GAME_SHORT_NAME || "")
      ) {
        const payload = cb.inline_message_id
          ? {
              user_id: cb.from.id,
              inline_message_id: cb.inline_message_id
            }
          : {
              user_id: cb.from.id,
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id
            };

        const p = btoa(JSON.stringify(payload));
        const base = String(env.PAGES_URL || "").replace(/\/+$/, "");
        const openUrl = `${base}/?p=${encodeURIComponent(p)}`;
        try {
          await bot.answerCallbackUrl(cb.id, openUrl);
        } catch {}
        return new Response("ok");
      }

      // 🔹 НОВОЕ: поддержка TD-игры
      if (
        cb.game_short_name &&
        cb.game_short_name === (env.TD_GAME_SHORT_NAME || "")
      ) {
        const payload = cb.inline_message_id
          ? {
              user_id: cb.from.id,
              inline_message_id: cb.inline_message_id
            }
          : {
              user_id: cb.from.id,
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id
            };

        const p = btoa(JSON.stringify(payload));
        // можно завести отдельный TD_PAGES_URL; если нет — используем общий PAGES_URL
        const baseTd = String(
          env.TD_PAGES_URL || env.PAGES_URL || ""
        ).replace(/\/+$/, "");
        const openUrlTd = `${baseTd}/?p=${encodeURIComponent(p)}`;
        try {
          await bot.answerCallbackUrl(cb.id, openUrlTd);
        } catch {}
        return new Response("ok");
      }

      const data = cb.data || "";
      const u = await users.getOrCreate(cb.from.id);

      try {
        await clans.touchDailyPresence(u);
      } catch {}

      // подстрахуем chatId
      if (u.chatId !== chatId) {
        u.chatId = chatId;
        await users.save(u);
      }

      // 🔹 Легаси: если ник пуст и не ждём ручной ввод — автоподстановка
      if (!u.displayName && !u.awaitingName) {
        const from = cb.from || {};
        const fn = (from.first_name || "").trim();
        const ln = (from.last_name || "").trim();
        const candidates = [
          (from.username || "").trim(),
          [fn, ln].filter(Boolean).join(" ").trim(),
          fn,
          `u${String(from.id || userId).slice(-8)}`
        ].filter(Boolean);

        for (const c of candidates) {
          const cleaned = users.sanitizeForDisplayName(c, { truncate: true });
          if (cleaned) {
            const res = await users.setDisplayName(u, cleaned);
            if (res?.ok) break;
          }
        }

        if (!u.displayName) {
          u.displayName = `u${String(userId).slice(-8)}`;
          await users.save(u);
        }
      }

      // 🔒 Если ждём ник — разрешаем только навигацию go:* как «выход/отмена», иначе снова показываем промпт
      if (u.awaitingName) {
        // ✔ Разрешённый выход: любые кнопки навигации (например, "⬅️ На Площадь" → go:Square)
        if (data && data.startsWith("go:")) {
          const target = data.split(":")[1] || "Square";
          u.awaitingName = false; // выходим из режима ввода
          u.afterNameRoute = "";  // чистим маршрут возврата
          await users.save(u);
          await goTo(u, target);
          return new Response("ok");
        }

        // ✖ Любые другие нажатия — продолжаем просить ник
        const ns = new NameService({ users });
        await ns.prompt(send);
        return new Response("ok");
      }

      // Если ждём название клана — разрешаем только выход через go:*
      if (u.awaitingClanName) {
        if (data && data.startsWith("go:")) {
          const target = data.split(":")[1] || "Square";
          u.awaitingClanName = false;
          await users.save(u);
          await goTo(u, target);
          return new Response("ok");
        }

        await answer(cb.id, "Сначала отправь название клана сообщением.");
        await locations.media.show({
          sourceMsg: locations._sourceMsg || cb.message,
          place: "CityBoard",
          caption:
            "✍️ Введи название клана одним сообщением.\n" +
            "Длина: 2-24 символа.\n" +
            "Можно буквы, цифры, пробел, _ . -",
          keyboard: [[{ text: "⬅️ Отмена", callback_data: "go:Clan" }]],
          policy: "auto"
        });
        locations.setSourceMessage(null);
        return new Response("ok");
      }

      // автозавершение по любому клику
      if (cb.message) {
        locations.setSourceMessage(cb.message);
      }

      const ctxObj = {
        data,
        u,
        cb,
        env,
        answer,
        edit,
        users,
        locations,
        economy,
        casino,
        now,
        pct,
        goTo,
        sendWithInline,
        bot,
        send,
        // сырьевые медиа-функции
        sendPhoto,
        editPhotoMedia,
        editPhotoCaption,
        deleteMsg,
        // новое
        daily,
        // сервисы
        study,
        fastForward,
        // соц
        social,
        clans,
        stocks,
        // ui
        ui,
        // payments
        chatId,
        orders,
        stars
      };

      // Minimal set during onboarding: navigation + work only
      const FULL_HANDLERS = [
        navigationHandler,
        clanHandler,
        premiumShopHandler,
        socialHandler,
        barHandler,
        dailyHandler,
        miniGamesHandler,
        workHandler,
        businessHandler,
        stocksHandler,
        studyHandler,
        homeHandler,
        shopHandler,
        casinoHandler,
        gymHandler,
        upgradesHandler
      ];

      const baseHandlers = [navigationHandler, workHandler];

      let handlers;
      if (u?.flags?.onboarding) {
        handlers = [...baseHandlers];
        if (u.flags.onboardingStep === "go_gym") {
          handlers.push(gymHandler);
        }
      } else {
        handlers = FULL_HANDLERS;
      }

      for (const h of handlers) {
        if (h.match(data)) {
          await h.handle(ctxObj);
          return new Response("ok");
        }
      }

      await locations.show(u);
      return new Response("ok");
    }

    return new Response("ok");
  },

  // ====== КРОН ======
  async scheduled(event, env, ctx) {
    const bot = new TelegramClient(env.BOT_TOKEN);
    const users = new UserStore(env.DB);
    const economy = new EconomyService();
    const stocks = new StockService({ db: env.DB, users, now: () => Date.now() });

    const notifier = new NotificationService({
      users,
      bot,
      db: env.DB,
      now: () => Date.now(),
      kvPrefix: "u:",
      economy,
      debug: !!env.DEBUG
    });
    ctx.waitUntil(Promise.allSettled([stocks.runDailyUpdate(), notifier.run()]));
  }
};
