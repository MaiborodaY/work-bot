const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const I18N_DIR = path.join(ROOT, "src", "i18n");

function read(relPath) {
  return fs.readFileSync(path.join(I18N_DIR, relPath), "utf8");
}

function extractKeys(source) {
  const out = new Set();
  const re = /"([^"\\]+)"\s*:/g;
  let m;
  while ((m = re.exec(source))) out.add(m[1]);
  return out;
}

function asSorted(arr) {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

function diff(aSet, bSet) {
  const onlyA = [];
  for (const k of aSet) if (!bSet.has(k)) onlyA.push(k);
  return asSorted(onlyA);
}

function resolveLangKeys(source, ruKeys) {
  const own = extractKeys(source);
  const inheritsRu = /\.\.\s*RU\b/.test(source);
  if (!inheritsRu) return own;
  const merged = new Set(ruKeys);
  for (const k of own) merged.add(k);
  return merged;
}

function main() {
  const ruSource = read("ru.js");
  const ukSource = read("uk.js");
  const enSource = read("en.js");

  const ruKeys = extractKeys(ruSource);
  const ukKeys = resolveLangKeys(ukSource, ruKeys);
  const enKeys = resolveLangKeys(enSource, ruKeys);

  const missingUk = diff(ruKeys, ukKeys);
  const missingEn = diff(ruKeys, enKeys);
  const extraUk = diff(ukKeys, ruKeys);
  const extraEn = diff(enKeys, ruKeys);

  let failed = false;
  if (missingUk.length) {
    failed = true;
    console.error("[i18n] Missing keys in uk:");
    for (const k of missingUk) console.error(`  - ${k}`);
  }
  if (missingEn.length) {
    failed = true;
    console.error("[i18n] Missing keys in en:");
    for (const k of missingEn) console.error(`  - ${k}`);
  }
  if (extraUk.length) {
    failed = true;
    console.error("[i18n] Extra keys in uk (not in ru):");
    for (const k of extraUk) console.error(`  - ${k}`);
  }
  if (extraEn.length) {
    failed = true;
    console.error("[i18n] Extra keys in en (not in ru):");
    for (const k of extraEn) console.error(`  - ${k}`);
  }

  if (failed) process.exit(1);
  console.log(`[i18n] OK. ru=${ruKeys.size}, uk=${ukKeys.size}, en=${enKeys.size}`);
}

main();
