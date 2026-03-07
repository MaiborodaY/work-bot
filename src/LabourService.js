import { CONFIG } from "./GameConfig.js";

const LABOUR_FREE_PLAYERS_KEY = "labour:free_players";
const DAY_MS = 24 * 60 * 60 * 1000;

export class LabourService {
  constructor({ db, users, now, bot }) {
    this.db = db;
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
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

  _bizTitle(bizId) {
    const b = CONFIG?.BUSINESS?.[String(bizId || "")];
    if (b?.title) return String(b.title);
    return "бизнес";
  }

  _formatName(u) {
    const s = String(u?.displayName || "").trim();
    if (s) return s;
    return `Игрок #${String(u?.id || "").slice(-4).padStart(4, "0")}`;
  }

  _inactiveEmployment() {
    return { active: false, ownerId: "", bizId: "", ownerPct: 0, contractEnd: 0 };
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
    return dirty;
  }

  _emptySlot() {
    return {
      purchased: false,
      employeeId: "",
      contractStart: 0,
      contractEnd: 0,
      earnedTotal: 0,
      lastEmployeeId: ""
    };
  }

  _ensureSlot(entry) {
    if (!entry.slot || typeof entry.slot !== "object") {
      entry.slot = this._emptySlot();
      return true;
    }
    let dirty = false;
    if (typeof entry.slot.purchased !== "boolean") { entry.slot.purchased = false; dirty = true; }
    if (typeof entry.slot.employeeId !== "string") { entry.slot.employeeId = ""; dirty = true; }
    if (typeof entry.slot.contractStart !== "number") { entry.slot.contractStart = 0; dirty = true; }
    if (typeof entry.slot.contractEnd !== "number") { entry.slot.contractEnd = 0; dirty = true; }
    if (typeof entry.slot.earnedTotal !== "number") { entry.slot.earnedTotal = 0; dirty = true; }
    if (typeof entry.slot.lastEmployeeId !== "string") { entry.slot.lastEmployeeId = ""; dirty = true; }
    return dirty;
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
    this._ensureSlot(entry);
    return { idx, entry, arr };
  }

  _slotIsActive(slot) {
    if (!slot || !slot.purchased) return false;
    if (!slot.employeeId) return false;
    return Number(slot.contractEnd || 0) > this.now();
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

  async _sendInline(chatId, text, kb) {
    if (!this.bot || !chatId) return;
    try {
      await this.bot.sendWithInline(chatId, text, kb || [[{ text: "Меню", callback_data: "go:Square" }]]);
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

    user.employment = this._inactiveEmployment();
    await this.users.save(user);

    let owner = null;
    let total = 0;
    if (ownerId) {
      owner = await this.users.load(ownerId).catch(() => null);
      if (owner) {
        const found = this._findOwnedEntry(owner, bizId);
        if (found.entry) {
          const slot = found.entry.slot || this._emptySlot();
          total = Math.max(0, Number(slot.earnedTotal) || 0);
          if (String(slot.employeeId || "") === String(user.id || "")) {
            slot.lastEmployeeId = String(user.id || "");
            slot.employeeId = "";
            slot.contractStart = 0;
            slot.contractEnd = 0;
            slot.earnedTotal = 0;
            found.entry.slot = slot;
            await this.users.save(owner);
          }
        }
      }
    }

    await this.upsertFreePlayer(user);

    if (notify) {
      const employeeName = this._formatName(user);
      const bizTitle = this._bizTitle(bizId);
      if (owner?.chatId) {
        await this._sendInline(
          owner.chatId,
          `Контракт с ${employeeName} завершён.\nВсего начислено: $${Math.max(0, Math.floor(total))}.\nСлот снова свободен.`,
          [[{ text: "👔 Наёмники", callback_data: "go:Labour" }]]
        );
      }
      if (user?.chatId) {
        await this._sendInline(
          user.chatId,
          `Контракт на ${bizTitle} завершён.\nТы снова свободен — тебя могут нанять снова.`,
          [[{ text: "🧭 Меню", callback_data: "go:Square" }]]
        );
      }
    }

    return { expired: true, ownerId, bizId };
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
      this._ensureSlot(e);
      const slot = e.slot;
      if (!slot.purchased || !slot.employeeId) continue;

      const employee = await this.users.load(slot.employeeId).catch(() => null);
      if (!employee) {
        slot.lastEmployeeId = String(slot.employeeId || slot.lastEmployeeId || "");
        slot.employeeId = "";
        slot.contractStart = 0;
        slot.contractEnd = 0;
        slot.earnedTotal = 0;
        dirty = true;
        continue;
      }

      this._ensureEmployment(employee);
      const active = !!employee.employment.active;
      const sameOwner = String(employee.employment.ownerId || "") === String(owner.id || "");
      const sameBiz = String(employee.employment.bizId || "") === String(e.id || "");

      if (!active || !sameOwner || !sameBiz) {
        slot.lastEmployeeId = String(slot.employeeId || slot.lastEmployeeId || "");
        slot.employeeId = "";
        slot.contractStart = 0;
        slot.contractEnd = 0;
        slot.earnedTotal = 0;
        dirty = true;
        continue;
      }

      if (Number(employee.employment.contractEnd || 0) <= this.now()) {
        await this._expireEmploymentForUser(employee, { notify: true });
        return this.users.load(owner.id).catch(() => owner);
      }
    }

    if (dirty) {
      await this.users.save(owner);
      return this.users.load(owner.id).catch(() => owner);
    }
    return owner;
  }

  async buySlot(owner, bizId) {
    const slotCfg = this._slotCfg(bizId);
    if (!slotCfg) return { ok: false, error: "Для этого бизнеса слот недоступен." };

    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) {
      return { ok: false, error: "Сначала купи этот бизнес." };
    }

    const slot = found.entry.slot || this._emptySlot();
    if (slot.purchased) return { ok: false, error: "Слот уже куплен." };

    const needMoney = Math.max(0, Number(slotCfg.slotMoney) || 0);
    const needGems = Math.max(0, Number(slotCfg.slotGems) || 0);

    const haveMoney = Math.max(0, Number(owner.money) || 0);
    const haveGems = Math.max(0, Number(owner.premium) || 0);
    if (haveMoney < needMoney) return { ok: false, error: "Недостаточно денег." };
    if (haveGems < needGems) return { ok: false, error: "Недостаточно кристаллов." };

    owner.money = haveMoney - needMoney;
    owner.premium = haveGems - needGems;

    slot.purchased = true;
    slot.employeeId = "";
    slot.contractStart = 0;
    slot.contractEnd = 0;
    slot.earnedTotal = 0;
    slot.lastEmployeeId = String(slot.lastEmployeeId || "");
    found.entry.slot = slot;

    await this.users.save(owner);
    return { ok: true, money: needMoney, gems: needGems };
  }

  async getHireCandidates(owner, bizId) {
    const slotCfg = this._slotCfg(bizId);
    if (!slotCfg) return [];

    const minEnergy = Math.max(0, Number(slotCfg.minEnergyMax) || 0);
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

  async hire(owner, bizId, employeeId) {
    const slotCfg = this._slotCfg(bizId);
    if (!slotCfg) return { ok: false, error: "Для этого бизнеса слот недоступен." };
    if (String(owner?.id || "") === String(employeeId || "")) {
      return { ok: false, error: "Нельзя нанять самого себя." };
    }

    owner = await this.reconcileOwnerSlots(owner);
    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) return { ok: false, error: "Сначала купи этот бизнес." };
    const slot = found.entry.slot || this._emptySlot();
    if (!slot.purchased) return { ok: false, error: "Сначала купи слот работодателя." };
    if (this._slotIsActive(slot)) return { ok: false, error: "Слот уже занят." };

    const prevLast = String(slot.lastEmployeeId || "");
    const contractStart = this.now();
    const contractEnd = contractStart + Math.max(1, Number(slotCfg.contractDays) || 1) * DAY_MS;
    const ownerPct = Math.max(0, Number(slotCfg.ownerPct) || 0);
    const minEnergy = Math.max(0, Number(slotCfg.minEnergyMax) || 0);
    const wantedEmployeeId = String(employeeId || "");

    let reserved = null;
    let reserveError = "";
    await this.users.update(wantedEmployeeId, async (emp) => {
      this._ensureEmployment(emp);

      if (emp.employment.active && Number(emp.employment.contractEnd || 0) <= this.now()) {
        emp.employment = this._inactiveEmployment();
      }

      const name = String(emp.displayName || "").trim();
      if (!name) {
        reserveError = "У игрока не установлен ник.";
        return emp;
      }
      if ((Number(emp.energy_max) || 0) < minEnergy) {
        reserveError = "Недостаточно максимальной энергии для этого бизнеса.";
        return emp;
      }
      if (emp.employment.active) {
        reserveError = "Игрок уже занят в другом контракте.";
        return emp;
      }
      if (String(emp.id || "") === String(owner.id || "")) {
        reserveError = "Нельзя нанять самого себя.";
        return emp;
      }

      emp.employment = {
        active: true,
        ownerId: String(owner.id || ""),
        bizId: String(bizId),
        ownerPct,
        contractEnd
      };
      reserved = {
        id: String(emp.id || wantedEmployeeId),
        name,
        chatId: emp.chatId || null
      };
      return emp;
    });

    if (!reserved) {
      return { ok: false, error: reserveError || "Не удалось нанять игрока." };
    }

    slot.employeeId = String(reserved.id);
    slot.contractStart = contractStart;
    slot.contractEnd = contractEnd;
    slot.earnedTotal = 0;
    slot.lastEmployeeId = String(reserved.id || prevLast || "");
    found.entry.slot = slot;

    await this.users.save(owner);
    await this.removeFreePlayer(reserved.id);

    if (reserved.chatId) {
      const ownerName = this._formatName(owner);
      const bizTitle = this._bizTitle(bizId);
      const days = Math.max(1, Number(slotCfg.contractDays) || 1);
      await this._sendInline(
        reserved.chatId,
        `Тебя наняли на ${bizTitle} игрока ${ownerName}.\nКонтракт на ${days} дн.\nТы получаешь 100% своей выплаты за смены. Работай как обычно!`,
        [[{ text: "💼 Работы", callback_data: "go:Work" }]]
      );
    }

    return { ok: true, employeeId: reserved.id, employeeName: reserved.name, contractEnd };
  }

  async hireLast(owner, bizId) {
    owner = await this.reconcileOwnerSlots(owner);
    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) return { ok: false, error: "Сначала купи этот бизнес." };
    const lastId = String(found.entry?.slot?.lastEmployeeId || "");
    if (!lastId) return { ok: false, error: "Нет последнего сотрудника для этого бизнеса." };
    return this.hire(owner, bizId, lastId);
  }

