# SCENARIO: EUROPE 1440

*Everything here is specific to this map; the general rules are in [RULES.md](../../docs/RULES.md).*

Every town where it really is, the realms that really existed in the year it starts, and towns made cities by how big they
really were.

This file is the **only** place the map's facts are written down. The map's shapes — one per settlement's land,
plus the rivers and the sea zone dividers — are in [map-base.svg](map-base.svg). From the two, a script builds
[map.svg](map.svg), the map the game shows, and [scenario.json](scenario.json), this scenario as data for the
game. After changing either, run:

```
node tools/map.js scenarios/europe-1440              # check everything, rebuild map.svg and scenario.json, refresh this file
node tools/map.js scenarios/europe-1440 mountains    # the same, but first move any mountain that touches something
```

map-base.svg and the data tables here were first made by
[tools/make-base.js](../../tools/make-base.js) from real latitudes and longitudes ([data.js](data.js)); running it again
**overwrites** map-base.svg and the tables, so once you edit them by hand, use tools/map.js only.

Columns and blocks marked *generated* are rewritten by the script — edit the rest.

**x = 1** (see the scenario scaling note in RULES.md)

**Army speed:** 315 map units per year — a route takes its length on the map ÷ this (RULES.md §8). One map unit
is about 1.6 km, so an army covers about 500 km a year, as on the Mitteleuropa map.

<!-- generated:summary -->
445 settlements (69 cities, 376 towns) · 118 countries · 5,140,000 people · 1015 land routes, 19 straits, 23 mountain passes
<!-- /generated -->

![Map](map.svg)

## Countries

*Code, Country and Capital are data (Capital is a settlement ID; the script adds the name); the other columns are generated. A country that owns a city must have one as its capital (RULES.md §2).*

| Code | Country | Capital | Colour | Settlements | Pop | Army | Ships | HRE |
|---|---|---|---|---|---|---|---|---|
| NOR | Norway | 2 Bergen | #e6bcd4 | 1, 2, 3, 4 | 50K | 2,000 | 25 | — |
| SWE | Sweden | 5 Stockholm | #a8c4ec | 5, 6, 7, 8, 9, 10, 11, 12, 13 | 100K | 4,000 | 50 | — |
| DEN | Denmark | 14 Copenhagen | #f0a8a0 | 14, 15, 16, 17, 18 | 50K | 2,000 | 25 | — |
| GOT | Gotland | 19 Visby |  | 19 | 10K | 400 | 5 | — |
| LIV | Livonian Order | 20 Riga | #c4cce0 | 20, 21, 22, 23 | 50K | 2,000 | 25 | — |
| TEU | Teutonic Order | 24 Danzig | #d4d4d4 | 24, 25, 26, 27 | 50K | 2,000 | 25 | — |
| ENG | England | 28 London | #ea9999 | 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 83, 84, 85, 86, 87, 88, 89 | 300K | 12,000 | 150 | — |
| SCO | Scotland | 49 Edinburgh | #b8d8f0 | 49, 50, 51, 52 | 40K | 1,600 | 20 | — |
| ISL | Lordship of the Isles | 53 Inverness |  | 53 | 10K | 400 | 5 | — |
| TRN | Tyrone | 46 Dungannon |  | 46 | 10K | 400 | — | — |
| THO | Thomond | 47 Ennis |  | 47 | 10K | 400 | — | — |
| DES | Desmond | 48 Tralee |  | 48 | 10K | 400 | 5 | — |
| FRA | France | 54 Paris | #8fb4ea | 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82 | 320K | 12,800 | 160 | — |
| BUR | Burgundy | 98 Brussels | #c4a0d8 | 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104 | 190K | 7,600 | 95 | part |
| BRI | Brittany | 106 Nantes | #d8d8cc | 105, 106, 107, 108 | 50K | 2,000 | 25 | — |
| ANJ | Anjou | 110 Marseille | #f2c7a6 | 109, 110, 111, 112 | 50K | 2,000 | 25 | part |
| BOU | Bourbon | 113 Moulins | #d6e39c | 113, 114 | 20K | 800 | — | — |
| ARM | Armagnac | 115 Rodez |  | 115, 116 | 20K | 800 | — | — |
| FOI | Foix-Béarn | 117 Pau |  | 117, 118 | 20K | 800 | — | — |
| SAV | Savoy | 120 Chambéry | #9fd6c4 | 120, 121, 122, 123, 124, 125 | 60K | 2,400 | 30 | ✓ |
| LIE | Liège | 126 Liège |  | 126 | 20K | 800 | — | ✓ |
| UTR | Utrecht | 127 Utrecht |  | 127 | 10K | 400 | — | ✓ |
| GEL | Guelders | 128 Nijmegen |  | 128 | 10K | 400 | — | ✓ |
| FRI | Frisia | 129 Groningen |  | 129 | 10K | 400 | 5 | ✓ |
| LUX | Luxembourg | 130 Luxembourg |  | 130 | 10K | 400 | — | ✓ |
| CAS | Castile | 131 Toledo | #f2d06b | 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154 | 290K | 11,600 | 145 | — |
| ARA | Aragon | 155 Zaragoza | #f4b073 | 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 223, 224, 225, 226, 227, 228, 229 | 220K | 8,800 | 110 | — |
| POR | Portugal | 166 Lisbon | #9fd29a | 166, 167, 168, 169, 170, 171, 172 | 80K | 3,200 | 40 | — |
| NAV | Navarre | 173 Pamplona |  | 173 | 10K | 400 | — | — |
| GRA | Granada | 174 Granada | #d4e8a0 | 174, 175, 176 | 40K | 1,600 | 20 | — |
| MIL | Milan | 177 Milan | #f0aaaa | 177, 178, 179, 180 | 50K | 2,000 | — | ✓ |
| VEN | Venice | 181 Venice | #8fd4d4 | 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194 | 170K | 6,800 | 85 | — |
| GEN | Genoa | 195 Genoa | #c8c8e8 | 195, 196, 197, 198, 199 | 70K | 2,800 | 35 | — |
| FLO | Florence | 200 Florence | #f6cf9e | 200, 201, 202 | 40K | 1,600 | 20 | — |
| SIE | Siena | 203 Siena |  | 203 | 10K | 400 | — | — |
| PAP | Papal States | 204 Rome | #f4eba0 | 119, 204, 205, 206, 207, 208 | 80K | 3,200 | 40 | — |
| FER | Ferrara | 209 Ferrara |  | 209, 210 | 20K | 800 | — | part |
| MAN | Mantua | 211 Mantua |  | 211 | 10K | 400 | — | ✓ |
| MON | Montferrat | 212 Casale |  | 212 | 10K | 400 | — | ✓ |
| RIM | Rimini | 213 Rimini |  | 213 | 10K | 400 | 5 | — |
| NAP | Naples | 214 Naples | #cdb4e6 | 214, 215, 216, 217, 218, 219, 220, 221, 222 | 100K | 4,000 | 50 | — |
| SHO | Schleswig-Holstein | 230 Schleswig |  | 230 | 10K | 400 | 5 | — |
| LUB | Lübeck | 231 Lübeck |  | 231 | 20K | 800 | 10 | ✓ |
| HAM | Hamburg | 232 Hamburg |  | 232 | 20K | 800 | 10 | ✓ |
| MEC | Mecklenburg | 233 Schwerin |  | 233, 234 | 20K | 800 | 10 | ✓ |
| POM | Pomerania | 235 Stettin |  | 235, 236 | 20K | 800 | 10 | ✓ |
| BRE | Bremen | 237 Bremen |  | 237 | 10K | 400 | 5 | ✓ |
| BRU | Brunswick-Lüneburg | 239 Brunswick |  | 238, 239 | 30K | 1,200 | — | ✓ |
| MAG | Magdeburg | 240 Magdeburg |  | 240 | 20K | 800 | — | ✓ |
| BRA | Brandenburg | 241 Berlin | #cfc4b0 | 241, 242, 243 | 30K | 1,200 | — | ✓ |
| CLE | Cleves-Mark | 244 Wesel |  | 244 | 10K | 400 | — | ✓ |
| MUN | Münster | 245 Münster |  | 245 | 10K | 400 | — | ✓ |
| JUL | Jülich-Berg | 246 Düsseldorf |  | 246 | 10K | 400 | — | ✓ |
| COL | Cologne | 247 Cologne |  | 247 | 20K | 800 | — | ✓ |
| HES | Hesse | 248 Kassel |  | 248, 249 | 20K | 800 | — | ✓ |
| SAX | Saxony | 250 Wittenberg | #b8dca8 | 250, 251, 252, 253 | 40K | 1,600 | — | ✓ |
| LUS | Upper Lusatia | 254 Bautzen |  | 254 | 10K | 400 | — | ✓ |
| SIL | Silesia | 255 Breslau |  | 255, 256 | 30K | 1,200 | — | ✓ |
| OPP | Opole | 257 Oppeln |  | 257 | 10K | 400 | — | ✓ |
| TRI | Trier | 258 Trier |  | 258 | 10K | 400 | — | ✓ |
| MAI | Mainz | 259 Mainz |  | 259 | 10K | 400 | — | ✓ |
| WBG | Würzburg | 260 Würzburg |  | 260 | 10K | 400 | — | ✓ |
| ANS | Ansbach-Kulmbach | 261 Ansbach |  | 261 | 10K | 400 | — | ✓ |
| NUR | Nuremberg | 262 Nuremberg |  | 262 | 20K | 800 | — | ✓ |
| PAL | Palatinate | 263 Heidelberg |  | 263, 264 | 20K | 800 | — | ✓ |
| BOH | Bohemia | 265 Prague | #e8b0a0 | 265, 266, 267, 268, 269 | 60K | 2,400 | — | ✓ |
| MET | Metz | 270 Metz |  | 270 | 20K | 800 | — | ✓ |
| STR | Strasbourg | 271 Strasbourg |  | 271 | 20K | 800 | — | ✓ |
| BAD | Baden | 272 Baden |  | 272 | 10K | 400 | — | ✓ |
| WRT | Württemberg | 273 Stuttgart |  | 273 | 10K | 400 | — | ✓ |
| ULM | Ulm | 274 Ulm |  | 274 | 20K | 800 | — | ✓ |
| AUG | Augsburg | 275 Augsburg |  | 275 | 20K | 800 | — | ✓ |
| BIN | Bavaria-Ingolstadt | 276 Ingolstadt |  | 276 | 10K | 400 | — | ✓ |
| REG | Regensburg | 277 Regensburg |  | 277 | 10K | 400 | — | ✓ |
| BMU | Bavaria-Munich | 278 Munich |  | 278 | 10K | 400 | — | ✓ |
| BLA | Bavaria-Landshut | 279 Landshut |  | 279 | 10K | 400 | — | ✓ |
| AUS | Austria | 280 Vienna | #f0e0b8 | 280, 281, 282 | 40K | 1,600 | — | ✓ |
| TYR | Tyrol | 283 Innsbruck |  | 283, 284, 285 | 30K | 1,200 | — | ✓ |
| BAS | Basel | 286 Basel |  | 286 | 10K | 400 | — | ✓ |
| ZUR | Zürich | 287 Zürich |  | 287 | 10K | 400 | — | ✓ |
| SWI | Swiss Confederacy | 288 Bern |  | 288, 289 | 20K | 800 | — | ✓ |
| SAL | Salzburg | 290 Salzburg |  | 290 | 10K | 400 | — | ✓ |
| STY | Inner Austria | 291 Graz |  | 291, 292, 293 | 30K | 1,200 | 15 | ✓ |
| POL | Poland | 294 Kraków | #f2b0c0 | 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305 | 140K | 5,600 | — | — |
| MAZ | Masovia | 306 Warsaw |  | 306, 307 | 20K | 800 | — | — |
| LIT | Lithuania | 308 Vilnius | #b8a4dc | 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322 | 170K | 6,800 | — | — |
| HUN | Hungary | 323 Buda | #e2b88a | 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336 | 150K | 6,000 | — | — |
| JIS | Upper Hungary | 337 Kassa |  | 337, 338 | 20K | 800 | — | — |
| OTT | Ottoman Empire | 339 Edirne | #8cc68c | 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386 | 330K | 13,200 | 165 | — |
| BYZ | Byzantium | 354 Constantinople | #b89ad8 | 354, 355 | 30K | 1,200 | 15 | — |
| MOR | Morea | 356 Mistra | #d8c0ec | 356, 357, 358 | 30K | 1,200 | 15 | — |
| SER | Serbia | 359 Novo Brdo |  | 359 | 10K | 400 | — | — |
| BOS | Bosnia | 360 Jajce |  | 360, 361 | 20K | 800 | — | — |
| HER | Herzegovina | 362 Blagaj |  | 362 | 10K | 400 | — | — |
| RAG | Ragusa | 363 Ragusa |  | 363 | 10K | 400 | 5 | — |
| WAL | Wallachia | 364 Târgoviște | #a8d0e8 | 364, 365 | 20K | 800 | — | — |
| MOL | Moldavia | 366 Suceava | #c8e8d0 | 366, 367, 368 | 30K | 1,200 | 15 | — |
| ATH | Athens | 369 Athens |  | 369 | 10K | 400 | 5 | — |
| EPI | Epirus | 370 Arta |  | 370 | 10K | 400 | — | — |
| LES | Lesbos | 371 Mytilene |  | 371 | 10K | 400 | 5 | — |
| KAR | Karaman | 387 Konya | #e8c49a | 387, 388, 389, 390, 391, 392 | 70K | 2,800 | 35 | — |
| CAN | Candar | 393 Kastamonu |  | 393, 394 | 20K | 800 | 10 | — |
| TRE | Trebizond | 395 Trebizond |  | 395 | 10K | 400 | 5 | — |
| DUL | Dulkadir | 396 Elbistan |  | 396, 397 | 20K | 800 | — | — |
| RAM | Ramadan | 398 Adana |  | 398 | 10K | 400 | — | — |
| AQQ | Aq Qoyunlu | 399 Diyarbakır | #dcb0b0 | 399, 400, 401 | 30K | 1,200 | — | — |
| CYP | Cyprus | 402 Nicosia |  | 402 | 10K | 400 | — | — |
| KRH | Knights of Rhodes | 403 Rhodes |  | 403, 404 | 20K | 800 | 10 | — |
| MOS | Muscovy | 405 Moscow | #b0dca0 | 405, 406, 407, 408, 409, 410, 411, 412, 413 | 100K | 4,000 | — | — |
| NOV | Novgorod | 414 Novgorod | #dcc090 | 414, 415, 416, 417, 418, 419, 420 | 80K | 3,200 | — | — |
| PSK | Pskov | 421 Pskov |  | 421 | 10K | 400 | — | — |
| TVE | Tver | 422 Tver |  | 422, 423 | 20K | 800 | — | — |
| RYA | Ryazan | 424 Ryazan |  | 424 | 10K | 400 | — | — |
| THE | Theodoro | 425 Mangup |  | 425 | 10K | 400 | — | — |
| GHO | Great Horde | 426 Azak | #e8de9c | 426 | 10K | 400 | 5 | — |
| MRC | Morocco | 427 Fez | #e0a888 | 427, 428, 429, 430, 431, 432, 433, 434 | 100K | 4,000 | 50 | — |
| TLE | Tlemcen | 435 Tlemcen | #d8cc9c | 435, 436, 437 | 40K | 1,600 | 20 | — |
| TUN | Tunis | 438 Tunis | #b8d8b0 | 438, 439, 440, 441, 442, 443, 444, 445 | 90K | 3,600 | 45 | — |

