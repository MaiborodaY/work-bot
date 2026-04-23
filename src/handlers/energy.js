import { Routes } from "../Routes.js";
import { normalizeLang, t } from "../i18n/index.js";
import { ProgressionService } from "../ProgressionService.js";

const ENERGY_ORIGINS = new Set([
  Routes.WORK,
  Routes.GYM,
  Routes.STUDY,
  Routes.THIEF,
  Routes.BUSINESS,
  Routes.FARM
]);

function normalizeOrigin(raw) {
  const origin = String(raw || "").trim();
  if (ENERGY_ORIGINS.has(origin)) return origin;
  return Routes.SQUARE;
}

function originTitle(tt, origin) {
  switch (origin) {
    case Routes.WORK: return tt("energy.origin.work");
    case Routes.GYM: return tt("energy.origin.gym");
    case Routes.STUDY: return tt("energy.origin.study");
    case Routes.THIEF: return tt("energy.origin.thief");
    case Routes.BUSINESS: return tt("energy.origin.business");
    case Routes.FARM: return tt("energy.origin.farm");
    default: return tt("ui.back.default");
  }
}

export async function showEnergyChoicePanel(ctx, { origin, need = 0 } = {}) {
  const { u, users, locations, cb } = ctx;
  const lang = normalizeLang(u?.lang || "ru");
  const tt = (key, vars = {}) => t(key, lang, vars);
  const safeOrigin = normalizeOrigin(origin);
  const needEnergy = Math.max(0, Math.floor(Number(need) || 0));
  const haveEnergy = Math.max(0, Math.floor(Number(u?.energy) || 0));
  const originText = originTitle(tt, safeOrigin);

  u.nav = (u?.nav && typeof u.nav === "object") ? u.nav : {};
  u.nav.backTo = safeOrigin;
  await users.save(u);

  const caption = tt("energy.choice.caption", {
    need: needEnergy,
    have: haveEnergy,
    origin: originText
  });
  const playerLevel = Math.max(1, ProgressionService.getLevelInfo(u)?.level || 1);
  const keyboard = [
    ...(playerLevel >= 5 ? [[{ text: tt("energy.choice.btn.home"), callback_data: `energy:to:home:${safeOrigin}` }]] : []),
    [{ text: tt("energy.choice.btn.shop"), callback_data: `energy:to:shop:${safeOrigin}` }],
    [{ text: tt("energy.choice.btn.stay"), callback_data: `energy:stay:${safeOrigin}` }]
  ];

  await locations.media.show({
    sourceMsg: locations._sourceMsg || cb?.message || null,
    place: safeOrigin,
    caption,
    keyboard,
    policy: "auto"
  });
  locations.setSourceMessage(null);
}

export const energyHandler = {
  match: (data) => data.startsWith("energy:to:") || data.startsWith("energy:stay:"),

  async handle(ctx) {
    const { data, u, cb, answer, users, goTo } = ctx;
    const lang = normalizeLang(u?.lang || "ru");
    const tt = (key, vars = {}) => t(key, lang, vars);
    const parts = String(data || "").split(":");
    const mode = String(parts[1] || "");
    const target = String(parts[2] || "");
    const originRaw = mode === "to" ? String(parts[3] || "") : String(parts[2] || "");
    const origin = normalizeOrigin(originRaw);
    const originText = originTitle(tt, origin);

    if (mode === "stay") {
      await answer(cb.id, tt("energy.choice.toast_stay"));
      await goTo(u, origin);
      return;
    }

    if (mode !== "to" || (target !== "home" && target !== "shop")) {
      await answer(cb.id);
      await goTo(u, origin);
      return;
    }

    u.nav = (u?.nav && typeof u.nav === "object") ? u.nav : {};
    u.nav.backTo = origin;
    await users.save(u);

    if (target === "home") {
      await answer(cb.id, tt("energy.choice.toast_to_home"));
      await goTo(u, Routes.HOME, tt("energy.choice.home_intro", { origin: originText }));
      return;
    }

    await answer(cb.id, tt("energy.choice.toast_to_shop"));
    await goTo(u, Routes.SHOP, tt("energy.choice.shop_intro", { origin: originText }));
  }
};
