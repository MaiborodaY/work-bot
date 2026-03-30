import { CONFIG } from "./GameConfig.js";
import {
  applyWeeklyKeyReset,
  canQueueByDailyLimit,
  canStartByDailyLimit,
  clearBattleStateOnFinish,
  isRoundSelectionValid,
  nextDefenseZones,
  shouldResetQueueAtMidnight
} from "./ColosseumRules.js";
import { normalizeLang } from "./i18n/index.js";
import { markUsefulActivity } from "./PlayerStats.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, toInt(value, min)));
}

function dayKeyUtc(ts) {
  const d = new Date(Number(ts) || Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekKey(ts) {
  const d = new Date(Number(ts) || Date.now());
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / DAY_MS) + 1) / 7);
  return `${dt.getUTCFullYear()}${String(week).padStart(2, "0")}`;
}

function shortName(userId, displayName) {
  const s = String(displayName || "").trim();
  if (s) return s;
  const id = String(userId || "").slice(-4).padStart(4, "0");
  return `u${id}`;
}

function battleId(nowTs) {
  const a = Math.max(0, toInt(nowTs, Date.now())).toString(36);
  const b = Math.random().toString(36).slice(2, 8);
  return `col_${a}_${b}`;
}

function isZone(value) {
  const z = String(value || "").trim();
  return z === "head" || z === "body" || z === "legs";
}

function zoneDamage(zone) {
  if (zone === "head") return 3;
  if (zone === "body") return 2;
  if (zone === "legs") return 1;
  return 0;
}

export class ColosseumService {
  constructor({ db, users, now, bot = null }) {
    this.db = db || users?.db || null;
    this.users = users || null;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
  }

