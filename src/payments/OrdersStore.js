// KV-хранилище транзакций/инвойсов/агрегатов + телеметрия с TTL 60 дней.

const DAY = 24 * 60 * 60 * 1000;
const TTL_60D = 60 * 24 * 60 * 60; // в секундах (KV expirationTtl)

export class OrdersStore {
  /**
   * @param {KVNamespace} db
   * @param {() => number} [now]
   */
  constructor(db, now) {
    this.db = db;
    this.now = now || (() => Date.now());
  }

  // --- ключи ---
  _txKey(chargeId) { return `tx:${chargeId}`; }
  _invoiceKey(nonce) { return `invoice:${nonce}`; }
  _aggKey(name, dayStr) { return `agg:stars:${name}:${dayStr}`; }
  _logKey(dayStr) { return `log:stars:${dayStr}`; } // JSONL-лог (опционально, с TTL)

  _dayStr(ts = this.now()) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  // --- инвойс ---
  async markInvoiceSent(nonce, meta) {
    // полезно сохранить связь nonce → packId/userId
    await this.db.put(this._invoiceKey(nonce), JSON.stringify(meta), { expirationTtl: TTL_60D });
  }

  // --- транзакции ---
  async getTx(chargeId) {
    const raw = await this.db.get(this._txKey(chargeId));
    return raw ? JSON.parse(raw) : null;
  }

  async saveTx({ chargeId, userId, packId, gems, status, ts, invoiceId }) {
    const v = { chargeId, userId, packId, gems, status, ts, invoiceId };
    await this.db.put(this._txKey(chargeId), JSON.stringify(v)); // без TTL — журнал полезно хранить
    return v;
  }

  // --- агрегаты за день ---
  async incrAgg(name, delta = 1, ts = this.now()) {
    const key = this._aggKey(name, this._dayStr(ts));
    const val = Number(await this.db.get(key)) || 0;
    const next = val + delta;
    await this.db.put(key, String(next), { expirationTtl: TTL_60D });
    return next;
  }

  // --- лёгкая телеметрия (с TTL 60 дней) ---
  async logImpression({ userId, placement = "Square", ts = this.now() }) {
    await this.incrAgg("impression", 1, ts);
    await this._appendLog({ t: "impr", userId, placement, ts });
  }

  async logClickBuy({ userId, packId, ts = this.now() }) {
    await this.incrAgg(`click:${packId}`, 1, ts);
    await this._appendLog({ t: "click", userId, packId, ts });
  }

  async logInvoiceSent({ userId, packId, nonce, ts = this.now() }) {
    await this.incrAgg(`invoice:${packId}`, 1, ts);
    await this._appendLog({ t: "inv", userId, packId, nonce, ts });
  }

  async logSuccess({ userId, packId, gems, chargeId, invoiceId, ts = this.now() }) {
    await this.incrAgg(`success:${packId}`, 1, ts);
    await this.incrAgg(`gems:${packId}`, gems, ts);
    await this._appendLog({ t: "ok", userId, packId, gems, chargeId, invoiceId, ts });
  }

  async logCreditApplied({ userId, gems, chargeId, balanceAfter, ts = this.now() }) {
    await this.incrAgg(`applied`, 1, ts);
    await this._appendLog({ t: "applied", userId, gems, chargeId, balanceAfter, ts });
  }

  async logFail({ where, userId, packId, reason, ts = this.now() }) {
    await this.incrAgg(`fail`, 1, ts);
    await this._appendLog({ t: "fail", where, userId, packId, reason, ts });
  }
  // ===== Fast-Forward агрегаты и логи (отдельный неймспейс 'ff') =====
  _ffAggKey(name, dayStr) { return `agg:ff:${name}:${dayStr}`; }
  _ffLogKey(dayStr) { return `log:ff:${dayStr}`; }

  async incrFfAgg(name, delta = 1, ts = this.now()) {
    const key = this._ffAggKey(name, this._dayStr(ts));
    const val = Number(await this.db.get(key)) || 0;
    const next = val + delta;
    await this.db.put(key, String(next), { expirationTtl: TTL_60D });
    return next;
  }

  async logFastForward({ userId, activity, cost, balanceAfter, ts = this.now() }) {
    const key = this._ffLogKey(this._dayStr(ts));
    const line = JSON.stringify({ t: "ff", userId, act: activity, cost, balAfter: balanceAfter, ts }) + "\n";
    const prev = (await this.db.get(key)) || "";
    await this.db.put(key, prev + line, { expirationTtl: TTL_60D });
  }

  async logFastForwardFail({ userId, activity, reason, ts = this.now() }) {
    const key = this._ffLogKey(this._dayStr(ts));
    const line = JSON.stringify({ t: "ff_fail", userId, act: activity, reason, ts }) + "\n";
    const prev = (await this.db.get(key)) || "";
    await this.db.put(key, prev + line, { expirationTtl: TTL_60D });
  }

  async _appendLog(obj, ts = this.now()) {
    // JSONL-лог одного дня, с TTL 60 дней
    const key = this._logKey(this._dayStr(ts));
    const line = JSON.stringify(obj) + "\n";
    const prev = (await this.db.get(key)) || "";
    const next = (prev + line);
    // если очень большие логи — можно сделать семплинг/обрезку, но пока просто append
    await this.db.put(key, next, { expirationTtl: TTL_60D });
  }
}
