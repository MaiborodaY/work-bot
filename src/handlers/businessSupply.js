import { BusinessSupplyService } from "../BusinessSupplyService.js";
import { CONFIG } from "../GameConfig.js";
import { getTodayUTC, normalizeBusinessEntry } from "../BusinessPayout.js";
import { getBusinessTitle } from "../I18nCatalog.js";
import { normalizeLang, t } from "../i18n/index.js";
import { Routes, toGoCallback } from "../Routes.js";

const MVP_BIZ_ID = "shawarma";
const PLACE = "BusinessSupply";

function hasAnyBusiness(u) {
  const owned = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
  return owned.some((it) => {
    if (!it) return false;
    if (typeof it === "string") return it.trim().length > 0;
    return String(it?.id || "").trim().length > 0;
  });
}

function findOwnedEntry(u, bizId = MVP_BIZ_ID) {
  if (!u.biz || typeof u.biz !== "object") u.biz = {};
  if (!Array.isArray(u.biz.owned)) u.biz.owned = [];

  const id = String(bizId || "").trim();
  const idx = u.biz.owned.findIndex((it) => (typeof it === "string" ? it === id : it?.id === id));
  if (idx < 0) return { idx: -1, entry: null };

  const raw = u.biz.owned[idx];
  const entry = normalizeBusinessEntry(typeof raw === "string" ? { id } : raw, id);
  u.biz.owned[idx] = entry;
  return { idx, entry };
}

function formatRecipeLine(tt, itemId, qty) {
  return tt("business_supply.recipe_line", {
    item: tt(`business_supply.item.${String(itemId || "")}`),
    qty
  });
}

function buildCaption(u, entry, lang) {
  const tt = (key, vars = {}) => t(key, lang, vars);
  const business = getBusinessTitle(MVP_BIZ_ID, lang) || MVP_BIZ_ID;
  const vm = entry
    ? BusinessSupplyService.buildViewModel(u, entry, MVP_BIZ_ID, getTodayUTC())
    : null;
  const recipe = vm?.recipe || BusinessSupplyService.config(MVP_BIZ_ID)?.recipe || {};
  const recipeLines = Object.entries(recipe).map(([itemId, qty]) => formatRecipeLine(tt, itemId, qty));
  const nextMultiplier = Number(CONFIG?.BUSINESS_SUPPLY?.[MVP_BIZ_ID]?.multipliersByOrders?.[
    Math.max(1, Number(vm?.ordersToday || 0) + 1)
  ]) || 2;

  if (!hasAnyBusiness(u)) {
    return tt("business_supply.no_business");
  }

  if (!entry) {
    return [
      tt("business_supply.title", { business }),
      "",
      tt("business_supply.mvp_only")
    ].join("\n");
  }

  if (!vm?.unlocked) {
    return [
      tt("business_supply.title", { business }),
      "",
      tt("business_supply.locked_intro"),
      tt("business_supply.open_price", { price: Number(CONFIG?.BUSINESS_SUPPLY?.[MVP_BIZ_ID]?.unlockPrice || 0) }),
      "",
      tt("business_supply.order_title"),
      ...recipeLines,
      "",
      tt("business_supply.bonus_next", { mult: nextMultiplier })
    ].join("\n");
  }

  let statusKey = "business_supply.status_ready";
  if (vm.submitBlockCode === "daily_limit") statusKey = "business_supply.status_wait_claim";
  if (vm.submitBlockCode === "missing_ingredients") statusKey = "business_supply.status_collect_ingredients";
  const slotStatus = vm.progressTarget <= 0
    ? tt("business_supply.slots_max")
    : (vm.canBuySlot
      ? tt("business_supply.next_slot_ready", { price: vm.nextSlotPrice })
      : tt("business_supply.next_slot_progress", { progress: vm.progress, target: vm.progressTarget }));

  return [
    tt("business_supply.title", { business }),
    "",
    tt("business_supply.order_title"),
    ...recipeLines,
    "",
    tt("business_supply.today", { done: vm.ordersToday, slots: vm.slots }),
    tt("business_supply.slots", { slots: vm.slots, max: vm.maxSlots }),
    tt("business_supply.bonus_next", { mult: nextMultiplier }),
    tt("business_supply.progress", { progress: vm.progress, target: vm.progressTarget || "-" }),
    slotStatus,
    "",
    tt(statusKey)
  ].join("\n");
}

