// Religion (RULES.md §2, Religion): each country's faith, from its scenario (SCENARIO.md, Religions), and each settlement's,
// that of the country that held it in 1440. One number for each pair of faiths says how they regard each other: it is added to
// a computer country's opinion (opinion.js), and the worse it is, the longer land of the other faith takes to comply with its
// new owner (economy.js, coringDays) and the likelier its people are to rise (events.js). A scenario without religions has none
// of this: every country of no faith, every pair 0. Nothing here is state: the faiths never change in a game.
import { CORING_DAYS } from "./costs.js";

export const RELIGIONS = ["catholic", "orthodox", "hussite", "sunni"];
export const RELIGION_NAMES = { catholic: "Catholic", orthodox: "Orthodox", hussite: "Hussite", sunni: "Sunni" };
export const SAME_FAITH = 15;
// how two faiths regard each other, the pair's names in alphabetical order (RULES.md §2): the schism softened by Florence,
// the Hussite crusades, Christian against Muslim — and Orthodox and Hussite, who sought each other out
const PAIRS = {
    "catholic|orthodox": -10, "catholic|hussite": -20, "catholic|sunni": -25,
    "hussite|orthodox": 0, "orthodox|sunni": -20, "hussite|sunni": -15,
};
export const WORST_FAITH = -25;
export const FAITH_UNREST = 0.10;          // a year, for a realm all of whose land is of the worst other faith and not core

// the scenario's faiths, looked up once: country code -> religion, and each settlement's (its 1440 owner's)
const LOOKUP = new WeakMap();
function lookup(scenario) {
    let l = LOOKUP.get(scenario);
    if (!l) {
        const country = new Map(scenario.countries.filter((c) => c.religion).map((c) => [c.code, c.religion]));
        const land = new Map(scenario.settlements.map((s) => [s.id, country.get(s.country) ?? null]));
        l = { country, land };
        LOOKUP.set(scenario, l);
    }
    return l;
}

// a country's faith, or null (peasant rebels, a scenario without religions)
export const religionOf = (game, code) => lookup(game.map.scenario).country.get(code) ?? null;
// a settlement's people's faith: that of the country that held it in 1440, or null
export const landReligion = (game, id) => lookup(game.map.scenario).land.get(Number(id)) ?? null;

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
export function faithUnrest(game, code) {
    const own = Object.values(game.state.settlements).filter((s) => s.owner === code);
    if (!own.length) return 0;
    let gap = 0;
    for (const s of own) if (!s.cores.includes(code)) gap += faithGap(game, code, s.id);
    return gap / own.length * FAITH_UNREST;
}
