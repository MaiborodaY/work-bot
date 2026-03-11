// SafeCall.js
export async function safeCall(tag, fn, opts = {}) {
  const logger = opts?.logger || console;
  const fallback = opts?.fallback;

  try {
    return await fn();
  } catch (e) {
    const msg = e?.stack || e?.message || String(e);
    try {
      if (logger && typeof logger.error === "function") {
        logger.error(`[safeCall:${String(tag || "unknown")}] ${msg}`);
      }
    } catch {}
    return fallback;
  }
}

