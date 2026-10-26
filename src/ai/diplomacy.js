// The computer player's diplomacy (docs/design.md, "The computer players", strategy): it asks for peace when a war has
// run its course — dictating terms when it is far ahead, buying peace when it is losing — plans and declares wars it
// should win, proposes alliances and pacts the other side will accept, demands subjects of weaker neighbours, and
// proposes the Empire when it holds enough of it. The other side's answers are the engine's pure formulas
// (opinion.js), so the computer asks only what it knows will be accepted: a proposal may be made once in five years.
//
// Rivalries (SCENARIO.md; util.js, rivalsOf) bend this: among the neighbours a country is strong enough to attack, a rival is
// the target of choice, and it is never proposed anything. They do not make it attack at worse odds or fight longer — tried,
// that turned every war between rivals into one between alliances (experiments/, 5). They are the AI's preferences, not
// rules: a rival's proposal is still answered by the engine's formula, like anyone's.
import { YEAR_DAYS, agreementAnswer, bordering, need, demandChance, hasAgreement, hreSettlementsOf, isVassal, mayPropose, militaryPowerOf, neighboursOf, overlordOf,
    peaceAnswer, sizeOf, subjectsOf, validateTerms, warJoiners, warScore } from "../engine/index.js";
import { agreementsBetween, alliesOf, friendly } from "../engine/relations.js";
import { warKey } from "../engine/state.js";
import { dice, enemiesOf, hash, ownSettlements, reachFrom, rivalsOf, stagingSettlement, thinksOn } from "./util.js";

// the most alliances (defensive and military together) a computer country seeks, or helps another to
export const ALLIANCE_CAP = 2;

const realFoes = (st, code) => enemiesOf(st, code).filter((c) => !st.countries[c].rebel);

// the terms to offer `foe` for peace, or null to fight on; `cash` is what we will have to pay with. Far ahead it asks the
// towns it can, money, the freedom of the loser's subjects, and — at least twice its size — the loser as its vassal, or else
// its protectorate; losing to a country twice its size it offers to become a protectorate before it gives up land.
function peaceTerms(game, code, foe, cash = game.state.countries[code].treasury, fl = { aggression: 0.5 }) {
    const st = game.state, info = st.warInfo[warKey(code, foe)];
    if (!info || st.day - info.start < 180) return null;
    const age = st.day - info.start, score = warScore(game, code, foe);
    // terms the rules allow (RULES.md §10, validateTerms) and the other side will take
    const ok = (terms) => !validateTerms(game, code, foe, terms) && peaceAnswer(game, foe, code, terms).accept;
    const mine = militaryPowerOf(st, code), theirs = militaryPowerOf(st, foe);
    if (score >= 20) {
        // far ahead: ask for what it will give, our cores and what lies next to us first
        const own = new Set(ownSettlements(st, code).map((s) => String(s.id)));
        const nextToUs = (s) => game.map.adj.get(String(s.id)).some((e) => own.has(e.to));
        const wanted = ownSettlements(st, foe).sort((a, b) => b.cores.includes(code) - a.cores.includes(code) || nextToUs(b) - nextToUs(a) || b.pop - a.pop || a.id - b.id);
        const terms = { take: [], give: [], money: 0, makeSubject: null, becomeSubject: null, release: [] };
        for (const s of wanted) {
            if (terms.take.length >= Math.min(6, wanted.length - 1)) break;          // a peace leaves it one settlement
            const tried = { ...terms, take: [...terms.take, s.id] };
            if (ok(tried)) terms.take = tried.take;
        }
        const cash = Math.floor(st.countries[foe].treasury * 0.35 / 1000) * 1000;
        if (cash > 0 && ok({ ...terms, money: cash })) terms.money = cash;
        // its subjects set free, the biggest first
        for (const s of subjectsOf(st, foe).sort((a, b) => sizeOf(st, b) - sizeOf(st, a) || (a < b ? -1 : 1))) {
            const tried = { ...terms, release: [...terms.release, s] };
            if (ok(tried)) terms.release = tried.release;
        }
        // the loser as our subject, if we are twice its size and minded to rule
        if (fl.aggression > 0.4 && sizeOf(st, code) >= 2 * sizeOf(st, foe)) {
            const kind = ["vassal", "protectorate"].find((k) => ok({ ...terms, makeSubject: k }));
            if (kind) terms.makeSubject = kind;
        }
        // a siege of ours that is about to pay off is worth waiting for; money alone is not worth a war that is being won
        const closing = ownSettlements(st, foe).some((s) => s.siege?.by === code && s.siege.end - st.day <= 200);
        if (closing || (!terms.take.length && !terms.makeSubject)) return age >= 2 * YEAR_DAYS && !closing ? terms : null;
        return terms;
    }
    if (score >= 0) return age >= 2 * YEAR_DAYS ? { take: [], give: [], money: 0 } : null;
    if (age < YEAR_DAYS || (mine > 0.7 * theirs && age < 3 * YEAR_DAYS)) return null;
    // losing: money first, then the settlements it can best spare
    const terms = { take: [], give: [], money: 0, makeSubject: null, becomeSubject: null, release: [] };
    const offer = Math.floor(Math.max(0, cash) * 0.5 / 1000) * 1000;
    for (const share of [0, 0.25, 0.5, 1]) {
        terms.money = -offer * share;
        if (ok(terms)) return terms;
    }
    // to a country twice our size: its protectorate, before any land
    if (sizeOf(st, foe) >= 2 * sizeOf(st, code) && ok({ ...terms, money: 0, becomeSubject: "protectorate" })) return { ...terms, money: 0, becomeSubject: "protectorate" };
    const spare = ownSettlements(st, code).sort((a, b) => a.cores.includes(code) - b.cores.includes(code) || a.pop - b.pop || a.id - b.id);
    for (const s of spare) {
        if (terms.give.length >= Math.min(6, spare.length - 1)) break;            // and leaves us one
        terms.give.push(s.id);
        if (ok(terms)) return terms;
    }
    return null;
}

