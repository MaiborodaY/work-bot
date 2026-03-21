import { CONFIG } from "./GameConfig.js";

const p = (u, key, fallback = 0) => {
  const v = Number(u?.achievements?.progress?.[key]);
  return Number.isFinite(v) ? v : fallback;
};

const boolP = (u, key) => !!u?.achievements?.progress?.[key];

const countOwnedBusinesses = (u) => {
  const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
  return arr.filter((x) => {
    const id = String(typeof x === "string" ? x : x?.id || "");
    return !!CONFIG?.BUSINESS?.[id];
  }).length;
};

const countBoughtSlots = (u) => {
  const arr = Array.isArray(u?.biz?.owned) ? u.biz.owned : [];
  let n = 0;
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const slots = Array.isArray(entry.slots) ? entry.slots : [];
    n += slots.filter((s) => !!s?.purchased).length;
  }
  return n;
};

const businessPoints = (u) => countOwnedBusinesses(u) + countBoughtSlots(u);

const heldCompanyCount = (u) => {
  const holdings = (u?.stocks?.holdings && typeof u.stocks.holdings === "object")
    ? u.stocks.holdings
    : {};
  let n = 0;
  for (const h of Object.values(holdings)) {
    const shares = Math.max(0, Math.floor(Number(h?.shares) || 0));
    if (shares > 0) n += 1;
  }
  return n;
};

const rewardedReferralCount = (u) => {
  const invited = Array.isArray(u?.referral?.invited) ? u.referral.invited : [];
  return invited.filter((x) => Math.max(0, Number(x?.rewardedAt) || 0) > 0).length;
};

const gymMaxEnergy = () => Math.max(0, Number(CONFIG?.GYM?.MAX_ENERGY_CAP) || 160);

const hasPet = (u) => !!(u?.pet && typeof u.pet === "object" && String(u.pet.type || ""));
const petStreak = (u) => Math.max(0, Math.floor(Number(u?.pet?.streak) || 0));

