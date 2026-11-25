// The Holy Roman Empire's crown (RULES.md §10, The Emperor; a scenario's SCENARIO.md, The Holy Roman Empire). One German state — one
// with a capital inside the Empire — wears it, for life: each year there is a chance the Emperor dies, and an election follows six
// months later, as it does when the throne falls vacant (the Emperor no longer a German state, out of the game or someone's
// vassal). Seven electors choose: whoever holds a secular elector's settlement casts its vote, but a church vote — an archbishop's —
// is cast only by the country that held it at the start, and is silent in anyone else's hands. Only Catholics stand, and after the
// Reformation Protestants too. Candidates may promise electors money, paid when the votes are cast whoever they go to; from 1519
// every Emperor elected signs a capitulation, at a cost to the crown. A person's electors vote as the person chooses; a computer's by
// a formula, as the computer answers everything else (opinion.js), so the votes are the engine's own and replay exactly.
//
// The crown's Imperial Authority (0 to 100) rises with years of peace among the German states and falls with their wars, with the
// crown changing hands and with capitulations; the rest of what moves it is in diplomacy.js (the Emperor's wars and peaces, Defender
// of the Empire, the imperial ban). The reforms are the estates': proposed by the Emperor or the Archbishop of Mainz once the
// authority allows, and passed by the Diet — the electors, the princes and the cities, two colleges of the three — and they bind the
// Emperor as much as anyone. A scenario without electors has no crown (Mitteleuropa's plain proposal is another thing:
// diplomacy.js, proposeEmpire).

import { YEAR_DAYS, dayOf } from "./calendar.js";
import { AUTHORITY, addAuthority, germanStates } from "./diplomacy.js";
import { popOf } from "./economy.js";
import { opinion } from "./opinion.js";
import { random } from "./random.js";
import { REFORMATION_DAY } from "./religion.js";
import { agreementsBetween } from "./relations.js";
import { atWar, isGermanState, isRebel, reformPassed } from "./state.js";

// who may stand: a German state of this many people — two cities' worth: no single town or free city. An outsider never stands: the
// Emperor must be a German state, and an outsider holding a secular vote casts it for another
export const CANDIDATE_GERMAN = 40000;
// a computer elector's score of a candidate (electorScore): +20 for the reigning or late Emperor's country, 1 for each 2,000 × x
// promised up to +30, −20 for one of 150,000 people or more, −50 for one at war with it, −20 for one of another faith
export const REIGNING = 20, PROMISE_MONEY = 2000, PROMISE_MAX = 30, TOO_BIG = 150000, TOO_BIG_MALUS = 20, AT_WAR_MALUS = 50, FAITH_MALUS = 20;
// the Emperor rules for life: the chance each year that he dies; the interregnum before the electors meet; and the day from which
// every Emperor elected signs a capitulation (AUTHORITY.CAPITULATION)
export const DEATH_CHANCE = 0.04, INTERREGNUM_DAYS = 182, CAPITULATION_DAY = dayOf(1519);
// the reforms of the estates, in the order they must pass, and the authority each needs before it may be proposed (RULES.md §10,
// Imperial reform); a proposal voted down may be made again after REFORM_RETRY_DAYS
// — as at Worms in 1495, the Public Peace with the Chamber Court to keep it and the Common Penny, then the Circles (1500, 1512)
export const REFORMS = [
    { key: "landfriede", name: "Eternal Public Peace", authority: 40 },
    { key: "court", name: "Imperial Chamber Court", authority: 55 },
    { key: "penny", name: "Common Penny", authority: 70 },
    { key: "circles", name: "Imperial Circles", authority: 85 },
];
export const REFORM_RETRY_DAYS = 5 * YEAR_DAYS;
// the imperial ban: what it costs the crown, and who may be put under it — a German state with this warmonger score, or one that
// took a settlement of the Empire from another German state within SEIZED_DAYS
export const BAN_COST = 10, BAN_WARMONGER = 30, SEIZED_DAYS = 10 * YEAR_DAYS;
export const reformsPassed = (st) => st.empire?.reforms ?? 0;
export const hasReform = reformPassed;