// how many times stronger than a country the countries that would side with it are, with it
function sideOf(game, declarer, target) {
    const { auto, calls } = warJoiners(game, declarer, target), st = game.state;
    const power = (c) => militaryPowerOf(st, c);
    return {
        theirs: power(target) + auto.filter(([, side]) => side === "def").reduce((n, [c]) => n + power(c), 0) + calls.filter(([, , side]) => side === "def").reduce((n, [c]) => n + 0.5 * power(c), 0),
        ours: power(declarer) + auto.filter(([, side]) => side === "att").reduce((n, [c]) => n + power(c), 0) + calls.filter(([, , side]) => side === "att").reduce((n, [c]) => n + 0.5 * power(c), 0),
    };
}

// a neighbour worth attacking: weak enough, with nothing binding us to it, giving the most land next to ours
export function bestTarget(game, code, fl) {
    const st = game.state, own = new Set(ownSettlements(st, code).map((s) => String(s.id))), rivals = rivalsOf(game, code);
    let best = null;
    for (const t of neighboursOf(game, code)) {
        if (!st.countries[t] || isVassal(st, t) || overlordOf(st, code) === t || overlordOf(st, t) === code) continue;
        if (agreementsBetween(st, code, t).some((x) => ["pact", "truce", "defensive", "military"].includes(x.kind)) || hasAgreement(st, "guarantee", code, t)) continue;
        const { ours, theirs } = sideOf(game, code, t);
        if (ours < (1.5 - 0.4 * fl.aggression) * Math.max(theirs, 1)) continue;
        const gain = ownSettlements(st, t).filter((s) => game.map.adj.get(String(s.id)).some((e) => own.has(e.to))).reduce((n, s) => n + s.pop, 0);
        // how much weaker it is counts up to three times: past that, every target is crushed alike, and the land and the grudge decide
        const score = gain * (ours / Math.max(theirs, 1)) * (rivals.has(t) ? 1.5 : 1);
        if (gain > 0 && (!best || score > best.score || (score === best.score && t < best.target))) best = { target: t, score };
    }
    return best;
}

