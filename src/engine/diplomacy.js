// War and peace, agreements, subjects and the Empire (RULES.md §10) — the operations; the formulas by which a
// computer country answers are in opinion.js, the commands in commands-diplomacy.js.
//
// A war is between two countries. Declaring one pulls others in as that country's friends and foes, each against the
// principal on the other side: the target's defensive allies, guarantors and vassals join at once; military allies on
// both sides are called and may refuse (a human has 6 months, a computer joins); the declarer's vassals join. Nobody
// joined drags in further allies. Every pair at war has a record — who is the attacking side, the people each had
// at the start, and the people each has taken — for the war score and the warmonger score at the peace.

import { YEAR_DAYS, longDate } from "./calendar.js";
import { money } from "./command-util.js";
import { BUILDING_PRICE } from "./costs.js";
import { popOf } from "./economy.js";
import { capture } from "./fighting.js";
import { portsInReach } from "./map.js";
import { retreat } from "./movement.js";
import { NEAR_VICTORY, agreementAnswer, bordering, demandChance, militaryPowerOf, nearVictory, neighboursOf, opinion, subjectChance, warScore } from "./opinion.js";
import { random } from "./random.js";
import { WORST_FAITH, faithRegard } from "./religion.js";
import { agreementsBetween, alliesOf, guarantorsOf, hasAgreement, isVassal, overlordOf, subjectsOf, wouldCycle } from "./relations.js";
import { armyList, atWar, canEnter, isGermanState, isRebel, reformPassed, warKey } from "./state.js";
import { scores, victoryOf } from "./victory.js";

export const OFFER_DAYS = Math.round(6 * 365 / 12);     // a human has 6 months to answer
export const TRUCE_DAYS = 5 * YEAR_DAYS;
export const PACT_DAYS = 10 * YEAR_DAYS;
export const GUARANTEE_DAYS = 20 * YEAR_DAYS;        // a guarantee runs out, as an alliance does, and may be given again (RULES.md §10)
export const START_ALLIANCE_DAYS = 20 * YEAR_DAYS;        // an alliance a scenario opens with
export const PROPOSAL_DAYS = 5 * YEAR_DAYS;             // the same proposal to the same country once in 5 years

const isHuman = (st, c) => st.humans.includes(c);
const real = (st, c) => Boolean(st.countries[c]) && !isRebel(st, c);
const pair = (a, b) => (a < b ? [a, b] : [b, a]);

// ---------- wars ----------

// a war between a and b begins; `attacker` is the one of them on the attacking side
export function openWar(game, a, b, attacker) {
    const st = game.state, key = warKey(a, b);
    if (st.wars.includes(key)) return;
    st.wars.push(key);
    st.wars.sort();
    st.warInfo[key] = { start: st.day, attacker, startPop: { [a]: popOf(st, a), [b]: popOf(st, b) }, taken: { [a]: 0, [b]: 0 }, gained: {},
        // where the scenario has an Emperor, which of the two was a German state as the war began (crownAtPeace)
        ...(st.empire ? { german: { [a]: isGerman(game, a), [b]: isGerman(game, b) } } : {}) };
}

// it ends; the world remembers when
export function closeWar(game, a, b) {
    const st = game.state, key = warKey(a, b);
    st.wars = st.wars.filter((w) => w !== key);
    delete st.warInfo[key];
    st.memory.lastWar[key] = st.day;
}

// a settlement of `from` was taken by `to` in war: for the war score and the warmonger score
export function recordCapture(game, settlement, from, to) {
    const w = game.state.warInfo[warKey(from, to)];
    if (!w) return;
    w.taken[to] = (w.taken[to] ?? 0) + settlement.pop;
    w.gained[settlement.id] = to;
}

// ---------- agreements ----------

// `against`: the warmonger a coalition's alliance is made against (coalitions, below); it lapses with the threat
export function addAgreement(game, kind, a, b, days = null, against = null) {
    const st = game.state;
    if (hasAgreement(st, kind, a, b)) return;
    const [x, y] = kind === "guarantee" || kind === "access" ? [a, b] : pair(a, b);
    st.agreements.push({ kind, a: x, b: y, since: st.day, until: days === null ? null : st.day + days, ...(against ? { against } : {}) });
}

export function removeAgreements(game, pred) {
    const before = game.state.agreements.length;
    game.state.agreements = game.state.agreements.filter((x) => !pred(x));
    return before - game.state.agreements.length;
}

// breaking an agreement: every alliance of the country ends, and the world remembers for 10 years (RULES.md §10)
export function punishBreak(game, code, events, victim = null) {
    const st = game.state;
    removeAgreements(game, (x) => (x.kind === "defensive" || x.kind === "military") && (x.a === code || x.b === code));
    st.memory.broke[code] = st.day;
    // whom it betrayed: the world weighs the breach by the two faiths (opinion.js, betrayalPenalty)
    (st.memory.betrayed ??= {})[code] = victim;
    events.push({ type: "broke", day: st.day, country: code, ...(victim ? { victim } : {}) });
}

// armies standing in land that has closed to them go home (RULES.md §10)
export function evictClosed(game, events) {
    const st = game.state;
    for (const a of armyList(st)) {
        if (a.retreating) continue;
        const key = a.at ?? a.march.to;
        if (!canEnter(game, a.owner, key)) retreat(game, a, events, null, true);
    }
}

// ---------- subjects ----------

