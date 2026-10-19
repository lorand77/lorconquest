// Geography of the Historical 1440 scenario, in real latitude and longitude (degrees north, east).
// make-base.js projects it onto the map. Positions are good to a few kilometres; one map unit is about 1.2 km.
"use strict";

// ---------------------------------------------------------------------------------------------------------
// Countries in 1440: code, name, capital (a settlement name below)
// ---------------------------------------------------------------------------------------------------------
const COUNTRIES = [
    ["NOR", "Norway",                 "Oslo"],
    ["SWE", "Sweden",                 "Stockholm"],
    ["DEN", "Denmark",                "Copenhagen"],
    ["GOT", "Gotland",                "Visby"],
    ["LIV", "Livonian Order",         "Riga"],
    ["SHO", "Schleswig-Holstein",     "Schleswig"],
    ["LUB", "Lübeck",                 "Lübeck"],
    ["HAM", "Hamburg",                "Hamburg"],
    ["MEC", "Mecklenburg",            "Schwerin"],
    ["POM", "Pomerania",              "Stettin"],
    ["TEU", "Teutonic Order",         "Danzig"],
    ["LIT", "Lithuania",              "Vilnius"],
    ["FRI", "Frisia",                 "Groningen"],
    ["EFR", "East Frisia",            "Emden"],
    ["OLD", "Oldenburg",              "Oldenburg"],
    ["BRE", "Bremen",                 "Bremen"],
    ["BRU", "Brunswick-Lüneburg",     "Brunswick"],
    ["MAG", "Magdeburg",              "Magdeburg"],
    ["BRA", "Brandenburg",            "Berlin"],
    ["POL", "Poland",                 "Kraków"],
    ["MAZ", "Masovia",                "Warsaw"],
    ["BUR", "Burgundy",               "Brussels"],
    ["UTR", "Utrecht",                "Utrecht"],
    ["GEL", "Guelders",               "Nijmegen"],
    ["CLE", "Cleves-Mark",            "Wesel"],
    ["MUN", "Münster",                "Münster"],
    ["KOL", "Electorate of Cologne",  "Arnsberg"],
    ["JUL", "Jülich-Berg",            "Jülich"],
    ["COL", "Cologne",                "Cologne"],
    ["LIE", "Liège",                  "Liège"],
    ["HES", "Hesse",                  "Kassel"],
    ["SAX", "Saxony",                 "Wittenberg"],
    ["ERF", "Erfurt",                 "Erfurt"],
    ["LUS", "Upper Lusatia",          "Görlitz"],
    ["SIL", "Silesia",                "Breslau"],
    ["OPP", "Opole",                  "Oppeln"],
    ["LUX", "Luxembourg",             "Luxembourg"],
    ["TRI", "Trier",                  "Trier"],
    ["MAI", "Mainz",                  "Mainz"],
    ["FFM", "Frankfurt",              "Frankfurt"],
    ["WBG", "Würzburg",               "Würzburg"],
    ["BAM", "Bamberg",                "Bamberg"],
    ["ANS", "Ansbach-Kulmbach",       "Ansbach"],
    ["NUR", "Nuremberg",              "Nuremberg"],
    ["PAL", "Palatinate",             "Heidelberg"],
    ["BOH", "Bohemia",                "Prague"],
    ["TAB", "Tábor",                  "Tábor"],
    ["MET", "Metz",                   "Metz"],
    ["LOR", "Lorraine",               "Nancy"],
    ["STR", "Strasbourg",             "Strasbourg"],
    ["BAD", "Baden",                  "Baden"],
    ["WRT", "Württemberg",            "Stuttgart"],
    ["ULM", "Ulm",                    "Ulm"],
    ["AUG", "Augsburg",               "Augsburg"],
    ["BIN", "Bavaria-Ingolstadt",     "Ingolstadt"],
    ["REG", "Regensburg",             "Regensburg"],
    ["BMU", "Bavaria-Munich",         "Munich"],
    ["BLA", "Bavaria-Landshut",       "Landshut"],
    ["PAS", "Passau",                 "Passau"],
    ["AUS", "Austria",                "Vienna"],
    ["HUN", "Hungary",                "Buda"],
    ["JIS", "Upper Hungary",          "Kassa"],
    ["DEC", "Decapolis",              "Colmar"],
    ["BAS", "Basel",                  "Basel"],
    ["KON", "Konstanz",               "Konstanz"],
    ["ZUR", "Zürich",                 "Zürich"],
    ["SWI", "Swiss Confederacy",      "Bern"],
    ["TYR", "Tyrol",                  "Innsbruck"],
    ["SAL", "Salzburg",               "Salzburg"],
    ["STY", "Inner Austria",          "Graz"],
    ["SAV", "Savoy",                  "Chambéry"],
    ["MIL", "Milan",                  "Como"],
    ["VEN", "Venice",                 "Udine"],
    ["FRA", "France",                 "Lyon"],
];

