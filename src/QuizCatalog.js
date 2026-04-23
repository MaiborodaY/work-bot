import { CONFIG } from "./GameConfig.js";

function toInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function pctFromRate(rate, fallback = "0%") {
  const n = Number(rate);
  if (!Number.isFinite(n)) return fallback;
  const pct = n * 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${String(pct.toFixed(1)).replace(/\.0$/, "")}%`;
}

function maxSlotsByConfig(cfg) {
  const slotsCfg = cfg?.LABOUR_MARKET?.SLOTS;
  if (!slotsCfg || typeof slotsCfg !== "object") return 5;
  let maxSlots = 0;
  for (const biz of Object.values(slotsCfg)) {
    const levels = Array.isArray(biz?.levels) ? biz.levels : [];
    if (levels.length > maxSlots) maxSlots = levels.length;
  }
  return maxSlots || 5;
}

function companyCount(cfg) {
  const companies = cfg?.STOCKS?.COMPANIES;
  if (!companies || typeof companies !== "object") return 5;
  const n = Object.keys(companies).length;
  return n > 0 ? n : 5;
}

function quizFacts(cfg = CONFIG) {
  const maxSlots = maxSlotsByConfig(cfg);
  const sellFee = pctFromRate(cfg?.STOCKS?.SELL_FEE, "3%");
  const dividend = pctFromRate(cfg?.STOCKS?.DIVIDEND_RATE_DAILY, "0.5%");
  const companies = companyCount(cfg);
  const healCost = toInt(cfg?.PET?.SICK_HEAL_GEMS, 3);
  const sickAfterDays = toInt(cfg?.PET?.SICK_AFTER_DAYS, 3);
  const studyMaxLevel = toInt(cfg?.STUDY?.MAX_LEVEL, 30);
  const referralRewardGems = toInt(cfg?.REFERRAL?.REWARD_GEMS, 10);
  const businessCount = Math.max(1, Object.keys(cfg?.BUSINESS || {}).length || 5);
  const shawarmaSlots = Math.max(1, toInt(cfg?.LABOUR_MARKET?.SLOTS?.shawarma?.levels?.length, 5));
  const shawarmaContractDays = Math.max(1, toInt(cfg?.LABOUR_MARKET?.SLOTS?.shawarma?.contractDays, 1));
  const shawarmaPrice = Math.max(0, toInt(cfg?.BUSINESS?.shawarma?.price, 10000));
  const packs = Array.isArray(cfg?.PREMIUM?.PACKS) ? cfg.PREMIUM.PACKS : [];
  const packGems = packs
    .map((x) => {
      const base = toInt(x?.gems, 0);
      const pct = toInt(x?.bonusPct, 0);
      const bonus = Math.ceil((base * pct) / 100);
      return base + bonus;
    })
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const premiumMinPack = packGems.length ? packGems[0] : 10;
  const premiumMaxPack = packGems.length ? packGems[packGems.length - 1] : 140;
  return {
    maxSlots,
    sellFee,
    dividend,
    companies,
    healCost,
    sickAfterDays,
    studyMaxLevel,
    referralRewardGems,
    businessCount,
    shawarmaSlots,
    shawarmaContractDays,
    shawarmaPrice,
    premiumMinPack,
    premiumMaxPack
  };
}

export function buildQuizCatalog(cfg = CONFIG) {
  const f = quizFacts(cfg);
  const lowerSlots = Math.max(2, f.maxSlots - 1);
  const higherSlots = Math.max(lowerSlots + 1, f.maxSlots + 1);
  const lowerCompanies = Math.max(1, f.companies - 2);
  const middleCompanies = Math.max(2, f.companies - 1);
  const higherCompanies = Math.max(f.companies + 2, 7);
  const sickBefore = Math.max(1, f.sickAfterDays - 1);
  const sickAfter = f.sickAfterDays + 2;
  const healCheap = Math.max(1, f.healCost - 1);
  const healExpensive = f.healCost + 2;
  const shawarmaWrongPrice = String(f.shawarmaPrice === 5000 ? 10000 : 5000);

  return [
    {
      id: "q01_work_skip",
      text: {
        ru: "Что нужно нажать, чтобы мгновенно завершить работу?",
        uk: "Що треба натиснути, щоб миттєво завершити роботу?",
        en: "What should you tap to finish a job instantly?"
      },
      options: {
        ru: ["Пропустить работу", "⏩ Завершить за кристаллы", "Отменить работу", "Ускорить"],
        uk: ["Пропустити роботу", "⏩ Завершити за кристали", "Скасувати роботу", "Прискорити"],
        en: ["Skip job", "⏩ Finish for crystals", "Cancel job", "Boost"]
      },
      correct: 1,
      explain: {
        ru: "Кнопка «Завершить» тратит кристаллы и закрывает работу сразу.",
        uk: "Кнопка «Завершити» витрачає кристали й одразу закриває роботу.",
        en: "The “Finish” button spends crystals and closes the job right away."
      }
    },
    {
      id: "q02_study_speed",
      text: {
        ru: "Что прокачивает учёба?",
        uk: "Що прокачує навчання?",
        en: "What does Study improve?"
      },
      options: {
        ru: ["Максимум энергии", "Скорость тренировок", "Скорость выполнения работ", "Доход с бизнеса"],
        uk: ["Максимум енергії", "Швидкість тренувань", "Швидкість виконання робіт", "Дохід з бізнесу"],
        en: ["Max energy", "Workout speed", "Job completion speed", "Business income"]
      },
      correct: 2,
      explain: {
        ru: "Чем выше уровень учёбы, тем быстрее выполняются работы.",
        uk: "Чим вищий рівень навчання, тим швидше виконуються роботи.",
        en: "The higher your Study level, the faster your jobs complete."
      }
    },
    {
      id: "q03_work_parallel",
      text: {
        ru: "Сколько работ можно выполнять одновременно?",
        uk: "Скільки робіт можна виконувати одночасно?",
        en: "How many jobs can run at the same time?"
      },
      options: {
        ru: ["1", "2", "3", "Без ограничений"],
        uk: ["1", "2", "3", "Без обмежень"],
        en: ["1", "2", "3", "Unlimited"]
      },
      correct: 0,
      explain: {
        ru: "В один момент времени можно вести только одну активную работу.",
        uk: "В один момент часу можна вести лише одну активну роботу.",
        en: "You can only have one active job at a time."
      }
    },
    {
      id: "q04_gym_energy_max",
      text: {
        ru: "Что прокачивает тренировка в зале?",
        uk: "Що прокачує тренування в залі?",
        en: "What does Gym training improve?"
      },
      options: {
        ru: ["Скорость работы", "Максимум энергии", "Уровень учёбы", "Доход с бизнеса"],
        uk: ["Швидкість роботи", "Максимум енергії", "Рівень навчання", "Дохід з бізнесу"],
        en: ["Job speed", "Max energy", "Study level", "Business income"]
      },
      correct: 1,
      explain: {
        ru: "Зал увеличивает максимум энергии, чтобы ты мог брать больше работ.",
        uk: "Зал збільшує максимум енергії, щоб ти міг виконувати більше робіт.",
        en: "Gym increases your max energy so you can run more jobs."
      }
    },
    {
      id: "q05_hire_energy_req",
      text: {
        ru: "Что нужно, чтобы нанять наёмника с высокими требованиями?",
        uk: "Що потрібно, щоб найняти працівника з високими вимогами?",
        en: "What do you need to hire workers with high requirements?"
      },
      options: {
        ru: ["Высокий уровень учёбы", "Много денег", "Достаточный максимум энергии", "Уровень вора выше 0"],
        uk: ["Високий рівень навчання", "Багато грошей", "Достатній максимум енергії", "Рівень злодія вище 0"],
        en: ["High Study level", "A lot of money", "Enough max energy", "Thief level above 0"]
      },
      correct: 2,
      explain: {
        ru: "Каждый бизнес проверяет минимум по максимальной энергии у кандидата.",
        uk: "Кожен бізнес перевіряє мінімум максимальної енергії у кандидата.",
        en: "Each business checks a minimum max-energy requirement for the candidate."
      }
    },
    {
      id: "q06_biz_slots_max",
      text: {
        ru: "Сколько максимум слотов для наёмников у одного бизнеса?",
        uk: "Скільки максимум слотів для працівників має один бізнес?",
        en: "What is the max number of worker slots per business?"
      },
      options: {
        ru: [String(lowerSlots), String(higherSlots), String(f.maxSlots), "Без лимита"],
        uk: [String(lowerSlots), String(higherSlots), String(f.maxSlots), "Без ліміту"],
        en: [String(lowerSlots), String(higherSlots), String(f.maxSlots), "Unlimited"]
      },
      correct: 2,
      explain: {
        ru: "Слоты покупаются по порядку, максимум берётся из конфигурации бизнеса.",
        uk: "Слоти купуються по черзі, максимум задається конфігом бізнесу.",
        en: "Slots are bought in order, and the max is defined by business config."
      }
    },
    {
      id: "q07_hire_prereq",
      text: {
        ru: "Что нужно купить перед наймом наёмника?",
        uk: "Що треба купити перед наймом працівника?",
        en: "What must be purchased before hiring a worker?"
      },
      options: {
        ru: ["Сам бизнес", "Бизнес и слот для наёмника", "Только слот", "Уровень вора"],
        uk: ["Лише бізнес", "Бізнес і слот для працівника", "Лише слот", "Рівень злодія"],
        en: ["Only the business", "Business and a worker slot", "Only a slot", "Thief level"]
      },
      correct: 1,
      explain: {
        ru: "Сначала покупается бизнес, потом слот. Только после этого доступен найм.",
        uk: "Спочатку купується бізнес, потім слот. Лише після цього доступний найм.",
        en: "First buy the business, then a slot. Only after that hiring is available."
      }
    },
    {
      id: "q08_owner_pct_growth",
      text: {
        ru: "Как меняется процент владельца с каждым новым слотом?",
        uk: "Як змінюється відсоток власника з кожним новим слотом?",
        en: "How does owner percent change with each new slot?"
      },
      options: {
        ru: ["Одинаковый для всех слотов", "Снижается с каждым слотом", "Растёт с каждым слотом", "Случайный каждый раз"],
        uk: ["Однаковий для всіх слотів", "Знижується з кожним слотом", "Зростає з кожним слотом", "Випадковий щоразу"],
        en: ["Same for all slots", "Decreases with each slot", "Increases with each slot", "Random each time"]
      },
      correct: 2,
      explain: {
        ru: "У каждого следующего слота выше % владельца, и он фиксируется при покупке.",
        uk: "У кожного наступного слота вищий % власника, і він фіксується при купівлі.",
        en: "Each next slot gives a higher owner %, and it is snapshotted on purchase."
      }
    },
    {
      id: "q09_owner_bonus_timing",
      text: {
        ru: "Когда владелец получает бонус от наёмника?",
        uk: "Коли власник отримує бонус від працівника?",
        en: "When does the owner receive worker bonus?"
      },
      options: {
        ru: ["Каждый час", "Каждый день", "В конце контракта", "После каждой работы"],
        uk: ["Щогодини", "Щодня", "У кінці контракту", "Після кожної роботи"],
        en: ["Every hour", "Every day", "At contract end", "After each job"]
      },
      correct: 2,
      explain: {
        ru: "Выплата владельцу идёт единоразово по завершению контракта.",
        uk: "Виплата власнику йде одноразово після завершення контракту.",
        en: "Owner payout is a one-time payment when the contract ends."
      }
    },
    {
      id: "q12_stocks_sell_fee",
      text: {
        ru: "Какая комиссия берётся при продаже акций?",
        uk: "Яка комісія береться при продажі акцій?",
        en: "What fee is charged when selling shares?"
      },
      options: {
        ru: ["1%", f.sellFee, "5%", "0%"],
        uk: ["1%", f.sellFee, "5%", "0%"],
        en: ["1%", f.sellFee, "5%", "0%"]
      },
      correct: 1,
      explain: {
        ru: "Комиссия продажи берётся по текущему конфигу биржи.",
        uk: "Комісія продажу береться за поточним конфігом біржі.",
        en: "Sell fee is taken according to the current exchange config."
      }
    },
    {
      id: "q13_stocks_dividend",
      text: {
        ru: "Как часто начисляются дивиденды по акциям?",
        uk: "Як часто нараховуються дивіденди по акціях?",
        en: "How often are stock dividends paid?"
      },
      options: {
        ru: ["Каждый час", "Раз в неделю", "Раз в день", "Только при продаже"],
        uk: ["Щогодини", "Раз на тиждень", "Раз на день", "Лише при продажі"],
        en: ["Every hour", "Weekly", "Daily", "Only on sell"]
      },
      correct: 2,
      explain: {
        ru: `Дивиденды начисляются ежедневно по ставке ${f.dividend}.`,
        uk: `Дивіденди нараховуються щодня за ставкою ${f.dividend}.`,
        en: `Dividends are paid daily at ${f.dividend}.`
      }
    },
    {
      id: "q14_stocks_companies",
      text: {
        ru: "Акции скольких компаний можно держать одновременно?",
        uk: "Акції скількох компаній можна тримати одночасно?",
        en: "How many companies can you hold at once?"
      },
      options: {
        ru: [String(lowerCompanies), String(middleCompanies), String(f.companies), String(higherCompanies)],
        uk: [String(lowerCompanies), String(middleCompanies), String(f.companies), String(higherCompanies)],
        en: [String(lowerCompanies), String(middleCompanies), String(f.companies), String(higherCompanies)]
      },
      correct: 2,
      explain: {
        ru: "Можно держать акции всех доступных компаний одновременно.",
        uk: "Можна тримати акції всіх доступних компаній одночасно.",
        en: "You can hold shares of all available companies at the same time."
      }
    },
    {
      id: "q20_pet_sick_after",
      text: {
        ru: "Через сколько дней без кормления питомец заболевает?",
        uk: "Через скільки днів без годування улюбленець захворіє?",
        en: "After how many days without feeding does the pet get sick?"
      },
      options: {
        ru: [String(sickBefore), String(f.sickAfterDays + 1), String(f.sickAfterDays), String(sickAfter)],
        uk: [String(sickBefore), String(f.sickAfterDays + 1), String(f.sickAfterDays), String(sickAfter)],
        en: [String(sickBefore), String(f.sickAfterDays + 1), String(f.sickAfterDays), String(sickAfter)]
      },
      correct: 2,
      explain: {
        ru: "После болезни нужно лечение, иначе питомец может погибнуть.",
        uk: "Після хвороби потрібне лікування, інакше улюбленець може загинути.",
        en: "Once sick, your pet needs treatment or it may die later."
      }
    },
    {
      id: "q21_pet_streak_reset",
      text: {
        ru: "Что происходит со стриком кормлений, если пропустить день?",
        uk: "Що стається зі стриком годування, якщо пропустити день?",
        en: "What happens to feeding streak if you miss one day?"
      },
      options: {
        ru: ["Стрик замораживается", "Стрик уменьшается на 1", "Стрик сбрасывается в 0", "Ничего не происходит"],
        uk: ["Стрик заморожується", "Стрик зменшується на 1", "Стрик скидається в 0", "Нічого не стається"],
        en: ["Streak is paused", "Streak loses 1", "Streak resets to 0", "Nothing happens"]
      },
      correct: 2,
      explain: {
        ru: "Любой пропуск дня обнуляет стрик, и он начинается заново.",
        uk: "Будь-який пропуск дня обнуляє стрик, і він починається заново.",
        en: "Any missed day resets the streak and it starts over."
      }
    },
    {
      id: "q22_pet_heal_cost",
      text: {
        ru: "Сколько стоит вылечить больного питомца?",
        uk: "Скільки коштує вилікувати хворого улюбленця?",
        en: "How much does it cost to heal a sick pet?"
      },
      options: {
        ru: [`💎${healCheap}`, `💎${f.healCost}`, `💎${healExpensive}`, "Бесплатно"],
        uk: [`💎${healCheap}`, `💎${f.healCost}`, `💎${healExpensive}`, "Безкоштовно"],
        en: [`💎${healCheap}`, `💎${f.healCost}`, `💎${healExpensive}`, "Free"]
      },
      correct: 1,
      explain: {
        ru: "Стоимость лечения фиксированная. Точную цену смотри в разделе питомца.",
        uk: "Вартість лікування фіксована. Точну ціну дивись у розділі улюбленця.",
        en: "Heal cost is fixed. You can always check the exact price in the pet section."
      }
    },
    {
      id: "q23_daily_refresh",
      text: {
        ru: "Что обновляется каждый день в 00:00 UTC?",
        uk: "Що оновлюється щодня о 00:00 UTC?",
        en: "What refreshes every day at 00:00 UTC?"
      },
      options: {
        ru: ["Только квесты", "Только викторина", "Дневные квесты и викторина", "Квесты, викторина и цены охраны"],
        uk: ["Лише квести", "Лише вікторина", "Денні квести та вікторина", "Квести, вікторина і ціни охорони"],
        en: ["Only quests", "Only quiz", "Daily quests and quiz", "Quests, quiz, and guard prices"]
      },
      correct: 2,
      explain: {
        ru: "Недельные квесты обновляются отдельно — раз в неделю.",
        uk: "Тижневі квести оновлюються окремо — раз на тиждень.",
        en: "Weekly quests refresh separately once per week."
      }
    },
    {
      id: "q24_gems_usage",
      text: {
        ru: "Для чего нужны кристаллы?",
        uk: "Для чого потрібні кристали?",
        en: "What are crystals used for?"
      },
      options: {
        ru: [
          "Только для быстрого завершения работ",
          "Для ускорений, лечения питомца и иммунитета бизнеса",
          "Только для покупки питомца",
          "Только для иммунитета бизнеса"
        ],
        uk: [
          "Лише для швидкого завершення робіт",
          "Для прискорень, лікування улюбленця та імунітету бізнесу",
          "Лише для купівлі улюбленця",
          "Лише для імунітету бізнесу"
        ],
        en: [
          "Only for instant job finish",
          "For skips, pet healing, and business immunity",
          "Only for buying pets",
          "Only for business immunity"
        ]
      },
      correct: 1,
      explain: {
        ru: "Кристаллы — редкая валюта для ускорений и важных защитных действий.",
        uk: "Кристали — рідкісна валюта для прискорень і важливих захисних дій.",
        en: "Crystals are premium currency for skips and key protection actions."
      }
    },
    
    {
      id: "q26_study_levels_total",
      text: {
        ru: "Сколько уровней образования доступно в игре?",
        uk: "Скільки рівнів навчання доступно в грі?",
        en: "How many Study levels are available in the game?"
      },
      options: {
        ru: ["10", "20", String(f.studyMaxLevel), "50"],
        uk: ["10", "20", String(f.studyMaxLevel), "50"],
        en: ["10", "20", String(f.studyMaxLevel), "50"]
      },
      correct: 2,
      explain: {
        ru: "Максимальный уровень учёбы задаётся текущей конфигурацией игры.",
        uk: "Максимальний рівень навчання задається поточною конфігурацією гри.",
        en: "The max Study level is defined by the current game configuration."
      }
    },
    {
      id: "q27_first_business_name",
      text: {
        ru: "Как называется первый бизнес, который можно купить?",
        uk: "Як називається перший бізнес, який можна купити?",
        en: "What is the first business you can buy?"
      },
      options: {
        ru: ["Стоматология", "Курьерская служба", "Ларёк с шавермой", "Ресторан"],
        uk: ["Стоматологія", "Курʼєрська служба", "Ларьок із шавермою", "Ресторан"],
        en: ["Dental clinic", "Courier service", "Shawarma stand", "Restaurant"]
      },
      correct: 2,
      explain: {
        ru: "Первый бизнес по цене входа — ларёк с шавермой.",
        uk: "Перший бізнес за ціною входу — ларьок із шавермою.",
        en: "The first business by entry price is the shawarma stand."
      }
    },
    {
      id: "q28_shawarma_slots_count",
      text: {
        ru: "Сколько слотов для наёмников можно купить в ларьке с шавермой?",
        uk: "Скільки слотів для працівників можна купити в ларьку з шавермою?",
        en: "How many worker slots can be bought in the shawarma stand?"
      },
      options: {
        ru: ["3", "4", String(f.shawarmaSlots), "7"],
        uk: ["3", "4", String(f.shawarmaSlots), "7"],
        en: ["3", "4", String(f.shawarmaSlots), "7"]
      },
      correct: 2,
      explain: {
        ru: "Число слотов для ларька определяется конфигом рынка наёмников.",
        uk: "Кількість слотів для ларька визначається конфігом ринку найманців.",
        en: "The slot count for this business is defined by labour market config."
      }
    },
    {
      id: "q29_referral_reward_gems",
      text: {
        ru: "Сколько кристаллов получаешь за приглашённого друга?",
        uk: "Скільки кристалів ти отримуєш за запрошеного друга?",
        en: "How many crystals do you get for an invited friend?"
      },
      options: {
        ru: ["5", String(f.referralRewardGems), "25", "50"],
        uk: ["5", String(f.referralRewardGems), "25", "50"],
        en: ["5", String(f.referralRewardGems), "25", "50"]
      },
      correct: 1,
      explain: {
        ru: "Награда за реферала задаётся в конфигурации реферальной системы.",
        uk: "Нагорода за реферала задається в конфігурації реферальної системи.",
        en: "Referral reward is configured in the referral settings."
      }
    },
    {
      id: "q30_business_count_total",
      text: {
        ru: "Сколько бизнесов доступно в игре?",
        uk: "Скільки бізнесів доступно в грі?",
        en: "How many businesses are available in the game?"
      },
      options: {
        ru: ["3", "4", String(f.businessCount), "8"],
        uk: ["3", "4", String(f.businessCount), "8"],
        en: ["3", "4", String(f.businessCount), "8"]
      },
      correct: 2,
      explain: {
        ru: "Количество бизнесов берётся из текущего списка бизнесов в игре.",
        uk: "Кількість бізнесів береться з поточного списку бізнесів у грі.",
        en: "The number comes from the current in-game business list."
      }
    },
    {
      id: "q31_premium_currency_name",
      text: {
        ru: "Как называется премиум-валюта игры?",
        uk: "Як називається преміум-валюта гри?",
        en: "What is the premium currency called?"
      },
      options: {
        ru: ["Монеты", "Золото", "Кристаллы", "Жетоны"],
        uk: ["Монети", "Золото", "Кристали", "Жетони"],
        en: ["Coins", "Gold", "Crystals", "Tokens"]
      },
      correct: 2,
      explain: {
        ru: "Премиум-валюта в игре — кристаллы.",
        uk: "Преміум-валюта в грі — кристали.",
        en: "Crystals are the premium currency in the game."
      }
    },
    {
      id: "q32_where_top_players",
      text: {
        ru: "Где можно посмотреть лучших игроков?",
        uk: "Де можна подивитися найкращих гравців?",
        en: "Where can you see the best players?"
      },
      options: {
        ru: ["В зале арканы", "В кланах", "В рейтинге", "В магазине"],
        uk: ["У залі аркани", "У кланах", "У рейтингу", "У магазині"],
        en: ["In Arcana Hall", "In Clans", "In Rating", "In Shop"]
      },
      correct: 2,
      explain: {
        ru: "Топы игроков отображаются в рейтингах и на доске почёта.",
        uk: "Топи гравців відображаються у рейтингах і на дошці пошани.",
        en: "Player tops are shown in ratings and the hall of fame."
      }
    },
    {
      id: "q33_player_group_name",
      text: {
        ru: "Как называется объединение игроков в WoL?",
        uk: "Як називається обʼєднання гравців у WoL?",
        en: "What is the player group called in WoL?"
      },
      options: {
        ru: ["Команда", "Альянс", "Клан", "Гильдия"],
        uk: ["Команда", "Альянс", "Клан", "Гільдія"],
        en: ["Team", "Alliance", "Clan", "Guild"]
      },
      correct: 2,
      explain: {
        ru: "Игроки объединяются в кланы.",
        uk: "Гравці обʼєднуються в клани.",
        en: "Players are organized into clans."
      }
    },
    {
      id: "q34_languages_count",
      text: {
        ru: "Сколько языков поддерживает игра?",
        uk: "Скільки мов підтримує гра?",
        en: "How many languages does the game support?"
      },
      options: {
        ru: ["1", "2", "3", "5"],
        uk: ["1", "2", "3", "5"],
        en: ["1", "2", "3", "5"]
      },
      correct: 2,
      explain: {
        ru: "Игра поддерживает русский, украинский и английский.",
        uk: "Гра підтримує російську, українську та англійську.",
        en: "The game supports Russian, Ukrainian, and English."
      }
    },
    {
      id: "q35_start_work_requirement",
      text: {
        ru: "Что нужно, чтобы начать работать?",
        uk: "Що потрібно, щоб почати працювати?",
        en: "What do you need to start working?"
      },
      options: {
        ru: ["Деньги", "Кристаллы", "Энергию", "Уровень образования"],
        uk: ["Гроші", "Кристали", "Енергію", "Рівень навчання"],
        en: ["Money", "Crystals", "Energy", "Study level"]
      },
      correct: 2,
      explain: {
        ru: "Каждая работа требует расход энергии.",
        uk: "Кожна робота потребує витрати енергії.",
        en: "Every job consumes energy."
      }
    },
    {
      id: "q36_shawarma_contract_days",
      text: {
        ru: "На сколько дней действует контракт наёмника в ларьке с шавермой?",
        uk: "На скільки днів діє контракт працівника в ларьку з шавермою?",
        en: "How many days does a worker contract last in the shawarma stand?"
      },
      options: {
        ru: [String(f.shawarmaContractDays), "2", "3", "7"],
        uk: [String(f.shawarmaContractDays), "2", "3", "7"],
        en: [String(f.shawarmaContractDays), "2", "3", "7"]
      },
      correct: 0,
      explain: {
        ru: "Длительность контракта в ларьке берётся из конфига слотов.",
        uk: "Тривалість контракту в ларьку береться з конфіга слотів.",
        en: "Contract duration in this business comes from slot config."
      }
    },
    {
      id: "q37_shop_energy_item",
      text: {
        ru: "Что можно купить в магазине для восстановления энергии?",
        uk: "Що можна купити в магазині для відновлення енергії?",
        en: "What can you buy in the shop to restore energy?"
      },
      options: {
        ru: ["Кристаллы", "Еду", "Акции", "Питомца"],
        uk: ["Кристали", "Їжу", "Акції", "Улюбленця"],
        en: ["Crystals", "Food", "Stocks", "Pet"]
      },
      correct: 1,
      explain: {
        ru: "Еда из магазина восстанавливает энергию.",
        uk: "Їжа з магазину відновлює енергію.",
        en: "Food items from the shop restore energy."
      }
    },
    {
      id: "q38_stocks_place",
      text: {
        ru: "Где торгуют ценными бумагами в игре?",
        uk: "Де торгують цінними паперами в грі?",
        en: "Where do you trade securities in the game?"
      },
      options: {
        ru: ["В магазине", "В зале арканы", "На бирже", "В клане"],
        uk: ["У магазині", "У залі аркани", "На біржі", "У клані"],
        en: ["In shop", "In Arcana Hall", "On the exchange", "In clan"]
      },
      correct: 2,
      explain: {
        ru: "Покупка и продажа акций происходят в разделе Биржа.",
        uk: "Купівля та продаж акцій відбуваються в розділі Біржа.",
        en: "Buying and selling shares happens in the Exchange section."
      }
    },
    {
      id: "q39_theft_mechanic_name",
      text: {
        ru: "Как называется механика кражи у других игроков?",
        uk: "Як називається механіка крадіжки в інших гравців?",
        en: "What is the theft mechanic called?"
      },
      options: {
        ru: ["Налёт", "Ограбление", "Воровство", "Мародёрство"],
        uk: ["Наліт", "Пограбування", "Злодійство", "Мародерство"],
        en: ["Raid", "Robbery", "Theft", "Looting"]
      },
      correct: 2,
      explain: {
        ru: "В игре эта механика называется «Воровство».",
        uk: "У грі ця механіка називається «Злодійство».",
        en: "In the game this mechanic is called “Theft”."
      }
    },
    {
      id: "q40_min_crystal_pack",
      text: {
        ru: "Какой самый маленький пак кристаллов можно купить?",
        uk: "Який найменший пак кристалів можна купити?",
        en: "What is the smallest crystal pack you can buy?"
      },
      options: {
        ru: [String(f.premiumMinPack), "25", "50", "100"],
        uk: [String(f.premiumMinPack), "25", "50", "100"],
        en: [String(f.premiumMinPack), "25", "50", "100"]
      },
      correct: 0,
      explain: {
        ru: "Минимальный пак определяется текущей витриной кристаллов.",
        uk: "Мінімальний пак визначається поточною вітриною кристалів.",
        en: "The smallest pack depends on current premium pack configuration."
      }
    },
    {
      id: "q41_max_crystal_pack",
      text: {
        ru: "Какой самый большой пак кристаллов можно купить?",
        uk: "Який найбільший пак кристалів можна купити?",
        en: "What is the largest crystal pack you can buy?"
      },
      options: {
        ru: ["60", "100", "120", String(f.premiumMaxPack)],
        uk: ["60", "100", "120", String(f.premiumMaxPack)],
        en: ["60", "100", "120", String(f.premiumMaxPack)]
      },
      correct: 3,
      explain: {
        ru: "Максимальный пак определяется текущей витриной кристаллов.",
        uk: "Максимальний пак визначається поточною вітриною кристалів.",
        en: "The largest pack depends on current premium pack configuration."
      }
    },
    {
      id: "q42_shawarma_price",
      text: {
        ru: "Сколько стоит ларёк с шавермой?",
        uk: "Скільки коштує ларьок із шавермою?",
        en: "How much does the shawarma stand cost?"
      },
      options: {
        ru: [shawarmaWrongPrice, String(f.shawarmaPrice), "25000", "50000"],
        uk: [shawarmaWrongPrice, String(f.shawarmaPrice), "25000", "50000"],
        en: [shawarmaWrongPrice, String(f.shawarmaPrice), "25000", "50000"]
      },
      correct: 1,
      explain: {
        ru: "Стоимость первого бизнеса задаётся в конфиге бизнеса.",
        uk: "Вартість першого бізнесу задається в конфігу бізнесу.",
        en: "The first business price is defined in business config."
      }
    },
    {
      id: "q43_pet_no_feed_effect",
      text: {
        ru: "Что происходит с питомцем если его не кормить?",
        uk: "Що відбувається з улюбленцем, якщо його не годувати?",
        en: "What happens to your pet if you don't feed it?"
      },
      options: {
        ru: ["Убегает", "Грустит но живёт", "Его состояние ухудшается", "Ничего"],
        uk: ["Тікає", "Сумує але живе", "Його стан погіршується", "Нічого"],
        en: ["Runs away", "Gets sad but stays fine", "Its condition worsens", "Nothing"]
      },
      correct: 2,
      explain: {
        ru: "Без кормления питомец переходит от голода к болезни и дальше.",
        uk: "Без годування улюбленець переходить від голоду до хвороби й далі.",
        en: "Without feeding, the pet state degrades over time."
      }
    },
    {
      id: "q44_coffee_restores",
      text: {
        ru: "Что восстанавливает кофе из магазина?",
        uk: "Що відновлює кава з магазину?",
        en: "What does coffee from the shop restore?"
      },
      options: {
        ru: ["Деньги", "Энергию", "Настроение", "Кристаллы"],
        uk: ["Гроші", "Енергію", "Настрій", "Кристали"],
        en: ["Money", "Energy", "Mood", "Crystals"]
      },
      correct: 1,
      explain: {
        ru: "Кофе — это еда на +энергию из магазина.",
        uk: "Кава — це їжа на +енергію з магазину.",
        en: "Coffee is an energy-restoring food item from the shop."
      }
    }
  ];
}