// `subject` becomes the subject of `overlord` (RULES.md §10). A vassal gives up its own diplomacy and joins every war
// of its overlord; a war between the two ends.
export function setSubject(game, subject, overlord, kind, events) {
    const st = game.state, c = st.countries[subject];
    if (subject === overlord || wouldCycle(st, subject, overlord) || (c.overlord && c.overlord !== overlord)) return false;
    if (atWar(st, subject, overlord)) closeWar(game, subject, overlord);
    // the day it became this overlord's vassal, from which it may be integrated after 10 years (integrate, below)
    c.vassalSince = kind !== "vassal" ? null : c.overlord === overlord && c.subjectKind === "vassal" ? c.vassalSince : st.day;
    c.overlord = overlord;
    c.subjectKind = kind;
    if (kind === "vassal") {
        // its own wars end — it has no diplomacy left to make peace with, and its overlord is not in them — except with its
        // own peasants; then it joins every war of its overlord's
        for (const w of [...st.wars]) {
            const [x, y] = w.split("|"), enemy = x === subject ? y : y === subject ? x : null;
            if (enemy && enemy !== overlord && real(st, enemy) && !atWar(st, overlord, enemy)) closeWar(game, subject, enemy);
        }
        removeAgreements(game, (x) => x.a === subject || x.b === subject);
        for (const w of [...st.wars]) {
            const [x, y] = w.split("|");
            if (x !== overlord && y !== overlord) continue;
            const enemy = x === overlord ? y : x;
            if (enemy !== subject && real(st, enemy) && !atWar(st, subject, enemy)) openWar(game, subject, enemy, st.warInfo[w]?.attacker === overlord ? subject : enemy);
        }
    }
    events.push({ type: "subject", day: st.day, country: subject, overlord, kind });
    if (kind === "vassal") evictClosed(game, events);           // its alliances are gone: allies' armies in its land go home
    return true;
}

export function freeSubject(game, subject, events) {
    const st = game.state, c = st.countries[subject], overlord = c.overlord;
    c.overlord = null;
    c.subjectKind = null;
    c.vassalSince = null;
    events.push({ type: "freedom", day: st.day, country: subject, overlord });
}

// ---------- going to war ----------

// who is drawn into a war that `declarer` declares on `target`: { auto: [[country, side]], calls: [[country, caller, side]] }
// where side is "att" (with the declarer) or "def" (with the target)
export function warJoiners(game, declarer, target) {
    const st = game.state, auto = [], calls = [];
    const principal = { att: declarer, def: target };
    const enemyOf = { att: target, def: declarer };
    const seen = new Set([declarer, target]);
    const add = (list, c, entry, side) => {
        // only a real country, once, and not a subject of — or overlord of — the other principal
        if (!real(st, c) || seen.has(c) || overlordOf(st, c) === enemyOf[side] || overlordOf(st, enemyOf[side]) === c) return;
        seen.add(c);
        list.push(entry);
    };
    for (const c of subjectsOf(st, declarer).filter((x) => isVassal(st, x))) add(auto, c, [c, "att"], "att");
    for (const c of subjectsOf(st, target).filter((x) => isVassal(st, x))) add(auto, c, [c, "def"], "def");
    // a defensive ally joins — one of a coalition only against the warmonger it was made against (RULES.md §10, Coalitions)
    const defends = (x) => agreementsBetween(st, target, x).some((g) => g.kind === "defensive" && (!g.against || g.against === declarer));
    for (const c of [...new Set([...alliesOf(st, target).filter(defends), ...guarantorsOf(st, target)])].sort()) add(auto, c, [c, "def"], "def");
    for (const side of ["att", "def"]) {
        for (const c of alliesOf(st, principal[side]).filter((x) => hasAgreement(st, "military", principal[side], x))) add(calls, c, [c, principal[side], side], side);
    }
    return { auto, calls };
}

// a country enters a war against the principal on the other side
export function joinWar(game, joiner, side, principal, other, events) {
    const st = game.state;
    if (atWar(st, joiner, other) || joiner === other || atWar(st, joiner, principal)) return false;
    openWar(game, joiner, other, side === "att" ? joiner : other);
    events.push({ type: "joins", day: st.day, country: joiner, enemy: other, side });
    // a country cannot stay allied with one it is now fighting: the alliance ends (this is no break of faith)
    if (removeAgreements(game, (x) => (x.kind === "defensive" || x.kind === "military") && ((x.a === joiner && x.b === other) || (x.a === other && x.b === joiner)))) {
        events.push({ type: "ended", day: st.day, country: joiner, with: other, kind: "alliance" });
    }
    return true;
}

// a call to arms answered (or lapsed) months after it was made: the caller must still be at war with the enemy, the alliance
// still stand, and the ally be free to fight that enemy — not its overlord or subject, not at war with the caller
export function callStands(game, o) {
    const st = game.state;
    // a call to defend the Empire stands while the one called still wears the crown; one to the Emperor's war of execution while the
    // ban lasts; one of the Imperial Circles while they stand (they do for good); a call to arms while the alliance holds
    const bond = o.defender ? st.empire?.emperor === o.to : o.execution ? Boolean(st.empire?.banned.includes(o.enemy)) : o.circle ? true
        : hasAgreement(st, "military", o.from, o.to);
    return atWar(st, o.from, o.enemy) && bond && !atWar(st, o.to, o.from)
        && overlordOf(st, o.to) !== o.enemy && overlordOf(st, o.enemy) !== o.to && st.countries[o.to].out === null;
}

// ---------- the crown's authority (RULES.md §10, The Emperor) ----------

// Imperial Authority, 0 to 100, the crown's not a country's: what moves it
export const AUTHORITY = { START: 20, PEACE_YEAR: 1, WAR_YEAR: -1, DEFENDED: 5, EXECUTED: 10, KEPT: -5, REFUSED: -10, ATTACKED: -15, PASSED: -10, BAN: -10, CAPITULATION: -10 };
// may `c` join a war on `enemy` at the crown's call: a German state of its own, thinking 0 or better of the Emperor, not yet in it,
// nobody's vassal, not the enemy's subject or overlord, and bound to it by no pact, truce, alliance or guarantee
function crownJoiner(game, c, enemy, emp) {
    const st = game.state;
    if (!real(st, c) || st.countries[c].out !== null || isVassal(st, c) || atWar(st, c, enemy) || overlordOf(st, c) === enemy || overlordOf(st, enemy) === c) return false;
    if (agreementsBetween(st, c, enemy).some((x) => ["pact", "truce", "defensive", "military"].includes(x.kind)) || hasAgreement(st, "guarantee", c, enemy)) return false;
    return c === emp || opinion(game, c, emp) >= 0;
}
// a German state called by the crown to a war on `enemy` beside `ally`: a computer comes; a person is asked (the offer's `flag`:
// circle or execution)
function crownCall(game, c, ally, enemy, flag, events) {
    const st = game.state;
    if (!isHuman(st, c)) { joinWar(game, c, "def", ally, enemy, events); return; }
    st.offers.push({ id: ++st.offerSeq, kind: "call", from: ally, to: c, enemy, side: "def", [flag]: true, deadline: st.day + OFFER_DAYS });
    events.push({ type: "offer", day: st.day, country: c, from: ally, what: flag === "execution" ? "a call to the Emperor's war of execution" : "a call of the Imperial Circles" });
}
export function addAuthority(game, delta, why, events) {
    const emp = game.state.empire;
    if (!emp || !delta) return;
    const before = emp.authority;
    emp.authority = Math.max(0, Math.min(100, before + delta));
    if (emp.authority !== before) events.push({ type: "authority", day: game.state.day, country: emp.emperor, delta: emp.authority - before, now: emp.authority, why });
}
const isGerman = (game, c) => isGermanState(game, c);

