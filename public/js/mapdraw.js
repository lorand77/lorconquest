// What the map shows of a game's state, as plain data for mapview.js to draw: the markers of armies and fleets, the rings
// round besieged settlements, the sharpshooter posts. Shared by the game page (which draws what its player may see, with
// their own armies marked and one selected) and the replay page (which draws everything). Pure functions of a state and a
// day, so they are tested in Node against real games.
import { SHIP_POWER, SHIPS, atWar, menOf, capitalsOf } from "/engine/index.js";
import { along, armyPoint, fleetPoints, formatMen, progress } from "./mirror.js";

// ---------- markers (design.md, "The map on screen") ----------
// an army's or fleet's size at a glance: one pip to three — an army by its men (under 3,000, under 15,000, more), a fleet by its
// strength in battle (a cog 1, a carrack 3, a galleon 5, a man-of-war 8: under 20, under 60, more), the steps times the map's x
export const ARMY_PIPS = [3000, 15000], FLEET_PIPS = [20, 60];
export const pipsOf = (n, [small, large], x = 1) => (n < small * x ? 1 : n < large * x ? 2 : 3);

// what most of an army's men carry: guns (hand cannons, arquebuses, muskets), cavalry, pikes, swords, or nothing; a tie to the first
const ARMS = [["guns", ["handCannons", "arquebuses", "muskets"]], ["cavalry", ["cavalry"]], ["pikes", ["pikes"]], ["swords", ["swords"]], ["unarmed", ["unarmed"]]];
export function mainArm(men) {
    let best = "unarmed", most = 0;
    for (const [arm, kinds] of ARMS) {
        const n = kinds.reduce((k, w) => k + (men[w] ?? 0), 0);
        if (n > most) { best = arm; most = n; }
    }
    return best;
}

// the heading of a march, in degrees (0 east, 90 south: the map's y grows downwards), where it is on `day`
function heading(a, day, legs) {
    const pts = a.march.sea ? legs.voyage?.(a.march.from, a.march.to, a.march.sea) : legs.get(`${a.march.from}>${a.march.to}`);
    if (!pts || pts.length < 2) return 0;
    const { at, rest } = along(pts, progress(a.march, day)), next = rest.find((q) => q[0] !== at[0] || q[1] !== at[1]) ?? pts[pts.length - 1];
    return Math.round(Math.atan2(next[1] - at[1], next[0] - at[0]) * 180 / Math.PI);
}

// what an army standing at a place is doing: besieging it, holding it as its garrison, or neither (null)
function standing(state, a) {
    const s = state.settlements[a.at];
    if (!s) return null;
    if (s.owner !== a.owner && s.siege && atWar(state, a.owner, s.owner)) return "siege";
    return s.owner === a.owner && !a.relief ? "garrison" : null;
}

