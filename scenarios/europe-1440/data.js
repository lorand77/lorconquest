// Geography of the Europe 1440 scenario, in real latitude and longitude (degrees north, east).
// tools/make-base.js projects it onto the map (`node tools/make-base.js scenarios/europe-1440`). One map unit is about 2.4 km:
// Europe from Ireland and Portugal to Moscow and Anatolia, from the North Cape to the coast of North Africa, as one rectangle.
// Settlements follow the people of 1440 — one for about 180,000 — so the empty north and east have few (docs: the plan of
// this map in experiments/README.md is not it; see SCENARIO.md, Design notes, once written).

const NAME = "EUROPE 1440";
// Lambert conformal conic for the whole of Europe: standard parallels 38 and 62 N, centred on 50 N 15 E
// The map reaches below the bottom of the Gulf of Sirte (30.2 N), so the coast of North Africa is whole, and past Ireland's
// west coast and the North Cape, so the Atlantic and the Arctic are each one stretch of sea
const PROJECTION = { parallels: [38, 62], origin: [50, 15], kmPerUnit: 2.4, margin: 20, include: [[29.6, 18.5], [53.0, -11.3], [72.0, 27.0]] };

// ---------------------------------------------------------------------------------------------------------
// Countries in 1440: code, name, capital (a settlement name below). Settlements follow the people of 1440 — one for about
// 180,000 — so the realms of the empty north and east hold wide lands with few towns, and the Empire's smallest states, whose
// town did not make the cut, are folded into their neighbours.
// ---------------------------------------------------------------------------------------------------------
const COUNTRIES = [
    // the North and the Baltic
    ["NOR", "Norway",                 "Bergen"],
    ["SWE", "Sweden",                 "Stockholm"],
    ["DEN", "Denmark",                "Copenhagen"],
    ["GOT", "Gotland",                "Visby"],
    ["LIV", "Livonian Order",         "Riga"],
    ["TEU", "Teutonic Order",         "Danzig"],
    // the British Isles
    ["ENG", "England",                "London"],
    ["SCO", "Scotland",               "Edinburgh"],
    ["ISL", "Lordship of the Isles",  "Inverness"],
    ["TRN", "Tyrone",                 "Dungannon"],
    ["THO", "Thomond",                "Ennis"],
    ["DES", "Desmond",                "Tralee"],
    // France and the Low Countries
    ["FRA", "France",                 "Paris"],
    ["BUR", "Burgundy",               "Brussels"],
    ["BRI", "Brittany",               "Nantes"],
    ["ANJ", "Anjou",                  "Marseille"],
    ["BOU", "Bourbon",                "Moulins"],
    ["ARM", "Armagnac",               "Rodez"],
    ["FOI", "Foix-Béarn",             "Pau"],
    ["SAV", "Savoy",                  "Chambéry"],
    ["LIE", "Liège",                  "Liège"],
    ["UTR", "Utrecht",                "Utrecht"],
    ["GEL", "Guelders",               "Nijmegen"],
    ["FRI", "Frisia",                 "Groningen"],
    ["LUX", "Luxembourg",             "Luxembourg"],
    // Iberia
    ["CAS", "Castile",                "Toledo"],
    ["ARA", "Aragon",                 "Zaragoza"],
    ["POR", "Portugal",               "Lisbon"],
    ["NAV", "Navarre",                "Pamplona"],
    ["GRA", "Granada",                "Granada"],
    // Italy
    ["MIL", "Milan",                  "Milan"],
    ["VEN", "Venice",                 "Venice"],
    ["GEN", "Genoa",                  "Genoa"],
    ["FLO", "Florence",               "Florence"],
    ["SIE", "Siena",                  "Siena"],
    ["LUC", "Lucca",                  "Lucca"],
    ["PAP", "Papal States",           "Rome"],
    ["FER", "Ferrara",                "Ferrara"],
    ["MAN", "Mantua",                 "Mantua"],
    ["MON", "Montferrat",             "Casale"],
    ["RIM", "Rimini",                 "Rimini"],
    ["NAP", "Naples",                 "Naples"],
    // the Empire
    ["SHO", "Schleswig-Holstein",     "Schleswig"],
    ["LUB", "Lübeck",                 "Lübeck"],
    ["HAM", "Hamburg",                "Hamburg"],
    ["MEC", "Mecklenburg",            "Schwerin"],
    ["POM", "Pomerania",              "Stettin"],
    ["BRE", "Bremen",                 "Bremen"],
    ["BRU", "Brunswick-Lüneburg",     "Brunswick"],
    ["MAG", "Magdeburg",              "Magdeburg"],
    ["BRA", "Brandenburg",            "Berlin"],
    ["CLE", "Cleves-Mark",            "Wesel"],
    ["MUN", "Münster",                "Münster"],
    ["JUL", "Jülich-Berg",            "Düsseldorf"],
    ["COL", "Cologne",                "Cologne"],
    ["HES", "Hesse",                  "Kassel"],
    ["SAX", "Saxony",                 "Wittenberg"],
    ["LUS", "Upper Lusatia",          "Bautzen"],
    ["SIL", "Silesia",                "Breslau"],
    ["OPP", "Opole",                  "Oppeln"],
    ["TRI", "Trier",                  "Trier"],
    ["MAI", "Mainz",                  "Mainz"],
    ["FFM", "Frankfurt",              "Frankfurt"],
    ["WBG", "Würzburg",               "Würzburg"],
    ["ANS", "Ansbach-Kulmbach",       "Ansbach"],
    ["NUR", "Nuremberg",              "Nuremberg"],
    ["PAL", "Palatinate",             "Heidelberg"],
    ["BOH", "Bohemia",                "Prague"],
    ["MET", "Metz",                   "Metz"],
    ["STR", "Strasbourg",             "Strasbourg"],
    ["BAD", "Baden",                  "Baden"],
    ["WRT", "Württemberg",            "Stuttgart"],
    ["ULM", "Ulm",                    "Ulm"],
    ["AUG", "Augsburg",               "Augsburg"],
    ["BIN", "Bavaria-Ingolstadt",     "Ingolstadt"],
    ["REG", "Regensburg",             "Regensburg"],
    ["BMU", "Bavaria-Munich",         "Munich"],
    ["BLA", "Bavaria-Landshut",       "Landshut"],
    ["AUS", "Austria",                "Vienna"],
    ["TYR", "Tyrol",                  "Innsbruck"],
    ["BAS", "Basel",                  "Basel"],
    ["ZUR", "Zürich",                 "Zürich"],
    ["SWI", "Swiss Confederacy",      "Bern"],
    ["SAL", "Salzburg",               "Salzburg"],
    ["STY", "Inner Austria",          "Graz"],
    // Poland, Lithuania, Hungary
    ["POL", "Poland",                 "Kraków"],
    ["MAZ", "Masovia",                "Warsaw"],
    ["LIT", "Lithuania",              "Vilnius"],
    ["HUN", "Hungary",                "Buda"],
    ["JIS", "Upper Hungary",          "Kassa"],
    // the Balkans
    ["OTT", "Ottoman Empire",         "Edirne"],
    ["BYZ", "Byzantium",              "Constantinople"],
    ["MOR", "Morea",                  "Mistra"],
    ["SER", "Serbia",                 "Novo Brdo"],
    ["BOS", "Bosnia",                 "Jajce"],
    ["HER", "Herzegovina",            "Blagaj"],
    ["RAG", "Ragusa",                 "Ragusa"],
    ["WAL", "Wallachia",              "Târgoviște"],
    ["MOL", "Moldavia",               "Suceava"],
    ["ATH", "Athens",                 "Athens"],
    ["EPI", "Epirus",                 "Arta"],
    ["LES", "Lesbos",                 "Mytilene"],
    // Anatolia and the islands
    ["KAR", "Karaman",                "Konya"],
    ["CAN", "Candar",                 "Kastamonu"],
    ["TRE", "Trebizond",              "Trebizond"],
    ["DUL", "Dulkadir",               "Elbistan"],
    ["RAM", "Ramadan",                "Adana"],
    ["AQQ", "Aq Qoyunlu",             "Diyarbakır"],
    ["CYP", "Cyprus",                 "Nicosia"],
    ["KRH", "Knights of Rhodes",      "Rhodes"],
    // Russia and the steppe
    ["MOS", "Muscovy",                "Moscow"],
    ["NOV", "Novgorod",               "Novgorod"],
    ["PSK", "Pskov",                  "Pskov"],
    ["TVE", "Tver",                   "Tver"],
    ["RYA", "Ryazan",                 "Ryazan"],
    ["CRI", "Crimea",                 "Qırım"],
    ["THE", "Theodoro",               "Mangup"],
    ["GHO", "Great Horde",            "Azak"],
    // North Africa
    ["MRC", "Morocco",                "Fez"],
    ["TLE", "Tlemcen",                "Tlemcen"],
    ["TUN", "Tunis",                  "Tunis"],
];

