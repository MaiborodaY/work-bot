import { CONFIG } from "./GameConfig.js";
import { normalizeLang, t } from "./i18n/index.js";

function localizedField(item, keyField, fallbackField, lang = "ru") {
  if (!item || typeof item !== "object") return "";
  const l = normalizeLang(lang || "ru");
  const key = String(item?.[keyField] || "").trim();
  if (key) {
    const translated = t(key, l);
    if (translated && translated !== key) return translated;
  }
  return String(item?.[fallbackField] || "");
}

export function getJobTitle(typeId, lang = "ru") {
  const item = CONFIG?.JOBS?.[String(typeId || "")];
  return localizedField(item, "titleKey", "title", lang) || String(typeId || "");
}

export function getShopTitle(itemId, lang = "ru") {
  const item = CONFIG?.SHOP?.[String(itemId || "")];
  return localizedField(item, "titleKey", "title", lang) || String(itemId || "");
}

export function getUpgradeTitle(itemId, lang = "ru") {
  const item = CONFIG?.UPGRADES?.[String(itemId || "")];
  return localizedField(item, "titleKey", "title", lang) || String(itemId || "");
}

export function getUpgradeDesc(itemId, lang = "ru") {
  const item = CONFIG?.UPGRADES?.[String(itemId || "")];
  return localizedField(item, "descKey", "desc", lang);
}

export function getBusinessTitle(bizId, lang = "ru") {
  const item = CONFIG?.BUSINESS?.[String(bizId || "")];
  return localizedField(item, "titleKey", "title", lang) || String(bizId || "");
}

export function getBusinessNote(bizId, lang = "ru") {
  const item = CONFIG?.BUSINESS?.[String(bizId || "")];
  return localizedField(item, "noteKey", "note", lang);
}