## Settlements

- **Type** — `town` (red circle, 10,000 pop) or `city` (red square, 20,000 pop). The 69 cities are the largest
  towns of the map around 1440.
- **Port** — the settlement sits on the coast.
- **HRE** — inside the Holy Roman Empire.
- **X, Y** — marker centre, in map units (the coordinates of map.svg). The settlement's land is the shape
  `land-ID` in map-base.svg; country borders are drawn wherever two lands belong to different countries.
- **Borders** — settlements an army can march to in one step (every route is listed under both ends). Routes
  through a mountain pass are listed here too; the pass itself is in *Mountain passes*.
- **Straits** — crossings by sea (dashed lines, RULES.md §8).

| ID | Name | Country | Type | Port | HRE | X | Y | Borders | Straits |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Oslo | NOR | town | port |  | 1315 | 908 | 2, 3, 6, 7, 9, 10 |  |
| 2 | Bergen | NOR | city | port |  | 1133 | 857 | 1, 3 |  |
| 3 | Nidaros | NOR | town | port |  | 1318 | 663 | 1, 2, 10, 11 |  |
| 4 | Vardøhus | NOR | town | port |  | 1851 | 134 | 11 |  |
| 5 | Stockholm | SWE | city | port |  | 1570 | 950 | 6, 7 |  |
| 6 | Uppsala | SWE | town |  |  | 1553 | 914 | 1, 5, 7, 10 |  |
| 7 | Linköping | SWE | town |  |  | 1484 | 1015 | 1, 5, 6, 8, 9, 15 |  |
| 8 | Kalmar | SWE | town | port |  | 1511 | 1133 | 7, 15 | 19 |
| 9 | Älvsborg | SWE | town | port |  | 1351 | 1060 | 1, 7, 15 |  |
| 10 | Gävle | SWE | town | port |  | 1534 | 859 | 1, 3, 6, 11 |  |
| 11 | Torneå | SWE | town | port |  | 1727 | 481 | 3, 4, 10, 12, 13, 417, 420 |  |
| 12 | Åbo | SWE | town | port |  | 1709 | 863 | 11, 13 |  |
| 13 | Viborg | SWE | town | port |  | 1925 | 814 | 11, 12, 416, 417 |  |
| 14 | Copenhagen | DEN | town | port |  | 1362 | 1201 |  | 15, 16 |
| 15 | Lund | DEN | town |  |  | 1392 | 1200 | 7, 8, 9 | 14 |
| 16 | Odense | DEN | town | port |  | 1284 | 1216 |  | 14, 17 |
| 17 | Aarhus | DEN | town | port |  | 1279 | 1162 | 18, 230 | 16 |
| 18 | Aalborg | DEN | town | port |  | 1273 | 1102 | 17 |  |
| 19 | Visby | GOT | town | port |  | 1588 | 1066 |  | 8 |
| 20 | Riga | LIV | city | port |  | 1801 | 1094 | 22, 23, 308, 309, 310, 315, 421 |  |
| 21 | Reval | LIV | town | port |  | 1802 | 925 | 22, 23 |  |
| 22 | Dorpat | LIV | town |  |  | 1882 | 984 | 20, 21, 23, 414, 421 |  |
| 23 | Pernau | LIV | town | port |  | 1803 | 995 | 20, 21, 22 |  |
| 24 | Danzig | TEU | city | port |  | 1606 | 1290 | 25, 26, 235, 296 |  |
| 25 | Königsberg | TEU | town | port |  | 1679 | 1260 | 24, 26, 27, 306, 307, 309, 310, 311 |  |
| 26 | Thorn | TEU | town |  |  | 1609 | 1380 | 24, 25, 235, 243, 256, 295, 296, 299, 307 |  |
| 27 | Memel | TEU | town | port |  | 1702 | 1190 | 25, 310 |  |
| 28 | London | ENG | city | port |  | 827 | 1421 | 31, 32, 35, 36 |  |
| 29 | York | ENG | city |  |  | 823 | 1250 | 34, 37, 38, 39 |  |
| 30 | Bristol | ENG | city | port |  | 724 | 1402 | 32, 33, 35, 40, 41 |  |
| 31 | Norwich | ENG | town | port |  | 900 | 1358 | 28, 34 |  |
| 32 | Southampton | ENG | town | port |  | 765 | 1450 | 28, 30, 33 |  |
| 33 | Exeter | ENG | town | port |  | 673 | 1441 | 30, 32 |  |
| 34 | Lincoln | ENG | town |  |  | 834 | 1303 | 29, 31, 35, 38 |  |
| 35 | Coventry | ENG | town |  |  | 783 | 1349 | 28, 30, 34, 38, 40 |  |
| 36 | Canterbury | ENG | town |  |  | 874 | 1446 | 28 | 83 |
| 37 | Newcastle | ENG | town | port |  | 817 | 1178 | 29, 39, 49 |  |
| 38 | Chester | ENG | town | port |  | 740 | 1284 | 29, 34, 35, 39, 40 | 42 |
| 39 | Carlisle | ENG | town |  |  | 766 | 1171 | 29, 37, 38, 49, 52 |  |
| 40 | Shrewsbury | ENG | town |  |  | 738 | 1317 | 30, 35, 38, 41 |  |
| 41 | Carmarthen | ENG | town | port |  | 660 | 1357 | 30, 40 |  |
| 42 | Dublin | ENG | town | port |  | 610 | 1238 | 43, 45, 46, 47 | 38 |
| 43 | Waterford | ENG | town | port |  | 555 | 1299 | 42, 44, 47 |  |
| 44 | Cork | ENG | town | port |  | 494 | 1305 | 43, 47, 48 |  |
| 45 | Galway | ENG | town | port |  | 501 | 1205 | 42, 46, 47 |  |
| 46 | Dungannon | TRN | town |  |  | 613 | 1157 | 42, 45 |  |
| 47 | Ennis | THO | town |  |  | 494 | 1238 | 42, 43, 44, 45, 48 |  |
| 48 | Tralee | DES | town | port |  | 453 | 1265 | 44, 47 |  |
| 49 | Edinburgh | SCO | town | port |  | 773 | 1099 | 37, 39, 50, 52 |  |
| 50 | Perth | SCO | town |  |  | 772 | 1067 | 49, 51, 52, 53 |  |
| 51 | Aberdeen | SCO | town | port |  | 831 | 1026 | 50, 53 |  |
| 52 | Glasgow | SCO | town |  |  | 733 | 1095 | 39, 49, 50, 53 |  |
| 53 | Inverness | ISL | town | port |  | 761 | 989 | 50, 51, 52 |  |
| 54 | Paris | FRA | city |  |  | 899 | 1618 | 55, 57, 79, 80, 81, 82, 92 |  |
| 55 | Orléans | FRA | town |  |  | 868 | 1679 | 54, 56, 57, 58, 92 |  |
| 56 | Blois | FRA | town |  |  | 838 | 1695 | 55, 57, 58, 59, 87 |  |
| 57 | Chartres | FRA | town |  |  | 856 | 1639 | 54, 55, 56, 84, 85, 87 |  |
| 58 | Bourges | FRA | town |  |  | 881 | 1738 | 55, 56, 60, 63, 78, 92, 113, 114 |  |
| 59 | Tours | FRA | town |  |  | 807 | 1703 | 56, 60, 87, 109 |  |
| 60 | Poitiers | FRA | town |  |  | 780 | 1754 | 58, 59, 61, 62, 63, 109 |  |
| 61 | La Rochelle | FRA | town | port |  | 707 | 1766 | 60, 62, 88, 106 |  |
| 62 | Angoulême | FRA | town |  |  | 759 | 1814 | 60, 61, 63, 64, 88 |  |
| 63 | Limoges | FRA | town |  |  | 813 | 1812 | 58, 60, 62, 64, 65, 74, 114 |  |
| 64 | Périgueux | FRA | town |  |  | 779 | 1851 | 62, 63, 65, 66, 88 |  |
| 65 | Cahors | FRA | town |  |  | 804 | 1906 | 63, 64, 66, 68, 74, 115 |  |
| 66 | Montauban | FRA | town |  |  | 795 | 1934 | 64, 65, 67, 68, 88, 116, 117 |  |
| 67 | Toulouse | FRA | city |  |  | 794 | 1964 | 66, 68, 69, 116, 118 |  |
| 68 | Albi | FRA | town |  |  | 832 | 1947 | 65, 66, 67, 69, 70, 115 |  |
| 69 | Carcassonne | FRA | town |  |  | 834 | 1998 | 67, 68, 70, 118, 162 |  |
| 70 | Narbonne | FRA | town |  |  | 865 | 2005 | 68, 69, 71, 162 |  |
| 71 | Montpellier | FRA | town | port |  | 913 | 1983 | 70, 72, 115 |  |
| 72 | Nîmes | FRA | town |  |  | 939 | 1971 | 71, 73, 76, 110, 115, 119 |  |
| 73 | Le Puy | FRA | town |  |  | 928 | 1886 | 72, 74, 76, 114, 115 |  |
| 74 | Saint-Flour | FRA | town |  |  | 890 | 1881 | 63, 65, 73, 114, 115 |  |
| 75 | Lyon | FRA | city |  |  | 980 | 1844 | 76, 77, 90, 114, 120, 121 |  |
| 76 | Valence | FRA | town |  |  | 975 | 1901 | 72, 73, 75, 77, 114, 119 |  |
| 77 | Grenoble | FRA | town |  |  | 1017 | 1888 | 75, 76, 119, 120, 124, 125 |  |
| 78 | Nevers | FRA | town |  |  | 914 | 1750 | 58, 90, 92, 113 |  |
| 79 | Troyes | FRA | town |  |  | 970 | 1668 | 54, 80, 90, 92, 112 |  |
| 80 | Reims | FRA | town |  |  | 977 | 1603 | 54, 79, 81, 112, 126 |  |
| 81 | Laon | FRA | town |  |  | 962 | 1580 | 54, 80, 94, 100, 126 |  |
| 82 | Beauvais | FRA | town |  |  | 894 | 1578 | 54, 83, 84, 94 |  |
| 83 | Calais | ENG | town | port |  | 904 | 1479 | 82, 93, 94, 95, 96 | 36 |
| 84 | Rouen | ENG | city | port |  | 851 | 1569 | 57, 82, 85 |  |
| 85 | Caen | ENG | town | port |  | 784 | 1574 | 57, 84, 86, 87, 105 |  |
| 86 | Cherbourg | ENG | town | port |  | 735 | 1535 | 85, 105 |  |
| 87 | Le Mans | ENG | town |  |  | 793 | 1658 | 56, 57, 59, 85, 105, 109 |  |
| 88 | Bordeaux | ENG | city | port |  | 713 | 1861 | 61, 62, 64, 66, 89, 117 |  |
| 89 | Bayonne | ENG | town | port |  | 653 | 1943 | 88, 117, 152, 173 |  |
| 90 | Dijon | BUR | town |  |  | 1004 | 1740 | 75, 78, 79, 91, 92, 111, 112, 113, 114, 121 |  |
| 91 | Besançon | BUR | town |  | HRE | 1048 | 1751 | 90, 111, 121, 123, 286, 288 |  |
| 92 | Auxerre | BUR | town |  |  | 942 | 1698 | 54, 55, 58, 78, 79, 90 |  |
| 93 | Arras | BUR | town |  |  | 934 | 1525 | 83, 94, 95, 100 |  |
| 94 | Amiens | BUR | town |  |  | 909 | 1549 | 81, 82, 83, 93, 100 |  |
| 95 | Lille | BUR | town |  |  | 949 | 1504 | 83, 93, 96, 97, 100 |  |
| 96 | Bruges | BUR | city | port |  | 963 | 1467 | 83, 95, 97 |  |
| 97 | Ghent | BUR | city |  |  | 982 | 1481 | 95, 96, 98, 99, 100 |  |
| 98 | Brussels | BUR | city |  | HRE | 1007 | 1498 | 97, 99, 100, 101, 126 |  |
| 99 | Antwerp | BUR | city | port | HRE | 1012 | 1474 | 97, 98, 102, 103, 126, 127, 128, 246 |  |
| 100 | Mons | BUR | town |  | HRE | 986 | 1523 | 81, 93, 94, 95, 97, 98, 101, 126 |  |
| 101 | Namur | BUR | town |  | HRE | 1025 | 1527 | 98, 100, 126 |  |
| 102 | Middelburg | BUR | town | port | HRE | 983 | 1449 | 99, 103 |  |
| 103 | Dordrecht | BUR | town | port | HRE | 1029 | 1435 | 99, 102, 104, 127 |  |
| 104 | Amsterdam | BUR | town | port | HRE | 1044 | 1399 | 103, 127 |  |
| 105 | Rennes | BRI | town |  |  | 711 | 1632 | 85, 86, 87, 106, 107, 109 |  |
| 106 | Nantes | BRI | city | port |  | 703 | 1693 | 61, 105, 107, 109 |  |
| 107 | Vannes | BRI | town | port |  | 656 | 1651 | 105, 106, 108 |  |
| 108 | Brest | BRI | town | port |  | 592 | 1583 | 107 |  |
| 109 | Angers | ANJ | town |  |  | 752 | 1686 | 59, 60, 87, 105, 106 |  |
| 110 | Marseille | ANJ | city | port |  | 984 | 2010 | 72, 119, 125 |  |
| 111 | Nancy | ANJ | town |  | HRE | 1067 | 1654 | 90, 91, 112, 270, 271, 285, 286 |  |
| 112 | Bar-le-Duc | ANJ | town |  | HRE | 1022 | 1643 | 79, 80, 90, 111, 130, 270 |  |
| 113 | Moulins | BOU | town |  |  | 918 | 1779 | 58, 78, 90, 114 |  |
| 114 | Clermont | BOU | town |  |  | 898 | 1830 | 58, 63, 73, 74, 75, 76, 90, 113 |  |
| 115 | Rodez | ARM | town |  |  | 857 | 1923 | 65, 68, 71, 72, 73, 74 |  |
| 116 | Lectoure | ARM | town |  |  | 758 | 1934 | 66, 67, 117 |  |
| 117 | Pau | FOI | town |  |  | 701 | 1966 | 66, 88, 89, 116, 118, 156 |  |
| 118 | Foix | FOI | town |  |  | 794 | 2007 | 67, 69, 117, 156, 158, 159, 161, 162 |  |
| 119 | Avignon | PAP | town |  |  | 962 | 1966 | 72, 76, 77, 110, 125 |  |
| 120 | Chambéry | SAV | town |  | HRE | 1030 | 1864 | 75, 77, 121, 122, 124 |  |
| 121 | Bourg-en-Bresse | SAV | town |  | HRE | 1003 | 1816 | 75, 90, 91, 120, 122 |  |
| 122 | Geneva | SAV | town |  | HRE | 1046 | 1822 | 120, 121, 123, 124 |  |
| 123 | Lausanne | SAV | town |  | HRE | 1070 | 1803 | 91, 122, 124, 288 |  |
| 124 | Turin | SAV | town |  | HRE | 1110 | 1907 | 77, 120, 122, 123, 125, 178, 195, 212 |  |
| 125 | Nice | SAV | town | port | HRE | 1078 | 1995 | 77, 110, 119, 124, 195 |  |
| 126 | Liège | LIE | city |  | HRE | 1057 | 1520 | 80, 81, 98, 99, 100, 101, 130, 246, 247, 258 |  |
| 127 | Utrecht | UTR | town |  | HRE | 1050 | 1419 | 99, 103, 104, 128, 129, 244, 245 |  |
| 128 | Nijmegen | GEL | town |  | HRE | 1079 | 1440 | 99, 127, 244 |  |
| 129 | Groningen | FRI | town | port | HRE | 1119 | 1350 | 127, 237, 245 |  |
| 130 | Luxembourg | LUX | town |  | HRE | 1072 | 1592 | 112, 126, 258, 270 |  |
| 131 | Toledo | CAS | city |  |  | 464 | 2153 | 132, 139, 140, 143, 145 |  |
| 132 | Madrid | CAS | town |  |  | 490 | 2120 | 131, 139, 145, 146, 149 |  |
| 133 | Seville | CAS | city | port |  | 316 | 2290 | 134, 136, 141, 170, 171, 175 |  |
| 134 | Córdoba | CAS | city |  |  | 389 | 2275 | 133, 135, 140, 141, 142, 174, 175 |  |
| 135 | Jaén | CAS | town |  |  | 440 | 2297 | 134, 137, 140, 174, 176 |  |
| 136 | Cádiz | CAS | town | port |  | 287 | 2343 | 133, 175 | 430 |
| 137 | Murcia | CAS | town |  |  | 585 | 2316 | 135, 138, 139, 140, 164, 176 |  |
| 138 | Cartagena | CAS | town | port |  | 586 | 2341 | 137, 176 |  |
| 139 | Cuenca | CAS | town |  |  | 565 | 2163 | 131, 132, 137, 140, 149, 157, 163, 164 |  |
| 140 | Ciudad Real | CAS | town |  |  | 454 | 2213 | 131, 134, 135, 137, 139, 142 |  |
| 141 | Badajoz | CAS | town |  |  | 294 | 2176 | 133, 134, 142, 169, 170 |  |
| 142 | Cáceres | CAS | town |  |  | 337 | 2146 | 134, 140, 141, 143, 169 |  |
| 143 | Plasencia | CAS | town |  |  | 362 | 2113 | 131, 142, 144, 145, 169 |  |
| 144 | Salamanca | CAS | town |  |  | 401 | 2057 | 143, 145, 147, 168 |  |
| 145 | Ávila | CAS | town |  |  | 444 | 2091 | 131, 132, 143, 144, 146, 147 |  |
| 146 | Segovia | CAS | town |  |  | 478 | 2079 | 132, 145, 147, 148, 149 |  |
| 147 | Valladolid | CAS | city |  |  | 461 | 2025 | 144, 145, 146, 148, 150, 168 |  |
| 148 | Burgos | CAS | city |  |  | 523 | 1992 | 146, 147, 149, 150, 151, 152 |  |
| 149 | Soria | CAS | town |  |  | 575 | 2046 | 132, 139, 146, 148, 152, 155, 157, 173 |  |
| 150 | León | CAS | town |  |  | 437 | 1950 | 147, 148, 151, 168 |  |
| 151 | Oviedo | CAS | town |  |  | 438 | 1896 | 148, 150, 152, 154, 168 |  |
| 152 | Bilbao | CAS | town | port |  | 576 | 1941 | 89, 148, 149, 151, 173 |  |
| 153 | Santiago | CAS | town |  |  | 299 | 1888 | 154, 168 |  |
| 154 | A Coruña | CAS | town | port |  | 319 | 1863 | 151, 153, 168 |  |
| 155 | Zaragoza | ARA | city |  |  | 653 | 2072 | 149, 156, 157, 158, 173 |  |
| 156 | Huesca | ARA | town |  |  | 683 | 2044 | 117, 118, 155, 158, 173 |  |
| 157 | Teruel | ARA | town |  |  | 622 | 2157 | 139, 149, 155, 158, 160, 163 |  |
| 158 | Lleida | ARA | town |  |  | 728 | 2089 | 118, 155, 156, 157, 159, 160 |  |
| 159 | Barcelona | ARA | city | port |  | 803 | 2117 | 118, 158, 160, 161 | 165 |
| 160 | Tarragona | ARA | town | port |  | 752 | 2126 | 157, 158, 159, 163 |  |
| 161 | Girona | ARA | town |  |  | 843 | 2085 | 118, 159, 162 |  |
| 162 | Perpignan | ARA | town |  |  | 855 | 2037 | 69, 70, 118, 161 |  |
| 163 | Valencia | ARA | city | port |  | 647 | 2224 | 139, 157, 160, 164 |  |
| 164 | Alicante | ARA | town | port |  | 623 | 2297 | 137, 139, 163 |  |
| 165 | Palma | ARA | town | port |  | 807 | 2243 |  | 159 |
| 166 | Lisbon | POR | city | port |  | 179 | 2150 | 169, 170, 171 |  |
| 167 | Porto | POR | town | port |  | 261 | 2000 | 168, 169 |  |
| 168 | Braga | POR | town |  |  | 277 | 1977 | 144, 147, 150, 151, 153, 154, 167, 169 |  |
| 169 | Coimbra | POR | town |  |  | 248 | 2064 | 141, 142, 143, 166, 167, 168, 170 |  |
| 170 | Évora | POR | town |  |  | 239 | 2181 | 133, 141, 166, 169, 171 |  |
| 171 | Lagos | POR | town | port |  | 169 | 2263 | 133, 166, 170 |  |
| 172 | Ceuta | POR | town | port |  | 319 | 2406 | 430 |  |
| 173 | Pamplona | NAV | town |  |  | 632 | 1985 | 89, 149, 152, 155, 156 |  |
| 174 | Granada | GRA | city |  |  | 440 | 2339 | 134, 135, 175, 176 |  |
| 175 | Málaga | GRA | town | port |  | 388 | 2355 | 133, 134, 136, 174 |  |
| 176 | Almería | GRA | town | port |  | 496 | 2374 | 135, 137, 138, 174 |  |
| 177 | Milan | MIL | city |  | HRE | 1184 | 1887 | 178, 185, 195, 212 |  |
| 178 | Como | MIL | town |  | HRE | 1181 | 1863 | 124, 177, 185, 212, 289 |  |
| 179 | Cremona | MIL | town |  | HRE | 1222 | 1912 | 180, 184, 185, 195, 211 |  |
| 180 | Parma | MIL | town |  | HRE | 1236 | 1936 | 179, 195, 201, 210, 211 |  |
| 181 | Venice | VEN | city | port |  | 1333 | 1895 | 182, 186, 209, 284 |  |
| 182 | Padua | VEN | town |  |  | 1313 | 1898 | 181, 183, 209, 284 |  |
| 183 | Verona | VEN | city |  |  | 1270 | 1894 | 182, 184, 209, 211, 284 |  |
| 184 | Brescia | VEN | town |  |  | 1233 | 1885 | 179, 183, 185, 211, 284 |  |
| 185 | Bergamo | VEN | town |  |  | 1208 | 1872 | 177, 178, 179, 184, 284, 287 |  |
| 186 | Udine | VEN | town |  |  | 1379 | 1856 | 181, 187, 290, 292, 293, 335 |  |
| 187 | Zara | VEN | town | port |  | 1477 | 1987 | 186, 188, 335, 360 |  |
| 188 | Spalato | VEN | town | port |  | 1535 | 2026 | 187, 360, 362 |  |
| 189 | Durazzo | VEN | town | port |  | 1696 | 2174 | 349, 350, 351, 359, 361, 363 |  |
| 190 | Corfu | VEN | town | port |  | 1720 | 2290 |  | 370 |
| 191 | Modon | VEN | town | port |  | 1840 | 2467 | 356, 357, 358 | 194 |
| 192 | Negroponte | VEN | town | port |  | 1927 | 2356 | 369 |  |
| 193 | Candia | VEN | city | port |  | 2040 | 2562 | 194 |  |
| 194 | Canea | VEN | town | port |  | 1976 | 2557 | 193 | 191 |
| 195 | Genoa | GEN | city | port |  | 1166 | 1954 | 124, 125, 177, 179, 180, 201, 212 |  |
| 196 | Bastia | GEN | town | port |  | 1179 | 2079 |  | 201, 229 |
| 197 | Chios | GEN | town | port |  | 2063 | 2340 |  | 376 |
| 198 | Famagusta | GEN | town | port |  | 2536 | 2474 | 402 | 391 |
| 199 | Caffa | GEN | city | port |  | 2430 | 1790 | 426 |  |
| 200 | Florence | FLO | city |  |  | 1277 | 2008 | 201, 202, 203, 208, 213 |  |
| 201 | Pisa | FLO | town | port |  | 1235 | 2009 | 180, 195, 200, 203, 210 | 196 |
| 202 | Arezzo | FLO | town |  |  | 1307 | 2031 | 200, 203, 206, 213 |  |
| 203 | Siena | SIE | town |  |  | 1279 | 2039 | 200, 201, 202, 205, 206 |  |
| 204 | Rome | PAP | city |  |  | 1334 | 2139 | 205, 216, 223 |  |
| 205 | Viterbo | PAP | town |  |  | 1315 | 2103 | 203, 204, 206, 216 |  |
| 206 | Perugia | PAP | town |  |  | 1332 | 2056 | 202, 203, 205, 207, 213, 216 |  |
| 207 | Ancona | PAP | town | port |  | 1384 | 2025 | 206, 216 |  |
| 208 | Bologna | PAP | city |  |  | 1284 | 1959 | 200, 209, 210, 213 |  |
| 209 | Ferrara | FER | town |  |  | 1298 | 1936 | 181, 182, 183, 208, 210, 211, 213 |  |
| 210 | Modena | FER | town |  | HRE | 1264 | 1948 | 180, 201, 208, 209, 211 |  |
| 211 | Mantua | MAN | town |  | HRE | 1260 | 1912 | 179, 180, 183, 184, 209, 210 |  |
| 212 | Casale | MON | town |  | HRE | 1147 | 1906 | 124, 177, 178, 195 |  |
| 213 | Rimini | RIM | town | port |  | 1338 | 1992 | 200, 202, 206, 208, 209 |  |
| 214 | Naples | NAP | city | port |  | 1424 | 2211 | 215, 217, 223 |  |
| 215 | Salerno | NAP | town | port |  | 1450 | 2222 | 214, 217, 218, 219, 221 |  |
| 216 | L'Aquila | NAP | town |  |  | 1381 | 2110 | 204, 205, 206, 207, 217, 223 |  |
| 217 | Foggia | NAP | town |  |  | 1490 | 2171 | 214, 215, 216, 218, 223 |  |
| 218 | Bari | NAP | town | port |  | 1557 | 2197 | 215, 217, 219 |  |
| 219 | Taranto | NAP | town | port |  | 1580 | 2235 | 215, 218, 220, 221 |  |
| 220 | Lecce | NAP | town |  |  | 1628 | 2245 | 219 |  |
| 221 | Cosenza | NAP | town |  |  | 1529 | 2320 | 215, 219, 222 |  |
| 222 | Reggio | NAP | town | port |  | 1505 | 2402 | 221 | 225 |
| 223 | Gaeta | ARA | town | port |  | 1389 | 2184 | 204, 214, 216, 217 |  |
| 224 | Palermo | ARA | city | port |  | 1371 | 2406 | 226 |  |
| 225 | Messina | ARA | town | port |  | 1480 | 2399 | 226 | 222 |
| 226 | Catania | ARA | town | port |  | 1464 | 2445 | 224, 225, 227 |  |
| 227 | Syracuse | ARA | town | port |  | 1474 | 2475 | 226 |  |
| 228 | Cagliari | ARA | town | port |  | 1147 | 2311 | 229 |  |
| 229 | Sassari | ARA | town |  |  | 1126 | 2207 | 228 | 196 |
| 230 | Schleswig | SHO | town | port |  | 1247 | 1273 | 17, 231, 232 |  |
| 231 | Lübeck | LUB | city | port | HRE | 1289 | 1320 | 230, 232, 233, 238 |  |
| 232 | Hamburg | HAM | city | port | HRE | 1260 | 1340 | 230, 231, 237, 238 |  |
| 233 | Schwerin | MEC | town |  | HRE | 1317 | 1338 | 231, 234, 238, 240, 242 |  |
| 234 | Rostock | MEC | town | port | HRE | 1346 | 1308 | 233, 236, 241 |  |
| 235 | Stettin | POM | town | port | HRE | 1444 | 1355 | 24, 26, 236, 241, 243 |  |
| 236 | Stralsund | POM | town | port | HRE | 1383 | 1297 | 234, 235 |  |
| 237 | Bremen | BRE | town | port | HRE | 1209 | 1369 | 129, 232, 238, 239, 245 |  |
| 238 | Lüneburg | BRU | town |  | HRE | 1275 | 1362 | 231, 232, 233, 237, 239, 240 |  |
| 239 | Brunswick | BRU | city |  | HRE | 1276 | 1429 | 237, 238, 240, 248, 253 |  |
| 240 | Magdeburg | MAG | city |  | HRE | 1321 | 1441 | 233, 238, 239, 242, 250, 251, 253 |  |
| 241 | Berlin | BRA | town |  | HRE | 1396 | 1417 | 234, 235, 242, 243, 250 |  |
| 242 | Brandenburg | BRA | town |  | HRE | 1361 | 1423 | 233, 240, 241, 250 |  |
| 243 | Frankfurt (Oder) | BRA | town |  | HRE | 1443 | 1429 | 26, 235, 241, 250, 254, 256 |  |
| 244 | Wesel | CLE | town |  | HRE | 1109 | 1456 | 127, 128, 245, 246 |  |
| 245 | Münster | MUN | town |  | HRE | 1154 | 1440 | 127, 129, 237, 244, 246, 248, 249 |  |
| 246 | Düsseldorf | JUL | town |  | HRE | 1113 | 1486 | 99, 126, 244, 245, 247, 249 |  |
| 247 | Cologne | COL | city |  | HRE | 1118 | 1506 | 126, 246, 249, 258, 259 |  |
| 248 | Kassel | HES | town |  | HRE | 1228 | 1491 | 239, 245, 249, 253 |  |
| 249 | Marburg | HES | town |  | HRE | 1195 | 1522 | 245, 246, 247, 248, 253, 259, 260 |  |
| 250 | Wittenberg | SAX | town |  | HRE | 1363 | 1460 | 240, 241, 242, 243, 251, 252 |  |
| 251 | Leipzig | SAX | town |  | HRE | 1350 | 1496 | 240, 250, 252, 253, 264, 266 |  |
| 252 | Dresden | SAX | town |  | HRE | 1408 | 1517 | 250, 251, 254, 265, 266 |  |
| 253 | Eisenach | SAX | town |  | HRE | 1262 | 1516 | 239, 240, 248, 249, 251, 260, 262, 264 |  |
| 254 | Bautzen | LUS | town |  | HRE | 1438 | 1508 | 243, 252, 256, 265, 267 |  |
| 255 | Breslau | SIL | city |  | HRE | 1549 | 1512 | 256, 257, 267, 269, 297 |  |
| 256 | Glogau | SIL | town |  | HRE | 1508 | 1475 | 26, 243, 254, 255, 295 |  |
| 257 | Oppeln | OPP | town |  | HRE | 1588 | 1541 | 255, 269, 294, 297, 298 |  |
| 258 | Trier | TRI | town |  | HRE | 1096 | 1584 | 126, 130, 247, 259, 263, 270, 272 |  |
| 259 | Mainz | MAI | town |  | HRE | 1168 | 1575 | 247, 249, 258, 260, 263 |  |
| 260 | Würzburg | WBG | town |  | HRE | 1240 | 1595 | 249, 253, 259, 261, 262, 263, 273 |  |
| 261 | Ansbach | ANS | town |  | HRE | 1266 | 1630 | 260, 262, 273, 274, 275, 276 |  |
| 262 | Nuremberg | NUR | city |  | HRE | 1289 | 1621 | 253, 260, 261, 264, 276 |  |
| 263 | Heidelberg | PAL | town |  | HRE | 1183 | 1618 | 258, 259, 260, 272, 273 |  |
| 264 | Amberg | PAL | town |  | HRE | 1323 | 1624 | 251, 253, 262, 266, 276, 277 |  |
| 265 | Prague | BOH | city |  | HRE | 1437 | 1583 | 252, 254, 266, 267, 281 |  |
| 266 | Plzeň | BOH | town |  | HRE | 1391 | 1605 | 251, 252, 264, 265, 277, 281 |  |
| 267 | Kutná Hora | BOH | town |  | HRE | 1474 | 1592 | 254, 255, 265, 268, 269, 281 |  |
| 268 | Brno | BOH | town |  | HRE | 1534 | 1642 | 267, 269, 280, 281, 324 |  |
| 269 | Olomouc | BOH | town |  | HRE | 1561 | 1615 | 255, 257, 267, 268, 294, 324 |  |
| 270 | Metz | MET | city |  | HRE | 1070 | 1625 | 111, 112, 130, 258, 271 |  |
| 271 | Strasbourg | STR | city |  | HRE | 1136 | 1669 | 111, 270, 272, 285 |  |
| 272 | Baden | BAD | town |  | HRE | 1159 | 1659 | 258, 263, 271, 273, 285 |  |
| 273 | Stuttgart | WRT | town |  | HRE | 1202 | 1661 | 260, 261, 263, 272, 274, 285 |  |
| 274 | Ulm | ULM | city |  | HRE | 1236 | 1690 | 261, 273, 275, 283, 287 |  |
| 275 | Augsburg | AUG | city |  | HRE | 1277 | 1694 | 261, 274, 276, 278, 283 |  |
| 276 | Ingolstadt | BIN | town |  | HRE | 1302 | 1668 | 261, 262, 264, 275, 277, 278, 279 |  |
| 277 | Regensburg | REG | town |  | HRE | 1333 | 1653 | 264, 266, 276, 279, 281 |  |
| 278 | Munich | BMU | town |  | HRE | 1307 | 1712 | 275, 276, 279, 283, 290 |  |
| 279 | Landshut | BLA | town |  | HRE | 1334 | 1685 | 276, 277, 278, 281, 290 |  |
| 280 | Vienna | AUS | city |  | HRE | 1524 | 1710 | 268, 281, 282, 324 |  |
| 281 | Linz | AUS | town |  | HRE | 1430 | 1703 | 265, 266, 267, 268, 277, 279, 280, 282, 290, 291 |  |
| 282 | Wiener Neustadt | AUS | town |  | HRE | 1519 | 1737 | 280, 281, 291, 324, 325 |  |
| 283 | Innsbruck | TYR | town |  | HRE | 1295 | 1770 | 274, 275, 278, 284, 287, 290 |  |
| 284 | Bozen | TYR | town |  | HRE | 1291 | 1823 | 181, 182, 183, 184, 185, 283, 287 |  |
| 285 | Freiburg | TYR | town |  | HRE | 1137 | 1710 | 111, 271, 272, 273, 286, 287 |  |
| 286 | Basel | BAS | town |  | HRE | 1122 | 1738 | 91, 111, 285, 287, 288, 289 |  |
| 287 | Zürich | ZUR | town |  | HRE | 1165 | 1755 | 185, 274, 283, 284, 285, 286, 289 |  |
| 288 | Bern | SWI | town |  | HRE | 1112 | 1778 | 91, 123, 286, 289 |  |
| 289 | Lucerne | SWI | town |  | HRE | 1152 | 1775 | 178, 286, 287, 288 |  |
| 290 | Salzburg | SAL | town |  | HRE | 1372 | 1737 | 186, 278, 279, 281, 283 |  |
| 291 | Graz | STY | town |  | HRE | 1482 | 1788 | 281, 282, 292, 325, 335 |  |
| 292 | Ljubljana | STY | town |  | HRE | 1439 | 1857 | 186, 291, 293, 335 |  |
| 293 | Trieste | STY | town | port | HRE | 1407 | 1883 | 186, 292 |  |
| 294 | Kraków | POL | city |  |  | 1677 | 1577 | 257, 269, 298, 300, 302, 324, 337, 338 |  |
| 295 | Poznań | POL | town |  |  | 1542 | 1424 | 26, 256, 296, 297 |  |
| 296 | Gniezno | POL | town |  |  | 1570 | 1415 | 24, 26, 295, 297, 299 |  |
| 297 | Kalisz | POL | town |  |  | 1592 | 1466 | 255, 257, 295, 296, 298, 299 |  |
| 298 | Sieradz | POL | town |  |  | 1619 | 1476 | 257, 294, 297, 299 |  |
| 299 | Łęczyca | POL | town |  |  | 1638 | 1444 | 26, 296, 297, 298, 300, 306, 307 |  |
| 300 | Sandomierz | POL | town |  |  | 1752 | 1529 | 294, 299, 301, 302, 306 |  |
| 301 | Lublin | POL | town |  |  | 1784 | 1487 | 300, 302, 303, 306, 312, 313 |  |
| 302 | Przemyśl | POL | town |  |  | 1802 | 1586 | 294, 300, 301, 303, 304, 337 |  |
| 303 | Lwów | POL | city |  |  | 1857 | 1575 | 301, 302, 304, 313 |  |
| 304 | Halicz | POL | town |  |  | 1893 | 1619 | 302, 303, 305, 313, 331, 332, 337, 366 |  |
| 305 | Kamieniec | POL | town |  |  | 1980 | 1638 | 304, 313, 322, 366, 367 |  |
| 306 | Warsaw | MAZ | town |  |  | 1712 | 1427 | 25, 299, 300, 301, 307, 311, 312 |  |
| 307 | Płock | MAZ | town |  |  | 1656 | 1409 | 25, 26, 299, 306 |  |
| 308 | Vilnius | LIT | city |  |  | 1866 | 1242 | 20, 309, 311, 314, 315 |  |
| 309 | Kaunas | LIT | town |  |  | 1810 | 1234 | 20, 25, 308, 310, 311 |  |
| 310 | Medininkai | LIT | town |  |  | 1738 | 1183 | 20, 25, 27, 309 |  |
| 311 | Grodno | LIT | town |  |  | 1817 | 1317 | 25, 306, 308, 309, 312, 314 |  |
| 312 | Brest-Litovsk | LIT | town |  |  | 1824 | 1425 | 301, 306, 311, 313, 314 |  |
| 313 | Lutsk | LIT | town |  |  | 1905 | 1507 | 301, 303, 304, 305, 312, 314, 319, 320, 322 |  |
| 314 | Minsk | LIT | town |  |  | 1964 | 1281 | 308, 311, 312, 313, 315, 316, 317, 320 |  |
| 315 | Polotsk | LIT | town |  |  | 1992 | 1166 | 20, 308, 314, 316, 318, 421 |  |
| 316 | Vitebsk | LIT | town |  |  | 2050 | 1175 | 314, 315, 317, 318 |  |
| 317 | Mogilev | LIT | town |  |  | 2073 | 1260 | 314, 316, 318, 320, 321 |  |
| 318 | Smolensk | LIT | city |  |  | 2126 | 1187 | 315, 316, 317, 321, 411, 415, 418, 421, 423 |  |
| 319 | Kiev | LIT | town |  |  | 2129 | 1488 | 313, 320, 321, 322, 426 |  |
| 320 | Chernigov | LIT | town |  |  | 2146 | 1412 | 313, 314, 317, 319, 321 |  |
| 321 | Novgorod-Seversky | LIT | town |  |  | 2219 | 1358 | 317, 318, 319, 320, 411, 424, 426 |  |
| 322 | Bratslav | LIT | town |  |  | 2082 | 1610 | 305, 313, 319, 367, 368, 426 |  |
| 323 | Buda | HUN | city |  |  | 1648 | 1754 | 325, 326, 328, 331, 337, 338 |  |
| 324 | Pozsony | HUN | town |  |  | 1558 | 1714 | 268, 269, 280, 282, 294, 325, 338 |  |
| 325 | Győr | HUN | town |  |  | 1582 | 1744 | 282, 291, 323, 324, 326, 327, 338 |  |
| 326 | Székesfehérvár | HUN | town |  |  | 1620 | 1776 | 323, 325, 327, 328 |  |
| 327 | Pécs | HUN | town |  |  | 1615 | 1853 | 325, 326, 328, 335, 336, 360, 361 |  |
| 328 | Szeged | HUN | town |  |  | 1705 | 1835 | 323, 326, 327, 329, 330, 331, 336 |  |
| 329 | Temesvár | HUN | town |  |  | 1758 | 1865 | 328, 330, 332, 333, 336, 346, 353 |  |
| 330 | Nagyvárad | HUN | town |  |  | 1783 | 1774 | 328, 329, 331, 332 |  |
| 331 | Debrecen | HUN | town |  |  | 1766 | 1743 | 304, 323, 328, 330, 332, 337 |  |
| 332 | Kolozsvár | HUN | town |  |  | 1862 | 1785 | 304, 329, 330, 331, 333, 334, 366 |  |
| 333 | Szeben | HUN | town |  |  | 1896 | 1848 | 329, 332, 334, 346, 364 |  |
| 334 | Brassó | HUN | town |  |  | 1966 | 1849 | 332, 333, 364, 365, 366, 367 |  |
| 335 | Zagreb | HUN | town |  |  | 1509 | 1873 | 186, 187, 291, 292, 327, 360 |  |
| 336 | Belgrade | HUN | town |  |  | 1726 | 1932 | 327, 328, 329, 353, 361 |  |
| 337 | Kassa | JIS | town |  |  | 1743 | 1664 | 294, 302, 304, 323, 331, 338 |  |
| 338 | Besztercebánya | JIS | town |  |  | 1648 | 1669 | 294, 323, 324, 325, 337 |  |
| 339 | Edirne | OTT | city |  |  | 2053 | 2110 | 340, 341, 343, 354, 355 |  |
| 340 | Gallipoli | OTT | town | port |  | 2066 | 2199 | 339, 354 | 375 |
| 341 | Philippopolis | OTT | town |  |  | 1957 | 2092 | 339, 342, 343, 345, 348 |  |
| 342 | Sofia | OTT | town |  |  | 1880 | 2063 | 341, 345, 346, 348, 349, 353, 359, 361 |  |
| 343 | Tarnovo | OTT | town |  |  | 1992 | 2022 | 339, 341, 344, 345, 355, 364 |  |
| 344 | Varna | OTT | town | port |  | 2102 | 1995 | 343, 355, 364, 365 |  |
| 345 | Nikopol | OTT | town |  |  | 1950 | 1985 | 341, 342, 343, 346, 364 |  |
| 346 | Vidin | OTT | town |  |  | 1849 | 1977 | 329, 333, 342, 345, 353, 364 |  |
| 347 | Salonica | OTT | city | port |  | 1877 | 2204 | 348, 350, 352 |  |
| 348 | Serres | OTT | town |  |  | 1905 | 2171 | 341, 342, 347, 349 |  |
| 349 | Skopje | OTT | town |  |  | 1790 | 2120 | 189, 342, 348, 350, 359 |  |
| 350 | Monastir | OTT | town |  |  | 1790 | 2187 | 189, 347, 349, 351, 352 |  |
| 351 | Ioannina | OTT | town |  |  | 1773 | 2283 | 189, 350, 352, 370 |  |
| 352 | Larissa | OTT | town |  |  | 1856 | 2277 | 347, 350, 351, 358, 369, 370 |  |
| 353 | Smederevo | OTT | town |  |  | 1750 | 1941 | 329, 336, 342, 346, 361 |  |
| 354 | Constantinople | BYZ | city | port |  | 2180 | 2131 | 339, 340, 355 | 372 |
| 355 | Mesembria | BYZ | town | port |  | 2091 | 2032 | 339, 343, 344, 354 |  |
| 356 | Mistra | MOR | town |  |  | 1871 | 2455 | 191, 357 |  |
| 357 | Patras | MOR | town | port |  | 1833 | 2380 | 191, 356, 358 |  |
| 358 | Corinth | MOR | town | port |  | 1893 | 2395 | 191, 352, 357, 369, 370 |  |
| 359 | Novo Brdo | SER | town |  |  | 1786 | 2078 | 189, 342, 349, 361 |  |
| 360 | Jajce | BOS | town |  |  | 1573 | 1972 | 187, 188, 327, 335, 361, 362 |  |
| 361 | Srebrenica | BOS | town |  |  | 1673 | 1984 | 189, 327, 336, 342, 353, 359, 360, 362 |  |
| 362 | Blagaj | HER | town |  |  | 1606 | 2045 | 188, 360, 361, 363 |  |
| 363 | Ragusa | RAG | town | port |  | 1622 | 2085 | 189, 362 |  |
| 364 | Târgoviște | WAL | town |  |  | 1966 | 1898 | 333, 334, 343, 344, 345, 346, 365 |  |
| 365 | Brăila | WAL | town |  |  | 2081 | 1856 | 334, 344, 364, 367, 368 |  |
| 366 | Suceava | MOL | town |  |  | 1976 | 1709 | 304, 305, 332, 334, 367 |  |
| 367 | Iași | MOL | town |  |  | 2042 | 1732 | 305, 322, 334, 365, 366, 368 |  |
| 368 | Akkerman | MOL | town | port |  | 2181 | 1773 | 322, 365, 367 |  |
| 369 | Athens | ATH | town | port |  | 1939 | 2384 | 192, 352, 358 |  |
| 370 | Arta | EPI | town |  |  | 1783 | 2317 | 351, 352, 358 | 190 |
| 371 | Mytilene | LES | town | port |  | 2072 | 2284 |  | 375 |
| 372 | Bursa | OTT | city |  |  | 2199 | 2190 | 373, 375, 380 | 354 |
| 373 | Nicaea | OTT | town |  |  | 2230 | 2166 | 372, 374, 380, 383 |  |
| 374 | Izmit | OTT | town | port |  | 2235 | 2142 | 373, 383, 393 |  |
| 375 | Balıkesir | OTT | town |  |  | 2144 | 2237 | 372, 376, 379, 380 | 340, 371 |
| 376 | Smyrna | OTT | town | port |  | 2122 | 2327 | 375, 377, 379 | 197 |
| 377 | Ayasoluk | OTT | town |  |  | 2137 | 2358 | 376, 378, 379 |  |
| 378 | Milas | OTT | town |  |  | 2167 | 2397 | 377, 379, 404 |  |
| 379 | Denizli | OTT | town |  |  | 2232 | 2353 | 375, 376, 377, 378, 380, 381, 382 |  |
| 380 | Kütahya | OTT | town |  |  | 2257 | 2232 | 372, 373, 375, 379, 381, 383 |  |
| 381 | Afyon | OTT | town |  |  | 2296 | 2270 | 379, 380, 382, 383, 387 |  |
| 382 | Antalya | OTT | town | port |  | 2332 | 2393 | 379, 381, 387, 392 |  |
| 383 | Ankara | OTT | town |  |  | 2399 | 2164 | 373, 374, 380, 381, 384, 387, 389, 390, 393 |  |
| 384 | Amasya | OTT | town |  |  | 2537 | 2075 | 383, 385, 386, 390, 393, 394 |  |
| 385 | Tokat | OTT | town |  |  | 2580 | 2087 | 384, 386, 390, 395, 396, 400 |  |
| 386 | Samsun | OTT | town | port |  | 2551 | 2030 | 384, 385, 394 |  |
| 387 | Konya | KAR | city |  |  | 2413 | 2307 | 381, 382, 383, 388, 389, 392 |  |
| 388 | Karaman | KAR | town |  |  | 2464 | 2344 | 387, 389, 391, 392, 398 |  |
| 389 | Aksaray | KAR | town |  |  | 2486 | 2253 | 383, 387, 388, 390, 398 |  |
| 390 | Kayseri | KAR | town |  |  | 2556 | 2208 | 383, 384, 385, 389, 396, 397, 398 |  |
| 391 | Silifke | KAR | town | port |  | 2513 | 2385 | 388, 392, 398 | 198 |
| 392 | Alanya | KAR | town | port |  | 2411 | 2401 | 382, 387, 388, 391 |  |
| 393 | Kastamonu | CAN | town |  |  | 2421 | 2055 | 374, 383, 384, 394 |  |
| 394 | Sinop | CAN | town | port |  | 2477 | 1999 | 384, 386, 393 |  |
| 395 | Trebizond | TRE | town | port |  | 2726 | 1995 | 385, 400, 401, 426 |  |
| 396 | Elbistan | DUL | town |  |  | 2656 | 2217 | 385, 390, 397, 399, 400 |  |
| 397 | Maraş | DUL | town |  |  | 2655 | 2262 | 390, 396, 398, 399 |  |
| 398 | Adana | RAM | town |  |  | 2580 | 2326 | 388, 389, 390, 391, 397 |  |
| 399 | Diyarbakır | AQQ | town |  |  | 2819 | 2184 | 396, 397, 400, 401 |  |
| 400 | Erzincan | AQQ | town |  |  | 2740 | 2077 | 385, 395, 396, 399, 401 |  |
| 401 | Erzurum | AQQ | town |  |  | 2825 | 2035 | 395, 399, 400, 426 |  |
| 402 | Nicosia | CYP | town |  |  | 2506 | 2479 | 198 |  |
| 403 | Rhodes | KRH | town | port |  | 2197 | 2461 |  | 404 |
| 404 | Bodrum | KRH | town | port |  | 2155 | 2419 | 378 | 403 |
| 405 | Moscow | MOS | city |  |  | 2318 | 1066 | 406, 407, 410, 411, 422 |  |
| 406 | Vladimir | MOS | town |  |  | 2411 | 1007 | 405, 407, 409, 410, 424 |  |
| 407 | Rostov | MOS | town |  |  | 2352 | 951 | 405, 406, 408, 409, 422 |  |
| 408 | Yaroslavl | MOS | town |  |  | 2357 | 917 | 407, 409, 412, 422 |  |
| 409 | Kostroma | MOS | town |  |  | 2391 | 895 | 406, 407, 408, 412, 420 |  |
| 410 | Kolomna | MOS | town |  |  | 2374 | 1094 | 405, 406, 411, 424 |  |
| 411 | Mozhaysk | MOS | town |  |  | 2264 | 1100 | 318, 321, 405, 410, 422, 423, 424 |  |
| 412 | Vologda | MOS | town |  |  | 2322 | 814 | 408, 409, 413, 419, 420, 422 |  |
| 413 | Beloozero | MOS | town |  |  | 2235 | 784 | 412, 416, 418, 419, 422 |  |
| 414 | Novgorod | NOV | city |  |  | 2041 | 944 | 22, 415, 416, 418, 421 |  |
| 415 | Staraya Russa | NOV | town |  |  | 2052 | 979 | 318, 414, 418, 421 |  |
| 416 | Ladoga | NOV | town |  |  | 2053 | 837 | 13, 413, 414, 417, 418, 419 |  |
| 417 | Korela | NOV | town |  |  | 1966 | 783 | 11, 13, 416, 419, 420 |  |
| 418 | Torzhok | NOV | town |  |  | 2196 | 1010 | 318, 413, 414, 415, 416, 422, 423 |  |
| 419 | Kargopol | NOV | town |  |  | 2241 | 675 | 412, 413, 416, 417, 420 |  |
| 420 | Kholmogory | NOV | town |  |  | 2258 | 468 | 11, 409, 412, 417, 419 |  |
| 421 | Pskov | PSK | town |  |  | 1946 | 1012 | 20, 22, 315, 318, 414, 415 |  |
| 422 | Tver | TVE | town |  |  | 2234 | 1012 | 405, 407, 408, 411, 412, 413, 418, 423 |  |
| 423 | Rzhev | TVE | town |  |  | 2187 | 1067 | 318, 411, 418, 422 |  |
| 424 | Ryazan | RYA | town |  |  | 2420 | 1113 | 321, 406, 410, 411, 426 |  |
| 425 | Mangup | THE | town |  |  | 2367 | 1842 | 426 |  |
| 426 | Azak | GHO | town | port |  | 2574 | 1601 | 199, 319, 321, 322, 395, 401, 424, 425 |  |
| 427 | Fez | MRC | city |  |  | 306 | 2532 | 428, 429, 430 |  |
| 428 | Meknes | MRC | town |  |  | 272 | 2533 | 427, 430, 431, 434 |  |
| 429 | Taza | MRC | town |  |  | 365 | 2535 | 427, 430, 435 |  |
| 430 | Tangier | MRC | town | port |  | 292 | 2405 | 172, 427, 428, 429, 431 | 136 |
| 431 | Salé | MRC | town | port |  | 208 | 2505 | 428, 430, 432, 434 |  |
| 432 | Azemmour | MRC | town | port |  | 103 | 2529 | 431, 433, 434 |  |
| 433 | Safi | MRC | town | port |  | 34 | 2577 | 432, 434 |  |
| 434 | Marrakesh | MRC | city |  |  | 85 | 2644 | 428, 431, 432, 433 |  |
| 435 | Tlemcen | TLE | city |  |  | 528 | 2526 | 429, 436 |  |
| 436 | Oran | TLE | town | port |  | 579 | 2482 | 435, 437 |  |
| 437 | Algiers | TLE | town | port |  | 798 | 2447 | 436, 439 |  |
| 438 | Tunis | TUN | city | port |  | 1193 | 2485 | 441, 442 |  |
| 439 | Bougie | TUN | town | port |  | 909 | 2465 | 437, 440 |  |
| 440 | Constantine | TUN | town |  |  | 991 | 2498 | 439, 441, 442, 444 |  |
| 441 | Bône | TUN | town | port |  | 1056 | 2472 | 438, 440, 442 |  |
| 442 | Kairouan | TUN | town |  |  | 1183 | 2563 | 438, 440, 441, 443, 444 |  |
| 443 | Sfax | TUN | town | port |  | 1214 | 2629 | 442, 444 |  |
| 444 | Gabès | TUN | town | port |  | 1171 | 2690 | 440, 442, 443, 445 |  |
| 445 | Tripoli | TUN | town | port |  | 1352 | 2772 | 444 |  |