// ---------------------------------------------------------------------------------------------------------
// Settlements: name, country, lat, lon, flags (city = 20K, else a 10K town; port; hre). Cities are the largest towns of 1440.
// ---------------------------------------------------------------------------------------------------------
const SETTLEMENTS = [
    // Scandinavia: the people of the north were few — one settlement stands for a wide land
    ["Oslo",            "NOR", 59.91, 10.75, "port"],
    ["Bergen",          "NOR", 60.39,  5.32, "city port"],
    ["Nidaros",         "NOR", 63.43, 10.40, "port"],
    ["Vardøhus",        "NOR", 70.37, 31.11, "port"],
    ["Stockholm",       "SWE", 59.33, 18.07, "city port"],
    ["Uppsala",         "SWE", 59.86, 17.64, ""],
    ["Linköping",       "SWE", 58.41, 15.62, ""],
    ["Kalmar",          "SWE", 56.66, 16.36, "port"],
    ["Älvsborg",        "SWE", 57.69, 11.92, "port"],
    ["Gävle",           "SWE", 60.67, 17.14, "port"],
    ["Torneå",          "SWE", 65.85, 24.15, "port"],
    ["Åbo",             "SWE", 60.45, 22.27, "port"],
    ["Viborg",          "SWE", 60.71, 28.75, "port"],
    ["Copenhagen",      "DEN", 55.68, 12.57, "port"],
    ["Lund",            "DEN", 55.70, 13.19, ""],
    ["Odense",          "DEN", 55.40, 10.39, "port"],
    ["Aarhus",          "DEN", 56.16, 10.21, "port"],
    ["Aalborg",         "DEN", 57.05,  9.92, "port"],
    ["Visby",           "GOT", 57.64, 18.30, "port"],
    // the Baltic orders
    ["Riga",            "LIV", 56.95, 24.11, "city port"],
    ["Reval",           "LIV", 59.44, 24.75, "port"],
    ["Dorpat",          "LIV", 58.38, 26.72, ""],
    ["Pernau",          "LIV", 58.39, 24.50, "port"],
    ["Danzig",          "TEU", 54.35, 18.65, "city port"],
    ["Königsberg",      "TEU", 54.71, 20.51, "port"],
    ["Thorn",           "TEU", 53.01, 18.60, ""],
    ["Memel",           "TEU", 55.71, 21.13, "port"],
    // the British Isles
    ["London",          "ENG", 51.51, -0.12, "city port"],
    ["York",            "ENG", 53.96, -1.08, "city"],
    ["Bristol",         "ENG", 51.45, -2.59, "city port"],
    ["Norwich",         "ENG", 52.63,  1.30, "port"],
    ["Southampton",     "ENG", 50.90, -1.40, "port"],
    ["Exeter",          "ENG", 50.72, -3.53, "port"],
    ["Lincoln",         "ENG", 53.23, -0.54, ""],
    ["Coventry",        "ENG", 52.41, -1.51, ""],
    ["Canterbury",      "ENG", 51.28,  1.08, ""],
    ["Newcastle",       "ENG", 54.97, -1.61, "port"],
    ["Chester",         "ENG", 53.19, -2.89, "port"],
    ["Carlisle",        "ENG", 54.89, -2.93, ""],
    ["Shrewsbury",      "ENG", 52.71, -2.75, ""],
    ["Carmarthen",      "ENG", 51.86, -4.31, "port"],
    ["Dublin",          "ENG", 53.35, -6.26, "port"],
    ["Waterford",       "ENG", 52.26, -7.11, "port"],
    ["Cork",            "ENG", 51.90, -8.47, "port"],
    ["Galway",          "ENG", 53.27, -9.05, "port"],
    ["Dungannon",       "TRN", 54.50, -6.77, ""],
    ["Ennis",           "THO", 52.84, -8.98, ""],
    ["Tralee",          "DES", 52.27, -9.70, "port"],
    ["Edinburgh",       "SCO", 55.95, -3.19, "port"],
    ["Perth",           "SCO", 56.40, -3.43, ""],
    ["Aberdeen",        "SCO", 57.15, -2.09, "port"],
    ["Glasgow",         "SCO", 55.86, -4.25, ""],
    ["Inverness",       "ISL", 57.48, -4.22, "port"],
    // France: the king's lands
    ["Paris",           "FRA", 48.86,  2.35, "city"],
    ["Orléans",         "FRA", 47.90,  1.90, ""],
    ["Blois",           "FRA", 47.59,  1.33, ""],
    ["Chartres",        "FRA", 48.45,  1.49, ""],
    ["Bourges",         "FRA", 47.08,  2.40, ""],
    ["Tours",           "FRA", 47.39,  0.69, ""],
    ["Poitiers",        "FRA", 46.58,  0.34, ""],
    ["La Rochelle",     "FRA", 46.16, -1.15, "port"],
    ["Angoulême",       "FRA", 45.65,  0.16, ""],
    ["Limoges",         "FRA", 45.83,  1.26, ""],
    ["Périgueux",       "FRA", 45.18,  0.72, ""],
    ["Cahors",          "FRA", 44.45,  1.44, ""],
    ["Agen",            "FRA", 44.20,  0.62, ""],
    ["Montauban",       "FRA", 44.02,  1.35, ""],
    ["Toulouse",        "FRA", 43.60,  1.44, "city"],
    ["Albi",            "FRA", 43.93,  2.15, ""],
    ["Carcassonne",     "FRA", 43.21,  2.35, ""],
    ["Narbonne",        "FRA", 43.18,  3.00, ""],
    ["Montpellier",     "FRA", 43.61,  3.88, ""],
    ["Aigues-Mortes",   "FRA", 43.57,  4.19, "port"],
    ["Nîmes",           "FRA", 43.84,  4.36, ""],
    ["Le Puy",          "FRA", 45.04,  3.88, ""],
    ["Saint-Flour",     "FRA", 45.03,  3.09, ""],
    ["Lyon",            "FRA", 45.76,  4.84, "city"],
    ["Valence",         "FRA", 44.93,  4.89, ""],
    ["Grenoble",        "FRA", 45.19,  5.72, ""],
    ["Nevers",          "FRA", 46.99,  3.16, ""],
    ["Troyes",          "FRA", 48.30,  4.08, ""],
    ["Reims",           "FRA", 49.26,  4.03, ""],
    ["Châlons",         "FRA", 48.96,  4.37, ""],
    ["Laon",            "FRA", 49.56,  3.62, ""],
    ["Beauvais",        "FRA", 49.43,  2.08, ""],
    // England in France
    ["Calais",          "ENG", 50.95,  1.86, "port"],
    ["Rouen",           "ENG", 49.44,  1.10, "city port"],
    ["Caen",            "ENG", 49.18, -0.37, "port"],
    ["Cherbourg",       "ENG", 49.64, -1.62, "port"],
    ["Le Mans",         "ENG", 48.00,  0.20, ""],
    ["Bordeaux",        "ENG", 44.84, -0.58, "city port"],
    ["Bayonne",         "ENG", 43.49, -1.47, "port"],
    // Burgundy, in France and the Low Countries
    ["Dijon",           "BUR", 47.32,  5.04, ""],
    ["Besançon",        "BUR", 47.24,  6.02, "hre"],
    ["Auxerre",         "BUR", 47.80,  3.57, ""],
    ["Mâcon",           "BUR", 46.31,  4.83, ""],
    ["Arras",           "BUR", 50.29,  2.78, ""],
    ["Amiens",          "BUR", 49.89,  2.30, ""],
    ["Abbeville",       "BUR", 50.11,  1.83, "port"],
    ["Lille",           "BUR", 50.63,  3.06, ""],
    ["Bruges",          "BUR", 51.21,  3.22, "city port"],
    ["Ghent",           "BUR", 51.05,  3.72, "city"],
    ["Brussels",        "BUR", 50.85,  4.35, "city hre"],
    ["Antwerp",         "BUR", 51.22,  4.40, "city port hre"],
    ["Leuven",          "BUR", 50.88,  4.70, "hre"],
    ["Mons",            "BUR", 50.45,  3.95, "hre"],
    ["Namur",           "BUR", 50.47,  4.87, "hre"],
    ["Middelburg",      "BUR", 51.50,  3.61, "port hre"],
    ["Dordrecht",       "BUR", 51.81,  4.67, "port hre"],
    ["Amsterdam",       "BUR", 52.37,  4.89, "port hre"],
    // the rest of France
    ["Rennes",          "BRI", 48.11, -1.68, ""],
    ["Nantes",          "BRI", 47.22, -1.55, "city port"],
    ["Vannes",          "BRI", 47.66, -2.76, "port"],
    ["Brest",           "BRI", 48.39, -4.49, "port"],
    ["Angers",          "ANJ", 47.47, -0.55, ""],
    ["Aix",             "ANJ", 43.53,  5.45, ""],
    ["Marseille",       "ANJ", 43.30,  5.37, "city port"],
    ["Nancy",           "ANJ", 48.69,  6.18, "hre"],
    ["Bar-le-Duc",      "ANJ", 48.77,  5.16, "hre"],
    ["Moulins",         "BOU", 46.57,  3.33, ""],
    ["Clermont",        "BOU", 45.78,  3.08, ""],
    ["Rodez",           "ARM", 44.35,  2.57, ""],
    ["Lectoure",        "ARM", 43.93,  0.62, ""],
    ["Pau",             "FOI", 43.30, -0.37, ""],
    ["Foix",            "FOI", 42.97,  1.61, ""],
    ["Avignon",         "PAP", 43.95,  4.81, ""],
    ["Chambéry",        "SAV", 45.57,  5.92, "hre"],
    ["Bourg-en-Bresse", "SAV", 46.21,  5.23, "hre"],
    ["Geneva",          "SAV", 46.20,  6.15, "hre"],
    ["Lausanne",        "SAV", 46.52,  6.63, "hre"],
    ["Turin",           "SAV", 45.07,  7.69, "hre"],
    ["Nice",            "SAV", 43.70,  7.27, "port hre"],
    // the Low Countries' own princes
    ["Liège",           "LIE", 50.63,  5.57, "city hre"],
    ["Utrecht",         "UTR", 52.09,  5.12, "hre"],
    ["Nijmegen",        "GEL", 51.84,  5.86, "hre"],
    ["Groningen",       "FRI", 53.22,  6.57, "port hre"],
    ["Luxembourg",      "LUX", 49.61,  6.13, "hre"],
    // Iberia
    ["Toledo",          "CAS", 39.86, -4.02, "city"],
    ["Madrid",          "CAS", 40.42, -3.70, ""],
    ["Seville",         "CAS", 37.39, -5.99, "city port"],
    ["Córdoba",         "CAS", 37.88, -4.78, "city"],
    ["Jaén",            "CAS", 37.77, -3.79, ""],
    ["Cádiz",           "CAS", 36.53, -6.29, "port"],
    ["Murcia",          "CAS", 37.99, -1.13, ""],
    ["Cartagena",       "CAS", 37.60, -0.98, "port"],
    ["Cuenca",          "CAS", 40.07, -2.13, ""],
    ["Ciudad Real",     "CAS", 38.98, -3.93, ""],
    ["Badajoz",         "CAS", 38.88, -6.97, ""],
    ["Cáceres",         "CAS", 39.47, -6.37, ""],
    ["Plasencia",       "CAS", 40.03, -6.09, ""],
    ["Salamanca",       "CAS", 40.96, -5.66, ""],
    ["Ávila",           "CAS", 40.66, -4.70, ""],
    ["Segovia",         "CAS", 40.95, -4.12, ""],
    ["Valladolid",      "CAS", 41.65, -4.72, "city"],
    ["Burgos",          "CAS", 42.34, -3.70, "city"],
    ["Soria",           "CAS", 41.76, -2.47, ""],
    ["León",            "CAS", 42.60, -5.57, ""],
    ["Oviedo",          "CAS", 43.36, -5.84, ""],
    ["Bilbao",          "CAS", 43.26, -2.93, "port"],
    ["Santiago",        "CAS", 42.88, -8.54, ""],
    ["A Coruña",        "CAS", 43.37, -8.40, "port"],
    ["Zaragoza",        "ARA", 41.65, -0.88, "city"],
    ["Huesca",          "ARA", 42.14, -0.41, ""],
    ["Teruel",          "ARA", 40.34, -1.11, ""],
    ["Lleida",          "ARA", 41.62,  0.62, ""],
    ["Barcelona",       "ARA", 41.39,  2.17, "city port"],
    ["Tarragona",       "ARA", 41.12,  1.25, "port"],
    ["Girona",          "ARA", 41.98,  2.82, ""],
    ["Perpignan",       "ARA", 42.70,  2.90, ""],
    ["Valencia",        "ARA", 39.47, -0.38, "city port"],
    ["Alicante",        "ARA", 38.35, -0.48, "port"],
    ["Palma",           "ARA", 39.57,  2.65, "port"],
    ["Lisbon",          "POR", 38.72, -9.14, "city port"],
    ["Porto",           "POR", 41.15, -8.61, "port"],
    ["Braga",           "POR", 41.55, -8.42, ""],
    ["Coimbra",         "POR", 40.21, -8.43, ""],
    ["Évora",           "POR", 38.57, -7.91, ""],
    ["Lagos",           "POR", 37.10, -8.67, "port"],
    ["Ceuta",           "POR", 35.89, -5.31, "port"],
    ["Pamplona",        "NAV", 42.82, -1.64, ""],
    ["Granada",         "GRA", 37.18, -3.60, "city"],
    ["Málaga",          "GRA", 36.72, -4.42, "port"],
    ["Almería",         "GRA", 36.84, -2.46, "port"],
    // Italy
    ["Milan",           "MIL", 45.46,  9.19, "city hre"],
    ["Pavia",           "MIL", 45.19,  9.16, "hre"],
    ["Como",            "MIL", 45.81,  9.08, "hre"],
    ["Cremona",         "MIL", 45.13, 10.02, "hre"],
    ["Piacenza",        "MIL", 45.05,  9.69, "hre"],
    ["Parma",           "MIL", 44.80, 10.33, "hre"],
    ["Alessandria",     "MIL", 44.91,  8.61, "hre"],
    ["Venice",          "VEN", 45.44, 12.33, "city port"],
    ["Padua",           "VEN", 45.41, 11.88, ""],
    ["Verona",          "VEN", 45.44, 10.99, "city"],
    ["Vicenza",         "VEN", 45.55, 11.55, ""],
    ["Brescia",         "VEN", 45.54, 10.21, ""],
    ["Bergamo",         "VEN", 45.70,  9.67, ""],
    ["Treviso",         "VEN", 45.67, 12.24, ""],
    ["Udine",           "VEN", 46.06, 13.24, ""],
    ["Zara",            "VEN", 44.12, 15.23, "port"],
    ["Spalato",         "VEN", 43.51, 16.44, "port"],
    ["Durazzo",         "VEN", 41.32, 19.45, "port"],
    ["Corfu",           "VEN", 39.62, 19.92, "port"],
    ["Modon",           "VEN", 36.82, 21.70, "port"],
    ["Negroponte",      "VEN", 38.46, 23.60, "port"],
    ["Candia",          "VEN", 35.34, 25.13, "city port"],
    ["Canea",           "VEN", 35.51, 24.02, "port"],
    ["Genoa",           "GEN", 44.41,  8.93, "city port"],
    ["Savona",          "GEN", 44.31,  8.48, "port"],
    ["Bastia",          "GEN", 42.70,  9.45, "port"],
    ["Chios",           "GEN", 38.37, 26.14, "port"],
    ["Famagusta",       "GEN", 35.12, 33.94, "port"],
    ["Caffa",           "GEN", 45.03, 35.38, "city port"],
    ["Florence",        "FLO", 43.77, 11.26, "city"],
    ["Pisa",            "FLO", 43.72, 10.40, "port"],
    ["Arezzo",          "FLO", 43.46, 11.88, ""],
    ["Siena",           "SIE", 43.32, 11.33, ""],
    ["Lucca",           "LUC", 43.84, 10.50, ""],
    ["Rome",            "PAP", 41.90, 12.50, "city"],
    ["Viterbo",         "PAP", 42.42, 12.10, ""],
    ["Perugia",         "PAP", 43.11, 12.39, ""],
    ["Ancona",          "PAP", 43.62, 13.52, "port"],
    ["Bologna",         "PAP", 44.49, 11.34, "city"],
    ["Ferrara",         "FER", 44.84, 11.62, ""],
    ["Modena",          "FER", 44.65, 10.93, "hre"],
    ["Mantua",          "MAN", 45.16, 10.79, "hre"],
    ["Casale",          "MON", 45.13,  8.45, "hre"],
    ["Rimini",          "RIM", 44.06, 12.57, "port"],
    ["Naples",          "NAP", 40.85, 14.27, "city port"],
    ["Salerno",         "NAP", 40.68, 14.77, "port"],
    ["L'Aquila",        "NAP", 42.35, 13.40, ""],
    ["Foggia",          "NAP", 41.46, 15.55, ""],
    ["Bari",            "NAP", 41.13, 16.87, "port"],
    ["Taranto",         "NAP", 40.47, 17.24, "port"],
    ["Lecce",           "NAP", 40.35, 18.17, ""],
    ["Cosenza",         "NAP", 39.30, 16.25, ""],
    ["Reggio",          "NAP", 38.11, 15.65, "port"],
    ["Gaeta",           "ARA", 41.21, 13.57, "port"],
    ["Palermo",         "ARA", 38.12, 13.36, "city port"],
    ["Messina",         "ARA", 38.19, 15.55, "port"],
    ["Catania",         "ARA", 37.50, 15.09, "port"],
    ["Syracuse",        "ARA", 37.08, 15.29, "port"],
    ["Cagliari",        "ARA", 39.22,  9.11, "port"],
    ["Sassari",         "ARA", 40.73,  8.56, ""],
    // the Empire
    ["Schleswig",       "SHO", 54.52,  9.56, "port"],
    ["Lübeck",          "LUB", 53.87, 10.69, "city port hre"],
    ["Hamburg",         "HAM", 53.55,  9.99, "city port hre"],
    ["Schwerin",        "MEC", 53.63, 11.41, "hre"],
    ["Rostock",         "MEC", 54.09, 12.10, "port hre"],
    ["Stettin",         "POM", 53.43, 14.55, "port hre"],
    ["Stralsund",       "POM", 54.31, 13.09, "port hre"],
    ["Bremen",          "BRE", 53.08,  8.80, "port hre"],
    ["Lüneburg",        "BRU", 53.25, 10.41, "hre"],
    ["Brunswick",       "BRU", 52.27, 10.52, "city hre"],
    ["Magdeburg",       "MAG", 52.13, 11.63, "city hre"],
    ["Berlin",          "BRA", 52.52, 13.40, "hre"],
    ["Brandenburg",     "BRA", 52.41, 12.56, "hre"],
    ["Frankfurt (Oder)", "BRA", 52.35, 14.55, "hre"],
    ["Wesel",           "CLE", 51.66,  6.62, "hre"],
    ["Münster",         "MUN", 51.96,  7.63, "hre"],
    ["Düsseldorf",      "JUL", 51.23,  6.78, "hre"],
    ["Cologne",         "COL", 50.94,  6.96, "city hre"],
    ["Kassel",          "HES", 51.31,  9.49, "hre"],
    ["Marburg",         "HES", 50.81,  8.77, "hre"],
    ["Wittenberg",      "SAX", 51.87, 12.65, "hre"],
    ["Leipzig",         "SAX", 51.34, 12.37, "hre"],
    ["Dresden",         "SAX", 51.05, 13.74, "hre"],
    ["Eisenach",        "SAX", 50.98, 10.32, "hre"],
    ["Bautzen",         "LUS", 51.18, 14.43, "hre"],
    ["Breslau",         "SIL", 51.11, 17.03, "city hre"],
    ["Glogau",          "SIL", 51.66, 16.08, "hre"],
    ["Oppeln",          "OPP", 50.67, 17.93, "hre"],
    ["Trier",           "TRI", 49.76,  6.64, "hre"],
    ["Mainz",           "MAI", 50.00,  8.27, "hre"],
    ["Frankfurt",       "FFM", 50.11,  8.68, "hre"],
    ["Würzburg",        "WBG", 49.79,  9.93, "hre"],
    ["Ansbach",         "ANS", 49.30, 10.57, "hre"],
    ["Nuremberg",       "NUR", 49.45, 11.08, "city hre"],
    ["Heidelberg",      "PAL", 49.40,  8.69, "hre"],
    ["Amberg",          "PAL", 49.44, 11.86, "hre"],
    ["Prague",          "BOH", 50.08, 14.42, "city hre"],
    ["Plzeň",           "BOH", 49.75, 13.38, "hre"],
    ["Kutná Hora",      "BOH", 49.95, 15.27, "hre"],
    ["Brno",            "BOH", 49.20, 16.61, "hre"],
    ["Olomouc",         "BOH", 49.59, 17.25, "hre"],
    ["Metz",            "MET", 49.12,  6.18, "city hre"],
    ["Strasbourg",      "STR", 48.58,  7.75, "city hre"],
    ["Baden",           "BAD", 48.76,  8.24, "hre"],
    ["Stuttgart",       "WRT", 48.78,  9.18, "hre"],
    ["Ulm",             "ULM", 48.40,  9.99, "city hre"],
    ["Augsburg",        "AUG", 48.37, 10.90, "city hre"],
    ["Ingolstadt",      "BIN", 48.77, 11.43, "hre"],
    ["Regensburg",      "REG", 49.02, 12.10, "hre"],
    ["Munich",          "BMU", 48.14, 11.58, "hre"],
    ["Straubing",       "BMU", 48.88, 12.57, "hre"],
    ["Landshut",        "BLA", 48.54, 12.15, "hre"],
    ["Vienna",          "AUS", 48.21, 16.37, "city hre"],
    ["Linz",            "AUS", 48.31, 14.29, "hre"],
    ["Wiener Neustadt", "AUS", 47.81, 16.24, "hre"],
    ["Innsbruck",       "TYR", 47.27, 11.39, "hre"],
    ["Bozen",           "TYR", 46.50, 11.35, "hre"],
    ["Freiburg",        "TYR", 47.99,  7.85, "hre"],
    ["Basel",           "BAS", 47.56,  7.59, "hre"],
    ["Zürich",          "ZUR", 47.37,  8.54, "hre"],
    ["Bern",            "SWI", 46.95,  7.45, "hre"],
    ["Lucerne",         "SWI", 47.05,  8.31, "hre"],
    ["Salzburg",        "SAL", 47.80, 13.04, "hre"],
    ["Graz",            "STY", 47.07, 15.44, "hre"],
    ["Ljubljana",       "STY", 46.05, 14.51, "hre"],
    ["Trieste",         "STY", 45.65, 13.77, "port hre"],
    // Poland and Lithuania
    ["Kraków",          "POL", 50.06, 19.94, "city"],
    ["Poznań",          "POL", 52.41, 16.93, ""],
    ["Gniezno",         "POL", 52.53, 17.60, ""],
    ["Kalisz",          "POL", 51.76, 18.09, ""],
    ["Sieradz",         "POL", 51.60, 18.73, ""],
    ["Łęczyca",         "POL", 52.06, 19.20, ""],
    ["Inowrocław",      "POL", 52.80, 18.26, ""],
    ["Sandomierz",      "POL", 50.68, 21.75, ""],
    ["Lublin",          "POL", 51.25, 22.57, ""],
    ["Przemyśl",        "POL", 49.78, 22.77, ""],
    ["Lwów",            "POL", 49.84, 24.03, "city"],
    ["Halicz",          "POL", 49.13, 24.72, ""],
    ["Kamieniec",       "POL", 48.68, 26.58, ""],
    ["Warsaw",          "MAZ", 52.23, 21.01, ""],
    ["Płock",           "MAZ", 52.55, 19.70, ""],
    ["Vilnius",         "LIT", 54.69, 25.28, "city"],
    ["Kaunas",          "LIT", 54.90, 23.90, ""],
    ["Medininkai",      "LIT", 55.76, 22.20, ""],
    ["Grodno",          "LIT", 53.68, 23.83, ""],
    ["Brest-Litovsk",   "LIT", 52.10, 23.69, ""],
    ["Lutsk",           "LIT", 50.75, 25.33, ""],
    ["Minsk",           "LIT", 53.90, 27.56, ""],
    ["Polotsk",         "LIT", 55.49, 28.79, ""],
    ["Vitebsk",         "LIT", 55.19, 30.20, ""],
    ["Mogilev",         "LIT", 53.90, 30.33, ""],
    ["Smolensk",        "LIT", 54.78, 32.04, "city"],
    ["Kiev",            "LIT", 50.45, 30.52, ""],
    ["Chernigov",       "LIT", 51.49, 31.29, ""],
    ["Novgorod-Seversky", "LIT", 52.01, 33.26, ""],
    ["Bratslav",        "LIT", 48.82, 28.93, ""],
    // Hungary
    ["Buda",            "HUN", 47.50, 19.04, "city"],
    ["Pozsony",         "HUN", 48.14, 17.11, ""],
    ["Győr",            "HUN", 47.69, 17.63, ""],
    ["Esztergom",       "HUN", 47.79, 18.74, ""],
    ["Székesfehérvár",  "HUN", 47.19, 18.41, ""],
    ["Pécs",            "HUN", 46.07, 18.23, ""],
    ["Szeged",          "HUN", 46.25, 20.15, ""],
    ["Temesvár",        "HUN", 45.75, 21.23, ""],
    ["Nagyvárad",       "HUN", 47.06, 21.93, ""],
    ["Debrecen",        "HUN", 47.53, 21.63, ""],
    ["Kolozsvár",       "HUN", 46.77, 23.59, ""],
    ["Szeben",          "HUN", 45.79, 24.15, ""],
    ["Brassó",          "HUN", 45.65, 25.61, ""],
    ["Zagreb",          "HUN", 45.81, 15.98, ""],
    ["Belgrade",        "HUN", 44.82, 20.46, ""],
    ["Kassa",           "JIS", 48.72, 21.26, ""],
    ["Besztercebánya",  "JIS", 48.74, 19.15, ""],
    // the Balkans
    ["Edirne",          "OTT", 41.68, 26.56, "city"],
    ["Gallipoli",       "OTT", 40.41, 26.67, "port"],
    ["Philippopolis",   "OTT", 42.14, 24.75, ""],
    ["Sofia",           "OTT", 42.70, 23.32, ""],
    ["Tarnovo",         "OTT", 43.08, 25.63, ""],
    ["Varna",           "OTT", 43.21, 27.92, "port"],
    ["Nikopol",         "OTT", 43.70, 24.90, ""],
    ["Vidin",           "OTT", 43.99, 22.88, ""],
    ["Salonica",        "OTT", 40.64, 22.94, "city port"],
    ["Serres",          "OTT", 41.09, 23.55, ""],
    ["Skopje",          "OTT", 42.00, 21.43, ""],
    ["Monastir",        "OTT", 41.03, 21.33, ""],
    ["Ioannina",        "OTT", 39.67, 20.85, ""],
    ["Larissa",         "OTT", 39.64, 22.42, ""],
    ["Kruja",           "OTT", 41.51, 19.79, ""],
    ["Smederevo",       "OTT", 44.66, 20.93, ""],
    ["Constantinople",  "BYZ", 41.01, 28.98, "city port"],
    ["Mesembria",       "BYZ", 42.66, 27.73, "port"],
    ["Mistra",          "MOR", 37.07, 22.37, ""],
    ["Patras",          "MOR", 38.25, 21.73, "port"],
    ["Corinth",         "MOR", 37.94, 22.93, "port"],
    ["Novo Brdo",       "SER", 42.62, 21.43, ""],
    ["Jajce",           "BOS", 44.34, 17.27, ""],
    ["Srebrenica",      "BOS", 44.10, 19.30, ""],
    ["Blagaj",          "HER", 43.26, 17.89, ""],
    ["Ragusa",          "RAG", 42.65, 18.09, "port"],
    ["Târgoviște",      "WAL", 44.93, 25.45, ""],
    ["Brăila",          "WAL", 45.27, 27.96, ""],
    ["Suceava",         "MOL", 47.65, 26.26, ""],
    ["Iași",            "MOL", 47.16, 27.59, ""],
    ["Akkerman",        "MOL", 46.20, 30.35, "port"],
    ["Athens",          "ATH", 37.98, 23.73, "port"],
    ["Arta",            "EPI", 39.16, 20.98, ""],
    ["Mytilene",        "LES", 39.10, 26.56, "port"],
    // Anatolia
    ["Bursa",           "OTT", 40.18, 29.06, "city"],
    ["Nicaea",          "OTT", 40.43, 29.72, ""],
    ["Izmit",           "OTT", 40.76, 29.92, "port"],
    ["Balıkesir",       "OTT", 39.65, 27.88, ""],
    ["Manisa",          "OTT", 38.61, 27.43, ""],
    ["Smyrna",          "OTT", 38.42, 27.14, "port"],
    ["Ayasoluk",        "OTT", 37.94, 27.37, ""],
    ["Milas",           "OTT", 37.32, 27.78, ""],
    ["Denizli",         "OTT", 37.78, 29.09, ""],
    ["Kütahya",         "OTT", 39.42, 29.98, ""],
    ["Afyon",           "OTT", 38.76, 30.54, ""],
    ["Antalya",         "OTT", 36.89, 30.70, "port"],
    ["Ankara",          "OTT", 39.93, 32.86, ""],
    ["Amasya",          "OTT", 40.65, 35.83, ""],
    ["Tokat",           "OTT", 40.31, 36.55, ""],
    ["Samsun",          "OTT", 41.29, 36.33, "port"],
    ["Konya",           "KAR", 37.87, 32.48, "city"],
    ["Karaman",         "KAR", 37.18, 33.22, ""],
    ["Aksaray",         "KAR", 38.37, 34.03, ""],
    ["Kayseri",         "KAR", 38.73, 35.49, ""],
    ["Silifke",         "KAR", 36.38, 33.93, "port"],
    ["Alanya",          "KAR", 36.54, 32.00, "port"],
    ["Kastamonu",       "CAN", 41.38, 33.78, ""],
    ["Sinop",           "CAN", 42.03, 35.15, "port"],
    ["Trebizond",       "TRE", 41.00, 39.72, "port"],
    ["Elbistan",        "DUL", 38.20, 37.20, ""],
    ["Maraş",           "DUL", 37.58, 36.94, ""],
    ["Adana",           "RAM", 37.00, 35.32, ""],
    ["Diyarbakır",      "AQQ", 37.91, 40.23, ""],
    ["Erzincan",        "AQQ", 39.75, 39.49, ""],
    ["Erzurum",         "AQQ", 39.91, 41.27, ""],
    ["Nicosia",         "CYP", 35.17, 33.36, ""],
    ["Rhodes",          "KRH", 36.43, 28.22, "port"],
    ["Bodrum",          "KRH", 37.03, 27.43, "port"],
    // Russia and the steppe
    ["Moscow",          "MOS", 55.75, 37.62, "city"],
    ["Vladimir",        "MOS", 56.13, 40.41, ""],
    ["Rostov",          "MOS", 57.19, 39.42, ""],
    ["Yaroslavl",       "MOS", 57.63, 39.87, ""],
    ["Kostroma",        "MOS", 57.77, 40.93, ""],
    ["Kolomna",         "MOS", 55.10, 38.77, ""],
    ["Mozhaysk",        "MOS", 55.50, 36.03, ""],
    ["Vologda",         "MOS", 59.22, 39.89, ""],
    ["Beloozero",       "MOS", 60.03, 37.79, ""],
    ["Novgorod",        "NOV", 58.52, 31.27, "city"],
    ["Staraya Russa",   "NOV", 57.99, 31.36, ""],
    ["Ladoga",          "NOV", 60.00, 32.30, ""],
    ["Korela",          "NOV", 61.03, 30.12, ""],
    ["Torzhok",         "NOV", 57.04, 34.96, ""],
    ["Kargopol",        "NOV", 61.50, 38.95, ""],
    ["Kholmogory",      "NOV", 64.22, 41.65, ""],
    ["Pskov",           "PSK", 57.82, 28.33, ""],
    ["Tver",            "TVE", 56.86, 35.92, ""],
    ["Rzhev",           "TVE", 56.26, 34.33, ""],
    ["Ryazan",          "RYA", 54.63, 39.74, ""],
    ["Qırım",           "CRI", 45.04, 35.09, ""],
    ["Mangup",          "THE", 44.59, 33.81, ""],
    ["Azak",            "GHO", 47.10, 39.42, "port"],
    // North Africa
    ["Fez",             "MRC", 34.03, -5.00, "city"],
    ["Meknes",          "MRC", 33.89, -5.55, ""],
    ["Taza",            "MRC", 34.21, -4.01, ""],
    ["Tangier",         "MRC", 35.78, -5.81, "port"],
    ["Salé",            "MRC", 34.04, -6.80, "port"],
    ["Azemmour",        "MRC", 33.29, -8.34, "port"],
    ["Safi",            "MRC", 32.30, -9.24, "port"],
    ["Marrakesh",       "MRC", 31.63, -8.01, "city"],
    ["Tlemcen",         "TLE", 34.88, -1.32, "city"],
    ["Oran",            "TLE", 35.70, -0.64, "port"],
    ["Algiers",         "TLE", 36.75,  3.06, "port"],
    ["Tunis",           "TUN", 36.81, 10.18, "city port"],
    ["Bougie",          "TUN", 36.75,  5.08, "port"],
    ["Constantine",     "TUN", 36.37,  6.61, ""],
    ["Bône",            "TUN", 36.90,  7.77, "port"],
    ["Kairouan",        "TUN", 35.68, 10.10, ""],
    ["Sfax",            "TUN", 34.74, 10.76, "port"],
    ["Gabès",           "TUN", 33.88, 10.10, "port"],
    ["Tripoli",         "TUN", 32.89, 13.19, "port"],
].map(([name, country, lat, lon, flags = ""]) => ({
    name, country, lat, lon,
    city: /city/.test(flags) ? 1 : 0, port: /port/.test(flags) ? 1 : 0, hre: /hre/.test(flags) ? 1 : 0,
}));

