// Fleets (RULES.md §7, §8): a fleet is in a port or at sea in one sea zone, sails to a neighbouring zone in 2
// months, and while sailing is neither fought nor fights. Patrols engage enemy fleets at sea; a blockade halves
// the money of an enemy port; armies may cross a strait only where their country has the ships.
//
// Ships need 50 crew at sea (not in port), who are soldiers: they pay upkeep, are not civilians, and count on the
// navy cap. Crew of ships sunk are lost from the population.

import { shareOut } from "./army.js";
import { COOLDOWN_DAYS, damage, mayFight } from "./battle.js";
import { MONTH } from "./calendar.js";
import { CREW_PER_SHIP, SHIPS, SHIP_POWER } from "./costs.js";
import { battleRoll } from "./random.js";
import { atWar, fleetList, killPeople } from "./state.js";

export const shipCount = (fleet) => SHIPS.reduce((n, k) => n + fleet.ships[k], 0);
export const fleetPower = (fleet) => SHIPS.reduce((n, k) => n + fleet.ships[k] * SHIP_POWER[k], 0);
const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

// a fleet that can fight and be fought: at sea, not on its way
export const atSea = (f) => !f.port && !f.moving;

// ship crew at sea, for upkeep, civilians and the navy cap
export const crewAtSea = (state, country) => sum(fleetList(state).filter((f) => f.owner === country && !f.port), (f) => shipCount(f) * CREW_PER_SHIP);

// the country's ships in a sea zone, at sea or in its ports, not counting fleets on their way
export const shipsIn = (state, country, zone) => sum(fleetList(state).filter((f) => f.owner === country && f.zone === zone && !f.moving), shipCount);

export const sailDays = (game) => Math.round(game.map.scenario.fleetHopMonths * MONTH);

// the ports under blockade: settlements an enemy fleet blockades at sea in their zone
export function blockaded(game) {
    const st = game.state, out = new Set();
    for (const f of fleetList(st)) {
        if (f.order?.type !== "blockade" || !atSea(f)) continue;
        const s = st.settlements[f.order.port];
        if (s && game.map.nodes.get(String(s.id)).zone === f.zone && atWar(st, f.owner, s.owner)) out.add(s.id);
    }
    return out;
}

// armies may cross a strait if their country has at least 10 × x ships in its zone (RULES.md §8)
export const crossable = (game, country, zone) => shipsIn(game.state, country, zone) >= game.map.scenario.straitShips;

