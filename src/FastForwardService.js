// FastForwardService.js
import { CONFIG } from "./GameConfig.js";
import { StudyService } from "./StudyService.js";
import { GymService } from "./GymService.js";

/**
 * Единый сервис "ускоренного завершения" активностей за кристаллы.
 * - Лимит: CONFIG.FAST_FORWARD.DAILY_LIMIT (UTC, суммарно на все активности)
 * - Цена: ceil(remainingHours) * PRICE_PER_HOUR, MIN=1, MAX_HOURS_PER_TX=24
 * - Логи: OrdersStore.{incrFfAgg, logFastForward, logFastForwardFail}
 *
 * ВАЖНО (Вариант A):
 *  - ДЛЯ РАБОТЫ (work) сервис ТОЛЬКО досрочно завершает смену (endAt = now)
 *    и списывает кристаллы. Выплату и обновление топа делает JobService.claim(u)
 *    в хендлере работы после успешного finishNow(...).
 *  - Study/Gym завершаем здесь же, как и прежде (это не влияет на соц-топ).
 */
export class FastForwardService {
  constructor({ users, orders, now, send, social = null }) {
    this.users = users;
    this.orders = orders || null;
    this.now = now || (() => Date.now());
    this.send = typeof send === "function" ? send : async () => {};
    this.social = social; // опционально храним

  }

  _cfg() {
    const c = CONFIG && CONFIG.FAST_FORWARD ? CONFIG.FAST_FORWARD : {};
    const num = (v, def) => (typeof v === "number" && Number.isFinite(v) ? v : def);
    const str = (v, def) => (typeof v === "string" ? v : def);
    return {
      PRICE_PER_HOUR: num(c.PRICE_PER_HOUR, 1),
      ROUND: str(c.ROUND, "ceil"),
      MIN_COST: num(c.MIN_COST, 1),
      MAX_HOURS_PER_TX: num(c.MAX_HOURS_PER_TX, 24),
      DAILY_LIMIT: num(c.DAILY_LIMIT, 3),
    };
  }

  _dayKey(ts = this.now()) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  _remainingMs(u, kind) {
    const t = this.now();
    if (kind === "work") {
      const inst = Array.isArray(u?.jobs?.active) ? u.jobs.active[0] : null;
      if (!inst) return { active: false, remainingMs: 0, endAt: 0 };
      return { active: t < (inst.endAt || 0), remainingMs: Math.max(0, (inst.endAt || 0) - t), endAt: inst.endAt || 0 };
    }
    if (kind === "study") {
      const active = !!(u?.study?.active && t < (u.study.endAt || 0));
      return { active, remainingMs: Math.max(0, (u.study?.endAt || 0) - t), endAt: u.study?.endAt || 0 };
    }
    if (kind === "gym") {
      const active = !!(u?.gym?.active && t < (u.gym.endAt || 0));
      return { active, remainingMs: Math.max(0, (u.gym?.endAt || 0) - t), endAt: u.gym?.endAt || 0 };
    }
    return { active: false, remainingMs: 0, endAt: 0 };
  }

  _hoursToCharge(ms) {
    if (ms <= 0) return 0;
    const h = ms / 3_600_000;
    return Math.ceil(h); // по ТЗ
  }

  quote(u, kind) {
    const cfg = this._cfg();
    const { active, remainingMs } = this._remainingMs(u, kind);
    if (!active) return { ok: false, error: "not_active", cost: 0, remainingMs: 0, hoursToCharge: 0 };

    let hoursToCharge = this._hoursToCharge(remainingMs);
    if (hoursToCharge > cfg.MAX_HOURS_PER_TX) hoursToCharge = cfg.MAX_HOURS_PER_TX;

    let cost = hoursToCharge * cfg.PRICE_PER_HOUR;
    if (cost < cfg.MIN_COST) cost = cfg.MIN_COST;

    return { ok: true, cost, remainingMs, hoursToCharge };
  }

  _checkDailyLimit(u) {
    const cfg = this._cfg();
    const dayKey = this._dayKey();
    if (!u.fastForwardDaily || typeof u.fastForwardDaily !== "object") {
      u.fastForwardDaily = { day: dayKey, n: 0 };
      return { ok: true, dayKey, used: 0, left: cfg.DAILY_LIMIT };
    }
    if (u.fastForwardDaily.day !== dayKey) {
      u.fastForwardDaily = { day: dayKey, n: 0 };
      return { ok: true, dayKey, used: 0, left: cfg.DAILY_LIMIT };
    }
    const used = u.fastForwardDaily.n || 0;
    const left = Math.max(0, cfg.DAILY_LIMIT - used);
    if (used >= cfg.DAILY_LIMIT) return { ok: false, reason: "limit", used, left: 0, dayKey };
    return { ok: true, used, left, dayKey };
  }

