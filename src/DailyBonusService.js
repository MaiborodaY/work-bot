// DailyBonusService.js
import { CONFIG } from "./GameConfig.js";

export class DailyBonusService {
  constructor({ users, now }) {
    this.users = users;
    this.now = now || (() => Date.now());
    this.base = 20;   // $
    this.step = 25;   // $ за день стрика
    this.cap  = 7;   // максимум учитываемых дней в формуле
  }

  _dateStr(offsetMs = 0) {
    const d = new Date(this.now() + offsetMs);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  canClaim(u) {
    const last = u?.bonus?.last || "";
    return last !== this._dateStr(0);
  }

  preview(u) {
    const last = u?.bonus?.last || "";
    const yesterday = this._dateStr(-24 * 60 * 60 * 1000);
    const oldStreak = u?.bonus?.streak || 0;
    const newStreak = (last === yesterday) ? Math.min(oldStreak + 1, this.cap) : 1;
    const amount = this.base + newStreak * this.step;
    return { amount, newStreak, today: this._dateStr(0) };
  }

  async claim(u) {
    if (!this.canClaim(u)) {
      return { ok: false, reason: "already", amount: 0, streak: u?.bonus?.streak || 0 };
    }
    const { amount, newStreak, today } = this.preview(u);
    u.money = (u.money || 0) + amount;
    u.bonus = { last: today, streak: newStreak };
    await this.users.save(u);
    return { ok: true, amount, streak: newStreak };
  }
}
