// NotifyDueIndex.js
const MINUTE_MS = 60_000;
const DEFAULT_BUCKET_MS = 5 * MINUTE_MS;

export class NotifyDueIndex {
  constructor({ db, now, bucketMs = DEFAULT_BUCKET_MS }) {
    this.db = db;
    this.now = now || (() => Date.now());
    this.bucketMs = Math.max(MINUTE_MS, Number(bucketMs) || DEFAULT_BUCKET_MS);
  }

  _bucket(ts) {
    const t = Number(ts) || 0;
    return Math.floor(t / this.bucketMs);
  }

  _key(bucket, activity, userId) {
    return `due:${bucket}:${activity}:${userId}`;
  }

  async markDue({ userId, activity, endAt, ttlSec = 3 * 24 * 60 * 60 }) {
    if (!this.db || typeof this.db.put !== "function") return;

    const uid = String(userId || "").trim();
    const act = String(activity || "").trim();
    const end = Number(endAt) || 0;
    if (!uid || !act || end <= 0) return;

    const bucket = this._bucket(end);
    const key = this._key(bucket, act, uid);
    await this.db.put(key, "1", { expirationTtl: Math.max(60, Math.floor(ttlSec)) });
  }

  _parseUserIdFromKey(key) {
    const parts = String(key || "").split(":");
    if (parts.length < 4) return "";
    return String(parts[3] || "").trim();
  }

  async collectDueUserIds({ nowTs = this.now(), lookbackMinutes = 15 } = {}) {
    if (!this.db || typeof this.db.list !== "function") return [];

    const endBucket = this._bucket(nowTs);
    const lookbackMs = Math.max(0, Math.floor(Number(lookbackMinutes) || 0)) * MINUTE_MS;
    const lookbackBuckets = Math.max(0, Math.ceil(lookbackMs / this.bucketMs));
    const startBucket = endBucket - lookbackBuckets;

    const ids = new Set();

    for (let bucket = startBucket; bucket <= endBucket; bucket++) {
      const prefix = `due:${bucket}:`;
      let cursor = undefined;

      do {
        const page = await this.db.list({ prefix, cursor });
        cursor = page?.cursor;

        const keys = page?.keys || [];
        for (const k of keys) {
          const uid = this._parseUserIdFromKey(k?.name);
          if (uid) ids.add(uid);
        }
      } while (cursor);
    }

    return [...ids];
  }
}