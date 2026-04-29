import { CONFIG } from "./GameConfig.js";
import { getBusinessTitle } from "./I18nCatalog.js";
import { formatMoney, normalizeLang, t } from "./i18n/index.js";
import { EnergyService } from "./EnergyService.js";

const LABOUR_FREE_PLAYERS_KEY = "labour:free_players";
const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_BUCKET_MS = 5 * 60 * 1000;
const DUE_LOOKBACK_MINUTES = 20;
const RECONCILE_GRACE_MS_DEFAULT = 10 * 60 * 1000;
const CONTRACT_MODEL_LEGACY = "legacy_claim_share";
const CONTRACT_MODEL_BG_V1 = "bg_fixed_v1";

export class LabourService {
  constructor({ db, users, now, bot, quests = null, social = null }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.quests = quests || null;
    this.social = social || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _t(source, key, vars = {}) {
    return t(key, this._lang(source), vars);
  }

  _cfg() {
    return CONFIG?.LABOUR_MARKET || {};
  }

  _slotsCfg() {
    return this._cfg().SLOTS || {};
  }

  _slotCfg(bizId) {
    return this._slotsCfg()[String(bizId || "")] || null;
  }

  _slotLevelsCfg(bizId) {
    const slotCfg = this._slotCfg(bizId);
    if (!slotCfg || typeof slotCfg !== "object") return [];
    const rawLevels = Array.isArray(slotCfg.levels)
      ? slotCfg.levels
      : [{
          slotMoney: slotCfg.slotMoney,
          slotGems: slotCfg.slotGems,
          ownerPct: slotCfg.ownerPct
        }];

    return rawLevels
      .map((x) => ({
        slotMoney: Math.max(0, Math.floor(Number(x?.slotMoney) || 0)),
        slotGems: Math.max(0, Math.floor(Number(x?.slotGems) || 0)),
        ownerPct: Math.max(0, Number(x?.ownerPct) || 0)
      }))
      .filter((x) => x.slotMoney > 0 || x.slotGems > 0 || x.ownerPct > 0);
  }

  _slotLevelCfg(bizId, slotIndex) {
    const levels = this._slotLevelsCfg(bizId);
    const idx = Math.floor(Number(slotIndex));
    if (!Number.isFinite(idx) || idx < 0 || idx >= levels.length) return null;
    return levels[idx];
  }

  _maxSlots(bizId) {
    const levels = this._slotLevelsCfg(bizId);
    return Math.max(0, levels.length);
  }

  _contractDays(bizId) {
    const slotCfg = this._slotCfg(bizId);
    return Math.max(1, Number(slotCfg?.contractDays) || 1);
  }

  _minEnergyMax(bizId) {
    const slotCfg = this._slotCfg(bizId);
    return Math.max(0, Number(slotCfg?.minEnergyMax) || 0);
  }

  _listSize() {
    return Math.max(1, Number(this._cfg().LIST_SIZE) || 10);
  }

  _indexSize() {
    return Math.max(this._listSize(), Number(this._cfg().INDEX_SIZE) || 20);
  }

  _reconcileGraceMs() {
    const raw = Math.floor(Number(this._cfg().RECONCILE_GRACE_MS));
    if (!Number.isFinite(raw) || raw < 0) return RECONCILE_GRACE_MS_DEFAULT;
    return raw;
  }

  _bgCfg() {
    return this._cfg().BACKGROUND || {};
  }

  _bgEmployeePayoutMult() {
    const raw = Number(this._bgCfg().EMPLOYEE_PAYOUT_MULT);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(0, raw);
  }

  _bgShiftMs() {
    return Math.max(60_000, Math.floor(Number(this._bgCfg().SHIFT_MS) || (60 * 60 * 1000)));
  }

  _bgRatePerHour(bizId) {
    const map = this._bgCfg().EMPLOYEE_RATE_PER_HOUR || {};
    return Math.max(0, Number(map[String(bizId || "")]) || 0);
  }

  _bgShiftPay(bizId) {
    const perHour = this._bgRatePerHour(bizId);
    const shiftHours = this._bgShiftMs() / (60 * 60 * 1000);
    const pay = perHour * shiftHours * this._bgEmployeePayoutMult();
    return Math.max(0, Math.round(pay * 100) / 100);
  }

  _bgOwnerGems(bizId) {
    const map = this._bgCfg().OWNER_GEMS_BY_BIZ || {};
    return Math.max(0, Math.floor(Number(map[String(bizId || "")]) || 0));
  }

  _buildBgPlan(bizId, contractStart, contractEnd, ownerPct) {
    const startAt = Math.max(0, Number(contractStart) || 0);
    const endAt = Math.max(startAt, Number(contractEnd) || 0);
    const shiftMs = this._bgShiftMs();
    const shiftPay = this._bgShiftPay(bizId);
    const totalShifts = shiftMs > 0 ? Math.max(0, Math.floor((endAt - startAt) / shiftMs)) : 0;
    const employeeTotal = Math.max(0, Math.floor(totalShifts * shiftPay));
    const pct = Math.max(0, Number(ownerPct) || 0);
    const ownerMoneyTotal = Math.max(0, Math.floor(employeeTotal * pct));
    const ownerGemsTotal = this._bgOwnerGems(bizId);
    return {
      model: CONTRACT_MODEL_BG_V1,
      shiftMs,
      shiftPay,
      totalShifts,
      employeeTotal,
      ownerMoneyTotal,
      ownerGemsTotal
    };
  }

  _numOr(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

  _dueBucket(ts) {
    const t = Number(ts) || 0;
    return Math.floor(t / DUE_BUCKET_MS);
  }

  _dueKey(bucket, employeeId) {
    return `labour:due:${bucket}:${String(employeeId || "")}`;
  }

  _parseDueEmployeeId(key) {
    const parts = String(key || "").split(":");
    if (parts.length < 4) return "";
    return String(parts[3] || "").trim();
  }

  async _markContractDue(employeeId, contractEnd) {
    if (!this.db || typeof this.db.put !== "function") return;
    const id = String(employeeId || "").trim();
    const endAt = Number(contractEnd) || 0;
    if (!id || endAt <= 0) return;

    const bucket = this._dueBucket(endAt);
    const ttlSec = Math.max(60, Math.ceil((endAt - this.now()) / 1000) + 3 * 24 * 60 * 60);
    await this.db.put(this._dueKey(bucket, id), "1", { expirationTtl: ttlSec });
  }

  async _collectDueEmployeeIds({ nowTs = this.now(), lookbackMinutes = DUE_LOOKBACK_MINUTES } = {}) {
    if (!this.db || typeof this.db.list !== "function") return [];
    const endBucket = this._dueBucket(nowTs);
    const lookbackMs = Math.max(0, Math.floor(Number(lookbackMinutes) || 0)) * 60 * 1000;
    const lookbackBuckets = Math.max(0, Math.ceil(lookbackMs / DUE_BUCKET_MS));
    const startBucket = endBucket - lookbackBuckets;
    const ids = new Set();

    for (let bucket = startBucket; bucket <= endBucket; bucket++) {
      const prefix = `labour:due:${bucket}:`;
      let cursor = undefined;
      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;
        const keys = page?.keys || [];
        for (const k of keys) {
          const id = this._parseDueEmployeeId(k?.name);
          if (id) ids.add(id);
        }
      } while (cursor);
    }

    return [...ids];
  }

  async runDueExpirations({ lookbackMinutes = DUE_LOOKBACK_MINUTES, limit = 200 } = {}) {
    const ids = await this._collectDueEmployeeIds({ lookbackMinutes });
    if (!ids.length) return { checked: 0 };

    let checked = 0;
    const max = Math.max(1, Math.floor(Number(limit) || 200));
    for (const id of ids) {
      if (checked >= max) break;
      checked += 1;
      try {
        const employee = await this.users.load(id).catch(() => null);
        if (!employee) continue;
        await this.ensureEmploymentFresh(employee);
      } catch {}
    }
    return { checked };
  }

  _bizTitle(bizId, source = "ru") {
    const localized = getBusinessTitle(bizId, this._lang(source));
    if (localized) return localized;
    return this._t(source, "labour.biz_fallback");
  }

  _formatName(u, source = "ru") {
    const s = String(u?.displayName || "").trim();
    if (s) return s;
    return this._t(source, "labour.player_short", {
      id: String(u?.id || "").slice(-4).padStart(4, "0")
    });
  }

  _money(source, amount) {
    return formatMoney(amount, this._lang(source));
  }

  _moneyPrecise(amount) {
    const raw = Number(amount);
    const v = Number.isFinite(raw) ? raw : 0;
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    const shown = Number.isInteger(abs)
      ? String(abs)
      : String(abs.toFixed(2)).replace(/\.?0+$/, "");
    return `${sign}$${shown}`;
  }

  _dayStrUtc(ts = this.now()) {
    const d = new Date(Number(ts) || this.now());
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _applyOwnerLabourDayIncome(owner, money, gems) {
    if (!owner || typeof owner !== "object") return null;

    const safeMoney = Math.max(0, Math.floor(Number(money) || 0));
    const safeGems = Math.max(0, Math.floor(Number(gems) || 0));
    if (safeMoney <= 0 && safeGems <= 0) return null;

    if (!owner.stats || typeof owner.stats !== "object") owner.stats = {};
    const s = owner.stats;
    const today = this._dayStrUtc();
    if (String(s.labourDayKey || "") !== today) {
      s.labourDayKey = today;
      s.labourDayMoney = 0;
      s.labourDayGems = 0;
    }

    s.labourDayMoney = Math.max(0, Math.floor(Number(s.labourDayMoney) || 0)) + safeMoney;
    s.labourDayGems = Math.max(0, Math.floor(Number(s.labourDayGems) || 0)) + safeGems;

    return {
      userId: owner.id,
      displayName: this._formatName(owner, owner),
      money: s.labourDayMoney,
      gems: s.labourDayGems
    };
  }

  async _maybeUpdateLabourDayTop(payload) {
    if (!payload || !this.social || typeof this.social.maybeUpdateLabourDayTop !== "function") return;
    try {
      await this.social.maybeUpdateLabourDayTop(payload);
    } catch {}
  }

  _formatTimeLeftDhM(source, endAt) {
    const endTs = Number(endAt) || 0;
    const diffMs = Math.max(0, endTs - this.now());
    const totalMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const lang = this._lang(source);

    if (lang === "en") return `${days}d ${hours}h ${minutes}m`;
    if (lang === "uk") return `${days} дн ${hours} год ${minutes} хв`;
    return `${days} дн ${hours} ч ${minutes} мин`;
  }

  _businessesOrdered() {
    const all = Object.values(CONFIG?.BUSINESS || {});
    all.sort((a, b) => {
      const pa = Number(a?.price) || 0;
      const pb = Number(b?.price) || 0;
      if (pa !== pb) return pa - pb;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    return all;
  }

  _inactiveEmployment() {
    return {
      active: false,
      ownerId: "",
      bizId: "",
      ownerPct: 0,
      contractEnd: 0,
      slotIndex: -1,
      model: CONTRACT_MODEL_LEGACY,
      bgShiftMs: 0,
      bgShiftPay: 0,
      bgTotalShifts: 0,
      bgEmployeeTotal: 0,
      bgOwnerMoneyTotal: 0,
      bgOwnerGemsTotal: 0
    };
  }

  _ensureEmployment(u) {
    if (!u.employment || typeof u.employment !== "object") {
      u.employment = this._inactiveEmployment();
      return true;
    }
    let dirty = false;
    if (typeof u.employment.active !== "boolean") {
      u.employment.active = false;
      dirty = true;
    }
    if (typeof u.employment.ownerId !== "string") {
      u.employment.ownerId = "";
      dirty = true;
    }
    if (typeof u.employment.bizId !== "string") {
      u.employment.bizId = "";
      dirty = true;
    }
    {
      const ownerPct = this._numOr(u.employment.ownerPct, 0);
      if (ownerPct !== u.employment.ownerPct) {
        u.employment.ownerPct = ownerPct;
        dirty = true;
      }
    }
    {
      const contractEnd = this._numOr(u.employment.contractEnd, 0);
      if (contractEnd !== u.employment.contractEnd) {
        u.employment.contractEnd = contractEnd;
        dirty = true;
      }
    }
    if (typeof u.employment.model !== "string") {
      u.employment.model = CONTRACT_MODEL_LEGACY;
      dirty = true;
    }
    const employmentNumDefaults = {
      bgShiftMs: 0,
      bgShiftPay: 0,
      bgTotalShifts: 0,
      bgEmployeeTotal: 0,
      bgOwnerMoneyTotal: 0,
      bgOwnerGemsTotal: 0
    };
    for (const [k, v] of Object.entries(employmentNumDefaults)) {
      const num = this._numOr(u.employment[k], v);
      if (num !== u.employment[k]) {
        u.employment[k] = num;
        dirty = true;
      }
    }
    const slotIdxRaw = this._numOr(u.employment.slotIndex, -1);
    const slotIdx = Math.max(-1, Math.floor(slotIdxRaw));
    if (slotIdx !== u.employment.slotIndex) {
      u.employment.slotIndex = slotIdx;
      dirty = true;
    }
    if (!u.employment.active && u.employment.slotIndex !== -1) {
      u.employment.slotIndex = -1;
      dirty = true;
    }
    return dirty;
  }

  _emptySlot() {
    return {
      purchased: false,
      employeeId: "",
      contractStart: 0,
      contractEnd: 0,
      earnedTotal: 0,
      lastEmployeeId: "",
      ownerPct: 0,
      bonusCarry: 0,
      contractModel: CONTRACT_MODEL_LEGACY,
      bgShiftMs: 0,
      bgShiftPay: 0,
      bgTotalShifts: 0,
      bgEmployeeTotal: 0,
      bgOwnerMoneyTotal: 0,
      bgOwnerGemsTotal: 0
    };
  }

  _ensureSlotObject(slot) {
    if (!slot || typeof slot !== "object") {
      return { slot: this._emptySlot(), dirty: true };
    }

    let dirty = false;
    if (typeof slot.purchased !== "boolean") { slot.purchased = false; dirty = true; }
    if (typeof slot.employeeId !== "string") { slot.employeeId = ""; dirty = true; }
    {
      const n = this._numOr(slot.contractStart, 0);
      if (n !== slot.contractStart) { slot.contractStart = n; dirty = true; }
    }
    {
      const n = this._numOr(slot.contractEnd, 0);
      if (n !== slot.contractEnd) { slot.contractEnd = n; dirty = true; }
    }
    {
      const n = this._numOr(slot.earnedTotal, 0);
      if (n !== slot.earnedTotal) { slot.earnedTotal = n; dirty = true; }
    }
    if (typeof slot.lastEmployeeId !== "string") { slot.lastEmployeeId = ""; dirty = true; }
    {
      const n = this._numOr(slot.ownerPct, 0);
      if (n !== slot.ownerPct) { slot.ownerPct = n; dirty = true; }
    }
    {
      const n = this._numOr(slot.bonusCarry, 0);
      if (n !== slot.bonusCarry) { slot.bonusCarry = n; dirty = true; }
    }
    if (typeof slot.contractModel !== "string") { slot.contractModel = CONTRACT_MODEL_LEGACY; dirty = true; }
    const bgDefaults = {
      bgShiftMs: 0,
      bgShiftPay: 0,
      bgTotalShifts: 0,
      bgEmployeeTotal: 0,
      bgOwnerMoneyTotal: 0,
      bgOwnerGemsTotal: 0
    };
    for (const [k, v] of Object.entries(bgDefaults)) {
      const num = this._numOr(slot[k], v);
      if (num !== slot[k]) {
        slot[k] = num;
        dirty = true;
      }
    }
    if (!slot.purchased) {
      if (
        slot.employeeId ||
        slot.contractStart ||
        slot.contractEnd ||
        slot.earnedTotal ||
        slot.ownerPct ||
        slot.bonusCarry ||
        slot.bgEmployeeTotal ||
        slot.bgOwnerMoneyTotal ||
        slot.bgOwnerGemsTotal
      ) {
        slot.employeeId = "";
        slot.contractStart = 0;
        slot.contractEnd = 0;
        slot.earnedTotal = 0;
        slot.ownerPct = 0;
        slot.bonusCarry = 0;
        slot.contractModel = CONTRACT_MODEL_LEGACY;
        slot.bgShiftMs = 0;
        slot.bgShiftPay = 0;
        slot.bgTotalShifts = 0;
        slot.bgEmployeeTotal = 0;
        slot.bgOwnerMoneyTotal = 0;
        slot.bgOwnerGemsTotal = 0;
        dirty = true;
      }
    } else {
      const ownerPct = Math.max(0, Number(slot.ownerPct) || 0);
      if (ownerPct !== slot.ownerPct) {
        slot.ownerPct = ownerPct;
        dirty = true;
      }
      const carryRaw = Math.max(0, Number(slot.bonusCarry) || 0);
      const carryInt = Math.floor(carryRaw);
      const carryFrac = Math.max(0, carryRaw - carryInt);
      if (carryInt > 0) {
        slot.earnedTotal = Math.max(0, Math.floor(Number(slot.earnedTotal) || 0)) + carryInt;
        dirty = true;
      }
      if (Math.abs(carryFrac - slot.bonusCarry) > 1e-9) {
        slot.bonusCarry = carryFrac;
        dirty = true;
      }
    }
    return { slot, dirty };
  }

  _ensureSlots(entry, bizId = "") {
    if (!entry || typeof entry !== "object") return false;

    let dirty = false;
    if (entry.slot && typeof entry.slot === "object" && !Array.isArray(entry.slots)) {
      entry.slots = [entry.slot];
      delete entry.slot;
      dirty = true;
    }
    if (!Array.isArray(entry.slots)) {
      entry.slots = [];
      dirty = true;
    }

    const normalized = [];
    for (const rawSlot of entry.slots) {
      const ensured = this._ensureSlotObject(rawSlot);
      normalized.push(ensured.slot);
      dirty = dirty || ensured.dirty;
    }

    const maxSlots = this._maxSlots(bizId || entry.id || "");
    if (maxSlots > 0 && normalized.length > maxSlots) {
      normalized.length = maxSlots;
      dirty = true;
    }

    if (normalized.length !== entry.slots.length) dirty = true;
    entry.slots = normalized;
    return dirty;
  }

  _slotIndex(rawIndex) {
    const idx = Math.floor(Number(rawIndex));
    if (!Number.isFinite(idx)) return -1;
    return Math.max(-1, idx);
  }

  _slotNum(rawIndex) {
    return this._slotIndex(rawIndex) + 1;
  }

  _slotAt(entry, slotIndex) {
    if (!entry || typeof entry !== "object") return null;
    if (!Array.isArray(entry.slots)) entry.slots = [];
    const idx = this._slotIndex(slotIndex);
    if (idx < 0) return null;
    while (entry.slots.length <= idx) {
      entry.slots.push(this._emptySlot());
    }
    const ensured = this._ensureSlotObject(entry.slots[idx]);
    entry.slots[idx] = ensured.slot;
    return entry.slots[idx];
  }

  _findEntrySlot(entry, slotIndex, employeeId = "") {
    if (!entry || typeof entry !== "object") return { slot: null, slotIndex: -1 };
    if (!Array.isArray(entry.slots)) entry.slots = [];

    const idx = this._slotIndex(slotIndex);
    if (idx >= 0 && idx < entry.slots.length) {
      const ensured = this._ensureSlotObject(entry.slots[idx]);
      entry.slots[idx] = ensured.slot;
      return { slot: entry.slots[idx], slotIndex: idx };
    }

    const wantedEmployeeId = String(employeeId || "");
    if (wantedEmployeeId) {
      for (let i = 0; i < entry.slots.length; i++) {
        const ensured = this._ensureSlotObject(entry.slots[i]);
        entry.slots[i] = ensured.slot;
        if (String(entry.slots[i].employeeId || "") === wantedEmployeeId) {
          return { slot: entry.slots[i], slotIndex: i };
        }
      }
    }

    return { slot: null, slotIndex: -1 };
  }

  _countPurchasedSlots(entry) {
    if (!entry || !Array.isArray(entry.slots)) return 0;
    return entry.slots.filter((s) => !!s?.purchased).length;
  }

  _nextBuySlotIndex(entry, maxSlots) {
    const limit = Math.max(0, Number(maxSlots) || 0);
    if (limit <= 0) return -1;
    for (let i = 0; i < limit; i++) {
      const slot = this._slotAt(entry, i);
      if (!slot?.purchased) return i;
    }
    return -1;
  }

  _ownedArray(u) {
    if (!u.biz || typeof u.biz !== "object") u.biz = {};
    if (!Array.isArray(u.biz.owned)) u.biz.owned = [];
    return u.biz.owned;
  }

  _findOwnedEntry(u, bizId) {
    const arr = this._ownedArray(u);
    const id = String(bizId || "");
    const idx = arr.findIndex((it) => (typeof it === "string" ? it === id : String(it?.id || "") === id));
    if (idx < 0) return { idx: -1, entry: null, arr };

    let entry = arr[idx];
    if (typeof entry === "string") {
      entry = { id: entry, boughtAt: 0, lastClaimDayUTC: "" };
      arr[idx] = entry;
    }

    if (!entry || typeof entry !== "object") {
      entry = { id, boughtAt: 0, lastClaimDayUTC: "" };
      arr[idx] = entry;
    }
    if (typeof entry.id !== "string") entry.id = id;
    if (typeof entry.boughtAt !== "number") entry.boughtAt = 0;
    if (typeof entry.lastClaimDayUTC !== "string") entry.lastClaimDayUTC = "";
    this._ensureSlots(entry, id);
    return { idx, entry, arr };
  }

  _slotIsActive(slot) {
    if (!slot || !slot.purchased) return false;
    if (!slot.employeeId) return false;
    return Number(slot.contractEnd || 0) > this.now();
  }

  _clearSlotAssignment(slot, employeeId = "") {
    if (!slot || typeof slot !== "object") return;
    slot.lastEmployeeId = String(employeeId || slot.employeeId || slot.lastEmployeeId || "");
    slot.employeeId = "";
    slot.contractStart = 0;
    slot.contractEnd = 0;
    slot.earnedTotal = 0;
    slot.bonusCarry = 0;
    slot.contractModel = CONTRACT_MODEL_LEGACY;
    slot.bgShiftMs = 0;
    slot.bgShiftPay = 0;
    slot.bgTotalShifts = 0;
    slot.bgEmployeeTotal = 0;
    slot.bgOwnerMoneyTotal = 0;
    slot.bgOwnerGemsTotal = 0;
  }

  async _loadFreePlayersIndex() {
    const raw = await this.db.get(LABOUR_FREE_PLAYERS_KEY);
    const arr = this._safeJson(raw, []);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        id: String(x?.id || ""),
        name: String(x?.name || ""),
        energyMax: Math.max(0, Number(x?.energyMax) || 0)
      }))
      .filter((x) => !!x.id);
  }

  async _saveFreePlayersIndex(arr) {
    const out = Array.isArray(arr) ? arr : [];
    await this.db.put(LABOUR_FREE_PLAYERS_KEY, JSON.stringify(out.slice(0, this._indexSize())));
  }

  _sortFreePlayers(arr) {
    arr.sort((a, b) => {
      if ((b.energyMax || 0) !== (a.energyMax || 0)) return (b.energyMax || 0) - (a.energyMax || 0);
      return 0;
    });
    return arr;
  }

  async removeFreePlayer(userId) {
    const id = String(userId || "");
    if (!id) return;
    const arr = await this._loadFreePlayersIndex();
    const next = arr.filter((x) => String(x.id) !== id);
    if (next.length !== arr.length) {
      await this._saveFreePlayersIndex(next);
    }
  }

  async upsertFreePlayer(u) {
    if (!u) return;
    this._ensureEmployment(u);

    const id = String(u.id || "");
    const name = String(u.displayName || "").trim();
    const energyMax = EnergyService.effectiveEnergyMax(u, this.now());
    if (!id) return;

    const arr = await this._loadFreePlayersIndex();
    const filtered = arr.filter((x) => String(x.id) !== id);

    if (name && !u.employment.active) {
      filtered.push({ id, name, energyMax });
    }

    this._sortFreePlayers(filtered);
    await this._saveFreePlayersIndex(filtered);
  }

  async _sendInline(chatId, text, kb, source = "ru") {
    if (!this.bot || !chatId) return;
    try {
      await this.bot.sendWithInline(chatId, text, kb || [[{ text: this._t(source, "labour.btn.menu"), callback_data: "go:Square" }]]);
    } catch {}
  }

  async _expireEmploymentForUser(user, { notify = true } = {}) {
    if (!user) return { expired: false };
    this._ensureEmployment(user);
    if (!user.employment.active) return { expired: false };
    if (this.now() <= Number(user.employment.contractEnd || 0)) return { expired: false };
    const preModel = String(user?.employment?.model || CONTRACT_MODEL_LEGACY);
    const pendingInst = user?.jobs?.active?.[0] || null;
    if (preModel !== CONTRACT_MODEL_BG_V1 && pendingInst && !pendingInst.claimed) {
      const endAt = Number(pendingInst.endAt || 0);
      if (endAt > 0 && endAt <= Number(user.employment.contractEnd || 0)) {
        return { expired: false, deferredUntilClaim: true };
      }
    }

    const ownerId = String(user.employment.ownerId || "");
    const bizId = String(user.employment.bizId || "");
    const slotIndex = this._slotIndex(user.employment.slotIndex);
    const contractModel = String(user?.employment?.model || CONTRACT_MODEL_LEGACY);
    const employmentSnapshot = { ...(user?.employment || {}) };

    let snapshotEmployeeTotal = Math.max(0, Math.floor(Number(employmentSnapshot?.bgEmployeeTotal) || 0));
    let snapshotOwnerMoneyTotal = Math.max(0, Math.floor(Number(employmentSnapshot?.bgOwnerMoneyTotal) || 0));
    let snapshotOwnerGemsTotal = Math.max(0, Math.floor(Number(employmentSnapshot?.bgOwnerGemsTotal) || 0));
    const snapshotShiftPay = Math.max(0, Number(employmentSnapshot?.bgShiftPay) || 0);
    const snapshotTotalShifts = Math.max(0, Math.floor(Number(employmentSnapshot?.bgTotalShifts) || 0));
    const snapshotOwnerPct = Math.max(
      0,
      Number(employmentSnapshot?.ownerPct) || 0,
      Number(this._slotLevelCfg(bizId, slotIndex)?.ownerPct) || 0
    );

    if (contractModel === CONTRACT_MODEL_BG_V1) {
      if (snapshotEmployeeTotal <= 0 && snapshotShiftPay > 0 && snapshotTotalShifts > 0) {
        snapshotEmployeeTotal = Math.max(0, Math.floor(snapshotShiftPay * snapshotTotalShifts));
      }
      if (snapshotOwnerMoneyTotal <= 0 && snapshotEmployeeTotal > 0 && snapshotOwnerPct > 0) {
        snapshotOwnerMoneyTotal = Math.max(0, Math.floor(snapshotEmployeeTotal * snapshotOwnerPct));
      }
      if (snapshotOwnerGemsTotal <= 0 && bizId) {
        snapshotOwnerGemsTotal = this._bgOwnerGems(bizId);
      }
      if ((snapshotEmployeeTotal <= 0 || snapshotOwnerMoneyTotal <= 0) && bizId) {
        const endAt = Math.max(0, Number(employmentSnapshot?.contractEnd) || 0);
        if (endAt > 0) {
          const days = Math.max(1, this._contractDays(bizId));
          const startAt = Math.max(0, endAt - days * DAY_MS);
          const plan = this._buildBgPlan(bizId, startAt, endAt, snapshotOwnerPct);
          if (snapshotEmployeeTotal <= 0) snapshotEmployeeTotal = Math.max(0, Math.floor(Number(plan.employeeTotal) || 0));
          if (snapshotOwnerMoneyTotal <= 0) snapshotOwnerMoneyTotal = Math.max(0, Math.floor(Number(plan.ownerMoneyTotal) || 0));
          if (snapshotOwnerGemsTotal <= 0) snapshotOwnerGemsTotal = Math.max(0, Math.floor(Number(plan.ownerGemsTotal) || 0));
        }
      }
    }

    let employeePayout = 0;
    if (contractModel === CONTRACT_MODEL_BG_V1) {
      employeePayout = snapshotEmployeeTotal;
      if (employeePayout > 0) {
        user.money = Math.max(0, Math.floor(Number(user.money) || 0)) + employeePayout;
      }
    }

    user.employment = this._inactiveEmployment();
    await this.users.save(user);

    let owner = null;
    let ownerMoneyTotal = 0;
    let ownerGemsTotal = 0;
    let legacyTotal = 0;
    let ownerQuestRes = null;
    let labourTopPayload = null;
    if (ownerId) {
      owner = await this.users.load(ownerId).catch(() => null);
      if (owner) {
        const found = this._findOwnedEntry(owner, bizId);
        let ownerDirty = false;

        if (found.entry) {
          const resolved = this._findEntrySlot(found.entry, slotIndex, user.id);
          const slot = resolved.slot;

          if (contractModel === CONTRACT_MODEL_BG_V1) {
            if (slot) {
              ownerMoneyTotal = Math.max(0, Math.floor(Number(slot.bgOwnerMoneyTotal) || 0));
              ownerGemsTotal = Math.max(0, Math.floor(Number(slot.bgOwnerGemsTotal) || 0));
              if (ownerMoneyTotal <= 0 || ownerGemsTotal <= 0) {
                const resolvedSlotIndex = resolved.slotIndex >= 0 ? resolved.slotIndex : slotIndex;
                const ownerPctForPlan = Math.max(
                  0,
                  Number(slot.ownerPct) || 0,
                  Number(this._slotLevelCfg(bizId, resolvedSlotIndex)?.ownerPct) || 0
                );
                const endAt = Math.max(0, Number(slot.contractEnd) || Number(employmentSnapshot?.contractEnd) || 0);
                if (bizId && endAt > 0) {
                  const defaultStart = Math.max(0, endAt - Math.max(1, this._contractDays(bizId)) * DAY_MS);
                  const startAt = Math.max(0, Number(slot.contractStart) || defaultStart);
                  const plan = this._buildBgPlan(bizId, startAt, endAt, ownerPctForPlan);
                  if (ownerMoneyTotal <= 0) ownerMoneyTotal = Math.max(0, Math.floor(Number(plan.ownerMoneyTotal) || 0));
                  if (ownerGemsTotal <= 0) ownerGemsTotal = Math.max(0, Math.floor(Number(plan.ownerGemsTotal) || 0));
                }
              }
              if (ownerMoneyTotal <= 0) ownerMoneyTotal = snapshotOwnerMoneyTotal;
              if (ownerGemsTotal <= 0) ownerGemsTotal = snapshotOwnerGemsTotal;
            } else {
              ownerMoneyTotal = snapshotOwnerMoneyTotal;
              ownerGemsTotal = snapshotOwnerGemsTotal;
            }
            if (ownerMoneyTotal > 0) {
              owner.money = Math.max(0, Math.floor(Number(owner.money) || 0)) + ownerMoneyTotal;
              ownerDirty = true;
            }
            if (ownerGemsTotal > 0) {
              owner.premium = Math.max(0, Math.floor(Number(owner.premium) || 0)) + ownerGemsTotal;
              ownerDirty = true;
            }
          } else if (slot) {
            legacyTotal = Math.max(0, Number(slot.earnedTotal) || 0);
          }

          if (slot && String(slot.employeeId || "") === String(user.id || "")) {
            this._clearSlotAssignment(slot, String(user.id || ""));
            ownerDirty = true;
          }
        } else if (contractModel === CONTRACT_MODEL_BG_V1) {
          ownerMoneyTotal = snapshotOwnerMoneyTotal;
          ownerGemsTotal = snapshotOwnerGemsTotal;
          if (ownerMoneyTotal > 0) {
            owner.money = Math.max(0, Math.floor(Number(owner.money) || 0)) + ownerMoneyTotal;
            ownerDirty = true;
          }
          if (ownerGemsTotal > 0) {
            owner.premium = Math.max(0, Math.floor(Number(owner.premium) || 0)) + ownerGemsTotal;
            ownerDirty = true;
          }
        }

        if (contractModel === CONTRACT_MODEL_BG_V1) {
          labourTopPayload = this._applyOwnerLabourDayIncome(owner, ownerMoneyTotal, ownerGemsTotal);
          if (labourTopPayload) ownerDirty = true;
        }

        if (contractModel === CONTRACT_MODEL_BG_V1 && this.quests?.onEvent) {
          try {
            ownerQuestRes = await this.quests.onEvent(owner, "labour_owner_contract_finish", {
              count: 1,
              bizId
            }, {
              persist: false,
              notify: false
            });
            if (ownerQuestRes?.changed) ownerDirty = true;
          } catch {}
        }

        if (ownerDirty) {
          await this.users.save(owner);
        }
        if (ownerQuestRes?.events?.length && this.quests?.notifyEvents) {
          await this.quests.notifyEvents(owner, ownerQuestRes.events);
        }
        if (labourTopPayload) {
          await this._maybeUpdateLabourDayTop(labourTopPayload);
        }
      }
    }
    await this.upsertFreePlayer(user);

    if (notify) {
      const employeeName = this._formatName(user, owner || user);
      const bizTitle = this._bizTitle(bizId, owner || user);
      if (owner?.chatId) {
        if (contractModel === CONTRACT_MODEL_BG_V1) {
          await this._sendInline(
            owner.chatId,
            this._t(owner, "labour.notify.owner_contract_finished_bg", {
              employeeName,
              money: this._money(owner, ownerMoneyTotal),
              gems: ownerGemsTotal,
              gemsEmoji: CONFIG?.PREMIUM?.emoji || "💎"
            }),
            [[{ text: this._t(owner, "labour.btn.labour"), callback_data: "go:Labour" }]],
            owner
          );
        } else {
          await this._sendInline(
            owner.chatId,
            this._t(owner, "labour.notify.owner_contract_finished", {
              employeeName,
              total: Math.max(0, Math.floor(legacyTotal))
            }),
            [[{ text: this._t(owner, "labour.btn.labour"), callback_data: "go:Labour" }]],
            owner
          );
        }
      }
      if (user?.chatId) {
        if (contractModel === CONTRACT_MODEL_BG_V1) {
          await this._sendInline(
            user.chatId,
            this._t(user, "labour.notify.employee_contract_finished_bg", {
              bizTitle,
              money: this._money(user, employeePayout)
            }),
            [[{ text: this._t(user, "labour.btn.menu"), callback_data: "go:Square" }]],
            user
          );
        } else {
          await this._sendInline(
            user.chatId,
            this._t(user, "labour.notify.employee_contract_finished", {
              bizTitle
            }),
            [[{ text: this._t(user, "labour.btn.menu"), callback_data: "go:Square" }]],
            user
          );
        }
      }
    }

    return { expired: true, ownerId, bizId, slotIndex, contractModel, employeePayout, ownerMoneyTotal, ownerGemsTotal };
  }

  async ensureEmploymentFresh(u) {
    if (!u) return u;
    await this._expireEmploymentForUser(u, { notify: true });
    return u;
  }

  async reconcileOwnerSlots(owner) {
    if (!owner) return owner;
    const arr = this._ownedArray(owner);
    let dirty = false;
    const nowTs = this.now();
    const graceMs = this._reconcileGraceMs();

    for (let i = 0; i < arr.length; i++) {
      let e = arr[i];
      if (typeof e === "string") {
        e = { id: e, boughtAt: 0, lastClaimDayUTC: "" };
        arr[i] = e;
        dirty = true;
      }
      if (!e || typeof e !== "object") continue;
      dirty = this._ensureSlots(e, e.id) || dirty;
      const slots = Array.isArray(e.slots) ? e.slots : [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        if (!slot?.purchased || !slot.employeeId) continue;
        const ownerSaysActive = Number(slot.contractEnd || 0) > nowTs;
        const inGraceWindow =
          ownerSaysActive &&
          Number(slot.contractStart || 0) > 0 &&
          (nowTs - Number(slot.contractStart || 0)) <= graceMs;

        const employee = await this.users.load(slot.employeeId).catch(() => null);
        if (!employee) {
          if (ownerSaysActive) continue;
          this._clearSlotAssignment(slot);
          dirty = true;
          continue;
        }

        this._ensureEmployment(employee);
        const active = !!employee.employment.active;
        const sameOwner = String(employee.employment.ownerId || "") === String(owner.id || "");
        const sameBiz = String(employee.employment.bizId || "") === String(e.id || "");
        const employeeSlotIdx = this._slotIndex(employee.employment.slotIndex);
        const sameSlot = employeeSlotIdx < 0 || employeeSlotIdx === slotIndex;

        if (!active || !sameOwner || !sameBiz || !sameSlot) {
          // KV can be briefly stale right after hire/update; do not clear active slot too early.
          if (inGraceWindow) continue;
          this._clearSlotAssignment(slot);
          dirty = true;
          continue;
        }

        if (Number(employee.employment.contractEnd || 0) <= nowTs) {
          await this._expireEmploymentForUser(employee, { notify: true });
          this._clearSlotAssignment(slot, String(employee.id || ""));
          dirty = true;
          continue;
        }
      }
    }

    if (dirty) {
      await this.users.save(owner);
      return owner;
    }
    return owner;
  }

  async buySlot(owner, bizId, slotIndex = -1) {
    const maxSlots = this._maxSlots(bizId);
    if (maxSlots <= 0) return { ok: false, error: this._t(owner, "labour.err.slot_unavailable") };

    owner = await this.reconcileOwnerSlots(owner);

    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) {
      return { ok: false, error: this._t(owner, "labour.err.buy_business_first") };
    }

    this._ensureSlots(found.entry, bizId);
    const purchasedCount = this._countPurchasedSlots(found.entry);
    const nextBuyIdx = this._nextBuySlotIndex(found.entry, maxSlots);
    if (nextBuyIdx < 0 || purchasedCount >= maxSlots) {
      return { ok: false, error: this._t(owner, "labour.err.max_slots_reached") };
    }

    let targetIdx = this._slotIndex(slotIndex);
    if (targetIdx < 0) targetIdx = nextBuyIdx;
    if (targetIdx >= maxSlots) {
      return { ok: false, error: this._t(owner, "labour.err.max_slots_reached") };
    }
    if (targetIdx < purchasedCount) {
      return { ok: false, error: this._t(owner, "labour.err.slot_already_bought") };
    }
    if (targetIdx !== nextBuyIdx) {
      return { ok: false, error: this._t(owner, "labour.err.buy_slot_in_order") };
    }

    const levelCfg = this._slotLevelCfg(bizId, targetIdx);
    if (!levelCfg) return { ok: false, error: this._t(owner, "labour.err.slot_unavailable") };
    const slot = this._slotAt(found.entry, targetIdx);
    if (!slot) return { ok: false, error: this._t(owner, "labour.err.slot_unavailable") };
    if (slot.purchased) return { ok: false, error: this._t(owner, "labour.err.slot_already_bought") };

    const needMoney = Math.max(0, Number(levelCfg.slotMoney) || 0);
    const needGems = Math.max(0, Number(levelCfg.slotGems) || 0);

    const haveMoney = Math.max(0, Number(owner.money) || 0);
    const haveGems = Math.max(0, Number(owner.premium) || 0);
    if (haveMoney < needMoney) return { ok: false, error: this._t(owner, "labour.err.not_enough_money") };
    if (haveGems < needGems) return { ok: false, error: this._t(owner, "labour.err.not_enough_gems") };

    owner.money = haveMoney - needMoney;
    owner.premium = haveGems - needGems;

    slot.purchased = true;
    slot.employeeId = "";
    slot.contractStart = 0;
    slot.contractEnd = 0;
    slot.earnedTotal = 0;
    slot.lastEmployeeId = String(slot.lastEmployeeId || "");
    slot.ownerPct = Math.max(0, Number(levelCfg.ownerPct) || 0);
    slot.bonusCarry = 0;

    await this.users.save(owner);
    return {
      ok: true,
      money: needMoney,
      gems: needGems,
      slotIndex: targetIdx,
      slotNum: this._slotNum(targetIdx),
      ownerPct: slot.ownerPct
    };
  }