// every army as a marker: a country's armies standing in one place as one (a stack: `count` of them, the men added up) — but the
// stack `open` (a key, game.js) and one holding the army selected, which show each army — in a column beside the place; marching
// ones where their march has them, with their heading. `x`: the map's scale, for the pips.
// A marker: { id (the first army's), ids, stack (its key, if a stack), count, x, y, colour, label, arm, cannons, pips, state
// ("march" | "siege" | "garrison" | null), angle, atSea, mine, enemy, selected, retreating }
export function armyMarkers(state, nodes, legs, day, colourOf, { me = null, selected = null, open = null, x = 1 } = {}) {
    const groups = new Map(), out = [], at = new Map();
    for (const a of Object.values(state.armies)) {
        const key = a.at ? `a:${a.at}|${a.owner}|${a.relief ? 1 : 0}` : `m:${a.id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    }
    const chosen = selected?.kind === "army" ? selected.id : null;
    for (const [key, list] of groups) {
        const stacked = list.length > 1 && key !== open && !list.some((a) => a.id === chosen);
        for (const part of stacked ? [list] : list.map((a) => [a])) {
            const a = part[0], men = {};
            for (const y of part) for (const [w, n] of Object.entries(y.men)) men[w] = (men[w] ?? 0) + n;
            const total = part.reduce((k, y) => k + menOf(y), 0);
            let [px, py] = armyPoint(a, day, legs, nodes);
            if (a.at) {
                const i = at.get(a.at) ?? 0;
                at.set(a.at, i + 1);
                px += 13;
                py += -7 + i * 16;
            } else py -= 12;
            out.push({
                id: a.id, ids: part.map((y) => y.id), ...(stacked ? { stack: key, count: part.length } : {}), x: px, y: py, colour: colourOf(a.owner), label: formatMen(total),
                arm: mainArm(men), cannons: part.some((y) => y.cannons > 0), pips: pipsOf(total, ARMY_PIPS, x),
                state: a.at ? standing(state, a) : "march", angle: a.at ? 0 : heading(a, day, legs), atSea: Boolean(a.march?.sea),
                mine: a.owner === me, enemy: Boolean(me) && atWar(state, me, a.owner), selected: !stacked && a.id === chosen, retreating: a.retreating,
            });
        }
    }
    return out;
}

// a fleet's best ship, by its strength in battle: men-of-war, galleons, carracks or cogs
export const bestShip = (ships) => [...SHIPS].sort((p, q) => SHIP_POWER[q] - SHIP_POWER[p]).find((k) => (ships[k] ?? 0) > 0) ?? "cogs";

// every fleet as a marker: a country's fleets lying together — in one port, blockading one port, or at sea in one zone on the same
// order — as one (a stack, as armies), but the stack `open` and one holding the fleet selected; sailing ones between their zones,
// with their heading. A marker: { id, ids, stack, count, x, y, colour, label (ships), best, pips, state ("sailing" | "blockade" |
// "patrol" | null), angle, mine, enemy, selected, sailing }
export function fleetMarkers(state, nodes, zones, day, colourOf, { me = null, selected = null, open = null, x = 1 } = {}) {
    const groups = new Map();
    for (const f of Object.values(state.fleets)) {
        const key = f.moving ? `m:${f.id}` : f.port ? `p:${f.port}|${f.owner}` : f.order?.type === "blockade" ? `b:${f.order.port}|${f.owner}` : `z:${f.zone}|${f.owner}|${f.order?.type ?? ""}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
    }
    const chosen = selected?.kind === "fleet" ? selected.id : null, parts = [];
    for (const [key, list] of groups) {
        const stacked = list.length > 1 && key !== open && !list.some((f) => f.id === chosen);
        for (const part of stacked ? [list] : list.map((f) => [f])) parts.push({ part, stack: stacked ? key : null });
    }
    // where each is drawn: as the fleets shown alone would be, the first of a stack in its place
    const shown = Object.fromEntries(parts.map(({ part }) => [part[0].id, part[0]]));
    const points = fleetPoints({ ...state, fleets: shown }, nodes, zones, day);
    return parts.map(({ part, stack }) => {
        const f = part[0], ships = {};
        for (const g of part) for (const [k, n] of Object.entries(g.ships)) ships[k] = (ships[k] ?? 0) + n;
        const count = Object.values(ships).reduce((k, v) => k + v, 0), strength = Object.entries(ships).reduce((k, [s, n]) => k + n * (SHIP_POWER[s] ?? 1), 0);
        const [px, py] = points.get(f.id);
        let angle = 0;
        if (f.moving) {
            const from = zones.get(f.zone)?.label, to = zones.get(f.moving.to)?.label;
            if (from && to) angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI);
        }
        return {
            id: f.id, ids: part.map((g) => g.id), ...(stack ? { stack, count: part.length } : {}), x: px, y: py, colour: colourOf(f.owner), label: String(count),
            best: bestShip(ships), pips: pipsOf(strength, FLEET_PIPS, x),
            state: f.moving ? "sailing" : f.order?.type === "blockade" ? "blockade" : f.order?.type === "patrol" ? "patrol" : null, angle,
            mine: f.owner === me, enemy: Boolean(me) && atWar(state, me, f.owner), selected: !stack && f.id === chosen, sailing: Boolean(f.moving),
        };
    });
}