// ---------------------------------------------------------------------------------------------------------
// Settlements: name, country, lat, lon, flags (city = 20K, else a 10K town; port; hre)
// Cities are the ~20 largest towns of the map around 1440.
// ---------------------------------------------------------------------------------------------------------
const SETTLEMENTS = [
    // Scandinavia
    ["Oslo",            "NOR", 59.91, 10.75, "port"],
    ["Skien",           "NOR", 59.21,  9.61, "port"],
    ["Stavanger",       "NOR", 58.97,  5.73, "port"],
    ["Uppsala",         "SWE", 59.86, 17.64, ""],
    ["Stockholm",       "SWE", 59.33, 18.07, "port"],
    ["Linköping",       "SWE", 58.41, 15.62, ""],
    ["Älvsborg",        "SWE", 57.69, 11.92, "port"],
    ["Kalmar",          "SWE", 56.66, 16.36, "port"],
    ["Aalborg",         "DEN", 57.05,  9.92, "port"],
    ["Aarhus",          "DEN", 56.16, 10.21, "port"],
    ["Ribe",            "DEN", 55.33,  8.76, "port"],
    ["Odense",          "DEN", 55.40, 10.39, "port"],
    ["Copenhagen",      "DEN", 55.68, 12.57, "port"],
    ["Lund",            "DEN", 55.70, 13.19, ""],
    ["Visby",           "GOT", 57.64, 18.33, "port"],
    // Livonia, Lithuania, Prussia
    ["Reval",           "LIV", 59.44, 24.75, "port"],
    ["Pernau",          "LIV", 58.38, 24.50, "port"],
    ["Riga",            "LIV", 56.95, 24.11, "port"],
    ["Windau",          "LIV", 57.39, 21.56, "port"],
    ["Medininkai",      "LIT", 55.75, 22.37, ""],
    ["Kaunas",          "LIT", 54.90, 23.89, ""],
    ["Vilnius",         "LIT", 54.69, 25.28, ""],
    ["Grodno",          "LIT", 53.68, 23.83, ""],
    ["Brest",           "LIT", 52.10, 23.69, ""],
    ["Lutsk",           "LIT", 50.75, 25.33, ""],
    ["Memel",           "TEU", 55.71, 21.13, "port"],
    ["Königsberg",      "TEU", 54.71, 20.51, "port"],
    ["Danzig",          "TEU", 54.35, 18.65, "city port"],
    ["Allenstein",      "TEU", 53.78, 20.49, ""],
    ["Thorn",           "TEU", 53.01, 18.60, ""],
    ["Landsberg",       "TEU", 52.73, 15.24, ""],
    // North German coast
    ["Schleswig",       "SHO", 54.52,  9.56, "port"],
    ["Kiel",            "SHO", 54.32, 10.13, "port hre"],
    ["Lübeck",          "LUB", 53.87, 10.69, "city port hre"],
    ["Hamburg",         "HAM", 53.55,  9.99, "city port hre"],
    ["Schwerin",        "MEC", 53.63, 11.41, "hre"],
    ["Rostock",         "MEC", 54.09, 12.13, "port hre"],
    ["Stralsund",       "POM", 54.31, 13.09, "port hre"],
    ["Stettin",         "POM", 53.43, 14.55, "port hre"],
    ["Kolberg",         "POM", 54.18, 15.58, "port hre"],
    ["Stolp",           "POM", 54.46, 17.03, "hre"],
    ["Groningen",       "FRI", 53.22,  6.57, "hre"],
    ["Emden",           "EFR", 53.37,  7.21, "port hre"],
    ["Oldenburg",       "OLD", 53.14,  8.21, "hre"],
    ["Bremen",          "BRE", 53.08,  8.80, "port hre"],
    ["Lüneburg",        "BRU", 53.25, 10.41, "hre"],
    ["Hanover",         "BRU", 52.37,  9.73, "hre"],
    ["Brunswick",       "BRU", 52.27, 10.52, "city hre"],
    ["Göttingen",       "BRU", 51.53,  9.93, "hre"],
    ["Magdeburg",       "MAG", 52.13, 11.63, "city hre"],
    ["Stendal",         "BRA", 52.60, 11.86, "hre"],
    ["Prenzlau",        "BRA", 53.32, 13.86, "hre"],
    ["Brandenburg",     "BRA", 52.41, 12.55, "hre"],
    ["Berlin",          "BRA", 52.52, 13.40, "hre"],
    ["Frankfurt (Oder)", "BRA", 52.34, 14.55, "hre"],
    // Poland
    ["Inowrocław",      "POL", 52.80, 18.26, ""],
    ["Poznań",          "POL", 52.41, 16.93, ""],
    ["Kalisz",          "POL", 51.76, 18.09, ""],
    ["Łęczyca",         "POL", 52.06, 19.20, ""],
    ["Płock",           "MAZ", 52.55, 19.70, ""],
    ["Warsaw",          "MAZ", 52.23, 21.01, ""],
    ["Lublin",          "POL", 51.25, 22.57, ""],
    ["Sandomierz",      "POL", 50.68, 21.75, ""],
    ["Kraków",          "POL", 50.06, 19.94, "city"],
    ["Przemyśl",        "POL", 49.78, 22.77, ""],
    ["Lwów",            "POL", 49.84, 24.03, ""],
    // Low Countries and Lower Rhine
    ["Amsterdam",       "BUR", 52.37,  4.90, "port hre"],
    ["Dordrecht",       "BUR", 51.81,  4.67, "port hre"],
    ["Antwerp",         "BUR", 51.22,  4.40, "city port hre"],
    ["Brussels",        "BUR", 50.85,  4.35, "city hre"],
    ["Namur",           "BUR", 50.47,  4.87, "hre"],
    ["Utrecht",         "UTR", 52.09,  5.12, "hre"],
    ["Deventer",        "UTR", 52.25,  6.16, "hre"],
    ["Nijmegen",        "GEL", 51.84,  5.86, "hre"],
    ["Roermond",        "GEL", 51.19,  5.99, "hre"],
    ["Wesel",           "CLE", 51.66,  6.62, "hre"],
    ["Hamm",            "CLE", 51.68,  7.82, "hre"],
    ["Münster",         "MUN", 51.96,  7.63, "hre"],
    ["Recklinghausen",  "KOL", 51.61,  7.20, "hre"],
    ["Arnsberg",        "KOL", 51.40,  8.06, "hre"],
    ["Düsseldorf",      "JUL", 51.23,  6.78, "hre"],
    ["Jülich",          "JUL", 50.92,  6.36, "hre"],
    ["Cologne",         "COL", 50.94,  6.96, "city hre"],
    ["Liège",           "LIE", 50.63,  5.57, "city hre"],
    // Central Germany
    ["Kassel",          "HES", 51.31,  9.48, "hre"],
    ["Marburg",         "HES", 50.81,  8.77, "hre"],
    ["Eisenach",        "SAX", 50.98, 10.32, "hre"],
    ["Wittenberg",      "SAX", 51.87, 12.65, "hre"],
    ["Leipzig",         "SAX", 51.34, 12.37, "hre"],
    ["Dresden",         "SAX", 51.05, 13.74, "hre"],
    ["Zwickau",         "SAX", 50.72, 12.49, "hre"],
    ["Erfurt",          "ERF", 50.98, 11.03, "city hre"],
    ["Bautzen",         "LUS", 51.18, 14.42, "hre"],
    ["Görlitz",         "LUS", 51.15, 14.99, "hre"],
    ["Glogau",          "SIL", 51.66, 16.08, "hre"],
    ["Liegnitz",        "SIL", 51.21, 16.16, "hre"],
    ["Breslau",         "SIL", 51.11, 17.03, "city hre"],
    ["Oppeln",          "OPP", 50.67, 17.93, "hre"],
    ["Ratibor",         "OPP", 50.09, 18.22, "hre"],
    // Rhine, Moselle, Main
    ["Luxembourg",      "LUX", 49.61,  6.13, "hre"],
    ["Trier",           "TRI", 49.75,  6.64, "hre"],
    ["Koblenz",         "TRI", 50.36,  7.59, "hre"],
    ["Mainz",           "MAI", 50.00,  8.27, "hre"],
    ["Frankfurt",       "FFM", 50.11,  8.68, "hre"],
    ["Würzburg",        "WBG", 49.79,  9.93, "hre"],
    ["Bamberg",         "BAM", 49.89, 10.89, "hre"],
    ["Kulmbach",        "ANS", 50.10, 11.45, "hre"],
    ["Ansbach",         "ANS", 49.30, 10.57, "hre"],
    ["Nuremberg",       "NUR", 49.45, 11.08, "city hre"],
    ["Heidelberg",      "PAL", 49.41,  8.69, "hre"],
    ["Amberg",          "PAL", 49.44, 11.86, "hre"],
    // Bohemia, Moravia
    ["Prague",          "BOH", 50.09, 14.42, "city hre"],
    ["Plzeň",           "BOH", 49.75, 13.38, "hre"],
    ["Kutná Hora",      "BOH", 49.95, 15.27, "hre"],
    ["Hradec Králové",  "BOH", 50.21, 15.83, "hre"],
    ["Brno",            "BOH", 49.20, 16.61, "hre"],
    ["Olomouc",         "BOH", 49.59, 17.25, "hre"],
    ["Tábor",           "TAB", 49.41, 14.66, "hre"],
    // Lorraine, Alsace, Swabia
    ["Metz",            "MET", 49.12,  6.18, "city hre"],
    ["Bar",             "LOR", 48.77,  5.16, "hre"],
    ["Nancy",           "LOR", 48.69,  6.18, "hre"],
    ["Strasbourg",      "STR", 48.58,  7.75, "city hre"],
    ["Baden",           "BAD", 48.76,  8.24, "hre"],
    ["Stuttgart",       "WRT", 48.78,  9.18, "hre"],
    ["Montbéliard",     "WRT", 47.51,  6.80, "hre"],
    ["Ulm",             "ULM", 48.40,  9.99, "city hre"],
    ["Augsburg",        "AUG", 48.37, 10.90, "city hre"],
    // Bavaria, Austria
    ["Ingolstadt",      "BIN", 48.76, 11.42, "hre"],
    ["Regensburg",      "REG", 49.02, 12.10, "hre"],
    ["Straubing",       "BMU", 48.88, 12.57, "hre"],
    ["Munich",          "BMU", 48.14, 11.58, "hre"],
    ["Landshut",        "BLA", 48.54, 12.15, "hre"],
    ["Burghausen",      "BLA", 48.17, 12.83, "hre"],
    ["Passau",          "PAS", 48.57, 13.43, "hre"],
    ["Linz",            "AUS", 48.31, 14.29, "hre"],
    ["St. Pölten",      "AUS", 48.20, 15.62, "hre"],
    ["Vienna",          "AUS", 48.21, 16.37, "city hre"],
    ["Wiener Neustadt", "AUS", 47.81, 16.24, "hre"],
    // Hungary
    ["Pozsony",         "HUN", 48.14, 17.11, ""],
    ["Győr",            "HUN", 47.69, 17.63, ""],
    ["Buda",            "HUN", 47.50, 19.04, "city"],
    ["Pécs",            "HUN", 46.07, 18.23, ""],
    ["Zagreb",          "HUN", 45.81, 15.98, ""],
    ["Debrecen",        "HUN", 47.53, 21.63, ""],
    ["Kolozsvár",       "HUN", 46.77, 23.59, ""],
    ["Besztercebánya",  "JIS", 48.74, 19.15, ""],
    ["Kassa",           "JIS", 48.72, 21.26, ""],
    // Upper Rhine, Switzerland, Alps
    ["Colmar",          "DEC", 48.08,  7.36, "hre"],
    ["Freiburg",        "TYR", 47.99,  7.85, "hre"],
    ["Basel",           "BAS", 47.56,  7.59, "hre"],
    ["Konstanz",        "KON", 47.66,  9.18, "hre"],
    ["Zürich",          "ZUR", 47.37,  8.54, "hre"],
    ["Lucerne",         "SWI", 47.05,  8.31, "hre"],
    ["Bern",            "SWI", 46.95,  7.45, "hre"],
    ["Innsbruck",       "TYR", 47.27, 11.39, "hre"],
    ["Bozen",           "TYR", 46.50, 11.35, "hre"],
    ["Salzburg",        "SAL", 47.80, 13.04, "hre"],
    ["Graz",            "STY", 47.07, 15.44, "hre"],
    ["St. Veit",        "STY", 46.77, 14.36, "hre"],
    ["Ljubljana",       "STY", 46.05, 14.51, "hre"],
    ["Lausanne",        "SAV", 46.52,  6.63, "hre"],
    ["Geneva",          "SAV", 46.20,  6.14, "hre"],
    ["Chambéry",        "SAV", 45.57,  5.92, "hre"],
    ["Como",            "MIL", 45.81,  9.08, ""],
    ["Udine",           "VEN", 46.06, 13.24, ""],
    // Burgundy and France
    ["Dijon",           "BUR", 47.32,  5.04, ""],
    ["Besançon",        "BUR", 47.24,  6.02, "hre"],
    ["Lyon",            "FRA", 45.76,  4.84, "city"],
].map(([name, country, lat, lon, flags = ""]) => ({
    name, country, lat, lon,
    city: /city/.test(flags) ? 1 : 0, port: /port/.test(flags) ? 1 : 0, hre: /hre/.test(flags) ? 1 : 0,
}));