  async getHireCandidates(owner, bizId) {
    const maxSlots = this._maxSlots(bizId);
    if (maxSlots <= 0) return [];
    const minEnergy = this._minEnergyMax(bizId);
    const limit = this._listSize();
    const index = await this._loadFreePlayersIndex();
    const out = [];

    for (const x of index) {
      if (out.length >= limit) break;
      if (String(x.id) === String(owner?.id || "")) continue;
      if ((Number(x.energyMax) || 0) < minEnergy) continue;
      if (!String(x.name || "").trim()) continue;
      out.push({
        id: String(x.id),
        name: String(x.name),
        energyMax: Math.max(0, Number(x.energyMax) || 0)
      });
    }
    return out;
  }

  async hire(owner, bizId, slotIndex, employeeId) {
    const maxSlots = this._maxSlots(bizId);
    if (maxSlots <= 0) return { ok: false, error: this._t(owner, "labour.err.slot_unavailable") };
    if (String(owner?.id || "") === String(employeeId || "")) {
      return { ok: false, error: this._t(owner, "labour.err.cannot_hire_self") };
    }

    owner = await this.reconcileOwnerSlots(owner);
    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) return { ok: false, error: this._t(owner, "labour.err.buy_business_first") };
    this._ensureSlots(found.entry, bizId);

