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
import { retreat } from "./movement.js";
import { agreementAnswer, demandChance, neighboursOf } from "./opinion.js";
import { random } from "./random.js";
import { agreementsBetween, alliesOf, guarantorsOf, hasAgreement, isVassal, overlordOf, subjectsOf, wouldCycle } from "./relations.js";
import { armyList, atWar, canEnter, isRebel, warKey } from "./state.js";

export const OFFER_DAYS = Math.round(6 * 365 / 12);     // a human has 6 months to answer
export const TRUCE_DAYS = 5 * YEAR_DAYS;
export const PACT_DAYS = 10 * YEAR_DAYS;
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
    st.warInfo[key] = { start: st.day, attacker, startPop: { [a]: popOf(st, a), [b]: popOf(st, b) }, taken: { [a]: 0, [b]: 0 }, gained: {} };
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
export function punishBreak(game, code, events) {
    const st = game.state;
    removeAgreements(game, (x) => (x.kind === "defensive" || x.kind === "military") && (x.a === code || x.b === code));
    st.memory.broke[code] = st.day;
    events.push({ type: "broke", day: st.day, country: code });
}

// armies standing in land that has closed to them go home (RULES.md §10)
export function evictClosed(game, events) {
    const st = game.state;
    for (const a of armyList(st)) {
        if (a.retreating) continue;
        const key = a.at ?? a.march.to;
        if (!canEnter(game, a.owner, key)) retreat(game, a, events);
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
        removeAgreements(game, (x) => x.a === subject || x.b === subject);
        for (const w of [...st.wars]) {
            const [x, y] = w.split("|");
            if (x !== overlord && y !== overlord) continue;
            const enemy = x === overlord ? y : x;
            if (enemy !== subject && real(st, enemy) && !atWar(st, subject, enemy)) openWar(game, subject, enemy, st.warInfo[w]?.attacker === overlord ? subject : enemy);
        }
    }
    events.push({ type: "subject", day: st.day, country: subject, overlord, kind });
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
    for (const c of [...new Set([...alliesOf(st, target).filter((x) => hasAgreement(st, "defensive", target, x)), ...guarantorsOf(st, target)])].sort()) add(auto, c, [c, "def"], "def");
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
        punishBreak(game, a, events);
    }
    removeAgreements(game, (x) => (x.kind === "access" && x.a === b && x.b === a) || (x.kind === "access" && x.a === a && x.b === b));
    openWar(game, a, b, a);
    st.countries[a].warmonger += 5;
    events.push({ type: "war", day: st.day, country: a, target: b });
    const { auto, calls } = warJoiners(game, a, b);
    for (const [c, side] of auto) joinWar(game, c, side, side === "att" ? a : b, side === "att" ? b : a, events);
    for (const [c, caller, side] of calls) call(game, c, caller, side, a, b, events);
    evictClosed(game, events);
}

// ---------- peace ----------

