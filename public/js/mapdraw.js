// What the map shows of a game's state, as plain data for mapview.js to draw: the markers of armies and fleets, the rings
// round besieged settlements, the sharpshooter posts. Shared by the game page (which draws what its player may see, with
// their own armies marked and one selected) and the replay page (which draws everything). Pure functions of a state and a
// day, so they are tested in Node against real games.
import { menOf } from "/engine/index.js";
import { armyPoint, fleetPoints, formatMen } from "./mirror.js";

// every army as a marker: armies standing at one place in a column beside it, marching ones where their march has them
export function armyMarkers(state, nodes, legs, day, colourOf, { me = null, selected = null } = {}) {
    const at = new Map();
    return Object.values(state.armies).map((a) => {
        let [x, y] = armyPoint(a, day, legs, nodes);
        if (a.at) {
            const i = at.get(a.at) ?? 0;
            at.set(a.at, i + 1);
            x += 13;
            y += -7 + i * 16;
        } else y -= 12;
        return { id: a.id, x, y, colour: colourOf(a.owner), label: formatMen(menOf(a)), mine: a.owner === me, selected: selected?.kind === "army" && selected.id === a.id, retreating: a.retreating };
    });
}

export function fleetMarkers(state, nodes, zones, day, colourOf, { me = null, selected = null } = {}) {
    const points = fleetPoints(state, nodes, zones, day);
    return Object.values(state.fleets).map((f) => {
        const [x, y] = points.get(f.id);
        const ships = Object.values(f.ships).reduce((k, v) => k + v, 0);
        return { id: f.id, x, y, colour: colourOf(f.owner), label: String(ships), mine: f.owner === me, selected: selected?.kind === "fleet" && selected.id === f.id, sailing: Boolean(f.moving) };
    });
}

// a ring round each besieged settlement, filling as the siege runs
export function siegeRings(state, nodes) {
    return Object.values(state.settlements).filter((s) => s.siege).map((s) => {
        const n = nodes.get(String(s.id));
        return { x: n.x, y: n.y, frac: Math.min(1, (state.day - s.siege.start) / (s.siege.end - s.siege.start)) };
    });
}

export const postMarks = (state, nodes) => Object.entries(state.posts).map(([key, p]) => {
    const n = nodes.get(key);
    return { x: n.x, y: n.y, n: p.n, colour: "#222" };
});

// the whole map, but for the lands' colours (which the caller repaints when ownership changes) and the planned route
export function paintMap(map, state, nodes, zones, legs, day, colourOf, options) {
    map.setArmies(armyMarkers(state, nodes, legs, day, colourOf, options));
    map.setFleets(fleetMarkers(state, nodes, zones, day, colourOf, options));
    map.setPosts(postMarks(state, nodes));
    map.setSieges(siegeRings(state, nodes));
}

// who owns what, as one string: when it changes, the lands are repainted
export const ownersKey = (state) => Object.values(state.settlements).map((s) => s.owner).join();
