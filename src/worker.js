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
import { ChannelService } from "./ChannelService.js";
import { ClanService } from "./ClanService.js";
import { DailyBonusService } from "./DailyBonusService.js";
import { StockService } from "./StockService.js";
import { LabourService } from "./LabourService.js";
import { ThiefService } from "./ThiefService.js";
import { ReferralService } from "./ReferralService.js";
import { AchievementService } from "./AchievementService.js";
import { RatingService } from "./RatingService.js";
import { QuestService } from "./QuestService.js";
import { PetService } from "./PetService.js";
import { FarmService } from "./FarmService.js";
import { QuizService } from "./QuizService.js";
import { GeneralQuizService } from "./GeneralQuizService.js";
import { ASSETS, JOB_ASSETS } from "./Assets.js";
import { normalizeLang, t } from "./i18n/index.js";
import { safeCall } from "./SafeCall.js";

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
import { labourHandler } from "./handlers/labour.js";
import { thiefHandler } from "./handlers/thief.js";
import { referralHandler } from "./handlers/referral.js";
import { ratingsHandler } from "./handlers/ratings.js";
import { petHandler } from "./handlers/pet.js";
import { farmHandler } from "./handlers/farm.js";
import { quizHandler } from "./handlers/quiz.js";
import { generalQuizHandler } from "./handlers/generalQuiz.js";
import { energyHandler } from "./handlers/energy.js";

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

const helpText = (lang) => t("worker.help", normalizeLang(lang || "en"));
const privacyText = (lang) => t("worker.privacy", normalizeLang(lang || "en"), { url: PRIVACY_URL });

