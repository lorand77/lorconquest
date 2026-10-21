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

// Countries' codes on the map, where their land is now (the map's own, drawn in 1440, are hidden by the game): each country
// still in the game gets its code on the clearest spot (tools/map.js worked them out, land by land) of the land it holds that
// lies nearest the middle of all it holds, large if it fits and small if not — or, if none of its lands has room, beside one
// of its settlements — never over another code, larger countries first. A country with nowhere free gets none. Peasant rebels
// and countries out of the game get none.
const CHAR_W = 0.72;                                      // a capital letter's width, in em, as tools/map.js reckons it
export function countryLabels(state, scenario) {
    const lands = new Map();
    for (const s of scenario.settlements) {
        const code = state.settlements[s.id]?.owner, c = state.countries[code];
        if (!c || c.rebel || (c.out ?? null) !== null || !s.label) continue;
        if (!lands.has(code)) lands.set(code, []);
        lands.get(code).push(s);
    }
    const groups = [...lands].map(([code, list]) => ({ code, list, area: list.reduce((n, s) => n + s.label.area, 0) }))
        .sort((a, b) => b.area - a.area || (a.code < b.code ? -1 : 1));
    const placed = [], out = [];
    const clear = (box) => !placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1]);
    for (const g of groups) {
        const at = (s) => s.label.small ?? s.label.big ?? [s.x, s.y];
        const weight = g.area || 1;
        const mx = g.list.reduce((n, s) => n + at(s)[0] * (s.label.area || 1), 0) / weight;
        const my = g.list.reduce((n, s) => n + at(s)[1] * (s.label.area || 1), 0) / weight;
        let chosen = null;
        for (const [size, key] of [[15, "big"], [10, "small"], [10, "near"]]) {
            const tw = CHAR_W * size * g.code.length, th = CHAR_W * size, m = size / 5;
            const spots = g.list.map((s) => s.label[key]).filter(Boolean).sort((p, q) => (p[0] - mx) ** 2 + (p[1] - my) ** 2 - ((q[0] - mx) ** 2 + (q[1] - my) ** 2));
            for (const [x, y] of spots) {
                const box = [x - tw / 2 - m, y - th / 2 - m, x + tw / 2 + m, y + th / 2 + m];
                if (!clear(box)) continue;
                chosen = { code: g.code, x, y: y + th / 2, size, box };
                break;
            }
            if (chosen) break;
        }
        if (!chosen) continue;
        placed.push(chosen.box);
        out.push({ code: chosen.code, x: chosen.x, y: chosen.y, size: chosen.size });
    }
    return out;
}
