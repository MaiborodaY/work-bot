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
  return { maxSlots, sellFee, dividend, companies, healCost, sickAfterDays };
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

  return [
    {
      id: "q01_work_skip",
      text: {
        ru: "Что нужно нажать, чтобы мгновенно завершить смену?",
        uk: "Що треба натиснути, щоб миттєво завершити зміну?",
        en: "What should you tap to finish a shift instantly?"
      },
      options: {
        ru: ["Пропустить смену", "⏩ Завершить за кристаллы", "Отменить смену", "Ускорить"],
        uk: ["Пропустити зміну", "⏩ Завершити за кристали", "Скасувати зміну", "Прискорити"],
        en: ["Skip shift", "⏩ Finish for crystals", "Cancel shift", "Boost shift"]
      },
      correct: 1,
      explain: {
        ru: "Кнопка «Завершить» тратит кристаллы и закрывает смену сразу.",
        uk: "Кнопка «Завершити» витрачає кристали й одразу закриває зміну.",
        en: "The “Finish” button spends crystals and closes the shift right away."
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
        ru: ["Максимум энергии", "Скорость тренировок", "Скорость выполнения смен", "Доход с бизнеса"],
        uk: ["Максимум енергії", "Швидкість тренувань", "Швидкість виконання змін", "Дохід з бізнесу"],
        en: ["Max energy", "Workout speed", "Shift completion speed", "Business income"]
      },
      correct: 2,
      explain: {
        ru: "Чем выше уровень учёбы, тем быстрее идут рабочие смены.",
        uk: "Чим вищий рівень навчання, тим швидше йдуть робочі зміни.",
        en: "The higher your Study level, the faster your job shifts complete."
      }
    },
    {
      id: "q03_work_parallel",
      text: {
        ru: "Сколько смен можно выполнять одновременно?",
        uk: "Скільки змін можна виконувати одночасно?",
        en: "How many shifts can run at the same time?"
      },
      options: {
        ru: ["1", "2", "3", "Без ограничений"],
        uk: ["1", "2", "3", "Без обмежень"],
        en: ["1", "2", "3", "Unlimited"]
      },
      correct: 0,
      explain: {
        ru: "В один момент времени можно вести только одну активную смену.",
        uk: "В один момент часу можна вести лише одну активну зміну.",
        en: "You can only have one active shift at a time."
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
        ru: ["Скорость смен", "Максимум энергии", "Уровень учёбы", "Доход с бизнеса"],
        uk: ["Швидкість змін", "Максимум енергії", "Рівень навчання", "Дохід з бізнесу"],
        en: ["Shift speed", "Max energy", "Study level", "Business income"]
      },
      correct: 1,
      explain: {
        ru: "Зал увеличивает максимум энергии, чтобы ты мог брать больше смен.",
        uk: "Зал збільшує максимум енергії, щоб ти міг брати більше змін.",
        en: "Gym increases your max energy so you can run more shifts."
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
        ru: ["Каждый час", "Каждый день", "В конце контракта", "После каждой смены"],
        uk: ["Щогодини", "Щодня", "У кінці контракту", "Після кожної зміни"],
        en: ["Every hour", "Every day", "At contract end", "After each shift"]
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
          "Только для быстрого завершения смен",
          "Для ускорений, лечения питомца и иммунитета бизнеса",
          "Только для покупки питомца",
          "Только для иммунитета бизнеса"
        ],
        uk: [
          "Лише для швидкого завершення змін",
          "Для прискорень, лікування улюбленця та імунітету бізнесу",
          "Лише для купівлі улюбленця",
          "Лише для імунітету бізнесу"
        ],
        en: [
          "Only for instant shift finish",
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
      id: "q25_referrals_5",
      text: {
        ru: "Сколько активированных рефералов нужно для ачивки «Вербовщик»?",
        uk: "Скільки активованих рефералів потрібно для ачивки «Вербувальник»?",
        en: "How many activated referrals are needed for the “Recruiter” achievement?"
      },
      options: {
        ru: ["3", "5", "10", "20"],
        uk: ["3", "5", "10", "20"],
        en: ["3", "5", "10", "20"]
      },
      correct: 1,
      explain: {
        ru: "Реферал считается только после первой выплаты со смены.",
        uk: "Реферал рахується лише після першої виплати зі зміни.",
        en: "A referral counts only after the first shift payout."
      }
    }
  ];
}
