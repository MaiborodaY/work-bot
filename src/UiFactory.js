// UiFactory.js
import { CONFIG } from "./GameConfig.js";
import { GymService } from "./GymService.js";

export class UiFactory {
  mainReply() {
    return {
      keyboard: [[{ text: "🧭 Меню" }, { text: "👤 Профиль" }]],
      resize_keyboard: true,
    };
  }

  square() {
    return [
      [{ text: "💼 Заработок", callback_data: "go:Earn" }],
      [{ text: "📈 Прогресс", callback_data: "go:Progress" }],
      [{ text: "🎮 Мини-игры", callback_data: "go:MiniGames" }],
      [{ text: "🏙️ Город", callback_data: "go:City" }],
      [{ text: "🛍️ Магазин", callback_data: "go:ShopHub" }],
    ];
  }
  
  miniGames() {
    return [
      [{ text: "🛡️ Защита башнями", callback_data: "game:td" }],
      [{ text: "🏃‍♂️ Неуловимый бегун", callback_data: "game:runner" }],
      [{ text: "⬅️ На Площадь", callback_data: "go:Square" }],
    ];
  }
  
  earn() {
    return [
      [{ text: "🛠️ Работы", callback_data: "go:Work" }],
      [{ text: "🍻 Бар", callback_data: "go:Bar" }],
      [{ text: "🏢 Бизнес", callback_data: "go:Business" }],
      [{ text: "⬅️ Назад в город", callback_data: "go:Square" }]
    ];
  }
  progress() {
    return [
      [{ text: "🎓 Учеба", callback_data: "go:Study" }],
      [{ text: "🏋️ Зал", callback_data: "go:Gym" }],
      [{ text: "🛠️ Улучшения", callback_data: "go:Upgrades" }],
      [{ text: "⬅️ Назад в город", callback_data: "go:Square" }],
    ];
  }
  city() {
    return [
      [{ text: "🏠 Дом и отдых", callback_data: "go:Home" }],
      [{ text: "🏆 Доска почёта", callback_data: "go:CityBoard" }],
      [{ text: "⬅️ Назад в город", callback_data: "go:Square" }],
    ];
  }
  shopHub() {
    return [
      [{ text: "🍔 Магазин еды", callback_data: "go:Shop" }],
      [{ text: "💎 Премиум", callback_data: "premium:open" }],
      [{ text: "⬅️ Назад в город", callback_data: "go:Square" }],
    ];
  }
       

  bar(user, now = Date.now()) {
    const kb = [];
    const bar = user.bar || {};
    const tasks = Array.isArray(bar.tasks) ? bar.tasks : [];
  
    kb.push([{ text: "📋 Задания бара", callback_data: "bar:tasks" }]);
  
    const today = new Date().toISOString().slice(0,10);
    const freeUsed = (user?.casino?.free?.day === today);
    const subDay = user?.subReward?.day || "";
    const eligible = !!(user?.subReward?.eligible);
    const showSubBtn = !freeUsed && (subDay !== today || eligible === true);
    // if (showSubBtn) {
    //   kb.push([{ text: "Получить бесплатное вращение", callback_data: "bar:sub" }]);
    // }
  
    kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);
    return kb;
  }

  barTasks(user) {
    const kb = [];
    const tasks = Array.isArray(user?.bar?.tasks) ? user.bar.tasks : [];
  
    if (!tasks.length) {
      kb.push([{ text: "😌 Заданий пока нет", callback_data: "noop" }]);
      kb.push([{ text: "⬅️ Назад", callback_data: "go:Bar" }]);
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
      const prog = t.id === "W1" ? `${t.progress}/${t.goal} смен` : `${t.progress}/${t.goal}`;
  
      kb.push([{ text: `🎯 ${t.title} (награда: ${rText})`, callback_data: "noop" }]);
      kb.push([{ text: `📊 Прогресс: ${prog}`, callback_data: "noop" }]);
  
      if (t.status === "done") {
        kb.push([{ text: "🎁 Забрать", callback_data: `bar:claim:${t.id}` }]);
      } else if (t.status === "claimed") {
        kb.push([{ text: "✅ Уже забрано", callback_data: "noop" }]);
      } else {
        kb.push([{ text: "⏳ Выполняется", callback_data: "noop" }]);
      }
    }
  
    kb.push([{ text: "⬅️ Назад", callback_data: "go:Bar" }]);
    return kb;
  }
  
  

