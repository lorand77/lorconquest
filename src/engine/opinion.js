// How the computer countries judge (RULES.md §10): military power and size, what a country's neighbours are,
// its opinion of every other country, and the three formulas by which it answers — peace, alliances, guarantees,
// pacts and access, and being asked to become a subject. All pure: the same state gives the same answer, so
// replays agree, and the browser can show a player what to expect.

import { militaryPower } from "./army.js";
import { YEAR_DAYS } from "./calendar.js";
import { economyOf, popOf } from "./economy.js";
import { alliesOf, overlordOf, subjectsOf } from "./relations.js";
import { faithOpinion, faithRegard, religionOf } from "./religion.js";
import { armiesOf, atWar, isGermanState, isRebel, warKey } from "./state.js";
import { scores, victoryOf } from "./victory.js";
import { memo } from "./memo.js";

const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

// a country's whole land force on paper (RULES.md §5): every army, garrison and sharpshooter post it owns; men
// without weapons and in training count 0, ships do not count
export function militaryPowerOf(state, code) { return memo("power", code, () => militaryPowerNow(state, code)); }
function militaryPowerNow(state, code) {
    return sum(armiesOf(state, code), militaryPower)
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
export function neighboursOf(game, code) { return memo("neighbours", code, () => neighboursNow(game, code)); }
function neighboursNow(game, code) {
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

// what `observer` holds against `betrayer` for breaking an agreement with `victim` (RULES.md §10, Opinion): 40, × 1 + (its regard for the
// victim's faith − its regard for the betrayer's) ÷ 40, between ×0 and ×2 — a Sunni shrugs at a faithless Christian vassal punished,
// an Orthodox state does not forgive it; on a map without religions, or a breach of no one in particular, the plain 40
export function betrayalPenalty(game, observer, betrayer, victim) {
    const st = game.state, faith = (c) => (st.countries[c] ? religionOf(game, c) : null), o = faith(observer), b = faith(betrayer), v = victim ? faith(victim) : null;
    if (!o || !b || !v) return 40;
    return 40 * Math.max(0, Math.min(2, 1 + (faithRegard(o, v) - faithRegard(o, b)) / 40));
}

// `holder`'s opinion of `other`, from −100 to +100: the sum of everything that applies (RULES.md §10)
export function opinion(game, holder, other) {
    const st = game.state, m = st.memory;
    let o = 0;
    const enemiesOf = (c) => Object.keys(st.countries).filter((x) => atWar(st, c, x) && !isRebel(st, x));
    // both at war with the same country
    if (enemiesOf(holder).some((e) => e !== other && atWar(st, other, e))) o += 20;
    // both hold HRE settlements
    const holdsHre = (c) => isGermanState(game, c);
    if (holdsHre(holder) && holdsHre(other)) o += 10;
    // a German state's regard for the Emperor: the crown's authority ÷ 5, up to +20 (RULES.md §10, The Emperor)
    if (st.empire?.emperor === other && holdsHre(holder)) o += Math.floor(st.empire.authority / 5);
    // the Imperial Chamber Court: a German state that took land of the Empire from another without the ban, in the last 10 years
    if ((st.empire?.reforms ?? 0) >= 4 && holdsHre(holder) && within(st, st.empire.seized[other], 10)) o -= 10;
    // a year of peace, +1, up to 20
    o += Math.min(20, Math.floor(daysSinceWar(st, holder, other) / YEAR_DAYS));
    const border = bordering(game, holder, other);
    if (border) o -= 15;
    // at war with one of its allies or subjects
    const friends = new Set([...alliesOf(st, holder), ...subjectsOf(st, holder), ...(overlordOf(st, holder) ? [overlordOf(st, holder)] : [])]);
    if ([...friends].some((f) => f !== other && atWar(st, other, f))) o -= 30;
    // fought a war against it in the last 20 years (one going on counts)
    if (atWar(st, holder, other) || within(st, m.lastWar[warKey(holder, other)], 20)) o -= 25;
    // broke an agreement in the last 10 years: 40, weighed by whom it betrayed (betrayalPenalty)
    if (within(st, m.broke[other], 10)) o -= betrayalPenalty(game, holder, other, m.betrayed?.[other] ?? null);
    // refused your demand to become your subject in the last 10 years
    if (within(st, m.refused[`${holder}>${other}`], 10)) o -= 30;
    // the two faiths (religion.js): +15 the same, down to −25 for Catholic and Sunni
    o += faithOpinion(game, holder, other);
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
// the strength part counts as far as the war has been fought (RULES.md §10, Peace): not at all while nothing has changed hands,
// in full once either side has lost a tenth of its people in it — no land is won at the table by an army that has taken none
export function warScore(game, mine, other) {
    const st = game.state, w = st.warInfo[warKey(mine, other)];
    if (!w) return 0;
    const won = (w.taken[mine] ?? 0) / Math.max(1, w.startPop[other]) * 100, lost = (w.taken[other] ?? 0) / Math.max(1, w.startPop[mine]) * 100;
    const strength = ratio(militaryPowerOf(st, mine), militaryPowerOf(st, other), 4), fought = Math.min(1, Math.max(won, lost) / 10);
    return won - lost + Math.min(30, 10 * (strength - 1)) * fought;
}

// what a set of peace terms asks of `other`, in the units of the formula: % of its people in the settlements
// asked for, 10 for each year of its money asked for, 50 for a vassal and 25 for a protectorate — less the same
// for what the proposer gives. Money asked is counted in years of `other`'s money; money paid in years of the payer's or the
// receiver's, whichever is the more — worth no more than it costs the one who pays, nor than it means to the one who gets it:
// an empire's coin is no small country's treasure, and a small country's coin is no empire's. And money paid only offsets what
// else is asked: a subject is won by the war, never bought (RULES.md §10, Peace)
const yearOf = (game, code) => { const e = economyOf(game, code); return Math.max(1, e.moneyPerYear, 0.25 * (e.settlementMoney ?? 0)); };
export function peaceCost(game, mine, other, terms) {
    const st = game.state, w = st.warInfo[warKey(mine, other)];
    const base = Math.max(1, w ? w.startPop[other] : popOf(st, other));
    const pop = (ids) => sum(ids, (id) => st.settlements[id].pop) / base * 100;
    // a year of the payer's money — never less than a quarter of what its settlements yield: one deep in debt, earning nothing a
    // year, does not sell a peace for a handful of coins
    const asked = pop(terms.take ?? []) + (terms.money > 0 ? 10 * terms.money / yearOf(game, other) : 0)
        + pop((terms.release ?? []).flatMap((c) => Object.values(st.settlements).filter((s) => s.owner === c).map((s) => s.id)));
    const paid = terms.money < 0 ? 10 * -terms.money / Math.max(yearOf(game, mine), yearOf(game, other)) : 0;
    let cost = asked - (terms.makeSubject ? Math.min(paid, asked) : paid) - pop(terms.give ?? []);
    // a rival bows only to a crushing defeat: twice the price (SCENARIO.md, Rivalries)
    if (terms.makeSubject) cost += subjectPrice(game, other, mine, terms.makeSubject) * (areRivals(game, mine, other) ? 2 : 1);
    if (terms.becomeSubject) cost -= subjectPrice(game, mine, other, terms.becomeSubject);
    return cost;
}

// what making `subject` the subject of `over` weighs in a peace (RULES.md §10, Peace): 50 for a vassal, 25 for a protectorate, ×
// (1 + its settlements ÷ the overlord's) — a town a quarter its size costs little more than the base, a country as large as the
// victor twice it: a great realm is not made a subject in a peace as lightly as a town
const SUBJECT_PRICE = { vassal: 50, protectorate: 25 };
const settlementsOf = (st, code) => { let n = 0; for (const id in st.settlements) if (st.settlements[id].owner === code) n++; return n; };
export function subjectPrice(game, subject, over, kind) {
    const st = game.state;
    return (SUBJECT_PRICE[kind] ?? 0) * (1 + settlementsOf(st, subject) / Math.max(1, settlementsOf(st, over)));
}

// land is won in the war, not at the table (RULES.md §10, Peace): what a peace hands either side, in people, is at most what it
// took in this war less what it lost — the strength part of the war score buys money, freedom, a subject or a plain peace, never
// towns. Terms asking more are refused; land given beyond it is a gift that pays nothing. { gain, won }: the people the proposer
// would gain (less if it gives) and the people it has taken net — both negative where it is the other way round
export function landOf(game, proposer, holder, terms) {
    const st = game.state, w = st.warInfo[warKey(proposer, holder)];
    const people = (ids) => sum(ids ?? [], (id) => st.settlements[id].pop);
    return { gain: people(terms.take) - people(terms.give), won: w ? (w.taken[proposer] ?? 0) - (w.taken[holder] ?? 0) : 0 };
}

// does the computer country `holder` accept `proposer`'s peace? `land`: refused for asking more land than was won
export function peaceAnswer(game, holder, proposer, terms) {
    const score = warScore(game, proposer, holder), { gain, won } = landOf(game, proposer, holder, terms);
    let cost = peaceCost(game, proposer, holder, terms);
    if (gain > 0 && gain > Math.max(0, won)) return { accept: false, score, cost, land: { gain, won: Math.max(0, won) } };
    // what the holder would be given beyond the land it has won counts for nothing: back onto the price it went off
    const w = game.state.warInfo[warKey(proposer, holder)];
    if (gain < 0 && -gain > Math.max(0, -won)) cost += (-gain - Math.max(0, -won)) / Math.max(1, w ? w.startPop[holder] : popOf(game.state, holder)) * 100;
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

// is `demander` too near victory for `holder` to become its subject (RULES.md §10): at three quarters of the scenario's number,
// or carried to it by this subject — { count, target } if so, else null
export function nearVictory(game, holder, demander, kind) {
    const st = game.state, target = victoryOf(game)?.settlements;
    if (!target) return null;
    const table = scores(st), count = table[demander]?.settlements ?? 0;
    // what it would gain: the holder's settlements and its subjects', at a vassal's share or a protectorate's — less the half a
    // protectorate of its own already gives it, if it is to become a vassal
    const was = st.countries[holder].overlord === demander ? (st.countries[holder].subjectKind === "vassal" ? 1 : 0.5) : 0;
    const gain = (table[holder]?.settlements ?? 0) * ((kind === "vassal" ? 1 : 0.5) - was);
    return count >= NEAR_VICTORY * target || count + gain >= target ? { count, target } : null;
}

// the chance that `holder` agrees to a demand to become `demander`'s subject (RULES.md §10): demandChance — but none for a
// rival, and none near victory (nearVictory; `why` says which, `count` and `target` how near). The Empire's vote asks the
// second, state by state, and not the first (diplomacy.js, proposeEmpire).
export function subjectChance(game, holder, demander, kind) {
    const base = demandChance(game, holder, demander, kind);
    if (areRivals(game, holder, demander)) return { ...base, chance: 0, why: "rival" };
    const near = nearVictory(game, holder, demander, kind);
    return near ? { ...base, chance: 0, why: "victory", ...near } : base;
}