// ---------------------------------------------------------------------------------------------------------
// Coastlines: closed rings of lat lon. The first, "mainland", runs from Gibraltar up the Atlantic coast, round the North
// Sea and the Baltic (the historical map's coast, as it is), up Norway to the North Cape and round the White Sea; closes far
// outside the map to the east and south; and comes back up the Atlantic coast of Morocco, along North Africa, the Levant
// and Anatolia, round the Black Sea and the Sea of Azov, and back by the Balkans, Italy, France and Spain to Gibraltar.
// Straits narrower than the map can show (it fills in water under 3 units, about 7 km) are widened to 15-20 km so they stay
// open: the Bosporus, the Dardanelles, Messina, the Øresund, Rio–Antirrio, and the water between Lesbos and Anatolia.
// ---------------------------------------------------------------------------------------------------------
const COAST = [
  [ "mainland", `
    36.01 -5.60  36.19 -5.92  36.30 -6.15  36.53 -6.30  36.75 -6.43  37.00 -6.70  37.15 -6.95  37.20 -7.40
    37.10 -7.65  37.01 -7.95  37.10 -8.30  37.08 -8.67  37.02 -8.99  37.40 -8.82  37.95 -8.87  38.20 -8.80
    38.45 -8.90  38.42 -9.20  38.65 -9.25  38.69 -9.40  38.78 -9.50  39.00 -9.42  39.36 -9.40  39.60 -9.07
    40.15 -8.87  40.64 -8.75  41.15 -8.67  41.69 -8.85  41.87 -8.87  42.12 -8.86  42.30 -8.90  42.55 -9.05
    42.88 -9.27  43.15 -9.20  43.37 -8.40  43.55 -8.10  43.79 -7.69  43.56 -7.04  43.57 -6.30  43.66 -5.85
    43.54 -5.40  43.48 -4.50  43.47 -3.80  43.40 -3.40  43.35 -3.00  43.40 -2.50  43.32 -1.98  43.49 -1.53
    44.10 -1.33  44.65 -1.25  45.00 -1.20  45.57 -1.06  45.75 -1.20  46.00 -1.10  46.16 -1.20  46.35 -1.45
    46.50 -1.79  46.80 -2.10  47.05 -2.20  47.27 -2.20  47.30 -2.50  47.48 -2.85  47.55 -3.12  47.73 -3.37
    47.80 -3.90  47.85 -4.30  48.04 -4.73  48.28 -4.60  48.38 -4.75  48.65 -4.55  48.72 -3.98  48.82 -3.45
    48.70 -3.00  48.55 -2.75  48.65 -2.30  48.65 -2.03  48.65 -1.50  48.84 -1.60  49.20 -1.60  49.55 -1.85
    49.72 -1.94  49.65 -1.62  49.67 -1.26  49.40 -1.20  49.35 -0.90  49.34 -0.40  49.40 0.20   49.50 0.10
    49.70 0.25   49.76 0.37   49.88 0.80   49.93 1.08   50.05 1.38   50.20 1.60   50.45 1.58   50.73 1.60
    50.87 1.58
    50.90 1.60  51.04 2.37  51.23 2.92  51.37 3.36  51.38 3.58  51.33 3.85  51.35 4.05  51.31 4.24
    51.40 4.21  51.43 4.00  51.45 3.75  51.47 3.55  51.56 3.44  51.66 3.68  51.75 3.85  51.84 3.97
    51.98 4.12  52.10 4.27  52.22 4.42  52.46 4.56  52.65 4.63  52.80 4.66  52.96 4.75  52.90 4.95
    52.77 5.10  52.68 5.25  52.55 5.10  52.47 5.06  52.40 4.93  52.38 4.97  52.34 5.08  52.31 5.23
    52.35 5.50  52.43 5.72  52.55 5.86  52.70 5.75  52.84 5.62  52.92 5.38  53.05 5.40  53.17 5.42
    53.30 5.62  53.39 5.98  53.44 6.40  53.40 6.80  53.32 7.02  53.23 7.18  53.31 7.25  53.42 7.07
    53.60 7.18  53.69 7.50  53.71 7.90  53.65 8.05  53.52 8.08  53.40 8.13  53.38 8.25  53.50 8.30
    53.62 8.42  53.55 8.52  53.42 8.50  53.40 8.56  53.56 8.61  53.76 8.56  53.87 8.70  53.82 8.95
    53.74 9.25  53.64 9.50  53.60 9.62  53.72 9.47  53.83 9.30  53.90 9.10  54.00 8.85  54.11 8.83
    54.25 8.82  54.30 8.62  54.40 8.62  54.48 8.98  54.60 8.85  54.80 8.70  55.00 8.62  55.30 8.65
    55.47 8.45  55.56 8.08  55.80 8.17  56.09 8.13  56.40 8.12  56.70 8.22  56.95 8.40  57.12 8.60
    57.20 9.00  57.40 9.60  57.59 9.96  57.75 10.60 57.55 10.55 57.44 10.53 57.25 10.45 57.07 10.32
    56.75 10.30 56.55 10.25 56.48 10.55 56.42 10.92 56.20 10.70 56.15 10.45 56.16 10.24 56.00 10.25
    55.85 10.00 55.70 9.75  55.57 9.72  55.45 9.66  55.30 9.55  55.10 9.50  55.04 9.42  54.92 9.62
    54.85 9.75  54.80 9.47  54.78 9.62  54.80 9.90  54.68 10.03 54.50 10.00 54.45 9.85  54.42 10.05
    54.33 10.15 54.45 10.20 54.42 10.50 54.33 10.90 54.35 11.00 54.25 11.08 54.05 10.85 53.96 10.87
    53.97 11.05 53.93 11.30 53.89 11.46 54.00 11.55 54.10 11.75 54.18 12.08 54.30 12.35 54.45 12.55
    54.40 12.80 54.42 12.95 54.35 13.05 54.31 13.11 54.20 13.25 54.15 13.45 54.15 13.68 54.05 13.72
    53.90 13.80 53.75 13.90 53.70 14.20 53.60 14.45 53.68 14.60 53.80 14.55 53.88 14.37 53.94 14.36
    54.00 14.70 54.06 15.00 54.18 15.58 54.30 15.90 54.42 16.41 54.58 16.86 54.68 17.20 54.76 17.55
    54.80 18.00 54.83 18.33 54.79 18.42 54.70 18.66 54.60 18.82 54.57 18.78 54.67 18.60 54.73 18.44
    54.68 18.43 54.60 18.50 54.52 18.56 54.43 18.59 54.40 18.70 54.35 18.95 54.43 19.40 54.55 19.84
    54.50 19.78 54.39 19.35 54.30 19.10 54.24 19.32 54.33 19.68 54.44 19.95 54.55 20.15 54.66 20.32
    54.69 20.15 54.66 19.95 54.70 19.93 54.85 19.95 54.96 20.00 54.96 20.48 55.10 20.76 55.30 20.95
    55.50 21.05 55.64 21.08 55.60 21.02 55.45 20.97 55.25 20.86 55.05 20.66 54.98 20.52 55.02 21.02
    55.15 21.25 55.35 21.30 55.55 21.25 55.69 21.17 55.92 21.06 56.20 21.00 56.50 21.00 56.90 21.10
    57.15 21.40 57.39 21.53 57.60 21.75 57.76 22.59 57.50 22.95 57.20 23.20 57.00 23.60 57.03 24.07
    57.25 24.38 57.60 24.38 57.90 24.35 58.10 24.45 58.35 24.45 58.30 24.00 58.45 23.75 58.60 23.50
    58.75 23.45 58.95 23.55 59.15 23.45 59.30 23.80 59.35 24.10 59.45 24.50 59.46 24.75 59.50 25.10
    59.60 25.60 59.55 26.00 59.50 26.60 59.45 27.50 59.42 28.05 59.70 28.50 59.90 29.50 59.95 30.30
    60.20 29.50 60.50 28.50 60.45 27.20 60.35 26.00 60.18 25.00 60.05 24.40 59.95 23.90 59.85 23.30
    59.82 22.95 60.05 22.50 60.30 22.00 60.45 21.40 60.90 21.30 61.50 21.50 62.50 21.00 63.10 21.50
    64.00 23.50 65.00 25.30 65.80 24.50 65.50 22.00 64.70 21.20 63.80 20.30 63.00 18.50 62.40 17.50
    61.70 17.20 60.70 17.20 60.50 17.60 60.35 18.40 60.10 18.85 59.85 19.00 59.60 18.85 59.40 18.60
    59.35 18.30 59.20 18.40 59.00 18.00 58.85 17.75 58.75 17.10 58.60 16.85 58.62 16.30 58.45 16.60
    58.20 16.80 57.95 16.70 57.75 16.65 57.40 16.60 57.25 16.50 56.95 16.45 56.66 16.38 56.40 16.10
    56.18 15.90 56.15 15.60 56.17 14.86 56.05 14.60 55.95 14.30 55.60 14.35 55.43 13.82 55.37 13.15
    55.40 12.85 55.60 13.02 55.75 13.00 55.95 12.85 56.05 12.82 56.20 12.62 56.30 12.45 56.25 12.85
    56.45 12.90 56.67 12.86 56.90 12.50 57.10 12.25 57.40 12.00 57.69 11.85 57.90 11.65 58.10 11.55
    58.35 11.30 58.60 11.25 58.94 11.12 59.10 11.00 59.20 10.95 59.40 10.65 59.65 10.62 59.90 10.75
    59.75 10.45 59.55 10.40 59.30 10.45 59.05 10.15 58.95 9.75  58.85 9.40  58.65 9.05  58.45 8.77
    58.25 8.40  58.15 8.00  58.05 7.50  57.98 7.05  58.10 6.65  58.30 6.20  58.50 5.75  58.75 5.55
    58.97 5.65  59.30 5.30  59.60 5.30  60.00 5.10  60.40 5.20  61.00 4.90  62.00 5.00
    62.47 6.15   62.73 7.16   63.10 7.75   63.45 8.70   63.70 9.60   64.50 10.70  65.10 11.60  65.50 12.20
    66.00 12.60  66.70 13.20  67.28 14.40  67.90 15.00  68.40 16.00  68.80 16.60  69.20 17.80  69.65 18.95
    70.00 20.20  70.30 21.50  70.66 23.68  71.00 25.00  71.17 25.78  70.95 26.50  71.05 27.80  70.70 29.00
    70.37 31.10  69.80 30.80  69.70 32.00  69.40 33.50  69.20 35.00  69.05 36.50  68.40 38.80  68.15 39.75
    66.70 41.00  66.20 39.20  66.30 37.00  66.60 34.80  67.10 32.50  66.40 33.60  65.80 34.40  64.95 34.65
    64.30 35.60  63.90 37.20  63.95 38.10  64.55 40.55  65.20 40.00  65.80 40.50  66.10 42.20  66.00 44.10
    66.60 43.80  67.60 43.50  68.65 43.30  68.20 45.40  67.60 46.50
    66.00 50.00  60.00 62.00  45.00 62.00  35.00 62.00  25.00 50.00  22.00 30.00  24.00 0.00   26.00 -15.00
    28.00 -13.20 29.38 -10.17 30.42 -9.60  30.63 -9.89  31.51 -9.77  32.30 -9.24  32.55 -9.28  33.25 -8.51
    33.60 -7.62  34.02 -6.84  34.26 -6.58  35.20 -6.16  35.47 -6.03  35.79 -5.93  35.78 -5.81  35.84 -5.56
    35.89 -5.31  35.60 -5.25  35.20 -4.40  35.25 -3.93  35.44 -2.96  35.10 -2.20  35.30 -1.40  35.70 -0.64
    35.93 0.09   36.51 1.31   36.60 2.40   36.77 3.06   36.90 3.90   36.75 5.08   36.85 5.75   37.00 6.57
    36.90 7.77   36.95 8.75   37.27 9.87   36.85 10.32  37.08 11.05  36.45 10.75  35.83 10.64  35.50 11.06
    34.74 10.76  34.30 10.10  33.88 10.10  33.50 10.90  33.15 11.50  32.89 13.19  32.65 14.26  32.38 15.10
    31.30 15.90  30.90 16.60  30.40 18.40  30.60 19.50  31.20 20.00  32.10 20.05  32.90 21.70  32.76 22.64
    32.08 23.97  31.56 25.16  31.35 27.24  31.20 29.90  31.40 30.40  31.52 31.84  31.27 32.30  31.10 33.70
    31.50 34.45  32.08 34.77  32.82 34.98  33.27 35.20  33.90 35.48  34.43 35.83  35.52 35.77  36.20 35.90
    36.58 36.17  36.98 35.70  36.70 35.20  36.80 34.64  36.40 33.93  36.02 32.80  36.54 32.00  36.80 31.40
    36.89 30.70  36.30 30.50  36.30 30.15  36.20 29.60  36.60 29.10  36.85 28.27  36.70 27.40  37.03 27.43
    37.50 27.20  37.86 27.26  38.32 26.30  38.42 27.14  38.67 26.75  39.32 26.69  39.58 27.02  39.48 26.07
    39.95 26.35  40.08 26.62  40.30 26.92  40.40 27.30  40.35 27.97  40.37 28.88  40.65 29.20  40.76 29.92
    40.88 29.18  40.99 29.18  41.12 29.24  41.23 29.30  41.18 29.61  41.10 30.40  41.28 31.42  41.75 32.39
    41.98 33.76  42.03 35.15  41.70 35.95  41.29 36.33  41.13 37.29  40.98 37.88  40.91 38.39  41.00 39.73
    41.03 40.52  41.60 41.62  42.15 41.67  43.00 41.02  43.28 40.27  43.60 39.73  44.10 39.07  44.72 37.78
    44.89 37.32  45.20 36.62  45.27 37.38  46.05 38.17  46.71 38.27  47.10 39.40  47.20 38.90  47.05 37.55
    46.75 36.80  46.40 35.30  45.95 34.90  45.32 35.45  45.45 36.10  45.36 36.47  45.10 36.44  45.03 35.38
    44.85 34.97  44.67 34.41  44.50 34.17  44.39 33.75  44.60 33.52  45.19 33.37  45.35 32.50  45.95 33.10
    46.05 33.60  46.11 32.91  46.55 31.55  46.62 31.54  46.48 30.74  46.10 30.40  45.16 29.66  44.88 29.61
    44.17 28.65  43.36 28.47  43.20 27.95  42.50 27.47  42.42 27.70  41.88 28.00  41.63 28.10  41.23 29.08
    41.12 29.03  41.01 28.97  41.07 28.25  40.98 27.51  40.61 27.11  40.41 26.67  40.22 26.40  40.05 26.18
    40.35 26.30  40.60 26.80  40.73 26.08  40.85 25.87  41.00 25.12  40.94 24.41  40.78 23.85  40.15 24.35
    40.30 23.95  39.98 23.92  40.15 23.55  39.95 23.70  40.20 23.30  40.63 22.94  40.27 22.60  39.80 22.70
    39.36 22.94  39.15 23.25  38.90 22.85  38.88 22.50  38.60 23.00  38.46 23.60  38.15 24.00  37.65 24.02
    37.94 23.63  37.94 22.98  37.57 22.80  37.35 23.15  36.69 23.06  36.44 23.20  36.76 22.57  36.38 22.48
    37.03 22.11  36.82 21.70  36.91 21.70  37.25 21.67  37.65 21.32  37.92 21.15  38.28 21.80  38.25 22.08
    37.94 22.93  38.43 22.42  38.39 21.83  38.37 21.75  38.37 21.43  38.53 21.08  38.96 20.75  39.28 20.40
    39.50 20.27  39.75 20.02  40.47 19.49  41.32 19.45  41.85 19.40  42.09 19.09  42.42 18.70  42.65 18.08
    42.85 17.70  43.51 16.44  43.73 15.90  44.12 15.23  44.50 14.90  44.99 14.90  45.33 14.44  44.90 13.95
    44.87 13.85  45.08 13.64  45.53 13.57  45.65 13.77  45.78 13.53  45.68 13.40  45.43 12.35  45.22 12.28
    44.95 12.53  44.42 12.28  44.06 12.57  43.91 12.91  43.62 13.52  43.00 13.85  42.46 14.21  42.00 15.00
    41.88 16.18  41.63 15.92  41.32 16.28  41.13 16.87  40.64 17.94  40.15 18.49  39.80 18.36  40.06 17.99
    40.47 17.24  40.35 16.80  39.75 16.50  39.08 17.13  39.03 17.20  38.80 16.60  38.68 16.55  38.24 16.27
    37.92 16.06  38.11 15.68  38.22 15.72  38.36 15.85  38.68 15.90  38.90 16.20  39.40 16.00  39.81 15.79
    40.07 15.63  40.03 15.28  40.35 14.99  40.68 14.76  40.57 14.32  40.84 14.25  40.82 14.12  41.21 13.57
    41.28 13.25  41.23 13.05  41.45 12.62  41.73 12.28  42.09 11.80  42.40 11.15  42.93 10.50  43.55 10.31
    43.87 10.25  44.10 9.83   44.41 8.93   44.31 8.48   43.88 8.03   43.70 7.27   43.58 7.12   43.42 6.74
    43.27 6.64   43.10 5.93   43.30 5.37   43.35 4.85   43.45 4.43   43.55 4.19   43.40 3.70   43.15 3.15
    42.70 3.04   42.32 3.32   42.26 3.17   41.85 3.13   41.38 2.18   41.11 1.25   40.70 0.87   40.36 0.40
    39.98 0.03   39.45 -0.32  38.73 0.23   38.34 -0.48  37.60 -0.98  36.72 -2.19  36.83 -2.46  36.75 -3.02
    36.72 -3.52  36.72 -4.42  36.51 -4.88  36.42 -5.15  36.14 -5.35  36.13 -5.45
  ` ],
  [ "Britain", `
    51.13 1.38   51.38 1.43   51.36 1.10   51.40 0.75   51.45 0.45   51.52 0.70   51.75 0.95   51.95 1.30
    52.08 1.60   52.48 1.75   52.75 1.70   52.93 1.30   52.95 0.60   52.80 0.40   52.85 0.10   53.10 0.35
    53.50 0.15   53.58 0.11   53.75 -0.30  54.12 -0.08  54.28 -0.40  54.49 -0.61  54.63 -1.15  54.91 -1.37
    55.02 -1.42  55.77 -2.00  55.90 -2.13  56.00 -2.52  56.05 -2.85  56.00 -3.40  56.11 -3.16  56.28 -2.58
    56.34 -2.79  56.45 -2.85  56.56 -2.58  56.71 -2.47  57.15 -2.08  57.51 -1.78  57.69 -2.00  57.68 -3.00
    57.60 -3.60  57.48 -4.22  57.68 -4.03  57.86 -3.77  57.88 -4.03  58.12 -3.65  58.44 -3.09  58.64 -3.03
    58.60 -3.52  58.53 -4.40  58.62 -5.00  58.15 -5.24  57.90 -5.60  57.55 -5.80  57.25 -5.70  56.95 -5.85
    56.73 -6.23  56.41 -5.47  56.20 -5.60  55.85 -5.60  55.45 -5.70  55.31 -5.80  55.45 -5.52  55.80 -5.40
    55.95 -4.90  55.79 -4.87  55.60 -4.68  55.46 -4.63  55.00 -5.10  54.64 -4.86  54.85 -4.40  54.84 -4.05
    54.95 -3.30  54.70 -3.45  54.50 -3.62  54.11 -3.23  54.05 -2.90  53.85 -3.05  53.60 -3.05  53.42 -3.05
    53.32 -3.49  53.32 -3.83  53.42 -4.40  53.30 -4.65  53.10 -4.35  52.80 -4.71  52.89 -4.42  52.72 -4.05
    52.42 -4.10  52.08 -4.66  51.90 -5.30  51.70 -5.15  51.67 -4.70  51.57 -4.30  51.58 -3.80  51.45 -3.18
    51.62 -2.62  51.50 -2.71  51.35 -2.98  51.22 -3.45  51.23 -4.20  51.05 -4.20  51.00 -4.53  50.83 -4.55
    50.55 -4.95  50.41 -5.08  50.21 -5.48  50.07 -5.71  49.96 -5.20  50.15 -5.05  50.37 -4.14  50.22 -3.65
    50.62 -3.41  50.70 -2.95  50.52 -2.45  50.61 -1.96  50.72 -1.75  50.80 -1.10  50.73 -0.78  50.82 -0.14
    50.74 0.25   50.86 0.58   50.91 0.98   51.08 1.18 ` ],
  [ "Ireland", `
    55.38 -7.37  55.20 -6.65  55.22 -6.15  54.85 -5.81  54.67 -5.62  54.35 -5.48  54.05 -6.05  53.72 -6.24
    53.35 -6.20  53.00 -6.03  52.80 -6.15  52.17 -6.36  52.15 -6.95  52.09 -7.62  51.80 -8.27  51.70 -8.52
    51.62 -8.88  51.45 -9.82  51.65 -10.15 51.95 -10.30 52.10 -10.46 52.30 -9.85  52.56 -9.93  52.68 -9.65
    52.97 -9.43  53.27 -9.05  53.40 -10.10 53.49 -10.02 53.96 -10.20 54.22 -9.99  54.25 -9.20  54.28 -8.47
    54.63 -8.44  54.64 -8.72  54.71 -8.73  55.15 -8.28  55.21 -7.98  55.27 -7.63 ` ],
  [ "Corsica", ` 43.00 9.42  42.70 9.45  42.10 9.55  41.65 9.40  41.38 9.20  41.60 8.80  41.92 8.70  42.25 8.55
    42.55 8.75  42.68 9.30  42.97 9.35 ` ],
  [ "Sardinia", ` 41.24 9.19  40.92 9.50  40.38 9.70  39.94 9.70  39.14 9.52  39.21 9.11  38.88 8.85  39.05 8.40
    39.40 8.40  39.90 8.53  40.30 8.48  40.56 8.16  40.94 8.22  40.91 8.71  41.10 9.00 ` ],
  [ "Sicily", ` 38.27 15.45  38.19 15.42  37.85 15.29  37.50 15.10  37.08 15.29  36.68 15.13  36.73 14.85  37.06 14.25
    37.29 13.56  37.51 13.08  37.65 12.59  37.80 12.43  38.02 12.51  38.18 12.73  38.12 13.36  37.98 13.70
    38.04 14.02  38.16 14.75  38.22 15.24 ` ],
  [ "Crete", ` 35.60 23.58  35.52 24.02  35.37 24.47  35.34 25.13  35.19 25.72  35.31 26.31  35.00 26.10  35.00 25.74
    34.93 24.90  35.20 24.14  35.25 23.55 ` ],
  [ "Rhodes", ` 36.45 28.23  36.10 28.10  35.88 27.75  36.10 27.70  36.35 27.85 ` ],
  [ "Cyprus", ` 35.70 34.58  35.12 33.94  34.96 34.08  34.68 33.04  34.77 32.42  35.05 32.27  35.19 32.95  35.34 33.32
    35.40 33.90 ` ],
  [ "Euboea", ` 38.95 23.00  39.00 23.25  38.75 23.60  38.63 24.10  38.15 24.58  38.00 24.40  38.38 23.88  38.52 23.65
    38.80 23.15 ` ],
  [ "Lesbos", ` 39.21 25.85  39.37 26.17  39.25 26.48  39.10 26.46  39.00 26.20 ` ],
  [ "Chios", ` 38.60 26.05  38.45 26.15  38.30 26.15  38.15 26.00  38.35 25.85 ` ],
  [ "Corfu", ` 39.78 19.70  39.70 19.95  39.60 19.92  39.38 20.11  39.55 19.80  39.70 19.65 ` ],
  [ "Mallorca", ` 39.96 3.21  39.70 3.45  39.27 3.05  39.57 2.65  39.60 2.35  39.79 2.69 ` ],
  [ "Menorca", ` 40.08 3.85  40.00 4.25  39.85 4.30  39.95 3.85 ` ],
  [ "Ibiza", ` 39.10 1.55  39.00 1.60  38.85 1.40  38.95 1.20  39.05 1.30 ` ],
  [ "Zealand",        ` 56.03 12.46 55.95 12.42 55.80 12.48 55.68 12.52 55.55 12.40 55.45 12.20 55.30 12.45
    55.15 12.20 55.00 11.90 55.10 11.70 55.20 11.25 55.33 11.14 55.50 11.10 55.68 11.09 55.75 10.95
    55.90 11.35 55.98 11.70 55.97 11.85 55.85 11.95 56.00 12.10 56.12 12.30 ` ],
  [ "Funen",          ` 55.60 10.10 55.55 10.45 55.52 10.70 55.31 10.80 55.10 10.75 55.05 10.60 55.08 10.25
    55.28 9.95  55.42 9.88  55.50 9.83 ` ],
  [ "Lolland-Falster", ` 54.85 11.00 54.95 11.15 54.85 11.50 54.95 11.85 54.85 12.00 54.57 11.95 54.65 11.70
    54.65 11.35 54.75 11.05 ` ],
  [ "Fehmarn",        ` 54.52 11.00 54.53 11.25 54.43 11.30 54.42 11.05 ` ],
  [ "Rügen",          ` 54.68 13.42 54.58 13.70 54.35 13.70 54.25 13.55 54.30 13.30 54.40 13.20 54.50 13.12
    54.60 13.25 ` ],
  [ "Usedom",         ` 54.10 13.86 54.05 14.10 53.93 14.26 53.85 14.10 53.95 13.98 ` ],
  [ "Bornholm",       ` 55.30 14.78 55.30 15.15 55.00 15.15 54.98 14.70 ` ],
  [ "Öland",          ` 57.36 17.07 57.20 16.98 56.90 16.85 56.50 16.62 56.20 16.40 56.50 16.47 56.90 16.67
    57.20 16.92 ` ],
  [ "Gotland",        ` 57.95 19.30 57.65 18.95 57.30 18.80 56.92 18.30 56.92 18.12 57.10 18.15 57.45 18.35
    57.64 18.27 57.85 18.75 ` ],
  [ "Saaremaa",       ` 58.55 22.00 58.45 22.90 58.30 23.05 58.00 22.40 57.92 22.05 58.20 21.90 58.40 21.85 ` ],
  [ "Hiiumaa",        ` 59.00 22.50 58.95 23.00 58.80 22.95 58.70 22.55 58.90 22.40 ` ],
  [ "Åland",          ` 60.40 19.65 60.40 20.30 60.05 20.30 60.00 19.75 ` ],
  [ "Texel",          ` 53.18 4.86 53.05 4.91 53.00 4.76 53.15 4.72 ` ],
];

