// GameConfig.js
import { ASSETS } from "./Assets.js";

export const CONFIG = {
  SHIFT_MS: 80 * 60 * 1000,
  PAY_BASE: 50,
  START_ENERGY_REQ: 20,
  ENERGY_COST_SHIFT: 15,
  ENERGY_MAX: 5,

  JOBS: {
    flyers:          { title: "Раздавать листовки", durationMs: 1 * 60_000,   pay: 7,   energy: 1 },
    dishwasher:      { title: "Посудомойщик",       durationMs: 5 * 60_000,   pay: 20,  energy: 6 },
    waiter:          { title: "Официант",           durationMs: 10 * 60_000,  pay: 38,  energy: 10 },
    courier:         { title: "Курьер",             durationMs: 30 * 60_000,  pay: 64,  energy: 18 },
    loader:          { title: "Грузчик",            durationMs: 60 * 60_000,  pay: 108, energy: 36 },
    shawarma_seller: { title: "Шаверма на вынос",   durationMs: 120 * 60_000, pay: 216, energy: 72 },
    dentist:         { title: "Стоматолог",         durationMs: 180 * 60_000, pay: 324, energy: 108 },
  },

  REST_RECOVER_MS: 5 * 60 * 1000,

  SHOP: {
    coffee:    { title: "Кофе (+10 энергии)",          price: 12,  heal: 10 },
    sandwich:  { title: "Сэндвич (+25 энергии)",       price: 30,  heal: 25 },
    lunch:     { title: "Бизнес-ланч (+50 энергии)",   price: 60,  heal: 50 },
    borscht:   { title: "Суп дня (+100 энергии)",      price: 120, heal: 100 },
    coke_zero: { title: "Cola Zero (max энергии)",     price_premium: 2 }
  },

  UPGRADES: {
    coffee: { title: "Кофемашина", desc: "-5% к расходу энергии на смену", price: 1000 },
    laptop: { title: "Ноутбук",     desc: "+10% к оплате за работу",         price: 5000, price_premium: 100 },
    car:    { title: "Авто",        desc: "+10% к скорости смены",           price: 10000, price_premium: 200 },

    bed1:   { title: "Comfort Bed", desc: "Отдых на 50% быстрее",            price: 80 },
    bed2:   { title: "Luxury Bed",  desc: "Отдых в 2 раза быстрее",          price: 1600, price_premium: 32 },
    bed3:   { title: "Royal Bed",   desc: "Отдых в 3 раза быстрее",          price: 3000, price_premium: 60 },
  },

  BONUS_STREAK: { 1: { money: 10 }, 3: { money: 20 }, 7: { money: 50, energy: 10 } },

  CASINO: {
    prices: [5, 10, 20, 50, 100, 500, 1000, 5000],
    price_low: 5,
    price_high: 10,
    cooldown_ms: 4_000,
    daily_limit: 10,
    mult3: { seven: 10.0, bar: 8.0, grape: 6.0, lemon: 4.0 },
    mult2: { seven: 2.0, bar: 1.75, grape: 1.5, lemon: 1.2 }
  },

  STUDY: {
    BASE_TIME_MS:     40 * 60 * 1000,
    BASE_COST_MONEY:  25,
    BASE_COST_ENERGY: 10,
    MAX_LEVEL:        30,
    GROWTH_FACTOR:    1.1
  },

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
    MAX_ENERGY_CAP:    160
  },

  PREMIUM: {
    name: "Кристаллы",
    emoji: "💎",
    skip_cost: 1,
    SKIP_PER_DAY: 5,
    PACKS: [
      { id: "g10",  gems: 10,  bonusPct: 0,  label: "💎10 без бонуса" },
      { id: "g25",  gems: 25,  bonusPct: 8,  label: "💎25 с +8%" },
      { id: "g60",  gems: 60,  bonusPct: 18, label: "💎60 с +18%" },
      { id: "g140", gems: 140, bonusPct: 32, label: "💎140 с +32%" }
    ]
  },

  FAST_FORWARD: {
    PRICE_PER_HOUR: 1,
    ROUND: "ceil",
    MIN_COST: 1,
    MAX_HOURS_PER_TX: 24,
    DAILY_LIMIT: 50
  },

  ASSETS: ASSETS,

  NOTIFY: {
    CLAIM_CTA: [
      "Смена готова",
      "Можно забирать выплату",
      "Работа завершена",
      "Загляни и забери деньги",
      "Готово, можно продолжать",
      "Напоминание: время вернуться",
      "Смена закрыта, забери награду"
    ]
  },

  BUSINESS: {
    shawarma: {
      id: "shawarma",
      emoji: "🌯",
      title: "Ларек с шавермой",
      price: 20000,
      daily: 500,
      resetPolicy: "utc_daily_burn",
      note: "Продает шаверму раз в день. Доход сгорает, если не забрать."
    },
    stomatology: {
      id: "stomatology",
      emoji: "🦷",
      title: "Стоматология",
      price: 50000,
      daily: 1000,
      resetPolicy: "utc_daily_burn",
      note: "Приносит прием пациентов раз в день. Доход нужно забирать вовремя."
    }
  }
};
