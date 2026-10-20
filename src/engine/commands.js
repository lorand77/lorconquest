// The one validator for player actions (design.md §3): every command a human, a computer player or a caretaker
// gives goes through applyCommand, which checks it against the state as it is now and applies it, or refuses it
// with a reason. `country` is the country giving the command, which the server has already checked is theirs.
//
// War and armies, here:
//   { type: "move", country, army, to, storm }     to a settlement id or pass id; storm: storm it on arrival
//   { type: "stop", country, army }                halt at the next place
//   { type: "besiege", country, army }    { type: "storm", country, army }    { type: "sortie", country, army }
//   { type: "stormPost", country, army }           storm the sharpshooter post at the pass the army is at
//   { type: "split", country, army, men: { swords: 200, ... }, cannons, crew }    { type: "merge", country, army, into }
// Running a country is in commands-country.js, fleets in commands-naval.js, diplomacy in commands-diplomacy.js.

import { CREW_PER_CANNON, WEAPONS, emptyMen, menOf } from "./army.js";
import { mayFight } from "./battle.js";
import { done, isPlayable, ownArmy, refuse, whole } from "./command-util.js";
import { countryCommands } from "./commands-country.js";
import { diplomacyCommands } from "./commands-diplomacy.js";
import { navalCommands } from "./commands-naval.js";
import { settle, situation, sortie, storm, stormThePost } from "./fighting.js";
import { follow, routeFor } from "./movement.js";
import { atWar, newArmy, removeArmy } from "./state.js";
import { isVassal } from "./relations.js";

const COMMANDS = {
    move(game, cmd) {
        const { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        const to = String(cmd.to);
        if (!game.map.nodes.has(to)) return refuse(`no place ${cmd.to}`);
        if (army.at === to) return refuse(`army ${army.id} is already at ${to}`);
        const found = routeFor(game, army, to);
        if (!found) return refuse(`army ${army.id} has no way to ${to} through land it may enter`);
        const left = army.at, events = [];
        if (!follow(game, army, found.path, events)) {
            // a strait it may not cross yet: refused if nothing happened, else a naval battle was fought
            if (events.length === 1 && events[0].type === "crossFailed") return refuse(`army ${army.id} cannot cross the strait: ${events[0].why}`);
            return done(events);
        }
        army.relief = false;
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

    stormPost(game, cmd) {
        const st = game.state, { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const post = st.posts[army.at];
        if (!post || !atWar(st, army.owner, post.owner)) return refuse(`army ${army.id} is not at a pass held by an enemy post`);
        const events = [];
        stormThePost(game, army.owner, army.at, events);
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
        // mercenaries go in proportion to the men taken
        const had = menOf(army), takenMen = menOf({ men });
        let mercs = army.mercs && had ? Math.round(army.mercs * takenMen / had) : 0;
        for (const w of WEAPONS) army.men[w] -= men[w];
        army.cannons -= cannons;
        army.crew -= crew;
        mercs = Math.min(mercs, army.mercs, takenMen);
        army.mercs = Math.min(army.mercs - mercs, menOf(army));
        const part = newArmy(game.state, army.owner, army.at, men, cannons, crew, mercs);
        part.relief = army.relief;
        part.arrived = army.arrived;
        return done([{ type: "split", day: game.state.day, army: army.id, owner: army.owner, into: part.id }]);
    },

    merge(game, cmd) {
        const { army, error } = ownArmy(game, cmd, { atPlace: true });
        if (error) return refuse(error);
        const into = ownArmy(game, cmd, { atPlace: true, id: cmd.into });
        if (into.error) return refuse(into.error);
        if (into.army === army) return refuse("an army cannot merge into itself");
        if (into.army.at !== army.at) return refuse(`armies ${army.id} and ${into.army.id} are not in the same place`);
        if (into.army.relief !== army.relief) return refuse("one army is inside the walls and the other outside");
        for (const w of WEAPONS) into.army.men[w] += army.men[w];
        into.army.cannons += army.cannons;
        into.army.crew += army.crew;
        into.army.mercs += army.mercs;
        into.army.arrived = Math.min(into.army.arrived, army.arrived);
        removeArmy(game.state, army);
        return done([{ type: "merge", day: game.state.day, army: army.id, owner: army.owner, into: into.army.id }]);
    },

    ...countryCommands,
    ...navalCommands,
    ...diplomacyCommands,
};

// a vassal has no diplomacy of its own: it cannot declare war, make agreements or sign peace (RULES.md §10)
const DIPLOMACY = ["declareWar", "proposePeace", "proposeAgreement", "breakAgreement", "cancelAccess", "demandSubject", "proposeEmpire"];

export const COMMAND_TYPES = Object.keys(COMMANDS);

export function applyCommand(game, cmd) {
    if (!cmd || typeof cmd !== "object" || !Object.hasOwn(COMMANDS, cmd.type)) return refuse(`unknown command ${cmd && cmd.type}`);
    if (!game.state.countries[cmd.country]) return refuse(`no country ${cmd.country}`);
    if (!isPlayable(game.state, cmd.country)) return refuse("peasant rebels take no orders");
    if (game.state.winner) return refuse("the game is over");
    if (DIPLOMACY.includes(cmd.type) && isVassal(game.state, cmd.country)) return refuse("a vassal has no diplomacy of its own: its overlord speaks for it");
    return COMMANDS[cmd.type](game, cmd);
}