## Mountain passes

Yellow triangles on the map. Every route listed runs settlement → pass → settlement. A pass belongs to whoever
owns the settlement whose land it lies in (RULES.md §8). *Pass, X, Y and Routes are data; the other columns are
generated from where the pass lies.*

| Pass | X | Y | Routes | In the land of | Owner at start |
|---|---|---|---|---|---|
| P1 | 1161 | 1810 | 178-289 | 289 Lucerne | SWI Swiss Confederacy |
| P2 | 1240 | 1777 | 283-287 | 283 Innsbruck | TYR Tyrol |
| P3 | 1300 | 1789 | 283-284 | 283 Innsbruck | TYR Tyrol |
| P4 | 1500 | 1750 | 282-291 | 282 Wiener Neustadt | AUS Austria |
| P5 | 1417 | 1541 | 252-265 | 252 Dresden | SAX Saxony |
| P6 | 1369 | 1634 | 264-266, 266-277 | 266 Plzeň | BOH Bohemia |
| P7 | 1514 | 1560 | 255-267 | 267 Kutná Hora | BOH Bohemia |
| P8 | 1630 | 1616 | 294-338 | 338 Besztercebánya | JIS Upper Hungary |
| P9 | 1758 | 1616 | 302-337, 294-337 | 337 Kassa | JIS Upper Hungary |
| P10 | 1825 | 1645 | 304-331, 304-337, 304-332 | 302 Przemyśl | POL Poland |
| P11 | 1119 | 1657 | 111-271 | 271 Strasbourg | STR Strasbourg |
| P12 | 1091 | 1850 | 123-124, 122-124 | 123 Lausanne | SAV Savoy |
| P13 | 1074 | 1890 | 120-124, 77-124 | 124 Turin | SAV Savoy |
| P14 | 650 | 1975 | 89-173 | 173 Pamplona | NAV Navarre |
| P15 | 687 | 1998 | 117-156 | 117 Pau | FOI Foix-Béarn |
| P16 | 799 | 2038 | 118-158, 118-162 | 118 Foix | FOI Foix-Béarn |
| P17 | 1956 | 1859 | 334-364 | 334 Brassó | HUN Hungary |
| P18 | 1904 | 1864 | 333-364 | 333 Szeben | HUN Hungary |
| P19 | 1927 | 1743 | 332-366 | 366 Suceava | MOL Moldavia |
| P20 | 1980 | 2047 | 341-343 | 343 Tarnovo | OTT Ottoman Empire |
| P21 | 1279 | 1986 | 200-208 | 200 Florence | FLO Florence |
| P22 | 2547 | 2315 | 388-398, 389-398 | 398 Adana | RAM Ramadan |
| P23 | 1287 | 742 | 1-3, 2-3 | 3 Nidaros | NOR Norway |

