export function buildGeneralQuizCatalog() {
  return [
    {
      id: "gq01_red_planet",
      text: {
        ru: "Какая планета известна как «Красная планета»?",
        uk: "Яку планету називають «Червоною планетою»?",
        en: "Which planet is known as the Red Planet?"
      },
      options: {
        ru: ["Венера", "Марс", "Юпитер", "Меркурий"],
        uk: ["Венера", "Марс", "Юпітер", "Меркурій"],
        en: ["Venus", "Mars", "Jupiter", "Mercury"]
      },
      correct: 1,
      explain: {
        ru: "Марс называют Красной планетой из-за оттенка поверхности.",
        uk: "Марс називають Червоною планетою через відтінок поверхні.",
        en: "Mars is called the Red Planet because of its reddish surface."
      }
    },
    {
      id: "gq02_largest_ocean",
      text: {
        ru: "Какой океан самый большой на Земле?",
        uk: "Який океан найбільший на Землі?",
        en: "Which ocean is the largest on Earth?"
      },
      options: {
        ru: ["Атлантический", "Индийский", "Тихий", "Северный Ледовитый"],
        uk: ["Атлантичний", "Індійський", "Тихий", "Північний Льодовитий"],
        en: ["Atlantic", "Indian", "Pacific", "Arctic"]
      },
      correct: 2,
      explain: {
        ru: "Тихий океан — крупнейший по площади.",
        uk: "Тихий океан — найбільший за площею.",
        en: "The Pacific Ocean is the largest by area."
      }
    },
    {
      id: "gq03_plants_absorb",
      text: {
        ru: "Какой газ растения поглощают при фотосинтезе?",
        uk: "Який газ рослини поглинають під час фотосинтезу?",
        en: "Which gas do plants absorb during photosynthesis?"
      },
      options: {
        ru: ["Кислород", "Азот", "Углекислый газ", "Водород"],
        uk: ["Кисень", "Азот", "Вуглекислий газ", "Водень"],
        en: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"]
      },
      correct: 2,
      explain: {
        ru: "Растения поглощают CO2 и выделяют кислород.",
        uk: "Рослини поглинають CO2 і виділяють кисень.",
        en: "Plants absorb CO2 and release oxygen."
      }
    },
    {
      id: "gq04_minutes_hour",
      text: {
        ru: "Сколько минут в одном часе?",
        uk: "Скільки хвилин в одній годині?",
        en: "How many minutes are in one hour?"
      },
      options: {
        ru: ["30", "45", "60", "90"],
        uk: ["30", "45", "60", "90"],
        en: ["30", "45", "60", "90"]
      },
      correct: 2,
      explain: {
        ru: "Один час всегда равен 60 минутам.",
        uk: "Одна година завжди дорівнює 60 хвилинам.",
        en: "One hour always equals 60 minutes."
      }
    },
    {
      id: "gq05_thermometer",
      text: {
        ru: "Какой прибор измеряет температуру?",
        uk: "Який прилад вимірює температуру?",
        en: "Which instrument measures temperature?"
      },
      options: {
        ru: ["Барометр", "Термометр", "Компас", "Секундомер"],
        uk: ["Барометр", "Термометр", "Компас", "Секундомір"],
        en: ["Barometer", "Thermometer", "Compass", "Stopwatch"]
      },
      correct: 1,
      explain: {
        ru: "Температуру измеряют термометром.",
        uk: "Температуру вимірюють термометром.",
        en: "Temperature is measured with a thermometer."
      }
    },
    {
      id: "gq06_romeo_author",
      text: {
        ru: "Кто написал «Ромео и Джульетту»?",
        uk: "Хто написав «Ромео і Джульєтту»?",
        en: "Who wrote Romeo and Juliet?"
      },
      options: {
        ru: ["Чарльз Диккенс", "Уильям Шекспир", "Жюль Верн", "Марк Твен"],
        uk: ["Чарльз Діккенс", "Вільям Шекспір", "Жуль Верн", "Марк Твен"],
        en: ["Charles Dickens", "William Shakespeare", "Jules Verne", "Mark Twain"]
      },
      correct: 1,
      explain: {
        ru: "Автор трагедии — Уильям Шекспир.",
        uk: "Автор трагедії — Вільям Шекспір.",
        en: "The tragedy was written by William Shakespeare."
      }
    },
    {
      id: "gq07_badminton",
      text: {
        ru: "В каком виде спорта используют ракетку и волан?",
        uk: "У якому виді спорту використовують ракетку і волан?",
        en: "Which sport uses a racket and a shuttlecock?"
      },
      options: {
        ru: ["Теннис", "Бадминтон", "Сквош", "Пинг-понг"],
        uk: ["Теніс", "Бадмінтон", "Сквош", "Пінг-понг"],
        en: ["Tennis", "Badminton", "Squash", "Table tennis"]
      },
      correct: 1,
      explain: {
        ru: "Волан используется именно в бадминтоне.",
        uk: "Волан використовується саме в бадмінтоні.",
        en: "A shuttlecock is used in badminton."
      }
    },
    {
      id: "gq08_saturn_rings",
      text: {
        ru: "Какая планета известна своими кольцами?",
        uk: "Яка планета відома своїми кільцями?",
        en: "Which planet is famous for its rings?"
      },
      options: {
        ru: ["Марс", "Сатурн", "Земля", "Нептун"],
        uk: ["Марс", "Сатурн", "Земля", "Нептун"],
        en: ["Mars", "Saturn", "Earth", "Neptune"]
      },
      correct: 1,
      explain: {
        ru: "У Сатурна самые заметные кольца в Солнечной системе.",
        uk: "У Сатурна найпомітніші кільця в Сонячній системі.",
        en: "Saturn has the most visible rings in the Solar System."
      }
    },
    {
      id: "gq09_water_boil",
      text: {
        ru: "При какой температуре кипит вода при нормальном давлении?",
        uk: "За якої температури кипить вода за нормального тиску?",
        en: "At what temperature does water boil at normal pressure?"
      },
      options: {
        ru: ["80°C", "90°C", "100°C", "120°C"],
        uk: ["80°C", "90°C", "100°C", "120°C"],
        en: ["80°C", "90°C", "100°C", "120°C"]
      },
      correct: 2,
      explain: {
        ru: "При нормальном атмосферном давлении вода кипит при 100°C.",
        uk: "За нормального атмосферного тиску вода кипить при 100°C.",
        en: "At normal atmospheric pressure, water boils at 100°C."
      }
    },
    {
      id: "gq10_sahara_continent",
      text: {
        ru: "На каком континенте находится пустыня Сахара?",
        uk: "На якому континенті розташована пустеля Сахара?",
        en: "On which continent is the Sahara Desert located?"
      },
      options: {
        ru: ["Азия", "Африка", "Австралия", "Южная Америка"],
        uk: ["Азія", "Африка", "Австралія", "Південна Америка"],
        en: ["Asia", "Africa", "Australia", "South America"]
      },
      correct: 1,
      explain: {
        ru: "Сахара расположена в Северной Африке.",
        uk: "Сахара розташована в Північній Африці.",
        en: "The Sahara is located in North Africa."
      }
    },
    {
      id: "gq11_binary",
      text: {
        ru: "Какие цифры используются в двоичной системе?",
        uk: "Які цифри використовуються у двійковій системі?",
        en: "Which digits are used in the binary system?"
      },
      options: {
        ru: ["0 и 1", "1 и 2", "0, 1 и 2", "Только 1"],
        uk: ["0 і 1", "1 і 2", "0, 1 і 2", "Лише 1"],
        en: ["0 and 1", "1 and 2", "0, 1 and 2", "Only 1"]
      },
      correct: 0,
      explain: {
        ru: "Двоичная система состоит из цифр 0 и 1.",
        uk: "Двійкова система складається з цифр 0 і 1.",
        en: "Binary uses only two digits: 0 and 1."
      }
    },
    {
      id: "gq12_largest_mammal",
      text: {
        ru: "Какое животное считается самым крупным млекопитающим?",
        uk: "Яку тварину вважають найбільшим ссавцем?",
        en: "Which animal is the largest mammal?"
      },
      options: {
        ru: ["Слон", "Синий кит", "Жираф", "Бегемот"],
        uk: ["Слон", "Синій кит", "Жирафа", "Бегемот"],
        en: ["Elephant", "Blue whale", "Giraffe", "Hippopotamus"]
      },
      correct: 1,
      explain: {
        ru: "Синий кит — крупнейшее млекопитающее на планете.",
        uk: "Синій кит — найбільший ссавець на планеті.",
        en: "The blue whale is the largest mammal on Earth."
      }
    },
    {
      id: "gq13_piano_keys",
      text: {
        ru: "Какой инструмент обычно имеет 88 клавиш?",
        uk: "Який інструмент зазвичай має 88 клавіш?",
        en: "Which instrument usually has 88 keys?"
      },
      options: {
        ru: ["Гитара", "Скрипка", "Пианино", "Флейта"],
        uk: ["Гітара", "Скрипка", "Піаніно", "Флейта"],
        en: ["Guitar", "Violin", "Piano", "Flute"]
      },
      correct: 2,
      explain: {
        ru: "Стандартное пианино имеет 88 клавиш.",
        uk: "Стандартне піаніно має 88 клавіш.",
        en: "A standard piano has 88 keys."
      }
    },
    {
      id: "gq14_html",
      text: {
        ru: "Какой язык используют для структуры веб-страницы?",
        uk: "Яку мову використовують для структури веб-сторінки?",
        en: "Which language is used for web page structure?"
      },
      options: {
        ru: ["Python", "HTML", "SQL", "C++"],
        uk: ["Python", "HTML", "SQL", "C++"],
        en: ["Python", "HTML", "SQL", "C++"]
      },
      correct: 1,
      explain: {
        ru: "HTML задаёт структуру и разметку страницы.",
        uk: "HTML задає структуру та розмітку сторінки.",
        en: "HTML defines page structure and markup."
      }
    },
    {
      id: "gq15_leap_year",
      text: {
        ru: "Сколько дней в високосном году?",
        uk: "Скільки днів у високосному році?",
        en: "How many days are in a leap year?"
      },
      options: {
        ru: ["365", "366", "364", "360"],
        uk: ["365", "366", "364", "360"],
        en: ["365", "366", "364", "360"]
      },
      correct: 1,
      explain: {
        ru: "В високосном году добавляется один день — 366.",
        uk: "У високосному році додається один день — 366.",
        en: "A leap year has one extra day, so 366 total."
      }
    },
    {
      id: "gq16_heart",
      text: {
        ru: "Какой орган перекачивает кровь по телу?",
        uk: "Який орган перекачує кров по тілу?",
        en: "Which organ pumps blood through the body?"
      },
      options: {
        ru: ["Лёгкие", "Печень", "Сердце", "Почки"],
        uk: ["Легені", "Печінка", "Серце", "Нирки"],
        en: ["Lungs", "Liver", "Heart", "Kidneys"]
      },
      correct: 2,
      explain: {
        ru: "Сердце обеспечивает циркуляцию крови.",
        uk: "Серце забезпечує циркуляцію крові.",
        en: "The heart drives blood circulation."
      }
    },
    {
      id: "gq17_after_spring",
      text: {
        ru: "Какое время года идёт после весны в Северном полушарии?",
        uk: "Яка пора року йде після весни в Північній півкулі?",
        en: "Which season comes after spring in the Northern Hemisphere?"
      },
      options: {
        ru: ["Осень", "Лето", "Зима", "Снова весна"],
        uk: ["Осінь", "Літо", "Зима", "Знову весна"],
        en: ["Autumn", "Summer", "Winter", "Spring again"]
      },
      correct: 1,
      explain: {
        ru: "После весны наступает лето.",
        uk: "Після весни настає літо.",
        en: "Summer comes after spring."
      }
    },
    {
      id: "gq18_liquid_metal",
      text: {
        ru: "Какой металл жидкий при комнатной температуре?",
        uk: "Який метал рідкий за кімнатної температури?",
        en: "Which metal is liquid at room temperature?"
      },
      options: {
        ru: ["Железо", "Серебро", "Ртуть", "Алюминий"],
        uk: ["Залізо", "Срібло", "Ртуть", "Алюміній"],
        en: ["Iron", "Silver", "Mercury", "Aluminum"]
      },
      correct: 2,
      explain: {
        ru: "Ртуть остаётся жидкой при обычной комнатной температуре.",
        uk: "Ртуть залишається рідкою за звичайної кімнатної температури.",
        en: "Mercury stays liquid at normal room temperature."
      }
    },
    {
      id: "gq19_fastest_land",
      text: {
        ru: "Какое животное самое быстрое на суше?",
        uk: "Яка тварина найшвидша на суші?",
        en: "Which animal is the fastest on land?"
      },
      options: {
        ru: ["Лев", "Гепард", "Антилопа", "Волк"],
        uk: ["Лев", "Гепард", "Антилопа", "Вовк"],
        en: ["Lion", "Cheetah", "Antelope", "Wolf"]
      },
      correct: 1,
      explain: {
        ru: "Гепард считается самым быстрым наземным животным.",
        uk: "Гепард вважається найшвидшою наземною твариною.",
        en: "The cheetah is considered the fastest land animal."
      }
    },
    {
      id: "gq20_solar",
      text: {
        ru: "Какой источник энергии использует солнечный свет?",
        uk: "Яке джерело енергії використовує сонячне світло?",
        en: "Which energy source uses sunlight?"
      },
      options: {
        ru: ["Солнечная энергия", "Уголь", "Нефть", "Природный газ"],
        uk: ["Сонячна енергія", "Вугілля", "Нафта", "Природний газ"],
        en: ["Solar energy", "Coal", "Oil", "Natural gas"]
      },
      correct: 0,
      explain: {
        ru: "Солнечная энергия вырабатывается из солнечного излучения.",
        uk: "Сонячна енергія виробляється із сонячного випромінювання.",
        en: "Solar energy is produced from sunlight."
      }
    }
  ];
}

