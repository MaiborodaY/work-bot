// UiFactory.js
import { CONFIG } from "./GameConfig.js";
import { GymService } from "./GymService.js";

export class UiFactory {
  mainReply() {
    return {
      keyboard: [[{ text: "🏙️ Площадь" }, { text: "📊 Статус" }]],
      resize_keyboard: true,
    };
  }
  // ---------- Площадь ----------

  square() {
    return [
      [{ text: "💼 Заработать", callback_data: "go:Earn" }],
      [{ text: "📈 Прокачка",   callback_data: "go:Progress" }],
      [{ text: "🏙️ Город",     callback_data: "go:City" }],
      [{ text: "🛒 Магазин",    callback_data: "go:ShopHub" }],
    ];
  }
  
  earn() {
    return [
      [{ text: "🏢 Работа",            callback_data: "go:Work" }],
      [{ text: "🍻 Бар / Задания",     callback_data: "go:Bar"  }],
      // [{ text: "🎁 Казино",            callback_data: "go:Casino" }],
      [{ text: "💼 Купить бизнес",     callback_data: "go:Business" }],
      [{ text: "⬅️ На Площадь",        callback_data: "go:Square" }]
    ];
  }
  progress() {
    return [
      [{ text: "🎓 Учёба",      callback_data: "go:Study" }],
      [{ text: "🏋️ Зал (Gym)", callback_data: "go:Gym" }],
      [{ text: "🛠 Улучшения",  callback_data: "go:Upgrades" }],
      [{ text: "⬅️ На Площадь", callback_data: "go:Square" }],
    ];
  }
  city() {
    return [
      [{ text: "🏠 Дом",             callback_data: "go:Home" }],
      [{ text: "🌟 Рейтинг игроков", callback_data: "go:CityBoard" }],
      [{ text: "⬅️ На Площадь",      callback_data: "go:Square" }],
    ];
  }
  shopHub() {
    return [
      [{ text: "🏪 Продуктовый",            callback_data: "go:Shop" }],
      [{ text: "💎 Магазин кристаллов", callback_data: "premium:open" }],
      [{ text: "⬅️ На Площадь",         callback_data: "go:Square" }],
    ];
  }
      

  // ---------- Бар ----------

  bar(user, now = Date.now()) {
    const kb = [];
    const bar = user.bar || {};
    const tasks = Array.isArray(bar.tasks) ? bar.tasks : [];
  
    // Кнопка перехода на экран ежедневных заданий
    kb.push([{ text: "🗓 Ежедневные задания", callback_data: "bar:tasks" }]);
  
    // Кнопка «ежедневная награда за подписку» — показываем только когда доступна
    const today = new Date().toISOString().slice(0,10); // UTC
    const freeUsed = (user?.casino?.free?.day === today);
    const subDay = user?.subReward?.day || "";
    const eligible = !!(user?.subReward?.eligible);
    const showSubBtn = !freeUsed && (subDay !== today || eligible === true);
    // if (showSubBtn) {
    //   kb.push([{ text: "🎁 Ежедневная награда за подписку", callback_data: "bar:sub" }]);
    // }
  
    // Главная навигация
    kb.push([{ text: "⬅️ Назад", callback_data: "go:Earn" }]);
    return kb;
  }

