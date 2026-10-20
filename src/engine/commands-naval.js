// The commands of fleets (design.md §3; RULES.md §7, §8): sailing, orders, splitting and merging. A fleet is in a
// port or at sea in one sea zone; a fleet on its way takes no orders.
//
//   sail { fleet, port }          into a port of the country in the fleet's own zone (instant)
//   sail { fleet, zone }          leave port for sea (the fleet's own zone), or sail to a neighbouring zone (2 months)
//   blockade { fleet, port }      blockade an enemy port in the fleet's zone    patrol { fleet }    hold { fleet }
//   splitFleet { fleet, ships: { cogs: 4, ... } }    mergeFleet { fleet, into }
import { CREW_PER_SHIP, SHIPS } from "./costs.js";
import { done, ownFleet, refuse, whole } from "./command-util.js";
import { economyOf } from "./economy.js";
import { sailDays, shipCount } from "./naval.js";
import { atWar, newFleet } from "./state.js";

const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

export const navalCommands = {
    sail(game, cmd) {
        const st = game.state, { fleet, error } = ownFleet(game, cmd);
        if (error) return refuse(error);
        if (fleet.moving) return refuse(`fleet ${fleet.id} is on its way`);
        // into a port of the country, in the fleet's own zone
        if (cmd.port !== undefined) {
            const s = st.settlements[cmd.port], node = game.map.nodes.get(String(cmd.port));
            if (!s || !node?.port || s.owner !== fleet.owner) return refuse(`${cmd.port} is not a port of ${fleet.owner}'s`);
            if (node.zone !== fleet.zone) return refuse(`${cmd.port} lies in another sea zone`);
            if (fleet.port === s.id) return refuse(`fleet ${fleet.id} is already in ${s.id}`);
            fleet.port = s.id;
            fleet.order = null;
            return done([{ type: "fleetInPort", day: st.day, fleet: fleet.id, owner: fleet.owner, port: s.id }]);
        }
        const zone = cmd.zone ?? fleet.zone;
        if (zone !== fleet.zone && !game.map.zones.get(fleet.zone).next.includes(zone)) return refuse(`${zone} is not next to ${fleet.zone}`);
        if (zone === fleet.zone && !fleet.port) return refuse(`fleet ${fleet.id} is already at sea in ${zone}`);
        // putting to sea takes 50 crew a ship, within the navy cap
        if (fleet.port) {
            const e = economyOf(game, fleet.owner), need = shipCount(fleet) * CREW_PER_SHIP;
            if (e.crewAtSea + need > e.navyCap) return refuse(`the crew (${need}) would be more than your law's navy cap allows (${Math.floor(e.navyCap)}, ${Math.round(e.crewAtSea)} already at sea)`);
        }
        fleet.port = null;
        fleet.order = null;
        if (zone === fleet.zone) return done([{ type: "fleetAtSea", day: st.day, fleet: fleet.id, owner: fleet.owner, zone }]);
        fleet.moving = { to: zone, start: st.day, end: st.day + sailDays(game) };
        return done([{ type: "fleetSails", day: st.day, fleet: fleet.id, owner: fleet.owner, from: fleet.zone, to: zone, days: sailDays(game) }]);
    },

    blockade(game, cmd) {
        const st = game.state, { fleet, error } = ownFleet(game, cmd);
        if (error) return refuse(error);
        if (fleet.moving || fleet.port) return refuse(`fleet ${fleet.id} must be at sea`);
        const s = st.settlements[cmd.port], node = game.map.nodes.get(String(cmd.port));
        if (!s || !node?.port) return refuse(`${cmd.port} is not a port`);
        if (node.zone !== fleet.zone) return refuse(`${cmd.port} lies in another sea zone`);
        if (!atWar(st, fleet.owner, s.owner)) return refuse(`${s.owner} is not your enemy`);
        fleet.order = { type: "blockade", port: s.id };
        return done([{ type: "blockade", day: st.day, fleet: fleet.id, owner: fleet.owner, port: s.id }]);
    },

    patrol(game, cmd) {
        const { fleet, error } = ownFleet(game, cmd);
        if (error) return refuse(error);
        if (fleet.moving || fleet.port) return refuse(`fleet ${fleet.id} must be at sea`);
        fleet.order = { type: "patrol" };
        return done();
    },

    hold(game, cmd) {
        const { fleet, error } = ownFleet(game, cmd);
        if (error) return refuse(error);
        fleet.order = null;
        return done();
    },

    splitFleet(game, cmd) {
        const st = game.state, { fleet, error } = ownFleet(game, cmd);
        if (error) return refuse(error);
        if (fleet.moving) return refuse(`fleet ${fleet.id} is on its way`);
        const ships = {};
        for (const [k, n] of Object.entries(cmd.ships ?? {})) {
            if (!SHIPS.includes(k)) return refuse(`no ship ${k}`);
            if (!whole(n) || n > fleet.ships[k]) return refuse(`fleet ${fleet.id} has ${fleet.ships[k]} ${k}`);
            ships[k] = n;
        }
        const taken = sum(Object.values(ships), (n) => n);
        if (!taken) return refuse("nothing to split off");
        if (taken === shipCount(fleet)) return refuse("that is the whole fleet");
        for (const k of Object.keys(ships)) fleet.ships[k] -= ships[k];
        const part = newFleet(st, fleet.owner, ships, fleet.port, fleet.zone);
        part.since = fleet.since;
        return done([{ type: "splitFleet", day: st.day, fleet: fleet.id, owner: fleet.owner, into: part.id }]);
    },

    mergeFleet(game, cmd) {
        const st = game.state, { fleet, error } = ownFleet(game, cmd);
        if (error) return refuse(error);
        const into = ownFleet(game, cmd, { id: cmd.into });
        if (into.error) return refuse(into.error);
        const other = into.fleet;
        if (other === fleet) return refuse("a fleet cannot merge into itself");
        if (fleet.moving || other.moving) return refuse("a fleet on its way cannot merge");
        if (fleet.zone !== other.zone || fleet.port !== other.port) return refuse(`fleets ${fleet.id} and ${other.id} are not in the same place`);
        for (const k of SHIPS) other.ships[k] += fleet.ships[k];
        other.since = Math.min(other.since, fleet.since);
        delete st.fleets[fleet.id];
        return done([{ type: "mergeFleet", day: st.day, fleet: fleet.id, owner: fleet.owner, into: other.id }]);
    },
};
