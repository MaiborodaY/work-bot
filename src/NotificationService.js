// @ts-check
import { CONFIG } from "./GameConfig.js";
import { NotifyDueIndex } from "./NotifyDueIndex.js";
import { normalizeLang, t } from "./i18n/index.js";
import { getJobTitle } from "./I18nCatalog.js";

const DUE_LOOKBACK_MINUTES = 15;
const FALLBACK_SCAN_EVERY_HOURS = 6;

/**
 * Фоновые уведомления: «смена закончилась — забери деньги».
 * Поддерживает только новую схему:
 *  u.jobs.active[0] { endAt, claimed, notified, typeId }
 *
 * Требования к отправке:
 *  - u.chatId есть
 *  - смена завершена
 *  - не уведомляли уже (jobs.active[0].notified === false)
 */
export class NotificationService {
  /**
   * @param {{
   *   users: any,                    // UserStore (get/save, listAll? — опционально)
   *   bot: any,                      // TelegramClient (sendWithInline(chatId, text, kb))
   *   db?: KVNamespace,              // env.DB — если нужно сканировать напрямую
   *   now?: ()=>number,              // время (по-умолчанию Date.now)
   *   kvPrefix?: string,             // явный префикс ключей (например "u:")
   *   economy?: any,                 // EconomyService (для старой схемы)
   *   debug?: boolean                // подробные логи
   * }} deps
   */
  constructor({ users, bot, db, now, kvPrefix, economy, debug }) {
    this.users = users;
    this.bot = bot;
    this.db = db || (users && users.db) || null;
    this.now = now || (() => Date.now());
    this.kvPrefix = kvPrefix;
    this.economy = economy; // не используется в новой схеме; оставляем для совместимости сигнатуры
    this.debug = !!debug;

    this.dueIndex = (this.db && typeof this.db.list === "function")
      ? new NotifyDueIndex({ db: this.db, now: this.now })
      : null;

    this.ctaList = Array.isArray(CONFIG?.NOTIFY?.CLAIM_CTA)
      ? CONFIG.NOTIFY.CLAIM_CTA
      : [
          "notify.cta.1",
          "notify.cta.2",
          "notify.cta.3",
          "notify.cta.4",
          "notify.cta.5",
          "notify.cta.6",
        ];
  }

  _lang(u) {
    return normalizeLang(u?.lang || "ru");
  }

  _t(u, key, vars = {}) {
    return t(key, this._lang(u), vars);
  }

  /** Основной запуск */
  async run() {
    const ready = await this._fetchReadyUsers();

    if (this.debug) {
      try { console.log("notify.debug.ready_ids", ready.map(u => u.id)); } catch {}
    } else if (ready.length) {
      try { console.log(`notify.ready_count=${ready.length}`); } catch {}
    }

    for (const u of ready) {
      try {
        const now = this.now();
        let changed = false;

        const inst = u?.jobs?.active?.[0];
        if (this._hasReadyWork(u, now)) {
          const jobTitle = getJobTitle(inst?.typeId, this._lang(u)) || inst?.title || this._t(u, "notify.work.shift_fallback");
          const text = this._t(u, "notify.work.ready", { title: jobTitle });
          const cta = this._nextCta(u);
          await this.bot.sendWithInline(u.chatId, text, [[{ text: cta, callback_data: "go:Work" }]]);
          if (inst && !inst.notified) {
            inst.notified = true;
            changed = true;
          }
        }

        if (this._hasReadyStudy(u, now)) {
          const textS = this._t(u, "notify.study.ready");
          await this.bot.sendWithInline(u.chatId, textS, [[{ text: this._t(u, "notify.btn.go_study"), callback_data: "go:Study" }]]);
          if (u.study && !u.study.notified) {
            u.study.notified = true;
            changed = true;
          }
        }

        if (this._hasReadyGym(u, now)) {
          const textG = this._t(u, "notify.gym.ready");
          await this.bot.sendWithInline(u.chatId, textG, [[{ text: this._t(u, "notify.btn.go_gym"), callback_data: "go:Gym" }]]);
          if (u.gym && !u.gym.notified) {
            u.gym.notified = true;
            changed = true;
          }
        }

        if (changed) {
          await this.users.save(u);
        }
      } catch (e) {
        console.error("notify.error", e?.message || e);
      }
    }
  }

  // ====== internals ======

  _hasReadyWork(u, now) {
    const inst = u?.jobs?.active?.[0];
    if (!inst) return false;
    if (!u.chatId) return false;
    if (inst.claimed) return false;
    if (inst.notified) return false;
    if (now < inst.endAt) return false;
    return true;
  }

  _hasReadyStudy(u, now) {
    const st = u?.study;
    if (!st || st.active !== true) return false;
    if (!u.chatId) return false;
    if (st.notified) return false;
    if (!Number.isFinite(st.endAt)) return false;
    if (now < st.endAt) return false;
    return true;
  }

