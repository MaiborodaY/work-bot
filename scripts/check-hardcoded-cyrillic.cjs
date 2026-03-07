const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const BASELINE_PATH = path.join(__dirname, "hardcoded-cyrillic-baseline.json");

const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

const EXCLUDED_FILES = new Set([
  path.join(SRC_DIR, "GameConfig.js"),
]);

const EXCLUDED_DIRS = new Set([
  path.join(SRC_DIR, "i18n"),
]);

function isExcluded(filePath) {
  if (EXCLUDED_FILES.has(filePath)) return true;
  for (const dir of EXCLUDED_DIRS) {
    if (filePath.startsWith(dir + path.sep)) return true;
  }
  return false;
}

function walkJsFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if ([...EXCLUDED_DIRS].some((d) => abs === d || abs.startsWith(d + path.sep))) continue;
      out.push(...walkJsFiles(abs));
      continue;
    }
    if (!ent.isFile()) continue;
    if (!abs.endsWith(".js")) continue;
    if (isExcluded(abs)) continue;
    out.push(abs);
  }
  return out;
}

function advancePos(ch, pos) {
  if (ch === "\n") {
    pos.line += 1;
    pos.col = 1;
  } else {
    pos.col += 1;
  }
}

function scanStringLiterals(source) {
  const hits = [];
  const len = source.length;
  let i = 0;
  const pos = { line: 1, col: 1 };

  const cur = () => source[i];
  const next = () => source[i + 1];

  function step() {
    advancePos(source[i], pos);
    i += 1;
  }

  function skipLineComment() {
    step();
    step();
    while (i < len && cur() !== "\n") step();
  }

  function skipBlockComment() {
    step();
    step();
    while (i < len) {
      if (cur() === "*" && next() === "/") {
        step();
        step();
        return;
      }
      step();
    }
  }

  function readQuoted(quote) {
    const start = { line: pos.line, col: pos.col };
    step(); // open quote
    let text = "";
    while (i < len) {
      const ch = cur();
      if (ch === "\\") {
        text += ch;
        step();
        if (i < len) {
          text += cur();
          step();
        }
        continue;
      }
      if (ch === quote) {
        step();
        break;
      }
      text += ch;
      step();
    }
    if (CYRILLIC_RE.test(text)) {
      hits.push({ line: start.line, col: start.col, text });
    }
  }

  function skipJsExprInTemplate() {
    // assumes current points to "$" and next points to "{"
    step(); // $
    step(); // {
    let depth = 1;
    while (i < len && depth > 0) {
      const ch = cur();
      const nx = next();
      if (ch === "/" && nx === "/") {
        skipLineComment();
        continue;
      }
      if (ch === "/" && nx === "*") {
        skipBlockComment();
        continue;
      }
      if (ch === "'" || ch === "\"") {
        readQuoted(ch);
        continue;
      }
      if (ch === "`") {
        readTemplate();
        continue;
      }
      if (ch === "{") {
        depth += 1;
        step();
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        step();
        continue;
      }
      step();
    }
  }

  function readTemplate() {
    const start = { line: pos.line, col: pos.col };
    step(); // open `
    let text = "";
    while (i < len) {
      const ch = cur();
      if (ch === "\\") {
        text += ch;
        step();
        if (i < len) {
          text += cur();
          step();
        }
        continue;
      }
      if (ch === "`") {
        step();
        break;
      }
      if (ch === "$" && next() === "{") {
        if (CYRILLIC_RE.test(text)) {
          hits.push({ line: start.line, col: start.col, text });
        }
        text = "";
        skipJsExprInTemplate();
        continue;
      }
      text += ch;
      step();
    }
    if (CYRILLIC_RE.test(text)) {
      hits.push({ line: start.line, col: start.col, text });
    }
  }

  while (i < len) {
    const ch = cur();
    const nx = next();
    if (ch === "/" && nx === "/") {
      skipLineComment();
      continue;
    }
    if (ch === "/" && nx === "*") {
      skipBlockComment();
      continue;
    }
    if (ch === "'" || ch === "\"") {
      readQuoted(ch);
      continue;
    }
    if (ch === "`") {
      readTemplate();
      continue;
    }
    step();
  }

  return hits;
}

function normalizeEntry(fileAbs, hit) {
  const rel = path.relative(ROOT, fileAbs).replace(/\\/g, "/");
  return {
    file: rel,
    text: String(hit.text),
  };
}

function keyOf(entry) {
  return `${entry.file}\u0000${entry.text}`;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return [];
  const raw = fs.readFileSync(BASELINE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x) => ({
      file: String(x?.file || ""),
      text: String(x?.text || ""),
    }))
    .filter((x) => x.file && x.text);
}

function saveBaseline(entries) {
  const sorted = [...entries].sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.text.localeCompare(b.text);
  });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function main() {
  const files = walkJsFiles(SRC_DIR);
  const current = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const hits = scanStringLiterals(src);
    for (const hit of hits) current.push(normalizeEntry(file, hit));
  }

  const uniqMap = new Map();
  for (const v of current) uniqMap.set(keyOf(v), v);
  const uniqCurrent = [...uniqMap.values()];

  if (UPDATE_BASELINE) {
    saveBaseline(uniqCurrent);
    console.log(`[cyrillic] Baseline updated: ${uniqCurrent.length} entries`);
    return;
  }

  const baseline = loadBaseline();
  const baselineSet = new Set(baseline.map(keyOf));
  const currentSet = new Set(uniqCurrent.map(keyOf));

  const added = uniqCurrent
    .filter((x) => !baselineSet.has(keyOf(x)))
    .sort((a, b) => (a.file === b.file ? a.text.localeCompare(b.text) : a.file.localeCompare(b.file)));

  const removed = baseline
    .filter((x) => !currentSet.has(keyOf(x)))
    .sort((a, b) => (a.file === b.file ? a.text.localeCompare(b.text) : a.file.localeCompare(b.file)));

  if (!added.length) {
    console.log(`[cyrillic] OK. tracked=${uniqCurrent.length}`);
    if (removed.length) {
      console.log(`[cyrillic] Note: ${removed.length} baseline entries disappeared. Run with --update-baseline to sync.`);
    }
    return;
  }

  console.error("[cyrillic] New hardcoded Cyrillic strings detected:");
  for (const x of added) {
    const preview = x.text.replace(/\s+/g, " ").trim().slice(0, 120);
    console.error(`  - ${x.file}: "${preview}"`);
  }
  console.error(`[cyrillic] Total new: ${added.length}`);
  console.error(`[cyrillic] If intentional, sync baseline: node scripts/check-hardcoded-cyrillic.cjs --update-baseline`);
  process.exit(1);
}

main();
