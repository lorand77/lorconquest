// Money, people and research (RULES.md §2, §4, §9): who counts as a soldier, the caps of the conscription law,
// what a country earns and spends in a year, and the monthly step that pays it — treasury, bank, research,
// population growth, mercenaries who desert, debt, bankruptcy, and settlements becoming core.
//
// Every amount a rule gives per year is paid at the start of each month, a twelfth at a time. Population, money
// and R keep their fractions inside the engine.

import { WEAPONS, isEmpty, menOf, takeMen } from "./army.js";
import { BANK_RATE_MONTHLY, BUILDING_PRICE, BUILDINGS, CANNON_PRICE, CORING_DAYS, DEBT_DAYS, LAWS, LIBRARY_BONUS, LOAN_RATE,
    MARKET_BONUS, MAX_LIBRARIES, MERCENARY_UPKEEP, SOLDIER_UPKEEP, TECHS, WEAPON_PRICE, WORKSHOP_MONEY } from "./costs.js";
import { blockaded, crewAtSea } from "./naval.js";
import { armyList, isCore, isRebel, killPeople, removeArmy } from "./state.js";

const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);
const realCountries = (state) => Object.keys(state.countries).sort().filter((c) => !isRebel(state, c));

export const ownedBy = (state, code) => Object.values(state.settlements).filter((s) => s.owner === code);
export const popOf = (state, code) => sum(ownedBy(state, code), (s) => s.pop);
// core manpower plus half of non-core (RULES.md §9): what the law's percentages apply to
export const manpowerOf = (state, code) => sum(ownedBy(state, code), (s) => (isCore(state, s, code) ? s.pop : s.pop / 2));
export const lawOf = (state, code) => LAWS[state.countries[code].law];
export const armyCapOf = (state, code) => lawOf(state, code).army * manpowerOf(state, code);
export const navyCapOf = (state, code) => lawOf(state, code).navy * manpowerOf(state, code);
export const mercenariesOf = (state, code) => sum(armyList(state).filter((a) => a.owner === code), (a) => a.mercs ?? 0);
export const librariesOf = (state, code) => Math.min(MAX_LIBRARIES, ownedBy(state, code).filter((s) => s.library).length);

// men on the army cap: regular soldiers, cannon crew, sharpshooters, and men in training — not mercenaries
export function armySoldiersOf(state, code) {
    const own = armyList(state).filter((a) => a.owner === code);
    return sum(own, (a) => menOf(a) - (a.mercs ?? 0) + a.crew)
        + sum(Object.values(state.posts).filter((p) => p.owner === code), (p) => p.n)
        + sum(state.countries[code].training, (t) => t.n);
}
// everyone who is a soldier for upkeep and is not a civilian: the army cap's, and ship crew at sea
export const soldiersOf = (state, code) => armySoldiersOf(state, code) + crewAtSea(state, code);

// rebels are your own people under arms (RULES.md §11): the men of the armies of the countries risen against you
export function rebelsOf(state, code) {
    const rebels = new Set(Object.values(state.countries).filter((c) => c.of === code).map((c) => c.code));
    return sum(armyList(state).filter((a) => rebels.has(a.owner)), menOf);
}

// what a country has and earns, as of today (RULES.md §2, §4, §9). All yearly figures are per year.
export function economyOf(game, code) {
    const st = game.state, c = st.countries[code], law = LAWS[c.law];
    const owned = ownedBy(st, code), pop = sum(owned, (s) => s.pop);
    const soldiers = soldiersOf(st, code), mercenaries = mercenariesOf(st, code), rebels = rebelsOf(st, code);
    const civilians = Math.max(0, pop - soldiers - rebels);
    const blocked = blockaded(game);
    let settlementMoney = 0;
    for (const s of owned) {
        const civ = pop ? civilians * s.pop / pop : 0;
        let money = civ * c.tax * (isCore(st, s, code) ? 1 : 0.5) + (s.workshop ? WORKSHOP_MONEY : 0);
        if (s.market) money *= 1 + MARKET_BONUS;
        if (blocked.has(s.id)) money /= 2;
        settlementMoney += money;
    }
    settlementMoney *= (1 - law.penalty) * (c.harvest ? 1.1 : 1);
    const upkeep = soldiers * SOLDIER_UPKEEP, mercenaryUpkeep = mercenaries * MERCENARY_UPKEEP, interest = c.loans * LOAN_RATE;
    const moneyPerYear = settlementMoney - upkeep - mercenaryUpkeep - interest;
    const investable = Math.max(0, moneyPerYear);
    const libraries = librariesOf(st, code);
    const rPerYear = (2 * (c.slider / 100) * investable + game.map.x * 10000) * (1 + LIBRARY_BONUS * libraries);
    return {
        pop, soldiers, armySoldiers: soldiers - crewAtSea(st, code), crewAtSea: crewAtSea(st, code), mercenaries, rebels, civilians,
        settlementMoney, upkeep, mercenaryUpkeep, interest, moneyPerYear, investable, rPerYear, libraries,
        armyCap: armyCapOf(st, code), navyCap: navyCapOf(st, code), loanLimit: 2 * settlementMoney,
    };
}

