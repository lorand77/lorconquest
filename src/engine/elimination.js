// A country with no settlement left is out of the game (RULES.md §10, Elimination). It is checked at the end of every day and
// of every command — not at each capture, so that a peace taking several settlements is signed whole first — and the country
// is then gone from the board: its armies and fleets vanish with every man in them, its queued training and hires with them,
// its wars end (with no truce: there is no one left to keep one), its agreements and the questions to and from it lapse, its
// subjects are free and it is nobody's subject. Its record stays, marked `out` with the day, so that events, scores, replays
// and the leaderboard can still name it; it gives no orders again. Peasant rebels are not countries in this sense: they hold
// no land of their own to begin with.
import { closeWar, freeSubject, lapseCoalitions, removeAgreements } from "./diplomacy.js";
import { settle } from "./fighting.js";
import { subjectsOf } from "./relations.js";
import { armyList, fleetList, isRebel, removeArmy } from "./state.js";

export function eliminations(game, events) {
    const st = game.state, owners = new Set(Object.values(st.settlements).map((s) => s.owner));
    for (const code of Object.keys(st.countries).sort()) {
        const c = st.countries[code];
        if (c.out !== null || isRebel(st, code) || owners.has(code)) continue;
        eliminate(game, code, events);
    }
}

function eliminate(game, code, events) {
    const st = game.state, c = st.countries[code], places = new Set();
    c.out = st.day;
    for (const a of armyList(st)) {
        if (a.owner !== code) continue;
        if (a.at) places.add(a.at);
        removeArmy(st, a);
    }
    for (const f of fleetList(st)) if (f.owner === code) delete st.fleets[f.id];
    c.training = [];
    c.hires = [];
    for (const w of [...st.wars]) {
        const [x, y] = w.split("|");
        if (x === code || y === code) closeWar(game, x, y);
    }
    removeAgreements(game, (x) => x.a === code || x.b === code);
    lapseCoalitions(game, events);                           // the coalitions against it have nothing left to stand against
    for (const s of subjectsOf(st, code)) freeSubject(game, s, events);
    c.overlord = null;
    c.subjectKind = null;
    c.vassalSince = null;
    st.offers = st.offers.filter((o) => o.from !== code && o.to !== code);
    events.push({ type: "eliminated", day: st.day, country: code });
    // a siege its armies held is lifted, a settlement they defended for a friend may fall
    for (const key of [...places].sort()) settle(game, key, events);
}