// ---------------------------------------------------------------------------------------------------------
// Coastlines: closed rings of lat lon. The first runs from the Channel along every mainland coast of the
// North Sea and the Baltic, round the Gulf of Bothnia and down Norway, then closes far outside the map.
// Narrow straits and lagoon mouths are widened to a few km so they stay open on the map.
// ---------------------------------------------------------------------------------------------------------
const COAST = [
  [ "mainland", `
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
    55.40 12.85 55.60 12.98 55.75 12.95 55.95 12.75 56.05 12.69 56.20 12.55 56.30 12.45 56.25 12.85
    56.45 12.90 56.67 12.86 56.90 12.50 57.10 12.25 57.40 12.00 57.69 11.85 57.90 11.65 58.10 11.55
    58.35 11.30 58.60 11.25 58.94 11.12 59.10 11.00 59.20 10.95 59.40 10.65 59.65 10.62 59.90 10.75
    59.75 10.45 59.55 10.40 59.30 10.45 59.05 10.15 58.95 9.75  58.85 9.40  58.65 9.05  58.45 8.77
    58.25 8.40  58.15 8.00  58.05 7.50  57.98 7.05  58.10 6.65  58.30 6.20  58.50 5.75  58.75 5.55
    58.97 5.65  59.30 5.30  59.60 5.30  60.00 5.10  60.40 5.20  61.00 4.90  62.00 5.00  63.50 8.50
    66.00 12.00 70.00 20.00 71.00 28.00 69.00 40.00 40.00 40.00 40.00 -2.00 50.90 -2.00 ` ],
  [ "Zealand",        ` 56.03 12.60 55.95 12.53 55.80 12.58 55.68 12.62 55.55 12.40 55.45 12.20 55.30 12.45
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

// Pieces of mainland cut off by the map edge, given to a settlement by a point inside them
const PIECE_OWNER = [ [60.12, 22.75, "Stockholm"] ];      // the coast of Finland was Swedish

// Islands with no settlement of their own belong to the land of this settlement (by name)
const ISLAND_OWNER = {
    "Lolland-Falster": "Copenhagen", "Fehmarn": "Kiel", "Rügen": "Stralsund", "Usedom": "Stettin",
    "Bornholm": "Lund", "Öland": "Kalmar", "Saaremaa": "Pernau", "Hiiumaa": "Reval", "Åland": "Stockholm",
    "Texel": "Amsterdam", "Funen": "Odense", "Zealand": "Copenhagen", "Gotland": "Visby",
};

// ---------------------------------------------------------------------------------------------------------
// Rivers: lat lon from source (or the map edge) to the mouth; the last point is moved onto the coast
// ---------------------------------------------------------------------------------------------------------
const RIVERS = [
  [ "Rhine",   ` 46.63 8.67  46.85 9.53  47.25 9.60  47.50 9.65  47.62 9.30  47.66 9.10  47.70 8.63  47.58 8.20
    47.56 7.59  48.03 7.58  48.58 7.80  49.00 8.30  49.32 8.44  49.49 8.46  49.63 8.37  50.00 8.27  49.97 7.90
    50.10 7.70  50.36 7.60  50.73 7.10  50.94 6.96  51.23 6.77  51.43 6.75  51.66 6.60  51.83 6.25  51.85 5.86
    51.88 5.43  51.83 4.97  51.81 4.67  51.92 4.48  51.98 4.12 ` ],
  [ "Rhône", ` 46.40 6.93  46.50 6.63  46.20 6.14  46.11 5.83  45.96 5.83  45.85 5.40  45.76 4.84  45.10 4.85 ` ],
  [ "Danube",  ` 47.95 8.50  48.09 9.22  48.40 9.99  48.72 10.78 48.76 11.43 48.92 11.88 49.02 12.10 48.88 12.57
    48.83 12.96 48.57 13.46 48.31 14.29 48.24 14.52 48.18 15.08 48.23 15.33 48.41 15.60 48.33 16.05 48.21 16.37
    48.15 16.94 48.14 17.11 47.76 18.12 47.79 18.74 47.78 19.13 47.50 19.04 46.96 18.94 46.62 18.86 46.18 18.95
    45.99 18.68 45.30 19.00 ` ],
  [ "Elbe",    ` 50.78 15.54 50.36 15.92 50.21 15.83 50.04 15.78 50.03 15.20 50.19 15.04 50.35 14.47 50.53 14.13
    50.66 14.04 50.78 14.21 50.96 13.94 51.05 13.74 51.16 13.47 51.31 13.29 51.56 13.00 51.87 12.65 51.84 12.24
    52.13 11.64 52.54 11.97 52.83 12.07 53.00 11.75 53.14 11.25 53.37 10.56 53.55 9.99  53.62 9.62 ` ],
  [ "Oder",    ` 49.60 17.50 49.84 18.29 50.09 18.22 50.35 18.20 50.67 17.93 50.86 17.47 51.11 17.03 51.41 16.43
    51.66 16.08 51.80 15.72 52.05 15.10 52.34 14.55 52.59 14.65 53.06 14.28 53.20 14.39 53.43 14.55 53.62 14.52 ` ],
  [ "Vistula", ` 49.60 18.95 50.03 19.20 50.06 19.94 50.68 21.75 50.89 21.86 51.42 21.96 51.56 21.85 52.23 21.02
    52.43 20.72 52.55 19.70 52.65 19.07 53.01 18.60 53.35 18.43 53.48 18.75 54.09 18.78 54.40 18.72 ` ],
  [ "Weser",   ` 50.90 9.65  51.31 9.49  51.42 9.65  51.77 9.38  52.10 9.36  52.29 8.92  52.64 9.21  52.92 9.23
    53.08 8.80  53.40 8.55 ` ],
  [ "Main",    ` 49.95 11.60 50.10 11.45 49.90 10.90 50.05 10.23 49.79 9.93  49.99 9.58  49.97 9.15  50.11 8.68
    50.00 8.27 ` ],
  [ "Moselle", ` 47.88 6.90  48.17 6.45  48.68 5.89  48.75 6.10  49.12 6.18  49.36 6.17  49.75 6.64  49.92 7.07
    50.15 7.17  50.36 7.60 ` ],
  [ "Meuse",   ` 48.08 5.60  48.36 5.70  49.16 5.38  49.70 4.94  49.77 4.72  50.14 4.82  50.26 4.91  50.47 4.87
    50.52 5.24  50.63 5.58  50.85 5.69  51.19 5.99  51.37 6.17  51.76 5.74  51.75 5.30  51.83 4.97 ` ],
  [ "Vltava",  ` 48.81 14.32 48.97 14.47 49.22 14.42 49.70 14.38 50.09 14.42 50.35 14.47 ` ],
  [ "Neman",   ` 53.68 23.83 54.02 23.97 54.40 24.05 54.90 23.90 55.08 22.77 55.08 21.88 55.30 21.30 ` ],
];

// ---------------------------------------------------------------------------------------------------------
// Sea zones: dividers run from coast to coast (each end is drawn out to the nearest coast); zones are named
// at a point inside them
// ---------------------------------------------------------------------------------------------------------
const DIVIDERS = [
  ` 57.15 8.55  57.95 7.10 `,          // North Sea | Skagerrak (Hanstholm - Lindesnes)
  ` 57.75 10.65 57.92 11.55 `,         // Skagerrak | Kattegat (Skagen - Marstrand)
  ` 55.76 10.92 55.87 10.05 `,         // Kattegat | Belt Sea (Great and Little Belt, north of Funen)
  ` 55.30 12.47 55.40 12.83 `,         // Kattegat (with the Øresund) | Baltic Sea (Stevns - Falsterbo)
  ` 55.00 11.97 54.90 11.97 `,         // Belt Sea | Baltic Sea (between Zealand and Falster)
  ` 54.57 11.97 54.45 12.53 `,         // Belt Sea | Baltic Sea (Gedser - Darß)
  ` 57.45 16.66 57.30 18.22 `,         // Baltic Sea | Northern Baltic (Småland north of Öland - Gotland)
  ` 57.20 18.85 56.70 21.02 `,         // Baltic Sea | Northern Baltic (Gotland - Courland)
  ` 57.75 22.62 57.93 22.08 `,         // Northern Baltic | Gulf of Riga (Irbe strait)
  ` 58.42 22.95 58.58 23.48 `,         // Northern Baltic | Gulf of Riga (Moon Sound)
];
const ZONES = [
    ["North Sea", 55.0, 5.5], ["Skagerrak", 58.0, 9.2], ["Kattegat", 57.0, 11.3], ["Belt Sea", 54.75, 10.7],
    ["Baltic Sea", 55.4, 17.0], ["Northern Baltic", 58.6, 20.0], ["Gulf of Riga", 57.6, 23.6],
];

// ---------------------------------------------------------------------------------------------------------
// Extra seeds: a settlement's land is everything nearer (over land) to one of its seeds than to any other.
// These pull the borders to where they were in 1440.
// ---------------------------------------------------------------------------------------------------------
const SEEDS = {
    "Oslo":         [ [58.65, 11.45] ],                     // Bohuslän was Norwegian
    "Lund":         [ [56.70, 12.95], [56.25, 15.10] ],     // Halland and Blekinge were Danish
    "Kalmar":       [ [57.30, 15.90] ],
    "Medininkai":   [ [55.95, 21.30] ],                     // Samogitia reached the sea at Palanga (1422)
    "Danzig":       [ [54.15, 17.70] ],                     // Pomerelia
    "Landsberg":    [ [53.10, 15.40] ],                     // the Neumark, the Order's since 1402
    "Lyon":         [ [46.30, 4.30] ],
    "Bozen":        [ [46.10, 11.10] ],                     // Trent, under Tyrol's protection
    "Innsbruck":    [ [47.25, 9.85] ],                      // Vorarlberg
    "Prague":       [ [50.55, 14.10] ],                     // Bohemia to the Ore Mountains
    "Hradec Králové": [ [50.45, 16.45] ],                 // the county of Glatz was Bohemian
    "Kolozsvár":    [ [47.40, 24.30] ],
    "Heidelberg":   [ [49.44, 7.77] ],                       // the Palatinate west of the Rhine (Kaiserslautern)
};

// ---------------------------------------------------------------------------------------------------------
// Mountain passes: id, lat, lon, routes (settlement name pairs) that go through it
// ---------------------------------------------------------------------------------------------------------
const PASSES = [
    ["P1",  46.56,  8.57, [ ["Lucerne", "Como"] ] ],                                  // St Gotthard
    ["P2",  47.13, 10.21, [ ["Innsbruck", "Konstanz"], ["Innsbruck", "Zürich"] ] ],  // Arlberg
    ["P3",  47.00, 11.50, [ ["Innsbruck", "Bozen"] ] ],                               // Brenner
    ["P4",  47.25, 13.55, [ ["Salzburg", "St. Veit"] ] ],                             // Radstädter Tauern
    ["P5",  47.63, 15.83, [ ["Wiener Neustadt", "Graz"] ] ],                          // Semmering
    ["P6",  46.55, 13.20, [ ["St. Veit", "Udine"] ] ],                                // Plöcken
    ["P7",  50.70, 13.95, [ ["Prague", "Dresden"] ] ],                                // Nollendorf, Ore Mountains
    ["P8",  49.32, 12.90, [ ["Plzeň", "Regensburg"], ["Plzeň", "Straubing"], ["Plzeň", "Amberg"] ] ],  // Cham, Bohemian Forest
    ["P9",  50.42, 16.20, [ ["Hradec Králové", "Liegnitz"], ["Hradec Králové", "Breslau"] ] ],        // Náchod, Sudetes
    ["P10", 49.53, 18.80, [ ["Besztercebánya", "Ratibor"], ["Besztercebánya", "Kraków"] ] ],         // Jablunka, Carpathians
    ["P11", 49.40, 21.70, [ ["Kassa", "Przemyśl"], ["Kassa", "Sandomierz"], ["Kassa", "Kraków"] ] ], // Dukla, Carpathians
    ["P12", 48.88, 23.13, [ ["Lwów", "Debrecen"], ["Lwów", "Kassa"], ["Lwów", "Kolozsvár"] ] ],      // Verecke, Carpathians
    ["P13", 48.74,  7.33, [ ["Nancy", "Strasbourg"] ] ],                              // Saverne, Vosges
];

// Routes not to draw although the lands touch (over high mountains with no pass, or barely touching)
const NO_ROUTE = [
    ["Bern", "Como"], ["Lausanne", "Como"], ["Bozen", "Como"], ["Bozen", "Udine"], ["Innsbruck", "Como"],
    ["Innsbruck", "St. Veit"], ["Salzburg", "Bozen"], ["Bern", "Bozen"], ["Lucerne", "Bozen"], ["Zürich", "Como"],
    ["Geneva", "Como"], ["Chambéry", "Como"], ["Lausanne", "Bozen"], ["Graz", "Salzburg"],
];

// Sea crossings for armies (dashed lines): settlement name pairs
const STRAITS = [ ["Copenhagen", "Lund"], ["Copenhagen", "Odense"], ["Odense", "Ribe"], ["Visby", "Kalmar"] ];

// Mountains, drawn only: apex positions (lat lon); tools/map.js mountains moves any that touch something
const MOUNTAINS = [
  // Alps
  ` 45.75 6.60  46.00 6.90  46.30 7.10  46.45 7.70  46.40 8.10  46.55 8.50  46.65 8.95  46.75 9.45  46.55 9.90
     46.95 9.70  47.05 10.30 46.90 10.80 47.00 11.20 46.80 11.80 46.95 12.30 47.05 12.80 47.15 13.40 47.10 14.00
     47.35 14.40 47.45 15.00 47.55 15.40 46.55 12.60 46.45 13.70 46.35 14.40 46.20 11.80 46.25 10.60 46.10 10.10
     47.30 11.80 47.45 12.70 47.60 13.60 46.10 7.50 45.95 7.20 47.40 10.80 `,
  // Jura, Vosges, Black Forest, Swabian Jura, Harz, Thuringian Forest
  ` 46.90 6.60  47.25 7.10  48.10 7.05  48.45 7.20  47.90 8.10  48.40 8.25  48.45 9.40  51.75 10.65 50.65 10.75 `,
  // Bohemian ring: Ore Mountains, Sudetes, Bohemian Forest, Bohemian-Moravian Highlands
  ` 50.45 12.75 50.55 13.30 50.65 13.80 50.85 14.80 50.75 15.50 50.60 16.10 50.30 16.75 50.10 17.20 49.40 12.75
     49.05 13.30 48.80 13.80 49.45 15.60 `,
  // Carpathians and Tatra
  ` 48.75 17.80 49.10 18.40 49.40 19.20 49.20 19.90 49.25 20.40 49.35 21.10 49.35 21.90 49.10 22.60 48.85 23.30
     48.50 23.90 48.00 24.40 47.50 24.70 47.00 25.10 46.55 23.00 46.40 22.70 48.70 20.10 48.85 19.50 `,
  // Scandinavian mountains
  ` 59.45 7.20  59.70 8.20  59.10 7.40  59.85 6.70  59.40 6.40  `,
];

// ---------------------------------------------------------------------------------------------------------
// Special coring (SCENARIO.md): name, what it was, and its settlements as country codes or settlement names
// ---------------------------------------------------------------------------------------------------------
const FORMABLES = [
  [ "Unite the Swiss",           "the Confederacy with Zürich and Basel (1501)",          ["SWI", "ZUR", "BAS"] ],
  [ "Reunite Bavaria",           "the Wittelsbach duchies, one again from 1505",          ["BMU", "BLA", "BIN", "REG"] ],
  [ "Habsburg Austria",          "the hereditary lands of the house of Habsburg",         ["AUS", "STY", "TYR"] ],
  [ "Kingdom of Hungary",        "the crown of St Stephen",                               ["HUN", "JIS"] ],
  [ "Lands of the Bohemian Crown", "Bohemia, Moravia, Silesia and Lusatia",               ["BOH", "TAB", "LUS", "SIL", "OPP"] ],
  [ "Kalmar Union",              "the three northern crowns under one king",              ["NOR", "SWE", "DEN", "GOT"] ],
  [ "Wettin Saxony",             "Saxony, Thuringia and Meissen",                         ["SAX", "ERF"] ],
  [ "Crown of Poland",           "Poland, Masovia (1526) and Royal Prussia (1466)",      ["POL", "MAZ", "Danzig", "Thorn", "Allenstein"] ],
  [ "Brandenburg-Prussia",       "the Hohenzollern lands of 1618",                        ["BRA", "ANS", "Königsberg", "Memel", "Landsberg"] ],
  [ "Burgundian Netherlands",    "the Seventeen Provinces of 1549",                       ["BUR", "UTR", "GEL", "LIE", "LUX", "FRI"] ],
  [ "Kingdom of Burgundy",       "the realm Charles the Bold wanted, Frisia to the Alps", ["BUR", "UTR", "GEL", "LIE", "LUX", "FRI", "LOR", "MET", "DEC", "Freiburg", "Montbéliard"] ],
  [ "Hanseatic League",          "its leading towns, under Lübeck",                       ["LUB", "HAM", "BRE", "Rostock", "Stralsund", "Danzig", "Cologne", "Riga", "Reval", "Visby"] ],
  [ "Polish-Lithuanian Commonwealth", "Poland and Lithuania joined at Lublin (1569)",     ["POL", "MAZ", "LIT", "LIV", "Danzig", "Thorn", "Allenstein", "Königsberg", "Memel"] ],
];

module.exports = {
    COUNTRIES, SETTLEMENTS, SEEDS, ISLAND_OWNER, PIECE_OWNER, COAST, RIVERS, PASSES, MOUNTAINS, DIVIDERS, ZONES,
    STRAITS, NO_ROUTE, FORMABLES,
};
