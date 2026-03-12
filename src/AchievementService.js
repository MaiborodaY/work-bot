import { ACHIEVEMENTS_BY_EVENT } from "./AchievementCatalog.js";
import { normalizeLang } from "./i18n/index.js";

function n(raw) {
  const v = Number(raw);
  return Number.isFinite(v) ? v : 0;
}

export class AchievementService {
  constructor({ users, db, now, bot }) {
    this.users = users;
    this.db = db || users?.db || null;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
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
      stockBuysTotal: 0
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