export const ACHIEVEMENTS = [
  {
    id: "work_first_shift",
    reward: 1,
    events: ["work_claim", "retro"],
    title: { ru: "Первый рабочий день", uk: "Перший робочий день", en: "First work day" },
    done: (u) => p(u, "totalShifts") >= 1
  },
  {
    id: "work_shifts_50",
    reward: 3,
    events: ["work_claim", "retro"],
    title: { ru: "Трудяга", uk: "Трудівник", en: "Hard worker" },
    done: (u) => p(u, "totalShifts") >= 50
  },
  {
    id: "work_shifts_500",
    reward: 10,
    events: ["work_claim", "retro"],
    title: { ru: "Стахановец", uk: "Стахановець", en: "Workhorse" },
    done: (u) => p(u, "totalShifts") >= 500
  },
  {
    id: "work_earned_1k",
    reward: 1,
    events: ["work_claim", "retro"],
    title: { ru: "Первая тысяча", uk: "Перша тисяча", en: "First thousand" },
    done: (u) => p(u, "totalEarned") >= 1_000
  },
  {
    id: "work_earned_1m",
    reward: 20,
    events: ["work_claim", "retro"],
    title: { ru: "Миллионер", uk: "Мільйонер", en: "Millionaire" },
    done: (u) => p(u, "totalEarned") >= 1_000_000
  },

  {
    id: "biz_first",
    reward: 3,
    events: ["business_buy", "retro"],
    title: { ru: "Предприниматель", uk: "Підприємець", en: "Entrepreneur" },
    done: (u) => countOwnedBusinesses(u) >= 1
  },
  {
    id: "biz_all_5",
    reward: 15,
    events: ["business_buy", "retro"],
    title: { ru: "Магнат", uk: "Магнат", en: "Magnate" },
    done: (u) => countOwnedBusinesses(u) >= 5
  },
  {
    id: "biz_points_10",
    reward: 10,
    events: ["business_buy", "slot_buy", "retro"],
    title: { ru: "Империя", uk: "Імперія", en: "Empire" },
    done: (u) => businessPoints(u) >= 10
  },
  {
    id: "biz_points_25",
    reward: 25,
    events: ["business_buy", "slot_buy", "retro"],
    title: { ru: "Корпорация", uk: "Корпорація", en: "Corporation" },
    done: (u) => businessPoints(u) >= 25
  },
  {
    id: "labour_first_hire",
    reward: 2,
    events: ["labour_hire", "retro"],
    title: { ru: "Работодатель", uk: "Роботодавець", en: "Employer" },
    done: (u) => p(u, "employeesHiredTotal") >= 1
  },
  {
    id: "labour_hires_10",
    reward: 10,
    events: ["labour_hire", "retro"],
    title: { ru: "Хозяин города", uk: "Хазяїн міста", en: "City boss" },
    done: (u) => p(u, "employeesHiredTotal") >= 10
  },

  {
    id: "gym_first_finish",
    reward: 1,
    events: ["gym_finish", "retro"],
    title: { ru: "Первая тренировка", uk: "Перше тренування", en: "First workout" },
    done: (u) => Math.max(0, Number(u?.gym?.level) || 0) >= 1
  },
  {
    id: "gym_energy_max",
    reward: 5,
    events: ["gym_finish", "retro"],
    title: { ru: "Железный человек", uk: "Залізна людина", en: "Iron human" },
    done: (u) => Math.max(0, Number(u?.energy_max) || 0) >= gymMaxEnergy()
  },
  {
    id: "study_lvl_5",
    reward: 5,
    events: ["study_finish", "retro"],
    title: { ru: "Студент", uk: "Студент", en: "Student" },
    done: (u) => Math.max(0, Number(u?.study?.level) || 0) >= 5
  },
  {
    id: "pet_owner",
    reward: 2,
    events: ["pet_buy", "retro"],
    title: { ru: "Хозяин", uk: "Господар", en: "Pet owner" },
    done: (u) => hasPet(u)
  },
  {
    id: "pet_streak_30",
    reward: 10,
    events: ["pet_feed", "retro"],
    title: { ru: "Верный друг", uk: "Вірний друг", en: "Loyal friend" },
    done: (u) => petStreak(u) >= 30
  },
  {
    id: "pet_streak_100",
    reward: 30,
    events: ["pet_feed", "retro"],
    title: { ru: "Преданность", uk: "Відданість", en: "Devotion" },
    done: (u) => petStreak(u) >= 100
  },

  {
    id: "farm_first",
    reward: 2,
    events: ["farm_harvest", "retro"],
    title: { ru: "Фермер", uk: "Фермер", en: "Farmer" },
    done: (u) => p(u, "farmHarvestTotal") >= 1
  },
  {
    id: "farm_corn_10",
    reward: 5,
    events: ["farm_harvest", "retro"],
    title: { ru: "Кукурузный барон", uk: "Кукурудзяний барон", en: "Corn baron" },
    done: (u) => p(u, "farmCornHarvest") >= 10
  },
  {
    id: "farm_all_crops",
    reward: 3,
    events: ["farm_harvest", "retro"],
    title: { ru: "Урожайник", uk: "Врожайник", en: "Crop collector" },
    done: (u) => (p(u, "farmHarvestedTypesMask") & 7) === 7
  },

  {
    id: "quiz_first_perfect",
    reward: 2,
    events: ["quiz_play"],
    title: { ru: "Идеальный ученик", uk: "Ідеальний учень", en: "Perfect learner" },
    done: (u) => p(u, "quizPerfectTotal") >= 1
  },
  {
    id: "quiz_streak_7",
    reward: 10,
    events: ["quiz_play"],
    title: { ru: "Серия знаний", uk: "Серія знань", en: "Knowledge streak" },
    done: (u) => p(u, "quizPerfectStreak") >= 7
  },

  {
    id: "stocks_first_buy",
    reward: 1,
    events: ["stocks_buy", "retro"],
    title: { ru: "Инвестор", uk: "Інвестор", en: "Investor" },
    done: (u) => p(u, "stockBuysTotal") >= 1
  },
  {
    id: "stocks_portfolio_5",
    reward: 5,
    events: ["stocks_buy", "retro"],
    title: { ru: "Портфель", uk: "Портфель", en: "Portfolio" },
    done: (u) => heldCompanyCount(u) >= 5
  },
  {
    id: "stocks_dividends_50k",
    reward: 10,
    events: ["stocks_dividend", "retro"],
    title: { ru: "Биржевой волк", uk: "Біржовий вовк", en: "Market wolf" },
    done: (u) => p(u, "totalDividends") >= 50_000
  },

  {
    id: "thief_first_success",
    reward: 2,
    events: ["thief_success", "retro"],
    title: { ru: "Карманник", uk: "Кишеньковий злодій", en: "Pickpocket" },
    done: (u) => p(u, "theftSuccessTotal") >= 1
  },
  {
    id: "thief_total_100k",
    reward: 10,
    events: ["thief_success", "retro"],
    title: { ru: "Теневой делец", uk: "Тіньовий ділок", en: "Shadow dealer" },
    done: (u) => p(u, "totalStolen") >= 100_000
  },
  {
    id: "thief_streak_10",
    reward: 5,
    events: ["thief_success", "thief_fail", "retro"],
    title: { ru: "Неуловимый", uk: "Невловимий", en: "Untouchable" },
    done: (u) => p(u, "successfulTheftsStreak") >= 10
  },
  {
    id: "thief_defense_5",
    reward: 3,
    events: ["thief_defense_success", "retro"],
    title: { ru: "Страж", uk: "Вартовий", en: "Guardian" },
    done: (u) => p(u, "defensesSuccess") >= 5
  },

  {
    id: "clan_join",
    reward: 1,
    events: ["clan_join", "clan_create", "retro"],
    title: { ru: "Не один в поле", uk: "Не один у полі", en: "Not alone" },
    done: (u) => boolP(u, "clanJoinedOnce") || !!String(u?.clan?.clanId || "")
  },
  {
    id: "clan_create",
    reward: 2,
    events: ["clan_create", "retro"],
    title: { ru: "Свой клан", uk: "Свій клан", en: "Own clan" },
    done: (u, ctx) => boolP(u, "clanCreatedOnce") || !!ctx?.isClanOwnerNow
  },
  {
    id: "clan_contracts_10",
    reward: 5,
    events: ["clan_contracts_completed", "retro"],
    title: { ru: "Командный игрок", uk: "Командний гравець", en: "Team player" },
    done: (u) => p(u, "clanContractsByUser") >= 10
  },

  {
    id: "referrals_1",
    reward: 2,
    events: ["referral_rewarded", "retro"],
    title: { ru: "Зазывала", uk: "Зазивала", en: "Caller" },
    done: (u) => rewardedReferralCount(u) >= 1
  },
  {
    id: "referrals_5",
    reward: 10,
    events: ["referral_rewarded", "retro"],
    title: { ru: "Вербовщик", uk: "Вербувальник", en: "Recruiter" },
    done: (u) => rewardedReferralCount(u) >= 5
  }
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((x) => [x.id, x])
);

export const ACHIEVEMENTS_BY_EVENT = ACHIEVEMENTS.reduce((acc, def) => {
  const events = Array.isArray(def?.events) ? def.events : [];
  for (const e of events) {
    if (!acc[e]) acc[e] = [];
    acc[e].push(def);
  }
  return acc;
}, {});
