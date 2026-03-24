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

  REFERRAL: {
    REWARD_GEMS: 10,
    INVITED_LIMIT: 100,
    VIEW_LIST_LIMIT: 20
  },

  QUESTS: {
    DAILY_COUNT: 3,
    WEEKLY_COUNT: 3,
    DAILY_BONUS_GEMS: 1,
    WEEKLY_BONUS_GEMS: 3,
    SUB_BONUS_REWARD_MONEY: 300,
    PET_BUY_GUIDE_REWARD_MONEY: 500,
    FIRST_BIZ_GUIDE_REWARD_MONEY: 1000,
    STUDY5_GUIDE_REWARD_MONEY: 800,
    STUDY5_GUIDE_REWARD_GEMS: 2,
    CLAN_JOIN_GUIDE_REWARD_MONEY: 1000,
    DAILY_WORK_EARN_TARGET: 500,
    DAILY_STOCKS_PORTFOLIO_TARGET: 5000,
    DAILY_STOCKS_INVEST_TARGET: 5000,
    WEEKLY_WORK_EARN_TARGET: 20000,
    WEEKLY_STOCKS_INVEST_TARGET: 50000,
    WEEKLY_THIEF_TOTAL_TARGET: 10000,

    DAILY_POOL: [
      { id: "work_1shift", type: "daily", category: "work", difficulty: "easy", rewardMoney: 300, target: 1 },
      { id: "work_2shifts", type: "daily", category: "work", difficulty: "medium", rewardMoney: 700, target: 2 },
      { id: "work_earn", type: "daily", category: "work", difficulty: "medium", rewardMoney: 500, target: 500 },
      { id: "gym_train", type: "daily", category: "gym", difficulty: "easy", rewardMoney: 300, target: 1 },
      { id: "gym_2trains", type: "daily", category: "gym", difficulty: "hard", rewardMoney: 600, target: 2 },
      { id: "fortune_spin", type: "daily", category: "fortune", difficulty: "easy", rewardMoney: 300, target: 1 },
      { id: "daily_bonus", type: "daily", category: "daily", difficulty: "easy", rewardMoney: 300, target: 1 },
      { id: "quiz_play", type: "daily", category: "quiz", difficulty: "easy", rewardMoney: 300, target: 1 },
      { id: "farm_harvest", type: "daily", category: "farm", difficulty: "easy", rewardMoney: 400, target: 1 },
      { id: "pet_feed", type: "daily", category: "pet", difficulty: "easy", rewardMoney: 300, target: 1 },
      { id: "biz_collect", type: "daily", category: "biz", difficulty: "easy", rewardMoney: 400, target: 1 },
      { id: "biz_collect_all", type: "daily", category: "biz", difficulty: "hard", rewardMoney: 800, target: 1 },
      { id: "biz_guard", type: "daily", category: "biz", difficulty: "medium", rewardMoney: 400, target: 1 },
      { id: "labour_hire", type: "daily", category: "labour", difficulty: "medium", rewardMoney: 600, target: 1 },
      { id: "stocks_buy", type: "daily", category: "stocks", difficulty: "easy", rewardMoney: 400, target: 1 },
      { id: "stocks_buy3", type: "daily", category: "stocks", difficulty: "hard", rewardMoney: 700, target: 1 },
      { id: "stocks_sell", type: "daily", category: "stocks", difficulty: "medium", rewardMoney: 500, target: 1 },
      { id: "stocks_invest_daily", type: "daily", category: "stocks", difficulty: "hard", rewardMoney: 600, target: 5000 },
      { id: "thief_attempt", type: "daily", category: "thief", difficulty: "medium", rewardMoney: 700, target: 1 },
      { id: "thief_success", type: "daily", category: "thief", difficulty: "hard", rewardMoney: 1200, target: 1 }
    ],

    WEEKLY_POOL: [
      { id: "w_work_10shifts", type: "weekly", category: "work", difficulty: "medium", rewardMoney: 5000, target: 10 },
      { id: "w_work_earn", type: "weekly", category: "work", difficulty: "hard", rewardMoney: 8000, target: 20000 },
      { id: "w_gym_7trains", type: "weekly", category: "gym", difficulty: "hard", rewardMoney: 4000, target: 7 },
      { id: "w_biz_streak", type: "weekly", category: "biz", difficulty: "hard", rewardMoney: 6000, target: 5 },
      { id: "w_biz_expand", type: "weekly", category: "biz", difficulty: "hard", rewardMoney: 10000, target: 1 },
      { id: "w_labour_hire", type: "weekly", category: "labour", difficulty: "medium", rewardMoney: 5000, target: 1 },
      { id: "w_labour_finish_contracts", type: "weekly", category: "labour", difficulty: "hard", rewardMoney: 4000, target: 2 },
      { id: "w_stocks_profit", type: "weekly", category: "stocks", difficulty: "hard", rewardMoney: 8000, target: 1 },
      { id: "w_stocks_5companies", type: "weekly", category: "stocks", difficulty: "hard", rewardMoney: 6000, target: 1 },
      { id: "w_stocks_invest", type: "weekly", category: "stocks", difficulty: "hard", rewardMoney: 7000, target: 50000 },
      { id: "w_thief_3attempts", type: "weekly", category: "thief", difficulty: "medium", rewardMoney: 6000, target: 3 },
      { id: "w_thief_total", type: "weekly", category: "thief", difficulty: "hard", rewardMoney: 10000, target: 10000 },
      { id: "w_farm_harvest_carrot", type: "weekly", category: "farm", difficulty: "easy", rewardMoney: 3500, target: 6 },
      { id: "w_farm_harvest_tomato", type: "weekly", category: "farm", difficulty: "medium", rewardMoney: 5000, target: 4 },
      { id: "w_farm_harvest_corn", type: "weekly", category: "farm", difficulty: "hard", rewardMoney: 7000, target: 2 },
      { id: "w_farm_plant_seeds", type: "weekly", category: "farm", difficulty: "medium", rewardMoney: 4500, target: 8 }
    ]
  },

  QUIZ: {
    QUESTIONS_PER_DAY: 3,
    REWARD_MONEY_PER_CORRECT: 300,
    PERFECT_BONUS_GEMS: 1
  },

  QUIZ_GENERAL: {
    QUESTIONS_PER_DAY: 3,
    REWARD_MONEY_PER_CORRECT: 100,
    PERFECT_BONUS_MONEY: 200
  },

  DAILY_TOP_REWARDS: {
    1:  { stars: 5, money: 0 },
    2:  { stars: 4, money: 0 },
    3:  { stars: 3, money: 0 },
    4:  { stars: 2, money: 0 },
    5:  { stars: 1, money: 0 },
    6:  { stars: 0, money: 300 },
    7:  { stars: 0, money: 200 },
    8:  { stars: 0, money: 150 },
    9:  { stars: 0, money: 100 },
    10: { stars: 0, money: 50 },
  },

  FAST_FORWARD: {
    PRICE_PER_HOUR: 1,
    ROUND: "ceil",
    MIN_COST: 1,
    MAX_HOURS_PER_TX: 24,
    DAILY_LIMIT: 50
  },

  CLANS: {
    MAX_MEMBERS: 10,
    CONTRACTS_PER_WEEK: 3,
    ALWAYS_CONTRACT: "work_money",
    CONTRACTS: {
      work_money: {
        id: "work_money",
        title: "Доход с работ",
        hint: "Сумма, полученная кнопкой «Получить выплату» в разделе Работы.",
        target: 125000,
        unit: "$",
        points: 100
      },
      business_money: {
        id: "business_money",
        title: "Доход с бизнесов",
        hint: "Сумма, собранная с купленных бизнесов.",
        target: 200000,
        unit: "$",
        points: 100
      },
      fortune_net_profit: {
        id: "fortune_net_profit",
        title: "Чистая прибыль Зала арканы",
        hint: "Только положительная разница: max(0, выигрыш - сумма попытки).",
        target: 15000,
        unit: "$",
        points: 100
      },
      active_actions: {
        id: "active_actions",
        title: "Активные действия",
        hint: "Полезные игровые действия участников клана.",
        target: 500,
        unit: "действ.",
        points: 100
      },
      daily_presence: {
        id: "daily_presence",
        title: "Ежедневная активность",
        hint: "Каждый участник может дать 1 пункт в день при любом действии в игре.",
        target: 14,
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
    LIST_SIZE: 15,
    INDEX_SIZE: 50,
    BACKGROUND: {
      SHIFT_MS: 60 * 60 * 1000,
      EMPLOYEE_PAYOUT_MULT: 0.5,
      EMPLOYEE_RATE_PER_HOUR: {
        shawarma: 75,
        stomatology: 110,
        restaurant: 150,
        courier_service: 190,
        fitness_club: 240
      },
      OWNER_GEMS_BY_BIZ: {
        shawarma: 1,
        stomatology: 2,
        restaurant: 3,
        courier_service: 4,
        fitness_club: 5
      }
    },
    SLOTS: {
      shawarma: {
        contractDays: 1,
        minEnergyMax: 20,
        levels: [
          { slotMoney: 10000, slotGems: 10, ownerPct: 0.06 },
          { slotMoney: 15000, slotGems: 15, ownerPct: 0.08 },
          { slotMoney: 20000, slotGems: 20, ownerPct: 0.10 },
          { slotMoney: 30000, slotGems: 30, ownerPct: 0.12 },
          { slotMoney: 40000, slotGems: 40, ownerPct: 0.14 }
        ]
      },
      stomatology: {
        contractDays: 2,
        minEnergyMax: 20,
        levels: [
          { slotMoney: 25000, slotGems: 25, ownerPct: 0.06 },
          { slotMoney: 37500, slotGems: 37, ownerPct: 0.08 },
          { slotMoney: 50000, slotGems: 50, ownerPct: 0.10 },
          { slotMoney: 75000, slotGems: 75, ownerPct: 0.12 },
          { slotMoney: 100000, slotGems: 100, ownerPct: 0.14 }
        ]
      },
      restaurant: {
        contractDays: 3,
        minEnergyMax: 20,
        levels: [
          { slotMoney: 50000, slotGems: 50, ownerPct: 0.06 },
          { slotMoney: 75000, slotGems: 75, ownerPct: 0.08 },
          { slotMoney: 100000, slotGems: 100, ownerPct: 0.10 },
          { slotMoney: 150000, slotGems: 150, ownerPct: 0.12 },
          { slotMoney: 200000, slotGems: 200, ownerPct: 0.14 }
        ]
      },
      courier_service: {
        contractDays: 5,
        minEnergyMax: 20,
        levels: [
          { slotMoney: 100000, slotGems: 100, ownerPct: 0.06 },
          { slotMoney: 150000, slotGems: 150, ownerPct: 0.08 },
          { slotMoney: 200000, slotGems: 200, ownerPct: 0.10 },
          { slotMoney: 300000, slotGems: 300, ownerPct: 0.12 },
          { slotMoney: 400000, slotGems: 400, ownerPct: 0.14 }
        ]
      },
      fitness_club: {
        contractDays: 7,
        minEnergyMax: 20,
        levels: [
          { slotMoney: 250000, slotGems: 250, ownerPct: 0.06 },
          { slotMoney: 375000, slotGems: 375, ownerPct: 0.08 },
          { slotMoney: 500000, slotGems: 500, ownerPct: 0.10 },
          { slotMoney: 750000, slotGems: 750, ownerPct: 0.12 },
          { slotMoney: 1000000, slotGems: 1000, ownerPct: 0.14 }
        ]
      }
    }
  },

  PET: {
    PRICES: {
      cat: 150,
      dog: 150
    },
    FEED_COST_MONEY: 100,
    ASSETS: {
      cat: "AgACAgIAAxkBAAJ1Umm0id_SiY8AATO8FwftUZEtaohRVQACqhhrG23doEnwpLyuEBT6wAEAAwIAA3kAAzoE",
      dog: "AgACAgIAAxkBAAJ1WWm0jLcN1EthAAGZmpecxE30v3YFCAACrhhrG23doElC83hXcht2IwEAAwIAA3kAAzoE"
    },
    NAME_MIN: 2,
    NAME_MAX: 12,
    // 1-6 -> 1 gem, 7-29 -> 2 gems, 30+ -> 3 gems
    REWARD_TIERS: [
      { from: 1, to: 6, gems: 1 },
      { from: 7, to: 29, gems: 2 },
      { from: 30, to: 999999, gems: 3 }
    ],
    SICK_HEAL_GEMS: 3,
    HUNGRY_AFTER_DAYS: 1,
    SICK_AFTER_DAYS: 3,
    DEAD_AFTER_DAYS: 5,
    NOTIFY: {
      REMINDER_HOUR_UTC: 18,
      STATUS_HOUR_UTC: 10,
      DUE_BUCKET_MS: 5 * 60 * 1000,
      DUE_LOOKBACK_MINUTES: 30,
      MAX_PROCESS_PER_RUN: 500
    }
  },

  FARM: {
    FREE_PLOTS: 1,
    MAX_PLOTS: 6,
    PLOT_PRICES: [5000, 15000, 35000, 75000, 150000],
    CROPS: {
      carrot: { emoji: "🥕", seedPrice: 250, growMs: 60 * 60_000, sellPrice: 400 },
      tomato: { emoji: "🍅", seedPrice: 700, growMs: 180 * 60_000, sellPrice: 1000 },
      corn: { emoji: "🌽", seedPrice: 1800, growMs: 480 * 60_000, sellPrice: 2200 }
    },
    NOTIFY: {
      DUE_BUCKET_MS: 5 * 60_000,
      DUE_LOOKBACK_MINUTES: 30,
      MAX_PROCESS_PER_RUN: 500
    }
  },

  CHANNEL: {
    PLAY_URL: "t.me/reallifesame_bot",
    POST_DAYS_UTC: [1, 3, 5], // Mon / Wed / Fri
    POST_HOUR_UTC: 9,
    POST_MINUTE_UTC: 0,
    MIN_EARNERS: 3,
    TOP_EARNERS_LIMIT: 10,
    TOP_BIZ_LIMIT: 3,
    TOP_THIEF_LIMIT: 3,
    SNAPSHOT_TTL_SEC: 7 * 24 * 60 * 60
  },

  THIEF: {
    HELP_ASSET: "AgACAgIAAxkBAAJ6y2m2n9iHnqm7tr1kXVm2g-1eQl9NAAKZFGsby1KwSXEibtL1lMpfAQADAgADeQADOgQ",
    REVEAL_COST: 100,
    LOG_MAX: 20,
    MIN_ACCOUNT_AGE_HOURS: 24,
    MAX_LEVEL: 5,
    DAILY_ATTEMPTS_PER_TARGET: 2,
    MIN_AVAILABLE_TO_TARGET: 50,
    ATTACK_PCT_MIN: 0.20,
    ATTACK_PCT_MAX: 0.35,
    OWNER_MIN_DAILY_REMAIN_PCT: 0.50,
    RESOLVE_LIMIT_PER_RUN: 200,
    DUE_BUCKET_MS: 60 * 1000,
    DAILY_LB_LIMIT: 20,
    DAILY_LB_TTL_SEC: 8 * 24 * 60 * 60,
    LEVEL_COSTS: {
      1: 10000,
      2: 25000,
      3: 75000,
      4: 200000,
      5: 500000
    },
    LEVEL_SUCCESS: {
      1: 0.30,
      2: 0.40,
      3: 0.50,
      4: 0.60,
      5: 0.70
    },
    LEVEL_COOLDOWN_MINUTES: {
      1: 120,
      2: 90,
      3: 60,
      4: 45,
      5: 30
    },
    PROTECTION: {
      GUARD: {
        DURATION_MS: 24 * 60 * 60 * 1000,
        SUCCESS_REDUCTION_PCT: 0.50,
        EXTRA_WINDOW_MS: 20 * 60 * 1000,
        PRICES: {
          shawarma: 50,
          stomatology: 100,
          restaurant: 200,
          courier_service: 400,
          fitness_club: 1000
        }
      },
      IMMUNITY: {
        OPTIONS: {
          24: 1,
          48: 2,
          96: 3
        }
      },
      EXPIRE_RESOLVE_LIMIT_PER_RUN: 200,
      EXPIRE_LOOKBACK_MINUTES: 30
    },
    BUSINESS: {
      shawarma: {
        unlockLevel: 1,
        attackMs: 20 * 60 * 1000,
        attackEnergy: 10,
        defendEnergy: 5
      },
      stomatology: {
        unlockLevel: 2,
        attackMs: 17 * 60 * 1000,
        attackEnergy: 15,
        defendEnergy: 8
      },
      restaurant: {
        unlockLevel: 3,
        attackMs: 15 * 60 * 1000,
        attackEnergy: 20,
        defendEnergy: 10
      },
      courier_service: {
        unlockLevel: 4,
        attackMs: 12 * 60 * 1000,
        attackEnergy: 30,
        defendEnergy: 15
      },
      fitness_club: {
        unlockLevel: 5,
        attackMs: 10 * 60 * 1000,
        attackEnergy: 40,
        defendEnergy: 20
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
      price: 10000,
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
