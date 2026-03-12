// handlers/business.js
import { CONFIG } from "../GameConfig.js";
import { applyBusinessClaim, getTodayUTC, normalizeBusinessEntry } from "../BusinessPayout.js";
import { normalizeLang, t } from "../i18n/index.js";
import { getBusinessTitle } from "../I18nCatalog.js";

export const businessHandler = {
  match: (data) => data.startsWith("biz:"),

  async handle(ctx) {
    const { data, u, users, answer, goTo, now, send, clans, thief, cb, locations } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const parts = String(data || "").split(":");
    const action = String(parts[1] || "");
    const id = String(parts[2] || "");
    const bizRoute = (bizId) => (bizId ? `Biz_${bizId}` : "Business");
    const ack = async (text = "") => {
      if (!cb?.id) return;
      await answer(cb.id, text);
    };
    const showPanel = async (caption, keyboard) => {
      if (!locations?.media?.show) return;
      await locations.media.show({
        sourceMsg: locations._sourceMsg || cb?.message || null,
        place: "Business",
        caption,
        keyboard,
        policy: "photo"
      });
      if (typeof locations.setSourceMessage === "function") {
        locations.setSourceMessage(null);
      } else {
        locations._sourceMsg = null;
      }
    };

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
        pendingTheftAmount: 0,
        guardUntil: 0,
        immunityUntil: 0,
        guardBlocked: 0
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

    if (action === "protection_help") {
      const B = CONFIG.BUSINESS[id];
      if (!B) {
        await ack(tt("handler.business.not_found"));
        await goTo(u, "Business");
        return;
      }
      const bizTitle = getBusinessTitle(B.id, lang) || B.title;
      const guardPrice = Math.max(0, Math.floor(Number(CONFIG?.THIEF?.PROTECTION?.GUARD?.PRICES?.[B.id]) || 0));
      const gem24 = Math.max(0, Math.floor(Number(CONFIG?.THIEF?.PROTECTION?.IMMUNITY?.OPTIONS?.["24"]) || 0));
      const gem48 = Math.max(0, Math.floor(Number(CONFIG?.THIEF?.PROTECTION?.IMMUNITY?.OPTIONS?.["48"]) || 0));
      const gem96 = Math.max(0, Math.floor(Number(CONFIG?.THIEF?.PROTECTION?.IMMUNITY?.OPTIONS?.["96"]) || 0));
      await ack();
      await showPanel(
        tt("biz.protect.help.caption", {
          bizTitle,
          guardPrice,
          gem24,
          gem48,
          gem96
        }),
        [[{ text: tt("loc.business.btn.back_businesses"), callback_data: `go:Biz_${id}` }]]
      );
      return;
    }

    if (action === "immune") {
      await ack();
      const B = CONFIG.BUSINESS[id];
      if (!B || !thief?.getProtectionUiModel) {
        await goTo(u, bizRoute(id));
        return;
      }
      const model = thief.getProtectionUiModel(u, id);
      if (!model?.ok) {
        await goTo(u, bizRoute(id));
        return;
      }
      const kb = model.immunityOptions.map((opt) => ([{
        text: tt("biz.protect.immunity.option_btn", { hours: opt.hours, gems: opt.gems }),
        callback_data: `biz:immune_buy:${id}:${opt.hours}`
      }]));
      kb.push([{ text: tt("loc.business.btn.cancel"), callback_data: `go:Biz_${id}` }]);
      await showPanel(tt("biz.protect.immunity.choose"), kb);
      return;
    }

    if (action === "guard" || action === "guard_confirm") {
      if (!thief?.buyGuard || !thief?.getProtectionUiModel) {
        await goTo(u, bizRoute(id));
        return;
      }
      const model = thief.getProtectionUiModel(u, id);
      if (!model?.ok) {
        await goTo(u, bizRoute(id));
        return;
      }
      if (model.immunityActive) {
        await ack(tt("biz.protect.err.immunity_active"));
        await goTo(u, bizRoute(id));
        return;
      }

      const forceReset = action === "guard_confirm";
      if (!forceReset && model.guardActive) {
        await ack();
        await showPanel(
          tt("biz.protect.guard.confirm_reset", { hours: model.guardLeftHours }),
          [[
            { text: tt("loc.business.btn.confirm_yes"), callback_data: `biz:guard_confirm:${id}` },
            { text: tt("loc.business.btn.cancel"), callback_data: `go:Biz_${id}` }
          ]]
        );
        return;
      }

      const res = await thief.buyGuard(u, id, { forceReset });
      if (!res?.ok) {
        if (res?.needConfirm) {
          await ack();
          await showPanel(
            tt("biz.protect.guard.confirm_reset", { hours: res.leftHours || 1 }),
            [[
              { text: tt("loc.business.btn.confirm_yes"), callback_data: `biz:guard_confirm:${id}` },
              { text: tt("loc.business.btn.cancel"), callback_data: `go:Biz_${id}` }
            ]]
          );
          return;
        }
        await ack(res?.error || tt("handler.business.not_enough_money"));
        await goTo(u, bizRoute(id));
        return;
      }

      await ack(tt("biz.protect.guard.set_ok"));
      await goTo(u, bizRoute(id));
      return;
    }

    if (action === "immune_buy" || action === "immune_confirm") {
      if (!thief?.buyImmunity) {
        await goTo(u, bizRoute(id));
        return;
      }
      const hours = Math.max(1, Math.floor(Number(parts[3]) || 0));
      const withGuardConfirm = action === "immune_confirm";
      const res = await thief.buyImmunity(u, id, hours, { confirmGuardReset: withGuardConfirm });
      if (!res?.ok) {
        if (res?.needConfirmGuardReset) {
          await ack();
          await showPanel(
            tt("biz.protect.immunity.confirm_guard_reset", {
              hours: res.leftHours || 1,
              immuneHours: res.hours || hours
            }),
            [[
              { text: tt("loc.business.btn.confirm_yes"), callback_data: `biz:immune_confirm:${id}:${hours}` },
              { text: tt("loc.business.btn.cancel"), callback_data: `go:Biz_${id}` }
            ]]
          );
          return;
        }
        await ack(res?.error || tt("handler.upgrades.not_enough_gems", { emoji: CONFIG?.PREMIUM?.emoji || "💎", need: 1 }));
        await goTo(u, bizRoute(id));
        return;
      }
      await ack(tt("biz.protect.immunity.set_ok", { hours: res.hours }));
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
