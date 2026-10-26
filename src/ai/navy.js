// The computer player's navy (docs/design.md, "The computer players"). In a war with a real country:
//   straits    10 ships of a country in the sea zone of a strait let its armies cross it (RULES.md §8): for every strait
//              between its land and the enemy's it gets that many there — the smallest fleet of its own that will do, split
//              off a bigger one if need be, sailing a zone at a time; else cogs bought in a port it holds there;
//   at sea     where its side is clearly the stronger (1.3 times the enemy's ships in the zone, in port or at sea) a fleet puts
//              out: it blockades the richest enemy port in the zone (halving its money, RULES.md §7), or, every port there
//              blockaded already, patrols, to fall on whatever comes out; outmatched, or with nothing left to do, it goes back
//              to port (forces.js, fleetsHome, takes home any fleet with nothing to do);
//   ships      against an enemy with more ships than its own where it holds a port, it builds the best kind it has, and only
//              then researches carracks, galleons and men-of-war (navalNeed, economy.js) — otherwise cogs only.
// Fleets of its own idle at the same place are merged. Fleets in port cannot be fought (RULES.md §7): there is nothing to hunt.
import { CREW_PER_SHIP as CREW, SHIPS, SHIP_PRICE } from "../engine/costs.js";
import { economyOf, fleetPower, shipCount, shipsIn } from "../engine/index.js";
import { fleetsHome } from "./forces.js";
import { threatsOf } from "./util.js";

// the next zone on the shortest way from `from` to `to` across the sea zones, or null (first by id among equals)
function hop(zones, from, to) {
    if (from === to) return null;
    const back = new Map([[from, null]]), queue = [from];
    while (queue.length) {
        const z = queue.shift();
        for (const n of [...zones.get(z).next].sort()) {
            if (back.has(n)) continue;
            back.set(n, z);
            if (n === to) { let k = n; while (back.get(k) !== from) k = back.get(k); return k; }
            queue.push(n);
        }
    }
    return null;
}

const realFoes = (st, code) => threatsOf(st, code).filter((c) => !st.countries[c].rebel);
const powerIn = (st, owners, zone) => Object.values(st.fleets).filter((f) => owners.includes(f.owner) && f.zone === zone && !f.moving).reduce((n, f) => n + fleetPower(f), 0);
const portsOf = (game, code) => Object.values(game.state.settlements).filter((s) => s.owner === code && game.map.nodes.get(String(s.id)).port);

// does the country face, at war, a fleet stronger than its own in a zone where it holds a port? Then it builds and researches
// warships better than cogs
export function navalNeed(game, code) {
    const st = game.state, foes = realFoes(st, code);
    if (!foes.length) return false;
    return portsOf(game, code).some((s) => {
        const z = game.map.nodes.get(String(s.id)).zone;
        return powerIn(st, foes, z) > powerIn(st, [code], z);
    });
}