// the crown in a new war: an Emperor attacking a German state loses authority; an outsider attacking one calls the Emperor in as
// Defender of the Empire — a computer Emperor comes if it is at least half the attacker's strength and bound to it by no pact,
// truce or alliance, and refusing costs it authority; a person is asked, as for a call to arms
function crownAtWar(game, a, b, events) {
    const st = game.state, emp = st.empire?.emperor;
    if (!emp || !st.countries[emp]) return;
    const germanB = isGerman(game, b);
    if (a === emp && germanB) addAuthority(game, AUTHORITY.ATTACKED, "attacked", events);
    // the Eternal Public Peace: a German state declaring war on another breaks an agreement, unless the target is under the ban
    if (reformPassed(st, "landfriede") && germanB && isGerman(game, a) && !st.empire.banned.includes(b)) {
        events.push({ type: "landfriede", day: st.day, country: a, target: b });
        punishBreak(game, a, events, b);
    }
    // the Imperial Circles: an outsider attacking a German state brings every German state that thinks 0 or better of the Emperor in
    if (reformPassed(st, "circles") && germanB && !isGerman(game, a)) {
        for (const c of germanStates(game)) if (c !== b && c !== emp && crownJoiner(game, c, a, emp)) crownCall(game, c, b, a, "circle", events);
    }
    if (!germanB || isGerman(game, a) || emp === a || emp === b || atWar(st, emp, a) || atWar(st, emp, b)) return;
    if (isVassal(st, emp) || overlordOf(st, emp) === a || overlordOf(st, a) === emp || st.countries[emp].out !== null) return;
    if (isHuman(st, emp)) {
        st.offers.push({ id: ++st.offerSeq, kind: "call", from: b, to: emp, enemy: a, side: "def", defender: true, deadline: st.day + OFFER_DAYS });
        events.push({ type: "offer", day: st.day, country: emp, from: b, what: "a call to defend the Empire" });
        return;
    }
    const bound = agreementsBetween(st, emp, a).some((x) => ["pact", "truce", "defensive", "military"].includes(x.kind));
    if (!bound && militaryPowerOf(st, emp) >= 0.5 * militaryPowerOf(st, a)) defendEmpire(game, emp, b, a, events);
    else refuseDefence(game, emp, b, a, events);
}

// the imperial ban: the Emperor at war with `target` — a war of execution, at the cost of 10 authority, in which the Emperor is the
// defending side (no warmonger score) and every German state that thinks 0 or better of it is called beside it; the two sides'
// vassals, defensive allies and guarantors come in as in any war, their military allies are called
export function banWar(game, emp, target, events) {
    const st = game.state;
    addAuthority(game, AUTHORITY.BAN, "ban", events);
    st.empire.banned.push(target);
    st.empire.banned.sort();
    openWar(game, emp, target, target);
    st.warInfo[warKey(emp, target)].execution = true;
    events.push({ type: "ban", day: st.day, country: emp, target, concern: germanStates(game) });
    const { auto, calls } = warJoiners(game, emp, target);
    for (const [c, side] of auto) joinWar(game, c, side === "att" ? "def" : "att", side === "att" ? emp : target, side === "att" ? target : emp, events);
    // (call: the other principal is the declarer for a defender, the target for an attacker)
    for (const [c, , side] of calls) {
        if (side === "att") call(game, c, emp, "def", target, emp, events);           // the Emperor's military allies, beside it
        else call(game, c, target, "att", emp, emp, events);                         // the banned state's, beside it
    }
    for (const c of germanStates(game)) if (c !== emp && c !== target && crownJoiner(game, c, target, emp)) crownCall(game, c, emp, target, "execution", events);
    evictClosed(game, events);
}

// the Emperor joins as Defender of the Empire — the war marked, for its peace (makePeace) — or refuses, at a cost
export function defendEmpire(game, emp, ally, enemy, events) {
    if (joinWar(game, emp, "def", ally, enemy, events)) game.state.warInfo[warKey(emp, enemy)].defender = true;
}
export function refuseDefence(game, emp, ally, enemy, events) {
    events.push({ type: "defenderRefuses", day: game.state.day, country: emp, ally, enemy });
    addAuthority(game, AUTHORITY.REFUSED, "refused", events);
}

// the crown at a peace: the Emperor's war as Defender won (a war score of 0 or more) raises it; every settlement of the Empire an
// outsider keeps of a German state's — one whose people count it core — lowers it, outsider and German state as the war began
// (an outsider that took land of the Empire holds some now). `before` is taken as the peace begins
function crownAtPeace(game, mine, other, before, events) {
    const st = game.state, emp = st.empire?.emperor;
    if (!emp) return;
    if (before.defended) addAuthority(game, AUTHORITY.DEFENDED, "defended", events);
    if (before.executed) {
        st.empire.banned = st.empire.banned.filter((c) => c !== before.executed.foe);
        if (before.executed.won) addAuthority(game, AUTHORITY.EXECUTED, "executed", events);
    }
    const hre = new Set(game.map.scenario.settlements.filter((s) => s.hre).map((s) => s.id));
    for (const [o, g] of [[mine, other], [other, mine]]) {
        if (before.german[o] || !before.german[g]) continue;
        const kept = Object.values(st.settlements).filter((s) => s.owner === o && hre.has(s.id) && s.cores.includes(g)).length;
        if (kept) addAuthority(game, AUTHORITY.KEPT * kept, "kept", events);
    }
}

