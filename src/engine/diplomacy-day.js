// Diplomacy's daily and yearly steps: agreements that run out, questions a human did not answer in time, subjects
// that grow strong enough to break free, and on 1 January the warmonger score falling and coalitions forming
// (RULES.md §10).
import { YEAR_DAYS } from "./calendar.js";
import { callStands, coalitions, evictClosed, formLeague, freeSubject, joinWar, lapseCoalitions, removeAgreements } from "./diplomacy.js";
import { militaryPowerOf } from "./opinion.js";
import { atWar, isRebel } from "./state.js";

const commonEnemy = (st, a, b) => Object.keys(st.countries).some((c) => atWar(st, a, c) && atWar(st, b, c));

export function diplomacyDay(game, events) {
    const st = game.state;
    // pacts, truces and alliances run out — an alliance only once the two are no longer at war with a common enemy: one whose
    // term ends in a shared war lasts until that war is over (RULES.md §10). Allies' armies in land now closed go home.
    const fighting = (x) => (x.kind === "defensive" || x.kind === "military") && commonEnemy(st, x.a, x.b);
    const ended = st.agreements.filter((x) => x.until !== null && x.until <= st.day && !fighting(x));
    if (ended.length) {
        removeAgreements(game, (x) => ended.includes(x));
        for (const x of ended) events.push({ type: "expired", day: st.day, kind: x.kind, a: x.a, b: x.b });
        if (ended.some((x) => x.kind === "defensive" || x.kind === "military")) evictClosed(game, events);
    }
    // a question a human did not answer: a call to arms is answered with a yes; the rest lapse (and a refused Empire is
    // a refusal)
    const due = st.offers.filter((o) => o.deadline <= st.day);
    if (due.length) {
        st.offers = st.offers.filter((o) => !due.includes(o));
        for (const o of due) {
            if (o.kind === "call" && callStands(game, o)) joinWar(game, o.to, o.side, o.from, o.enemy, events);
            else if (o.kind === "empire") refuseEmpire(game, o, events);
            events.push({ type: "lapsed", day: st.day, country: o.to, from: o.from, kind: o.kind });
        }
    }
    // a subject whose military power is greater than its overlord's breaks free
    for (const code of Object.keys(st.countries)) {
        const c = st.countries[code];
        if (!c.overlord || isRebel(st, code)) continue;
        if (militaryPowerOf(st, code) > militaryPowerOf(st, c.overlord)) freeSubject(game, code, events);
    }
    if (st.day % YEAR_DAYS === 0) {
        for (const c of Object.values(st.countries)) if (!c.rebel) c.warmonger = Math.max(0, c.warmonger - 2);
        lapseCoalitions(game, events);
        coalitions(game, events);
    }
}

// a human state that refuses the Empire joins the others that did in the League
export function refuseEmpire(game, offer, events) {
    const memory = game.state.memory.empire[offer.from];
    if (!memory) return;
    memory.league.push(offer.to);
    formLeague(game, memory.league, events);
}