// ---------------------------------------------------------------------------------------------------------
// Waste: land in the map's rectangle that the game leaves to nobody — grey, held by no one, crossed by no road (it may run
// through the sea, which stays sea). The Sahara south of the Atlas; Libya east of Misrata, Cyrenaica and Egypt (the Mamluks
// are not in the game); the Levant, Syria and Mesopotamia, up to the Taurus and the edge of Anatolia. Its long edges are drawn
// point by point along their parallel: a straight line between far points would cut a corner off the map.
// ---------------------------------------------------------------------------------------------------------
const WASTE = [
  [ "south and east", `
    29.90 -16.00 29.90 -9.50  30.90 -8.00  31.20 -6.00  32.00 -4.00  32.30 -1.50  33.40 1.00   34.00 3.00
    34.40 5.00   34.20 7.00   33.60 8.50   33.20 9.80   32.40 11.00  31.90 12.50  32.00 14.50  32.60 15.30
    33.00 15.30  33.00 33.00  34.00 35.00  35.80 35.60  36.40 35.75  36.80 36.30  36.95 37.50  37.00 38.50
    37.20 40.00  37.20 50.00  20.00 50.00  20.00 45.00  20.00 40.00  20.00 35.00
    20.00 30.00  20.00 25.00  20.00 20.00  20.00 15.00  20.00 10.00  20.00 5.00
    20.00 0.00  20.00 -5.00  20.00 -10.00  20.00 -15.00  20.00 -16.00 ` ],
];

