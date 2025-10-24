/** @typedef {import("./OrdersStore.js").OrdersStore} OrdersStore */

export class StarsService {
  /**
   * @param {object} p
   * @param {string} p.botToken
   * @param {OrdersStore} p.orders
   * @param {() => number} [p.now]
   */
  constructor({ botToken, orders, now }) {
    this.botToken = botToken;
    this.orders = orders;
    this.now = now || (() => Date.now());
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
  }

  _nonce() {
    const ts = this.now();
    const rand = Math.random().toString(36).slice(2);
    return `inv_${ts}_${rand}`;
  }

  buildPayload({ userId, packId, nonce }) {
    return JSON.stringify({ t: "stars", userId, packId, nonce });
  }

  parsePayload(raw) {
    try {
      const p = JSON.parse(raw || "{}");
      if (p && p.t === "stars" && p.userId && p.packId && p.nonce) return p;
    } catch {}
    return null;
  }

  /**
   * Совместимый интерфейс для PremiumHandler (принимает payload без nonce).
   */
  async sendStarsInvoice({ chatId, title, description, payload, currency, prices }) {
    let parsed = null;
    try { parsed = JSON.parse(payload || "{}"); } catch {}
    const userId = parsed?.userId;
    const packId = parsed?.packId;
    const amount = Number(prices?.[0]?.amount) || 0;

    const nonce = this._nonce();
    const fullPayload = this.buildPayload({ userId, packId, nonce });

    await this.orders.markInvoiceSent(nonce, {
      userId, packId, gems: amount, ts: this.now()
    });

    const reqBody = {
      chat_id: chatId,
      title,
      description,
      payload: fullPayload,
      currency,
      prices,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      is_flexible: false
    };

    const res = await fetch(`${this.apiBase}/sendInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody)
    });

    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      await this.orders.logFail({
        where: "sendInvoice",
        userId, packId,
        reason: json.description || "unknown",
        ts: this.now()
      });
      throw new Error(`sendInvoice failed: ${json.description || res.statusText}`);
    }

    await this.orders.logInvoiceSent({ userId, packId, nonce, ts: this.now() });
    return { ok: true, nonce, message_id: json.result?.message_id };
  }

  /**
   * Базовый интерфейс: передаём pack и userId.
   */
  async sendInvoice(chatId, pack, userId) {
    const nonce = this._nonce();
    const payload = this.buildPayload({ userId, packId: pack.id, nonce });

    await this.orders.markInvoiceSent(nonce, {
      userId,
      packId: pack.id,
      gems: pack.gems,
      ts: this.now()
    });

    const reqBody = {
      chat_id: chatId,
      title: pack.label || `Пакет 💎`,
      description: pack.desc || `Пакет кристаллов ${pack.gems}`,
      payload,
      currency: "XTR",
      prices: [{ label: pack.label || "💎", amount: pack.gems }],
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      is_flexible: false
    };

    const res = await fetch(`${this.apiBase}/sendInvoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody)
    });

    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      await this.orders.logFail({
        where: "sendInvoice",
        userId,
        packId: pack.id,
        reason: json.description || "unknown",
        ts: this.now()
      });
      throw new Error(`sendInvoice failed: ${json.description || res.statusText}`);
    }

    await this.orders.logInvoiceSent({ userId, packId: pack.id, nonce, ts: this.now() });
    return { ok: true, nonce, message_id: json.result?.message_id };
  }
}
