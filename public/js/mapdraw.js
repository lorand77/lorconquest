// What the map shows of a game's state, as plain data for mapview.js to draw: the markers of armies and fleets, the rings
// round besieged settlements, the sharpshooter posts. Shared by the game page (which draws what its player may see, with
// their own armies marked and one selected) and the replay page (which draws everything). Pure functions of a state and a
// day, so they are tested in Node against real games.
import { atWar, menOf } from "/engine/index.js";
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
        return { id: a.id, x, y, colour: colourOf(a.owner), label: formatMen(menOf(a)), mine: a.owner === me, enemy: Boolean(me) && atWar(state, me, a.owner),
            selected: selected?.kind === "army" && selected.id === a.id, retreating: a.retreating };
    });
}

export function fleetMarkers(state, nodes, zones, day, colourOf, { me = null, selected = null } = {}) {
    const points = fleetPoints(state, nodes, zones, day);
    return Object.values(state.fleets).map((f) => {
        const [x, y] = points.get(f.id);
        const ships = Object.values(f.ships).reduce((k, v) => k + v, 0);
        return { id: f.id, x, y, colour: colourOf(f.owner), label: String(ships), mine: f.owner === me, enemy: Boolean(me) && atWar(state, me, f.owner),
            selected: selected?.kind === "fleet" && selected.id === f.id, sailing: Boolean(f.moving) };
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

// every country's capital, while it holds it (a lost capital is no capital: RULES.md §2) — its marker with a gold border
// (`mine`: the player's own): [{ id, code, mine }] by settlement id
export function capitalMarks(state, me = null) {
    const out = [];
    for (const c of Object.values(state.countries)) {
        if (c.rebel || (c.out ?? null) !== null || c.capital === null || c.capital === undefined) continue;
        if (state.settlements[c.capital]?.owner === c.code) out.push({ id: c.capital, code: c.code, mine: c.code === me });
    }
    return out.sort((a, b) => a.id - b.id);
}

// the whole map, but for the lands' colours (which the caller repaints when ownership changes) and the planned route
export function paintMap(map, state, nodes, zones, legs, day, colourOf, options) {
    map.setArmies(armyMarkers(state, nodes, legs, day, colourOf, options));
    map.setFleets(fleetMarkers(state, nodes, zones, day, colourOf, options));
    map.setPosts(postMarks(state, nodes));
    map.setSieges(siegeRings(state, nodes));
    map.setCapitals(capitalMarks(state, options?.me ?? null));
}

// a country as the map shows it: in the colour and under the code of the new state it proclaimed, if it did (SCENARIO.md,
// Special coring: Becomes), else its own; peasants in arms in dark red
const becameOf = (state, scenario, code) => {
    const f = state.countries[code]?.formed;
    return f ? scenario.formables?.find((x) => x.id === f)?.becomes ?? null : null;
};
export const countryColour = (state, scenario, code) => (state.countries[code]?.rebel ? "#8c3a3a"
    : becameOf(state, scenario, code)?.colour ?? scenario.countries.find((c) => c.code === code)?.colour ?? "#ddd");
export const mapCode = (state, scenario, code) => becameOf(state, scenario, code)?.code ?? code;
// an event's line (the engine's describeEvent, which names countries by code) with each country that proclaimed a new state under
// the code the map shows it by — "GER takes 48 Ulm", not the "BAV" it began as
export function inMapCodes(text, state, scenario) {
    const formed = Object.values(state.countries).filter((c) => c.formed && mapCode(state, scenario, c.code) !== c.code);
    return formed.reduce((t, c) => t.replace(new RegExp(`\\b${c.code}\\b`, "g"), mapCode(state, scenario, c.code)), text);
}

// what the lands' colours and the labels depend on, as one string — when it changes, the lands are repainted: who holds each
// settlement, who is whose subject, and who has become a new state
export const ownersKey = (state) => Object.values(state.settlements).map((s) => s.owner).join()
    + "|" + Object.values(state.countries).filter((c) => c.overlord).map((c) => `${c.code}>${c.overlord}:${c.subjectKind}`).join()
    + "|" + Object.values(state.countries).filter((c) => c.formed).map((c) => `${c.code}=${c.formed}`).join();

// how a country's land is filled: its own colour, or — for a subject — its own colour striped with its overlord's, broad
// stripes for a vassal and thin ones for a protectorate (mapview.js, colourLands, and mapcanvas.js draw them). Where the two
// colours are the same or nearly, the stripes would not show: they are a darker shade of the overlord's then (a lighter one
// on a dark colour), still the overlord's, now to be seen.
export const landFill = (state, colourOf) => (code) => {
    const c = state.countries[code];
    if (!c?.overlord || c.rebel || !state.countries[c.overlord]) return colourOf(code);
    const colour = colourOf(code), stripe = colourOf(c.overlord);
    return { colour, stripe: alike(colour, stripe) ? shade(stripe) : stripe, kind: c.subjectKind };
};

// colours as "#rgb" or "#rrggbb"; anything else counts as unlike everything
const rgbOf = (hex) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return null;
    const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
// too near to tell apart as stripes: within 30 of each other by the "redmean" distance, a cheap fit to how the eye weighs red,
// green and blue (0 for the same colour, about 765 for black and white). The scenarios reuse colours: dozens of pairs of
// countries share one exactly, and those (and near copies) are what this catches
export function alike(a, b) {
    const x = rgbOf(a), y = rgbOf(b);
    if (!x || !y) return false;
    const r = (x[0] + y[0]) / 2, [dr, dg, db] = [0, 1, 2].map((i) => x[i] - y[i]);
    return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db) < 30;
}
// the same colour 45% of the way to black — or, for a dark one, to white
export function shade(hex) {
    const c = rgbOf(hex);
    if (!c) return hex;
    const light = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] > 110;
    return "#" + c.map((v) => Math.round(light ? v * 0.55 : v + (255 - v) * 0.45).toString(16).padStart(2, "0")).join("");
}

// Countries' codes on the map, where their land is now (the map's own, drawn in 1440, are hidden by the game): each country
// still in the game gets its code on the clearest spot (tools/map.js worked them out, land by land) of the land it holds that
// lies nearest the middle of all it holds, large if it fits and small if not — or, if none of its lands has room, beside one
// of its settlements — never over another code, larger countries first. A country with nowhere free gets none. Peasant rebels
// and countries out of the game get none. A subject's label names its overlord too, "ULM▸BAV", where that fits, and its own code
// alone where it does not.
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
        const overlord = state.countries[g.code].overlord;
        const short = mapCode(state, scenario, g.code);
        for (const text of overlord ? [`${short}▸${mapCode(state, scenario, overlord)}`, short] : [short]) {
            for (const [size, key] of [[15, "big"], [10, "small"], [10, "near"]]) {
                const tw = CHAR_W * size * text.length, th = CHAR_W * size, m = size / 5;
                const spots = g.list.map((s) => s.label[key]).filter(Boolean).sort((p, q) => (p[0] - mx) ** 2 + (p[1] - my) ** 2 - ((q[0] - mx) ** 2 + (q[1] - my) ** 2));
                for (const [x, y] of spots) {
                    const box = [x - tw / 2 - m, y - th / 2 - m, x + tw / 2 + m, y + th / 2 + m];
                    if (!clear(box)) continue;
                    chosen = { code: g.code, text, x, y: y + th / 2, size, box };
                    break;
                }
                if (chosen) break;
            }
            if (chosen) break;
        }
        if (!chosen) continue;
        placed.push(chosen.box);
        out.push({ code: chosen.code, text: chosen.text, x: chosen.x, y: chosen.y, size: chosen.size });
    }
    return out;
}
