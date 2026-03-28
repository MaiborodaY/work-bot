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

const GENERAL_QUIZ_MEDIUM_EN = [
  { id: "gqm_001", q: "Which element has the chemical symbol 'Ag'?", options: ["Gold", "Silver", "Argon", "Aluminum"], correct: 1, explain: "Ag comes from the Latin word 'argentum', meaning silver." },
  { id: "gqm_002", q: "Which planet has the shortest day in our solar system?", options: ["Mars", "Saturn", "Jupiter", "Neptune"], correct: 2, explain: "Jupiter rotates in about 10 hours, the fastest of all planets." },
  { id: "gqm_003", q: "A substance with pH 3 is:", options: ["Neutral", "Basic", "Acidic", "Salt-based"], correct: 2, explain: "Any pH value below 7 is acidic." },
  { id: "gqm_004", q: "What is the most abundant gas in Earth's atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Argon"], correct: 1, explain: "Nitrogen makes up about 78% of the atmosphere." },
  { id: "gqm_005", q: "What is the largest internal organ in the human body?", options: ["Lungs", "Brain", "Liver", "Kidney"], correct: 2, explain: "The liver is the largest internal organ." },
  { id: "gqm_006", q: "Which blood cells mainly carry oxygen?", options: ["White blood cells", "Platelets", "Red blood cells", "Plasma cells"], correct: 2, explain: "Red blood cells carry oxygen via hemoglobin." },
  { id: "gqm_007", q: "Which vitamin is produced in skin when exposed to sunlight?", options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], correct: 2, explain: "Sunlight helps the body synthesize vitamin D." },
  { id: "gqm_008", q: "What is the process by which plants release water vapor from leaves?", options: ["Photosynthesis", "Respiration", "Transpiration", "Pollination"], correct: 2, explain: "Transpiration is water loss through stomata." },
  { id: "gqm_009", q: "What is the SI unit of electrical resistance?", options: ["Volt", "Ampere", "Watt", "Ohm"], correct: 3, explain: "Electrical resistance is measured in ohms." },
  { id: "gqm_010", q: "The speed of light in vacuum is closest to:", options: ["30,000 km/s", "300,000 km/s", "3,000 km/s", "3,000,000 km/s"], correct: 1, explain: "It is approximately 299,792 km/s." },
  { id: "gqm_011", q: "Which is the longest river in South America?", options: ["Parana", "Orinoco", "Amazon", "Magdalena"], correct: 2, explain: "The Amazon is the longest river in South America." },
  { id: "gqm_012", q: "What is the capital city of Canada?", options: ["Toronto", "Ottawa", "Montreal", "Vancouver"], correct: 1, explain: "Ottawa is Canada's capital." },
  { id: "gqm_013", q: "Which mountain range separates France and Spain?", options: ["Alps", "Andes", "Pyrenees", "Carpathians"], correct: 2, explain: "The Pyrenees form the natural border." },
  { id: "gqm_014", q: "Which country is often cited as having the most islands?", options: ["Indonesia", "Philippines", "Norway", "Sweden"], correct: 3, explain: "Sweden is commonly listed as having the most islands." },
  { id: "gqm_015", q: "Which desert is located in northern Africa?", options: ["Gobi", "Kalahari", "Sahara", "Atacama"], correct: 2, explain: "The Sahara is in northern Africa." },
  { id: "gqm_016", q: "The 0° longitude line is called:", options: ["Equator", "Prime Meridian", "Tropic of Cancer", "International Date Line"], correct: 1, explain: "0° longitude is the Prime Meridian." },
  { id: "gqm_017", q: "Which ocean lies between Africa and Australia?", options: ["Atlantic Ocean", "Pacific Ocean", "Arctic Ocean", "Indian Ocean"], correct: 3, explain: "That is the Indian Ocean." },
  { id: "gqm_018", q: "What currency is used in Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], correct: 2, explain: "Japan uses the yen." },
  { id: "gqm_019", q: "Which is the largest country in South America by area?", options: ["Argentina", "Peru", "Brazil", "Colombia"], correct: 2, explain: "Brazil is the largest by area." },
  { id: "gqm_020", q: "Which city is famously called the City of Canals?", options: ["Amsterdam", "Copenhagen", "Bangkok", "Venice"], correct: 3, explain: "Venice is globally known for its canals." },
  { id: "gqm_021", q: "Which protocol is used for secure websites?", options: ["HTTP", "FTP", "HTTPS", "SMTP"], correct: 2, explain: "HTTPS is HTTP with encryption." },
  { id: "gqm_022", q: "What is decimal 10 in binary?", options: ["1001", "1010", "1100", "1110"], correct: 1, explain: "Decimal 10 equals binary 1010." },
  { id: "gqm_023", q: "Who created the Python programming language?", options: ["Bjarne Stroustrup", "Guido van Rossum", "Dennis Ritchie", "James Gosling"], correct: 1, explain: "Python was created by Guido van Rossum." },
  { id: "gqm_024", q: "What does RAM stand for?", options: ["Read Access Module", "Random Access Memory", "Runtime Active Memory", "Rapid Application Method"], correct: 1, explain: "RAM means Random Access Memory." },
  { id: "gqm_025", q: "What is the main purpose of two-factor authentication (2FA)?", options: ["Speed up login", "Reduce storage usage", "Add a second verification layer", "Encrypt screenshots"], correct: 2, explain: "2FA adds a second step to improve account security." },
  { id: "gqm_026", q: "Linux is best described as:", options: ["A web browser", "A database", "A kernel-based operating system family", "An image format"], correct: 2, explain: "Linux refers to a kernel used in many OS distributions." },
  { id: "gqm_027", q: "Which file extension is commonly used for ZIP archives?", options: [".rar", ".7z", ".zip", ".tar.gz"], correct: 2, explain: "ZIP archives use the .zip extension." },
  { id: "gqm_028", q: "Cloud computing primarily means:", options: ["Using only laptops", "Running services on remote servers", "Using encrypted chat only", "Offline data processing"], correct: 1, explain: "Cloud services run on remote infrastructure." },
  { id: "gqm_029", q: "SQL is mainly used to:", options: ["Edit photos", "Query and manage relational data", "Compile Java code", "Compress videos"], correct: 1, explain: "SQL is the standard language for relational databases." },
  { id: "gqm_030", q: "Phishing is:", options: ["A backup strategy", "A cooling method", "A social engineering scam to steal data", "A file system check"], correct: 2, explain: "Phishing tricks users into revealing sensitive information." },
  { id: "gqm_031", q: "Photosynthesis mostly takes place in which plant structure?", options: ["Mitochondria", "Nucleus", "Chloroplasts", "Vacuoles"], correct: 2, explain: "Chloroplasts contain chlorophyll for photosynthesis." },
  { id: "gqm_032", q: "Which atmospheric layer helps absorb harmful UV radiation?", options: ["Troposphere", "Mesosphere", "Ozone layer in the stratosphere", "Ionosphere"], correct: 2, explain: "Ozone in the stratosphere absorbs much of UV radiation." },
  { id: "gqm_033", q: "Which is a renewable energy source?", options: ["Coal", "Natural gas", "Wind", "Diesel"], correct: 2, explain: "Wind energy is renewable." },
  { id: "gqm_034", q: "What is the largest animal currently living on Earth?", options: ["African elephant", "Blue whale", "Whale shark", "Giraffe"], correct: 1, explain: "The blue whale is the largest known living animal." },
  { id: "gqm_035", q: "Bees are critically important for:", options: ["Soil erosion", "Pollination", "Rock formation", "Ocean currents"], correct: 1, explain: "Many crops depend on bee pollination." },
  { id: "gqm_036", q: "Which gas is a major contributor to modern greenhouse warming?", options: ["Helium", "Carbon dioxide", "Neon", "Hydrogen"], correct: 1, explain: "CO2 is a key greenhouse gas from fossil fuel use." },
  { id: "gqm_037", q: "Metamorphosis in insects is the process of:", options: ["Winter migration", "Color change only", "Development from larva to adult", "Nest building"], correct: 2, explain: "Metamorphosis is a staged transformation." },
  { id: "gqm_038", q: "Coral reefs usually thrive in:", options: ["Cold deep water", "Warm shallow water", "Freshwater lakes", "Polar seas"], correct: 1, explain: "Most reef-building corals prefer warm, shallow seas." },
  { id: "gqm_039", q: "In which sport is the score term love used?", options: ["Badminton", "Tennis", "Volleyball", "Table tennis"], correct: 1, explain: "Love means zero in tennis scoring." },
  { id: "gqm_040", q: "The official marathon distance is:", options: ["40 km", "41.5 km", "42.195 km", "45 km"], correct: 2, explain: "A standard marathon is 42.195 km." },
  { id: "gqm_041", q: "How many rings are on the Olympic symbol?", options: ["4", "5", "6", "7"], correct: 1, explain: "The Olympic symbol has five rings." },
  { id: "gqm_042", q: "Judo originated in which country?", options: ["China", "South Korea", "Japan", "Thailand"], correct: 2, explain: "Judo was founded in Japan." },
  { id: "gqm_043", q: "Who wrote the novel 1984?", options: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "J.R.R. Tolkien"], correct: 1, explain: "1984 was written by George Orwell." },
  { id: "gqm_044", q: "Who painted the Mona Lisa?", options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], correct: 2, explain: "The Mona Lisa is by Leonardo da Vinci." },
  { id: "gqm_045", q: "Which language has the largest number of native speakers?", options: ["English", "Spanish", "Hindi", "Mandarin Chinese"], correct: 3, explain: "Mandarin Chinese has the most native speakers." },
  { id: "gqm_046", q: "A standard piano has how many keys?", options: ["76", "81", "88", "96"], correct: 2, explain: "A full-size modern piano has 88 keys." },
  { id: "gqm_047", q: "In which Shakespeare play do Rosencrantz and Guildenstern appear?", options: ["Macbeth", "Hamlet", "Othello", "King Lear"], correct: 1, explain: "They are characters in Hamlet." },
  { id: "gqm_048", q: "Which Ancient Wonder is still standing today?", options: ["Hanging Gardens of Babylon", "Lighthouse of Alexandria", "Great Pyramid of Giza", "Temple of Artemis"], correct: 2, explain: "Only the Great Pyramid of Giza still survives." },
  { id: "gqm_049", q: "Diwali is commonly known as the festival of:", options: ["Harvest", "Lights", "Rain", "Spring"], correct: 1, explain: "Diwali is widely known as the Festival of Lights." },
  { id: "gqm_050", q: "Who was the first person to walk on the Moon?", options: ["Yuri Gagarin", "Neil Armstrong", "Buzz Aldrin", "Michael Collins"], correct: 1, explain: "Neil Armstrong stepped onto the Moon first in 1969." }
];

