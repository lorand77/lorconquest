// The one validator for player actions (design.md §3): every command a human, a computer player or a caretaker
// gives goes through applyCommand, which checks it against the state as it is now and applies it, or refuses it
// with a reason. `country` is the country giving the command, which the server has already checked is theirs.
//
//   { type: "declareWar", country, target }
//   { type: "move", country, army, to, storm }     to a settlement id or pass id; storm: storm it on arrival
//   { type: "stop", country, army }                halt at the next place
//   { type: "besiege", country, army }
//   { type: "storm", country, army }
//   { type: "sortie", country, army }
//   { type: "split", country, army, men: { swords: 200, ... }, cannons, crew }
//   { type: "merge", country, army, into }

import { CREW_PER_CANNON, WEAPONS, emptyMen, menOf } from "./army.mjs";
import { mayFight } from "./battle.mjs";
import { settle, situation, sortie, storm } from "./fighting.mjs";
import { follow, routeFor } from "./movement.mjs";
import { atWar, newArmy, removeArmy, warKey } from "./state.mjs";

const refuse = (error) => ({ ok: false, error });
const done = (events = []) => ({ ok: true, events });
const whole = (n) => Number.isInteger(n) && n >= 0;

// the army a command names, if it is the country's and free to take orders
function ownArmy(game, cmd, { atPlace = false } = {}) {
    const army = game.state.armies[cmd.army];
    if (!army) return { error: `no army ${cmd.army}` };
    if (army.owner !== cmd.country) return { error: `army ${army.id} is not ${cmd.country}'s` };
    if (army.retreating) return { error: `army ${army.id} is retreating and takes no orders` };
    if (atPlace && !army.at) return { error: `army ${army.id} is on the march` };
    return { army };
}

const COMMANDS = {
    declareWar(game, cmd) {
        const st = game.state;
        if (!st.countries[cmd.target]) return refuse(`no country ${cmd.target}`);
        if (cmd.target === cmd.country) return refuse("a country cannot declare war on itself");
        if (atWar(st, cmd.country, cmd.target)) return refuse(`${cmd.country} is already at war with ${cmd.target}`);
        st.wars.push(warKey(cmd.country, cmd.target));
        st.wars.sort();
        return done([{ type: "war", day: st.day, country: cmd.country, target: cmd.target }]);
    },

    move(game, cmd) {
        const { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        const to = String(cmd.to);
        if (!game.map.nodes.has(to)) return refuse(`no place ${cmd.to}`);
        if (army.at === to) return refuse(`army ${army.id} is already at ${to}`);
        const found = routeFor(game, army, to);
        if (!found) return refuse(`army ${army.id} has no way to ${to} through land it may enter`);
        const left = army.at, events = [];
        army.relief = false;
        follow(game, army, found.path);
        army.storm = Boolean(cmd.storm);
        if (left) settle(game, left, events);              // a siege it leaves may be lifted
        return done(events);
    },

    stop(game, cmd) {
        const { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        army.path = [];
        army.storm = false;
        return done();
    },

    besiege(game, cmd) {
        const { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const { s, garrison } = situation(game, army.at);
        if (!s || !atWar(game.state, army.owner, s.owner) || !garrison.length) return refuse(`army ${army.id} is not at an enemy settlement with a garrison`);
        const events = [];
        settle(game, army.at, events);
        return done(events);
    },

    storm(game, cmd) {
        const { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const { s, garrison, hostile } = situation(game, army.at);
        if (!s || !atWar(game.state, army.owner, s.owner) || !garrison.length) return refuse(`army ${army.id} is not at an enemy settlement with a garrison`);
        if (!mayFight(game.state, hostile.filter((a) => a.owner === army.owner), garrison)) return refuse("these armies fought less than 3 months ago");
        const events = [];
        storm(game, army.owner, army.at, events);
        return done(events);
    },

    sortie(game, cmd) {
        const { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const { s, garrison, hostile } = situation(game, army.at);
        if (!s || s.owner !== army.owner || !s.siege || !hostile.length) return refuse(`army ${army.id} is not in a besieged settlement of its own`);
        if (!garrison.includes(army)) return refuse(`army ${army.id} is outside the walls`);
        if (!mayFight(game.state, garrison, hostile)) return refuse("these armies fought less than 3 months ago");
        const events = [];
        sortie(game, army.at, events);
        return done(events);
    },

    split(game, cmd) {
        const { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const men = emptyMen(), cannons = cmd.cannons ?? 0, crew = cmd.crew ?? 0;
        for (const [w, n] of Object.entries(cmd.men ?? {})) {
            if (!WEAPONS.includes(w)) return refuse(`no weapon ${w}`);
            if (!whole(n) || n > army.men[w]) return refuse(`army ${army.id} has ${army.men[w]} ${w}, not ${n}`);
            men[w] = n;
        }
        if (!whole(cannons) || cannons > army.cannons) return refuse(`army ${army.id} has ${army.cannons} cannons`);
        if (!whole(crew) || crew > army.crew) return refuse(`army ${army.id} has ${army.crew} crew`);
        const taken = menOf({ men }) + cannons + crew;
        if (!taken) return refuse("nothing to split off");
        if (taken === menOf(army) + army.cannons + army.crew) return refuse("that is the whole army");
        if (cannons * CREW_PER_CANNON > crew || (army.cannons - cannons) * CREW_PER_CANNON > army.crew - crew) return refuse(`every cannon needs ${CREW_PER_CANNON} crew`);
        for (const w of WEAPONS) army.men[w] -= men[w];
        army.cannons -= cannons;
        army.crew -= crew;
        const part = newArmy(game.state, army.owner, army.at, men, cannons, crew);
        part.relief = army.relief;
        part.arrived = army.arrived;
        return done([{ type: "split", day: game.state.day, army: army.id, owner: army.owner, into: part.id }]);
    },

    merge(game, cmd) {
        const { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const into = ownArmy(game, { ...cmd, army: cmd.into }, { atPlace: true });
        if (into.error) return refuse(into.error);
        if (into.army === army) return refuse("an army cannot merge into itself");
        if (into.army.at !== army.at) return refuse(`armies ${army.id} and ${into.army.id} are not in the same place`);
        if (into.army.relief !== army.relief) return refuse("one army is inside the walls and the other outside");
        for (const w of WEAPONS) into.army.men[w] += army.men[w];
        into.army.cannons += army.cannons;
        into.army.crew += army.crew;
        into.army.arrived = Math.min(into.army.arrived, army.arrived);
        removeArmy(game.state, army);
        return done([{ type: "merge", day: game.state.day, army: army.id, owner: army.owner, into: into.army.id }]);
    },
};

export const COMMAND_TYPES = Object.keys(COMMANDS);

export function applyCommand(game, cmd) {
    if (!cmd || typeof cmd !== "object" || !Object.hasOwn(COMMANDS, cmd.type)) return refuse(`unknown command ${cmd && cmd.type}`);
    if (!game.state.countries[cmd.country]) return refuse(`no country ${cmd.country}`);
    return COMMANDS[cmd.type](game, cmd);
}