    let targetIdx = this._slotIndex(slotIndex);
    if (targetIdx < 0) {
      targetIdx = found.entry.slots.findIndex((s) => !!s?.purchased && !this._slotIsActive(s));
      if (targetIdx < 0) targetIdx = 0;
    }
    if (targetIdx < 0 || targetIdx >= maxSlots) {
      return { ok: false, error: this._t(owner, "labour.err.slot_unavailable") };
    }

    const slot = this._slotAt(found.entry, targetIdx);
    if (!slot) return { ok: false, error: this._t(owner, "labour.err.slot_unavailable") };
    if (!slot.purchased) return { ok: false, error: this._t(owner, "labour.err.buy_slot_for_business_first") };
    if (this._slotIsActive(slot)) return { ok: false, error: this._t(owner, "labour.err.slot_busy") };

    const prevLast = String(slot.lastEmployeeId || "");
    const contractStart = this.now();
    const contractEnd = contractStart + this._contractDays(bizId) * DAY_MS;
    const ownerPctFromConfig = Math.max(0, Number(this._slotLevelCfg(bizId, targetIdx)?.ownerPct) || 0);
    const ownerPct = Math.max(0, Math.max(Number(slot.ownerPct) || 0, ownerPctFromConfig || 0));
    const bgPlan = this._buildBgPlan(bizId, contractStart, contractEnd, ownerPct);
    const minEnergy = this._minEnergyMax(bizId);
    const wantedEmployeeId = String(employeeId || "");
    slot.ownerPct = ownerPct;