const GENERAL_QUIZ_MEDIUM_I18N = {
  gqm_001: {
    ru: { q: "Какой химический символ у серебра?", options: ["Au", "Ag", "Ar", "Al"], explain: "Ag происходит от латинского слова argentum — серебро." },
    uk: { q: "Який хімічний символ у срібла?", options: ["Au", "Ag", "Ar", "Al"], explain: "Ag походить від латинського слова argentum — срібло." }
  },
  gqm_002: {
    ru: { q: "У какой планеты самые короткие сутки в Солнечной системе?", options: ["Марс", "Сатурн", "Юпитер", "Нептун"], explain: "Юпитер делает оборот примерно за 10 часов — быстрее всех планет." },
    uk: { q: "У якої планети найкоротша доба в Сонячній системі?", options: ["Марс", "Сатурн", "Юпітер", "Нептун"], explain: "Юпітер обертається приблизно за 10 годин — найшвидше серед планет." }
  },
  gqm_003: {
    ru: { q: "Вещество с pH 3 — это:", options: ["Нейтральное", "Щелочное", "Кислотное", "Солевое"], explain: "Значение pH ниже 7 означает кислотную среду." },
    uk: { q: "Речовина з pH 3 — це:", options: ["Нейтральна", "Лужна", "Кисла", "Сольова"], explain: "Значення pH нижче 7 означає кисле середовище." }
  },
  gqm_004: {
    ru: { q: "Какой газ самый распространённый в атмосфере Земли?", options: ["Кислород", "Азот", "Углекислый газ", "Аргон"], explain: "Азот составляет около 78% земной атмосферы." },
    uk: { q: "Який газ є найпоширенішим в атмосфері Землі?", options: ["Кисень", "Азот", "Вуглекислий газ", "Аргон"], explain: "Азот становить приблизно 78% атмосфери Землі." }
  },
  gqm_005: {
    ru: { q: "Какой самый крупный внутренний орган человека?", options: ["Лёгкие", "Мозг", "Печень", "Почка"], explain: "Печень — крупнейший внутренний орган." },
    uk: { q: "Який найбільший внутрішній орган людини?", options: ["Легені", "Мозок", "Печінка", "Нирка"], explain: "Печінка — найбільший внутрішній орган." }
  },
  gqm_006: {
    ru: { q: "Какие клетки крови в основном переносят кислород?", options: ["Лейкоциты", "Тромбоциты", "Эритроциты", "Плазматические клетки"], explain: "Эритроциты переносят кислород благодаря гемоглобину." },
    uk: { q: "Які клітини крові переважно переносять кисень?", options: ["Лейкоцити", "Тромбоцити", "Еритроцити", "Плазматичні клітини"], explain: "Еритроцити переносять кисень завдяки гемоглобіну." }
  },
  gqm_007: {
    ru: { q: "Какой витамин вырабатывается в коже под действием солнца?", options: ["Витамин A", "Витамин C", "Витамин D", "Витамин K"], explain: "Солнечный свет помогает организму синтезировать витамин D." },
    uk: { q: "Який вітамін синтезується в шкірі під дією сонця?", options: ["Вітамін A", "Вітамін C", "Вітамін D", "Вітамін K"], explain: "Сонячне світло допомагає організму синтезувати вітамін D." }
  },
  gqm_008: {
    ru: { q: "Как называется процесс испарения воды листьями растений?", options: ["Фотосинтез", "Дыхание", "Транспирация", "Опыление"], explain: "Транспирация — это испарение воды через устьица листьев." },
    uk: { q: "Як називається процес випаровування води листям рослин?", options: ["Фотосинтез", "Дихання", "Транспірація", "Запилення"], explain: "Транспірація — це випаровування води через продихи листка." }
  },
  gqm_009: {
    ru: { q: "Какая единица СИ используется для сопротивления?", options: ["Вольт", "Ампер", "Ватт", "Ом"], explain: "Электрическое сопротивление измеряется в омах." },
    uk: { q: "Яка одиниця SI використовується для опору?", options: ["Вольт", "Ампер", "Ват", "Ом"], explain: "Електричний опір вимірюється в омах." }
  },
  gqm_010: {
    ru: { q: "Скорость света в вакууме ближе всего к:", options: ["30 000 км/с", "300 000 км/с", "3 000 км/с", "3 000 000 км/с"], explain: "Скорость света примерно 299 792 км/с." },
    uk: { q: "Швидкість світла у вакуумі найближча до:", options: ["30 000 км/с", "300 000 км/с", "3 000 км/с", "3 000 000 км/с"], explain: "Швидкість світла приблизно 299 792 км/с." }
  },
  gqm_011: {
    ru: { q: "Какая река самая длинная в Южной Америке?", options: ["Парана", "Ориноко", "Амазонка", "Магдалена"], explain: "Амазонка — самая длинная река Южной Америки." },
    uk: { q: "Яка річка найдовша в Південній Америці?", options: ["Парана", "Ориноко", "Амазонка", "Магдалена"], explain: "Амазонка — найдовша річка Південної Америки." }
  },
  gqm_012: {
    ru: { q: "Столица Канады:", options: ["Торонто", "Оттава", "Монреаль", "Ванкувер"], explain: "Столица Канады — Оттава." },
    uk: { q: "Столиця Канади:", options: ["Торонто", "Оттава", "Монреаль", "Ванкувер"], explain: "Столиця Канади — Оттава." }
  },
  gqm_013: {
    ru: { q: "Какие горы разделяют Францию и Испанию?", options: ["Альпы", "Анды", "Пиренеи", "Карпаты"], explain: "Пиренеи образуют естественную границу между странами." },
    uk: { q: "Які гори розділяють Францію та Іспанію?", options: ["Альпи", "Анди", "Піренеї", "Карпати"], explain: "Піренеї утворюють природний кордон між цими країнами." }
  },
  gqm_014: {
    ru: { q: "Какую страну часто считают лидером по количеству островов?", options: ["Индонезия", "Филиппины", "Норвегия", "Швеция"], explain: "Швецию часто указывают как страну с наибольшим числом островов." },
    uk: { q: "Яку країну часто вважають лідером за кількістю островів?", options: ["Індонезія", "Філіппіни", "Норвегія", "Швеція"], explain: "Швецію часто називають країною з найбільшою кількістю островів." }
  },
  gqm_015: {
    ru: { q: "Какая пустыня находится в Северной Африке?", options: ["Гоби", "Калахари", "Сахара", "Атакама"], explain: "Сахара расположена в Северной Африке." },
    uk: { q: "Яка пустеля розташована в Північній Африці?", options: ["Гобі", "Калахарі", "Сахара", "Атакама"], explain: "Сахара розташована в Північній Африці." }
  },
  gqm_016: {
    ru: { q: "Линия долготы 0° называется:", options: ["Экватор", "Нулевой меридиан", "Тропик Рака", "Линия перемены дат"], explain: "0° долготы — это нулевой (главный) меридиан." },
    uk: { q: "Лінія довготи 0° називається:", options: ["Екватор", "Нульовий меридіан", "Тропік Рака", "Лінія зміни дат"], explain: "0° довготи — це нульовий (головний) меридіан." }
  },
  gqm_017: {
    ru: { q: "Какой океан расположен между Африкой и Австралией?", options: ["Атлантический", "Тихий", "Северный Ледовитый", "Индийский"], explain: "Между Африкой и Австралией находится Индийский океан." },
    uk: { q: "Який океан розташований між Африкою та Австралією?", options: ["Атлантичний", "Тихий", "Північний Льодовитий", "Індійський"], explain: "Між Африкою та Австралією розташований Індійський океан." }
  },
  gqm_018: {
    ru: { q: "Какая валюта используется в Японии?", options: ["Вона", "Юань", "Иена", "Ринггит"], explain: "В Японии используется иена." },
    uk: { q: "Яка валюта використовується в Японії?", options: ["Вона", "Юань", "Єна", "Рингіт"], explain: "У Японії використовується єна." }
  },
  gqm_019: {
    ru: { q: "Какая страна самая большая в Южной Америке по площади?", options: ["Аргентина", "Перу", "Бразилия", "Колумбия"], explain: "Бразилия — крупнейшая страна Южной Америки по площади." },
    uk: { q: "Яка країна найбільша в Південній Америці за площею?", options: ["Аргентина", "Перу", "Бразилія", "Колумбія"], explain: "Бразилія — найбільша країна Південної Америки за площею." }
  },
  gqm_020: {
    ru: { q: "Какой город известен как «город каналов»?", options: ["Амстердам", "Копенгаген", "Бангкок", "Венеция"], explain: "Венеция всемирно известна своими каналами." },
    uk: { q: "Яке місто відоме як «місто каналів»?", options: ["Амстердам", "Копенгаген", "Бангкок", "Венеція"], explain: "Венеція всесвітньо відома своїми каналами." }
  },
  gqm_021: {
    ru: { q: "Какой протокол используется для защищённых сайтов?", options: ["HTTP", "FTP", "HTTPS", "SMTP"], explain: "HTTPS — это HTTP с шифрованием." },
    uk: { q: "Який протокол використовується для захищених сайтів?", options: ["HTTP", "FTP", "HTTPS", "SMTP"], explain: "HTTPS — це HTTP із шифруванням." }
  },
  gqm_022: {
    ru: { q: "Число 10 в двоичной системе:", options: ["1001", "1010", "1100", "1110"], explain: "Десятичное 10 равно двоичному 1010." },
    uk: { q: "Число 10 у двійковій системі:", options: ["1001", "1010", "1100", "1110"], explain: "Десяткове 10 дорівнює двійковому 1010." }
  },
  gqm_023: {
    ru: { q: "Кто создал язык программирования Python?", options: ["Бьёрн Страуструп", "Гвидо ван Россум", "Деннис Ритчи", "Джеймс Гослинг"], explain: "Python создал Гвидо ван Россум." },
    uk: { q: "Хто створив мову програмування Python?", options: ["Бʼярне Страуструп", "Гвідо ван Россум", "Денніс Рітчі", "Джеймс Гослінг"], explain: "Python створив Гвідо ван Россум." }
  },
  gqm_024: {
    ru: { q: "Что означает RAM?", options: ["Модуль чтения доступа", "Оперативная память", "Активная память выполнения", "Быстрый прикладной метод"], explain: "RAM — это оперативная память." },
    uk: { q: "Що означає RAM?", options: ["Модуль доступу для читання", "Оперативна пам'ять", "Активна пам'ять виконання", "Швидкий прикладний метод"], explain: "RAM — це оперативна пам'ять." }
  },
  gqm_025: {
    ru: { q: "Главная цель двухфакторной аутентификации (2FA):", options: ["Ускорить вход", "Снизить расход памяти", "Добавить второй уровень проверки", "Шифровать скриншоты"], explain: "2FA добавляет второй шаг и повышает безопасность аккаунта." },
    uk: { q: "Головна мета двофакторної автентифікації (2FA):", options: ["Прискорити вхід", "Зменшити використання пам'яті", "Додати другий рівень перевірки", "Шифрувати скриншоти"], explain: "2FA додає другий крок і підвищує безпеку акаунта." }
  },
  gqm_026: {
    ru: { q: "Linux лучше всего описывается как:", options: ["Веб-браузер", "База данных", "Семейство ОС на базе ядра", "Формат изображения"], explain: "Linux — это ядро, на базе которого построено много дистрибутивов ОС." },
    uk: { q: "Linux найточніше описується як:", options: ["Веб-браузер", "База даних", "Сімейство ОС на базі ядра", "Формат зображення"], explain: "Linux — це ядро, на базі якого створено багато дистрибутивів ОС." }
  },
  gqm_027: {
    ru: { q: "Какое расширение обычно у ZIP-архивов?", options: [".rar", ".7z", ".zip", ".tar.gz"], explain: "ZIP-архивы обычно имеют расширение .zip." },
    uk: { q: "Яке розширення зазвичай мають ZIP-архіви?", options: [".rar", ".7z", ".zip", ".tar.gz"], explain: "ZIP-архіви зазвичай мають розширення .zip." }
  },
  gqm_028: {
    ru: { q: "Облачные вычисления — это в первую очередь:", options: ["Работа только на ноутбуках", "Запуск сервисов на удалённых серверах", "Только зашифрованный чат", "Оффлайн-обработка данных"], explain: "Облачные сервисы работают на удалённой инфраструктуре." },
    uk: { q: "Хмарні обчислення — це насамперед:", options: ["Робота лише на ноутбуках", "Запуск сервісів на віддалених серверах", "Лише зашифрований чат", "Офлайн-обробка даних"], explain: "Хмарні сервіси працюють на віддаленій інфраструктурі." }
  },
  gqm_029: {
    ru: { q: "SQL в основном используется для:", options: ["Редактирования фото", "Запросов и управления реляционными данными", "Компиляции Java-кода", "Сжатия видео"], explain: "SQL — стандартный язык для реляционных баз данных." },
    uk: { q: "SQL здебільшого використовується для:", options: ["Редагування фото", "Запитів і керування реляційними даними", "Компіляції Java-коду", "Стиснення відео"], explain: "SQL — стандартна мова для реляційних баз даних." }
  },
  gqm_030: {
    ru: { q: "Фишинг — это:", options: ["Стратегия резервного копирования", "Метод охлаждения", "Социальная атака для кражи данных", "Проверка файловой системы"], explain: "Фишинг обманом заставляет раскрыть личные данные." },
    uk: { q: "Фішинг — це:", options: ["Стратегія резервного копіювання", "Метод охолодження", "Соціальна атака для викрадення даних", "Перевірка файлової системи"], explain: "Фішинг обманом змушує користувача розкрити особисті дані." }
  },
  gqm_031: {
    ru: { q: "Где в основном происходит фотосинтез у растений?", options: ["Митохондрии", "Ядро", "Хлоропласты", "Вакуоли"], explain: "Хлоропласты содержат хлорофилл, необходимый для фотосинтеза." },
    uk: { q: "Де переважно відбувається фотосинтез у рослин?", options: ["Мітохондрії", "Ядро", "Хлоропласти", "Вакуолі"], explain: "Хлоропласти містять хлорофіл, необхідний для фотосинтезу." }
  },
  gqm_032: {
    ru: { q: "Какой слой атмосферы помогает поглощать вредное УФ-излучение?", options: ["Тропосфера", "Мезосфера", "Озоновый слой в стратосфере", "Ионосфера"], explain: "Озон в стратосфере поглощает значительную часть УФ-лучей." },
    uk: { q: "Який шар атмосфери допомагає поглинати шкідливе УФ-випромінювання?", options: ["Тропосфера", "Мезосфера", "Озоновий шар у стратосфері", "Іоносфера"], explain: "Озон у стратосфері поглинає значну частину УФ-випромінювання." }
  },
  gqm_033: {
    ru: { q: "Какой источник энергии является возобновляемым?", options: ["Уголь", "Природный газ", "Ветер", "Дизель"], explain: "Ветроэнергия относится к возобновляемым источникам." },
    uk: { q: "Яке джерело енергії є відновлюваним?", options: ["Вугілля", "Природний газ", "Вітер", "Дизель"], explain: "Вітроенергія належить до відновлюваних джерел." }
  },
  gqm_034: {
    ru: { q: "Какое животное сейчас считается самым большим на Земле?", options: ["Африканский слон", "Синий кит", "Китовая акула", "Жираф"], explain: "Синий кит — крупнейшее из известных ныне живущих животных." },
    uk: { q: "Яка тварина нині вважається найбільшою на Землі?", options: ["Африканський слон", "Синій кит", "Китова акула", "Жирафа"], explain: "Синій кит — найбільша відома нині жива тварина." }
  },
  gqm_035: {
    ru: { q: "Пчёлы особенно важны для:", options: ["Эрозии почвы", "Опыления", "Формирования горных пород", "Океанических течений"], explain: "Многие сельскохозяйственные культуры зависят от опыления пчёлами." },
    uk: { q: "Бджоли особливо важливі для:", options: ["Ерозії ґрунту", "Запилення", "Формування гірських порід", "Океанічних течій"], explain: "Багато сільськогосподарських культур залежать від запилення бджолами." }
  },
  gqm_036: {
    ru: { q: "Какой газ сильно влияет на современное парниковое потепление?", options: ["Гелий", "Углекислый газ", "Неон", "Водород"], explain: "CO2 — один из ключевых парниковых газов, связанных с сжиганием топлива." },
    uk: { q: "Який газ суттєво впливає на сучасне парникове потепління?", options: ["Гелій", "Вуглекислий газ", "Неон", "Водень"], explain: "CO2 — один із ключових парникових газів, пов'язаних зі спалюванням палива." }
  },
  gqm_037: {
    ru: { q: "Метаморфоз у насекомых — это:", options: ["Зимняя миграция", "Только смена окраса", "Развитие от личинки до взрослой формы", "Строительство гнезда"], explain: "Метаморфоз — это поэтапное превращение организма." },
    uk: { q: "Метаморфоз у комах — це:", options: ["Зимова міграція", "Лише зміна забарвлення", "Розвиток від личинки до дорослої форми", "Будівництво гнізда"], explain: "Метаморфоз — це поетапне перетворення організму." }
  },
  gqm_038: {
    ru: { q: "Коралловые рифы обычно процветают в:", options: ["Холодной глубокой воде", "Тёплой мелкой воде", "Пресных озёрах", "Полярных морях"], explain: "Большинство рифообразующих кораллов предпочитают тёплые мелководья." },
    uk: { q: "Коралові рифи зазвичай процвітають у:", options: ["Холодній глибокій воді", "Теплій мілкій воді", "Прісних озерах", "Полярних морях"], explain: "Більшість рифоутворювальних коралів віддають перевагу теплим мілководдям." }
  },
  gqm_039: {
    ru: { q: "В каком виде спорта используется термин «love»?", options: ["Бадминтон", "Теннис", "Волейбол", "Настольный теннис"], explain: "В теннисе слово love означает ноль очков." },
    uk: { q: "У якому виді спорту використовується термін «love»?", options: ["Бадмінтон", "Теніс", "Волейбол", "Настільний теніс"], explain: "У тенісі слово love означає нуль очок." }
  },
  gqm_040: {
    ru: { q: "Официальная длина марафона:", options: ["40 км", "41,5 км", "42,195 км", "45 км"], explain: "Стандартная дистанция марафона — 42,195 км." },
    uk: { q: "Офіційна довжина марафону:", options: ["40 км", "41,5 км", "42,195 км", "45 км"], explain: "Стандартна дистанція марафону — 42,195 км." }
  },
  gqm_041: {
    ru: { q: "Сколько колец на олимпийском символе?", options: ["4", "5", "6", "7"], explain: "Олимпийский символ состоит из пяти колец." },
    uk: { q: "Скільки кілець на олімпійському символі?", options: ["4", "5", "6", "7"], explain: "Олімпійський символ складається з п'яти кілець." }
  },
  gqm_042: {
    ru: { q: "В какой стране возникло дзюдо?", options: ["Китай", "Южная Корея", "Япония", "Таиланд"], explain: "Дзюдо было основано в Японии." },
    uk: { q: "У якій країні виникло дзюдо?", options: ["Китай", "Південна Корея", "Японія", "Таїланд"], explain: "Дзюдо було засноване в Японії." }
  },
  gqm_043: {
    ru: { q: "Кто написал роман «1984»?", options: ["Олдос Хаксли", "Джордж Оруэлл", "Рэй Брэдбери", "Дж. Р. Р. Толкин"], explain: "Роман «1984» написал Джордж Оруэлл." },
    uk: { q: "Хто написав роман «1984»?", options: ["Олдос Гакслі", "Джордж Орвелл", "Рей Бредбері", "Дж. Р. Р. Толкін"], explain: "Роман «1984» написав Джордж Орвелл." }
  },
  gqm_044: {
    ru: { q: "Кто написал картину «Мона Лиза»?", options: ["Микеланджело", "Рафаэль", "Леонардо да Винчи", "Донателло"], explain: "«Мону Лизу» написал Леонардо да Винчи." },
    uk: { q: "Хто створив картину «Мона Ліза»?", options: ["Мікеланджело", "Рафаель", "Леонардо да Вінчі", "Донателло"], explain: "«Мону Лізу» створив Леонардо да Вінчі." }
  },
  gqm_045: {
    ru: { q: "Какой язык имеет наибольшее число носителей?", options: ["Английский", "Испанский", "Хинди", "Китайский (мандарин)"], explain: "Китайский (мандарин) имеет самое большое число носителей." },
    uk: { q: "Яка мова має найбільшу кількість носіїв?", options: ["Англійська", "Іспанська", "Гінді", "Китайська (мандарин)"], explain: "Китайська (мандарин) має найбільшу кількість носіїв." }
  },
  gqm_046: {
    ru: { q: "Сколько клавиш у стандартного пианино?", options: ["76", "81", "88", "96"], explain: "У полноразмерного современного пианино 88 клавиш." },
    uk: { q: "Скільки клавіш має стандартне піаніно?", options: ["76", "81", "88", "96"], explain: "Повнорозмірне сучасне піаніно має 88 клавіш." }
  },
  gqm_047: {
    ru: { q: "В какой пьесе Шекспира есть Розенкранц и Гильденстерн?", options: ["Макбет", "Гамлет", "Отелло", "Король Лир"], explain: "Эти персонажи появляются в пьесе «Гамлет»." },
    uk: { q: "У якій п'єсі Шекспіра з'являються Розенкранц і Гільденстерн?", options: ["Макбет", "Гамлет", "Отелло", "Король Лір"], explain: "Ці персонажі з'являються у п'єсі «Гамлет»." }
  },
  gqm_048: {
    ru: { q: "Какое из древних чудес света сохранилось до наших дней?", options: ["Висячие сады Вавилона", "Александрийский маяк", "Пирамида Хеопса в Гизе", "Храм Артемиды"], explain: "До наших дней сохранилась только Великая пирамида в Гизе." },
    uk: { q: "Яке з давніх чудес світу збереглося донині?", options: ["Висячі сади Вавилона", "Олександрійський маяк", "Велика піраміда в Гізі", "Храм Артеміди"], explain: "До наших днів збереглася лише Велика піраміда в Гізі." }
  },
  gqm_049: {
    ru: { q: "Дивали чаще всего называют праздником:", options: ["Урожая", "Огней", "Дождя", "Весны"], explain: "Дивали широко известен как Фестиваль огней." },
    uk: { q: "Дівалі найчастіше називають святом:", options: ["Врожаю", "Вогнів", "Дощу", "Весни"], explain: "Дівалі широко відомий як Фестиваль вогнів." }
  },
  gqm_050: {
    ru: { q: "Кто первым ступил на Луну?", options: ["Юрий Гагарин", "Нил Армстронг", "Базз Олдрин", "Майкл Коллинз"], explain: "Нил Армстронг первым вышел на поверхность Луны в 1969 году." },
    uk: { q: "Хто першим ступив на Місяць?", options: ["Юрій Гагарін", "Ніл Армстронг", "Базз Олдрін", "Майкл Коллінз"], explain: "Ніл Армстронг першим вийшов на поверхню Місяця у 1969 році." }
  }
};

