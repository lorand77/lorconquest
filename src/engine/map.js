// The map as a graph for marching (RULES.md §8), built once from scenario.json and never changed by play. Every
// settlement and pass is a node, keyed by its settlement id ("37") or pass id ("P3"); every land route is a leg,
// or two legs either side of its pass. A leg takes its route's years in whole days. A strait is a leg of 3 months
// whatever its length, listed in `straits` with the sea zone it lies in: an army may take it only with ships
// (src/engine/naval.js).
//
// Sea lanes (RULES.md §8): an army in a port may sail to any port up to SEA_ZONES_MAX zones off, a fleet's hop for each zone.
// They are not legs: the route search alone steps through the zones, as waypoints ("~<zone>~<depth>") a path never names, and
// only when asked to (`sea`) — so retreats, and everything that walks the legs, never go to sea. Two ports one after the other
// in a path, with no leg between them, are a voyage.

import { MONTH, YEAR_DAYS } from "./calendar.js";
import { SEA_ZONES_MAX, STRAIT_DAYS } from "./costs.js";

export const legKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function buildMap(scenario) {
    const nodes = new Map();
    for (const s of scenario.settlements) {
        nodes.set(String(s.id), { key: String(s.id), kind: "settlement", id: s.id, name: s.name, land: s.id, river: s.river, port: s.port, zone: s.seaZone, x: s.x, y: s.y });
    }
    for (const p of scenario.passes) {
        if (!nodes.has(String(p.land))) throw new Error(`scenario: pass ${p.id} lies in the land of unknown settlement ${p.land}`);
        nodes.set(p.id, { key: p.id, kind: "pass", id: p.id, name: p.id, land: p.land, river: false, x: p.x, y: p.y });
    }
    const adj = new Map([...nodes.keys()].map((k) => [k, []]));
    const legDays = new Map(), straits = new Map();
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
        if (r.type === "strait") {
            const a = String(r.from), b = String(r.to);
            link(a, b, STRAIT_DAYS / YEAR_DAYS, r.id);
            straits.set(legKey(a, b), r.seaZone);
            for (const [x, y] of [[a, b], [b, a]]) adj.get(x).find((e) => e.to === y).strait = r.seaZone;
            continue;
        }
        if (r.type !== "land") continue;
        const a = String(r.from), b = String(r.to);
        if (r.pass) {
            link(a, r.pass, r.legs[0].years, r.id);
            link(r.pass, b, r.legs[1].years, r.id);
        } else link(a, b, r.years, r.id);
    }
    for (const list of adj.values()) list.sort((x, y) => byKey(x.to, y.to));
    const zones = new Map(scenario.seaZones.map((z) => [z.id, z]));
    // the sea's own graph: each zone's ports (by key) and the zones next to it, both in order
    const sea = { hopDays: Math.round((scenario.fleetHopMonths ?? 2) * MONTH), ports: new Map(), next: new Map(), reach: new Map(), steps: new Map(), board: new Map() };
    for (const z of scenario.seaZones) {
        sea.ports.set(z.id, (z.ports ?? []).map(String).filter((k) => nodes.has(k)).sort(byKey));
        sea.next.set(z.id, [...(z.next ?? [])].sort(byKey));
    }
    return { scenario, nodes, adj, legDays, straits, zones, sea, keys: [...nodes.keys()].sort(byKey), x: scenario.scaleX,
        // the warmonger score a settlement taken or integrated adds, × this (RULES.md §10, Warmongers): 1 but on a larger map
        warmongerScale: scenario.warmongerScale ?? 1 };
}

