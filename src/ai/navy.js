// The computer player's navy (docs/design.md, "The computer players"). It builds only cogs, and only where its armies need
// them: 10 ships of a country in the sea zone of a strait let its armies cross it (RULES.md §8), so in a war with a real
// country, for every strait between its land and the enemy's it gets that many there — sailing a fleet of its own to the
// zone, a zone at a time, or buying cogs in a port it holds there. At sea it fights only where it is clearly the stronger: a
// fleet in a zone where enemy ships are at sea puts out and patrols if its side has 1.3 times their power; outmatched, or with
// no enemy left at sea, it goes back to port. Every other fleet with nothing to do goes home (forces.js, fleetsHome).
import { CREW_PER_SHIP as CREW, SHIP_PRICE } from "../engine/costs.js";
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

export function navyOrders(game, code, ctx = { budget: 0 }) {
    const st = game.state, zones = game.map.zones, out = [], keep = new Set();
    const cmd = (type, rest) => out.push({ type, country: code, ...rest });
    const foes = threatsOf(st, code).filter((c) => !st.countries[c].rebel);
    const mine = Object.values(st.fleets).filter((f) => f.owner === code).sort((a, b) => a.id - b.id);
    const ownPort = (z) => (zones.get(z)?.ports ?? []).filter((p) => st.settlements[p]?.owner === code).sort((a, b) => a - b)[0];
    const e = economyOf(game, code);
    let crewRoom = e.navyCap - e.crewAtSea;                // putting to sea takes crew, within the navy cap
    const putOut = (f) => { const need = shipCount(f) * CREW; if (need > crewRoom) return false; crewRoom -= need; return true; };

    if (foes.length) {
        // straits: those between our land and an enemy's, and the ships they need
        const need = game.map.scenario.straitShips;
        const owner = (id) => st.settlements[id]?.owner;
        const wanted = [...new Set((game.map.scenario.routes ?? []).filter((r) => r.type === "strait" && r.seaZone
            && ((owner(r.from) === code && foes.includes(owner(r.to))) || (owner(r.to) === code && foes.includes(owner(r.from)))))
            .map((r) => r.seaZone))].sort();
        for (const z of wanted) {
            const have = shipsIn(st, code, z);
            for (const f of mine) if (f.zone === z && !f.moving) keep.add(f.id);           // held there
            if (have >= need) continue;
            // a fleet of ours elsewhere, big enough, sails for the zone; one on its way carries on
            const coming = mine.filter((f) => f.moving && f.moving.to === z).reduce((n, f) => n + shipCount(f), 0);
            if (have + coming >= need) { for (const f of mine) if (f.moving) keep.add(f.id); continue; }
            const fleet = mine.filter((f) => !f.moving && f.zone !== z && !keep.has(f.id) && shipCount(f) >= need - have && hop(zones, f.zone, z))
                .sort((a, b) => shipCount(b) - shipCount(a) || a.id - b.id)[0];
            if (fleet && (!fleet.port || putOut(fleet))) {
                cmd("sail", { fleet: fleet.id, zone: hop(zones, fleet.zone, z) });
                keep.add(fleet.id);
                continue;
            }
            // else cogs, ten at a time, in a port of ours in the zone, if the money allows
            const port = ownPort(z), lots = Math.ceil((need - have) / 10), cost = lots * SHIP_PRICE.cogs;
            if (port !== undefined && ctx.budget >= cost + 0.3 * e.settlementMoney) {
                cmd("buyShips", { port, kind: "cogs", lots });
                ctx.budget -= cost;
            }
        }
        // fleets on their way to a zone the straits need, at sea between hops: on to the next
        for (const f of mine) {
            if (f.moving || f.port || f.order || keep.has(f.id)) continue;
            const z = wanted.find((w) => hop(zones, f.zone, w));
            if (z && shipsIn(st, code, z) < need && shipCount(f) >= need - shipsIn(st, code, z)) { cmd("sail", { fleet: f.id, zone: hop(zones, f.zone, z) }); keep.add(f.id); }
        }
    }

    // fighting at sea: where enemy ships are at sea in a fleet's zone
    const atSea = (f) => !f.port && !f.moving;
    for (const f of mine) {
        if (f.moving) continue;
        const enemy = Object.values(st.fleets).filter((x) => x.zone === f.zone && atSea(x) && foes.includes(x.owner));
        const theirs = enemy.reduce((n, x) => n + fleetPower(x), 0);
        const ours = mine.filter((x) => x.zone === f.zone && !x.moving).reduce((n, x) => n + fleetPower(x), 0);
        if (theirs > 0 && ours >= 1.3 * theirs) {
            if (f.port && !putOut(f)) continue;
            if (f.port) cmd("sail", { fleet: f.id, zone: f.zone });
            if (f.order?.type !== "patrol") cmd("patrol", { fleet: f.id });
            keep.add(f.id);
        } else if (f.order?.type === "patrol" || (atSea(f) && theirs > 0)) {
            // outmatched, or nothing left to fight: back to port in the zone if there is one (else home, below)
            const port = ownPort(f.zone);
            if (port !== undefined && port !== f.port) { cmd("sail", { fleet: f.id, port }); keep.add(f.id); }
            else if (f.order) cmd("hold", { fleet: f.id });
        }
    }
    return [...out, ...fleetsHome(game, code, keep)];
}
