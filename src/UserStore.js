// UserStore.js
import { CONFIG } from "./GameConfig.js";

export class UserStore {
  static START_ENERGY_MIN = 20;

  constructor(db) {
    this.db = db;
  }

  _key(id) {
    return `u:${id}`;
  }

  async save(u) {
    const clone = JSON.parse(JSON.stringify(u));
    delete clone.__isNew;
    await this.db.put(this._key(u.id), JSON.stringify(clone));
    return clone;
  }

  /**
   * Мягкая миграция пользователя.
   */
  async load(id, rawOverride = undefined) {
    const raw = (typeof rawOverride === "string")
      ? rawOverride
      : await this.db.get(this._key(id));
    let u = raw ? JSON.parse(raw) : this._newUser(id);
    let dirty = false;
    const todayUTC = new Date().toISOString().slice(0, 10);

    if (typeof u.createdAt !== "number" || !Number.isFinite(u.createdAt) || u.createdAt < 0) {
      u.createdAt = 0;
      dirty = true;
    }

    // ===== Нормализация актуальных полей =====

    // Инвентарь / апгрейды
    if (!u.inv || typeof u.inv !== "object") { u.inv = { coffee: 0, sandwich: 0, lunch: 0 }; dirty = true; }
    if (!Array.isArray(u.upgrades)) { u.upgrades = []; dirty = true; }

    // Бонус дня
    if (!u.bonus || typeof u.bonus !== "object") { u.bonus = { last: "", streak: 0 }; dirty = true; }
    if (typeof u.bonus.last !== "string") { u.bonus.last = ""; dirty = true; }
    if (typeof u.bonus.streak !== "number") { u.bonus.streak = 0; dirty = true; }

    // Отдых
    if (!u.rest || typeof u.rest !== "object") { u.rest = { active: false, last: 0 }; dirty = true; }
    else {
      if (typeof u.rest.active !== "boolean") { u.rest.active = false; dirty = true; }
      if (typeof u.rest.last   !== "number")  { u.rest.last   = 0;     dirty = true; }
    }

    // Казино
    if (!u.casino || typeof u.casino !== "object") {
      u.casino = { last: 0, day: "", spins: 0, free: { day: "", lastPrize: 0 } };
      dirty = true;
    } else {
      if (typeof u.casino.last  !== "number") { u.casino.last  = 0; dirty = true; }
      if (typeof u.casino.day   !== "string") { u.casino.day   = ""; dirty = true; }
      if (typeof u.casino.spins !== "number") { u.casino.spins = 0; dirty = true; }
      if (!u.casino.free || typeof u.casino.free !== "object") {
        u.casino.free = { day: "", lastPrize: 0 }; dirty = true;
      } else {
        if (typeof u.casino.free.day       !== "string") { u.casino.free.day       = ""; dirty = true; }
        if (typeof u.casino.free.lastPrize !== "number") { u.casino.free.lastPrize = 0;  dirty = true; }
      }
    }

    // Учёба
    const maxLvl = CONFIG.STUDY.MAX_LEVEL;
    if (!u.study || typeof u.study !== "object") {
      u.study = { level: 0, active: false, startAt: 0, endAt: 0 };
      dirty = true;
    } else {
      if (typeof u.study.level !== "number") { u.study.level = 0; dirty = true; }
      u.study.level = Math.min(Math.max(u.study.level || 0, 0), maxLvl);
      if (typeof u.study.active !== "boolean") { u.study.active = false; dirty = true; }
      if (!u.study.active) {
        if (u.study.startAt !== 0 || u.study.endAt !== 0) dirty = true;
        u.study.startAt = 0;
        u.study.endAt   = 0;
      } else {
        if (typeof u.study.startAt !== "number") { u.study.startAt = 0; dirty = true; }
        if (typeof u.study.endAt   !== "number") { u.study.endAt   = 0; dirty = true; }
      }
    }

    // Зал (с прогрессией)
    if (!u.gym || typeof u.gym !== "object") {
      u.gym = { active: false, startAt: 0, endAt: 0, level: 0 };
      dirty = true;
    } else {
      if (typeof u.gym.level  !== "number")  { u.gym.level  = 0;     dirty = true; }
      if (typeof u.gym.active !== "boolean") { u.gym.active = false; dirty = true; }
      if (!u.gym.active) {
        if (u.gym.startAt !== 0 || u.gym.endAt !== 0) dirty = true;
        u.gym.startAt = 0;
        u.gym.endAt   = 0;
      } else {
        if (typeof u.gym.startAt !== "number") { u.gym.startAt = 0; dirty = true; }
        if (typeof u.gym.endAt   !== "number") { u.gym.endAt   = 0; dirty = true; }
      }
    }

    // Энергия
    const minEnergy = UserStore.START_ENERGY_MIN;
    const baseEnergyMax = Math.max(Number(CONFIG.ENERGY_MAX) || 0, minEnergy);
    if (typeof u.energy_max !== "number") { u.energy_max = baseEnergyMax; dirty = true; }
    if (u.energy_max < minEnergy) { u.energy_max = minEnergy; dirty = true; }
    if (typeof u.energy !== "number") { u.energy = minEnergy; dirty = true; }
    if (u.energy < minEnergy) { u.energy = minEnergy; dirty = true; }

    // Ник/онбординг
    if (typeof u.displayName !== "string") { u.displayName = ""; dirty = true; }
    if (typeof u.lang !== "string") { u.lang = ""; dirty = true; }
    if (u.lang && !["ru", "uk", "en"].includes(u.lang)) { u.lang = "ru"; dirty = true; }
    u.awaitingName = !!u.awaitingName;
    if (typeof u.afterNameRoute !== "string") { u.afterNameRoute = ""; dirty = true; }
    u.awaitingClanName = !!u.awaitingClanName;
    u.awaitingPetName = !!u.awaitingPetName;
    if (!u.petDraft || typeof u.petDraft !== "object") {
      u.petDraft = { type: "", name: "" };
      dirty = true;
    } else {
      if (typeof u.petDraft.type !== "string") { u.petDraft.type = ""; dirty = true; }
      if (typeof u.petDraft.name !== "string") { u.petDraft.name = ""; dirty = true; }
    }

    // Соц-табло суммы
    if (typeof u.dayTotal  !== "number") { u.dayTotal  = 0; dirty = true; }
    if (typeof u.dayKey    !== "string") { u.dayKey    = ""; dirty = true; }
    if (typeof u.weekTotal !== "number") { u.weekTotal = 0; dirty = true; }
    if (typeof u.weekKey   !== "string") { u.weekKey   = ""; dirty = true; }

    // Прем-валюта
    if (typeof u.premium !== "number") { u.premium = 0; dirty = true; }

    if (u.pet == null) {
      u.pet = null;
    } else if (typeof u.pet !== "object") {
      u.pet = null;
      dirty = true;
    } else {
      const p = u.pet;
      const type = String(p.type || "cat");
      if (type !== "cat" && type !== "dog") { p.type = "cat"; dirty = true; }
      if (typeof p.name !== "string") { p.name = ""; dirty = true; }
      const status = String(p.status || "healthy");
      if (!["healthy", "hungry", "sick", "dead"].includes(status)) {
        p.status = "healthy";
        dirty = true;
      }
      const streak = Math.max(0, Math.floor(Number(p.streak) || 0));
      if (streak !== p.streak) { p.streak = streak; dirty = true; }
      if (typeof p.lastFedDay !== "string") { p.lastFedDay = ""; dirty = true; }
      if (typeof p.sickSince !== "string") { p.sickSince = ""; dirty = true; }
      if (typeof p.boughtAt !== "number" || !Number.isFinite(p.boughtAt)) { p.boughtAt = Date.now(); dirty = true; }
      if (typeof p.notifyDay !== "string") { p.notifyDay = ""; dirty = true; }
      const notifyPriority = Math.max(0, Math.floor(Number(p.notifyPriority) || 0));
      if (notifyPriority !== p.notifyPriority) { p.notifyPriority = notifyPriority; dirty = true; }
      if (Object.prototype.hasOwnProperty.call(p, "fedToday")) { delete p.fedToday; dirty = true; }
      if (Object.prototype.hasOwnProperty.call(p, "missedDays")) { delete p.missedDays; dirty = true; }
    }

    // Биржа
    if (!u.stocks || typeof u.stocks !== "object") {
      u.stocks = { holdings: {}, lastDividendDay: "", lastDividendAmount: 0 };
      dirty = true;
    } else {
      if (!u.stocks.holdings || typeof u.stocks.holdings !== "object") { u.stocks.holdings = {}; dirty = true; }
      if (typeof u.stocks.lastDividendDay !== "string") { u.stocks.lastDividendDay = ""; dirty = true; }
      if (typeof u.stocks.lastDividendAmount !== "number") { u.stocks.lastDividendAmount = 0; dirty = true; }
      for (const [ticker, h] of Object.entries(u.stocks.holdings)) {
        if (!h || typeof h !== "object") { delete u.stocks.holdings[ticker]; dirty = true; continue; }
        const shares = Math.max(0, Math.floor(Number(h.shares) || 0));
        const avgPrice = Math.max(0, Number(h.avgPrice) || 0);
        if (!shares) { delete u.stocks.holdings[ticker]; dirty = true; continue; }
        if (shares !== h.shares || avgPrice !== h.avgPrice) {
          u.stocks.holdings[ticker] = { shares, avgPrice };
          dirty = true;
        }
      }
    }

    // Лимит ускорений (UTC) — для FastForward
    if (!u.fastForwardDaily || typeof u.fastForwardDaily !== "object") {
      u.fastForwardDaily = { day: "", n: 0 }; dirty = true;
    } else {
      if (typeof u.fastForwardDaily.day !== "string") { u.fastForwardDaily.day = ""; dirty = true; }
      if (typeof u.fastForwardDaily.n   !== "number") { u.fastForwardDaily.n   = 0;  dirty = true; }
    }

    // Магазинные дневные лимиты (пример: Coke Zero)
    if (!u.premiumDaily || typeof u.premiumDaily !== "object") {
      u.premiumDaily = { day: "", coke: 0 }; dirty = true;
    } else {
      if (typeof u.premiumDaily.day  !== "string") { u.premiumDaily.day  = ""; dirty = true; }
      if (typeof u.premiumDaily.coke !== "number") { u.premiumDaily.coke = 0;  dirty = true; }
    }

    // Работа
    if (!u.jobs || typeof u.jobs !== "object") {
      u.jobs = { slotMax: 1, active: [] };
      dirty = true;
    } else {
      if (!Array.isArray(u.jobs.active)) { u.jobs.active = []; dirty = true; }
      if (typeof u.jobs.slotMax !== "number") { u.jobs.slotMax = 1; dirty = true; }
      const normalizedActive = [];
      for (const it of u.jobs.active) {
        if (!it || typeof it !== "object") { dirty = true; continue; }
        const inst = { ...it };
        if (typeof inst.typeId !== "string" || !inst.typeId) {
          const fromId = String(inst.id || "");
          const parts = fromId.split(":");
          inst.typeId = parts.length >= 2 ? String(parts[1] || "") : "";
          dirty = true;
        }
        if (Object.prototype.hasOwnProperty.call(inst, "title")) {
          delete inst.title;
          dirty = true;
        }
        if (!Number.isFinite(inst.plannedPay)) {
          const cfgPay = inst.typeId ? Number(CONFIG?.JOBS?.[inst.typeId]?.pay) : NaN;
          inst.plannedPay = Number.isFinite(cfgPay) ? cfgPay : Math.max(0, Number(inst.plannedPay) || 0);
          dirty = true;
        }
        if (typeof inst.claimed !== "boolean") { inst.claimed = false; dirty = true; }
        if (typeof inst.notified !== "boolean") { inst.notified = false; dirty = true; }
        normalizedActive.push(inst);
      }
      if (normalizedActive.length !== u.jobs.active.length) dirty = true;
      u.jobs.active = normalizedActive;
    }

    // ==== Новый Бар ====
    if (!u.bar || typeof u.bar !== "object") {
      u.bar = { day: "", assigned: false, tasks: [] };
      dirty = true;
    } else {
      if (typeof u.bar.day !== "string") { u.bar.day = ""; dirty = true; }
      if (typeof u.bar.assigned !== "boolean") { u.bar.assigned = false; dirty = true; }
      if (!Array.isArray(u.bar.tasks)) { u.bar.tasks = []; dirty = true; }
      // жёстко чистим легаси
      if (u.bar.offered) { delete u.bar.offered; dirty = true; }
      if (u.bar.chosen)  { delete u.bar.chosen;  dirty = true; }
    }

    // Ежедневное право на бесплатный спин (после подписки в Баре)
    if (!u.subReward || typeof u.subReward !== "object") {
      u.subReward = { day: "", eligible: false }; dirty = true;
    } else {
      if (typeof u.subReward.day !== "string") { u.subReward.day = ""; dirty = true; }
      if (typeof u.subReward.eligible !== "boolean") { u.subReward.eligible = false; dirty = true; }
    }

    // Кланы
    if (!u.clan || typeof u.clan !== "object") {
      u.clan = { clanId: "", joinedAt: 0, joinAvailableFromWeek: "", lastPresenceDay: "" };
      dirty = true;
    } else {
      if (typeof u.clan.clanId !== "string") { u.clan.clanId = ""; dirty = true; }
      if (typeof u.clan.joinedAt !== "number") { u.clan.joinedAt = 0; dirty = true; }
      if (typeof u.clan.joinAvailableFromWeek !== "string") { u.clan.joinAvailableFromWeek = ""; dirty = true; }
      if (typeof u.clan.lastPresenceDay !== "string") { u.clan.lastPresenceDay = ""; dirty = true; }
    }
    if (u.clanCosmetic == null) {
      u.clanCosmetic = null;
    } else if (typeof u.clanCosmetic === "object") {
      const tier = String(u.clanCosmetic.tier || "");
      const weekKey = String(u.clanCosmetic.weekKey || "");
      const label = String(u.clanCosmetic.label || "");
      if (tier !== u.clanCosmetic.tier || weekKey !== u.clanCosmetic.weekKey || label !== u.clanCosmetic.label) {
        u.clanCosmetic = { tier, weekKey, label };
        dirty = true;
      }
    } else {
      u.clanCosmetic = null;
      dirty = true;
    }

    // Наемники (слоты в бизнесах): миграция slot -> slots[0]
    if (u.biz && typeof u.biz === "object" && Array.isArray(u.biz.owned)) {
      for (const entry of u.biz.owned) {
        if (!entry || typeof entry !== "object") continue;

        const hadPendingTheft = typeof entry.pendingTheftAmount === "number" && Number.isFinite(entry.pendingTheftAmount);
        if (typeof entry.pendingTheftAmount !== "number" || !Number.isFinite(entry.pendingTheftAmount)) {
          entry.pendingTheftAmount = 0;
          dirty = true;
        } else {
          const pending = Math.max(0, Math.floor(Number(entry.pendingTheftAmount) || 0));
          if (pending !== entry.pendingTheftAmount) {
            entry.pendingTheftAmount = pending;
            dirty = true;
          }
        }

        const legacyDay = String(entry.stolenDayUTC || "");
        const legacyAmountRaw = Math.max(0, Math.floor(Number(entry.stolenAmountToday) || 0));
        if (!hadPendingTheft && legacyAmountRaw > 0 && legacyDay === todayUTC) {
          entry.pendingTheftAmount = legacyAmountRaw;
          dirty = true;
        }

        if (entry.stolenDayUTC !== "") {
          entry.stolenDayUTC = "";
          dirty = true;
        }
        if (entry.stolenAmountToday !== 0) {
          entry.stolenAmountToday = 0;
          dirty = true;
        }

        if (entry.slot && typeof entry.slot === "object" && !Array.isArray(entry.slots)) {
          entry.slots = [entry.slot];
          delete entry.slot;
          dirty = true;
        }

        if (!Array.isArray(entry.slots)) continue;
        const norm = [];
        for (const rawSlot of entry.slots) {
          if (!rawSlot || typeof rawSlot !== "object") { dirty = true; continue; }
          const purchased = !!rawSlot.purchased;
          const employeeId = purchased ? String(rawSlot.employeeId || "") : "";
          const contractStart = purchased ? Math.max(0, Number(rawSlot.contractStart) || 0) : 0;
          const contractEnd = purchased ? Math.max(0, Number(rawSlot.contractEnd) || 0) : 0;
          const earnedTotal = purchased ? Math.max(0, Math.floor(Number(rawSlot.earnedTotal) || 0)) : 0;
          const lastEmployeeId = String(rawSlot.lastEmployeeId || "");
          const ownerPct = purchased ? Math.max(0, Number(rawSlot.ownerPct) || 0) : 0;
          const bonusCarry = purchased ? Math.max(0, Number(rawSlot.bonusCarry) || 0) : 0;

          norm.push({
            purchased,
            employeeId,
            contractStart,
            contractEnd,
            earnedTotal,
            lastEmployeeId,
            ownerPct,
            bonusCarry
          });
        }
        if (norm.length !== entry.slots.length) dirty = true;
        if (norm.length > 5) dirty = true;
        entry.slots = norm.slice(0, 5);
      }
    }

    // Тёмный бизнес
    if (!u.thief || typeof u.thief !== "object") {
      u.thief = { level: 0, activeAttackId: "", cooldowns: {}, totalStolen: 0 };
      dirty = true;
    } else {
      const maxLevel = Math.max(0, Number(CONFIG?.THIEF?.MAX_LEVEL) || 5);
      const level = Math.max(0, Math.floor(Number(u.thief.level) || 0));
      const boundedLevel = Math.min(maxLevel, level);
      if (boundedLevel !== u.thief.level) {
        u.thief.level = boundedLevel;
        dirty = true;
      }
      if (typeof u.thief.activeAttackId !== "string") {
        u.thief.activeAttackId = "";
        dirty = true;
      }
      if (!u.thief.cooldowns || typeof u.thief.cooldowns !== "object") {
        u.thief.cooldowns = {};
        dirty = true;
      } else {
        const normalized = {};
        for (const [bizId, endAtRaw] of Object.entries(u.thief.cooldowns)) {
          const endAt = Math.max(0, Math.floor(Number(endAtRaw) || 0));
          if (endAt > 0) normalized[String(bizId)] = endAt;
        }
        const prevKeys = Object.keys(u.thief.cooldowns);
        const nextKeys = Object.keys(normalized);
        if (prevKeys.length !== nextKeys.length ||
            prevKeys.some((k) => Number(u.thief.cooldowns[k]) !== Number(normalized[k]))) {
          u.thief.cooldowns = normalized;
          dirty = true;
        }
      }
      const totalStolen = Math.max(0, Math.floor(Number(u.thief.totalStolen) || 0));
      if (totalStolen !== Number(u.thief.totalStolen)) {
        u.thief.totalStolen = totalStolen;
        dirty = true;
      }
    }

    // Наемники (статус игрока как сотрудника)
    if (!u.employment || typeof u.employment !== "object") {
      u.employment = {
        active: false,
        ownerId: "",
        bizId: "",
        ownerPct: 0,
        contractEnd: 0,
        slotIndex: -1
      };
      dirty = true;
    } else {
      if (typeof u.employment.active !== "boolean") { u.employment.active = false; dirty = true; }
      if (typeof u.employment.ownerId !== "string") { u.employment.ownerId = ""; dirty = true; }
      if (typeof u.employment.bizId !== "string") { u.employment.bizId = ""; dirty = true; }
      if (typeof u.employment.ownerPct !== "number") { u.employment.ownerPct = 0; dirty = true; }
      if (typeof u.employment.contractEnd !== "number") { u.employment.contractEnd = 0; dirty = true; }
      if (typeof u.employment.slotIndex !== "number" || !Number.isFinite(u.employment.slotIndex)) {
        u.employment.slotIndex = -1;
        dirty = true;
      } else {
        const slotIndex = Math.floor(Number(u.employment.slotIndex));
        if (slotIndex !== u.employment.slotIndex || slotIndex < -1) {
          u.employment.slotIndex = Math.max(-1, slotIndex);
          dirty = true;
        }
      }
      if (!u.employment.active && u.employment.slotIndex !== -1) {
        u.employment.slotIndex = -1;
        dirty = true;
      }
    }

    // Рефералы
    if (!u.referral || typeof u.referral !== "object") {
      u.referral = {
        referredBy: "",
        rewarded: false,
        invited: [],
        totalGemsEarned: 0,
        startPayload: "",
        startSource: "",
        startBoundAt: 0
      };
      dirty = true;
    } else {
      if (typeof u.referral.referredBy !== "string") { u.referral.referredBy = ""; dirty = true; }
      if (typeof u.referral.rewarded !== "boolean") { u.referral.rewarded = false; dirty = true; }
      if (!Array.isArray(u.referral.invited)) { u.referral.invited = []; dirty = true; }
      if (typeof u.referral.totalGemsEarned !== "number") { u.referral.totalGemsEarned = 0; dirty = true; }
      if (typeof u.referral.startPayload !== "string") { u.referral.startPayload = ""; dirty = true; }
      if (typeof u.referral.startSource !== "string") { u.referral.startSource = ""; dirty = true; }
      if (typeof u.referral.startBoundAt !== "number" || !Number.isFinite(u.referral.startBoundAt)) {
        u.referral.startBoundAt = 0;
        dirty = true;
      }

      const invitedNorm = [];
      for (const raw of u.referral.invited) {
        const idRef = String(raw?.id || "").trim();
        if (!idRef) { dirty = true; continue; }
        const rewardedAt = Math.max(0, Number(raw?.rewardedAt) || 0);
        invitedNorm.push({ id: idRef, rewardedAt });
      }
      if (invitedNorm.length !== u.referral.invited.length) dirty = true;
      invitedNorm.sort((a, b) => (Number(b.rewardedAt) || 0) - (Number(a.rewardedAt) || 0));
      u.referral.invited = invitedNorm.slice(0, 100);
      u.referral.totalGemsEarned = Math.max(0, Math.round(Number(u.referral.totalGemsEarned) || 0));
      u.referral.startPayload = String(u.referral.startPayload || "").trim().slice(0, 64);
      u.referral.startSource = String(u.referral.startSource || "").trim().slice(0, 16);
      u.referral.startBoundAt = Math.max(0, Math.floor(Number(u.referral.startBoundAt) || 0));
    }

    // Достижения
    if (!u.achievements || typeof u.achievements !== "object") {
      u.achievements = {
        earned: {},
        progress: {
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
          referralsDone: 0,
          clanJoinedOnce: false,
          clanCreatedOnce: false
        },
        retroDone: false
      };
      dirty = true;
    } else {
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
      const progressDefaults = {
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
        referralsDone: 0
      };
      for (const [k, d] of Object.entries(progressDefaults)) {
        if (typeof u.achievements.progress[k] !== "number" || !Number.isFinite(u.achievements.progress[k])) {
          u.achievements.progress[k] = d;
          dirty = true;
        }
      }
      if (typeof u.achievements.progress.clanJoinedOnce !== "boolean") {
        u.achievements.progress.clanJoinedOnce = false;
        dirty = true;
      }
      if (typeof u.achievements.progress.clanCreatedOnce !== "boolean") {
        u.achievements.progress.clanCreatedOnce = false;
        dirty = true;
      }
    }

    // ===== LEGACY — мягко удаляем устаревшие ключи =====
    const dropKeys = [
      "status","last_work_start","shifts","goals","last_daily",
      "streak","achv","ui","effects",
      "skipsToday" // старый суточный лимит скипов работы — больше не используется
    ];
    for (const k of dropKeys) {
      if (k in u) { delete u[k]; dirty = true; }
    }

    // Ensure flags presence and types (used for onboarding persistence)
    if (!u.flags || typeof u.flags !== "object") { u.flags = {}; dirty = true; }
    if (typeof u.flags.onboarding !== "boolean") { u.flags.onboarding = false; dirty = true; }
    if (typeof u.flags.onboardingStartedAt !== "number") { u.flags.onboardingStartedAt = 0; dirty = true; }
    if (typeof u.flags.onboardingStep !== "string") { u.flags.onboardingStep = ""; dirty = true; }
    if (typeof u.flags.firstJobGemGiven !== "boolean") { u.flags.firstJobGemGiven = false; dirty = true; }
    if (typeof u.flags.onboardingDone !== "boolean") { u.flags.onboardingDone = false; dirty = true; }
    if (typeof u.flags.onboardingFlowV2 !== "boolean") { u.flags.onboardingFlowV2 = false; dirty = true; }
    if (typeof u.flags.freeSkipUsed_work !== "boolean") { u.flags.freeSkipUsed_work = false; dirty = true; }
    if (typeof u.flags.freeSkipUsed_gym !== "boolean") { u.flags.freeSkipUsed_gym = false; dirty = true; }

    // Daily top stats and reward marker
    if (!u.stats || typeof u.stats !== "object") {
      u.stats = { dailyTop1Count: 0, dailyTop3Count: 0, dailyTop10Count: 0 };
      dirty = true;
    } else {
      if (typeof u.stats.dailyTop1Count !== "number") { u.stats.dailyTop1Count = 0; dirty = true; }
      if (typeof u.stats.dailyTop3Count !== "number") { u.stats.dailyTop3Count = 0; dirty = true; }
      if (typeof u.stats.dailyTop10Count !== "number") { u.stats.dailyTop10Count = 0; dirty = true; }
    }
    if (typeof u.lastDailyRewardDay !== "string") { u.lastDailyRewardDay = ""; dirty = true; }

    if (dirty) await this.save(u);
    return u;
  }

