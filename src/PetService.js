import { CONFIG } from "./GameConfig.js";
import { normalizeLang } from "./i18n/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toInt(raw, fallback = 0) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function dayStr(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDay(day) {
  const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function diffDays(fromDay, toDay) {
  const a = parseDay(fromDay);
  const b = parseDay(toDay);
  if (!a || !b) return 0;
  return Math.max(0, Math.floor((b - a) / DAY_MS));
}

export class PetService {
  constructor({ db, users, now, bot = null, quests = null, achievements = null }) {
    this.db = db || users?.db || null;
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.quests = quests || null;
    this.achievements = achievements || null;
  }

  _cfg() {
    return CONFIG?.PET || {};
  }

  _notifyCfg() {
    return this._cfg().NOTIFY || {};
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _s(source) {
    const lang = this._lang(source);
    if (lang === "en") {
      return {
        titleNoPet: "🐾 Pet",
        noPet: "You don't have a pet yet.\nA pet brings 💎 every day if you feed it.",
        buyCat: "🐱 Buy cat",
        buyDog: "🐶 Buy dog",
        deadPrefix: "💀",
        healthy: "😊 Healthy and happy",
        healthyFed: "😊 Healthy and full",
        hungry: "😟 Hungry",
        sick: "🤒 Sick",
        dead: "💀 Dead",
        streak: "🔥 Streak",
        lastFeed: "Last feed",
        notFedYet: "not fed yet",
        todayReward: "💎 Today reward",
        todayGot: "💎 Received today",
        feedBtn: "🍖 Feed",
        healBtn: "💊 Heal",
        backBtn: "⬅️ Back",
        fedToday: "✅ Already fed today",
        hungryWarn: "⚠️ {{days}} day(s) without food left before sickness",
        sickHint: "Pet gives no 💎 while sick. Heal first, then feed.",
        deadHint: "You can adopt a new pet.",
        askName: "How will you name your {{type}}?\n\nSend a name (2-12 chars).",
        askNameAgain: "Send pet name (2-12 chars, letters/digits/spaces only).",
        confirmName: "Confirm pet:\n{{typeEmoji}} {{name}}\nPrice: ${{price}}",
        confirmBtn: "✅ Confirm",
        cancelBtn: "⬅️ Cancel",
        errNoMoney: "Not enough money.",
        errNoGems: "Not enough gems.",
        errNoPet: "You have no pet yet.",
        errAlreadyFed: "Already fed today.",
        errNeedHeal: "Pet is sick. Heal first.",
        errDead: "This pet is dead. Adopt a new one.",
        errName: "Name must be 2-12 chars, letters/digits/spaces only.",
        buyOk: "🎉 {{name}} is now with you.",
        feedOk: "🍖 {{name}} is fed. +💎{{gems}}",
        healOk: "💊 {{name}} was healed. Feed it today to start streak again.",
        typeCat: "cat",
        typeDog: "dog",
        notifyReminder: "🐾 {{name}} is waiting for food today.",
        notifyHungry: "😟 {{name}} is hungry — feed soon.",
        notifySick: "🤒 {{name}} is sick — heal urgently.",
        notifyCritical: "💀 {{name}} is very sick. 1 day left!",
        notifyDead: "💔 {{name}} died... You can adopt a new pet.",
        toPetBtn: "🐾 Open pet"
      };
    }
    if (lang === "uk") {
      return {
        titleNoPet: "🐾 Улюбленець",
        noPet: "У тебе поки немає улюбленця.\nВін приносить 💎 щодня, якщо його годувати.",
        buyCat: "🐱 Купити кішку",
        buyDog: "🐶 Купити собаку",
        deadPrefix: "💀",
        healthy: "😊 Здоровий і задоволений",
        healthyFed: "😊 Здоровий і ситий",
        hungry: "😟 Голодний",
        sick: "🤒 Хворий",
        dead: "💀 Мертвий",
        streak: "🔥 Серія",
        lastFeed: "Останнє годування",
        notFedYet: "ще не годували",
        todayReward: "💎 Сьогодні принесе",
        todayGot: "💎 Отримано сьогодні",
        feedBtn: "🍖 Годувати",
        healBtn: "💊 Лікувати",
        backBtn: "⬅️ Назад",
        fedToday: "✅ Уже нагодований сьогодні",
        hungryWarn: "⚠️ Ще {{days}} дн. без їжі — захворіє",
        sickHint: "Поки хворіє — 💎 не приносить. Спочатку лікування, потім годування.",
        deadHint: "Можеш завести нового улюбленця.",
        askName: "Як назвеш свого {{type}}?\n\nНадішли ім'я (2-12 символів).",
        askNameAgain: "Надішли ім'я улюбленця (2-12 символів, лише літери/цифри/пробіл).",
        confirmName: "Підтверди улюбленця:\n{{typeEmoji}} {{name}}\nЦіна: ${{price}}",
        confirmBtn: "✅ Підтвердити",
        cancelBtn: "⬅️ Скасувати",
        errNoMoney: "Недостатньо грошей.",
        errNoGems: "Недостатньо кристалів.",
        errNoPet: "У тебе ще немає улюбленця.",
        errAlreadyFed: "Уже нагодований сьогодні.",
        errNeedHeal: "Улюбленець хворий. Спочатку лікування.",
        errDead: "Цей улюбленець помер. Заведи нового.",
        errName: "Ім'я: 2-12 символів, лише літери/цифри/пробіл.",
        buyOk: "🎉 {{name}} тепер з тобою.",
        feedOk: "🍖 {{name}} нагодований. +💎{{gems}}",
        healOk: "💊 {{name}} вилікуваний. Погодуй сьогодні, щоб почати серію заново.",
        typeCat: "кішку",
        typeDog: "собаку",
        notifyReminder: "🐾 {{name}} чекає на їжу сьогодні.",
        notifyHungry: "😟 {{name}} голодує — нагодуй швидше.",
        notifySick: "🤒 {{name}} захворів — терміново лікуй.",
        notifyCritical: "💀 {{name}} дуже погано. Лишився 1 день!",
        notifyDead: "💔 {{name}} помер... Можеш завести нового улюбленця.",
        toPetBtn: "🐾 До улюбленця"
      };
    }
    return {
      titleNoPet: "🐾 Питомец",
      noPet: "У тебя пока нет питомца.\nПитомец приносит 💎 каждый день, если его кормить.",
      buyCat: "🐱 Купить кошку",
      buyDog: "🐶 Купить собаку",
      deadPrefix: "💀",
      healthy: "😊 Здоров и доволен",
      healthyFed: "😊 Здоров и сыт",
      hungry: "😟 Голоден",
      sick: "🤒 Болеет",
      dead: "💀 Мёртв",
      streak: "🔥 Стрик",
      lastFeed: "Последнее кормление",
      notFedYet: "ещё не кормили",
      todayReward: "💎 Сегодня принесёт",
      todayGot: "💎 Получено сегодня",
      feedBtn: "🍖 Покормить",
      healBtn: "💊 Вылечить",
      backBtn: "⬅️ Назад",
      fedToday: "✅ Уже покормлен сегодня",
      hungryWarn: "⚠️ Ещё {{days}} дн. без еды — заболеет",
      sickHint: "Питомец не приносит 💎 пока болеет. Сначала лечение, потом кормление.",
      deadHint: "Ты можешь завести нового питомца.",
      askName: "Как назовёшь своего {{type}}?\n\nОтправь имя (2-12 символов).",
      askNameAgain: "Отправь имя питомца (2-12 символов, только буквы/цифры/пробел).",
      confirmName: "Подтверди питомца:\n{{typeEmoji}} {{name}}\nЦена: ${{price}}",
      confirmBtn: "✅ Подтвердить",
      cancelBtn: "⬅️ Отмена",
      errNoMoney: "Недостаточно денег.",
      errNoGems: "Недостаточно кристаллов.",
      errNoPet: "У тебя пока нет питомца.",
      errAlreadyFed: "Уже покормлен сегодня.",
      errNeedHeal: "Питомец болеет. Сначала лечение.",
      errDead: "Этот питомец умер. Заведи нового.",
      errName: "Имя: 2-12 символов, только буквы/цифры/пробел.",
      buyOk: "🎉 {{name}} теперь с тобой.",
      feedOk: "🍖 {{name}} накормлен. +💎{{gems}}",
      healOk: "💊 {{name}} вылечен. Покорми сегодня, чтобы начать стрик заново.",
      typeCat: "кошку",
      typeDog: "собаку",
      notifyReminder: "🐾 {{name}} ждёт еды сегодня.",
      notifyHungry: "😟 {{name}} голодает — покорми скорее.",
      notifySick: "🤒 {{name}} заболел — срочно нужно лечение.",
      notifyCritical: "💀 {{name}} очень плохо! Остался 1 день.",
      notifyDead: "💔 {{name}} умер... Ты можешь завести нового питомца.",
      toPetBtn: "🐾 К питомцу"
    };
  }

  _fmt(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  }

  _petTypeEmoji(type) {
    return String(type) === "dog" ? "🐶" : "🐱";
  }

  _petTypeName(u, type) {
    const s = this._s(u);
    return String(type) === "dog" ? s.typeDog : s.typeCat;
  }

  _isAliveStatus(status) {
    const s = String(status || "");
    return s === "healthy" || s === "hungry" || s === "sick";
  }

  _price(type) {
    const p = this._cfg().PRICES || {};
    return Math.max(0, toInt(p[String(type || "")], 0));
  }

  _rewardGems(streak) {
    const tiers = Array.isArray(this._cfg().REWARD_TIERS) ? this._cfg().REWARD_TIERS : [];
    const n = Math.max(0, toInt(streak, 0));
    for (const t of tiers) {
      const from = Math.max(0, toInt(t?.from, 0));
      const to = Math.max(from, toInt(t?.to, from));
      if (n >= from && n <= to) return Math.max(0, toInt(t?.gems, 0));
    }
    return 0;
  }

  _today() {
    return dayStr(this.now());
  }

  _fedRefDay(pet) {
    const lastFed = String(pet?.lastFedDay || "");
    if (lastFed) return lastFed;
    return dayStr(Math.max(0, Number(pet?.boughtAt) || this.now()));
  }

  _missedDays(pet, today = this._today()) {
    const ref = this._fedRefDay(pet);
    return diffDays(ref, today);
  }

  _nextUtc(hour, minute = 0, dayOffset = 0) {
    const now = new Date(this.now());
    const ts = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + dayOffset,
      hour,
      minute,
      0,
      0
    );
    return ts;
  }