function mediumRowsToCatalog(rows) {
  return rows.map((x) => ({
    id: String(x.id),
    text: {
      en: String(x.q),
      ru: String(GENERAL_QUIZ_MEDIUM_I18N?.[x.id]?.ru?.q || x.q),
      uk: String(GENERAL_QUIZ_MEDIUM_I18N?.[x.id]?.uk?.q || x.q)
    },
    options: {
      en: Array.isArray(x.options) ? x.options.map((o) => String(o)) : [],
      ru: Array.isArray(GENERAL_QUIZ_MEDIUM_I18N?.[x.id]?.ru?.options)
        ? GENERAL_QUIZ_MEDIUM_I18N[x.id].ru.options.map((o) => String(o))
        : (Array.isArray(x.options) ? x.options.map((o) => String(o)) : []),
      uk: Array.isArray(GENERAL_QUIZ_MEDIUM_I18N?.[x.id]?.uk?.options)
        ? GENERAL_QUIZ_MEDIUM_I18N[x.id].uk.options.map((o) => String(o))
        : (Array.isArray(x.options) ? x.options.map((o) => String(o)) : [])
    },
    correct: Number(x.correct) || 0,
    explain: {
      en: String(x.explain || ""),
      ru: String(GENERAL_QUIZ_MEDIUM_I18N?.[x.id]?.ru?.explain || x.explain || ""),
      uk: String(GENERAL_QUIZ_MEDIUM_I18N?.[x.id]?.uk?.explain || x.explain || "")
    }
  }));
}

