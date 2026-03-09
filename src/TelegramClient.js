// Класс-обёртка для Telegram Bot API (минималистично)
export class TelegramClient {
  constructor(botToken, defaultReplyMarkup = null) {
    this.token = botToken;
    this.defaultReplyMarkup = defaultReplyMarkup;
    this.base = `https://api.telegram.org/bot${this.token}`;
  }

  async _call(method, body) {
    const resp = await fetch(`${this.base}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    let payload = null;
    try {
      payload = await resp.json();
    } catch {
      payload = null;
    }

    if (!resp.ok) {
      throw new Error(`Telegram HTTP ${resp.status} on ${method}`);
    }
    if (!payload || payload.ok !== true) {
      const desc = String(payload?.description || "unknown telegram error");
      throw new Error(`Telegram API ${method} failed: ${desc}`);
    }
    return payload;
  }

  async sendMessage(chatId, text, extra = {}) {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: this.defaultReplyMarkup || undefined,
      ...extra,
    };
    await this._call("sendMessage", body);
  }

  async sendWithInline(chatId, text, inline_keyboard) {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard },
    };
    await this._call("sendMessage", body);
  }

  async sendPhoto(chatId, file_id, caption, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      photo: file_id,
      caption,
      parse_mode: "HTML",
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await this._call("sendPhoto", body);
  }

  async editMessageCaption(chatId, messageId, caption, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: "HTML",
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await this._call("editMessageCaption", body);
  }

  async editMessageMedia(chatId, messageId, file_id, caption = null, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      media: {
        type: "photo",
        media: file_id,
        caption: caption || undefined,
        parse_mode: "HTML",
      },
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await this._call("editMessageMedia", body);
  }

  async deleteMessage(chatId, messageId) {
    await this._call("deleteMessage", { chat_id: chatId, message_id: messageId });
  }

  async answerCallback(callbackQueryId, text) {
    // answerCallbackQuery может падать, если query устарел; не ломаем основной flow.
    try {
      await this._call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
    } catch {}
  }

  // Send a game message using Telegram Games platform
  async sendGame(chatId, gameShortName) {
    const body = { chat_id: chatId, game_short_name: gameShortName };
    await this._call("sendGame", body);
  }

  // Answer callback_query with URL to open the game
  async answerCallbackUrl(callbackQueryId, url) {
    const body = { callback_query_id: callbackQueryId, url };
    await this._call("answerCallbackQuery", body);
  }

  // подтверждение pre_checkout_query (обязательно для Stars)
  async answerPreCheckoutQuery(preCheckoutQueryId, ok = true, error_message = undefined) {
    const body = { pre_checkout_query_id: preCheckoutQueryId, ok };
    if (!ok && error_message) body.error_message = error_message;
    await this._call("answerPreCheckoutQuery", body);
  }

  async editMessage(chatId, messageId, text, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await this._call("editMessageText", body);
  }

  async sendDice(chatId, emoji = "🎰") {
    return this._call("sendDice", { chat_id: chatId, emoji });
  }

  async removeKeyboard(chatId, text = "🔁 Обновляю клавиатуру…") {
    return this.sendMessage(chatId, text, { reply_markup: { remove_keyboard: true } });
  }
}
