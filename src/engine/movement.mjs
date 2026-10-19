// Marching (RULES.md §8): an army is either at a place or on a leg between two, moving at an even pace from its
// start day to its end day — so where it is on any day is simple arithmetic, for the engine and for the screen.
// Setting an army on its way, turning it back, retreats, and armies destroyed with nowhere to go.

import { menOf } from "./army.mjs";
import { findNearest, findRoute, legKey } from "./map.mjs";
import { canEnter, killPeople, removeArmy } from "./state.mjs";

// how far along its leg a march is on `day`: 0 at the start, 1 on arrival (not clamped)
export const progress = (march, day) => (day - march.start) / (march.end - march.start);
const clamp01 = (f) => Math.min(1, Math.max(0, f));

// where an army is, as a starting point for route finding
export function positionOf(army, day) {
    if (army.at) return { node: army.at };
    const m = army.march;
    return { from: m.from, to: m.to, f: clamp01(progress(m, day)), days: m.end - m.start };
}

export function startLeg(game, army, from, to, start) {
    army.at = null;
    army.march = { from, to, start, end: start + game.map.legDays.get(legKey(from, to)) };
}

// the fastest way for an army from where it is to `to`, through land it may enter
export const routeFor = (game, army, to) => findRoute(game.map, positionOf(army, game.state.day), to, (k) => canEnter(game, army.owner, k));

// set an army on its way along a route found from where it is now. On a leg, a route that starts with the leg's
// far end carries on; one that starts with the end it came from turns it back, from where it is.
export function follow(game, army, path) {
    const day = game.state.day;
    if (army.at) {
        if (!path.length) return;
        startLeg(game, army, army.at, path[0], day);
        army.path = path.slice(1);
        return;
    }
    const m = army.march;
    if (path[0] === m.from) {
        const days = m.end - m.start, start = day - (1 - clamp01(progress(m, day))) * days;
        army.march = { from: m.to, to: m.from, start, end: start + days };
    }
    army.path = path.slice(1);
}

// a beaten army falls back to the nearest settlement of its own, by marching time, through land it may enter
// (RULES.md §5); never to `exclude`, the place it lost at. With nowhere to go the whole army dies.
export function retreat(game, army, events, exclude = null) {
    const st = game.state;
    const isRefuge = (k) => k !== exclude && game.map.nodes.get(k).kind === "settlement" && st.settlements[game.map.nodes.get(k).id].owner === army.owner;
    const found = findNearest(game.map, positionOf(army, st.day), (k) => canEnter(game, army.owner, k), isRefuge);
    army.relief = false;
    army.storm = false;
    if (!found) return destroy(game, army, events, "nowhere to retreat");
    const from = army.at ?? legKey(army.march.from, army.march.to);
    army.retreating = true;
    follow(game, army, found.path);
    events.push({ type: "retreat", day: st.day, army: army.id, owner: army.owner, from, to: found.target, days: found.days });
}

// an army wiped out: every man in it is a casualty (RULES.md §2)
export function destroy(game, army, events, why) {
    const st = game.state, dead = menOf(army) + army.crew;
    killPeople(st, army.owner, dead);
    removeArmy(st, army);
    events.push({ type: "destroyed", day: st.day, army: army.id, owner: army.owner, dead, why });
}
