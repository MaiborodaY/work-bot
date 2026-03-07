// NameService.js — единая логика ника (промпт + обработка текста)
import { UserStore } from "./UserStore.js";
import { normalizeLang, t } from "./i18n/index.js";

/**
 * @typedef {{ users: UserStore }} CtxDeps
 */
export class NameService {
  /** @param {CtxDeps} p */
  constructor({ users }) {
    this.users = users;
  }

  _lang(lang = "ru") {
    return normalizeLang(lang || "ru");
  }

  _t(lang, key, vars = {}) {
    return t(key, this._lang(lang), vars);
  }

  /**
   * Показать промпт. Если есть reason — выводим её как подсказку об ошибке.
   * @param {(text:string, extra?:any)=>Promise<any>} send
   * @param {string} [reason]
   * @param {string} [lang]
   */
  async prompt(send, reason = "", lang = "ru") {
    const base = this._t(lang, "worker.name.prompt");
    const text = reason ? `${this._t(lang, "worker.name.warn_prefix")} ${reason}\n\n${base}` : base;

    const keyboard = {
      inline_keyboard: [[{ text: this._t(lang, "ui.back.square"), callback_data: "go:Square" }]],
    };
    await send(text, { reply_markup: keyboard });
  }

  /**
   * Попробовать применить ник из текста пользователя.
   * Возвращает { ok: true, value } или { ok: false, error }.
   * @param {any} u
   * @param {string} rawText
   * @param {string} [lang]
   */
  async tryHandleText(u, rawText, lang = "ru") {
    const s = (rawText || "").trim();
    if (!s) return { ok: false, error: this._t(lang, "worker.name.send_text") };

    // используем существующую валидацию + сохранение из UserStore
    const res = await this.users.setDisplayName(u, s);
    if (!res.ok) {
      return { ok: false, error: res.error || this._t(lang, "worker.name.invalid") };
    }

    return { ok: true, value: res.value };
  }
}