export function navyOrders(game, code, ctx = { budget: 0 }) {
    const st = game.state, zones = game.map.zones, out = [], keep = new Set();
    const cmd = (type, rest) => out.push({ type, country: code, ...rest });
    const foes = realFoes(st, code);
    let mine = Object.values(st.fleets).filter((f) => f.owner === code).sort((a, b) => a.id - b.id);
    const ownPort = (z) => (zones.get(z)?.ports ?? []).filter((p) => st.settlements[p]?.owner === code).sort((a, b) => a - b)[0];
    const e = economyOf(game, code), c = st.countries[code];
    let crewRoom = e.navyCap - e.crewAtSea;                // putting to sea takes crew, within the navy cap
    const putOut = (f) => { const need = shipCount(f) * CREW; if (need > crewRoom) return false; crewRoom -= need; return true; };

    // straits: those between our land and an enemy's, and the ships they need
    const need = game.map.scenario.straitShips;
    const owner = (id) => st.settlements[id]?.owner;
    const wanted = !foes.length ? [] : [...new Set((game.map.scenario.routes ?? []).filter((r) => r.type === "strait" && r.seaZone
        && ((owner(r.from) === code && foes.includes(owner(r.to))) || (owner(r.to) === code && foes.includes(owner(r.from)))))
        .map((r) => r.seaZone))].sort();
    const short = wanted.some((z) => shipsIn(st, code, z) < need);

    // idle fleets at the same place become one (the lowest-numbered keeps the ships) — but not while a strait is short of
    // ships, when a part split off for it waits a think to sail (it would be merged back before it could)
    const merged = new Set();
    if (!short) for (const f of mine) {
        if (f.moving || f.order || merged.has(f.id)) continue;
        for (const g of mine) {
            if (g === f || g.moving || g.order || merged.has(g.id) || g.zone !== f.zone || g.port !== f.port) continue;
            cmd("mergeFleet", { fleet: g.id, into: f.id });
            merged.add(g.id);
        }
    }
    mine = mine.filter((f) => !merged.has(f.id));
    if (!foes.length) return [...out, ...fleetsHome(game, code, keep)];

    for (const z of wanted) {
        const have = shipsIn(st, code, z);
        for (const f of mine) if (f.zone === z && !f.moving) keep.add(f.id);               // held there
        if (have >= need) continue;
        const coming = mine.filter((f) => f.moving && f.moving.to === z).reduce((n, f) => n + shipCount(f), 0);
        if (have + coming >= need) { for (const f of mine) if (f.moving) keep.add(f.id); continue; }
        const lack = need - have;
        const able = mine.filter((f) => !f.moving && f.zone !== z && !keep.has(f.id) && shipCount(f) >= lack && hop(zones, f.zone, z));
        const fit = able.filter((f) => shipCount(f) < 2 * lack).sort((a, b) => shipCount(a) - shipCount(b) || a.id - b.id)[0];
        const big = able.sort((a, b) => shipCount(b) - shipCount(a) || a.id - b.id)[0];
        if (fit && (!fit.port || putOut(fit))) { cmd("sail", { fleet: fit.id, zone: hop(zones, fit.zone, z) }); keep.add(fit.id); continue; }
        if (big && !big.order) {
            // split off what the strait needs, from the weakest ships first: it sails on the next think
            const ships = {};
            let left = lack;
            for (const k of SHIPS) { const n = Math.min(left, big.ships[k]); if (n > 0) { ships[k] = n; left -= n; } }
            cmd("splitFleet", { fleet: big.id, ships });
            keep.add(big.id);
            continue;
        }
        const port = ownPort(z), lots = Math.ceil(lack / 10), cost = lots * SHIP_PRICE.cogs;
        if (port !== undefined && ctx.budget >= cost + 0.3 * e.settlementMoney) {
            cmd("buyShips", { port, kind: "cogs", lots });
            ctx.budget -= cost;
        }
    }
    // fleets on their way to a zone the straits need, at sea between hops: on to the next
    for (const f of mine) {
        if (f.moving || f.port || f.order || keep.has(f.id)) continue;
        const z = wanted.find((w) => hop(zones, f.zone, w) && shipsIn(st, code, w) < need && shipCount(f) >= need - shipsIn(st, code, w));
        if (z) { cmd("sail", { fleet: f.id, zone: hop(zones, f.zone, z) }); keep.add(f.id); }
    }

    // warships: against more enemy ships than ours where we hold a port, ten of the best kind we have, if the money allows
    const kind = ["menOfWar", "galleons", "carracks", "cogs"].find((k) => c.techs.includes(k));
    for (const s of portsOf(game, code).sort((a, b) => a.id - b.id)) {
        const z = game.map.nodes.get(String(s.id)).zone;
        if (powerIn(st, foes, z) <= powerIn(st, [code], z)) continue;
        if (ctx.budget >= SHIP_PRICE[kind] + 0.3 * e.settlementMoney) { cmd("buyShips", { port: s.id, kind, lots: 1 }); ctx.budget -= SHIP_PRICE[kind]; }
        break;
    }

    // at sea: blockade, or patrol, where our side is clearly the stronger; back to port where it is not
    const atSea = (f) => !f.port && !f.moving;
    const blockading = new Set(mine.filter((f) => f.order?.type === "blockade").map((f) => f.order.port));
    for (const f of mine) {
        if (f.moving) continue;
        const theirs = powerIn(st, foes, f.zone), ours = powerIn(st, [code], f.zone);
        const enemyPorts = (zones.get(f.zone)?.ports ?? []).filter((p) => foes.includes(st.settlements[p]?.owner)).sort((a, b) => st.settlements[b].pop - st.settlements[a].pop || a - b);
        const enemyAtSea = Object.values(st.fleets).some((x) => x.zone === f.zone && atSea(x) && foes.includes(x.owner));
        if ((enemyPorts.length || enemyAtSea) && ours >= 1.3 * theirs && ours > 0) {
            if (f.order) { keep.add(f.id); continue; }                       // already at it
            if (f.port && !putOut(f)) continue;
            const port = enemyPorts.find((p) => !blockading.has(p));
            if (f.port) cmd("sail", { fleet: f.id, zone: f.zone });
            if (port !== undefined && !enemyAtSea) { cmd("blockade", { fleet: f.id, port }); blockading.add(port); }
            else cmd("patrol", { fleet: f.id });
            keep.add(f.id);
        } else if (f.order || (atSea(f) && theirs > 0)) {
            const port = ownPort(f.zone);
            if (port !== undefined && port !== f.port) { cmd("sail", { fleet: f.id, port }); keep.add(f.id); }
            else if (f.order) cmd("hold", { fleet: f.id });
        }
    }
    return [...out, ...fleetsHome(game, code, keep)];
}
