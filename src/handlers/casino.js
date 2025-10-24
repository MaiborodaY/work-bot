// handlers/casino.js
import { CONFIG } from "../GameConfig.js";
import { BarService } from "../BarService.js";
import { Formatters } from "../Formatters.js";

export const casinoHandler = {
  match: (data) =>
    data.startsWith("casino_spin") ||
    data.startsWith("casino_allin") ||
    data === "casino_free" ||
    data === "casino_info",

  async handle(ctx) {
    const { data, u, cb, answer, users, casino, now, env, social } = ctx; // goTo не используем здесь
    const chatId = cb.message.chat.id;

    // гарантируем структуру пользователя
    u.casino = u.casino || { last: 0, day: "", spins: 0 };
    u.casino.free = u.casino.free || { day: "", lastPrize: 0 };
    if (typeof u.casino.bestSingleWin !== "number") u.casino.bestSingleWin = 0;

    // право на бесплатный спин через подписку (добавляем мягко)
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
    u.casino.stats = { day, won: 0, lost: 0, week: wk, wonW: 0, lostW: 0 };
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
  return u.casino.stats;
};


    

    const PRICES = Array.isArray(CONFIG.CASINO.prices) && CONFIG.CASINO.prices.length
      ? CONFIG.CASINO.prices
      : [CONFIG.CASINO.price_low, CONFIG.CASINO.price_high];

    const makeGridKeyboard = () => {
      const rows = [];
      for (let i = 0; i < PRICES.length; i += 2) {
        const row = [];
        const p1 = PRICES[i];
        row.push({ text: `🎡 Спин — $${p1}`, callback_data: `casino_spin:${p1}` });
        const p2 = PRICES[i + 1];
        if (p2 != null) row.push({ text: `🎡 Спин — $${p2}`, callback_data: `casino_spin:${p2}` });
        rows.push(row);
      }
      rows.push([{ text: "🃏 All in", callback_data: "casino_allin:ask" }]);
      rows.push([{ text: "ℹ️ Таблица выплат", callback_data: "casino_info" }]);
      rows.push([{ text: "🚪 Вернуться на Площадь", callback_data: "o:Square" }]);

      return { inline_keyboard: rows };
    };

    const againKeyboard = makeGridKeyboard();

    const canPlayChecks = () => {
      const t = now();
      const today = todayStr();
      if (u.casino.day !== today) { u.casino.day = today; u.casino.spins = 0; }
      if ((u.casino.spins || 0) >= CONFIG.CASINO.daily_limit) return "Лимит спинов на сегодня исчерпан.";
      if (t - (u.casino.last || 0) < CONFIG.CASINO.cooldown_ms) return "Подожди несколько секунд…";
      return null;
    };

    // Ядро одного спина (UI: результат + клавиатура ещё ставок)
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
      // Для платного спина ставка уже списана выше, поэтому тут просто +win.
      // Для бесплатного — тоже корректно: ставки не было.
      const postMoney = (u.money || 0) + win;
      
      const text = `${headerText}${headerText ? "\n" : ""}${
        win > 0
          ? `🎉 Выигрыш: $${win} (×${mult})`
          : `🙃 Мимо. Попробуй ещё!`
      }\nСтавка: $${bet}\n💰 Деньги: $${postMoney}\nСегодня: ${u.casino.spins}/${CONFIG.CASINO.daily_limit}`;
      
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
      if (bet <= 0) { await answer(cb.id, "💸 Недостаточно денег для ставки."); return; }
      if ((u.money || 0) < bet) { await answer(cb.id, "💸 Недостаточно денег для этой ставки."); return; }

      const t = now();
      u.money -= bet;
      u.casino.spins = (u.casino.spins || 0) + 1;
      u.casino.last = t;
      await users.save(u);

      // >>> Прогресс квеста Бара по казино (по факту спина)
      await BarService.onCasinoSpin({ u, users, now });

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
st.won  = Math.max(0, (st.won  || 0)  + Math.max(0, win));
st.wonW = Math.max(0, (st.wonW || 0)  + Math.max(0, win));
st.lost  = Math.max(0, (st.lost  || 0)  + Math.max(0, bet));
st.lostW = Math.max(0, (st.lostW || 0)  + Math.max(0, bet));

if (win > 0) u.money += win;
await users.save(u);
      
      
      // остаёмся в потоковом UI (againKeyboard)
    };

    // ---------- БЕСПЛАТНЫЙ СПИН ----------
    if (data === "casino_free") {
      const today = todayStr();

      // уже использован сегодня → обычный ответ
      if (u.casino.free.day === today) {
        await answer(cb.id, "🎲 Бесплатный спин уже использован. Доступно завтра.");
        return;
      }

      // проверка права на сегодня: приходит из Бара
      const eligibleToday = (u.subReward.day === today) && u.subReward.eligible === true;

      if (!eligibleToday) {
        // нет права → НЕ крутим, предлагаем идти в Бар
        await tgSend("sendMessage", {
          chat_id: chatId,
          text: "Чтобы получить бесплатный спин, зайдите в Бар и заберите ежедневную награду за подписку.",
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🍻 В бар «Две Лисы»", callback_data: "go:Bar" }]
            ]
          }
        });
        await answer(cb.id, "");
        return;
      }

      // есть право → помечаем использование и сразу сбрасываем право
      u.casino.free.day = today;
      u.subReward.eligible = false;
      await users.save(u);

      // >>> Прогресс квеста Бара по казино (по факту спина)
      await BarService.onCasinoSpin({ u, users, now });

      await answer(cb.id, "🎲 Бесплатный спин!");

      const bet = 10;
      const { win } = await spinCore({
        bet,
        headerText: "🎲 Бесплатный спин (ставка $10, без списания)"
      });
      
      // рекорд за 1 спин — учитываем и бесплатные спины
// --- рекорд за 1 спин (free тоже учитываем)
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
// статистика: бесплатный — ТОЛЬКО выигрыш
const st = ensureStats(u);
st.won  = Math.max(0, (st.won  || 0) + Math.max(0, win));
st.wonW = Math.max(0, (st.wonW || 0) + Math.max(0, win));

if (win > 0) u.money += win;
u.casino.free.lastPrize = win;
await users.save(u);
      

      // остаёмся в потоковом меню
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
        reply_markup: makeGridKeyboard()
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
        text: `🃏 Поставить всё?\n${Formatters.moneyLine(u)}`,
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
        text: "Выбери ставку:",
        parse_mode: "HTML",
        reply_markup: againKeyboard
      });
      await answer(cb.id, "Отменено.");
      return;
    }
  }
};
