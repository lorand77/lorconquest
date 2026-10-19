// The map as a graph for marching (RULES.md §8), built once from scenario.json and never changed by play. Every
// settlement and pass is a node, keyed by its settlement id ("37") or pass id ("P3"); every land route is a leg,
// or two legs either side of its pass. A leg takes its route's years in whole days. Straits wait for fleets
// (milestone 3).

import { YEAR_DAYS } from "./calendar.mjs";

export const legKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function buildMap(scenario) {
    const nodes = new Map();
    for (const s of scenario.settlements) {
        nodes.set(String(s.id), { key: String(s.id), kind: "settlement", id: s.id, name: s.name, land: s.id, river: s.river, x: s.x, y: s.y });
    }
    for (const p of scenario.passes) {
        if (!nodes.has(String(p.land))) throw new Error(`scenario: pass ${p.id} lies in the land of unknown settlement ${p.land}`);
        nodes.set(p.id, { key: p.id, kind: "pass", id: p.id, name: p.id, land: p.land, river: false, x: p.x, y: p.y });
    }
    const adj = new Map([...nodes.keys()].map((k) => [k, []]));
    const legDays = new Map();
    // several routes through one pass share their legs to it: one leg per pair of places, the fastest
    const link = (a, b, years, route) => {
        if (!nodes.has(a) || !nodes.has(b)) throw new Error(`scenario: ${route} joins an unknown place`);
        const days = Math.max(1, Math.round(years * YEAR_DAYS)), k = legKey(a, b);
        if (legDays.has(k)) {
            if (days < legDays.get(k)) {
                legDays.set(k, days);
                for (const [x, y] of [[a, b], [b, a]]) adj.get(x).find((e) => e.to === y).days = days;
            }
            return;
        }
        adj.get(a).push({ to: b, days, route });
        adj.get(b).push({ to: a, days, route });
        legDays.set(k, days);
    };
    for (const r of scenario.routes) {
        if (r.type !== "land") continue;
        const a = String(r.from), b = String(r.to);
        if (r.pass) {
            link(a, r.pass, r.legs[0].years, r.id);
            link(r.pass, b, r.legs[1].years, r.id);
        } else link(a, b, r.years, r.id);
    }
    for (const list of adj.values()) list.sort((x, y) => byKey(x.to, y.to));
    return { scenario, nodes, adj, legDays, keys: [...nodes.keys()].sort(byKey), x: scenario.scaleX };
}

// Dijkstra over the legs, from a place ({ node }) or a point on a leg ({ from, to, f, days }, f the way along
// from `from`). `ok(key)` says which places may be entered. Stops at the first place `goal` accepts (ties go to
// the lower key) and returns { target, days, path }, the path listing every place to reach in order — from a
// point on a leg it starts with the end of the leg the army heads for. Null when no goal can be reached.
function search(map, start, ok, goal) {
    const dist = new Map(), prev = new Map(), done = new Set();
    if (start.node) {
        dist.set(start.node, 0);
        prev.set(start.node, null);
    } else {
        for (const [k, d] of [[start.from, start.f * start.days], [start.to, (1 - start.f) * start.days]]) {
            if (ok(k) && (!dist.has(k) || d < dist.get(k))) { dist.set(k, d); prev.set(k, null); }
        }
    }
    for (;;) {
        let best = null;
        for (const [k, d] of dist) if (!done.has(k) && (best === null || d < dist.get(best) || (d === dist.get(best) && k < best))) best = k;
        if (best === null) return null;
        done.add(best);
        if (best !== start.node && goal(best)) {
            const path = [];
            for (let k = best; k !== null; k = prev.get(k)) path.unshift(k);
            if (start.node) path.shift();
            return { target: best, days: dist.get(best), path };
        }
        for (const e of map.adj.get(best)) {
            if (done.has(e.to) || !ok(e.to)) continue;
            const d = dist.get(best) + e.days;
            if (!dist.has(e.to) || d < dist.get(e.to)) { dist.set(e.to, d); prev.set(e.to, best); }
        }
    }
}

// the fastest way to `target`
export const findRoute = (map, start, target, ok) => search(map, start, ok, (k) => k === target);

// the nearest place `isGoal` accepts
export const findNearest = (map, start, ok, isGoal) => search(map, start, ok, isGoal);