// a country calls its military ally: a computer joins; a human is asked, and joins if it does not answer in 6 months
function call(game, ally, caller, side, declarer, target, events) {
    const st = game.state, other = side === "att" ? target : declarer;
    if (atWar(st, ally, caller)) {
        removeAgreements(game, (x) => x.kind === "military" && ((x.a === ally && x.b === caller) || (x.a === caller && x.b === ally)));
        return;
    }
    if (!isHuman(st, ally)) { joinWar(game, ally, side, caller, other, events); return; }
    st.offers.push({ id: ++st.offerSeq, kind: "call", from: caller, to: ally, enemy: other, side, deadline: st.day + OFFER_DAYS });
    events.push({ type: "offer", day: st.day, country: ally, from: caller, what: "a call to arms" });
}

// declare war (RULES.md §10): through a pact, a truce or an alliance it breaks the agreement; +5 warmonger; allies, guarantors
// and vassals join
export function declareWar(game, a, b, events) {
    const st = game.state;
    const bound = agreementsBetween(st, a, b).filter((x) => ["pact", "truce", "defensive", "military"].includes(x.kind))
        .concat(st.agreements.filter((x) => x.kind === "guarantee" && x.a === a && x.b === b));
    if (bound.length) {
        removeAgreements(game, (x) => bound.includes(x));
        punishBreak(game, a, events, b);
    }
    removeAgreements(game, (x) => (x.kind === "access" && x.a === b && x.b === a) || (x.kind === "access" && x.a === a && x.b === b));
    openWar(game, a, b, a);
    st.countries[a].warmonger += 5;
    events.push({ type: "war", day: st.day, country: a, target: b });
    const { auto, calls } = warJoiners(game, a, b);
    for (const [c, side] of auto) joinWar(game, c, side, side === "att" ? a : b, side === "att" ? b : a, events);
    for (const [c, caller, side] of calls) call(game, c, caller, side, a, b, events);
    crownAtWar(game, a, b, events);
    evictClosed(game, events);
}

// a war joined by choice (RULES.md §10, Subjects): an overlord joins one its protectorate fights, or a protectorate its overlord's —
// on that side, against the principal on the other, as an ally would (no declarer's warmonger score). Choosing to fight `enemy`
// breaks a pact, a truce, an alliance or a guarantee with it, as declaring war does; access between the two ends.
export function joinByChoice(game, joiner, ally, enemy, events) {
    const st = game.state, side = st.warInfo[warKey(ally, enemy)]?.attacker === ally ? "att" : "def";
    const bound = agreementsBetween(st, joiner, enemy).filter((x) => ["pact", "truce", "defensive", "military"].includes(x.kind))
        .concat(st.agreements.filter((x) => x.kind === "guarantee" && x.a === joiner && x.b === enemy));
    if (bound.length) {
        removeAgreements(game, (x) => bound.includes(x));
        punishBreak(game, joiner, events, enemy);
    }
    removeAgreements(game, (x) => x.kind === "access" && ((x.a === enemy && x.b === joiner) || (x.a === joiner && x.b === enemy)));
    joinWar(game, joiner, side, ally, enemy, events);
    evictClosed(game, events);
}

// ---------- peace ----------

// peace terms: { take: [settlements of the other], give: [of mine], money: + to me, − to the other, makeSubject: the other
// becomes my "vassal" | "protectorate", becomeSubject: I become the other's, release: [subjects of the other freed] }
// of the settlements `ids`, those `gainer` could not be given in a peace (validateTerms): reached from its land and its subjects'
// over roads, passes, straits and sea lanes (a port it could land at, whatever the fleets), through the others of `ids` — or
// under its siege — are within reach; the rest are not
export function outOfReach(game, gainer, ids) {
    const st = game.state, want = new Set(ids.map(String)), mine = new Set([gainer, ...subjectsOf(st, gainer)]);
    const reached = new Set(), seen = new Set(), todo = [];
    for (const key in st.settlements) if (mine.has(st.settlements[key].owner)) { seen.add(key); todo.push(key); }
    for (const id of want) if (st.settlements[id]?.siege?.by === gainer && !seen.has(id)) { seen.add(id); reached.add(id); todo.push(id); }
    while (todo.length) {
        const at = todo.pop();
        for (const e of [...(game.map.adj.get(at) ?? []), ...portsInReach(game.map, at).map((to) => ({ to }))]) {
            if (seen.has(e.to)) continue;
            const pass = game.map.nodes.get(e.to)?.kind === "pass";
            if (!pass && !want.has(e.to)) continue;                               // through a pass, or a settlement of the peace
            seen.add(e.to);
            if (!pass) reached.add(e.to);
            todo.push(e.to);
        }
    }
    return ids.filter((id) => !reached.has(String(id)));
}