const GENERAL_QUIZ_HARD_EN = [
  { id: "gqh_001", q: "Which SI base unit measures amount of substance?", options: ["Mole", "Candela", "Kelvin", "Tesla"], correct: 0, explain: "Amount of substance is measured in moles." },
  { id: "gqh_002", q: "What is the atomic number of tungsten (W)?", options: ["72", "73", "74", "75"], correct: 2, explain: "Tungsten has atomic number 74." },
  { id: "gqh_003", q: "Which cell organelle is primarily responsible for ATP production?", options: ["Ribosome", "Mitochondrion", "Golgi apparatus", "Lysosome"], correct: 1, explain: "Mitochondria are the main ATP producers." },
  { id: "gqh_004", q: "In genetics, which base pairs with guanine in DNA?", options: ["Adenine", "Thymine", "Uracil", "Cytosine"], correct: 3, explain: "Guanine pairs with cytosine in DNA." },
  { id: "gqh_005", q: "Which law states that pressure and volume of a gas are inversely proportional at constant temperature?", options: ["Boyle's law", "Charles's law", "Avogadro's law", "Gay-Lussac's law"], correct: 0, explain: "Boyle's law describes inverse P-V behavior." },
  { id: "gqh_006", q: "What is the SI unit of electric capacitance?", options: ["Henry", "Farad", "Weber", "Siemens"], correct: 1, explain: "Capacitance is measured in farads." },
  { id: "gqh_007", q: "Which planet has the largest moon in the Solar System?", options: ["Saturn", "Jupiter", "Neptune", "Uranus"], correct: 1, explain: "Jupiter's moon Ganymede is the largest." },
  { id: "gqh_008", q: "What is the term for a star's explosive death that can briefly outshine a galaxy?", options: ["Nebula", "Quasar", "Supernova", "Pulsar"], correct: 2, explain: "A supernova is a stellar explosion." },
  { id: "gqh_009", q: "Which atmospheric layer contains most weather phenomena?", options: ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"], correct: 0, explain: "Most weather occurs in the troposphere." },
  { id: "gqh_010", q: "The Coriolis effect is caused by:", options: ["Earth's magnetic field", "Earth's rotation", "Ocean salinity", "Solar wind"], correct: 1, explain: "The Coriolis effect comes from Earth's rotation." },
  { id: "gqh_011", q: "Which ocean current strongly influences Western Europe's climate?", options: ["California Current", "Benguela Current", "Gulf Stream", "Peru Current"], correct: 2, explain: "The Gulf Stream transports warm water northward." },
  { id: "gqh_012", q: "Which country has the largest land area entirely in the Southern Hemisphere?", options: ["Australia", "Argentina", "South Africa", "Indonesia"], correct: 0, explain: "Australia is the largest fully Southern Hemisphere country." },
  { id: "gqh_013", q: "What is the longest mountain range on land?", options: ["Himalayas", "Rockies", "Andes", "Alps"], correct: 2, explain: "The Andes are the longest continental mountain range." },
  { id: "gqh_014", q: "Which strait separates Asia and North America?", options: ["Strait of Gibraltar", "Bering Strait", "Strait of Malacca", "Bosporus"], correct: 1, explain: "The Bering Strait divides Asia and North America." },
  { id: "gqh_015", q: "What is the approximate bit length of an IPv6 address?", options: ["32 bits", "64 bits", "128 bits", "256 bits"], correct: 2, explain: "IPv6 addresses are 128 bits." },
  { id: "gqh_016", q: "Which data structure typically supports O(1) average-time key lookup?", options: ["Array", "Linked list", "Hash table", "Binary tree"], correct: 2, explain: "Hash tables provide average O(1) lookup." },
  { id: "gqh_017", q: "Binary search requires the input data to be:", options: ["Unique", "Sorted", "Numeric", "Balanced"], correct: 1, explain: "Binary search works correctly on sorted data." },
  { id: "gqh_018", q: "Which sorting algorithm has O(n log n) average complexity and is stable in its common implementation?", options: ["Merge sort", "Selection sort", "Bubble sort", "Insertion sort"], correct: 0, explain: "Merge sort is stable and O(n log n) on average." },
  { id: "gqh_019", q: "In relational databases, a FOREIGN KEY is used to:", options: ["Encrypt a column", "Index text search", "Enforce referential integrity", "Increase RAM usage"], correct: 2, explain: "Foreign keys enforce relationships between tables." },
  { id: "gqh_020", q: "What does TLS primarily provide for network communication?", options: ["Compression only", "Encryption and integrity", "Physical routing", "Database replication"], correct: 1, explain: "TLS secures data with encryption and integrity checks." },
  { id: "gqh_021", q: "Who composed The Four Seasons?", options: ["Bach", "Mozart", "Vivaldi", "Beethoven"], correct: 2, explain: "The Four Seasons was composed by Antonio Vivaldi." },
  { id: "gqh_022", q: "Which art movement is Salvador Dali most associated with?", options: ["Cubism", "Surrealism", "Impressionism", "Baroque"], correct: 1, explain: "Dali is a major figure of Surrealism." },
  { id: "gqh_023", q: "The novel One Hundred Years of Solitude was written by:", options: ["Pablo Neruda", "Gabriel Garcia Marquez", "Mario Vargas Llosa", "Jorge Luis Borges"], correct: 1, explain: "The novel is by Gabriel Garcia Marquez." },
  { id: "gqh_024", q: "Which language family does Hungarian belong to?", options: ["Slavic", "Romance", "Uralic", "Germanic"], correct: 2, explain: "Hungarian is part of the Uralic family." },
  { id: "gqh_025", q: "In economics, inflation means:", options: ["A fall in overall prices", "A rise in overall price levels", "A rise in unemployment only", "A stronger currency by definition"], correct: 1, explain: "Inflation is a sustained increase in general prices." },
  { id: "gqh_026", q: "GDP at market prices measures:", options: ["Only exports", "Total value of final goods and services produced domestically", "Only government spending", "Only household income"], correct: 1, explain: "GDP sums domestic final output value." },
  { id: "gqh_027", q: "Compound interest differs from simple interest because it is calculated on:", options: ["Principal only", "Principal plus accumulated interest", "Inflation only", "Tax-adjusted principal only"], correct: 1, explain: "Compound interest includes prior interest in the base." },
  { id: "gqh_028", q: "Which instrument is typically used by central banks for short-term policy signaling?", options: ["Policy interest rate", "Corporate tax rate", "Import tariff", "Sales tax"], correct: 0, explain: "Central banks usually signal through policy rates." },
  { id: "gqh_029", q: "Which blood vessel carries oxygenated blood from lungs to the heart?", options: ["Pulmonary artery", "Pulmonary vein", "Aorta", "Vena cava"], correct: 1, explain: "Pulmonary veins return oxygenated blood to the heart." },
  { id: "gqh_030", q: "What is the normal diploid number of chromosomes in humans?", options: ["23", "44", "46", "48"], correct: 2, explain: "Humans have 46 chromosomes in diploid cells." },
  { id: "gqh_031", q: "Insulin is primarily produced by which organ?", options: ["Liver", "Pancreas", "Kidney", "Spleen"], correct: 1, explain: "Insulin is produced by pancreatic beta cells." },
  { id: "gqh_032", q: "Which pathogen class includes organisms like Plasmodium?", options: ["Virus", "Bacterium", "Protozoan", "Prion"], correct: 2, explain: "Plasmodium is a protozoan parasite." },
  { id: "gqh_033", q: "What is the main purpose of a control group in an experiment?", options: ["To increase sample bias", "To provide a baseline for comparison", "To randomize questions", "To maximize variance"], correct: 1, explain: "A control group provides a baseline condition." },
  { id: "gqh_034", q: "A p-value in hypothesis testing is best interpreted as:", options: ["Probability that the null is true", "Probability of obtaining data at least as extreme under the null", "Chance the experiment was random", "Error rate after publication"], correct: 1, explain: "It quantifies extremeness assuming the null hypothesis." },
  { id: "gqh_035", q: "Which graph type is most appropriate for showing distribution shape of a continuous variable?", options: ["Pie chart", "Histogram", "Radar chart", "Sankey diagram"], correct: 1, explain: "Histograms show distribution of continuous data." },
  { id: "gqh_036", q: "In project management, a critical path is:", options: ["The cheapest task sequence", "The longest-duration path determining project completion time", "A backup plan", "The path with most team members"], correct: 1, explain: "Critical path sets the minimum project duration." },
  { id: "gqh_037", q: "Which protocol is primarily used for version control collaboration platforms like GitHub?", options: ["IMAP", "Git", "SNMP", "LDAP"], correct: 1, explain: "Git is the version control system used by such platforms." },
  { id: "gqh_038", q: "What does CI/CD stand for?", options: ["Code Inspection / Code Delivery", "Continuous Integration / Continuous Delivery", "Centralized Infrastructure / Centralized Deployment", "Controlled Iteration / Controlled Debugging"], correct: 1, explain: "CI/CD means Continuous Integration and Continuous Delivery." },
  { id: "gqh_039", q: "Which cyberattack attempts to overwhelm a service with massive traffic from many sources?", options: ["Phishing", "Ransomware", "DDoS", "SQL injection"], correct: 2, explain: "DDoS floods a target from distributed sources." },
  { id: "gqh_040", q: "Public key cryptography typically uses:", options: ["One shared secret key for both directions", "A key pair: public and private", "No keys", "Only biometric data"], correct: 1, explain: "Asymmetric crypto uses public/private key pairs." },
  { id: "gqh_041", q: "Which theorem links sides of a right triangle?", options: ["Fermat's Last Theorem", "Pythagorean theorem", "Bayes theorem", "Noether theorem"], correct: 1, explain: "The Pythagorean theorem links triangle side lengths." },
  { id: "gqh_042", q: "The derivative of sin(x) with respect to x is:", options: ["-sin(x)", "cos(x)", "-cos(x)", "tan(x)"], correct: 1, explain: "d/dx sin(x) = cos(x)." },
  { id: "gqh_043", q: "What is the value of pi rounded to 3 decimal places?", options: ["3.124", "3.142", "3.214", "3.412"], correct: 1, explain: "Pi rounded to three decimals is 3.142." },
  { id: "gqh_044", q: "If two events are independent, then P(A and B) equals:", options: ["P(A) + P(B)", "P(A) - P(B)", "P(A) * P(B)", "P(A) / P(B)"], correct: 2, explain: "For independent events, probabilities multiply." },
  { id: "gqh_045", q: "Which city hosts the headquarters of the United Nations?", options: ["Geneva", "Vienna", "New York", "Paris"], correct: 2, explain: "UN headquarters is in New York City." },
  { id: "gqh_046", q: "The international agreement focused on limiting global warming to well below 2 deg C is:", options: ["Kyoto Protocol", "Montreal Protocol", "Paris Agreement", "Geneva Convention"], correct: 2, explain: "The Paris Agreement sets this global climate goal." },
  { id: "gqh_047", q: "Which sea is shrinking rapidly due to river diversion projects in Central Asia?", options: ["Caspian Sea", "Aral Sea", "Black Sea", "Dead Sea"], correct: 1, explain: "The Aral Sea famously shrank due to water diversion." },
  { id: "gqh_048", q: "Which country has the most official time zones when overseas territories are included?", options: ["United States", "Russia", "France", "United Kingdom"], correct: 2, explain: "France spans the most time zones with overseas territories." },
  { id: "gqh_049", q: "The default branch name in many modern Git repositories is often:", options: ["master", "main", "trunk", "root"], correct: 1, explain: "Many repositories now use main as default." },
  { id: "gqh_050", q: "In machine learning, overfitting means a model:", options: ["Generalizes well to unseen data", "Learns noise and performs poorly on new data", "Uses too little training data by definition", "Always has high bias and low variance"], correct: 1, explain: "Overfitting captures noise and hurts generalization." }
];

const GENERAL_QUIZ_HARD_I18N = {
  gqh_001: {
    ru: { q: "Какая базовая единица СИ измеряет количество вещества?", options: ["Моль", "Кандела", "Кельвин", "Тесла"] },
    uk: { q: "Яка базова одиниця SI вимірює кількість речовини?", options: ["Моль", "Кандела", "Кельвін", "Тесла"] }
  },
  gqh_002: {
    ru: { q: "Какой атомный номер у вольфрама (W)?", options: ["72", "73", "74", "75"] },
    uk: { q: "Який атомний номер у вольфраму (W)?", options: ["72", "73", "74", "75"] }
  },
  gqh_003: {
    ru: { q: "Какая органелла клетки в первую очередь отвечает за выработку АТФ?", options: ["Рибосома", "Митохондрия", "Аппарат Гольджи", "Лизосома"] },
    uk: { q: "Яка органела клітини насамперед відповідає за вироблення АТФ?", options: ["Рибосома", "Мітохондрія", "Апарат Гольджі", "Лізосома"] }
  },
  gqh_004: {
    ru: { q: "В генетике какая азотистая база в ДНК спаривается с гуанином?", options: ["Аденин", "Тимин", "Урацил", "Цитозин"] },
    uk: { q: "У генетиці яка азотиста основа в ДНК спаровується з гуаніном?", options: ["Аденін", "Тимін", "Урацил", "Цитозин"] }
  },
  gqh_005: {
    ru: { q: "Какой закон говорит, что давление и объём газа обратно пропорциональны при постоянной температуре?", options: ["Закон Бойля", "Закон Шарля", "Закон Авогадро", "Закон Гей-Люссака"] },
    uk: { q: "Який закон стверджує, що тиск і об’єм газу обернено пропорційні за сталої температури?", options: ["Закон Бойля", "Закон Шарля", "Закон Авогадро", "Закон Гей-Люссака"] }
  },
  gqh_006: {
    ru: { q: "Какая единица СИ используется для измерения электрической ёмкости?", options: ["Генри", "Фарад", "Вебер", "Сименс"] },
    uk: { q: "Яка одиниця SI використовується для вимірювання електричної ємності?", options: ["Генрі", "Фарад", "Вебер", "Сіменс"] }
  },
  gqh_007: {
    ru: { q: "У какой планеты находится крупнейший спутник Солнечной системы?", options: ["Сатурн", "Юпитер", "Нептун", "Уран"] },
    uk: { q: "У якої планети є найбільший супутник Сонячної системи?", options: ["Сатурн", "Юпітер", "Нептун", "Уран"] }
  },
  gqh_008: {
    ru: { q: "Как называется взрывная гибель звезды, которая может ненадолго затмить целую галактику?", options: ["Туманность", "Квазар", "Сверхновая", "Пульсар"] },
    uk: { q: "Як називається вибухова загибель зорі, що може ненадовго затьмарити цілу галактику?", options: ["Туманність", "Квазар", "Наднова", "Пульсар"] }
  },
  gqh_009: {
    ru: { q: "В каком слое атмосферы происходит большинство погодных явлений?", options: ["Тропосфера", "Стратосфера", "Мезосфера", "Термосфера"] },
    uk: { q: "У якому шарі атмосфери відбувається більшість погодних явищ?", options: ["Тропосфера", "Стратосфера", "Мезосфера", "Термосфера"] }
  },
  gqh_010: {
    ru: { q: "Эффект Кориолиса вызван:", options: ["Магнитным полем Земли", "Вращением Земли", "Солёностью океана", "Солнечным ветром"] },
    uk: { q: "Ефект Коріоліса спричинений:", options: ["Магнітним полем Землі", "Обертанням Землі", "Солоністю океану", "Сонячним вітром"] }
  },
  gqh_011: {
    ru: { q: "Какое океаническое течение сильно влияет на климат Западной Европы?", options: ["Калифорнийское течение", "Бенгельское течение", "Гольфстрим", "Перуанское течение"] },
    uk: { q: "Яка океанічна течія сильно впливає на клімат Західної Європи?", options: ["Каліфорнійська течія", "Бенгельська течія", "Гольфстрім", "Перуанська течія"] }
  },
  gqh_012: {
    ru: { q: "Какая страна имеет наибольшую площадь и целиком находится в Южном полушарии?", options: ["Австралия", "Аргентина", "ЮАР", "Индонезия"] },
    uk: { q: "Яка країна має найбільшу площу і повністю розташована в Південній півкулі?", options: ["Австралія", "Аргентина", "ПАР", "Індонезія"] }
  },
  gqh_013: {
    ru: { q: "Какой горный хребет является самым длинным на суше?", options: ["Гималаи", "Скалистые горы", "Анды", "Альпы"] },
    uk: { q: "Який гірський хребет є найдовшим на суходолі?", options: ["Гімалаї", "Скелясті гори", "Анди", "Альпи"] }
  },
  gqh_014: {
    ru: { q: "Какой пролив разделяет Азию и Северную Америку?", options: ["Гибралтарский пролив", "Берингов пролив", "Малаккский пролив", "Босфор"] },
    uk: { q: "Яка протока розділяє Азію та Північну Америку?", options: ["Гібралтарська протока", "Берингова протока", "Малаккська протока", "Босфор"] }
  },
  gqh_015: {
    ru: { q: "Какова длина IPv6-адреса в битах?", options: ["32 бита", "64 бита", "128 бит", "256 бит"] },
    uk: { q: "Яка довжина IPv6-адреси в бітах?", options: ["32 біти", "64 біти", "128 біт", "256 біт"] }
  },
  gqh_016: {
    ru: { q: "Какая структура данных обычно поддерживает поиск по ключу со средней сложностью O(1)?", options: ["Массив", "Связный список", "Хеш-таблица", "Бинарное дерево"] },
    uk: { q: "Яка структура даних зазвичай підтримує пошук за ключем із середньою складністю O(1)?", options: ["Масив", "Зв’язний список", "Хеш-таблиця", "Бінарне дерево"] }
  },
  gqh_017: {
    ru: { q: "Для работы бинарного поиска входные данные должны быть:", options: ["Уникальными", "Отсортированными", "Числовыми", "Сбалансированными"] },
    uk: { q: "Щоб бінарний пошук працював коректно, вхідні дані мають бути:", options: ["Унікальними", "Відсортованими", "Числовими", "Збалансованими"] }
  },
  gqh_018: {
    ru: { q: "Какой алгоритм сортировки имеет среднюю сложность O(n log n) и стабилен в распространённой реализации?", options: ["Сортировка слиянием", "Сортировка выбором", "Пузырьковая сортировка", "Сортировка вставками"] },
    uk: { q: "Який алгоритм сортування має середню складність O(n log n) і є стабільним у типовій реалізації?", options: ["Сортування злиттям", "Сортування вибором", "Бульбашкове сортування", "Сортування вставками"] }
  },
  gqh_019: {
    ru: { q: "В реляционных базах данных FOREIGN KEY используется для:", options: ["Шифрования столбца", "Индексирования текстового поиска", "Поддержки ссылочной целостности", "Увеличения использования RAM"] },
    uk: { q: "У реляційних базах даних FOREIGN KEY використовується для:", options: ["Шифрування стовпця", "Індексування текстового пошуку", "Підтримки посилальної цілісності", "Збільшення використання RAM"] }
  },
  gqh_020: {
    ru: { q: "Что в первую очередь обеспечивает TLS в сетевом обмене?", options: ["Только сжатие", "Шифрование и целостность", "Физическую маршрутизацию", "Репликацию базы данных"] },
    uk: { q: "Що насамперед забезпечує TLS у мережевому обміні?", options: ["Лише стиснення", "Шифрування та цілісність", "Фізичну маршрутизацію", "Реплікацію бази даних"] }
  },
  gqh_021: {
    ru: { q: "Кто написал цикл Времена года?", options: ["Бах", "Моцарт", "Вивальди", "Бетховен"] },
    uk: { q: "Хто написав цикл Пори року?", options: ["Бах", "Моцарт", "Вівальді", "Бетховен"] }
  },
  gqh_022: {
    ru: { q: "С каким художественным направлением чаще всего связывают Сальвадора Дали?", options: ["Кубизм", "Сюрреализм", "Импрессионизм", "Барокко"] },
    uk: { q: "З яким мистецьким напрямом найчастіше пов’язують Сальвадора Далі?", options: ["Кубізм", "Сюрреалізм", "Імпресіонізм", "Бароко"] }
  },
  gqh_023: {
    ru: { q: "Роман Сто лет одиночества написал:", options: ["Пабло Неруда", "Габриэль Гарсиа Маркес", "Марио Варгас Льоса", "Хорхе Луис Борхес"] },
    uk: { q: "Роман Сто років самотності написав:", options: ["Пабло Неруда", "Габріель Гарсія Маркес", "Маріо Варгас Льоса", "Хорхе Луїс Борхес"] }
  },
  gqh_024: {
    ru: { q: "К какой языковой семье относится венгерский язык?", options: ["Славянская", "Романская", "Уральская", "Германская"] },
    uk: { q: "До якої мовної сім’ї належить угорська мова?", options: ["Слов’янська", "Романська", "Уральська", "Германська"] }
  },
  gqh_025: {
    ru: { q: "В экономике инфляция — это:", options: ["Падение общего уровня цен", "Рост общего уровня цен", "Только рост безработицы", "По определению усиление валюты"] },
    uk: { q: "В економіці інфляція — це:", options: ["Падіння загального рівня цін", "Зростання загального рівня цін", "Лише зростання безробіття", "За визначенням зміцнення валюти"] }
  },
  gqh_026: {
    ru: { q: "ВВП по рыночным ценам измеряет:", options: ["Только экспорт", "Общую стоимость конечных товаров и услуг, произведённых внутри страны", "Только госрасходы", "Только доход домохозяйств"] },
    uk: { q: "ВВП за ринковими цінами вимірює:", options: ["Лише експорт", "Загальну вартість кінцевих товарів і послуг, вироблених у межах країни", "Лише державні витрати", "Лише доходи домогосподарств"] }
  },
  gqh_027: {
    ru: { q: "Сложный процент отличается от простого тем, что начисляется на:", options: ["Только первоначальную сумму", "Первоначальную сумму плюс накопленные проценты", "Только инфляцию", "Только сумму после налогов"] },
    uk: { q: "Складний відсоток відрізняється від простого тим, що нараховується на:", options: ["Лише початкову суму", "Початкову суму плюс накопичені відсотки", "Лише інфляцію", "Лише суму після податків"] }
  },
  gqh_028: {
    ru: { q: "Какой инструмент обычно используют центральные банки для краткосрочных сигналов по политике?", options: ["Ключевая процентная ставка", "Ставка налога на прибыль", "Импортный тариф", "Налог с продаж"] },
    uk: { q: "Який інструмент зазвичай використовують центральні банки для короткострокових сигналів монетарної політики?", options: ["Ключова процентна ставка", "Ставка податку на прибуток", "Імпортний тариф", "Податок із продажів"] }
  },
  gqh_029: {
    ru: { q: "Какой сосуд несёт насыщенную кислородом кровь из лёгких к сердцу?", options: ["Лёгочная артерия", "Лёгочная вена", "Аорта", "Полая вена"] },
    uk: { q: "Яка судина несе насичену киснем кров із легень до серця?", options: ["Легенева артерія", "Легенева вена", "Аорта", "Порожниста вена"] }
  },
  gqh_030: {
    ru: { q: "Какое нормальное диплоидное число хромосом у человека?", options: ["23", "44", "46", "48"] },
    uk: { q: "Яке нормальне диплоїдне число хромосом у людини?", options: ["23", "44", "46", "48"] }
  },
  gqh_031: {
    ru: { q: "Инсулин в основном вырабатывается каким органом?", options: ["Печень", "Поджелудочная железа", "Почка", "Селезёнка"] },
    uk: { q: "Інсулін переважно виробляється яким органом?", options: ["Печінка", "Підшлункова залоза", "Нирка", "Селезінка"] }
  },
  gqh_032: {
    ru: { q: "К какому классу возбудителей относятся организмы вроде Plasmodium?", options: ["Вирус", "Бактерия", "Простейшие", "Прион"] },
    uk: { q: "До якого класу збудників належать організми на кшталт Plasmodium?", options: ["Вірус", "Бактерія", "Найпростіші", "Пріон"] }
  },
  gqh_033: {
    ru: { q: "Основная цель контрольной группы в эксперименте:", options: ["Увеличить смещение выборки", "Дать базовый уровень для сравнения", "Рандомизировать вопросы", "Максимизировать дисперсию"] },
    uk: { q: "Основна мета контрольної групи в експерименті:", options: ["Збільшити зміщення вибірки", "Дати базовий рівень для порівняння", "Рандомізувати запитання", "Максимізувати дисперсію"] }
  },
  gqh_034: {
    ru: { q: "P-value в проверке гипотез лучше всего интерпретируется как:", options: ["Вероятность, что нулевая гипотеза верна", "Вероятность получить такие же или более экстремальные данные при верной нулевой гипотезе", "Вероятность, что эксперимент случайный", "Уровень ошибки после публикации"] },
    uk: { q: "P-value у перевірці гіпотез найкраще інтерпретується як:", options: ["Ймовірність, що нульова гіпотеза правильна", "Ймовірність отримати такі ж або більш екстремальні дані за умови правильної нульової гіпотези", "Ймовірність, що експеримент випадковий", "Рівень помилки після публікації"] }
  },
  gqh_035: {
    ru: { q: "Какой график лучше всего подходит для показа формы распределения непрерывной переменной?", options: ["Круговая диаграмма", "Гистограмма", "Радар-график", "Диаграмма Санки"] },
    uk: { q: "Який графік найкраще підходить для показу форми розподілу неперервної змінної?", options: ["Кругова діаграма", "Гістограма", "Радар-діаграма", "Діаграма Санкі"] }
  },
  gqh_036: {
    ru: { q: "В управлении проектами критический путь — это:", options: ["Самая дешёвая последовательность задач", "Путь максимальной длительности, который определяет срок завершения проекта", "Резервный план", "Путь с максимальным числом участников"] },
    uk: { q: "В управлінні проєктами критичний шлях — це:", options: ["Найдешевша послідовність задач", "Шлях максимальної тривалості, що визначає строк завершення проєкту", "Резервний план", "Шлях із найбільшою кількістю учасників"] }
  },
  gqh_037: {
    ru: { q: "Какой протокол в первую очередь используется платформами совместной разработки версий, например GitHub?", options: ["IMAP", "Git", "SNMP", "LDAP"] },
    uk: { q: "Який протокол насамперед використовується платформами спільної розробки версій, як-от GitHub?", options: ["IMAP", "Git", "SNMP", "LDAP"] }
  },
  gqh_038: {
    ru: { q: "Что означает CI/CD?", options: ["Code Inspection / Code Delivery", "Continuous Integration / Continuous Delivery", "Centralized Infrastructure / Centralized Deployment", "Controlled Iteration / Controlled Debugging"] },
    uk: { q: "Що означає CI/CD?", options: ["Code Inspection / Code Delivery", "Continuous Integration / Continuous Delivery", "Centralized Infrastructure / Centralized Deployment", "Controlled Iteration / Controlled Debugging"] }
  },
  gqh_039: {
    ru: { q: "Какая кибератака пытается перегрузить сервис огромным трафиком из множества источников?", options: ["Фишинг", "Программа-вымогатель", "DDoS", "SQL-инъекция"] },
    uk: { q: "Яка кібератака намагається перевантажити сервіс величезним трафіком із багатьох джерел?", options: ["Фішинг", "Програма-вимагач", "DDoS", "SQL-ін’єкція"] }
  },
  gqh_040: {
    ru: { q: "Криптография с открытым ключом обычно использует:", options: ["Один общий секретный ключ в обе стороны", "Пару ключей: открытый и закрытый", "Вообще без ключей", "Только биометрические данные"] },
    uk: { q: "Криптографія з відкритим ключем зазвичай використовує:", options: ["Один спільний секретний ключ в обидва боки", "Пару ключів: відкритий і закритий", "Взагалі без ключів", "Лише біометричні дані"] }
  },
  gqh_041: {
    ru: { q: "Какая теорема связывает стороны прямоугольного треугольника?", options: ["Великая теорема Ферма", "Теорема Пифагора", "Теорема Байеса", "Теорема Нётер"] },
    uk: { q: "Яка теорема пов’язує сторони прямокутного трикутника?", options: ["Велика теорема Ферма", "Теорема Піфагора", "Теорема Байєса", "Теорема Нетер"] }
  },
  gqh_042: {
    ru: { q: "Производная sin(x) по x равна:", options: ["-sin(x)", "cos(x)", "-cos(x)", "tan(x)"] },
    uk: { q: "Похідна sin(x) за x дорівнює:", options: ["-sin(x)", "cos(x)", "-cos(x)", "tan(x)"] }
  },
  gqh_043: {
    ru: { q: "Чему равно число pi, округлённое до 3 знаков после запятой?", options: ["3.124", "3.142", "3.214", "3.412"] },
    uk: { q: "Чому дорівнює число pi, округлене до 3 знаків після коми?", options: ["3.124", "3.142", "3.214", "3.412"] }
  },
  gqh_044: {
    ru: { q: "Если два события независимы, то P(A и B) равно:", options: ["P(A) + P(B)", "P(A) - P(B)", "P(A) * P(B)", "P(A) / P(B)"] },
    uk: { q: "Якщо дві події незалежні, то P(A і B) дорівнює:", options: ["P(A) + P(B)", "P(A) - P(B)", "P(A) * P(B)", "P(A) / P(B)"] }
  },
  gqh_045: {
    ru: { q: "В каком городе находится штаб-квартира ООН?", options: ["Женева", "Вена", "Нью-Йорк", "Париж"] },
    uk: { q: "У якому місті розташована штаб-квартира ООН?", options: ["Женева", "Відень", "Нью-Йорк", "Париж"] }
  },
  gqh_046: {
    ru: { q: "Какое международное соглашение направлено на ограничение глобального потепления значительно ниже 2 deg C?", options: ["Киотский протокол", "Монреальский протокол", "Парижское соглашение", "Женевская конвенция"] },
    uk: { q: "Яка міжнародна угода спрямована на обмеження глобального потепління значно нижче 2 deg C?", options: ["Кіотський протокол", "Монреальський протокол", "Паризька угода", "Женевська конвенція"] }
  },
  gqh_047: {
    ru: { q: "Какое море быстро сокращается из-за проектов отвода рек в Центральной Азии?", options: ["Каспийское море", "Аральское море", "Чёрное море", "Мёртвое море"] },
    uk: { q: "Яке море швидко скорочується через проєкти відведення річок у Центральній Азії?", options: ["Каспійське море", "Аральське море", "Чорне море", "Мертве море"] }
  },
  gqh_048: {
    ru: { q: "Какая страна имеет больше всего официальных часовых поясов с учётом заморских территорий?", options: ["США", "Россия", "Франция", "Великобритания"] },
    uk: { q: "Яка країна має найбільше офіційних часових поясів з урахуванням заморських територій?", options: ["США", "Росія", "Франція", "Велика Британія"] }
  },
  gqh_049: {
    ru: { q: "Название основной ветки по умолчанию во многих современных Git-репозиториях чаще всего:", options: ["master", "main", "trunk", "root"] },
    uk: { q: "Назва основної гілки за замовчуванням у багатьох сучасних Git-репозиторіях найчастіше:", options: ["master", "main", "trunk", "root"] }
  },
  gqh_050: {
    ru: { q: "В машинном обучении переобучение (overfitting) означает, что модель:", options: ["Хорошо обобщает на новых данных", "Запоминает шум и плохо работает на новых данных", "По определению использует слишком мало обучающих данных", "Всегда имеет высокий bias и низкую variance"] },
    uk: { q: "У машинному навчанні перенавчання (overfitting) означає, що модель:", options: ["Добре узагальнює на нових даних", "Запам’ятовує шум і погано працює на нових даних", "За визначенням використовує занадто мало тренувальних даних", "Завжди має високий bias і низьку variance"] }
  }
};

function hardRowsToCatalog(rows) {
  return rows.map((x) => ({
    id: String(x.id),
    text: {
      en: String(x.q),
      ru: String(GENERAL_QUIZ_HARD_I18N?.[x.id]?.ru?.q || x.q),
      uk: String(GENERAL_QUIZ_HARD_I18N?.[x.id]?.uk?.q || x.q)
    },
    options: {
      en: Array.isArray(x.options) ? x.options.map((o) => String(o)) : [],
      ru: Array.isArray(GENERAL_QUIZ_HARD_I18N?.[x.id]?.ru?.options)
        ? GENERAL_QUIZ_HARD_I18N[x.id].ru.options.map((o) => String(o))
        : (Array.isArray(x.options) ? x.options.map((o) => String(o)) : []),
      uk: Array.isArray(GENERAL_QUIZ_HARD_I18N?.[x.id]?.uk?.options)
        ? GENERAL_QUIZ_HARD_I18N[x.id].uk.options.map((o) => String(o))
        : (Array.isArray(x.options) ? x.options.map((o) => String(o)) : [])
    },
    correct: Number(x.correct) || 0,
    explain: {
      en: String(x.explain || ""),
      ru: String(GENERAL_QUIZ_HARD_I18N?.[x.id]?.ru?.explain || x.explain || ""),
      uk: String(GENERAL_QUIZ_HARD_I18N?.[x.id]?.uk?.explain || x.explain || "")
    }
  }));
}

export function buildGeneralQuizCatalogByDifficulty(difficulty = "easy") {
  const d = String(difficulty || "").toLowerCase();
  if (d === "medium") {
    return mediumRowsToCatalog(GENERAL_QUIZ_MEDIUM_EN);
  }
  if (d === "hard") {
    return hardRowsToCatalog(GENERAL_QUIZ_HARD_EN);
  }
  return buildGeneralQuizCatalog();
}
