import { CONFIG } from "./GameConfig.js";
import { NameService } from "./NameService.js";
import { ASSETS, JOB_ASSETS } from "./Assets.js";

// Helper for gym active title
const titleActive = (mins) => `🏋️ Тренировка идёт: ~${mins} мин`;

export class Locations {
  /**
   * @param {{
   *  media:any, ui:any, economy:any, formatters:any,
   *  pct:(a:number,b:number)=>number, now:()=>number,
   *  maybeFinishStudy:(u:any)=>Promise<boolean>,
   *  maybeFinishGym?:(u:any, goTo:(u:any,place:string,intro?:string)=>Promise<void>)=>Promise<boolean>,
   *  daily?:any,
   *  fastForward?: { quote:(u:any, kind:"work"|"study"|"gym")=>{ok:boolean,cost?:number} }
   *  users?:any
   *  clans?:any
   *  stocks?:any,
   *  labour?:any
   * }} deps
   */
  constructor({ media, ui, economy, formatters, pct, now, maybeFinishStudy, daily, fastForward, users, social, clans, stocks, labour }) {
    this.media = media;
    this.ui = ui;
    this.economy = economy;
    this.formatters = formatters;
    this.pct = pct;
    this.now = now;
    this.maybeFinishStudy = maybeFinishStudy;
    this.daily = daily;
    this.fastForward = fastForward || null;
    this.users = users || null; // ← понадобится для await users.save(u)
    this.social = social || null;
    this.clans = clans || null;
    this.stocks = stocks || null;
    this.labour = labour || null;


    this._sourceMsg = null;
    this._route = "Square";
    this._backToRoute = null;
  }

  setSourceMessage(msg) { this._sourceMsg = msg || null; }
  setRoute(route) {
    this._route = typeof route === "string" && route ? route : this._route;
  }
  setBack(to) {
    this._backToRoute = (typeof to === "string" && to) ? to : null;
  }