  _newUser(id) {
    const now = Date.now();
    return {
      id,
      createdAt: now,
      money: 20,
      energy: UserStore.START_ENERGY_MIN,
      energy_max: Math.max(Number(CONFIG.ENERGY_MAX) || 0, UserStore.START_ENERGY_MIN),

      inv: { coffee: 0, sandwich: 0, lunch: 0 },
      upgrades: [],

      bonus: { last: "", streak: 0 },

      rest: { active: false, last: 0 },

      casino: { last: 0, day: "", spins: 0, free: { day: "", lastPrize: 0 } },

      study: { level: 0, active: false, startAt: 0, endAt: 0 },

      gym: { active: false, startAt: 0, endAt: 0, level: 0 },

      subReward: { day: "", eligible: false },

      displayName: "",
      lang: "",
      awaitingName: true,
      afterNameRoute: "",
      awaitingClanName: false,
      awaitingPetName: false,
      petDraft: { type: "", name: "" },

      dayTotal: 0,
      dayKey: "",
      weekTotal: 0,
      weekKey: "",

      stats: { dailyTop1Count: 0, dailyTop3Count: 0, dailyTop10Count: 0 },
      lastDailyRewardDay: "",

      premium: 20,
      pet: null,

      stocks: { holdings: {}, lastDividendDay: "", lastDividendAmount: 0 },

      // FastForward дневной лимит
      fastForwardDaily: { day: "", n: 0 },

      // дневные лимиты магазина
      premiumDaily: { day: "", coke: 0 },

      // Бар
      bar: { day: "", assigned: false, tasks: [] },

      clan: { clanId: "", joinedAt: 0, joinAvailableFromWeek: "", lastPresenceDay: "" },
      clanCosmetic: null,
      employment: { active: false, ownerId: "", bizId: "", ownerPct: 0, contractEnd: 0, slotIndex: -1 },
      referral: {
        referredBy: "",
        rewarded: false,
        invited: [],
        totalGemsEarned: 0,
        startPayload: "",
        startSource: "",
        startBoundAt: 0
      },
      thief: { level: 0, activeAttackId: "", cooldowns: {}, totalStolen: 0 },
      achievements: {
        earned: {},
        progress: {
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
          referralsDone: 0,
          clanJoinedOnce: false,
          clanCreatedOnce: false
        },
        retroDone: false
      },

      // Flags
      flags: {
        onboarding: false,
        onboardingStartedAt: 0,
        onboardingStep: "",
        firstJobGemGiven: false,
        onboardingDone: false,
        onboardingFlowV2: false,
        freeSkipUsed_work: false,
        freeSkipUsed_gym: false
      }
    };
  }

