import { CONFIG } from "./GameConfig.js";
import { normalizeLang, formatMoney } from "./i18n/index.js";
import { buildGeneralQuizCatalog } from "./GeneralQuizCatalog.js";

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

  _rewardMoneyPerCorrect() {
    return Math.max(0, toInt(this._cfg().REWARD_MONEY_PER_CORRECT, 100));
  }

  _perfectBonusMoney() {
    return Math.max(0, toInt(this._cfg().PERFECT_BONUS_MONEY, 200));
  }

  _catalog() {
    return buildGeneralQuizCatalog();
  }

  _catalogMap() {
    return new Map(this._catalog().map((q) => [q.id, q]));
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

    q.currentIndex = Math.max(0, toInt(q.currentIndex, 0));
    q.correctTotal = Math.max(0, toInt(q.correctTotal, 0));
    q.playedTotal = Math.max(0, toInt(q.playedTotal, 0));
    q.perfectTotal = Math.max(0, toInt(q.perfectTotal, 0));
    q.answers = q.answers.map((x) => !!x);

    return dirty;
  }

  _pickQuestionIds(day) {
    const ids = this._catalog().map((q) => q.id);
    const count = Math.min(this._questionsPerDay(), ids.length);
    const rng = rngFromSeed(`gquiz:${day}:questions`);
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
    const map = this._catalogMap();

    const regen = () => {
      const ids = this._pickQuestionIds(day);
      u.quizGeneral.day = day;
      u.quizGeneral.questionIds = ids;
      u.quizGeneral.optionOrder = ids.map((id) => this._pickOptionOrder(day, id, 4));
      u.quizGeneral.currentIndex = 0;
      u.quizGeneral.answers = [];
      u.quizGeneral.done = false;
      u.quizGeneral.correctTotal = 0;
      dirty = true;
    };

    if (u.quizGeneral.day !== day) {
      regen();
    } else {
      const validIds = u.quizGeneral.questionIds.filter((id) => map.has(String(id || "")));
      if (validIds.length !== u.quizGeneral.questionIds.length || !validIds.length) {
        regen();
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

  _questionFor(u, index) {
    const map = this._catalogMap();
    const qid = String(u?.quizGeneral?.questionIds?.[index] || "");
    const q = map.get(qid);
    if (!q) return null;
    const lang = this._lang(u);
    const options = (q.options && q.options[lang]) || q.options?.ru || [];
    const text = (q.text && q.text[lang]) || q.text?.ru || qid;
    const explain = (q.explain && q.explain[lang]) || q.explain?.ru || "";
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
    if (l === "en") {
      return {
        title: "🧠 General Quiz",
        intro: "3 daily questions on general topics.\n+$100 for each correct answer.\nAll 3 correct: +$200 bonus.",
        done: "Today's general quiz is already completed.",
        start: "▶️ Start quiz",
        resume: "▶️ Continue quiz",
        next: "➡️ Next question",
        toBar: "⬅️ Back to bar",
        qPrefix: "Question",
        correct: "✅ Correct!",
        wrong: "❌ Wrong answer.",
        rightAnswer: "Correct answer",
        explanation: "Explanation",
        reward: "Reward",
        perfectBonus: "Perfect bonus",
        result: "Result",
        stale: "Quiz session is outdated. Open the quiz again.",
        invalid: "Invalid answer option.",
        alreadyDoneToast: "General quiz is already completed for today."
      };
    }
    if (l === "uk") {
      return {
        title: "🧠 Загальна вікторина",
        intro: "3 щоденні питання на загальні теми.\n+$100 за кожну правильну відповідь.\nУсі 3 правильно: +$200 бонус.",
        done: "Сьогоднішню загальну вікторину вже завершено.",
        start: "▶️ Почати вікторину",
        resume: "▶️ Продовжити вікторину",
        next: "➡️ Наступне питання",
        toBar: "⬅️ Назад у бар",
        qPrefix: "Питання",
        correct: "✅ Правильно!",
        wrong: "❌ Неправильна відповідь.",
        rightAnswer: "Правильна відповідь",
        explanation: "Пояснення",
        reward: "Нагорода",
        perfectBonus: "Бонус за ідеал",
        result: "Результат",
        stale: "Сесію застаріло. Відкрий вікторину знову.",
        invalid: "Некоректний варіант відповіді.",
        alreadyDoneToast: "Загальну вікторину на сьогодні вже завершено."
      };
    }
    return {
      title: "🧠 Общая викторина",
      intro: "3 ежедневных вопроса на общие темы.\n+$100 за каждый правильный ответ.\nВсе 3 правильно: +$200 бонус.",
      done: "Сегодняшняя общая викторина уже завершена.",
      start: "▶️ Начать викторину",
      resume: "▶️ Продолжить викторину",
      next: "➡️ Следующий вопрос",
      toBar: "⬅️ Назад в бар",
      qPrefix: "Вопрос",
      correct: "✅ Верно!",
      wrong: "❌ Неверно.",
      rightAnswer: "Правильный ответ",
      explanation: "Пояснение",
      reward: "Награда",
      perfectBonus: "Бонус за идеал",
      result: "Результат",
      stale: "Сессия устарела. Открой викторину снова.",
      invalid: "Некорректный вариант ответа.",
      alreadyDoneToast: "Общая викторина на сегодня уже завершена."
    };
  }

  _timeToNextDayText(lang) {
    const nowTs = this.now();
    const d = new Date(nowTs);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
    const left = Math.max(0, next - nowTs);
    const hours = Math.floor(left / (60 * 60 * 1000));
    const mins = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
    if (lang === "en") return `${hours}h ${mins}m`;
    if (lang === "uk") return `${hours}г ${mins}хв`;
    return `${hours}ч ${mins}м`;
  }

  async buildOpenView(u) {
    await this.ensureSession(u, { persist: true });
    const s = this._strings(u);
    const lang = this._lang(u);
    const total = Math.max(1, u?.quizGeneral?.questionIds?.length || this._questionsPerDay());
    const answered = Math.max(0, toInt(u?.quizGeneral?.answers?.length, 0));
    const correct = Math.max(0, toInt(u?.quizGeneral?.correctTotal, 0));
    const left = this._timeToNextDayText(lang);
    const rewardMoney = formatMoney(this._rewardMoneyPerCorrect(), lang);
    const bonusMoney = this._perfectBonusMoney();

    if (u.quizGeneral.done) {
      const lines = [
        s.title,
        "",
        s.done,
        "",
        `${s.result}: ${correct}/${total}`,
        `${s.reward}: ${rewardMoney} × ${correct}`,
        `${s.perfectBonus}: ${correct === total && bonusMoney > 0 ? `+${formatMoney(bonusMoney, lang)}` : "+$0"}`,
        "",
        (lang === "en"
          ? `Next quiz in: ${left}`
          : (lang === "uk" ? `Нова вікторина через: ${left}` : `Новая викторина через: ${left}`))
      ];
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: s.toBar, callback_data: "go:Bar" }]]
      };
    }

    const cta = answered > 0 ? s.resume : s.start;
    const lines = [
      s.title,
      "",
      s.intro,
      "",
      `${s.result}: ${correct}/${total}`
    ];
    return {
      caption: lines.join("\n"),
      keyboard: [
        [{ text: cta, callback_data: answered > 0 ? "gquiz:next" : "gquiz:start" }],
        [{ text: s.toBar, callback_data: "go:Bar" }]
      ]
    };
  }

  async buildQuestionView(u) {
    await this.ensureSession(u, { persist: true });
    const s = this._strings(u);
    if (u.quizGeneral.done) {
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
    const rewardMoney = correct ? this._rewardMoneyPerCorrect() : 0;
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
      perfect = u.quizGeneral.correctTotal === u.quizGeneral.questionIds.length;
      if (perfect) {
        bonusMoney = this._perfectBonusMoney();
        if (bonusMoney > 0) {
          u.money = Math.max(0, toInt(u.money, 0)) + bonusMoney;
        }
        u.quizGeneral.perfectTotal = Math.max(0, toInt(u.quizGeneral.perfectTotal, 0)) + 1;
      }
    }

    await this.users.save(u);

    return {
      ok: true,
      finished,
      view: this._buildAnswerView(u, { q, correct, rewardMoney, finished, perfect, bonusMoney })
    };
  }
}

