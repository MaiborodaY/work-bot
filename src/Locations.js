import { CONFIG } from "./GameConfig.js";
import { NameService } from "./NameService.js";
import { ASSETS, JOB_ASSETS } from "./Assets.js";


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
   * }} deps
   */
  constructor({ media, ui, economy, formatters, pct, now, maybeFinishStudy, daily, fastForward, users }) {
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
    if (route === "Square") {
      let kb = this.ui.square();
      if (this.daily && this.daily.canClaim(user)) {
        kb = [[{ text: "🎁 Бонус дня", callback_data: "daily:claim" }], ...kb];
      }
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square",
        caption: header +"🏙️ Ты на Площади. Нажми Заработать и выбери Работу",
        keyboard: kb,
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Square";
      return;
    }
    // ---------- Earn ----------
    if (route === "Earn") {
      await this.media.show({
        sourceMsg: this._sourceMsg,
        place: "Square", // можно оставить Square-ассет; отдельный баннер добавим позже
        caption: (introText ? introText + "\n\n" : "") + "💼 Заработать: выбери способ дохода",
        keyboard: this.ui.earn(),
        policy: "photo",
      });
      this._sourceMsg = null;
      this._route = "Earn";
      return;
    }
// ---------- Progress ----------
if (route === "Progress") {
  await this.media.show({
    sourceMsg: this._sourceMsg,
    place: "Square", // баннер можно не менять; позже заведём ASSETS.Progress
    caption: (header || "") + "📈 Прокачка: учёба, зал и апгрейды",
    keyboard: this.ui.progress(),
    policy: "photo",
  });
  this._sourceMsg = null;
  this._route = "Progress";
  return;
}
// ---------- City ----------
if (route === "City") {
  await this.media.show({
    sourceMsg: this._sourceMsg,
    place: "Square",
    caption: (header || "") + "🏙️ Город: дом и социальные табло",
    keyboard: this.ui.city(),
    policy: "photo",
  });
  this._sourceMsg = null;
  this._route = "City";
  return;
}
// ---------- CityBoard ----------
if (route === "CityBoard") {
  await this.media.show({
    sourceMsg: this._sourceMsg,
    place: "CityBoard", 
    caption: header + "🌟 Рейтинг игроков\n\n" +"В будущем будут выдаваться призы за первые места.",
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


    // ---------- Work ----------
    if (route === "Work") {
      const active = user.jobs?.active?.[0] || null;
      if (active) {
        const leftMin = Math.max(0, Math.ceil((active.endAt - this.now()) / 60000));
        const ready = this.now() >= active.endAt;
        const caption = ready
        ? `✅ Готово к выплате: ${active.title} — [$${active.plannedPay}]`
        : `▶️ Идёт: ${active.title} (~${leftMin} мин)\n\nСовет: можно заняться другими делами.\n\n` +
          this.formatters.balance(user);
     
;

        // динамическая стоимость ускорения
        let ffCost = null;
        try {
          if (this.fastForward && !ready) {
            const q = this.fastForward.quote(user, "work");
            if (q?.ok) ffCost = q.cost;
          }
        } catch {}

        const typeId = active.typeId;
        const fileId = JOB_ASSETS[typeId] || ASSETS.WorkDefault;
        
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          asset: fileId,                 // ← override картинки
          caption,
          keyboard: this.ui.workV2(user, { active, ready, ffCost }),
          policy: "photo",               // показываем фото выбранной работы
        });
      } else {

        const perks = this.formatters.workPerks(user, { hints: true });
        await this.media.show({
          sourceMsg: this._sourceMsg,
          place: "Work",
          caption: header + "🏢 Выбирая работу - получаешь деньги, но тратишь энергию:" + "\n\n" +
          this.formatters.balance(user) + "\n\n" + "Улучшения работы:\n"+
          perks,

          keyboard: this.ui.workV2(user, {}),
          policy: "auto",
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
          caption: header + `🎓 Обучайся, чтобы уменьшить время работы\nМаксимальный бонус к скорости ${CONFIG.STUDY.MAX_LEVEL}% ` + "\n\n" + this.formatters.balance(user)+ "\n" + this.formatters.studyLine(user),
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
        caption: "🏠 Ты дома. Можно восстановить энергию с бонусом от кровати."+ "\n\n" + this.formatters.balance(user),
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
  const today = new Date().toISOString().slice(0,10);
  const spinsToday = (user.casino?.day === today) ? (user.casino?.spins || 0) : 0;
  const freeUsedToday = (user.casino?.free?.day === today);
  const freeLine = freeUsedToday ? "Бесплатный спин завтра." : "1 бесплатный спин в день. Деньги не списываются.";
  const statusLine = `Сегодня: ${spinsToday}/${CONFIG.CASINO.daily_limit} спинов`;
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

  let casinoKb = this.ui.casinoMenu();
  if (!freeUsedToday) {
    casinoKb = [[{ text: "🎲 Бесплатный спин ($10, без списания)", callback_data: "casino_free" }], ...casinoKb];
  }

  const captionCore = `🎰 Казино\n\n${freeLine}\n${statusLine}${lastPrizeLine}`;
  const captionWithStats = statsLines ? `${captionCore}\n\n${statsLines}` : captionCore;
  const captionStatsBest = bestLine ? `${captionWithStats}\n${bestLine}` : captionWithStats;
  const finalCaption = `${captionWithStats}\n\n${this.formatters.moneyLine(user)}`;

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
        caption: "🍻 Бар «Две Лисы» \nТут можешь получить награду и выполнить задания 🎯" + "\n\n" + this.formatters.balance(user),
        keyboard: this.ui.bar(user, this.now()),
        policy: "auto",
      });
      this._sourceMsg = null;
      this._route = "Bar";
      return;
    }

 // ---------- Gym ----------
if (route === "Gym") {
  // 1) вычисляем цену FF, только если тренировка активна
  let ffCost = null;
  try {
    if (this.fastForward && user?.gym?.active) {
      const q = this.fastForward.quote(user, "gym");
      if (q?.ok) ffCost = q.cost;
    }
  } catch {}

  // 2) клавиатура как раньше
  let kb = this.ui.gym(user, this.now(), ffCost);
  try {
    const backToGym = (user?.nav?.backTo || null) || "Progress";
    const backText =
      backToGym === "Work"  ? "Назад, к выбору работы" :
      backToGym === "Study" ? "Назад, к учебе" :
      backToGym === "Gym"   ? "Назад" :
                               "��:��? �?�������?";
    const backCb = `go:${backToGym}`;
    if (Array.isArray(kb) && kb.length > 0) {
      kb[kb.length - 1] = [{ text: backText, callback_data: backCb }];
    }
  } catch {}

  // 3) заголовок
  let defaultTitle;
  if (user?.gym?.active) {
    const now = this.now();
    const end = user.gym.endAt || 0;
    if (now >= end) {
      defaultTitle = "🏋️ Тренировка завершена — можно повысить энергию";
    } else {
      const leftMin = Math.max(1, Math.ceil((end - now) / 60000));
      defaultTitle = `🏋️ Идёт тренировка (~${leftMin} мин). Можешь заняться другими делами`;
    }
  } else {
    defaultTitle =
      "🏋️ Тренируйся в зале, чтобы увеличить максимальную энергию.\n+1 к макс. энергии за каждую тренировку";
  }
  
  const titleOrHeader =
    (introText && introText.trim()) ? introText.trim() : defaultTitle;

  // 4) показываем:
  if (user?.gym?.active) {
    // активная тренировка — подменяем картинку на GymActive (если есть)
    const gymActiveAsset = (CONFIG.ASSETS?.GymActive || CONFIG.ASSETS?.Gym);
    await this.media.show({
      sourceMsg: this._sourceMsg,
      place: "Gym",
      asset: gymActiveAsset,     // ← только в активном состоянии
      caption: titleOrHeader + "\n\n" + this.formatters.balance(user),
      keyboard: kb,
      policy: "photo",
    });
  } else {
    // неактивно — используем дефолтный баннер Gym из CONFIG.ASSETS
    await this.media.show({
      sourceMsg: this._sourceMsg,
      place: "Gym",
      // без asset — возьмётся CONFIG.ASSETS.Gym
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
  const title = "🗓 Ежедневные задания";
  const tasks = Array.isArray(user?.bar?.tasks) ? user.bar.tasks : [];
  const hasTasks = tasks.length > 0;
  const allClaimed = hasTasks && tasks.every(t => t?.status === "claimed");

  let caption = title;
  if (!hasTasks) {
    caption = `${title}\n\nСегодня квестов нет — приходи завтра.`;
  } else if (allClaimed) {
    caption = `${title}\n\n✅ Все задания на сегодня выполнены — приходи завтра.`;
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
      kb.push([{ text: "✅ Сегодня уже забрано", callback_data: "noop" }]);
    }
  }
  kb.push([{ text: "⬅️ Назад", callback_data: "go:Earn" }]);

  const statusLine = isOwned
    ? (claimedToday
        ? "Статус: ✅ сегодня уже получено"
        : `Статус: доступно к сбору сегодня — $${availableToday}`)
    : "Статус: не куплено";

  await this.media.show({
    sourceMsg: this._sourceMsg,
    place: "Business",
    caption:
      (header || "") +
      "💼 Купить бизнес\n\n" +
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