// the computer player's diplomacy for one country on one think; `memory` is the AI's: the wars it is preparing (`plans`)
// and when it last asked a human something (`asked`), since a question to a human leaves no mark in the game until
// it is answered. `cash` is the treasury once the orders of the same think that spend are applied.
export function diplomacyOrders(game, code, fl, { plans, asked }, cash = game.state.countries[code].treasury) {
    const st = game.state, c = st.countries[code], out = [], day = st.day, r = dice(hash(`${st.seed}:${code}:${day}:diplomacy`));
    const cmd = (type, rest) => out.push({ type, country: code, ...rest });
    // may it ask `to` this now: a computer once in five years (the game's rule), a human once a year and not while a question stands
    const mayAsk = (to, what) => (st.humans.includes(to)
        ? !st.offers.some((o) => o.from === code && o.to === to) && day - (asked.get(`${code}>${to}>${what}`) ?? -Infinity) >= YEAR_DAYS
        : mayPropose(game, code, to, what));
    const ask = (type, to, what, rest) => { asked.set(`${code}>${to}>${what}`, day); cmd(type, rest); };
    if (isVassal(st, code)) return { orders: out, prepare: false };
    const foes = realFoes(st, code), rivals = rivalsOf(game, code);

    // peace — but only one offer a think that makes us or the other a subject: once one is signed, the next would be refused
    let subjecting = false;
    for (const foe of foes) {
        if (isVassal(st, foe) || !mayAsk(foe, "peace")) continue;
        const terms = peaceTerms(game, code, foe, cash, fl);
        if (!terms) continue;
        const binds = Boolean(terms.makeSubject || terms.becomeSubject);
        if (binds && subjecting) continue;
        subjecting ||= binds;
        ask("proposePeace", foe, "peace", { with: foe, terms });
    }

    // war: choose a target, prepare for 40 days, declare if it is still a good idea
    const plan = plans.get(code);
    const limit = fl.aggression > 0.8 ? 2 : 1;
    const calm = foes.length < limit && c.treasury > 0 && (c.warmonger ?? 0) < 12 + 30 * fl.aggression;
    if (plan) {
        const target = st.countries[plan.target], { ours, theirs } = sideOf(game, code, plan.target);
        const valid = calm && target && target.out === null && !enemiesOf(st, code).includes(plan.target) && ours >= (1.3 - 0.4 * fl.aggression) * Math.max(theirs, 1);
        if (!valid) plans.delete(code);
        else if (day - plan.since >= 40) { plans.delete(code); cmd("declareWar", { target: plan.target }); }
    } else if (calm && r() < 0.03 + 0.1 * fl.aggression) {
        const t = bestTarget(game, code, fl);
        if (t) plans.set(code, { target: t.target, since: day });
    }

    // agreements, at most one proposal a think: a military alliance against a common enemy, then a defensive alliance
    // or a pact with a neighbour. Alliances are sought sparingly — with every country allied to every neighbour that would
    // have it, a war on anyone brought in a dozen (experiments/README.md, 6): a defensive alliance only when the country
    // feels threatened, only with a neighbour about as strong as itself or stronger, and no alliance of either kind once
    // it, or the other, has ALLIANCE_CAP of them.
    const planned = plans.get(code)?.target;
    const mine = militaryPowerOf(st, code), threatened = need(game, code) > 15;
    const roomFor = (c) => alliesOf(st, c).length < ALLIANCE_CAP;
    const neighbours = neighboursOf(game, code).filter((n) => n !== planned && !isVassal(st, n) && !foes.includes(n) && !enemiesOf(st, code).includes(n));
    const tries = [];
    if (foes.length) for (const n of Object.keys(st.countries)) if (!st.countries[n].rebel && n !== code && !isVassal(st, n) && foes.some((f) => f !== n && st.wars.includes(warKey(n, f))) && !foes.includes(n)) tries.push(["military", n]);
    // a warlike country keeps its hands free, unless it is threatened
    const wary = fl.aggression <= 0.6 || need(game, code) > 15;
    for (const n of neighbours.sort((a, b) => militaryPowerOf(st, b) - militaryPowerOf(st, a) || (a < b ? -1 : 1))) tries.push(["defensive", n], ...(wary ? [["pact", n]] : []));
    // military access, first of all, through a neighbour that borders an enemy we cannot reach otherwise
    if (foes.length) {
        const from = stagingSettlement(game, code) ?? st.settlements[c.capital];
        const reach = from ? reachFrom(game, code, String(from.id)) : new Map();
        const cut = foes.filter((f) => !Object.values(st.settlements).some((s) => s.owner === f && reach.has(String(s.id))));
        for (const n of neighbours) if (cut.some((f) => bordering(game, n, f)) && !friendly(st, code, n)) tries.unshift(["access", n]);
    }
    // a guarantee, from a friendly country, to a much weaker neighbour that borders a rival of ours: a buffer kept standing
    const given = st.agreements.filter((x) => x.kind === "guarantee" && x.a === code).length;
    if (fl.friendliness > 0.6 && given < 2) for (const n of neighbours) if (militaryPowerOf(st, n) <= 0.4 * mine && [...rivals].some((rv) => bordering(game, n, rv))) tries.push(["guarantee", n]);
    for (const [kind, n] of tries) {
        if (rivals.has(n)) continue;                                                   // never with a rival
        if ((kind === "defensive" || kind === "military") && (!roomFor(code) || !roomFor(n))) continue;
        if (kind === "defensive" && (!threatened || militaryPowerOf(st, n) < 0.8 * mine)) continue;
        if (r() > 0.3 + 0.5 * fl.friendliness) continue;
        if (hasAgreement(st, kind, code, n) || hasAgreement(st, kind, n, code) || !mayAsk(n, kind)) continue;
        if (n < code && thinksOn(n, day) && kind !== "military") continue;              // it asks us today, and its question is put first
        if (!agreementAnswer(game, n, code, kind).accept) continue;
        ask("proposeAgreement", n, kind, { with: n, kind });
        break;
    }

    // military access we give a country at war with a friend of ours (an ally, a subject, an overlord), or to a rival, ends
    const friends = Object.keys(st.countries).filter((x) => x !== code && friendly(st, code, x));
    const ungrant = st.agreements.find((x) => x.kind === "access" && x.a === code && (rivals.has(x.b) || friends.some((fr) => st.wars.includes(warKey(fr, x.b)))));
    if (ungrant) cmd("cancelAccess", { with: ungrant.b });

    // a warlike country breaks a pact with a rival it would crush, and plans the war (breaking costs it opinion, RULES.md §10)
    if (!plans.has(code) && calm && fl.aggression > 0.8 && r() < 0.1) {
        for (const rv of [...rivals].sort()) {
            const bonds = agreementsBetween(st, code, rv).map((x) => x.kind);
            if (!st.countries[rv] || st.countries[rv].out !== null || bonds.length !== 1 || bonds[0] !== "pact" || !bordering(game, code, rv)) continue;
            const { ours, theirs } = sideOf(game, code, rv);
            if (ours < 2.5 * Math.max(theirs, 1)) continue;
            cmd("breakAgreement", { with: rv, kind: "pact" });
            plans.set(code, { target: rv, since: day });
            break;
        }
    }

    // a subject from a much weaker neighbour
    if (!foes.length && fl.aggression > 0.4 && subjectsOf(st, code).length < 3 && r() < 0.15) {
        for (const n of neighbours) {
            if (overlordOf(st, n) || sizeOf(st, code) < 2 * sizeOf(st, n) || militaryPowerOf(st, code) < 2.5 * militaryPowerOf(st, n)) continue;
            const kind = ["vassal", "protectorate"].find((k) => demandChance(game, n, code, k).chance >= 35 && mayAsk(n, `demand-${k}`));
            if (kind) { ask("demandSubject", n, `demand-${kind}`, { target: n, kind }); break; }
        }
    }

    // the Empire, once
    const needed = game.map.scenario.empire?.needed;
    if (needed && !st.memory.empire[code] && hreSettlementsOf(game, code) >= needed) cmd("proposeEmpire", {});
    return { orders: out, prepare: plans.has(code) };
}