// Islands with no settlement of their own (or more land than theirs reaches), given to one: ring name -> settlement
const ISLAND_OWNER = {
    "Corsica": "Bastia", "Sardinia": "Cagliari", "Sicily": "Palermo", "Crete": "Candia", "Cyprus": "Nicosia", "Rhodes": "Rhodes",
    "Euboea": "Negroponte", "Lesbos": "Mytilene", "Chios": "Chios", "Corfu": "Corfu", "Mallorca": "Palma", "Menorca": "Palma",
    "Ibiza": "Palma", "Zealand": "Copenhagen", "Funen": "Odense", "Lolland-Falster": "Copenhagen", "Fehmarn": "Schleswig",
    "Rügen": "Stralsund", "Usedom": "Stettin", "Bornholm": "Lund", "Öland": "Kalmar", "Gotland": "Visby", "Saaremaa": "Pernau",
    "Hiiumaa": "Reval", "Åland": "Stockholm", "Texel": "Amsterdam",
};
// Pieces of mainland cut off by the map edge, given to a settlement by a point inside them
const PIECE_OWNER = [];
// Extra seeds of a settlement's land (points it is grown from besides itself), by name: step 3
const SEEDS = {};

// ---------------------------------------------------------------------------------------------------------
// Rivers: lat lon from source to the mouth (the last point is moved onto the coast), or to where it leaves the land shown
// ---------------------------------------------------------------------------------------------------------
const RIVERS = [
  [ "Rhine",   ` 46.63 8.67  46.85 9.53  47.25 9.60  47.50 9.65  47.62 9.30  47.66 9.10  47.70 8.63  47.58 8.20
    47.56 7.59  48.03 7.58  48.58 7.80  49.00 8.30  49.32 8.44  49.49 8.46  49.63 8.37  50.00 8.27  49.97 7.90
    50.10 7.70  50.36 7.60  50.73 7.10  50.94 6.96  51.23 6.77  51.43 6.75  51.66 6.60  51.83 6.25  51.85 5.86
    51.88 5.43  51.83 4.97  51.81 4.67  51.92 4.48  51.98 4.12 ` ],
  [ "Rhône",   ` 46.40 6.93  46.50 6.63  46.20 6.14  46.11 5.83  45.96 5.83  45.85 5.40  45.76 4.84  45.10 4.85  44.93 4.89
    44.56 4.75  44.14 4.81  43.95 4.81  43.68 4.63  43.35 4.85 ` ],
  [ "Danube",  ` 47.95 8.50  48.09 9.22  48.40 9.99  48.72 10.78 48.76 11.43 48.92 11.88 49.02 12.10 48.88 12.57
    48.83 12.96 48.57 13.46 48.31 14.29 48.24 14.52 48.18 15.08 48.23 15.33 48.41 15.60 48.33 16.05 48.21 16.37
    48.15 16.94 48.14 17.11 47.76 18.12 47.79 18.74 47.78 19.13 47.50 19.04 46.96 18.94 46.62 18.86 46.18 18.95
    45.99 18.68 45.30 19.00 45.25 19.85 44.82 20.46 44.66 20.93 44.66 21.63 44.63 22.66 43.99 22.88 43.83 23.24
    43.70 24.90 43.62 25.35 43.85 25.97 44.12 27.27 44.69 27.95 45.27 27.96 45.44 28.05 45.27 28.46 45.18 28.80
    45.16 29.66 ` ],
  [ "Elbe",    ` 50.78 15.54 50.36 15.92 50.21 15.83 50.04 15.78 50.03 15.20 50.19 15.04 50.35 14.47 50.53 14.13
    50.66 14.04 50.78 14.21 50.96 13.94 51.05 13.74 51.16 13.47 51.31 13.29 51.56 13.00 51.87 12.65 51.84 12.24
    52.13 11.64 52.54 11.97 52.83 12.07 53.00 11.75 53.14 11.25 53.37 10.56 53.55 9.99  53.62 9.62 ` ],
  [ "Oder",    ` 49.60 17.50 49.84 18.29 50.09 18.22 50.35 18.20 50.67 17.93 50.86 17.47 51.11 17.03 51.41 16.43
    51.66 16.08 51.80 15.72 52.05 15.10 52.34 14.55 52.59 14.65 53.06 14.28 53.20 14.39 53.43 14.55 53.62 14.52 ` ],
  [ "Vistula", ` 49.60 18.95 50.03 19.20 50.06 19.94 50.68 21.75 50.89 21.86 51.42 21.96 51.56 21.85 52.23 21.02
    52.43 20.72 52.55 19.70 52.65 19.07 53.01 18.60 53.35 18.43 53.48 18.75 54.09 18.78 54.40 18.72 ` ],
  [ "Weser",   ` 50.90 9.65  51.31 9.49  51.42 9.65  51.77 9.38  52.10 9.36  52.29 8.92  52.64 9.21  52.92 9.23
    53.08 8.80  53.40 8.55 ` ],
  [ "Meuse",   ` 48.08 5.60  48.36 5.70  49.16 5.38  49.70 4.94  49.77 4.72  50.14 4.82  50.26 4.91  50.47 4.87
    50.52 5.24  50.63 5.58  50.85 5.69  51.19 5.99  51.37 6.17  51.76 5.74  51.75 5.30  51.83 4.97 ` ],
  [ "Neman",   ` 53.68 23.83 54.02 23.97 54.40 24.05 54.90 23.90 55.08 22.77 55.08 21.88 55.30 21.30 ` ],
  [ "Daugava", ` 56.85 32.50 55.90 30.90 55.49 28.79 55.87 26.53 56.50 25.86 56.82 24.60 56.95 24.11 57.05 24.03 ` ],
  [ "Seine",   ` 47.48 4.72  48.30 4.08  48.38 2.95  48.54 2.66  48.86 2.35  48.99 2.10  49.09 1.48  49.24 1.41
    49.44 1.10  49.53 0.73  49.45 0.20 ` ],
  [ "Loire",   ` 44.84 4.22  45.43 4.39  46.04 4.07  46.48 3.98  46.99 3.16  47.41 2.93  47.90 1.90  47.59 1.33
    47.39 0.69  47.26 -0.07 47.42 -0.52 47.22 -1.55 47.27 -2.20 ` ],
  [ "Garonne", ` 42.70 0.95  43.11 0.72  43.60 1.44  44.04 1.11  44.20 0.62  44.50 0.17  44.84 -0.58 45.20 -0.70
    45.57 -1.06 ` ],
  [ "Thames",  ` 51.69 -2.03 51.75 -1.26 51.46 -0.97 51.51 -0.12 51.47 0.40  51.50 0.70 ` ],
  [ "Ebro",    ` 43.00 -4.25 42.69 -2.95 42.46 -2.44 42.06 -1.60 41.65 -0.88 41.23 -0.04 41.37 0.30  40.82 0.52
    40.70 0.87 ` ],
  [ "Tagus",   ` 40.30 -1.80 40.40 -2.70 40.03 -3.60 39.86 -4.02 39.96 -4.83 39.80 -5.67 39.72 -6.88 39.65 -7.68
    39.46 -8.20 39.24 -8.69 38.85 -9.05 38.70 -9.25 ` ],
  [ "Douro",   ` 41.99 -2.88 41.76 -2.47 41.61 -3.69 41.50 -5.00 41.50 -5.74 41.50 -6.27 41.03 -6.93 41.16 -7.79
    41.14 -8.67 ` ],
  [ "Guadalquivir", ` 37.82 -2.95 38.01 -3.37 38.04 -4.05 37.88 -4.78 37.70 -5.28 37.39 -5.99 37.00 -6.20 36.78 -6.38 ` ],
  [ "Po",      ` 44.70 7.10  45.07 7.69  45.19 7.89  45.13 8.45  45.12 9.25  45.05 9.69  45.13 10.02 45.05 10.75
    45.07 11.14 44.89 11.61 44.96 11.75 44.95 12.53 ` ],
  [ "Dnieper", ` 55.87 33.70 54.78 32.04 54.51 30.42 53.90 30.33 52.36 30.39 51.30 30.30 50.45 30.52 49.75 31.46
    49.43 32.06 49.07 33.42 48.46 35.04 47.80 35.17 47.57 34.39 46.81 33.48 46.63 32.62 46.55 31.90 46.55 31.55 ` ],
  [ "Dniester", ` 49.10 23.05 49.13 24.72 48.62 26.60 48.45 27.80 48.16 28.30 47.27 29.16 46.84 29.64 46.38 30.08
    46.08 30.47 ` ],
  [ "Don",     ` 54.01 38.29 52.40 38.95 51.66 39.21 50.45 40.10 49.50 40.80 48.50 40.90 47.60 40.60 47.23 39.72
    47.10 39.42 ` ],
  [ "Volga",   ` 57.25 32.47 56.86 35.92 56.87 37.36 57.53 38.33 58.05 38.83 57.63 39.87 57.77 40.93 57.45 42.15 ` ],
];

