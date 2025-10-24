// BarService.js
import { HomeService } from "./HomeService.js";

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

  _ensureBar(u) {
    if (!u.bar || typeof u.bar !== "object") {
      u.bar = { day: "", assigned: false, tasks: [] };
    } else {
      if (typeof u.bar.day !== "string") u.bar.day = "";
      if (typeof u.bar.assigned !== "boolean") u.bar.assigned = false;
      if (!Array.isArray(u.bar.tasks)) u.bar.tasks = [];
      // на всякий случай чистим легаси
      if (u.bar.offered) delete u.bar.offered;
      if (u.bar.chosen) delete u.bar.chosen;
    }
  }

  _genTasksForDay(dayStr) {
    // Чередование: нечётные дни → W1 + C1; чётные → W2 + C2
    const dayNum = Number(dayStr.slice(-2)) || 0;
    const odd = (dayNum % 2) === 1;

    if (odd) {
      return [
        { // Work simple: 2 работы → +1💎
          id: "W1",
          title: "Сделай 2 работы",
          goal: 2,
          progress: 0,
          reward: { t: "premium", n: 1 },
          status: "active"
        },
        { // Casino simple: 1 спин → +10⚡
          id: "C1",
          title: "Сделай 1 спин в казино",
          goal: 1,
          progress: 0,
          reward: { t: "energy", n: 10 },
          status: "active"
        }
      ];
    }

    return [
      { // Work mid: заработай $60 → +2💎
        id: "W2",
        title: "Заработай $60 на работах",
        goal: 60,
        progress: 0,
        reward: { t: "premium", n: 2 },
        status: "active"
      },
      { // Casino mid: 3 спина → +20⚡
        id: "C2",
        title: "Сделай 3 спина в казино",
        goal: 3,
        progress: 0,
        reward: { t: "energy", n: 20 },
        status: "active"
      }
    ];
  }

  /**
   * Гарантирует актуальный "дневной пакет" задач.
   * Если день поменялся — создаёт свежие две задачи. Ничего не перевыдаёт внутри одного дня.
   */
  ensureToday(u) {
    this._ensureBar(u);
    const today = BarService._dayStr(this.now());
    if (u.bar.day !== today) {
      u.bar.day = today;
      u.bar.assigned = true;          // авто-выдача пакета при первом открытии
      u.bar.tasks = this._genTasksForDay(today);
      return true; // был ресет/создание
    }
    // тот же день: если ещё не было assign — выдаём пакет сейчас
    if (!u.bar.assigned) {
      u.bar.assigned = true;
      u.bar.tasks = this._genTasksForDay(today);
      return true;
    }
    return false;
  }

  /**
   * Вызывается при входе в Бар.
   * Возвращает список задач дня (два элемента).
   */
  async open(u) {
    const changed = this.ensureToday(u);
    if (changed) await this.users.save(u);
    return { ok: true, tasks: Array.isArray(u.bar.tasks) ? u.bar.tasks : [] };
  }

  // === Хуки прогресса ===

  /**
   * Отработал (получил выплату). pay — начисленная сумма за работу (после модификаторов).
   */
  static async onWorkClaim({ u, users, now, pay = 0 }) {
    if (!u) return;
    const svc = new BarService({ users, now });
    svc._ensureBar(u);
    svc.ensureToday(u);
    if (!Array.isArray(u.bar.tasks)) u.bar.tasks = [];

    let changed = false;
    for (const t of u.bar.tasks) {
      if (t.status !== "active") continue;
      if (t.id === "W1") {
        const before = t.progress;
        t.progress = Math.min(t.goal, (t.progress || 0) + 1);
        if (t.progress !== before) changed = true;
        if (t.progress >= t.goal) t.status = "done";
      }
      if (t.id === "W2") {
        const inc = Math.max(0, Math.round(Number(pay) || 0));
        if (inc > 0) {
          const before = t.progress;
          t.progress = Math.min(t.goal, (t.progress || 0) + inc);
          if (t.progress !== before) changed = true;
          if (t.progress >= t.goal) t.status = "done";
        }
      }
    }
    if (changed) await users.save(u);
  }

  /**
   * Любой спин казино (платный/бесплатный).
   */
  static async onCasinoSpin({ u, users, now }) {
    if (!u) return;
    const svc = new BarService({ users, now });
    svc._ensureBar(u);
    svc.ensureToday(u);
    if (!Array.isArray(u.bar.tasks)) u.bar.tasks = [];

    let changed = false;
    for (const t of u.bar.tasks) {
      if (t.status !== "active") continue;
      if (t.id === "C1" || t.id === "C2") {
        const before = t.progress;
        t.progress = Math.min(t.goal, (t.progress || 0) + 1);
        if (t.progress !== before) changed = true;
        if (t.progress >= t.goal) t.status = "done";
      }
    }
    if (changed) await users.save(u);
  }

  /**
   * Выдача награды по конкретной задаче.
   */
  async claim(u, taskId) {
    this._ensureBar(u);
    this.ensureToday(u);

    const t = (u.bar.tasks || []).find(x => x && x.id === taskId);
    if (!t) return { ok: false, error: "Задача не найдена." };
    if (t.status !== "done") return { ok: false, error: "Задача ещё не выполнена." };

    // Награда
    if (t.reward?.t === "premium") {
      const n = Number(t.reward?.n || 0);
      u.premium = (u.premium || 0) + n;
    } else if (t.reward?.t === "energy") {
      const n = Number(t.reward?.n || 0);
      HomeService.applyEnergy(u, n, { autoStopRest: true });
    } else if (t.reward?.t === "money") {
      const n = Number(t.reward?.n || 0);
      u.money = (u.money || 0) + n;
    }

    t.status = "claimed";
    await this.users.save(u);
    return { ok: true, reward: t.reward };
  }
}