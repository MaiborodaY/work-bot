// GymService.js
import { CONFIG } from "./GameConfig.js";

/**
 * РЎРµСЂРІРёСЃ С‚СЂРµРЅР°Р¶С‘СЂРЅРѕРіРѕ Р·Р°Р»Р°:
 * - СЂР°СЃС‚СѓС‰РёРµ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ, С†РµРЅР° ($), СЂР°СЃС…РѕРґ вљЎ РїРѕ СѓСЂРѕРІРЅСЋ "gym.level"
 * - РїРѕ Р·Р°РІРµСЂС€РµРЅРёРё +1 Рє РєР°РїСѓ СЌРЅРµСЂРіРёРё (РёР»Рё РґСЂСѓРіРѕР№ С€Р°Рі РёР· РєРѕРЅС„РёРіР°), РґРѕ Р»РёРјРёС‚Р°
 * - СЃРѕСЃС‚РѕСЏРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРєРё С…СЂР°РЅРёС‚СЃСЏ РІ u.gym { level, active, startAt, endAt }
 */
export class GymService {
  constructor({ users, send, now, social = null }) {
    this.users  = users;
    this.send   = typeof send === "function" ? send : async () => {};
    this.now    = now || (() => Date.now());
    this.social = social; // в†ђ РґРѕР±Р°РІРёР»Рё, Р°РЅР°Р»РѕРіРёС‡РЅРѕ StudyService
  }

  /** РќРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅС‹Р№ РєРѕРЅС„РёРі СЃ РґРµС„РѕР»С‚Р°РјРё Рё РєР°РїР°РјРё */
  static cfg() {
    return {
      // РІСЂРµРјСЏ
      BASE_TIME_MS:     CONFIG.GYM?.BASE_TIME_MS     ?? (10 * 60 * 1000),
      TIME_GROWTH:      CONFIG.GYM?.TIME_GROWTH      ?? 1.18,
      MAX_TIME_MS:      CONFIG.GYM?.MAX_TIME_MS      ?? (45 * 60 * 1000),

      // РґРµРЅСЊРіРё
      BASE_COST_MONEY:  CONFIG.GYM?.BASE_COST_MONEY  ?? 20,
      MONEY_GROWTH:     CONFIG.GYM?.MONEY_GROWTH     ?? 1.15,
      MAX_COST_MONEY:   CONFIG.GYM?.MAX_COST_MONEY   ?? 120,

      // СЌРЅРµСЂРіРёСЏ
      BASE_COST_ENERGY: CONFIG.GYM?.BASE_COST_ENERGY ?? 8,
      ENERGY_GROWTH:    CONFIG.GYM?.ENERGY_GROWTH    ?? 1.08,
      MAX_COST_ENERGY:  CONFIG.GYM?.MAX_COST_ENERGY  ?? 20,

      // РЅР°РіСЂР°РґР°
      REWARD_ENERGY_MAX: CONFIG.GYM?.REWARD_ENERGY_MAX ?? 1,
      MAX_ENERGY_CAP:    CONFIG.GYM?.MAX_ENERGY_CAP    ?? 150,
    };
  }

  /** Р§РёСЃС‚Р°СЏ вЂњС„РѕСЂРјСѓР»Р°вЂќ РґР»СЏ С‚РµРєСѓС‰РµР№ С‚СЂРµРЅРёСЂРѕРІРєРё РёРіСЂРѕРєР° */
  static computeForUser(u) {
    const C = this.cfg();
    const L = Math.max(0, u?.gym?.level || 0);

    const timeMs     = Math.min(C.MAX_TIME_MS,      Math.round(C.BASE_TIME_MS     * Math.pow(C.TIME_GROWTH,   L)));
    const costMoney  = Math.min(C.MAX_COST_MONEY,   Math.round(C.BASE_COST_MONEY  * Math.pow(C.MONEY_GROWTH,  L)));
    const costEnergy = Math.min(C.MAX_COST_ENERGY,  Math.round(C.BASE_COST_ENERGY * Math.pow(C.ENERGY_GROWTH, L)));

    return { timeMs, costMoney, costEnergy, level: L };
  }

