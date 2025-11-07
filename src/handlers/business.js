// handlers/business.js
import { CONFIG } from "../GameConfig.js";

export const businessHandler = {
  match: (data) => data.startsWith("biz:"),

  async handle(ctx) {
    const { data, u, users, answer, goTo, now, send } = ctx;
    const [ns, action, id] = data.split(":"); // biz:buy:shawarma / biz:claim:shawarma

    if (action === "buy") {
      const B = CONFIG.BUSINESS[id];
      if (!B) { await answer("Бизнес не найден"); return; }

      // уже куплено?
      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      const isOwned = ownedArr.some(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
      if (isOwned) {
        await answer("Уже куплено");
        await goTo(u, (id === "shawarma") ? "Biz_shawarma" : (id === "stomatology") ? "Biz_stomatology" : "Business");
        return;
      }

      // хватает ли денег?
      const price = Number(B.price) || 0;
      const money = Number.isFinite(u?.money) ? u.money : 0;
      if (money < price) {
        await answer("Недостаточно денег");
        // мягкий редирект, чтобы показать цену и баланс
        await goTo(u, "Business", "❌ Недостаточно денег для покупки.");
        return;
      }

      // списываем и сохраняем владение
      u.money = money - price;
      if (!u.biz) u.biz = {};
      if (!Array.isArray(u.biz.owned)) u.biz.owned = [];
      u.biz.owned.push({ id: B.id, boughtAt: now(), lastClaimDayUTC: "" });
      await users.save(u);

      await send(`✅ Куплено: ${B.emoji} ${B.title}\n−$${price}\nБаланс: $${u.money}`);
      await goTo(u, (id === "shawarma") ? "Biz_shawarma" : (id === "stomatology") ? "Biz_stomatology" : "Business");
      return;
    }

    if (action === "claim") {
        const B = CONFIG.BUSINESS[id];
        if (!B) { await answer("Бизнес не найден"); return; }
      
        const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
        const idx = ownedArr.findIndex(it => (typeof it === "string" ? it === B.id : it?.id === B.id));
        if (idx < 0) {
          await answer("Этот бизнес у тебя не куплен");
          await goTo(u, (id === "shawarma") ? "Biz_shawarma" : (id === "stomatology") ? "Biz_stomatology" : "Business");
          return;
        }
      
        // День по UTC
        const todayUTC = new Date().toISOString().slice(0, 10);
        const entry = typeof ownedArr[idx] === "string" ? { id: B.id } : ownedArr[idx];
      
        if (entry.lastClaimDayUTC === todayUTC) {
          await answer("Сегодня уже забрано");
          await goTo(u, "Business");
          return;
        }
      
        // «Не забрал — сгорело»: просто выдаём ровно 1× в день
        const reward = Number(B.daily) || 0;
        u.money = (Number.isFinite(u.money) ? u.money : 0) + reward;
      
        // фиксируем факт сбора на сегодня
        entry.lastClaimDayUTC = todayUTC;
        ownedArr[idx] = entry;
        u.biz = u.biz || {};
        u.biz.owned = ownedArr;
        await users.save(u);
      
        await send(`💼 ${B.emoji} ${B.title}\n✅ Получено за сегодня: $${reward}\nБаланс: $${u.money}`);
        await goTo(u, (id === "shawarma") ? "Biz_shawarma" : (id === "stomatology") ? "Biz_stomatology" : "Business");
        return;
      }
    await answer("Неизвестное действие");
  }
};