// ---------------------------------------------------------------------------------------------------------
// Sea zones: a divider is drawn from its middle out to the nearest coast (or the map's edge) at each end; a zone is named at
// a point inside it
// ---------------------------------------------------------------------------------------------------------
const DIVIDERS = [
  ` 57.15 8.55  57.95 7.10 `,          // North Sea | Skagerrak (Hanstholm - Lindesnes)
  ` 57.75 10.65 57.92 11.55 `,         // Skagerrak | Kattegat (Skagen - Marstrand)
  ` 55.76 10.92 55.87 10.05 `,         // Kattegat | Belt Sea (north of Funen)
  ` 55.30 12.47 55.40 12.83 `,         // Kattegat (with the Øresund) | Baltic Sea (Stevns - Falsterbo)
  ` 55.00 11.97 54.90 11.97 `,         // Belt Sea | Baltic Sea (between Zealand and Falster)
  ` 54.57 11.97 54.45 12.53 `,         // Belt Sea | Baltic Sea (Gedser - Darß)
  ` 57.45 16.66 57.30 18.22 `,         // Baltic Sea | Northern Baltic (north of Öland - Gotland)
  ` 57.20 18.85 56.70 21.02 `,         // Baltic Sea | Northern Baltic (Gotland - Courland)
  ` 57.75 22.62 57.93 22.08 `,         // Northern Baltic | Gulf of Riga (Irbe strait)
  ` 58.42 22.95 58.58 23.48 `,         // Northern Baltic | Gulf of Riga (Moon Sound)
  ` 61.50 17.10 61.50 21.60 `,         // Northern Baltic | Gulf of Bothnia (across the Bothnian Sea)
  ` 59.82 22.95 59.15 23.45 `,         // Northern Baltic | Gulf of Finland (Hanko - Estonia)
  ` 58.64 -3.03 61.00 4.90 `,          // North Sea | Norwegian Sea (Duncansby Head - Norway)
  ` 58.62 -5.00 58.62 -9.00 `,         // Norwegian Sea | Atlantic (Cape Wrath, out west)
  ` 66.25 39.50 65.90 40.60 `,         // Norwegian Sea | White Sea (the Gorlo)
  ` 51.04 1.62  51.13 1.38 `,          // North Sea | English Channel (Strait of Dover)
  ` 48.45 -4.80 50.10 -5.45 `,         // English Channel | Atlantic (Ushant - Land's End: aimed at Penwith, not past it)
  ` 51.90 -5.30 52.25 -6.30 `,         // Irish Sea | Atlantic (St David's - Carnsore Point)
  ` 55.31 -5.80 55.22 -6.15 `,         // Irish Sea | Atlantic (North Channel)
  ` 43.79 -7.69 48.04 -4.73 `,         // Atlantic | Bay of Biscay (Estaca de Bares - Pointe du Raz)
  ` 42.88 -9.27 42.88 -9.80 `,         // Atlantic | Gulf of Cádiz (Cape Finisterre, out west)
  ` 36.01 -5.60 35.78 -5.81 `,         // Gulf of Cádiz | Alboran Sea (Strait of Gibraltar)
  ` 36.72 -2.19 35.77 -0.80 `,         // Alboran Sea | Western Mediterranean (Cabo de Gata - Cap Falcon)
  ` 43.55 7.15  42.56 8.75 `,          // Western Mediterranean | Ligurian Sea (Antibes - Calvi)
  ` 42.93 10.50 42.95 9.45 `,          // Ligurian Sea | Tyrrhenian Sea (Piombino - Corsica)
  ` 41.38 9.20  41.24 9.19 `,          // Western Mediterranean | Tyrrhenian Sea (Bonifacio)
  ` 38.88 8.65  36.95 8.75 `,          // Western Mediterranean | Tyrrhenian Sea (Sardinia - Tabarka)
  ` 37.80 12.43 37.08 11.05 `,         // Tyrrhenian Sea | Strait of Sicily (Marsala - Cap Bon)
  ` 38.22 15.52 38.22 15.68 `,         // Tyrrhenian Sea | Ionian Sea (Strait of Messina)
  ` 36.68 15.13 32.38 15.10 `,         // Strait of Sicily | Ionian Sea (Capo Passero - Misrata)
  ` 40.15 18.49 40.40 19.32 `,         // Ionian Sea | Adriatic Sea (Strait of Otranto)
  ` 36.44 23.20 35.60 23.58 `,         // Ionian Sea | Aegean Sea (Cape Malea - Crete)
  ` 35.25 23.55 32.90 22.60 `,         // Ionian Sea | Levantine Sea (Crete - Cyrenaica)
  ` 35.31 26.31 35.90 27.75 `,         // Aegean Sea | Levantine Sea (Crete - Rhodes)
  ` 36.43 28.00 36.70 27.60 `,         // Aegean Sea | Levantine Sea (Rhodes - Datça)
  ` 40.22 26.40 40.14 26.50 `,         // Aegean Sea | Sea of Marmara (the Dardanelles)
  ` 41.12 29.03 41.12 29.13 `,         // Sea of Marmara | Western Black Sea (the Bosporus)
  ` 44.39 33.75 42.02 33.33 `,         // Western Black Sea | Eastern Black Sea (Cape Sarych - Cape Kerempe)
  ` 45.40 36.50 45.30 36.70 `,         // Eastern Black Sea | Sea of Azov (the north end of the Kerch strait)
];
const ZONES = [
    ["Norwegian Sea", 66.0, 5.0], ["White Sea", 65.0, 37.5], ["North Sea", 55.0, 3.5], ["Skagerrak", 58.0, 9.2],
    ["Kattegat", 57.0, 11.3], ["Belt Sea", 54.75, 10.7], ["Baltic Sea", 55.4, 17.0], ["Northern Baltic", 58.6, 20.0],
    ["Gulf of Riga", 57.6, 23.6], ["Gulf of Bothnia", 63.0, 20.0], ["Gulf of Finland", 59.8, 26.0], ["English Channel", 50.1, -2.0],
    ["Irish Sea", 53.6, -5.0], ["Atlantic", 49.5, -8.0], ["Bay of Biscay", 45.5, -3.5], ["Gulf of Cádiz", 36.6, -7.5],
    ["Alboran Sea", 36.0, -3.5], ["Western Mediterranean", 39.5, 4.5], ["Ligurian Sea", 43.6, 8.8], ["Tyrrhenian Sea", 40.0, 12.5],
    ["Strait of Sicily", 35.5, 12.5], ["Ionian Sea", 37.5, 18.5], ["Adriatic Sea", 43.0, 15.5], ["Aegean Sea", 38.8, 25.0],
    ["Levantine Sea", 34.0, 30.0], ["Sea of Marmara", 40.75, 28.2], ["Western Black Sea", 43.5, 30.5],
    ["Eastern Black Sea", 42.8, 37.0], ["Sea of Azov", 46.3, 36.8],
];