  async show(user, introText = null, routeOverride = null) {
    const route = routeOverride || this._route || "Square";
    const onboardingStage = user?.flags?.onboardingStep || "";

    // backTo храним в БД: уходим с Shop/Home — очищаем u.nav.backTo и сохраняем
    if (route !== "Shop" && route !== "Home" && route !== "Gym") {
      if (user?.nav?.backTo) {
        try {
          user.nav.backTo = null;
          if (this.users && typeof this.users.save === "function") {
            await this.users.save(user);
          }
        } catch {}
      }
    }

    const header = introText ? introText + "\n\n" : "";

    // ---------- Square ----------
    // Onboarding: single CTA for first job, then gym
    if (route === "Square" && user?.flags?.onboarding) {
      const goGym = onboardingStage === "go_gym";
      const kbOnboarding = [[{
        text: goGym ? "Перейти в зал" : "Начать первую смену",
        callback_data: goGym ? "go:Gym" : "go:Work"
      }]];

      const caption = (header || "") + (goGym
        ? "💪 Первая смена готова. Открой зал, чтобы потратить награду и увеличить энергию."
        : "🚀 Запускаем игру без лишних меню. Нажми кнопку ниже, чтобы начать первую минутную смену и получить награду.");

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption,
        keyboard: kbOnboarding,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Square";
      return;
    }

    // ---------- Square (основной режим) ----------
    if (route === "Square") {
      const kbBase = this.ui.square();
      const kb = (this.daily && this.daily.canClaim(user))
        ? [[{ text: "Бонус дня", callback_data: "daily:claim" }], ...kbBase]
        : kbBase;

      let yesterdayBlock = "";
      if (this.social && typeof this.social.getDailyWinnersSnapshot === "function") {
        try {
          const winners = await this.social.getDailyWinnersSnapshot();
          if (Array.isArray(winners) && winners.length) {
            const medals = ["🥇","🥈","🥉"];
            const nameCache = new Map();
            const resolveName = (w) => {
              const key = String(w?.userId ?? "");
              if (key && nameCache.has(key)) return nameCache.get(key);
              const fromSnap = (w && typeof w.name === "string" && w.name.trim()) ? w.name.trim() : "";
              if (fromSnap) {
                if (key) nameCache.set(key, fromSnap);
                return fromSnap;
              }
              const fallback = key ? `Игрок #${key.slice(-4).padStart(4, "0")}` : "Игрок";
              if (key) nameCache.set(key, fallback);
              return fallback;
            };

            const lines = ["Вчерашний топ по заработку:"];
            for (const w of winners) {
              const mark = medals[(w?.place || 0) - 1] || `${w.place}.`;
              const name = resolveName(w);
              const earned = Math.max(0, Math.round(Number(w?.earned) || 0));
              const stars = Math.max(0, Number(w?.reward?.stars) || 0);
              const money = Math.max(0, Number(w?.reward?.money) || 0);
              const rewardParts = [];
              if (stars) rewardParts.push(`${stars}${CONFIG.PREMIUM?.emoji || "💎"}`);
              if (money) rewardParts.push(`$${money}`);
              const rewardText = rewardParts.length ? ` (получил ${rewardParts.join(" + ")})` : "";
              lines.push(`${mark} ${name} — $${earned}${rewardText}`);
            }
            yesterdayBlock = lines.join("\n");
          }
        } catch {}
      }

      const captionBase = (header || "") + "🏙️ Площадь: выберите, куда пойти дальше, или загляните в магазин.";
      const captionSquare = yesterdayBlock ? `${captionBase}\n\n${yesterdayBlock}` : captionBase;

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: captionSquare,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Square";
      return;
    }

    if (route === "Earn")  {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (introText ? introText + "\n\n" : "") + "💼 Заработок: выберите, как хотите получить деньги.",
        keyboard: this.ui.earn(),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Earn";
      return;
    }

    // ---------- Stocks ----------
    if (route === "Stocks") {
      let view = null;
      try {
        if (this.stocks && typeof this.stocks.buildMarketView === "function") {
          view = await this.stocks.buildMarketView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: "📈 Биржа временно недоступна.",
          keyboard: [[{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Stocks",
        caption,
        keyboard: view.keyboard || [[{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]],
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Stocks";
      return;
    }

    // ---------- Labour ----------
    if (route === "Labour") {
      let view = null;
      try {
        if (this.labour && typeof this.labour.buildMainView === "function") {
          view = await this.labour.buildMainView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: "👔 Наёмники временно недоступны.",
          keyboard: [[{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        caption,
        keyboard: view.keyboard || [[{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]],
        policy: "auto"
      });
      this._sourceMsg = null;
      this._route = "Labour";
      return;
    }


    // ---------- Progress ----------
    if (route === "Progress") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + "📈 Прогресс: учеба, зал и улучшения.",
        keyboard: this.ui.progress(),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Progress";
      // Keep onboarding active when viewing Progress; it ends after first job start
      return;
    }
    // ---------- City ----------
    if (route === "City") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + "🏙️ Город: дом, таблицы лидеров и кланы.",
        keyboard: this.ui.city(),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "City";
      return;
    }
    // ---------- Clan ----------
    if (route === "Clan") {
      let view = null;
      try {
        if (this.clans && typeof this.clans.buildMainView === "function") {
          view = await this.clans.buildMainView(user);
        }
      } catch {}

      if (!view) {
        view = {
          caption: "👥 Кланы временно недоступны.",
          keyboard: [[{ text: "⬅️ Назад", callback_data: "go:City" }]]
        };
      }

      const caption = (header || "") + (view.caption || "");
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Clan",
        caption,
        keyboard: view.keyboard || [[{ text: "⬅️ Назад", callback_data: "go:City" }]],
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Clan";
      return;
    }
    // ---------- CityBoard ----------
    if (route === "CityBoard") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "CityBoard", 
        caption: header + "🌟 Рейтинг игроков\n\nПризы за лучшие места выдаются каждый день.",
        keyboard: this.ui.cityBoard(),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "CityBoard";
      return;
    }
    // ---------- ShopHub ----------
    if (route === "ShopHub") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + "🛒 Магазины",
        keyboard: this.ui.shopHub(),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "ShopHub";
      return;
    }

    // ---------- MiniGames ----------
    if (route === "MiniGames") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: (header || "") + "🎮 Мини-игры: выбери режим и нажми, чтобы запустить.",
        keyboard: this.ui.miniGames(),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "MiniGames";
      return;
    }


    // ---------- Work ----------
    // Онбординг: первое открытие списка заданий
    if (route === "Work" && user?.flags?.onboarding && !(user.jobs?.active?.[0])) {
      if (onboardingStage === "go_gym") {
        const kbGym = [[{ text: "Go to gym", callback_data: "go:Gym" }]];
        const captionGym = (header || "") + "💪 Первая выплата получена. Открой зал и вложи её в энергию.";
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          caption: captionGym,
          keyboard: kbGym,
          policy: "auto",
        });
        this._sourceMsg = null;
        this._route = "Work";
        return;
      }

      const kb = this.ui.workV2(user, {});
      const caption =
        (header || "") +
        "🚦 Шаг 1: запусти первую минутную смену. Это почти не требует энергии и дает стартовый доход.\n\n" +
        this.formatters.balance(user) + "\n\n" +
        "Выбери первую смену ниже. 💪 После награды покажем зал.";

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Work",
        caption,
        keyboard: kb,
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Work";
      return;
    }

    // ---------- Work (основной режим) ----------
    if (route === "Work") {
      const active = user.jobs?.active?.[0] || null;
      const onboarding = !!(user?.flags?.onboarding);

      if (active) {
        const leftMin = Math.max(0, Math.ceil((active.endAt - this.now()) / 60000));
        const ready = this.now() >= active.endAt;

        let ffCost = null;
        try {
          if (this.fastForward && !ready) {
            const q = this.fastForward.quote(user, "work");
            if (q?.ok) ffCost = q.cost;
          }
        } catch {}

        const typeId = active.typeId;
        const fileId = JOB_ASSETS[typeId] || ASSETS.WorkDefault;

        const caption = ready
          ? `💰 Готово к выплате: ${active.title} [$${active.plannedPay}]`
          : `⏳ Идет смена: ${active.title} (~${leftMin} мин)\n\n💡 Совет: можно открыть другие разделы.\n\n` +
            this.formatters.balance(user);

        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          asset: fileId,
          caption,
          keyboard: this.ui.workV2(user, { active, ready, ffCost }),
          policy: "photo",
        });
      } else {
        const perks = this.formatters.workPerks(user, { hints: true });
        const caption =
          (header || "") +
          "💼 Выбери смену ниже и запускай работу. 🎯 Цель — получить выплату сегодня.\n\n" +
          this.formatters.balance(user) + "\n\n" +
          "✨ Бонусы от учебы и улучшений:\n" + perks;

        const kb = this.ui.workV2(user, {});

        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          caption,
          keyboard: kb,
          policy: "photo",
        });
      }

      this._sourceMsg = null;
      this._route = "Work";
      return;
    }