// the crown at the start, from the scenario: null on a map without electors
export function startEmpire(scenario) {
    const e = scenario.empire;
    if (!e?.electors?.length) return null;
    return {
        // the Emperor (null in an interregnum), the late Emperor's country while the throne is empty, the crown's authority
        emperor: e.emperor ?? null, late: null, authority: AUTHORITY.START,
        // an election called and the day it is held; candidates' promises; people's choices of candidate; the last result
        called: false, next: null, promises: {}, choices: {}, last: null,
        // the reforms passed (how many, in order), the day the last one was voted down, people's stand on reforms, the states under
        // the ban, the day each German state last took a settlement of the Empire from another not under the ban, the Common Penny's
        // war chest
        reforms: 0, tried: null, reformChoices: {}, banned: [], seized: {}, chest: 0,
        // the crown made hereditary by the Emperor proclaiming a region only the Emperor may (SCENARIO.md, Special coring: the Kaiserreich):
        // no death, no election, until it falls vacant
        hereditary: false,
    };
}

// the reigning Emperor's country, or in an interregnum the late Emperor's: the house the electors know
const house = (st) => st.empire?.emperor ?? st.empire?.late ?? null;

// the electors as they stand: each vote, its settlement, and who casts it — whoever holds a secular vote's settlement; a church
// vote's only if it is the country that held it at the start, else nobody: the vote is silent (null for nobody, or rebels)
export function electorsOf(game) {
    const st = game.state;
    return (game.map.scenario.empire?.electors ?? []).map((e) => {
        const owner = st.settlements[e.settlement]?.owner ?? null;
        const holder = owner && !isRebel(st, owner) && (!e.church || owner === e.see) ? owner : null;
        return { vote: e.vote, settlement: e.settlement, church: Boolean(e.church), holder };
    });
}

const standing = (st, code) => Boolean(st.countries[code]) && !isRebel(st, code) && st.countries[code].out === null && st.countries[code].subjectKind !== "vassal";
// a faith that may wear the crown: Catholic, and after the Reformation Protestant too; on a map without religions, any
const crownFaith = (st, code) => {
    const r = st.countries[code].religion;
    return !r || r === "catholic" || (r === "protestant" && st.day >= REFORMATION_DAY);
};

// who may stand, in order of their codes: the reigning (or late) Emperor's country, and every German state of 40,000 people or more —
// German states all, none of them anyone's vassal, all of a faith that may be crowned
export function candidatesOf(game) {
    const st = game.state, known = house(st);
    return germanStates(game).filter((c) => standing(st, c) && crownFaith(st, c) && (c === known || popOf(st, c) >= CANDIDATE_GERMAN));
}

// what the candidate has promised the vote of this settlement
const promised = (st, candidate, settlement) => st.empire?.promises[candidate]?.[settlement] ?? 0;

// how a computer elector holding `settlement` weighs a candidate (RULES.md §10, The Emperor)
export function electorScore(game, elector, candidate, settlement) {
    const st = game.state, a = st.countries[elector], b = st.countries[candidate];
    let score = opinion(game, elector, candidate);
    if (candidate === house(st)) score += REIGNING;
    score += Math.min(PROMISE_MAX, promised(st, candidate, settlement) / (PROMISE_MONEY * game.map.x));
    if (popOf(st, candidate) >= TOO_BIG) score -= TOO_BIG_MALUS;
    if (atWar(st, elector, candidate)) score -= AT_WAR_MALUS;
    if (a.religion && b.religion && a.religion !== b.religion) score -= FAITH_MALUS;
    return score;
}

// whom the vote of an elector goes to: a person's as they chose, if their choice stands; a computer's — or a person's who has not
// chosen — to the other candidate it scores highest (the first by code among equals), or to itself if it stands and is the known
// house, or has more people than that candidate: the electors mostly chose another, and one of their own only when it was the
// greater. Null with no one to cast it
export function voteOf(game, elector, candidates = candidatesOf(game)) {
    const st = game.state, holder = elector.holder;
    if (!holder || !candidates.length) return null;
    const chosen = st.empire?.choices[holder];
    if (st.humans.includes(holder) && chosen && candidates.includes(chosen)) return chosen;
    let best = null, bestScore = -Infinity;
    for (const c of candidates) {
        if (c === holder) continue;
        const s = electorScore(game, holder, c, elector.settlement);
        if (s > bestScore) { best = c; bestScore = s; }
    }
    if (candidates.includes(holder) && (holder === house(st) || !best || popOf(st, holder) > popOf(st, best))) return holder;
    return best;
}

