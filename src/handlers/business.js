// handlers/business.js
import { CONFIG } from "../GameConfig.js";

export const businessHandler = {
  match: (data) => data.startsWith("biz:"),

  async handle(ctx) {
    const { data, u, users, answer, goTo, now, send, clans } = ctx;
    const [ns, action, id] = data.split(":"); // biz:buy:shawarma / biz:claim:shawarma
    const bizRoute = (bizId) => (bizId ? `Biz_${bizId}` : "Business");

    if (action === "buy") {
      const B = CONFIG.BUSINESS[id];
      if (!B) { await answer("Бизнес не найден"); return; }

      // Уже куплено?
      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      const isOwned = ownedArr.some(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      if (isOwned) {
        await answer("Уже куплено");
        await goTo(u, bizRoute(id));
        return;
      }

      // Достаточно денег?
      const price = Number(B.price) || 0;
      const money = Number.isFinite(u?.money) ? u.money : 0;
      if (money < price) {
        await answer("Недостаточно денег");
        await goTo(u, "Business", "⚠️ Недостаточно денег для покупки.");
        return;
      }

      // Списываем деньги и сохраняем покупку
      u.money = money - price;
      if (!u.biz) u.biz = {};
      if (!Array.isArray(u.biz.owned)) u.biz.owned = [];
      u.biz.owned.push({ id: B.id, boughtAt: now(), lastClaimDayUTC: "" });
      await users.save(u);

      await send(`✅ Куплено: ${B.emoji} ${B.title}\n💵$${price}\nБаланс: $${u.money}`);
      await goTo(u, bizRoute(id));
      return;
    }

    if (action === "claim") {
      const B = CONFIG.BUSINESS[id];
      if (!B) { await answer("Бизнес не найден"); return; }
      
      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      const idx = ownedArr.findIndex(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      if (idx < 0) {
        await answer("У вас нет такого бизнеса");
        await goTo(u, bizRoute(id));
        return;
      }
      
      // Текущая дата в UTC
      const todayUTC = new Date().toISOString().slice(0, 10);
      const entry = typeof ownedArr[idx] === "string" ? { id: B.id } : ownedArr[idx];
      
      if (entry.lastClaimDayUTC === todayUTC) {
        await answer("Прибыль уже собрана");
        await goTo(u, "Business");
        return;
      }
      
      // Начисляем ежедневную прибыль в баланс
      const reward = Number(B.daily) || 0;
      u.money = (Number.isFinite(u.money) ? u.money : 0) + reward;
      
      // Сохраняем дату сбора
      entry.lastClaimDayUTC = todayUTC;
      ownedArr[idx] = entry;
      u.biz = u.biz || {};
      u.biz.owned = ownedArr;
      await users.save(u);

      try {
        if (clans?.recordBusinessMoney) {
          await clans.recordBusinessMoney(u, reward);
        }
      } catch {}
      
      await send(`💰 ${B.emoji} ${B.title}\n🤑 Прибыль за сутки: $${reward}\nБаланс: $${u.money}`);
      await goTo(u, bizRoute(id));
      return;
    }
    await answer("Неизвестная команда");
  }
};
