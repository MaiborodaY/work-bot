// AdminCommands.js
// Admin tools: legacy economy commands + broadcast workflow.
import { CONFIG } from "./GameConfig.js";
import { addDaysUtc, dayDiffUtc, dayStrUtc, hasActivityOnDay, isDayStr, markUsefulActivity } from "./PlayerStats.js";

const LABOUR_FREE_PLAYERS_KEY = "labour:free_players";

export class AdminCommands {
  /**
   * deps:
   *  - users: UserStore
   *  - send: (text: string) => Promise<void>   // sends into current admin chat
   *  - isAdmin: (id: number|string) => boolean
   *  - botToken: Telegram bot token
   */
  constructor({ users, send, isAdmin, botToken, ratings = null, quiz = null }) {
    this.users = users;
    this.send = send;
    this.isAdmin = isAdmin;
    this.botToken = botToken;
    this.db = users?.db;
    this.ratings = ratings || null;
    this.quiz = quiz || null;

    this.K = {
      draft: (adminId) => `admin:broadcast:draft:${adminId}`,
      compose: (adminId) => `admin:broadcast:compose:${adminId}`,
      active: "admin:broadcast:active",
      history: "admin:broadcast:history"
    };
  }

  async tryHandle(text, { fromId, chatId, message, waitUntil } = {}) {
    if (!this.isAdmin(fromId)) return false;

    const msg = message || {};
    const textBody = typeof msg.text === "string" ? msg.text.trim() : "";
    const captionBody = typeof msg.caption === "string" ? msg.caption.trim() : "";
    const input = (typeof text === "string" && text.trim())
      ? text.trim()
      : (textBody || captionBody || "");
    const isCommand = input.startsWith("/");

    // ===== New admin menu =====
    if (/^\/admin(?:@\w+)?\s*$/i.test(input)) {
      await this.send(
        "<b>Admin commands</b>\n" +
        "/admin\n" +
        "/users\n" +
        "/grant &lt;userId&gt; &lt;amount&gt;\n" +
        "/setmoney &lt;userId&gt; &lt;amount&gt;\n" +
        "/givegem &lt;userId&gt; &lt;amount&gt;\n" +
        "/setgem &lt;userId&gt; &lt;amount&gt;\n" +
        "/wipe &lt;userId&gt;\n" +
        "/labour_reindex - rebuild free labour index once\n\n" +
        "/admin_referrals - referrals/ads stats\n" +
        "/admin_referrals &lt;userId&gt; - referral info for user\n" +
        "/admin_retention - retention by cohorts (last 30d)\n" +
        "/admin_funnel - onboarding funnel (all-time)\n" +
        "/admin_new_users [limit] - new users list (last 30d)\n" +
        "/admin_backfill_activity_today - backfill useful activity for today\n" +
        "/admin_quiz - quiz stats\n" +
        "/admin_rebuild_ratings - rebuild top rating indexes once\n\n" +
        "<b>Broadcast</b>\n" +
        "/broadcast - start draft mode\n" +
        "/broadcast_test - send draft only to you\n" +
        "/broadcast_send - send draft to all users\n" +
        "/broadcast_status - current run + recent history\n" +
        "/broadcast_cancel - clear draft/compose mode\n" +
        "/fileid - send photo with this caption to get file_id"
      );
      return true;
    }

    // Manual file_id helper (instead of auto-trigger on every photo)
    if (/^\/fileid(?:@\w+)?\s*$/i.test(input)) {
      const fileId = this._extractPhotoFileId(msg);
      if (!fileId) {
        await this.send("Send a photo with caption /fileid.");
        return true;
      }
      await this.send(`file_id:\n<code>${this._escapeHtml(fileId)}</code>`);
      return true;
    }

    // ===== Broadcast commands =====
    if (/^\/broadcast(?:@\w+)?\s*$/i.test(input)) {
      await this._setCompose(fromId, true);
      await this.send(
        "Broadcast compose mode is ON.\n" +
        "Next message will become a draft.\n" +
        "Allowed:\n" +
        "1) plain text message\n" +
        "2) photo + optional caption\n\n" +
        "Then use /broadcast_test and /broadcast_send."
      );
      return true;
    }

    if (/^\/broadcast_cancel(?:@\w+)?\s*$/i.test(input)) {
      await this._setCompose(fromId, false);
      await this._delete(this.K.draft(fromId));
      await this.send("Broadcast draft was cleared.");
      return true;
    }

    if (/^\/broadcast_status(?:@\w+)?\s*$/i.test(input)) {
      const active = await this._getJson(this.K.active, null);
      const history = await this._getJson(this.K.history, []);
      const draft = await this._getJson(this.K.draft(fromId), null);

      const lines = [];
      if (active?.status === "running") {
        lines.push("<b>Broadcast status: running</b>");
        lines.push(`Run: <code>${this._escapeHtml(active.runId || "-")}</code>`);
        lines.push(`Progress: ${Number(active.processed || 0)} / ${Number(active.total || 0)}`);
        lines.push(`Sent: ${Number(active.sent || 0)}, Failed: ${Number(active.failed || 0)}, Blocked: ${Number(active.blocked || 0)}`);
        lines.push(`Started: ${this._escapeHtml(active.startedAt || "-")}`);
      } else {
        lines.push("<b>Broadcast status: idle</b>");
      }

      if (draft) {
        lines.push("");
        lines.push("<b>Your draft</b>");
        lines.push(`Type: ${this._escapeHtml(draft.type || "-")}`);
        lines.push(`Updated: ${this._escapeHtml(draft.updatedAt || "-")}`);
      }

      if (Array.isArray(history) && history.length) {
        lines.push("");
        lines.push("<b>Recent history</b>");
        for (const h of history.slice(0, 5)) {
          lines.push(
            `<code>${this._escapeHtml(h.runId || "-")}</code> | ${this._escapeHtml(h.status || "-")} | ` +
            `sent ${Number(h.sent || 0)}/${Number(h.total || 0)} | failed ${Number(h.failed || 0)}`
          );
        }
      }

      await this.send(lines.join("\n"));
      return true;
    }

    if (/^\/broadcast_test(?:@\w+)?\s*$/i.test(input)) {
      const draft = await this._getJson(this.K.draft(fromId), null);
      if (!draft) {
        await this.send("No draft. Use /broadcast, then send text or photo.");
        return true;
      }
      const out = await this._sendDraft(chatId, draft);
      if (!out.ok) {
        await this.send(`Test failed: ${this._escapeHtml(out.error || "unknown error")}`);
      } else {
        await this.send("Test sent.");
      }
      return true;
    }

    if (/^\/broadcast_send(?:@\w+)?\s*$/i.test(input)) {
      const active = await this._getJson(this.K.active, null);
      if (active?.status === "running") {
        await this.send(
          "Another broadcast is already running.\n" +
          `Run: <code>${this._escapeHtml(active.runId || "-")}</code>`
        );
        return true;
      }

      const draft = await this._getJson(this.K.draft(fromId), null);
      if (!draft) {
        await this.send("No draft. Use /broadcast, then send content.");
        return true;
      }

      const runId = `bc_${Date.now()}`;
      const initial = {
        runId,
        status: "running",
        startedAt: new Date().toISOString(),
        startedBy: String(fromId),
        type: draft.type,
        total: 0,
        processed: 0,
        sent: 0,
        failed: 0,
        blocked: 0
      };

      await this._putJson(this.K.active, initial);
      await this.send(
        "Broadcast started.\n" +
        `Run: <code>${this._escapeHtml(runId)}</code>\n` +
        "Use /broadcast_status to check progress."
      );

      const runPromise = this._runBroadcast({ runId, draft, startedBy: fromId });
      if (typeof waitUntil === "function") waitUntil(runPromise);
      else await runPromise;
      return true;
    }

    // If compose mode is ON, the next non-command message becomes a draft.
    const composeOn = await this._isCompose(fromId);
    if (composeOn && !isCommand) {
      const applied = await this._trySaveDraftFromMessage({
        adminId: fromId,
        chatId,
        msg
      });
      if (applied) return true;

      await this.send(
        "Draft was not saved. Send either plain text or photo (+caption)."
      );
      return true;
    }

    // ===== Legacy commands =====
    const mWipe = input.match(/^\/wipe(?:@\w+)?\s+(\d+)\s*$/i);
    if (mWipe) {
      const targetId = Number(mWipe[1]);
      if (!Number.isFinite(targetId)) {
        await this.send("Format: /wipe <userId>");
        return true;
      }

      // Hard wipe: remove user row so next /start goes through true "new user" flow.
      const userKey = (this.users && typeof this.users._key === "function")
        ? this.users._key(targetId)
        : `u:${targetId}`;
      await this._delete(userKey);

      // Best-effort: remove from labour free players index.
      try {
        const rows = await this._getJson(LABOUR_FREE_PLAYERS_KEY, []);
        if (Array.isArray(rows)) {
          const next = rows.filter((x) => String(x?.id || "") !== String(targetId));
          if (next.length !== rows.length) {
            await this._putJson(LABOUR_FREE_PLAYERS_KEY, next);
          }
        }
      } catch {
        // ignore index cleanup errors
      }

      await this.send(
        "Wipe done.\n" +
        `User <code>${targetId}</code> fully deleted from KV.\n` +
        "Ask this user to send /start again - profile will be recreated as new and onboarding will start."
      );
      return true;
    }

    const mGrant = input.match(/^\/grant(?:@\w+)?\s+(\d+)\s+(-?\d+)\s*$/i);
    if (mGrant) {
      const targetId = Number(mGrant[1]);
      const amount = Number(mGrant[2]);
      if (!Number.isFinite(targetId) || !Number.isFinite(amount)) {
        await this.send("Format: /grant <userId> <amount>");
        return true;
      }
      const u = await this.users.getOrCreate(targetId);
      u.money = Math.max(0, (u.money || 0) + amount);
      await this.users.save(u);
      await this.send(
        `Grant: ${amount >= 0 ? `+${amount}` : amount} -> <code>${targetId}</code>\n` +
        `Balance: $${u.money}`
      );
      return true;
    }

    const mSet = input.match(/^\/setmoney(?:@\w+)?\s+(\d+)\s+(\d+)\s*$/i);
    if (mSet) {
      const targetId = Number(mSet[1]);
      const value = Math.max(0, Number(mSet[2]));
      if (!Number.isFinite(targetId) || !Number.isFinite(value)) {
        await this.send("Format: /setmoney <userId> <amount>");
        return true;
      }
      const u = await this.users.getOrCreate(targetId);
      u.money = value;
      await this.users.save(u);
      await this.send(
        `SetMoney: <code>${targetId}</code>\n` +
        `Balance: $${u.money}`
      );
      return true;
    }

    const mGiveGem = input.match(/^\/givegem(?:@\w+)?\s+(\d+)\s+(-?\d+)\s*$/i);
    if (mGiveGem) {
      const targetId = Number(mGiveGem[1]);
      const amount = Number(mGiveGem[2]);
      if (!Number.isFinite(targetId) || !Number.isFinite(amount)) {
        await this.send("Format: /givegem <userId> <amount>");
        return true;
      }
      const u = await this.users.getOrCreate(targetId);
      u.premium = Math.max(0, (u.premium || 0) + amount);
      await this.users.save(u);
      await this.send(
        `Gems: ${amount >= 0 ? `+${amount}` : amount} -> <code>${targetId}</code>\n` +
        `Balance: ${u.premium}`
      );
      return true;
    }

    const mSetGem = input.match(/^\/setgem(?:@\w+)?\s+(\d+)\s+(\d+)\s*$/i);
    if (mSetGem) {
      const targetId = Number(mSetGem[1]);
      const value = Math.max(0, Number(mSetGem[2]));
      if (!Number.isFinite(targetId) || !Number.isFinite(value)) {
        await this.send("Format: /setgem <userId> <amount>");
        return true;
      }

      const u = await this.users.getOrCreate(targetId);
      u.premium = value;
      await this.users.save(u);
      await this.send(
        `SetGems: <code>${targetId}</code>\n` +
        `Balance: ${u.premium}`
      );
      return true;
    }

    if (/^\/users(?:@\w+)?\s*$/i.test(input)) {
      await this._sendUsersList();
      return true;
    }
    const mAdminReferrals = input.match(/^\/admin_referrals(?:@\w+)?(?:\s+(\d+))?\s*$/i);
    if (mAdminReferrals) {
      const targetId = String(mAdminReferrals[1] || "").trim();
      if (targetId) {
        await this._sendReferralUserInfo(targetId);
      } else {
        await this._sendReferralStats();
      }
      return true;
    }
    if (/^\/admin_quiz(?:@\w+)?\s*$/i.test(input)) {
      await this._sendQuizStats();
      return true;
    }
    if (/^\/admin_retention(?:@\w+)?\s*$/i.test(input)) {
      await this._sendRetentionStats();
      return true;
    }
    if (/^\/admin_funnel(?:@\w+)?\s*$/i.test(input)) {
      await this._sendOnboardingFunnel();
      return true;
    }
    const mAdminNewUsers = input.match(/^\/admin_new_users(?:@\w+)?(?:\s+(\d+))?\s*$/i);
    if (mAdminNewUsers) {
      const limitRaw = Number(mAdminNewUsers[1] || 50);
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
      await this._sendNewUsers(limit);
      return true;
    }
    if (/^\/admin_backfill_activity_today(?:@\w+)?\s*$/i.test(input)) {
      await this._backfillActivityToday();
      return true;
    }
    if (/^\/labour_reindex(?:@\w+)?\s*$/i.test(input)) {
      await this.send("Labour reindex started...");
      try {
        const out = await this._rebuildLabourFreeIndex();
        await this.send(
          "Labour reindex done.\n" +
          `Scanned: ${Number(out.scanned || 0)}\n` +
          `Energy patched to min 20: ${Number(out.energyPatched || 0)}\n` +
          `Eligible: ${Number(out.eligible || 0)}\n` +
          `Saved to index: ${Number(out.saved || 0)} (limit ${Number(out.limit || 0)})`
        );
      } catch (e) {
        await this.send(`Labour reindex failed: ${this._escapeHtml(e?.message || e)}`);
      }
      return true;
    }
    if (/^\/admin_rebuild_ratings(?:@\w+)?\s*$/i.test(input)) {
      await this.send("Ratings rebuild started...");
      try {
        const out = await this._rebuildRatings();
        await this.send(
          "Ratings rebuild done.\n" +
          `Scanned users: ${Number(out.scanned || 0)}\n` +
          `Indexes rebuilt: ${Number(out.rebuilt || 0)}`
        );
      } catch (e) {
        await this.send(`Ratings rebuild failed: ${this._escapeHtml(e?.message || e)}`);
      }
      return true;
    }

    return false;
  }