// the ports under blockade, each with a chain beside its marker: [{ x, y, port }]
export function blockadeMarks(state, nodes) {
    const ports = [...new Set(Object.values(state.fleets).filter((f) => !f.moving && f.order?.type === "blockade").map((f) => f.order.port))].sort((a, b) => a - b);
    return ports.flatMap((port) => {
        const n = nodes.get(String(port));
        return n ? [{ port, x: n.x - 14, y: n.y - 10 }] : [];
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
        for (const id of capitalsOf(state, c.code)) out.push({ id, code: c.code, mine: c.code === me });       // a union's, one for each member
    }
    return out.sort((a, b) => a.id - b.id);
}

// the whole map, but for the lands' colours (which the caller repaints when ownership changes) and the planned route
export function paintMap(map, state, nodes, zones, legs, day, colourOf, options) {
    map.setArmies(armyMarkers(state, nodes, legs, day, colourOf, options));
    map.setFleets(fleetMarkers(state, nodes, zones, day, colourOf, options));
    map.setPosts(postMarks(state, nodes));
    map.setSieges(siegeRings(state, nodes));
    map.setBlockades?.(blockadeMarks(state, nodes));
    map.setCapitals(capitalMarks(state, options?.me ?? null));
}

// a country as the map shows it: in the colour and under the code of the new state it proclaimed, if it did (SCENARIO.md,
// Special coring: Becomes), or that it took on rising from rebels (RULES.md §11), else its own; peasants in arms in dark red
const becameOf = (state, scenario, code) => {
    if (state.countries[code]?.risen) return state.countries[code].risen;
    const f = state.countries[code]?.formed;
    return f ? scenario.formables?.find((x) => x.id === f)?.becomes ?? null : null;
};
export const countryColour = (state, scenario, code) => (state.countries[code]?.rebel ? "#8c3a3a"
    : becameOf(state, scenario, code)?.colour ?? scenario.countries.find((c) => c.code === code)?.colour ?? "#ddd");
export const mapCode = (state, scenario, code) => becameOf(state, scenario, code)?.code ?? code;
// an event's line (the engine's describeEvent, which names countries by code) with each country that proclaimed a new state under
// the code the map shows it by — "GER takes 48 Ulm", not the "BAV" it began as
export function inMapCodes(text, state, scenario) {
    const formed = Object.values(state.countries).filter((c) => (c.formed || c.risen) && mapCode(state, scenario, c.code) !== c.code);
    return formed.reduce((t, c) => t.replace(new RegExp(`\\b${c.code}\\b`, "g"), mapCode(state, scenario, c.code)), text);
}

// what the lands' colours and the labels depend on, as one string — when it changes, the lands are repainted: who holds each
// settlement, who is whose subject, and who has become a new state
export const ownersKey = (state) => Object.values(state.settlements).map((s) => s.owner).join()
    + "|" + Object.values(state.countries).filter((c) => c.overlord).map((c) => `${c.code}>${c.overlord}:${c.subjectKind}`).join()
    + "|" + Object.values(state.countries).filter((c) => c.formed).map((c) => `${c.code}=${c.formed}`).join()
    + "|" + (state.memory?.unions ?? []).join();

// the countries a union is made of (RULES.md §10), itself first and the others in the order they joined — a union that joined
// another brings its own — from the engine's record of who united with whom, pairs [into, from] in state.memory.unions; just
// [code] for a country that never united
export function unionMembers(state, code) {
    const pairs = state.memory?.unions ?? [], out = [code];
    for (let i = 0; i < pairs.length; i += 2) if (pairs[i] === code) for (const m of unionMembers(state, pairs[i + 1])) if (!out.includes(m)) out.push(m);
    return out;
}

// the faiths shown on the map (the Country tab's Faith, "Show on the map"): each land in the colour of its people's faith
// (RULES.md §2, Religion), the borders drawn between faiths — and what they depend on, to repaint when a land turns Protestant
export const FAITH_COLOURS = { catholic: "#e2c35a", orthodox: "#9a7ccb", hussite: "#4ea7a2", sunni: "#4e9b58", protestant: "#4c7ed0" };
export const faithOfLand = (state) => (key) => state.settlements[key]?.faith ?? null;
export const faithFill = (faith) => FAITH_COLOURS[faith] ?? "#cfcfcf";
export const faithsKey = (state) => Object.values(state.settlements).map((s) => s.faith ?? "").join();

// how a country's land is filled: its own colour; for a union, even bands of its members' colours (the second band in a colour
// too near the first is shaded, as below); or — for a subject — its own colour striped with its overlord's, broad
// stripes for a vassal and thin ones for a protectorate (mapview.js, colourLands, and mapcanvas.js draw them). Where the two
// colours are the same or nearly, the stripes would not show: they are a darker shade of the overlord's then (a lighter one
// on a dark colour), still the overlord's, now to be seen.
export const landFill = (state, colourOf) => (code) => {
    const c = state.countries[code];
    const members = c && !c.rebel ? unionMembers(state, code) : [code];
    if (members.length > 1 && !c.overlord) {
        const bands = [];
        for (const m of members) { const b = colourOf(m); bands.push(bands.some((x) => alike(x, b)) ? shade(b) : b); }
        return { colour: bands[0], bands, kind: "union" };
    }
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
// of its settlements — never over another code, larger countries first, and not on the only spot a country still to come has,
// while it has another free. A country with nowhere free gets none. Peasant rebels
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
    const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const clear = (box) => !placed.some((p) => overlap(box, p));
    const SIZES = [[15, "big"], [10, "small"], [10, "near"]];
    const boxAt = ([x, y], size, text) => { const tw = CHAR_W * size * text.length, th = CHAR_W * size, m = size / 5; return [x - tw / 2 - m, y - th / 2 - m, x + tw / 2 + m, y + th / 2 + m]; };
    // a country with one spot alone, for its own code: kept for it from those placed before it, while they have another
    const only = new Map();
    for (const g of groups) {
        const short = mapCode(state, scenario, g.code);
        const all = SIZES.flatMap(([size, key]) => g.list.map((s) => s.label[key]).filter(Boolean).map((p) => boxAt(p, size, short)));
        if (all.length === 1) only.set(g.code, all[0]);
    }
    groups.forEach((g, i) => {
        const at = (s) => s.label.small ?? s.label.big ?? [s.x, s.y];
        const weight = g.area || 1;
        const mx = g.list.reduce((n, s) => n + at(s)[0] * (s.label.area || 1), 0) / weight;
        const my = g.list.reduce((n, s) => n + at(s)[1] * (s.label.area || 1), 0) / weight;
        const overlord = state.countries[g.code].overlord;
        const short = mapCode(state, scenario, g.code);
        const kept = groups.slice(i + 1).map((x) => only.get(x.code)).filter(Boolean);
        const pick = (spare) => {
            for (const text of overlord ? [`${short}▸${mapCode(state, scenario, overlord)}`, short] : [short]) {
                for (const [size, key] of SIZES) {
                    const spots = g.list.map((s) => s.label[key]).filter(Boolean).sort((p, q) => (p[0] - mx) ** 2 + (p[1] - my) ** 2 - ((q[0] - mx) ** 2 + (q[1] - my) ** 2));
                    for (const p of spots) {
                        const box = boxAt(p, size, text);
                        if (!clear(box) || (spare && kept.some((k) => overlap(box, k)))) continue;
                        return { code: g.code, text, x: p[0], y: p[1] + CHAR_W * size / 2, size, box };
                    }
                }
            }
            return null;
        };
        const chosen = pick(true) ?? pick(false);
        if (!chosen) return;
        placed.push(chosen.box);
        out.push({ code: chosen.code, text: chosen.text, x: chosen.x, y: chosen.y, size: chosen.size });
    });
    return out;
}
