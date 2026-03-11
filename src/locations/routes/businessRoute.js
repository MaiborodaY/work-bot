import { CONFIG } from "../../GameConfig.js";
import { ASSETS, JOB_ASSETS } from "../../Assets.js";
import {
  getBusinessAvailableToday,
  getBusinessPendingTheft,
  getTodayUTC,
  normalizeBusinessEntry
} from "../../BusinessPayout.js";
import { getBusinessNote, getBusinessTitle } from "../../I18nCatalog.js";
import { Routes, toGoCallback } from "../../Routes.js";

export async function renderBusinessRoute(ctx, user, { header = "", lang = "ru", route = Routes.BUSINESS } = {}) {
  const bizRouteMeta = {
    Biz_shawarma: {
      id: "shawarma",
      asset: ASSETS?.BusinessShawarma || JOB_ASSETS?.shawarma_seller || ASSETS?.Business,
    },
    Biz_stomatology: {
      id: "stomatology",
      asset: ASSETS?.BusinessStomatology || JOB_ASSETS?.dentist || ASSETS?.Business,
    },
    Biz_restaurant: {
      id: "restaurant",
      asset: ASSETS?.BusinessRestaurant || JOB_ASSETS?.waiter || ASSETS?.Business,
    },
    Biz_courier_service: {
      id: "courier_service",
      asset: ASSETS?.BusinessCourier || JOB_ASSETS?.courier || ASSETS?.Business,
    },
    Biz_fitness_club: {
      id: "fitness_club",
      asset: ASSETS?.BusinessFitness || ASSETS?.Gym || ASSETS?.Business,
    },
  };

  const renderBusinessCard = async (B, options = {}) => {
    const opts = options || {};
    if (!B) {
      await ctx.media.show({
        sourceMsg: ctx._sourceMsg,
        place: Routes.BUSINESS,
        caption: (header || "") + ctx._t(user, "loc.business.unavailable"),
        keyboard: [[{ text: ctx._t(user, "loc.business.btn.back"), callback_data: toGoCallback(Routes.BUSINESS) }]],
        policy: "auto",
      });
      ctx._sourceMsg = null;
      ctx._route = Routes.BUSINESS;
      return;
    }

    const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
    const ownedObj = ownedArr.find((it) => (typeof it === "string" ? it === B.id : it?.id === B.id));
    const isOwned = !!ownedObj;
    const todayUTC = getTodayUTC();
    const entry = isOwned ? normalizeBusinessEntry(typeof ownedObj === "string" ? { id: B.id } : ownedObj, B.id) : null;
    const claimedToday = !!entry && (entry.lastClaimDayUTC === todayUTC);
    const availableToday = entry ? getBusinessAvailableToday(entry, Number(B.daily) || 0, todayUTC) : 0;
    const pendingTheft = entry ? getBusinessPendingTheft(entry, Number(B.daily) || 0) : 0;
    const bizTitle = getBusinessTitle(B.id, lang) || B.title;
    const bizNote = getBusinessNote(B.id, lang) || B.note;

    const statusLine = !isOwned
      ? ctx._t(user, "loc.business.status_unowned")
      : (claimedToday
          ? ctx._t(user, "loc.business.status_claimed_today")
          : ctx._t(user, "loc.business.status_available_today", { amount: availableToday }));
    const stolenLine = isOwned
      ? ctx._t(user, "loc.business.status_stolen_next", { amount: pendingTheft })
      : "";

    const kb = [];
    if (!isOwned) {
      kb.push([{ text: ctx._t(user, "loc.business.btn.buy_for", { price: B.price }), callback_data: `biz:buy:${B.id}` }]);
    } else if (!claimedToday) {
      const claimKey = opts.claimKey || "loc.business.btn.claim";
      kb.push([{ text: ctx._t(user, claimKey, { amount: availableToday }), callback_data: `biz:claim:${B.id}` }]);
    } else {
      kb.push([{ text: ctx._t(user, "loc.business.btn.claimed_today"), callback_data: "noop" }]);
    }

    if (opts.showBackToBusinesses) {
      kb.push([{ text: ctx._t(user, "loc.business.btn.back_businesses"), callback_data: toGoCallback(Routes.BUSINESS) }]);
    }
    kb.push([{ text: ctx._t(user, "loc.business.btn.back_earn"), callback_data: toGoCallback(Routes.EARN) }]);

    const intro = opts.includeIntro ? ctx._t(user, "loc.business.caption_intro") + "\n\n" : "";
    const modeLine = opts.useManualClaim
      ? ctx._t(user, "loc.business.manual_claim")
      : ctx._t(user, "loc.business.no_accumulation");

    await ctx.media.show({
      sourceMsg: ctx._sourceMsg,
      place: Routes.BUSINESS,
      asset: opts.asset || ASSETS?.Business,
      caption:
        (header || "") +
        intro +
        `${B.emoji} ${bizTitle}\n` +
        ctx._t(user, "loc.business.price", { price: B.price }) + "\n" +
        ctx._t(user, "loc.business.daily_income", { daily: B.daily }) + "\n" +
        modeLine + "\n" +
        statusLine +
        (stolenLine ? `\n${stolenLine}` : "") +
        (bizNote ? `\n\nℹ️ ${bizNote}` : ""),
      keyboard: kb,
      policy: "photo",
    });
    ctx._sourceMsg = null;
    ctx._route = opts.routeName || Routes.BUSINESS;
  };

  if (route === Routes.BUSINESS) {
    const items = Object.values(CONFIG?.BUSINESS || {}).filter(Boolean);
    if (items.length > 1) {
      const ownedArr = Array.isArray(user?.biz?.owned) ? user.biz.owned : [];
      const ownedMap = new Map(
        ownedArr.map((it) => (typeof it === "string" ? [it, { id: it, lastClaimDayUTC: "" }] : [String(it?.id || ""), it]))
      );
      const todayUTC = getTodayUTC();
      let claimAllCount = 0;
      let claimAllAmount = 0;
      for (const B of items) {
        const entry = ownedMap.get(String(B.id || ""));
        if (!entry) continue;
        const normalized = normalizeBusinessEntry(entry, B.id);
        const reward = getBusinessAvailableToday(normalized, Math.max(0, Number(B.daily) || 0), todayUTC);
        if (reward <= 0) continue;
        claimAllCount += 1;
        claimAllAmount += reward;
      }

      const caption =
        (header || "") +
        ctx._t(user, "loc.business.caption_intro") +
        "\n\n" +
        ctx._t(user, "loc.business.choose");
      const kb = items.map((B) => [{
        text: `${B.emoji} ${getBusinessTitle(B.id, lang) || B.title}`,
        callback_data: `go:Biz_${B.id}`,
      }]);
      kb.push([{
        text: ctx._t(user, "loc.business.btn.claim_all", {
          amount: claimAllAmount,
          count: claimAllCount
        }),
        callback_data: "biz:claim_all"
      }]);
      kb.push([{ text: ctx._t(user, "loc.business.btn.back_earn"), callback_data: toGoCallback(Routes.EARN) }]);
      await ctx.media.show({
        sourceMsg: ctx._sourceMsg,
        place: Routes.BUSINESS,
        caption,
        keyboard: kb,
        policy: "photo",
      });
      ctx._sourceMsg = null;
      ctx._route = Routes.BUSINESS;
      return true;
    }

    const B = items[0] || CONFIG?.BUSINESS?.shawarma;
    await renderBusinessCard(B, {
      includeIntro: true,
      useManualClaim: true,
      claimKey: "loc.business.btn.claim_today",
    });
    return true;
  }

  if (typeof route === "string" && route.startsWith("Biz_")) {
    const bizId = String(route.slice(4) || "").trim();
    const B = CONFIG?.BUSINESS?.[bizId] || null;
    const meta = Object.values(bizRouteMeta).find((it) => it.id === bizId);
    await renderBusinessCard(B, {
      routeName: route,
      asset: meta?.asset || ASSETS?.Business,
      showBackToBusinesses: true,
      useManualClaim: false,
    });
    return true;
  }

  return false;
}