export function validateTerms(game, mine, other, terms) {
    const st = game.state, t = terms ?? {};
    // lists, each naming a thing once: a settlement given twice would count twice in the price (opinion.js, peaceCost)
    for (const key of ["take", "give", "release"]) {
        if (t[key] === undefined || t[key] === null) continue;
        if (!Array.isArray(t[key])) return `${key} is a list`;
        if (key !== "release" && !t[key].every(Number.isInteger)) return `${key} names settlements by their numbers`;
        if (key === "release" && !t[key].every((c) => typeof c === "string")) return "release names countries by their codes";
        if (new Set(t[key]).size !== t[key].length) return `${key} names something twice`;
    }
    for (const [key, owner] of [["take", other], ["give", mine]]) {
        for (const id of t[key] ?? []) if (st.settlements[id]?.owner !== owner) return `${id} is not ${owner}'s`;
    }
    // only what lies within the receiver's reach: next to its land or its subjects', under its siege, or joined to them through
    // the others of the same peace — no town across the map (RULES.md §10, Peace)
    for (const [key, gainer] of [["take", mine], ["give", other]]) {
        const far = outOfReach(game, gainer, t[key] ?? []);
        if (far.length) return `${far[0]} is out of ${gainer}'s reach: a peace hands over only what borders its land or its subjects', or what it besieges`;
    }
    // a peace leaves each side at least one settlement: it does not wipe a country off the map (RULES.md §10)
    const kept = (c, lose, gain) => Object.values(st.settlements).filter((s) => s.owner === c).length - (lose ?? []).length + (gain ?? []).length;
    if (kept(other, t.take, t.give) < 1) return `${other} would be left with no settlement: a peace must leave it one`;
    if (kept(mine, t.give, t.take) < 1) return "you would be left with no settlement: a peace must leave you one";
    if (t.money !== undefined && (typeof t.money !== "number" || !Number.isFinite(t.money))) return "money is a number";
    if ((t.money ?? 0) > 0 && st.countries[other].treasury < t.money) return `${other} cannot pay that much`;
    if ((t.money ?? 0) < 0 && st.countries[mine].treasury < -t.money) return "you cannot pay that much";
    for (const k of ["makeSubject", "becomeSubject"]) if (t[k] && !["vassal", "protectorate"].includes(t[k])) return `${k} is vassal or protectorate`;
    if (t.makeSubject && t.becomeSubject) return "one of you cannot be the subject of the other and have the other as a subject";
    for (const c of t.release ?? []) if (overlordOf(st, c) !== other) return `${c} is not a subject of ${other}`;
    // a subject only of a neighbour of the overlord's or its subjects', by land or strait, as on demand (RULES.md §10)
    if (t.makeSubject && !withinDemandReach(game, mine, other)) return `${other} borders neither you nor your subjects: a subject is made only of a neighbour`;
    if (t.becomeSubject && !withinDemandReach(game, other, mine)) return `you border neither ${other} nor its subjects: a subject is made only of a neighbour`;
    // a subject has one overlord, and there is no ring of them
    if (t.makeSubject && ((overlordOf(st, other) && overlordOf(st, other) !== mine) || wouldCycle(st, other, mine))) return `${other} cannot become your subject`;
    if (t.becomeSubject && ((overlordOf(st, mine) && overlordOf(st, mine) !== other) || wouldCycle(st, mine, other))) return "you cannot become its subject";
    return null;
}

// what making `subject` a vassal adds to the warmonger score (RULES.md §10, Warmongers): `flat` (10), or —
// if more — half of what taking its settlements would cost (× the scenario's scale); a protectorate half of either. A great realm
// made a subject is no cheaper in the world's eyes than half its conquest
export function subjectWarmonger(game, subject, kind, flat) {
    let pop = 0;
    for (const id in game.state.settlements) if (game.state.settlements[id].owner === subject) pop += game.state.settlements[id].pop;
    return Math.max(flat, 0.5 * pop / 1000 * game.map.warmongerScale) * (kind === "vassal" ? 1 : 0.5);
}

// the warmonger score at a peace (RULES.md §10): +1 per 1,000 people of each settlement held that was taken in the war or
// given in the peace — half on the defending side, × the scenario's warmonger scale — unless it was one's own core; +10/+5 for
// a vassal made, +5/+2.5 for a protectorate
function scoreWarmongers(game, a, b, info, terms, gainer) {
    const st = game.state;
    const credit = (country, points) => { st.countries[country].warmonger += points; };
    const side = (c) => (info.attacker === c ? 1 : 0.5);
    for (const [id, taker] of Object.entries({ ...info.gained, ...gainer })) {
        const s = st.settlements[id];
        if (s.owner !== taker || (taker !== a && taker !== b) || s.cores.includes(taker)) continue;
        credit(taker, s.pop / 1000 * side(taker) * game.map.warmongerScale);
    }
    if (terms.makeSubject) credit(terms.who, subjectWarmonger(game, terms.other, terms.makeSubject, 10) * side(terms.who));
    if (terms.becomeSubject) credit(terms.other, subjectWarmonger(game, terms.who, terms.becomeSubject, 10) * side(terms.other));
}

// sign a peace between `mine` (who proposed) and `other` with the terms; both have agreed (RULES.md §10)
export function makePeace(game, mine, other, terms, events) {
    const st = game.state, t = terms ?? {}, info = st.warInfo[warKey(mine, other)];
    // the crown as the peace begins: whether the Emperor ends a war it defended, winning; which side was a German state
    const emp = st.empire?.emperor, foe = emp === mine ? other : emp === other ? mine : null, crown = st.empire ? {
        defended: Boolean(info?.defender) && foe !== null && warScore(game, emp, foe) >= 0,
        // the Emperor's war of execution ended: the ban lifted, and won if its war score is 0 or more
        executed: Boolean(info?.execution) && foe !== null && st.empire.banned.includes(foe) ? { foe, won: warScore(game, emp, foe) >= 0 } : null,
        german: info?.german ?? { [mine]: isGerman(game, mine), [other]: isGerman(game, other) },
    } : null;
    const gained = {};
    for (const id of t.take ?? []) { capture(game, st.settlements[id], mine, events, "peace"); gained[id] = mine; }
    for (const id of t.give ?? []) { capture(game, st.settlements[id], other, events, "peace"); gained[id] = other; }
    if (t.money) { st.countries[other].treasury -= t.money; st.countries[mine].treasury += t.money; }
    // the wars between the two, and between their vassals, end — before any subject is freed, so that one freed by this peace
    // is not left at war with the side that freed it
    const sides = (c) => [c, ...subjectsOf(st, c).filter((x) => isVassal(st, x))];
    for (const x of sides(mine)) for (const y of sides(other)) if (atWar(st, x, y)) closeWar(game, x, y);
    for (const c of t.release ?? []) freeSubject(game, c, events);
    if (info) scoreWarmongers(game, mine, other, info, { ...t, who: mine, other }, gained);
    if (t.makeSubject) setSubject(game, other, mine, t.makeSubject, events);
    if (t.becomeSubject) setSubject(game, mine, other, t.becomeSubject, events);
    addAgreement(game, "truce", mine, other, TRUCE_DAYS);
    events.push({ type: "peace", day: st.day, country: mine, with: other, terms: t });
    if (crown) crownAtPeace(game, mine, other, crown, events);
    evictClosed(game, events);
}

// ---------- the Empire ----------

// the German states: every country that holds an HRE settlement
export function germanStates(game) {
    const st = game.state;
    return Object.keys(st.countries).sort().filter((c) => real(st, c) && st.countries[c].out === null && isGermanState(game, c));
}