    // ---------- Study ----------
    if (route === "Study") {
      if (!user.displayName || !String(user.displayName).trim()) {
        // помечаем ожидание ника и куда вернуться после него
        if (this.users && typeof this.users.save === "function") {
          user.awaitingName = true;
          user.afterNameRoute = "go:Study";
          await this.users.save(user);
        }

        // показываем тот же промпт ника, что и в табло
        const ns = new NameService({ users: this.users });
        await ns.prompt(async (text, extra) => {
          await this.media.show({
            sourceMsg: this._sourceMsg,
            place: "Study",
            caption: text,
            keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: "⬅️ На Площадь", callback_data: "go:Square" }]],
            policy: "photo",
          });
          this.setSourceMessage(null);
        });
        this._route = "Study";
        return;
      }

      if (user.study?.active) {
        const startAt = user.study.startAt || 0;
        const endAt   = user.study.endAt   || 1;
        const now     = this.now();
        const elapsed  = Math.max(0, now - startAt);
        const need     = Math.max(1, endAt - startAt);
        const progress = Math.min(100, this.pct(elapsed, need));
        const ready    = now >= endAt;
        
        let ffCost = null;
        try {
          if (this.fastForward && !ready) {           // цену FF считаем только если НЕ готово
            const q = this.fastForward.quote(user, "study");
            if (q?.ok) ffCost = q.cost;
          }
        } catch {}
        
        const leftMin = Math.max(1, Math.ceil((endAt - now) / 60000));
        const studyAsset = CONFIG?.ASSETS?.StudyActive || CONFIG?.ASSETS?.Study;
        
        const title = ready
          ? "📘 Обучение завершено — можно повысить уровень"
          : "📘 Идёт обучение (~" + leftMin + " мин)";
        
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Study",
          asset: studyAsset,
          caption:
            title +
            "\n\n" + this.formatters.balance(user) +
            "\n" + this.formatters.studyLine(user),
          keyboard: this.ui.studyActive(progress, { ready, ffCost }),
          policy: "photo",
        });
      } else {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Study",
          caption: header + `🎓 Обучайся, чтобы ускорить работу.\nМаксимальный бонус к скорости может достигать ${CONFIG.STUDY.MAX_LEVEL}% `
           + "\n\n" + this.formatters.balance(user)+ "\n" + this.formatters.studyLine(user)
           +"\n"+"+1% к скорости работы за каждое обучение",
          keyboard: this.ui.studyIdle(this.economy.fmtStudyEffects(user)),
          policy: "auto",
        });
      }
      this._sourceMsg = null;
      this._route = "Study";
      return;
    }

    // ---------- Home ----------
    if (route === "Home") {
      const backTo = (user?.nav?.backTo || null) || "City";
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Home",
        caption: "🏠 Ты дома. Здесь можно восстановить энергию с бонусом от кровати."
        + "\n\n" +"Нажми «Отдыхать» для начала отдыха или «Прервать» для получения энергии после отдыха"
        + "\n\n" + this.formatters.balance(user),
        keyboard: this.ui.home(user, { backTo }),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Home";
      return;
    }

    // ---------- Shop ----------
    if (route === "Shop") {
      const backToShop = (user?.nav?.backTo || null) || "ShopHub";
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Shop",
        caption: header + "🛒 Ты в магазине. Что купить?" + "\n\n" + this.formatters.balance(user),
        keyboard: this.ui.shop({ backTo: backToShop }),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Shop";
      return;
    }

    // ---------- Casino ----------
    if (route === "Casino") {
      const minStudy = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
      const studyLevel = Math.max(0, Number(user?.study?.level) || 0);
      const paidLocked = studyLevel < minStudy;

      const today = new Date().toISOString().slice(0,10);
      const spinsToday = (user.casino?.day === today) ? (user.casino?.spins || 0) : 0;
      const freeUsedToday = (user.casino?.free?.day === today);
      const freeLine = freeUsedToday ? "Бесплатная попытка будет доступна завтра." : "1 бесплатная попытка в день. Деньги не списываются.";
      const statusLine = `Сегодня: ${spinsToday}/${CONFIG.CASINO.daily_limit} попыток`;
      const lastPrizeLine = (user.casino?.free?.lastPrize ?? null) != null
        ? `\nПоследний бесплатный приз: $${user.casino.free.lastPrize || 0}.`
        : "";

      // Казино (день+неделя); если форматтера нет — просто пустая строка
      const statsLines =
        typeof this.formatters?.casinoStatsLines === "function"
          ? this.formatters.casinoStatsLines(user)
          : "";

      const bestLine =
        typeof this.formatters?.casinoBestLine === "function"
          ? this.formatters.casinoBestLine(user)
          : "";

      let casinoKb = this.ui.casinoMenu(user);
      if (!freeUsedToday) {
        casinoKb = [[{ text: "🌀 Бесплатная попытка ($5, без списания)", callback_data: "casino_free" }], ...casinoKb];
      }

      const captionCore = `🌀 Зал арканы\n\n${freeLine}\n${statusLine}${lastPrizeLine}`;
      const captionWithStats = statsLines ? `${captionCore}\n\n${statsLines}` : captionCore;
      const captionWithLocks = paidLocked
        ? `${captionWithStats}\n\nБольше попыток доступно с уровня учебы ${minStudy}.`
        : captionWithStats;
      const captionStatsBest = bestLine ? `${captionWithLocks}\n${bestLine}` : captionWithLocks;
      const finalCaption = `${captionStatsBest}\n\n${this.formatters.moneyLine(user)}`;

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Casino",
        caption: finalCaption,
        keyboard: casinoKb,
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Casino";
      return;
    }

    // ---------- Bar ----------
    if (route === "Bar") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Bar",
        caption: "🍺 Бар «Две Лисы»\nТут можно получить награду и выполнить задания." + "\n\n" + this.formatters.balance(user),
        keyboard: this.ui.bar(user, this.now()),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Bar";
      return;
    }

    // ---------- Gym ----------
    if (route === "Gym") {
      if (user?.flags?.onboarding && onboardingStage === "go_gym") {
        user.flags.onboarding = false;
        user.flags.onboardingStep = "done";
        try { if (this.users && typeof this.users.save === "function") { await this.users.save(user); } } catch {}
      }

      let ffCost = null;
      try {
        if (this.fastForward && user?.gym?.active) {
          const q = this.fastForward.quote(user, "gym");
          if (q?.ok) ffCost = q.cost;
        }
      } catch {}

      let kb = this.ui.gym(user, this.now(), ffCost);
      try {
        const backToGym = (user?.nav?.backTo || null) || "Progress";
        const backText =
          backToGym === "Work"  ? "⬅️ Назад, к выбору смен" :
          backToGym === "Study" ? "⬅️ Назад, к учебе" :
          backToGym === "Gym"   ? "⬅️ Назад" : "⬅️ Назад";
        const backCb = "go:" + (backToGym === "Gym" ? "Progress" : backToGym);
        if (Array.isArray(kb) && kb.length > 0) {
          kb[kb.length - 1] = [{ text: backText, callback_data: backCb }];
        }
      } catch {}

      let defaultTitle;
      if (user?.gym?.active) {
        const now = this.now();
        const end = user.gym.endAt || 0;
        if (now >= end) {
          defaultTitle = "🏁 Тренировка завершена — можно повысить энергию";
        } else {
          const leftMin = Math.max(1, Math.ceil((end - now) / 60000));
          defaultTitle = titleActive(leftMin);
        }
      } else {
        defaultTitle = "💪 Тренируйтесь в зале, чтобы увеличить максимальную энергию. \nКаждая тренировка дает +1 к максимуму. \nМаксимум может быть 160 энергии";
      }
      
      const titleOrHeader = (introText && introText.trim()) ? introText.trim() : defaultTitle;

      if (user?.gym?.active) {
        const gymActiveAsset = (CONFIG.ASSETS?.GymActive || CONFIG.ASSETS?.Gym);
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Gym",
          asset: gymActiveAsset,
          caption: titleOrHeader + "\n\n" + this.formatters.balance(user),
          keyboard: kb,
          policy: "photo",
        });
      } else {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Gym",
          caption: titleOrHeader + "\n\n" + this.formatters.balance(user),
          keyboard: kb,
          policy: "auto",
        });
      }

      this._sourceMsg = null;
      this._route = "Gym";
      return;
    }

    // ---------- Upgrades ----------
    if (route === "Upgrades") {
      const caption = this.ui.upgradesCaption(user);
      const kbRows  = this.ui.upgrades(user);

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Upgrades",
        caption: caption + "\n\n" + this.formatters.balance(user),
        keyboard: kbRows,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Upgrades";
      return;
    }

    // ---------- BarTasks ----------
    if (route === "BarTasks") {
      const title = "📋 Ежедневные задания";
      const tasks = Array.isArray(user?.bar?.tasks) ? user.bar.tasks : [];
      const hasTasks = tasks.length > 0;
      const allClaimed = hasTasks && tasks.every(t => t?.status === "claimed");

      let caption = title;
      if (!hasTasks) {
        caption = `${title}\n\nСегодня квестов нет — приходи завтра.`;
      } else if (allClaimed) {
        caption = `${title}\n\n✓ Все задания на сегодня выполнены — приходи завтра.`;
      }

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Bar",
        caption,
        keyboard: this.ui.barTasks(user),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "BarTasks";
      return;
    }

    // ---------- Business ----------
    if (route === "Business") {
      // Selection-first version when multiple businesses exist
      try {
        const all = CONFIG?.BUSINESS || {};
        const items = Object.keys(all).map(k => all[k]);
        if (items.length > 1) {
          const caption = (header || "") + "💼 Свой бизнес\n\nВыберите бизнес:";
          const kb = items.map(B => [{ text: `${B.emoji} ${B.title}`, callback_data: `go:Biz_${B.id}` }]);
          kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);
          await this.media.show({ sourceMsg: this._sourceMsg, place: "Business", caption, keyboard: kb, policy: "photo" });
          this._sourceMsg = null;
          this._route = "Business";
          return;
        }
      } catch {}
      // Multi-business overview when more than one type is configured
      try {
        const all = CONFIG?.BUSINESS || {};
        const items = Object.keys(all).map(k => all[k]);
        if (items.length > 1) {
          const todayUTC = new Date().toISOString().slice(0, 10);
          const captionLines = [];
          captionLines.push((header || "") + "💼 Свой бизнес\n");
          const kb = [];
          const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
          for (const B of items) {
            const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
            const isOwned = !!ownedObj;
            const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
            const availableToday = isOwned && !claimedToday ? (Number(B.daily) || 0) : 0;
            captionLines.push(`${B.emoji} ${B.title}`);
            captionLines.push(`Цена: $${B.price}`);
            captionLines.push(`Доход: $${B.daily} в день`);
            captionLines.push(`Накопление между днями: не накапливается`);
            captionLines.push(
              isOwned
                ? (claimedToday ? "Статус: доход за сегодня забран" : `Статус: доступно сегодня: $${availableToday}`)
                : "Статус: не куплено"
            );
            if (B.note) captionLines.push(B.note);
            captionLines.push("");
            if (!isOwned) {
              kb.push([{ text: `Купить ${B.title} за $${B.price}`, callback_data: `biz:buy:${B.id}` }]);
            } else {
              if (!claimedToday) {
                kb.push([{ text: `Забрать $${B.daily} (${B.title})`, callback_data: `biz:claim:${B.id}` }]);
              } else {
                kb.push([{ text: `Сегодня уже забрано (${B.title})`, callback_data: "noop" }]);
              }
            }
          }
          kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);
          await this.media.show({ sourceMsg: this._sourceMsg, place: "Business", caption: captionLines.join("\n"), keyboard: kb, policy: "photo" });
          this._sourceMsg = null;
          this._route = "Business";
          return;
        }
      } catch {}
      const B = CONFIG.BUSINESS.shawarma;
      const title = `${B.emoji} ${B.title}`;
      const price = `$${B.price}`;
      const daily = `$${B.daily}`;

      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      const isOwned = !!ownedObj;

      // День по UTC в формате YYYY-MM-DD
      const todayUTC = new Date().toISOString().slice(0, 10);
      // уже собрал сегодня?
      const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);

      // сколько доступно сегодня (MVP: всегда весь дневной доход или 0)
      const availableToday = isOwned && !claimedToday ? B.daily : 0;

      const kb = [];
      if (!isOwned) {
        kb.push([{ text: `🛒 Купить за ${price}`, callback_data: `biz:buy:${B.id}` }]);
      } else {
        if (!claimedToday) {
          kb.push([{ text: `🏦 Забрать $${B.daily} за сегодня`, callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: "✓ Сегодня уже забрано", callback_data: "noop" }]);
        }
      }
      kb.push([{ text: "⬅️ Назад", callback_data: "go:Earn" }]);

      const statusLine = isOwned
        ? (claimedToday
            ? "Статус: ✓ сегодня уже получено"
            : `Статус: доступно к сбору сегодня — $${availableToday}`)
        : "Статус: не куплено";

      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        caption:
          (header || "") +
          "💵 Купить бизнес\n\n" +
          `${title}\n` +
          `Цена: ${price}\n` +
          `Доход: ${daily} в день\n` +
          `Сбор дохода: вручную\n` +
          statusLine + "\n\n" +
          (B.note ? "ℹ️ " + B.note : ""),
        keyboard: kb,
        policy: "photo", // показываем баннер Business
      });
      this._sourceMsg = null;
      this._route = "Business";
      return;
    }

    // ---------- Biz_shawarma ----------
    if (route === "Biz_shawarma") {
      const B = CONFIG?.BUSINESS?.shawarma;
      if (!B) {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Business",
          caption: (header || "") + "Бизнес недоступен",
          keyboard: [[{ text: "Назад", callback_data: "go:Business" }]],
          policy: "auto"
        });
        this._sourceMsg = null;
        this._route = "Business";
        return;
      }

      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      const isOwned = !!ownedObj;
      const todayUTC = new Date().toISOString().slice(0, 10);
      const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
      const availableToday = isOwned && !claimedToday ? (Number(B.daily)||0) : 0;

      const kb = [];
      if (!isOwned) {
        kb.push([{ text: `Купить за $${B.price}`, callback_data: `biz:buy:${B.id}` }]);
      } else {
        if (!claimedToday) {
          kb.push([{ text: `Забрать $${B.daily}`, callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: "Сегодня уже забрано", callback_data: "noop" }]);
        }
      }
      kb.push([{ text: "⬅️ Назад к бизнесам", callback_data: "go:Business" }]);
      kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);

      const statusLine = isOwned
        ? (claimedToday ? "Статус: доход за сегодня забран" : `Статус: доступно сегодня: $${availableToday}`)
        : "Статус: не куплено";

      const assetShaw = (ASSETS?.BusinessShawarma || JOB_ASSETS?.shawarma_seller || ASSETS?.Business);
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        asset: assetShaw,
        caption:
          (header || "") +
          `${B.emoji} ${B.title}\n` +
          `Цена: $${B.price}\n` +
          `Доход: $${B.daily} в день\n` +
          `Накопление между днями: не накапливается\n` +
          statusLine,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Biz_shawarma";
      return;
    }

    // ---------- Biz_stomatology ----------
    if (route === "Biz_stomatology") {
      const B = CONFIG?.BUSINESS?.stomatology;
      if (!B) {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Business",
          caption: (header || "") + "Бизнес недоступен",
          keyboard: [[{ text: "Назад", callback_data: "go:Business" }]],
          policy: "auto"
        });
        this._sourceMsg = null;
        this._route = "Business";
        return;
      }

      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      const isOwned = !!ownedObj;
      const todayUTC = new Date().toISOString().slice(0, 10);
      const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
      const availableToday = isOwned && !claimedToday ? (Number(B.daily)||0) : 0;

      const kb = [];
      if (!isOwned) {
        kb.push([{ text: `Купить за $${B.price}`, callback_data: `biz:buy:${B.id}` }]);
      } else {
        if (!claimedToday) {
          kb.push([{ text: `Забрать $${B.daily}`, callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: "Сегодня уже забрано", callback_data: "noop" }]);
        }
      }
      kb.push([{ text: "⬅️ Назад к бизнесам", callback_data: "go:Business" }]);
      kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);

      const statusLine = isOwned
        ? (claimedToday ? "Статус: доход за сегодня забран" : `Статус: доступно сегодня: $${availableToday}`)
        : "Статус: не куплено";

      const assetSto = (ASSETS?.BusinessStomatology || JOB_ASSETS?.dentist || ASSETS?.Business);
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        asset: assetSto,
        caption:
          (header || "") +
          `${B.emoji} ${B.title}\n` +
          `Цена: $${B.price}\n` +
          `Доход: $${B.daily} в день\n` +
          `Накопление между днями: не накапливается\n` +
          statusLine,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Biz_stomatology";
      return;
    }

    // ---------- Biz_restaurant ----------
    if (route === "Biz_restaurant") {
      const B = CONFIG?.BUSINESS?.restaurant;
      if (!B) {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Business",
          caption: (header || "") + "Бизнес недоступен",
          keyboard: [[{ text: "Назад", callback_data: "go:Business" }]],
          policy: "auto"
        });
        this._sourceMsg = null;
        this._route = "Business";
        return;
      }

      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      const isOwned = !!ownedObj;
      const todayUTC = new Date().toISOString().slice(0, 10);
      const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
      const availableToday = isOwned && !claimedToday ? (Number(B.daily)||0) : 0;

      const kb = [];
      if (!isOwned) {
        kb.push([{ text: `Купить за $${B.price}`, callback_data: `biz:buy:${B.id}` }]);
      } else {
        if (!claimedToday) {
          kb.push([{ text: `Забрать $${B.daily}`, callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: "Уже забрано сегодня", callback_data: "noop" }]);
        }
      }
      kb.push([{ text: "⬅️ Назад к бизнесам", callback_data: "go:Business" }]);
      kb.push([{ text: "🏃 К заработку", callback_data: "go:Earn" }]);

      const statusLine = isOwned
        ? (claimedToday ? "Статус: прибыль уже получена" : `Статус: доступно к получению: $${availableToday}`)
        : "Статус: не куплено";

      const assetRest = (ASSETS?.BusinessRestaurant || JOB_ASSETS?.waiter || ASSETS?.Business);
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        asset: assetRest,
        caption:
          (header || "") +
          `${B.emoji} ${B.title}\n` +
          `Цена: $${B.price}\n` +
          `Доход: $${B.daily} в день\n` +
          `Ежедневный сброс прибыли: не накапливается\n` +
          statusLine,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Biz_restaurant";
      return;
    }

    // ---------- Biz_courier_service ----------
    if (route === "Biz_courier_service") {
      const B = CONFIG?.BUSINESS?.courier_service;
      if (!B) {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Business",
          caption: (header || "") + "Бизнес недоступен",
          keyboard: [[{ text: "Назад", callback_data: "go:Business" }]],
          policy: "auto"
        });
        this._sourceMsg = null;
        this._route = "Business";
        return;
      }

      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      const isOwned = !!ownedObj;
      const todayUTC = new Date().toISOString().slice(0, 10);
      const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
      const availableToday = isOwned && !claimedToday ? (Number(B.daily)||0) : 0;

      const kb = [];
      if (!isOwned) {
        kb.push([{ text: `Купить за $${B.price}`, callback_data: `biz:buy:${B.id}` }]);
      } else {
        if (!claimedToday) {
          kb.push([{ text: `Забрать $${B.daily}`, callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: "Уже забрано сегодня", callback_data: "noop" }]);
        }
      }
      kb.push([{ text: "⬅️ Назад к бизнесам", callback_data: "go:Business" }]);
      kb.push([{ text: "🏃 К заработку", callback_data: "go:Earn" }]);

      const statusLine = isOwned
        ? (claimedToday ? "Статус: прибыль уже получена" : `Статус: доступно к получению: $${availableToday}`)
        : "Статус: не куплено";

      const assetCourier = (ASSETS?.BusinessCourier || JOB_ASSETS?.courier || ASSETS?.Business);
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        asset: assetCourier,
        caption:
          (header || "") +
          `${B.emoji} ${B.title}\n` +
          `Цена: $${B.price}\n` +
          `Доход: $${B.daily} в день\n` +
          `Накопление между днями: не накапливается\n` +
          statusLine,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Biz_courier_service";
      return;
    }

    // ---------- Biz_fitness_club ----------
    if (route === "Biz_fitness_club") {
      const B = CONFIG?.BUSINESS?.fitness_club;
      if (!B) {
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Business",
          caption: (header || "") + "Бизнес недоступен",
          keyboard: [[{ text: "Назад", callback_data: "go:Business" }]],
          policy: "auto"
        });
        this._sourceMsg = null;
        this._route = "Business";
        return;
      }

      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedObj = ownedArr.find(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      const isOwned = !!ownedObj;
      const todayUTC = new Date().toISOString().slice(0, 10);
      const claimedToday = isOwned && (ownedObj.lastClaimDayUTC === todayUTC);
      const availableToday = isOwned && !claimedToday ? (Number(B.daily)||0) : 0;

      const kb = [];
      if (!isOwned) {
        kb.push([{ text: `Купить за $${B.price}`, callback_data: `biz:buy:${B.id}` }]);
      } else {
        if (!claimedToday) {
          kb.push([{ text: `Забрать $${B.daily}`, callback_data: `biz:claim:${B.id}` }]);
        } else {
          kb.push([{ text: "Уже забрано сегодня", callback_data: "noop" }]);
        }
      }
      kb.push([{ text: "⬅️ Назад к бизнесам", callback_data: "go:Business" }]);
      kb.push([{ text: "🏃 К заработку", callback_data: "go:Earn" }]);

      const statusLine = isOwned
        ? (claimedToday ? "Статус: прибыль уже получена" : `Статус: доступно к получению: $${availableToday}`)
        : "Статус: не куплено";

      const assetFitness = (ASSETS?.BusinessFitness || ASSETS?.Gym || ASSETS?.Business);
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Business",
        asset: assetFitness,
        caption:
          (header || "") +
          `${B.emoji} ${B.title}\n` +
          `Цена: $${B.price}\n` +
          `Доход: $${B.daily} в день\n` +
          `Накопление между днями: не накапливается\n` +
          statusLine,
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Biz_fitness_club";
      return;
    }

    // ---------- Fallback → Square ----------
    let kb = this.ui.square();
    if (this.daily && this.daily.canClaim(user)) {
      kb = [[{ text: "🎁 Бонус дня", callback_data: "daily:claim" }], ...kb];
    }
    await this.media.show({
      sourceMsg: this._sourceMsg,
      place: "Square",
      caption: header + "🏙️ Ты на Площади. Куда пойдём?",
      keyboard: kb,
      policy: "photo",
    });
    this._sourceMsg = null;
    this._route = "Square";
  }
}