  async onEmployeePaid(employee, pay, shiftEndAt) {
    this._ensureEmployment(employee);
    if (!employee.employment.active) return { ok: true, applied: false, bonus: 0 };

    const ownerId = String(employee.employment.ownerId || "");
    const bizId = String(employee.employment.bizId || "");
    const ownerPct = Math.max(0, Number(employee.employment.ownerPct) || 0);
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
            const slot = found.entry.slot || this._emptySlot();
            if (!slot.purchased) {
              slot.purchased = true;
            }
            if (!slot.employeeId) {
              slot.employeeId = String(employee.id || "");
            }
            slot.lastEmployeeId = String(employee.id || slot.lastEmployeeId || "");
            slot.earnedTotal = Math.max(0, Number(slot.earnedTotal) || 0) + bonus;
            found.entry.slot = slot;
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
    const ownerName = owner ? this._formatName(owner) : "Игрок";
    const bizTitle = this._bizTitle(fresh.employment.bizId);
    const pct = Math.max(0, Math.floor((Number(fresh.employment.ownerPct) || 0) * 100));
    const leftMs = Math.max(0, Number(fresh.employment.contractEnd || 0) - this.now());
    const leftDays = Math.max(1, Math.ceil(leftMs / DAY_MS));
    return `👔 Работаешь на: ${bizTitle} ${ownerName} (+${pct}%) • осталось ${leftDays} дн`;
  }

