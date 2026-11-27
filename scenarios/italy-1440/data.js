// Geography of the Italy 1440 scenario, in real latitude and longitude (degrees north, east).
// tools/make-base.js projects it onto the map (`node tools/make-base.js scenarios/italy-1440`). One map unit is 1.1 km: the
// peninsula from the Alps to Cape Passero, with Corsica, Sardinia, Sicily and Elba, as one rectangle — smaller than the Mitteleuropa
// map. A battle of Italy: the Italian states of 1440 and one outsider, Aragon, in Sicily, Sardinia and Gaeta — who reunites Italy?
// Settlements follow the people of 1440 — about one for 110,000 — so that no two are much closer than 30 km: 71 of them.
// The coasts, the Po and the Alps and Apennines are Europe's (scenarios/europe-1440/data.js), Italy's coast drawn finer.

import { COAST as EUROPE_COAST, RIVERS as EUROPE_RIVERS, MOUNTAINS as EUROPE_MOUNTAINS } from "../europe-1440/data.js";

const NAME = "ITALY 1440";
// Lambert conformal conic for the peninsula: standard parallels 38 and 45 N, centred on 41.5 N 12.5 E; 1.1 km a map unit. The map
// reaches west of Sardinia, for the sea there, over the crest of the Alps, south of Cape Passero, and past Otranto for the strait's
// divider
const PROJECTION = { parallels: [38, 45], origin: [41.5, 12.5], kmPerUnit: 1.1, margin: 30, include: [[39.5, 7.3], [46.95, 11.0], [36.45, 14.8], [40.15, 18.85]] };

// ---------------------------------------------------------------------------------------------------------
// Countries in 1440: code, name, capital (a settlement name below), and for the larger powers a colour on the map. Every one
// Italian but Aragon — Alfonso V, King of Aragon and of Sicily and Sardinia, at war for Naples with René of Anjou (he took it in
// 1442). The smallest lordships (Saluzzo, Asti, Trent, the Romagna's, Ravenna, Carpi, Mirandola, Pesaro) are folded into their
// neighbours.
// ---------------------------------------------------------------------------------------------------------
const COUNTRIES = [
    ["SAV", "Savoy",                  "Turin", "#a8c4ec"],
    ["MON", "Montferrat",             "Casale"],
    ["GEN", "Genoa",                  "Genoa", "#e88a8a"],
    ["MIL", "Milan",                  "Milan", "#8cc68c"],
    ["VEN", "Venice",                 "Venice", "#e8c070"],
    ["MAN", "Mantua",                 "Mantua"],
    ["FER", "Ferrara",                "Ferrara", "#b8d8f0"],
    ["BOL", "Bologna",                "Bologna"],
    ["RIM", "Rimini",                 "Rimini"],
    ["URB", "Urbino",                 "Urbino"],
    ["SFO", "Sforza's March",         "Fermo", "#dcb0b0"],
    ["ANC", "Ancona",                 "Ancona"],
    ["FLO", "Florence",               "Florence", "#c4a0d8"],
    ["SIE", "Siena",                  "Siena", "#d8d8cc"],
    ["LUC", "Lucca",                  "Lucca"],
    ["PIO", "Piombino",               "Piombino"],
    ["PAP", "Papal States",           "Rome", "#f0e0a0"],
    ["NAP", "Naples",                 "Naples", "#a8d8b8"],
    ["TAR", "Taranto",                "Taranto"],
    ["ARA", "Aragon",                 "Palermo", "#f0c040"],
];

