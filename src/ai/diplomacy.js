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
import { YEAR_DAYS, agreementAnswer, need, demandChance, hasAgreement, hreSettlementsOf, isVassal, mayPropose, militaryPowerOf, neighboursOf, overlordOf,
    peaceAnswer, sizeOf, subjectsOf, warJoiners, warScore } from "../engine/index.js";
import { agreementsBetween } from "../engine/relations.js";
import { warKey } from "../engine/state.js";
import { dice, enemiesOf, hash, ownSettlements, rivalsOf, thinksOn } from "./util.js";

const realFoes = (st, code) => enemiesOf(st, code).filter((c) => !st.countries[c].rebel);

// the terms to offer `foe` for peace, or null to fight on
function peaceTerms(game, code, foe) {
    const st = game.state, info = st.warInfo[warKey(code, foe)];
    if (!info || st.day - info.start < 180) return null;
    const age = st.day - info.start, score = warScore(game, code, foe);
    const ok = (terms) => peaceAnswer(game, foe, code, terms).accept;
    const mine = militaryPowerOf(st, code), theirs = militaryPowerOf(st, foe);
    if (score >= 20) {
        // far ahead: ask for what it will give, our cores and what lies next to us first
        const own = new Set(ownSettlements(st, code).map((s) => String(s.id)));
        const nextToUs = (s) => game.map.adj.get(String(s.id)).some((e) => own.has(e.to));
        const wanted = ownSettlements(st, foe).sort((a, b) => b.cores.includes(code) - a.cores.includes(code) || nextToUs(b) - nextToUs(a) || b.pop - a.pop || a.id - b.id);
        const terms = { take: [], give: [], money: 0, makeSubject: null, becomeSubject: null, release: [] };
        for (const s of wanted) {
            if (terms.take.length >= 6) break;
            const tried = { ...terms, take: [...terms.take, s.id] };
            if (ok(tried)) terms.take = tried.take;
        }
        const cash = Math.floor(st.countries[foe].treasury * 0.35 / 1000) * 1000;
        if (cash > 0 && ok({ ...terms, money: cash })) terms.money = cash;
        // a siege of ours that is about to pay off is worth waiting for; money alone is not worth a war that is being won
        const closing = ownSettlements(st, foe).some((s) => s.siege?.by === code && s.siege.end - st.day <= 200);
        if (closing || !terms.take.length) return age >= 2 * YEAR_DAYS && !closing ? terms : null;
        return terms;
    }
    if (score >= 0) return age >= 2 * YEAR_DAYS ? { take: [], give: [], money: 0 } : null;
    if (age < YEAR_DAYS || (mine > 0.7 * theirs && age < 3 * YEAR_DAYS)) return null;
    // losing: money first, then the settlements it can best spare
    const terms = { take: [], give: [], money: 0, makeSubject: null, becomeSubject: null, release: [] };
    const cash = Math.floor(st.countries[code].treasury * 0.5 / 1000) * 1000;
    for (const share of [0, 0.25, 0.5, 1]) {
        terms.money = -cash * share;
        if (ok(terms)) return terms;
    }
    const spare = ownSettlements(st, code).sort((a, b) => a.cores.includes(code) - b.cores.includes(code) || a.pop - b.pop || a.id - b.id);
    for (const s of spare) {
        if (terms.give.length >= 6) break;
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
        const score = gain * (ours / Math.max(theirs, 1)) * (rivals.has(t) ? 3 : 1);
        if (gain > 0 && (!best || score > best.score || (score === best.score && t < best.target))) best = { target: t, score };
    }
    return best;
}

// the computer player's diplomacy for one country on one think; `memory` is the AI's: the wars it is preparing (`plans`)
// and when it last asked a human something (`asked`), since a question to a human leaves no mark in the game until
// it is answered
export function diplomacyOrders(game, code, fl, { plans, asked }) {
    const st = game.state, c = st.countries[code], out = [], day = st.day, r = dice(hash(`${st.seed}:${code}:${day}:diplomacy`));
    const cmd = (type, rest) => out.push({ type, country: code, ...rest });
    // may it ask `to` this now: a computer once in five years (the game's rule), a human once a year and not while a question stands
    const mayAsk = (to, what) => (st.humans.includes(to)
        ? !st.offers.some((o) => o.from === code && o.to === to) && day - (asked.get(`${code}>${to}>${what}`) ?? -Infinity) >= YEAR_DAYS
        : mayPropose(game, code, to, what));
    const ask = (type, to, what, rest) => { asked.set(`${code}>${to}>${what}`, day); cmd(type, rest); };
    if (isVassal(st, code)) return { orders: out, prepare: false };
    const foes = realFoes(st, code), rivals = rivalsOf(game, code);

    // peace
    for (const foe of foes) {
        if (isVassal(st, foe) || !mayAsk(foe, "peace")) continue;
        const terms = peaceTerms(game, code, foe);
        if (terms) ask("proposePeace", foe, "peace", { with: foe, terms });
    }

    // war: choose a target, prepare for 40 days, declare if it is still a good idea
    const plan = plans.get(code);
    const limit = fl.aggression > 0.8 ? 2 : 1;
    const calm = foes.length < limit && c.treasury > 0 && (c.warmonger ?? 0) < 12 + 30 * fl.aggression;
    if (plan) {
        const target = st.countries[plan.target], { ours, theirs } = sideOf(game, code, plan.target);
        const valid = calm && target && !enemiesOf(st, code).includes(plan.target) && ours >= (1.3 - 0.4 * fl.aggression) * Math.max(theirs, 1);
        if (!valid) plans.delete(code);
        else if (day - plan.since >= 40) { plans.delete(code); cmd("declareWar", { target: plan.target }); }
    } else if (calm && r() < 0.03 + 0.1 * fl.aggression) {
        const t = bestTarget(game, code, fl);
        if (t) plans.set(code, { target: t.target, since: day });
    }

    // agreements, at most one proposal a think: a military alliance against a common enemy, then a defensive alliance
    // or a pact with a neighbour
    const planned = plans.get(code)?.target;
    const neighbours = neighboursOf(game, code).filter((n) => n !== planned && !isVassal(st, n) && !foes.includes(n) && !enemiesOf(st, code).includes(n));
    const tries = [];
    if (foes.length) for (const n of Object.keys(st.countries)) if (!st.countries[n].rebel && n !== code && !isVassal(st, n) && foes.some((f) => f !== n && st.wars.includes(warKey(n, f))) && !foes.includes(n)) tries.push(["military", n]);
    // a warlike country keeps its hands free, unless it is threatened
    const wary = fl.aggression <= 0.6 || need(game, code) > 15;
    for (const n of neighbours.sort((a, b) => militaryPowerOf(st, b) - militaryPowerOf(st, a) || (a < b ? -1 : 1))) tries.push(["defensive", n], ...(wary ? [["pact", n]] : []));
    for (const [kind, n] of tries) {
        if (rivals.has(n)) continue;                                                   // never with a rival
        if (r() > 0.3 + 0.5 * fl.friendliness) continue;
        if (hasAgreement(st, kind, code, n) || hasAgreement(st, kind, n, code) || !mayAsk(n, kind)) continue;
        if (n < code && thinksOn(n, day) && kind !== "military") continue;              // it asks us today, and its question is put first
        if (!agreementAnswer(game, n, code, kind).accept) continue;
        ask("proposeAgreement", n, kind, { with: n, kind });
        break;
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
