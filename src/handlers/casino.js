// handlers/casino.js
import { CONFIG } from "../GameConfig.js";
import { Formatters } from "../Formatters.js";
import { normalizeLang, t } from "../i18n/index.js";

const CASINO_RATING_KEY = "casino:rating:all";
const CASINO_RATING_LIMIT = 15;

function casinoRatingSort(list) {
  return list.slice().sort((a, b) => {
    const d = (b.net || 0) - (a.net || 0);
    return d !== 0 ? d : (a.reachedAt || 0) - (b.reachedAt || 0);
  });
}

async function updateCasinoRating(db, u, nowTs) {
  if (!db || !u?.id) return;
  const uid = String(u.id);
  const st = u?.casino?.stats;
  if (!st) return;
  const net  = (st.wonAll || 0) - (st.lostAll || 0);
  const spent = st.lostAll || 0;
  const name = String(u.displayName || uid).slice(0, 32);
  const raw = await db.get(CASINO_RATING_KEY).catch(() => null);
  let list = [];
  try { list = JSON.parse(raw) || []; } catch {}
  if (!Array.isArray(list)) list = [];
  const idx = list.findIndex((x) => String(x.userId) === uid);
  const entry = { userId: uid, name, net, spent, reachedAt: nowTs };
  if (idx >= 0) {
    entry.reachedAt = list[idx].net === net ? (list[idx].reachedAt || nowTs) : nowTs;
    list[idx] = entry;
  } else {
    list.push(entry);
  }
  const sorted = casinoRatingSort(list).slice(0, CASINO_RATING_LIMIT + 20);
  await db.put(CASINO_RATING_KEY, JSON.stringify(sorted)).catch(() => {});
}