// in a second round, whom an elector's vote goes to of the two left: a person's as they chose, if it is one of them; one of the two
// itself; else the one it scores higher (the first by code if equal)
export function voteBetween(game, elector, pair) {
    const st = game.state, holder = elector.holder;
    if (!holder) return null;
    const chosen = st.empire?.choices[holder];
    if (st.humans.includes(holder) && pair.includes(chosen)) return chosen;
    if (pair.includes(holder)) return holder;
    const [a, b] = pair, sa = electorScore(game, holder, a, elector.settlement), sb = electorScore(game, holder, b, elector.settlement);
    return sb > sa ? b : a;
}

// whom an election concerns, for the news (text.js, eventCountries): every German state, every candidate and every elector
const concerned = (game) => [...new Set([...germanStates(game), ...candidatesOf(game), ...electorsOf(game).map((e) => e.holder).filter(Boolean)])].sort();

// the election: every promise paid from its candidate's treasury to whoever casts that vote now, as far as the treasury goes; the
// votes counted. A majority of the votes cast wins; without one, the electors vote again between the two leaders (voteBetween), and
// the more votes win. Ties — for the lead, or in the second round — go to the known house if it is among them, else to the larger
// people, else to the first by code. The crown passing to another country costs it authority, and from 1519 so does the new
// Emperor's capitulation. The promises and choices are spent with it
export function holdElection(game, events, why) {
    const st = game.state, emp = st.empire, candidates = candidatesOf(game), electors = electorsOf(game);
    for (const cand of Object.keys(emp.promises).sort()) {
        for (const e of electors) {
            const owed = promised(st, cand, e.settlement);
            if (!owed || !e.holder || e.holder === cand || !st.countries[cand]) continue;
            const paid = Math.min(owed, Math.max(0, st.countries[cand].treasury));
            st.countries[cand].treasury -= paid;
            st.countries[e.holder].treasury += paid;
        }
    }
    const concern = concerned(game), votes = {}, cast = [];
    for (const e of electors) {
        const v = voteOf(game, e, candidates);
        cast.push({ settlement: e.settlement, holder: e.holder, vote: v });
        if (v) votes[v] = (votes[v] ?? 0) + 1;
    }
    const before = house(st), total = Object.values(votes).reduce((n, v) => n + v, 0);
    const rank = (tally) => Object.keys(tally).sort((x, y) => tally[y] - tally[x] || (y === before) - (x === before) || popOf(st, y) - popOf(st, x) || (x < y ? -1 : 1));
    let ranked = rank(votes), runoff = null;
    if (ranked.length > 1 && votes[ranked[0]] < Math.floor(total / 2) + 1) {
        const pair = ranked.slice(0, 2).sort();
        runoff = {};
        for (const e of electors) {
            const v = voteBetween(game, e, pair);
            if (v) runoff[v] = (runoff[v] ?? 0) + 1;
        }
        ranked = rank(runoff);
    }
    emp.emperor = ranked[0] ?? (candidates.includes(before) ? before : null);
    emp.late = null;
    emp.promises = {};
    emp.choices = {};
    emp.called = false;
    emp.next = null;
    emp.last = { day: st.day, votes, ...(runoff ? { runoff } : {}) };
    events.push({ type: "elected", day: st.day, country: emp.emperor, previous: before, votes, ...(runoff ? { runoff } : {}), cast, why, concern });
    if (before && emp.emperor && emp.emperor !== before) addAuthority(game, AUTHORITY.PASSED, "passed", events);
    if (emp.emperor && st.day >= CAPITULATION_DAY) addAuthority(game, AUTHORITY.CAPITULATION, "capitulation", events);
}