    let reserved = null;
    let reserveError = "";
    await this.users.update(wantedEmployeeId, async (emp) => {
      this._ensureEmployment(emp);

      if (emp.employment.active && Number(emp.employment.contractEnd || 0) <= this.now()) {
        emp.employment = this._inactiveEmployment();
      }

      const name = String(emp.displayName || "").trim();
      if (!name) {
        reserveError = this._t(owner, "labour.err.employee_no_name");
        return emp;
      }
      if (EnergyService.effectiveEnergyMax(emp, this.now()) < minEnergy) {
        reserveError = this._t(owner, "labour.err.employee_not_enough_energy");
        return emp;
      }
      if (emp.employment.active) {
        reserveError = this._t(owner, "labour.err.employee_busy");
        return emp;
      }
      if (String(emp.id || "") === String(owner.id || "")) {
        reserveError = this._t(owner, "labour.err.cannot_hire_self");
        return emp;
      }

      emp.employment = {
        active: true,
        ownerId: String(owner.id || ""),
        bizId: String(bizId),
        ownerPct,
        contractEnd,
        slotIndex: targetIdx,
        model: CONTRACT_MODEL_BG_V1,
        bgShiftMs: bgPlan.shiftMs,
        bgShiftPay: bgPlan.shiftPay,
        bgTotalShifts: bgPlan.totalShifts,
        bgEmployeeTotal: bgPlan.employeeTotal,
        bgOwnerMoneyTotal: bgPlan.ownerMoneyTotal,
        bgOwnerGemsTotal: bgPlan.ownerGemsTotal
      };
      reserved = {
        id: String(emp.id || wantedEmployeeId),
        name,
        chatId: emp.chatId || null,
        lang: emp.lang || "ru"
      };
      return emp;
    });