## Route bends

A route is drawn straight, and the script bends it by itself only where the straight line would leave its
countries' land. List a route here to bend it through points of your own. *All columns are data.* Points are x,y
in map units, in order from the lower-numbered settlement; the route's length (and so its marching time) follows
the bend.

| Route | Through | Why |
|---|---|---|

## Mountains

Decoration only — mountains have no rules effect outside the passes. Apex positions (x,y in map units);
`node tools/map.js scenarios/europe-1440 mountains` moves any that touch something else.

```
1555,306  1504,415  1462,522  1400,641  1255,720  1247,793  1226,916  1190,929
721,983  1703,1632  1859,1640  1883,1712  1450,1762  1129,1789  1928,1792  1434,1795
1838,1820  1064,1841  1856,1869  475,1927  2802,1985  728,2036  1913,2036  2004,2050
400,2074  1939,2132  2661,2132  1489,2192  1798,2240  2496,2293  2452,2365  776,2551
920,2558  657,2565  536,2576  412,2591  312,2624  90,2663  205,2668
```

## Overview

<!-- generated:overview -->
**Cities (20K):** 2, 5, 20, 24, 28, 29, 30, 54, 67, 75, 84, 88, 96, 97, 98, 99, 106, 110, 126, 131, 133, 134, 147, 148, 155, 159, 163, 166, 174, 177, 181, 183, 193, 195, 199, 200, 204, 208, 214, 224, 231, 232, 239, 240, 247, 255, 262, 265, 270, 271, 274, 275, 280, 294, 303, 308, 318, 323, 339, 347, 354, 372, 387, 405, 414, 427, 434, 435, 438 — all other settlements are towns (10K).