// ---------- Работа ----------
  workV2(user, options = {}) {
    const { active = null, ready = false } = options;
    const kb = [];

    if (active) {
      if (ready) {
        kb.push([{ text: `💵 Получить выплату ($${active.plannedPay})`, callback_data: "work:claim" }]);
        kb.push([{ text: "✖️ Отменить смену", callback_data: "work:cancel" }]);
      } else {
        const left = Math.max(0, Math.ceil((active.endAt - Date.now())/60000));
        kb.push([{ text: `⏳ Выполняется ~${left} мин`, callback_data: "noop" }]);
        const costLabel = (typeof options.ffCost === "number" && options.ffCost > 0)
          ? `${CONFIG.PREMIUM.emoji}${options.ffCost}` : `${CONFIG.PREMIUM.emoji}?`;
        kb.push([{ text: `⏩ Завершить за ${costLabel}`, callback_data: "work:skip" }]);
        kb.push([{ text: "🛑 Отменить (штраф $5)", callback_data: "work:cancel" }]);
      }
      kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);
      return kb;
    }

    const entries = Object.entries(CONFIG.JOBS || {});
    const list = (user?.flags?.onboarding) ? entries.slice(0, 1) : entries;
    for (const [id, j] of list) {
      const mins = Math.max(1, Math.round((j.durationMs || 0) / 60000));
      kb.push([{
        text: `▶️ ${j.title} · ${mins} мин · $${j.pay} · ${j.energy}⚡`,
        callback_data: `work:start:${id}`
      }]);
    }

    kb.push([{ text: "⬅️ Назад в город", callback_data: "go:Square" }]);
    return kb;
  }

  // ---------- Учеба ----------
  studyIdle(effectsText) {
    return [
      [{ text: `📘 Начать учебу (${effectsText})`, callback_data: "study:start" }],
      [{ text: "⬅️ Назад к прогрессу", callback_data: "go:Progress" }],
    ];
  }

  studyActive(progress, { ready = false, ffCost = null } = {}) {
    if (ready) {
      return [
        [{ text: `📊 Прогресс: ${progress}%`, callback_data: "noop" }],
        [{ text: "🎓 Завершить учебу", callback_data: "study:finish" }],
        [{ text: "⬅️ Назад к прогрессу", callback_data: "go:Progress" }],
      ];
    }

    const costLabel = (typeof ffCost === "number" && ffCost > 0)
      ? `${CONFIG.PREMIUM.emoji}${ffCost}`
      : `${CONFIG.PREMIUM.emoji}?`;
    return [
      [{ text: `📊 Прогресс: ${progress}%`, callback_data: "noop" }],
      [{ text: `⏩ Завершить за ${costLabel}`, callback_data: "study:skip" }],
      [{ text: "⬅️ Назад к прогрессу", callback_data: "go:Progress" }],
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
      const approx = (mult === 1.5) ? "~1.5" : `${Math.round(1 * mult)}`;
      kb.push([{ text: `😴 Отдыхать (+${approx}⚡/5 мин)`, callback_data: "rest:start" }]);
    } else {
      kb.push([{ text: `⏹️ Остановить отдых (x${mult})`, callback_data: "rest:stop" }]);
    }


    const eatButtons = Object.entries(CONFIG.SHOP)
      .filter(([k, v]) => (user.inv[k] || 0) > 0 && typeof v.price === "number")
      .map(([k, v]) => [{ text: `${v.title} x${user.inv[k]} (+${v.heal}⚡)`, callback_data: `eat_${k}` }]);
    if (eatButtons.length) kb.push(...eatButtons);

    const bedKeys = ["bed1", "bed2", "bed3"].filter(k => CONFIG.UPGRADES[k]);

    let currentIdx = -1;
    for (let i = bedKeys.length - 1; i >= 0; i--) {
      if (owned.has(bedKeys[i])) { currentIdx = i; break; }
    }
    const currentKey   = currentIdx >= 0 ? bedKeys[currentIdx] : null;
    const currentTitle = currentKey ? (CONFIG.UPGRADES[currentKey]?.title || "Текущая кровать") : "Кровать не куплена";
    
    kb.push([{ text: `🛏️ Текущая кровать: ${currentTitle} (x${mult})`, callback_data: "noop" }]);
    
    const nextKey = bedKeys[currentIdx + 1];
    if (nextKey) {
      const it = CONFIG.UPGRADES[nextKey];
      const effect =
        nextKey === "bed1" ? "Отдых +50%" :
        nextKey === "bed2" ? "Отдых в 2 раза быстрее" :
        nextKey === "bed3" ? "Отдых в 3 раза быстрее" : (it?.desc || "");
      const row = [{ text: `${it.title} · ${effect} · $${it.price}`, callback_data: `upg:buy:${nextKey}` }];
      if (typeof it.price_premium === "number") {
        row.push({ text: `${CONFIG.PREMIUM.emoji}${it.price_premium}`, callback_data: `upg:buy_p:${nextKey}` });
      }
      kb.push(row);
    } else {
      kb.push([{ text: "✅ Все кровати куплены", callback_data: "noop" }]);
    }
    
    const back = (opts && typeof opts.backTo === "string" && opts.backTo) ? opts.backTo : "City";
    kb.push([{ text: "⬅️ Назад", callback_data: `go:${back}` }]);
    return kb;
  }

  // ---------- Магазин ----------
  shop(opts = {}) {
    const items = Object.entries(CONFIG.SHOP).map(([k, v]) => {
      const label = (typeof v.price === "number")
        ? `🛒 ${v.title} · $${v.price}`
        : (typeof v.price_premium === "number")
          ? `🛒 ${v.title} · ${CONFIG.PREMIUM.emoji}${v.price_premium}`
          : `🛒 ${v.title}`;
      return [{ text: label, callback_data: `buy_${k}` }];
    });

    const backTo   = opts?.backTo || null;
    const backText =
      backTo === "Work"  ? "⬅️ Назад к сменам" :
      backTo === "Study" ? "⬅️ Назад к учебе" :
      backTo === "Gym"   ? "⬅️ Назад в зал" :
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
      row.push({ text: `🎰 Крутить за $${p1}`, callback_data: `casino_spin:${p1}` });
      const p2 = PRICES[i + 1];
      if (p2 != null) row.push({ text: `🎰 Крутить за $${p2}`, callback_data: `casino_spin:${p2}` });
      rows.push(row);
    }
    rows.push([{ text: "🃏 All in", callback_data: "casino_allin:ask" }]);
    rows.push([
      { text: "ℹ️ Правила", callback_data: "casino_info" },
      { text: "⬅️ Назад", callback_data: "go:Earn" }
    ]);
    return rows;
  }

  // ===== Зал =====
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
          [{ text: `📊 Прогресс: ${progress}%`, callback_data: "noop" }],
          [{ text: "🏁 Завершить тренировку", callback_data: "gym:finish" }],
          [{ text: "⬅️ Назад к прогрессу", callback_data: "go:Progress" }],
        ];
      }
    
      const costLabel = (typeof ffCost === "number" && ffCost > 0)
        ? `${CONFIG.PREMIUM.emoji}${ffCost}`
        : `${CONFIG.PREMIUM.emoji}?`;
      return [
        [{ text: `📊 Прогресс: ${progress}%`, callback_data: "noop" }],
        [{ text: `⏩ Завершить за ${costLabel}`, callback_data: "gym:skip" }],
        [{ text: "⬅️ Назад к прогрессу", callback_data: "go:Progress" }],
      ];
    }
    

    const { timeMs, costMoney, costEnergy } = GymService.computeForUser(user);
    const mins = Math.max(1, Math.round(timeMs / 60000));

    return [
      [{
        text: `🏋️ Начать тренировку ($${costMoney}, ${costEnergy}⚡, ~${mins} мин)`,
        callback_data: "gym:start"
      }],
      [{ text: "⬅️ Назад к прогрессу", callback_data: "go:Progress" }],
    ];
  }

  // ---------- Улучшения ----------
  upgradesCaption(user) {
    const owned = new Set(user.upgrades || []);
    const lines = ["🛠️ Твои улучшения:"];

    for (const key of Object.keys(CONFIG.UPGRADES)) {
      if (key === "bed1" || key === "bed2" || key === "bed3") continue;
      const it = CONFIG.UPGRADES[key];
      const mark = owned.has(key) ? "✔" : "✖";
      const alt = (typeof it.price_premium === "number") ? ` / ${CONFIG.PREMIUM?.emoji || "💎"}${it.price_premium}` : "";
      lines.push(`${mark} ${it.title}: ${it.desc}${it.price ? ` · $${it.price}${alt}` : ""}`);
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
        rows.push([{ text: `✅ Куплено: ${it.title}` , callback_data: "noop" }]);
      } else {
        const row = [{ text: `🛒 ${it.title} · $${it.price}`, callback_data: `upg:buy:${key}` }];
        if (typeof it.price_premium === "number") {
          row.push({ text: `${CONFIG.PREMIUM.emoji}${it.price_premium}`, callback_data: `upg:buy_p:${key}` });
        }
        rows.push(row);
      }
    }
    rows.push([{ text: "⬅️ Назад", callback_data: "go:Progress" }]);
    return rows;
  }

  // ---------- Доска почета ----------
  cityBoard() {
    return [
      [{ text: "🤝 Внести вклад", callback_data: "city:contribute" }],
      [
        { text: "📅 Топ за день",    callback_data: "city:topday" },
        { text: "🗓️ Топ за неделю", callback_data: "city:topweek" }
      ],
      [
        { text: "🧠 Самые умные", callback_data: "city:topsmart" },
        { text: "💪 Самые выносливые",    callback_data: "city:topstrong" }
      ],
      [{ text: "✏️ Сменить имя", callback_data: "social:name" }],
      [{ text: "⬅️ Назад", callback_data: "go:City" }],
    ];
  }
  
  cityTopStrong() {
    return [
      [{ text: "⬅️ Назад", callback_data: "go:CityBoard" }],
    ];
  }

  cityTopDay() {
    return [
      [{ text: "⬅️ Назад", callback_data: "go:CityBoard" }],
    ];
  }

  cityTopDayCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "🏅 Топ дня\n\nПока пусто. Заработай и попадешь сюда.";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["🏅 Топ дня\n\nЛидеры по заработку:"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      lines.push(`${m} ${x.name} — $${x.total}`);
    });
    return lines.join("\n");
  }
  cityTopWeekCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "📆 Топ недели\n\nПока пусто. Заработай и попадешь сюда.";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["📆 Топ недели\n\nЛидеры недели:"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      lines.push(`${m} ${x.name} — $${x.total}`);
    });
    return lines.join("\n");
  }
  cityTopSmartCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "🧠 Самые умные (учеба)\n\nПока пусто. Учись, чтобы попасть сюда.";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["🧠 Самые умные.\n\nЛучшие по уровню обучения:"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const lvl = typeof x.level === "number" ? x.level : 0;
      lines.push(`${m} ${x.name} — Lvl ${lvl}`);
    });
    return lines.join("\n");
  }
  cityTopStrongCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "💪 Самые выносливые\n\nПока пусто. Тренируйся, чтобы попасть сюда.";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["💪 Самые выносливые.\n\nЛучшие по максимуму энергии:"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const cap = typeof x.energyMax === "number" ? x.energyMax : 0;
      const lvl = typeof x.level === "number" ? x.level : null;
      const levelPart = lvl != null ? ` (ур. тренировок: ${lvl})` : "";
      lines.push(`${m} ${x.name} — ${cap}⚡${levelPart}`);
    });
    return lines.join("\n");
  }

  cityTopLucky() {
    return [
      [{ text: "⬅️ Назад", callback_data: "go:CityBoard" }],
    ];
  }

  cityTopLuckyCaption(list) {
    if (!Array.isArray(list) || !list.length) {
      return "🍀 Самые везучие\n\nПока пусто. Попробуй удачу в казино.";
    }
    const medals = ["🥇","🥈","🥉"];
    const lines = ["🍀 Самые везучие:\n"];
    list.forEach((x, i) => {
      const m = medals[i] || `${i+1}.`;
      const best = typeof x.best === "number" ? x.best : 0;
      lines.push(`${m} ${x.name} — $${best}`);
    });
    return lines.join("\n");
  }

}
