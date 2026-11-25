// Money, people and research (RULES.md §2, §4, §9): who counts as a soldier, the caps of the conscription law,
// what a country earns and spends in a year, and the monthly step that pays it — treasury, bank, research,
// population growth, mercenaries who desert, debt, bankruptcy, and settlements becoming core.
//
// Every amount a rule gives per year is paid at the start of each month, a twelfth at a time. Population, money
// and R keep their fractions inside the engine.

import { WEAPONS, isEmpty, menOf, takeMen } from "./army.js";
import { BANK_RATE_MONTHLY, CAPITAL_MONEY, CAPITAL_SOLDIERS, BUILDING_PRICE, BUILDINGS, CANNON_PRICE, DEBT_DAYS, LAWS, LIBRARY_BONUS, LOAN_RATE, MAX_UNIVERSITIES, UNIVERSITY_BONUS,
    HIRE_ROOM, MARKET_BONUS, MAX_LIBRARIES, MERCENARY_GROWS, MERCENARY_REFILL, MERCENARY_SHARE, MERCENARY_SHARE_LATE, MERCENARY_UPKEEP, SOLDIER_UPKEEP, TECHS, WEAPON_PRICE, WORKSHOP_MONEY } from "./costs.js";
import { blockaded, crewAtSea } from "./naval.js";
import { subjectKind, subjectsOf } from "./relations.js";
import { armiesOf, armyList, atWar, capitalsOf, reformPassed, settlementsOf, isCore, isGermanState, isRebel, killPeople, removeArmy } from "./state.js";
import { coringDays } from "./religion.js";
import { dateOf } from "./calendar.js";
import { memo, memoTable } from "./memo.js";

const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);
const realCountries = (state) => Object.keys(state.countries).sort().filter((c) => !isRebel(state, c));

export const ownedBy = (state, code) => settlementsOf(state, code);
export const popOf = (state, code) => sum(ownedBy(state, code), (s) => s.pop);
// core manpower plus half of non-core (RULES.md §9): what the law's percentages apply to
export const manpowerOf = (state, code) => sum(ownedBy(state, code), (s) => (isCore(state, s, code) ? s.pop : s.pop / 2));
export const lawOf = (state, code) => LAWS[state.countries[code].law ?? "feudal"];
// each capital a country holds brings its money and soldiers (RULES.md §2, §9) — a union's every member's; peasant rebels have none
export const armyCapOf = (state, code) => lawOf(state, code).army * manpowerOf(state, code) + capitalsOf(state, code).length * CAPITAL_SOLDIERS;
// what a settlement may still train at once (RULES.md §8): a tenth of its people — a capital a fifth — less the men in training there
// now: a large army is raised in several places, or over a long time, though most of all at the capital
export const TRAINING_SHARE = 0.1, CAPITAL_TRAINING_SHARE = 0.2;
export const trainingRoom = (state, code, s) => Math.max(0, (capitalsOf(state, code).includes(s.id) ? CAPITAL_TRAINING_SHARE : TRAINING_SHARE) * s.pop
    - sum(state.countries[code].training.filter((t) => t.settlement === s.id), (t) => t.n));
// a sea power's raised in proportion to the fleet its scenario gives it (RULES.md §9; state.js, navy)
// the share of its money a free city pays the Emperor each year (RULES.md §10, The Emperor)
export const DUES = 0.05, PENNY = 0.01;
export const navyCapOf = (state, code) => lawOf(state, code).navy * manpowerOf(state, code) * (state.countries[code].navy ?? 1);
// how many mercenaries a country may have (RULES.md §8): as many as its army cap — and the Emperor, besides, Imperial Authority's share
// of every other German state's army cap: the Empire's contingents, paid in coin (RULES.md §10, The Emperor)
export function mercenaryCapOf(game, code) {
    const st = game.state, own = armyCapOf(st, code), emp = st.empire;
    if (!emp || emp.emperor !== code) return own;
    let members = 0;
    for (const c of Object.keys(st.countries).sort()) if (c !== code && st.countries[c].out === null && isGermanState(game, c)) members += armyCapOf(st, c);
    return own + emp.authority / 100 * members;
}
export const mercenariesOf = (state, code) => sum(armiesOf(state, code), (a) => a.mercs ?? 0);

