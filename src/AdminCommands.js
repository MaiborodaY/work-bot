// AdminCommands.js
// Admin tools: legacy economy commands + broadcast workflow.
import { CONFIG } from "./GameConfig.js";

const LABOUR_FREE_PLAYERS_KEY = "labour:free_players";

export class AdminCommands {
  /**
   * deps:
   *  - users: UserStore
   *  - send: (text: string) => Promise<void>   // sends into current admin chat
   *  - isAdmin: (id: number|string) => boolean
   *  - botToken: Telegram bot token
   */
  constructor({ users, send, isAdmin, botToken }) {
    this.users = users;
    this.send = send;
    this.isAdmin = isAdmin;
    this.botToken = botToken;
    this.db = users?.db;

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

      const fresh = this.users._newUser(targetId);
      fresh.displayName = "";
      fresh.awaitingName = true;
      fresh.afterNameRoute = "Square";

      if (fresh.study) fresh.study.active = false;
      if (fresh.rest) fresh.rest.active = false;
      if (fresh.gym) fresh.gym.active = false;
      if (fresh.jobs) fresh.jobs.active = [];
      if (fresh.bar) {
        fresh.bar.day = "";
        fresh.bar.assigned = false;
        fresh.bar.tasks = [];
      }
      if (fresh.clan) {
        fresh.clan.clanId = "";
        fresh.clan.joinedAt = 0;
      }

      await this.users.save(fresh);

      await this.send(
        "Wipe done.\n" +
        `User <code>${targetId}</code> reset to new state.\n` +
        `Balance: $${fresh.money}, energy ${fresh.energy}/${fresh.energy_max}, gems ${fresh.premium}.`
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
    if (/^\/labour_reindex(?:@\w+)?\s*$/i.test(input)) {
      await this.send("Labour reindex started...");
      try {
        const out = await this._rebuildLabourFreeIndex();
        await this.send(
          "Labour reindex done.\n" +
          `Scanned: ${Number(out.scanned || 0)}\n` +
          `Eligible: ${Number(out.eligible || 0)}\n` +
          `Saved to index: ${Number(out.saved || 0)} (limit ${Number(out.limit || 0)})`
        );
      } catch (e) {
        await this.send(`Labour reindex failed: ${this._escapeHtml(e?.message || e)}`);
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
    let cursor = undefined;
    let scanned = 0;
    let eligible = 0;
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
    return { scanned, eligible, saved: out.length, limit };
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
