import { CONFIG } from "./GameConfig.js";
import { normalizeLang } from "./i18n/index.js";
import { markUsefulActivity } from "./PlayerStats.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * HOUR_MS;

function toInt(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
}

function makeSessionId(nowTs) {
  const a = Math.max(0, toInt(nowTs, Date.now())).toString(36);
  const b = Math.random().toString(36).slice(2, 8);
  return `fish_${a}_${b}`;
}

function shortName(id, displayName) {
  const name = String(displayName || "").trim();
  if (name) return name;
  return `u${String(id || "").slice(-4).padStart(4, "0")}`;
}

// Inline strings — to be extracted to i18n/fishing.js in Session 3
function getFishingStrings(lang) {
  const L = {
    ru: {
      title: "🎣 Рыбалка",
      subtitle: "Найди напарника и разделите улов",
      locked: "🔒 Рыбалка доступна с уровня игрока {{need}}. Твой уровень: {{have}}",
      fisherLevel: "Уровень рыбака: {{label}} ({{completed}} сессий)",
      activeSession: "🎣 Активная сессия: {{spot}} — осталось {{left}}",
      noActiveSession: "Нет активной сессии",
      spotLocked: "🔒 Доступно с уровня рыбака {{need}}",
      spotStake: "Ставка: ${{stake}}",
      spotDuration: "Длительность: {{duration}}",
      spotOpenCount: "Ждут напарника: {{count}}",
      btnCreate: "🎣 Создать сессию",
      btnJoin: "➕ Присоединиться",
      btnBack: "⬅️ Назад к заработку",
      btnBackMain: "⬅️ Назад",
      btnOpenFishing: "🎣 Рыбалка",
      btnChoiceHonest: "✅ Честно",
      btnChoiceGreedy: "❌ Жадно",
      matchFoundTitle: "🎣 Напарник найден!",
      fishingWith: "Рыбачишь с: {{name}}",
      repLabel: "📊 Его репутация: {{pct}}%",
      repVisual: "{{bar}}",
      repNewbie: "🆕 Новичок",
      historyTitle: "Ваша история:",
      historyYou: "ты  {{bar}}",
      historyThem: "он  {{bar}}",
      resultTitle: "🎣 Рыбалка завершена!",
      resultPartnerLine: "{{name}}: {{choice}}",
      resultYourLine: "Ты: {{choice}}",
      resultProfit: "Улов: +${{amount}} 💰",
      resultZero: "Ты вернул только ставку.",
      resultCC: "Отличная рыбалка! Оба остались в плюсе.",
      resultDC: "Ты забрал больше. Партнёр остался ни с чем.",
      resultCD: "Партнёр забрал всё. Ты вернул только ставку.",
      resultDD: "Водоём истощён — оба ушли ни с чем.",
      choiceHonest: "Честно ✅",
      choiceGreedy: "Жадно ❌",
      errAlreadyActive: "У тебя уже есть активная сессия.",
      errNotFound: "Сессия не найдена.",
      errNotParticipant: "Ты не участник этой сессии.",
      errAlreadyChosen: "Ты уже сделал выбор.",
      errSessionNotActive: "Сессия не активна.",
      errSpotLocked: "Этот водоём ещё не открыт.",
      errNoMoney: "Недостаточно средств. Нужно ${{need}}.",
      errCantJoinOwn: "Нельзя присоединиться к своей сессии.",
      toastCreated: "Сессия создана, ищем напарника...",
      toastJoined: "Ты присоединился! Сделай свой выбор.",
      toastChosen: "Выбор сделан. Ждём окончания рыбалки.",
      expiredNotify: "⏰ Напарник не нашёлся. Ставка возвращена.",
    },
    uk: {
      title: "🎣 Риболовля",
      subtitle: "Знайди напарника і поділіть улов",
      locked: "🔒 Риболовля доступна з рівня гравця {{need}}. Твій рівень: {{have}}",
      fisherLevel: "Рівень рибалки: {{label}} ({{completed}} сесій)",
      activeSession: "🎣 Активна сесія: {{spot}} — залишилось {{left}}",
      noActiveSession: "Немає активної сесії",
      spotLocked: "🔒 Доступно з рівня рибалки {{need}}",
      spotStake: "Ставка: ${{stake}}",
      spotDuration: "Тривалість: {{duration}}",
      spotOpenCount: "Чекають напарника: {{count}}",
      btnCreate: "🎣 Створити сесію",
      btnJoin: "➕ Приєднатися",
      btnBack: "⬅️ Назад до заробітку",
      btnBackMain: "⬅️ Назад",
      btnOpenFishing: "🎣 Риболовля",
      btnChoiceHonest: "✅ Чесно",
      btnChoiceGreedy: "❌ Жадібно",
      matchFoundTitle: "🎣 Напарника знайдено!",
      fishingWith: "Рибалиш з: {{name}}",
      repLabel: "📊 Його репутація: {{pct}}%",
      repVisual: "{{bar}}",
      repNewbie: "🆕 Новачок",
      historyTitle: "Ваша історія:",
      historyYou: "ти  {{bar}}",
      historyThem: "він  {{bar}}",
      resultTitle: "🎣 Риболовля завершена!",
      resultPartnerLine: "{{name}}: {{choice}}",
      resultYourLine: "Ти: {{choice}}",
      resultProfit: "Улов: +${{amount}} 💰",
      resultZero: "Ти повернув лише ставку.",
      resultCC: "Чудова риболовля! Обидва в плюсі.",
      resultDC: "Ти взяв більше. Партнер залишився ні з чим.",
      resultCD: "Партнер забрав усе. Ти повернув лише ставку.",
      resultDD: "Водойму виснажено — обидва пішли ні з чим.",
      choiceHonest: "Чесно ✅",
      choiceGreedy: "Жадібно ❌",
      errAlreadyActive: "У тебе вже є активна сесія.",
      errNotFound: "Сесію не знайдено.",
      errNotParticipant: "Ти не учасник цієї сесії.",
      errAlreadyChosen: "Ти вже зробив вибір.",
      errSessionNotActive: "Сесія не активна.",
      errSpotLocked: "Ця водойма ще не відкрита.",
      errNoMoney: "Недостатньо коштів. Потрібно ${{need}}.",
      errCantJoinOwn: "Не можна приєднатися до своєї сесії.",
      toastCreated: "Сесію створено, шукаємо напарника...",
      toastJoined: "Ти приєднався! Зроби свій вибір.",
      toastChosen: "Вибір зроблено. Чекаємо закінчення риболовлі.",
      expiredNotify: "⏰ Напарника не знайшлось. Ставку повернено.",
    },
    en: {
      title: "🎣 Fishing",
      subtitle: "Find a partner and share the catch",
      locked: "🔒 Fishing available from player level {{need}}. Your level: {{have}}",
      fisherLevel: "Fisher level: {{label}} ({{completed}} sessions)",
      activeSession: "🎣 Active session: {{spot}} — {{left}} left",
      noActiveSession: "No active session",
      spotLocked: "🔒 Available from fisher level {{need}}",
      spotStake: "Stake: ${{stake}}",
      spotDuration: "Duration: {{duration}}",
      spotOpenCount: "Waiting for partner: {{count}}",
      btnCreate: "🎣 Create session",
      btnJoin: "➕ Join",
      btnBack: "⬅️ Back to earnings",
      btnBackMain: "⬅️ Back",
      btnOpenFishing: "🎣 Fishing",
      btnChoiceHonest: "✅ Honest",
      btnChoiceGreedy: "❌ Greedy",
      matchFoundTitle: "🎣 Partner found!",
      fishingWith: "Fishing with: {{name}}",
      repLabel: "📊 Their reputation: {{pct}}%",
      repVisual: "{{bar}}",
      repNewbie: "🆕 Newbie",
      historyTitle: "Your history:",
      historyYou: "you  {{bar}}",
      historyThem: "them {{bar}}",
      resultTitle: "🎣 Fishing complete!",
      resultPartnerLine: "{{name}}: {{choice}}",
      resultYourLine: "You: {{choice}}",
      resultProfit: "Catch: +${{amount}} 💰",
      resultZero: "You got your stake back.",
      resultCC: "Great fishing! Both of you came out ahead.",
      resultDC: "You took more. Your partner got nothing.",
      resultCD: "Your partner took it all. You got your stake back.",
      resultDD: "The water was fished out — both got nothing.",
      choiceHonest: "Honest ✅",
      choiceGreedy: "Greedy ❌",
      errAlreadyActive: "You already have an active session.",
      errNotFound: "Session not found.",
      errNotParticipant: "You are not a participant in this session.",
      errAlreadyChosen: "You already made your choice.",
      errSessionNotActive: "Session is not active.",
      errSpotLocked: "This spot is not unlocked yet.",
      errNoMoney: "Not enough money. Need ${{need}}.",
      errCantJoinOwn: "You cannot join your own session.",
      toastCreated: "Session created, looking for a partner...",
      toastJoined: "You joined! Make your choice.",
      toastChosen: "Choice made. Waiting for the session to end.",
      expiredNotify: "⏰ No partner found. Stake returned.",
    }
  };
  const l = normalizeLang(lang);
  return L[l] || L.en;
}