// ---------------------------------------------------------------------------------------------------------
// Mountain passes: id, lat, lon, routes (settlement name pairs) that go through it
// ---------------------------------------------------------------------------------------------------------
const PASSES = [
    ["P1",  46.56,  8.57, [ ["Lucerne", "Como"] ] ],                                  // St Gotthard
    ["P2",  47.13, 10.21, [ ["Innsbruck", "Zürich"] ] ],                              // Arlberg
    ["P3",  47.00, 11.50, [ ["Innsbruck", "Bozen"] ] ],                               // Brenner
    ["P4",  47.63, 15.83, [ ["Wiener Neustadt", "Graz"] ] ],                          // Semmering
    ["P5",  50.70, 13.95, [ ["Prague", "Dresden"] ] ],                                // Nollendorf, Ore Mountains
    ["P6",  49.32, 12.90, [ ["Plzeň", "Straubing"], ["Plzeň", "Amberg"] ] ],  // Cham, Bohemian Forest
    ["P7",  50.42, 16.20, [ ["Kutná Hora", "Breslau"] ] ],  // Náchod, Sudetes
    ["P8",  49.53, 18.80, [ ["Besztercebánya", "Kraków"] ] ],  // Jablunka, Carpathians
    ["P9",  49.40, 21.70, [ ["Kassa", "Przemyśl"], ["Kassa", "Kraków"] ] ], // Dukla, Carpathians
    ["P10", 48.88, 23.13, [ ["Halicz", "Debrecen"], ["Halicz", "Kassa"], ["Halicz", "Kolozsvár"] ] ], // Verecke
    ["P11", 48.74,  7.33, [ ["Nancy", "Strasbourg"] ] ],                              // Saverne, Vosges
    ["P12", 45.87,  7.17, [ ["Lausanne", "Turin"], ["Geneva", "Turin"] ] ],           // Great St Bernard
    ["P13", 45.26,  6.90, [ ["Chambéry", "Turin"], ["Grenoble", "Turin"] ] ],         // Mont Cenis
    ["P14", 43.02, -1.33, [ ["Pamplona", "Bayonne"] ] ],                              // Roncesvalles
    ["P15", 42.80, -0.53, [ ["Huesca", "Pau"] ] ],                                    // Somport
    ["P16", 42.55,  1.82, [ ["Foix", "Lleida"], ["Foix", "Perpignan"] ] ],            // Puymorens
    ["P17", 45.52, 25.37, [ ["Brassó", "Târgoviște"] ] ],                             // Bran
    ["P18", 45.55, 24.27, [ ["Szeben", "Târgoviște"] ] ],                             // Red Tower
    ["P19", 47.27, 25.10, [ ["Suceava", "Kolozsvár"] ] ],                             // Borgo
    ["P20", 42.75, 25.32, [ ["Tarnovo", "Philippopolis"] ] ],                         // Shipka, Balkan Mountains
    ["P21", 44.10, 11.27, [ ["Bologna", "Florence"] ] ],                              // Futa, Apennines
    ["P22", 37.28, 34.80, [ ["Karaman", "Adana"], ["Aksaray", "Adana"] ] ],           // Cilician Gates, Taurus
    ["P23", 62.27,  9.60, [ ["Oslo", "Nidaros"], ["Bergen", "Nidaros"] ] ],           // Dovrefjell
];

