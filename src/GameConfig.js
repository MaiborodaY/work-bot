// GameConfig.js
import { ASSETS } from "./Assets.js";

export const CONFIG = {
  // Работа (оставлено для обратной совместимости)
  SHIFT_MS: 80 * 60 * 1000,
  PAY_BASE: 50,
  START_ENERGY_REQ: 20,
  ENERGY_COST_SHIFT: 15,
  // Стартовый кап энергии (v1)
  ENERGY_MAX: 5,

  // Новая модель работ — каталог (v1 баланс)
  JOBS: {
    flyers:           { title: "Раздача листовок",     durationMs: 2 * 60_000,    pay:  7,  energy:  1 },
    dishwasher:       { title: "Мойщик посуды",        durationMs: 5 * 60_000,    pay: 20,  energy:  6 },
    waiter:           { title: "Официант",             durationMs: 10 * 60_000,   pay: 38,  energy:  10 },
  
    courier:          { title: "Курьер",               durationMs: 30 * 60_000,   pay: 64,  energy: 18 },
    loader:           { title: "Грузчик",              durationMs: 60 * 60_000,   pay:108,  energy: 36 },
    shawarma_seller:  { title: "Продавец шаурмы",      durationMs:120 * 60_000,   pay:216,  energy: 72 },
    dentist:          { title: "Стоматолог",           durationMs:180 * 60_000,   pay:324,  energy:108 },
  },
  

  // Отдых
  REST_RECOVER_MS: 5 * 60 * 1000,

  // Магазин
  SHOP: {
    coffee:   { title: "☕ КофЭ (+10⚡️)",        price: 12,  heal: 10 },
    sandwich: { title: "🥪 Сендвич (+25⚡️)",      price: 30,  heal: 25 },
    lunch:    { title: "🍱 Ланч (+50⚡️)",         price: 60,  heal: 50 },
    borscht:  { title: "🥣 Зеленый борщ (+100⚡️)", price: 120, heal: 100 },
    coke_zero:{ title: "🥤 Cola Zero⚡️до максимума", price_premium: 2 }
  },
  

  // Улучшения
  UPGRADES: {
    coffee: { title: "☕ Coffee Machine", desc: "На 5% меньше работа отнимает энергии ",         price: 1000                          },
    laptop: { title: "💻 Laptop",        desc: "На 10% больше зарплата",               price: 5000, price_premium: 100  },
    car:    { title: "🚗 Car",           desc: "На 10% быстрее быстрее заканчивается работа",              price: 10000, price_premium: 200 },

    bed1:   { title: "🛏️ Comfort Bed",  desc: "Rest +50% faster",             price: 80                            },
    bed2:   { title: "🛌 Luxury Bed",    desc: "Rest +100% faster",            price: 1600, price_premium: 32  },
    bed3:   { title: "👑 Royal Bed",     desc: "Rest +200% faster",            price: 3000,  price_premium: 60 },
  },

  BONUS_STREAK: { 1: { money: 10 }, 3: { money: 20 }, 7: { money: 50, energy: 10 } },

  // Казино
  CASINO: {
    prices: [5, 10, 20, 50, 100, 200, 500],
    price_low:  5,
    price_high: 10,
    cooldown_ms: 4_000,
    daily_limit: 10,
    mult3: { seven: 10.0, bar: 8.0, grape: 6.0, lemon: 4.0 },
    mult2: { seven: 2.0, bar: 1.75, grape: 1.5, lemon: 1.2 }
  },

  // Учёба
  STUDY: {
    BASE_TIME_MS:     40 * 60 * 1000,
    BASE_COST_MONEY:  25,
    BASE_COST_ENERGY: 10,
    MAX_LEVEL:        30,
    GROWTH_FACTOR:    1.1
  },

  // Зал
  GYM: {
    BASE_TIME_MS:     10 * 60 * 1000,
    BASE_COST_MONEY:  20,
    BASE_COST_ENERGY: 5,

    TIME_GROWTH:    1.18,
    MONEY_GROWTH:   1.15,
    ENERGY_GROWTH:  1.1,

    MAX_TIME_MS:      45 * 60 * 1000,
    MAX_COST_MONEY:   120,
    MAX_COST_ENERGY:  20,

    REWARD_ENERGY_MAX: 1,
    MAX_ENERGY_CAP:    150
  },

  // 💎 Прем-валюта GEMS ЭТО ЗВЕЗДЫ!!
  PREMIUM: {
    name: "Кристаллы",
    emoji: "💎",
    skip_cost: 1,
    SKIP_PER_DAY: 5,
    PACKS: [
      { id: "g10",  gems: 10,  bonusPct: 0,  label: "💎10 — маленький пак" },
      { id: "g25",  gems: 25,  bonusPct: 8,  label: "💎25 — стандартный пак" },
      { id: "g60",  gems: 60,  bonusPct: 18, label: "💎60 — выгодный пак" },
      { id: "g140", gems: 140, bonusPct: 32, label: "💎140 — для китов" }
    ]
  },

  // Ускоренное завершение активностей (за кристаллы)
  FAST_FORWARD: {
    PRICE_PER_HOUR: 1,
    ROUND: "ceil",
    MIN_COST: 1,
    MAX_HOURS_PER_TX: 24,
    DAILY_LIMIT: 20
  },

  // Баннеры
  ASSETS: ASSETS,

  // Ротация CTA для уведомлений
  NOTIFY: {
    CLAIM_CTA: [
      "🏦 Налик сюда!",
      "🧲 Притянуть деньги",
      "🥳 Деньги ждут!",
      "✨ Поднять кассу",
      "💵 Хочу кэш",
      "🧧 Взять конвертик",
      "🧿 Призвать денюжку"
    ]
  },

    // ==== Бизнесы (MVP) ====
    BUSINESS: {
      shawarma: {
        id: "shawarma",
        emoji: "🌯",
        title: "Ларёк с шаурмой",
        price: 20000,        // 💡 легко меняется, сейчас окупаемость ~40 дней при $500/день
        daily: 500,          // доход раз в день (UTC)
        resetPolicy: "utc_daily_burn", // не забрал в этот день — сгорает
        note: "Доход начисляется 1 раз в день. Накопление не сохраняется."
      }
    }
};