  async finishNow(u, kind, deps = {}) {
    const users = deps.users || this.users;
    const orders = deps.orders || this.orders;
    const now = deps.now || this.now;
    const cfg = this._cfg();

    // 1) активность и остаток
    const q1 = this.quote(u, kind);
    if (!q1.ok) {
      if (orders?.logFastForwardFail) {
        await orders.logFastForwardFail({ userId: u.id, activity: kind, reason: "no_active", ts: now() });
      }
      return { ok: false, error: "Уже завершено или не запущено." };
    }

    // 2) лимит
    const lim = this._checkDailyLimit(u);
    if (!lim.ok) {
      if (orders?.logFastForwardFail) {
        await orders.logFastForwardFail({ userId: u.id, activity: kind, reason: "limit", ts: now() });
      }
      return { ok: false, error: `Лимит ускорений на сегодня исчерпан (${cfg.DAILY_LIMIT}).` };
    }

    // 3) баланс
    const have = Number(u.premium || 0);
    if (have < q1.cost) {
      if (orders?.logFastForwardFail) {
        await orders.logFastForwardFail({ userId: u.id, activity: kind, reason: "no_funds", ts: now() });
      }
      return { ok: false, error: `Недостаточно кристаллов.` };
    }

    // 4) повторная проверка гонки
    const q2 = this.quote(u, kind);
    if (!q2.ok || q2.remainingMs <= 0) {
      if (orders?.logFastForwardFail) {
        await orders.logFastForwardFail({ userId: u.id, activity: kind, reason: "race_done", ts: now() });
      }
      return { ok: false, error: "Уже готово — просто забери результат." };
    }

    // 5) форс-завершение
    const nowTs = now();

    if (kind === "work") {
      const inst = Array.isArray(u?.jobs?.active) ? u.jobs.active[0] : null;
      if (!inst) return { ok: false, error: "Активной работы нет." };
      if (nowTs >= (inst.endAt || 0)) return { ok: false, error: "Уже готово — забери выплату." };
      // Только ускоряем: endAt = сейчас. Выплата — в JobService.claim(u) (хендлер).
      inst.endAt = nowTs;
    }
    if (kind === "study") {
      if (!u?.study?.active) return { ok: false, error: "Учёба не идёт." };
      if (nowTs >= (u.study.endAt || 0)) {
        return { ok: false, error: "Учёба уже завершена." };
      }
      u.study.endAt = nowTs;
    }
    


    // GYM: заканчиваем через сервис (он сам поднимет уровень/кап и обновит “силачей”)
    if (kind === "gym") {
      if (!u?.gym?.active) return { ok: false, error: "Тренировка не идёт." };
      if (nowTs >= (u.gym.endAt || 0)) return { ok: false, error: "Тренировка уже завершена." };
      // Только ускоряем: завершаем таймер сейчас.
      // Само завершение (ап капа/уровня и UI) делает хендлер через GymService.maybeFinish(u,...)
      u.gym.endAt = nowTs;
    }
    
    
    // 6) списание и лимит
    u.premium = Math.max(0, (u.premium || 0) - q2.cost);
    const dk = this._dayKey();
    if (!u.fastForwardDaily || u.fastForwardDaily.day !== dk) {
      u.fastForwardDaily = { day: dk, n: 0 };
    }
    u.fastForwardDaily.n = (u.fastForwardDaily.n || 0) + 1;

    await users.save(u);

    // 7) логи
    try {
      if (orders) {
        await orders.incrFfAgg("ff_total", 1, nowTs);
        await orders.incrFfAgg(`ff_${kind}`, 1, nowTs);
        await orders.incrFfAgg("ff_gems_spent", q2.cost, nowTs);
        await orders.logFastForward({
          userId: u.id,
          activity: kind,
          cost: q2.cost,
          balanceAfter: u.premium,
          ts: nowTs
        });
      }
    } catch {}

    // Возвращаем без выплаты — claim сделает хендлер (для work)
    return { ok: true, cost: q2.cost, activity: kind };
  }
}
