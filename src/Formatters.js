// Formatters.js
import { CONFIG } from "./GameConfig.js";
import { EconomyService } from "./EconomyService.js";

export const Formatters = {
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

  moneyLine(u) {
    const money = Number.isFinite(u?.money) ? u.money : 0;
    return `💰 Деньги: $${money}`;
  },

  studyLine(u) {
    const level = Math.min(Math.max(Number(u?.study?.level) || 0, 0), CONFIG?.STUDY?.MAX_LEVEL ?? 50);
    return `📚 Учеба: уровень ${level} (+${level}% скорость работы)`;
  },

  laptopLine(u) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("laptop");
    return `💻 Ноутбук: +${has ? 10 : 0}% к оплате`;
  },

  coffeeLine(u) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("coffee");
    return `☕ Кофемашина: -${has ? 5 : 0}% к расходу энергии`;
  },

  carLine(u) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("car");
    return `🚗 Авто: +${has ? 10 : 0}% к скорости смены`;
  },

  workPerks(u, opts = {}) {
    const hints = !!opts.hints;
    const lines = [];

    lines.push(this.studyLine(u));

    const hasLaptop = this._hasUpgrade(u, "laptop");
    const hasCoffee = this._hasUpgrade(u, "coffee");
    const hasCar    = this._hasUpgrade(u, "car");

    if (hasLaptop) lines.push("💻 Ноутбук: +10% к оплате");
    if (hasCoffee) lines.push("☕ Кофемашина: -5% к расходу энергии");
    if (hasCar)    lines.push("🚗 Авто: +10% к скорости смены");

    if (hints) {
      const missing = [];
      if (!hasLaptop) missing.push("ноутбук");
      if (!hasCoffee) missing.push("кофемашина");
      if (!hasCar)    missing.push("авто");
      if (missing.length) {
        lines.push("💡 Совет: собери " + missing.join(", ") + " — это ускорит рост дохода.");
      }
    }

    return lines.join("\n");
  },

  _hasUpgrade(u, key) {
    return Array.isArray(u?.upgrades) && u.upgrades.includes(key);
  },

  status(u, deps = {}) {
    const economy =
      deps.economy instanceof EconomyService ? deps.economy : new EconomyService();
    const now = typeof deps.now === "function" ? deps.now : () => Date.now();
    const pct =
      typeof deps.pct === "function"
        ? deps.pct
        : (a, b) => (b > 0 ? Math.min(100, Math.floor((a / b) * 100)) : 0);

    const lines = [];
    lines.push("👤 Мой профиль");

    const nick = u?.displayName && String(u.displayName).trim()
      ? u.displayName
      : "Игрок";
    lines.push(`🎭 Имя: ${nick}`);
    if (u?.clan?.clanId) {
      lines.push(`👥 Клан: #${String(u.clan.clanId)}`);
    } else {
      lines.push("👥 Клан: не выбран");
    }

    lines.push(Formatters.balance(u));

    const inst = u?.jobs?.active?.[0] || null;
    if (inst) {
      const leftMs  = Math.max(0, (inst.endAt || 0) - now());
      const mins    = Math.ceil(leftMs / 60000);
      const total   = Math.max(1, (inst.endAt || 0) - (inst.startAt || 0));
      const elapsed = Math.max(0, total - leftMs);
      const progress = pct(elapsed, total);
      lines.push(`💼 Смена: ${inst.title} · ${progress}% (~${mins} мин)`);
    } else {
      lines.push("⏸️ Смена не запущена");
    }

    lines.push(Formatters.studyLine(u));

    const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
    const top1 = Number(stats.dailyTop1Count || 0);
    const top3 = Number(stats.dailyTop3Count || 0);
    const top10 = Number(stats.dailyTop10Count || 0);
    lines.push(`🧲 Магнит дня (1 место): ${top1} раз`);
    lines.push(`🥈 Топ-3 дня: ${top3} раз`);
    lines.push(`🏅 Топ-10 дня: ${top10} раз`);

    return lines.join("\n");
  },

  casinoBestLine(u) {
    const best = Math.max(0, Number(u?.casino?.bestSingleWin) || 0);
    return `🏅 Лучший выигрыш за попытку: $${best}`;
  },

  casinoStatsLines(u) {
    const fmt = (n) => `$${Number(n || 0)}`;
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

    const lineDay   = `📊 День: выигрыш ${fmt(wonD)} · траты ${fmt(lostD)} · итог ${fmt(netD)}`;
    const lineWeek  = `🗓️ Неделя: выигрыш ${fmt(wonW)} · траты ${fmt(lostW)} · итог ${fmt(netW)}`;
    const lineBest  = `\n🏅 Лучшая попытка: ${fmt(best)}`;

    return `${lineDay}\n${lineWeek}\n${lineBest}`;
  },
};
