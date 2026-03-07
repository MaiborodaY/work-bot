// GameConfig.js
import { ASSETS } from "./Assets.js";

export const CONFIG = {
  SHIFT_MS: 80 * 60 * 1000,
  PAY_BASE: 50,
  START_ENERGY_REQ: 20,
  ENERGY_COST_SHIFT: 15,
  ENERGY_MAX: 5,

  JOBS: {
    flyers:          { title: "Раздавать листовки", titleKey: "cfg.job.flyers.title", durationMs: 1 * 60_000,   pay: 7,   energy: 1 },
    dishwasher:      { title: "Посудомойщик",       titleKey: "cfg.job.dishwasher.title", durationMs: 5 * 60_000,   pay: 20,  energy: 6 },
    waiter:          { title: "Официант",           titleKey: "cfg.job.waiter.title", durationMs: 10 * 60_000,  pay: 38,  energy: 10 },
    courier:         { title: "Курьер",             titleKey: "cfg.job.courier.title", durationMs: 30 * 60_000,  pay: 64,  energy: 18 },
    loader:          { title: "Грузчик",            titleKey: "cfg.job.loader.title", durationMs: 60 * 60_000,  pay: 108, energy: 36 },
    shawarma_seller: { title: "Шаверма на вынос",   titleKey: "cfg.job.shawarma_seller.title", durationMs: 120 * 60_000, pay: 216, energy: 72 },
    dentist:         { title: "Стоматолог",         titleKey: "cfg.job.dentist.title", durationMs: 180 * 60_000, pay: 324, energy: 108 },
    qa_engineer:     { title: "QA engineer.",       titleKey: "cfg.job.qa_engineer.title", durationMs: 300 * 60_000, pay: 500, energy: 140 },
  },

  REST_RECOVER_MS: 5 * 60 * 1000,

  SHOP: {
    coffee:    { title: "Кофе (+10 энергии)",          titleKey: "cfg.shop.coffee.title", price: 12,  heal: 10 },
    sandwich:  { title: "Сэндвич (+25 энергии)",       titleKey: "cfg.shop.sandwich.title", price: 30,  heal: 25 },
    lunch:     { title: "Бизнес-ланч (+50 энергии)",   titleKey: "cfg.shop.lunch.title", price: 60,  heal: 50 },
    borscht:   { title: "Суп дня (+100 энергии)",      titleKey: "cfg.shop.borscht.title", price: 120, heal: 100 },
    coke_zero: { title: "Cola Zero (max энергии)",     titleKey: "cfg.shop.coke_zero.title", price_premium: 2 }
  },

  UPGRADES: {
    coffee: { title: "Кофемашина", titleKey: "cfg.upg.coffee.title", desc: "-5% к расходу энергии на смену", descKey: "cfg.upg.coffee.desc", price: 1000 },
    laptop: { title: "Ноутбук", titleKey: "cfg.upg.laptop.title",     desc: "+10% к оплате за работу", descKey: "cfg.upg.laptop.desc",         price: 5000, price_premium: 100 },
    car:    { title: "Авто", titleKey: "cfg.upg.car.title",        desc: "+10% к скорости смены", descKey: "cfg.upg.car.desc",           price: 10000, price_premium: 200 },

    bed1:   { title: "Comfort Bed", titleKey: "cfg.upg.bed1.title", desc: "Отдых на 50% быстрее", descKey: "cfg.upg.bed1.desc",            price: 80 },
    bed2:   { title: "Luxury Bed", titleKey: "cfg.upg.bed2.title",  desc: "Отдых в 2 раза быстрее", descKey: "cfg.upg.bed2.desc",          price: 1600, price_premium: 32 },
    bed3:   { title: "Royal Bed", titleKey: "cfg.upg.bed3.title",   desc: "Отдых в 3 раза быстрее", descKey: "cfg.upg.bed3.desc",          price: 3000, price_premium: 60 },
  },

  BONUS_STREAK: { 1: { money: 10 }, 3: { money: 20 }, 7: { money: 50, energy: 10 } },

  CASINO: {
    prices: [5, 20, 50, 100, 500, 1000, 5000, 10000],
    price_low: 5,
    price_high: 20,
    cooldown_ms: 4_000,
    daily_limit: 10,
    // Платные попытки (casino_spin / all-in) доступны только с этого уровня учёбы
    MIN_STUDY_FOR_PAID: 5,
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

  DAILY_TOP_REWARDS: {
    1:  { stars: 3, money: 0 },
    2:  { stars: 2, money: 0 },
    3:  { stars: 1, money: 0 },
    4:  { stars: 0, money: 100 },
    5:  { stars: 0, money: 80 },
    6:  { stars: 0, money: 60 },
    7:  { stars: 0, money: 40 },
    8:  { stars: 0, money: 30 },
    9:  { stars: 0, money: 20 },
    10: { stars: 0, money: 10 },
  },

  FAST_FORWARD: {
    PRICE_PER_HOUR: 1,
    ROUND: "ceil",
    MIN_COST: 1,
    MAX_HOURS_PER_TX: 24,
    DAILY_LIMIT: 50
  },

  CLANS: {
    MAX_MEMBERS: 20,
    CONTRACTS_PER_WEEK: 3,
    ALWAYS_CONTRACT: "work_money",
    CONTRACTS: {
      work_money: {
        id: "work_money",
        title: "Доход с работ",
        hint: "Сумма, полученная кнопкой «Получить выплату» в разделе Работы.",
        target: 250000,
        unit: "$",
        points: 100
      },
      business_money: {
        id: "business_money",
        title: "Доход с бизнесов",
        hint: "Сумма, собранная с купленных бизнесов.",
        target: 400000,
        unit: "$",
        points: 100
      },
      fortune_net_profit: {
        id: "fortune_net_profit",
        title: "Чистая прибыль Зала арканы",
        hint: "Только положительная разница: max(0, выигрыш - ставка).",
        target: 30000,
        unit: "$",
        points: 100
      },
      active_actions: {
        id: "active_actions",
        title: "Активные действия",
        hint: "Полезные игровые действия участников клана.",
        target: 1000,
        unit: "действ.",
        points: 100
      },
      daily_presence: {
        id: "daily_presence",
        title: "Ежедневная активность",
        hint: "Каждый участник может дать 1 пункт в день при любом действии в игре.",
        target: 28,
        unit: "дней",
        points: 100
      }
    },
    WEEKLY_REWARDS: {
      1: { money: 5000, premium: 5, cosmeticTier: "top1" },
      2: { money: 3000, premium: 3, cosmeticTier: "top2" },
      3: { money: 2000, premium: 2, cosmeticTier: "top3" },
      4: { money: 1500, premium: 0 },
      5: { money: 1200, premium: 0 },
      6: { money: 1000, premium: 0 },
      7: { money: 800, premium: 0 },
      8: { money: 600, premium: 0 },
      9: { money: 400, premium: 0 },
      10: { money: 300, premium: 0 }
    },
    ELIGIBILITY: {
      MIN_SHARE: 0.01,
      MIN_USEFUL_EVENTS: 3
    }
  },

  STOCKS: {
    UPDATE_HOUR_UTC: 0,
    HISTORY_DAYS: 7,
    PRICE_FLOOR: 1,
    PRICE_CEILING_MULT: 20,
    SELL_FEE: 0.03,
    DIVIDEND_RATE_DAILY: 0.005,
    LUCKY_ACTIVITY: {
      MAX_BONUS: 0.05,
      SPINS_FOR_MAX: 100,
      CURVE: "sqrt"
    },
    COMPANIES: {
      shawarma: {
        ticker: "shawarma",
        title: "ShawarmaChain",
        emoji: "🌯",
        basePrice: 100,
        volatility: 0.04,
        reversion: 0.30,
        casinoLinked: false
      },
      dent: {
        ticker: "dent",
        title: "DentCorp",
        emoji: "💊",
        basePrice: 180,
        volatility: 0.07,
        reversion: 0.20,
        casinoLinked: false
      },
      fitlife: {
        ticker: "fitlife",
        title: "FitLife",
        emoji: "🏋️",
        basePrice: 220,
        volatility: 0.09,
        reversion: 0.10,
        casinoLinked: false
      },
      quick: {
        ticker: "quick",
        title: "QuickDeliver",
        emoji: "📦",
        basePrice: 260,
        volatility: 0.12,
        reversion: 0.18,
        casinoLinked: false
      },
      lucky: {
        ticker: "lucky",
        title: "LuckyHoldings",
        emoji: "🎰",
        basePrice: 140,
        volatility: 0.18,
        reversion: 0.03,
        casinoLinked: true
      }
    }
  },

  LABOUR_MARKET: {
    LIST_SIZE: 10,
    INDEX_SIZE: 20,
    SLOTS: {
      shawarma: {
        slotMoney: 10000,
        slotGems: 20,
        ownerPct: 0.08,
        contractDays: 1,
        minEnergyMax: 20
      },
      stomatology: {
        slotMoney: 25000,
        slotGems: 50,
        ownerPct: 0.10,
        contractDays: 2,
        minEnergyMax: 40
      },
      restaurant: {
        slotMoney: 50000,
        slotGems: 100,
        ownerPct: 0.12,
        contractDays: 3,
        minEnergyMax: 60
      },
      courier_service: {
        slotMoney: 100000,
        slotGems: 200,
        ownerPct: 0.14,
        contractDays: 5,
        minEnergyMax: 80
      },
      fitness_club: {
        slotMoney: 250000,
        slotGems: 500,
        ownerPct: 0.16,
        contractDays: 7,
        minEnergyMax: 100
      }
    }
  },

  ASSETS: ASSETS,

  NOTIFY: {
    CLAIM_CTA: [
      "Можно забирать выплату",
      "Работа завершена",
      "Загляни и забери деньги",
      "Готово, можно продолжать",
      "Забрать конвертик",
      "Притянуть средства"
    ]
  },

  BUSINESS: {
    shawarma: {
      id: "shawarma",
      emoji: "🌯",
      title: "Ларек с шавермой",
      titleKey: "cfg.biz.shawarma.title",
      price: 20000,
      daily: 500,
      resetPolicy: "utc_daily_burn",
      note: "Продает шаверму раз в день. Доход сгорает, если не забрать.",
      noteKey: "cfg.biz.shawarma.note"
    },
    stomatology: {
      id: "stomatology",
      emoji: "🦷",
      title: "Стоматология",
      titleKey: "cfg.biz.stomatology.title",
      price: 50000,
      daily: 1000,
      resetPolicy: "utc_daily_burn",
      note: "Приносит прием пациентов раз в день. Доход нужно забирать вовремя.",
      noteKey: "cfg.biz.stomatology.note"
    },
    restaurant: {
      id: "restaurant",
      emoji: "🍽️",
      title: "Ресторан",
      titleKey: "cfg.biz.restaurant.title",
      price: 100000,
      daily: 2000,
      resetPolicy: "utc_daily_burn",
      note: "Популярное заведение с высоким чеком. Забирайте прибыль раз в день.",
      noteKey: "cfg.biz.restaurant.note"
    },
    courier_service: {
      id: "courier_service",
      emoji: "📦",
      title: "Курьерская служба",
      titleKey: "cfg.biz.courier_service.title",
      price: 200000,
      daily: 4000,
      resetPolicy: "utc_daily_burn",
      note: "Доставляем посылки по городу без выходных. Доход стабилен, если не забывать забирать.",
      noteKey: "cfg.biz.courier_service.note"
    },
    fitness_club: {
      id: "fitness_club",
      emoji: "💪",
      title: "Фитнес-клуб",
      titleKey: "cfg.biz.fitness_club.title",
      price: 500000,
      daily: 10000,
      resetPolicy: "utc_daily_burn",
      note: "Современный зал с тренерами и абонементами. Прибыль каждый день — забирайте вовремя.",
      noteKey: "cfg.biz.fitness_club.note"
    }
  }
};
