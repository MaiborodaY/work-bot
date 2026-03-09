import { CONFIG } from "./GameConfig.js";
import { getBusinessTitle } from "./I18nCatalog.js";
import { normalizeLang, t } from "./i18n/index.js";

const LABOUR_FREE_PLAYERS_KEY = "labour:free_players";
const DAY_MS = 24 * 60 * 60 * 1000;

export class LabourService {
  constructor({ db, users, now, bot }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
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

  _safeJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
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

  _inactiveEmployment() {
    return { active: false, ownerId: "", bizId: "", ownerPct: 0, contractEnd: 0, slotIndex: -1 };
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
    if (typeof u.employment.ownerPct !== "number") {
      u.employment.ownerPct = 0;
      dirty = true;
    }
    if (typeof u.employment.contractEnd !== "number") {
      u.employment.contractEnd = 0;
      dirty = true;
    }
    if (typeof u.employment.slotIndex !== "number" || !Number.isFinite(u.employment.slotIndex)) {
      u.employment.slotIndex = -1;
      dirty = true;
    } else {
      const idx = Math.floor(Number(u.employment.slotIndex));
      if (idx !== u.employment.slotIndex || idx < -1) {
        u.employment.slotIndex = Math.max(-1, idx);
        dirty = true;
      }
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
      ownerPct: 0
    };
  }

  _ensureSlotObject(slot) {
    if (!slot || typeof slot !== "object") {
      return { slot: this._emptySlot(), dirty: true };
    }

    let dirty = false;
    if (typeof slot.purchased !== "boolean") { slot.purchased = false; dirty = true; }
    if (typeof slot.employeeId !== "string") { slot.employeeId = ""; dirty = true; }
    if (typeof slot.contractStart !== "number") { slot.contractStart = 0; dirty = true; }
    if (typeof slot.contractEnd !== "number") { slot.contractEnd = 0; dirty = true; }
    if (typeof slot.earnedTotal !== "number") { slot.earnedTotal = 0; dirty = true; }
    if (typeof slot.lastEmployeeId !== "string") { slot.lastEmployeeId = ""; dirty = true; }
    if (typeof slot.ownerPct !== "number") { slot.ownerPct = 0; dirty = true; }
    if (!slot.purchased) {
      if (slot.employeeId || slot.contractStart || slot.contractEnd || slot.earnedTotal || slot.ownerPct) {
        slot.employeeId = "";
        slot.contractStart = 0;
        slot.contractEnd = 0;
        slot.earnedTotal = 0;
        slot.ownerPct = 0;
        dirty = true;
      }
    } else {
      const ownerPct = Math.max(0, Number(slot.ownerPct) || 0);
      if (ownerPct !== slot.ownerPct) {
        slot.ownerPct = ownerPct;
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
    const energyMax = Math.max(0, Number(u.energy_max) || 0);
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
    const pendingInst = user?.jobs?.active?.[0] || null;
    if (pendingInst && !pendingInst.claimed) {
      const endAt = Number(pendingInst.endAt || 0);
      if (endAt > 0 && endAt <= Number(user.employment.contractEnd || 0)) {
        return { expired: false, deferredUntilClaim: true };
      }
    }

    const ownerId = String(user.employment.ownerId || "");
    const bizId = String(user.employment.bizId || "");
    const slotIndex = this._slotIndex(user.employment.slotIndex);

    user.employment = this._inactiveEmployment();
    await this.users.save(user);

    let owner = null;
    let total = 0;
    if (ownerId) {
      owner = await this.users.load(ownerId).catch(() => null);
      if (owner) {
        const found = this._findOwnedEntry(owner, bizId);
        if (found.entry) {
          const resolved = this._findEntrySlot(found.entry, slotIndex, user.id);
          const slot = resolved.slot;
          if (slot) {
            total = Math.max(0, Number(slot.earnedTotal) || 0);
          }
          if (slot && String(slot.employeeId || "") === String(user.id || "")) {
            this._clearSlotAssignment(slot, String(user.id || ""));
            await this.users.save(owner);
          }
        }
      }
    }

    await this.upsertFreePlayer(user);

    if (notify) {
      const employeeName = this._formatName(user, owner || user);
      const bizTitle = this._bizTitle(bizId, owner || user);
      if (owner?.chatId) {
        await this._sendInline(
          owner.chatId,
          this._t(owner, "labour.notify.owner_contract_finished", {
            employeeName,
            total: Math.max(0, Math.floor(total))
          }),
          [[{ text: this._t(owner, "labour.btn.labour"), callback_data: "go:Labour" }]],
          owner
        );
      }
      if (user?.chatId) {
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

    return { expired: true, ownerId, bizId, slotIndex };
  }

  async ensureEmploymentFresh(u) {
    if (!u) return u;
    await this._expireEmploymentForUser(u, { notify: true });
    return this.users.load(u.id).catch(() => u);
  }

  async reconcileOwnerSlots(owner) {
    if (!owner) return owner;
    const arr = this._ownedArray(owner);
    let dirty = false;

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

        const employee = await this.users.load(slot.employeeId).catch(() => null);
        if (!employee) {
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
          this._clearSlotAssignment(slot);
          dirty = true;
          continue;
        }

        if (Number(employee.employment.contractEnd || 0) <= this.now()) {
          await this._expireEmploymentForUser(employee, { notify: true });
          return this.users.load(owner.id).catch(() => owner);
        }
      }
    }

    if (dirty) {
      await this.users.save(owner);
      return this.users.load(owner.id).catch(() => owner);
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
    const ownerPct = Math.max(0, Number(slot.ownerPct) || ownerPctFromConfig || 0);
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
      if ((Number(emp.energy_max) || 0) < minEnergy) {
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
        slotIndex: targetIdx
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
    slot.lastEmployeeId = String(reserved.id || prevLast || "");

    await this.users.save(owner);
    await this.removeFreePlayer(reserved.id);

    if (reserved.chatId) {
      const ownerName = this._formatName(owner, reserved);
      const bizTitle = this._bizTitle(bizId, reserved);
      const days = this._contractDays(bizId);
      await this._sendInline(
        reserved.chatId,
        this._t(reserved, "labour.notify.employee_hired", { bizTitle, ownerName, days }),
        [[{ text: this._t(reserved, "labour.btn.work"), callback_data: "go:Work" }]],
        reserved
      );
    }

    return {
      ok: true,
      employeeId: reserved.id,
      employeeName: reserved.name,
      contractEnd,
      slotIndex: targetIdx,
      slotNum: this._slotNum(targetIdx)
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

    const ownerId = String(employee.employment.ownerId || "");
    const bizId = String(employee.employment.bizId || "");
    const ownerPct = Math.max(0, Number(employee.employment.ownerPct) || 0);
    const slotIndex = this._slotIndex(employee.employment.slotIndex);
    const contractEnd = Number(employee.employment.contractEnd || 0);
    const endedAt = Math.max(0, Number(shiftEndAt) || 0);
    const safePay = Math.max(0, Math.floor(Number(pay) || 0));

    let applied = false;
    let bonus = 0;
    if (safePay > 0 && endedAt > 0 && endedAt <= contractEnd && ownerId && bizId) {
      bonus = Math.max(0, Math.floor(safePay * ownerPct));
      if (bonus > 0) {
        const owner = await this.users.load(ownerId).catch(() => null);
        if (owner) {
          const found = this._findOwnedEntry(owner, bizId);
          if (found.entry) {
            const resolved = this._findEntrySlot(found.entry, slotIndex, employee.id);
            const slot = resolved.slot;
            if (slot && slot.purchased) {
              if (!slot.employeeId) {
                slot.employeeId = String(employee.id || "");
              }
              if (Number(slot.ownerPct || 0) <= 0) {
                slot.ownerPct = ownerPct;
              }
              slot.lastEmployeeId = String(employee.id || slot.lastEmployeeId || "");
              slot.earnedTotal = Math.max(0, Number(slot.earnedTotal) || 0) + bonus;
            }
            owner.money = Math.max(0, Number(owner.money) || 0) + bonus;
            await this.users.save(owner);
            applied = true;
          }
        }
      }
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
    const arr = this._ownedArray(owner);
    const lines = [
      this._t(langSource, "labour.view.title"),
      this._t(langSource, "labour.view.line1"),
      this._t(langSource, "labour.view.line2"),
      this._t(langSource, "labour.view.line3"),
      ""
    ];
    const kb = [];
    const nowTs = this.now();

    if (!arr.length) {
      lines.push(this._t(langSource, "labour.view.need_business"));
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: this._t(langSource, "labour.btn.back_earn"), callback_data: "go:Earn" }]]
      };
    }

    const allBiz = Object.values(CONFIG?.BUSINESS || {});
    for (const B of allBiz) {
      const found = this._findOwnedEntry(owner, B.id);
      if (found.idx < 0 || !found.entry) continue;
      const maxSlots = this._maxSlots(B.id);
      if (maxSlots <= 0) continue;

      this._ensureSlots(found.entry, B.id);
      const nextBuyIdx = this._nextBuySlotIndex(found.entry, maxSlots);
      const bizTitle = this._bizTitle(B.id, langSource);

      lines.push(`${B.emoji || "🏢"} ${bizTitle}`);
      for (let slotIndex = 0; slotIndex < maxSlots; slotIndex++) {
        const slot = this._slotAt(found.entry, slotIndex);
        const slotNum = this._slotNum(slotIndex);
        const levelCfg = this._slotLevelCfg(B.id, slotIndex);
        const pct = Math.max(0, Math.floor((Number(slot?.ownerPct) || Number(levelCfg?.ownerPct) || 0) * 100));

        if (!slot?.purchased) {
          lines.push(this._t(langSource, "labour.view.slot_not_bought", { slotNum, pct }));
          lines.push(this._t(langSource, "labour.view.slot_price", {
            slotNum,
            money: Math.max(0, Number(levelCfg?.slotMoney) || 0),
            gemsEmoji: CONFIG?.PREMIUM?.emoji || "💎",
            gems: Math.max(0, Number(levelCfg?.slotGems) || 0),
            pct
          }));
          if (slotIndex === nextBuyIdx) {
            kb.push([{
              text: this._t(langSource, "labour.btn.buy_slot", { bizTitle, slotNum }),
              callback_data: `labour:buy_slot:${B.id}:${slotIndex}`
            }]);
          }
          continue;
        }

        if (slot.employeeId && Number(slot.contractEnd || 0) > nowTs) {
          const employee = await this.users.load(slot.employeeId).catch(() => null);
          const employeeName = employee
            ? this._formatName(employee, langSource)
            : this._t(langSource, "labour.player_short", {
                id: String(slot.employeeId).slice(-4).padStart(4, "0")
              });
          const leftDays = Math.max(1, Math.ceil((Number(slot.contractEnd || 0) - nowTs) / DAY_MS));
          lines.push(this._t(langSource, "labour.view.slot_busy", { slotNum, employeeName, leftDays, pct }));
          lines.push(this._t(langSource, "labour.view.earned_total", {
            total: Math.max(0, Math.floor(Number(slot.earnedTotal) || 0))
          }));
          continue;
        }

        lines.push(this._t(langSource, "labour.view.slot_free", { slotNum, pct }));
        kb.push([{
          text: this._t(langSource, "labour.btn.hire", { bizTitle, slotNum }),
          callback_data: `labour:hire_list:${B.id}:${slotIndex}`
        }]);
        if (slot.lastEmployeeId) {
          const lastEmployee = await this.users.load(slot.lastEmployeeId).catch(() => null);
          const rehireName = lastEmployee
            ? this._formatName(lastEmployee, langSource)
            : this._t(langSource, "labour.player_generic");
          kb.push([{
            text: this._t(langSource, "labour.btn.rehire", { bizTitle, slotNum, name: rehireName }),
            callback_data: `labour:rehire:${B.id}:${slotIndex}`
          }]);
        }
      }
      lines.push("");
    }

    kb.push([{ text: this._t(langSource, "labour.btn.help"), callback_data: "labour:help" }]);
    kb.push([{ text: this._t(langSource, "labour.btn.refresh"), callback_data: "go:Labour" }]);
    kb.push([{ text: this._t(langSource, "labour.btn.back_earn"), callback_data: "go:Earn" }]);
    return { caption: lines.join("\n").trim(), keyboard: kb };
  }

  async buildHelpView(owner) {
    const langSource = owner;
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

    return {
      caption: lines.join("\n"),
      keyboard: [[{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]]
    };
  }

  async buildHireListView(owner, bizId, slotIndex = -1) {
    owner = await this.reconcileOwnerSlots(owner);
    const langSource = owner;
    const maxSlots = this._maxSlots(bizId);
    const B = CONFIG?.BUSINESS?.[String(bizId || "")];
    const bizTitle = this._bizTitle(bizId, langSource);
    if (maxSlots <= 0 || !B) {
      return {
        caption: this._t(langSource, "labour.err.slot_unavailable"),
        keyboard: [[{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]]
      };
    }

    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) {
      return {
        caption: this._t(langSource, "labour.err.buy_business_first"),
        keyboard: [[{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]]
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
        keyboard: [[{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]]
      };
    }

    const slot = this._slotAt(found.entry, targetIdx);
    if (!slot.purchased) {
      return {
        caption: this._t(langSource, "labour.err.buy_slot_for_business_first"),
        keyboard: [[{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]]
      };
    }
    if (this._slotIsActive(slot)) {
      return {
        caption: this._t(langSource, "labour.err.slot_busy_wait"),
        keyboard: [[{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]]
      };
    }

    const minEnergy = this._minEnergyMax(bizId);
    const slotNum = this._slotNum(targetIdx);
    const list = await this.getHireCandidates(owner, bizId);

    const lines = [
      this._t(langSource, "labour.view.pick_employee_for", { bizTitle, slotNum }),
      this._t(langSource, "labour.view.min_energy", { minEnergy }),
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

    kb.push([{ text: this._t(langSource, "labour.btn.back"), callback_data: "go:Labour" }]);
    return { caption: lines.join("\n").trim(), keyboard: kb };
  }
}