// one naval battle between two sides' fleets (RULES.md §7): power (cogs + carracks × 3 + galleons × 5 + men-of-war
// × 8) × (2d6 + 4), losses as on land applied to ships in whole numbers; the crew of sunk ships die. `tie` is the
// side that wins equal power. Fleets with no ships left are removed.
export function fleetBattle(game, { kind, zone, a, b, tie }) {
    const st = game.state;
    const rollA = battleRoll(st), rollB = battleRoll(st);
    const pa = sum(a, fleetPower) * rollA, pb = sum(b, fleetPower) * rollB;
    const winner = pa > pb ? "a" : pb > pa ? "b" : tie;
    const dmg = winner === "a" ? damage(pa, pb) : damage(pb, pa);
    const side = (fleets, p, roll) => ({
        countries: [...new Set(fleets.map((f) => f.owner))], fleets: fleets.map((f) => f.id), men: sum(fleets, shipCount), unit: "ships", cannons: 0,
        power: p, roll, dead: 0,
    });
    const ev = { type: "battle", kind, day: st.day, place: zone, winner, a: side(a, pa, rollA), b: side(b, pb, rollB), destroyed: [] };
    for (const [fleets, pct, s] of [[a, winner === "a" ? dmg.winner : dmg.loser, ev.a], [b, winner === "b" ? dmg.winner : dmg.loser, ev.b]]) {
        for (const f of fleets) {
            const sunk = Math.min(shipCount(f), Math.round(shipCount(f) * pct));
            const lost = shareOut(f.ships, SHIPS, sunk);
            for (const k of SHIPS) f.ships[k] -= lost[k];
            killPeople(st, f.owner, sunk * CREW_PER_SHIP);
            s.dead += sunk;
            if (!shipCount(f)) { delete st.fleets[f.id]; ev.destroyed.push(f.id); }
        }
    }
    for (const x of a) for (const y of b) st.cooldowns[x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`] = st.day + COOLDOWN_DAYS;
    return ev;
}

// the losing side runs for its nearest port in the zone, if it has one, and waits there
function runForPort(game, fleets, zone, events) {
    const st = game.state;
    for (const f of fleets) {
        if (!st.fleets[f.id] || f.port) continue;
        const port = (game.map.zones.get(zone)?.ports ?? []).filter((p) => st.settlements[p].owner === f.owner).sort((x, y) => x - y)[0];
        if (port === undefined) continue;
        f.port = port;
        f.order = null;
        events.push({ type: "fleetInPort", day: st.day, fleet: f.id, owner: f.owner, port });
    }
}

// each day: fleets that have reached the next zone arrive, and patrols engage the enemy fleets at sea in their zone
export function navalDay(game, events) {
    const st = game.state;
    for (const f of fleetList(st)) {
        if (f.moving && f.moving.end <= st.day) {
            f.zone = f.moving.to;
            f.since = f.moving.end;
            f.moving = null;
            events.push({ type: "fleetArrives", day: st.day, fleet: f.id, owner: f.owner, zone: f.zone });
        }
    }
    for (const zone of game.map.zones.keys()) {
        const fleets = fleetList(st).filter((f) => f.zone === zone && atSea(f));
        const owners = [...new Set(fleets.map((f) => f.owner))].sort();
        for (let i = 0; i < owners.length; i++) {
            for (let j = i + 1; j < owners.length; j++) {
                if (!atWar(st, owners[i], owners[j])) continue;
                const live = (o) => fleets.filter((f) => f.owner === o && st.fleets[f.id] === f && atSea(f));
                const A = live(owners[i]), B = live(owners[j]);
                if (!A.length || !B.length) continue;
                const patrolA = A.some((f) => f.order?.type === "patrol"), patrolB = B.some((f) => f.order?.type === "patrol");
                if ((!patrolA && !patrolB) || !mayFight(st, A, B)) continue;
                // the patrolling side attacks; if both patrol, the side that came to the zone later does
                const first = (side) => [Math.min(...side.map((f) => f.since)), Math.min(...side.map((f) => f.id))];
                const aFirst = patrolA && patrolB ? first(A)[0] < first(B)[0] || (first(A)[0] === first(B)[0] && first(A)[1] < first(B)[1]) : !patrolA;
                const [att, def] = aFirst ? [B, A] : [A, B];
                const ev = fleetBattle(game, { kind: "naval", zone, a: att, b: def, tie: "b" });
                events.push(ev);
                runForPort(game, ev.winner === "a" ? def : att, zone, events);
            }
        }
    }
}

// an army is about to set out across a strait (RULES.md §8): the country must have the ships there, and if an enemy
// fleet is at sea in the zone, its fleets there must beat them first. Returns whether the crossing may begin.
export function crossStrait(game, army, zone, events) {
    const st = game.state, owner = army.owner;
    const fail = (why) => {
        events.push({ type: "crossFailed", day: st.day, army: army.id, owner, zone, why });
        return false;
    };
    if (!crossable(game, owner, zone)) return fail("too few ships");
    const foes = fleetList(st).filter((f) => f.zone === zone && atSea(f) && atWar(st, owner, f.owner));
    if (!foes.length) return true;
    const mine = fleetList(st).filter((f) => f.owner === owner && f.zone === zone && !f.moving);
    if (!mayFight(st, mine, foes)) return fail("an enemy fleet holds the strait");
    const ev = fleetBattle(game, { kind: "strait", zone, a: mine, b: foes, tie: "b" });
    events.push(ev);
    if (ev.winner !== "a") {
        runForPort(game, mine, zone, events);
        return fail("lost the naval battle");
    }
    runForPort(game, foes, zone, events);
    return crossable(game, owner, zone) || fail("too few ships left");
}
