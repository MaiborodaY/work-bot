import { CONFIG } from "./GameConfig.js";
import { normalizeLang, t } from "./i18n/index.js";

export class BarService {
  constructor({ users, now }) {
    this.users = users;
    this.now = now || (() => Date.now());
  }

  static _dayStr(ts) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  static _lang(u, lang = null) {
    return normalizeLang(lang || u?.lang || "ru");
  }

  static _t(lang, key, vars = {}) {
    return t(key, normalizeLang(lang || "ru"), vars);
  }

  _ensureBar(u) {
    if (!u.bar || typeof u.bar !== "object") {
      u.bar = { day: "", assigned: false, tasks: [] };
    } else {
      if (typeof u.bar.day !== "string") u.bar.day = "";
      if (typeof u.bar.assigned !== "boolean") u.bar.assigned = false;
      if (!Array.isArray(u.bar.tasks)) u.bar.tasks = [];
      if (u.bar.offered) delete u.bar.offered;
      if (u.bar.chosen) delete u.bar.chosen;
    }
  }

  _genTasksForDay(dayStr, u) {
    const lang = BarService._lang(u);
    const dayNum = Number(dayStr.slice(-2)) || 0;
    const odd = (dayNum % 2) === 1;
    const minStudyPaid = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
    const studyLevel = Math.max(0, Number(u?.study?.level) || 0);
    const allowC2 = studyLevel >= minStudyPaid;

    if (odd) {
      return [
        {
          id: "W1",
          title: BarService._t(lang, "bar.task.w1.title"),
          goal: 2,
          progress: 0,
          reward: { t: "premium", n: 1 },
          status: "active",
        },
        {
          id: "C1",
          title: BarService._t(lang, "bar.task.c1.title"),
          goal: 1,
          progress: 0,
          reward: { t: "energy", n: 10 },
          status: "active",
        },
      ];
    }

    return [
      {
        id: "W2",
        title: BarService._t(lang, "bar.task.w2.title"),
        goal: 60,
        progress: 0,
        reward: { t: "premium", n: 2 },
        status: "active",
      },
      allowC2
        ? {
            id: "C2",
            title: BarService._t(lang, "bar.task.c2.title"),
            goal: 3,
            progress: 0,
            reward: { t: "energy", n: 20 },
            status: "active",
          }
        : {
            id: "C1",
            title: BarService._t(lang, "bar.task.c1.title"),
            goal: 1,
            progress: 0,
            reward: { t: "energy", n: 10 },
            status: "active",
          },
    ];
  }

  static _pickVariant(variants, nowTs = Date.now()) {
    const arr = Array.isArray(variants) ? variants : [];
    if (!arr.length) return "";
    const idx = Math.abs(new Date(nowTs).getDay()) % arr.length;
    return String(arr[idx] || arr[0] || "");
  }

  static _hasEmployerSlot(u) {
    const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    return owned.some((b) => {
      if (!b || typeof b !== "object") return false;
      if (Array.isArray(b.slots)) {
        return b.slots.some((s) => !!s?.purchased);
      }
      return !!b?.slot?.purchased;
    });
  }

  static _hasAnyBusiness(u) {
    const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
    return owned.length > 0;
  }

  static _hasAnyStockHoldings(u) {
    const holdings = u?.stocks?.holdings;
    if (!holdings || typeof holdings !== "object") return false;
    return Object.keys(holdings).length > 0;
  }

  static _quoteSet(lang, prefix) {
    return [1, 2, 3].map((i) => BarService._t(lang, `${prefix}.${i}`));
  }

  static _taskTitleById(taskId, lang) {
    if (taskId === "W1") return BarService._t(lang, "bar.task.w1.title");
    if (taskId === "W2") return BarService._t(lang, "bar.task.w2.title");
    if (taskId === "C1") return BarService._t(lang, "bar.task.c1.title");
    if (taskId === "C2") return BarService._t(lang, "bar.task.c2.title");
    return "";
  }

  static getBarmanQuote(u, nowTs = Date.now()) {
    const lang = BarService._lang(u);
    const studyLevel = Math.max(0, Number(u?.study?.level) || 0);
    const gymLevel = Math.max(0, Number(u?.gym?.level) || 0);

    if (!BarService._hasAnyBusiness(u)) {
      return BarService._pickVariant(BarService._quoteSet(lang, "bar.quote.no_business"), nowTs);
    }

    if (studyLevel < 5) {
      return BarService._pickVariant(BarService._quoteSet(lang, "bar.quote.low_study"), nowTs);
    }

    if (gymLevel < 5) {
      return BarService._pickVariant(BarService._quoteSet(lang, "bar.quote.low_gym"), nowTs);
    }

    if (!BarService._hasEmployerSlot(u)) {
      return BarService._pickVariant(BarService._quoteSet(lang, "bar.quote.no_slot"), nowTs);
    }

    if (!BarService._hasAnyStockHoldings(u)) {
      return BarService._pickVariant(BarService._quoteSet(lang, "bar.quote.no_stocks"), nowTs);
    }

    return BarService._pickVariant(BarService._quoteSet(lang, "bar.quote.default"), nowTs);
  }

  ensureToday(u) {
    this._ensureBar(u);
    const today = BarService._dayStr(this.now());
    if (u.bar.day !== today) {
      u.bar.day = today;
      u.bar.assigned = true;
      u.bar.tasks = this._genTasksForDay(today, u);
      return true;
    }

    if (!u.bar.assigned) {
      u.bar.assigned = true;
      u.bar.tasks = this._genTasksForDay(today, u);
      return true;
    }

    const minStudyPaid = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
    const studyLevel = Math.max(0, Number(u?.study?.level) || 0);
    if (studyLevel < minStudyPaid && Array.isArray(u.bar.tasks)) {
      const idxC2 = u.bar.tasks.findIndex((x) => x && x.id === "C2");
      if (idxC2 !== -1) {
        const tsk = u.bar.tasks[idxC2] || {};
        const progress = Math.min(1, Math.max(0, Number(tsk.progress) || 0));
        const status =
          tsk.status === "claimed" ? "claimed" :
          progress >= 1 ? "done" : "active";

        u.bar.tasks[idxC2] = {
          id: "C1",
          title: BarService._t(BarService._lang(u), "bar.task.c1.title"),
          goal: 1,
          progress,
          reward: { t: "energy", n: 10 },
          status,
        };
        return true;
      }
    }

    if (Array.isArray(u.bar.tasks)) {
      const l = BarService._lang(u);
      let changed = false;
      for (const task of u.bar.tasks) {
        if (!task || typeof task !== "object") continue;
        const localizedTitle = BarService._taskTitleById(task.id, l);
        if (localizedTitle && task.title !== localizedTitle) {
          task.title = localizedTitle;
          changed = true;
        }
      }
      if (changed) return true;
    }

    return false;
  }

  async open(u) {
    this._ensureBar(u);
    return { ok: true, tasks: [] };
  }

  static async onWorkClaim({ u, users, now, pay = 0 }) {
    return;
  }

  static async onCasinoSpin({ u, users, now }) {
    return;
  }

  async claim(u, taskId, lang = null) {
    return { ok: false, error: "legacy_bar_tasks_disabled" };
  }
}