**HRE settlements (91):** 91, 98–104, 111, 112, 120–130, 177–180, 210–212, 231–293 — held by 53 of the 118 countries.

**Ports (143):** 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 27, 28, 30, 31, 32, 33, 37, 38, 41, 42, 43, 44, 45, 48, 49, 51, 53, 61, 71, 83, 84, 85, 86, 88, 89, 96, 99, 102, 103, 104, 106, 107, 108, 110, 125, 129, 133, 136, 138, 152, 154, 159, 160, 163, 164, 165, 166, 167, 171, 172, 175, 176, 181, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 201, 207, 213, 214, 215, 218, 219, 222, 223, 224, 225, 226, 227, 228, 230, 231, 232, 234, 235, 236, 237, 293, 340, 344, 347, 354, 355, 357, 358, 363, 368, 369, 371, 374, 376, 382, 386, 391, 392, 394, 395, 403, 404, 426, 430, 431, 432, 433, 436, 437, 438, 439, 441, 443, 444, 445 — on the coast; grow +0.5% more (RULES.md §2).

**On a river (111):** 20, 24, 26, 28, 36, 54, 55, 56, 59, 66, 67, 72, 73, 75, 76, 78, 79, 84, 88, 90, 101, 103, 106, 109, 112, 113, 116, 119, 122, 123, 124, 126, 127, 128, 131, 133, 134, 135, 136, 139, 142, 143, 147, 149, 155, 166, 167, 177, 179, 180, 209, 211, 212, 232, 235, 237, 238, 240, 243, 244, 246, 247, 248, 250, 252, 255, 256, 257, 259, 263, 265, 267, 269, 271, 272, 274, 275, 276, 277, 280, 281, 285, 286, 287, 294, 300, 304, 305, 306, 307, 309, 311, 315, 317, 318, 319, 323, 324, 325, 327, 336, 345, 346, 353, 365, 368, 408, 409, 418, 422, 426 — within 24px of a river on the map; grow +0.5% more (RULES.md §2).