  _cfg() {
    return CONFIG?.COLOSSEUM || {};
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "en");
  }

  _s() {
    return {
      title: "Colosseum",
      locked: "Colosseum unlocks at {{need}} max energy.\nNow: {{have}}.",
      statusIdle: "Status: ready for battle",
      statusQueue: "Status: in matchmaking queue",
      statusBattle: "Status: active battle",
      weeklyWins: "Weekly wins: {{wins}}",
      battlesLeft: "Daily battles: {{used}}/{{limit}}",
      topTitle: "Weekly top (wins):",
      topEmpty: "No winners yet.",
      topLine: "{{place}} {{name}} - {{wins}}",
      meTop: "You are in top: place {{place}}",
      meOut: "You are outside top-10",
      btnFind: "Find opponent",
      btnLeaveQueue: "Leave queue",
      btnOpenBattle: "Open battle",
      btnStatus: "My status",
      btnHelp: "How Colosseum works",
      btnBack: "Back to city",
      toastQueued: "You joined the queue.",
      toastMatched: "Opponent found!",
      toastQueueLeft: "You left the queue.",
      toastNeedEnergy: "Need {{need}} max energy.",
      toastDailyLimit: "Daily battle limit reached.",
      toastAlreadyBattle: "Finish your current battle first.",
      toastNoBattle: "No active battle found.",
      pendingTitle: "Opponent found",
      pendingLine: "Opponent: {{name}}",
      pendingAcceptIn: "Accept window: {{secs}} sec",
      pendingAccepted: "You accepted. Waiting for opponent.",
      pendingWait: "Waiting for opponent decision...",
      btnAccept: "Accept",
      btnDecline: "Decline",
      activeTitle: "Battle {{round}}/{{rounds}}",
      activeVs: "{{left}} vs {{right}}",
      activeScore: "Score: {{my}} - {{enemy}}",
      activeDeadline: "Turn ends in: {{secs}} sec",
      activePickAttack: "Pick your attack:",
      activePickDefense: "Attack: {{attack}}. Now pick defense:",
      activeDone: "Turn submitted. Waiting for opponent.",
      btnAtkHead: "Attack head +3",
      btnAtkBody: "Attack body +2",
      btnAtkLegs: "Attack legs +1",
      btnDefHead: "Defend head",
      btnDefBody: "Defend body",
      btnDefLegs: "Defend legs",
      btnRefresh: "Refresh",
      btnSurrender: "Surrender",
      toastAccepted: "Battle accepted.",
      toastDeclined: "You declined the battle.",
      toastCannotAct: "This round is already resolved.",
      toastPickAttackFirst: "Pick attack first.",
      toastInvalidDefense: "Defense cannot match your attack zone.",
      finishedWin: "Victory!",
      finishedLose: "Defeat.",
      finishedDraw: "Draw.",
      finishedScore: "Final score: {{my}} - {{enemy}}",
      finishedRound: "Round {{round}}: you {{myAttack}}/{{myDef}} | opponent {{enemyAttack}}/{{enemyDef}} | damage {{myDmg}}-{{enemyDmg}}",
      finishReasonTimeout: "Battle ended by timeout.",
      finishReasonSurrender: "Battle ended: surrender.",
      btnBackColosseum: "Back to Colosseum",
      helpTitle: "How Colosseum works",
      helpLine1: "- Entry: from 50 max energy.",
      helpLine2: "- Up to 10 battles per UTC day.",
      helpLine3: "- Queue lives until UTC 00:00.",
      helpLine4: "- Accept window is 1 minute.",
      helpLine5: "- 3 rounds: choose attack + defense.",
      helpLine6: "- You cannot attack and defend same zone in a round.",
      helpLine7: "- Damage: head 3, body 2, legs 1.",
      helpLine8: "- Winner is higher total damage.",
      notifyFound: "Opponent found in Colosseum: {{name}}. Accept within 1 minute.",
      notifyFoundBtn: "Open battle",
      notifyStart: "Battle started. Round 1 of 3.",
      notifyRound: "Round {{round}} started. Pick attack and defense.",
      notifyTimeoutAccepted: "Opponent did not accept. You were requeued.",
      notifyTimeoutDeclined: "Battle cancelled: opponent declined.",
      notifyFinishWin: "You won in Colosseum!",
      notifyFinishLose: "You lost in Colosseum.",
      notifyFinishDraw: "Draw in Colosseum.",
      errBattleNotFound: "Battle is no longer available."
    };
  }

  _fmt(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  }

  _queueKey() { return "colosseum:queue:v1"; }
  _openBattlesKey() { return "colosseum:open:v1"; }
  _battleKey(battleIdRaw) { return `colosseum:battle:${String(battleIdRaw || "").trim()}`; }
  _ratingKey(weekKey) { return `colosseum:rating:${String(weekKey || "").trim()}`; }
  _minEnergyMax() { return Math.max(1, toInt(this._cfg().MIN_ENERGY_MAX, 50)); }
  _dailyLimit() { return Math.max(1, toInt(this._cfg().DAILY_LIMIT, 10)); }
  _acceptWindowSec() { return Math.max(10, toInt(this._cfg().ACCEPT_WINDOW_SEC, 60)); }
  _roundWindowSec() { return Math.max(10, toInt(this._cfg().ROUND_WINDOW_SEC, 60)); }
  _roundsCount() { return Math.max(1, toInt(this._cfg().ROUNDS, 3)); }
  _ratingLimit() { return Math.max(1, toInt(this._cfg().RATING_LIMIT, 10)); }
  _battleTtlSec() { return Math.max(3600, toInt(this._cfg().BATTLE_TTL_SEC, 24 * 3600)); }
  _queueTtlSec() { return Math.max(24 * 3600, toInt(this._cfg().QUEUE_TTL_SEC, 10 * 24 * 3600)); }
  _ratingTtlSec() { return Math.max(24 * 3600, toInt(this._cfg().RATING_TTL_SEC, 21 * 24 * 3600)); }
  _nowDayKey() { return dayKeyUtc(this.now()); }
  _nowWeekKey() { return isoWeekKey(this.now()); }
  _isAccessUnlocked(u) { return Math.max(0, toInt(u?.energy_max, 0)) >= this._minEnergyMax(); }
  _secondsLeft(deadlineTs) { return Math.max(0, toInt((Number(deadlineTs) - this.now()) / 1000, 0)); }

  _zoneLabel(zone) {
    if (zone === "head") return "head";
    if (zone === "body") return "body";
    if (zone === "legs") return "legs";
    return "-";
  }

  _ensureUserState(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;
    if (!u.colosseum || typeof u.colosseum !== "object") {
      u.colosseum = {
        dayKey: "",
        battlesToday: 0,
        weekKey: "",
        weekWins: 0,
        activeBattleId: "",
        inQueue: false
      };
      dirty = true;
    }
    const today = this._nowDayKey();
    if (u.colosseum.dayKey !== today) {
      u.colosseum.dayKey = today;
      u.colosseum.battlesToday = 0;
      dirty = true;
    } else {
      const battlesToday = Math.max(0, toInt(u.colosseum.battlesToday, 0));
      if (battlesToday !== u.colosseum.battlesToday) {
        u.colosseum.battlesToday = battlesToday;
        dirty = true;
      }
    }
    if (applyWeeklyKeyReset(u, this._nowWeekKey())) dirty = true;
    if (typeof u.colosseum.activeBattleId !== "string") { u.colosseum.activeBattleId = ""; dirty = true; }
    if (typeof u.colosseum.inQueue !== "boolean") { u.colosseum.inQueue = false; dirty = true; }
    return dirty;
  }

  async _saveUser(u) {
    if (!this.users || typeof this.users.save !== "function") return;
    await this.users.save(u);
  }

  async _loadUser(userId) {
    if (!this.users || typeof this.users.load !== "function") return null;
    const id = String(userId || "").trim();
    if (!id) return null;
    return this.users.load(id).catch(() => null);
  }

  async _sendInline(chatId, text, keyboard) {
    if (!this.bot || !chatId) return;
    try {
      await this.bot.sendWithInline(chatId, String(text || ""), keyboard);
    } catch {}
  }

  _safeJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  _queueEntry(user) {
    return {
      userId: String(user?.id || ""),
      name: shortName(user?.id, user?.displayName),
      joinedAt: this.now()
    };
  }

  _cleanQueueEntries(list) {
    const src = Array.isArray(list) ? list : [];
    const out = [];
    const seen = new Set();
    for (const row of src) {
      const userId = String(row?.userId || "").trim();
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      out.push({
        userId,
        name: shortName(userId, row?.name),
        joinedAt: Math.max(0, toInt(row?.joinedAt, 0))
      });
    }
    out.sort((a, b) => toInt(a.joinedAt, 0) - toInt(b.joinedAt, 0));
    return out.slice(0, 300);
  }

  async _loadQueue() {
    if (!this.db) return { dayKey: this._nowDayKey(), entries: [] };
    const fallback = { dayKey: this._nowDayKey(), entries: [] };
    const raw = await this.db.get(this._queueKey()).catch(() => null);
    const parsed = this._safeJson(raw, fallback);
    const out = {
      dayKey: String(parsed?.dayKey || ""),
      entries: this._cleanQueueEntries(parsed?.entries)
    };
    const today = this._nowDayKey();
    if (!out.dayKey) out.dayKey = today;
    if (shouldResetQueueAtMidnight(out.dayKey, today)) {
      out.dayKey = today;
      out.entries = [];
    }
    return out;
  }

  async _saveQueue(queue) {
    if (!this.db) return;
    const dayKey = String(queue?.dayKey || this._nowDayKey());
    const entries = this._cleanQueueEntries(queue?.entries);
    const payload = { dayKey, entries };
    await this.db.put(this._queueKey(), JSON.stringify(payload), {
      expirationTtl: this._queueTtlSec()
    });
  }

  async _loadOpenBattles() {
    if (!this.db) return [];
    const raw = await this.db.get(this._openBattlesKey()).catch(() => null);
    const parsed = this._safeJson(raw, []);
    const list = Array.isArray(parsed) ? parsed : [];
    const out = [];
    const seen = new Set();
    for (const x of list) {
      const id = String(x || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out.slice(0, 500);
  }

  async _saveOpenBattles(list) {
    if (!this.db) return;
    const arr = Array.isArray(list) ? list.map((x) => String(x || "").trim()).filter(Boolean) : [];
    await this.db.put(this._openBattlesKey(), JSON.stringify(arr), {
      expirationTtl: this._battleTtlSec()
    });
  }

  async _setOpenBattle(id, include) {
    const battleIdRaw = String(id || "").trim();
    if (!battleIdRaw) return;
    const list = await this._loadOpenBattles();
    const has = list.includes(battleIdRaw);
    if (include && !has) list.push(battleIdRaw);
    if (!include && has) {
      const idx = list.indexOf(battleIdRaw);
      if (idx >= 0) list.splice(idx, 1);
    }
    await this._saveOpenBattles(list);
  }

  _normalizeBattle(row) {
    if (!row || typeof row !== "object") return null;
    const id = String(row.id || "").trim();
    const players = Array.isArray(row.players) ? row.players.map((x) => String(x || "").trim()).filter(Boolean) : [];
    if (!id || players.length !== 2) return null;
    const p1 = players[0];
    const p2 = players[1];
    const accepted = row.accepted && typeof row.accepted === "object" ? row.accepted : {};
    const score = row.score && typeof row.score === "object" ? row.score : {};
    const selections = row.selections && typeof row.selections === "object" ? row.selections : {};
    const status = String(row.status || "pending_accept");
    return {
      id,
      createdAt: Math.max(0, toInt(row.createdAt, 0)),
      status,
      dayKey: String(row.dayKey || ""),
      weekKey: String(row.weekKey || this._nowWeekKey()),
      players: [p1, p2],
      names: {
        [p1]: shortName(p1, row?.names?.[p1]),
        [p2]: shortName(p2, row?.names?.[p2])
      },
      acceptDeadline: Math.max(0, toInt(row.acceptDeadline, 0)),
      accepted: {
        [p1]: !!accepted[p1],
        [p2]: !!accepted[p2]
      },
      roundDeadline: Math.max(0, toInt(row.roundDeadline, 0)),
      currentRound: Math.max(1, toInt(row.currentRound, 1)),
      rounds: Array.isArray(row.rounds) ? row.rounds : [],
      score: {
        [p1]: Math.max(0, toInt(score[p1], 0)),
        [p2]: Math.max(0, toInt(score[p2], 0))
      },
      selections: {
        [p1]: {
          attack: isZone(selections?.[p1]?.attack) ? selections[p1].attack : "",
          defense: isZone(selections?.[p1]?.defense) ? selections[p1].defense : "",
          submittedAt: Math.max(0, toInt(selections?.[p1]?.submittedAt, 0))
        },
        [p2]: {
          attack: isZone(selections?.[p2]?.attack) ? selections[p2].attack : "",
          defense: isZone(selections?.[p2]?.defense) ? selections[p2].defense : "",
          submittedAt: Math.max(0, toInt(selections?.[p2]?.submittedAt, 0))
        }
      },
      result: {
        winnerId: String(row?.result?.winnerId || ""),
        draw: !!row?.result?.draw,
        reason: String(row?.result?.reason || "")
      },
      finishedAt: Math.max(0, toInt(row.finishedAt, 0))
    };
  }

  async _loadBattle(id) {
    if (!this.db) return null;
    const battleIdRaw = String(id || "").trim();
    if (!battleIdRaw) return null;
    const raw = await this.db.get(this._battleKey(battleIdRaw)).catch(() => null);
    return this._normalizeBattle(this._safeJson(raw, null));
  }

  async _saveBattle(battle, ttlSec = null) {
    if (!this.db || !battle) return;
    const ttl = Math.max(60, toInt(ttlSec, this._battleTtlSec()));
    await this.db.put(this._battleKey(battle.id), JSON.stringify(battle), { expirationTtl: ttl });
  }

  _otherPlayerId(battle, myId) {
    const id = String(myId || "");
    if (!battle || !Array.isArray(battle.players)) return "";
    return battle.players.find((x) => x !== id) || "";
  }

  _battleBelongsTo(battle, userId) {
    const uid = String(userId || "");
    if (!uid) return false;
    return Array.isArray(battle?.players) && battle.players.includes(uid);
  }

  _newBattleForUsers(a, b) {
    const p1 = String(a?.id || "").trim();
    const p2 = String(b?.id || "").trim();
    const id = battleId(this.now());
    const nowTs = this.now();
    return {
      id,
      createdAt: nowTs,
      status: "pending_accept",
      dayKey: this._nowDayKey(),
      weekKey: this._nowWeekKey(),
      players: [p1, p2],
      names: {
        [p1]: shortName(a?.id, a?.displayName),
        [p2]: shortName(b?.id, b?.displayName)
      },
      acceptDeadline: nowTs + this._acceptWindowSec() * 1000,
      accepted: { [p1]: false, [p2]: false },
      roundDeadline: 0,
      currentRound: 1,
      rounds: [],
      score: { [p1]: 0, [p2]: 0 },
      selections: {
        [p1]: { attack: "", defense: "", submittedAt: 0 },
        [p2]: { attack: "", defense: "", submittedAt: 0 }
      },
      result: { winnerId: "", draw: false, reason: "" },
      finishedAt: 0
    };
  }

  async _saveUserIfDirty(user, dirty) {
    if (dirty) await this._saveUser(user);
  }

  async _loadWeeklyRating(weekKey) {
    if (!this.db) return [];
    const key = this._ratingKey(weekKey);
    const raw = await this.db.get(key).catch(() => null);
    const parsed = this._safeJson(raw, []);
    const list = Array.isArray(parsed) ? parsed : [];
    const out = [];
    const seen = new Set();
    for (const row of list) {
      const userId = String(row?.userId || "").trim();
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      out.push({
        userId,
        name: shortName(userId, row?.name),
        wins: Math.max(0, toInt(row?.wins, 0)),
        reachedAt: Math.max(0, toInt(row?.reachedAt, 0))
      });
    }
    out.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.reachedAt !== b.reachedAt) return a.reachedAt - b.reachedAt;
      return String(a.userId).localeCompare(String(b.userId));
    });
    return out.slice(0, this._ratingLimit());
  }

  async _saveWeeklyRating(weekKey, list) {
    if (!this.db) return;
    const key = this._ratingKey(weekKey);
    const prepared = Array.isArray(list) ? list : [];
    await this.db.put(key, JSON.stringify(prepared), {
      expirationTtl: this._ratingTtlSec()
    });
  }

  async _updateWeeklyRating(user) {
    if (!user) return;
    const weekKey = this._nowWeekKey();
    let list = await this._loadWeeklyRating(weekKey);
    const userId = String(user.id || "").trim();
    if (!userId) return;
    const wins = Math.max(0, toInt(user?.colosseum?.weekWins, 0));
    const idx = list.findIndex((x) => String(x.userId) === userId);
    if (wins <= 0) {
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) {
      const prev = list[idx];
      list[idx] = {
        userId,
        name: shortName(user.id, user.displayName),
        wins,
        reachedAt: wins !== prev.wins ? this.now() : prev.reachedAt
      };
    } else {
      list.push({
        userId,
        name: shortName(user.id, user.displayName),
        wins,
        reachedAt: this.now()
      });
    }
    list.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.reachedAt !== b.reachedAt) return a.reachedAt - b.reachedAt;
      return String(a.userId).localeCompare(String(b.userId));
    });
    list = list.slice(0, this._ratingLimit());
    await this._saveWeeklyRating(weekKey, list);
  }

  _mainKeyboard(user, hasActiveBattle) {
    const s = this._s();
    const kb = [];
    if (hasActiveBattle) {
      kb.push([{ text: s.btnOpenBattle, callback_data: "col:battle:open" }]);
    } else if (user?.colosseum?.inQueue) {
      kb.push([{ text: s.btnLeaveQueue, callback_data: "col:queue:leave" }]);
    } else {
      kb.push([{ text: s.btnFind, callback_data: "col:queue:join" }]);
    }
    kb.push([{ text: s.btnStatus, callback_data: "col:status" }]);
    kb.push([{ text: s.btnHelp, callback_data: "col:help" }]);
    kb.push([{ text: s.btnBack, callback_data: "go:City" }]);
    return kb;
  }

  _buildTopLines(top, myUserId) {
    const s = this._s();
    const lines = [s.topTitle];
    if (!Array.isArray(top) || !top.length) {
      lines.push(s.topEmpty);
      return { lines, meLine: s.meOut, place: -1 };
    }
    const medals = ["1.", "2.", "3."];
    for (let i = 0; i < top.length; i += 1) {
      const row = top[i];
      const place = medals[i] || `${i + 1}.`;
      lines.push(this._fmt(s.topLine, {
        place,
        name: row.name,
        wins: row.wins
      }));
    }
    const idx = top.findIndex((x) => String(x.userId) === String(myUserId || ""));
    return {
      lines,
      meLine: idx >= 0 ? this._fmt(s.meTop, { place: idx + 1 }) : s.meOut,
      place: idx >= 0 ? idx + 1 : -1
    };
  }

  async _resolvePendingTimeout(battle) {
    if (!battle || battle.status !== "pending_accept") return false;
    const nowTs = this.now();
    if (nowTs < battle.acceptDeadline) return false;

    const queue = await this._loadQueue();
    const acceptedIds = battle.players.filter((pid) => !!battle.accepted?.[pid]);
    const users = [];
    for (const pid of battle.players) {
      const u = await this._loadUser(pid);
      if (u) users.push(u);
    }

    for (const u of users) {
      clearBattleStateOnFinish(u);
      this._ensureUserState(u);
      if (acceptedIds.includes(String(u.id || "")) && this._isAccessUnlocked(u) && canQueueByDailyLimit(u, this._nowDayKey(), this._dailyLimit())) {
        const uid = String(u.id || "");
        if (!queue.entries.some((x) => String(x.userId) === uid)) {
          queue.entries.push(this._queueEntry(u));
        }
        u.colosseum.inQueue = true;
      }
      await this._saveUser(u);
    }
    queue.entries = this._cleanQueueEntries(queue.entries);
    await this._saveQueue(queue);

    battle.status = "expired";
    battle.result = { winnerId: "", draw: false, reason: "accept_timeout" };
    battle.finishedAt = nowTs;
    await this._saveBattle(battle, this._battleTtlSec());
    await this._setOpenBattle(battle.id, false);

    for (const u of users) {
      const chatId = String(u?.chatId || "").trim();
      if (!chatId) continue;
      if (acceptedIds.includes(String(u.id || ""))) {
        await this._sendInline(chatId, this._s().notifyTimeoutAccepted, [[{ text: this._s().notifyFoundBtn, callback_data: "go:Colosseum" }]]);
      } else {
        await this._sendInline(chatId, this._s().notifyTimeoutDeclined, [[{ text: this._s().notifyFoundBtn, callback_data: "go:Colosseum" }]]);
      }
    }
    return true;
  }

  _bothSubmitted(battle) {
    const [a, b] = battle.players;
    return !!(battle?.selections?.[a]?.defense) && !!(battle?.selections?.[b]?.defense);
  }

  _resolveRoundOnce(battle) {
    const [a, b] = battle.players;
    const sa = battle.selections?.[a] || { attack: "", defense: "" };
    const sb = battle.selections?.[b] || { attack: "", defense: "" };

    const aAttack = isZone(sa.attack) ? sa.attack : "";
    const aDef = isZone(sa.defense) ? sa.defense : "";
    const bAttack = isZone(sb.attack) ? sb.attack : "";
    const bDef = isZone(sb.defense) ? sb.defense : "";

    const damageToB = (aAttack && aAttack !== bDef) ? zoneDamage(aAttack) : 0;
    const damageToA = (bAttack && bAttack !== aDef) ? zoneDamage(bAttack) : 0;
    battle.score[a] = Math.max(0, toInt(battle.score[a], 0)) + damageToB;
    battle.score[b] = Math.max(0, toInt(battle.score[b], 0)) + damageToA;

    battle.rounds.push({
      round: battle.currentRound,
      [a]: { attack: aAttack, defense: aDef, dealt: damageToB, taken: damageToA },
      [b]: { attack: bAttack, defense: bDef, dealt: damageToA, taken: damageToB }
    });
  }

  async _finalizeBattle(battle, reason = "normal", forcedWinnerId = "") {
    if (!battle || battle.status === "finished") return false;
    const [a, b] = battle.players;
    const users = {
      [a]: await this._loadUser(a),
      [b]: await this._loadUser(b)
    };

    let winnerId = String(forcedWinnerId || "");
    if (!winnerId) {
      const aScore = Math.max(0, toInt(battle?.score?.[a], 0));
      const bScore = Math.max(0, toInt(battle?.score?.[b], 0));
      if (aScore > bScore) winnerId = a;
      else if (bScore > aScore) winnerId = b;
    }
    const draw = !winnerId;
    battle.status = "finished";
    battle.result = { winnerId, draw, reason: String(reason || "normal") };
    battle.finishedAt = this.now();
    await this._saveBattle(battle, this._battleTtlSec());
    await this._setOpenBattle(battle.id, false);

    for (const pid of [a, b]) {
      const u = users[pid];
      if (!u) continue;
      let dirty = false;
      dirty = this._ensureUserState(u) || dirty;
      clearBattleStateOnFinish(u);
      dirty = true;
      if (winnerId && String(u.id || "") === winnerId) {
        u.colosseum.weekWins = Math.max(0, toInt(u.colosseum.weekWins, 0)) + 1;
        dirty = true;
      }
      dirty = markUsefulActivity(u, this.now()) || dirty;
      await this._saveUserIfDirty(u, dirty);
    }
    if (winnerId && users[winnerId]) {
      await this._updateWeeklyRating(users[winnerId]);
    }

    for (const pid of [a, b]) {
      const u = users[pid];
      if (!u) continue;
      const chatId = String(u?.chatId || "").trim();
      if (!chatId) continue;
      if (draw) {
        await this._sendInline(chatId, this._s().notifyFinishDraw, [[{ text: this._s().notifyFoundBtn, callback_data: "go:Colosseum" }]]);
      } else if (String(pid) === String(winnerId)) {
        await this._sendInline(chatId, this._s().notifyFinishWin, [[{ text: this._s().notifyFoundBtn, callback_data: "go:Colosseum" }]]);
      } else {
        await this._sendInline(chatId, this._s().notifyFinishLose, [[{ text: this._s().notifyFoundBtn, callback_data: "go:Colosseum" }]]);
      }
    }
    return true;
  }

  async _resolveActiveTimeout(battle) {
    if (!battle || battle.status !== "active_round") return false;
    const nowTs = this.now();
    if (nowTs < battle.roundDeadline) return false;

    const [a, b] = battle.players;
    if (!battle.selections?.[a]) {
      battle.selections[a] = { attack: "", defense: "", submittedAt: 0 };
    }
    if (!battle.selections?.[b]) {
      battle.selections[b] = { attack: "", defense: "", submittedAt: 0 };
    }
    this._resolveRoundOnce(battle);

    const roundsCount = this._roundsCount();
    if (battle.currentRound >= roundsCount) {
      await this._finalizeBattle(battle, "timeout");
      return true;
    }

    battle.currentRound += 1;
    battle.roundDeadline = nowTs + this._roundWindowSec() * 1000;
    battle.selections[a] = { attack: "", defense: "", submittedAt: 0 };
    battle.selections[b] = { attack: "", defense: "", submittedAt: 0 };
    await this._saveBattle(battle, this._battleTtlSec());
    return true;
  }

  async runTick() {
    const queue = await this._loadQueue();
    await this._saveQueue(queue);

    const open = await this._loadOpenBattles();
    if (!open.length) return { processed: 0 };
    let processed = 0;
    const keep = [];
    for (const id of open) {
      const battle = await this._loadBattle(id);
      if (!battle) continue;
      processed += 1;
      if (battle.status === "pending_accept") {
        const changed = await this._resolvePendingTimeout(battle);
        if (!changed) keep.push(id);
        continue;
      }
      if (battle.status === "active_round") {
        const changed = await this._resolveActiveTimeout(battle);
        if (!changed) keep.push(id);
        continue;
      }
      if (battle.status === "finished" || battle.status === "expired") {
        continue;
      }
      keep.push(id);
    }
    await this._saveOpenBattles(keep);
    return { processed };
  }

  async buildMainView(user) {
    const s = this._s();
    if (!user || typeof user !== "object") {
      return { caption: s.errBattleNotFound, keyboard: [[{ text: s.btnBack, callback_data: "go:City" }]] };
    }
    let dirty = this._ensureUserState(user);
    if (!this._isAccessUnlocked(user)) {
      await this._saveUserIfDirty(user, dirty);
      return {
        caption: `${s.title}\n\n${this._fmt(s.locked, { need: this._minEnergyMax(), have: Math.max(0, toInt(user?.energy_max, 0)) })}`,
        keyboard: [[{ text: s.btnBack, callback_data: "go:City" }]]
      };
    }

    await this.runTick().catch(() => {});

    const activeBattleId = String(user?.colosseum?.activeBattleId || "");
    if (activeBattleId) {
      await this._saveUserIfDirty(user, dirty);
      return this.buildBattleView(user);
    }
    const top = await this._loadWeeklyRating(this._nowWeekKey());
    const topBlock = this._buildTopLines(top, user.id);
    const lines = [
      s.title,
      "",
      user?.colosseum?.inQueue ? s.statusQueue : s.statusIdle,
      this._fmt(s.weeklyWins, { wins: Math.max(0, toInt(user?.colosseum?.weekWins, 0)) }),
      this._fmt(s.battlesLeft, {
        used: Math.max(0, toInt(user?.colosseum?.battlesToday, 0)),
        limit: this._dailyLimit()
      }),
      "",
      ...topBlock.lines,
      "",
      topBlock.meLine
    ];
    dirty = markUsefulActivity(user, this.now()) || dirty;
    await this._saveUserIfDirty(user, dirty);
    return {
      caption: lines.join("\n"),
      keyboard: this._mainKeyboard(user, false)
    };
  }

  async buildHelpView() {
    const s = this._s();
    const lines = [
      s.helpTitle,
      "",
      s.helpLine1,
      s.helpLine2,
      s.helpLine3,
      s.helpLine4,
      s.helpLine5,
      s.helpLine6,
      s.helpLine7,
      s.helpLine8
    ];
    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]]
    };
  }

  async buildStatusView(user) {
    const s = this._s();
    let dirty = this._ensureUserState(user);
    const top = await this._loadWeeklyRating(this._nowWeekKey());
    const topBlock = this._buildTopLines(top, user?.id);
    const lines = [
      s.title,
      "",
      this._fmt(s.weeklyWins, { wins: Math.max(0, toInt(user?.colosseum?.weekWins, 0)) }),
      this._fmt(s.battlesLeft, {
        used: Math.max(0, toInt(user?.colosseum?.battlesToday, 0)),
        limit: this._dailyLimit()
      }),
      "",
      ...topBlock.lines,
      "",
      topBlock.meLine
    ];
    dirty = markUsefulActivity(user, this.now()) || dirty;
    await this._saveUserIfDirty(user, dirty);
    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]]
    };
  }

  async _renderFinishedForUser(user, battle) {
    const s = this._s();
    const uid = String(user?.id || "");
    const other = this._otherPlayerId(battle, uid);
    const myScore = Math.max(0, toInt(battle?.score?.[uid], 0));
    const enemyScore = Math.max(0, toInt(battle?.score?.[other], 0));
    const lines = [s.title, ""];
    if (battle?.result?.draw) {
      lines.push(s.finishedDraw);
    } else if (String(battle?.result?.winnerId || "") === uid) {
      lines.push(s.finishedWin);
    } else {
      lines.push(s.finishedLose);
    }
    lines.push(this._fmt(s.finishedScore, { my: myScore, enemy: enemyScore }));
    if (battle?.result?.reason === "timeout") lines.push(s.finishReasonTimeout);
    if (battle?.result?.reason === "surrender") lines.push(s.finishReasonSurrender);
    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]]
    };
  }

  async buildBattleView(user) {
    const s = this._s();
    if (!user || typeof user !== "object") {
      return { caption: s.errBattleNotFound, keyboard: [[{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]] };
    }
    let dirty = this._ensureUserState(user);
    const bid = String(user?.colosseum?.activeBattleId || "");
    if (!bid) {
      await this._saveUserIfDirty(user, dirty);
      return this.buildMainView(user);
    }
    await this.runTick().catch(() => {});
    const battle = await this._loadBattle(bid);
    if (!battle || !this._battleBelongsTo(battle, user.id)) {
      clearBattleStateOnFinish(user);
      dirty = true;
      await this._saveUserIfDirty(user, dirty);
      return this.buildMainView(user);
    }

    if (battle.status === "finished" || battle.status === "expired") {
      clearBattleStateOnFinish(user);
      dirty = true;
      await this._saveUserIfDirty(user, dirty);
      return this._renderFinishedForUser(user, battle);
    }

    const uid = String(user.id || "");
    const enemyId = this._otherPlayerId(battle, uid);
    const myName = shortName(uid, user.displayName);
    const enemyName = shortName(enemyId, battle?.names?.[enemyId] || "");
    const myScore = Math.max(0, toInt(battle?.score?.[uid], 0));
    const enemyScore = Math.max(0, toInt(battle?.score?.[enemyId], 0));

    if (battle.status === "pending_accept") {
      const left = this._secondsLeft(battle.acceptDeadline);
      const lines = [
        s.pendingTitle,
        this._fmt(s.pendingLine, { name: enemyName }),
        this._fmt(s.pendingAcceptIn, { secs: left })
      ];
      const accepted = !!battle?.accepted?.[uid];
      if (accepted) lines.push(s.pendingAccepted);
      const keyboard = accepted
        ? [[{ text: s.btnRefresh, callback_data: "col:battle:open" }], [{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]]
        : [[
          { text: s.btnAccept, callback_data: "col:accept" },
          { text: s.btnDecline, callback_data: "col:decline" }
        ], [{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]];
      return { caption: lines.join("\n"), keyboard };
    }

    const left = this._secondsLeft(battle.roundDeadline);
    const mySel = battle?.selections?.[uid] || { attack: "", defense: "", submittedAt: 0 };
    const lines = [
      this._fmt(s.activeTitle, { round: battle.currentRound, rounds: this._roundsCount() }),
      this._fmt(s.activeVs, { left: myName, right: enemyName }),
      this._fmt(s.activeScore, { my: myScore, enemy: enemyScore }),
      this._fmt(s.activeDeadline, { secs: left }),
      ""
    ];
    const keyboard = [];
    if (!isZone(mySel.attack)) {
      lines.push(s.activePickAttack);
      keyboard.push([
        { text: s.btnAtkHead, callback_data: "col:pick:attack:head" },
        { text: s.btnAtkBody, callback_data: "col:pick:attack:body" }
      ]);
      keyboard.push([{ text: s.btnAtkLegs, callback_data: "col:pick:attack:legs" }]);
    } else if (!isZone(mySel.defense)) {
      lines.push(this._fmt(s.activePickDefense, { attack: this._zoneLabel(mySel.attack) }));
      const options = nextDefenseZones(mySel.attack);
      const row = [];
      for (const zone of options) {
        if (zone === "head") row.push({ text: s.btnDefHead, callback_data: "col:pick:defense:head" });
        if (zone === "body") row.push({ text: s.btnDefBody, callback_data: "col:pick:defense:body" });
        if (zone === "legs") row.push({ text: s.btnDefLegs, callback_data: "col:pick:defense:legs" });
      }
      keyboard.push(row);
    } else {
      lines.push(s.activeDone);
    }
    keyboard.push([{ text: s.btnRefresh, callback_data: "col:battle:open" }]);
    keyboard.push([{ text: s.btnSurrender, callback_data: "col:surrender" }]);
    keyboard.push([{ text: s.btnBackColosseum, callback_data: "go:Colosseum" }]);
    return { caption: lines.join("\n"), keyboard };
  }

  async joinQueue(user) {
    const s = this._s();
    if (!user || typeof user !== "object") return { ok: false, error: s.errBattleNotFound };
    let dirty = this._ensureUserState(user);
    if (!this._isAccessUnlocked(user)) {
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "locked", error: this._fmt(s.toastNeedEnergy, { need: this._minEnergyMax() }) };
    }
    if (!canQueueByDailyLimit(user, this._nowDayKey(), this._dailyLimit())) {
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "daily_limit", error: s.toastDailyLimit };
    }
    if (String(user?.colosseum?.activeBattleId || "")) {
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "already_battle", error: s.toastAlreadyBattle };
    }

    const queue = await this._loadQueue();
    queue.entries = this._cleanQueueEntries(queue.entries).filter((x) => String(x.userId) !== String(user.id));

    let opponent = null;
    while (queue.entries.length) {
      const candidate = queue.entries.shift();
      if (!candidate || String(candidate.userId) === String(user.id)) continue;
      const candUser = await this._loadUser(candidate.userId);
      if (!candUser) continue;
      let candDirty = this._ensureUserState(candUser);
      const blocked = !this._isAccessUnlocked(candUser) ||
        !canQueueByDailyLimit(candUser, this._nowDayKey(), this._dailyLimit()) ||
        !!String(candUser?.colosseum?.activeBattleId || "");
      if (blocked) {
        if (candUser?.colosseum?.inQueue) {
          candUser.colosseum.inQueue = false;
          candDirty = true;
        }
        await this._saveUserIfDirty(candUser, candDirty);
        continue;
      }
      opponent = candUser;
      break;
    }

    if (!opponent) {
      queue.entries.push(this._queueEntry(user));
      queue.entries = this._cleanQueueEntries(queue.entries);
      user.colosseum.inQueue = true;
      dirty = true;
      dirty = markUsefulActivity(user, this.now()) || dirty;
      await this._saveQueue(queue);
      await this._saveUserIfDirty(user, dirty);
      return { ok: true, matched: false, toast: s.toastQueued, view: await this.buildMainView(user) };
    }

    const battle = this._newBattleForUsers(user, opponent);
    user.colosseum.inQueue = false;
    user.colosseum.activeBattleId = battle.id;
    dirty = true;
    dirty = markUsefulActivity(user, this.now()) || dirty;

    let oppDirty = this._ensureUserState(opponent);
    opponent.colosseum.inQueue = false;
    opponent.colosseum.activeBattleId = battle.id;
    oppDirty = true;
    oppDirty = markUsefulActivity(opponent, this.now()) || oppDirty;

    await this._saveQueue(queue);
    await this._saveUserIfDirty(user, dirty);
    await this._saveUserIfDirty(opponent, oppDirty);
    await this._saveBattle(battle, this._battleTtlSec());
    await this._setOpenBattle(battle.id, true);

    const myChat = String(user?.chatId || "").trim();
    const oppChat = String(opponent?.chatId || "").trim();
    const keyboard = [[
      { text: s.btnAccept, callback_data: "col:accept" },
      { text: s.btnDecline, callback_data: "col:decline" }
    ], [{ text: s.notifyFoundBtn, callback_data: "col:battle:open" }]];
    await this._sendInline(myChat, this._fmt(s.notifyFound, { name: shortName(opponent.id, opponent.displayName) }), keyboard);
    await this._sendInline(oppChat, this._fmt(s.notifyFound, { name: shortName(user.id, user.displayName) }), keyboard);

    return { ok: true, matched: true, toast: s.toastMatched, view: await this.buildBattleView(user) };
  }

  async leaveQueue(user) {
    const s = this._s();
    if (!user || typeof user !== "object") return { ok: false, error: s.errBattleNotFound };
    let dirty = this._ensureUserState(user);
    const queue = await this._loadQueue();
    const before = queue.entries.length;
    queue.entries = this._cleanQueueEntries(queue.entries).filter((x) => String(x.userId) !== String(user.id));
    if (queue.entries.length !== before) await this._saveQueue(queue);
    if (user?.colosseum?.inQueue) {
      user.colosseum.inQueue = false;
      dirty = true;
    }
    await this._saveUserIfDirty(user, dirty);
    return { ok: true, toast: s.toastQueueLeft, view: await this.buildMainView(user) };
  }

  async accept(user) {
    const s = this._s();
    if (!user || typeof user !== "object") return { ok: false, error: s.errBattleNotFound };
    let dirty = this._ensureUserState(user);
    const bid = String(user?.colosseum?.activeBattleId || "");
    if (!bid) {
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "no_battle", error: s.toastNoBattle, view: await this.buildMainView(user) };
    }

    await this.runTick().catch(() => {});
    const battle = await this._loadBattle(bid);
    if (!battle || !this._battleBelongsTo(battle, user.id)) {
      clearBattleStateOnFinish(user);
      dirty = true;
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "stale", error: s.errBattleNotFound, view: await this.buildMainView(user) };
    }
    if (battle.status !== "pending_accept") {
      await this._saveUserIfDirty(user, dirty);
      return { ok: true, toast: s.toastAccepted, view: await this.buildBattleView(user) };
    }
    if (this.now() >= battle.acceptDeadline) {
      await this._resolvePendingTimeout(battle);
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "expired", error: s.errBattleNotFound, view: await this.buildMainView(user) };
    }

    const uid = String(user.id || "");
    battle.accepted[uid] = true;
    await this._saveBattle(battle, this._battleTtlSec());

    const otherId = this._otherPlayerId(battle, uid);
    const bothAccepted = !!battle.accepted?.[uid] && !!battle.accepted?.[otherId];
    if (!bothAccepted) {
      dirty = markUsefulActivity(user, this.now()) || dirty;
      await this._saveUserIfDirty(user, dirty);
      return { ok: true, toast: s.pendingAccepted, view: await this.buildBattleView(user) };
    }

    const meFresh = await this._loadUser(uid) || user;
    const enemyFresh = await this._loadUser(otherId);
    if (!enemyFresh) {
      await this._resolvePendingTimeout(battle);
      return { ok: false, code: "missing_opponent", error: s.errBattleNotFound, view: await this.buildMainView(meFresh) };
    }
    let meDirty = this._ensureUserState(meFresh);
    let enemyDirty = this._ensureUserState(enemyFresh);
    if (!canStartByDailyLimit(meFresh, this._nowDayKey(), this._dailyLimit()) || !canStartByDailyLimit(enemyFresh, this._nowDayKey(), this._dailyLimit())) {
      await this._resolvePendingTimeout(battle);
      await this._saveUserIfDirty(meFresh, meDirty);
      await this._saveUserIfDirty(enemyFresh, enemyDirty);
      return { ok: false, code: "daily_limit", error: s.toastDailyLimit, view: await this.buildMainView(meFresh) };
    }

    meFresh.colosseum.battlesToday = Math.max(0, toInt(meFresh.colosseum.battlesToday, 0)) + 1;
    enemyFresh.colosseum.battlesToday = Math.max(0, toInt(enemyFresh.colosseum.battlesToday, 0)) + 1;
    meFresh.colosseum.inQueue = false;
    enemyFresh.colosseum.inQueue = false;
    meDirty = true;
    enemyDirty = true;
    meDirty = markUsefulActivity(meFresh, this.now()) || meDirty;
    enemyDirty = markUsefulActivity(enemyFresh, this.now()) || enemyDirty;

    battle.status = "active_round";
    battle.currentRound = 1;
    battle.roundDeadline = this.now() + this._roundWindowSec() * 1000;
    battle.selections = {
      [battle.players[0]]: { attack: "", defense: "", submittedAt: 0 },
      [battle.players[1]]: { attack: "", defense: "", submittedAt: 0 }
    };

    await this._saveUserIfDirty(meFresh, meDirty);
    await this._saveUserIfDirty(enemyFresh, enemyDirty);
    await this._saveBattle(battle, this._battleTtlSec());

    await this._sendInline(String(meFresh?.chatId || "").trim(), this._s().notifyStart, [[{ text: this._s().notifyFoundBtn, callback_data: "col:battle:open" }]]);
    await this._sendInline(String(enemyFresh?.chatId || "").trim(), this._s().notifyStart, [[{ text: this._s().notifyFoundBtn, callback_data: "col:battle:open" }]]);

    return { ok: true, toast: s.toastAccepted, view: await this.buildBattleView(meFresh) };
  }

  async decline(user) {
    const s = this._s();
    if (!user || typeof user !== "object") return { ok: false, error: s.errBattleNotFound };
    let dirty = this._ensureUserState(user);
    const bid = String(user?.colosseum?.activeBattleId || "");
    if (!bid) {
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "no_battle", error: s.toastNoBattle, view: await this.buildMainView(user) };
    }
    const battle = await this._loadBattle(bid);
    if (!battle || !this._battleBelongsTo(battle, user.id)) {
      clearBattleStateOnFinish(user);
      dirty = true;
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "stale", error: s.errBattleNotFound, view: await this.buildMainView(user) };
    }

    if (battle.status !== "pending_accept") {
      await this._saveUserIfDirty(user, dirty);
      return { ok: false, code: "already_started", error: s.toastCannotAct, view: await this.buildBattleView(user) };
    }

    const uid = String(user.id || "");
    const otherId = this._otherPlayerId(battle, uid);
    const other = await this._loadUser(otherId);
    const queue = await this._loadQueue();

    clearBattleStateOnFinish(user);
    dirty = true;
    dirty = markUsefulActivity(user, this.now()) || dirty;
    await this._saveUserIfDirty(user, dirty);

    if (other) {
      let otherDirty = this._ensureUserState(other);
      clearBattleStateOnFinish(other);
      otherDirty = true;
      if (this._isAccessUnlocked(other) && canQueueByDailyLimit(other, this._nowDayKey(), this._dailyLimit())) {
        if (!queue.entries.some((x) => String(x.userId) === String(other.id))) {
          queue.entries.push(this._queueEntry(other));
        }
        other.colosseum.inQueue = true;
        otherDirty = true;
      }
      otherDirty = markUsefulActivity(other, this.now()) || otherDirty;
      await this._saveUserIfDirty(other, otherDirty);
      await this._sendInline(String(other?.chatId || "").trim(), s.notifyTimeoutDeclined, [[{ text: s.notifyFoundBtn, callback_data: "go:Colosseum" }]]);
    }

    queue.entries = this._cleanQueueEntries(queue.entries);
    await this._saveQueue(queue);

    battle.status = "expired";
    battle.result = { winnerId: "", draw: false, reason: "declined" };
    battle.finishedAt = this.now();
    await this._saveBattle(battle, this._battleTtlSec());
    await this._setOpenBattle(battle.id, false);

    return { ok: true, toast: s.toastDeclined, view: await this.buildMainView(user) };
  }

  async pickAttack(user, attackZone) {
    const s = this._s();
    const zone = String(attackZone || "").trim();
    if (!isZone(zone)) return { ok: false, error: s.toastCannotAct };
    const bid = String(user?.colosseum?.activeBattleId || "");
    if (!bid) return { ok: false, error: s.toastNoBattle, view: await this.buildMainView(user) };
    await this.runTick().catch(() => {});
    const battle = await this._loadBattle(bid);
    if (!battle || battle.status !== "active_round" || !this._battleBelongsTo(battle, user.id)) {
      return { ok: false, error: s.errBattleNotFound, view: await this.buildMainView(user) };
    }
    if (this.now() >= battle.roundDeadline) {
      await this._resolveActiveTimeout(battle);
      return { ok: false, error: s.toastCannotAct, view: await this.buildBattleView(user) };
    }

    const uid = String(user.id || "");
    if (!battle.selections[uid]) battle.selections[uid] = { attack: "", defense: "", submittedAt: 0 };
    battle.selections[uid].attack = zone;
    battle.selections[uid].defense = "";
    battle.selections[uid].submittedAt = 0;
    await this._saveBattle(battle, this._battleTtlSec());
    return { ok: true, view: await this.buildBattleView(user) };
  }

  async pickDefense(user, defenseZone) {
    const s = this._s();
    const zone = String(defenseZone || "").trim();
    if (!isZone(zone)) return { ok: false, error: s.toastCannotAct };
    const bid = String(user?.colosseum?.activeBattleId || "");
    if (!bid) return { ok: false, error: s.toastNoBattle, view: await this.buildMainView(user) };
    await this.runTick().catch(() => {});
    const battle = await this._loadBattle(bid);
    if (!battle || battle.status !== "active_round" || !this._battleBelongsTo(battle, user.id)) {
      return { ok: false, error: s.errBattleNotFound, view: await this.buildMainView(user) };
    }
    if (this.now() >= battle.roundDeadline) {
      await this._resolveActiveTimeout(battle);
      return { ok: false, error: s.toastCannotAct, view: await this.buildBattleView(user) };
    }

    const uid = String(user.id || "");
    if (!battle.selections[uid]) battle.selections[uid] = { attack: "", defense: "", submittedAt: 0 };
    const attack = String(battle.selections[uid].attack || "");
    if (!isZone(attack)) {
      return { ok: false, error: s.toastPickAttackFirst, view: await this.buildBattleView(user) };
    }
    if (!isRoundSelectionValid(attack, zone)) {
      return { ok: false, error: s.toastInvalidDefense, view: await this.buildBattleView(user) };
    }
    battle.selections[uid].defense = zone;
    battle.selections[uid].submittedAt = this.now();

    if (!this._bothSubmitted(battle)) {
      await this._saveBattle(battle, this._battleTtlSec());
      return { ok: true, view: await this.buildBattleView(user) };
    }

    this._resolveRoundOnce(battle);
    if (battle.currentRound >= this._roundsCount()) {
      await this._finalizeBattle(battle, "normal");
      return { ok: true, view: await this.buildMainView(user) };
    }

    battle.currentRound += 1;
    battle.roundDeadline = this.now() + this._roundWindowSec() * 1000;
    for (const pid of battle.players) {
      battle.selections[pid] = { attack: "", defense: "", submittedAt: 0 };
      const player = await this._loadUser(pid);
      if (player) {
        await this._sendInline(String(player?.chatId || "").trim(), this._fmt(s.notifyRound, { round: battle.currentRound }), [[{ text: s.notifyFoundBtn, callback_data: "col:battle:open" }]]);
      }
    }
    await this._saveBattle(battle, this._battleTtlSec());
    return { ok: true, view: await this.buildBattleView(user) };
  }

  async surrender(user) {
    const s = this._s();
    const bid = String(user?.colosseum?.activeBattleId || "");
    if (!bid) return { ok: false, error: s.toastNoBattle, view: await this.buildMainView(user) };
    const battle = await this._loadBattle(bid);
    if (!battle || !this._battleBelongsTo(battle, user.id)) {
      return { ok: false, error: s.errBattleNotFound, view: await this.buildMainView(user) };
    }
    if (battle.status === "pending_accept") {
      return this.decline(user);
    }
    if (battle.status !== "active_round") {
      return { ok: true, view: await this.buildBattleView(user) };
    }
    const winnerId = this._otherPlayerId(battle, user.id);
    await this._finalizeBattle(battle, "surrender", winnerId);
    return { ok: true, view: await this.buildMainView(user) };
  }
}