// ---------------------------------------------------------------------------------------------------------
// Settlements: name, country, lat, lon, flags (city = 20K, else a 10K town; port). Where two were nearer than 30 km the markers are
// moved apart a little: Pisa and Lucca, Messina and Reggio across the strait. Aragon holds Gaeta, Sicily and Sardinia; Salerno and
// Calabria are Naples', Bari Taranto's: with a foothold at the strait Aragon won 11 of 20 computer games, without Bari's going to
// Taranto Naples 8 (experiments/README.md, 32 and 33).
// ---------------------------------------------------------------------------------------------------------
const SETTLEMENTS = [
    ["Turin",           "SAV", 45.07,  7.69, ""],
    ["Aosta",           "SAV", 45.74,  7.32, ""],
    ["Cuneo",           "SAV", 44.39,  7.55, ""],
    ["Nice",            "SAV", 43.70,  7.27, "port"],
    ["Casale",          "MON", 45.13,  8.45, ""],
    ["Alba",            "MON", 44.70,  8.03, ""],
    ["Genoa",           "GEN", 44.41,  8.93, "city port"],
    ["Savona",          "GEN", 44.31,  8.48, "port"],
    ["La Spezia",       "GEN", 44.10,  9.82, "port"],
    ["Bastia",          "GEN", 42.70,  9.45, "port"],
    ["Ajaccio",         "GEN", 41.92,  8.74, "port"],
    ["Milan",           "MIL", 45.46,  9.19, "city"],
    ["Pavia",           "MIL", 45.19,  9.16, ""],
    ["Como",            "MIL", 45.81,  9.08, ""],
    ["Novara",          "MIL", 45.45,  8.62, ""],
    ["Parma",           "MIL", 44.80, 10.33, ""],
    ["Cremona",         "MIL", 45.13, 10.02, "city"],
    ["Venice",          "VEN", 45.44, 12.33, "city port"],
    ["Padua",           "VEN", 45.41, 11.88, "city"],
    ["Verona",          "VEN", 45.44, 10.99, "city"],
    ["Belluno",         "VEN", 46.14, 12.22, ""],
    ["Udine",           "VEN", 46.06, 13.24, ""],
    ["Brescia",         "VEN", 45.54, 10.21, "city"],
    ["Bergamo",         "VEN", 45.70,  9.67, ""],
    ["Mantua",          "MAN", 45.16, 10.79, "city"],
    ["Ferrara",         "FER", 44.84, 11.62, "city"],
    ["Modena",          "FER", 44.65, 10.93, ""],
    ["Bologna",         "BOL", 44.49, 11.34, "city"],
    ["Rimini",          "RIM", 44.06, 12.57, "port"],
    ["Urbino",          "URB", 43.73, 12.64, ""],
    ["Fermo",           "SFO", 43.16, 13.72, "port"],
    ["Ascoli",          "SFO", 42.85, 13.58, ""],
    ["Ancona",          "ANC", 43.62, 13.52, "port"],
    ["Florence",        "FLO", 43.77, 11.26, "city"],
    ["Pisa",            "FLO", 43.66, 10.33, "port"],
    ["Arezzo",          "FLO", 43.46, 11.88, ""],
    ["Volterra",        "FLO", 43.40, 10.86, ""],
    ["Siena",           "SIE", 43.32, 11.33, "city"],
    ["Grosseto",        "SIE", 42.76, 11.11, "port"],
    ["Orbetello",       "SIE", 42.44, 11.21, "port"],
    ["Lucca",           "LUC", 43.90, 10.55, "city"],
    ["Piombino",        "PIO", 42.93, 10.53, "port"],
    ["Rome",            "PAP", 41.90, 12.50, "city"],
    ["Civitavecchia",   "PAP", 42.09, 11.80, "port"],
    ["Viterbo",         "PAP", 42.42, 12.10, ""],
    ["Perugia",         "PAP", 43.11, 12.39, "city"],
    ["Spoleto",         "PAP", 42.73, 12.74, ""],
    ["Benevento",       "PAP", 41.13, 14.78, ""],
    ["Naples",          "NAP", 40.85, 14.27, "city port"],
    ["L'Aquila",        "NAP", 42.35, 13.40, ""],
    ["Chieti",          "NAP", 42.35, 14.17, ""],
    ["Campobasso",      "NAP", 41.56, 14.66, ""],
    ["Foggia",          "NAP", 41.46, 15.55, ""],
    ["Bari",            "TAR", 41.13, 16.87, "port"],
    ["Potenza",         "NAP", 40.64, 15.80, ""],
    ["Salerno",         "NAP", 40.68, 14.77, "port"],
    ["Cosenza",         "NAP", 39.30, 16.25, ""],
    ["Catanzaro",       "NAP", 38.91, 16.59, ""],
    ["Reggio",          "NAP", 38.05, 15.75, "port"],
    ["Taranto",         "TAR", 40.47, 17.24, "port"],
    ["Lecce",           "TAR", 40.35, 18.17, ""],
    ["Matera",          "TAR", 40.67, 16.60, ""],
    ["Gaeta",           "ARA", 41.21, 13.57, "port"],
    ["Palermo",         "ARA", 38.12, 13.36, "city port"],
    ["Messina",         "ARA", 38.20, 15.47, "city port"],
    ["Catania",         "ARA", 37.50, 15.09, "port"],
    ["Syracuse",        "ARA", 37.08, 15.29, "port"],
    ["Agrigento",       "ARA", 37.31, 13.58, "port"],
    ["Trapani",         "ARA", 38.02, 12.51, "port"],
    ["Cagliari",        "ARA", 39.22,  9.11, "port"],
    ["Sassari",         "ARA", 40.73,  8.56, ""],
].map(([name, country, lat, lon, flags = ""]) => ({
    name, country, lat, lon,
    city: /city/.test(flags) ? 1 : 0, port: /port/.test(flags) ? 1 : 0, hre: 0,
}));

