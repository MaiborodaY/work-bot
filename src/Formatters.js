// Formatters.js
import { CONFIG } from "./GameConfig.js";
import { EconomyService } from "./EconomyService.js";
import { normalizeLang, t } from "./i18n/index.js";
import { getJobTitle } from "./I18nCatalog.js";
import { EnergyService } from "./EnergyService.js";
import { ProgressionService } from "./ProgressionService.js";

export const Formatters = {
  _lang(u, lang = null) {
    return normalizeLang(lang || u?.lang || "ru");
  },

  _t(u, key, vars = {}, lang = null) {
    return t(key, this._lang(u, lang), vars);
  },

  balance(u, opts = {}, lang = null) {

    // Backward compatible signature:

    // - balance(u, "en")

    // - balance(u, { showGems: false }, "en")

    if (typeof opts === "string" || opts == null) {

      lang = opts;

      opts = {};

    }

    const money     = Number.isFinite(u?.money) ? u.money : 0;

    const energy    = Number.isFinite(u?.energy) ? u.energy : 0;

    const energyMax = EnergyService.effectiveEnergyMax(u);

    const premium   = Number.isFinite(u?.premium) ? u.premium : 0;

    const gemEmoji  = CONFIG?.PREMIUM?.emoji ?? "💎";

    const showGems  = opts?.showGems !== false;

  

    const lines = [

      this._t(u, "fmt.balance.money", { money }, lang),

      this._t(u, "fmt.balance.energy", { energy, energyMax }, lang),

    ];

    if (showGems) lines.push(this._t(u, "fmt.balance.gems", { gemEmoji, premium }, lang));

    return lines.join("\n");

  },
  moneyLine(u, lang = null) {
    const money = Number.isFinite(u?.money) ? u.money : 0;
    return this._t(u, "fmt.money_line", { money }, lang);
  },

  studyLine(u, lang = null) {
    const level = Math.min(Math.max(Number(u?.study?.level) || 0, 0), CONFIG?.STUDY?.MAX_LEVEL ?? 50);
    return this._t(u, "fmt.study_line", { level }, lang);
  },

  laptopLine(u, lang = null) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("laptop");
    return this._t(u, "fmt.laptop_line", { pct: has ? 10 : 0 }, lang);
  },

  coffeeLine(u, lang = null) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("coffee");
    return this._t(u, "fmt.coffee_line", { pct: has ? 5 : 0 }, lang);
  },

  carLine(u, lang = null) {
    const has = Array.isArray(u?.upgrades) && u.upgrades.includes("car");
    return this._t(u, "fmt.car_line", { pct: has ? 10 : 0 }, lang);
  },

  workPerks(u, opts = {}, lang = null) {
    const hints = !!opts.hints;
    const lines = [];
    const l = this._lang(u, lang);

    lines.push(this.studyLine(u, l));

    const hasLaptop = this._hasUpgrade(u, "laptop");
    const hasCoffee = this._hasUpgrade(u, "coffee");
    const hasCar    = this._hasUpgrade(u, "car");

    if (hasLaptop) lines.push(this._t(u, "fmt.laptop_line", { pct: 10 }, l));
    if (hasCoffee) lines.push(this._t(u, "fmt.coffee_line", { pct: 5 }, l));
    if (hasCar)    lines.push(this._t(u, "fmt.car_line", { pct: 10 }, l));

    if (hints) {
      const missing = [];
      if (!hasLaptop) missing.push(this._t(u, "fmt.upgrade_name.laptop", {}, l));
      if (!hasCoffee) missing.push(this._t(u, "fmt.upgrade_name.coffee", {}, l));
      if (!hasCar)    missing.push(this._t(u, "fmt.upgrade_name.car", {}, l));
      if (missing.length) {
        lines.push(this._t(u, "fmt.work_perks.tip", { list: missing.join(", ") }, l));
      }
    }

    return lines.join("\n");
  },

  _hasUpgrade(u, key) {
    return Array.isArray(u?.upgrades) && u.upgrades.includes(key);
  },

  _progressBar(pct, width = 10) {
    const safePct = Math.max(0, Math.min(100, Math.floor(Number(pct) || 0)));
    const filled = Math.max(0, Math.min(width, Math.round((safePct / 100) * width)));
    return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
  },

  _playerCosmeticPrefix(cosmetic, currentWeek = "") {
    const tier = String(cosmetic?.tier || "");
    const weekKey = String(cosmetic?.weekKey || "");
    if (currentWeek && weekKey && weekKey !== currentWeek) return "";
    if (tier === "top1") return "🥇";
    if (tier === "top2") return "🥈";
    if (tier === "top3") return "🥉";
    return "";
  },

  status(u, deps = {}, lang = null) {
    const economy =
      deps.economy instanceof EconomyService ? deps.economy : new EconomyService();
    const now = typeof deps.now === "function" ? deps.now : () => Date.now();
    const pct =
      typeof deps.pct === "function"
        ? deps.pct
        : (a, b) => (b > 0 ? Math.min(100, Math.floor((a / b) * 100)) : 0);

    const lines = [];
    const l = this._lang(u, lang);
    lines.push(this._t(u, "fmt.status.title", {}, l));

    const nick = u?.displayName && String(u.displayName).trim()
      ? u.displayName
      : this._t(u, "fmt.status.player_fallback", {}, l);
    const cosmeticPrefix = this._playerCosmeticPrefix(u?.clanCosmetic, deps?.clanWeekKey || "");
    const shownNick = cosmeticPrefix ? `${cosmeticPrefix} ${nick}` : nick;
    lines.push(this._t(u, "fmt.status.name", { shownNick }, l));
    const clanName = typeof deps?.clanName === "string" ? deps.clanName.trim() : "";
    const clanId = String(u?.clan?.clanId || "");
    if (u?.clan?.clanId) {
      lines.push(this._t(u, "fmt.status.clan_selected", { clan: clanName || `#${clanId}` }, l));
    } else {
      lines.push(this._t(u, "fmt.status.clan_none", {}, l));
    }

    lines.push(Formatters.balance(u, l));

    const levelInfo = ProgressionService.getLevelInfo(u);
    lines.push(this._t(u, "fmt.status.level", { level: levelInfo.level }, l));
    if (levelInfo.isMax) {
      lines.push(this._t(u, "fmt.status.level_xp_max", { xp: levelInfo.xp, maxLevel: levelInfo.maxLevel }, l));
    } else {
      lines.push(this._t(u, "fmt.status.level_xp", {
        xp: levelInfo.xp,
        nextLevelXp: levelInfo.nextLevelXp
      }, l));
    }
    lines.push(this._progressBar(levelInfo.progressPct));
    const pendingReward = ProgressionService.getPendingReward(u);
    if (pendingReward) {
      lines.push(this._t(u, "fmt.status.level_reward_ready", {
        fromLevel: pendingReward.fromLevel,
        toLevel: pendingReward.toLevel,
        gems: pendingReward.gems
      }, l));
    }

    const inst = u?.jobs?.active?.[0] || null;
    if (inst) {
      const leftMs  = Math.max(0, (inst.endAt || 0) - now());
      const mins    = Math.ceil(leftMs / 60000);
      const total   = Math.max(1, (inst.endAt || 0) - (inst.startAt || 0));
      const elapsed = Math.max(0, total - leftMs);
      const progress = pct(elapsed, total);
      const jobTitle = getJobTitle(inst.typeId, l) || inst.title || this._t(u, "fmt.status.shift_fallback", {}, l);
      lines.push(this._t(u, "fmt.status.shift_active", { jobTitle, progress, mins }, l));
    } else {
      lines.push(this._t(u, "fmt.status.shift_none", {}, l));
    }

    if (deps?.employmentLine && String(deps.employmentLine).trim()) {
      lines.push(String(deps.employmentLine).trim());
    }

    const passState = EnergyService.gymPassState(u);
    if (passState.active) {
      const leftMin = Math.max(1, Math.ceil(passState.leftMs / 60000));
      const d = Math.floor(leftMin / (24 * 60));
      const h = Math.floor((leftMin % (24 * 60)) / 60);
      const m = leftMin % 60;
      lines.push(this._t(u, "fmt.status.gym_pass_active", {
        bonus: EnergyService.passCfg().bonusEnergyMax,
        d,
        h,
        m
      }, l));
    } else {
      lines.push(this._t(u, "fmt.status.gym_pass_inactive", {
        price: EnergyService.passCfg().priceGems
      }, l));
    }

    lines.push(Formatters.studyLine(u, l));

    const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
    const top1 = Number(stats.dailyTop1Count || 0);
    const top3 = Number(stats.dailyTop3Count || 0);
    const top10 = Number(stats.dailyTop10Count || 0);
    lines.push(this._t(u, "fmt.status.top1", { count: top1 }, l));
    lines.push(this._t(u, "fmt.status.top3", { count: top3 }, l));
    lines.push(this._t(u, "fmt.status.top10", { count: top10 }, l));

    return lines.join("\n");
  },

  casinoBestLine(u, lang = null) {
    const best = Math.max(0, Number(u?.casino?.bestSingleWin) || 0);
    return this._t(u, "fmt.casino.best_line", { best }, lang);
  },

  casinoStatsLines(u, lang = null) {
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

    const l = this._lang(u, lang);
    const lineDay = this._t(u, "fmt.casino.day_line", {
      won: fmt(wonD), lost: fmt(lostD), net: fmt(netD)
    }, l);
    const lineWeek = this._t(u, "fmt.casino.week_line", {
      won: fmt(wonW), lost: fmt(lostW), net: fmt(netW)
    }, l);
    const wonAll  = st ? (st.wonAll  || 0) : 0;
    const lostAll = st ? (st.lostAll || 0) : 0;
    const netAll  = wonAll - lostAll;
    const lineAll = this._t(u, "fmt.casino.all_line", {
      won: fmt(wonAll), lost: fmt(lostAll), net: fmt(netAll)
    }, l);
    const lineBest = `\n${this._t(u, "fmt.casino.best_line_compact", { best: fmt(best) }, l)}`;

    return `${lineDay}\n${lineWeek}\n${lineAll}\n${lineBest}`;
  },
};