**Routes crossing a river (265):** 20-22, 20-23, 20-315, 20-421, 24-25, 24-26, 24-235, 25-26, 25-27, 25-306, 25-309, 25-310, 26-235, 26-243, 26-307, 28-32, 28-36, 54-55, 54-57, 54-92, 55-58, 56-58, 57-84, 58-92, 59-60, 60-109, 61-88, 61-106, 62-88, 64-88, 66-67, 66-88, 66-116, 66-117, 67-68, 67-69, 67-118, 72-110, 73-76, 75-76, 75-77, 75-114, 75-120, 76-77, 76-114, 76-119, 77-119, 78-90, 78-92, 79-90, 79-92, 80-126, 81-126, 84-85, 90-113, 90-114, 99-103, 99-127, 99-128, 99-246, 102-103, 110-119, 111-112, 111-285, 112-130, 112-270, 117-118, 118-156, 119-125, 120-121, 120-122, 122-124, 123-124, 124-125, 124-195, 124-212, 126-130, 126-246, 126-247, 126-258, 127-128, 128-244, 131-139, 131-140, 131-143, 132-139, 132-149, 133-134, 133-136, 133-175, 134-135, 134-174, 134-175, 135-137, 135-140, 139-149, 141-169, 142-143, 142-169, 144-147, 144-168, 145-147, 146-147, 146-148, 146-149, 148-149, 148-152, 149-152, 149-155, 149-173, 155-157, 157-158, 157-160, 160-163, 166-169, 167-169, 168-169, 169-170, 177-195, 179-180, 179-195, 180-211, 181-209, 182-209, 183-209, 185-287, 195-212, 209-211, 210-211, 231-238, 232-237, 232-238, 233-238, 233-240, 235-243, 237-238, 237-239, 239-248, 240-242, 240-250, 243-256, 244-246, 245-246, 246-249, 247-249, 247-259, 248-253, 249-253, 250-251, 250-252, 252-254, 254-256, 254-265, 254-267, 255-257, 255-267, 255-269, 257-294, 257-297, 257-298, 258-259, 258-263, 258-272, 259-263, 261-275, 268-280, 269-294, 271-272, 271-285, 274-275, 274-283, 274-287, 275-276, 276-278, 276-279, 277-279, 279-281, 280-281, 280-324, 281-282, 281-290, 281-291, 282-324, 283-287, 284-287, 285-286, 285-287, 294-302, 294-324, 294-337, 294-338, 299-307, 300-301, 300-302, 301-306, 304-331, 304-332, 304-337, 304-366, 305-366, 305-367, 306-307, 306-311, 306-312, 308-311, 308-315, 309-311, 311-314, 313-320, 314-315, 314-320, 315-316, 315-318, 317-318, 317-320, 317-321, 318-321, 318-411, 318-415, 318-418, 318-421, 319-320, 319-321, 319-426, 322-367, 322-426, 323-328, 323-331, 323-337, 323-338, 324-325, 325-338, 326-328, 327-328, 327-336, 328-336, 329-336, 329-346, 333-346, 336-353, 341-345, 342-345, 342-353, 343-345, 343-364, 344-364, 344-365, 345-346, 346-353, 346-364, 353-361, 365-368, 367-368, 395-426, 401-426, 405-422, 406-409, 407-408, 407-409, 407-422, 408-422, 411-422, 418-423, 422-423, 424-426 — +1 month to march (RULES.md §8).

**Marching** at 315 map units a year, +1 month per river crossing, +2 per leg to or from a pass: a route takes 0.06–1.92 years (median 0.29); through a pass 0.49–1.21.

| Pop | Countries |
|---|---|
| 330K | 1: OTT Ottoman Empire |
| 320K | 1: FRA France |
| 300K | 1: ENG England |
| 290K | 1: CAS Castile |
| 220K | 1: ARA Aragon |
| 190K | 1: BUR Burgundy |
| 170K | 2: VEN Venice · LIT Lithuania |
| 150K | 1: HUN Hungary |
| 140K | 1: POL Poland |
| 100K | 4: SWE Sweden · NAP Naples · MOS Muscovy · MRC Morocco |
| 90K | 1: TUN Tunis |
| 80K | 3: POR Portugal · PAP Papal States · NOV Novgorod |
| 70K | 2: GEN Genoa · KAR Karaman |
| 60K | 2: SAV Savoy · BOH Bohemia |
| 50K | 7: NOR Norway · DEN Denmark · LIV Livonian Order · TEU Teutonic Order · BRI Brittany · ANJ Anjou · MIL Milan |
| 40K | 6: SCO Scotland · GRA Granada · FLO Florence · SAX Saxony · AUS Austria · TLE Tlemcen |
| 30K | 9: BRU Brunswick-Lüneburg · BRA Brandenburg · SIL Silesia · TYR Tyrol · STY Inner Austria · BYZ Byzantium · MOR Morea · MOL Moldavia · AQQ Aq Qoyunlu |
| 20K | 27: BOU Bourbon · ARM Armagnac · FOI Foix-Béarn · LIE Liège · FER Ferrara · LUB Lübeck · HAM Hamburg · MEC Mecklenburg · POM Pomerania · MAG Magdeburg · COL Cologne · HES Hesse · NUR Nuremberg · PAL Palatinate · MET Metz · STR Strasbourg · ULM Ulm · AUG Augsburg · SWI Swiss Confederacy · MAZ Masovia · JIS Upper Hungary · BOS Bosnia · WAL Wallachia · CAN Candar · DUL Dulkadir · KRH Knights of Rhodes · TVE Tver |
| 10K | 47: GOT Gotland · ISL Lordship of the Isles · TRN Tyrone · THO Thomond · DES Desmond · UTR Utrecht · GEL Guelders · FRI Frisia · LUX Luxembourg · NAV Navarre · SIE Siena · MAN Mantua · MON Montferrat · RIM Rimini · SHO Schleswig-Holstein · BRE Bremen · CLE Cleves-Mark · MUN Münster · JUL Jülich-Berg · LUS Upper Lusatia · OPP Opole · TRI Trier · MAI Mainz · WBG Würzburg · ANS Ansbach-Kulmbach · BAD Baden · WRT Württemberg · BIN Bavaria-Ingolstadt · REG Regensburg · BMU Bavaria-Munich · BLA Bavaria-Landshut · BAS Basel · ZUR Zürich · SAL Salzburg · SER Serbia · HER Herzegovina · RAG Ragusa · ATH Athens · EPI Epirus · LES Lesbos · TRE Trebizond · RAM Ramadan · CYP Cyprus · PSK Pskov · RYA Ryazan · THE Theodoro · GHO Great Horde |

**Sailing:** 2 months to a neighbouring sea zone (RULES.md §8); the furthest apart, Gulf of Riga and Sea of Azov, are 17 hops (34 months).

**Naval powers:** 48 countries, 1695 ships. Crossing a strait needs 10 ships (10 × x) in the sea zone the strait lies in (RULES.md §8), so at the start a country can only cross the straits of its own ports' zones; for any other it must first sail 10 ships there.

| Country | Ports held | Home zones | Ships | Can cross straits? |
|---|---|---|---|---|
| OTT Ottoman Empire | 340, 344, 347, 374, 376, 382, 386 | Aegean Sea, Levantine Sea, Sea of Marmara, Western Black Sea, Eastern Black Sea | 165 | yes: 197-376, 198-391, 340-375, 354-372, 371-375, 403-404 |
| FRA France | 61, 71 | Bay of Biscay, Western Mediterranean | 160 | yes: 159-165, 196-229 |
| ENG England | 28, 30, 31, 32, 33, 37, 38, 41, 42, 43, 44, 45, 83, 84, 85, 86, 88, 89 | North Sea, English Channel, Irish Sea, Atlantic, Bay of Biscay | 150 | yes: 36-83, 38-42 |
| CAS Castile | 133, 136, 138, 152, 154 | Atlantic, Bay of Biscay, Gulf of Cádiz, Western Mediterranean | 145 | yes: 136-430, 159-165, 196-229 |
| ARA Aragon | 159, 160, 163, 164, 165, 223, 224, 225, 226, 227, 228 | Western Mediterranean, Tyrrhenian Sea, Ionian Sea | 110 | yes: 159-165, 190-370, 191-194, 196-229, 222-225 |
| BUR Burgundy | 96, 99, 102, 103, 104 | North Sea | 95 | no — no strait in its zones |
| VEN Venice | 181, 187, 188, 189, 190, 191, 192, 193, 194 | Ionian Sea, Adriatic Sea, Aegean Sea | 85 | yes: 190-370, 191-194, 197-376, 222-225, 371-375 |
| SWE Sweden | 5, 8, 9, 10, 11, 12, 13 | Kattegat, Baltic Sea, Northern Baltic, Gulf of Bothnia, Gulf of Finland | 50 | yes: 8-19, 14-15 |
| NAP Naples | 214, 215, 218, 219, 222 | Tyrrhenian Sea, Ionian Sea, Adriatic Sea | 50 | yes: 190-370, 191-194, 222-225 |
| MRC Morocco | 430, 431, 432, 433 | Gulf of Cádiz | 50 | yes: 136-430 |
| TUN Tunis | 438, 439, 441, 443, 444, 445 | Western Mediterranean, Tyrrhenian Sea, Strait of Sicily | 45 | yes: 159-165, 196-229 |
| POR Portugal | 166, 167, 171, 172 | Gulf of Cádiz, Alboran Sea | 40 | yes: 136-430 |
| PAP Papal States | 207 | Adriatic Sea | 40 | no — no strait in its zones |
| GEN Genoa | 195, 196, 197, 198, 199 | Ligurian Sea, Tyrrhenian Sea, Aegean Sea, Levantine Sea, Eastern Black Sea | 35 | yes: 196-201, 197-376, 198-391, 371-375, 403-404 |
| KAR Karaman | 391, 392 | Levantine Sea | 35 | yes: 198-391, 403-404 |
| SAV Savoy | 125 | Ligurian Sea | 30 | yes: 196-201 |
| NOR Norway | 1, 2, 3, 4 | Norwegian Sea, North Sea, Skagerrak | 25 | no — no strait in its zones |
| DEN Denmark | 14, 16, 17, 18 | Kattegat, Belt Sea | 25 | yes: 14-15, 14-16, 16-17 |
| LIV Livonian Order | 20, 21, 23 | Gulf of Riga, Gulf of Finland | 25 | no — no strait in its zones |
| TEU Teutonic Order | 24, 25, 27 | Baltic Sea | 25 | yes: 8-19 |
| BRI Brittany | 106, 107, 108 | English Channel, Bay of Biscay | 25 | yes: 36-83 |
| ANJ Anjou | 110 | Western Mediterranean | 25 | yes: 159-165, 196-229 |
| SCO Scotland | 49, 51 | North Sea | 20 | no — no strait in its zones |
| GRA Granada | 175, 176 | Alboran Sea | 20 | no — no strait in its zones |
| FLO Florence | 201 | Ligurian Sea | 20 | yes: 196-201 |
| TLE Tlemcen | 436, 437 | Western Mediterranean | 20 | yes: 159-165, 196-229 |
| STY Inner Austria | 293 | Adriatic Sea | 15 | no — no strait in its zones |
| BYZ Byzantium | 354, 355 | Sea of Marmara, Western Black Sea | 15 | yes: 340-375, 354-372 |
| MOR Morea | 357, 358 | Ionian Sea, Aegean Sea | 15 | yes: 190-370, 191-194, 197-376, 222-225, 371-375 — one zone at a time (10 ships in each) |
| MOL Moldavia | 368 | Western Black Sea | 15 | no — no strait in its zones |
| LUB Lübeck | 231 | Belt Sea | 10 | **exactly**: 14-16, 16-17 |
| HAM Hamburg | 232 | North Sea | 10 | no — no strait in its zones |
| MEC Mecklenburg | 234 | Belt Sea | 10 | **exactly**: 14-16, 16-17 |
| POM Pomerania | 235, 236 | Baltic Sea | 10 | **exactly**: 8-19 |
| CAN Candar | 394 | Eastern Black Sea | 10 | no — no strait in its zones |
| KRH Knights of Rhodes | 403, 404 | Aegean Sea, Levantine Sea | 10 | **exactly**: 197-376, 198-391, 371-375, 403-404 — one zone at a time (10 ships in each) |
| GOT Gotland | 19 | Northern Baltic | 5 | no — no strait in its zones |
| ISL Lordship of the Isles | 53 | North Sea | 5 | no — no strait in its zones |
| DES Desmond | 48 | Atlantic | 5 | no — no strait in its zones |
| FRI Frisia | 129 | North Sea | 5 | no — no strait in its zones |
| RIM Rimini | 213 | Adriatic Sea | 5 | no — no strait in its zones |
| SHO Schleswig-Holstein | 230 | Belt Sea | 5 | no — too few ships for 14-16, 16-17 |
| BRE Bremen | 237 | North Sea | 5 | no — no strait in its zones |
| RAG Ragusa | 363 | Adriatic Sea | 5 | no — no strait in its zones |
| ATH Athens | 369 | Aegean Sea | 5 | no — too few ships for 197-376, 371-375 |
| LES Lesbos | 371 | Aegean Sea | 5 | no — too few ships for 197-376, 371-375 |
| TRE Trebizond | 395 | Eastern Black Sea | 5 | no — no strait in its zones |
| GHO Great Horde | 426 | Sea of Azov | 5 | no — no strait in its zones |
<!-- /generated -->