// ---------------------------------------------------------------------------------------------------------
// Coastlines: Europe's rings, with Italy drawn finer. The mainland ring's stretch from Monfalcone round the peninsula to Nice
// is replaced, point for point along the real coast; so are Corsica, Sardinia and Sicily, and Elba is added. The Strait of
// Messina is widened to about 12 km so that it stays open.
// ---------------------------------------------------------------------------------------------------------
const ITALY_COAST = `
    45.78 13.53  45.68 13.38  45.66 13.12  45.60 12.88  45.50 12.62  45.42 12.40  45.30 12.33  45.22 12.29
    45.05 12.37  44.95 12.53  44.83 12.40  44.70 12.26  44.55 12.29  44.42 12.30  44.26 12.36  44.20 12.40
    44.07 12.58  43.97 12.74  43.91 12.91  43.84 13.02  43.72 13.22  43.62 13.51  43.55 13.62  43.43 13.67
    43.18 13.80  42.95 13.89  42.75 13.97  42.47 14.22  42.35 14.41  42.12 14.71  42.00 15.00  41.92 15.40
    41.93 15.88  41.88 16.18  41.71 16.05  41.63 15.92  41.45 15.98  41.32 16.28  41.28 16.42  41.20 16.60
    41.13 16.87  40.95 17.30  40.80 17.55  40.64 17.95  40.39 18.30  40.15 18.49  39.98 18.42  39.80 18.36
    39.92 18.15  40.06 17.98  40.26 17.89  40.40 17.50  40.47 17.23  40.35 16.82  40.20 16.70  39.87 16.53
    39.75 16.50  39.62 16.66  39.50 16.96  39.40 17.15  39.08 17.13  39.03 17.20  38.91 17.03  38.82 16.62
    38.68 16.55  38.32 16.40  38.24 16.27  37.92 16.06  37.92 15.78  38.02 15.68  38.11 15.68  38.21 15.70
    38.26 15.75  38.36 15.85  38.43 15.90  38.62 15.83  38.68 15.90  38.73 16.16  38.90 16.20  39.13 16.07
    39.36 16.03  39.52 15.94  39.81 15.79  39.99 15.71  40.07 15.63  40.03 15.28  40.35 14.99  40.42 15.00
    40.67 14.76  40.63 14.60  40.57 14.32  40.63 14.37  40.70 14.48  40.84 14.25  40.80 14.20  40.82 14.12
    40.78 14.08  40.85 14.05  41.02 13.93  41.11 13.88  41.21 13.57  41.26 13.43  41.28 13.25  41.23 13.05
    41.45 12.62  41.73 12.28  41.77 12.22  42.03 11.85  42.09 11.79  42.22 11.67  42.33 11.58  42.41 11.28
    42.45 11.20  42.40 11.18  42.36 11.12  42.45 11.10  42.55 11.13  42.76 10.88  42.92 10.75  42.93 10.50
    43.00 10.49  43.10 10.54  43.30 10.49  43.55 10.30  43.68 10.28  43.87 10.24  44.00 10.12  44.06 9.92
    44.05 9.83   44.17 9.61   44.27 9.39   44.31 9.32   44.30 9.21   44.38 9.04   44.40 8.93   44.42 8.75
    44.36 8.57   44.30 8.48   44.17 8.34   44.05 8.22   43.88 8.03   43.81 7.78   43.79 7.61   43.77 7.50
    43.73 7.42   43.70 7.27 `;