  async _sendUsersList() {
    const prefix = "u:";
    let cursor = undefined;
    const keys = [];

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await this.users.db.list({ prefix, cursor });
        if (res?.keys?.length) keys.push(...res.keys);
        if (!res || res.list_complete || !res.cursor) break;
        cursor = res.cursor;
      }
    } catch (e) {
      await this.send(`KV list error: ${this._escapeHtml(e?.message || e)}`);
      return;
    }

    if (!keys.length) {
      await this.send("No users found.");
      return;
    }

    const rows = [];
    for (const k of keys) {
      try {
        const raw = await this.users.db.get(k.name);
        const u = raw ? JSON.parse(raw) : null;
        if (u && (u.id || u.displayName)) {
          const id = u.id ?? Number(String(k.name).slice(prefix.length));
          const name = u.displayName || "(no name)";
          rows.push({ id, name });
        }
      } catch {
        // ignore broken rows
      }
    }

    if (!rows.length) {
      await this.send("No users found.");
      return;
    }

    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const CHUNK = 70;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      const body = part
        .map((r) => `<code>${r.id}</code> - ${this._escapeHtml(r.name)}`)
        .join("\n");
      await this.send(
        `Users (${i + 1}-${i + part.length} / ${rows.length})\n${body}`
      );
    }
  }

  _refSnapshot(u) {
    const ref = (u?.referral && typeof u.referral === "object") ? u.referral : {};
    const invited = Array.isArray(ref.invited) ? ref.invited : [];
    let invitedDone = 0;
    let invitedPending = 0;
    for (const raw of invited) {
      const id = String(raw?.id || "").trim();
      if (!id) continue;
      const rewardedAt = Math.max(0, Number(raw?.rewardedAt) || 0);
      if (rewardedAt > 0) invitedDone += 1;
      else invitedPending += 1;
    }
    return {
      referredBy: String(ref?.referredBy || "").trim(),
      rewarded: !!ref?.rewarded,
      invitedTotal: invitedDone + invitedPending,
      invitedDone,
      invitedPending,
      totalGemsEarned: Math.max(0, Math.round(Number(ref?.totalGemsEarned) || 0)),
      startPayload: String(ref?.startPayload || "").trim(),
      startSource: String(ref?.startSource || "").trim(),
      startBoundAt: Math.max(0, Math.floor(Number(ref?.startBoundAt) || 0))
    };
  }

  async _sendReferralUserInfo(userId) {
    const u = await this.users.load(userId).catch(() => null);
    if (!u) {
      await this.send(`User not found: <code>${this._escapeHtml(userId)}</code>`);
      return;
    }
    const id = String(u?.id ?? userId ?? "");
    const name = String(u?.displayName || "").trim() || "(no name)";
    const s = this._refSnapshot(u);
    const lines = [
      "<b>Referral user info</b>",
      `User: <code>${this._escapeHtml(id)}</code> - ${this._escapeHtml(name)}`,
      `referredBy: <code>${this._escapeHtml(s.referredBy || "-")}</code>`,
      `rewarded (newbie got gems): ${s.rewarded ? "yes" : "no"}`,
      `invited: total ${s.invitedTotal}, done ${s.invitedDone}, pending ${s.invitedPending}`,
      `total gems earned as referrer: 💎${s.totalGemsEarned}`,
      `start source: <code>${this._escapeHtml(s.startSource || "-")}</code>`,
      `start payload: <code>${this._escapeHtml(s.startPayload || "-")}</code>`,
      `start tracked at: ${s.startBoundAt > 0 ? this._escapeHtml(new Date(s.startBoundAt * 1000).toISOString()) : "-"}`
    ];
    await this.send(lines.join("\n"));
  }

  async _sendReferralStats() {
    await this.send("Referral stats started...");
    const prefix = "u:";
    let cursor = undefined;
    let scanned = 0;
    let boundReferrals = 0;
    let rewardedReferrals = 0;
    let referrersActive = 0;
    let invitedDoneTotal = 0;
    let invitedPendingTotal = 0;
    let gemsPaidToReferrers = 0;
    let sourceTracked = 0;
    let sourceAds = 0;
    let sourceRef = 0;
    const sourceCounts = new Map();
    const topReferrers = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        scanned += 1;
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const fallbackId = String(k.name || "").slice(prefix.length);
          const id = String((u?.id ?? fallbackId) || "");
          const name = String(u?.displayName || "").trim() || "(no name)";
          const s = this._refSnapshot(u);

          if (s.referredBy) boundReferrals += 1;
          if (s.rewarded) rewardedReferrals += 1;
          if (s.invitedTotal > 0 || s.totalGemsEarned > 0) referrersActive += 1;

          invitedDoneTotal += s.invitedDone;
          invitedPendingTotal += s.invitedPending;
          gemsPaidToReferrers += s.totalGemsEarned;

          if (s.startPayload) {
            sourceTracked += 1;
            sourceCounts.set(s.startPayload, Number(sourceCounts.get(s.startPayload) || 0) + 1);
          }
          if (s.startSource === "ads") sourceAds += 1;
          if (s.startSource === "ref") sourceRef += 1;

          if (s.invitedDone > 0 || s.totalGemsEarned > 0) {
            topReferrers.push({
              id,
              name,
              done: s.invitedDone,
              pending: s.invitedPending,
              gems: s.totalGemsEarned
            });
          }
        } catch {
          // skip bad rows
        }
      }

      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    topReferrers.sort((a, b) => {
      if ((b.done || 0) !== (a.done || 0)) return (b.done || 0) - (a.done || 0);
      if ((b.gems || 0) !== (a.gems || 0)) return (b.gems || 0) - (a.gems || 0);
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const topSources = Array.from(sourceCounts.entries())
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .slice(0, 10);

    const lines = [
      "<b>Referral stats</b>",
      `Scanned users: ${scanned}`,
      `Bound referrals (referredBy): ${boundReferrals}`,
      `Rewarded referrals: ${rewardedReferrals}`,
      `Referrer accounts (invites/gems): ${referrersActive}`,
      `Invites: done ${invitedDoneTotal}, pending ${invitedPendingTotal}`,
      `Gems paid to referrers total: 💎${gemsPaidToReferrers}`,
      "",
      "<b>Start payload tracking</b>",
      `Tracked users: ${sourceTracked}`,
      `Source=ads: ${sourceAds}`,
      `Source=ref: ${sourceRef}`
    ];

    if (topSources.length) {
      lines.push("", "<b>Top start payloads</b>");
      for (const [payload, count] of topSources) {
        lines.push(`${this._escapeHtml(payload)} - ${Number(count || 0)}`);
      }
    }

    if (topReferrers.length) {
      lines.push("", "<b>Top referrers</b>");
      for (const r of topReferrers.slice(0, 10)) {
        lines.push(
          `<code>${this._escapeHtml(r.id)}</code> ${this._escapeHtml(r.name)} - ` +
          `done ${Number(r.done || 0)}, pending ${Number(r.pending || 0)}, 💎${Number(r.gems || 0)}`
        );
      }
    }

    await this.send(lines.join("\n"));
  }

  async _sendQuizStats() {
    if (!this.quiz || typeof this.quiz.collectAdminStats !== "function") {
      await this.send("Quiz stats unavailable.");
      return;
    }
    await this.send("Quiz stats started...");
    const out = await this.quiz.collectAdminStats({ topLimit: 10 });
    const avgCorrect = Number(out?.avgCorrectToday || 0);
    const lines = [
      "<b>Quiz stats</b>",
      `Day (UTC): ${this._escapeHtml(String(out?.day || "-"))}`,
      `Scanned users: ${Number(out?.scanned || 0)}`,
      `Played today: ${Number(out?.playedToday || 0)}`,
      `Perfect today: ${Number(out?.perfectToday || 0)}`,
      `Average correct today: ${avgCorrect.toFixed(2)}`,
      "",
      `Total played: ${Number(out?.playedTotal || 0)}`,
      `Total perfect: ${Number(out?.perfectTotal || 0)}`
    ];

    const top = Array.isArray(out?.topStreak) ? out.topStreak : [];
    if (top.length) {
      lines.push("", "<b>Top perfect streaks</b>");
      for (const row of top) {
        lines.push(
          `<code>${this._escapeHtml(String(row?.id || "-"))}</code> ` +
          `${this._escapeHtml(String(row?.name || "(no name)"))} - ${Number(row?.streak || 0)}`
        );
      }
    }
    await this.send(lines.join("\n"));
  }

  _retentionCounters() {
    return { total: 0, d1e: 0, d1r: 0, d3e: 0, d3r: 0, d7e: 0, d7r: 0 };
  }

  _fmtRetentionPair(done, eligible) {
    const e = Math.max(0, Number(eligible || 0));
    const d = Math.max(0, Number(done || 0));
    const pct = e > 0 ? Math.round((d * 100) / e) : 0;
    return `${d}/${e} (${pct}%)`;
  }

  _cohortSource(refSnapshot) {
    const src = String(refSnapshot?.startSource || "").trim().toLowerCase();
    const payload = String(refSnapshot?.startPayload || "").trim().toLowerCase();
    if (src === "ads" || payload.startsWith("ads_")) return "ads";
    if (src === "ref" || payload.startsWith("ref_") || String(refSnapshot?.referredBy || "").trim()) return "ref";
    return "organic";
  }

  async _sendRetentionStats() {
    await this.send("Retention stats started...");
    const prefix = "u:";
    const today = dayStrUtc(Date.now());
    let cursor = undefined;

    let scannedUsers = 0;
    let excludedAdmins = 0;
    let noFirstActiveDay = 0;
    let activeToday = 0;
    let active7d = 0;
    let active30d = 0;
    let newPlayers = 0;

    const cohortCounts = { ads: 0, ref: 0, organic: 0 };
    const overall = this._retentionCounters();
    const byCohort = {
      ads: this._retentionCounters(),
      ref: this._retentionCounters(),
      organic: this._retentionCounters()
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const fallbackId = String(k.name || "").slice(prefix.length);
          const id = String((u?.id ?? fallbackId) || "");
          if (!id) continue;
          if (this.isAdmin(id)) {
            excludedAdmins += 1;
            continue;
          }

          scannedUsers += 1;
          const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
          const firstActiveDay = isDayStr(stats.firstActiveDay) ? String(stats.firstActiveDay) : "";
          const lastActiveDay = isDayStr(stats.lastActiveDay) ? String(stats.lastActiveDay) : "";

          if (lastActiveDay) {
            const lastAge = dayDiffUtc(lastActiveDay, today);
            if (lastAge === 0) activeToday += 1;
            if (lastAge >= 0 && lastAge <= 6) active7d += 1;
            if (lastAge >= 0 && lastAge <= 29) active30d += 1;
          }

          if (!firstActiveDay) {
            noFirstActiveDay += 1;
            continue;
          }

          const age = dayDiffUtc(firstActiveDay, today);
          if (age < 0 || age > 29) continue;

          newPlayers += 1;
          const snap = this._refSnapshot(u);
          const cohort = this._cohortSource(snap);
          cohortCounts[cohort] += 1;
          overall.total += 1;
          byCohort[cohort].total += 1;

          const checks = [
            { n: 1, e: "d1e", r: "d1r" },
            { n: 3, e: "d3e", r: "d3r" },
            { n: 7, e: "d7e", r: "d7r" }
          ];
          for (const c of checks) {
            if (age < c.n) continue;
            overall[c.e] += 1;
            byCohort[cohort][c.e] += 1;
            const targetDay = addDaysUtc(firstActiveDay, c.n);
            if (targetDay && hasActivityOnDay(u, targetDay)) {
              overall[c.r] += 1;
              byCohort[cohort][c.r] += 1;
            }
          }
        } catch {
          // skip bad rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    const lines = [
      "<b>Retention (last 30 days)</b>",
      "",
      `New players (first useful action): ${newPlayers}`,
      `  ads_*: ${cohortCounts.ads}`,
      `  ref_*: ${cohortCounts.ref}`,
      `  organic: ${cohortCounts.organic}`,
      "",
      `D1 retention: ${this._fmtRetentionPair(overall.d1r, overall.d1e)}`,
      `D3 retention: ${this._fmtRetentionPair(overall.d3r, overall.d3e)}`,
      `D7 retention: ${this._fmtRetentionPair(overall.d7r, overall.d7e)}`,
      "",
      "<b>By cohorts</b>",
      `ads_*: D1 ${this._fmtRetentionPair(byCohort.ads.d1r, byCohort.ads.d1e)} · D3 ${this._fmtRetentionPair(byCohort.ads.d3r, byCohort.ads.d3e)} · D7 ${this._fmtRetentionPair(byCohort.ads.d7r, byCohort.ads.d7e)}`,
      `ref_*: D1 ${this._fmtRetentionPair(byCohort.ref.d1r, byCohort.ref.d1e)} · D3 ${this._fmtRetentionPair(byCohort.ref.d3r, byCohort.ref.d3e)} · D7 ${this._fmtRetentionPair(byCohort.ref.d7r, byCohort.ref.d7e)}`,
      `organic: D1 ${this._fmtRetentionPair(byCohort.organic.d1r, byCohort.organic.d1e)} · D3 ${this._fmtRetentionPair(byCohort.organic.d3r, byCohort.organic.d3e)} · D7 ${this._fmtRetentionPair(byCohort.organic.d7r, byCohort.organic.d7e)}`,
      "",
      `Active today: ${activeToday}`,
      `Active last 7d: ${active7d}`,
      `Active last 30d: ${active30d}`,
      "",
      `Scanned users (non-admin): ${scannedUsers}`,
      `Excluded admins: ${excludedAdmins}`
    ];
    if (noFirstActiveDay > 0) {
      lines.push(`⚠️ Without firstActiveDay (legacy users): ${noFirstActiveDay} — not included in cohorts`);
    }

    await this.send(lines.join("\n"));
  }

  _toBool(v) {
    return !!v;
  }

  _hasAnyBusiness(u) {
    const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    for (const b of owned) {
      const id = String(typeof b === "string" ? b : b?.id || "").trim();
      if (id) return true;
    }
    return false;
  }

  _pct(part, total) {
    const p = Math.max(0, Number(part || 0));
    const t = Math.max(0, Number(total || 0));
    if (t <= 0) return 0;
    return Math.round((p * 100) / t);
  }

  async _sendOnboardingFunnel() {
    await this.send("Onboarding funnel started...");
    const prefix = "u:";
    let cursor = undefined;
    let registered = 0;
    let excludedAdmins = 0;

    let firstShift = 0;
    let firstClaim = 0;
    let firstGym = 0;
    let firstBar = 0;
    let firstBiz = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const fallbackId = String(k.name || "").slice(prefix.length);
          const id = String((u?.id ?? fallbackId) || "");
          if (!id) continue;
          if (this.isAdmin(id)) {
            excludedAdmins += 1;
            continue;
          }

          registered += 1;
          const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
          const shiftByHistory = Math.max(0, Number(u?.achievements?.progress?.totalShifts || 0)) > 0;
          const didFirstShift = this._toBool(stats.didFirstShift) || shiftByHistory;
          const didFirstClaim = this._toBool(stats.didFirstClaim) || shiftByHistory;
          const didGym = this._toBool(stats.didGym) || Math.max(0, Number(u?.gym?.level || 0)) > 0;
          const didBar = this._toBool(stats.didBar);
          const didBusiness = this._toBool(stats.didBusiness) || this._hasAnyBusiness(u);

          if (didFirstShift) firstShift += 1;
          if (didFirstClaim) firstClaim += 1;
          if (didGym) firstGym += 1;
          if (didBar) firstBar += 1;
          if (didBusiness) firstBiz += 1;
        } catch {
          // skip bad rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    const lines = [
      "<b>Onboarding funnel (all-time)</b>",
      "",
      `Registered users: ${registered}`,
      `First shift started: ${firstShift} (${this._pct(firstShift, registered)}%)`,
      `First payout claimed: ${firstClaim} (${this._pct(firstClaim, registered)}%)`,
      `First workout finished: ${firstGym} (${this._pct(firstGym, registered)}%)`,
      `Opened bar: ${firstBar} (${this._pct(firstBar, registered)}%)`,
      `Bought first business: ${firstBiz} (${this._pct(firstBiz, registered)}%)`,
      "",
      `Excluded admins: ${excludedAdmins}`
    ];
    await this.send(lines.join("\n"));
  }

  _funnelState(stats) {
    const s = (stats && typeof stats === "object") ? stats : {};
    const marks = [
      this._toBool(s.didFirstShift) ? "S" : "·",
      this._toBool(s.didFirstClaim) ? "C" : "·",
      this._toBool(s.didGym) ? "G" : "·",
      this._toBool(s.didBar) ? "B" : "·",
      this._toBool(s.didBusiness) ? "Z" : "·"
    ];
    const done = marks.filter((x) => x !== "·").length;
    return { done, text: marks.join("") };
  }

  async _sendNewUsers(limit = 50) {
    await this.send("New users list started...");
    const prefix = "u:";
    const today = dayStrUtc(Date.now());
    let cursor = undefined;
    const rows = [];
    let excludedAdmins = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const fallbackId = String(k.name || "").slice(prefix.length);
          const id = String((u?.id ?? fallbackId) || "");
          if (!id) continue;
          if (this.isAdmin(id)) {
            excludedAdmins += 1;
            continue;
          }

          const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
          const firstActiveDay = isDayStr(stats.firstActiveDay) ? String(stats.firstActiveDay) : "";
          if (!firstActiveDay) continue;
          const age = dayDiffUtc(firstActiveDay, today);
          if (age < 0 || age > 29) continue;

          const lastActiveDay = isDayStr(stats.lastActiveDay) ? String(stats.lastActiveDay) : "-";
          const name = String(u?.displayName || "").trim() || "(no name)";
          const snap = this._refSnapshot(u);
          const source = this._cohortSource(snap);
          const sourceLabel = source === "ads" ? "ads_*" : (source === "ref" ? "ref_*" : "organic");
          const payload = String(snap?.startPayload || "").trim();
          const funnel = this._funnelState(stats);

          rows.push({
            id,
            name,
            firstActiveDay,
            lastActiveDay,
            sourceLabel,
            payload,
            funnelDone: funnel.done,
            funnelText: funnel.text
          });
        } catch {
          // skip bad rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    rows.sort((a, b) => {
      if (String(b.firstActiveDay) !== String(a.firstActiveDay)) {
        return String(b.firstActiveDay).localeCompare(String(a.firstActiveDay));
      }
      if (String(b.lastActiveDay) !== String(a.lastActiveDay)) {
        return String(b.lastActiveDay).localeCompare(String(a.lastActiveDay));
      }
      return String(a.id).localeCompare(String(b.id));
    });

    if (!rows.length) {
      await this.send("No new users for last 30 days.");
      return;
    }

    const capped = rows.slice(0, limit);
    const header = [
      "<b>New users (last 30 days)</b>",
      `Total: ${rows.length}`,
      `Showing: ${capped.length} (limit ${limit})`,
      `Excluded admins: ${excludedAdmins}`,
      "",
      "Funnel legend: S=first shift, C=first claim, G=first gym, B=opened bar, Z=bought business"
    ];
    await this.send(header.join("\n"));

    const CHUNK = 20;
    for (let i = 0; i < capped.length; i += CHUNK) {
      const part = capped.slice(i, i + CHUNK);
      const lines = [];
      for (const r of part) {
        const payloadSuffix = r.payload ? ` · ${this._escapeHtml(r.payload)}` : "";
        lines.push(
          `<code>${this._escapeHtml(r.id)}</code> ${this._escapeHtml(r.name)}`,
          `first ${this._escapeHtml(r.firstActiveDay)} · last ${this._escapeHtml(r.lastActiveDay)} · ${this._escapeHtml(r.sourceLabel)}${payloadSuffix}`,
          `funnel ${r.funnelDone}/5 [${this._escapeHtml(r.funnelText)}]`,
          ""
        );
      }
      await this.send(lines.join("\n").trim());
    }
  }

  _todayDayKey() {
    const d = new Date(Date.now());
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  _hasUsefulActivityToday(u, todayDay, todayDayKey) {
    const day = String(todayDay || "");
    const dayKey = String(todayDayKey || "");

    // Work claim today (legacy reliable marker).
    const hasWorkToday = String(u?.dayKey || "") === dayKey && Math.max(0, Number(u?.dayTotal || 0)) > 0;
    if (hasWorkToday) return true;

    // Quest daily counters for today.
    const qDaily = (u?.quests?.daily && typeof u.quests.daily === "object") ? u.quests.daily : null;
    if (qDaily && String(qDaily.day || "") === day) {
      const c = (qDaily.counters && typeof qDaily.counters === "object") ? qDaily.counters : {};
      const work = Math.max(0, Number(c.workShifts || 0));
      const gym = Math.max(0, Number(c.gymTrains || 0));
      const biz = Math.max(0, Number(c.bizClaims || 0));
      const pet = Math.max(0, Number(c.petFeeds || 0));
      if (work > 0 || gym > 0 || biz > 0 || pet > 0) return true;
    }

    // Business claim today.
    const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    for (const b of owned) {
      if (b && typeof b === "object" && String(b.lastClaimDayUTC || "") === day) return true;
    }

    // Pet feed today.
    if (String(u?.pet?.lastFedDay || "") === day) return true;

    return false;
  }

  async _backfillActivityToday() {
    await this.send("Backfill activity started...");
    const prefix = "u:";
    const today = dayStrUtc(Date.now());
    const todayDayKey = this._todayDayKey();
    let cursor = undefined;
    let scanned = 0;
    let excludedAdmins = 0;
    let matchedToday = 0;
    let updated = 0;
    let alreadyMarked = 0;
    let skippedNoSignal = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const fallbackId = String(k.name || "").slice(prefix.length);
          const id = String((u?.id ?? fallbackId) || "");
          if (!id) continue;
          if (this.isAdmin(id)) {
            excludedAdmins += 1;
            continue;
          }

          scanned += 1;
          if (!this._hasUsefulActivityToday(u, today, todayDayKey)) {
            skippedNoSignal += 1;
            continue;
          }
          matchedToday += 1;

          const changed = markUsefulActivity(u, Date.now());
          if (changed) {
            await this.users.save(u);
            updated += 1;
          } else {
            alreadyMarked += 1;
          }
        } catch {
          // skip invalid rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    await this.send(
      "<b>Backfill activity done</b>\n" +
      `Day (UTC): ${today}\n` +
      `Scanned users (non-admin): ${scanned}\n` +
      `Matched today useful activity: ${matchedToday}\n` +
      `Updated: ${updated}\n` +
      `Already marked: ${alreadyMarked}\n` +
      `No today signal: ${skippedNoSignal}\n` +
      `Excluded admins: ${excludedAdmins}`
    );
  }

  async _trySaveDraftFromMessage({ adminId, chatId, msg }) {
    const text = typeof msg?.text === "string" ? msg.text.trim() : "";
    const caption = typeof msg?.caption === "string" ? msg.caption.trim() : "";
    const photoId = this._extractPhotoFileId(msg);
    let draft = null;

    if (photoId) {
      if (caption.length > 1024) {
        await this.send("Caption too long (>1024).");
        return true;
      }
      draft = {
        type: "photo",
        fileId: photoId,
        caption,
        updatedAt: new Date().toISOString()
      };
    } else if (text) {
      if (text.length > 4096) {
        await this.send("Text too long (>4096).");
        return true;
      }
      draft = {
        type: "text",
        text,
        updatedAt: new Date().toISOString()
      };
    } else {
      return false;
    }

    await this._putJson(this.K.draft(adminId), draft);
    await this._setCompose(adminId, false);

    await this.send("Draft saved. Preview:");
    const preview = await this._sendDraft(chatId, draft);
    if (!preview.ok) {
      await this.send(`Preview send failed: ${this._escapeHtml(preview.error || "unknown error")}`);
      return true;
    }

    await this.send(
      "Confirm actions:\n" +
      "/broadcast_test - send to your chat\n" +
      "/broadcast_send - send to all users\n" +
      "/broadcast_cancel - clear this draft"
    );
    return true;
  }

  async _runBroadcast({ runId, draft, startedBy }) {
    const active = await this._getJson(this.K.active, null);
    if (!active || active.runId !== runId || active.status !== "running") return;

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let blocked = 0;
    let lastError = "";

    try {
      const recipients = await this._collectRecipientChatIds();
      const total = recipients.length;
      active.total = total;
      await this._putJson(this.K.active, active);

      for (const rcpt of recipients) {
        const out = await this._sendDraft(rcpt, draft);
        processed += 1;
        if (out.ok) {
          sent += 1;
        } else {
          failed += 1;
          if (out.blocked) blocked += 1;
          if (out.error) lastError = out.error;
        }

        if (processed % 25 === 0) {
          await this._putJson(this.K.active, {
            ...active,
            processed,
            sent,
            failed,
            blocked,
            lastError
          });
        }

        // Gentle rate limit (about 25 msg/sec).
        await this._sleep(40);
      }

      const done = {
        ...active,
        status: "done",
        endedAt: new Date().toISOString(),
        processed,
        sent,
        failed,
        blocked,
        lastError,
        startedBy: String(startedBy)
      };
      await this._appendHistory(done);
    } catch (e) {
      const crash = {
        ...active,
        status: "failed",
        endedAt: new Date().toISOString(),
        processed,
        sent,
        failed: failed + 1,
        blocked,
        lastError: String(e?.message || e || "broadcast run error"),
        startedBy: String(startedBy)
      };
      await this._appendHistory(crash);
    } finally {
      await this._delete(this.K.active);
    }
  }

  async _collectRecipientChatIds() {
    const prefix = "u:";
    const out = [];
    const seen = new Set();
    let cursor = undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const chatId = Number(u?.chatId || u?.id || 0);
          if (!Number.isFinite(chatId) || chatId <= 0) continue;
          if (seen.has(chatId)) continue;
          seen.add(chatId);
          out.push(chatId);
        } catch {
          // skip bad rows
        }
      }

      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }
    return out;
  }

  async _rebuildLabourFreeIndex() {
    const prefix = "u:";
    const now = Date.now();
    const limit = Math.max(1, Number(CONFIG?.LABOUR_MARKET?.INDEX_SIZE) || 20);
    const minEnergy = 20;
    let cursor = undefined;
    let scanned = 0;
    let eligible = 0;
    let energyPatched = 0;
    const rawRows = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];

      for (const k of keys) {
        scanned += 1;
        try {
          const raw = await this.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);

          const fallbackId = String(k.name || "").slice(prefix.length);
          const id = String((u?.id ?? fallbackId) || "");
          if (!id) continue;
          if (String(u?.id || "") !== id) {
            u.id = id;
          }

          let changed = false;
          const currEnergyMax = Math.max(0, Number(u?.energy_max) || 0);
          const currEnergy = Math.max(0, Number(u?.energy) || 0);
          if (currEnergyMax < minEnergy) {
            u.energy_max = minEnergy;
            changed = true;
          }
          if (currEnergy < minEnergy) {
            u.energy = minEnergy;
            changed = true;
          }
          if (changed) {
            await this.users.save(u);
            energyPatched += 1;
          }

          const name = String(u?.displayName || "").trim();
          if (!name) continue;

          const energyMax = Math.max(0, Number(u?.energy_max) || 0);
          const emp = (u?.employment && typeof u.employment === "object") ? u.employment : null;
          const active = !!emp?.active;
          const contractEnd = Number(emp?.contractEnd || 0);
          const busy = active && contractEnd > now;
          if (busy) continue;

          eligible += 1;
          rawRows.push({ id, name, energyMax });
        } catch {
          // skip invalid user rows
        }
      }

      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    rawRows.sort((a, b) => {
      if ((b.energyMax || 0) !== (a.energyMax || 0)) return (b.energyMax || 0) - (a.energyMax || 0);
      return 0;
    });

    const out = [];
    const seen = new Set();
    for (const row of rawRows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
      if (out.length >= limit) break;
    }

    await this.db.put(LABOUR_FREE_PLAYERS_KEY, JSON.stringify(out));
    return { scanned, eligible, saved: out.length, limit, energyPatched };
  }

  async _rebuildRatings() {
    if (!this.ratings || typeof this.ratings.rebuildAll !== "function") {
      throw new Error("ratings service unavailable");
    }
    return this.ratings.rebuildAll();
  }
  async _sendDraft(chatId, draft) {
    if (!chatId || !draft) return { ok: false, error: "missing chatId/draft" };

    const method = draft.type === "photo" ? "sendPhoto" : "sendMessage";
    const payload = draft.type === "photo"
      ? {
          chat_id: chatId,
          photo: draft.fileId,
          caption: this._sanitizeOutgoingText(draft.caption || ""),
          parse_mode: "HTML"
        }
      : {
          chat_id: chatId,
          text: this._sanitizeOutgoingText(draft.text || ""),
          parse_mode: "HTML"
        };

    return this._sendTelegramWithRetry(method, payload);
  }

  async _sendTelegramWithRetry(method, payload) {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let res;
      try {
        res = await fetch(`https://api.telegram.org/bot${this.botToken}/${method}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        if (attempt === maxAttempts) {
          return { ok: false, error: `network error: ${String(e?.message || e)}` };
        }
        await this._sleep(500 * attempt);
        continue;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const tgOk = !!(res.ok && data?.ok);
      if (tgOk) return { ok: true };

      const errCode = Number(data?.error_code || res.status || 0);
      const desc = String(data?.description || `HTTP ${res.status}`);
      const retryAfter = Number(data?.parameters?.retry_after || 0);

      if (errCode === 429 && retryAfter > 0 && attempt < maxAttempts) {
        await this._sleep((retryAfter + 1) * 1000);
        continue;
      }

      if (errCode >= 500 && attempt < maxAttempts) {
        await this._sleep(800 * attempt);
        continue;
      }

      return {
        ok: false,
        blocked: errCode === 403,
        error: `${errCode}: ${desc}`
      };
    }

    return { ok: false, error: "unknown telegram send failure" };
  }

  _extractPhotoFileId(msg) {
    if (!msg?.photo || !Array.isArray(msg.photo) || !msg.photo.length) return "";
    const p = msg.photo[msg.photo.length - 1];
    return String(p?.file_id || "");
  }

  _sanitizeOutgoingText(s) {
    return this._escapeHtml(String(s || ""));
  }

  _escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async _appendHistory(row) {
    const history = await this._getJson(this.K.history, []);
    const next = Array.isArray(history) ? history.slice() : [];
    next.unshift({
      runId: String(row.runId || `bc_${Date.now()}`),
      status: String(row.status || "done"),
      type: String(row.type || "text"),
      startedAt: String(row.startedAt || ""),
      endedAt: String(row.endedAt || new Date().toISOString()),
      total: Number(row.total || 0),
      processed: Number(row.processed || 0),
      sent: Number(row.sent || 0),
      failed: Number(row.failed || 0),
      blocked: Number(row.blocked || 0),
      lastError: String(row.lastError || "")
    });
    while (next.length > 20) next.pop();
    await this._putJson(this.K.history, next);
  }

  async _isCompose(adminId) {
    const raw = await this.db.get(this.K.compose(adminId));
    return raw === "1";
  }

  async _setCompose(adminId, on) {
    if (on) {
      await this.db.put(this.K.compose(adminId), "1");
      return;
    }
    await this._delete(this.K.compose(adminId));
  }

  async _getJson(key, fallback) {
    try {
      const raw = await this.db.get(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async _putJson(key, value) {
    await this.db.put(key, JSON.stringify(value));
  }

  async _delete(key) {
    await this.db.delete(key);
  }

  async _sleep(ms) {
    if (!ms || ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