## Special coring
*(no Courthouse and no 20-year wait)*

You may proclaim a region when **both** are true:

1. Your **capital** lies within the region.
2. You control **100%** of its settlements.

Every settlement in the region becomes core immediately. If you later lose one and retake it, it is core again
on capture.

| Formable | What it was | Settlements | Count | Becomes |
|---|---|---|---|---|
| **Kalmar Union** | the three northern crowns under one king | 1–19 | 19 | Kalmar Union, KAL, #4f7fc0 |
| **Spain** | the crowns of Castile and Aragon, Navarre and Granada (1512) | 131–165, 173–176, 223–229 | 46 | Spain, SPA, #f0b030 |
| **Great Britain** | England and Scotland under one crown (1603) | 28–45, 49–53, 83–89 | 30 | Great Britain, GBR, #b03040 |
| **Kingdom of France** | the realm whole again: the apanages and the great fiefs under the king | 54–82, 105–118 | 43 | — |
| **Burgundian Netherlands** | the Seventeen Provinces of 1549 | 95–104, 126–130 | 15 | — |
| **Kingdom of Burgundy** | the realm Charles the Bold wanted, Frisia to the Alps | 90–104, 111, 112, 126–130, 270 | 23 | Kingdom of Burgundy, KBG, #c7799f |
| **Italian League** | the five powers of the Peace of Lodi (1454) | 119, 177–194, 200–202, 204–208, 214–222 | 36 | — |
| **Unite the Swiss** | the Confederacy with Zürich and Basel (1501) | 286–289 | 4 | — |
| **Reunite Bavaria** | the Wittelsbach duchies, one again from 1505 | 276–279 | 4 | — |
| **Habsburg Austria** | the hereditary lands of the house of Habsburg | 280–285, 291–293 | 9 | — |
| **Lands of the Bohemian Crown** | Bohemia, Moravia, Silesia and Lusatia | 254–257, 265–269 | 9 | — |
| **Kingdom of Hungary** | the crown of St Stephen | 323–338 | 16 | — |
| **Danubian Monarchy** | the three crowns Ferdinand of Habsburg gathered in 1526 | 254–257, 265–269, 280–285, 291–293, 323–338 | 34 | Habsburg Monarchy, HAB, #c8b820 |
| **Hanseatic League** | its leading towns, under Lübeck | 19–21, 24, 231, 232, 234, 236, 237, 247 | 10 | Hanseatic League, HSL, #a07850 |
| **Brandenburg-Prussia** | the Hohenzollern lands of 1618 | 25, 27, 241–243, 261 | 6 | Brandenburg-Prussia, BPR, #a0a0a0 |
| **Crown of Poland** | Poland, Masovia (1526) and Royal Prussia (1466) | 24, 26, 294–307 | 16 | — |
| **Polish-Lithuanian Commonwealth** | Poland and Lithuania joined at Lublin (1569) | 20–27, 294–322 | 37 | Poland-Lithuania, PLC, #e05aa0 |
| **Tsardom of Russia** | the Russian lands gathered by Moscow (1547) | 405–424 | 20 | Russia, RUS, #6fb07a |
| **Rum** | Anatolia whole under the house of Osman (1515) | 339–355, 372–398 | 44 | — |
| **Restored Empire** | the Empire of the Romans as the Palaiologoi dreamt it: Thrace, Macedonia and Greece | 339–341, 347, 348, 351, 352, 354–358, 369, 370 | 14 | Roman Empire, ROM, #9c6fc8 |
| **The Maghreb** | North Africa from the Atlantic to Tripoli, as the Almohads held it | 427–445 | 19 | Maghreb, MGH, #c89050 |

## Sea zones

Seven zones, split by the dashed lines in the sea. A fleet operates in one zone at a time (RULES.md §7). A port
belongs to the zone its coast faces; crossing a strait needs 10 ships in the zone the strait lies in (RULES.md
§8). *Zone, X and Y are data — X, Y is where the name is drawn, and the zone it names is the one around that
point; the other columns are generated from the map.*

| Zone | X | Y | Ports | Straits | Next to |
|---|---|---|---|---|---|
| Norwegian Sea | 1174 | 467 | 3, 4 | — | White Sea, North Sea, Atlantic |
| White Sea | 2122 | 457 | — | — | Norwegian Sea |
| North Sea | 1014 | 1214 | 2, 28, 31, 37, 49, 51, 53, 83, 96, 99, 102, 103, 104, 129, 232, 237 | — | Norwegian Sea, Skagerrak, English Channel |
| Skagerrak | 1251 | 1035 | 1 | — | North Sea, Kattegat |
| Kattegat | 1324 | 1108 | 9, 14, 17, 18 | 14-15 | Skagerrak, Belt Sea, Baltic Sea |
| Belt Sea | 1293 | 1261 | 16, 230, 231, 234 | 14-16, 16-17 | Kattegat, Baltic Sea |
| Baltic Sea | 1539 | 1220 | 8, 24, 25, 27, 235, 236 | 8-19 | Kattegat, Belt Sea, Northern Baltic |
| Northern Baltic | 1641 | 996 | 5, 10, 12, 19 | — | Baltic Sea, Gulf of Riga, Gulf of Bothnia, Gulf of Finland |
| Gulf of Riga | 1777 | 1053 | 20, 23 | — | Northern Baltic |
| Gulf of Bothnia | 1620 | 692 | 11 | — | Northern Baltic |
| Gulf of Finland | 1842 | 891 | 13, 21 | — | Northern Baltic |
| English Channel | 727 | 1497 | 32, 33, 84, 85, 86, 108 | 36-83 | North Sea, Atlantic |
| Irish Sea | 664 | 1236 | 38, 42 | 38-42 | Atlantic |
| Atlantic | 463 | 1467 | 30, 41, 43, 44, 45, 48, 154 | — | Norwegian Sea, English Channel, Irish Sea, Bay of Biscay, Gulf of Cádiz |
| Bay of Biscay | 587 | 1785 | 61, 88, 89, 106, 107, 152 | — | Atlantic |
| Gulf of Cádiz | 219 | 2318 | 133, 136, 166, 167, 171, 430, 431, 432, 433 | 136-430 | Atlantic, Alboran Sea |
| Alboran Sea | 425 | 2420 | 172, 175, 176 | — | Gulf of Cádiz, Western Mediterranean |
| Western Mediterranean | 904 | 2267 | 71, 110, 138, 159, 160, 163, 164, 165, 436, 437, 439, 441 | 159-165, 196-229 | Alboran Sea, Ligurian Sea, Tyrrhenian Sea |
| Ligurian Sea | 1155 | 2012 | 125, 195, 201 | 196-201 | Western Mediterranean, Tyrrhenian Sea |
| Tyrrhenian Sea | 1330 | 2270 | 196, 214, 215, 223, 224, 228, 438 | — | Western Mediterranean, Ligurian Sea, Strait of Sicily, Ionian Sea |
| Strait of Sicily | 1319 | 2583 | 443, 444, 445 | — | Tyrrhenian Sea, Ionian Sea |
| Ionian Sea | 1655 | 2441 | 190, 191, 219, 222, 225, 226, 227, 357 | 190-370, 191-194, 222-225 | Tyrrhenian Sea, Strait of Sicily, Adriatic Sea, Aegean Sea, Levantine Sea |
| Adriatic Sea | 1487 | 2066 | 181, 187, 188, 189, 207, 213, 218, 293, 363 | — | Ionian Sea |
| Aegean Sea | 2001 | 2319 | 192, 193, 194, 197, 347, 358, 369, 371, 376, 404 | 197-376, 371-375 | Ionian Sea, Levantine Sea, Sea of Marmara |
| Levantine Sea | 2334 | 2602 | 198, 382, 391, 392, 403 | 198-391, 403-404 | Ionian Sea, Aegean Sea |
| Sea of Marmara | 2147 | 2159 | 340, 354, 374 | 340-375, 354-372 | Aegean Sea, Western Black Sea |
| Western Black Sea | 2226 | 1951 | 344, 355, 368 | — | Sea of Marmara, Eastern Black Sea |
| Eastern Black Sea | 2553 | 1917 | 199, 386, 394, 395 | — | Western Black Sea, Sea of Azov |
| Sea of Azov | 2474 | 1691 | 426 | — | Eastern Black Sea |

## The situation in 1440

The game opens in the middle of eight wars, and with the alliances of 1440 already signed. They count exactly as if declared
and signed in play (RULES.md §10): the sides below are at war from the first day, the agreements are in force, and every
warmonger score still starts at 0. War score in these wars counts populations as they were at the start. Allies are **not**
in these wars unless listed — a military alliance only calls an ally into wars declared from now on.

### Wars

| War | Attacking side | Defending side | What happened |
|---|---|---|---|
| **Hundred Years' War** (since 1337) | ENG England | FRA France | England held Normandy, Maine and Guyenne; Paris had been French again since 1436. Normandy fell in 1450, Bordeaux in 1453. |
| **Praguerie** (1440) | BOU Bourbon | FRA France | The duke of Bourbon and the Dauphin rose against Charles VII and his new standing army; it was over by July. |
| **Dutch–Hanseatic War** (since 1438) | LUB Lübeck, HAM Hamburg | BUR Burgundy | The Wendish towns of the Hansa fought Holland's ships out of the Baltic trade; peace at Copenhagen in 1441. |
| **Wars in Lombardy** (since 1438) | MIL Milan | VEN Venice, FLO Florence, PAP Papal States | The Visconti against Venice and her allies for the Lombard plain — Anghiari was fought in 1440; peace at Cremona in 1441. |
| **War of the Neapolitan Succession** (since 1435) | ARA Aragon | NAP Naples, GEN Genoa | Alfonso V of Aragon against René of Anjou for Naples, with Genoa on René's side; Alfonso took the city in 1442. |
| **Hungarian civil war** (1440) | HUN Hungary | JIS Upper Hungary | Władysław III against the party of the infant Ladislaus Posthumus; Jan Jiskra held the north for Ladislaus until 1462. |
| **Old Zürich War** (1440) | SWI Swiss Confederacy | ZUR Zürich | Schwyz and the cantons against Zürich over the Toggenburg inheritance; peace in 1450. |
| **Ottoman–Hungarian war** (since 1437) | OTT Ottoman Empire | HUN Hungary, SER Serbia | Murad II had taken Smederevo in 1439 and besieged Belgrade in 1440; the despot of Serbia fought on from Hungary. Varna, 1444. |

### Agreements

| Agreement | Between | Why |
|---|---|---|
| Military alliance | POL Poland – HUN Hungary | Władysław III is king of both. |
| Defensive alliance | POL Poland – LIT Lithuania | The Jagiellon brothers: Władysław in Kraków, Casimir in Vilnius. |
| Defensive alliances | DEN Denmark – SWE Sweden – NOR Norway (each pair) | One king, Christopher of Bavaria — the Kalmar Union. |
| Military alliance | TEU Teutonic Order – LIV Livonian Order | Two branches of one Order. |
| Military alliances | STY Inner Austria – AUS Austria – TYR Tyrol (each pair) | Frederick III rules all three Habsburg lands: his own, and two as guardian. |
| Guarantee | STY Inner Austria → JIS Upper Hungary | Frederick holds the infant Ladislaus — and the Holy Crown of Hungary. |
| Defensive alliance | BRA Brandenburg – ANS Ansbach-Kulmbach | The Hohenzollern brothers Frederick Irontooth and Albert Achilles. |
| Defensive alliance | LUB Lübeck – HAM Hamburg | The Wendish towns of the Hansa. |
| Military alliance | ANJ Anjou – NAP Naples | René is duke of Anjou, count of Provence, duke of Lorraine and Bar — and king of Naples. |
| Military alliance | VEN Venice – FLO Florence | The league against the Visconti. |
| Defensive alliance | FRA France – SCO Scotland | The Auld Alliance (1295). |
| Defensive alliance | FRA France – CAS Castile | The Franco-Castilian alliance of the Trastámaras. |
| Defensive alliance | ENG England – POR Portugal | The Treaty of Windsor (1386). |
| Non-aggression pact, 5 years left | TEU Teutonic Order – POL Poland | The Peace of Brest (1435). |
| Non-aggression pact, 7 years left | ENG England – SCO Scotland | The truce of 1438. |
| Non-aggression pact, 3 years left | CAS Castile – GRA Granada | The truce of 1439. |
| Non-aggression pact, 3 years left | OTT Ottoman Empire – KAR Karaman | The peace of 1437; Karaman attacked again in 1443. |

## The Holy Roman Empire

> **Not on this map yet.** As on the historical map, there is no demand of the Empire: settlements marked **HRE** only make two
> German states think 10 better of each other (RULES.md §10).

## Victory

> **Control or vassalize 180 settlements.** Protectorates count as half — unless you demand one become a vassal
> and it agrees.

**End date: 1650.** The game ends when a player reaches 180, or at the start of **1650** — 210 years, about 2 hours
8 minutes of play. At the end date the player with the most settlements wins, counted the same way: controlled
and vassalized settlements count 1, protectorates ½. A tie goes to the larger total population (own settlements
and subjects).


## Characters

*How the computer plays each country when no person does (docs/design.md, *Characters and rivalries*). Data: every country
needs one of six characters — conqueror, zealot, opportunist, diplomat, defender, merchant — and `node tools/map.js` refuses a
lopsided spread: no character for more than 30% of the countries, every one for at least two, conqueror and zealot together
for no more than 30%. Each game varies a character a little, so a country keeps its nature without being scripted.*

