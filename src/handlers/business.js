// handlers/business.js
import { CONFIG } from "../GameConfig.js";
import { applyBusinessClaim, getTodayUTC, normalizeBusinessEntry } from "../BusinessPayout.js";
import { normalizeLang, t } from "../i18n/index.js";
import { getBusinessTitle } from "../I18nCatalog.js";

export const businessHandler = {
  match: (data) => data.startsWith("biz:"),

  async handle(ctx) {
    const { data, u, users, answer, goTo, now, send, clans, thief } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const [, action, id] = data.split(":"); // biz:buy:shawarma / biz:claim:shawarma
    const bizRoute = (bizId) => (bizId ? `Biz_${bizId}` : "Business");

    if (action === "buy") {
      const B = CONFIG.BUSINESS[id];
      if (!B) { await answer(tt("handler.business.not_found")); return; }
      const bizTitle = getBusinessTitle(B.id, lang) || B.title;

      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      const isOwned = ownedArr.some((it) => (typeof it === "string" ? it === B.id : it?.id === B.id));
      if (isOwned) {
        await answer(tt("handler.business.already_owned"));
        await goTo(u, bizRoute(id));
        return;
      }

      const price = Number(B.price) || 0;
      const money = Number.isFinite(u?.money) ? u.money : 0;
      if (money < price) {
        await answer(tt("handler.business.not_enough_money"));
        await goTo(u, "Business", tt("handler.business.not_enough_money_intro"));
        return;
      }

      u.money = money - price;
      if (!u.biz) u.biz = {};
      if (!Array.isArray(u.biz.owned)) u.biz.owned = [];
      u.biz.owned.push({
        id: B.id,
        boughtAt: now(),
        lastClaimDayUTC: "",
        stolenDayUTC: "",
        stolenAmountToday: 0
      });
      await users.save(u);

      try {
        if (thief?.upsertBizOwner) {
          await thief.upsertBizOwner(u.id, B.id);
        }
      } catch {}

      await send(tt("handler.business.buy_ok", {
        emoji: B.emoji,
        title: bizTitle,
        price,
        money: u.money
      }));
      await goTo(u, bizRoute(id));
      return;
    }

    if (action === "claim") {
      const B = CONFIG.BUSINESS[id];
      if (!B) { await answer(tt("handler.business.not_found")); return; }
      const bizTitle = getBusinessTitle(B.id, lang) || B.title;

      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      const idx = ownedArr.findIndex((it) => (typeof it === "string" ? it === B.id : it?.id === B.id));
      if (idx < 0) {
        await answer(tt("handler.business.not_owned"));
        await goTo(u, bizRoute(id));
        return;
      }

      const todayUTC = getTodayUTC();
      const entry = normalizeBusinessEntry(
        typeof ownedArr[idx] === "string" ? { id: B.id } : ownedArr[idx],
        B.id
      );

      if (entry.lastClaimDayUTC === todayUTC) {
        await answer(tt("handler.business.already_claimed"));
        await goTo(u, "Business");
        return;
      }

      const reward = applyBusinessClaim(entry, Number(B.daily) || 0, todayUTC);
      u.money = (Number.isFinite(u.money) ? u.money : 0) + reward;

      ownedArr[idx] = entry;
      u.biz = u.biz || {};
      u.biz.owned = ownedArr;
      await users.save(u);

      try {
        if (clans?.recordBusinessMoney) {
          await clans.recordBusinessMoney(u, reward);
        }
      } catch {}

      await send(tt("handler.business.claim_ok", {
        emoji: B.emoji,
        title: bizTitle,
        reward,
        money: u.money
      }));
      await goTo(u, bizRoute(id));
      return;
    }

    if (action === "claim_all") {
      const ownedArr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
      if (!ownedArr.length) {
        await answer(tt("handler.business.not_owned"));
        await goTo(u, "Business");
        return;
      }

      const todayUTC = getTodayUTC();
      const normalizedOwned = ownedArr.map((it) => normalizeBusinessEntry(
        typeof it === "string" ? { id: it, boughtAt: 0, lastClaimDayUTC: "" } : { ...it },
        typeof it === "string" ? it : it?.id
      ));

      let total = 0;
      let rewardedCount = 0;
      let processed = 0;
      for (const entry of normalizedOwned) {
        const bizId = String(entry?.id || "");
        const B = CONFIG.BUSINESS[bizId];
        if (!B) continue;
        if (entry.lastClaimDayUTC === todayUTC) continue;
        processed += 1;

        const reward = applyBusinessClaim(entry, Math.max(0, Number(B.daily) || 0), todayUTC);
        if (reward > 0) {
          total += reward;
          rewardedCount += 1;
        }
      }

      if (processed <= 0) {
        await answer(tt("handler.business.claim_all_none"));
        await goTo(u, "Business");
        return;
      }

      u.money = Math.max(0, Number(u.money) || 0) + total;
      u.biz = u.biz || {};
      u.biz.owned = normalizedOwned;
      await users.save(u);

      try {
        if (clans?.recordBusinessMoney && total > 0) {
          await clans.recordBusinessMoney(u, total);
        }
      } catch {}

      if (total <= 0 || rewardedCount <= 0) {
        await answer(tt("handler.business.claim_all_none"));
        await goTo(u, "Business");
        return;
      }

      await send(tt("handler.business.claim_all_ok", {
        count: rewardedCount,
        reward: total,
        money: u.money
      }));
      await goTo(u, "Business");
      return;
    }
    await answer(tt("handler.common.unknown_command"));
  }
};
