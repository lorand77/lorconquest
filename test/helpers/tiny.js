// A tiny scenario for engine tests, small enough to work out by hand:
//
//        AAA                      BBB            CCC
//   1 city, river ---73--- 2 ---110--- 4 city ---37--- 6
//        |                                \
//       37                                 73
//        |                                  \
//        3 ---91--- P1 (pass, land of 3) ---91--- 5
//        3 - - - - - - strait (zone "north", 91 days) - - - - - - 6
//
// Numbers are marching days. Settlement 3 is AAA's, 5 BBB's, 6 CCC's. Every settlement starts with its garrison
// of pop ÷ 25 swords (400 in a town, 800 in a city), numbered like the settlement. 1 is a port in the sea zone
// "north", 4 a port in "south"; the zones are next to each other; the strait 3-6 lies in "north". No country has
// ships at the start. AAA's capital is 1, BBB's 4, CCC's 6. The region "AAA lands" is 1, 2 and 3.
import { Game } from "../../src/engine/index.js";
import { d6 } from "../../src/engine/random.js";
import { newFleet } from "../../src/engine/state.js";

// [id, name, country, type, on a river, sea zone if a port]
const SETTLEMENTS = [
    [1, "One", "AAA", "city", true, "north"], [2, "Two", "AAA", "town", false], [3, "Three", "AAA", "town", false],
    [4, "Four", "BBB", "city", false, "south"], [5, "Five", "BBB", "town", false], [6, "Six", "CCC", "town", false],
];
// [from, to, days, pass, days of the second leg]
const ROUTES = [[1, 2, 73], [1, 3, 37], [2, 4, 110], [3, 5, 91, "P1", 91], [4, 5, 73], [4, 6, 37]];

function tinyScenario() {
    const settlements = SETTLEMENTS.map(([id, name, country, type, river, zone]) => ({
        id, name, country, type, pop: type === "city" ? 20000 : 10000, port: Boolean(zone), river, hre: false,
        x: id * 100, y: 100, land: `land-${id}`, seaZone: zone ?? null, borders: [], straits: [],
    }));
    const countries = [...new Set(settlements.map((s) => s.country))].map((code) => {
        const own = settlements.filter((s) => s.country === code);
        const pop = own.reduce((n, s) => n + s.pop, 0);
        const capital = { AAA: 1, BBB: 4, CCC: 6 }[code];
        return { code, name: code, capital, settlements: own.map((s) => s.id), pop, army: pop / 25, ships: 0, hre: "none" };
    });
    const routes = ROUTES.map(([from, to, days, pass, days2]) => ({
        id: `route-${from}-${to}`, from, to, type: "land", length: 0, crossesRiver: false, seaZone: null, points: [],
        pass: pass ?? null,
        years: pass ? (days + days2) / 365 : days / 365,
        legs: pass ? [{ length: 0, years: days / 365 }, { length: 0, years: days2 / 365 }] : null,
    }));
    routes.push({ id: "route-3-6", from: 3, to: 6, type: "strait", length: 300, years: null, legs: null, pass: null, seaZone: "north", crossesRiver: false, points: [[300, 100], [600, 100]] });
    const seaZones = [
        { id: "north", name: "North", label: { x: 100, y: 20 }, ports: [1], straits: ["3-6"], next: ["south"] },
        { id: "south", name: "South", label: { x: 400, y: 20 }, ports: [4], straits: [], next: ["north"] },
    ];
    const formables = [{ id: "aaa-lands", name: "AAA lands", settlements: [1, 2, 3] }];
    return {
        scaleX: 1, armySpeed: 480, fleetHopMonths: 2, straitShips: 10, map: { svg: "map.svg", width: 800, height: 300 },
        countries, settlements, routes, passes: [{ id: "P1", x: 350, y: 200, land: 3, routes: ["3-5"] }], seaZones, formables,
    };
}

const tinyGame = (seed = 1) => Game.create(tinyScenario(), { seed });

// set what an army is made of: { swords: 1000, pikes: 500, cannons: 10, crew: 100 }
function setArmy(game, id, parts) {
    const army = game.state.armies[id];
    for (const w of Object.keys(army.men)) army.men[w] = 0;
    for (const [k, n] of Object.entries(parts)) {
        if (k === "cannons" || k === "crew") army[k] = n;
        else army.men[k] = n;
    }
    return army;
}

// advance until `day`, collecting every event
function runTo(game, day) {
    const events = [];
    while (game.day < day) events.push(...game.advance());
    return events;
}

// a command that must be accepted
function order(game, cmd) {
    const r = game.command(cmd);
    if (!r.ok) throw new Error(`refused: ${r.error}`);
    return r.events;
}

// load the dice: the next d6 rolls the game makes come up `faces`, in order (a battle rolls two for its attacker,
// two for its defender, then a storm's escape roll). Finds a random state that rolls them.
function rig(game, ...faces) {
    for (let s = 0; s < 1e7; s++) {
        const st = { rng: s };
        if (faces.every((f) => d6(st) === f)) { game.state.rng = s; return; }
    }
    throw new Error(`no random state rolls ${faces}`);
}

// a fleet of `ships` ({ cogs: 12 }) for `owner`, in port `port` or, with port null, at sea in `zone`
function giveFleet(game, owner, ships, port = 1, zone = "north") {
    return newFleet(game.state, owner, ships, port, zone);
}

// a refused command's error; the command must be refused
function refused(game, cmd) {
    const r = game.command(cmd);
    if (r.ok) throw new Error(`accepted: ${JSON.stringify(cmd)}`);
    return r.error;
}

export { tinyScenario, tinyGame, setArmy, runTo, order, rig, giveFleet, refused };
