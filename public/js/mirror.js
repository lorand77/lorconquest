// The browser's copy of the game and the geometry of drawing it: the state kept up to date from each day's
// changes (src/game/view.js), where an army stands or marches on the map, the roads an order would take.
// Pure functions, no DOM, so the tests run them in Node.

// one day's public changes into the mirrored state
export function applyChanges(state, changes) {
    state.day = changes.day;
    for (const name of ["armies", "fleets", "settlements", "posts"]) {
        for (const [id, x] of Object.entries(changes[name] ?? {})) {
            if (x === null) delete state[name][id];
            else state[name][id] = x;
        }
    }
    for (const [code, c] of Object.entries(changes.countries ?? {})) {
        if (c === null) delete state.countries[code];               // an uprising that is over
        else state.countries[code] = { ...state.countries[code], ...c };
    }
    if (changes.wars) state.wars = changes.wars;
    for (const name of ["agreements", "warInfo", "memory"]) if (changes[name]) state[name] = changes[name];
    if ("winner" in changes) state.winner = changes.winner;
}

// one's own country's private changes (its treasury)
export function applyPrivate(state, code, changes) {
    state.countries[code] = { ...state.countries[code], ...changes };
}

// every leg's line on the map, both ways: "37>48" -> [[x, y], ...]. A route through a pass is split at the pass.
export function buildLegs(scenario) {
    const legs = new Map(), passes = new Map(scenario.passes.map((p) => [p.id, p]));
    const xy = new Map(scenario.settlements.map((s) => [String(s.id), [s.x, s.y]]));
    for (const p of scenario.passes) xy.set(p.id, [p.x, p.y]);
    const add = (a, b, pts) => {
        if (legs.has(`${a}>${b}`)) return;
        legs.set(`${a}>${b}`, pts);
        legs.set(`${b}>${a}`, [...pts].reverse());
    };
    for (const r of scenario.routes) {
        if (r.type !== "land") continue;
        const a = String(r.from), b = String(r.to);
        if (r.pass) {
            const p = passes.get(r.pass), i = r.points.findIndex((q) => q[0] === p.x && q[1] === p.y);
            if (i > 0) {
                add(a, r.pass, r.points.slice(0, i + 1));
                add(r.pass, b, r.points.slice(i));
            } else {
                add(a, r.pass, [xy.get(a), xy.get(r.pass)]);
                add(r.pass, b, [xy.get(r.pass), xy.get(b)]);
            }
        } else add(a, b, r.points);
    }
    return legs;
}

const clamp01 = (f) => Math.min(1, Math.max(0, f));
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

// the point a fraction `f` of the way along a line, and the line from there on
export function along(points, f) {
    const lengths = points.slice(1).map((p, i) => dist(points[i], p));
    let left = clamp01(f) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
        if (left <= lengths[i] || i === lengths.length - 1) {
            const t = lengths[i] ? Math.min(1, left / lengths[i]) : 0;
            const at = [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
            return { at, rest: [at, ...points.slice(i + 1)] };
        }
        left -= lengths[i];
    }
    return { at: points[0], rest: points };
}

export const progress = (march, day) => clamp01((day - march.start) / (march.end - march.start));

// where an army is drawn on `day` (a fraction of a day between ticks): its place, or along its leg
export function armyPoint(army, day, legs, nodes) {
    if (army.at) { const n = nodes.get(army.at); return [n.x, n.y]; }
    const pts = legs.get(`${army.march.from}>${army.march.to}`);
    return pts ? along(pts, progress(army.march, day)).at : [nodes.get(army.march.to).x, nodes.get(army.march.to).y];
}

// the line of a route from where an army is now along `path` (the places it will reach, as the engine's route
// finding gives them): from a place, or from a point on its leg — onwards, or back the way it came
export function routeLine(army, path, day, legs, nodes) {
    const pts = [];
    let from;
    if (army.at) {
        from = army.at;
        pts.push([nodes.get(from).x, nodes.get(from).y]);
    } else {
        const m = army.march, f = progress(m, day);
        const back = path[0] === m.from;
        const leg = back ? legs.get(`${m.to}>${m.from}`) : legs.get(`${m.from}>${m.to}`);
        pts.push(...along(leg, back ? 1 - f : f).rest);
        from = path[0];
        path = path.slice(1);
    }
    for (const k of path) {
        const leg = legs.get(`${from}>${k}`) ?? [[nodes.get(from).x, nodes.get(from).y], [nodes.get(k).x, nodes.get(k).y]];
        pts.push(...leg.slice(1));
        from = k;
    }
    return pts;
}

