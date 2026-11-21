// The Holy Roman Empire's crown (RULES.md §10, The Emperor; a scenario's SCENARIO.md, The Holy Roman Empire): one German state wears
// it, and seven electors choose who — whoever holds an elector's settlement casts its vote. An election every 25 years, called at
// the start of the year before, and at once whenever the throne falls vacant: the Emperor no longer a German state, out of the
// game or someone's vassal. Candidates may promise electors money, paid when the votes are cast whoever they go to. A person's
// electors vote as the person chooses; a computer's by a formula, as the computer answers everything else (opinion.js), so the
// votes are the engine's own and replay exactly. The crown's Imperial Authority (0 to 100) rises with years of peace among the German
// states and falls with years of their wars, and with the crown changing hands; the rest of what moves it is in diplomacy.js
// (an Emperor's wars and peaces, Defender of the Empire). A scenario without electors has no crown (Mitteleuropa's plain proposal is
// another thing: diplomacy.js, proposeEmpire).

import { YEAR_DAYS } from "./calendar.js";
import { AUTHORITY, addAuthority, germanStates, hreSettlementsOf } from "./diplomacy.js";
import { popOf } from "./economy.js";
import { opinion } from "./opinion.js";
import { atWar, isRebel } from "./state.js";

export const ELECTION_YEARS = 25;
// who may stand: a German state of this many people — two cities' worth: no single town or free city — or an outsider of this many
export const CANDIDATE_GERMAN = 40000, CANDIDATE_OUTSIDER = 100000;
// a computer elector's score of a candidate (electorScore): +20 for the reigning Emperor, 1 for each 2,000 × x promised up to
// +30, −20 for one of 150,000 people or more, −50 for one at war with it, −20 for one of another faith
export const REIGNING = 20, PROMISE_MONEY = 2000, PROMISE_MAX = 30, TOO_BIG = 150000, TOO_BIG_MALUS = 20, AT_WAR_MALUS = 50, FAITH_MALUS = 20;
// the reforms, in the order they must pass, and the authority each needs before the Emperor may propose it (RULES.md §10, Imperial
// reform); a proposal voted down may be made again after REFORM_RETRY_DAYS; it passes with REFORM_VOTES of the seven
export const REFORMS = [
    { key: "landfriede", name: "Eternal Public Peace", authority: 40 },
    { key: "penny", name: "Common Penny", authority: 55 },
    { key: "circles", name: "Imperial Circles", authority: 70 },
    { key: "renovatio", name: "Renovatio Imperii", authority: 85 },
    { key: "hereditary", name: "Hereditary Empire", authority: 100 },
];
export const REFORM_RETRY_DAYS = 5 * YEAR_DAYS, REFORM_VOTES = 4;
// the imperial ban: what it costs the crown, and who may be put under it — a German state with this warmonger score, or one that
// took a settlement of the Empire from another German state within SEIZED_DAYS
export const BAN_COST = 10, BAN_WARMONGER = 30, SEIZED_DAYS = 10 * YEAR_DAYS;
export const reformsPassed = (st) => st.empire?.reforms ?? 0;
export const hasReform = (st, key) => reformsPassed(st) > REFORMS.findIndex((r) => r.key === key);

// the crown at the start, from the scenario: null on a map without electors
export function startEmpire(scenario) {
    const e = scenario.empire;
    if (!e?.electors?.length) return null;
    return { emperor: e.emperor ?? null, authority: AUTHORITY.START, next: ELECTION_YEARS * YEAR_DAYS, called: false, promises: {}, choices: {}, last: null,
        // the reforms passed (how many, in order), the day the last one was voted down, people's electors' stand on reforms, the states
        // under the ban, the day each German state last took a settlement of the Empire from another, and who has demanded Renovatio
        reforms: 0, tried: null, reformChoices: {}, banned: [], seized: {} };
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

// who may stand, in order of their codes: the reigning Emperor while it is a German state, and every German state of 40,000
// people or more (CANDIDATE_GERMAN) and every outsider of 100,000 or more — none of them anyone's vassal
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
    if (before && emp.emperor && emp.emperor !== before) addAuthority(game, AUTHORITY.PASSED, "passed", events);
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
    // at the start of each year: a year with no war between German states raises the crown's authority by 1; otherwise each such
    // war being fought lowers it by 1
    if (st.day > 0 && st.day % YEAR_DAYS === 0) {
        const german = new Set(germanStates(game)), wars = st.wars.filter((k) => k.split("|").every((c) => german.has(c))).length;
        if (wars === 0) addAuthority(game, AUTHORITY.PEACE_YEAR, "peace", events);
        else addAuthority(game, AUTHORITY.WAR_YEAR * wars, "wars", events);
    }
    // a Hereditary Empire has no more elections — only a throne fallen vacant is filled
    if (hasReform(st, "hereditary")) {
        if (vacant(game)) { events.push({ type: "vacant", day: st.day, country: emp.emperor, concern: concerned(game) }); holdElection(game, events, "vacant"); }
        return;
    }
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
    if (!candidatesOf(game).includes(code)) return "you do not stand: a German state of 40,000 people or an outsider of 100,000, nobody's vassal";
    const e = electorsOf(game).find((x) => x.settlement === settlement);
    if (!e) return `${settlement} casts no vote`;
    if (!e.holder || e.holder === code) return "nobody else holds that vote";
    if (!Number.isFinite(money) || money < 0) return "promise a sum of money, or 0 to take a promise back";
    const others = Object.entries(emp.promises[code] ?? {}).filter(([s]) => Number(s) !== settlement).reduce((n, [, m]) => n + m, 0);
    if (others + money > st.countries[code].treasury) return "you may not promise more than you hold";
    return null;
}