// the throne is empty, by death or vacancy: the late Emperor's country remembered, and an election called for six months on
function callElection(game, events, why) {
    const st = game.state, emp = st.empire;
    emp.late = emp.emperor ?? emp.late;
    emp.emperor = null;
    emp.hereditary = false;                                 // a crown fallen vacant is elected again
    emp.called = true;
    emp.next = st.day + INTERREGNUM_DAYS;
    events.push({ type: "electionCalled", day: st.day, on: emp.next, why, country: emp.late, candidates: candidatesOf(game), concern: concerned(game) });
}

// the throne is vacant when the Emperor is out of the game, someone's vassal, or no longer a German state
const vacant = (game) => {
    const st = game.state, e = st.empire.emperor;
    return e !== null && (!standing(st, e) || !isGermanState(game, e));
};

// each day: a ban whose war is over lifted; at the start of each year the authority's year and the Emperor's chance of death; a
// throne fallen vacant; an election held when its day comes
export function empireDay(game, events) {
    const st = game.state, emp = st.empire;
    if (!emp) return;
    // a ban lasts as long as its war of execution, however it ends (a peace, the banned state out of the game)
    if (emp.banned.length) emp.banned = emp.banned.filter((t) => st.wars.some((k) => st.warInfo[k]?.execution && st.warInfo[k].attacker === t));
    if (st.day > 0 && st.day % YEAR_DAYS === 0) {
        // a year with no war between German states raises the crown's authority by 1; otherwise each such war lowers it by 1
        const german = new Set(germanStates(game)), wars = st.wars.filter((k) => k.split("|").every((c) => german.has(c))).length;
        if (wars === 0) addAuthority(game, AUTHORITY.PEACE_YEAR, "peace", events);
        else addAuthority(game, AUTHORITY.WAR_YEAR * wars, "wars", events);
        // the Emperor rules for life — and may die this year; a hereditary crown passes to his heir, in the same country
        if (emp.emperor && random(st) < DEATH_CHANCE && !emp.hereditary) {
            events.push({ type: "emperorDies", day: st.day, country: emp.emperor, concern: concerned(game) });
            callElection(game, events, "death");
        }
    }
    if (vacant(game)) {
        events.push({ type: "vacant", day: st.day, country: emp.emperor, concern: concerned(game) });
        callElection(game, events, "vacant");
    }
    if (!emp.emperor && !emp.called) callElection(game, events, "vacant");
    if (emp.called && st.day >= emp.next) holdElection(game, events, "due");
}

// may `code` promise `money` to the vote of `settlement`: an election called, `code` standing, the vote cast by another, and its
// promises no more than its treasury. Null if so, else why not
export function promiseError(game, code, settlement, money) {
    const st = game.state, emp = st.empire;
    if (!emp) return "this scenario has no Emperor";
    if (!emp.called) return "no election has been called";
    if (!candidatesOf(game).includes(code)) return "you do not stand: a Catholic (or, after 1517, Protestant) German state of 40,000 people, nobody's vassal";
    const e = electorsOf(game).find((x) => x.settlement === settlement);
    if (!e) return `${settlement} casts no vote`;
    if (!e.holder || e.holder === code) return "nobody else casts that vote";
    if (!Number.isFinite(money) || money < 0) return "promise a sum of money, or 0 to take a promise back";
    const others = Object.entries(emp.promises[code] ?? {}).filter(([s]) => Number(s) !== settlement).reduce((n, [, m]) => n + m, 0);
    if (others + money > st.countries[code].treasury) return "you may not promise more than you hold";
    return null;
}

// ---------- imperial reform: the estates' (RULES.md §10, Imperial reform) ----------

// the Archbishop of Mainz, the arch-chancellor, who led the estates' reform: whoever casts that church vote
const chancellor = (game) => electorsOf(game).find((e, i) => game.map.scenario.empire.electors[i].chancellor)?.holder ?? null;

