// Winning (SCENARIO.md, Victory): a country wins by controlling or vassalizing the scenario's number of settlements —
// its own and its vassals' count 1 each, its protectorates' ½, and so on up a chain of subjects (a vassal's vassal counts 1
// for the top, a protectorate's vassal ½) — or, at the start of the end year, by having the most; a tie goes to the larger
// total population, its own and its subjects'. Several reaching the number on the same day — a subject and its overlord
// both count the subject's settlements — are ranked the same way: the most settlements, then people, then the lower code.
// A vassal never beats its overlord (who counts all its settlements and has its own); a protectorate may. A computer
// country may win.
//
// A game may be a long one (RULES.md, Victory; chosen by its host): 60% of the map's settlements, rounded up (or the scenario's
// number, if that is more), instead of the scenario's number, and held for 2 years — the first to reach it must still have it 730 days later (the count may rise and fall
// above it meanwhile); dropping below starts the clock again, as does another reaching it ahead. The end year is the same.
// Or a short one: a third of the map's settlements, rounded up (or the scenario's number, if that is less), won as soon as reached;
// the end year the same.
import { dayOf } from "./calendar.js";
import { isRebel } from "./state.js";
import { memo } from "./memo.js";

// every country's score and total people
export function scores(state) { return memo("scores", "", () => scoresNow(state)); }
function scoresNow(state) {
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

// the game's lengths: the scenario's number, at once; the long one, 60% of the map held for 2 years; or the short one, a third of it
export const GAME_LENGTHS = ["normal", "long", "short"];
export const LONG_SHARE = 0.6, LONG_HOLD_DAYS = 730, SHORT_SHARE = 1 / 3;
// a long game's number: 60% of the map, rounded up — or the scenario's own, where that is more (Italy 1440's two thirds), so that a
// long game is never won with less than a normal one
export const longTarget = (scenario) => Math.max(Math.ceil(LONG_SHARE * scenario.settlements.length), scenario.victory?.settlements ?? 0);
// a short game's number: a third of the map, rounded up — or the scenario's own, where that is less, so that a short game is never
// harder to win than a normal one
export const shortTarget = (scenario) => Math.min(Math.ceil(SHORT_SHARE * scenario.settlements.length), scenario.victory?.settlements ?? Infinity);
// what a game of `length` keeps in its state (state.victory): null for the scenario's own
export const victoryFor = (scenario, length) => (length === "long" ? { settlements: longTarget(scenario), hold: LONG_HOLD_DAYS }
    : length === "short" ? { settlements: shortTarget(scenario), hold: 0 } : null);
// the victory a game is played to: the scenario's, with the game's own target and hold if it is a long one — every reader asks this
export function victoryOf(game) {
    const v = game.map.scenario.victory;
    return v ? { ...v, hold: 0, ...(game.state.victory ?? {}) } : null;
}

// the winner, if there is one today; in a long game, who is holding the target and since when (state.holding)
export function checkVictory(game, events) {
    const st = game.state, v = victoryOf(game);
    if (st.winner || !v) return;
    const table = scores(st), codes = Object.keys(table);
    const best = (list) => list.sort((a, b) => table[b].settlements - table[a].settlements || table[b].pop - table[a].pop || (a < b ? -1 : 1))[0];
    const reached = codes.filter((c) => table[c].settlements >= v.settlements);
    const over = st.day >= dayOf(v.endYear);
    if (v.hold && !over) {
        const leader = reached.length ? best([...reached]) : null;
        if (st.holding && st.holding.country !== leader) {
            events.push({ type: "holdBroken", day: st.day, country: st.holding.country });
            st.holding = null;
        }
        if (!leader) return;
        if (!st.holding) {
            st.holding = { country: leader, since: st.day };
            events.push({ type: "holding", day: st.day, country: leader, settlements: table[leader].settlements, until: st.day + v.hold });
        }
        if (st.day - st.holding.since < v.hold) return;
    }
    if (!reached.length && !over) return;
    st.winner = best(reached.length ? reached : codes);
    events.push({ type: "victory", day: st.day, country: st.winner, settlements: table[st.winner].settlements, why: reached.length ? "reached" : "end" });
}