    if (!reserved) {
      return { ok: false, error: reserveError || this._t(owner, "labour.err.hire_failed") };
    }

    slot.employeeId = String(reserved.id);
    slot.contractStart = contractStart;
    slot.contractEnd = contractEnd;
    slot.earnedTotal = 0;
    slot.bonusCarry = 0;
    slot.lastEmployeeId = String(reserved.id || prevLast || "");
    slot.contractModel = CONTRACT_MODEL_BG_V1;
    slot.bgShiftMs = bgPlan.shiftMs;
    slot.bgShiftPay = bgPlan.shiftPay;
    slot.bgTotalShifts = bgPlan.totalShifts;
    slot.bgEmployeeTotal = bgPlan.employeeTotal;
    slot.bgOwnerMoneyTotal = bgPlan.ownerMoneyTotal;
    slot.bgOwnerGemsTotal = bgPlan.ownerGemsTotal;

    let questRes = null;
    if (this.quests?.onEvent) {
      try {
        questRes = await this.quests.onEvent(owner, "labour_hire", {
          bizId,
          employeeId: reserved.id,
          slotIndex: targetIdx
        }, {
          persist: false,
          notify: false
        });
      } catch {}
    }

    await this.users.save(owner);
    if (questRes?.events?.length && this.quests?.notifyEvents) {
      await this.quests.notifyEvents(owner, questRes.events);
    }
    await this.removeFreePlayer(reserved.id);
    try {
      await this._markContractDue(reserved.id, contractEnd);
    } catch {}