// may `code` propose the next reform now: the Emperor or the Archbishop of Mainz, the authority high enough, none voted down within
// 5 years. Null if so
export function reformError(game, code) {
    const st = game.state, emp = st.empire;
    if (!emp) return "this scenario has no Emperor";
    if (code !== emp.emperor && code !== chancellor(game)) return "only the Emperor or the Archbishop of Mainz proposes a reform";
    const next = REFORMS[emp.reforms];
    if (!next) return "every reform has passed";
    if (emp.authority < next.authority) return `the ${next.name} needs Imperial Authority ${next.authority}; it is ${emp.authority}`;
    if (emp.tried !== null && st.day - emp.tried < REFORM_RETRY_DAYS) return "a reform was voted down less than 5 years ago";
    return null;
}

// the Diet's vote on a reform `proposer` puts to it: three colleges — the electors (every vote cast), the princes (each German state
// but the free cities, a vote each) and the cities (each free city that is a German state). A person votes in each as they have said
// (reformVote), or else as a computer; a computer for it if it proposed it or thinks 0 or better of the proposer. A college is for it
// with more yes than no; the reform passes with two colleges of the three.
// { electors, princes, cities: { yes, no }, colleges: how many are for it, passed }
export function dietVotes(game, proposer) {
    const st = game.state, emp = st.empire, cities = new Set(game.map.scenario.empire?.freeCities ?? []);
    const yes = (c) => {
        const said = emp.reformChoices[c];
        if (st.humans.includes(c) && typeof said === "boolean") return said;
        return c === proposer || opinion(game, c, proposer) >= 0;
    };
    const count = (list) => list.reduce((t, c) => (yes(c) ? { ...t, yes: t.yes + 1 } : { ...t, no: t.no + 1 }), { yes: 0, no: 0 });
    const german = germanStates(game);
    const result = {
        electors: count(electorsOf(game).map((e) => e.holder).filter(Boolean)),
        princes: count(german.filter((c) => !cities.has(c))),
        cities: count(german.filter((c) => cities.has(c))),
    };
    // a reform needs the electors and the princes both; the cities vote, but only advise, as before 1648
    const colleges = ["electors", "princes", "cities"].filter((k) => result[k].yes > result[k].no).length;
    const carried = (k) => result[k].yes > result[k].no;
    return { ...result, colleges, passed: carried("electors") && carried("princes") };
}

// a reform put to the Diet: it passes for good with the electors and the princes both, the cities only advising; voted down, it may be proposed again in 5 years
export function proposeReform(game, code, events) {
    const st = game.state, emp = st.empire, reform = REFORMS[emp.reforms], vote = dietVotes(game, code);
    if (vote.passed) emp.reforms++; else emp.tried = st.day;
    events.push({ type: "reform", day: st.day, country: code, reform: reform.key, name: reform.name, passed: vote.passed, vote, concern: concerned(game) });
}

// ---------- the imperial ban (RULES.md §10, The imperial ban) ----------

// may the Emperor `code` put `target` under the ban: authority enough to pay for it, the target a German state — not itself, nobody it
// is already at war with, bound to by a truce or a pact, or bound to as overlord or subject — with a warmonger score of 30 or more,
// or having taken a settlement of the Empire from another German state within 10 years. Null if so
export function banError(game, code, target) {
    const st = game.state, emp = st.empire;
    if (!emp) return "this scenario has no Emperor";
    if (emp.emperor !== code) return "only the Emperor bans";
    if (emp.authority < BAN_COST) return `the ban costs ${BAN_COST} Imperial Authority; it is ${emp.authority}`;
    if (!st.countries[target] || isRebel(st, target) || target === code || st.countries[target].out !== null) return `${target} cannot be banned`;
    if (!isGermanState(game, target)) return `${target} is no German state`;
    if (emp.banned.includes(target) || atWar(st, code, target)) return `you are at war with ${target} already`;
    if (agreementsBetween(st, code, target).some((x) => x.kind === "truce" || x.kind === "pact")) return `a truce or a pact binds you to ${target}`;
    if (st.countries[target].overlord === code || st.countries[code].overlord === target) return `${target} is your subject or your overlord`;
    const seized = emp.seized[target];
    if ((st.countries[target].warmonger ?? 0) < BAN_WARMONGER && !(seized !== undefined && st.day - seized < SEIZED_DAYS))
        return `${target} has a warmonger score under ${BAN_WARMONGER} and has taken no land of the Empire from a German state in 10 years`;
    return null;
}
