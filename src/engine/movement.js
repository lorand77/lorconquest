// Marching (RULES.md §8): an army is either at a place or on a leg between two, moving at an even pace from its
// start day to its end day — so where it is on any day is simple arithmetic, for the engine and for the screen.
// Setting an army on its way, turning it back, retreats, and armies destroyed with nowhere to go.

import { menOf, peopleLost } from "./army.js";
import { findNearest, findRoute, legKey } from "./map.js";
import { crossStrait, crossable } from "./naval.js";
import { atWar, canEnter, isFriend, isRebel, killPeople, removeArmy } from "./state.js";

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

// a strait is open to an army only where its country has the ships (RULES.md §8)
const straitOpen = (game, country) => (from, edge) => !edge.strait || crossable(game, country, edge.strait);

// may the army pass through `key`? Land it may enter — and an army sent home (retreating "home": land closed to it by a peace,
// the end of an agreement, a capture) may also cross land that is not an enemy's on its way out, or it could never leave
export function mayPass(game, army, key) {
    if (canEnter(game, army.owner, key)) return true;
    if (army.retreating !== "home") return false;
    const node = game.map.nodes.get(key), land = node.kind === "pass" ? node.land : node.id;
    return !atWar(game.state, army.owner, game.state.settlements[land].owner);
}

// the fastest way for an army from where it is to `to`, through land it may pass
export const routeFor = (game, army, to) => findRoute(game.map, positionOf(army, game.state.day), to, (k) => mayPass(game, army, k), straitOpen(game, army.owner));

// may the army set out from `from` to `to`? A strait needs its ships there, and a battle if an enemy fleet holds it
export function mayDepart(game, army, from, to, events) {
    const zone = game.map.straits.get(legKey(from, to));
    return !zone || crossStrait(game, army, zone, events);
}

// set an army on its way along a route found from where it is now. On a leg, a route that starts with the leg's
// far end carries on; one that starts with the end it came from turns it back, from where it is. Returns false if
// it could not set out (a strait it may not cross yet), with the reason in `events`.
export function follow(game, army, path, events) {
    const day = game.state.day;
    if (army.at) {
        if (!path.length) return true;
        if (!mayDepart(game, army, army.at, path[0], events)) return false;
        startLeg(game, army, army.at, path[0], day);
        army.path = path.slice(1);
        return true;
    }
    const m = army.march;
    if (path[0] === m.from) {
        const days = m.end - m.start, start = day - (1 - clamp01(progress(m, day))) * days;
        army.march = { from: m.to, to: m.from, start, end: start + days };
    }
    army.path = path.slice(1);
    return true;
}

// a beaten army falls back to the nearest settlement of its own, by marching time, through land it may enter
// (RULES.md §5); never to `exclude`, the place it lost at. With nowhere to go the whole army dies. `home`: it is not beaten
// but sent home from land closed to it, and may cross land that is not an enemy's on the way (mayPass). A route that opens
// with a strait it cannot cross after all (an enemy fleet there) is given up for one by land.
export function retreat(game, army, events, exclude = null, home = false) {
    const st = game.state;
    const isRefuge = (k) => k !== exclude && game.map.nodes.get(k).kind === "settlement" && isFriend(st, army.owner, st.settlements[game.map.nodes.get(k).id].owner);
    army.relief = false;
    army.storm = false;
    army.retreating = home || army.retreating === "home" ? "home" : true;
    const nearest = (straits) => findNearest(game.map, positionOf(army, st.day), (k) => mayPass(game, army, k), isRefuge, straits);
    let found = nearest(straitOpen(game, army.owner));
    const from = army.at ?? legKey(army.march.from, army.march.to);
    if (found && !follow(game, army, found.path, events)) {
        found = nearest((f, edge) => !edge.strait);
        if (found && !follow(game, army, found.path, events)) found = null;
    }
    if (!found) {
        army.retreating = false;
        if (isRebel(st, army.owner)) {                       // rebels with nowhere to go scatter home (RULES.md §11)
            removeArmy(st, army);
            return events.push({ type: "scattered", day: st.day, army: army.id, owner: army.owner, men: menOf(army) });
        }
        return destroy(game, army, events, "nowhere to retreat");
    }
    events.push({ type: "retreat", day: st.day, army: army.id, owner: army.owner, from, to: found.target, days: found.days });
}

// an army wiped out: every man in it is a casualty (RULES.md §2)
export function destroy(game, army, events, why) {
    const st = game.state, dead = menOf(army) - (army.mercs ?? 0) + army.crew;
    killPeople(st, army.owner, dead);
    removeArmy(st, army);
    events.push({ type: "destroyed", day: st.day, army: army.id, owner: army.owner, dead, why });
}