| Code | Character | Why |
|---|---|---|
| NOR | Defender | The junior kingdom of the Kalmar Union, keeping to its fjords. |
| SWE | Opportunist | Its nobles had risen with Engelbrekt in 1434 and would leave the Union when they could. |
| DEN | Conqueror | The Union's kings, at war for Sweden, Schleswig and the Sound for two centuries. |
| GOT | Opportunist | From 1439 the deposed King Eric held Visby and lived by piracy. |
| LIV | Zealot | The Livonian branch of the Teutonic Order. |
| TEU | Zealot | A crusading order of knights, beaten at Grunwald but still armed. |
| ENG | Conqueror | A century of war in France, and Henry VI's council not yet ready to give it up. |
| SCO | Defender | A small kingdom whose wars were to keep England out. |
| ISL | Opportunist | The MacDonald lords of the Isles, who made treaties with England behind their king's back. |
| TRN | Defender | The O'Neills, holding Ulster against all comers. |
| THO | Defender | The O'Briens behind the Shannon. |
| DES | Opportunist | The FitzGeralds, Anglo-Irish lords gone native, who took what the crown could not hold. |
| FRA | Conqueror | Charles VII's France, with a standing army from 1445, taking its lands back one by one. |
| BUR | Diplomat | Philip the Good, who gathered the Low Countries by marriage, purchase and treaty. |
| BRI | Defender | The dukes of Brittany, keeping out of the war between France and England. |
| ANJ | Diplomat | René of Anjou, a prince of many crowns and few victories. |
| BOU | Opportunist | A great vassal ready to rise against the king — the Praguerie of 1440. |
| ARM | Opportunist | The counts of Armagnac, faithless vassals of every king. |
| FOI | Diplomat | Gaston IV of Foix, who married his way to the throne of Navarre. |
| SAV | Diplomat | Its dukes, princes of the Empire and of France, playing one against the other — Amadeus VIII was pope in 1440. |
| LIE | Defender | The prince-bishopric, whose towns rose against Burgundy again and again. |
| UTR | Defender | The prince-bishopric, defending its liberties against Burgundy. |
| GEL | Opportunist | The dukes of Guelders, ready to change sides between Burgundy and its enemies. |
| FRI | Defender | The Frisian freedom, kept by its farmers against every prince. |
| LUX | Diplomat | Elisabeth of Görlitz, who sold the duchy to Burgundy in 1443. |
| CAS | Zealot | The crown of the Reconquista, its eyes on Granada. |
| ARA | Conqueror | Alfonso V, who spent his reign conquering Naples and left Aragon to his queen. |
| POR | Merchant | Henry the Navigator's Portugal, turned to the sea and the African coast. |
| NAV | Defender | A small kingdom between Castile and France. |
| GRA | Defender | The last Muslim kingdom of Iberia, behind its mountains and its truces. |
| MIL | Conqueror | Filippo Maria Visconti, at war with Venice for Lombardy all his life. |
| VEN | Merchant | The Serenissima, which fought for its trade and its terraferma alike. |
| GEN | Merchant | A republic of bankers and seafarers, its colonies from Chios to the Crimea. |
| FLO | Merchant | The Medici's Florence, which hired its wars and banked for popes. |
| SIE | Merchant | A republic of merchants in Florence's shadow. |
| PAP | Diplomat | The papacy, healing the schism with councils and treaties. |
| FER | Diplomat | The Este, whose court made peace between the powers of Italy. |
| MAN | Diplomat | The Gonzaga, captains for hire married into every court. |
| MON | Defender | A small marquisate between Milan and Savoy. |
| RIM | Opportunist | Sigismondo Malatesta, condottiero, who fought for whoever paid. |
| NAP | Opportunist | A kingdom fought over, ready to change its king. |
| SHO | Opportunist | The Holstein counts, who had taken Schleswig while the Danish crown was weak. |
| LUB | Merchant | The queen of the Hansa. |
| HAM | Merchant | A city of the Hansa, the North Sea's gate. |
| MEC | Diplomat | Its dukes had sat on the Swedish throne by marriage and election. |
| POM | Defender | Its dukes, holding the coast against Brandenburg. |
| BRE | Merchant | A Hanseatic city on the Weser. |
| BRU | Defender | The Guelph dukes, heirs of Henry the Lion, keeping what was left. |
| MAG | Zealot | The archbishopric, a prince of the Church with soldiers. |
| BRA | Opportunist | The Hohenzollern margraves, who made the most of every chance. |
| CLE | Opportunist | The dukes of Cleves, who changed sides in every feud of the Lower Rhine. |
| MUN | Zealot | The prince-bishopric, its bishops fighting the Soest feud. |
| JUL | Diplomat | Its dukes, who gathered Jülich and Berg by inheritance. |
| COL | Merchant | The free city of the Rhine trade, which had thrown out its archbishop. |
| HES | Defender | The landgraves, holding their hills between greater neighbours. |
| SAX | Diplomat | The Wettin electors, who grew by marriage and inheritance. |
| LUS | Merchant | The Six Towns of Upper Lusatia, a league of merchants. |
| SIL | Defender | Its Piast dukes, holding on between Bohemia and Poland. |
| OPP | Defender | The Piast dukes of Opole. |
| TRI | Zealot | The archbishop-elector of Trier. |
| MAI | Zealot | The archbishop-elector of Mainz, the Empire's arch-chancellor. |
| WBG | Zealot | The prince-bishop of Würzburg. |
| ANS | Opportunist | Albert Achilles, the Hohenzollern who fought everyone in Franconia. |
| NUR | Merchant | The richest city of the Empire's south. |
| PAL | Opportunist | The electors Palatine, who rose by every feud they could win. |
| BOH | Zealot | The Hussite crown, its knights and preachers still armed. |
| MET | Merchant | A free city of the Empire, living by its trade. |
| STR | Merchant | A free city on the Rhine. |
| BAD | Diplomat | Its margraves, who kept the peace with their neighbours. |
| WRT | Opportunist | Its counts, who rose to dukes by taking what they could. |
| ULM | Merchant | A free city of the Swabian League. |
| AUG | Merchant | The free city of the Fuggers' trade. |
| BIN | Opportunist | Louis the Bearded, who feuded with all his kin. |
| REG | Merchant | A free city on the Danube. |
| BMU | Defender | The Munich dukes, holding their share. |
| BLA | Merchant | The rich dukes of Landshut. |
| AUS | Diplomat | Frederick III, who outlasted his enemies. |
| TYR | Defender | Duke Sigismund, guarded by Frederick, holding the Alpine passes. |
| BAS | Merchant | A free city of the Rhine, its council in 1440. |
| ZUR | Opportunist | The city that broke with the Confederacy and sought the Habsburgs' help. |
| SWI | Conqueror | The cantons, who beat every army sent against them. |
| SAL | Zealot | The prince-archbishop of Salzburg. |
| STY | Diplomat | Frederick III's own lands, ruled with patience. |
| POL | Diplomat | The Jagiellon kingdom, which grew by union and marriage. |
| MAZ | Defender | The Piast dukes of Masovia. |
| LIT | Conqueror | Casimir Jagiellon's Lithuania, still reaching east. |
| HUN | Conqueror | A kingdom at war with the Ottomans and with itself. |
| JIS | Opportunist | Jan Jiskra, a Hussite captain holding Upper Hungary for Ladislaus. |
| OTT | Conqueror | Murad II, who took the Balkans back after Ankara and pushed on to Hungary. |
| BYZ | Diplomat | The last of the Romans, living on diplomacy and appeals to the West. |
| MOR | Defender | The despots of the Morea, behind the Hexamilion wall. |
| SER | Defender | The despot Đurađ Branković, fighting for his lands from exile. |
| BOS | Opportunist | A kingdom of feuding nobles between Hungary and the Ottomans. |
| HER | Opportunist | Duke Stjepan Vukčić, who served whoever paid. |
| RAG | Merchant | The republic of Ragusa, trading with all sides. |
| WAL | Opportunist | Vlad Dracul, between Hungary and the Sultan. |
| MOL | Defender | A principality defending itself between greater neighbours. |
| ATH | Diplomat | The Florentine Acciaioli, dukes of Athens by the Sultan's leave. |
| EPI | Defender | The Tocco, holding Arta against the Ottomans. |
| LES | Merchant | The Genoese Gattilusi of Lesbos. |
| KAR | Opportunist | The beylik of Karaman, the Ottomans' rival in Anatolia, ready to strike when they were busy. |
| CAN | Defender | The Candarids of Kastamonu, keeping to their mountains. |
| TRE | Diplomat | The Grand Komnenoi, marrying their daughters to every neighbour. |
| DUL | Opportunist | The Dulkadir beys, between the Mamluks and the Ottomans. |
| RAM | Opportunist | The Ramadan beys of Cilicia. |
| AQQ | Conqueror | Uzun Hasan's people, the White Sheep, at war across the east. |
| CYP | Merchant | The Lusignan kingdom of Cyprus, living on its trade. |
| KRH | Zealot | The Knights Hospitaller, a crusading order on Rhodes. |
| MOS | Conqueror | Vasily II's Muscovy, which gathered the Russian lands. |
| NOV | Merchant | Lord Novgorod the Great, a republic of the fur trade. |
| PSK | Defender | The city-republic of Pskov, on the Livonian frontier. |
| TVE | Diplomat | The grand princes of Tver, balancing Moscow against Lithuania. |
| RYA | Defender | The grand principality of Ryazan, on the steppe frontier. |
| THE | Defender | The Orthodox principality of Theodoro in the Crimean mountains. |
| GHO | Conqueror | Küchük Muhammad's horde, raiding north and west. |
| MRC | Zealot | The Marinids and their Wattasid viziers, at war with Portugal for Tangier. |
| TLE | Defender | The Zayyanids of Tlemcen, holding on between Fez and Tunis. |
| TUN | Merchant | The Hafsids of Tunis, a power of trade and of the sea. |

### Rivalries

*Pairs the computer holds a grudge between: of the neighbours it is strong enough to attack, it goes for a rival first, and it
never proposes anything to one. A rivalry goes both ways. Mostly it is the computer's preference: a person playing either
country is free of it, and a rival's proposals are answered by the game's formulas, like anyone's — but for one rule: a computer
country never agrees to become its rival's subject on demand (RULES.md §10). The Diplomacy tab shows a country's rivals.*

| Rivals | Why |
|---|---|
| ENG England – FRA France | The Hundred Years' War. |
| ENG England – SCO Scotland | The wars of Scottish independence, and every border raid since. |
| FRA France – BUR Burgundy | Valois cousins: reconciled at Arras in 1435, at war again under Charles the Bold. |
| BUR Burgundy – LIE Liège | The prince-bishopric's towns against the Burgundian dukes, until Liège was razed in 1468. |
| CAS Castile – POR Portugal | Aljubarrota (1385), and every succession since. |
| CAS Castile – GRA Granada | The Reconquista. |
| ARA Aragon – NAP Naples | Alfonso V and René of Anjou, for Naples. |
| ARA Aragon – GEN Genoa | For the western Mediterranean, Corsica and Sardinia. |
| MIL Milan – VEN Venice | For the Lombard plain. |
| MIL Milan – FLO Florence | The Visconti against the Florentine republic, for Tuscany and the Romagna. |
| VEN Venice – GEN Genoa | Two maritime republics, four wars for the trade of the East. |
| VEN Venice – OTT Ottoman Empire | For the Aegean and the Adriatic, until 1718. |
| VEN Venice – HUN Hungary | For Dalmatia. |
| OTT Ottoman Empire – HUN Hungary | For the Danube and the Balkans — Varna, Belgrade, Mohács. |
| OTT Ottoman Empire – KAR Karaman | For Anatolia, until Karaman fell in 1468. |
| OTT Ottoman Empire – BYZ Byzantium | Constantinople. |
| OTT Ottoman Empire – AQQ Aq Qoyunlu | Uzun Hasan against Mehmed II, for eastern Anatolia (Otlukbeli, 1473). |
| POL Poland – TEU Teutonic Order | Grunwald (1410), and the Thirteen Years' War (1454–66). |
| LIT Lithuania – TEU Teutonic Order | The Order's crusade against Lithuania. |
| LIT Lithuania – LIV Livonian Order | The Livonian Order's long border war with Lithuania. |
| LIT Lithuania – MOS Muscovy | For the Russian lands between them, war after war from 1492. |
| MOS Muscovy – NOV Novgorod | Moscow against the republic, until Ivan III took it in 1478. |
| MOS Muscovy – TVE Tver | The two grand principalities' contest for the leadership of Rus'. |
| MOS Muscovy – GHO Great Horde | The Tatar yoke, until the Ugra in 1480. |
| DEN Denmark – SWE Sweden | The Kalmar Union's kings against the Swedish nobility, until 1523. |
| DEN Denmark – LUB Lübeck | The Danish kings against the Hansa, for the Sound and the Baltic trade. |
| DEN Denmark – SHO Schleswig-Holstein | The crown and the Holstein counts, over Schleswig. |
| SWI Swiss Confederacy – AUS Austria | The cantons against their old Habsburg lords: Morgarten, Sempach, Näfels. |
| SWI Swiss Confederacy – ZUR Zürich | The Old Zürich War. |
| HUN Hungary – JIS Upper Hungary | The war for the crown of the infant Ladislaus. |
| BRA Brandenburg – POM Pomerania | The Hohenzollern margraves' claim to Pomerania. |
| POR Portugal – MRC Morocco | Ceuta (1415), Tangier (1437), and the wars for the Moroccan coast. |
| MRC Morocco – TLE Tlemcen | The Marinids and the Zayyanids, for the central Maghreb. |
| TLE Tlemcen – TUN Tunis | The Zayyanids and the Hafsids. |

---

## Design notes

*Hand-written. Unlike everything above it is not checked by the script, so re-read it after changing countries
or borders.*

### How the map was made

From real latitudes and longitudes (data.js) by `tools/make-base.js`, as the historical map was, at 1.6 km a map unit: Europe
from Ireland and Portugal to Moscow and Anatolia, from the North Cape to the coast of North Africa, as one rectangle. The land the
game leaves to nobody — the Sahara, Libya east of Misrata, Egypt, the Levant and Syria (the Mamluks are not in the game) — is
grey: no settlement grows into it, no road crosses it.

Settlements follow the people of 1440, about one for 180,000, so the realms of the empty north and east hold wide lands with few
towns, and France, Italy, the Low Countries and the Empire are dense. No two settlements are much closer than 35 km — the smaller
of a closer pair is left out (Lucca, Leuven, Pavia, Frankfurt…) — so that their markers and armies do not crowd each other; the
Empire's smallest states, whose town did not make the cut, are folded into their neighbours. Borders are pulled to where they
were in 1440 by extra seeds (data.js), checked against some 140 places of the year.

### Colours

The larger powers have colours after their heraldry and the colours maps give them (data.js), none like a neighbour's;
`tools/map.js` picks the rest from its palette, never a neighbour's, and should it run out, the colour of the smallest neighbour,
so that two large neighbours never share one.

### Still to do

The Empire (as on the historical map), achievements, and the balance: the 180 settlements that win are a first guess, and the
speed of the computer players on a map of this size is still to be measured.
