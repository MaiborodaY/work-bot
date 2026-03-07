import { RU } from "./ru.js";
import { UK } from "./uk.js";
import { EN } from "./en.js";

export const LANGS = ["ru", "uk", "en"];

export const STRINGS = {
  ru: RU,
  uk: UK,
  en: EN
};

export function normalizeLang(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return "ru";
  if (v.startsWith("uk")) return "uk";
  if (v.startsWith("en")) return "en";
  if (LANGS.includes(v)) return v;
  return "ru";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function plural(n, forms, lang = "ru") {
  const count = Math.abs(Number(n) || 0);
  const f = Array.isArray(forms) ? forms : [];
  if (!f.length) return "";

  const l = normalizeLang(lang);
  if (l === "en") {
    if (f.length === 1) return f[0];
    if (f.length >= 2) return count === 1 ? f[0] : f[1];
    return f[0];
  }

  const n10 = count % 10;
  const n100 = count % 100;
  if (n10 === 1 && n100 !== 11) return f[0] ?? "";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return f[1] ?? f[0] ?? "";
  return f[2] ?? f[1] ?? f[0] ?? "";
}

function interpolate(template, vars = {}, { html = false } = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const raw = Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "";
    return html ? escapeHtml(raw) : String(raw ?? "");
  });
}

export function t(key, lang = "ru", vars = {}) {
  const l = normalizeLang(lang);
  const table = STRINGS[l] || {};
  const ru = STRINGS.ru || {};
  const text = Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : (Object.prototype.hasOwnProperty.call(ru, key) ? ru[key] : key);
  return interpolate(text, vars, { html: false });
}

export function tHtml(key, lang = "ru", vars = {}) {
  const l = normalizeLang(lang);
  const table = STRINGS[l] || {};
  const ru = STRINGS.ru || {};
  const text = Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : (Object.prototype.hasOwnProperty.call(ru, key) ? ru[key] : key);
  return interpolate(text, vars, { html: true });
}

