import { CONFIG } from "./GameConfig.js";

export class CasinoEngine {
  decode(val) {
    const v = (val - 1) & 63;
    const symbols = ["bar", "grape", "lemon", "seven"];
    const left   = symbols[(v) & 3];
    const center = symbols[(v >> 2) & 3];
    const right  = symbols[(v >> 4) & 3];
    return [left, center, right];
  }

  payout(symbols, bet) {
    const [a,b,c] = symbols;
    let mult = 0;
    if (a === b && b === c) {
      mult = CONFIG.CASINO.mult3[a] || 0;
    } else if (a === b || b === c || a === c) {
      const pairSym = a===b ? a : (b===c ? b : a);
      mult = CONFIG.CASINO.mult2[pairSym] || 0;
    }
    const win = Math.round(bet * mult);
    return { mult, win };
  }

  pretty(s) { return ({seven:"7", bar:"BAR", grape:"🍇", lemon:"🍋"})[s] || s; }
}