// Routes not to draw although the lands touch (over high mountains with no pass, or barely touching)
const NO_ROUTE = [
    ["Bern", "Como"], ["Lausanne", "Como"], ["Bozen", "Como"], ["Innsbruck", "Como"], ["Zürich", "Como"], ["Geneva", "Como"],
    ["Chambéry", "Como"], ["Lausanne", "Bozen"], ["Bern", "Bozen"], ["Lucerne", "Bozen"], ["Salzburg", "Bozen"], ["Graz", "Salzburg"],
    ["Bozen", "Udine"], ["Innsbruck", "Udine"], ["Lucerne", "Turin"], ["Bern", "Turin"], ["Pau", "Pamplona"], ["Pau", "Lleida"],
    ["Bayonne", "Huesca"],
];

// Sea crossings for armies (dashed lines): settlement name pairs
const STRAITS = [
    ["Copenhagen", "Lund"], ["Copenhagen", "Odense"], ["Odense", "Aarhus"], ["Visby", "Kalmar"], ["Calais", "Canterbury"],
    ["Messina", "Reggio"], ["Tangier", "Cádiz"], ["Constantinople", "Bursa"], ["Gallipoli", "Balıkesir"], ["Bastia", "Sassari"],
    ["Mytilene", "Balıkesir"], ["Chios", "Smyrna"], ["Corfu", "Arta"], ["Rhodes", "Bodrum"],
    // the islands' ways to the mainland: no island is out of reach of an army with the ships
    ["Palma", "Barcelona"], ["Bastia", "Pisa"], ["Canea", "Modon"], ["Famagusta", "Silifke"], ["Chester", "Dublin"],
];

// Mountains, drawn only: apex positions (lat lon); tools/map.js mountains moves any that touch something
const MOUNTAINS = [
  // Alps
  ` 45.75 6.60  46.00 6.90  46.30 7.10  46.45 7.70  46.40 8.10  46.55 8.50  46.65 8.95  46.75 9.45  46.55 9.90
     46.95 9.70  47.05 10.30 46.90 10.80 47.00 11.20 46.80 11.80 46.95 12.30 47.05 12.80 47.15 13.40 47.10 14.00
     47.35 14.40 47.45 15.00 46.55 12.60 46.45 13.70 46.20 11.80 46.25 10.60 44.90 6.90  44.40 7.00 `,
  // Pyrenees, the Cantabrian range, the Sierra Nevada, the meseta's sierras
  ` 42.70 -0.90 42.75 0.10  42.65 1.00  42.50 2.00  43.00 -5.00 43.05 -4.20 37.05 -3.30 40.30 -5.30 40.80 -4.00 `,
  // Massif Central, Jura, Vosges, Black Forest
  ` 45.20 2.80  45.60 2.95  44.40 3.70  46.90 6.60  47.25 7.10  48.10 7.05  47.90 8.10 `,
  // Bohemian ring, Carpathians and Tatra, the Transylvanian Alps
  ` 50.55 13.30 50.85 14.80 50.60 16.10 49.05 13.30 49.40 19.20 49.25 20.40 49.35 21.90 48.85 23.30 48.00 24.40
     47.50 24.70 47.00 25.10 46.40 22.70 45.50 23.50 45.50 24.70 45.40 25.70 `,
  // Apennines
  ` 44.30 10.30 43.90 11.60 43.30 12.60 42.70 13.20 42.10 13.90 41.40 14.60 40.70 15.40 39.90 16.10 `,
  // Dinaric Alps, the Balkan Mountains, Pindus, Rhodopes
  ` 44.70 15.60 44.00 16.60 43.50 17.70 42.90 18.90 42.50 20.00 42.80 23.80 42.70 25.20 42.80 26.20 40.00 21.10
     39.30 21.60 41.60 24.30 `,
  // the Taurus and the Pontic mountains, the Anatolian plateau's edge
  ` 37.20 31.50 37.10 32.80 37.40 34.30 37.80 35.70 40.70 38.30 40.60 39.60 40.30 41.00 39.50 38.00 `,
  // the Atlas
  ` 31.20 -7.80 31.80 -6.00 32.80 -4.50 33.60 -3.00 34.20 -1.00 34.70 1.00 35.20 3.00 35.40 5.50 `,
  // Scandinavian mountains
  ` 59.45 7.20  59.70 8.20  61.50 8.50  62.40 9.30  63.80 13.00 65.50 15.00 67.00 16.50 68.50 18.50 `,
  // the Scottish Highlands
  ` 57.00 -4.50 56.80 -5.20 57.40 -5.00 `,
];

// ---------------------------------------------------------------------------------------------------------
// Special coring (SCENARIO.md): name, what it was, and its settlements as country codes or settlement names — step 3
// ---------------------------------------------------------------------------------------------------------
const FORMABLES = [];

export {
    NAME, PROJECTION, COUNTRIES, SETTLEMENTS, SEEDS, ISLAND_OWNER, PIECE_OWNER, COAST, RIVERS, PASSES, MOUNTAINS, DIVIDERS,
    ZONES, STRAITS, NO_ROUTE, FORMABLES, WASTE,
};