const LANG_OPTIONS = [
  { code: "ru", label: "🇷🇺 Русский" },
  { code: "uk", label: "🇺🇦 Українська" },
  { code: "en", label: "🇬🇧 English" }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ручной запуск нотификатора
    if (url.pathname === "/cron-run" && request.method === "GET") {
      const bot = new TelegramClient(env.BOT_TOKEN);
      const users = new UserStore(env.DB);
      const economy = new EconomyService();
      const ratings = new RatingService({ db: env.DB, users, now: () => Date.now() });
      const achievements = new AchievementService({ users, db: env.DB, now: () => Date.now(), bot, ratings });
      const quests = new QuestService({ users, now: () => Date.now(), bot });
      const social = new SocialService({ db: env.DB, users, now: () => Date.now(), economy });
      const stocks = new StockService({ db: env.DB, users, now: () => Date.now(), achievements, quests });
      const labour = new LabourService({ db: env.DB, users, now: () => Date.now(), bot, quests });
      const thief = new ThiefService({ db: env.DB, users, now: () => Date.now(), bot, achievements, ratings, quests });
      const channel = new ChannelService({
        db: env.DB,
        bot,
        social,
        ratings,
        thief,
        now: () => Date.now(),
        channelId: env.CHANNEL_ID,
        playUrl: CONFIG?.CHANNEL?.PLAY_URL
      });
      const pet = new PetService({ db: env.DB, users, now: () => Date.now(), bot, quests, achievements });
      const farm = new FarmService({ db: env.DB, users, now: () => Date.now(), bot, quests, achievements, social });
      const notifier = new NotificationService({
        users,
        bot,
        db: env.DB,
        now: () => Date.now(),
        kvPrefix: "u:",
        economy,
        debug: !!env.DEBUG
      });
      await safeCall("worker.cron.stocks_daily_update", async () => {
        await stocks.runDailyUpdate();
      });
      await safeCall("worker.cron.thief.resolve_expired", async () => {
        await thief.resolveExpired();
      });
      await safeCall("worker.cron.thief.resolve_protection_expirations", async () => {
        await thief.resolveProtectionExpirations();
      });
      await safeCall("worker.cron.labour.run_due_expirations", async () => {
        await labour.runDueExpirations();
      });
      await safeCall("worker.cron.pet.daily_tick", async () => {
        await pet.dailyTick();
      });
      await safeCall("worker.cron.farm.daily_tick", async () => {
        await farm.dailyTick();
      });
      await safeCall("worker.cron.social.ensure_period", async () => {
        await social.ensurePeriod();
      });
      await safeCall("worker.cron.channel.run_scheduled", async () => {
        await channel.runScheduled();
      });
      await notifier.run();
      return new Response("ok");
    }

    if (url.pathname === "/") return new Response("OK");
    if (url.pathname !== `/tg/${env.WEBHOOK_SECRET}` || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const update = await safeCall("worker.update.parse_json", async () => {
      return await request.json();
    }, { fallback: {} });
    if (!update.message && !update.callback_query && !update.pre_checkout_query) {
      return new Response("ok");
    }

    const chatId =
      update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    const userId =
      update.message?.from?.id || update.callback_query?.from?.id;

    const ui = new UiFactory();
    const bot = new TelegramClient(env.BOT_TOKEN, ui.mainReply("en"));
    const users = new UserStore(env.DB);
    const economy = new EconomyService();
    const casino = new CasinoEngine();
    const now = () => Date.now();
    const pct = (a, b) => Math.min(100, Math.floor((a / b) * 100));

    const ratings = new RatingService({ db: env.DB, users, now });
    const achievements = new AchievementService({ users, db: env.DB, now, bot, ratings });
    const quests = new QuestService({ users, now, bot });
    const quiz = new QuizService({ users, now, bot, quests, achievements });
    const generalQuiz = new GeneralQuizService({ users, now, bot });
    const social = new SocialService({ db: env.DB, users, now, economy });
    const clans = new ClanService({ db: env.DB, users, now, economy, achievements });
    const stocks = new StockService({ db: env.DB, users, now, achievements, quests });
    const labour = new LabourService({ db: env.DB, users, now, bot, quests });
    const thief = new ThiefService({ db: env.DB, users, now, bot, achievements, ratings, quests });
    const channel = new ChannelService({
      db: env.DB,
      bot,
      social,
      ratings,
      thief,
      now,
      channelId: env.CHANNEL_ID,
      playUrl: CONFIG?.CHANNEL?.PLAY_URL
    });
    const pet = new PetService({ db: env.DB, users, now, bot, quests, achievements });
    const farm = new FarmService({ db: env.DB, users, now, bot, quests, achievements, social });
    const referrals = new ReferralService({
      users,
      now,
      bot,
      botUsername: env.BOT_USERNAME,
      achievements
    });

    const orders = new StarsOrdersStore(env.DB, now);
    const stars = new StarsPayService({ botToken: env.BOT_TOKEN, orders, now });

    let replyLang = "en";
    let send = (text, extra = {}) => bot.sendMessage(chatId, text, {
      reply_markup: ui.mainReply(replyLang),
      ...extra
    });
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
        const fileCandidates = [];
        const preferredAsset = (p && p.asset) ? String(p.asset) : "";
        const placeAsset = String(CONFIG.ASSETS?.[place] || "");
        if (preferredAsset) fileCandidates.push(preferredAsset);
        if (placeAsset && placeAsset !== preferredAsset) fileCandidates.push(placeAsset);
        const fileId = fileCandidates[0] || "";
        const canUsePhoto = !!(sendPhoto && fileCandidates.length);
        const safePhotoCaption = (fullCaption) => {
          const text = String(fullCaption || "");
          if (!text) return " ";
          const firstLine = String(text.split("\n")[0] || "").trim() || " ";
          return firstLine.slice(0, 1024);
        };
        const sendPhotoOrFallback = async () => {
          if (!canUsePhoto) {
            await sendWithInline(caption, keyboard);
            return;
          }
          // Telegram photo captions are capped at 1024 chars.
          const tooLongCaption = String(caption || "").length > 1024;
          if (tooLongCaption) {
            for (const candidate of fileCandidates) {
              try {
                await sendPhoto(chatId, candidate, safePhotoCaption(caption), undefined);
                break;
              } catch {}
            }
            await sendWithInline(caption, keyboard);
            return;
          }
          try {
            for (const candidate of fileCandidates) {
              try {
                await sendPhoto(chatId, candidate, caption, keyboard);
                return;
              } catch {}
            }
            await sendWithInline(caption, keyboard);
          } catch {
            await sendWithInline(caption, keyboard);
          }
        };
        const wantPhoto =
          policy === "photo" ||
          (policy === "auto" &&
            canUsePhoto &&
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
              if (deleteMsg && sourceMsg?.chat?.id && sourceMsg?.message_id) {
                await deleteMsg(sourceMsg.chat.id, sourceMsg.message_id).catch(
                  () => {}
                );
              }
              await sendPhotoOrFallback();
              return;
            }
          } else {
            await sendPhotoOrFallback();
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
    const daily = new DailyBonusService({ users, now, quests });
    const gym = new GymService({ users, send, now, social, labour });
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
      stocks,
      labour,
      farm,
      pet,
      ratings,
      thief,
      referrals,
      quests
    });

    // статлесс переход — ничего не пишем в KV
    async function goTo(u, place, intro = null) {
      if (typeof locations.setRoute === "function") {
        locations.setRoute(place);
      }
      await locations.show(u, intro, place);
    }

    const profileLangButtonText = (u) => {
      const lang = normalizeLang(u?.lang || "en");
      return t("profile.lang.button", lang, { lang: lang.toUpperCase() });
    };

    const langOptionLabel = (code) => {
      const found = LANG_OPTIONS.find((x) => x.code === code);
      return found ? found.label : code.toUpperCase();
    };

    const menuLabelSet = new Set([
      "Меню",
      "🧭 Меню",
      "Menu",
      "🧭 Menu",
      ...LANG_OPTIONS.map((x) => t("ui.reply.menu", x.code))
    ]);
    const profileLabelSet = new Set([
      "Профиль",
      "👤 Профиль",
      "Profile",
      "👤 Profile",
      ...LANG_OPTIONS.map((x) => t("ui.reply.profile", x.code))
    ]);

    const startLangPickerText = (lang) => {
      const l = normalizeLang(lang || "en");
      return `${t("worker.start.lang_pick", l)}\n\n${t("worker.start.lang_pick_hint", l)}`;
    };

    const buildLangPickerKeyboard = (lang, { prefix = "profile:lang:set:", withBack = false } = {}) => {
      const l = normalizeLang(lang || "en");
      const kb = LANG_OPTIONS.map((opt) => {
        const mark = opt.code === l ? " ✅" : "";
        return [{ text: `${opt.label}${mark}`, callback_data: `${prefix}${opt.code}` }];
      });
      if (withBack) kb.push([{ text: t("worker.btn.back", l), callback_data: "profile:back" }]);
      return kb;
    };

    async function renderProfile(u, sourceMsg = null) {
      const clan = await safeCall("worker.profile.get_clan", async () => {
        return await clans.getClanForUser(u);
      }, { fallback: null });
      const clanName = clan?.name ? String(clan.name) : "";
      const clanWeekKey = await safeCall("worker.profile.ensure_week", async () => {
        return await clans.ensureWeek();
      }, { fallback: "" });
      const employmentLine = await safeCall("worker.profile.employment_line", async () => {
        return await labour.buildProfileEmploymentLine(u);
      }, { fallback: "" });
      const statusText = Formatters.status(u, { economy, now, pct, clanName, clanWeekKey, employmentLine });
      const lang = normalizeLang(u?.lang || "en");
      const achievementsBtn = lang === "en"
        ? "🏆 Achievements"
        : (lang === "uk" ? "🏆 Досягнення" : "🏆 Достижения");
      const kb = [
        [{ text: achievementsBtn, callback_data: "profile:achievements" }],
        [{ text: profileLangButtonText(u), callback_data: "profile:lang" }]
      ];
      if (sourceMsg) {
        const edited = await safeCall("worker.profile.edit", async () => {
          await edit(sourceMsg, statusText, kb);
          return true;
        }, { fallback: false });
        if (edited) return;
      }
      await sendWithInline(statusText, kb);
    }

    const profileSourceToCallback = (srcToken) => {
      const s = String(srcToken || "").trim().toLowerCase();
      if (!s) return "go:CityBoard";
      if (s === "day") return "city:topday";
      if (s === "week") return "city:topweek";
      if (s === "smart") return "city:topsmart";
      if (s === "strong") return "city:topstrong";
      if (s === "lucky") return "city:toplucky";
      if (s === "farmweek") return "city:topfarmweek";
      if (s === "farmall") return "city:topfarmall";
      if (s === "rating") return "go:Ratings";
      return "go:CityBoard";
    };

    async function renderPublicProfile(viewer, targetId, sourceToken = "", sourceMsg = null) {
      const lang = normalizeLang(viewer?.lang || "en");
      const target = await users.load(targetId).catch(() => null);
      if (!target) {
        return null;
      }
      if (String(target.id || "") === String(viewer.id || "")) {
        await renderProfile(viewer, sourceMsg);
        return { renderedSelf: true };
      }

      let clanName = "";
      const targetClan = await safeCall("worker.profile.public.get_clan", async () => {
        return await clans.getClanForUser(target);
      }, { fallback: null });
      clanName = String(targetClan?.name || "");

      const bizOwned = Array.isArray(target?.biz?.owned) ? target.biz.owned : [];
      let bizCount = 0;
      let slotsCount = 0;
      for (const b of bizOwned) {
        const id = String(typeof b === "string" ? b : b?.id || "");
        if (id) bizCount += 1;
        if (b && typeof b === "object" && Array.isArray(b.slots)) {
          slotsCount += b.slots.filter((s) => !!s?.purchased).length;
        }
      }

      const preview = achievements?.buildPublicSummary
        ? achievements.buildPublicSummary(target, lang, 8)
        : { totalDone: 0, lines: [], more: 0 };

      const name = String(target?.displayName || "").trim() || `u${String(target?.id || "").slice(-4).padStart(4, "0")}`;
      const money = Math.max(0, Math.floor(Number(target?.money) || 0));
      const energy = Math.max(0, Math.floor(Number(target?.energy) || 0));
      const energyMax = Math.max(0, Math.floor(Number(target?.energy_max) || 0));
      const stolen = Math.max(0, Math.floor(Number(target?.thief?.totalStolen || target?.achievements?.progress?.totalStolen) || 0));
      const hideMoneyInPublicProfile = true;

      const lines = [];
      if (lang === "en") {
        lines.push(`👤 ${name}`);
        lines.push("");
        lines.push(`💰 $${money} · ⚡ ${energy}/${energyMax}`);
        lines.push(`🏢 Businesses: ${bizCount} · Slots: ${slotsCount}${clanName ? ` · 🤝 ${clanName}` : ""}`);
        lines.push(`🎖️ Achievements: ${preview.totalDone} · 🌑 Stolen: $${stolen}`);
        lines.push("");
        lines.push("🏆 Recent achievements:");
      } else if (lang === "uk") {
        lines.push(`👤 ${name}`);
        lines.push("");
        lines.push(`💰 $${money} · ⚡ ${energy}/${energyMax}`);
        lines.push(`🏢 Бізнесів: ${bizCount} · Слотів: ${slotsCount}${clanName ? ` · 🤝 ${clanName}` : ""}`);
        lines.push(`🎖️ Досягнень: ${preview.totalDone} · 🌑 Вкрадено: $${stolen}`);
        lines.push("");
        lines.push("🏆 Останні досягнення:");
      } else {
        lines.push(`👤 ${name}`);
        lines.push("");
        lines.push(`💰 $${money} · ⚡ ${energy}/${energyMax}`);
        lines.push(`🏢 Бизнесов: ${bizCount} · Слотов: ${slotsCount}${clanName ? ` · 🤝 ${clanName}` : ""}`);
        lines.push(`🎖️ Ачивок: ${preview.totalDone} · 🌑 Украдено: $${stolen}`);
        lines.push("");
        lines.push("🏆 Последние достижения:");
      }

      if (hideMoneyInPublicProfile && lines.length >= 3) {
        lines[2] = `⚡ ${energy}/${energyMax}`;
      }

      if (preview.lines.length) {
        lines.push(...preview.lines);
      } else {
        lines.push(lang === "en"
          ? "No completed achievements yet."
          : (lang === "uk" ? "Поки немає виконаних досягнень." : "Пока нет выполненных достижений."));
      }
      if (preview.more > 0) {
        lines.push(lang === "en"
          ? `… and ${preview.more} more`
          : (lang === "uk" ? `… і ще ${preview.more}` : `… и ещё ${preview.more}`));
      }

      const backCb = profileSourceToCallback(sourceToken);
      const backText = lang === "en"
        ? "⬅️ Back to rating"
        : (lang === "uk" ? "⬅️ Назад до рейтингу" : "⬅️ Назад к рейтингу");
      const kb = [[{ text: backText, callback_data: backCb }]];

      if (sourceMsg) {
        const edited = await safeCall("worker.profile.public.edit", async () => {
          await edit(sourceMsg, lines.join("\n"), kb);
          return true;
        }, { fallback: false });
        if (edited) return { rendered: true };
      }
      await sendWithInline(lines.join("\n"), kb);
      return { rendered: true };
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
      botToken: env.BOT_TOKEN,
      ratings,
      quiz,
      channel
    });

    // ===== Минимальная телеметрия оплаты =====
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      await orders.incrAgg("pre_ok", 1);
      const p = await safeCall("worker.pre_checkout.parse_payload", async () => {
        return JSON.parse(pcq.invoice_payload || "{}");
      }, { fallback: null });
      if (p && p.packId) await orders.incrAgg(`pre_ok:${p.packId}`, 1);
      await safeCall("worker.pre_checkout.answer", async () => {
        await bot.answerPreCheckoutQuery(pcq.id, true);
      });
      return new Response("ok");
    }

    // ---------- MESSAGES ----------
    if (update.message) {
      const text = (update.message.text || "").trim();

      // /help
      if (/^\/help(?:@\w+)?$/i.test(text)) {
        await send(helpText(update?.message?.from?.language_code || "en"));
        return new Response("ok");
      }
      // /privacy
      if (/^\/privacy(?:@\w+)?$/i.test(text)) {
        await send(privacyText(update?.message?.from?.language_code || "en"));
        return new Response("ok");
      }

      // /play — send game card with configured game_short_name
      if (text === "/play") {
        await safeCall("worker.cmd.play", async () => {
          await bot.sendGame(chatId, env.GAME_SHORT_NAME);
        });
        return new Response("ok");
      }

      // /td — send game card with configured td_game_short_name
      if (text === "/td") {
        await safeCall("worker.cmd.td", async () => {
          await bot.sendGame(chatId, env.TD_GAME_SHORT_NAME);
        });
        return new Response("ok");
      }

      const u = await users.getOrCreate(userId);

      await safeCall("worker.message.touch_daily_presence", async () => {
        await clans.touchDailyPresence(u);
      });

      let shouldSaveMeta = false;
      if (u.chatId !== chatId) {
        u.chatId = chatId;
        shouldSaveMeta = true;
      }
      if (!u.lang) {
        const detectedLang = normalizeLang(update?.message?.from?.language_code || "");
        u.lang = detectedLang;
        shouldSaveMeta = true;
      }
      // One-time migration for legacy stuck onboarding (pre-v2 flow).
      // Legacy users with onboarding=true and no v2 marker are released immediately.
      u.flags = (u.flags && typeof u.flags === "object") ? u.flags : {};
      if (u.flags.onboarding && !u.flags.onboardingFlowV2) {
        u.flags.onboarding = false;
        u.flags.onboardingDone = true;
        u.flags.onboardingStep = "done";
        u.flags.freeSkipUsed_work = false;
        u.flags.freeSkipUsed_gym = false;
        shouldSaveMeta = true;
      }
      if (shouldSaveMeta) {
        await users.save(u);
      }
      replyLang = normalizeLang(u?.lang || "en");
      await safeCall("worker.message.achievements.retro", async () => {
        if (achievements?.retroCheck) {
          await achievements.retroCheck(u);
        }
      });

      // 🔹 Легаси: если ник пуст и НЕ ждём ручной ввод (от Social) — тихо автоподставим
      if (!u.displayName && !u.awaitingName) {
        let nameChanged = false;
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
            if (res?.ok) {
              nameChanged = true;
              break;
            }
          }
        }

        if (!u.displayName) {
          u.displayName = `u${String(userId).slice(-8)}`;
          await users.save(u);
          nameChanged = true;
        }

        if (nameChanged) {
          await safeCall("worker.message.labour_upsert_name_changed", async () => {
            await labour.upsertFreePlayer(u);
          });
        }
      }

      // === /start: поддержка deeplink-параметра и стерильный онбординг ===
      const mStart = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/i);
      if (mStart) {
        const startPayload = (mStart[1] || "").trim();
        await safeCall("worker.start.bind_referral_payload", async () => {
          if (referrals && typeof referrals.bindFromStartPayload === "function") {
            await referrals.bindFromStartPayload(u, startPayload);
          }
        });

        u.flags = u.flags || {};
        if (u.__isNew) {
          u.lang = "en";
          u.flags.onboarding = true;
          u.flags.onboardingDone = false;
          u.flags.onboardingStartedAt = now();
          u.flags.firstJobGemGiven = false;
          u.flags.onboardingFlowV2 = true;
          u.flags.freeSkipUsed_work = false;
          u.flags.freeSkipUsed_gym = false;
          u.flags.awaitingLangPick = true;
        }
        if (u.flags.onboarding && !u.flags.onboardingStep) {
          u.flags.onboardingStep = "first_job";
        }

        u.awaitingName = false;
        u.awaitingClanName = false;
        u.afterNameRoute = "";
        await users.save(u);

        await safeCall("worker.start.remove_reply_keyboard", async () => {
          await bot.sendMessage(chatId, " ", {
            reply_markup: { remove_keyboard: true }
          });
        });

        if (u?.flags?.awaitingLangPick) {
          await safeCall("worker.start.send_lang_picker", async () => {
            await sendWithInline(
              startLangPickerText("en"),
              buildLangPickerKeyboard("en", { prefix: "start:lang:set:" })
            );
          });
          return new Response("ok");
        }

        const onboardingWelcome = t("worker.onboarding.welcome", normalizeLang(u?.lang || "en"));
        await safeCall("worker.start.send_onboarding_welcome", async () => {
          await send(onboardingWelcome);
        });

        await goTo(u, "Square");
        return new Response("ok");
      }

      // Никнейм: если ждём ввода — перехватываем
      if (u.awaitingName) {
        const ns = new NameService({ users });
        const textMsg = (update.message.text || "").trim();
        const langNow = normalizeLang(u?.lang || "en");

        if (!textMsg || textMsg.startsWith("/")) {
          await ns.prompt(send, "", langNow);
          return new Response("ok");
        }

        const res = await ns.tryHandleText(u, textMsg, langNow);
        if (!res.ok) {
          await ns.prompt(send, res.error, langNow);
          return new Response("ok");
        }

        const route = u.afterNameRoute || "Square";
        u.afterNameRoute = "";
        u.awaitingName = false;
        await users.save(u);
        await safeCall("worker.message.labour_upsert_after_name", async () => {
          await labour.upsertFreePlayer(u);
        });

        await goTo(u, route, t("worker.name.set_ok", normalizeLang(u?.lang || "en"), { name: u.displayName }));
        return new Response("ok");
      }

      // Название клана: если ждём ввода — перехватываем
      if (u.awaitingClanName) {
        const textMsg = (update.message.text || "").trim();
        if (!textMsg || textMsg.startsWith("/")) {
          await send(t("worker.clan.awaiting_name_prompt", normalizeLang(u?.lang || "en")));
          return new Response("ok");
        }

        const res = await clans.createClan(u, textMsg);
        if (!res.ok) {
          await send(`⚠️ ${res.error || t("worker.clan.create_failed", normalizeLang(u?.lang || "en"))}`);
          return new Response("ok");
        }

        await safeCall("worker.message.achievements.clan_create", async () => {
          if (achievements?.onEvent) {
            await achievements.onEvent(u, "clan_create", { clanId: String(res?.clan?.id || "") });
          }
        });
        await safeCall("worker.message.quests.clan_join", async () => {
          if (quests?.onEvent) {
            await quests.onEvent(u, "clan_join", { clanId: String(res?.clan?.id || "") });
          }
        });

        await goTo(u, "Clan", t("worker.clan.create_ok", normalizeLang(u?.lang || "en"), { name: res.clan?.name || "" }));
        return new Response("ok");
      }

      if (u.awaitingPetName && text && !text.startsWith("/")) {
        const res = await pet.setDraftName(u, text);
        if (!res.ok) {
          await send(res.error || "Invalid pet name.");
          await goTo(u, "Pet");
          return new Response("ok");
        }
        await goTo(u, "Pet");
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
        const parsed = await safeCall("worker.payment.parse_payload", async () => {
          return JSON.parse(payloadRaw || "{}");
        }, { fallback: null });

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

          await send(t("worker.payment.success", normalizeLang(u?.lang || "en"), {
            emoji: CONFIG.PREMIUM.emoji,
            credited,
            premium: u.premium
          }));
        } else {
          await send(t("worker.payment.duplicate", normalizeLang(u?.lang || "en")));
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
        await bot.sendMessage(chatId, t("worker.reset.in_progress", normalizeLang(u?.lang || "en")), {
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
            t("worker.reset.done_intro", normalizeLang(u?.lang || "en"))
        );
        await send(t("worker.reset.done_toast", normalizeLang(u?.lang || "en")));
        return new Response("ok");
      }

      const langNow = normalizeLang(u?.lang || "en");

      if (menuLabelSet.has(text)) {
        await goTo(u, "Square");
        return new Response("ok");
      }

      if (profileLabelSet.has(text)) {
        await renderProfile(u);
        return new Response("ok");
      }

      await locations.show(u, t("worker.use_buttons", langNow));
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
        await safeCall("worker.callback.open_main_game_url", async () => {
          await bot.answerCallbackUrl(cb.id, openUrl);
        });
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
        await safeCall("worker.callback.open_td_game_url", async () => {
          await bot.answerCallbackUrl(cb.id, openUrlTd);
        });
        return new Response("ok");
      }

      const data = cb.data || "";
      const u = await users.getOrCreate(cb.from.id);

      await safeCall("worker.callback.touch_daily_presence", async () => {
        await clans.touchDailyPresence(u);
      });

      let shouldSaveMetaCb = false;
      if (u.chatId !== chatId) {
        u.chatId = chatId;
        shouldSaveMetaCb = true;
      }
      if (!u.lang) {
        const detectedLangCb = normalizeLang(cb?.from?.language_code || "");
        u.lang = detectedLangCb;
        shouldSaveMetaCb = true;
      }
      if (shouldSaveMetaCb) {
        await users.save(u);
      }
      replyLang = normalizeLang(u?.lang || "en");
      await safeCall("worker.callback.achievements.retro", async () => {
        if (achievements?.retroCheck) {
          await achievements.retroCheck(u);
        }
      });

      if (u?.flags?.awaitingLangPick && !data.startsWith("start:lang:set:")) {
        const lang = normalizeLang(u?.lang || "en");
        await answer(cb.id, t("worker.start.lang_pick_required", lang));
        const caption = startLangPickerText(lang);
        const kb = buildLangPickerKeyboard(lang, { prefix: "start:lang:set:" });
        try {
          await edit(cb.message, caption, kb);
        } catch {
          await sendWithInline(caption, kb);
        }
        return new Response("ok");
      }

      if (data.startsWith("start:lang:set:")) {
        const next = normalizeLang(data.split(":")[3] || "");
        const prev = normalizeLang(u.lang || "en");
        u.flags = (u.flags && typeof u.flags === "object") ? u.flags : {};
        const wasAwaitingLangPick = !!u.flags.awaitingLangPick;
        u.flags.awaitingLangPick = false;
        if (next !== prev) u.lang = next;
        await users.save(u);
        await answer(cb.id, t("profile.lang.changed", next, { lang: langOptionLabel(next) }));
        if (wasAwaitingLangPick) {
          replyLang = next;
          const onboardingWelcome = t("worker.onboarding.welcome", next);
          await safeCall("worker.start.send_onboarding_welcome_after_lang_pick", async () => {
            await send(onboardingWelcome);
          });
          await goTo(u, "Square");
          return new Response("ok");
        }
        await renderProfile(u, cb.message);
        return new Response("ok");
      }

      if (data === "profile:lang") {
        await answer(cb.id);
        const lang = normalizeLang(u.lang || "en");
        const title = t("profile.lang.title", lang);
        const kb = buildLangPickerKeyboard(lang, { prefix: "profile:lang:set:", withBack: true });
        try {
          await edit(cb.message, title, kb);
        } catch {
          await sendWithInline(title, kb);
        }
        return new Response("ok");
      }

      if (data === "profile:achievements") {
        await answer(cb.id);
        const view = achievements?.buildOwnView ? achievements.buildOwnView(u) : null;
        if (!view) {
          await renderProfile(u, cb.message);
          return new Response("ok");
        }
        try {
          await edit(cb.message, view.caption, view.keyboard);
        } catch {
          await sendWithInline(view.caption, view.keyboard);
        }
        return new Response("ok");
      }

      if (data.startsWith("profile:view:")) {
        await answer(cb.id);
        const parts = data.split(":");
        const targetId = String(parts[2] || "").trim();
        const srcToken = String(parts[3] || "").trim();
        if (!targetId) {
          await renderProfile(u, cb.message);
          return new Response("ok");
        }
        await renderPublicProfile(u, targetId, srcToken, cb.message);
        return new Response("ok");
      }

      if (data.startsWith("profile:lang:set:")) {
        const next = normalizeLang(data.split(":")[3] || "");
        const prev = normalizeLang(u.lang || "en");
        u.lang = next;
        replyLang = next;
        if (next !== prev) {
          await users.save(u);
        }
        await answer(cb.id);
        await send(t("profile.lang.changed", next, { lang: langOptionLabel(next) }), {
          reply_markup: ui.mainReply(next)
        });
        await renderProfile(u, cb.message);
        return new Response("ok");
      }

      if (data === "profile:back") {
        await answer(cb.id);
        await renderProfile(u, cb.message);
        return new Response("ok");
      }

      // 🔹 Легаси: если ник пуст и не ждём ручной ввод — автоподстановка
      if (!u.displayName && !u.awaitingName) {
        let nameChanged = false;
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
            if (res?.ok) {
              nameChanged = true;
              break;
            }
          }
        }

        if (!u.displayName) {
          u.displayName = `u${String(userId).slice(-8)}`;
          await users.save(u);
          nameChanged = true;
        }

        if (nameChanged) {
          await safeCall("worker.callback.labour_upsert_name_changed", async () => {
            await labour.upsertFreePlayer(u);
          });
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
        await ns.prompt(send, "", normalizeLang(u?.lang || "en"));
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

        const langAwaitClan = normalizeLang(u?.lang || "en");
        await answer(cb.id, t("worker.clan.send_name_first", langAwaitClan));
        await locations.media.show({
          sourceMsg: locations._sourceMsg || cb.message,
          place: "CityBoard",
          caption: t("worker.clan.awaiting_name_caption", langAwaitClan),
          keyboard: [[{ text: t("worker.btn.cancel", langAwaitClan), callback_data: "go:Clan" }]],
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
        labour,
        farm,
        pet,
        ratings,
        thief,
        referrals,
        achievements,
        quests,
        quiz,
        generalQuiz,
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
        energyHandler,
        clanHandler,
        thiefHandler,
        ratingsHandler,
        premiumShopHandler,
        socialHandler,
        referralHandler,
        barHandler,
        quizHandler,
        generalQuizHandler,
        dailyHandler,
        miniGamesHandler,
        workHandler,
        businessHandler,
        labourHandler,
        farmHandler,
        petHandler,
        stocksHandler,
        studyHandler,
        homeHandler,
        shopHandler,
        casinoHandler,
        gymHandler,
        upgradesHandler
      ];

      const baseHandlers = [navigationHandler, energyHandler, workHandler];

      let handlers;
      if (u?.flags?.onboarding) {
        handlers = [...baseHandlers];
        if (u.flags.onboardingStep === "go_gym" || u.flags.onboardingStep === "gym_started") {
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
    const ratings = new RatingService({ db: env.DB, users, now: () => Date.now() });
    const achievements = new AchievementService({ users, db: env.DB, now: () => Date.now(), bot, ratings });
    const quests = new QuestService({ users, now: () => Date.now(), bot });
    const social = new SocialService({ db: env.DB, users, now: () => Date.now(), economy });
    const stocks = new StockService({ db: env.DB, users, now: () => Date.now(), achievements, quests });
    const labour = new LabourService({ db: env.DB, users, now: () => Date.now(), bot, quests });
    const thief = new ThiefService({ db: env.DB, users, now: () => Date.now(), bot, achievements, ratings, quests });
    const channel = new ChannelService({
      db: env.DB,
      bot,
      social,
      ratings,
      thief,
      now: () => Date.now(),
      channelId: env.CHANNEL_ID,
      playUrl: CONFIG?.CHANNEL?.PLAY_URL
    });
    const pet = new PetService({ db: env.DB, users, now: () => Date.now(), bot, quests, achievements });
    const farm = new FarmService({ db: env.DB, users, now: () => Date.now(), bot, quests, achievements, social });

    const notifier = new NotificationService({
      users,
      bot,
      db: env.DB,
      now: () => Date.now(),
      kvPrefix: "u:",
      economy,
      debug: !!env.DEBUG
    });
    ctx.waitUntil(Promise.allSettled([
      social.ensurePeriod(),
      stocks.runDailyUpdate(),
      notifier.run(),
      labour.runDueExpirations(),
      thief.resolveExpired(),
      thief.resolveProtectionExpirations(),
      pet.dailyTick(),
      farm.dailyTick(),
      channel.runScheduled()
    ]));
  }
};