  async buildMainView(owner) {
    owner = await this.reconcileOwnerSlots(owner);
    const arr = this._ownedArray(owner);
    const lines = [
      "👔 Наёмники",
      "Найми игрока — получай % с каждой его смены.",
      "Он играет как обычно, ты зарабатываешь сверху.",
      "Слот покупается один раз, контракт истекает сам.",
      ""
    ];
    const kb = [];
    const nowTs = this.now();

    if (!arr.length) {
      lines.push("Сначала купи бизнес, чтобы открыть найм сотрудников.");
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]]
      };
    }

    const allBiz = Object.values(CONFIG?.BUSINESS || {});
    for (const B of allBiz) {
      const found = this._findOwnedEntry(owner, B.id);
      if (found.idx < 0 || !found.entry) continue;
      const slotCfg = this._slotCfg(B.id);
      if (!slotCfg) continue;

      const slot = found.entry.slot || this._emptySlot();
      lines.push(`${B.emoji || "🏢"} ${B.title}`);

      if (!slot.purchased) {
        lines.push("Слот: не куплен");
        lines.push(`Цена слота: $${slotCfg.slotMoney} + ${CONFIG?.PREMIUM?.emoji || "💎"}${slotCfg.slotGems}`);
        kb.push([{ text: `💳 Купить слот (${B.title})`, callback_data: `labour:buy_slot:${B.id}` }]);
        lines.push("");
        continue;
      }

      if (slot.employeeId && Number(slot.contractEnd || 0) > nowTs) {
        const employee = await this.users.load(slot.employeeId).catch(() => null);
        const employeeName = employee ? this._formatName(employee) : `Игрок #${String(slot.employeeId).slice(-4).padStart(4, "0")}`;
        const leftDays = Math.max(1, Math.ceil((Number(slot.contractEnd || 0) - nowTs) / DAY_MS));
        lines.push(`Слот: занят (${employeeName}, осталось ${leftDays} дн)`);
        lines.push(`Заработано с контракта: $${Math.max(0, Math.floor(Number(slot.earnedTotal) || 0))}`);
        lines.push("");
        continue;
      }

      lines.push("Слот: свободен");
      kb.push([{ text: `👤 Нанять (${B.title})`, callback_data: `labour:hire_list:${B.id}` }]);
      if (slot.lastEmployeeId) {
        kb.push([{ text: `🔄 Нанять снова (${B.title})`, callback_data: `labour:rehire:${B.id}` }]);
      }
      lines.push("");
    }

    kb.push([{ text: "🔄 Обновить", callback_data: "go:Labour" }]);
    kb.push([{ text: "⬅️ Назад к заработку", callback_data: "go:Earn" }]);
    return { caption: lines.join("\n").trim(), keyboard: kb };
  }

  async buildHireListView(owner, bizId) {
    owner = await this.reconcileOwnerSlots(owner);
    const slotCfg = this._slotCfg(bizId);
    const B = CONFIG?.BUSINESS?.[String(bizId || "")];
    if (!slotCfg || !B) {
      return {
        caption: "Для этого бизнеса найм недоступен.",
        keyboard: [[{ text: "⬅️ Назад", callback_data: "go:Labour" }]]
      };
    }

    const found = this._findOwnedEntry(owner, bizId);
    if (found.idx < 0 || !found.entry) {
      return {
        caption: "Сначала купи этот бизнес.",
        keyboard: [[{ text: "⬅️ Назад", callback_data: "go:Labour" }]]
      };
    }
    const slot = found.entry.slot || this._emptySlot();
    if (!slot.purchased) {
      return {
        caption: "Сначала купи слот работодателя для этого бизнеса.",
        keyboard: [[{ text: "⬅️ Назад", callback_data: "go:Labour" }]]
      };
    }
    if (this._slotIsActive(slot)) {
      return {
        caption: "Слот уже занят. Дождись завершения текущего контракта.",
        keyboard: [[{ text: "⬅️ Назад", callback_data: "go:Labour" }]]
      };
    }

    const minEnergy = Math.max(0, Number(slotCfg.minEnergyMax) || 0);
    const list = await this.getHireCandidates(owner, bizId);

    const lines = [
      `Выберите сотрудника для ${B.title}`,
      `Минимум: ${minEnergy}⚡`,
      ""
    ];
    const kb = [];

    if (!list.length) {
      lines.push("Нет свободных игроков с нужной энергией.");
    } else {
      let i = 1;
      for (const x of list) {
        lines.push(`${i}. ${x.name} — ${x.energyMax}⚡`);
        kb.push([{ text: `✅ ${x.name} (${x.energyMax}⚡)`, callback_data: `labour:hire:${B.id}:${x.id}` }]);
        i++;
      }
    }

    kb.push([{ text: "⬅️ Назад", callback_data: "go:Labour" }]);
    return { caption: lines.join("\n").trim(), keyboard: kb };
  }
}