  /** Р—Р°РїСѓСЃРє С‚СЂРµРЅРёСЂРѕРІРєРё */
  async start(u) {
    u.gym = u.gym || { level: 0, active: false, startAt: 0, endAt: 0 };

    if (u.gym.active) {
      return { ok: false, error: "РўСЂРµРЅРёСЂРѕРІРєР° СѓР¶Рµ РёРґС‘С‚." };
    }

    const { timeMs, costMoney, costEnergy, level } = GymService.computeForUser(u);

    if ((u.money || 0) < costMoney)  return { ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РґРµРЅРµРі." };
    if ((u.energy || 0) < costEnergy) return { ok: false, error: "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СЌРЅРµСЂРіРёРё." };

    // СЃРїРёСЃР°РЅРёСЏ
    u.money  = (u.money  || 0) - costMoney;
    u.energy = Math.max(0, (u.energy || 0) - costEnergy);

    // СЃРѕСЃС‚РѕСЏРЅРёРµ С‚СЂРµРЅРёСЂРѕРІРєРё
    const startAt = this.now();
    const endAt   = startAt + timeMs;
    u.gym.active  = true;
    u.gym.startAt = startAt;
    u.gym.endAt   = endAt;
    u.gym.notified = false; // С‡С‚РѕР±С‹ РїРѕ Р·Р°РІРµСЂС€РµРЅРёРё РєСЂРѕРЅ РїСЂРёСЃР»Р°Р» РїСѓС€

    await this.users.save(u);
    return { ok: true, timeMs, costMoney, costEnergy, level, endAt };
  }

  /**
   * Р—Р°РІРµСЂС€РµРЅРёРµ, РµСЃР»Рё СЃСЂРѕРє РІС‹С€РµР».
   * Р•СЃР»Рё РїРµСЂРµРґР°РЅ goTo, РїРѕРєР°Р¶РµРј СЌРєСЂР°РЅ Gym СЃ РёРЅС‚СЂРѕ; РёРЅР°С‡Рµ РїСЂРѕСЃС‚Рѕ РѕС‚РїСЂР°РІРёРј СЃРѕРѕР±С‰РµРЅРёРµ.
   * Р’РѕР·РІСЂР°С‰Р°РµС‚ true, РµСЃР»Рё Р·Р°РІРµСЂС€РёР»Рё.
   */
  async maybeFinish(u, goTo = null) {
    if (!u?.gym?.active) return false;

    const now = this.now();
    if (now < (u.gym.endAt || 0)) return false;

    const C = GymService.cfg();

    // Р°Рї СѓСЂРѕРІРЅСЏ Рё РЅР°РіСЂР°РґР° Рє РєР°РїСѓ СЌРЅРµСЂРіРёРё
    const prevLevel = Math.max(0, u.gym.level || 0);
    u.gym.level  = prevLevel + 1;
    u.gym.active = false;
    u.gym.startAt = 0;
    u.gym.endAt   = 0;

    u.energy_max = Math.min(C.MAX_ENERGY_CAP, (u.energy_max || CONFIG.ENERGY_MAX || 100) + (C.REWARD_ENERGY_MAX || 1));
    await this.users.save(u);

// РѕР±РЅРѕРІР»СЏРµРј "РўРѕРї СЃРёР»Р°С‡РµР№" (best effort), РєР°Рє РІ study РґР»СЏ СѓРјРЅРёРєРѕРІ
try {
  if (this.social && typeof this.social.maybeUpdateStrongTop === "function") {
    await this.social.maybeUpdateStrongTop({
      userId: u.id,
      displayName: u.displayName || String(u.id),
      energyMax: u.energy_max,
      level: u.gym.level,
    });
  }
} catch {}


    const intro = `💪 Тренировка завершена! Энергокап: ${u.energy_max}. (Уровень зала: ${u.gym.level})`;

    if (typeof goTo === "function") {
      await goTo(u, "Gym", intro);
    } else {
      await this.send(intro);
    }
    return true;
  }
}

