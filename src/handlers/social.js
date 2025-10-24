// handlers/social.js — стопор ника + нормализация имён в старых записях
import { NameService } from "../NameService.js";

export const socialHandler = {
  match: (data) =>
  data === "go:CityBoard" ||
  data === "city:topday"  ||
  data === "city:topweek" ||      // ← добавили
  data === "city:topsmart" ||     // ← добавили
  data === "city:topstrong" ||
  data === "city:toplucky" ||
  data === "social:name",


  async handle(ctx) {
    const { data, cb, u, answer, locations, ui, social, goTo, users } = ctx;

        // ===== ручная смена ника по кнопке в табло =====
        if (data === "social:name") {
          await answer(cb.id);
    
          u.awaitingName = true;
          u.afterNameRoute = "CityBoard";      // ← чистое имя места
          await users.save(u);
    
          const ns = new NameService({ users });
          await ns.prompt(async (text, extra) => {
            await locations.media.show({
              sourceMsg: locations._sourceMsg,
              place: "CityBoard",
              caption: text,
              keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: "⬅️ На Площадь", callback_data: "go:Square" }]],
              policy: "auto",
            });
            locations.setSourceMessage(null);
          });
          return;
        }

    if (data === "city:toplucky") {
      await answer(cb.id);
      const list = await social.getLuckyTop(10).catch(() => []);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopLuckyCaption(list),
        keyboard: ui.cityTopLucky(),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }


    if (data === "city:contribute") {
      await answer(cb.id);
      await goTo(u, "Work");
      return;
    }

    // ник обязателен для табло/топа
    if ((data === "go:CityBoard" || data === "city:topday") && !u.displayName) {
      u.awaitingName = true;
      u.afterNameRoute = data;
      await users.save(u);
      await answer(cb.id, "Нужно указать ник для игры.");

      // единая точка показа промпта ника
      const ns = new NameService({ users });
      await ns.prompt(async (text, extra) => {
        await locations.media.show({
          sourceMsg: locations._sourceMsg,
          place: "CityBoard",
          caption: text,
          keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: "⬅️ На Площадь", callback_data: "go:Square" }]],
          policy: "auto",
        });
        locations.setSourceMessage(null);
      });

      return;
    }

    if (data === "go:CityBoard") {
      await answer(cb.id);
      const totals = await social.getTotals();
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: `🏙️ Впиши свое имя в список Лидеров!\n\nСегодня: $${totals.day}\nНеделя: $${totals.week}\nВсего: $${totals.all}`,
        keyboard: ui.cityBoard(),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topday") {
      await answer(cb.id);
      const raw = await social.getDailyTop(); // [{userId,name,total}]
      const norm = (item) => {
        const idStr = String(item.userId || "");
        const looksLikeId = typeof item.name === "string" && /^[0-9]+$/.test(item.name.trim());
        const empty = !item.name || !String(item.name).trim();
        const masked = `Игрок #${idStr.slice(-4).padStart(4, "0")}`;
        return { ...item, name: (empty || looksLikeId) ? masked : String(item.name).trim() };
      };
      const top = Array.isArray(raw) ? raw.map(norm) : [];

      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopDayCaption(top),
        keyboard: ui.cityTopDay(),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topweek") {
      await answer(cb.id);
      const raw = await social.getWeeklyTop(); // [{userId,name,total}]
      const norm = (item) => {
        const idStr = String(item.userId || "");
        const looksLikeId = typeof item.name === "string" && /^[0-9]+$/.test(item.name.trim());
        const empty = !item.name || !String(item.name).trim();
        const masked = `Игрок #${idStr.slice(-4).padStart(4, "0")}`;
        return { ...item, name: (empty || looksLikeId) ? masked : String(item.name).trim() };
      };
      const top = Array.isArray(raw) ? raw.map(norm) : [];

      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopWeekCaption(top),
        keyboard: ui.cityTopDay(), // можно переиспользовать ту же «Назад»-клавиатуру
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topsmart") {
      await answer(cb.id);
      const raw = await social.getSmartTop(); // [{userId,name,level}]
      const norm = (item) => {
        const idStr = String(item.userId || "");
        const looksLikeId = typeof item.name === "string" && /^[0-9]+$/.test(item.name.trim());
        const empty = !item.name || !String(item.name).trim();
        const masked = `Игрок #${idStr.slice(-4).padStart(4, "0")}`;
        return {
          ...item,
          name: (empty || looksLikeId) ? masked : String(item.name).trim()
        };
      };
      const top = Array.isArray(raw) ? raw.map(norm) : [];

      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopSmartCaption(top),
        keyboard: ui.cityTopDay(), // можем переиспользовать ту же "назад"-клаву
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }
    if (data === "city:topstrong") {
      await answer(cb.id);
    
      // ник обязателен (как в других топах)
      if (!u.displayName) {
        u.awaitingName = true;
        u.afterNameRoute = "city:topstrong";
        await users.save(u);
    
        const ns = new NameService({ users });
        await ns.prompt(async (text, extra) => {
          await locations.media.show({
            sourceMsg: locations._sourceMsg,
            place: "CityBoard",
            caption: text,
            keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: "⬅️ На Площадь", callback_data: "go:Square" }]],
            policy: "auto",
          });
          locations.setSourceMessage(null);
        });
        return;
      }
    
      // читаем топ силачей
      const raw = await social.getStrongTop(); // [{userId,name,energyMax,level}]
      const norm = (item) => {
        const idStr = String(item.userId || "");
        const looksLikeId = typeof item.name === "string" && /^[0-9]+$/.test(item.name.trim());
        const empty = !item.name || !String(item.name).trim();
        const masked = `Игрок #${idStr.slice(-4).padStart(4, "0")}`;
        return { ...item, name: (empty || looksLikeId) ? masked : String(item.name).trim() };
      };
      const top = Array.isArray(raw) ? raw.map(norm) : [];
    
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopStrongCaption(top),
        keyboard: ui.cityTopStrong(),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }
    

  }
};
