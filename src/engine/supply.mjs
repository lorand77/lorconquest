// Losses at the start of every month (RULES.md §6, §8): siege disease — 1% of a besieger's men — and supply — 1%
// of the men of every army outside friendly land when its country's armies there outnumber what the land feeds.
// An army counts in the land of the place it is at or besieging, and while marching of the place it marches to.
// Men only: cannons and their crews are spared.

import { applyLosses, isEmpty, lossesFor, menOf } from "./army.mjs";
import { armyList, atWar, killPeople, removeArmy } from "./state.mjs";

export function attrition(game, events) {
    const st = game.state, map = game.map;
    const landOf = (a) => map.nodes.get(a.at ?? a.march.to).land;
    const men = new Map();                                          // "country|land" -> men there
    for (const a of armyList(st)) {
        const k = `${a.owner}|${landOf(a)}`;
        men.set(k, (men.get(k) ?? 0) + menOf(a));
    }
    for (const a of armyList(st)) {
        const land = landOf(a), s = st.settlements[land];
        // a settlement's land feeds half its pop, ×1.5 on a river; friendly land feeds everyone (milestone 4 adds
        // subjects and allies to "friendly")
        const feeds = s.pop / 2 * (map.nodes.get(String(land)).river ? 1.5 : 1);
        const hungry = s.owner !== a.owner && men.get(`${a.owner}|${land}`) > feeds;
        const sick = a.at === String(land) && s.siege !== null && atWar(st, a.owner, s.owner);
        const pct = (sick ? 0.01 : 0) + (hungry ? 0.01 : 0);
        if (!pct) continue;
        const loss = lossesFor(a, pct, true);
        applyLosses(a, loss);
        killPeople(st, a.owner, loss.dead);
        if (loss.dead) events.push({ type: "attrition", day: st.day, army: a.id, owner: a.owner, dead: loss.dead, sick, hungry });
        if (isEmpty(a)) {
            removeArmy(st, a);
            events.push({ type: "destroyed", day: st.day, army: a.id, owner: a.owner, dead: 0, why: "wasted away" });
        }
    }
}