export const hreSettlementsOf = (game, code) => {
    const hre = new Set(game.map.scenario.settlements.filter((s) => s.hre).map((s) => s.id));
    return Object.values(game.state.settlements).filter((s) => s.owner === code && hre.has(s.id)).length;
};

// states that refuse the Empire form the League: a defensive alliance among them all — but never between two at war with
// each other, and none with a member that is out of the game or a vassal (which has no diplomacy). A human's late refusal
// forms it again, from members some of whom may have gone since (RULES.md §10).
export function formLeague(game, members, events) {
    const st = game.state, able = members.filter((c) => real(st, c) && st.countries[c].out === null && !isVassal(st, c));
    for (let i = 0; i < able.length; i++) for (let j = i + 1; j < able.length; j++) {
        if (!allied(st, able[i], able[j]) && !atWar(st, able[i], able[j])) addAgreement(game, "defensive", able[i], able[j]);
    }
    if (able.length > 1) events.push({ type: "league", day: st.day, members: [...able] });
}
const allied = (st, a, b) => hasAgreement(st, "defensive", a, b) || hasAgreement(st, "military", a, b);

// demand the Empire: each German state rolls like a protectorate demand (RULES.md §10); those that join become protectorates,
// those that refuse form the League. Humans are asked. Near victory nobody bows (nearVictory), state by state as they join:
// once the proposer holds three quarters of the number that wins, or the next would carry it there, the rest refuse unrolled.
// A state at war with the proposer refuses at once, a person too: joining would end the war with no peace (a demand is not
// made in a war either). `joined` in the event counts those that joined now, not the subjects it had already.
export function proposeEmpire(game, proposer, events, { bonus = 0 } = {}) {
    const st = game.state, refused = [], asked = [];
    let joined = 0;
    st.memory.empire[proposer] = { league: [] };
    for (const c of germanStates(game)) {
        if (c === proposer || st.countries[c].overlord || wouldCycle(st, c, proposer)) continue;
        if (atWar(st, c, proposer)) { refused.push(c); continue; }
        if (isHuman(st, c)) {
            st.offers.push({ id: ++st.offerSeq, kind: "empire", from: proposer, to: c, deadline: st.day + OFFER_DAYS });
            asked.push(c);
            events.push({ type: "offer", day: st.day, country: c, from: proposer, what: "to join the Empire as a protectorate" });
            continue;
        }
        if (nearVictory(game, c, proposer, "protectorate")) { refused.push(c); continue; }
        if (random(st) * 100 < demandChance(game, c, proposer, "protectorate", bonus).chance) { setSubject(game, c, proposer, "protectorate", events); joined++; }
        else refused.push(c);
    }
    st.memory.empire[proposer].league = refused;
    formLeague(game, refused, events);
    events.push({ type: "empire", day: st.day, country: proposer, joined, refused: refused.length, asked: asked.length });
}

// ---------- integrating a vassal ----------

// a vassal of 10 years may be made part of its overlord's country, for the price of a courthouse a settlement, while neither
// is at war — with a country, or with its own peasants; a person's country is asked first (RULES.md §10, Integration)
export const INTEGRATE_DAYS = 15 * YEAR_DAYS;
// how long a vassal must be one before it may be integrated (RULES.md §10, Integration): 15 years, longer across faiths — × (1 + how
// far apart the two rulers' faiths are, 0 to 1: religion.js), so up to 30 years for Catholic and Sunni
export const integrateDays = (game, overlord, subject) => {
    const regard = faithRegard(game.state.countries[overlord]?.religion, game.state.countries[subject]?.religion);
    return Math.round(INTEGRATE_DAYS * (1 + Math.min(1, Math.max(0, regard / WORST_FAITH))));
};
export const integratePrice = (game, subject) => Object.values(game.state.settlements).filter((s) => s.owner === subject).length * BUILDING_PRICE.courthouse;

// why `overlord` may not integrate `subject` now, or null
export function integrateError(game, overlord, subject) {
    const st = game.state, c = st.countries[subject];
    if (!c || c.overlord !== overlord || c.subjectKind !== "vassal") return `${subject} is not your vassal`;
    const days = integrateDays(game, overlord, subject), from = (c.vassalSince ?? 0) + days;
    if (st.day < from) return `a vassal may be integrated after ${Math.round(days / YEAR_DAYS)} years: ${subject} on ${longDate(from)}`;
    // at war with a country, or with the peasants of either of the two; the peasants of another country (at war with anyone at
    // war with it: rebelWars) do not count
    const blocks = (other) => !st.countries[other]?.rebel || [overlord, subject].includes(st.countries[other].of);
    const fighting = (code) => st.wars.some((w) => { const [x, y] = w.split("|"); return (x === code || y === code) && blocks(x === code ? y : x); });
    if (fighting(overlord) || fighting(subject)) return "not while either of you is at war (or your own peasants are up in arms)";
    const price = integratePrice(game, subject);
    if (st.countries[overlord].treasury < price) return `integrating ${subject} costs ${money(price)}, and the treasury holds ${money(st.countries[overlord].treasury)}`;
    return null;
}

// the vassal becomes part of the overlord (absorb). +1 warmonger score a settlement, × the scenario's warmonger scale.
export function integrate(game, overlord, subject, events) {
    game.state.countries[overlord].treasury -= integratePrice(game, subject);
    const n = absorb(game, overlord, subject, events);
    game.state.countries[overlord].warmonger += n * game.map.warmongerScale;
    events.push({ type: "integrated", day: game.state.day, country: overlord, subject, settlements: n });
}