const ITALY_ISLANDS = [
  [ "Corsica", ` 43.00 9.42  42.70 9.45  42.37 9.53  42.10 9.55  41.85 9.40  41.59 9.29  41.39 9.16  41.67 8.90
    41.92 8.73  42.13 8.59  42.27 8.69  42.57 8.75  42.64 8.94  42.68 9.30  42.97 9.35 ` ],
  [ "Sardinia", ` 41.24 9.19  41.18 9.38  40.92 9.52  40.57 9.80  40.38 9.71  39.94 9.70  39.40 9.62  39.14 9.52
    39.21 9.11  38.97 9.00  38.86 8.64  39.05 8.40  39.20 8.38  39.45 8.40  39.75 8.50  39.90 8.53  40.03 8.38
    40.30 8.48  40.56 8.31  40.56 8.16  40.73 8.13  40.94 8.22  40.84 8.40  40.91 8.71  41.01 8.87  41.10 9.00 ` ],
  [ "Sicily", ` 38.26 15.58  38.20 15.53  38.05 15.47  37.85 15.29  37.73 15.21  37.50 15.10  37.23 15.22  37.07 15.29
    36.90 15.14  36.69 15.13  36.73 14.85  36.89 14.43  37.06 14.25  37.10 13.94  37.27 13.58  37.50 13.08
    37.65 12.59  37.80 12.43  38.02 12.50  38.18 12.73  38.03 12.88  38.21 13.31  38.12 13.37  38.11 13.54
    37.98 13.70  38.04 14.02  38.16 14.75  38.27 15.23  38.26 15.40 ` ],
  [ "Elba", ` 42.83 10.43  42.76 10.42  42.73 10.25  42.73 10.15  42.81 10.14  42.82 10.32 ` ],
];
// Europe's mainland ring with the Italian stretch swapped: from Monfalcone (45.78 13.53) to Nice (43.70 7.27), both kept
function finer(ring) {
    const from = ring.indexOf("45.78 13.53"), to = ring.indexOf("43.70 7.27", from);
    if (from < 0 || to < from) throw new Error("data.js: Europe's coast has moved — find Monfalcone and Nice again");
    return ring.slice(0, from) + ITALY_COAST.trim() + ring.slice(to + "43.70 7.27".length);
}
const SWAPPED = new Set(ITALY_ISLANDS.map(([name]) => name));
const COAST = [
    ...EUROPE_COAST.filter(([name]) => !SWAPPED.has(name)).map(([name, ring]) => [name, name === "mainland" ? finer(ring) : ring]),
    ...ITALY_ISLANDS,
];

// ---------------------------------------------------------------------------------------------------------
// Waste: the lands beyond the game, grey — the Alps' far side and Provence; the Balkans and Africa. The two rings meet at
// Tarvisio. The first runs up the Var, along the crest of the Alps (Larche, Mont Cenis, the Great St Bernard, the Simplon, the
// Gotthard, the Stelvio) and north of Trent and Cadore; the second down the Isonzo to the Gulf of Trieste, then through the
// sea — the middle of the Adriatic, the Strait of Otranto, south of Calabria and Sicily, the Strait of Sicily, south of
// Sardinia — so it takes Istria, Dalmatia, Albania and Tunis and leaves the sea sea.
// ---------------------------------------------------------------------------------------------------------
const WASTE = [
  [ "the Alps and Provence", `
    43.66 7.20   43.90 7.00   44.15 6.85   44.42 6.89   44.68 6.98   44.93 6.75   45.13 6.68   45.25 6.90
    45.68 6.88   45.83 6.86   45.87 7.17   45.98 7.66   45.94 7.87   46.25 8.03   46.45 8.40   46.56 8.57
    46.56 8.80   46.50 9.17   46.51 9.33   46.40 9.69   46.41 10.02  46.53 10.45  46.45 10.80  46.42 11.05
    46.32 11.30  46.32 11.60  46.50 12.00  46.65 12.45  46.60 12.90  46.55 13.30  46.50 13.66  47.80 13.66
    47.80 4.00   42.50 4.00   42.90 7.25 ` ],
  [ "the Balkans and Africa", `
    46.50 13.62  46.30 13.62  45.95 13.56  45.70 13.58  45.30 13.30  44.60 13.40  43.90 13.90  42.90 14.60
    42.20 15.60  42.05 16.40  41.40 17.40  40.40 18.85  39.50 18.90  37.60 16.60  36.40 15.30  36.30 14.50
    36.55 13.30  37.35 11.75  37.75 10.50  38.30 8.50   38.30 4.00   30.00 4.00   30.00 25.00  47.80 25.00
    47.80 13.62 ` ],
];