// ---------- imperial reform (RULES.md §10, Imperial reform) ----------

// may `code` propose the next reform now: the Emperor, its authority high enough, no proposal voted down within 5 years. Null if so
export function reformError(game, code) {
    const st = game.state, emp = st.empire;
    if (!emp) return "this scenario has no Emperor";
    if (emp.emperor !== code) return "only the Emperor proposes a reform";
    const next = REFORMS[emp.reforms];
    if (!next) return "every reform has passed";
    if (emp.authority < next.authority) return `${next.name} needs Imperial Authority ${next.authority}; it is ${emp.authority}`;
    if (emp.tried !== null && st.day - emp.tried < REFORM_RETRY_DAYS) return `a reform was voted down less than 5 years ago`;
    return null;
}

// how each elector votes on the Emperor's reform: a person's electors as the person has said (reformVote), or else as a computer's;
// a computer's for it when it is the Emperor's own or thinks 0 or better of the Emperor. [{ settlement, holder, yes }]
export function reformVotes(game) {
    const st = game.state, emp = st.empire;
    return electorsOf(game).map((e) => {
        if (!e.holder) return { ...e, yes: false };
        const said = emp.reformChoices[e.holder];
        if (st.humans.includes(e.holder) && typeof said === "boolean") return { ...e, yes: said };
        return { ...e, yes: e.holder === emp.emperor || opinion(game, e.holder, emp.emperor) >= 0 };
    });
}

// the Emperor proposes the next reform: it passes with 4 of the 7 votes, for good; voted down, it may be tried again in 5 years
export function proposeReform(game, events) {
    const st = game.state, emp = st.empire, reform = REFORMS[emp.reforms], votes = reformVotes(game), yes = votes.filter((v) => v.yes).length;
    const passed = yes >= REFORM_VOTES;
    if (passed) emp.reforms++; else emp.tried = st.day;
    events.push({ type: "reform", day: st.day, country: emp.emperor, reform: reform.key, name: reform.name, passed, yes, concern: concerned(game) });
}

// ---------- the imperial ban (RULES.md §10, The imperial ban) ----------

// may the Emperor `code` put `target` under the ban: authority enough to pay for it, the target a German state — not itself, nobody it is
// already at war with or bound to as overlord or subject — with a warmonger score of 30 or more, or having taken a settlement of the
// Empire from another German state within 10 years. Null if so
export function banError(game, code, target) {
    const st = game.state, emp = st.empire;
    if (!emp) return "this scenario has no Emperor";
    if (emp.emperor !== code) return "only the Emperor bans";
    if (emp.authority < BAN_COST) return `the ban costs ${BAN_COST} Imperial Authority; it is ${emp.authority}`;
    if (!st.countries[target] || isRebel(st, target) || target === code || st.countries[target].out !== null) return `${target} cannot be banned`;
    if (!hreSettlementsOf(game, target)) return `${target} is no German state`;
    if (emp.banned.includes(target) || atWar(st, code, target)) return `you are at war with ${target} already`;
    if (st.countries[target].overlord === code || st.countries[code].overlord === target) return `${target} is your subject or your overlord`;
    const seized = emp.seized[target];
    if ((st.countries[target].warmonger ?? 0) < BAN_WARMONGER && !(seized !== undefined && st.day - seized < SEIZED_DAYS))
        return `${target} has a warmonger score under ${BAN_WARMONGER} and has taken no land of the Empire from a German state in 10 years`;
    return null;
}
