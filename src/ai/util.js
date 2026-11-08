// What the computer players share: their own dice, what a force is worth, who the enemies are, how far places are, and
// which settlement an army is best raised in. Everything here only reads the game.
//
// The dice are the AI's own, seeded from the game's seed, the country, the day and a label — never the game's state.rng
// (docs/design.md, "The computer players"): the AI's commands are logged and a replay applies them without running it.
import { combine } from "../engine/army.js";
import { findRoute } from "../engine/map.js";
import { straitClear } from "../engine/naval.js";
import { YEAR_DAYS, armyList, atWar, canEnter, dayOf, isRebel, power, scores } from "../engine/index.js";
import { CHARACTERS, NOISE } from "./characters.js";

export function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

export function dice(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// a country's character for the game: how eager it is for war, how much it wants friends, how much it builds. The one the
// scenario gives it (characters.js), each number moved by up to NOISE either way by the seed; with none, rolled at random.
export function flavorOf(seed, code, character = null) {
    const r = dice(hash(`flavor:${seed}:${code}`));
    const base = CHARACTERS[character];
    if (!base) return { aggression: 0.25 + 0.75 * r(), friendliness: 0.3 + 0.7 * r(), builder: 0.3 + 0.7 * r(), character: null };
    const vary = (x) => Math.min(1, Math.max(0.1, x + (2 * r() - 1) * NOISE));
    return { aggression: vary(base.aggression), friendliness: vary(base.friendliness), builder: vary(base.builder), character };
}

// the countries a country holds a grudge against, from the scenario (SCENARIO.md, Rivalries): it attacks them sooner and
// allies with them never. A rivalry goes both ways.
export function rivalsOf(game, code) {
    const out = new Set();
    for (const [a, b] of game.map.scenario.rivalries ?? []) {
        if (a === code) out.add(b);
        else if (b === code) out.add(a);
    }
    return out;
}

// what an army or several together are worth in battle with the dice at their average (RULES.md §5)
export const forcePower = (armies) => (armies.length ? power(combine(armies), 1.4) : 0);
export const armyPower = (army) => forcePower([army]);

// the chance that power `a` beats power `b` (defence and walls already in it) on the rules' dice: each side's power × 2d6+4
// (RULES.md §5), `tieToA` deciding equal power — every pair of throws weighed, nothing drawn from the game's dice
const ROLLS = (() => { const n = new Map(); for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) n.set(x + y + 4, (n.get(x + y + 4) ?? 0) + 1); return [...n]; })();
export function winChance(a, b, tieToA = false) {
    if (a <= 0) return 0;
    if (b <= 0) return 1;
    let won = 0;
    for (const [ra, wa] of ROLLS) for (const [rb, wb] of ROLLS) {
        const pa = a * ra, pb = b * rb;
        if (pa > pb || (pa === pb && tieToA)) won += wa * wb;
    }
    return won / 1296;
}

// a front-runner, racing for the win (design.md, "The computer players"): one that holds 60% of the scenario's settlements to
// win, or, in the last 30 years before its end year, one of the two ahead (as victory counts them: SCENARIO.md, Victory)
export function racing(game, code) {
    const v = game.map.scenario.victory, st = game.state;
    if (!v) return false;
    const table = scores(st), mine = table[code];
    if (!mine) return false;
    if (mine.settlements >= 0.6 * v.settlements) return true;
    if (st.day < dayOf(v.endYear) - 30 * YEAR_DAYS) return false;
    const ahead = Object.keys(table).filter((c) => c !== code && st.countries[c].out === null && (table[c].settlements > mine.settlements || (table[c].settlements === mine.settlements && table[c].pop > mine.pop)));
    return ahead.length < 2;
}

// the leader the others gang up on (design.md, "The computer players"): the country with the most settlements as victory
// counts them, once it holds 75% of those to win — before that a front-runner is let run; null if none
export function leaderOf(game) {
    const v = game.map.scenario.victory, st = game.state;
    if (!v) return null;
    const table = scores(st);
    const order = Object.keys(table).filter((c) => st.countries[c].out === null).sort((a, b) => table[b].settlements - table[a].settlements || table[b].pop - table[a].pop || (a < b ? -1 : 1));
    if (!order.length) return null;
    return table[order[0]].settlements >= 0.75 * v.settlements ? order[0] : null;
}

// the endgame: the last 25 years before the scenario's end year, when the end-year count decides (SCENARIO.md, Victory)
export function endgame(game) {
    const v = game.map.scenario.victory;
    return Boolean(v) && game.state.day >= dayOf(v.endYear) - 25 * YEAR_DAYS;
}

// the countries still in the game, first by settlements as victory counts them (then people, then code)
export function standings(game) {
    const st = game.state, table = scores(st);
    return Object.keys(table).filter((c) => st.countries[c].out === null).sort((a, b) => table[b].settlements - table[a].settlements || table[b].pop - table[a].pop || (a < b ? -1 : 1));
}

// whom `code` gangs up on: the leader (leaderOf) if it is someone else; in the endgame, for the second to the fifth, the first,
// whatever its lead — they go for what closes the gap
export function leaderFor(game, code) {
    const leader = leaderOf(game);
    if (leader && leader !== code) return leader;
    if (!endgame(game)) return null;
    const order = standings(game), rank = order.indexOf(code);
    return rank >= 1 && rank <= 4 ? order[0] : null;
}

