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

export function buildGeneralQuizCatalogByDifficulty(difficulty = "easy") {
  const d = String(difficulty || "").toLowerCase();
  if (d === "medium") {
    return mediumRowsToCatalog(GENERAL_QUIZ_MEDIUM_EN);
  }
  // For now: easy and hard use existing catalog.
  return buildGeneralQuizCatalog();
}
