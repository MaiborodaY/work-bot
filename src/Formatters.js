// Formatters.js
import { CONFIG } from "./GameConfig.js";
import { EconomyService } from "./EconomyService.js";

/**
 * Универсальные текстовые форматтеры UI.
 * ЕДИНЫЙ источник правды для шапки баланса — Formatters.balance().
 * Отдельный хелпер для строки про учёбу — Formatters.studyLine().
 */
export const Formatters = {
  /**
   * Шапка баланса игрока (многострочная).
   * @param {object} u
   * @returns {string}
   */
  balance(u) {
    const money     = Number.isFinite(u?.money) ? u.money : 0;
    const energy    = Number.isFinite(u?.energy) ? u.energy : 0;
    const energyMax = Number.isFinite(u?.energy_max) ? u.energy_max : (CONFIG?.ENERGY_MAX ?? 100);
    const premium   = Number.isFinite(u?.premium) ? u.premium : 0;
    const gemEmoji  = CONFIG?.PREMIUM?.emoji ?? "💎";

    return (
      `💰 Деньги: $${money}\n` +
      `⚡ Энергия: ${energy}/${energyMax}\n` +
      `${gemEmoji} Кристаллы: ${premium}`
    );
  },
    /** Однострочный вывод только денег. */
    moneyLine(u) {
      const money = Number.isFinite(u?.money) ? u.money : 0;
      return `💰 Деньги: $${money}`;
    },

  /**
   * Однострочное описание текущего уровня учёбы и бонуса к скорости работ.
   * @param {object} u
   * @returns {string}
   */
  studyLine(u) {
    const level   = Math.max(0, Number.isFinite(u?.study?.level) ? u.study.level : 0);
    const maxL    = (CONFIG?.STUDY?.MAX_LEVEL ?? 50);
    // Бонус: +1% к скорости работ за уровень, кап по MAX_LEVEL (логика отображения)
    return `📚 Учёба: уровень ${Math.min(level, maxL)} (+${Math.min(level, maxL)}% к скорости работ)`;
  },
    /**
   * Бонус от ноутбука к выплатам за работу.
   * @param {object} u
   * @returns {string} "💻 Ноутбук: +10% к выплатам" | "+0% ..."
   */
    laptopLine(u) {
      const has = Array.isArray(u?.upgrades) && u.upgrades.includes("laptop");
      return `💻 Ноутбук: +${has ? 10 : 0}% к выплатам`;
    },
  
    /**
     * Бонус от кофемашины к расходу энергии на работу.
     * @param {object} u
     * @returns {string} "☕ Кофемашина: −5% к расходу энергии" | "−0% ..."
     */
    coffeeLine(u) {
      const has = Array.isArray(u?.upgrades) && u.upgrades.includes("coffee");
      return `☕ Кофемашина: −${has ? 5 : 0}% к расходу энергии`;
    },
    
      /**
   * Бонус от машины к времени работы.
   * @param {object} u
   * @returns {string} "🚗 Машина: −10% к времени работы" | "−0% ..."
   */
  carLine(u) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("car");
    return `🚗 Машина: −${has ? 10 : 0}% к времени работы`;
  },

/**
   * НОВОЕ: компактный блок перков работы.
   * — Показываем только активные бонусы (вариант С).
   * — Если `opts.hints === true`, добавим лёгкие подсказки для отсутствующих апгрейдов.
   *
   * @param {object} u
   * @param {{hints?: boolean}} [opts]
   * @returns {string} Готовый многострочный блок (включая строку учёбы первой)
   */
workPerks(u, opts = {}) {
  const hints = !!opts.hints;
  const lines = [];

  // 1) всегда показываем учёбу
  lines.push(this.studyLine(u));

  // 2) только активные бонусы от апгрейдов
  const hasLaptop = this._hasUpgrade(u, "laptop");
  const hasCoffee = this._hasUpgrade(u, "coffee");
  const hasCar    = this._hasUpgrade(u, "car");

  if (hasLaptop) lines.push("💻 Ноутбук: +10% к выплатам");
  if (hasCoffee) lines.push("☕ Кофемашина: −5% к расходу энергии");
  if (hasCar)    lines.push("🚗 Машина: −10% к времени работы");

  // 3) мягкие подсказки (опционально)
  if (hints) {
    const missing = [];
    if (!hasLaptop) missing.push("ноутбук");
    if (!hasCoffee) missing.push("кофемашина");
    if (!hasCar)    missing.push("машина");
    if (missing.length) {
      // короткая нейтральная подсказка — без цен/магазинов
      lines.push("💡 Доступно улучшение: " + missing.join(", "));
    }
  }

  return lines.join("\n");
},

