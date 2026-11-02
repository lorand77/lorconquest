// Winning (SCENARIO.md, Victory): a country wins by controlling or vassalizing the scenario's number of settlements —
// its own and its vassals' count 1 each, its protectorates' ½, and so on up a chain of subjects (a vassal's vassal counts 1
// for the top, a protectorate's vassal ½) — or, at the start of the end year, by having the most; a tie goes to the larger
// total population, its own and its subjects'. Several reaching the number on the same day — a subject and its overlord
// both count the subject's settlements — are ranked the same way: the most settlements, then people, then the lower code.
// A vassal never beats its overlord (who counts all its settlements and has its own); a protectorate may. A computer
// country may win.
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
        // up the chain of overlords, each step a vassal's (×1) or a protectorate's (×½); a chain is never a ring (relations.js)
        let c = owner, share = 1;
        for (let guard = 0; c.overlord && out[c.overlord] && guard < 16; guard++) {
            share *= c.subjectKind === "vassal" ? 1 : 0.5;
            out[c.overlord].settlements += share;
            out[c.overlord].pop += s.pop;
            c = state.countries[c.overlord];
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