function buildKeyboard(u, entry, lang) {
  const tt = (key, vars = {}) => t(key, lang, vars);
  const rows = [];
  const cfg = BusinessSupplyService.config(MVP_BIZ_ID);

  if (entry) {
    const vm = BusinessSupplyService.buildViewModel(u, entry, MVP_BIZ_ID, getTodayUTC());
    if (!vm.unlocked) {
      rows.push([{
        text: tt("business_supply.btn_unlock", { price: Number(cfg?.unlockPrice || 0) }),
        callback_data: `supply:unlock:${MVP_BIZ_ID}`
      }]);
    } else if (vm.canSubmit) {
      rows.push([{ text: tt("business_supply.btn_submit"), callback_data: `supply:submit:${MVP_BIZ_ID}` }]);
    }
    if (vm.canBuySlot) {
      rows.push([{
        text: tt("business_supply.btn_buy_slot", { price: vm.nextSlotPrice }),
        callback_data: `supply:buy_slot:${MVP_BIZ_ID}`
      }]);
    }
    rows.push([{ text: tt("business_supply.btn_to_business"), callback_data: `go:Biz_${MVP_BIZ_ID}` }]);
  }

  rows.push([{ text: tt("ui.back.default"), callback_data: toGoCallback(Routes.EARN) }]);
  return rows;
}

async function showSupplies(ctx) {
  const { u, cb, locations } = ctx;
  const lang = normalizeLang(u?.lang || "ru");
  const { entry } = findOwnedEntry(u, MVP_BIZ_ID);
  await locations.media.show({
    sourceMsg: locations._sourceMsg || cb?.message || null,
    place: PLACE,
    caption: buildCaption(u, entry, lang),
    keyboard: buildKeyboard(u, entry, lang),
    policy: "auto"
  });
  locations.setSourceMessage?.(null);
}

export const businessSupplyHandler = {
  match: (data) => {
    const raw = String(data || "");
    return raw === "supply:open" ||
      raw.startsWith("supply:unlock:") ||
      raw.startsWith("supply:submit:") ||
      raw.startsWith("supply:buy_slot:");
  },

  async handle(ctx) {
    const { data, u, cb, answer, users, send } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);

    if (data === "supply:open") {
      await answer(cb.id);
      await showSupplies(ctx);
      return;
    }

    const parts = String(data || "").split(":");
    const action = parts[1] || "";
    const bizId = parts[2] || MVP_BIZ_ID;
    if (bizId !== MVP_BIZ_ID) {
      await answer(cb.id, tt("business_supply.mvp_only_toast"));
      return;
    }

    const { entry } = findOwnedEntry(u, MVP_BIZ_ID);
    if (!entry) {
      await answer(cb.id, tt(hasAnyBusiness(u) ? "business_supply.mvp_only_toast" : "business_supply.no_business_toast"));
      await showSupplies(ctx);
      return;
    }

    if (action === "unlock") {
      const res = BusinessSupplyService.unlock(u, entry, MVP_BIZ_ID);
      if (!res.ok) {
        const key = res.code === "not_enough_money"
          ? "business_supply.not_enough_money"
          : "business_supply.cannot_submit";
        await answer(cb.id, tt(key));
        await showSupplies(ctx);
        return;
      }
      await users.save(u);
      await answer(cb.id, tt("business_supply.toast_unlocked"));
      await showSupplies(ctx);
      return;
    }

    if (action === "submit") {
      const res = BusinessSupplyService.submitOrder(u, entry, MVP_BIZ_ID, getTodayUTC());
      if (!res.ok) {
        await answer(cb.id, tt("business_supply.cannot_submit"));
        await showSupplies(ctx);
        return;
      }
      await users.save(u);
      await answer(cb.id, tt("business_supply.toast_submitted"));
      await send(tt("business_supply.notify_submitted", {
        mult: res.multiplier,
        progress: res.progress,
        target: res.progressTarget || "-"
      }));
      await showSupplies(ctx);
      return;
    }

    if (action === "buy_slot") {
      const res = BusinessSupplyService.buySlot(u, entry, MVP_BIZ_ID);
      if (!res.ok) {
        const key = res.code === "not_enough_money"
          ? "business_supply.not_enough_money"
          : "business_supply.cannot_buy_slot";
        await answer(cb.id, tt(key));
        await showSupplies(ctx);
        return;
      }
      await users.save(u);
      await answer(cb.id, tt("business_supply.toast_slot_bought", { slots: res.slots }));
      await showSupplies(ctx);
    }
  }
};