  async getOrCreate(id) {
    const key = this._key(id);
    const raw = await this.db.get(key);
    if (!raw) {
      const u = this._newUser(id);
      // Mark as new in-memory (not persisted) to enable onboarding logic on first /start
      u.__isNew = true;
      await this.save(u);
      return u;
    }
    return this.load(id, raw);
  }

  async update(id, fn) {
    const u = await this.load(id);
    const updated = (await fn(u)) ?? u;
    return this.save(updated);
  }

  // ===== никнейм =====
  validateDisplayName(raw) {
    if (typeof raw !== "string") return { ok: false, error: "Отправь текст с никнеймом." };
    const s = raw.trim();
    if (s.length < 2 || s.length > 16) return { ok: false, error: "Ник должен быть 2–16 символов." };
    if (s.includes("http") || s.includes("://") || s.includes("t.me/") || s.includes("@")) {
      return { ok: false, error: "В нике не должно быть ссылок и @." };
    }
    // RU/UA/EN + цифры, пробел, _ . -
    const re = /^[A-Za-z0-9 А-Яа-яЁёІіЇїЄєҐґ_.-]+$/u;
    if (!re.test(s)) {
      return {
        ok: false,
        error: "Разрешены буквы/цифры/пробел/._- (латиница/кириллица/украинский).",
      };
    }
    return { ok: true, value: s };
  }

