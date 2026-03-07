import { CONFIG } from "./GameConfig.js";
import { normalizeLang, t } from "./i18n/index.js";

export class ReferralService {
  constructor({ users, now, bot, botUsername }) {
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.botUsername = String(botUsername || "").replace(/^@+/, "").trim();
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _t(source, key, vars = {}) {
    return t(key, this._lang(source), vars);
  }

  _cfg() {
    return CONFIG?.REFERRAL || {};
  }

  _rewardGems() {
    return Math.max(0, Math.round(Number(this._cfg().REWARD_GEMS) || 10));
  }

  _invitedLimit() {
    return Math.max(1, Number(this._cfg().INVITED_LIMIT) || 100);
  }

  _viewListLimit() {
    return Math.max(1, Number(this._cfg().VIEW_LIST_LIMIT) || 20);
  }

  _ensureReferral(u) {
    if (!u.referral || typeof u.referral !== "object") {
      u.referral = { referredBy: "", rewarded: false, invited: [], totalGemsEarned: 0 };
      return true;
    }
    let dirty = false;
    if (typeof u.referral.referredBy !== "string") { u.referral.referredBy = ""; dirty = true; }
    if (typeof u.referral.rewarded !== "boolean") { u.referral.rewarded = false; dirty = true; }
    if (!Array.isArray(u.referral.invited)) { u.referral.invited = []; dirty = true; }
    if (typeof u.referral.totalGemsEarned !== "number") { u.referral.totalGemsEarned = 0; dirty = true; }

    const invited = [];
    for (const raw of u.referral.invited) {
      const id = String(raw?.id || "").trim();
      if (!id) continue;
      invited.push({ id, rewardedAt: Math.max(0, Number(raw?.rewardedAt) || 0) });
    }
    invited.sort((a, b) => (Number(b.rewardedAt) || 0) - (Number(a.rewardedAt) || 0));
    u.referral.invited = invited.slice(0, this._invitedLimit());
    u.referral.totalGemsEarned = Math.max(0, Math.round(Number(u.referral.totalGemsEarned) || 0));
    return dirty;
  }

  _parseRefPayload(payload) {
    const p = String(payload || "").trim();
    const m = p.match(/^ref_(\d+)$/);
    if (!m) return "";
    return String(m[1] || "").trim();
  }

  _canBindForUser(u) {
    this._ensureReferral(u);
    if (u.__isNew) return true;
    return !u.referral.rewarded && !String(u.referral.referredBy || "").trim();
  }

  _upsertInvited(arr, invitedUserId, rewardedAt = 0) {
    const id = String(invitedUserId || "").trim();
    if (!id) return arr;
    const current = Array.isArray(arr) ? arr : [];
    const idx = current.findIndex((x) => String(x?.id || "") === id);
    if (idx >= 0) {
      const prev = current[idx] || {};
      current[idx] = { id, rewardedAt: Math.max(Number(prev.rewardedAt) || 0, Number(rewardedAt) || 0) };
    } else {
      current.push({ id, rewardedAt: Math.max(0, Number(rewardedAt) || 0) });
    }
    current.sort((a, b) => (Number(b.rewardedAt) || 0) - (Number(a.rewardedAt) || 0));
    return current.slice(0, this._invitedLimit());
  }

  buildInviteLink(u) {
    const username = String(this.botUsername || "").replace(/^@+/, "").trim();
    if (!username) return "";
    return `https://t.me/${username}?start=ref_${String(u?.id || "").trim()}`;
  }

  async bindFromStartPayload(u, payload) {
    this._ensureReferral(u);
    const referrerId = this._parseRefPayload(payload);
    if (!referrerId) return { ok: true, bound: false, reason: "invalid" };
    if (!this._canBindForUser(u)) return { ok: true, bound: false, reason: "not_eligible" };
    if (String(referrerId) === String(u?.id || "")) return { ok: true, bound: false, reason: "self" };
    if (String(u.referral.referredBy || "").trim()) return { ok: true, bound: false, reason: "already_bound" };

    u.referral.referredBy = String(referrerId);

    try {
      const referrer = await this.users.load(referrerId).catch(() => null);
      if (referrer) {
        this._ensureReferral(referrer);
        referrer.referral.invited = this._upsertInvited(referrer.referral.invited, u.id, 0);
        await this.users.save(referrer);
      }
    } catch (e) {
      try {
        console.error("referral_bind_referrer_failed", String(referrerId), String(u?.id || ""), e?.message || e);
      } catch {}
    }

    return { ok: true, bound: true, referrerId: String(referrerId) };
  }

  async tryRewardReferral(u) {
    this._ensureReferral(u);
    const referrerId = String(u?.referral?.referredBy || "").trim();
    if (!referrerId) return { ok: true, rewarded: false, reason: "no_referrer" };
    if (u.referral.rewarded) return { ok: true, rewarded: false, reason: "already_rewarded" };

    const gems = this._rewardGems();
    if (!gems) return { ok: true, rewarded: false, reason: "no_reward" };

    const nowSec = Math.floor(this.now() / 1000);
    const newbieName = String(u?.displayName || "").trim()
      || this._t(u, "loc.square.player_fallback_id", { id: String(u?.id || "").slice(-4).padStart(4, "0") });

    u.premium = (u.premium || 0) + gems;
    u.referral.rewarded = true;
    await this.users.save(u);

    if (this.bot && u?.chatId) {
      try {
        await this.bot.sendMessage(u.chatId, this._t(u, "referral.notify.newbie", { gems }));
      } catch {}
    }

    try {
      const referrer = await this.users.load(referrerId).catch(() => null);
      if (!referrer) return { ok: true, rewarded: true, referrerRewarded: false };
      this._ensureReferral(referrer);

      referrer.premium = (referrer.premium || 0) + gems;
      referrer.referral.totalGemsEarned = Math.max(0, Number(referrer.referral.totalGemsEarned) || 0) + gems;
      referrer.referral.invited = this._upsertInvited(referrer.referral.invited, u.id, nowSec);
      await this.users.save(referrer);

      if (this.bot && referrer?.chatId) {
        try {
          await this.bot.sendMessage(
            referrer.chatId,
            this._t(referrer, "referral.notify.referrer", { name: newbieName, gems })
          );
        } catch {}
      }

      return { ok: true, rewarded: true, referrerRewarded: true };
    } catch (e) {
      try {
        console.error("referrer_reward_failed", String(referrerId), String(u?.id || ""), e?.message || e);
      } catch {}
      return { ok: true, rewarded: true, referrerRewarded: false };
    }
  }

  async buildView(u) {
    this._ensureReferral(u);
    const link = this.buildInviteLink(u);
    const gems = this._rewardGems();

    const invited = Array.isArray(u?.referral?.invited) ? u.referral.invited.slice(0, this._viewListLimit()) : [];
    const rows = [];
    for (const it of invited) {
      const uid = String(it?.id || "").trim();
      if (!uid) continue;
      const peer = await this.users.load(uid).catch(() => null);
      const name = String(peer?.displayName || "").trim()
        || this._t(u, "loc.square.player_fallback_id", { id: uid.slice(-4).padStart(4, "0") });
      const rewardedAt = Math.max(0, Number(it?.rewardedAt) || 0);
      if (rewardedAt > 0) {
        rows.push(this._t(u, "referral.row.done", { name, gems }));
      } else {
        rows.push(this._t(u, "referral.row.waiting", { name }));
      }
    }

    const lines = [
      this._t(u, "referral.view.title"),
      "",
      this._t(u, "referral.view.your_link"),
      link || this._t(u, "referral.view.link_unavailable"),
      "",
      this._t(u, "referral.view.reward_rule", { gems }),
      "",
      this._t(u, "referral.view.invited_total", { count: Array.isArray(u?.referral?.invited) ? u.referral.invited.length : 0 }),
      this._t(u, "referral.view.total_earned", { emoji: CONFIG?.PREMIUM?.emoji || "💎", total: Math.max(0, Number(u?.referral?.totalGemsEarned) || 0) }),
      "",
      this._t(u, "referral.view.list_title")
    ];

    if (rows.length) {
      lines.push(...rows);
    } else {
      lines.push(this._t(u, "referral.view.empty"));
    }

    const keyboard = [];
    if (link) {
      keyboard.push([{ text: this._t(u, "referral.btn.open_link"), url: link }]);
    }
    keyboard.push([{ text: this._t(u, "referral.btn.refresh"), callback_data: "ref:refresh" }]);
    keyboard.push([{ text: this._t(u, "referral.btn.back_city"), callback_data: "go:City" }]);

    return { caption: lines.join("\n"), keyboard };
  }
}