  _hasReadyGym(u, now) {
    const g = u?.gym;
    if (!g || !g.active) return false;
    if (!u.chatId) return false;
    if (g.notified) return false;
    if (now < (g.endAt || 0)) return false;
    return true;
  }

  _isFallbackScanWindow(nowTs) {
    const d = new Date(nowTs);
    return d.getUTCMinutes() === 0 && (d.getUTCHours() % FALLBACK_SCAN_EVERY_HOURS === 0);
  }

  async _fetchReadyUsers() {
    const now = this.now();

    if (this.dueIndex && !this._isFallbackScanWindow(now)) {
      try {
        const out = await this._fetchByDueIndex(now);
        if (this.debug) {
          try { console.log(`notify.debug.due.ready=${out.length}`); } catch {}
        }
        return out;
      } catch (e) {
        if (this.debug) {
          try { console.log("notify.debug.due.error", e?.message || e); } catch {}
        }
      }
    }

    return this._fetchReadyUsersByFullScan(now);
  }

  async _fetchByDueIndex(nowTs) {
    if (!this.dueIndex) return [];

    const ids = await this.dueIndex.collectDueUserIds({
      nowTs,
      lookbackMinutes: DUE_LOOKBACK_MINUTES,
    });

    if (!ids.length) return [];

    const out = [];
    for (const id of ids) {
      let u = null;

      if (typeof this.users?.load === "function") {
        u = await this.users.load(id).catch(() => null);
      } else if (this.db && typeof this.db.get === "function") {
        const raw = await this.db.get(`u:${id}`);
        if (raw) {
          try { u = JSON.parse(raw); } catch {}
        }
      }

      if (!u) continue;
      if (this._hasReadyWork(u, nowTs) || this._hasReadyStudy(u, nowTs) || this._hasReadyGym(u, nowTs)) {
        out.push(u);
      }
    }

    return out;
  }

  async _fetchReadyUsersByFullScan(now) {
    if (typeof this.users?.listAll === "function") {
      const out = [];
      const all = await this.users.listAll();
      for (const u of all) {
        if (this._hasReadyWork(u, now) || this._hasReadyStudy(u, now) || this._hasReadyGym(u, now)) {
          out.push(u);
        }
      }
      return out;
    }

    if (!this.db || typeof this.db.list !== "function") return [];

    const prefixes = this._candidatePrefixes();
    for (const prefix of prefixes) {
      const found = await this._scanKv(prefix, now);
      if (found.length) {
        if (this.debug) {
          try { console.log(`notify.debug.scan.hit prefix="${prefix}" users=${found.length}`); } catch {}
        }
        return found;
      }
      if (this.debug) {
        try { console.log(`notify.debug.scan.empty prefix="${prefix}"`); } catch {}
      }
    }
    return [];
  }

  _candidatePrefixes() {
    const list = [];
    if (typeof this.kvPrefix === "string") list.push(this.kvPrefix);
    list.push("u:", "user:", "users:", "");
    return [...new Set(list)];
  }

  async _scanKv(prefix, now) {
    const out = [];
    let cursor = undefined;
    let scanned = 0;

    do {
      const page = await this.db.list({ prefix, cursor });
      cursor = page.cursor;

      const keys = page.keys || [];
      scanned += keys.length;

      for (const k of keys) {
        const raw = await this.db.get(k.name);
        if (!raw) continue;
        let u;
        try { u = JSON.parse(raw); } catch { continue; }
        if (this._hasReadyWork(u, now) || this._hasReadyStudy(u, now) || this._hasReadyGym(u, now)) {
          out.push(u);
        }
      }
    } while (cursor);

    if (this.debug) {
      try { console.log(`notify.debug.scan prefix="${prefix}" scanned=${scanned} ready=${out.length}`); } catch {}
    }
    return out;
  }

  _nextCta(u) {
    const arr = this.ctaList;
    if (!arr.length) return this._t(u, "notify.cta.fallback");
    if (!u.notify) u.notify = {};
    const i = Number.isInteger(u.notify.ctaIndex) ? u.notify.ctaIndex : 0;
    const idx = (i % arr.length + arr.length) % arr.length;
    const fallbackText = arr[idx];
    if (typeof fallbackText === "string" && /^notify\.cta\.\d+$/.test(fallbackText)) {
      u.notify.ctaIndex = (i + 1) % arr.length;
      return this._t(u, fallbackText);
    }
    const key = `notify.cta.${idx + 1}`;
    const localized = this._t(u, key);
    const text = localized && localized !== key
      ? localized
      : (this._lang(u) === "ru" ? fallbackText : this._t(u, "notify.cta.fallback"));
    u.notify.ctaIndex = (i + 1) % arr.length;
    return text;
  }
}