// peace terms: { take: [settlements of the other], give: [of mine], money: + to me, − to the other, makeSubject: the other
// becomes my "vassal" | "protectorate", becomeSubject: I become the other's, release: [subjects of the other freed] }
export function validateTerms(game, mine, other, terms) {
    const st = game.state, t = terms ?? {};
    // lists, each naming a thing once: a settlement given twice would count twice in the price (opinion.js, peaceCost)
    for (const key of ["take", "give", "release"]) {
        if (t[key] === undefined || t[key] === null) continue;
        if (!Array.isArray(t[key])) return `${key} is a list`;
        if (new Set(t[key]).size !== t[key].length) return `${key} names something twice`;
    }
    for (const [key, owner] of [["take", other], ["give", mine]]) {
        for (const id of t[key] ?? []) if (st.settlements[id]?.owner !== owner) return `${id} is not ${owner}'s`;
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
    // a subject has one overlord, and there is no ring of them
    if (t.makeSubject && ((overlordOf(st, other) && overlordOf(st, other) !== mine) || wouldCycle(st, other, mine))) return `${other} cannot become your subject`;
    if (t.becomeSubject && ((overlordOf(st, mine) && overlordOf(st, mine) !== other) || wouldCycle(st, mine, other))) return "you cannot become its subject";
    return null;
}

// the warmonger score at a peace (RULES.md §10): +1 per 1,000 people of each settlement held that was taken in the war or
// given in the peace — half on the defending side — unless it was one's own core; +10/+5 for a vassal made, +5/+2.5 for a protectorate
function scoreWarmongers(game, a, b, info, terms, gainer) {
    const st = game.state;
    const credit = (country, points) => { st.countries[country].warmonger += points; };
    const side = (c) => (info.attacker === c ? 1 : 0.5);
    for (const [id, taker] of Object.entries({ ...info.gained, ...gainer })) {
        const s = st.settlements[id];
        if (s.owner !== taker || (taker !== a && taker !== b) || s.cores.includes(taker)) continue;
        credit(taker, s.pop / 1000 * side(taker));
    }
    if (terms.makeSubject) credit(terms.who, { vassal: 10, protectorate: 5 }[terms.makeSubject] * side(terms.who));
    if (terms.becomeSubject) credit(terms.other, { vassal: 10, protectorate: 5 }[terms.becomeSubject] * side(terms.other));
}

// sign a peace between `mine` (who proposed) and `other` with the terms; both have agreed (RULES.md §10)
export function makePeace(game, mine, other, terms, events) {
    const st = game.state, t = terms ?? {}, info = st.warInfo[warKey(mine, other)];
    const gained = {};
    for (const id of t.take ?? []) { capture(game, st.settlements[id], mine, events, "peace"); gained[id] = mine; }
    for (const id of t.give ?? []) { capture(game, st.settlements[id], other, events, "peace"); gained[id] = other; }
    if (t.money) { st.countries[other].treasury -= t.money; st.countries[mine].treasury += t.money; }
    for (const c of t.release ?? []) freeSubject(game, c, events);
    // the wars between the two, and between their vassals, end
    const sides = (c) => [c, ...subjectsOf(st, c).filter((x) => isVassal(st, x))];
    for (const x of sides(mine)) for (const y of sides(other)) if (atWar(st, x, y)) closeWar(game, x, y);
    if (info) scoreWarmongers(game, mine, other, info, { ...t, who: mine, other }, gained);
    if (t.makeSubject) setSubject(game, other, mine, t.makeSubject, events);
    if (t.becomeSubject) setSubject(game, mine, other, t.becomeSubject, events);
    addAgreement(game, "truce", mine, other, TRUCE_DAYS);
    events.push({ type: "peace", day: st.day, country: mine, with: other, terms: t });
    evictClosed(game, events);
}

// ---------- the Empire ----------

// the German states: every country that holds an HRE settlement
export function germanStates(game) {
    const st = game.state, hre = new Set(game.map.scenario.settlements.filter((s) => s.hre).map((s) => s.id));
    return Object.keys(st.countries).sort().filter((c) => real(st, c) && Object.values(st.settlements).some((s) => s.owner === c && hre.has(s.id)));
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
// those that refuse form the League. Humans are asked.
export function proposeEmpire(game, proposer, events) {
    const st = game.state, refused = [], asked = [];
    st.memory.empire[proposer] = { league: [] };
    for (const c of germanStates(game)) {
        if (c === proposer || st.countries[c].overlord || wouldCycle(st, c, proposer)) continue;
        if (isHuman(st, c)) {
            st.offers.push({ id: ++st.offerSeq, kind: "empire", from: proposer, to: c, deadline: st.day + OFFER_DAYS });
            asked.push(c);
            events.push({ type: "offer", day: st.day, country: c, from: proposer, what: "to join the Empire as a protectorate" });
            continue;
        }
        if (random(st) * 100 < demandChance(game, c, proposer, "protectorate").chance) setSubject(game, c, proposer, "protectorate", events);
        else refused.push(c);
    }
    st.memory.empire[proposer].league = refused;
    formLeague(game, refused, events);
    events.push({ type: "empire", day: st.day, country: proposer, joined: germanStates(game).filter((c) => st.countries[c].overlord === proposer).length, refused: refused.length, asked: asked.length });
}

// ---------- integrating a vassal ----------

// a vassal of 10 years may be made part of its overlord's country, for the price of a courthouse a settlement, while neither
// is at war (peasants included); a person's country is asked first (RULES.md §10, Integration)
export const INTEGRATE_DAYS = 10 * YEAR_DAYS;
export const integratePrice = (game, subject) => Object.values(game.state.settlements).filter((s) => s.owner === subject).length * BUILDING_PRICE.courthouse;

// why `overlord` may not integrate `subject` now, or null
export function integrateError(game, overlord, subject) {
    const st = game.state, c = st.countries[subject];
    if (!c || c.overlord !== overlord || c.subjectKind !== "vassal") return `${subject} is not your vassal`;
    const from = (c.vassalSince ?? 0) + INTEGRATE_DAYS;
    if (st.day < from) return `a vassal may be integrated after 10 years: ${subject} on ${longDate(from)}`;
    const fighting = (code) => st.wars.some((w) => w.split("|").includes(code));
    if (fighting(overlord) || fighting(subject)) return "not while either of you is at war";
    const price = integratePrice(game, subject);
    if (st.countries[overlord].treasury < price) return `integrating ${subject} costs ${money(price)}, and the treasury holds ${money(st.countries[overlord].treasury)}`;
    return null;
}

// the vassal becomes part of the overlord: its settlements (core for the overlord at once), armies, fleets, sharpshooters,
// soldiers being raised, weapons, treasury, bank, loans and research pool, and its own subjects. It is then out of the game
// — integrated, not eliminated: nothing of it vanishes, and it has no wars to end. +1 warmonger score a settlement.
export function integrate(game, overlord, subject, events) {
    const st = game.state, o = st.countries[overlord], c = st.countries[subject];
    o.treasury -= integratePrice(game, subject);
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
    c.out = st.day;
    c.overlord = null;
    c.subjectKind = null;
    c.vassalSince = null;
    lapseCoalitions(game, events);
    o.warmonger += n;
    events.push({ type: "integrated", day: st.day, country: overlord, subject, settlements: n });
}

// ---------- asking a country to become a subject ----------

// a computer rolls; a refusal is remembered for 10 years
export function demandSubject(game, demander, target, kind, events) {
    const st = game.state;
    if (random(st) * 100 < demandChance(game, target, demander, kind).chance) {
        setSubject(game, target, demander, kind, events);
        return true;
    }
    st.memory.refused[`${target}>${demander}`] = st.day;
    events.push({ type: "refused", day: st.day, country: target, from: demander, what: `to become its ${kind}` });
    return false;
}

// ---------- the start of a game ----------

// the wars and agreements a scenario opens with count as if declared and signed in play, with no warmonger score
export function applyStart(game) {
    const start = game.map.scenario.start ?? { wars: [], agreements: [] };
    for (const w of start.wars) for (const a of w.attackers) for (const d of w.defenders) openWar(game, a, d, a);
    for (const x of start.agreements) addAgreement(game, x.kind, x.a, x.b, x.yearsLeft ? x.yearsLeft * YEAR_DAYS : x.kind === "pact" ? PACT_DAYS : null);
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

// the computer countries that border the same warmonger propose defensive alliances to each other (RULES.md §10)
// a coalition's alliances lapse once the warmonger they were made against is one no more — its score fallen under 30 (checked
// at the start of the year, after the fall) — or is out of the game (RULES.md §10, Coalitions)
export function lapseCoalitions(game, events) {
    const st = game.state;
    const over = (x) => x.against && (!st.countries[x.against] || st.countries[x.against].out !== null || (st.countries[x.against].warmonger ?? 0) < 30);
    const ended = st.agreements.filter(over);
    if (!ended.length) return;
    removeAgreements(game, over);
    for (const x of ended) events.push({ type: "expired", day: st.day, kind: x.kind, a: x.a, b: x.b, against: x.against });
}

export function coalitions(game, events) {
    const st = game.state;
    const computer = (c) => real(st, c) && !isHuman(st, c) && !st.countries[c].overlord;
    for (const w of Object.keys(st.countries).sort()) {
        if (!real(st, w) || (st.countries[w].warmonger ?? 0) < 30) continue;
        const near = neighboursOf(game, w).filter(computer);
        for (const c of near) for (const d of near) {
            if (c === d || allied(st, c, d) || atWar(st, c, d)) continue;
            if (agreementAnswer(game, d, c, "defensive").accept) {
                addAgreement(game, "defensive", c, d, null, w);
                events.push({ type: "agreement", day: st.day, kind: "defensive", a: c, b: d, why: `against ${w}` });
            }
        }
    }
}