  barTasks(user) {
    const kb = [];
    const tasks = Array.isArray(user?.bar?.tasks) ? user.bar.tasks : [];
  
    if (!tasks.length) {
      kb.push([{ text: "Сегодня квестов нет — приходи завтра.", callback_data: "noop" }]);
      kb.push([{ text: "🍻 Назад в бар", callback_data: "go:Bar" }]);
      return kb;
    }
  
    const fmtReward = (r) => {
      if (!r) return "";
      if (r.t === "premium") return `${CONFIG.PREMIUM.emoji}${r.n}`;
      if (r.t === "energy")  return `${r.n}⚡`;
      if (r.t === "money")   return `$${r.n}`;
      return "";
    };
  
    for (const t of tasks) {
      const rText = fmtReward(t.reward);
      const prog =
        t.id === "W1" ? `${t.progress}/${t.goal} работ` :
        t.id === "W2" ? `$${t.progress}/$${t.goal}` :
                        `${t.progress}/${t.goal} спинов`;
  
      kb.push([{ text: `🎯 ${t.title} (награда: ${rText})`, callback_data: "noop" }]);
      kb.push([{ text: `📈 Прогресс: ${prog}`, callback_data: "noop" }]);
  
      if (t.status === "done") {
        kb.push([{ text: "✅ Сдать награду", callback_data: `bar:claim:${t.id}` }]);
      } else if (t.status === "claimed") {
        kb.push([{ text: "🏁 Награда получена", callback_data: "noop" }]);
      } else {
        kb.push([{ text: "⏳ В процессе", callback_data: "noop" }]);
      }
    }
  
    kb.push([{ text: "🍻 Назад в бар", callback_data: "go:Bar" }]);
    return kb;
  }
  
  

  // ---------- Работа ----------
  workV2(user, options = {}) {
    const { active = null, ready = false } = options;
    const kb = [];

    if (active) {

      if (ready) {
        kb.push([{ text: `✅ Забрать выплату ($${active.plannedPay})`, callback_data: "work:claim" }]);
        kb.push([{ text: "⏹️ Отменить", callback_data: "work:cancel" }]);
      } else {
        kb.push([{ text: `⏳ Осталось ~${Math.max(0, Math.ceil((active.endAt - Date.now())/60000))} мин`, callback_data: "noop" }]);
        const costLabel = (typeof options.ffCost === "number" && options.ffCost > 0)
          ? `${CONFIG.PREMIUM.emoji}${options.ffCost}`
          : `${CONFIG.PREMIUM.emoji}?`;
        kb.push([{ text: `⏩ Завершить сейчас (${costLabel})`, callback_data: "work:skip" }]);
        kb.push([{ text: "⏹️ Отменить (штраф −5⚡)", callback_data: "work:cancel" }]);
      }

      kb.push([{ text: "⬅️ Назад", callback_data: "go:Earn" }]);
      return kb;
    }

    for (const [id, j] of Object.entries(CONFIG.JOBS)) {
      kb.push([{
        text: `${j.title} — ${Math.round(j.durationMs/60000)} мин — $${j.pay} — −${j.energy}⚡`,
        callback_data: `work:start:${id}`
      }]);
    }
    kb.push([{ text: "⬅️ Назад", callback_data: "go:Earn" }]);
    return kb;
  }

  // ---------- Учёба ----------
  studyIdle(effectsText) {
    return [
      [{ text: `📘 Начать обучение (${effectsText})`, callback_data: "study:start" }],
      [{ text: "⬅️ Назад", callback_data: "go:Progress" }],
    ];
  }

// добавили флаг ready: если сессия уже закончилась по времени — показываем «Завершить»
studyActive(progress, { ready = false, ffCost = null } = {}) {
  if (ready) {
    return [
      [{ text: `⏳ Прогресс: ${progress}%`, callback_data: "noop" }],
      [{ text: "✅ Завершить обучение", callback_data: "study:finish" }],
      [{ text: "⬅️ Назад", callback_data: "go:Progress" }],
    ];
  }

  const costLabel = (typeof ffCost === "number" && ffCost > 0)
    ? `${CONFIG.PREMIUM.emoji}${ffCost}`
    : `${CONFIG.PREMIUM.emoji}?`;
  return [
    [{ text: `⏳ Прогресс: ${progress}%`, callback_data: "noop" }],
    [{ text: `⏩ Завершить сейчас (${costLabel})`, callback_data: "study:skip" }],
    [{ text: "⬅️ Назад", callback_data: "go:Progress" }],
  ];
}