// the mercenaries for hire (RULES.md §8). The world's companies: a share of its people, 1% until 1490 and 2% from 1600, rising between;
// those in service — in armies and on their way — are not for hire. What is for hire is `state.mercenaries`: hiring takes from it,
// dismissing and desertion give back, the dead are gone; at the start of each month it fills by a tenth of the companies' size a year,
// never past what is not in service.
export function mercenaryShare(day) {
    const [from, to] = MERCENARY_GROWS, t = Math.min(1, Math.max(0, (dateOf(day).year - from) / (to - from)));
    return MERCENARY_SHARE + (MERCENARY_SHARE_LATE - MERCENARY_SHARE) * t;
}
export const mercenaryCompanies = (state) => mercenaryShare(state.day) * sum(Object.values(state.settlements), (s) => s.pop);
export const mercenariesInService = (state) => sum(armyList(state), (a) => a.mercs ?? 0) + sum(Object.values(state.countries), (c) => sum(c.hires ?? [], (h) => h.n));
export function mercenariesMonth(game) {
    const st = game.state, size = mercenaryCompanies(st);
    st.mercenaries = Math.min(Math.max(0, size - mercenariesInService(st)), st.mercenaries + MERCENARY_REFILL * size / 12);
}
// what a settlement may still take of mercenaries being hired at once: 1,000 at a town, 2,000 at a city, 4,000 at a capital, less those
// on their way there now
export function hireRoom(game, code, s) {
    const kind = capitalsOf(game.state, code).includes(s.id) ? "capital" : game.map.scenario.settlements.find((x) => x.id === s.id)?.type === "city" ? "city" : "town";
    return Math.max(0, HIRE_ROOM[kind] - sum(game.state.countries[code].hires.filter((h) => h.settlement === s.id), (h) => h.n));
}
export const librariesOf = (state, code) => Math.min(MAX_LIBRARIES, ownedBy(state, code).filter((s) => s.library).length);
export const universitiesOf = (state, code) => Math.min(MAX_UNIVERSITIES, ownedBy(state, code).filter((s) => s.university).length);
// what a country's libraries and universities add to its R (RULES.md §4): × 1.05 a library, up to ten, and 1.10 a university, up to three
export const learning = (e) => 1 + LIBRARY_BONUS * e.libraries + UNIVERSITY_BONUS * (e.universities ?? 0);

// men on the army cap: regular soldiers, cannon crew, sharpshooters, and men in training — not mercenaries
export function armySoldiersOf(state, code) {
    const own = armiesOf(state, code);
    return sum(own, (a) => menOf(a) - (a.mercs ?? 0) + a.crew)
        + sum(Object.values(state.posts).filter((p) => p.owner === code), (p) => p.n)
        + sum(state.countries[code].training ?? [], (t) => t.n);
}
// everyone who is a soldier for upkeep and is not a civilian: the army cap's, and ship crew at sea
export const soldiersOf = (state, code) => armySoldiersOf(state, code) + crewAtSea(state, code);

// rebels are your own people under arms (RULES.md §11): the men of the armies of the countries risen against you
// — while the memory is on (memo.js), from a table of every country's made once, summed in the same order
export function rebelsOf(state, code) {
    const t = memoTable("rebelsByCountry", () => {
        const m = new Map();
        for (const a of armyList(state)) { const of = state.countries[a.owner]?.of; if (of) m.set(of, (m.get(of) ?? 0) + menOf(a)); }
        return m;
    });
    if (t) return t.get(code) ?? 0;
    if (!Object.values(state.countries).some((c) => c.of === code)) return 0;
    let n = 0;                                                      // (one pass over the armies: asked with every country's economy)
    for (const a of armyList(state)) if (state.countries[a.owner]?.of === code) n += menOf(a);
    return n;
}

// the share of its money a subject pays its overlord (RULES.md §10)
export const TRIBUTE = { vassal: 0.4, protectorate: 0.1 };