// one country made part of another, by integration or a union: its settlements (core for the other at once), armies, fleets,
// sharpshooters, soldiers being raised, weapons, treasury, bank, loans and research pool, and its own subjects. It is then out
// of the game — absorbed, not eliminated: nothing of it vanishes. Its agreements and the questions to it or from it end. The
// number of its settlements.
function absorb(game, overlord, subject, events) {
    const st = game.state, o = st.countries[overlord], c = st.countries[subject];
    let n = 0;
    for (const s of Object.values(st.settlements)) {
        if (s.owner !== subject) continue;
        s.owner = overlord;
        s.heldSince = st.day;
        if (!s.cores.includes(overlord)) s.cores.push(overlord);
        n++;
    }
    for (const a of armyList(st)) if (a.owner === subject) a.owner = overlord;
    for (const fl of Object.values(st.fleets)) if (fl.owner === subject) fl.owner = overlord;
    for (const p of Object.values(st.posts)) if (p.owner === subject) p.owner = overlord;
    o.training.push(...c.training);
    o.hires.push(...c.hires);
    c.training = [];
    c.hires = [];
    for (const w of Object.keys(o.reserve)) { o.reserve[w] += c.reserve[w]; c.reserve[w] = 0; }
    o.treasury += c.treasury;
    o.bank += c.bank;
    o.loans += c.loans;
    o.r += c.r;
    o.noBorrowUntil = Math.max(o.noBorrowUntil, c.noBorrowUntil);
    if (o.treasury < 0) o.debtSince = Math.min(o.debtSince ?? st.day, c.debtSince ?? st.day);
    c.treasury = c.bank = c.loans = c.r = 0;
    for (const s of subjectsOf(st, subject)) {
        const x = st.countries[s];
        x.overlord = overlord;
        x.vassalSince = x.subjectKind === "vassal" ? st.day : null;
    }
    removeAgreements(game, (x) => x.a === subject || x.b === subject);
    st.offers = st.offers.filter((x) => x.from !== subject && x.to !== subject);
    // its wars end with it: only peasants' can be left (integrateError, unionError), and the rebels' bookkeeping (events.js,
    // rebelWars) gives the country it joined the ones that are now its own — a country out of the game is at war with nobody
    for (const w of [...st.wars]) { const [x, y] = w.split("|"); if (x === subject || y === subject) closeWar(game, x, y); }
    c.out = st.day;
    c.overlord = null;
    c.subjectKind = null;
    c.vassalSince = null;
    lapseCoalitions(game, events);
    return n;
}

// ---------- a union of two people's countries ----------

// why `a` may not propose a union to `b` now (RULES.md §10, Union), or null: both played by people, neither anyone's subject,
// at peace with each other and at war with the same countries (peasant rebels aside), and not near victory together — three
// quarters of the number that wins, as for a subject (opinion.js, NEAR_VICTORY). A union may grow: a third country joins it as
// the second did (unionInto); that every one of its people agrees is the server's to see (src/game/rooms.js, consent)
export function unionError(game, a, b) {
    const st = game.state;
    if (!st.humans.includes(a) || !st.humans.includes(b)) return "a union is of two countries played by people";
    if (st.countries[a].out !== null || st.countries[b].out !== null) return "a union is of two countries still in the game";
    if (st.countries[a].overlord || st.countries[b].overlord) return "a subject cannot unite with anyone: it must be free first";
    if (atWar(st, a, b)) return "not while you are at war with each other";
    const foes = (c) => st.wars.map((w) => w.split("|")).filter((w) => w.includes(c)).map((w) => w.find((x) => x !== c)).filter((x) => !isRebel(st, x)).sort().join(",");
    if (foes(a) !== foes(b)) return "only while you are at war with the same countries, or at peace with all";
    const target = victoryOf(game)?.settlements, table = scores(st);
    if (target && (table[a]?.settlements ?? 0) + (table[b]?.settlements ?? 0) >= NEAR_VICTORY * target) return "too near victory together: what is left must be taken";
    return null;
}

// which of two countries a union keeps (RULES.md §10): one that is a union already — a newcomer joins it, whoever asked —
// else the one that proposed
export const unionInto = (st, proposer, other) => (!st.memory.unions?.includes(proposer) && st.memory.unions?.includes(other) ? other : proposer);

// `from` becomes part of `into` (absorb), at once and for nothing, its capital one of `into`'s (RULES.md §2); `into` takes both names, "Bohemia–Hungary" (a newcomer's
// added at the end), and `from`'s research too, and `from`'s wars, against the same enemies, are `into`'s already. Its person
// rules `into` with `into`'s (src/game/rooms.js). The map paints the union in its members' colours (public/js/mapdraw.js, landFill).
export function unite(game, into, from, events) {
    const st = game.state, o = st.countries[into], c = st.countries[from];
    for (const t of c.techs) if (!o.techs.includes(t)) o.techs.push(t);
    o.warmonger = Math.max(o.warmonger, c.warmonger);
    o.name = `${o.name}–${c.name}`;
    for (const w of [...st.wars]) {
        const [x, y] = w.split("|");
        if (x === from || y === from) closeWar(game, x, y);
    }
    // its capital stays a capital, `into`'s now, and so do those of the countries that joined it before — each that it holds
    const held = (id) => st.settlements[id]?.owner === from;
    const seats = [{ of: from, at: held(c.capital) ? c.capital : null }, ...(c.seats ?? []).map((x) => ({ of: x.of, at: held(x.at) ? x.at : null }))];
    const n = absorb(game, into, from, events);
    o.seats = [...(o.seats ?? []), ...seats];
    c.seats = [];
    for (const x of Object.values(st.settlements)) if (x.siege?.by === from) x.siege.by = into;     // its sieges go on, as `into`'s
    (st.memory.unions ??= []).push(into, from);
    events.push({ type: "union", day: st.day, country: into, with: from, name: o.name, settlements: n });
}

// ---------- asking a country to become a subject ----------

// a computer rolls; a refusal is remembered for 10 years
export function demandSubject(game, demander, target, kind, events) {
    const st = game.state;
    if (random(st) * 100 < subjectChance(game, target, demander, kind).chance) {
        takeSubject(game, target, demander, kind, events);
        return true;
    }
    st.memory.refused[`${target}>${demander}`] = st.day;
    events.push({ type: "refused", day: st.day, country: target, from: demander, what: `to become its ${kind}` });
    return false;
}

// may `demander` demand that `target` become its subject (RULES.md §10, Subjects): only of a neighbour of its land or of its
// subjects' — by land or across a strait, as Gotland is Sweden's — no realm across the map is made a subject by asking
const touches = (game, a, b) => bordering(game, a, b) || game.map.scenario.routes.some((r) => {
    if (r.type !== "strait") return false;
    const x = game.state.settlements[r.from]?.owner, y = game.state.settlements[r.to]?.owner;
    return (x === a && y === b) || (x === b && y === a);
});
export const withinDemandReach = (game, demander, target) => touches(game, demander, target) || subjectsOf(game.state, demander).some((s) => touches(game, s, target));

