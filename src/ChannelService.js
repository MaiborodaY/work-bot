import { CONFIG } from "./GameConfig.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStrUtc(ts = Date.now()) {
  return new Date(Number(ts) || Date.now()).toISOString().slice(0, 10);
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export class ChannelService {
  constructor({
    db,
    bot,
    social = null,
    ratings = null,
    thief = null,
    isAdmin = null,
    now = () => Date.now(),
    channelId = "",
    playUrl = ""
  }) {
    this.db = db;
    this.bot = bot;
    this.social = social;
    this.ratings = ratings;
    this.thief = thief;
    this.isAdmin = (typeof isAdmin === "function") ? isAdmin : (() => false);
    this.now = now;
    this.channelId = String(channelId || "").trim();
    this.playUrl = String(playUrl || CONFIG?.CHANNEL?.PLAY_URL || "t.me/reallifesame_bot").trim();
  }

  _cfg() {
    return CONFIG?.CHANNEL || {};
  }

  _snapshotKey(day) {
    return `channel:snapshot:${String(day || "")}`;
  }

  _postedKey(day) {
    return `channel:lastPost:${String(day || "")}`;
  }

  _snapshotTtlSec() {
    return Math.max(60, toInt(this._cfg()?.SNAPSHOT_TTL_SEC, 7 * 24 * 60 * 60));
  }

  _minEarnersToPost() {
    return Math.max(1, toInt(this._cfg()?.MIN_EARNERS, 3));
  }

  _topEarnersLimit() {
    return Math.max(1, toInt(this._cfg()?.TOP_EARNERS_LIMIT, 10));
  }

  _topThiefLimit() {
    return Math.max(1, toInt(this._cfg()?.TOP_THIEF_LIMIT, 3));
  }

  _topFarmLimit() {
    return Math.max(1, toInt(this._cfg()?.TOP_FARM_LIMIT, 3));
  }

  _isAdminUserId(userId) {
    const id = String(userId ?? "").trim();
    if (!id) return false;
    try {
      return !!this.isAdmin(id);
    } catch {
      return false;
    }
  }

  _scheduleDays() {
    const raw = Array.isArray(this._cfg()?.POST_DAYS_UTC) ? this._cfg().POST_DAYS_UTC : [1, 3, 5];
    const allowed = new Set([0, 1, 2, 3, 4, 5, 6]);
    return raw
      .map((v) => toInt(v, -1))
      .filter((v) => allowed.has(v));
  }

  _scheduleHour() {
    return Math.max(0, Math.min(23, toInt(this._cfg()?.POST_HOUR_UTC, 9)));
  }

  _scheduleMinute() {
    return Math.max(0, Math.min(59, toInt(this._cfg()?.POST_MINUTE_UTC, 0)));
  }

  _formatMoney(amount) {
    const n = Math.max(0, toInt(amount, 0));
    return `$${n.toLocaleString("en-US")}`;
  }

  _escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  _rewardForPlace(place) {
    const table = CONFIG?.DAILY_TOP_REWARDS || {};
    const row = table?.[place] || table?.[String(place)] || {};
    return {
      stars: Math.max(0, toInt(row?.stars, 0)),
      money: Math.max(0, toInt(row?.money, 0))
    };
  }

  _rewardText(place, rewardRaw) {
    const reward = rewardRaw && typeof rewardRaw === "object" ? rewardRaw : this._rewardForPlace(place);
    const stars = Math.max(0, toInt(reward?.stars, 0));
    const money = Math.max(0, toInt(reward?.money, 0));
    const parts = [];
    if (stars > 0) parts.push(`💎${stars}`);
    if (money > 0) parts.push(this._formatMoney(money));
    return parts.length ? ` · reward: ${parts.join(" + ")}` : "";
  }

  _name(value, fallbackId = "") {
    const raw = String(value || "").trim();
    if (raw) return raw;
    const id = String(fallbackId || "").slice(-4).padStart(4, "0");
    return `Player #${id}`;
  }

  _placePrefix(place) {
    const p = Math.max(1, toInt(place, 1));
    if (p === 1) return "🥇";
    if (p === 2) return "🥈";
    if (p === 3) return "🥉";
    return `${p}.`;
  }

  _postTitle(nowTs = this.now()) {
    const day = new Date(nowTs).getUTCDay();
    if (day === 1) return "🌍 World of Life — Weekend recap";
    if (day === 3) return "⚡ Who ruled the city yesterday?";
    if (day === 5) return "🏆 Midweek city results";
    return "🌍 World of Life — Yesterday recap";
  }

  _postFooter(day) {
    const variants = [
      "You in the list today? If not, your turn is next.",
      "The city never sleeps. Keep climbing.",
      "The leaderboard resets every day. Push now.",
      "Today matters. Every shift counts.",
      "See you in tomorrow's rankings."
    ];
    const idx = Math.abs(dayStrUtc(day).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % variants.length;
    return variants[idx];
  }

  _shouldRunAt(nowTs = this.now()) {
    const d = new Date(nowTs);
    const days = this._scheduleDays();
    return days.includes(d.getUTCDay()) &&
      d.getUTCHours() === this._scheduleHour() &&
      d.getUTCMinutes() === this._scheduleMinute();
  }

  _yesterday(nowTs = this.now()) {
    return dayStrUtc(nowTs - DAY_MS);
  }

  async _buildSnapshot(day) {
    if (this.social?.ensurePeriod) {
      await this.social.ensurePeriod();
    }

    const topEarnersRaw = this.social?.getDailyWinnersSnapshot
      ? await this.social.getDailyWinnersSnapshot(day)
      : [];
    const topEarners = (Array.isArray(topEarnersRaw) ? topEarnersRaw : [])
      .filter((row) => !this._isAdminUserId(row?.userId))
      .slice(0, this._topEarnersLimit())
      .map((row, idx) => {
        const place = Math.max(1, toInt(row?.place, idx + 1));
        const earned = Math.max(0, toInt(row?.earned, 0));
        const userId = String(row?.userId ?? "").trim();
        const name = this._name(row?.name, userId);
        const reward = row?.reward && typeof row.reward === "object"
          ? {
              stars: Math.max(0, toInt(row.reward.stars, 0)),
              money: Math.max(0, toInt(row.reward.money, 0))
            }
          : this._rewardForPlace(place);
        return { place, userId, name, earned, reward };
      });

    const topThievesRaw = this.ratings?.getTop ? await this.ratings.getTop("thief") : [];
    const topThieves = (Array.isArray(topThievesRaw) ? topThievesRaw : [])
      .filter((row) => !this._isAdminUserId(row?.userId))
      .slice(0, this._topThiefLimit())
      .map((row, idx) => ({
        place: idx + 1,
        userId: String(row?.userId || "").trim(),
        name: this._name(row?.name, row?.userId),
        stolen: Math.max(0, toInt(row?.score, 0))
      }));

    const topFarmRaw = this.social?.getFarmAllTop ? await this.social.getFarmAllTop() : [];
    const topFarm = (Array.isArray(topFarmRaw) ? topFarmRaw : [])
      .filter((row) => !this._isAdminUserId(row?.userId))
      .slice(0, this._topFarmLimit())
      .map((row, idx) => ({
        place: idx + 1,
        userId: String(row?.userId || "").trim(),
        name: this._name(row?.name, row?.userId),
        total: Math.max(0, toInt(row?.total, 0))
      }));

    const earnersPositive = topEarners.filter((x) => Math.max(0, toInt(x?.earned, 0)) > 0).length;
    const shouldPost = earnersPositive >= this._minEarnersToPost();

    return {
      date: day,
      topEarners,
      topFarm,
      topThieves,
      shouldPost
    };
  }

  async _ensureSnapshot(day) {
    const key = this._snapshotKey(day);
    const raw = await this.db.get(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const valid =
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.topEarners) &&
          Array.isArray(parsed.topFarm) &&
          Array.isArray(parsed.topThieves);
        if (valid) return parsed;
      } catch {
        // ignore broken snapshot and rebuild
      }
    }
    const snapshot = await this._buildSnapshot(day);
    await this.db.put(key, JSON.stringify(snapshot), { expirationTtl: this._snapshotTtlSec() });
    return snapshot;
  }

  _buildText(snapshot) {
    const date = String(snapshot?.date || this._yesterday());
    const topEarners = Array.isArray(snapshot?.topEarners) ? snapshot.topEarners : [];
    const topFarm = Array.isArray(snapshot?.topFarm) ? snapshot.topFarm : [];
    const topThieves = Array.isArray(snapshot?.topThieves) ? snapshot.topThieves : [];
    const dateTs = Date.parse(`${date}T00:00:00Z`);

    const lines = [];
    lines.push(this._postTitle(this.now()));
    lines.push("");
    lines.push(`📅 ${this._escapeHtml(date)}`);

    if (topEarners.length) {
      lines.push("");
      lines.push("💰 <b>Top earnings (yesterday)</b>");
      for (const row of topEarners) {
        const place = Math.max(1, toInt(row?.place, 0));
        const marker = this._placePrefix(place);
        const name = this._escapeHtml(this._name(row?.name, row?.userId));
        const earned = this._formatMoney(row?.earned);
        const rewardTxt = this._rewardText(place, row?.reward);
        lines.push(`${marker} ${name} — ${earned}${rewardTxt}`);
      }
    }

    if (topFarm.length) {
      lines.push("");
      lines.push("🌱 <b>Top farmers (all-time)</b>");
      for (const row of topFarm) {
        const marker = this._placePrefix(row?.place);
        const name = this._escapeHtml(this._name(row?.name, row?.userId));
        const total = this._formatMoney(row?.total);
        lines.push(`${marker} ${name} — ${total}`);
      }
    }

    lines.push("");
    lines.push("🌑 <b>Top thieves (all-time)</b>");
    if (topThieves.length) {
      for (const row of topThieves) {
        const marker = this._placePrefix(row?.place);
        const name = this._escapeHtml(this._name(row?.name, row?.userId));
        const stolen = this._formatMoney(row?.stolen);
        lines.push(`${marker} ${name} — ${stolen} stolen`);
      }
    } else {
      lines.push("No thief records yet.");
    }

    lines.push("");
    lines.push(`▶️ Play now: ${this._escapeHtml(this.playUrl)}`);
    lines.push(this._escapeHtml(this._postFooter(Number.isFinite(dateTs) ? dateTs : this.now())));
    return lines.join("\n");
  }

  async previewYesterday(adminChatId) {
    const day = this._yesterday();
    const snapshot = await this._buildSnapshot(day);
    await this.db.put(this._snapshotKey(day), JSON.stringify(snapshot), { expirationTtl: this._snapshotTtlSec() });
    const text = this._buildText(snapshot);
    await this.bot.sendMessage(adminChatId, text, { reply_markup: undefined });
    return { ok: true, day, posted: false, reason: snapshot?.shouldPost ? "preview_ready" : "below_threshold" };
  }

  async publishYesterday({ force = false } = {}) {
    const channelId = this.channelId;
    if (!channelId) return { ok: false, reason: "channel_id_missing" };

    const day = this._yesterday();
    const postedKey = this._postedKey(day);
    const already = await this.db.get(postedKey);
    if (already && !force) return { ok: false, reason: "already_posted", day };

    const snapshot = await this._ensureSnapshot(day);
    if (!snapshot?.shouldPost && !force) {
      return { ok: false, reason: "below_threshold", day };
    }

    const text = this._buildText(snapshot);
    await this.bot.sendMessage(channelId, text, { reply_markup: undefined });
    await this.db.put(postedKey, String(this.now()), { expirationTtl: this._snapshotTtlSec() });
    return { ok: true, day, posted: true, forced: !!force };
  }

  async runScheduled() {
    if (!this._shouldRunAt(this.now())) {
      return { ok: true, skipped: true, reason: "outside_schedule" };
    }
    return this.publishYesterday({ force: false });
  }
}