export const techCost = (game, tech) => TECHS[tech].cost * 1e6 * game.map.x;

// the target tech unlocks the moment the R pool covers its cost, which is taken from the pool
export function unlockTech(game, code, events) {
    const c = game.state.countries[code];
    if (!c.target || c.r < techCost(game, c.target)) return;
    c.r -= techCost(game, c.target);
    c.techs.push(c.target);
    events.push({ type: "tech", day: game.state.day, country: code, tech: c.target });
    c.target = null;
}

// mercenaries leave, taking their weapons with them (RULES.md §8): `share` of them, rounded up per army
export function desert(game, code, share, events) {
    let gone = 0;
    for (const a of armyList(game.state).filter((x) => x.owner === code && x.mercs)) {
        const n = Math.min(a.mercs, Math.ceil(a.mercs * share));
        takeMen(a, n, ["pikes", ...WEAPONS]);
        a.mercs -= n;
        gone += n;
        if (isEmpty(a)) removeArmy(game.state, a);          // a company of mercenaries that all left
    }
    if (gone) events.push({ type: "desertion", day: game.state.day, country: code, men: gone });
}

// RULES.md §2, Debt: ten years after the treasury first went below zero, a debt over pop × 10 is cleared by
// selling buildings, then the reserve, then the weapons and cannons of the armies, until the treasury is no longer
// below zero. Each is sold at its shop price.
function bankrupt(game, code, events) {
    const st = game.state, c = st.countries[code];
    const sold = { buildings: 0, weapons: 0 };
    for (const s of ownedBy(st, code)) {
        for (const b of BUILDINGS) {
            if (c.treasury >= 0) break;
            if (!s[b]) continue;
            s[b] = false;
            c.treasury += BUILDING_PRICE[b];
            sold.buildings++;
        }
    }
    const sell = (counts) => {
        for (const w of WEAPONS) {
            if (w === "unarmed") continue;
            const price = WEAPON_PRICE[w] / 1000, n = Math.min(counts[w] ?? 0, Math.max(0, Math.ceil(-c.treasury / price)));
            if (c.treasury < 0 && n > 0) {
                counts[w] -= n;
                if (counts.unarmed !== undefined) counts.unarmed += n;     // an army's men keep fighting, unarmed
                c.treasury += n * price;
                sold.weapons += n;
            }
        }
    };
    sell(c.reserve);
    if (c.treasury < 0 && c.reserve.cannons) {
        const n = Math.min(c.reserve.cannons, Math.ceil(-c.treasury / (CANNON_PRICE / 100)));
        c.reserve.cannons -= n;
        c.treasury += n * CANNON_PRICE / 100;
        sold.weapons += n;
    }
    for (const a of armyList(st).filter((x) => x.owner === code)) {
        if (c.treasury >= 0) break;
        sell(a.men);
    }
    if (c.treasury >= 0) c.debtSince = null;
    events.push({ type: "bankruptcy", day: st.day, country: code, buildings: sold.buildings, weapons: sold.weapons });
}

// the monthly step, at the start of every month (day 1 of each; RULES.md §1, §2)
export function monthly(game, events) {
    const st = game.state, x = game.map.x;
    // population grows 1% a year, 0.5% more on a river or the coast
    for (const s of Object.values(st.settlements)) {
        const n = game.map.nodes.get(String(s.id));
        s.pop *= 1 + (0.01 + (n.river || n.port ? 0.005 : 0)) / 12;
    }
    for (const code of realCountries(st)) {
        const c = st.countries[code];
        if (c.treasury < 0) desert(game, code, 0.1, events);        // unpaid mercenaries
        const e = economyOf(game, code), m = e.moneyPerYear / 12, invest = Math.max(0, m);
        // what goes to research and what stays: slider 50% leaves the full money, each 10% above moves a fifth of it
        c.treasury += m + (1 - 2 * c.slider / 100) * invest;
        c.bank += c.bank * BANK_RATE_MONTHLY;
        c.r += (2 * (c.slider / 100) * invest + x * 10000 / 12) * (1 + LIBRARY_BONUS * e.libraries);
        unlockTech(game, code, events);
        // debt: the clock starts when the treasury first goes below zero and stops once it is repaid
        if (c.treasury < 0 && c.debtSince === null) c.debtSince = st.day;
        if (c.treasury >= 0) c.debtSince = null;
        if (c.debtSince !== null && st.day - c.debtSince >= DEBT_DAYS && -c.treasury > popOf(st, code) * 10) bankrupt(game, code, events);
        // a settlement becomes core after 20 years held and a courthouse
        for (const s of ownedBy(st, code)) {
            if (s.courthouse && !s.cores.includes(code) && st.day - s.heldSince >= CORING_DAYS) {
                s.cores.push(code);
                events.push({ type: "cored", day: st.day, country: code, settlement: s.id });
            }
        }
    }
}

// death in the population from a plague, as a share of every settlement (RULES.md §11)
export function plague(game, code, share, events) {
    const st = game.state;
    const dead = popOf(st, code) * share;
    killPeople(st, code, dead);
    events.push({ type: "plague", day: st.day, country: code, dead: Math.round(dead) });
}
