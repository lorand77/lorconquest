// Random events and peasant rebels (RULES.md §11). On 1 January every country rolls for a good harvest (10%,
// +10% money that year), a plague (5%, −10% of its people) and an uprising ((average tax − 2)² × 25%). An uprising
// is a country of its own — "REB1", at war with the country it rose against for ever — with soldiers equal to 3% of
// that country's people, armed with swords, outside its capital. They are its own people: they pay no tax while
// under arms, their dead are lost from its population, and survivors with nowhere to fall back scatter home.
//
// The rebels' behaviour is a rule, not a player's choice: every 10 days each idle rebel army marches on a
// settlement of its country — undefended ones first, then core ones, then the nearest. It uses no dice, so it
// needs no logging and replays exactly.

import { emptyMen } from "./army.js";
import { YEAR_DAYS } from "./calendar.js";
import { ownedBy, plague, popOf } from "./economy.js";
import { settle } from "./fighting.js";
import { follow, routeFor } from "./movement.js";
import { random } from "./random.js";
import { armiesAt, armyList, isCore, isRebel, newArmy, warKey } from "./state.js";

export function yearly(game, events) {
    const st = game.state;
    for (const code of Object.keys(st.countries).sort()) {
        if (isRebel(st, code)) continue;
        const c = st.countries[code];
        // three rolls a year, always, so what one country rolls never changes what the next does
        const harvest = random(st), sick = random(st), rise = random(st);
        c.harvest = harvest < 0.10;
        if (c.harvest) events.push({ type: "harvest", day: st.day, country: code });
        if (sick < 0.05) plague(game, code, 0.10, events);
        const average = c.taxSum / YEAR_DAYS;
        c.taxSum = 0;
        if (rise < (average - 2) ** 2 * 0.25) uprising(game, code, events);
    }
}

// rebels rise outside the capital, or if it is lost in the largest settlement the country has
export function uprising(game, code, events) {
    const st = game.state, c = st.countries[code], owned = ownedBy(st, code);
    if (!owned.length) return;
    const home = st.settlements[c.capital]?.owner === code ? st.settlements[c.capital] : [...owned].sort((a, b) => b.pop - a.pop || a.id - b.id)[0];
    const n = Math.round(0.03 * popOf(st, code));
    const rebel = `REB${++st.rebels}`;
    st.countries[rebel] = { code: rebel, name: `Rebels of ${c.name}`, capital: null, rebel: true, of: code, treasury: 0 };
    st.wars.push(warKey(rebel, code));
    st.wars.sort();
    const men = emptyMen();
    men.swords = n;
    const army = newArmy(st, rebel, String(home.id), men);
    events.push({ type: "uprising", day: st.day, country: code, rebels: rebel, army: army.id, men: n, at: home.id });
    settle(game, String(home.id), events);
}

// every 10 days: idle rebel armies pick a settlement to march on
export function rebelOrders(game, events) {
    const st = game.state;
    if (st.day % 10) return;
    for (const code of Object.keys(st.countries).sort()) {
        const rebel = st.countries[code];
        if (!rebel.rebel) continue;
        for (const army of armyList(st).filter((a) => a.owner === code && a.at && !a.retreating)) {
            const here = st.settlements[game.map.nodes.get(army.at).kind === "settlement" ? game.map.nodes.get(army.at).id : -1];
            if (here && here.owner === rebel.of && here.siege?.by === code) continue;          // the siege goes on
            const options = [];
            for (const s of ownedBy(st, rebel.of)) {
                const key = String(s.id);
                if (key === army.at) continue;
                const route = routeFor(game, army, key);
                if (!route) continue;
                const defended = armiesAt(st, key).some((a) => a.owner === rebel.of && !a.relief);
                options.push({ route, rank: [defended ? 1 : 0, isCore(st, s, rebel.of) ? 0 : 1, route.days, s.id] });
            }
            options.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2] - b.rank[2] || a.rank[3] - b.rank[3]);
            if (options.length) follow(game, army, options[0].route.path, events);
        }
    }
}

// an uprising is over when its country has no army and holds no settlement
export function endUprisings(game) {
    const st = game.state;
    for (const code of Object.keys(st.countries)) {
        if (!st.countries[code].rebel) continue;
        if (armyList(st).some((a) => a.owner === code) || Object.values(st.settlements).some((s) => s.owner === code)) continue;
        delete st.countries[code];
        st.wars = st.wars.filter((w) => !w.split("|").includes(code));
    }
}
