// The commands of diplomacy (design.md §3; RULES.md §10). A proposal to a computer country is answered at once by the
// formulas of opinion.js; to a human it becomes a question waiting for an answer for 6 months. Each handler is given
// the game and the command, whose `country` is the one giving it.
//
//   declareWar { target }
//   proposePeace { with, terms: { take, give, money, makeSubject, becomeSubject, release } }
//   proposeAgreement { with, kind: "defensive" | "military" | "guarantee" | "pact" | "access" }
//       guarantee: you guarantee them; access: they give you military access
//   breakAgreement { with, kind: "defensive" | "military" | "guarantee" | "pact" | "truce" }   cancelAccess { with }
//   demandSubject { target, kind: "vassal" | "protectorate" }   proposeEmpire {}   integrate { target }   a vassal of 10 years
//   answerOffer { id, accept }       a call to arms, or anything a human was asked
import { done, refuse } from "./command-util.js";
import { OFFER_DAYS, addAgreement, callStands, declareWar, demandSubject, evictClosed, hreSettlementsOf, integrate, integrateError, makePeace, mayPropose, notePropose, proposeEmpire, removeAgreements, punishBreak,
    setSubject, validateTerms, joinWar, PACT_DAYS } from "./diplomacy.js";
import { refuseEmpire } from "./diplomacy-day.js";
import { agreementAnswer, peaceAnswer } from "./opinion.js";
import { hasAgreement, isVassal, overlordOf, wouldCycle } from "./relations.js";
import { atWar, isRebel } from "./state.js";

const KINDS = ["defensive", "military", "guarantee", "pact", "access"];
const isHuman = (st, c) => st.humans.includes(c);

// the other country of a command, if it is a real country that is not the giver and has its own diplomacy
function other(game, cmd, code) {
    const st = game.state;
    if (!st.countries[code]) return { error: `no country ${code}` };
    if (code === cmd.country) return { error: "that is your own country" };
    if (isRebel(st, code)) return { error: "peasants are always at war with their country, and nothing else" };
    if (st.countries[code].out !== null) return { error: `${code} is no more` };
    return { c: code };
}
// a question to a person — one of each kind (and agreement) from the same country at a time: a new peace offer replaces the
// one still waiting, anything else is refused until it is answered or lapses (asking: below)
const ask = (game, kind, from, to, extra) => {
    const st = game.state;
    if (kind === "peace") st.offers = st.offers.filter((o) => !(o.kind === "peace" && o.from === from && o.to === to));
    st.offers.push({ id: ++st.offerSeq, kind, from, to, ...extra, deadline: st.day + OFFER_DAYS });
    return { type: "offer", day: st.day, country: to, from, what: kind };
};

const waiting = (st, kind, from, to, extra = {}) => st.offers.some((o) => o.kind === kind && o.from === from && o.to === to && Object.entries(extra).every(([k, v]) => o[k] === v));
const asking = (game, kind, from, to, extra = {}, same = {}) => (kind !== "peace" && waiting(game.state, kind, from, to, same)
    ? refuse(`you have asked ${to} already: it has 6 months to answer`) : done([ask(game, kind, from, to, extra)]));

function agreementError(game, cmd, to, kind) {
    const st = game.state;
    if (!KINDS.includes(kind)) return `no agreement ${kind}`;
    if (atWar(st, cmd.country, to)) return `you are at war with ${to}`;
    if (isVassal(st, to)) return `${to} is a vassal: it has no diplomacy`;
    const [a, b] = kind === "access" ? [to, cmd.country] : [cmd.country, to];
    if (hasAgreement(st, kind, a, b)) return `${kind === "pact" ? "a pact" : `that ${kind}`} already stands`;
    return null;
}

// the agreement signed
function sign(game, kind, from, to, events) {
    const st = game.state;
    const [a, b] = kind === "access" ? [to, from] : [from, to];
    addAgreement(game, kind, a, b, kind === "pact" ? PACT_DAYS : null);
    events.push({ type: "agreement", day: st.day, kind, a, b });
}

