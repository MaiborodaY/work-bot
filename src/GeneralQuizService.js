import { CONFIG } from "./GameConfig.js";
import { normalizeLang, formatMoney } from "./i18n/index.js";
import { buildGeneralQuizCatalogByDifficulty } from "./GeneralQuizCatalog.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function toInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function dayStr(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function seed() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromSeed(seed) {
  const seedFn = xmur3(String(seed || ""));
  return mulberry32(seedFn());
}

function shuffleDeterministic(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class GeneralQuizService {
  constructor({ users, now, bot = null }) {
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "en");
  }

  _cfg() {
    return CONFIG?.QUIZ_GENERAL || {};
  }

  _questionsPerDay() {
    return Math.max(1, toInt(this._cfg().QUESTIONS_PER_DAY, 3));
  }

  _difficultyIds() {
    return ["easy", "medium", "hard"];
  }

  _defaultDifficulty() {
    const raw = String(this._cfg().DEFAULT_DIFFICULTY || "easy").toLowerCase();
    return this._difficultyIds().includes(raw) ? raw : "easy";
  }

  _normalizeDifficulty(value) {
    const raw = String(value || "").toLowerCase().trim();
    return this._difficultyIds().includes(raw) ? raw : "";
  }

  _hardMinStudyLevel() {
    return Math.max(0, toInt(this._cfg().HARD_MIN_STUDY_LEVEL, 15));
  }

  _difficultyCfg(difficulty) {
    const d = this._normalizeDifficulty(difficulty) || this._defaultDifficulty();
    const all = (this._cfg().DIFFICULTIES && typeof this._cfg().DIFFICULTIES === "object")
      ? this._cfg().DIFFICULTIES
      : {};
    const row = (all[d] && typeof all[d] === "object") ? all[d] : {};
    return {
      id: d,
      rewardPerCorrect: Math.max(0, toInt(row.rewardPerCorrect, this._cfg().REWARD_MONEY_PER_CORRECT ?? 100)),
      perfectBonusMoney: Math.max(0, toInt(row.perfectBonusMoney, this._cfg().PERFECT_BONUS_MONEY ?? 200))
    };
  }

  _rewardMoneyPerCorrect(difficulty) {
    return this._difficultyCfg(difficulty).rewardPerCorrect;
  }

  _perfectBonusMoney(difficulty) {
    return this._difficultyCfg(difficulty).perfectBonusMoney;
  }

  _difficultyLabel(lang, difficulty) {
    const l = this._lang(lang);
    const d = this._normalizeDifficulty(difficulty) || this._defaultDifficulty();
    if (l === "ru") {
      if (d === "easy") return "\u041b\u0451\u0433\u043a\u0430\u044f";
      if (d === "medium") return "\u0421\u0440\u0435\u0434\u043d\u044f\u044f";
      return "\u0421\u043b\u043e\u0436\u043d\u0430\u044f";
    }
    if (l === "uk") {
      if (d === "easy") return "\u041b\u0435\u0433\u043a\u0430";
      if (d === "medium") return "\u0421\u0435\u0440\u0435\u0434\u043d\u044f";
      return "\u0421\u043a\u043b\u0430\u0434\u043d\u0430";
    }
    if (d === "easy") return "Easy";
    if (d === "medium") return "Medium";
    return "Hard";
  }

  _catalog(difficulty = this._defaultDifficulty()) {
    return buildGeneralQuizCatalogByDifficulty(difficulty);
  }

  _catalogMap(difficulty = this._defaultDifficulty()) {
    return new Map(this._catalog(difficulty).map((q) => [q.id, q]));
  }

  _today() {
    return dayStr(this.now());
  }

  _ensureModel(u) {
    if (!u || typeof u !== "object") return false;
    let dirty = false;

    if (!u.quizGeneral || typeof u.quizGeneral !== "object") {
      u.quizGeneral = {};
      dirty = true;
    }

    const q = u.quizGeneral;
    if (typeof q.day !== "string") { q.day = ""; dirty = true; }
    if (!Array.isArray(q.questionIds)) { q.questionIds = []; dirty = true; }
    if (!Array.isArray(q.optionOrder)) { q.optionOrder = []; dirty = true; }
    if (typeof q.currentIndex !== "number" || !Number.isFinite(q.currentIndex)) { q.currentIndex = 0; dirty = true; }
    if (!Array.isArray(q.answers)) { q.answers = []; dirty = true; }
    if (typeof q.done !== "boolean") { q.done = false; dirty = true; }
    if (typeof q.correctTotal !== "number" || !Number.isFinite(q.correctTotal)) { q.correctTotal = 0; dirty = true; }
    if (typeof q.playedTotal !== "number" || !Number.isFinite(q.playedTotal)) { q.playedTotal = 0; dirty = true; }
    if (typeof q.perfectTotal !== "number" || !Number.isFinite(q.perfectTotal)) { q.perfectTotal = 0; dirty = true; }
    if (typeof q.difficulty !== "string") { q.difficulty = ""; dirty = true; }
    if (!q.byDifficulty || typeof q.byDifficulty !== "object") { q.byDifficulty = {}; dirty = true; }

    q.currentIndex = Math.max(0, toInt(q.currentIndex, 0));
    q.correctTotal = Math.max(0, toInt(q.correctTotal, 0));
    q.playedTotal = Math.max(0, toInt(q.playedTotal, 0));
    q.perfectTotal = Math.max(0, toInt(q.perfectTotal, 0));
    q.answers = q.answers.map((x) => !!x);
    q.difficulty = this._normalizeDifficulty(q.difficulty);
    for (const id of this._difficultyIds()) {
      const row = (q.byDifficulty?.[id] && typeof q.byDifficulty[id] === "object") ? q.byDifficulty[id] : null;
      if (!row) {
        q.byDifficulty[id] = { playedTotal: 0, perfectTotal: 0 };
        dirty = true;
        continue;
      }
      const p = Math.max(0, toInt(row.playedTotal, 0));
      const pf = Math.max(0, toInt(row.perfectTotal, 0));
      if (p !== row.playedTotal || pf !== row.perfectTotal) dirty = true;
      q.byDifficulty[id] = { playedTotal: p, perfectTotal: pf };
    }

    return dirty;
  }

  _pickQuestionIds(day, difficulty = this._defaultDifficulty()) {
    const ids = this._catalog(difficulty).map((q) => q.id);
    const count = Math.min(this._questionsPerDay(), ids.length);
    const rng = rngFromSeed(`gquiz:${day}:${String(difficulty || "easy")}:questions`);
    return shuffleDeterministic(ids, rng).slice(0, count);
  }

  _pickOptionOrder(day, questionId, optionCount) {
    const base = Array.from({ length: Math.max(1, optionCount) }, (_, i) => i);
    const rng = rngFromSeed(`gquiz:${day}:${questionId}:options`);
    return shuffleDeterministic(base, rng);
  }

  async ensureSession(u, { persist = false } = {}) {
    let dirty = this._ensureModel(u);
    const day = this._today();
    const planDifficulty = this._normalizeDifficulty(u?.quizGeneral?.difficulty) || this._defaultDifficulty();
    const map = this._catalogMap(planDifficulty);

    const regen = ({ resetDifficulty = false } = {}) => {
      const ids = this._pickQuestionIds(day, planDifficulty);
      u.quizGeneral.day = day;
      u.quizGeneral.questionIds = ids;
      u.quizGeneral.optionOrder = ids.map((id) => this._pickOptionOrder(day, id, 4));
      u.quizGeneral.currentIndex = 0;
      u.quizGeneral.answers = [];
      u.quizGeneral.done = false;
      u.quizGeneral.correctTotal = 0;
      if (resetDifficulty) {
        u.quizGeneral.difficulty = "";
      }
      dirty = true;
    };

    if (u.quizGeneral.day !== day) {
      regen({ resetDifficulty: true });
    } else {
      const validIds = u.quizGeneral.questionIds.filter((id) => map.has(String(id || "")));
      if (validIds.length !== u.quizGeneral.questionIds.length || !validIds.length) {
        regen({ resetDifficulty: false });
      } else {
        u.quizGeneral.questionIds = validIds;
        if (!Array.isArray(u.quizGeneral.optionOrder) || u.quizGeneral.optionOrder.length !== u.quizGeneral.questionIds.length) {
          u.quizGeneral.optionOrder = u.quizGeneral.questionIds.map((id) => this._pickOptionOrder(day, id, 4));
          dirty = true;
        }
      }
    }

    const total = u.quizGeneral.questionIds.length;
    const expectedIndex = Math.max(0, Math.min(u.quizGeneral.answers.length, total));
    if (u.quizGeneral.done) {
      if (u.quizGeneral.currentIndex !== total) {
        u.quizGeneral.currentIndex = total;
        dirty = true;
      }
    } else if (u.quizGeneral.currentIndex !== expectedIndex) {
      u.quizGeneral.currentIndex = expectedIndex;
      dirty = true;
    }

    if (persist && dirty) {
      await this.users.save(u);
    }
    return { changed: dirty };
  }

  async selectDifficulty(u, difficulty) {
    await this.ensureSession(u, { persist: false });
    const s = this._strings(u);
    const lang = this._lang(u);
    const picked = this._normalizeDifficulty(difficulty);
    if (!picked) {
      return { ok: false, error: s.invalidDifficulty };
    }

    const current = this._normalizeDifficulty(u?.quizGeneral?.difficulty);
    if (current) {
      if (current === picked) {
        return { ok: true, view: await this.buildOpenView(u) };
      }
      return { ok: false, error: s.difficultyLocked };
    }

    if (picked === "hard") {
      const studyLevel = Math.max(0, toInt(u?.study?.level, 0));
      const minStudy = this._hardMinStudyLevel();
      if (studyLevel < minStudy) {
        return {
          ok: false,
          error: s.hardLocked
            .replace("{{need}}", String(minStudy))
            .replace("{{have}}", String(studyLevel))
        };
      }
    }

    u.quizGeneral.difficulty = picked;
    await this.users.save(u);
    const view = await this.buildOpenView(u);
    return { ok: true, view, toast: s.difficultyPicked.replace("{{difficulty}}", this._difficultyLabel(lang, picked)) };
  }

  _questionFor(u, index) {
    const selectedDifficulty = this._normalizeDifficulty(u?.quizGeneral?.difficulty) || this._defaultDifficulty();
    const map = this._catalogMap(selectedDifficulty);
    const qid = String(u?.quizGeneral?.questionIds?.[index] || "");
    const q = map.get(qid);
    if (!q) return null;
    const lang = this._lang(u);
    const options = (q.options && q.options[lang]) || q.options?.en || q.options?.ru || [];
    const text = (q.text && q.text[lang]) || q.text?.en || q.text?.ru || qid;
    const explain = (q.explain && q.explain[lang]) || q.explain?.en || q.explain?.ru || "";
    let order = Array.isArray(u?.quizGeneral?.optionOrder?.[index]) ? [...u.quizGeneral.optionOrder[index]] : [];
    if (order.length !== options.length) {
      order = Array.from({ length: options.length }, (_, i) => i);
    }
    return {
      id: qid,
      text,
      options,
      correctIndex: Math.max(0, toInt(q.correct, 0)),
      explain,
      order
    };
  }

  _strings(source) {
    const l = this._lang(source);
    if (l === "ru") {
      return {
        title: "\ud83e\udde0 \u041e\u0431\u0449\u0430\u044f \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0430",
        intro: "\u0412\u044b\u0431\u0435\u0440\u0438 \u0441\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u043e\u0434\u0438\u043d \u0440\u0430\u0437 \u0432 \u0434\u0435\u043d\u044c.\n3 \u0432\u043e\u043f\u0440\u043e\u0441\u0430 \u043d\u0430 \u043e\u0431\u0449\u0438\u0435 \u0442\u0435\u043c\u044b.",
        done: "\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043e\u0431\u0449\u0430\u044f \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0430 \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430.",
        start: "\u041d\u0430\u0447\u0430\u0442\u044c \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0443",
        resume: "\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0443",
        next: "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0432\u043e\u043f\u0440\u043e\u0441",
        toBar: "\u041d\u0430\u0437\u0430\u0434 \u0432 \u0431\u0430\u0440",
        chooseDifficulty: "\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f:",
        onePerDay: "\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u043c\u043e\u0436\u043d\u043e \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u0434\u0438\u043d \u0440\u0430\u0437 \u0432 \u0434\u0435\u043d\u044c.",
        pickEasy: "\u041b\u0451\u0433\u043a\u0430\u044f",
        pickMedium: "\u0421\u0440\u0435\u0434\u043d\u044f\u044f",
        pickHard: "\u0421\u043b\u043e\u0436\u043d\u0430\u044f",
        hardNeedStudy: "\u0421\u043b\u043e\u0436\u043d\u0430\u044f \u043e\u0442\u043a\u0440\u043e\u0435\u0442\u0441\u044f \u0441 {{need}} \u0443\u0440\u043e\u0432\u043d\u044f \u0443\u0447\u0451\u0431\u044b (\u0441\u0435\u0439\u0447\u0430\u0441 {{have}}).",
        qPrefix: "\u0412\u043e\u043f\u0440\u043e\u0441",
        correct: "\u0412\u0435\u0440\u043d\u043e!",
        wrong: "\u041d\u0435\u0432\u0435\u0440\u043d\u043e.",
        rightAnswer: "\u041f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442",
        explanation: "\u041f\u043e\u044f\u0441\u043d\u0435\u043d\u0438\u0435",
        reward: "\u041d\u0430\u0433\u0440\u0430\u0434\u0430",
        perfectBonus: "\u0411\u043e\u043d\u0443\u0441 \u0437\u0430 3/3",
        result: "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442",
        stale: "\u0421\u0435\u0441\u0441\u0438\u044f \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430. \u041e\u0442\u043a\u0440\u043e\u0439 \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0443 \u0437\u0430\u043d\u043e\u0432\u043e.",
        invalid: "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u043e\u0442\u0432\u0435\u0442\u0430.",
        invalidDifficulty: "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u0441\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c.",
        difficultyLocked: "\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u0443\u0436\u0435 \u0432\u044b\u0431\u0440\u0430\u043d\u0430 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f.",
        hardLocked: "\u0421\u043b\u043e\u0436\u043d\u0430\u044f \u0437\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u0430. \u041d\u0443\u0436\u0435\u043d {{need}} \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0443\u0447\u0451\u0431\u044b (\u0441\u0435\u0439\u0447\u0430\u0441 {{have}}).",
        difficultyPicked: "\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u0430: {{difficulty}}.",
        needPickDifficulty: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438 \u0441\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c.",
        alreadyDoneToast: "\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043e\u0431\u0449\u0430\u044f \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0430 \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430.",
        nextQuizIn: "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u0432\u0438\u043a\u0442\u043e\u0440\u0438\u043d\u0430 \u0447\u0435\u0440\u0435\u0437"
      };
    }
    if (l === "uk") {
      return {
        title: "\ud83e\udde0 \u0417\u0430\u0433\u0430\u043b\u044c\u043d\u0430 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0430",
        intro: "\u041e\u0431\u0435\u0440\u0438 \u0441\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c \u043e\u0434\u0438\u043d \u0440\u0430\u0437 \u043d\u0430 \u0434\u0435\u043d\u044c.\n3 \u043f\u0438\u0442\u0430\u043d\u043d\u044f \u043d\u0430 \u0437\u0430\u0433\u0430\u043b\u044c\u043d\u0456 \u0442\u0435\u043c\u0438.",
        done: "\u0421\u044c\u043e\u0433\u043e\u0434\u043d\u0456 \u0437\u0430\u0433\u0430\u043b\u044c\u043d\u0443 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0443 \u0432\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e.",
        start: "\u041f\u043e\u0447\u0430\u0442\u0438 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0443",
        resume: "\u041f\u0440\u043e\u0434\u043e\u0432\u0436\u0438\u0442\u0438 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0443",
        next: "\u041d\u0430\u0441\u0442\u0443\u043f\u043d\u0435 \u043f\u0438\u0442\u0430\u043d\u043d\u044f",
        toBar: "\u041d\u0430\u0437\u0430\u0434 \u0443 \u0431\u0430\u0440",
        chooseDifficulty: "\u0421\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c \u043d\u0430 \u0441\u044c\u043e\u0433\u043e\u0434\u043d\u0456:",
        onePerDay: "\u0421\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c \u043c\u043e\u0436\u043d\u0430 \u043e\u0431\u0440\u0430\u0442\u0438 \u043b\u0438\u0448\u0435 \u043e\u0434\u0438\u043d \u0440\u0430\u0437 \u043d\u0430 \u0434\u0435\u043d\u044c.",
        pickEasy: "\u041b\u0435\u0433\u043a\u0430",
        pickMedium: "\u0421\u0435\u0440\u0435\u0434\u043d\u044f",
        pickHard: "\u0421\u043a\u043b\u0430\u0434\u043d\u0430",
        hardNeedStudy: "\u0421\u043a\u043b\u0430\u0434\u043d\u0430 \u0432\u0456\u0434\u043a\u0440\u0438\u0454\u0442\u044c\u0441\u044f \u0437 {{need}} \u0440\u0456\u0432\u043d\u044f \u043d\u0430\u0432\u0447\u0430\u043d\u043d\u044f (\u0437\u0430\u0440\u0430\u0437 {{have}}).",
        qPrefix: "\u041f\u0438\u0442\u0430\u043d\u043d\u044f",
        correct: "\u041f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e!",
        wrong: "\u041d\u0435\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u043e.",
        rightAnswer: "\u041f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u0430 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c",
        explanation: "\u041f\u043e\u044f\u0441\u043d\u0435\u043d\u043d\u044f",
        reward: "\u041d\u0430\u0433\u043e\u0440\u043e\u0434\u0430",
        perfectBonus: "\u0411\u043e\u043d\u0443\u0441 \u0437\u0430 3/3",
        result: "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442",
        stale: "\u0421\u0435\u0441\u0456\u044f \u0437\u0430\u0441\u0442\u0430\u0440\u0456\u043b\u0430. \u0412\u0456\u0434\u043a\u0440\u0438\u0439 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0443 \u0437\u043d\u043e\u0432\u0443.",
        invalid: "\u041d\u0435\u0432\u0456\u0440\u043d\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u0456.",
        invalidDifficulty: "\u041d\u0435\u0432\u0456\u0434\u043e\u043c\u0430 \u0441\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c.",
        difficultyLocked: "\u0421\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c \u0432\u0436\u0435 \u043e\u0431\u0440\u0430\u043d\u0430 \u043d\u0430 \u0441\u044c\u043e\u0433\u043e\u0434\u043d\u0456.",
        hardLocked: "\u0421\u043a\u043b\u0430\u0434\u043d\u0430 \u0437\u0430\u0431\u043b\u043e\u043a\u043e\u0432\u0430\u043d\u0430. \u041f\u043e\u0442\u0440\u0456\u0431\u0435\u043d {{need}} \u0440\u0456\u0432\u0435\u043d\u044c \u043d\u0430\u0432\u0447\u0430\u043d\u043d\u044f (\u0437\u0430\u0440\u0430\u0437 {{have}}).",
        difficultyPicked: "\u0421\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c \u043e\u0431\u0440\u0430\u043d\u043e: {{difficulty}}.",
        needPickDifficulty: "\u0421\u043f\u043e\u0447\u0430\u0442\u043a\u0443 \u043e\u0431\u0435\u0440\u0438 \u0441\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c.",
        alreadyDoneToast: "\u0421\u044c\u043e\u0433\u043e\u0434\u043d\u0456 \u0437\u0430\u0433\u0430\u043b\u044c\u043d\u0443 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0443 \u0432\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e.",
        nextQuizIn: "\u041d\u0430\u0441\u0442\u0443\u043f\u043d\u0430 \u0432\u0456\u043a\u0442\u043e\u0440\u0438\u043d\u0430 \u0447\u0435\u0440\u0435\u0437"
      };
    }
    return {
      title: "General Quiz",
      intro: "Choose difficulty once per day.\n3 questions on general topics.",
      done: "Today's general quiz is already completed.",
      start: "Start quiz",
      resume: "Continue quiz",
      next: "Next question",
      toBar: "Back to bar",
      chooseDifficulty: "Difficulty for today:",
      onePerDay: "You can select difficulty only once per day.",
      pickEasy: "Easy",
      pickMedium: "Medium",
      pickHard: "Hard",
      hardNeedStudy: "Hard unlocks at Study level {{need}} (now {{have}}).",
      qPrefix: "Question",
      correct: "Correct!",
      wrong: "Wrong answer.",
      rightAnswer: "Correct answer",
      explanation: "Explanation",
      reward: "Reward",
      perfectBonus: "Perfect 3/3 bonus",
      result: "Result",
      stale: "Quiz session is outdated. Open the quiz again.",
      invalid: "Invalid answer option.",
      invalidDifficulty: "Unknown difficulty.",
      difficultyLocked: "Difficulty is already selected for today.",
      hardLocked: "Hard is locked. Need Study level {{need}} (now {{have}}).",
      difficultyPicked: "Difficulty selected: {{difficulty}}.",
      needPickDifficulty: "Pick difficulty first.",
      alreadyDoneToast: "General quiz is already completed for today.",
      nextQuizIn: "Next quiz in"
    };
  }
  _timeToNextDayText(lang) {
    const nowTs = this.now();
    const d = new Date(nowTs);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
    const left = Math.max(0, next - nowTs);
    const hours = Math.floor(left / (60 * 60 * 1000));
    const mins = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
    const l = this._lang(lang);
    if (l === "ru") return `${hours}ч ${mins}м`;
    if (l === "uk") return `${hours}г ${mins}хв`;
    return `${hours}h ${mins}m`;
  }

  async buildOpenView(u) {
    await this.ensureSession(u, { persist: true });
    const s = this._strings(u);
    const lang = this._lang(u);
    const total = Math.max(1, u?.quizGeneral?.questionIds?.length || this._questionsPerDay());
    const answered = Math.max(0, toInt(u?.quizGeneral?.answers?.length, 0));
    const correct = Math.max(0, toInt(u?.quizGeneral?.correctTotal, 0));
    const selectedDifficulty = this._normalizeDifficulty(u?.quizGeneral?.difficulty);
    const difficulty = selectedDifficulty || this._defaultDifficulty();
    const left = this._timeToNextDayText(lang);
    const rewardPerCorrect = this._rewardMoneyPerCorrect(difficulty);
    const bonusMoney = this._perfectBonusMoney(difficulty);
    const rewardMoney = formatMoney(rewardPerCorrect, lang);

    if (u.quizGeneral.done) {
      const lines = [
        s.title,
        "",
        s.done,
        "",
        `${s.chooseDifficulty} ${this._difficultyLabel(lang, difficulty)}`,
        `${s.result}: ${correct}/${total}`,
        `${s.reward}: ${rewardMoney} x ${correct}`,
        `${s.perfectBonus}: ${correct === total && bonusMoney > 0 ? `+${formatMoney(bonusMoney, lang)}` : "+$0"}`,
        "",
        `${s.nextQuizIn}: ${left}`
      ];
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: s.toBar, callback_data: "go:Bar" }]]
      };
    }

    const cta = answered > 0 ? s.resume : s.start;
    const minStudy = this._hardMinStudyLevel();
    const studyLevel = Math.max(0, toInt(u?.study?.level, 0));
    const hardLocked = studyLevel < minStudy;
    const easyTotal = (this._rewardMoneyPerCorrect("easy") * total) + this._perfectBonusMoney("easy");
    const mediumTotal = (this._rewardMoneyPerCorrect("medium") * total) + this._perfectBonusMoney("medium");
    const hardTotal = (this._rewardMoneyPerCorrect("hard") * total) + this._perfectBonusMoney("hard");

    const lines = [
      s.title,
      "",
      s.intro,
      "",
      selectedDifficulty
        ? `${s.chooseDifficulty} ${this._difficultyLabel(lang, selectedDifficulty)}`
        : s.chooseDifficulty,
      selectedDifficulty
        ? `${s.reward}: ${formatMoney(this._rewardMoneyPerCorrect(selectedDifficulty), lang)} x ${total} | ${s.perfectBonus}: +${formatMoney(this._perfectBonusMoney(selectedDifficulty), lang)}`
        : s.onePerDay,
      hardLocked ? s.hardNeedStudy.replace("{{need}}", String(minStudy)).replace("{{have}}", String(studyLevel)) : "",
      "",
      `${s.result}: ${correct}/${total}`
    ];

    const keyboard = selectedDifficulty
      ? [[{ text: cta, callback_data: answered > 0 ? "gquiz:next" : "gquiz:start" }]]
      : [
        [{ text: `${s.pickEasy} - ${formatMoney(easyTotal, lang)}`, callback_data: "gquiz:pick:easy" }],
        [{ text: `${s.pickMedium} - ${formatMoney(mediumTotal, lang)}`, callback_data: "gquiz:pick:medium" }],
        [{ text: `${hardLocked ? "[LOCK] " : ""}${s.pickHard} - ${formatMoney(hardTotal, lang)}`, callback_data: "gquiz:pick:hard" }]
      ];
    keyboard.push([{ text: s.toBar, callback_data: "go:Bar" }]);

    return {
      caption: lines.filter((x) => String(x || "").trim().length > 0).join("\n"),
      keyboard
    };
  }

  async buildQuestionView(u) {
    await this.ensureSession(u, { persist: true });
    const s = this._strings(u);
    if (u.quizGeneral.done) {
      return this.buildOpenView(u);
    }
    if (!this._normalizeDifficulty(u?.quizGeneral?.difficulty)) {
      return this.buildOpenView(u);
    }

    const idx = Math.max(0, toInt(u.quizGeneral.currentIndex, 0));
    const q = this._questionFor(u, idx);
    if (!q) return this.buildOpenView(u);

    const total = Math.max(1, u.quizGeneral.questionIds.length);
    const lines = [
      s.title,
      "",
      `${s.qPrefix} ${idx + 1}/${total}`,
      "",
      q.text
    ];

    const keyboard = q.order.map((orig, shownIdx) => [{
      text: q.options[orig],
      callback_data: `gquiz:answer:${shownIdx}`
    }]);
    keyboard.push([{ text: s.toBar, callback_data: "go:Bar" }]);
    return { caption: lines.join("\n"), keyboard };
  }
  _buildAnswerView(u, payload) {
    const s = this._strings(u);
    const lang = this._lang(u);
    const {
      q,
      correct,
      rewardMoney,
      finished,
      perfect,
      bonusMoney
    } = payload;

    const total = Math.max(1, u.quizGeneral.questionIds.length);
    const lines = [s.title, ""];

    if (correct) {
      lines.push(`${s.correct} ${rewardMoney > 0 ? `+${formatMoney(rewardMoney, lang)}` : ""}`.trim());
    } else {
      lines.push(s.wrong);
      lines.push(`${s.rightAnswer}: ${q.options[q.correctIndex]}`);
    }
    lines.push("");
    lines.push(`${s.explanation}: ${q.explain}`);
    lines.push("");

    if (finished) {
      lines.push(`${s.result}: ${u.quizGeneral.correctTotal}/${total}`);
      lines.push(`${s.perfectBonus}: ${perfect && bonusMoney > 0 ? `+${formatMoney(bonusMoney, lang)}` : "+$0"}`);
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: s.toBar, callback_data: "go:Bar" }]]
      };
    }

    return {
      caption: lines.join("\n"),
      keyboard: [
        [{ text: s.next, callback_data: "gquiz:next" }],
        [{ text: s.toBar, callback_data: "go:Bar" }]
      ]
    };
  }

  async answer(u, shownOptionIndex) {
    await this.ensureSession(u, { persist: false });
    const s = this._strings(u);
    if (u.quizGeneral.done) {
      return { ok: false, error: s.alreadyDoneToast };
    }
    const difficulty = this._normalizeDifficulty(u?.quizGeneral?.difficulty);
    if (!difficulty) {
      return { ok: false, error: s.needPickDifficulty };
    }
    if (u.quizGeneral.answers.length !== u.quizGeneral.currentIndex) {
      return { ok: false, error: s.stale };
    }

    const idx = Math.max(0, toInt(u.quizGeneral.currentIndex, 0));
    const q = this._questionFor(u, idx);
    if (!q) return { ok: false, error: s.stale };

    const shown = toInt(shownOptionIndex, -1);
    if (shown < 0 || shown >= q.order.length) {
      return { ok: false, error: s.invalid };
    }

    const pickedOrig = q.order[shown];
    const correct = pickedOrig === q.correctIndex;
    const rewardMoney = correct ? this._rewardMoneyPerCorrect(difficulty) : 0;
    if (rewardMoney > 0) {
      u.money = Math.max(0, toInt(u.money, 0)) + rewardMoney;
    }

    u.quizGeneral.answers.push(correct);
    u.quizGeneral.correctTotal = Math.max(0, toInt(u.quizGeneral.correctTotal, 0)) + (correct ? 1 : 0);
    u.quizGeneral.currentIndex = u.quizGeneral.answers.length;

    let finished = false;
    let perfect = false;
    let bonusMoney = 0;

    if (u.quizGeneral.currentIndex >= u.quizGeneral.questionIds.length) {
      finished = true;
      u.quizGeneral.done = true;
      u.quizGeneral.currentIndex = u.quizGeneral.questionIds.length;
      u.quizGeneral.playedTotal = Math.max(0, toInt(u.quizGeneral.playedTotal, 0)) + 1;
      const diffStats = (u.quizGeneral.byDifficulty && typeof u.quizGeneral.byDifficulty === "object")
        ? u.quizGeneral.byDifficulty
        : (u.quizGeneral.byDifficulty = {});
      const row = (diffStats[difficulty] && typeof diffStats[difficulty] === "object")
        ? diffStats[difficulty]
        : (diffStats[difficulty] = { playedTotal: 0, perfectTotal: 0 });
      row.playedTotal = Math.max(0, toInt(row.playedTotal, 0)) + 1;
      perfect = u.quizGeneral.correctTotal === u.quizGeneral.questionIds.length;
      if (perfect) {
        bonusMoney = this._perfectBonusMoney(difficulty);
        if (bonusMoney > 0) {
          u.money = Math.max(0, toInt(u.money, 0)) + bonusMoney;
        }
        u.quizGeneral.perfectTotal = Math.max(0, toInt(u.quizGeneral.perfectTotal, 0)) + 1;
        row.perfectTotal = Math.max(0, toInt(row.perfectTotal, 0)) + 1;
      }
    }

    await this.users.save(u);

    return {
      ok: true,
      finished,
      view: this._buildAnswerView(u, { q, correct, rewardMoney, finished, perfect, bonusMoney })
    };
  }

  async collectAdminStats() {
    const prefix = "u:";
    const today = this._today();
    let cursor;
    let scanned = 0;
    let playedToday = 0;
    let perfectToday = 0;
    let playedTotal = 0;
    let perfectTotal = 0;
    const byDifficulty = {
      easy: { playedToday: 0, perfectToday: 0, playedTotal: 0, perfectTotal: 0, selectedToday: 0 },
      medium: { playedToday: 0, perfectToday: 0, playedTotal: 0, perfectTotal: 0, selectedToday: 0 },
      hard: { playedToday: 0, perfectToday: 0, playedTotal: 0, perfectTotal: 0, selectedToday: 0 }
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.users.db.list({ prefix, cursor });
      const keys = Array.isArray(page?.keys) ? page.keys : [];
      for (const k of keys) {
        scanned += 1;
        try {
          const raw = await this.users.db.get(k.name);
          if (!raw) continue;
          const u = JSON.parse(raw);
          const q = (u?.quizGeneral && typeof u.quizGeneral === "object") ? u.quizGeneral : null;
          if (!q) continue;

          playedTotal += Math.max(0, toInt(q.playedTotal, 0));
          perfectTotal += Math.max(0, toInt(q.perfectTotal, 0));

          const doneToday = String(q.day || "") === today && !!q.done;
          const d = this._normalizeDifficulty(q.difficulty) || this._defaultDifficulty();
          if (String(q.day || "") === today && this._normalizeDifficulty(q.difficulty)) {
            byDifficulty[d].selectedToday += 1;
          }
          if (doneToday) {
            playedToday += 1;
            byDifficulty[d].playedToday += 1;
            const isPerfect = Math.max(0, toInt(q.correctTotal, 0)) >= Math.max(1, this._questionsPerDay());
            if (isPerfect) {
              perfectToday += 1;
              byDifficulty[d].perfectToday += 1;
            }
          }

          const bd = (q.byDifficulty && typeof q.byDifficulty === "object") ? q.byDifficulty : {};
          for (const id of this._difficultyIds()) {
            const row = (bd[id] && typeof bd[id] === "object") ? bd[id] : null;
            if (!row) continue;
            byDifficulty[id].playedTotal += Math.max(0, toInt(row.playedTotal, 0));
            byDifficulty[id].perfectTotal += Math.max(0, toInt(row.perfectTotal, 0));
          }
        } catch {
          // ignore bad rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    return {
      day: today,
      scanned,
      playedToday,
      perfectToday,
      playedTotal,
      perfectTotal,
      byDifficulty
    };
  }
}