// Islands with no settlement of their own (or more land than theirs reaches), given to one: ring name -> settlement
const ISLAND_OWNER = { "Corsica": "Bastia", "Sardinia": "Cagliari", "Sicily": "Palermo", "Elba": "Piombino" };
const PIECE_OWNER = [];
// Extra seeds: a settlement's land is everything nearer (over land) to one of its seeds than to any other
const SEEDS = {
    "Venice":        [ [45.22, 12.20] ],                     // Chioggia and the lagoon
    "Gaeta":         [ [41.30, 13.75] ],                     // Fondi and the Garigliano
};


// ---------------------------------------------------------------------------------------------------------
// Rivers: lat lon from source to the mouth (the last point is moved onto the coast), or to where it leaves the land shown.
// The Po is Europe's; the Adige, the Arno and the Tiber are drawn here.
// ---------------------------------------------------------------------------------------------------------
const RIVERS = [
    ...EUROPE_RIVERS.filter(([name]) => name === "Po"),
  [ "Adige",   ` 46.67 11.16 46.48 11.33 46.25 11.17 46.07 11.12 45.89 11.04 45.58 10.92 45.44 10.99 45.30 11.15
    45.19 11.31 45.13 11.80 45.15 12.30 ` ],
  [ "Arno",    ` 43.87 11.70 43.80 11.71 43.70 11.82 43.50 11.80 43.62 11.60 43.77 11.43 43.77 11.25 43.78 11.10
    43.72 10.95 43.66 10.63 43.70 10.40 43.68 10.28 ` ],
  [ "Tiber",   ` 43.79 12.07 43.57 12.14 43.46 12.24 43.31 12.33 43.09 12.44 42.78 12.41 42.62 12.25 42.46 12.39
    42.20 12.55 41.90 12.47 41.74 12.24 ` ],
];

// ---------------------------------------------------------------------------------------------------------
// Sea zones: a divider is drawn from its middle out to the nearest coast (or the map's edge) at each end; a zone is named at
// a point inside it
// ---------------------------------------------------------------------------------------------------------
const DIVIDERS = [
  ` 43.55 7.15  42.56 8.75 `,          // Sea of Sardinia | Ligurian Sea (Antibes - Calvi)
  ` 42.93 10.50 42.95 9.45 `,          // Ligurian Sea | Tyrrhenian Sea (Piombino - Corsica)
  ` 41.38 9.18  41.24 9.19 `,          // Sea of Sardinia | Tyrrhenian Sea (Bonifacio)
  ` 38.88 8.65  36.95 8.75 `,          // Sea of Sardinia | Tyrrhenian Sea (Sardinia - Tabarka)
  ` 37.80 12.43 37.08 11.05 `,         // Tyrrhenian Sea | Strait of Sicily (Marsala - Cap Bon)
  ` 38.24 15.56 38.24 15.72 `,         // Tyrrhenian Sea | Ionian Sea (Strait of Messina)
  ` 36.69 15.13 36.55 15.13 `,         // Strait of Sicily | Ionian Sea (Capo Passero, out south: its middle must be on the map)
  ` 40.15 18.49 40.25 18.75 `,         // Ionian Sea | Lower Adriatic (Strait of Otranto, out to the edge)
  ` 42.00 15.00 42.90 16.80 `,         // Lower Adriatic | Upper Adriatic (Termoli - Dalmatia)
];
const ZONES = [
    ["Ligurian Sea", 43.95, 8.90], ["Tyrrhenian Sea", 40.00, 12.50], ["Sea of Sardinia", 40.00, 7.80],
    ["Strait of Sicily", 36.95, 12.80], ["Ionian Sea", 38.50, 17.80], ["Lower Adriatic", 41.90, 17.00],
    ["Upper Adriatic", 44.40, 13.20],
];

