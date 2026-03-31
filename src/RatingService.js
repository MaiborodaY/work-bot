import { normalizeLang } from "./i18n/index.js";

const CATS = ["biz", "ach", "thief"];

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export class RatingService {
  constructor({ db, users, now, isAdmin = null }) {
    this.db = db || users?.db || null;
    this.users = users || null;
    this.now = now || (() => Date.now());
    this.isAdmin = (typeof isAdmin === "function") ? isAdmin : (() => false);
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "ru");
  }

  _key(cat) {
    return `rating:v1:${String(cat || "")}:top`;
  }

  _isAdminUserId(userId) {
    void userId;
    return false;
  }

  _limit() {
    return 10;
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

  _name(u, lang = "ru") {
    const s = String(u?.displayName || "").trim();
    if (s) return s;
    const id = String(u?.id || "").slice(-4).padStart(4, "0");
    if (this._lang(lang) === "en") return `Player #${id}`;
    if (this._lang(lang) === "uk") return `Гравець #${id}`;
    return `Игрок #${id}`;
  }

  _bizScore(u) {
    const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    let businesses = 0;
    let slots = 0;
    for (const e of arr) {
      const id = String(typeof e === "string" ? e : e?.id || "");
      if (id) businesses += 1;
      if (e && typeof e === "object" && Array.isArray(e.slots)) {
        slots += e.slots.filter((s) => !!s?.purchased).length;
      }
    }
    return Math.max(0, businesses + slots);
  }

  _achScore(u) {
    const earned = u?.achievements?.earned;
    if (!earned || typeof earned !== "object") return 0;
    let c = 0;
    for (const ts of Object.values(earned)) {
      if (Math.max(0, Math.floor(n(ts))) > 0) c += 1;
    }
    return c;
  }

  _thiefScore(u) {
    return Math.max(0, Math.floor(n(u?.thief?.totalStolen || u?.achievements?.progress?.totalStolen)));
  }

  scoreFor(u, cat) {
    const c = String(cat || "biz");
    if (c === "ach") return this._achScore(u);
    if (c === "thief") return this._thiefScore(u);
    return this._bizScore(u);
  }

  _sort(list) {
    list.sort((a, b) => {
      const bs = Math.max(0, Math.floor(n(b?.score)));
      const as = Math.max(0, Math.floor(n(a?.score)));
      if (bs !== as) return bs - as;
      const at = Math.max(0, Math.floor(n(a?.reachedAt)));
      const bt = Math.max(0, Math.floor(n(b?.reachedAt)));
      if (at !== bt) return at - bt;
      return String(a?.userId || "").localeCompare(String(b?.userId || ""));
    });
    return list;
  }

  _normalizeList(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    const out = [];
    for (const x of arr) {
      const userId = String(x?.userId || "").trim();
      if (!userId) continue;
      if (this._isAdminUserId(userId)) continue;
      const score = Math.max(0, Math.floor(n(x?.score)));
      if (score <= 0) continue;
      out.push({
        userId,
        name: String(x?.name || "").trim(),
        score,
        reachedAt: Math.max(0, Math.floor(n(x?.reachedAt)))
      });
    }
    return this._sort(out).slice(0, this._limit());
  }

  async _load(cat) {
    const raw = await this.db.get(this._key(cat));
    return this._normalizeList(this._safeJson(raw, []));
  }

  async _save(cat, list) {
    await this.db.put(this._key(cat), JSON.stringify(this._normalizeList(list)));
  }

  async getTop(cat) {
    if (!this.db) return [];
    const c = CATS.includes(String(cat)) ? String(cat) : "biz";
    return this._load(c);
  }

  async updateUser(u, categories = CATS) {
    if (!this.db || !u) return { updated: [] };
    const uid = String(u?.id || "").trim();
    if (!uid) return { updated: [] };
    const isAdminUser = this._isAdminUserId(uid);

    const cats = (Array.isArray(categories) ? categories : CATS)
      .map((x) => String(x))
      .filter((x, i, a) => CATS.includes(x) && a.indexOf(x) === i);

    const updated = [];
    const nowTs = this.now();
    for (const cat of cats) {
      const list = await this._load(cat);
      const next = [...list];
      const idx = next.findIndex((x) => String(x.userId) === uid);
      const score = isAdminUser ? 0 : Math.max(0, Math.floor(this.scoreFor(u, cat)));
      const name = this._name(u, u);
      let changed = false;

      if (score <= 0) {
        if (idx >= 0) {
          next.splice(idx, 1);
          changed = true;
        }
      } else if (idx >= 0) {
        const prev = next[idx];
        let reachedAt = Math.max(0, Math.floor(n(prev?.reachedAt)));
        const prevScore = Math.max(0, Math.floor(n(prev?.score)));
        if (score !== prevScore) {
          reachedAt = nowTs;
        }
        const newEntry = { userId: uid, name, score, reachedAt };
        if (
          String(prev?.name || "") !== newEntry.name ||
          prevScore !== newEntry.score ||
          Math.max(0, Math.floor(n(prev?.reachedAt))) !== newEntry.reachedAt
        ) {
          next[idx] = newEntry;
          changed = true;
        }
      } else {
        next.push({ userId: uid, name, score, reachedAt: nowTs });
        changed = true;
      }

      if (changed) {
        const sorted = this._normalizeList(next);
        const same = JSON.stringify(sorted) === JSON.stringify(list);
        if (!same) {
          await this._save(cat, sorted);
        }
        updated.push(cat);
      }
    }
    return { updated };
  }

  async rebuildAll() {
    if (!this.db || typeof this.db.list !== "function") {
      return { ok: false, scanned: 0, rebuilt: 0 };
    }
    for (const cat of CATS) {
      await this._save(cat, []);
    }

    let scanned = 0;
    let cursor = undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.db.list({ prefix: "u:", cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const key of keys) {
        const raw = await this.db.get(key.name);
        if (!raw) continue;
        let u;
        try {
          u = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!u || typeof u !== "object" || !u.id) continue;
        scanned += 1;
        await this.updateUser(u, CATS);
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    return { ok: true, scanned, rebuilt: CATS.length };
  }

  _tabLabel(cat, lang, active = false) {
    const l = this._lang(lang);
    const names = {
      ru: { biz: "🏢 Бизнес", ach: "🎖️ Ачивки", thief: "🌑 Воры" },
      uk: { biz: "🏢 Бізнес", ach: "🎖️ Досягнення", thief: "🌑 Злодії" },
      en: { biz: "🏢 Business", ach: "🎖️ Achievements", thief: "🌑 Thieves" }
    };
    const base = (names[l] && names[l][cat]) || names.ru[cat] || cat;
    return active ? `${base} ✅` : base;
  }

  _title(lang) {
    const l = this._lang(lang);
    if (l === "en") return "🏆 City rating";
    if (l === "uk") return "🏆 Рейтинг міста";
    return "🏆 Рейтинг города";
  }

  _emptyLine(lang) {
    const l = this._lang(lang);
    if (l === "en") return "No players in this rating yet.";
    if (l === "uk") return "У цьому рейтингу поки нікого немає.";
    return "В этом рейтинге пока никого нет.";
  }

  _metricLine(score, cat, lang) {
    const s = Math.max(0, Math.floor(n(score)));
    const l = this._lang(lang);
    if (cat === "thief") return `$${s}`;
    if (l === "en") return `${s} pts`;
    if (l === "uk") return `${s} очок`;
    return `${s} очков`;
  }

  _meLine({ inTop, place, score, cat, lang }) {
    const metric = this._metricLine(score, cat, lang);
    const l = this._lang(lang);
    if (inTop) {
      if (l === "en") return `👤 You — place ${place} · ${metric}`;
      if (l === "uk") return `👤 Ти — місце ${place} · ${metric}`;
      return `👤 Ты — место ${place} · ${metric}`;
    }
    if (l === "en") return `👤 You — outside top-10 · ${metric}`;
    if (l === "uk") return `👤 Ти — поза топ-10 · ${metric}`;
    return `👤 Ты — вне топ-10 · ${metric}`;
  }

  _short(raw) {
    const s = String(raw || "").trim();
    if (s.length <= 24) return s;
    return `${s.slice(0, 23)}…`;
  }

  async buildView(u, cat = "biz") {
    const lang = this._lang(u);
    const c = CATS.includes(String(cat)) ? String(cat) : "biz";
    const top = await this.getTop(c);
    const lines = [this._title(lang), ""];
    const medals = ["🥇", "🥈", "🥉"];

    if (!top.length) {
      lines.push(this._emptyLine(lang));
    } else {
      for (let i = 0; i < top.length; i++) {
        const x = top[i];
        const mark = medals[i] || `${i + 1}.`;
        lines.push(`${mark} ${x.name} — ${this._metricLine(x.score, c, lang)}`);
      }
    }

    lines.push("");
    const uid = String(u?.id || "");
    const idx = top.findIndex((x) => String(x.userId) === uid);
    const myScore = this.scoreFor(u, c);
    lines.push(this._meLine({
      inTop: idx >= 0,
      place: idx + 1,
      score: myScore,
      cat: c,
      lang
    }));

    const kb = [[
      { text: this._tabLabel("biz", lang, c === "biz"), callback_data: "rating:tab:biz" },
      { text: this._tabLabel("ach", lang, c === "ach"), callback_data: "rating:tab:ach" },
      { text: this._tabLabel("thief", lang, c === "thief"), callback_data: "rating:tab:thief" }
    ]];

    for (const x of top) {
      kb.push([{ text: this._short(x.name), callback_data: `profile:view:${x.userId}:rating` }]);
    }

    kb.push([{
      text: lang === "en" ? "🔄 Refresh" : (lang === "uk" ? "🔄 Оновити" : "🔄 Обновить"),
      callback_data: `rating:tab:${c}`
    }]);
    kb.push([{
      text: lang === "en" ? "⬅️ Back to city" : (lang === "uk" ? "⬅️ Назад до міста" : "⬅️ Назад в город"),
      callback_data: "go:City"
    }]);

    return { caption: lines.join("\n"), keyboard: kb };
  }
}
