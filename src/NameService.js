// NameService.js — единая логика ника (промпт + обработка текста)
import { UserStore } from "./UserStore.js";

/**
 * @typedef {{ users: UserStore }} CtxDeps
 */
export class NameService {
  /** @param {CtxDeps} p */
  constructor({ users }) {
    this.users = users;
  }

  /**
   * Показать промпт. Если есть reason — выводим её как подсказку об ошибке.
   * @param {(text:string, extra?:any)=>Promise<any>} send
   * @param {string} [reason]
   */
  async prompt(send, reason = "") {
    const base =
    "📝 Укажи свой никнейм для игры простым сообщением в ответ на это\n\n" +
    "Требования: 2–16 символов; RU/UA/EN; можно цифры, пробел, «_», «.», «-».";
  
    const text = reason ? `⚠️ ${reason}\n\n${base}` : base;

    const keyboard = { inline_keyboard: [[{ text: "⬅️ На Площадь", callback_data: "go:Square" }]] };
    await send(text, { reply_markup: keyboard });
  }

  /**
   * Попробовать применить ник из текста пользователя.
   * Возвращает { ok: true, value } или { ok: false, error }.
   * @param {any} u
   * @param {string} rawText
   */
  async tryHandleText(u, rawText) {
    const s = (rawText || "").trim();
    if (!s) return { ok: false, error: "Отправь текст с никнеймом." };

    // используем существующую валидацию + сохранение из UserStore
    const res = await this.users.setDisplayName(u, s);
    if (!res.ok) return { ok: false, error: res.error || "Некорректный ник." };

    return { ok: true, value: res.value };
  }
}