    if (reserved.chatId) {
      const ownerName = this._formatName(owner, reserved);
      const bizTitle = this._bizTitle(bizId, reserved);
      const days = this._contractDays(bizId);
      await this._sendInline(
        reserved.chatId,
          this._t(reserved, "labour.notify.employee_hired", {
            bizTitle,
            ownerName,
            days,
            shifts: bgPlan.totalShifts,
            shiftPay: this._moneyPrecise(bgPlan.shiftPay),
            employeeTotal: this._money(reserved, bgPlan.employeeTotal)
          }),
        [[{ text: this._t(reserved, "labour.btn.work"), callback_data: "go:Work" }]],
        reserved
      );
    }

    if (owner?.chatId) {
      const employeeName = this._formatName({ id: reserved.id, displayName: reserved.name }, owner);
      const bizTitle = this._bizTitle(bizId, owner);
      await this._sendInline(
        owner.chatId,
        this._t(owner, "labour.notify.owner_hired", {
          employeeName,
          bizTitle,
          shifts: bgPlan.totalShifts,
          employeeTotal: this._money(owner, bgPlan.employeeTotal),
          ownerMoneyTotal: this._money(owner, bgPlan.ownerMoneyTotal),
          ownerGemsTotal: Math.max(0, bgPlan.ownerGemsTotal),
          gemsEmoji: CONFIG?.PREMIUM?.emoji || "💎"
        }),
        [[{ text: this._t(owner, "labour.btn.labour"), callback_data: "go:Labour" }]],
        owner
      );
    }