// the ports a voyage from the port `key` could reach, whatever the fleets: all within SEA_ZONES_MAX zones, in order (the reach
// of a peace, RULES.md §10). Worked out once a zone, and kept with the map, which never changes
export function portsInReach(map, key) {
    const n = map.nodes.get(key);
    if (!n?.port || !n.zone) return [];
    if (!map.sea.reach.has(n.zone)) {
        const zones = new Set([n.zone]);
        for (let ring = [n.zone], d = 1; d < SEA_ZONES_MAX; d++) ring = ring.flatMap((z) => map.sea.next.get(z) ?? []).filter((z) => !zones.has(z) && zones.add(z));
        map.sea.reach.set(n.zone, [...zones].flatMap((z) => map.sea.ports.get(z) ?? []).sort(byKey));
    }
    return map.sea.reach.get(n.zone);
}

// is two places one after the other a voyage by sea lane: both ports, and no leg between them
export const isVoyage = (map, a, b) => !map.legDays.has(legKey(a, b)) && Boolean(map.nodes.get(a)?.port && map.nodes.get(b)?.port);
export const waypoint = (k) => k.charCodeAt(0) === 126;   // "~"

// the steps out of a waypoint, a zone at a depth: to its ports, and on to the zones next to it while the voyage has zones left.
// Each says what it is (`sea`: { board | sail | land: zone }) for `edgeOk` to judge. Kept with the map, which never changes
function seaEdges(map, key) {
    if (map.sea.steps.has(key)) return map.sea.steps.get(key);
    const [, zone, d] = key.split("~"), depth = Number(d), out = [];
    for (const p of map.sea.ports.get(zone) ?? []) out.push({ to: p, days: 0, sea: { land: zone } });
    if (depth < SEA_ZONES_MAX) for (const z of map.sea.next.get(zone) ?? []) out.push({ to: `~${z}~${depth + 1}`, days: map.sea.hopDays, sea: { sail: z } });
    map.sea.steps.set(key, out);
    return out;
}

// the steps out of a place or waypoint: its legs, and with `sea` the sea's (for searches of their own, as the computer's)
export function stepsOf(map, key, sea = false) {
    if (waypoint(key)) return seaEdges(map, key);
    const legs = map.adj.get(key), n = sea && map.nodes.get(key);
    if (!n?.port || !n.zone) return legs;
    if (!map.sea.board.has(key)) map.sea.board.set(key, [...legs, { to: `~${n.zone}~1`, days: map.sea.hopDays, sea: { board: n.zone } }]);
    return map.sea.board.get(key);
}

// Dijkstra over the legs, from a place ({ node }) or a point on a leg ({ from, to, f, days }, f the way along
// from `from`). `ok(key)` says which places may be entered. Stops at the first place `goal` accepts (ties go to
// the lower key) and returns { target, days, path }, the path listing every place to reach in order — from a
// point on a leg it starts with the end of the leg the army heads for. Null when no goal can be reached. With `sea`, it may
// also sail by sea lane, as `edgeOk` allows (seaEdges).
function search(map, start, ok, goal, edgeOk = () => true, sea = false) {
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
        if (best !== start.node && !waypoint(best) && goal(best)) {
            const path = [];
            for (let k = best; k !== null; k = prev.get(k)) if (!waypoint(k)) path.unshift(k);
            if (start.node) path.shift();
            return { target: best, days: dist.get(best), path };
        }
        for (const e of stepsOf(map, best, sea)) {
            if (done.has(e.to) || (!waypoint(e.to) && !ok(e.to)) || !edgeOk(best, e)) continue;
            const d = dist.get(best) + e.days;
            if (!dist.has(e.to) || d < dist.get(e.to)) { dist.set(e.to, d); prev.set(e.to, best); }
        }
    }
}

// the fastest way to `target`; `edgeOk(from, edge)` may close a leg (a strait without the ships)
export const findRoute = (map, start, target, ok, edgeOk, sea = false) => search(map, start, ok, (k) => k === target, edgeOk, sea);

// the nearest place `isGoal` accepts
export const findNearest = (map, start, ok, isGoal, edgeOk, sea = false) => search(map, start, ok, isGoal, edgeOk, sea);