export const casinoHandler = {
  match: (data) =>
    data.startsWith("casino_spin") ||
    data.startsWith("casino_allin") ||
    data === "casino_free" ||
    data === "casino_info" ||
    data === "casino_top",

  async handle(ctx) {
    const { data, u, cb, answer, users, casino, now, env, social, clans, stocks, quests } = ctx; // goTo не используем здесь
    const chatId = cb.message.chat.id;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    const minStudy = Number(CONFIG?.CASINO?.MIN_STUDY_FOR_PAID ?? 5);
    const studyLevel = Math.max(0, Number(u?.study?.level) || 0);
    const allowPaid = studyLevel >= minStudy;
    if (!allowPaid) {
      await answer(cb.id, tt("handler.casino.locked_gate", { level: minStudy }));
      return;
    }

    // гарантируем структуру пользователя
    u.casino = u.casino || { last: 0, day: "", spins: 0 };
    u.casino.free = u.casino.free || { day: "", lastPrize: 0 };
    if (typeof u.casino.bestSingleWin !== "number") u.casino.bestSingleWin = 0;

    // право на бесплатную попытку через подписку (добавляем мягко)
    if (!u.subReward || typeof u.subReward !== "object") {
      u.subReward = { day: "", eligible: false };
    } else {
      if (typeof u.subReward.day !== "string") u.subReward.day = "";
      if (typeof u.subReward.eligible !== "boolean") u.subReward.eligible = false;
    }

    // мини-хелпер отправки сообщений (кроме sendDice)
    const tgSend = async (method, payload) => {
      await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    };

    const todayStr = () => new Date().toISOString().slice(0, 10);
// ISO-неделя по UTC: YYYYWW (как в SocialService)
const weekKeyUTC = () => {
  const d = new Date();
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // 0..6, 0=понедельник
  const thursday = new Date(tmp);
  thursday.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const diffDays = Math.floor((thursday.getTime() - firstThursday.getTime()) / 86400000);
  const week = 1 + Math.floor(diffDays / 7);
  return `${thursday.getUTCFullYear()}${String(week).padStart(2, "0")}`;
};

// нормализация структуры статистики на юзере
const ensureStats = (u) => {
  const day = todayStr();
  const wk  = weekKeyUTC();
  if (!u.casino) u.casino = {};
  if (!u.casino.stats || typeof u.casino.stats !== "object") {
    u.casino.stats = { day, won: 0, lost: 0, week: wk, wonW: 0, lostW: 0, wonAll: 0, lostAll: 0 };
  }
  if (u.casino.stats.day !== day) {
    u.casino.stats.day  = day;
    u.casino.stats.won  = 0;
    u.casino.stats.lost = 0;
  }
  if (u.casino.stats.week !== wk) {
    u.casino.stats.week  = wk;
    u.casino.stats.wonW  = 0;
    u.casino.stats.lostW = 0;
  }
  if (typeof u.casino.stats.wonAll  !== "number") u.casino.stats.wonAll  = 0;
  if (typeof u.casino.stats.lostAll !== "number") u.casino.stats.lostAll = 0;
  return u.casino.stats;
};


    

    const PRICES = Array.isArray(CONFIG.CASINO.prices) && CONFIG.CASINO.prices.length
      ? CONFIG.CASINO.prices
      : [CONFIG.CASINO.price_low, CONFIG.CASINO.price_high];

    const makeGridKeyboard = ({ allowPaid } = {}) => {
      const rows = [];
      if (allowPaid) {
        for (let i = 0; i < PRICES.length; i += 2) {
          const row = [];
          const p1 = PRICES[i];
          row.push({ text: `🌀 $${p1}`, callback_data: `casino_spin:${p1}` });
          const p2 = PRICES[i + 1];
          if (p2 != null) row.push({ text: `🌀$${p2}`, callback_data: `casino_spin:${p2}` });
          rows.push(row);
        }
        rows.push([{ text: "🃏 All in", callback_data: "casino_allin:ask" }]);
      }
      rows.push([{ text: "ℹ️ Таблица выплат", callback_data: "casino_info" }]);
      rows.push([{ text: "⬅️ В бар", callback_data: "go:Bar" }]);

      return { inline_keyboard: rows };
    };

    const againKeyboard = makeGridKeyboard({ allowPaid });

    // server-side gate for paid attempts (buttons can be bypassed via old messages)
    if (!allowPaid && (data.startsWith("casino_spin") || data.startsWith("casino_allin"))) {
      await answer(cb.id, `Больше попыток доступно с уровня учебы ${minStudy}.`);
      return;
    }

    const canPlayChecks = () => {
      const t = now();
      const today = todayStr();
      if (u.casino.day !== today) { u.casino.day = today; u.casino.spins = 0; }
      if ((u.casino.spins || 0) >= CONFIG.CASINO.daily_limit) return "Лимит попыток на сегодня исчерпан.";
      if (t - (u.casino.last || 0) < CONFIG.CASINO.cooldown_ms) return "Подожди несколько секунд…";
      return null;
    };

    // Ядро одной попытки (UI: результат + клавиатура новых попыток)
    const spinCore = async ({ bet, headerText = "" }) => {
      const diceResp = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendDice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, emoji: "🎰" })
      });
      const diceJson = await diceResp.json().catch(()=>({}));
      const val = diceJson?.result?.dice?.value || 0;

      // дождаться «прокрутки барабана»
      await new Promise(res => setTimeout(res, 2500));
      const symbols = casino.decode(val);
      const { mult, win } = casino.payout(symbols, bet);
      
      // Итоговый баланс после СПИНА.
      // Для платного спина сумма попытки уже списана выше, поэтому тут просто +win.
      // Для бесплатного — тоже корректно: списания суммы попытки не было.
      const postMoney = (u.money || 0) + win;
      
      const text = `${headerText}${headerText ? "\n" : ""}${
        win > 0
          ? `🎉 Выигрыш: $${win} (×${mult})`
          : `🙃 Мимо. Попробуй ещё!`
      }\nПопытка: $${bet}\n💰 Деньги: $${postMoney}\nПопыток сегодня: ${u.casino.spins}/${CONFIG.CASINO.daily_limit}`;
      
      await tgSend("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: againKeyboard
      });
      

      return { win, mult };
    };

    // Платный спин: проверки/списание/лимиты → spinCore → начисление выигрыша
    const spinWithBet = async (bet, isAllIn = false) => {
      const err = canPlayChecks();
      if (err) { await answer(cb.id, err); return; }
      if (bet <= 0) { await answer(cb.id, "💸 Недостаточно денег для попытки."); return; }
      if ((u.money || 0) < bet) { await answer(cb.id, "💸 Недостаточно денег для этой попытки."); return; }

      const t = now();
      u.money -= bet;
      u.casino.spins = (u.casino.spins || 0) + 1;
      u.casino.last = t;
      await users.save(u);

      // >>> Прогресс квеста Бара по казино (по факту спина)
      try {
        if (stocks?.recordCasinoSpin) {
          await stocks.recordCasinoSpin(1);
        }
      } catch {}

      await answer(cb.id, isAllIn ? "🃏 All in! Крутим…" : "Крутим…");

      const { win } = await spinCore({ bet });

// --- рекорд за 1 спин + пуш в соц-топ (используем prevBest до апдейта)
const prevBest = Number(u.casino.bestSingleWin || 0);
if (win > prevBest) {
  u.casino.bestSingleWin = win;
  try {
    if (social?.maybeUpdateLuckyTop) {
      await social.maybeUpdateLuckyTop({
        userId: u.id,
        displayName: u.displayName || String(u.id),
        best: win
      });
    }
  } catch {}
}
      
// статистика (UTC): выигрыш всегда, проигрыш — только если не free (а тут платный)
const st = ensureStats(u);
st.won    = Math.max(0, (st.won    || 0) + Math.max(0, win));
st.wonW   = Math.max(0, (st.wonW   || 0) + Math.max(0, win));
st.wonAll = Math.max(0, (st.wonAll || 0) + Math.max(0, win));
st.lost    = Math.max(0, (st.lost    || 0) + Math.max(0, bet));
st.lostW   = Math.max(0, (st.lostW   || 0) + Math.max(0, bet));
st.lostAll = Math.max(0, (st.lostAll || 0) + Math.max(0, bet));

if (win > 0) u.money += win;
await users.save(u);
try { await updateCasinoRating(env.DB, u, now()); } catch {}
try {
  if (clans?.recordFortuneSpin) {
    await clans.recordFortuneSpin(u, { bet, win });
  }
} catch {}
try {
  if (quests?.onEvent) {
    await quests.onEvent(u, "fortune_spin");
  }
} catch {}
      
      
      // остаёмся в потоковом UI (againKeyboard)
    };

    // ---------- БЕСПЛАТНАЯ ПОПЫТКА ----------
    if (data === "casino_free") {
      await answer(cb.id, "За подписку в Баре теперь начисляется +💎1 в день.");
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: "🎁 Бесплатная попытка в Зале арканы больше не выдается.\nТеперь за подписку в Баре: +💎1 в день.",
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🍻 В бар «Две Лисы»", callback_data: "go:Bar" }]
          ]
        }
      });
      return;
    }

    // ---------- СПРАВКА ----------
    if (data === "casino_info") {
      await answer(cb.id, "");
      const t = [
        "ℹ️ Таблица выплат (средний ряд)\n",
        `3×7️⃣ = ×${CONFIG.CASINO.mult3.seven}`,
        `3×BAR = ×${CONFIG.CASINO.mult3.bar}`,
        `3×🍇 = ×${CONFIG.CASINO.mult3.grape}`,
        `3×🍋 = ×${CONFIG.CASINO.mult3.lemon}\n`,
        `2×7️⃣ = ×${CONFIG.CASINO.mult2.seven}`,
        `2×BAR = ×${CONFIG.CASINO.mult2.bar}`,
        `2×🍇 = ×${CONFIG.CASINO.mult2.grape}`,
        `2×🍋 = ×${CONFIG.CASINO.mult2.lemon}`
      ].join("\n");

      await tgSend("sendMessage", {
        chat_id: chatId,
        text: t,
        parse_mode: "HTML",
        reply_markup: makeGridKeyboard({ allowPaid })
      });
      return;
    }

    // ---------- ТОП ИГРОКОВ ----------
    if (data === "casino_top") {
      await answer(cb.id);
      const raw = await env.DB.get(CASINO_RATING_KEY).catch(() => null);
      let list = [];
      try { list = casinoRatingSort(JSON.parse(raw) || []); } catch {}
      list = list.slice(0, CASINO_RATING_LIMIT);
      const medals = ["🥇", "🥈", "🥉"];
      const fmt = (n) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
      const sign = (n) => n >= 0 ? `+${fmt(n)}` : `-${fmt(n)}`;
      const lines = [tt("ui.casino.top_title"), ""];
      if (!list.length) {
        lines.push(tt("ui.casino.top_empty"));
      } else {
        for (let i = 0; i < list.length; i++) {
          const x = list[i];
          const mark = medals[i] || `${i + 1}.`;
          lines.push(`${mark} ${String(x.name || "?")} — ${sign(x.net || 0)} (${tt("ui.casino.top_spent")}: ${fmt(x.spent || 0)})`);
        }
      }
      const uid = String(u?.id || "");
      const me = list.find((x) => String(x.userId) === uid);
      lines.push("");
      if (me) {
        lines.push(`👤 ${tt("ui.casino.top_you")}: ${sign(me.net || 0)} · ${tt("ui.casino.top_spent")}: ${fmt(me.spent || 0)}`);
      } else {
        const mySt = u?.casino?.stats;
        const myNet = mySt ? ((mySt.wonAll || 0) - (mySt.lostAll || 0)) : 0;
        lines.push(`👤 ${tt("ui.casino.top_you_out")}: ${sign(myNet)}`);
      }
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        reply_markup: makeGridKeyboard({ allowPaid })
      });
      return;
    }

    // ---------- ПЛАТНЫЕ СПИНЫ ----------
    if (data.startsWith("casino_spin")) {
      const raw = (data.split(":")[1] || "").toLowerCase();

      let bet = null;
      if (raw === "2") bet = CONFIG.CASINO.price_low;
      else if (raw === "4") bet = CONFIG.CASINO.price_high;
      else {
        const n = Number(raw);
        bet = Number.isFinite(n) && n > 0 ? n : PRICES[0];
      }

      await spinWithBet(bet, false);
      return;
    }

    // ---------- ALL IN ----------
    if (data === "casino_allin:ask") {
      const err = canPlayChecks();
      if (err) { await answer(cb.id, err); return; }
      if ((u.money || 0) <= 0) { await answer(cb.id, "💸 Денег нет — all in невозможен."); return; }

      await tgSend("sendMessage", {
        chat_id: chatId,
        text: `🃏 Использовать весь баланс?\n${Formatters.moneyLine(u)}`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Да, all in", callback_data: "casino_allin:yes" },
            { text: "✖️ Нет",        callback_data: "casino_allin:no"  }
          ]]
        }
      });
      return;
    }

    if (data === "casino_allin:yes") {
      const bet = u.money; // актуальный баланс
      await spinWithBet(bet, true);
      return;
    }

    if (data === "casino_allin:no") {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: "Выбери сумму попытки:",
        parse_mode: "HTML",
        reply_markup: againKeyboard
      });
      await answer(cb.id, "Отменено.");
      return;
    }
  }
};