    return {
      ok: true,
      employeeId: reserved.id,
      employeeName: reserved.name,
      contractEnd,
      slotIndex: targetIdx,
      slotNum: this._slotNum(targetIdx),
      plan: bgPlan,
      owner
    };
  }

  async hireLast(owner, bizId, slotIndex) {
    owner = await this.reconcileOwnerSlots(owner);
    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) return { ok: false, error: this._t(owner, "labour.err.buy_business_first") };
    this._ensureSlots(found.entry, bizId);

    let targetIdx = this._slotIndex(slotIndex);
    if (targetIdx < 0) {
      targetIdx = found.entry.slots.findIndex((s) => !!s?.purchased && !!s?.lastEmployeeId && !this._slotIsActive(s));
      if (targetIdx < 0) targetIdx = 0;
    }
    const slot = this._slotAt(found.entry, targetIdx);
    if (!slot || !slot.purchased) return { ok: false, error: this._t(owner, "labour.err.buy_slot_for_business_first") };

    const lastId = String(slot.lastEmployeeId || "");
    if (!lastId) return { ok: false, error: this._t(owner, "labour.err.no_last_employee") };
    return this.hire(owner, bizId, targetIdx, lastId);
  }

  async onEmployeePaid(employee, pay, shiftEndAt) {
    this._ensureEmployment(employee);
    if (!employee.employment.active) return { ok: true, applied: false, bonus: 0 };
    if (String(employee?.employment?.model || "") === CONTRACT_MODEL_BG_V1) {
      return { ok: true, applied: false, bonus: 0, mode: CONTRACT_MODEL_BG_V1 };
    }

    const ownerId = String(employee.employment.ownerId || "");
    const bizId = String(employee.employment.bizId || "");
    let ownerPct = Math.max(0, Number(employee.employment.ownerPct) || 0);
    const slotIndex = this._slotIndex(employee.employment.slotIndex);
    const contractEnd = Number(employee.employment.contractEnd || 0);
    const endedAt = Math.max(0, Number(shiftEndAt) || 0);
    const safePay = Math.max(0, Math.floor(Number(pay) || 0));
    let employeeDirty = false;

    let applied = false;
    let bonus = 0;
    let labourTopPayload = null;
    if (safePay > 0 && endedAt > 0 && endedAt <= contractEnd && ownerId && bizId) {
      const owner = await this.users.load(ownerId).catch(() => null);
      if (owner) {
        const found = this._findOwnedEntry(owner, bizId);
        if (found.entry) {
          const resolved = this._findEntrySlot(found.entry, slotIndex, employee.id);
          const slot = resolved.slot;
          let ownerDirty = false;
          let carry = 0;

          if (slot && slot.purchased) {
            if (!slot.employeeId) {
              slot.employeeId = String(employee.id || "");
              ownerDirty = true;
            }

            const slotPct = Math.max(
              0,
              Number(slot.ownerPct) ||
              Number(this._slotLevelCfg(bizId, resolved.slotIndex)?.ownerPct) ||
              0
            );
            if (ownerPct <= 0 && slotPct > 0) {
              ownerPct = slotPct;
              employee.employment.ownerPct = slotPct;
              employeeDirty = true;
            }
            if (Number(slot.ownerPct || 0) <= 0 && ownerPct > 0) {
              slot.ownerPct = ownerPct;
              ownerDirty = true;
            }

            carry = Math.max(0, Number(slot.bonusCarry) || 0);
          }

          const rawBonus = Math.max(0, safePay * ownerPct + carry);
          bonus = Math.max(0, Math.floor(rawBonus));
          const nextCarry = Math.max(0, rawBonus - bonus);

          if (slot && slot.purchased) {
            slot.lastEmployeeId = String(employee.id || slot.lastEmployeeId || "");
            if (Math.abs(nextCarry - (Number(slot.bonusCarry) || 0)) > 1e-9) {
              slot.bonusCarry = nextCarry;
              ownerDirty = true;
            }
            if (bonus > 0) {
              slot.earnedTotal = Math.max(0, Number(slot.earnedTotal) || 0) + bonus;
              ownerDirty = true;
            }
          }

          if (bonus > 0) {
            owner.money = Math.max(0, Number(owner.money) || 0) + bonus;
            ownerDirty = true;
            applied = true;
            labourTopPayload = this._applyOwnerLabourDayIncome(owner, bonus, 0);
            if (labourTopPayload) ownerDirty = true;
          }

          if (ownerDirty) {
            await this.users.save(owner);
          }
          if (labourTopPayload) {
            await this._maybeUpdateLabourDayTop(labourTopPayload);
          }
        }
      }
    }

    if (employeeDirty) {
      await this.users.save(employee);
    }

    if (this.now() > contractEnd) {
      await this._expireEmploymentForUser(employee, { notify: true });
    }

    return { ok: true, applied, bonus };
  }

  async buildProfileEmploymentLine(u) {
    const fresh = await this.ensureEmploymentFresh(u);
    this._ensureEmployment(fresh);
    if (!fresh.employment.active) return "";

    const owner = await this.users.load(fresh.employment.ownerId).catch(() => null);
    const ownerName = owner ? this._formatName(owner, fresh) : this._t(fresh, "labour.player_generic");
    const bizTitle = this._bizTitle(fresh.employment.bizId, fresh);
    const pct = Math.max(0, Math.floor((Number(fresh.employment.ownerPct) || 0) * 100));
    const leftMs = Math.max(0, Number(fresh.employment.contractEnd || 0) - this.now());
    const leftDays = Math.max(1, Math.ceil(leftMs / DAY_MS));
    return this._t(fresh, "labour.profile.employment_line", { bizTitle, ownerName, pct, leftDays });
  }

  async buildMainView(owner) {
    owner = await this.reconcileOwnerSlots(owner);
    const langSource = owner;
    const lines = [this._t(langSource, "labour.view.title"), ""];
    const kb = [];
    const allBiz = this._businessesOrdered();

    for (const B of allBiz) {
      const maxSlots = this._maxSlots(B.id);
      if (maxSlots <= 0) continue;

      const found = this._findOwnedEntry(owner, B.id);
      const emoji = B.emoji || "🏢";
      const bizTitle = this._bizTitle(B.id, langSource);
      if (found.idx < 0 || !found.entry) {
        lines.push(this._t(langSource, "labour.main.row_unowned", { emoji, bizTitle }));
      } else {
        this._ensureSlots(found.entry, B.id);
        const bought = this._countPurchasedSlots(found.entry);
        if (bought <= 0) {
          lines.push(this._t(langSource, "labour.main.row_no_slots", {
            emoji,
            bizTitle,
            bought,
            max: maxSlots
          }));
        } else {
          const active = found.entry.slots.filter((s) => !!s?.purchased && this._slotIsActive(s)).length;
          lines.push(this._t(langSource, "labour.main.row_owned", {
            emoji,
            bizTitle,
            active,
            bought,
            max: maxSlots
          }));
        }
      }

      kb.push([{ text: `${emoji} ${bizTitle}`, callback_data: `labour:biz:${B.id}` }]);
    }

    kb.push([{ text: this._t(langSource, "labour.btn.help"), callback_data: "labour:help" }]);
    kb.push([{ text: this._t(langSource, "labour.btn.refresh"), callback_data: "go:Labour" }]);
    kb.push([{ text: this._t(langSource, "labour.btn.back_earn"), callback_data: "go:BusinessDistrict" }]);
    return { caption: lines.join("\n").trim(), keyboard: kb };
  }

  async buildHelpView(owner) {
    const langSource = owner;
    const businesses = this._businessesOrdered().filter((b) => this._maxSlots(b.id) > 0);
    const lines = [
      this._t(langSource, "labour.help.title"),
      "",
      this._t(langSource, "labour.help.line1"),
      this._t(langSource, "labour.help.line2"),
      this._t(langSource, "labour.help.line3"),
      this._t(langSource, "labour.help.line4"),
      this._t(langSource, "labour.help.line5"),
      "",
      this._t(langSource, "labour.help.line6")
    ];
    if (businesses.length) {
      const maxSlots = businesses.reduce((acc, b) => Math.max(acc, this._maxSlots(b.id)), 0);
      lines.push("");
      lines.push(this._t(langSource, "labour.help.line7", { maxSlots }));
      for (const B of businesses) {
        const first = this._slotLevelCfg(B.id, 0);
        if (!first) continue;
        const days = this._contractDays(B.id);
        const plan = this._buildBgPlan(
          B.id,
          this.now(),
          this.now() + days * DAY_MS,
          Number(first.ownerPct) || 0
        );
        lines.push(this._t(langSource, "labour.help.biz_line", {
          emoji: B.emoji || "????",
          bizTitle: this._bizTitle(B.id, langSource),
          days,
          minEnergy: this._minEnergyMax(B.id),
          money: this._money(langSource, Number(first.slotMoney) || 0),
          gemsEmoji: CONFIG?.PREMIUM?.emoji || "????",
          gems: Math.max(0, Number(first.slotGems) || 0),
          pct: Math.max(0, Math.floor((Number(first.ownerPct) || 0) * 100)),
          shiftPay: this._moneyPrecise(plan.shiftPay),
          shifts: plan.totalShifts,
          employeeTotal: this._money(langSource, plan.employeeTotal),
          ownerMoney: this._money(langSource, plan.ownerMoneyTotal),
          ownerGems: Math.max(0, plan.ownerGemsTotal)
        }));
      }
      lines.push(this._t(langSource, "labour.help.line8"));
    }

    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: this._t(langSource, "labour.btn.back_to_businesses"), callback_data: "go:Labour" }]]
    };
  }

  async buildBizView(owner, bizId, options = {}) {
    const doReconcile = options?.reconcile !== false;
    if (doReconcile) {
      owner = await this.reconcileOwnerSlots(owner);
    }
    const langSource = owner;
    const B = CONFIG?.BUSINESS?.[String(bizId || "")];
    const maxSlots = this._maxSlots(bizId);
    if (!B || maxSlots <= 0) {
      return {
        caption: this._t(langSource, "labour.err.slot_unavailable"),
        keyboard: [[{ text: this._t(langSource, "labour.btn.back_to_businesses"), callback_data: "go:Labour" }]]
      };
    }

    const emoji = B.emoji || "🏢";
    const bizTitle = this._bizTitle(bizId, langSource);
    const lines = [this._t(langSource, "labour.biz.title", { emoji, bizTitle }), ""];
    const kb = [];
    const found = this._findOwnedEntry(owner, bizId);

    if (found.idx < 0 || !found.entry) {
      lines.push(this._t(langSource, "labour.biz.unowned"));
      lines.push(this._t(langSource, "labour.biz.price", {
        price: this._money(langSource, Number(B.price) || 0)
      }));

      kb.push([{
        text: this._t(langSource, "labour.btn.buy_business", {
          price: this._money(langSource, Number(B.price) || 0)
        }),
        callback_data: `labour:buy_biz:${B.id}`
      }]);
      kb.push([{ text: this._t(langSource, "labour.btn.back_to_businesses"), callback_data: "go:Labour" }]);
      return { caption: lines.join("\n").trim(), keyboard: kb };
    }

    this._ensureSlots(found.entry, bizId);
    const bought = this._countPurchasedSlots(found.entry);
    const nextBuyIdx = this._nextBuySlotIndex(found.entry, maxSlots);
    const nowTs = this.now();

    for (let i = 0; i < bought; i++) {
      const slot = this._slotAt(found.entry, i);
      if (!slot?.purchased) continue;
      const slotNum = this._slotNum(i);
      const levelCfg = this._slotLevelCfg(B.id, i);
      const pct = Math.max(0, Math.floor(Math.max(Number(slot.ownerPct) || 0, Number(levelCfg?.ownerPct) || 0) * 100));

       if (slot.employeeId && Number(slot.contractEnd || 0) > nowTs) {
         const employee = await this.users.load(slot.employeeId).catch(() => null);
         const employeeName = employee
           ? this._formatName(employee, langSource)
           : this._t(langSource, "labour.player_short", {
               id: String(slot.employeeId).slice(-4).padStart(4, "0")
             });
         const leftTime = this._formatTimeLeftDhM(langSource, slot.contractEnd);
         let earnPart = "";

         // Prefer the employee's live model when possible (old slots might have stale contractModel).
         let model = String(slot.contractModel || "");
         if (employee?.employment?.active) {
           const sameOwner = String(employee.employment.ownerId || "") === String(owner.id || "");
           const sameBiz = String(employee.employment.bizId || "") === String(B.id || "");
           const sameSlot = this._slotIndex(employee.employment.slotIndex) === i;
           if (sameOwner && sameBiz && sameSlot) {
             model = String(employee.employment.model || model);
           }
         }

         if (model === CONTRACT_MODEL_BG_V1) {
           // For background contracts, show the fixed plan (money + gems) to the owner.
           let planMoney = Math.max(0, Math.floor(Number(slot.bgOwnerMoneyTotal) || 0));
           let planGems = Math.max(0, Math.floor(Number(slot.bgOwnerGemsTotal) || 0));
           if (planMoney <= 0 && employee?.employment?.bgOwnerMoneyTotal != null) {
             planMoney = Math.max(0, Math.floor(Number(employee.employment.bgOwnerMoneyTotal) || 0));
           }
           if (planGems <= 0 && employee?.employment?.bgOwnerGemsTotal != null) {
             planGems = Math.max(0, Math.floor(Number(employee.employment.bgOwnerGemsTotal) || 0));
           }
           // Last resort: compute from contract window and slot ownerPct (no writes, view-only).
           if ((planMoney <= 0 || planGems <= 0) && bizId) {
             const startAt = Math.max(0, Number(slot.contractStart) || 0);
             const endAt = Math.max(0, Number(slot.contractEnd) || 0);
             if (startAt > 0 && endAt > startAt) {
               const ownerPct = Math.max(0, Number(slot.ownerPct) || 0, Number(levelCfg?.ownerPct) || 0);
               const plan = this._buildBgPlan(bizId, startAt, endAt, ownerPct);
               if (planMoney <= 0) planMoney = Math.max(0, Math.floor(Number(plan.ownerMoneyTotal) || 0));
               if (planGems <= 0) planGems = Math.max(0, Math.floor(Number(plan.ownerGemsTotal) || 0));
             }
           }
           earnPart = this._t(langSource, "labour.biz.plan_part", {
             money: this._money(langSource, planMoney),
             gemsEmoji: CONFIG?.PREMIUM?.emoji || "💎",
             gems: planGems
           });
         } else {
           const earned = Math.max(0, Math.floor(Number(slot.earnedTotal) || 0));
           earnPart = earned > 0
             ? this._t(langSource, "labour.biz.earned_part", { earned: this._money(langSource, earned) })
             : "";
         }
        lines.push(this._t(langSource, "labour.biz.slot_busy", {
          slotNum,
          pct,
          employeeName,
          leftTime,
          earnPart
        }));
      } else {
        lines.push(this._t(langSource, "labour.biz.slot_free", { slotNum, pct }));
        kb.push([{
          text: this._t(langSource, "labour.btn.hire", { slotNum }),
          callback_data: `labour:hire_list:${B.id}:${i}`
        }]);

        if (slot.lastEmployeeId) {
          const lastEmployee = await this.users.load(slot.lastEmployeeId).catch(() => null);
          const rehireName = lastEmployee
            ? this._formatName(lastEmployee, langSource)
            : this._t(langSource, "labour.player_generic");
          kb.push([{
            text: this._t(langSource, "labour.btn.rehire", { slotNum, name: rehireName }),
            callback_data: `labour:rehire:${B.id}:${i}`
          }]);
        }
      }
    }

    if (nextBuyIdx >= 0) {
      const levelCfg = this._slotLevelCfg(B.id, nextBuyIdx);
      const slotNum = this._slotNum(nextBuyIdx);
      const pct = Math.max(0, Math.floor(Number(levelCfg?.ownerPct || 0) * 100));
      lines.push(this._t(langSource, "labour.biz.slot_next_buy", { slotNum, pct }));
      kb.push([{
        text: this._t(langSource, "labour.btn.buy_slot_compact", {
          slotNum,
          money: this._money(langSource, Number(levelCfg?.slotMoney) || 0),
          gemsEmoji: CONFIG?.PREMIUM?.emoji || "💎",
          gems: Math.max(0, Number(levelCfg?.slotGems) || 0)
        }),
        callback_data: `labour:buy_slot:${B.id}:${nextBuyIdx}`
      }]);
    }

    return {
      caption: lines.join("\n").trim(),
      keyboard: [
        ...kb,
        [{ text: this._t(langSource, "labour.btn.help"), callback_data: "labour:help" }],
        [{ text: this._t(langSource, "labour.btn.refresh"), callback_data: `labour:biz:${B.id}` }],
        [{ text: this._t(langSource, "labour.btn.back_to_businesses"), callback_data: "go:Labour" }]
      ]
    };
  }

  async buildHireListView(owner, bizId, slotIndex = -1) {
    owner = await this.reconcileOwnerSlots(owner);
    const langSource = owner;
    const maxSlots = this._maxSlots(bizId);
    const B = CONFIG?.BUSINESS?.[String(bizId || "")];
    const bizTitle = this._bizTitle(bizId, langSource);
    const backBtn = [{ text: this._t(langSource, "labour.btn.back_to_businesses"), callback_data: `labour:biz:${B?.id || bizId}` }];
    if (maxSlots <= 0 || !B) {
      return {
        caption: this._t(langSource, "labour.err.slot_unavailable"),
        keyboard: [backBtn]
      };
    }

    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) {
      return {
        caption: this._t(langSource, "labour.err.buy_business_first"),
        keyboard: [backBtn]
      };
    }
    this._ensureSlots(found.entry, bizId);

    let targetIdx = this._slotIndex(slotIndex);
    if (targetIdx < 0) {
      targetIdx = found.entry.slots.findIndex((s) => !!s?.purchased && !this._slotIsActive(s));
      if (targetIdx < 0) targetIdx = 0;
    }
    if (targetIdx < 0 || targetIdx >= maxSlots) {
      return {
        caption: this._t(langSource, "labour.err.slot_unavailable"),
        keyboard: [backBtn]
      };
    }

    const slot = this._slotAt(found.entry, targetIdx);
    if (!slot.purchased) {
      return {
        caption: this._t(langSource, "labour.err.buy_slot_for_business_first"),
        keyboard: [backBtn]
      };
    }
    if (this._slotIsActive(slot)) {
      return {
        caption: this._t(langSource, "labour.err.slot_busy_wait"),
        keyboard: [backBtn]
      };
    }

    const minEnergy = this._minEnergyMax(bizId);
    const slotNum = this._slotNum(targetIdx);
    const levelCfg = this._slotLevelCfg(B.id, targetIdx);
    const ownerPct = Math.max(0, Math.max(Number(slot.ownerPct) || 0, Number(levelCfg?.ownerPct) || 0));
    const contractDays = this._contractDays(bizId);
    const plan = this._buildBgPlan(
      bizId,
      this.now(),
      this.now() + contractDays * DAY_MS,
      ownerPct
    );
    const list = await this.getHireCandidates(owner, bizId);

    const lines = [
      this._t(langSource, "labour.view.pick_employee_for", { bizTitle, slotNum }),
      this._t(langSource, "labour.view.min_energy", { minEnergy }),
      this._t(langSource, "labour.view.contract_plan", {
        days: contractDays,
        shifts: plan.totalShifts,
        shiftPay: this._moneyPrecise(plan.shiftPay),
        employeeTotal: this._money(langSource, plan.employeeTotal),
        ownerPct: Math.max(0, Math.floor(ownerPct * 100)),
        ownerMoneyTotal: this._money(langSource, plan.ownerMoneyTotal),
        ownerGemsTotal: Math.max(0, plan.ownerGemsTotal),
        gemsEmoji: CONFIG?.PREMIUM?.emoji || "💎"
      }),
      ""
    ];
    const kb = [];

    if (!list.length) {
      lines.push(this._t(langSource, "labour.view.no_candidates"));
    } else {
      let i = 1;
      for (const x of list) {
        lines.push(`${i}. ${x.name} — ${x.energyMax}⚡`);
        kb.push([{ text: `✅ ${x.name} (${x.energyMax}⚡)`, callback_data: `labour:hire:${B.id}:${targetIdx}:${x.id}` }]);
        i++;
      }
    }

    kb.push(backBtn);
    return { caption: lines.join("\n").trim(), keyboard: kb };
  }
}