  // ---------- Дом ----------
  home(user, opts = {}) {
    const owned = new Set(user.upgrades || []);
    const kb = [];

    const mult = user.upgrades.includes("bed3") ? 3
    : user.upgrades.includes("bed2") ? 2
    : user.upgrades.includes("bed1") ? 1.5
    : 1;

if (!user.rest.active) {
// Базовая скорость 1⚡/5 мин → показываем итог ~скорость и множитель
const approx = (mult === 1.5) ? "≈2" : `${Math.round(1 * mult)}`;
kb.push([{ text: `🛏️ Отдыхать (+${approx}⚡/5 мин)`, callback_data: "rest:start" }]);
} else {
kb.push([{ text: `⏹️ Прервать отдых (множитель x${mult})`, callback_data: "rest:stop" }]);
}


    const eatButtons = Object.entries(CONFIG.SHOP)
      .filter(([k, v]) => (user.inv[k] || 0) > 0 && typeof v.price === "number")
      .map(([k, v]) => [{ text: `${v.title} x${user.inv[k]} (+${v.heal}⚡)`, callback_data: `eat_${k}` }]);
    if (eatButtons.length) kb.push(...eatButtons);

    const bedKeys = ["bed1", "bed2", "bed3"].filter(k => CONFIG.UPGRADES[k]);

    // Текущая кровать = самая старшая из купленных
    let currentIdx = -1;
    for (let i = bedKeys.length - 1; i >= 0; i--) {
      if (owned.has(bedKeys[i])) { currentIdx = i; break; }
    }
    const currentKey   = currentIdx >= 0 ? bedKeys[currentIdx] : null;
    const currentTitle = currentKey ? (CONFIG.UPGRADES[currentKey]?.title || "Кровать") : "Нет кровати";
    
    // Статусная строка «что установлено» + множитель
    kb.push([{ text: `🛏 Установлена: ${currentTitle} • x${mult} к отдыху`, callback_data: "noop" }]);
    
    // Показать только СЛЕДУЮЩУЮ кровать (если есть), иначе — заглушку MAX
    const nextKey = bedKeys[currentIdx + 1];
    if (nextKey) {
      const it = CONFIG.UPGRADES[nextKey];
      const effect =
        nextKey === "bed1" ? "Rest +50% быстрее" :
        nextKey === "bed2" ? "Rest +100% быстрее" :
        nextKey === "bed3" ? "Rest +200% быстрее" : (it?.desc || "");
      const row = [{ text: `${it.title} — ${effect} — $${it.price}`, callback_data: `upg:buy:${nextKey}` }];
      if (typeof it.price_premium === "number") {
        row.push({ text: `За ${CONFIG.PREMIUM.emoji}${it.price_premium}`, callback_data: `upg:buy_p:${nextKey}` });
      }
      kb.push(row);
    } else {
      kb.push([{ text: "✅ Кровать максимального уровня", callback_data: "noop" }]);
    }
    
    const back = (opts && typeof opts.backTo === "string" && opts.backTo) ? opts.backTo : "City";
    kb.push([{ text: "⬅️ Назад к выбору работы", callback_data: `go:${back}` }]);
    return kb;
  }

  // ---------- Магазин ----------
// UiFactory.js
shop(opts = {}) {
  const items = Object.entries(CONFIG.SHOP).map(([k, v]) => {
    const label = (typeof v.price === "number")
      ? `${v.title} – $${v.price}`
      : (typeof v.price_premium === "number")
        ? `${v.title} – ${CONFIG.PREMIUM.emoji}${v.price_premium}`
        : `${v.title}`;
    return [{ text: label, callback_data: `buy_${k}` }];
  });

  const backTo   = opts?.backTo || null;
  const backText =
    backTo === "Work"  ? "⬅️ Назад к выбору работы" :
    backTo === "Study" ? "⬅️ Назад к Учёбе" :
    backTo === "Gym"   ? "⬅️ Назад в Зал" :
                         "⬅️ Назад";
  const backCb = backTo ? `go:${backTo}` : "go:ShopHub";
  items.push([{ text: backText, callback_data: backCb }]);
  return items;
}



  