  _dueBucket(ts) {
    const bucketMs = Math.max(60_000, toInt(this._notifyCfg().DUE_BUCKET_MS, 5 * 60_000));
    return Math.floor((Number(ts) || 0) / bucketMs);
  }

  _dueKey(bucket, userId) {
    return `pet:due:${bucket}:${String(userId || "")}`;
  }

  async _markDue(userId, dueTs) {
    if (!this.db || typeof this.db.put !== "function") return;
    const id = String(userId || "").trim();
    const ts = Number(dueTs) || 0;
    if (!id || ts <= 0) return;
    const bucket = this._dueBucket(ts);
    const ttlSec = Math.max(60, Math.ceil((ts - this.now()) / 1000) + 3 * 24 * 60 * 60);
    await this.db.put(this._dueKey(bucket, id), "1", { expirationTtl: ttlSec });
  }

  _parseDueUserId(key) {
    const parts = String(key || "").split(":");
    if (parts.length < 4) return "";
    return String(parts[3] || "").trim();
  }

  async _collectDueUserIds(nowTs = this.now()) {
    if (!this.db || typeof this.db.list !== "function") return [];
    const bucketMs = Math.max(60_000, toInt(this._notifyCfg().DUE_BUCKET_MS, 5 * 60_000));
    const lookbackMinutes = Math.max(0, toInt(this._notifyCfg().DUE_LOOKBACK_MINUTES, 30));
    const lookbackBuckets = Math.max(0, Math.ceil((lookbackMinutes * 60_000) / bucketMs));
    const endBucket = this._dueBucket(nowTs);
    const startBucket = endBucket - lookbackBuckets;
    const ids = new Set();

    for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
      const prefix = `pet:due:${bucket}:`;
      let cursor = undefined;
      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;
        for (const k of page?.keys || []) {
          const id = this._parseDueUserId(k?.name);
          if (id) ids.add(id);
        }
      } while (cursor);
    }
    return [...ids];
  }

  _normalizePet(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;
    if (!u.pet || typeof u.pet !== "object") return false;
    const p = u.pet;
    const type = String(p.type || "cat");
    if (type !== "cat" && type !== "dog") {
      p.type = "cat";
      dirty = true;
    }
    if (typeof p.name !== "string") { p.name = ""; dirty = true; }
    if (!["healthy", "hungry", "sick", "dead"].includes(String(p.status || ""))) {
      p.status = "healthy";
      dirty = true;
    }
    if (typeof p.streak !== "number" || !Number.isFinite(p.streak)) { p.streak = 0; dirty = true; }
    p.streak = Math.max(0, toInt(p.streak, 0));
    if (typeof p.lastFedDay !== "string") { p.lastFedDay = ""; dirty = true; }
    if (typeof p.sickSince !== "string") { p.sickSince = ""; dirty = true; }
    if (typeof p.boughtAt !== "number" || !Number.isFinite(p.boughtAt)) { p.boughtAt = this.now(); dirty = true; }
    if (typeof p.notifyDay !== "string") { p.notifyDay = ""; dirty = true; }
    if (typeof p.notifyPriority !== "number" || !Number.isFinite(p.notifyPriority)) { p.notifyPriority = 0; dirty = true; }
    p.notifyPriority = Math.max(0, toInt(p.notifyPriority, 0));
    return dirty;
  }

  _ensureDraft(u) {
    let dirty = false;
    if (typeof u.awaitingPetName !== "boolean") {
      u.awaitingPetName = false;
      dirty = true;
    }
    if (!u.petDraft || typeof u.petDraft !== "object") {
      u.petDraft = { type: "", name: "" };
      dirty = true;
    } else {
      if (typeof u.petDraft.type !== "string") { u.petDraft.type = ""; dirty = true; }
      if (typeof u.petDraft.name !== "string") { u.petDraft.name = ""; dirty = true; }
    }
    return dirty;
  }

  _validateName(raw) {
    const minLen = Math.max(1, toInt(this._cfg().NAME_MIN, 2));
    const maxLen = Math.max(minLen, toInt(this._cfg().NAME_MAX, 12));
    const value = String(raw || "").trim().replace(/\s+/g, " ");
    if (value.length < minLen || value.length > maxLen) {
      return { ok: false };
    }
    const re = /^[\p{L}\p{N} ]+$/u;
    if (!re.test(value)) return { ok: false };
    return { ok: true, value };
  }

  async _syncState(u, { persist = false } = {}) {
    if (!u?.pet || typeof u.pet !== "object") return { changed: false };
    let changed = this._normalizePet(u);
    const p = u.pet;
    const today = this._today();
    const prevStatus = String(p.status || "healthy");
    if (prevStatus === "dead") return { changed };

    const hungryAfter = Math.max(1, toInt(this._cfg().HUNGRY_AFTER_DAYS, 1));
    const sickAfter = Math.max(hungryAfter + 1, toInt(this._cfg().SICK_AFTER_DAYS, 3));
    const deadAfter = Math.max(sickAfter + 1, toInt(this._cfg().DEAD_AFTER_DAYS, 5));
    const missed = this._missedDays(p, today);

    let nextStatus = prevStatus;
    if (missed >= deadAfter) {
      nextStatus = "dead";
    } else if (missed >= sickAfter) {
      nextStatus = "sick";
    } else if (missed >= hungryAfter) {
      nextStatus = "hungry";
    } else if (missed === 0) {
      nextStatus = prevStatus === "hungry" ? "hungry" : "healthy";
    }

    if (nextStatus !== prevStatus) {
      p.status = nextStatus;
      changed = true;
    }

    if (nextStatus === "hungry" && prevStatus !== "hungry" && missed >= hungryAfter && p.streak !== 0) {
      p.streak = 0;
      changed = true;
    }

    if (nextStatus === "sick") {
      if (!p.sickSince) {
        p.sickSince = dayStr(parseDay(this._fedRefDay(p)) + sickAfter * DAY_MS);
        changed = true;
      }
    } else if (p.sickSince) {
      p.sickSince = "";
      changed = true;
    }

    if (nextStatus === "dead" && p.streak !== 0) {
      p.streak = 0;
      changed = true;
    }

    if (changed && persist) {
      await this.users.save(u);
    }
    return { changed, missed, status: nextStatus, today };
  }

  _isAlivePet(u) {
    const st = String(u?.pet?.status || "");
    return this._isAliveStatus(st);
  }

  _nextDueTs(u) {
    if (!this._isAlivePet(u)) return 0;
    const reminderHour = Math.max(0, Math.min(23, toInt(this._notifyCfg().REMINDER_HOUR_UTC, 18)));
    const statusHour = Math.max(0, Math.min(23, toInt(this._notifyCfg().STATUS_HOUR_UTC, 10)));
    const p = u.pet;
    const nowTs = this.now();
    const today = this._today();
    const missed = this._missedDays(p, today);
    const fedToday = String(p.lastFedDay || "") === today;

    if (missed >= 1) {
      const todayStatusTs = this._nextUtc(statusHour, 0, 0);
      return nowTs < todayStatusTs ? todayStatusTs : this._nextUtc(statusHour, 0, 1);
    }

    if (fedToday) {
      return this._nextUtc(reminderHour, 0, 1);
    }

    const todayReminderTs = this._nextUtc(reminderHour, 0, 0);
    if (nowTs < todayReminderTs) return todayReminderTs;
    return this._nextUtc(statusHour, 0, 1);
  }

  async _scheduleNextDue(u) {
    const ts = this._nextDueTs(u);
    if (ts > 0) {
      await this._markDue(u.id, ts);
    }
  }

  _notifyEvent(u) {
    if (!u?.pet || !this._isAlivePet(u) && String(u?.pet?.status || "") !== "dead") return null;
    const nowTs = this.now();
    const today = this._today();
    const nowHour = new Date(nowTs).getUTCHours();
    const reminderHour = Math.max(0, Math.min(23, toInt(this._notifyCfg().REMINDER_HOUR_UTC, 18)));
    const p = u.pet;
    const missed = this._missedDays(p, today);

    if (String(p.status || "") === "dead") {
      return { key: "dead", priority: 5 };
    }
    if (missed >= 4) return { key: "critical", priority: 4 };
    if (missed >= 3) return { key: "sick", priority: 3 };
    if (missed >= 1) return { key: "hungry", priority: 2 };

    const fedToday = String(p.lastFedDay || "") === today;
    if (!fedToday && nowHour >= reminderHour) {
      return { key: "reminder", priority: 1 };
    }
    return null;
  }

  _notifyText(u, key) {
    const s = this._s(u);
    const name = String(u?.pet?.name || "");
    switch (String(key || "")) {
      case "reminder":
        return this._fmt(s.notifyReminder, { name });
      case "hungry":
        return this._fmt(s.notifyHungry, { name });
      case "sick":
        return this._fmt(s.notifySick, { name });
      case "critical":
        return this._fmt(s.notifyCritical, { name });
      case "dead":
        return this._fmt(s.notifyDead, { name });
      default:
        return "";
    }
  }

  async _notifyIfNeeded(u) {
    if (!this.bot || !u?.chatId || !u?.pet) return { sent: false };
    const ev = this._notifyEvent(u);
    if (!ev) return { sent: false };
    const today = this._today();
    const prevDay = String(u.pet.notifyDay || "");
    const prevPriority = Math.max(0, toInt(u.pet.notifyPriority, 0));
    if (prevDay === today && prevPriority >= ev.priority) {
      return { sent: false };
    }

    const text = this._notifyText(u, ev.key);
    if (!text) return { sent: false };

    try {
      await this.bot.sendWithInline(
        u.chatId,
        text,
        [[{ text: this._s(u).toPetBtn, callback_data: "go:Pet" }]]
      );
      u.pet.notifyDay = today;
      u.pet.notifyPriority = ev.priority;
      return { sent: true };
    } catch {
      return { sent: false };
    }
  }

  async dailyTick() {
    const ids = await this._collectDueUserIds(this.now());
    const max = Math.max(1, toInt(this._notifyCfg().MAX_PROCESS_PER_RUN, 500));
    let processed = 0;
    for (const id of ids) {
      if (processed >= max) break;
      const u = await this.users.load(id).catch(() => null);
      if (!u || !u.pet) continue;
      processed += 1;
      let changed = false;
      const state = await this._syncState(u, { persist: false });
      changed = changed || !!state.changed;
      const notifyRes = await this._notifyIfNeeded(u);
      changed = changed || !!notifyRes.sent;
      await this._scheduleNextDue(u);
      if (changed) {
        await this.users.save(u);
      }
    }
    return { processed };
  }

  async startBuy(u, type) {
    this._ensureDraft(u);
    await this._syncState(u, { persist: false });
    if (this._isAlivePet(u)) {
      const lang = this._lang(u);
      return {
        ok: false,
        error: lang === "en"
          ? "You already have a living pet."
          : (lang === "uk" ? "У тебе вже є живий улюбленець." : "У тебя уже есть живой питомец.")
      };
    }
    const t = String(type || "");
    if (t !== "cat" && t !== "dog") {
      return { ok: false, error: this._lang(u) === "en" ? "Invalid pet type." : "Некорректный тип питомца." };
    }
    u.petDraft.type = t;
    u.petDraft.name = "";
    u.awaitingPetName = true;
    await this.users.save(u);
    return { ok: true };
  }

  async cancelDraft(u) {
    this._ensureDraft(u);
    u.awaitingPetName = false;
    u.petDraft.type = "";
    u.petDraft.name = "";
    await this.users.save(u);
    return { ok: true };
  }

  async setDraftName(u, rawName) {
    this._ensureDraft(u);
    const check = this._validateName(rawName);
    if (!check.ok) return { ok: false, error: this._s(u).errName };
    if (!u.petDraft.type) {
      const lang = this._lang(u);
      return {
        ok: false,
        error: lang === "en" ? "Choose pet type first." : (lang === "uk" ? "Спочатку обери тип улюбленця." : "Сначала выбери тип питомца.")
      };
    }
    u.petDraft.name = check.value;
    u.awaitingPetName = false;
    await this.users.save(u);
    return { ok: true, name: check.value };
  }

  async confirmBuy(u) {
    this._ensureDraft(u);
    await this._syncState(u, { persist: false });
    if (this._isAlivePet(u)) {
      const lang = this._lang(u);
      return {
        ok: false,
        error: lang === "en"
          ? "You already have a living pet."
          : (lang === "uk" ? "У тебе вже є живий улюбленець." : "У тебя уже есть живой питомец.")
      };
    }
    const type = String(u?.petDraft?.type || "");
    const name = String(u?.petDraft?.name || "").trim();
    if (!type || !name) {
      const lang = this._lang(u);
      return {
        ok: false,
        error: lang === "en"
          ? "Choose pet type and name first."
          : (lang === "uk" ? "Спочатку обери тип і ім'я улюбленця." : "Сначала выбери тип и имя питомца.")
      };
    }
    const check = this._validateName(name);
    if (!check.ok) return { ok: false, error: this._s(u).errName };
    const price = this._price(type);
    if (Math.max(0, toInt(u.money, 0)) < price) {
      return { ok: false, error: this._s(u).errNoMoney };
    }

    u.money = Math.max(0, toInt(u.money, 0)) - price;
    u.pet = {
      type,
      name: check.value,
      status: "healthy",
      streak: 0,
      lastFedDay: "",
      sickSince: "",
      boughtAt: this.now(),
      notifyDay: "",
      notifyPriority: 0
    };
    u.awaitingPetName = false;
    u.petDraft = { type: "", name: "" };

    let achRes = null;
    if (this.achievements?.onEvent) {
      achRes = await this.achievements.onEvent(u, "pet_buy", {}, { persist: false, notify: false }).catch(() => null);
    }

    await this._scheduleNextDue(u);
    await this.users.save(u);
    if (achRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, achRes.newlyEarned);
    }

    return { ok: true, pet: u.pet, price };
  }

  async feed(u) {
    await this._syncState(u, { persist: false });
    if (!u?.pet) return { ok: false, error: this._s(u).errNoPet };
    const p = u.pet;
    const s = this._s(u);
    const today = this._today();
    if (String(p.status || "") === "dead") return { ok: false, error: s.errDead };
    if (String(p.status || "") === "sick") return { ok: false, error: s.errNeedHeal };
    if (String(p.lastFedDay || "") === today && String(p.status || "") === "healthy") {
      return { ok: false, error: s.errAlreadyFed };
    }

    const prevStatus = String(p.status || "");
    const wasConsecutive = prevStatus === "healthy" && diffDays(String(p.lastFedDay || ""), today) === 1;
    p.streak = wasConsecutive ? Math.max(0, toInt(p.streak, 0)) + 1 : 1;
    p.lastFedDay = today;
    p.status = "healthy";
    p.sickSince = "";

    const gems = this._rewardGems(p.streak);
    u.premium = Math.max(0, toInt(u.premium, 0)) + gems;

    let qRes = null;
    if (this.quests?.onEvent) {
      qRes = await this.quests.onEvent(u, "pet_feed", { streak: p.streak }, { persist: false, notify: false }).catch(() => null);
    }
    let aRes = null;
    if (this.achievements?.onEvent) {
      aRes = await this.achievements.onEvent(u, "pet_feed", { streak: p.streak }, { persist: false, notify: false }).catch(() => null);
    }

    await this._scheduleNextDue(u);
    await this.users.save(u);

    if (qRes?.events?.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(u, qRes.events).catch(() => {});
    }
    if (aRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
      await this.achievements.notifyEarned(u, aRes.newlyEarned).catch(() => {});
    }

    return { ok: true, gems, streak: p.streak, name: p.name };
  }

  async heal(u) {
    await this._syncState(u, { persist: false });
    if (!u?.pet) return { ok: false, error: this._s(u).errNoPet };
    const p = u.pet;
    const s = this._s(u);
    if (String(p.status || "") === "dead") return { ok: false, error: s.errDead };
    if (String(p.status || "") !== "sick") return { ok: false, error: s.errNeedHeal };
    const need = Math.max(0, toInt(this._cfg().SICK_HEAL_GEMS, 3));
    if (Math.max(0, toInt(u.premium, 0)) < need) return { ok: false, error: s.errNoGems };

    u.premium = Math.max(0, toInt(u.premium, 0)) - need;
    p.status = "hungry";
    p.sickSince = "";
    p.lastFedDay = this._today();
    p.streak = 0;

    await this._scheduleNextDue(u);
    await this.users.save(u);
    return { ok: true, cost: need, name: p.name };
  }

  buildViewDraftConfirm(u) {
    const s = this._s(u);
    const type = String(u?.petDraft?.type || "cat");
    const name = String(u?.petDraft?.name || "");
    const price = this._price(type);
    const caption = this._fmt(s.confirmName, {
      typeEmoji: this._petTypeEmoji(type),
      name,
      price
    });
    return {
      caption,
      keyboard: [
        [{ text: s.confirmBtn, callback_data: "pet:confirm_buy" }],
        [{ text: s.cancelBtn, callback_data: "pet:cancel_buy" }]
      ]
    };
  }

  buildTypePickerView(u, opts = {}) {
    const lang = this._lang(u);
    const s = this._s(u);
    const deadName = String(opts?.deadName || "").trim();
    const caption = deadName
      ? (lang === "en"
        ? `💀 ${deadName} died...\n\nChoose a new pet.`
        : (lang === "uk"
          ? `💀 ${deadName} помер...\n\nОбери нового улюбленця.`
          : `💀 ${deadName} умер...\n\nВыбери нового питомца.`))
      : (lang === "en"
        ? "🐾 Choose your pet\n\nOpen a card to see photo and details."
        : (lang === "uk"
          ? "🐾 Обери улюбленця\n\nВідкрий картку, щоб побачити фото та деталі."
          : "🐾 Выбери питомца\n\nОткрой карточку, чтобы увидеть фото и детали."));

    return {
      caption,
      keyboard: [
        [{ text: "🐱 Кошка", callback_data: "pet:card:cat" }],
        [{ text: "🐶 Собака", callback_data: "pet:card:dog" }],
        [{ text: s.backBtn, callback_data: "go:Home" }]
      ]
    };
  }

  buildTypeCardView(u, type) {
    const t = String(type || "") === "dog" ? "dog" : "cat";
    const price = this._price(t);
    const lang = this._lang(u);
    const isDog = t === "dog";
    const caption = lang === "en"
      ? `${isDog ? "🐶 Dog" : "🐱 Cat"}\n\nPrice: $${price}\nAfter purchase, choose a name (2-12 symbols).`
      : (lang === "uk"
        ? `${isDog ? "🐶 Собака" : "🐱 Кішка"}\n\nЦіна: $${price}\nПісля покупки обери ім'я (2-12 символів).`
        : `${isDog ? "🐶 Собака" : "🐱 Кошка"}\n\nЦена: $${price}\nПосле покупки выбери имя (2-12 символов).`);
    const buyText = lang === "en"
      ? `💰 Buy ${isDog ? "dog" : "cat"} — $${price}`
      : (lang === "uk"
        ? `💰 Купити ${isDog ? "собаку" : "кішку"} — $${price}`
        : `💰 Купить ${isDog ? "собаку" : "кошку"} — $${price}`);
    const asset = String(this._cfg()?.ASSETS?.[t] || "");
    return {
      caption,
      asset,
      keyboard: [
        [{ text: buyText, callback_data: `pet:buy:${t}` }],
        [{ text: lang === "en" ? "⬅️ Back to pets" : (lang === "uk" ? "⬅️ До вибору" : "⬅️ К выбору"), callback_data: "go:Pet" }]
      ]
    };
  }

  async buildView(u) {
    await this._syncState(u, { persist: true });
    this._ensureDraft(u);
    const s = this._s(u);
    const backRow = [{ text: s.backBtn, callback_data: "go:Home" }];

    if (u.awaitingPetName && String(u?.petDraft?.type || "")) {
      return {
        caption: `${s.titleNoPet}\n\n${this._fmt(s.askName, { type: this._petTypeName(u, u.petDraft.type) })}`,
        keyboard: [[{ text: s.cancelBtn, callback_data: "pet:cancel_buy" }], backRow]
      };
    }

    if (u.petDraft?.type && u.petDraft?.name) {
      return this.buildViewDraftConfirm(u);
    }

    if (!u?.pet || typeof u.pet !== "object") {
      return this.buildTypePickerView(u);
    }

    const p = u.pet;
    const typeEmoji = this._petTypeEmoji(p.type);
    const title = `${typeEmoji} ${p.name}`;
    const today = this._today();
    const fedToday = String(p.lastFedDay || "") === today && String(p.status || "") === "healthy";
    const status = String(p.status || "healthy");
    const lines = [title, ""];
    const kb = [];

    if (status === "dead") {
      return this.buildTypePickerView(u, { deadName: p.name });
    }

    if (status === "sick") {
      lines.push(s.sick, "", s.sickHint);
      const healCost = Math.max(0, toInt(this._cfg().SICK_HEAL_GEMS, 3));
      kb.push([{ text: `${s.healBtn} — 💎${healCost}`, callback_data: "pet:heal" }]);
      kb.push(backRow);
      return { caption: lines.join("\n"), keyboard: kb };
    }

    const streak = Math.max(0, toInt(p.streak, 0));
    const reward = this._rewardGems(Math.max(1, streak || 1));
    if (status === "hungry") {
      const missed = this._missedDays(p, today);
      const sickAfter = Math.max(2, toInt(this._cfg().SICK_AFTER_DAYS, 3));
      const left = Math.max(0, sickAfter - missed);
      lines.push(s.hungry, "", `${s.streak}: 0`, this._fmt(s.hungryWarn, { days: left }));
      kb.push([{ text: s.feedBtn, callback_data: "pet:feed" }]);
      kb.push(backRow);
      return { caption: lines.join("\n"), keyboard: kb };
    }

    lines.push(fedToday ? s.healthyFed : s.healthy, "");
    lines.push(`${s.streak}: ${streak} дн.`);
    lines.push(`${fedToday ? s.todayGot : s.todayReward}: 💎${reward}`);
    lines.push("");
    lines.push(`${s.lastFeed}: ${p.lastFedDay || s.notFedYet}`);
    if (fedToday) {
      lines.push("", s.fedToday);
      kb.push(backRow);
    } else {
      kb.push([{ text: s.feedBtn, callback_data: "pet:feed" }]);
      kb.push(backRow);
    }
    return { caption: lines.join("\n"), keyboard: kb };
  }
}