/** Вспомогательный — единая проверка владения апгрейдом. */
_hasUpgrade(u, key) {
  return Array.isArray(u?.upgrades) && u.upgrades.includes(key);
},




  /**
   * Полный рендер статуса игрока.
   * Баланс — из balance(), учёба — из studyLine().
   * @param {object} u
   * @param {{ economy?: EconomyService, now?: ()=>number, pct?: (a:number,b:number)=>number }} [deps]
   * @returns {string}
   */
  status(u, deps = {}) {
    const economy =
      deps.economy instanceof EconomyService ? deps.economy : new EconomyService();
    const now =
      typeof deps.now === "function" ? deps.now : () => Date.now();
    const pct =
      typeof deps.pct === "function"
        ? deps.pct
        : (a, b) => (b > 0 ? Math.min(100, Math.floor((a / b) * 100)) : 0);

    const lines = [];

    // Заголовок
    lines.push("📊 Статус");

    // Имя/ник
    const nick = u?.displayName && String(u.displayName).trim()
      ? u.displayName
      : "без ника";
    lines.push(`👤 Ник: ${nick}`);

    // Баланс
    lines.push(Formatters.balance(u));

    // Текущая работа — только через jobs.active[0]
    const inst = u?.jobs?.active?.[0] || null;
    if (inst) {
      const leftMs  = Math.max(0, (inst.endAt || 0) - now());
      const mins    = Math.ceil(leftMs / 60000);
      const total   = Math.max(1, (inst.endAt || 0) - (inst.startAt || 0));
      const elapsed = Math.max(0, total - leftMs);
      const progress = pct(elapsed, total);
      lines.push(`🕒 Смена: ${inst.title} — ${progress}% (~${mins} мин)`);
    } else {
      lines.push("🟢 Сейчас ты свободен");
    }

    // Учёба (всегда показываем текущий уровень/бонус одной строкой)
    lines.push(Formatters.studyLine(u));

    return lines.join("\n");
  },

  casinoBestLine(u) {
    const best = Math.max(0, Number(u?.casino?.bestSingleWin) || 0);
    return `🏆 Рекорд за 1 спин: $${best}`;
  },
  

  /**
   * Статистика казино: две строки (день и неделя, UTC) + нетто.
   * @param {object} u
   * @returns {string} две строки, разделённые \n
   */
  casinoStatsLines(u) {
    const fmt = (n) => `$${Number(n || 0)}`;
  
    // day/week ключи на момент показа — если не совпали, показываем 0/0/0
    const today = new Date().toISOString().slice(0, 10);
    const weekKeyUTC = () => {
      const d = new Date();
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = (tmp.getUTCDay() + 6) % 7;
      const th = new Date(tmp); th.setUTCDate(tmp.getUTCDate() - dayNum + 3);
      const firstTh = new Date(Date.UTC(th.getUTCFullYear(), 0, 4));
      const diffDays = Math.floor((th.getTime() - firstTh.getTime()) / 86400000);
      const week = 1 + Math.floor(diffDays / 7);
      return `${th.getUTCFullYear()}${String(week).padStart(2,"0")}`;
    };
    const curW = weekKeyUTC();
  
    const st = (u?.casino?.stats && typeof u.casino.stats === "object") ? u.casino.stats : null;
  
    const dayOk = st && st.day === today;
    const wonD  = dayOk ? (st.won  || 0) : 0;
    const lostD = dayOk ? (st.lost || 0) : 0;
    const netD  = wonD - lostD;
  
    const wkOk  = st && st.week === curW;
    const wonW  = wkOk ? (st.wonW  || 0) : 0;
    const lostW = wkOk ? (st.lostW || 0) : 0;
    const netW  = wonW - lostW;
  
    const best = Math.max(0, Number(u?.casino?.bestSingleWin) || 0);
  
    const lineDay   = `За сегодня: выиграл ${fmt(wonD)} • проиграл ${fmt(lostD)} • итого ${fmt(netD)}`;
    const lineWeek  = `За неделю:  выиграл ${fmt(wonW)} • проиграл ${fmt(lostW)} • итого ${fmt(netW)}`;
    const lineBest  = `\n🏅 Рекорд за спин: ${fmt(best)}`;
  
    return `${lineDay}\n${lineWeek}\n${lineBest}`;
  },
  
  
  
};
