// How the computer countries judge (RULES.md §10): military power and size, what a country's neighbours are,
// its opinion of every other country, and the three formulas by which it answers — peace, alliances, guarantees,
// pacts and access, and being asked to become a subject. All pure: the same state gives the same answer, so
// replays agree, and the browser can show a player what to expect.

import { militaryPower } from "./army.js";
import { YEAR_DAYS } from "./calendar.js";
import { economyOf, popOf } from "./economy.js";
import { alliesOf, overlordOf, subjectsOf } from "./relations.js";
import { armyList, atWar, isRebel, warKey } from "./state.js";
import { scores } from "./victory.js";

const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

// a country's whole land force on paper (RULES.md §5): every army, garrison and sharpshooter post it owns; men
// without weapons and in training count 0, ships do not count
export function militaryPowerOf(state, code) {
    return sum(armyList(state).filter((a) => a.owner === code), militaryPower)
        + sum(Object.values(state.posts).filter((p) => p.owner === code), (p) => p.n * 2.5);
}

// a ratio of two powers; if the divisor has none, it counts as at its `cap`, and if neither has any, as 1
export function ratio(a, b, cap) {
    if (b <= 0) return a <= 0 ? 1 : cap;
    return a / b;
}

// every settlement, core and non-core, not counting subjects
export const sizeOf = (state, code) => popOf(state, code);
export const sizeRatio = (state, a, b) => (sizeOf(state, b) > 0 ? sizeOf(state, a) / sizeOf(state, b) : Infinity);

// the countries whose settlements share a land route with its settlements (RULES.md §10)
export function neighboursOf(game, code) {
    const st = game.state, out = new Set();
    for (const r of game.map.scenario.routes) {
        if (r.type !== "land") continue;
        const a = st.settlements[r.from].owner, b = st.settlements[r.to].owner;
        if (a === code && b !== code) out.add(b);
        else if (b === code && a !== code) out.add(a);
    }
    return [...out].filter((c) => !isRebel(st, c)).sort();
}

export const bordering = (game, a, b) => neighboursOf(game, a).includes(b);

const daysSinceWar = (st, a, b) => (atWar(st, a, b) ? 0 : st.day - (st.memory.lastWar[warKey(a, b)] ?? 0));
const within = (st, since, years) => since !== undefined && st.day - since < years * YEAR_DAYS;

// `holder`'s opinion of `other`, from −100 to +100: the sum of everything that applies (RULES.md §10)
export function opinion(game, holder, other) {
    const st = game.state, m = st.memory;
    let o = 0;
    const enemiesOf = (c) => Object.keys(st.countries).filter((x) => atWar(st, c, x) && !isRebel(st, x));
    // both at war with the same country
    if (enemiesOf(holder).some((e) => e !== other && atWar(st, other, e))) o += 20;
    // both hold HRE settlements
    const holdsHre = (c) => Object.values(st.settlements).some((s) => s.owner === c && game.map.scenario.settlements.find((x) => x.id === s.id).hre);
    if (holdsHre(holder) && holdsHre(other)) o += 10;
    // a year of peace, +1, up to 20
    o += Math.min(20, Math.floor(daysSinceWar(st, holder, other) / YEAR_DAYS));
    const border = bordering(game, holder, other);
    if (border) o -= 15;
    // at war with one of its allies or subjects
    const friends = new Set([...alliesOf(st, holder), ...subjectsOf(st, holder), ...(overlordOf(st, holder) ? [overlordOf(st, holder)] : [])]);
    if ([...friends].some((f) => f !== other && atWar(st, other, f))) o -= 30;
    // fought a war against it in the last 20 years (one going on counts)
    if (atWar(st, holder, other) || within(st, m.lastWar[warKey(holder, other)], 20)) o -= 25;
    // broke an agreement with anyone in the last 10 years
    if (within(st, m.broke[other], 10)) o -= 40;
    // refused your demand to become your subject in the last 10 years
    if (within(st, m.refused[`${holder}>${other}`], 10)) o -= 30;
    // the warmonger score: in full beside it, half further off, at most −60
    o -= Math.min(60, (st.countries[other].warmonger ?? 0) * (border ? 1 : 0.5));
    return Math.max(-100, Math.min(100, o));
}

// how threatened `holder` feels by its neighbours (RULES.md §10): 10 × (its strongest neighbour's power ÷ its own −1),
// between 0 and 40, and half of its neighbours' highest warmonger score, up to 30 — not counting `excluded`
export function need(game, holder, excluded) {
    const st = game.state, mine = militaryPowerOf(st, holder), nb = neighboursOf(game, holder);
    const strongest = Math.max(0, ...nb.map((c) => militaryPowerOf(st, c)));
    const threat = nb.length ? Math.max(0, Math.min(40, 10 * (ratio(strongest, mine, 5) - 1))) : 0;
    const warmonger = Math.min(30, Math.max(0, ...nb.filter((c) => c !== excluded).map((c) => (st.countries[c].warmonger ?? 0) / 2)));
    return threat + warmonger;
}

