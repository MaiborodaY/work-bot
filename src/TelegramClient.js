// Класс-обёртка для Telegram Bot API (минималистично)
export class TelegramClient {
  constructor(botToken, defaultReplyMarkup = null) {
    this.token = botToken;
    this.defaultReplyMarkup = defaultReplyMarkup;
    this.base = `https://api.telegram.org/bot${this.token}`;
  }

  async sendMessage(chatId, text, extra = {}) {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: this.defaultReplyMarkup || undefined,
      ...extra,
    };
    await fetch(`${this.base}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async sendWithInline(chatId, text, inline_keyboard) {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard },
    };
    await fetch(`${this.base}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async sendPhoto(chatId, file_id, caption, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      photo: file_id,
      caption,
      parse_mode: "HTML",
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await fetch(`${this.base}/sendPhoto`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async editMessageCaption(chatId, messageId, caption, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: "HTML",
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await fetch(`${this.base}/editMessageCaption`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
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
    await fetch(`${this.base}/editMessageMedia`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async deleteMessage(chatId, messageId) {
    await fetch(`${this.base}/deleteMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  }

  async answerCallback(callbackQueryId, text) {
    await fetch(`${this.base}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  }

  // подтверждение pre_checkout_query (обязательно для Stars)
  async answerPreCheckoutQuery(preCheckoutQueryId, ok = true, error_message = undefined) {
    const body = { pre_checkout_query_id: preCheckoutQueryId, ok };
    if (!ok && error_message) body.error_message = error_message;
    await fetch(`${this.base}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async editMessage(chatId, messageId, text, inline_keyboard = null) {
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
    };
    await fetch(`${this.base}/editMessageText`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async sendDice(chatId, emoji = "🎰") {
    const resp = await fetch(`${this.base}/sendDice`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, emoji }),
    });
    return resp.json().catch(() => ({}));
  }

  async removeKeyboard(chatId, text = "🔁 Обновляю клавиатуру…") {
    return this.sendMessage(chatId, text, { reply_markup: { remove_keyboard: true } });
  }
}
