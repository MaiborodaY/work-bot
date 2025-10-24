// handlers/fastforward.js
import { CONFIG } from "../GameConfig.js";
import { JobService } from "../JobService.js";

const HOUR_MS = 60 * 60 * 1000;

function ceilHours(ms) {
  if (ms <= 0) return 0;
  return Math.ceil(ms / HOUR_MS);
}

function ffCfg() {
  const c = CONFIG.FAST_FORWARD || {};
  return {
    PRICE_PER_HOUR: c.PRICE_PER_HOUR ?? 1,
    MAX_HOURS_PER_TX: c.MAX_HOURS_PER_TX ?? 24,
    DAILY_LIMIT: c.DAILY_LIMIT ?? 3,
    MIN_COST: c.MIN_COST ?? 1
  };
}

function remainingMsOf(u, kind, now) {
  if (kind === "work") {
    const inst = u.jobs?.active?.[0] || null;
    if (!inst) return 0;
    return Math.max(0, (inst.endAt || 0) - now());
  }
  if (kind === "study") {
    if (!u?.study?.active) return 0;
    return Math.max(0, (u.study.endAt || 0) - now());
  }
  if (kind === "gym") {
    if (!u?.gym?.active) return 0;
    return Math.max(0, (u.gym.endAt || 0) - now());
  }
  return 0;
}

function computeCost(u, kind, now) {
  const C = ffCfg();
  const left = remainingMsOf(u, kind, now);
  if (left <= 0) return { leftMs: 0, hoursToCharge: 0, cost: 0 };

  const hours = Math.min(C.MAX_HOURS_PER_TX, ceilHours(left));
  const raw = hours * C.PRICE_PER_HOUR;
  const cost = Math.max(C.MIN_COST, raw);
  return { leftMs: left, hoursToCharge: hours, cost };
}

function dayKeyUTC(now) {
  const d = new Date(now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export const fastForwardHandler = {
  match: (data) => typeof data === "string" && data.startsWith("ff:finish:"),

  async handle(ctx) {
    const { data, u, cb, answer, users, now, study, goTo, send, social } = ctx;
    const kind = data.split(":")[2]; // "work" | "study" | "gym"

    // 1) валидация активности
    const left = remainingMsOf(u, kind, now);
    if (left <= 0) {
      await answer(cb.id, "Уже готово.");
      // мягко открыть соответствующий экран
      if (kind === "work") await goTo(u, "Work");
      if (kind === "study") await goTo(u, "Study");
      if (kind === "gym") await goTo(u, "Gym");
      return;
    }

    // 2) лимит/стоимость
    const C = ffCfg();
    const dk = dayKeyUTC(now);
    if (!u.fastForwardDaily || u.fastForwardDaily.day !== dk) {
      u.fastForwardDaily = { day: dk, n: 0 };
    }
    if ((u.fastForwardDaily.n || 0) >= C.DAILY_LIMIT) {
      await answer(cb.id, `Лимит ускорений на сегодня исчерпан (${C.DAILY_LIMIT}).`);
      return;
    }

    const { cost } = computeCost(u, kind, now);
    if ((u.premium || 0) < cost) {
      await answer(cb.id, `Недостаточно кристаллов: нужно ${CONFIG.PREMIUM.emoji}${cost}.`);
      return;
    }

    // 3) списание и завершение
    u.premium = (u.premium || 0) - cost;

    // гонка: пересчёт перед фиксацией
    const left2 = remainingMsOf(u, kind, now);
    if (left2 <= 0) {
      // вернуть кристаллы (не тратили)
      u.premium = (u.premium || 0) + cost;
      await users.save(u);
      await answer(cb.id, "Уже готово.");
      if (kind === "work") await goTo(u, "Work");
      if (kind === "study") await goTo(u, "Study");
      if (kind === "gym") await goTo(u, "Gym");
      return;
    }

    // помечаем день
    u.fastForwardDaily.n = (u.fastForwardDaily.n || 0) + 1;

    // собственно финиш
    if (kind === "work") {
      // ускоряем работу: ставим endAt=now и сразу claim
      const jobSvc = new JobService({ users, now, social });
      const active = u.jobs?.active?.[0] || null;
      if (!active) {
        await users.save(u);
        await answer(cb.id, "Активной работы нет.");
        await goTo(u, "Work");
        return;
      }
      active.endAt = now();
      const res = await jobSvc.claim(u);
      await users.save(u);
      if (!res.ok) {
        await answer(cb.id, res.error || "Не удалось завершить.");
        await goTo(u, "Work");
        return;
      }
      await answer(cb.id, `⏩ Готово: +$${res.pay} (−${CONFIG.PREMIUM.emoji}${cost})`);
      await goTo(u, "Work");
      return;
    }

    if (kind === "study") {
      if (!u.study?.active) {
        await users.save(u);
        await answer(cb.id, "Учёба не идёт.");
        await goTo(u, "Study");
        return;
      }
      u.study.endAt = now();
      await users.save(u);
      await study.maybeFinish(u, goTo);
      await answer(cb.id, `⏩ Учёба завершена (−${CONFIG.PREMIUM.emoji}${cost}).`);
      return;
    }

    if (kind === "gym") {
      if (!u.gym?.active) {
        await users.save(u);
        await answer(cb.id, "Тренировка не идёт.");
        await goTo(u, "Gym");
        return;
      }
      u.gym.endAt = now();
      await users.save(u);
      // автодогона Gym мы делаем через Locations.maybeFinishGym при открытии экрана,
      // но чтобы флоу был мгновенным — сразу вернём пользователя в Gym.
      await goTo(u, "Gym", `⏩ Тренировка завершена (−${CONFIG.PREMIUM.emoji}${cost}).`);
      return;
    }

    await users.save(u);
    await answer(cb.id, "Неизвестная активность.");
  },
};

export function previewFastForwardCost(u, kind, now) {
  // утилита для UI
  const { cost } = computeCost(u, kind, now);
  return cost;
}