// the bar `opinion + need` must reach for an agreement, by kind (RULES.md §10): the proposer guarantees the
// holder; a non-aggression pact; the holder gives the proposer military access; a defensive or military alliance
export const BAR = { guarantee: -20, pact: 0, access: 10, defensive: 20, military: 40 };
// an alliance is signed for 10 or 20 years; the longer one asks 10 more
export const ALLIANCE_YEARS = [10, 20];
export const LONG_ALLIANCE_BAR = 10;
export const isAlliance = (kind) => kind === "defensive" || kind === "military";

export function agreementAnswer(game, holder, proposer, kind, years = 10) {
    const op = opinion(game, holder, proposer), nd = need(game, holder, proposer);
    const bar = BAR[kind] + (isAlliance(kind) && years === 20 ? LONG_ALLIANCE_BAR : 0);
    return { accept: op + nd >= bar, opinion: op, need: nd, bar };
}

// the war between two countries and how it stands for `winner`, against `other`: % of its people taken, less the %
// it took of one's own, plus 10 × (strength − 1), the last at most +30. Populations as at the start of the war.
export function warScore(game, mine, other) {
    const st = game.state, w = st.warInfo[warKey(mine, other)];
    if (!w) return 0;
    const taken = (w.taken[mine] ?? 0) / Math.max(1, w.startPop[other]) * 100 - (w.taken[other] ?? 0) / Math.max(1, w.startPop[mine]) * 100;
    const strength = ratio(militaryPowerOf(st, mine), militaryPowerOf(st, other), 4);
    return taken + Math.min(30, 10 * (strength - 1));
}

// what a set of peace terms asks of `other`, in the units of the formula: % of its people in the settlements
// asked for, 10 for each year of its money asked for, 50 for a vassal and 25 for a protectorate — less the same
// for what the proposer gives
export function peaceCost(game, mine, other, terms) {
    const st = game.state, w = st.warInfo[warKey(mine, other)];
    const base = Math.max(1, w ? w.startPop[other] : popOf(st, other));
    const pop = (ids) => sum(ids, (id) => st.settlements[id].pop) / base * 100;
    let cost = pop(terms.take ?? []) - pop(terms.give ?? []);
    // a year of its money — never less than a quarter of what its settlements yield: one deep in debt, earning nothing a year,
    // does not sell a peace for a handful of coins
    if (terms.money) { const e = economyOf(game, other); cost += 10 * terms.money / Math.max(1, e.moneyPerYear, 0.25 * (e.settlementMoney ?? 0)); }
    cost += pop((terms.release ?? []).flatMap((c) => Object.values(st.settlements).filter((s) => s.owner === c).map((s) => s.id)));
    cost += { vassal: 50, protectorate: 25 }[terms.makeSubject] ?? 0;
    cost -= { vassal: 50, protectorate: 25 }[terms.becomeSubject] ?? 0;
    return cost;
}

// does the computer country `holder` accept `proposer`'s peace?
export function peaceAnswer(game, holder, proposer, terms) {
    const score = warScore(game, proposer, holder), cost = peaceCost(game, proposer, holder, terms);
    return { accept: score >= cost, score, cost };
}

// the chance, in percent, that `holder` agrees to become `demander`'s subject (RULES.md §10): mostly size, a little
// opinion; at most 75%; none if the demander is not the larger or is disliked below −50. `bonus` is added first.
export function demandChance(game, holder, demander, kind, bonus = 0) {
    const st = game.state, op = opinion(game, holder, demander);
    if (sizeOf(st, demander) <= sizeOf(st, holder) || op < -50) return { chance: 0, opinion: op };
    const size = sizeRatio(st, demander, holder);
    return { chance: Math.min(75, Math.max(0, size * (kind === "vassal" ? 5 : 10) + op / 10 + bonus)), opinion: op };
}

// two countries the scenario makes rivals (SCENARIO.md, Rivalries)
export const areRivals = (game, a, b) => (game.map.scenario.rivalries ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
// how close a country is to winning, from 0, as a share of the scenario's number (SCENARIO.md, Victory)
export const NEAR_VICTORY = 0.75;

// the chance that `holder` agrees to a demand to become `demander`'s subject (RULES.md §10): demandChance — but none for a
// rival, and none for a country at three quarters of victory or that this subject would carry past it (`why` says which;
// `count` and `target`, how near). The Empire's vote keeps demandChance alone.
export function subjectChance(game, holder, demander, kind) {
    const st = game.state, base = demandChance(game, holder, demander, kind), target = game.map.scenario.victory?.settlements;
    if (areRivals(game, holder, demander)) return { ...base, chance: 0, why: "rival" };
    if (!target) return base;
    const table = scores(st), count = table[demander]?.settlements ?? 0;
    // what it would gain: the holder's settlements and its subjects', at a vassal's share or a protectorate's — less the half a
    // protectorate of its own already gives it, if it is to become a vassal
    const was = st.countries[holder].overlord === demander ? (st.countries[holder].subjectKind === "vassal" ? 1 : 0.5) : 0;
    const gain = (table[holder]?.settlements ?? 0) * ((kind === "vassal" ? 1 : 0.5) - was);
    if (count >= NEAR_VICTORY * target || count + gain >= target) return { ...base, chance: 0, why: "victory", count, target };
    return base;
}