export class FishingService {
  constructor({ db, users, now, bot, isAdmin, achievements, quests } = {}) {
    this.db = db || null;
    this.users = users || null;
    this.now = typeof now === "function" ? now : () => Date.now();
    this.bot = bot || null;
    this.isAdmin = typeof isAdmin === "function" ? isAdmin : () => false;
    this.achievements = achievements || null;
    this.quests = quests || null;
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  _cfg() { return CONFIG?.FISHING || {}; }
  _lang(source) {
    return normalizeLang(typeof source === "string" ? source : (source?.lang || "en"));
  }
  _s(source = "en") { return getFishingStrings(this._lang(source)); }
  _fmt(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  }
  _money(n) { return toInt(n, 0).toLocaleString("en-US"); }

  _spotIds() { return Object.keys(this._cfg()?.SPOTS || {}); }
  _spotCfg(spotId) {
    const cfg = (this._cfg()?.SPOTS || {})[String(spotId || "")];
    return cfg && typeof cfg === "object" ? cfg : null;
  }
  _spotTitle(spotId, lang = "en") {
    const l = this._lang(lang);
    const titles = {
      ru: { pond: "Городской пруд", lake: "Загородное озеро", river: "Горная река" },
      uk: { pond: "Міський ставок", lake: "Заміське озеро",   river: "Гірська річка" },
      en: { pond: "City Pond",      lake: "Country Lake",      river: "Mountain River" }
    };
    return (titles[l] || titles.en)[String(spotId)] || String(spotId);
  }

  _minPlayerLevel() { return Math.max(1, toInt(this._cfg()?.MIN_PLAYER_LEVEL, 5)); }
  _openTimeoutMs()  { return Math.max(HOUR_MS, toInt(this._cfg()?.OPEN_TIMEOUT_MS, DAY_MS)); }
  _sessionTtlSec()  { return Math.max(3600, toInt(this._cfg()?.SESSION_TTL_SEC, 7 * 24 * 3600)); }
  _repWindow()      { return Math.max(1, toInt(this._cfg()?.REPUTATION_WINDOW, 10)); }
  _newbieThreshold(){ return Math.max(1, toInt(this._cfg()?.NEWBIE_THRESHOLD, 5)); }
  _partnerHistMax() { return Math.max(1, toInt(this._cfg()?.PARTNER_HISTORY_MAX, 20)); }

  _levels() { return Array.isArray(this._cfg()?.LEVELS) ? this._cfg().LEVELS : []; }

  _fishingLevel(u) {
    const completed = Math.max(0, toInt(u?.fishing?.completedTotal, 0));
    let level = 1;
    for (const entry of this._levels()) {
      if (completed >= toInt(entry.required, 0)) level = toInt(entry.level, level);
    }
    return level;
  }

  _fishingLevelLabel(level, lang = "en") {
    const l = this._lang(lang);
    const entry = this._levels().find((x) => toInt(x.level, 0) === level);
    if (!entry) return String(level);
    const labelObj = entry.label || {};
    const label = typeof labelObj === "string" ? labelObj : (labelObj[l] || labelObj.en || String(level));
    return `${String(entry.emoji || "")} ${label}`.trim();
  }

  _playerLevel(u) { return Math.max(1, toInt(u?.study?.level, 1)); }
  _hasAccess(u)   { return this._playerLevel(u) >= this._minPlayerLevel(); }
  _spotUnlocked(u, spotId) {
    const cfg = this._spotCfg(spotId);
    return !!cfg && this._fishingLevel(u) >= toInt(cfg.levelRequired, 1);
  }

  // ── User state ─────────────────────────────────────────────────────────────

  _ensureUserState(u) {
    if (!u || typeof u !== "object") return;
    if (!u.fishing || typeof u.fishing !== "object") u.fishing = {};
    const f = u.fishing;
    if (typeof f.completedTotal !== "number") f.completedTotal = 0;
    if (!Array.isArray(f.recentOutcomes))      f.recentOutcomes = [];
    if (typeof f.ccStreak !== "number")         f.ccStreak = 0;
    if (typeof f.activeSession !== "string")    f.activeSession = "";
    if (!f.partnerHistory || typeof f.partnerHistory !== "object") f.partnerHistory = {};
  }

  // ── KV helpers ─────────────────────────────────────────────────────────────

  _sessionKey(id)      { return `fishing:session:${String(id)}`; }
  _openIndexKey(spotId){ return `fishing:open:${String(spotId)}`; }
  _activeIndexKey()    { return "fishing:active"; }

  async _loadJson(key, def) {
    try {
      const raw = await this.db.get(key);
      if (raw == null) return def;
      return JSON.parse(String(raw));
    } catch { return def; }
  }

  async _saveJson(key, value, ttlSec = 0) {
    const str = JSON.stringify(value);
    if (ttlSec > 0) {
      await this.db.put(key, str, { expirationTtl: ttlSec });
    } else {
      await this.db.put(key, str);
    }
  }

  async _loadSession(id) {
    const raw = await this._loadJson(this._sessionKey(id), null);
    return raw && typeof raw === "object" ? raw : null;
  }

  async _saveSession(session) {
    await this._saveJson(this._sessionKey(String(session.id)), session, this._sessionTtlSec());
  }

  async _loadIndex(key) {
    const raw = await this._loadJson(key, []);
    return Array.isArray(raw) ? raw.map(String) : [];
  }

  async _addToIndex(key, id) {
    const list = await this._loadIndex(key);
    if (!list.includes(String(id))) {
      list.push(String(id));
      await this._saveJson(key, list);
    }
  }

  async _removeFromIndex(key, id) {
    const list = await this._loadIndex(key);
    const next = list.filter((x) => x !== String(id));
    if (next.length !== list.length) await this._saveJson(key, next);
  }

  // ── Reputation ─────────────────────────────────────────────────────────────

  _reputationInfo(u) {
    const outcomes = Array.isArray(u?.fishing?.recentOutcomes) ? u.fishing.recentOutcomes : [];
    if (outcomes.length < this._newbieThreshold()) return { isNewbie: true, pct: 0, bar: "" };
    const honest = outcomes.filter((x) => x === "C").length;
    const pct = Math.round((honest / outcomes.length) * 100);
    const bar = outcomes.map((x) => x === "C" ? "✅" : "❌").join("");
    return { isNewbie: false, pct, bar };
  }

  _addRecentOutcome(u, myChoice) {
    if (!u?.fishing) return;
    u.fishing.recentOutcomes.push(myChoice === "C" ? "C" : "D");
    if (u.fishing.recentOutcomes.length > this._repWindow()) {
      u.fishing.recentOutcomes = u.fishing.recentOutcomes.slice(-this._repWindow());
    }
  }

  _addPartnerHistory(u, partnerId, me, them) {
    if (!u?.fishing) return;
    const pid = String(partnerId || "");
    if (!pid) return;
    if (!Array.isArray(u.fishing.partnerHistory[pid])) u.fishing.partnerHistory[pid] = [];
    u.fishing.partnerHistory[pid].push({ me: me === "C" ? "C" : "D", them: them === "C" ? "C" : "D" });
    if (u.fishing.partnerHistory[pid].length > this._partnerHistMax()) {
      u.fishing.partnerHistory[pid] = u.fishing.partnerHistory[pid].slice(-this._partnerHistMax());
    }
  }

  _pairHistoryBlock(u, partnerId, s) {
    const pid = String(partnerId || "");
    if (!pid) return "";
    const history = u?.fishing?.partnerHistory?.[pid];
    if (!Array.isArray(history) || history.length === 0) return "";
    const meBar   = history.map((x) => x.me   === "C" ? "✅" : "❌").join("");
    const themBar = history.map((x) => x.them  === "C" ? "✅" : "❌").join("");
    return [
      s.historyTitle,
      this._fmt(s.historyYou,  { bar: meBar }),
      this._fmt(s.historyThem, { bar: themBar })
    ].join("\n");
  }

  // ── Payouts ────────────────────────────────────────────────────────────────

  _calcProfit(spotId, myChoice, theirChoice) {
    const cfg = this._spotCfg(spotId);
    if (!cfg) return 0;
    const p = cfg.payouts || {};
    const me   = myChoice    === "C" ? "C" : "D";
    const them = theirChoice === "C" ? "C" : "D";
    if (me === "C" && them === "C") return toInt(p.CC, 0);
    if (me === "D" && them === "C") return toInt(p.DC_greedy, 0);
    if (me === "C" && them === "D") return toInt(p.DC_honest, 0);
    return toInt(p.DD, 0);
  }

  _outcomeKey(myChoice, theirChoice) {
    return `${myChoice === "C" ? "C" : "D"}${theirChoice === "C" ? "C" : "D"}`;
  }

  // ── Duration ───────────────────────────────────────────────────────────────

  _durationLabel(ms, lang = "en") {
    const l = this._lang(lang);
    const h = Math.floor(ms / HOUR_MS);
    const m = Math.floor((ms % HOUR_MS) / 60000);
    if (l === "ru" || l === "uk") {
      if (h > 0 && m > 0) return `${h}ч ${m}м`;
      if (h > 0) return `${h}ч`;
      return `${m}м`;
    }
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  async _sendInline(chatId, text, keyboard) {
    if (!this.bot || !chatId) return;
    try {
      if (typeof this.bot.sendWithInline === "function") {
        await this.bot.sendWithInline(String(chatId), text, keyboard);
      } else if (typeof this.bot.sendMessage === "function") {
        await this.bot.sendMessage(String(chatId), text);
      }
    } catch {}
  }

  async _notifyMatchFound(creatorUser, session, partnerUser) {
    if (!creatorUser) return;
    const s = this._s(creatorUser);
    const chatId = String(creatorUser?.chatId || "").trim();
    if (!chatId) return;
    const partnerName = shortName(partnerUser?.id, partnerUser?.displayName);
    const rep = this._reputationInfo(partnerUser || {});
    const lines = [
      s.matchFoundTitle,
      "",
      this._fmt(s.fishingWith, { name: partnerName }),
      ""
    ];
    if (rep.isNewbie) {
      lines.push(s.repNewbie);
    } else {
      lines.push(this._fmt(s.repLabel, { pct: rep.pct }));
      lines.push(this._fmt(s.repVisual, { bar: rep.bar }));
    }
    const histBlock = this._pairHistoryBlock(creatorUser, String(partnerUser?.id || ""), s);
    if (histBlock) lines.push("", histBlock);
    const sid = String(session.id || "");
    await this._sendInline(chatId, lines.join("\n"), [[
      { text: s.btnChoiceHonest, callback_data: `fish:choice:${sid}:C` },
      { text: s.btnChoiceGreedy, callback_data: `fish:choice:${sid}:D` }
    ]]);
  }

  async _notifyExpired(user) {
    if (!user) return;
    const s = this._s(user);
    const chatId = String(user?.chatId || "").trim();
    if (!chatId) return;
    await this._sendInline(chatId, s.expiredNotify, [[{ text: s.btnOpenFishing, callback_data: "go:Fishing" }]]);
  }

  async _notifyResult(user, session, myChoice, theirChoice, profit, partnerName) {
    if (!user) return;
    const s = this._s(user);
    const chatId = String(user?.chatId || "").trim();
    if (!chatId) return;
    const outcomeMsg = {
      CC: s.resultCC, DC: s.resultDC, CD: s.resultCD, DD: s.resultDD
    }[this._outcomeKey(myChoice, theirChoice)] || "";
    const lines = [
      s.resultTitle,
      "",
      this._fmt(s.resultPartnerLine, { name: partnerName, choice: theirChoice === "C" ? s.choiceHonest : s.choiceGreedy }),
      this._fmt(s.resultYourLine,    { choice: myChoice  === "C" ? s.choiceHonest : s.choiceGreedy }),
      ""
    ];
    if (profit > 0) {
      lines.push(this._fmt(s.resultProfit, { amount: this._money(profit) }));
    } else {
      lines.push(s.resultZero);
    }
    if (outcomeMsg) lines.push("", outcomeMsg);
    await this._sendInline(chatId, lines.join("\n"), [[{ text: s.btnOpenFishing, callback_data: "go:Fishing" }]]);
  }

  // ── Apply result to user ───────────────────────────────────────────────────

  async _applySessionToUser(user, session, myChoice, theirChoice, partnerId) {
    if (!user || !session) return;
    this._ensureUserState(user);
    const stake  = Math.max(0, toInt(session.stake, 0));
    const profit = this._calcProfit(session.spotId, myChoice, theirChoice);
    user.money = Math.max(0, toInt(user.money, 0)) + stake + profit;
    user.fishing.completedTotal += 1;
    user.fishing.activeSession = "";
    this._addRecentOutcome(user, myChoice);
    this._addPartnerHistory(user, partnerId, myChoice, theirChoice);
    const isCC = myChoice === "C" && theirChoice === "C";
    user.fishing.ccStreak = isCC ? toInt(user.fishing.ccStreak, 0) + 1 : 0;
    markUsefulActivity(user, this.now());

    if (this.achievements?.onEvent) {
      const ctx = { spotId: session.spotId, completed: user.fishing.completedTotal, ccStreak: user.fishing.ccStreak };
      for (const ev of ["fishing_session_completed", ...(isCC ? ["fishing_cc_result"] : [])]) {
        try { await this.achievements.onEvent(user, ev, ctx, { persist: false, notify: true }); } catch {}
      }
    }
    if (this.quests?.onEvent) {
      try { await this.quests.onEvent(user, "fishing_session_completed", { spotId: session.spotId }, { notify: true }); } catch {}
    }

    await this.users.save(user);
  }

  // ── Session lifecycle ──────────────────────────────────────────────────────

  async _resolveSession(session) {
    if (!session || String(session.state || "") !== "active") return false;
    const creatorChoice = session.creatorChoice || "C";
    const partnerChoice = session.partnerChoice || "C";
    const creatorId = String(session.creatorId || "");
    const partnerId = String(session.partnerId || "");

    const [creator, partner] = await Promise.all([
      this.users.load(creatorId).catch(() => null),
      this.users.load(partnerId).catch(() => null)
    ]);
    const creatorName = shortName(creatorId, creator?.displayName);
    const partnerName = shortName(partnerId, partner?.displayName);

    if (creator) {
      await this._applySessionToUser(creator, session, creatorChoice, partnerChoice, partnerId);
      await this._notifyResult(creator, session, creatorChoice, partnerChoice, this._calcProfit(session.spotId, creatorChoice, partnerChoice), partnerName);
    }
    if (partner) {
      await this._applySessionToUser(partner, session, partnerChoice, creatorChoice, creatorId);
      await this._notifyResult(partner, session, partnerChoice, creatorChoice, this._calcProfit(session.spotId, partnerChoice, creatorChoice), creatorName);
    }

    session.state = "finished";
    session.finishedAt = this.now();
    session.result = {
      creatorChoice,
      partnerChoice,
      creatorProfit: this._calcProfit(session.spotId, creatorChoice, partnerChoice),
      partnerProfit: this._calcProfit(session.spotId, partnerChoice, creatorChoice)
    };
    await this._saveSession(session);
    await this._removeFromIndex(this._activeIndexKey(), String(session.id));
    return true;
  }

  async _expireOpenSession(session) {
    if (!session || String(session.state || "") !== "open") return false;
    const creator = await this.users.load(String(session.creatorId || "")).catch(() => null);
    if (creator) {
      this._ensureUserState(creator);
      creator.money = Math.max(0, toInt(creator.money, 0)) + Math.max(0, toInt(session.stake, 0));
      creator.fishing.activeSession = "";
      await this.users.save(creator);
      await this._notifyExpired(creator);
    }
    session.state = "expired";
    session.finishedAt = this.now();
    await this._saveSession(session);
    await this._removeFromIndex(this._openIndexKey(session.spotId), String(session.id));
    return true;
  }

  // ── Cron tick ──────────────────────────────────────────────────────────────

  async runTick() {
    let expired = 0;
    let resolved = 0;
    const nowTs = this.now();

    for (const spotId of this._spotIds()) {
      const openIds = await this._loadIndex(this._openIndexKey(spotId));
      for (const id of openIds) {
        const session = await this._loadSession(id);
        if (!session) { await this._removeFromIndex(this._openIndexKey(spotId), id); continue; }
        if (String(session.state || "") !== "open") { await this._removeFromIndex(this._openIndexKey(spotId), id); continue; }
        if (toInt(session.expiresAt, 0) > nowTs) continue;
        if (await this._expireOpenSession(session)) expired += 1;
      }
    }

    const activeIds = await this._loadIndex(this._activeIndexKey());
    for (const id of activeIds) {
      const session = await this._loadSession(id);
      if (!session) { await this._removeFromIndex(this._activeIndexKey(), id); continue; }
      if (String(session.state || "") !== "active") { await this._removeFromIndex(this._activeIndexKey(), id); continue; }
      if (toInt(session.endAt, 0) > nowTs) continue;
      if (await this._resolveSession(session)) resolved += 1;
    }

    return { expired, resolved };
  }

  // ── Public actions ─────────────────────────────────────────────────────────

  async createSession(u, spotIdRaw) {
    this._ensureUserState(u);
    const s = this._s(u);
    if (!this._hasAccess(u)) {
      return { ok: false, error: this._fmt(s.locked, { need: this._minPlayerLevel(), have: this._playerLevel(u) }) };
    }
    const spotId = String(spotIdRaw || "").trim();
    const spotCfg = this._spotCfg(spotId);
    if (!spotCfg) return { ok: false, error: s.errNotFound };
    if (!this._spotUnlocked(u, spotId)) return { ok: false, error: s.errSpotLocked };
    if (u.fishing.activeSession) return { ok: false, error: s.errAlreadyActive };
    const stake = toInt(spotCfg.stake, 0);
    if (toInt(u.money, 0) < stake) return { ok: false, error: this._fmt(s.errNoMoney, { need: this._money(stake) }) };

    u.money = Math.max(0, toInt(u.money, 0)) - stake;
    const nowTs = this.now();
    const id = makeSessionId(nowTs);
    const session = {
      id,
      spotId,
      stake,
      state: "open",
      creatorId: String(u.id || ""),
      partnerId: "",
      creatorChoice: null,
      partnerChoice: null,
      createdAt: nowTs,
      expiresAt: nowTs + this._openTimeoutMs(),
      startedAt: null,
      endAt: null,
      finishedAt: null,
      result: null
    };
    u.fishing.activeSession = id;
    await this.users.save(u);
    await this._saveSession(session);
    await this._addToIndex(this._openIndexKey(spotId), id);
    return { ok: true, toast: s.toastCreated, sessionId: id };
  }

  async joinSession(u, sessionIdRaw) {
    this._ensureUserState(u);
    const s = this._s(u);
    if (!this._hasAccess(u)) {
      return { ok: false, error: this._fmt(s.locked, { need: this._minPlayerLevel(), have: this._playerLevel(u) }) };
    }
    const sessionId = String(sessionIdRaw || "").trim();
    const session = await this._loadSession(sessionId);
    if (!session) return { ok: false, error: s.errNotFound };
    if (String(session.state || "") !== "open") return { ok: false, error: s.errSessionNotActive };
    if (String(session.creatorId || "") === String(u.id || "")) return { ok: false, error: s.errCantJoinOwn };
    if (!this._spotUnlocked(u, session.spotId)) return { ok: false, error: s.errSpotLocked };
    if (u.fishing.activeSession) return { ok: false, error: s.errAlreadyActive };
    const stake = toInt(session.stake, 0);
    if (toInt(u.money, 0) < stake) return { ok: false, error: this._fmt(s.errNoMoney, { need: this._money(stake) }) };

    u.money = Math.max(0, toInt(u.money, 0)) - stake;
    const nowTs = this.now();
    const durationMs = Math.max(HOUR_MS, toInt(this._spotCfg(session.spotId)?.durationMs, HOUR_MS));
    session.state = "active";
    session.partnerId = String(u.id || "");
    session.startedAt = nowTs;
    session.endAt = nowTs + durationMs;
    u.fishing.activeSession = String(session.id);

    await this.users.save(u);
    await this._saveSession(session);
    await this._removeFromIndex(this._openIndexKey(session.spotId), String(session.id));
    await this._addToIndex(this._activeIndexKey(), String(session.id));

    const creator = await this.users.load(String(session.creatorId || "")).catch(() => null);
    if (creator) await this._notifyMatchFound(creator, session, u);

    return { ok: true, toast: s.toastJoined, session };
  }

  async joinFirstOpenSession(u, spotIdRaw) {
    const spotId = String(spotIdRaw || "").trim();
    const openIds = await this._loadIndex(this._openIndexKey(spotId));
    const uid = String(u.id || "");
    for (const id of openIds) {
      const session = await this._loadSession(id);
      if (!session || session.state !== "open") continue;
      if (String(session.creatorId || "") === uid) continue;
      return this.joinSession(u, id);
    }
    return { ok: false, error: this._s(u).errNotFound };
  }

  async submitChoice(u, sessionIdRaw, choiceRaw) {
    this._ensureUserState(u);
    const s = this._s(u);
    const sessionId = String(sessionIdRaw || "").trim();
    const choice = String(choiceRaw || "").toUpperCase() === "D" ? "D" : "C";
    const session = await this._loadSession(sessionId);
    if (!session) return { ok: false, error: s.errNotFound };
    if (String(session.state || "") !== "active") return { ok: false, error: s.errSessionNotActive };
    const uid = String(u.id || "");
    const isCreator = String(session.creatorId || "") === uid;
    const isPartner = String(session.partnerId  || "") === uid;
    if (!isCreator && !isPartner) return { ok: false, error: s.errNotParticipant };
    if (isCreator && session.creatorChoice !== null) return { ok: false, error: s.errAlreadyChosen };
    if (isPartner && session.partnerChoice !== null) return { ok: false, error: s.errAlreadyChosen };
    if (isCreator) session.creatorChoice = choice;
    else session.partnerChoice = choice;
    await this._saveSession(session);
    return { ok: true, toast: s.toastChosen };
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  async buildMainView(u) {
    this._ensureUserState(u);
    const s = this._s(u);
    const lang = this._lang(u);

    if (!this._hasAccess(u)) {
      return {
        caption: [s.title, "", this._fmt(s.locked, { need: this._minPlayerLevel(), have: this._playerLevel(u) })].join("\n"),
        keyboard: [[{ text: s.btnBack, callback_data: "go:Earn" }]]
      };
    }

    const level = this._fishingLevel(u);
    const completed = Math.max(0, toInt(u.fishing.completedTotal, 0));
    const lines = [
      s.title,
      s.subtitle,
      "",
      this._fmt(s.fisherLevel, { label: this._fishingLevelLabel(level, lang), completed })
    ];

    const activeId = String(u.fishing.activeSession || "");
    if (activeId) {
      const session = await this._loadSession(activeId);
      if (session && (session.state === "open" || session.state === "active")) {
        const nowTs  = this.now();
        const leftMs = session.state === "open"
          ? Math.max(0, toInt(session.expiresAt, 0) - nowTs)
          : Math.max(0, toInt(session.endAt, 0) - nowTs);
        lines.push("", this._fmt(s.activeSession, {
          spot: this._spotTitle(session.spotId, lang),
          left: this._durationLabel(leftMs, lang)
        }));
      } else {
        u.fishing.activeSession = "";
        await this.users.save(u);
        lines.push("", s.noActiveSession);
      }
    } else {
      lines.push("", s.noActiveSession);
    }

    const kb = [];
    for (const spotId of this._spotIds()) {
      const cfg = this._spotCfg(spotId);
      if (!cfg) continue;
      const unlocked = this._spotUnlocked(u, spotId);
      const title = this._spotTitle(spotId, lang);
      const label = unlocked ? `${cfg.emoji} ${title}` : `🔒 ${title}`;
      kb.push([{ text: label, callback_data: `fish:spot:${spotId}` }]);
    }
    kb.push([{ text: s.btnBack, callback_data: "go:Earn" }]);
    return { caption: lines.join("\n"), keyboard: kb };
  }

  async buildSpotView(u, spotIdRaw) {
    this._ensureUserState(u);
    const s = this._s(u);
    const lang = this._lang(u);
    const spotId = String(spotIdRaw || "").trim();
    const cfg = this._spotCfg(spotId);
    if (!cfg) {
      return { caption: s.errNotFound, keyboard: [[{ text: s.btnBackMain, callback_data: "fish:main" }]] };
    }

    const title = `${cfg.emoji} ${this._spotTitle(spotId, lang)}`;
    const unlocked = this._spotUnlocked(u, spotId);
    const lines = [title, ""];

    if (!unlocked) {
      lines.push(this._fmt(s.spotLocked, { need: toInt(cfg.levelRequired, 1) }));
      return { caption: lines.join("\n"), keyboard: [[{ text: s.btnBackMain, callback_data: "fish:main" }]] };
    }

    const p = cfg.payouts || {};
    lines.push(this._fmt(s.spotStake,    { stake:    this._money(cfg.stake) }));
    lines.push(this._fmt(s.spotDuration, { duration: this._durationLabel(toInt(cfg.durationMs, 0), lang) }));
    lines.push("");
    lines.push(`CC: +$${this._money(p.CC)}  |  DC: +$${this._money(p.DC_greedy)}  |  DD: $0`);

    const openIds = await this._loadIndex(this._openIndexKey(spotId));
    const openCount = openIds.length;
    lines.push("", this._fmt(s.spotOpenCount, { count: openCount }));

    const kb = [];
    const hasActive = !!String(u.fishing.activeSession || "");
    if (!hasActive) {
      kb.push([{ text: s.btnCreate, callback_data: `fish:create:${spotId}` }]);
      if (openCount > 0) {
        kb.push([{ text: s.btnJoin, callback_data: `fish:joinspot:${spotId}` }]);
      }
    }
    kb.push([{ text: s.btnBackMain, callback_data: "fish:main" }]);
    return { caption: lines.join("\n"), keyboard: kb };
  }

  // For choice screen: partner info block (called from handler after joinSession)
  buildChoiceBlock(u, session, partnerUser) {
    const s = this._s(u);
    const partnerName = shortName(partnerUser?.id, partnerUser?.displayName);
    const rep = this._reputationInfo(partnerUser || {});
    const lines = [
      this._fmt(s.fishingWith, { name: partnerName }),
      ""
    ];
    if (rep.isNewbie) {
      lines.push(s.repNewbie);
    } else {
      lines.push(this._fmt(s.repLabel, { pct: rep.pct }));
      lines.push(this._fmt(s.repVisual, { bar: rep.bar }));
    }
    const histBlock = this._pairHistoryBlock(u, String(partnerUser?.id || ""), s);
    if (histBlock) lines.push("", histBlock);
    return lines.join("\n");
  }

  // Expose for tests
  async _loadDeal(id) { return this._loadSession(id); }
}