  /**
   * Санитайзер для авто-фолбэка из Telegram: вычищает лишнее и, при необходимости, обрезает до 16.
   * Возвращает "" если после очистки <2 символов.
   * @param {string} raw
   * @param {{truncate?: boolean}} [opt]
   */
  sanitizeForDisplayName(raw, opt = {}) {
    if (typeof raw !== "string") return "";
    const truncate = !!opt.truncate;
    
    // Нормализуем и чистим zero-width, чтобы не прятали символы
    raw = raw.normalize?.("NFKC") || raw; 
    let s = raw.replace(/[\u200B-\u200D\uFEFF]/g, "");
    
    // Убираем URL и @
    s = s.replace(/https?:\/\/\S+|t\.me\/\S+|@/gi, " ");

    // Оставляем только разрешённые символы (буквы RU/UA/EN, цифры, пробел, _ . -)
    s = s.replace(/[^A-Za-z0-9 А-Яа-яЁёІіЇїЄєҐґ_.-]+/gu, " ");

    // Нормализуем пробелы и обрезаем края
    s = s.replace(/\s+/g, " ").trim();

    // Обрезка до 16, если нужно
    if (truncate && s.length > 16) s = s.slice(0, 16);

    // Минимальная длина после очистки
    if (s.length < 2) return "";
    return s;
  }

  async setDisplayName(u, name) {
    const v = this.validateDisplayName(name);
    if (!v.ok) return v;
    u.displayName = v.value;
    u.awaitingName = false;
    await this.save(u);
    return { ok: true, value: u.displayName };
  }
}
