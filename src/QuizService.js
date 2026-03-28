import { CONFIG } from "./GameConfig.js";
import { normalizeLang, formatMoney } from "./i18n/index.js";
import { buildQuizCatalog } from "./QuizCatalog.js";

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

function parseDayToMs(day) {
  const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dayDiff(a, b) {
  const ma = parseDayToMs(a);
  const mb = parseDayToMs(b);
  if (!ma || !mb) return 0;
  return Math.floor((mb - ma) / DAY_MS);
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

export class QuizService {
  constructor({ users, now, bot = null, quests = null, achievements = null }) {
    this.users = users;
    this.now = now || (() => Date.now());
    this.bot = bot || null;
    this.quests = quests || null;
    this.achievements = achievements || null;
  }

  _lang(source) {
    if (typeof source === "string") return normalizeLang(source);
    return normalizeLang(source?.lang || "en");
  }

  _cfg() {
    return CONFIG?.QUIZ || {};
  }

  _questionsPerDay() {
    return Math.max(1, toInt(this._cfg().QUESTIONS_PER_DAY, 3));
  }

  _rewardMoneyPerCorrect() {
    return Math.max(0, toInt(this._cfg().REWARD_MONEY_PER_CORRECT, 300));
  }

  _perfectBonusGems() {
    return Math.max(0, toInt(this._cfg().PERFECT_BONUS_GEMS, 1));
  }

  _catalog() {
    return buildQuizCatalog(CONFIG);
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

    if (!u.quiz || typeof u.quiz !== "object") {
      u.quiz = {};
      dirty = true;
    }

    const q = u.quiz;
    if (typeof q.day !== "string") { q.day = ""; dirty = true; }
    if (!Array.isArray(q.questionIds)) { q.questionIds = []; dirty = true; }
    if (!Array.isArray(q.optionOrder)) { q.optionOrder = []; dirty = true; }
    if (typeof q.currentIndex !== "number" || !Number.isFinite(q.currentIndex)) { q.currentIndex = 0; dirty = true; }
    if (!Array.isArray(q.answers)) { q.answers = []; dirty = true; }
    if (typeof q.done !== "boolean") { q.done = false; dirty = true; }
    if (typeof q.correctTotal !== "number" || !Number.isFinite(q.correctTotal)) { q.correctTotal = 0; dirty = true; }
    if (typeof q.streak !== "number" || !Number.isFinite(q.streak)) { q.streak = 0; dirty = true; }
    if (typeof q.lastPerfectDay !== "string") { q.lastPerfectDay = ""; dirty = true; }
    if (typeof q.playedTotal !== "number" || !Number.isFinite(q.playedTotal)) { q.playedTotal = 0; dirty = true; }
    if (typeof q.perfectTotal !== "number" || !Number.isFinite(q.perfectTotal)) { q.perfectTotal = 0; dirty = true; }

    q.currentIndex = Math.max(0, toInt(q.currentIndex, 0));
    q.correctTotal = Math.max(0, toInt(q.correctTotal, 0));
    q.streak = Math.max(0, toInt(q.streak, 0));
    q.playedTotal = Math.max(0, toInt(q.playedTotal, 0));
    q.perfectTotal = Math.max(0, toInt(q.perfectTotal, 0));
    q.answers = q.answers.map((x) => !!x);

    return dirty;
  }

  _pickQuestionIds(day) {
    const ids = this._catalog().map((q) => q.id);
    const count = Math.min(this._questionsPerDay(), ids.length);
    const rng = rngFromSeed(`quiz:${day}:questions`);
    return shuffleDeterministic(ids, rng).slice(0, count);
  }

  _pickOptionOrder(day, questionId, optionCount) {
    const base = Array.from({ length: Math.max(1, optionCount) }, (_, i) => i);
    const rng = rngFromSeed(`quiz:${day}:${questionId}:options`);
    return shuffleDeterministic(base, rng);
  }

  async ensureSession(u, { persist = false } = {}) {
    let dirty = this._ensureModel(u);
    const day = this._today();
    const map = this._catalogMap();

    const regen = () => {
      const ids = this._pickQuestionIds(day);
      u.quiz.day = day;
      u.quiz.questionIds = ids;
      u.quiz.optionOrder = ids.map((id) => this._pickOptionOrder(day, id, 4));
      u.quiz.currentIndex = 0;
      u.quiz.answers = [];
      u.quiz.done = false;
      u.quiz.correctTotal = 0;
      dirty = true;
    };

    if (u.quiz.day !== day) {
      regen();
    } else {
      const validIds = u.quiz.questionIds.filter((id) => map.has(String(id || "")));
      if (validIds.length !== u.quiz.questionIds.length || !validIds.length) {
        regen();
      } else {
        u.quiz.questionIds = validIds;
        if (!Array.isArray(u.quiz.optionOrder) || u.quiz.optionOrder.length !== u.quiz.questionIds.length) {
          u.quiz.optionOrder = u.quiz.questionIds.map((id) => this._pickOptionOrder(day, id, 4));
          dirty = true;
        }
      }
    }

    const total = u.quiz.questionIds.length;
    const expectedIndex = Math.max(0, Math.min(u.quiz.answers.length, total));
    if (u.quiz.done) {
      if (u.quiz.currentIndex !== total) {
        u.quiz.currentIndex = total;
        dirty = true;
      }
    } else if (u.quiz.currentIndex !== expectedIndex) {
      u.quiz.currentIndex = expectedIndex;
      dirty = true;
    }

    if (persist && dirty) {
      await this.users.save(u);
    }
    return { changed: dirty };
  }

  _questionFor(u, index) {
    const map = this._catalogMap();
    const qid = String(u?.quiz?.questionIds?.[index] || "");
    const q = map.get(qid);
    if (!q) return null;
    const lang = this._lang(u);
    const options = (q.options && q.options[lang]) || q.options?.ru || [];
    const text = (q.text && q.text[lang]) || q.text?.ru || qid;
    let order = Array.isArray(u?.quiz?.optionOrder?.[index]) ? [...u.quiz.optionOrder[index]] : [];
    if (order.length !== options.length) {
      order = Array.from({ length: options.length }, (_, i) => i);
    }
    return {
      id: qid,
      text,
      options,
      correctIndex: Math.max(0, toInt(q.correct, 0)),
      order
    };
  }

  _strings(source) {
    const l = this._lang(source);
    if (l === "en") {
      return {
        title: "🎯 Daily Quiz",
        intro: "3 questions per day. One attempt.\n+$300 for each correct answer.\nAll 3 correct: +💎1 bonus.",
        done: "Today's quiz is already completed.",
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
        stale: "Quiz session is outdated. Open quiz again.",
        invalid: "Invalid answer option.",
        alreadyDoneToast: "Quiz already completed for today."
      };
    }
    if (l === "uk") {
      return {
        title: "🎯 Щоденна вікторина",
        intro: "3 запитання на день. Одна спроба.\n+$300 за кожну правильну відповідь.\nУсі 3 правильно: +💎1 бонус.",
        done: "Сьогоднішню вікторину вже завершено.",
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
        stale: "Сесія вікторини застаріла. Відкрий вікторину ще раз.",
        invalid: "Некоректний варіант відповіді.",
        alreadyDoneToast: "Вікторину на сьогодні вже завершено."
      };
    }
    return {
      title: "🎯 Викторина дня",
      intro: "3 вопроса в день. Одна попытка.\n+$300 за каждый правильный ответ.\nВсе 3 правильно: +💎1 бонус.",
      done: "Сегодняшняя викторина уже завершена.",
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
      stale: "Сессия викторины устарела. Открой викторину снова.",
      invalid: "Некорректный вариант ответа.",
      alreadyDoneToast: "Викторина на сегодня уже завершена."
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
    const total = Math.max(1, u?.quiz?.questionIds?.length || this._questionsPerDay());
    const answered = Math.max(0, toInt(u?.quiz?.answers?.length, 0));
    const correct = Math.max(0, toInt(u?.quiz?.correctTotal, 0));
    const left = this._timeToNextDayText(lang);
    const rewardMoney = formatMoney(this._rewardMoneyPerCorrect(), lang);
    const bonusGems = this._perfectBonusGems();

    if (u.quiz.done) {
      const lines = [
        s.title,
        "",
        s.done,
        "",
        `${s.result}: ${correct}/${total}`,
        `${s.reward}: ${rewardMoney} × ${correct}`,
        `${s.perfectBonus}: ${correct === total && bonusGems > 0 ? `+💎${bonusGems}` : "+💎0"}`,
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
        [{ text: cta, callback_data: answered > 0 ? "quiz:next" : "quiz:start" }],
        [{ text: s.toBar, callback_data: "go:Bar" }]
      ]
    };
  }

  async buildQuestionView(u) {
    await this.ensureSession(u, { persist: true });
    const s = this._strings(u);
    if (u.quiz.done) {
      return this.buildOpenView(u);
    }

    const idx = Math.max(0, toInt(u.quiz.currentIndex, 0));
    const q = this._questionFor(u, idx);
    if (!q) {
      return this.buildOpenView(u);
    }
    const total = Math.max(1, u.quiz.questionIds.length);
    const lines = [
      s.title,
      "",
      `${s.qPrefix} ${idx + 1}/${total}`,
      "",
      q.text
    ];
    const keyboard = q.order.map((orig, shownIdx) => [{
      text: q.options[orig],
      callback_data: `quiz:answer:${shownIdx}`
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
      bonusGems
    } = payload;
    const total = Math.max(1, u.quiz.questionIds.length);
    const lines = [s.title, ""];

    if (correct) {
      lines.push(`${s.correct} ${rewardMoney > 0 ? `+${formatMoney(rewardMoney, lang)}` : ""}`.trim());
    } else {
      lines.push(s.wrong);
      lines.push(`${s.rightAnswer}: ${q.options[q.correctIndex]}`);
    }
    lines.push("");

    if (finished) {
      lines.push(`${s.result}: ${u.quiz.correctTotal}/${total}`);
      lines.push(`${s.perfectBonus}: ${perfect && bonusGems > 0 ? `+💎${bonusGems}` : "+💎0"}`);
      return {
        caption: lines.join("\n"),
        keyboard: [[{ text: s.toBar, callback_data: "go:Bar" }]]
      };
    }

    return {
      caption: lines.join("\n"),
      keyboard: [
        [{ text: s.next, callback_data: "quiz:next" }],
        [{ text: s.toBar, callback_data: "go:Bar" }]
      ]
    };
  }

  async answer(u, shownOptionIndex) {
    await this.ensureSession(u, { persist: false });
    const s = this._strings(u);
    if (u.quiz.done) {
      return { ok: false, error: s.alreadyDoneToast };
    }
    if (u.quiz.answers.length !== u.quiz.currentIndex) {
      return { ok: false, error: s.stale };
    }

    const idx = Math.max(0, toInt(u.quiz.currentIndex, 0));
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

    u.quiz.answers.push(correct);
    u.quiz.correctTotal = Math.max(0, toInt(u.quiz.correctTotal, 0)) + (correct ? 1 : 0);
    u.quiz.currentIndex = u.quiz.answers.length;

    let finished = false;
    let perfect = false;
    let bonusGems = 0;
    let questRes = null;
    let achRes = null;

    if (u.quiz.currentIndex >= u.quiz.questionIds.length) {
      finished = true;
      u.quiz.done = true;
      u.quiz.currentIndex = u.quiz.questionIds.length;
      u.quiz.playedTotal = Math.max(0, toInt(u.quiz.playedTotal, 0)) + 1;
      perfect = u.quiz.correctTotal === u.quiz.questionIds.length;
      if (perfect) {
        bonusGems = this._perfectBonusGems();
        if (bonusGems > 0) {
          u.premium = Math.max(0, toInt(u.premium, 0)) + bonusGems;
        }
        const today = this._today();
        const prev = String(u.quiz.lastPerfectDay || "");
        const diff = dayDiff(prev, today);
        if (prev === today) {
          // no-op
        } else if (diff === 1) {
          u.quiz.streak = Math.max(0, toInt(u.quiz.streak, 0)) + 1;
        } else {
          u.quiz.streak = 1;
        }
        u.quiz.lastPerfectDay = today;
        u.quiz.perfectTotal = Math.max(0, toInt(u.quiz.perfectTotal, 0)) + 1;
      } else {
        u.quiz.streak = 0;
      }

      if (this.quests?.onEvent) {
        try {
          questRes = await this.quests.onEvent(
            u,
            "quiz_play",
            { correctTotal: u.quiz.correctTotal, perfect },
            { persist: false, notify: false }
          );
        } catch {}
      }
      if (this.achievements?.onEvent) {
        try {
          achRes = await this.achievements.onEvent(
            u,
            "quiz_play",
            { perfect, streak: u.quiz.streak, correctTotal: u.quiz.correctTotal },
            { persist: false, notify: false }
          );
        } catch {}
      }
    }

    await this.users.save(u);

    if (finished) {
      if (questRes?.events?.length && this.quests?.notifyEvents) {
        try { await this.quests.notifyEvents(u, questRes.events); } catch {}
      }
      if (achRes?.newlyEarned?.length && this.achievements?.notifyEarned) {
        try { await this.achievements.notifyEarned(u, achRes.newlyEarned); } catch {}
      }
    }

    return {
      ok: true,
      finished,
      view: this._buildAnswerView(u, { q, correct, rewardMoney, finished, perfect, bonusGems })
    };
  }

  async collectAdminStats({ topLimit = 10 } = {}) {
    const prefix = "u:";
    const today = this._today();
    let cursor;
    let scanned = 0;
    let playedToday = 0;
    let perfectToday = 0;
    let correctTodaySum = 0;
    let playedTotal = 0;
    let perfectTotal = 0;
    const topStreak = [];

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
          const q = (u?.quiz && typeof u.quiz === "object") ? u.quiz : null;
          if (!q) continue;

          const pTotal = Math.max(0, toInt(q.playedTotal, 0));
          const pfTotal = Math.max(0, toInt(q.perfectTotal, 0));
          playedTotal += pTotal;
          perfectTotal += pfTotal;

          const streak = Math.max(0, toInt(q.streak, 0));
          if (streak > 0) {
            topStreak.push({
              id: String(u?.id || String(k.name || "").slice(prefix.length)),
              name: String(u?.displayName || "").trim() || "(no name)",
              streak
            });
          }

          const isDoneToday = String(q.day || "") === today && !!q.done;
          if (isDoneToday) {
            playedToday += 1;
            const correct = Math.max(0, toInt(q.correctTotal, 0));
            correctTodaySum += correct;
            if (correct >= this._questionsPerDay()) perfectToday += 1;
          }
        } catch {
          // ignore bad rows
        }
      }
      if (!page || page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }

    topStreak.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    return {
      day: today,
      scanned,
      playedToday,
      perfectToday,
      avgCorrectToday: playedToday > 0 ? (correctTodaySum / playedToday) : 0,
      playedTotal,
      perfectTotal,
      topStreak: topStreak.slice(0, Math.max(1, toInt(topLimit, 10)))
    };
  }
}