// Mountain passes: id, lat, lon, routes (settlement name pairs) that go through it
const PASSES = [
    ["P1",  44.15,  7.56, [ ["Cuneo", "Nice"] ] ],                                     // Col de Tende
    ["P2",  44.47,  9.93, [ ["Parma", "La Spezia"] ] ],                                // Cisa
    ["P3",  44.10, 11.27, [ ["Bologna", "Florence"] ] ],                               // Futa
];

// Routes not to draw although the lands touch
const NO_ROUTE = [];


// Sea crossings for armies (dashed lines): settlement name pairs
const STRAITS = [
    ["Messina", "Reggio"], ["Ajaccio", "Sassari"],
    // the islands' way to the mainland: Corsica, and through it Sardinia
    ["Bastia", "Piombino"],
];


// Mountains, drawn only: apex positions (lat lon); tools/map.js mountains moves any that touch something. Europe's Alps and
// Apennines, and the islands' and Calabria's ranges
const MOUNTAINS = [
    ...EUROPE_MOUNTAINS.filter((m) => /46\.00 6\.90|44\.30 10\.30/.test(m)),
  ` 37.95 14.00 37.75 14.95 37.85 13.30 `,                   // the Madonie, Etna, the Sicani
  ` 40.05 9.30  39.70 9.40  40.30 9.05 `,                    // the Gennargentu
  ` 42.20 9.05  42.35 8.95  41.90 9.10 `,                    // Corsica's spine
  ` 39.35 16.45 38.95 16.30 38.20 15.95 `,                   // the Sila and the Aspromonte
  ` 44.20 7.70  44.30 8.20 `,                                // the Maritime and Ligurian Alps
];

// ---------------------------------------------------------------------------------------------------------
// Special coring (SCENARIO.md): name, what it was, its settlements as country codes or settlement names, and if proclaiming it
// makes a new state, [name, code, colour] (its colour unlike every country's: tools/map.js checks). The Kingdom of Italy's Needs (Rome, Milan and 38 in all) are SCENARIO.md's,
// written there by hand: make-base.js does not write that column.
// ---------------------------------------------------------------------------------------------------------
const ALL = COUNTRIES.map(([code]) => code);
const FORMABLES = [
  [ "Kingdom of Italy",            "the Regnum Italiae of the emperors, and the kingdom Gian Galeazzo Visconti died wanting (1402) — the whole peninsula, with Rome and Milan", ALL, ["Italy", "ITA", "#4e9a7a"] ],
  [ "Grand Duchy of Tuscany",      "Florence, Siena, Lucca and Piombino under the Medici, as Cosimo I made it (1569)", ["FLO", "SIE", "LUC", "PIO"], ["Tuscany", "TUS", "#b04a7a"] ],
  [ "States of the Church",        "the Patrimony, Umbria, the March, the Romagna and Bologna under the Pope, as Julius II won them back (1506–12)", ["BOL", "RIM", "URB", "SFO", "ANC", "PAP"] ],
  [ "Kingdom of the Two Sicilies", "Naples and Sicily under one king, as Alfonso held them from 1442", ["NAP", "TAR", "Gaeta", "Palermo", "Messina", "Catania", "Syracuse", "Agrigento", "Trapani"], ["Two Sicilies", "TSI", "#3f6fb5"] ],
];

export {
    NAME, PROJECTION, COUNTRIES, SETTLEMENTS, SEEDS, ISLAND_OWNER, PIECE_OWNER, COAST, RIVERS, PASSES, MOUNTAINS, DIVIDERS,
    ZONES, STRAITS, NO_ROUTE, FORMABLES, WASTE,
};
