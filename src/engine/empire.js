// The Holy Roman Empire's crown (RULES.md §10, The Emperor; a scenario's SCENARIO.md, The Holy Roman Empire): one German state wears
// it, and seven electors choose who — whoever holds an elector's settlement casts its vote. An election every 25 years, called at
// the start of the year before, and at once whenever the throne falls vacant: the Emperor no longer a German state, out of the
// game or someone's vassal. Candidates may promise electors money, paid when the votes are cast whoever they go to. A person's
// electors vote as the person chooses; a computer's by a formula, as the computer answers everything else (opinion.js), so the
// votes are the engine's own and replay exactly. A scenario without electors has no crown (Mitteleuropa's plain proposal is
// another thing: diplomacy.js, proposeEmpire).

import { YEAR_DAYS } from "./calendar.js";
import { germanStates, hreSettlementsOf } from "./diplomacy.js";
import { popOf } from "./economy.js";
import { opinion } from "./opinion.js";
import { atWar, isRebel } from "./state.js";

export const ELECTION_YEARS = 25;
// who may stand: a German state of this many people, or an outsider of this many
export const CANDIDATE_GERMAN = 20000, CANDIDATE_OUTSIDER = 100000;
// a computer elector's score of a candidate (electorScore): +20 for the reigning Emperor, 1 for each 2,000 × x promised up to
// +30, −20 for one of 150,000 people or more, −50 for one at war with it, −20 for one of another faith
export const REIGNING = 20, PROMISE_MONEY = 2000, PROMISE_MAX = 30, TOO_BIG = 150000, TOO_BIG_MALUS = 20, AT_WAR_MALUS = 50, FAITH_MALUS = 20;

// the crown at the start, from the scenario: null on a map without electors
export function startEmpire(scenario) {
    const e = scenario.empire;
    if (!e?.electors?.length) return null;
    return { emperor: e.emperor ?? null, next: ELECTION_YEARS * YEAR_DAYS, called: false, promises: {}, choices: {}, last: null };
}

// the electors as they stand: each vote, its settlement, and who holds it (null for nobody, or rebels)
export function electorsOf(game) {
    const st = game.state;
    return (game.map.scenario.empire?.electors ?? []).map((e) => {
        const owner = st.settlements[e.settlement]?.owner ?? null;
        return { vote: e.vote, settlement: e.settlement, holder: owner && !isRebel(st, owner) ? owner : null };
    });
}

const standing = (st, code) => Boolean(st.countries[code]) && !isRebel(st, code) && st.countries[code].out === null && st.countries[code].subjectKind !== "vassal";

// who may stand, in order of their codes: the reigning Emperor while it is a German state, and every German state of 20,000
// people or more and every outsider of 100,000 or more — none of them anyone's vassal
export function candidatesOf(game) {
    const st = game.state, german = new Set(germanStates(game)), emperor = st.empire?.emperor;
    return Object.keys(st.countries).sort().filter((c) => standing(st, c)
        && ((c === emperor && german.has(c)) || popOf(st, c) >= (german.has(c) ? CANDIDATE_GERMAN : CANDIDATE_OUTSIDER)));
}

// what the candidate has promised the vote of this settlement
const promised = (st, candidate, settlement) => st.empire?.promises[candidate]?.[settlement] ?? 0;

// how a computer elector holding `settlement` weighs a candidate (RULES.md §10, The Emperor)
export function electorScore(game, elector, candidate, settlement) {
    const st = game.state, a = st.countries[elector], b = st.countries[candidate];
    let score = opinion(game, elector, candidate);
    if (candidate === st.empire?.emperor) score += REIGNING;
    score += Math.min(PROMISE_MAX, promised(st, candidate, settlement) / (PROMISE_MONEY * game.map.x));
    if (popOf(st, candidate) >= TOO_BIG) score -= TOO_BIG_MALUS;
    if (atWar(st, elector, candidate)) score -= AT_WAR_MALUS;
    if (a.religion && b.religion && a.religion !== b.religion) score -= FAITH_MALUS;
    return score;
}

// whom the vote of an elector goes to: a person's as they chose, if their choice stands; a computer's — or a person's who has not
// chosen — to the other candidate it scores highest (the first by code among equals), or to itself if it stands and wears the crown
// already, or has more people than that candidate: the electors mostly chose another, and one of their own only when it was the
// greater. Null with no holder
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
    if (candidates.includes(holder) && (holder === st.empire?.emperor || !best || popOf(st, holder) > popOf(st, best))) return holder;
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

// the election: every promise paid from its candidate's treasury to whoever holds that vote now, as far as the treasury goes;
// the votes counted. A majority of the votes cast — 4 of 7 — wins; without one, the electors vote again between the two leaders
// (voteBetween), and the more votes win. Ties — for the lead, or in the second round — go to the reigning Emperor if it is among
// them, else to the larger people, else to the first by code. The promises and choices are spent with it
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
    const before = emp.emperor, total = Object.values(votes).reduce((n, v) => n + v, 0);
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
    emp.promises = {};
    emp.choices = {};
    emp.called = false;
    emp.last = { day: st.day, votes, ...(runoff ? { runoff } : {}) };
    events.push({ type: "elected", day: st.day, country: emp.emperor, previous: before, votes, ...(runoff ? { runoff } : {}), cast, why, concern });
}

// whom an election concerns, for the news (text.js, eventCountries): every German state, every candidate and every elector
const concerned = (game) => [...new Set([...germanStates(game), ...candidatesOf(game), ...electorsOf(game).map((e) => e.holder).filter(Boolean)])].sort();

// the throne is vacant when its holder is nobody, out of the game, someone's vassal, or no longer a German state
const vacant = (game) => {
    const st = game.state, e = st.empire.emperor;
    return !e || !standing(st, e) || hreSettlementsOf(game, e) === 0;
};

// each day: an election called a year ahead, held when due; a vacant throne filled at once
export function empireDay(game, events) {
    const st = game.state, emp = st.empire;
    if (!emp) return;
    if (!emp.called && st.day >= emp.next - YEAR_DAYS && st.day < emp.next) {
        emp.called = true;
        events.push({ type: "electionCalled", day: st.day, on: emp.next, candidates: candidatesOf(game), concern: concerned(game) });
    }
    if (st.day >= emp.next) {
        emp.next += ELECTION_YEARS * YEAR_DAYS;
        holdElection(game, events, "due");
    } else if (vacant(game)) {
        events.push({ type: "vacant", day: st.day, country: emp.emperor, concern: concerned(game) });
        holdElection(game, events, "vacant");
    }
}

// may `code` promise `money` to the vote of `settlement`: an election called, `code` standing, the vote an elector's held by
// another, and its promises no more than its treasury. Null if so, else why not
export function promiseError(game, code, settlement, money) {
    const st = game.state, emp = st.empire;
    if (!emp) return "this scenario has no Emperor";
    if (!emp.called) return "no election has been called";
    if (!candidatesOf(game).includes(code)) return "you do not stand: a German state of 20,000 people or an outsider of 100,000, nobody's vassal";
    const e = electorsOf(game).find((x) => x.settlement === settlement);
    if (!e) return `${settlement} casts no vote`;
    if (!e.holder || e.holder === code) return "nobody else holds that vote";
    if (!Number.isFinite(money) || money < 0) return "promise a sum of money, or 0 to take a promise back";
    const others = Object.entries(emp.promises[code] ?? {}).filter(([s]) => Number(s) !== settlement).reduce((n, [, m]) => n + m, 0);
    if (others + money > st.countries[code].treasury) return "you may not promise more than you hold";
    return null;
}