// a subject agreed to on demand: the world takes note — half what a peace's terms give an attacker (subjectWarmonger): +5 for a
// vassal, +2.5 for a protectorate or a protectorate made a vassal, or more for a large one (RULES.md §10)
export function takeSubject(game, target, demander, kind, events) {
    const st = game.state, upgrade = st.countries[target].overlord === demander;
    st.countries[demander].warmonger += subjectWarmonger(game, target, kind === "vassal" && !upgrade ? "vassal" : "protectorate", 10) * 0.5;
    setSubject(game, target, demander, kind, events);
}

// ---------- the start of a game ----------

// the wars and agreements a scenario opens with count as if declared and signed in play, with no warmonger score; its
// alliances for 20 years
export function applyStart(game) {
    const start = game.map.scenario.start ?? { wars: [], agreements: [] };
    for (const w of start.wars) for (const a of w.attackers) for (const d of w.defenders) openWar(game, a, d, a);
    const days = (x) => (x.yearsLeft ? x.yearsLeft * YEAR_DAYS : x.kind === "pact" ? PACT_DAYS : x.kind === "guarantee" ? GUARANTEE_DAYS : x.kind === "defensive" || x.kind === "military" ? START_ALLIANCE_DAYS : null);
    for (const x of start.agreements) addAgreement(game, x.kind, x.a, x.b, days(x));
    // and its subjects, subjects since the start (a vassal of the start may be integrated as one of any other)
    for (const x of start.subjects ?? []) setSubject(game, x.subject, x.overlord, x.kind, []);
}

// ---------- answering ----------

// does a computer country take up this proposal? Records that it was made (the same one once in 5 years)
export function proposalKey(from, to, kind) {
    return `${from}>${to}>${kind}`;
}
export function mayPropose(game, from, to, kind) {
    const last = game.state.memory.proposed[proposalKey(from, to, kind)];
    return last === undefined || game.state.day - last >= PROPOSAL_DAYS;
}
export function notePropose(game, from, to, kind) {
    game.state.memory.proposed[proposalKey(from, to, kind)] = game.state.day;
}

// the computer countries that border the same warmonger — and each other — propose defensive alliances to each other, never
// across faiths that regard each other at −20 or worse (RULES.md §10, Coalitions)
// a coalition's alliances lapse once the warmonger they were made against is one no more — its score fallen under 30 (checked
// at the start of the year, after the fall) — or is out of the game (RULES.md §10, Coalitions)
export function lapseCoalitions(game, events) {
    const st = game.state;
    const over = (x) => x.against && (!st.countries[x.against] || st.countries[x.against].out !== null || (st.countries[x.against].warmonger ?? 0) < 30);
    const ended = st.agreements.filter(over);
    if (!ended.length) return;
    removeAgreements(game, over);
    for (const x of ended) events.push({ type: "expired", day: st.day, kind: x.kind, a: x.a, b: x.b, against: x.against });
    evictClosed(game, events);
}

export const COALITION_FAITH = -20, COALITION_SCORE = 30;
// why `from` and `to` cannot make a coalition's alliance against `against` now, or null (RULES.md §10, Coalitions): a warmonger
// of 30 or more, neither of the two; both border it; not at war with each other, nor allied already; neither a vassal; and of
// faiths that regard each other better than −20
export function coalitionError(game, from, to, against) {
    const st = game.state, w = st.countries[against];
    if (!w || !real(st, against)) return `no country ${against}`;
    if (against === from || against === to) return "a coalition is against a third country";
    if ((w.warmonger ?? 0) < COALITION_SCORE) return `${against} is no warmonger: its score is under ${COALITION_SCORE}`;
    if (!real(st, to)) return `no country ${to}`;
    if (!bordering(game, from, against) || !bordering(game, to, against)) return `a coalition against ${against} is of countries that border it, both of you`;
    if (atWar(st, from, to)) return `you are at war with ${to}`;
    if (allied(st, from, to)) return `you and ${to} are allied already`;
    if (isVassal(st, from) || isVassal(st, to)) return "a vassal has no diplomacy";
    if (faithRegard(st.countries[from].religion, st.countries[to].religion) <= COALITION_FAITH) return `${to}'s faith and yours are too far apart for a coalition`;
    return null;
}
// a coalition's alliance signed: defensive, for as long as the warmonger is one (lapseCoalitions)
export function signCoalition(game, a, b, against, events) {
    addAgreement(game, "defensive", a, b, null, against);
    events.push({ type: "agreement", day: game.state.day, kind: "defensive", a, b, why: `against ${against}` });
}
// at the start of each year: the countries that border the same warmonger — and each other — make coalitions against it. Two computer
// countries sign at once if the one asked agrees; a computer country asks a person, a question like any proposal, once in five years
// at most; a person founds one of their own (proposeCoalition)
export function coalitions(game, events) {
    const st = game.state;
    const party = (c) => real(st, c) && !st.countries[c].overlord;
    for (const w of Object.keys(st.countries).sort()) {
        if (!real(st, w) || (st.countries[w].warmonger ?? 0) < COALITION_SCORE) continue;
        const near = neighboursOf(game, w).filter(party);
        for (const c of near) for (const d of near) {
            if (c === d || isHuman(st, c) || allied(st, c, d) || atWar(st, c, d) || !bordering(game, c, d)) continue;
            if (faithRegard(st.countries[c].religion, st.countries[d].religion) <= COALITION_FAITH) continue;
            if (isHuman(st, d)) {
                if (st.offers.some((o) => o.kind === "coalition" && o.from === c && o.to === d) || !mayPropose(game, c, d, "coalition")) continue;
                notePropose(game, c, d, "coalition");
                st.offers.push({ id: ++st.offerSeq, kind: "coalition", from: c, to: d, against: w, deadline: st.day + OFFER_DAYS });
                events.push({ type: "offer", day: st.day, country: d, from: c, what: "coalition", against: w });
            } else if (agreementAnswer(game, d, c, "defensive").accept) signCoalition(game, c, d, w, events);
        }
    }
}