// what a country has and earns, as of today (RULES.md §2, §4, §9, §10). All yearly figures are per year. A subject
// pays its overlord a share of its money, when positive, *before* its own tribute is counted; money per year is
// then what it earns less upkeep and interest, plus the tribute it receives, less the tribute it pays. The capital's own money
// is the subject's alone: no tribute is paid on it.
export function economyOf(game, code) { return memo("economy", code, () => economyOfNow(game, code)); }
function economyOfNow(game, code) {
    const e = economyBase(game, code), st = game.state;
    const share = (c) => { if (!st.countries[c].overlord) return 0; const b = economyBase(game, c); return TRIBUTE[subjectKind(st, c)] * Math.max(0, b.moneyPerYear - b.capitalMoney); };
    // a free city's dues to the Emperor (RULES.md §10, The Emperor): 5% of its money, when positive, while the two are not at war —
    // tribute as a subject's is, on top of any it pays an overlord
    const emperor = st.empire?.emperor, cities = game.map.scenario.empire?.freeCities ?? [];
    const dues = (c) => (emperor && c !== emperor && cities.includes(c) && st.countries[c] && st.countries[emperor] && !isRebel(st, c) && !atWar(st, c, emperor)
        ? DUES * Math.max(0, economyBase(game, c).moneyPerYear) : 0);
    // the Common Penny, once passed (RULES.md §10, Imperial reform): every German state but the Emperor pays 1% of its money, when
    // positive, into the Empire's war chest — no one's tribute (monthly, below, keeps the chest)
    const penny = reformPassed(st, "penny") && code !== emperor && isGermanState(game, code) ? PENNY * Math.max(0, e.moneyPerYear) : 0;
    const paid = share(code) + dues(code) + penny, received = subjectsOf(st, code).reduce((n, c) => n + share(c), 0) + (code === emperor ? cities.reduce((n, c) => n + dues(c), 0) : 0);
    const moneyPerYear = e.moneyPerYear + received - paid;
    const investable = Math.max(0, moneyPerYear);
    const slider = (st.countries[code].slider ?? 50) / 100;
    return { ...e, tributePaid: paid, tributeReceived: received, pennyPaid: penny, moneyPerYear, investable, rPerYear: (2 * slider * investable + game.map.x * 10000) * learning(e) };
}

