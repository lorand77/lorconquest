// Winning (SCENARIO.md, Victory): a country wins by controlling or vassalizing the scenario's number of settlements —
// its own and its vassals' count 1 each, its protectorates' ½ — or, at the start of the end year, by having the most;
// a tie goes to the larger total population, its own and its subjects'. A computer country may win.
import { dayOf } from "./calendar.js";
import { isRebel } from "./state.js";

// every country's score and total people
export function scores(state) {
    const out = {};
    for (const code of Object.keys(state.countries)) if (!isRebel(state, code)) out[code] = { settlements: 0, pop: 0 };
    for (const s of Object.values(state.settlements)) {
        const owner = state.countries[s.owner];
        if (!owner || owner.rebel) continue;
        out[s.owner].settlements += 1;
        out[s.owner].pop += s.pop;
        if (owner.overlord && out[owner.overlord]) {
            out[owner.overlord].settlements += owner.subjectKind === "vassal" ? 1 : 0.5;
            out[owner.overlord].pop += s.pop;
        }
    }
    return out;
}

// the winner, if there is one today
export function checkVictory(game, events) {
    const st = game.state, v = game.map.scenario.victory;
    if (st.winner || !v) return;
    const table = scores(st), codes = Object.keys(table);
    const best = (list) => list.sort((a, b) => table[b].settlements - table[a].settlements || table[b].pop - table[a].pop || (a < b ? -1 : 1))[0];
    const reached = codes.filter((c) => table[c].settlements >= v.settlements);
    const over = st.day >= dayOf(v.endYear);
    if (!reached.length && !over) return;
    st.winner = best(reached.length ? reached : codes);
    events.push({ type: "victory", day: st.day, country: st.winner, settlements: table[st.winner].settlements, why: reached.length ? "reached" : "end" });
}