export const diplomacyCommands = {
    declareWar(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.target);
        if (error) return refuse(error);
        if (atWar(st, cmd.country, c)) return refuse(`${cmd.country} is already at war with ${c}`);
        if (overlordOf(st, cmd.country) === c || overlordOf(st, c) === cmd.country) return refuse("a subject and its overlord do not make war on each other: it breaks free instead");
        if (isVassal(st, c)) return refuse(`${c} is a vassal of ${overlordOf(st, c)}: its overlord answers for it — declare war on ${overlordOf(st, c)}`);
        const events = [];
        declareWar(game, cmd.country, c, events);
        return done(events);
    },

    proposePeace(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.with);
        if (error) return refuse(error);
        if (!atWar(st, cmd.country, c)) return refuse(`you are not at war with ${c}`);
        if (isVassal(st, c)) return refuse(`${c} is a vassal: treat with its overlord`);
        const terms = { take: cmd.terms?.take ?? [], give: cmd.terms?.give ?? [], money: cmd.terms?.money ?? 0, makeSubject: cmd.terms?.makeSubject ?? null, becomeSubject: cmd.terms?.becomeSubject ?? null, release: cmd.terms?.release ?? [] };
        const bad = validateTerms(game, cmd.country, c, terms);
        if (bad) return refuse(bad);
        const events = [];
        if (isHuman(st, c)) return asking(game, "peace", cmd.country, c, { terms });
        if (!mayPropose(game, cmd.country, c, "peace")) return refuse(`you asked ${c} for peace less than 5 years ago`);
        notePropose(game, cmd.country, c, "peace");
        const a = peaceAnswer(game, c, cmd.country, terms);
        events.push({ type: "answer", day: st.day, country: c, from: cmd.country, what: "peace", accepted: a.accept, score: Math.round(a.score * 10) / 10, cost: Math.round(a.cost * 10) / 10 });
        if (a.accept) makePeace(game, cmd.country, c, terms, events);
        return done(events);
    },

    proposeAgreement(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.with);
        if (error) return refuse(error);
        const bad = agreementError(game, cmd, c, cmd.kind);
        if (bad) return refuse(bad);
        if (isHuman(st, c)) return asking(game, "agreement", cmd.country, c, { agreement: cmd.kind }, { agreement: cmd.kind });
        if (!mayPropose(game, cmd.country, c, cmd.kind)) return refuse(`you proposed that to ${c} less than 5 years ago`);
        notePropose(game, cmd.country, c, cmd.kind);
        const a = agreementAnswer(game, c, cmd.country, cmd.kind), events = [];
        events.push({ type: "answer", day: st.day, country: c, from: cmd.country, what: cmd.kind, accepted: a.accept, opinion: a.opinion, need: a.need, bar: a.bar });
        if (a.accept) sign(game, cmd.kind, cmd.country, c, events);
        return done(events);
    },

    breakAgreement(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.with);
        if (error) return refuse(error);
        const kind = cmd.kind;
        if (!["defensive", "military", "guarantee", "pact", "truce"].includes(kind)) return refuse(`no agreement ${kind} to break`);
        const mine = (x) => x.kind === kind && (kind === "guarantee" ? x.a === cmd.country && x.b === c : (x.a === cmd.country && x.b === c) || (x.a === c && x.b === cmd.country));
        if (!st.agreements.some(mine)) return refuse(`there is no such ${kind} between you and ${c}`);
        removeAgreements(game, mine);
        const events = [{ type: "ended", day: st.day, country: cmd.country, with: c, kind }];
        punishBreak(game, cmd.country, events);
        evictClosed(game, events);
        return done(events);
    },

    // the country that gives military access may cancel at any time; that is not breaking an agreement
    cancelAccess(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.with);
        if (error) return refuse(error);
        if (!hasAgreement(st, "access", cmd.country, c)) return refuse(`you give ${c} no military access`);
        removeAgreements(game, (x) => x.kind === "access" && x.a === cmd.country && x.b === c);
        const events = [{ type: "ended", day: st.day, country: cmd.country, with: c, kind: "access" }];
        evictClosed(game, events);
        return done(events);
    },

    demandSubject(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.target);
        if (error) return refuse(error);
        if (!["vassal", "protectorate"].includes(cmd.kind)) return refuse("ask for a vassal or a protectorate");
        if (atWar(st, cmd.country, c)) return refuse(`you cannot demand this of ${c} while at war: make it a term of the peace`);
        const upgrade = overlordOf(st, c) === cmd.country && st.countries[c].subjectKind === "protectorate" && cmd.kind === "vassal";
        if (overlordOf(st, c) && !upgrade) return refuse(`${c} is already ${overlordOf(st, c) === cmd.country ? "your subject" : "a subject"}`);
        if (wouldCycle(st, c, cmd.country)) return refuse(`${cmd.country} is itself a subject of ${c}'s side: there can be no ring of overlords`);
        const events = [];
        if (isHuman(st, c)) return asking(game, "demand", cmd.country, c, { subject: cmd.kind }, { subject: cmd.kind });
        if (!mayPropose(game, cmd.country, c, `demand-${cmd.kind}`)) return refuse(`you asked ${c} for that less than 5 years ago`);
        notePropose(game, cmd.country, c, `demand-${cmd.kind}`);
        // a refusal is already an event of its own
        if (demandSubject(game, cmd.country, c, cmd.kind, events)) events.push({ type: "answer", day: st.day, country: c, from: cmd.country, what: `to become its ${cmd.kind}`, accepted: true });
        return done(events);
    },

    proposeEmpire(game, cmd) {
        const st = game.state, needed = game.map.scenario.empire?.needed;
        if (!needed) return refuse("this scenario has no plain proposal of the Empire");
        if (st.memory.empire[cmd.country]) return refuse("you may propose the Empire only once, ever");
        const held = hreSettlementsOf(game, cmd.country);
        if (held < needed) return refuse(`you must control at least ${needed} settlements inside the Empire; you hold ${held}`);
        const events = [];
        proposeEmpire(game, cmd.country, events);
        return done(events);
    },

    // a vassal of 10 years becomes part of its overlord's country (RULES.md §10, Integration): a computer's vassal has no say, a
    // person's is asked — and the conditions must still hold when they say yes
    integrate(game, cmd) {
        const st = game.state, { c, error } = other(game, cmd, cmd.target);
        if (error) return refuse(error);
        const why = integrateError(game, cmd.country, c);
        if (why) return refuse(why);
        if (isHuman(st, c)) {
            if (st.offers.some((o) => o.kind === "integrate" && o.from === cmd.country && o.to === c)) return refuse(`you have asked ${c} already: it has 6 months to answer`);
            return done([ask(game, "integrate", cmd.country, c)]);
        }
        const events = [];
        integrate(game, cmd.country, c, events);
        return done(events);
    },

    // a human's answer to a question: a call to arms, a proposal, a demand, the Empire, integration
    answerOffer(game, cmd) {
        const st = game.state, offer = st.offers.find((o) => o.id === cmd.id);
        if (!offer) return refuse(`no question ${cmd.id}`);
        if (offer.to !== cmd.country) return refuse("that question was not put to you");
        st.offers = st.offers.filter((o) => o !== offer);
        const events = [], accept = Boolean(cmd.accept);
        events.push({ type: "answer", day: st.day, country: offer.to, from: offer.from, what: offer.kind === "agreement" ? offer.agreement : offer.kind, accepted: accept });
        if (offer.kind === "call") {
            if (accept) { if (callStands(game, offer)) joinWar(game, offer.to, offer.side, offer.from, offer.enemy, events); }
            else {
                removeAgreements(game, (x) => x.kind === "military" && ((x.a === offer.to && x.b === offer.from) || (x.a === offer.from && x.b === offer.to)));
                events.push({ type: "ended", day: st.day, country: offer.to, with: offer.from, kind: "military" });
                evictClosed(game, events);
            }
        } else if (offer.kind === "agreement") {
            if (accept && !isVassal(st, offer.from) && !agreementError(game, { country: offer.from }, offer.to, offer.agreement)) sign(game, offer.agreement, offer.from, offer.to, events);
        } else if (offer.kind === "peace") {
            if (accept && atWar(st, offer.from, offer.to) && !isVassal(st, offer.from) && !isVassal(st, offer.to) && !validateTerms(game, offer.from, offer.to, offer.terms)) makePeace(game, offer.from, offer.to, offer.terms, events);
        } else if (offer.kind === "demand") {
            // at war with the demander by now: a yes would end the war with no peace — it counts as a refusal
            if (accept && atWar(st, offer.to, offer.from)) st.memory.refused[`${offer.to}>${offer.from}`] = st.day;
            else if (accept && !(overlordOf(st, offer.to) && offer.subject === "protectorate")) setSubject(game, offer.to, offer.from, offer.subject, events);
            else if (!accept) st.memory.refused[`${offer.to}>${offer.from}`] = st.day;
        } else if (offer.kind === "integrate") {
            if (accept && !integrateError(game, offer.from, offer.to)) integrate(game, offer.from, offer.to, events);
        } else if (offer.kind === "empire") {
            // one that has become someone's subject since it was asked has nothing to give: its yes changes nothing; one at
            // war with the proposer by now cannot end the war by it: its yes counts as a refusal, and it joins the League
            if (accept && atWar(st, offer.to, offer.from)) refuseEmpire(game, offer, events);
            else if (accept) { if (!st.countries[offer.to].overlord) setSubject(game, offer.to, offer.from, "protectorate", events); }
            else refuseEmpire(game, offer, events);
        }
        return done(events);
    },
};
