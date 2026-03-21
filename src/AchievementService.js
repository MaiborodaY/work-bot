import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, ACHIEVEMENTS_BY_EVENT } from "./AchievementCatalog.js";
import { CONFIG } from "./GameConfig.js";
import { normalizeLang } from "./i18n/index.js";

function n(raw) {
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

export class AchievementService {
  constructor({ users, db, now, bot, ratings = null }) {
    this.users = users;
    this.db = db || users?.db || null;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.ratings = ratings || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _ensureModel(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;

    if (!u.achievements || typeof u.achievements !== "object") {
      u.achievements = {
        earned: {},
        progress: {},
        retroDone: false
      };
      dirty = true;
    }

    if (!u.achievements.earned || typeof u.achievements.earned !== "object" || Array.isArray(u.achievements.earned)) {
      u.achievements.earned = {};
      dirty = true;
    }
    if (!u.achievements.progress || typeof u.achievements.progress !== "object") {
      u.achievements.progress = {};
      dirty = true;
    }
    if (typeof u.achievements.retroDone !== "boolean") {
      u.achievements.retroDone = false;
      dirty = true;
    }

    const p = u.achievements.progress;
    const defaultsNum = {
      totalShifts: 0,
      totalEarned: 0,
      totalDividends: 0,
      successfulTheftsStreak: 0,
      theftSuccessTotal: 0,
      totalStolen: 0,
      defensesSuccess: 0,
      employeesHiredTotal: 0,
      clanContractsByUser: 0,
      stockBuysTotal: 0,
      farmHarvestTotal: 0,
      farmCornHarvest: 0,
      farmHarvestedTypesMask: 0,
      quizPerfectTotal: 0,
      quizPerfectStreak: 0
    };
    for (const [k, d] of Object.entries(defaultsNum)) {
      if (typeof p[k] !== "number" || !Number.isFinite(p[k])) {
        p[k] = d;
        dirty = true;
      }
    }

    if (typeof p.clanJoinedOnce !== "boolean") {
      p.clanJoinedOnce = false;
      dirty = true;
    }
    if (typeof p.clanCreatedOnce !== "boolean") {
      p.clanCreatedOnce = false;
      dirty = true;
    }

    const thiefTotal = Math.max(0, Math.floor(n(u?.thief?.totalStolen)));
    if (thiefTotal > p.totalStolen) {
      p.totalStolen = thiefTotal;
      dirty = true;
    }

    return dirty;
  }

  _isEarned(u, id) {
    const ts = n(u?.achievements?.earned?.[id]);
    return ts > 0;
  }

  _markEarned(u, id, ts) {
    const key = String(id || "");
    if (!key) return false;
    if (this._isEarned(u, key)) return false;
    u.achievements.earned[key] = Math.max(1, Math.floor(n(ts) || this.now()));
    return true;
  }

  _inc(u, key, delta = 1) {
    const d = Math.max(0, Math.floor(n(delta)));
    if (!d) return false;
    const prev = Math.max(0, Math.floor(n(u?.achievements?.progress?.[key])));
    const next = prev + d;
    u.achievements.progress[key] = next;
    return next !== prev;
  }

  _set(u, key, value) {
    const prev = u?.achievements?.progress?.[key];
    if (prev === value) return false;
    u.achievements.progress[key] = value;
    return true;
  }

  _rewardedReferralsCount(u) {
    const invited = Array.isArray(u?.referral?.invited) ? u.referral.invited : [];
    return invited.filter((x) => n(x?.rewardedAt) > 0).length;
  }

  _applyEventProgress(u, event, ctx = {}) {
    let changed = false;
    this._ensureModel(u);

    switch (String(event || "")) {
      case "work_claim": {
        changed = this._inc(u, "totalShifts", 1) || changed;
        changed = this._inc(u, "totalEarned", Math.max(0, Math.floor(n(ctx?.pay)))) || changed;
        break;
      }
      case "labour_hire": {
        changed = this._inc(u, "employeesHiredTotal", 1) || changed;
        break;
      }
      case "stocks_buy": {
        changed = this._inc(u, "stockBuysTotal", 1) || changed;
        break;
      }
      case "farm_harvest": {
        changed = this._inc(u, "farmHarvestTotal", 1) || changed;
        if (String(ctx?.cropId || "") === "corn") {
          changed = this._inc(u, "farmCornHarvest", 1) || changed;
        }
        const bitByCrop = { carrot: 1, tomato: 2, corn: 4 };
        const bit = bitByCrop[String(ctx?.cropId || "")] || 0;
        if (bit > 0) {
          const prevMask = Math.max(0, Math.floor(n(u?.achievements?.progress?.farmHarvestedTypesMask)));
          changed = this._set(u, "farmHarvestedTypesMask", prevMask | bit) || changed;
        }
        break;
      }
      case "stocks_dividend": {
        changed = this._inc(u, "totalDividends", Math.max(0, Math.floor(n(ctx?.amount)))) || changed;
        break;
      }
      case "thief_success": {
        changed = this._inc(u, "theftSuccessTotal", 1) || changed;
        changed = this._inc(u, "totalStolen", Math.max(0, Math.floor(n(ctx?.amount)))) || changed;
        changed = this._set(
          u,
          "successfulTheftsStreak",
          Math.max(0, Math.floor(n(u?.achievements?.progress?.successfulTheftsStreak))) + 1
        ) || changed;
        break;
      }
      case "thief_fail": {
        changed = this._set(u, "successfulTheftsStreak", 0) || changed;
        break;
      }
      case "thief_defense_success": {
        changed = this._inc(u, "defensesSuccess", 1) || changed;
        break;
      }
      case "clan_join": {
        changed = this._set(u, "clanJoinedOnce", true) || changed;
        break;
      }
      case "clan_create": {
        changed = this._set(u, "clanCreatedOnce", true) || changed;
        changed = this._set(u, "clanJoinedOnce", true) || changed;
        break;
      }
      case "clan_contracts_completed": {
        changed = this._inc(u, "clanContractsByUser", Math.max(0, Math.floor(n(ctx?.count)))) || changed;
        break;
      }
      case "referral_rewarded": {
        const count = Math.max(0, Math.floor(n(ctx?.count || this._rewardedReferralsCount(u))));
        changed = this._set(u, "referralsDone", count) || changed;
        break;
      }
      case "quiz_play": {
        const perfect = !!ctx?.perfect;
        if (perfect) {
          changed = this._inc(u, "quizPerfectTotal", 1) || changed;
          const streakFromCtx = Math.max(0, Math.floor(n(ctx?.streak)));
          const nextStreak = streakFromCtx > 0
            ? streakFromCtx
            : (Math.max(0, Math.floor(n(u?.achievements?.progress?.quizPerfectStreak))) + 1);
          changed = this._set(u, "quizPerfectStreak", nextStreak) || changed;
        } else {
          changed = this._set(u, "quizPerfectStreak", 0) || changed;
        }
        break;
      }
      default:
        break;
    }

    return changed;
  }

  async _isClanOwnerNow(u) {
    const clanId = String(u?.clan?.clanId || "").trim();
    if (!clanId || !this.db || typeof this.db.get !== "function") return false;
    const raw = await this.db.get(`clan:item:${clanId}`);
    if (!raw) return false;
    try {
      const clan = JSON.parse(raw);
      return String(clan?.ownerId || "") === String(u?.id || "");
    } catch {
      return false;
    }
  }

  _defsForEvent(event) {
    const key = String(event || "");
    return Array.isArray(ACHIEVEMENTS_BY_EVENT[key]) ? ACHIEVEMENTS_BY_EVENT[key] : [];
  }

  _knownDefs() {
    return Array.isArray(ACHIEVEMENTS) ? ACHIEVEMENTS : [];
  }

  _categoryForId(id) {
    const s = String(id || "");
    if (s.startsWith("work_")) return "work";
    if (s.startsWith("biz_") || s.startsWith("labour_")) return "biz";
    if (s.startsWith("gym_") || s.startsWith("study_")) return "growth";
    if (s.startsWith("pet_")) return "pet";
    if (s.startsWith("farm_")) return "farm";
    if (s.startsWith("quiz_")) return "quiz";
    if (s.startsWith("stocks_")) return "stocks";
    if (s.startsWith("thief_")) return "thief";
    if (s.startsWith("clan_")) return "clan";
    if (s.startsWith("referrals_")) return "ref";
    return "other";
  }

  _categoryTitle(cat, lang) {
    const l = this._lang(lang);
    if (cat === "farm") {
      return l === "en" ? "🌱 Farm" : "🌱 Ферма";
    }
    const map = {
      ru: {
        work: "💼 Работа",
        biz: "🏢 Бизнес",
        growth: "🏋️ Зал и учёба",
        pet: "🐾 Питомец",
        quiz: "🎯 Викторина",
        stocks: "📈 Биржа",
        thief: "🌑 Воровство",
        clan: "🤝 Клан",
        ref: "👥 Рефералы",
        other: "📌 Прочее"
      },
      uk: {
        work: "💼 Робота",
        biz: "🏢 Бізнес",
        growth: "🏋️ Зал і навчання",
        pet: "🐾 Улюбленець",
        quiz: "🎯 Вікторина",
        stocks: "📈 Біржа",
        thief: "🌑 Крадіжки",
        clan: "🤝 Клан",
        ref: "👥 Реферали",
        other: "📌 Інше"
      },
      en: {
        work: "💼 Work",
        biz: "🏢 Business",
        growth: "🏋️ Gym & Study",
        pet: "🐾 Pet",
        quiz: "🎯 Quiz",
        stocks: "📈 Stocks",
        thief: "🌑 Theft",
        clan: "🤝 Clan",
        ref: "👥 Referrals",
        other: "📌 Other"
      }
    };
    return (map[l] && map[l][cat]) || map.ru[cat] || map.ru.other;
  }

  _countOwnedBusinesses(u) {
    const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    let nBiz = 0;
    for (const x of arr) {
      const id = String(typeof x === "string" ? x : x?.id || "");
      if (id) nBiz += 1;
    }
    return nBiz;
  }

  _countBoughtSlots(u) {
    const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    let slots = 0;
    for (const entry of arr) {
      if (!entry || typeof entry !== "object") continue;
      const s = Array.isArray(entry.slots) ? entry.slots : [];
      slots += s.filter((x) => !!x?.purchased).length;
    }
    return slots;
  }

  _heldCompanies(u) {
    const holdings = (u?.stocks?.holdings && typeof u.stocks.holdings === "object")
      ? u.stocks.holdings
      : {};
    let count = 0;
    for (const h of Object.values(holdings)) {
      if (Math.max(0, Math.floor(n(h?.shares))) > 0) count += 1;
    }
    return count;
  }

  _rewardedReferrals(u) {
    const invited = Array.isArray(u?.referral?.invited) ? u.referral.invited : [];
    let c = 0;
    for (const x of invited) {
      if (Math.max(0, Math.floor(n(x?.rewardedAt))) > 0) c += 1;
    }
    return c;
  }

  _progressText(id, u, lang) {
    const l = this._lang(lang);
    const p = u?.achievements?.progress || {};
    const totalShifts = Math.max(0, Math.floor(n(p.totalShifts)));
    const totalEarned = Math.max(0, Math.floor(n(p.totalEarned)));
    const ownedBiz = this._countOwnedBusinesses(u);
    const boughtSlots = this._countBoughtSlots(u);
    const bizPts = ownedBiz + boughtSlots;
    const hires = Math.max(0, Math.floor(n(p.employeesHiredTotal)));
    const gymLevel = Math.max(0, Math.floor(n(u?.gym?.level)));
    const maxEnergy = Math.max(0, Math.floor(n(u?.energy_max)));
    const gymCap = Math.max(0, Number(CONFIG?.GYM?.MAX_ENERGY_CAP) || 160);
    const studyLevel = Math.max(0, Math.floor(n(u?.study?.level)));
    const hasPetNow = !!(u?.pet && typeof u.pet === "object" && String(u?.pet?.type || ""));
    const petFeedStreak = Math.max(0, Math.floor(n(u?.pet?.streak)));
    const farmHarvestTotal = Math.max(0, Math.floor(n(p.farmHarvestTotal)));
    const farmCornHarvest = Math.max(0, Math.floor(n(p.farmCornHarvest)));
    const farmMask = Math.max(0, Math.floor(n(p.farmHarvestedTypesMask)));
    const farmTypesCount = ((farmMask & 1) ? 1 : 0) + ((farmMask & 2) ? 1 : 0) + ((farmMask & 4) ? 1 : 0);
    const stockBuys = Math.max(0, Math.floor(n(p.stockBuysTotal)));
    const heldCompanies = this._heldCompanies(u);
    const totalDividends = Math.max(0, Math.floor(n(p.totalDividends)));
    const theftTotal = Math.max(0, Math.floor(n(p.totalStolen)));
    const theftStreak = Math.max(0, Math.floor(n(p.successfulTheftsStreak)));
    const defenses = Math.max(0, Math.floor(n(p.defensesSuccess)));
    const clanContracts = Math.max(0, Math.floor(n(p.clanContractsByUser)));
    const refs = this._rewardedReferrals(u);

    if (id === "farm_first") {
      return `${farmHarvestTotal}/1`;
    }
    if (id === "farm_corn_10") {
      return `${farmCornHarvest}/10`;
    }
    if (id === "farm_all_crops") {
      return `${farmTypesCount}/3`;
    }

    const ru = {
      work_first_shift: `${totalShifts}/1 смен`,
      work_shifts_50: `${totalShifts}/50 смен`,
      work_shifts_500: `${totalShifts}/500 смен`,
      work_earned_1k: `$${totalEarned}/$1000`,
      work_earned_1m: `$${totalEarned}/$1000000`,
      biz_first: `${ownedBiz}/1 бизнесов`,
      biz_all_5: `${ownedBiz}/5 бизнесов`,
      biz_points_10: `${bizPts}/10 очков`,
      biz_points_25: `${bizPts}/25 очков`,
      labour_first_hire: `${hires}/1 наймов`,
      labour_hires_10: `${hires}/10 наймов`,
      gym_first_finish: `${gymLevel}/1 тренировок`,
      gym_energy_max: `${maxEnergy}/${gymCap}⚡`,
      study_lvl_5: `${studyLevel}/5 уровней`,
      pet_owner: `${hasPetNow ? 1 : 0}/1 питомец`,
      pet_streak_30: `${petFeedStreak}/30 дней`,
      pet_streak_100: `${petFeedStreak}/100 дней`,
      quiz_first_perfect: `${Math.max(0, Math.floor(n(p.quizPerfectTotal)))}/1`,
      quiz_streak_7: `${Math.max(0, Math.floor(n(p.quizPerfectStreak)))}/7 подряд`,
      stocks_first_buy: `${stockBuys}/1 покупок`,
      stocks_portfolio_5: `${heldCompanies}/5 компаний`,
      stocks_dividends_50k: `$${totalDividends}/$50000`,
      thief_first_success: `${Math.max(0, Math.floor(n(p.theftSuccessTotal)))}/1 краж`,
      thief_total_100k: `$${theftTotal}/$100000`,
      thief_streak_10: `${theftStreak}/10 подряд`,
      thief_defense_5: `${defenses}/5 защит`,
      clan_contracts_10: `${clanContracts}/10 контрактов`,
      referrals_1: `${refs}/1 рефералов`,
      referrals_5: `${refs}/5 рефералов`
    };
    const uk = {
      work_first_shift: `${totalShifts}/1 змін`,
      work_shifts_50: `${totalShifts}/50 змін`,
      work_shifts_500: `${totalShifts}/500 змін`,
      work_earned_1k: `$${totalEarned}/$1000`,
      work_earned_1m: `$${totalEarned}/$1000000`,
      biz_first: `${ownedBiz}/1 бізнесів`,
      biz_all_5: `${ownedBiz}/5 бізнесів`,
      biz_points_10: `${bizPts}/10 очок`,
      biz_points_25: `${bizPts}/25 очок`,
      labour_first_hire: `${hires}/1 наймів`,
      labour_hires_10: `${hires}/10 наймів`,
      gym_first_finish: `${gymLevel}/1 тренувань`,
      gym_energy_max: `${maxEnergy}/${gymCap}⚡`,
      study_lvl_5: `${studyLevel}/5 рівнів`,
      pet_owner: `${hasPetNow ? 1 : 0}/1 улюбленець`,
      pet_streak_30: `${petFeedStreak}/30 днів`,
      pet_streak_100: `${petFeedStreak}/100 днів`,
      quiz_first_perfect: `${Math.max(0, Math.floor(n(p.quizPerfectTotal)))}/1`,
      quiz_streak_7: `${Math.max(0, Math.floor(n(p.quizPerfectStreak)))}/7 поспіль`,
      stocks_first_buy: `${stockBuys}/1 покупок`,
      stocks_portfolio_5: `${heldCompanies}/5 компаній`,
      stocks_dividends_50k: `$${totalDividends}/$50000`,
      thief_first_success: `${Math.max(0, Math.floor(n(p.theftSuccessTotal)))}/1 крадіжок`,
      thief_total_100k: `$${theftTotal}/$100000`,
      thief_streak_10: `${theftStreak}/10 поспіль`,
      thief_defense_5: `${defenses}/5 захистів`,
      clan_contracts_10: `${clanContracts}/10 контрактів`,
      referrals_1: `${refs}/1 рефералів`,
      referrals_5: `${refs}/5 рефералів`
    };
    const en = {
      work_first_shift: `${totalShifts}/1 shifts`,
      work_shifts_50: `${totalShifts}/50 shifts`,
      work_shifts_500: `${totalShifts}/500 shifts`,
      work_earned_1k: `$${totalEarned}/$1000`,
      work_earned_1m: `$${totalEarned}/$1000000`,
      biz_first: `${ownedBiz}/1 businesses`,
      biz_all_5: `${ownedBiz}/5 businesses`,
      biz_points_10: `${bizPts}/10 points`,
      biz_points_25: `${bizPts}/25 points`,
      labour_first_hire: `${hires}/1 hires`,
      labour_hires_10: `${hires}/10 hires`,
      gym_first_finish: `${gymLevel}/1 workouts`,
      gym_energy_max: `${maxEnergy}/${gymCap}⚡`,
      study_lvl_5: `${studyLevel}/5 levels`,
      pet_owner: `${hasPetNow ? 1 : 0}/1 pet`,
      pet_streak_30: `${petFeedStreak}/30 days`,
      pet_streak_100: `${petFeedStreak}/100 days`,
      quiz_first_perfect: `${Math.max(0, Math.floor(n(p.quizPerfectTotal)))}/1`,
      quiz_streak_7: `${Math.max(0, Math.floor(n(p.quizPerfectStreak)))}/7 streak`,
      stocks_first_buy: `${stockBuys}/1 buys`,
      stocks_portfolio_5: `${heldCompanies}/5 companies`,
      stocks_dividends_50k: `$${totalDividends}/$50000`,
      thief_first_success: `${Math.max(0, Math.floor(n(p.theftSuccessTotal)))}/1 thefts`,
      thief_total_100k: `$${theftTotal}/$100000`,
      thief_streak_10: `${theftStreak}/10 streak`,
      thief_defense_5: `${defenses}/5 defenses`,
      clan_contracts_10: `${clanContracts}/10 contracts`,
      referrals_1: `${refs}/1 referrals`,
      referrals_5: `${refs}/5 referrals`
    };

    const maps = { ru, uk, en };
    return (maps[l] && maps[l][id]) || (maps.ru[id] || "");
  }

  _earnedEntriesSorted(u) {
    this._ensureModel(u);
    const earned = u?.achievements?.earned && typeof u.achievements.earned === "object"
      ? u.achievements.earned
      : {};
    const out = [];
    for (const [id, tsRaw] of Object.entries(earned)) {
      const ts = Math.max(0, Math.floor(n(tsRaw)));
      if (!ts) continue;
      const def = ACHIEVEMENT_BY_ID[id];
      if (!def) continue;
      out.push({ id, ts, reward: Math.max(0, Math.floor(n(def.reward))), title: def.title || null });
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }

  _achTitle(id, lang) {
    const def = ACHIEVEMENT_BY_ID[String(id || "")];
    if (!def) return String(id || "");
    return this._titleForLang(def.title, lang) || String(id || "");
  }

  buildOwnView(u) {
    this._ensureModel(u);
    const lang = this._lang(u);
    const defs = this._knownDefs();
    const total = defs.length;
    const earned = this._earnedEntriesSorted(u);
    const done = earned.length;
    const gems = earned.reduce((sum, x) => sum + Math.max(0, Math.floor(n(x.reward))), 0);
    const lines = [];

    const titleMap = {
      ru: "🏆 Достижения",
      uk: "🏆 Досягнення",
      en: "🏆 Achievements"
    };
    const summaryMap = {
      ru: `Выполнено: ${done} из ${total} · 💎 получено: ${gems}`,
      uk: `Виконано: ${done} з ${total} · 💎 отримано: ${gems}`,
      en: `Completed: ${done} of ${total} · 💎 earned: ${gems}`
    };

    lines.push(titleMap[lang] || titleMap.ru);
    lines.push("");
    lines.push(summaryMap[lang] || summaryMap.ru);
    lines.push("");

    const catOrder = ["work", "biz", "growth", "pet", "quiz", "stocks", "thief", "clan", "ref"];
    for (const cat of catOrder) {
      const group = defs.filter((d) => this._categoryForId(d.id) === cat);
      if (!group.length) continue;
      lines.push(this._categoryTitle(cat, lang));
      for (const def of group) {
        const title = this._titleForLang(def.title, lang) || def.id;
        if (this._isEarned(u, def.id)) {
          lines.push(`✅ ${title} — 💎${Math.max(0, Math.floor(n(def.reward)))}`);
          continue;
        }
        const progress = this._progressText(def.id, u, lang);
        if (progress) {
          lines.push(`⬜ ${title} — ${progress}`);
        } else {
          lines.push(`⬜ ${title} — 💎${Math.max(0, Math.floor(n(def.reward)))}`);
        }
      }
      lines.push("");
    }

    while (lines.length > 0 && !String(lines[lines.length - 1] || "").trim()) lines.pop();
    return {
      caption: lines.join("\n"),
      keyboard: [[{
        text: lang === "en" ? "⬅️ Back to profile" : (lang === "uk" ? "⬅️ До профілю" : "⬅️ В профиль"),
        callback_data: "profile:back"
      }]]
    };
  }

  buildPublicSummary(targetUser, viewerLang = "ru", limit = 8) {
    const lang = this._lang(viewerLang);
    const earned = this._earnedEntriesSorted(targetUser);
    const shown = earned.slice(0, Math.max(1, Math.floor(n(limit) || 8)));
    const lines = [];
    for (const item of shown) {
      lines.push(`✅ ${this._achTitle(item.id, lang)}`);
    }
    const more = Math.max(0, earned.length - shown.length);
    return {
      totalDone: earned.length,
      lines,
      more
    };
  }

  async onEvent(u, event, ctx = {}, opts = {}) {
    if (!u || typeof u !== "object") return { changed: false, newlyEarned: [], gemsAwarded: 0 };
    const persist = opts.persist !== false;
    const notify = opts.notify !== false;
    const silent = !!opts.silent;

    let changed = this._ensureModel(u);
    changed = this._applyEventProgress(u, event, ctx) || changed;

    const defs = this._defsForEvent(event);
    const newlyEarned = [];
    let gemsAwarded = 0;
    const extraCtx = { ...ctx };
    if (event === "retro" || event === "clan_create") {
      extraCtx.isClanOwnerNow = await this._isClanOwnerNow(u);
    }

    for (const def of defs) {
      if (!def?.id || this._isEarned(u, def.id)) continue;
      let done = false;
      try {
        done = !!(await def.done(u, extraCtx));
      } catch {
        done = false;
      }
      if (!done) continue;
      const reward = Math.max(0, Math.floor(n(def.reward)));
      const marked = this._markEarned(u, def.id, this.now());
      if (!marked) continue;
      if (reward > 0) {
        u.premium = Math.max(0, Math.floor(n(u.premium))) + reward;
        gemsAwarded += reward;
      }
      newlyEarned.push({ id: def.id, reward, title: def.title || null });
      changed = true;
    }

    if (changed && persist && this.users?.save) {
      await this.users.save(u);
    }
    if (newlyEarned.length > 0 && this.ratings?.updateUser) {
      try {
        await this.ratings.updateUser(u, ["ach"]);
      } catch {}
    }
    if (newlyEarned.length && notify && !silent) {
      await this.notifyEarned(u, newlyEarned);
    }

    return { changed, newlyEarned, gemsAwarded };
  }

  async retroCheck(u) {
    if (!u || typeof u !== "object") return { changed: false, awarded: 0, earned: 0 };
    let changed = this._ensureModel(u);
    if (u.achievements.retroDone === true) {
      if (changed) await this.users.save(u);
      return { changed, awarded: 0, earned: 0 };
    }

    const res = await this.onEvent(u, "retro", {}, {
      persist: false,
      notify: false,
      silent: true
    });
    if (u.achievements.retroDone !== true) {
      u.achievements.retroDone = true;
      changed = true;
    }
    changed = changed || !!res.changed;
    if (changed && this.users?.save) {
      await this.users.save(u);
    }
    return {
      changed,
      awarded: Math.max(0, Math.floor(n(res?.gemsAwarded))),
      earned: Array.isArray(res?.newlyEarned) ? res.newlyEarned.length : 0
    };
  }

  _titleForLang(item, lang) {
    const l = this._lang(lang);
    if (!item || typeof item !== "object") return "";
    if (typeof item[l] === "string" && item[l]) return item[l];
    if (typeof item.ru === "string" && item.ru) return item.ru;
    if (typeof item.en === "string" && item.en) return item.en;
    return "";
  }

  _pushText(lang, title, reward) {
    const gems = Math.max(0, Math.floor(n(reward)));
    if (lang === "uk") {
      return `🏆 Нове досягнення!\n«${title}»\nНагорода: +💎${gems}`;
    }
    if (lang === "en") {
      return `🏆 New achievement!\n"${title}"\nReward: +💎${gems}`;
    }
    return `🏆 Новое достижение!\n«${title}»\nНаграда: +💎${gems}`;
  }

  async notifyEarned(u, newlyEarned) {
    if (!this.bot || !Array.isArray(newlyEarned) || !newlyEarned.length) return;
    const chatId = u?.chatId || u?.id;
    if (!chatId) return;
    const lang = this._lang(u);

    for (const item of newlyEarned) {
      const title = this._titleForLang(item?.title, lang) || String(item?.id || "achievement");
      const text = this._pushText(lang, title, Math.max(0, Math.floor(n(item?.reward))));
      try {
        await this.bot.sendMessage(chatId, text);
      } catch {}
    }
  }
}