// "750", "1.2k", "12k"
export function formatMen(n) {
    if (n < 1000) return String(n);
    if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `${Math.round(n / 1000)}k`;
}

// a whole number with thousands separated: "1,060,000"
export const formatNumber = (n) => Math.round(n).toLocaleString("en-GB");

// where each fleet is drawn on `day`: in a port, a column below the settlement's marker; at sea, a column below its
// zone's name; on its way, between the two zones' names — a Map from fleet id to [x, y]
export function fleetPoints(state, nodes, zones, day) {
    const out = new Map(), slots = new Map();
    const slot = (key) => { const i = slots.get(key) ?? 0; slots.set(key, i + 1); return i; };
    const zoneAt = (id, i) => [zones.get(id).label.x, zones.get(id).label.y + 14 + i * 16];
    for (const f of Object.values(state.fleets)) {
        if (f.moving) {
            const from = zoneAt(f.zone, 0), to = zoneAt(f.moving.to, 0), t = clamp01((day - f.moving.start) / (f.moving.end - f.moving.start));
            out.set(f.id, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
        } else if (f.port) {
            const n = nodes.get(String(f.port));
            out.set(f.id, [n.x - 8, n.y + 20 + slot(`p${f.port}`) * 16]);
        } else out.set(f.id, zoneAt(f.zone, slot(`z${f.zone}`)));
    }
    return out;
}

// the tab a selection on the map opens (design.md, "The game screen"): an army or a fleet its panel on the Map tab, one of the
// player's own settlements the Shop (to build there), anyone else's settlement or a pass the Map tab, the player's own land the
// Country tab, another country's land the Diplomacy tab (to deal with it) — peasant rebels', with whom there is no dealing,
// the Map tab. Nothing selected (a click on the sea) keeps the tab there is. `place` is the clicked place's map node, if any.
export function tabForSelection(sel, me, { place = null, owner = null, rebel = false } = {}) {
    if (!sel) return null;
    if (sel.kind === "army" || sel.kind === "fleet") return "selection";
    if (sel.kind === "place") return place?.kind === "settlement" && owner === me ? "shop" : "selection";
    if (sel.kind === "country") return sel.code === me ? "country" : rebel ? "selection" : "diplomacy";
    return "selection";
}

// the part of the map in view, kept on the map (design.md, "The map on screen"): shaped like the box it is shown in (its width
// over its height, `aspect`), no wider than the map nor taller, and never past an edge — so nothing beyond the map shows.
// Zoomed in at most to a twelfth of the map's width. `view` is { x, y, w } (the height follows); returns { x, y, w, h }.
export function fitView(view, W, H, aspect) {
    const most = Math.min(W, H * aspect), least = Math.min(W / 12, most);
    const w = Math.min(most, Math.max(least, view.w)), h = w / aspect;
    const x = Math.min(W - w, Math.max(0, view.x)), y = Math.min(H - h, Math.max(0, view.y));
    return { x, y, w, h };
}

// the weapons the screen offers first, the best first
export const BEST_FIRST = ["muskets", "arquebuses", "cavalry", "handCannons", "pikes", "swords"];

// what arming `n` men with `weapon` costs (RULES.md §8, Raising forces): the reserve first, then whole lots of 1000 at `price` a
// lot — or, for cannons, one for every 10 men, in lots of 100
export function armingCost(reserve, weapon, n, price) {
    if (weapon === "unarmed" || n <= 0) return { lots: 0, cost: 0 };
    const [need, lot] = weapon === "cannons" ? [n / 10, 100] : [n, 1000];
    const lots = Math.ceil(Math.max(0, need - (reserve[weapon] ?? 0)) / lot);
    return { lots, cost: lots * price };
}

// the one-click arming of `n` men: the best weapon `country` has unlocked whose missing lots its treasury can pay, or null
export function bestArming(country, n, prices) {
    if (n <= 0) return null;
    for (const weapon of BEST_FIRST) {
        if (!country.techs.includes(weapon)) continue;
        const { lots, cost } = armingCost(country.reserve, weapon, n, prices[weapon]);
        if (cost <= country.treasury) return { weapon, n, lots, cost };
    }
    return null;
}

// is the click on the army or fleet that is selected already? Then it deselects it (design.md, "The game screen")
export const isSelected = (sel, hit) => Boolean(sel) && (hit.kind === "army" || hit.kind === "fleet") && sel.kind === hit.kind && sel.id === hit.id;