// (remembered while the computer players think: memo.js)
function economyBase(game, code) { return memo("economyBase", code, () => economyBaseNow(game, code)); }
function economyBaseNow(game, code) {
    // another country's private settings are not known to a player's copy of the game: its starting ones stand in
    const st = game.state, c = { tax: 2, slider: 50, law: "feudal", loans: 0, harvest: false, ...st.countries[code] }, law = LAWS[c.law];
    const owned = ownedBy(st, code), pop = sum(owned, (s) => s.pop);
    const soldiers = soldiersOf(st, code), mercenaries = mercenariesOf(st, code), rebels = rebelsOf(st, code);
    const civilians = Math.max(0, pop - soldiers - rebels);
    const blocked = blockaded(game);
    let settlementMoney = 0;
    for (const s of owned) {
        const civ = pop ? civilians * s.pop / pop : 0;
        const core = isCore(st, s, code);
        let money = civ * c.tax * (core ? 1 : 0.5) + (s.workshop ? WORKSHOP_MONEY : 0);
        if (s.market) money *= 1 + MARKET_BONUS;
        // a conquest pays as its people settle under the new owner (RULES.md §2, Conquest): nothing the day it falls, all of its
        // non-core half once fully compliant (20 years, longer for people of another faith: religion.js), full once core
        if (!core) money *= Math.min(1, Math.max(0, st.day - s.heldSince) / coringDays(game, code, s.id));
        if (blocked.has(s.id)) money /= 2;
        settlementMoney += money;
    }
    // each capital's own money, the same for every country, under the law's penalty and a harvest like the rest
    const capitalMoney = capitalsOf(st, code).length * CAPITAL_MONEY * (1 - law.penalty) * (c.harvest ? 1.1 : 1);
    settlementMoney = settlementMoney * (1 - law.penalty) * (c.harvest ? 1.1 : 1) + capitalMoney;
    const upkeep = soldiers * SOLDIER_UPKEEP, mercenaryUpkeep = mercenaries * MERCENARY_UPKEEP, interest = c.loans * LOAN_RATE;
    const moneyPerYear = settlementMoney - upkeep - mercenaryUpkeep - interest;
    const investable = Math.max(0, moneyPerYear);
    const libraries = librariesOf(st, code), universities = universitiesOf(st, code), armyCap = armyCapOf(st, code), armySoldiers = soldiers - crewAtSea(st, code);
    const rPerYear = (2 * (c.slider / 100) * investable + game.map.x * 10000) * learning({ libraries, universities });
    return {
        pop, soldiers, armySoldiers, crewAtSea: crewAtSea(st, code), mercenaries, rebels, civilians,
        settlementMoney, capitalMoney, upkeep, mercenaryUpkeep, interest, moneyPerYear, investable, rPerYear, libraries, universities,
        // how many men may still be raised: room under the army cap, and civilians to raise them from (RULES.md §8)
        armyCap, mercenaryCap: mercenaryCapOf(game, code), raiseRoom: Math.max(0, Math.min(armyCap - armySoldiers, civilians)), navyCap: navyCapOf(st, code), loanLimit: 2 * settlementMoney,
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
    game.state.mercenaries += gone;                         // for hire again
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
    // population grows 1% a year, 0.5% more on a river or the coast — by the owner's law, halved under Mass levy, none under
    // Scrape the barrel (RULES.md §9)
    for (const s of Object.values(st.settlements)) {
        const n = game.map.nodes.get(String(s.id)), law = LAWS[st.countries[s.owner]?.law ?? "feudal"] ?? LAWS.feudal;
        s.pop *= 1 + (0.01 + (n.river || n.port ? 0.005 : 0)) * law.growth / 12;
    }
    mercenariesMonth(game);
    for (const code of realCountries(st)) {
        const c = st.countries[code];
        if (!ownedBy(st, code).length) continue;                    // a country with no land left is out of the game: no money, no debt
        if (c.treasury < 0) desert(game, code, 0.1, events);        // unpaid mercenaries
        const e = economyOf(game, code), m = e.moneyPerYear / 12, invest = Math.max(0, m);
        // what goes to research and what stays: slider 50% leaves the full money, each 10% above moves a fifth of it
        c.treasury += m + (1 - 2 * c.slider / 100) * invest;
        if (st.empire && e.pennyPaid) st.empire.chest += e.pennyPaid / 12;          // the Common Penny into the war chest
        c.bank += c.bank * BANK_RATE_MONTHLY;
        c.r += (2 * (c.slider / 100) * invest + x * 10000 / 12) * learning(e);
        unlockTech(game, code, events);
        // debt: the clock starts when the treasury first goes below zero and stops once it is repaid
        if (c.treasury < 0 && c.debtSince === null) c.debtSince = st.day;
        if (c.treasury >= 0) c.debtSince = null;
        if (c.debtSince !== null && st.day - c.debtSince >= DEBT_DAYS && -c.treasury > popOf(st, code) * 10) bankrupt(game, code, events);
        // a settlement becomes core after 20 years held (longer for another faith) and a courthouse
        for (const s of ownedBy(st, code)) {
            if (s.courthouse && !s.cores.includes(code) && st.day - s.heldSince >= coringDays(game, code, s.id)) {
                s.cores.push(code);
                events.push({ type: "cored", day: st.day, country: code, settlement: s.id });
            }
        }
    }
    // the war chest paid out, month by month, to an Emperor at war with an outsider — the Empire's foreign wars, as the Penny was raised
    // against the Turks — or in a war of execution
    const emp = st.empire, chief = emp?.emperor;
    const foreign = (k) => { const [x, y] = k.split("|"), foe = x === chief ? y : x; return !isRebel(st, foe) && !isGermanState(game, foe); };
    if (emp && chief && emp.chest > 0 && st.wars.some((k) => k.split("|").includes(chief) && (foreign(k) || st.warInfo[k]?.execution))) {
        st.countries[chief].treasury += emp.chest;
        events.push({ type: "chest", day: st.day, country: chief, money: emp.chest });
        emp.chest = 0;
    }
}

// death in the population from a plague, as a share of every settlement (RULES.md §11)
export function plague(game, code, share, events) {
    const st = game.state;
    const dead = popOf(st, code) * share;
    killPeople(st, code, dead);
    events.push({ type: "plague", day: st.day, country: code, dead: Math.round(dead) });
}