export const enemiesOf = (st, code) => Object.keys(st.countries).filter((c) => atWar(st, code, c));
// the enemies that put a country on a war footing (taxes, spending, raising): real countries, and its own peasants — not other
// countries' peasants, with whom it is at war only as their country's enemy or because their country is gone (RULES.md §11)
export const threatsOf = (st, code) => enemiesOf(st, code).filter((c) => !st.countries[c].rebel || st.countries[c].of === code);
export const ownSettlements = (st, code) => Object.values(st.settlements).filter((s) => s.owner === code);
export const ownArmies = (st, code) => armyList(st).filter((a) => a.owner === code);

// money to keep in hand: a third of a year's income
export const reserveOf = (e) => 0.3 * e.settlementMoney;

// the days an army of `country` takes to march from a place to another, through land it may enter; Infinity if it cannot.
// Remembered for the length of one think.
export function daysFn(game, country) {
    const cache = new Map();
    const ok = (k) => canEnter(game, country, k);
    const edgeOk = (from, e) => !e.strait || straitClear(game, country, e.strait);
    return (from, to) => {
        if (from === to) return 0;
        const key = `${from}>${to}`;
        if (!cache.has(key)) cache.set(key, findRoute(game.map, { node: from }, to, ok, edgeOk)?.days ?? Infinity);
        return cache.get(key);
    };
}

// the places next to a place by one march
export const neighboursOfPlace = (game, key) => game.map.adj.get(key).map((e) => e.to);

// is a settlement next to land of a country at war with `code`, or of rebels
export function nextToEnemy(game, code, key) {
    const st = game.state;
    return neighboursOfPlace(game, key).some((k) => {
        const o = st.settlements[game.map.nodes.get(k).land].owner;
        return o !== code && atWar(st, code, o);
    });
}

// is a settlement next to land of anyone who is not its friend: one an enemy could come from
export function exposed(game, code, key) {
    const st = game.state;
    return neighboursOfPlace(game, key).some((k) => {
        const o = st.settlements[game.map.nodes.get(k).land].owner;
        return o !== code && !isRebel(st, o) && !(st.countries[o].overlord === code || st.countries[code].overlord === o);
    });
}

// a settlement that needs no garrison: every route from it leads to the country's own land (or a subject's or overlord's), it
// is not the capital (where risings form), and no peasants of the country are up in arms (they make for undefended towns)
export function inland(game, code, s) {
    const st = game.state;
    if (st.countries[code].capital === s.id || exposed(game, code, String(s.id))) return false;
    return !enemiesOf(st, code).some((c) => st.countries[c].rebel && st.countries[c].of === code);
}

// the men a settlement's garrison should keep: its starting 4% where an enemy could come from, 1.5% at the capital or with
// peasants up, none inland (inland)
export function garrisonFloor(game, code, s) {
    if (exposed(game, code, String(s.id))) return 0.04 * s.pop;
    return inland(game, code, s) ? 0 : 0.015 * s.pop;
}

// each own settlement's garrison army: the lowest-numbered army of the country standing in it (not outside its walls)
export function garrisons(st, code) {
    const out = new Map();
    for (const a of ownArmies(st, code)) {
        if (!a.at || a.relief || a.retreating) continue;
        // only in a settlement of its own: an army at a pass, or before an enemy's town, is a host in the field (war.js) — taken
        // for a garrison it would never be given another order
        if (st.settlements[a.at]?.owner !== code) continue;
        const cur = out.get(a.at);
        if (!cur || a.id < cur.id) out.set(a.at, a);
    }
    return out;
}

// the core settlement a country raises men in: the one beside an enemy with the most people, else its capital
export function stagingSettlement(game, code) {
    const st = game.state, c = st.countries[code];
    const core = ownSettlements(st, code).filter((s) => s.cores.includes(code));
    const front = core.filter((s) => nextToEnemy(game, code, String(s.id))).sort((a, b) => b.pop - a.pop || a.id - b.id)[0];
    const capital = st.settlements[c.capital]?.owner === code ? st.settlements[c.capital] : null;
    return front ?? capital ?? core.sort((a, b) => b.pop - a.pop || a.id - b.id)[0] ?? null;
}

// the days from a place to every place a country's armies may reach from it, in one sweep (Dijkstra over the legs)
export function reachFrom(game, country, from) {
    const dist = new Map([[from, 0]]), done = new Set();
    const ok = (k) => canEnter(game, country, k);
    for (;;) {
        let best = null;
        for (const [k, d] of dist) if (!done.has(k) && (best === null || d < dist.get(best) || (d === dist.get(best) && k < best))) best = k;
        if (best === null) return dist;
        done.add(best);
        for (const e of game.map.adj.get(best)) {
            if (done.has(e.to) || !ok(e.to) || (e.strait && !straitClear(game, country, e.strait))) continue;
            const d = dist.get(best) + e.days;
            if (!dist.has(e.to) || d < dist.get(e.to)) dist.set(e.to, d);
        }
    }
}

// every country thinks this often, in game days (1.5 s)
export const THINK_DAYS = 15;

// at war, a country also looks at its war — its armies' marches, sieges, threats; not its economy or diplomacy — every LOOK_DAYS
// days, on days of its own (its think days among them, LOOK_DAYS dividing THINK_DAYS): a march on a town of its is met while
// there is time to meet it, not up to fifteen days late
export const LOOK_DAYS = 5;
export function looksOn(country, day) {
    return (day + hash(`${country}*`) % THINK_DAYS) % LOOK_DAYS === 0;
}

// does `country` think on `day`? Every THINK_DAYS days, on a day of its own, so 45 countries never all think at once. The
// period is the same for all: a country that thought twice as often would get twice the chances to plan a war, ask for
// peace or answer a threat, and the stagger needs only different days, not different periods.
export function thinksOn(country, day) {
    const offset = hash(`${country}*`) % THINK_DAYS;
    return (day + offset) % THINK_DAYS === 0;
}
