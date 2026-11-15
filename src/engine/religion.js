// Religion (RULES.md §2, Religion): each country's faith, from its scenario (SCENARIO.md, Religions), and each settlement's,
// that of the country that held it in 1440 — both in the state, for from 1517 a Catholic or Hussite country may adopt the
// Reformation (commands-country.js, adoptReformation), and its core land with it. One number for each pair of faiths says how
// they regard each other: it is added to a computer country's opinion (opinion.js), and the worse it is, the longer land of the other faith takes to comply with its
// new owner (economy.js, coringDays) and the likelier its people are to rise (events.js). A scenario without religions has none
// of this: every country of no faith, every pair 0.
import { YEAR_DAYS, dayOf } from "./calendar.js";
import { CORING_DAYS } from "./costs.js";

export const RELIGIONS = ["catholic", "orthodox", "hussite", "sunni", "protestant"];
export const RELIGION_NAMES = { catholic: "Catholic", orthodox: "Orthodox", hussite: "Hussite", sunni: "Sunni", protestant: "Protestant" };
export const SAME_FAITH = 15;
// how two faiths regard each other, the pair's names in alphabetical order (RULES.md §2): the schism softened by Florence,
// the Hussite crusades, Christian against Muslim — and Orthodox and Hussite, who sought each other out; then the Reformation:
// the wars of religion, Utraquists and Lutherans grown together, "rather Turkish than Papist"
const PAIRS = {
    "catholic|orthodox": -10, "catholic|hussite": -20, "catholic|sunni": -25,
    "hussite|orthodox": 0, "orthodox|sunni": -20, "hussite|sunni": -15,
    "catholic|protestant": -25, "hussite|protestant": 10, "orthodox|protestant": 0, "protestant|sunni": -5,
};
export const WORST_FAITH = -25;
export const FAITH_UNREST = 0.10;          // a year, for a realm all of whose land is of the worst other faith and not core
// the Reformation (RULES.md §2): from 31 October 1517, Wittenberg; a few years of unrest after a country adopts it
export const REFORMATION_DAY = dayOf(1517, 10, 31);
export const REFORMATION_UNREST = 0.05, REFORMATION_YEARS = 5;
export const MAY_REFORM = ["catholic", "hussite"];

// a country's faith, or null (peasant rebels, a scenario without religions)
export const religionOf = (game, code) => game.state.countries[code]?.religion ?? null;
// a settlement's people's faith, or null
export const landReligion = (game, id) => game.state.settlements[id]?.faith ?? null;

// why a country may not adopt the Reformation now, or null (RULES.md §2): a map with religions, from 1517, a Catholic or Hussite
export function reformationError(game, code) {
    const c = game.state.countries[code];
    if (!c?.religion) return "this scenario has no religions";
    if (game.state.day < REFORMATION_DAY) return "the Reformation begins on 31 October 1517";
    if (!MAY_REFORM.includes(c.religion)) return `a ${RELIGION_NAMES[c.religion]} country cannot adopt the Reformation`;
    return null;
}

// how faith `a` regards faith `b`: +15 the same, the table otherwise, 0 if either is none
export function faithRegard(a, b) {
    if (!a || !b) return 0;
    if (a === b) return SAME_FAITH;
    return PAIRS[[a, b].sort().join("|")] ?? 0;
}
// the faiths' part of `holder`'s opinion of `other` (opinion.js)
export const faithOpinion = (game, holder, other) => faithRegard(religionOf(game, holder), religionOf(game, other));

// how far apart a country and the people of a settlement are, 0 to 1: the pair's dislike ÷ the worst's — 0 for the same faith
// or a pair that bears no grudge, 1 for Catholic and Sunni
export function faithGap(game, code, id) {
    const r = faithRegard(religionOf(game, code), landReligion(game, id));
    return r >= 0 ? 0 : Math.min(1, r / WORST_FAITH);
}

// the days a settlement's people take to comply fully with `code` (RULES.md §2, Coring): 20 years, × (1 + the faiths' gap)
export const coringDays = (game, code, id) => CORING_DAYS * (1 + faithGap(game, code, id));

// the faiths' part of a country's yearly chance of an uprising (RULES.md §11): for each of its settlements not core for it,
// the faiths' gap, as a share of all it holds, × 10%
// — and 5% for the first 5 years after it adopted the Reformation
export function faithUnrest(game, code) {
    const own = Object.values(game.state.settlements).filter((s) => s.owner === code);
    if (!own.length) return 0;
    let gap = 0;
    for (const s of own) if (!s.cores.includes(code)) gap += faithGap(game, code, s.id);
    const reformed = game.state.countries[code]?.reformed;
    const fresh = reformed !== null && reformed !== undefined && game.state.day - reformed < REFORMATION_YEARS * YEAR_DAYS;
    return gap / own.length * FAITH_UNREST + (fresh ? REFORMATION_UNREST : 0);
}
