// handlers/social.js — стопор ника + нормализация имён в старых записях
import { NameService } from "../NameService.js";
import { normalizeLang, t } from "../i18n/index.js";

export const socialHandler = {
  match: (data) =>
  data === "go:CityBoard" ||
  data === "city:topday"  ||
  data === "city:topweek" ||      // ← добавили
  data === "city:topsmart" ||     // ← добавили
  data === "city:topstrong" ||
  data === "city:toplucky" ||
  data === "city:topsynday" ||
  data === "city:topfishday" ||
  data === "city:topmarketday" ||
  data === "city:topbizday" ||
  data === "city:toptheftweek" ||
  data === "city:topfarmweek" ||
  data === "city:topfarmday" ||
  data === "city:topfarmall" ||
  data === "social:name",


  async handle(ctx) {
    const { data, cb, u, answer, locations, ui, social, goTo, users } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const medals = ["🥇", "🥈", "🥉"];
    const shortName = (raw) => {
      const s = String(raw || "").trim();
      if (!s) return tt("loc.square.player_fallback_id", { id: String(u?.id || "").slice(-4).padStart(4, "0") });
      return s.length > 24 ? `${s.slice(0, 23)}…` : s;
    };
    const topProfileKb = (list, sourceToken, baseKb) => {
      const kb = [];
      const arr = Array.isArray(list) ? list.slice(0, 15) : [];
      for (let i = 0; i < arr.length; i++) {
        const row = arr[i] || {};
        const uid = String(row.userId ?? row.id ?? "").trim();
        if (!uid) continue;
        const marker = medals[i] || `${i + 1}.`;
        const label = `${marker} ${shortName(row.name)}`;
        kb.push([{ text: label, callback_data: `profile:view:${uid}:${sourceToken}` }]);
      }
      if (Array.isArray(baseKb) && baseKb.length) {
        kb.push(...baseKb);
      }
      return kb;
    };
    const clanNameCache = new Map();
    const readClanNameByUserId = async (userIdRaw) => {
      const userId = String(userIdRaw || "").trim();
      if (!userId) return "";
      if (clanNameCache.has(userId)) return clanNameCache.get(userId) || "";
      let clanName = "";
      try {
        const player = await users?.load?.(userId);
        const clanId = String(player?.clan?.clanId || "").trim();
        if (clanId && users?.db?.get) {
          const rawClan = await users.db.get(`clan:item:${clanId}`).catch(() => null);
          if (rawClan) {
            const parsed = JSON.parse(rawClan);
            clanName = String(parsed?.name || "").replace(/\s+/g, " ").trim();
          }
        }
      } catch {}
      clanNameCache.set(userId, clanName);
      return clanName;
    };
    const normalizeTop = async (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      const out = [];
      for (const item of arr) {
        const userId = String(item?.userId ?? item?.id ?? "").trim();
        const looksLikeId = typeof item?.name === "string" && /^[0-9]+$/.test(item.name.trim());
        const empty = !item?.name || !String(item.name).trim();
        const masked = tt("loc.square.player_fallback_id", { id: userId.slice(-4).padStart(4, "0") });
        const baseName = (empty || looksLikeId) ? masked : String(item.name).trim();
        const clanName = await readClanNameByUserId(userId);
        const shownName = clanName ? `${baseName} [${clanName}]` : baseName;
        out.push({ ...item, userId, name: shownName, clanName });
      }
      return out;
    };

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
              keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: tt("ui.back.square"), callback_data: "go:Square" }]],
              policy: "auto",
            });
            locations.setSourceMessage(null);
          }, "", lang);
          return;
        }

    if (data === "city:toplucky") {
      await answer(cb.id);
      const raw = await social.getLuckyTop(15).catch(() => []);
      const list = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopLuckyCaption(list, lang),
        keyboard: topProfileKb(list, "lucky", ui.cityTopLucky(lang)),
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
      await answer(cb.id, tt("handler.social.need_nick"));

      // единая точка показа промпта ника
      const ns = new NameService({ users });
      await ns.prompt(async (text, extra) => {
        await locations.media.show({
          sourceMsg: locations._sourceMsg,
          place: "CityBoard",
          caption: text,
          keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: tt("ui.back.square"), callback_data: "go:Square" }]],
          policy: "auto",
        });
        locations.setSourceMessage(null);
      }, "", lang);

      return;
    }

    if (data === "city:topfarmweek") {
      await answer(cb.id);
      const raw = await social.getFarmWeekTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopFarmWeekCaption(top, lang),
        keyboard: topProfileKb(top, "farmweek", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topmarketday") {
      await answer(cb.id);
      const raw = await social.getMarketDayTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopMarketDayCaption(top, lang),
        keyboard: topProfileKb(top, "marketday", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topfishday") {
      await answer(cb.id);
      const raw = await social.getFishDayTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopFishDayCaption(top, lang),
        keyboard: topProfileKb(top, "fishday", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topsynday") {
      await answer(cb.id);
      const raw = await social.getSynDayTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopSynDayCaption(top, lang),
        keyboard: topProfileKb(top, "synday", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topbizday") {
      await answer(cb.id);
      const raw = await social.getBizDayTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopBizDayCaption(top, lang),
        keyboard: topProfileKb(top, "bizday", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:toptheftweek") {
      await answer(cb.id);
      const raw = await social.getTheftWeekTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopTheftWeekCaption(top, lang),
        keyboard: topProfileKb(top, "theftweek", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topfarmday" || data === "city:topfarmall") {
      await answer(cb.id);
      const raw = await social.getFarmDayTop().catch(() => []);
      const top = await normalizeTop(raw);
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopFarmDayCaption(top, lang),
        keyboard: topProfileKb(top, "farmday", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "go:CityBoard") {
      await answer(cb.id);
      const totals = await social.getTotals();
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: tt("handler.social.board_caption", { day: totals.day, week: totals.week, all: totals.all }),
        keyboard: ui.cityBoard(lang),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topday") {
      await answer(cb.id);
      const raw = await social.getDailyTop(); // [{userId,name,total}]
      const top = await normalizeTop(raw);

      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopDayCaption(top, lang),
        keyboard: topProfileKb(top, "day", ui.cityTopDay(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topweek") {
      await answer(cb.id);
      const raw = await social.getWeeklyTop(); // [{userId,name,total}]
      const top = await normalizeTop(raw);

      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopWeekCaption(top, lang),
        keyboard: topProfileKb(top, "week", ui.cityTopDay(lang)), // можно переиспользовать ту же «Назад»-клавиатуру
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }

    if (data === "city:topsmart") {
      await answer(cb.id);
      const raw = await social.getGeneralQuizDayTop().catch(() => []); // [{userId,name,total}]
      const top = await normalizeTop(raw);

      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopSmartCaption(top, lang),
        keyboard: topProfileKb(top, "smart", ui.cityTopDay(lang)), // можем переиспользовать ту же "назад"-клаву
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
            keyboard: extra?.reply_markup?.inline_keyboard || [[{ text: tt("ui.back.square"), callback_data: "go:Square" }]],
            policy: "auto",
          });
          locations.setSourceMessage(null);
        }, "", lang);
        return;
      }
    
      // читаем дневной топ по наёмникам (доход владельца: деньги + кристаллы)
      const raw = await social.getLabourDayTop().catch(() => []); // [{userId,name,money,gems}]
      const top = await normalizeTop(raw);
    
      await locations.media.show({
        sourceMsg: locations._sourceMsg,
        place: "CityBoard",
        caption: ui.cityTopStrongCaption(top, lang),
        keyboard: topProfileKb(top, "strong", ui.cityTopStrong(lang)),
        policy: "auto",
      });
      locations.setSourceMessage(null);
      return;
    }
    

  }
};