  // ---------- Казино ----------
  casinoMenu() {
    const PRICES = Array.isArray(CONFIG.CASINO.prices) && CONFIG.CASINO.prices.length
      ? CONFIG.CASINO.prices
      : [CONFIG.CASINO.price_low, CONFIG.CASINO.price_high];

    const rows = [];
    for (let i = 0; i < PRICES.length; i += 2) {
      const row = [];
      const p1 = PRICES[i];
      row.push({ text: `🎡 Спин – $${p1}`, callback_data: `casino_spin:${p1}` });
      const p2 = PRICES[i + 1];
      if (p2 != null) row.push({ text: `🎡 Спин – $${p2}`, callback_data: `casino_spin:${p2}` });
      rows.push(row);
    }
    rows.push([{ text: "🃏 All in", callback_data: "casino_allin:ask" }]);
    rows.push([
      { text: "ℹ️ Таблица выплат", callback_data: "casino_info" },
      { text: "⬅️ Назад", callback_data: "go:Earn" }
    ]);
    return rows;
  }

  // ===== Зал (ключевой раздел: показывает растущие $ и ⚡) =====
  gym(user, now = Date.now(), ffCost = null) {
    if (user?.gym?.active) {
      const startAt = user.gym.startAt || 0;
      const endAt   = user.gym.endAt   || 1;
      const elapsed = Math.max(0, now - startAt);
      const need    = Math.max(1, endAt - startAt);
      const progress= Math.min(100, Math.floor((elapsed / need) * 100));
      const ready   = now >= endAt;
    
      if (ready) {
        return [
          [{ text: `⏳ Прогресс: ${progress}%`, callback_data: "noop" }],
          [{ text: "✅ Завершить тренировку", callback_data: "gym:finish" }],
          [{ text: "⬅️ Назад", callback_data: "go:Progress" }],
        ];
      }
    
      const costLabel = (typeof ffCost === "number" && ffCost > 0)
        ? `${CONFIG.PREMIUM.emoji}${ffCost}`
        : `${CONFIG.PREMIUM.emoji}?`;
      return [
        [{ text: `⏳ Прогресс: ${progress}%`, callback_data: "noop" }],
        [{ text: `⏩ Завершить сейчас (${costLabel})`, callback_data: "gym:skip" }],
        [{ text: "⬅️ Назад", callback_data: "go:Progress" }],
      ];
    }
    

    // получаем текущие параметры тренировки из сервиса
    const { timeMs, costMoney, costEnergy } = GymService.computeForUser(user);
    const mins = Math.max(1, Math.round(timeMs / 60000));

    return [
      [{
        text: `🏋️ Начать(−$${costMoney}, −${costEnergy}⚡, ~${mins} мин)`,
        callback_data: "gym:start"
      }],
      [{ text: "⬅️ Назад", callback_data: "go:Progress" }],
    ];
  }

  // ---------- Улучшения ----------
  upgradesCaption(user) {
    const owned = new Set(user.upgrades || []);
    const lines = [`🛠 Улучшения:`];

    // кровати скрываем — покупаются в Доме
    for (const key of Object.keys(CONFIG.UPGRADES)) {
      if (key === "bed1" || key === "bed2" || key === "bed3") continue;
      const it = CONFIG.UPGRADES[key];
      const mark = owned.has(key) ? "✅" : "—";
      const alt = (typeof it.price_premium === "number") ? ` / ${CONFIG.PREMIUM?.emoji || "💎"}${it.price_premium}` : "";
      lines.push(`${mark} ${it.title}: ${it.desc} `);
    }
    return lines.join("\n");
  }

  upgrades(user) {
    const owned = new Set(user.upgrades || []);
    const rows = [];
    for (const key of Object.keys(CONFIG.UPGRADES)) {
      if (key === "bed1" || key === "bed2" || key === "bed3") continue;
      const it = CONFIG.UPGRADES[key];
      if (owned.has(key)) {
        rows.push([{ text: `✅ ${it.title}`, callback_data: "noop" }]);
      } else {
        const row = [{ text: `${it.title} — $${it.price}`, callback_data: `upg:buy:${key}` }];
        if (typeof it.price_premium === "number") {
          row.push({ text: `Купить за ${CONFIG.PREMIUM.emoji}${it.price_premium}`, callback_data: `upg:buy_p:${key}` });
        }
        rows.push(row);
      }
    }
    rows.push([{ text: "⬅️ Назад", callback_data: "go:Progress" }]);
    return rows;
  }

