// AdminCommands.js
// Admin tools: legacy economy commands + broadcast workflow.
import { CONFIG } from "./GameConfig.js";
import { addDaysUtc, dayDiffUtc, dayStrUtc, hasActivityOnDay, isDayStr, markUsefulActivity } from "./PlayerStats.js";
import { ProgressionService } from "./ProgressionService.js";

const LABOUR_FREE_PLAYERS_KEY = "labour:free_players";

export class AdminCommands {
  /**
   * deps:
   *  - users: UserStore
   *  - send: (text: string) => Promise<void>   // sends into current admin chat
   *  - isAdmin: (id: number|string) => boolean
   *  - botToken: Telegram bot token
   */
  constructor({ users, send, isAdmin, botToken, ratings = null, quiz = null, generalQuiz = null, channel = null, syndicate = null }) {
    this.users = users;
    this.send = send;
    this.isAdmin = isAdmin;
    this.botToken = botToken;
    this.db = users?.db;
    this.ratings = ratings || null;
    this.quiz = quiz || null;
    this.generalQuiz = generalQuiz || null;
    this.channel = channel || null;
    this.syndicate = syndicate || null;

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
        "<b>Admin commands</b>\n\n" +
        "<b>Economy &amp; Profiles</b>\n" +
        "/users - list users\n" +
        "/grant &lt;userId&gt; &lt;amount&gt; - add money\n" +
        "/setmoney &lt;userId&gt; &lt;amount&gt; - set money\n" +
        "/givegem &lt;userId&gt; &lt;amount&gt; - add gems\n" +
        "/setgem &lt;userId&gt; &lt;amount&gt; - set gems\n" +
        "/wipe &lt;userId&gt; - full reset user profile\n\n" +
        "<b>Indexes &amp; Patches</b>\n" +
        "/labour_reindex - rebuild labour free index\n" +
        "/admin_rebuild_ratings - rebuild rating indexes\n" +
        "/admin_backfill_activity_today - mark useful activity today\n" +
        "/admin_backfill_activity_today weekly_farm_patch - add missing weekly farm quest for current week\n\n" +
        "<b>Analytics</b>\n" +
        "/admin_referrals - referrals/ads stats\n" +
        "/admin_referrals &lt;userId&gt; - referral info by user\n" +
        "/admin_retention - cohorts retention (30d)\n" +
        "/admin_funnel - onboarding funnel (all-time)\n" +
        "/admin_newbie - newbie path funnel/retention\n" +
        "/admin_levels - players levels snapshot\n" +
        "/admin_syndicate - syndicate stats snapshot\n" +
        "/admin_new_users [limit] - newest users list\n" +
        "/admin_quiz - quiz stats\n\n" +
        "<b>Channel</b>\n" +
        "/admin_channel_preview - preview yesterday post\n" +
        "/admin_channel_publish - publish yesterday post\n" +
        "/admin_channel_force - force publish now\n" +
        "/admin_channel_check [chat] - check channel rights/id\n\n" +
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
      const media = this._extractAnyFileId(msg);
      if (!media?.fileId) {
        await this.send("Send a photo or GIF(animation) with caption /fileid.");
        return true;
      }
      await this.send(
        `type: <code>${this._escapeHtml(media.type)}</code>\n` +
        `file_id:\n<code>${this._escapeHtml(media.fileId)}</code>`
      );
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
    if (/^\/admin_channel_preview(?:@\w+)?\s*$/i.test(input)) {
      await this._sendChannelPreview(chatId);
      return true;
    }
    if (/^\/admin_channel_publish(?:@\w+)?\s*$/i.test(input)) {
      await this._sendChannelPublish({ force: false });
      return true;
    }
    if (/^\/admin_channel_force(?:@\w+)?\s*$/i.test(input)) {
      await this._sendChannelPublish({ force: true });
      return true;
    }
    const mChannelCheck = input.match(/^\/admin_channel_check(?:@\w+)?(?:\s+(.+))?\s*$/i);
    if (mChannelCheck) {
      const target = String(mChannelCheck[1] || "").trim();
      await this._sendChannelCheck(target);
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
    if (/^\/admin_newbie(?:@\w+)?\s*$/i.test(input)) {
      await this._sendNewbieStats();
      return true;
    }
    if (/^\/admin_syndicate(?:@\w+)?\s*$/i.test(input)) {
      await this._sendSyndicateStats();
      return true;
    }
    const mAdminLevels = input.match(/^\/admin_levels(?:@\w+)?(?:\s+(all))?\s*$/i);
    if (mAdminLevels) {
      const includeAdmins = String(mAdminLevels[1] || "").toLowerCase() === "all";
      await this._sendLevelsStats({ includeAdmins });
      return true;
    }
    const mAdminNewUsers = input.match(/^\/admin_new_users(?:@\w+)?(?:\s+(\d+))?\s*$/i);
    if (mAdminNewUsers) {
      const limitRaw = Number(mAdminNewUsers[1] || 50);
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));
      await this._sendNewUsers(limit);
      return true;
    }
    const mBackfill = input.match(/^\/admin_backfill_activity_today(?:@\w+)?(?:\s+([a-z_]+))?\s*$/i);
    if (mBackfill) {
      const mode = String(mBackfill[1] || "").trim().toLowerCase();
      if (!mode) {
        await this._backfillActivityToday();
        return true;
      }
      if (mode === "weekly_farm_patch") {
        await this._patchWeeklyFarmQuestCurrentWeek();
        return true;
      }
      await this.send(
        "Unknown mode.\n" +
        "Use:\n" +
        "/admin_backfill_activity_today\n" +
        "/admin_backfill_activity_today weekly_farm_patch"
      );
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
    const sourceConversions = new Map();
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
            const key = s.startPayload;
            const prev = sourceConversions.get(key) || { started: 0, firstClaim: 0 };
            prev.started += 1;
            const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
            const shiftByHistory = Math.max(0, Number(u?.achievements?.progress?.totalShifts || 0)) > 0;
            const didFirstClaim = this._toBool(stats.didFirstClaim) || shiftByHistory;
            if (didFirstClaim) prev.firstClaim += 1;
            sourceConversions.set(key, prev);
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
    const topSourceConversions = Array.from(sourceConversions.entries())
      .map(([payload, row]) => ({
        payload,
        started: Math.max(0, Number(row?.started || 0)),
        firstClaim: Math.max(0, Number(row?.firstClaim || 0))
      }))
      .sort((a, b) => {
        if (b.started !== a.started) return b.started - a.started;
        if (b.firstClaim !== a.firstClaim) return b.firstClaim - a.firstClaim;
        return String(a.payload).localeCompare(String(b.payload));
      })
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
    if (topSourceConversions.length) {
      lines.push("", "<b>Top payload conversions (start -&gt; first payout)</b>");
      for (const row of topSourceConversions) {
        const started = Math.max(0, Number(row.started || 0));
        const firstClaim = Math.max(0, Number(row.firstClaim || 0));
        const pct = started > 0 ? Math.round((firstClaim * 100) / started) : 0;
        lines.push(
          `${this._escapeHtml(row.payload)} - ${started} -&gt; ${firstClaim} (${pct}%)`
        );
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

    if (this.generalQuiz && typeof this.generalQuiz.collectAdminStats === "function") {
      const g = await this.generalQuiz.collectAdminStats().catch(() => null);
      if (g) {
        const bd = (g.byDifficulty && typeof g.byDifficulty === "object") ? g.byDifficulty : {};
        const row = (id) => (bd[id] && typeof bd[id] === "object")
          ? bd[id]
          : { selectedToday: 0, playedToday: 0, perfectToday: 0, playedTotal: 0, perfectTotal: 0 };
        const easy = row("easy");
        const medium = row("medium");
        const hard = row("hard");
        const legacyPlayed = Math.max(0, Number(g?.legacyPlayedTotal || 0));
        const legacyPerfect = Math.max(0, Number(g?.legacyPerfectTotal || 0));
        lines.push(
          "",
          "<b>General quiz stats</b>",
          `Day (UTC): ${this._escapeHtml(String(g?.day || "-"))}`,
          `Scanned users: ${Number(g?.scanned || 0)}`,
          `Selected today: easy ${Number(easy.selectedToday || 0)}, medium ${Number(medium.selectedToday || 0)}, hard ${Number(hard.selectedToday || 0)}`,
          `Played today: ${Number(g?.playedToday || 0)} (easy ${Number(easy.playedToday || 0)}, medium ${Number(medium.playedToday || 0)}, hard ${Number(hard.playedToday || 0)})`,
          `Perfect today: ${Number(g?.perfectToday || 0)} (easy ${Number(easy.perfectToday || 0)}, medium ${Number(medium.perfectToday || 0)}, hard ${Number(hard.perfectToday || 0)})`,
          `Total played: ${Number(g?.playedTotal || 0)} (easy ${Number(easy.playedTotal || 0)}, medium ${Number(medium.playedTotal || 0)}, hard ${Number(hard.playedTotal || 0)})`,
          `Total perfect: ${Number(g?.perfectTotal || 0)} (easy ${Number(easy.perfectTotal || 0)}, medium ${Number(medium.perfectTotal || 0)}, hard ${Number(hard.perfectTotal || 0)})`
        );
        if (legacyPlayed > 0 || legacyPerfect > 0) {
          lines.push(
            `Legacy totals (before difficulty split): played ${legacyPlayed}, perfect ${legacyPerfect}`
          );
        }
      }
    }
    await this.send(lines.join("\n"));
  }

  async _sendChannelPreview(chatId) {
    if (!this.channel || typeof this.channel.previewYesterday !== "function") {
      await this.send("Channel posts service unavailable.");
      return;
    }
    const targetChatId = Number(chatId) || chatId;
    if (!targetChatId) {
      await this.send("Preview failed: admin chat id is missing.");
      return;
    }
    await this.send("Channel preview started...");
    try {
      const out = await this.channel.previewYesterday(targetChatId);
      if (out?.reason === "below_threshold") {
        await this.send("Preview sent (note: yesterday is below auto-post threshold).");
        return;
      }
      await this.send("Preview sent.");
    } catch (e) {
      await this.send(`Channel preview failed: ${this._escapeHtml(e?.message || e)}`);
    }
  }

  async _sendChannelPublish({ force = false } = {}) {
    if (!this.channel || typeof this.channel.publishYesterday !== "function") {
      await this.send("Channel posts service unavailable.");
      return;
    }
    await this.send(force ? "Force publish started..." : "Publish started...");
    try {
      const out = await this.channel.publishYesterday({ force: !!force });
      if (out?.ok) {
        await this.send(
          `Published to channel for <code>${this._escapeHtml(String(out.day || "-"))}</code>.` +
          (out?.forced ? " (forced)" : "")
        );
        return;
      }
      const reason = String(out?.reason || "unknown");
      if (reason === "already_posted") {
        await this.send(`Skipped: already posted for <code>${this._escapeHtml(String(out?.day || "-"))}</code>.`);
        return;
      }
      if (reason === "below_threshold") {
        await this.send(`Skipped: below threshold for <code>${this._escapeHtml(String(out?.day || "-"))}</code>.`);
        return;
      }
      if (reason === "channel_id_missing") {
        await this.send("Publish failed: CHANNEL_ID is not configured.");
        return;
      }
      await this.send(`Publish skipped: ${this._escapeHtml(reason)}.`);
    } catch (e) {
      await this.send(`Publish failed: ${this._escapeHtml(e?.message || e)}`);
    }
  }

  async _sendChannelCheck(inputTarget = "") {
    const target = String(inputTarget || this.channel?.channelId || "").trim();
    if (!target) {
      await this.send("Channel check failed: target is empty. Use /admin_channel_check @channel_username");
      return;
    }

    await this.send(`Channel check started for <code>${this._escapeHtml(target)}</code>...`);

    let chat = null;
    try {
      const chatResp = await fetch(`https://api.telegram.org/bot${this.botToken}/getChat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: target })
      });
      const chatJson = await chatResp.json().catch(() => null);
      if (!chatResp.ok || !chatJson?.ok) {
        const err = this._escapeHtml(String(chatJson?.description || `HTTP ${chatResp.status}`));
        await this.send(`Channel getChat failed: ${err}`);
        return;
      }
      chat = chatJson?.result || null;
    } catch (e) {
      await this.send(`Channel getChat error: ${this._escapeHtml(e?.message || e)}`);
      return;
    }

    const chatId = String(chat?.id || "").trim();
    const title = this._escapeHtml(String(chat?.title || ""));
    const username = this._escapeHtml(String(chat?.username || ""));
    const type = this._escapeHtml(String(chat?.type || ""));

    let meStatus = "";
    try {
      const memberResp = await fetch(`https://api.telegram.org/bot${this.botToken}/getChatMember`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: target, user_id: "me" })
      });
      const memberJson = await memberResp.json().catch(() => null);
      if (memberResp.ok && memberJson?.ok) {
        meStatus = String(memberJson?.result?.status || "");
      }
    } catch {
      // ignore optional status probe
    }

    await this.send(
      "<b>Channel check result</b>\n" +
      `Target: <code>${this._escapeHtml(target)}</code>\n` +
      `Resolved id: <code>${this._escapeHtml(chatId || "-")}</code>\n` +
      `Type: ${type || "-"}\n` +
      `Title: ${title || "-"}\n` +
      `Username: ${username ? `@${username}` : "-"}\n` +
      (meStatus ? `Bot status: ${this._escapeHtml(meStatus)}\n` : "")
    );

    try {
      const testResp = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: target,
          text: "✅ Channel post check from /admin_channel_check",
          parse_mode: "HTML"
        })
      });
      const testJson = await testResp.json().catch(() => null);
      if (!testResp.ok || !testJson?.ok) {
        const err = this._escapeHtml(String(testJson?.description || `HTTP ${testResp.status}`));
        await this.send(`sendMessage test failed: ${err}`);
        return;
      }
      await this.send("sendMessage test: success.");
    } catch (e) {
      await this.send(`sendMessage test error: ${this._escapeHtml(e?.message || e)}`);
    }
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

  _bizScore(u) {
    const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    let businesses = 0;
    let slots = 0;
    for (const b of owned) {
      const id = String(typeof b === "string" ? b : b?.id || "").trim();
      if (id) businesses += 1;
      if (b && typeof b === "object" && Array.isArray(b.slots)) {
        slots += b.slots.filter((s) => !!s?.purchased).length;
      } else if (b && typeof b === "object" && b.slot && typeof b.slot === "object" && b.slot.purchased) {
        // legacy single-slot shape
        slots += 1;
      }
    }
    return Math.max(0, businesses + slots);
  }

  _sortTopRows(rows, scoreKey = "score") {
    const out = Array.isArray(rows) ? rows.slice() : [];
    out.sort((a, b) => {
      const bs = Math.max(0, Number(b?.[scoreKey]) || 0);
      const as = Math.max(0, Number(a?.[scoreKey]) || 0);
      if (bs !== as) return bs - as;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    return out;
  }

  _petPurchaseStats(u) {
    const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
    const petType = String(u?.pet?.type || "").trim();
    const catByPet = petType === "cat";
    const dogByPet = petType === "dog";
    const cat = this._toBool(stats.didPetBuyCat) || catByPet;
    const dog = this._toBool(stats.didPetBuyDog) || dogByPet;
    const bought = this._toBool(stats.didPetBuy) || cat || dog;
    return { bought, cat, dog };
  }

  _pct(part, total) {
    const p = Math.max(0, Number(part || 0));
    const t = Math.max(0, Number(total || 0));
    if (t <= 0) return 0;
    return Math.round((p * 100) / t);
  }

  _fmtInt(v) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    return n.toLocaleString("en-US");
  }

  _bucketLabel(min, max) {
    return `${min}-${max}`;
  }

  _medianInt(values) {
    const arr = Array.isArray(values) ? values.slice().sort((a, b) => a - b) : [];
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 === 1) return arr[mid];
    return Math.round((arr[mid - 1] + arr[mid]) / 2);
  }

  _percentileInt(values, q) {
    const arr = Array.isArray(values) ? values.slice().sort((a, b) => a - b) : [];
    if (!arr.length) return 0;
    const qq = Math.max(0, Math.min(1, Number(q) || 0));
    const idx = Math.max(0, Math.min(arr.length - 1, Math.ceil(qq * arr.length) - 1));
    return Math.max(0, Math.floor(Number(arr[idx]) || 0));
  }

  async _sendLevelsStats({ includeAdmins = false } = {}) {
    await this.send("Levels stats started...");
    const prefix = "u:";
    const today = dayStrUtc(Date.now());
    let cursor = undefined;
    let scannedUsers = 0;
    let excludedAdmins = 0;
    let active7d = 0;
    let active30d = 0;
    const rows = [];

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
          if (!includeAdmins && this.isAdmin(id)) {
            excludedAdmins += 1;
            continue;
          }
          scannedUsers += 1;

          const stats = (u?.stats && typeof u.stats === "object") ? u.stats : {};
          const lastActiveDay = isDayStr(stats.lastActiveDay) ? String(stats.lastActiveDay) : "";
          if (lastActiveDay) {
            const age = dayDiffUtc(lastActiveDay, today);
            if (age >= 0 && age <= 6) active7d += 1;
            if (age >= 0 && age <= 29) active30d += 1;
          }

          const lvl = ProgressionService.getLevelInfo(u);
          rows.push({
            id,
            name: String(u?.displayName || "").trim() || "(no name)",
            level: Math.max(1, Math.floor(Number(lvl?.level) || 1)),
            xp: Math.max(0, Math.floor(Number(lvl?.xp) || 0))
          });
        } catch {
          // skip broken rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    const levels = rows.map((r) => r.level);
    const total = rows.length;
    const sum = levels.reduce((acc, v) => acc + v, 0);
    const avg = total > 0 ? (sum / total) : 0;
    const median = this._medianInt(levels);
    const p90 = this._percentileInt(levels, 0.9);
    const maxLevel = levels.length ? Math.max(...levels) : 0;
    const gte15 = levels.filter((v) => v >= 15).length;
    const gte20 = levels.filter((v) => v >= 20).length;

    const bucketDefs = [
      [1, 5],
      [6, 10],
      [11, 15],
      [16, 20],
      [21, 30],
      [31, 50]
    ];
    const bucketRows = bucketDefs.map(([min, max]) => ({
      label: this._bucketLabel(min, max),
      count: levels.filter((v) => v >= min && v <= max).length
    }));

    const top = rows
      .slice()
      .sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        if (b.xp !== a.xp) return b.xp - a.xp;
        return String(a.id).localeCompare(String(b.id));
      })
      .slice(0, 15);

    const lines = [
      "<b>Player levels snapshot</b>",
      "",
      `Scope: ${includeAdmins ? "all users" : "non-admin users"}`,
      `Scanned users (${includeAdmins ? "all" : "non-admin"}): ${this._fmtInt(scannedUsers)}`,
      `Active last 7d: ${this._fmtInt(active7d)}`,
      `Active last 30d: ${this._fmtInt(active30d)}`,
      "",
      `Avg level: ${avg.toFixed(1)}`,
      `Median: ${this._fmtInt(median)} | P90: ${this._fmtInt(p90)} | Max: ${this._fmtInt(maxLevel)}`,
      "",
      "<b>Buckets</b>"
    ];
    for (const b of bucketRows) {
      lines.push(`${this._escapeHtml(b.label)}: ${this._fmtInt(b.count)}`);
    }
    lines.push(
      "",
      `Users >=15: ${this._fmtInt(gte15)}`,
      `Users >=20: ${this._fmtInt(gte20)}`,
      ""
    );
    lines.push("<b>Top 15 by level</b>");
    if (!top.length) {
      lines.push("-");
    } else {
      let rank = 1;
      for (const row of top) {
        lines.push(`${rank}. ${this._escapeHtml(row.name)} - lvl ${this._fmtInt(row.level)} | XP ${this._fmtInt(row.xp)}`);
        rank += 1;
      }
    }
    if (!includeAdmins) lines.push("", `Excluded admins: ${this._fmtInt(excludedAdmins)}`);
    await this.send(lines.join("\n"));
  }

  async _sendSyndicateStats() {
    await this.send("Syndicate stats started...");
    if (!this.syndicate || typeof this.syndicate.getAdminStats !== "function") {
      await this.send("Syndicate service unavailable.");
      return;
    }

    const stats = await this.syndicate.getAdminStats();
    const todayStats = (stats?.todayStats && typeof stats.todayStats === "object")
      ? stats.todayStats
      : null;
    const topWeek = Array.isArray(stats?.topWeek) ? stats.topWeek.slice(0, 10) : [];
    const topAll = Array.isArray(stats?.topAll) ? stats.topAll.slice(0, 10) : [];

    const lines = [
      "<b>Syndicate snapshot</b>",
      "",
      `Scanned users (non-admin): ${this._fmtInt(stats?.scannedUsers || 0)}`,
      `Excluded admins: ${this._fmtInt(stats?.excludedAdmins || 0)}`,
      `Users with access: ${this._fmtInt(stats?.withAccess || 0)}`,
      `Participants (>=1 deal): ${this._fmtInt(stats?.participants || 0)}`,
      `Completed deals (approx): ${this._fmtInt(stats?.totalCompletedDealsApprox || 0)}`,
      `Net profit (approx): $${this._fmtInt(stats?.totalNetApprox || 0)}`,
      "",
      `Open deals now: ${this._fmtInt(stats?.openCount || 0)}`,
      `Active deals now: ${this._fmtInt(stats?.activeCount || 0)}`,
      `Deals scanned in KV: ${this._fmtInt(stats?.dealsScanned || 0)}`,
      `Finished deals in KV: ${this._fmtInt(stats?.finishedDeals || 0)}`,
      "",
      "<b>Outcomes</b>",
      `Success: ${this._fmtInt(stats?.outcomes?.success || 0)}`,
      `Lucky: ${this._fmtInt(stats?.outcomes?.lucky || 0)}`,
      `Fail: ${this._fmtInt(stats?.outcomes?.fail || 0)}`,
      `Expired: ${this._fmtInt(stats?.outcomes?.expired || 0)}`,
      `Cancelled: ${this._fmtInt(stats?.outcomes?.cancelled || 0)}`
    ];

    if (todayStats) {
      lines.push(
        "",
        "<b>Today counters (UTC)</b>",
        `Day: ${this._escapeHtml(String(todayStats?.day || "-"))}`,
        `Created: ${this._fmtInt(todayStats?.created || 0)}`,
        `Accepted: ${this._fmtInt(todayStats?.accepted || 0)}`,
        `Cancelled: ${this._fmtInt(todayStats?.cancelled || 0)}`,
        `Expired: ${this._fmtInt(todayStats?.expired || 0)}`,
        `Finished: ${this._fmtInt(todayStats?.finished || 0)}`
      );
    }

    lines.push("", "<b>Top 10 (week, weighted points)</b>");
    if (!topWeek.length) {
      lines.push("-");
    } else {
      let i = 1;
      for (const row of topWeek) {
        lines.push(
          `${i}. ${this._escapeHtml(String(row?.name || "Player"))} - ${this._fmtInt(row?.score || 0)} pts · ` +
          `${this._fmtInt(row?.completed || 0)} deals`
        );
        i += 1;
      }
    }

    lines.push("", "<b>Top 10 (all-time, weighted points)</b>");
    if (!topAll.length) {
      lines.push("-");
    } else {
      let i = 1;
      for (const row of topAll) {
        lines.push(
          `${i}. ${this._escapeHtml(String(row?.name || "Player"))} - ${this._fmtInt(row?.score || 0)} pts · ` +
          `${this._fmtInt(row?.completed || 0)} deals`
        );
        i += 1;
      }
    }

    await this.send(lines.join("\n"));
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
    let petBought = 0;
    let petCat = 0;
    let petDog = 0;

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
          const petStats = this._petPurchaseStats(u);

          if (didFirstShift) firstShift += 1;
          if (didFirstClaim) firstClaim += 1;
          if (didGym) firstGym += 1;
          if (didBar) firstBar += 1;
          if (didBusiness) firstBiz += 1;
          if (petStats.bought) petBought += 1;
          if (petStats.cat) petCat += 1;
          if (petStats.dog) petDog += 1;
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
      `First job started: ${firstShift} (${this._pct(firstShift, registered)}%)`,
      `First payout claimed: ${firstClaim} (${this._pct(firstClaim, registered)}%)`,
      `First workout finished: ${firstGym} (${this._pct(firstGym, registered)}%)`,
      `Opened bar: ${firstBar} (${this._pct(firstBar, registered)}%)`,
      `Bought first business: ${firstBiz} (${this._pct(firstBiz, registered)}%)`,
      `Bought pet (ever): ${petBought} (${this._pct(petBought, registered)}%)`,
      `  cat: ${petCat}, dog: ${petDog}`,
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

  _newbieStepDefs() {
    return Array.isArray(CONFIG?.QUESTS?.NEWBIE_PATH) ? CONFIG.QUESTS.NEWBIE_PATH : [];
  }

  _newbieStepLabel(stepId = "") {
    switch (String(stepId || "")) {
      case "daily_bonus": return "daily bonus";
      case "work_job": return "flyers job";
      case "start_study": return "start study";
      case "buy_coffee": return "buy coffee";
      case "buy_pet": return "buy pet";
      case "gym_train": return "gym workout";
      case "plant_carrot": return "plant carrot";
      case "energy_50": return "reach 50 energy";
      case "money_10000": return "save $10000";
      case "buy_business": return "first business";
      default: return String(stepId || "-");
    }
  }

  _newbieStats(rawStats) {
    const stats = (rawStats && typeof rawStats === "object") ? rawStats : {};
    const nb = (stats.newbie && typeof stats.newbie === "object") ? stats.newbie : {};
    const stepsSeen = (nb.stepsSeen && typeof nb.stepsSeen === "object") ? nb.stepsSeen : {};
    const stepsClaimed = (nb.stepsClaimed && typeof nb.stepsClaimed === "object") ? nb.stepsClaimed : {};
    return {
      openedDay: isDayStr(nb.openedDay) ? String(nb.openedDay) : "",
      completedDay: isDayStr(nb.completedDay) ? String(nb.completedDay) : "",
      maxStepSeen: Math.max(0, Math.floor(Number(nb.maxStepSeen) || 0)),
      maxStepClaimed: Math.max(0, Math.floor(Number(nb.maxStepClaimed) || 0)),
      stepsSeen,
      stepsClaimed
    };
  }

  _newbieStageLabel(u, defs) {
    if (u?.newbiePath?.completed) return "done";
    const step = Math.max(1, Math.floor(Number(u?.newbiePath?.step) || 1));
    const def = defs[step - 1] || null;
    const label = this._newbieStepLabel(def?.id || `step_${step}`);
    return `${label} (${u?.newbiePath?.pending ? "pending" : "active"})`;
  }

  _retentionIntoBucket(bucket, milestoneDay, u, today) {
    if (!isDayStr(milestoneDay)) return;
    bucket.total += 1;
    const age = dayDiffUtc(milestoneDay, today);
    const checks = [
      { n: 1, e: "d1e", r: "d1r" },
      { n: 3, e: "d3e", r: "d3r" },
      { n: 7, e: "d7e", r: "d7r" }
    ];
    for (const c of checks) {
      if (age < c.n) continue;
      bucket[c.e] += 1;
      const targetDay = addDaysUtc(milestoneDay, c.n);
      if (targetDay && hasActivityOnDay(u, targetDay)) {
        bucket[c.r] += 1;
      }
    }
  }

  async _sendNewbieStats() {
    await this.send("Newbie stats started...");
    const prefix = "u:";
    const today = dayStrUtc(Date.now());
    const defs = this._newbieStepDefs();
    let cursor = undefined;
    let scannedUsers = 0;
    let excludedAdmins = 0;

    const sourceStats = {
      ads: { started: 0, completed: 0 },
      ref: { started: 0, completed: 0 },
      organic: { started: 0, completed: 0 }
    };
    const steps = defs.map((def, idx) => ({
      idx: idx + 1,
      id: String(def?.id || ""),
      label: this._newbieStepLabel(def?.id || ""),
      seen: 0,
      claimed: 0,
      activeNow: 0,
      pendingNow: 0
    }));
    const milestones = {
      started: this._retentionCounters(),
      step3: this._retentionCounters(),
      step5: this._retentionCounters(),
      completed: this._retentionCounters()
    };
    const stalled = [];
    const recentCompleted = [];

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
          const nb = this._newbieStats(stats);
          const lastActiveDay = isDayStr(stats.lastActiveDay) ? String(stats.lastActiveDay) : "";
          const firstActiveDay = isDayStr(stats.firstActiveDay) ? String(stats.firstActiveDay) : "";
          const name = String(u?.displayName || "").trim() || "(no name)";
          const snap = this._refSnapshot(u);
          const source = this._cohortSource(snap);
          const sourceLabel = source === "ads" ? "ads_*" : (source === "ref" ? "ref_*" : "organic");

          if (nb.openedDay) {
            sourceStats[source].started += 1;
            this._retentionIntoBucket(milestones.started, nb.openedDay, u, today);
          }
          if (nb.completedDay) {
            sourceStats[source].completed += 1;
            this._retentionIntoBucket(milestones.completed, nb.completedDay, u, today);
            recentCompleted.push({
              id,
              name,
              sourceLabel,
              completedDay: nb.completedDay,
              lastActiveDay: lastActiveDay || "-"
            });
          }

          const step3Day = String(nb.stepsClaimed["3"] || "");
          const step5Day = String(nb.stepsClaimed["5"] || "");
          if (isDayStr(step3Day)) this._retentionIntoBucket(milestones.step3, step3Day, u, today);
          if (isDayStr(step5Day)) this._retentionIntoBucket(milestones.step5, step5Day, u, today);

          for (const row of steps) {
            if (isDayStr(nb.stepsSeen[String(row.idx)])) row.seen += 1;
            if (isDayStr(nb.stepsClaimed[String(row.idx)])) row.claimed += 1;
          }

          if (nb.openedDay && !!u?.flags?.onboardingDone && u?.newbiePath?.completed !== true) {
            const stepIdx = Math.max(1, Math.floor(Number(u?.newbiePath?.step) || 1));
            const row = steps[stepIdx - 1] || null;
            if (row) {
              if (u?.newbiePath?.pending) row.pendingNow += 1;
              else row.activeNow += 1;
            }
            const inactiveDays = lastActiveDay ? Math.max(0, dayDiffUtc(lastActiveDay, today)) : 999;
            stalled.push({
              id,
              name,
              sourceLabel,
              stage: this._newbieStageLabel(u, defs),
              firstActiveDay: firstActiveDay || "-",
              lastActiveDay: lastActiveDay || "-",
              inactiveDays
            });
          }
        } catch {
          // skip bad rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    stalled.sort((a, b) => {
      if (b.inactiveDays !== a.inactiveDays) return b.inactiveDays - a.inactiveDays;
      if (String(a.lastActiveDay) !== String(b.lastActiveDay)) {
        return String(a.lastActiveDay).localeCompare(String(b.lastActiveDay));
      }
      return String(a.id).localeCompare(String(b.id));
    });
    recentCompleted.sort((a, b) => {
      if (String(b.completedDay) !== String(a.completedDay)) {
        return String(b.completedDay).localeCompare(String(a.completedDay));
      }
      return String(a.id).localeCompare(String(b.id));
    });

    const startedTotal = sourceStats.ads.started + sourceStats.ref.started + sourceStats.organic.started;
    const completedTotal = sourceStats.ads.completed + sourceStats.ref.completed + sourceStats.organic.completed;
    const completionPct = startedTotal > 0 ? Math.round((completedTotal * 100) / startedTotal) : 0;

    const lines = [
      "<b>Newbie path analytics</b>",
      "",
      `Started: ${startedTotal}`,
      `Completed: ${completedTotal} (${completionPct}%)`,
      "",
      "<b>By source</b>",
      `ads_*: started ${sourceStats.ads.started} · completed ${sourceStats.ads.completed} (${this._pct(sourceStats.ads.completed, sourceStats.ads.started)}%)`,
      `ref_*: started ${sourceStats.ref.started} · completed ${sourceStats.ref.completed} (${this._pct(sourceStats.ref.completed, sourceStats.ref.started)}%)`,
      `organic: started ${sourceStats.organic.started} · completed ${sourceStats.organic.completed} (${this._pct(sourceStats.organic.completed, sourceStats.organic.started)}%)`,
      "",
      "<b>Steps funnel</b>"
    ];
    for (const row of steps) {
      lines.push(`${row.idx}. ${this._escapeHtml(row.label)} — seen ${row.seen} · claimed ${row.claimed} · active ${row.activeNow} · pending ${row.pendingNow}`);
    }
    lines.push(
      "",
      "<b>Retention after milestones</b>",
      `Path started: D1 ${this._fmtRetentionPair(milestones.started.d1r, milestones.started.d1e)} · D3 ${this._fmtRetentionPair(milestones.started.d3r, milestones.started.d3e)} · D7 ${this._fmtRetentionPair(milestones.started.d7r, milestones.started.d7e)}`,
      `Step 3 claimed: D1 ${this._fmtRetentionPair(milestones.step3.d1r, milestones.step3.d1e)} · D3 ${this._fmtRetentionPair(milestones.step3.d3r, milestones.step3.d3e)} · D7 ${this._fmtRetentionPair(milestones.step3.d7r, milestones.step3.d7e)}`,
      `Step 5 claimed: D1 ${this._fmtRetentionPair(milestones.step5.d1r, milestones.step5.d1e)} · D3 ${this._fmtRetentionPair(milestones.step5.d3r, milestones.step5.d3e)} · D7 ${this._fmtRetentionPair(milestones.step5.d7r, milestones.step5.d7e)}`,
      `Path completed: D1 ${this._fmtRetentionPair(milestones.completed.d1r, milestones.completed.d1e)} · D3 ${this._fmtRetentionPair(milestones.completed.d3r, milestones.completed.d3e)} · D7 ${this._fmtRetentionPair(milestones.completed.d7r, milestones.completed.d7e)}`,
      "",
      `Scanned users (non-admin): ${scannedUsers}`,
      `Excluded admins: ${excludedAdmins}`
    );
    await this.send(lines.join("\n"));

    const stalledRows = stalled.filter((row) => row.inactiveDays >= 1).slice(0, 15);
    if (stalledRows.length) {
      const out = ["<b>Stalled users</b>"];
      for (const row of stalledRows) {
        out.push(
          `<code>${this._escapeHtml(row.id)}</code> ${this._escapeHtml(row.name)}`,
          `${this._escapeHtml(row.stage)} · inactive ${row.inactiveDays}d · ${this._escapeHtml(row.sourceLabel)}`,
          `first ${this._escapeHtml(row.firstActiveDay)} · last ${this._escapeHtml(row.lastActiveDay)}`,
          ""
        );
      }
      await this.send(out.join("\n").trim());
    }

    const completedRows = recentCompleted.slice(0, 10);
    if (completedRows.length) {
      const out = ["<b>Recent completions</b>"];
      for (const row of completedRows) {
        out.push(
          `<code>${this._escapeHtml(row.id)}</code> ${this._escapeHtml(row.name)}`,
          `completed ${this._escapeHtml(row.completedDay)} · last ${this._escapeHtml(row.lastActiveDay)} · ${this._escapeHtml(row.sourceLabel)}`,
          ""
        );
      }
      await this.send(out.join("\n").trim());
    }
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
      "Funnel legend: S=first job, C=first claim, G=first gym, B=opened bar, Z=bought business"
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

  _isoWeekKeyUtc(ts = Date.now()) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const d = new Date(ts);
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThu = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    const diff = Math.floor((tmp.getTime() - firstThu.getTime()) / DAY_MS);
    const week = 1 + Math.floor(diff / 7);
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  _toInt(raw, min = 0) {
    const v = Number(raw);
    return Number.isFinite(v) ? Math.max(min, Math.floor(v)) : min;
  }

  _farmProgressByQuestId(counters, id) {
    const c = (counters && typeof counters === "object") ? counters : {};
    switch (String(id || "")) {
      case "w_farm_harvest_carrot":
        return this._toInt(c.farmHarvestCarrot, 0);
      case "w_farm_harvest_tomato":
        return this._toInt(c.farmHarvestTomato, 0);
      case "w_farm_harvest_corn":
        return this._toInt(c.farmHarvestCorn, 0);
      case "w_farm_plant_seeds":
        return this._toInt(c.farmPlants, 0);
      default:
        return 0;
    }
  }

  _pickFarmWeeklyQuestDef(userId, weekKey) {
    const pool = Array.isArray(CONFIG?.QUESTS?.WEEKLY_POOL) ? CONFIG.QUESTS.WEEKLY_POOL : [];
    const farmDefs = pool.filter((q) => String(q?.category || "") === "farm" && String(q?.id || ""));
    if (!farmDefs.length) return null;
    const seed = `${String(userId || "")}:${String(weekKey || "")}:farm_patch`;
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = ((h * 31) + seed.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % farmDefs.length;
    return farmDefs[idx] || farmDefs[0] || null;
  }

  _buildFarmWeeklyQuest(user, week) {
    const def = this._pickFarmWeeklyQuestDef(user?.id, week);
    if (!def) return null;
    const target = this._toInt(def?.target, 1);
    const rewardMoney = this._toInt(def?.rewardMoney, 0);
    const counters = user?.quests?.weekly?.counters || {};
    const progressRaw = this._farmProgressByQuestId(counters, def.id);
    const progress = Math.min(progressRaw, target);
    const done = progressRaw >= target;
    return {
      id: String(def.id),
      type: "weekly",
      category: "farm",
      difficulty: String(def?.difficulty || "medium"),
      rewardMoney,
      target,
      progress,
      done,
      paid: false
    };
  }

  async _patchWeeklyFarmQuestCurrentWeek() {
    await this.send("Weekly farm patch started...");
    const prefix = "u:";
    const currentWeek = this._isoWeekKeyUtc(Date.now());
    const weeklyCount = this._toInt(CONFIG?.QUESTS?.WEEKLY_COUNT, 2);
    let cursor = undefined;

    let scanned = 0;
    let excludedAdmins = 0;
    let noWeeklyState = 0;
    let weekMismatch = 0;
    let alreadyHasFarm = 0;
    let skippedFull = 0;
    let patched = 0;
    let completedOnPatch = 0;
    let noFarmDefs = 0;

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

          const weekly = (u?.quests?.weekly && typeof u.quests.weekly === "object") ? u.quests.weekly : null;
          if (!weekly || !Array.isArray(weekly.list)) {
            noWeeklyState += 1;
            continue;
          }
          if (String(weekly.week || "") !== currentWeek) {
            weekMismatch += 1;
            continue;
          }

          const hasFarm = weekly.list.some((q) => String(q?.category || "") === "farm");
          if (hasFarm) {
            alreadyHasFarm += 1;
            continue;
          }

          if (weekly.list.length >= weeklyCount) {
            skippedFull += 1;
            continue;
          }

          if (!weekly.counters || typeof weekly.counters !== "object") weekly.counters = {};
          if (!Number.isFinite(Number(weekly.counters.farmPlants))) weekly.counters.farmPlants = 0;
          if (!Number.isFinite(Number(weekly.counters.farmHarvestCarrot))) weekly.counters.farmHarvestCarrot = 0;
          if (!Number.isFinite(Number(weekly.counters.farmHarvestTomato))) weekly.counters.farmHarvestTomato = 0;
          if (!Number.isFinite(Number(weekly.counters.farmHarvestCorn))) weekly.counters.farmHarvestCorn = 0;

          const q = this._buildFarmWeeklyQuest(u, currentWeek);
          if (!q) {
            noFarmDefs += 1;
            continue;
          }
          if (q.done) completedOnPatch += 1;

          weekly.list.push(q);
          await this.users.save(u);
          patched += 1;
        } catch {
          // skip invalid user rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    await this.send(
      "<b>Weekly farm patch done</b>\n" +
      `Week: ${this._escapeHtml(currentWeek)}\n` +
      `Scanned users (non-admin): ${scanned}\n` +
      `Patched: ${patched}\n` +
      `Already had farm quest: ${alreadyHasFarm}\n` +
      `Skipped (weekly full): ${skippedFull}\n` +
      `Skipped (no weekly state): ${noWeeklyState}\n` +
      `Skipped (other week): ${weekMismatch}\n` +
      `Patched and already complete by counters: ${completedOnPatch}\n` +
      `No farm defs in config: ${noFarmDefs}\n` +
      `Excluded admins: ${excludedAdmins}\n\n` +
      "Note: completed-on-patch quests will be paid on next player action."
    );
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

  _extractAnyFileId(msg) {
    const photo = this._extractPhotoFileId(msg);
    if (photo) return { type: "photo", fileId: photo };
    const animation = String(msg?.animation?.file_id || "").trim();
    if (animation) return { type: "animation", fileId: animation };
    const video = String(msg?.video?.file_id || "").trim();
    if (video) return { type: "video", fileId: video };
    const document = String(msg?.document?.file_id || "").trim();
    if (document) return { type: "document", fileId: document };
    return { type: "", fileId: "" };
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