  // ---------- Соц ----------
  cityBoard() {
    return [
      [{ text: "💸 Внести вклад", callback_data: "city:contribute" }],
      [
        { text: "🏆 Топ дня",    callback_data: "city:topday" },
        { text: "🏆 Топ недели", callback_data: "city:topweek" }
      ],
      [
        { text: "🧠 Топ умников", callback_data: "city:topsmart" },
        { text: "💪 Топ силачей",    callback_data: "city:topstrong" }
      ],
      // [
      //   { text: "🤠 Самый везучий палец на Диком Западе!", callback_data: "city:toplucky" }
      // ],
      [{ text: "✏️ Изменить ник", callback_data: "social:name" }],
      [{ text: "⬅️ Назад", callback_data: "go:City" }],
    ];
  }
  
  
  // Экран “Топ силачей” — назад
cityTopStrong() {
  return [
    [{ text: "⬅️ Назад к табло", callback_data: "go:CityBoard" }],
  ];
}

  cityTopDay() {
    return [
      [{ text: "⬅️ Назад к табло", callback_data: "go:CityBoard" }],
    ];
  }

  cityTopDayCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "🏆 Топ дня\n\nПока пусто. Будь первым!";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["🏆 Топ дня\n"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      lines.push(`${m} ${x.name} — $${x.total}`);
    });
    return lines.join("\n");
  }
  cityTopWeekCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "🏆 Топ недели\n\nПока пусто. Будь первым!";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["🏆 Топ недели\n"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      lines.push(`${m} ${x.name} — $${x.total}`);
    });
    return lines.join("\n");
  }
  cityTopSmartCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "🧠 Топ умников (уровень)\n\nПока пусто. Будь первым!";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["🧠 Топ умников.\n\nУ кого самый высокий уровень обучения?!\n"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const lvl = typeof x.level === "number" ? x.level : 0;
      lines.push(`${m} ${x.name} — Lvl ${lvl}`);
    });
    return lines.join("\n");
  }
  // Caption для “Топ силачей”
cityTopStrongCaption(list) {
  if (!Array.isArray(list) || !list.length) {
    return "💪 Топ силачей\n\nПока пусто. Будь первым!";
  }
  const medals = ["🥇","🥈","🥉"];
  const lines = ["💪 Топ силачей\n\nУ кого самая большая максимальная энергия?!\n"];
  list.forEach((x, i) => {
    const m = medals[i] || `${i+1}.`;
    const cap = typeof x.energyMax === "number" ? x.energyMax : 0;
    const lvl = typeof x.level === "number" ? x.level : null;
    const levelPart = lvl != null ? ` (ур. зала: ${lvl})` : "";
    lines.push(`${m} ${x.name} — ⚡ кап: ${cap}${levelPart}`);
  });
  return lines.join("\n");
}

// Кнопка «назад» для экрана lucky
cityTopLucky() {
  return [
    [{ text: "⬅️ Назад к табло", callback_data: "go:CityBoard" }],
  ];
}

cityTopLuckyCaption(list) {
  if (!Array.isArray(list) || !list.length) {
    return "🤠 Самый везучий палец на Диком Западе\n\nПока пусто. Будь первым!";
  }
  const medals = ["🥇","🥈","🥉"];
  const lines = ["🏅 Рекорд за спин в казино!\n"];
  list.forEach((x, i) => {
    const m = medals[i] || `${i+1}.`;
    const best = typeof x.best === "number" ? x.best : 0;
    lines.push(`${m} ${x.name} — $${best}`);
  });
  return lines.join("\n");
}


}
