// The game state and its starting values (RULES.md §2). The state is plain JSON — a snapshot is the state as a
// string — and holds everything that changes; the map (map.js) holds what does not. Also the questions every
// other module asks of it: who owns a place, who is at war, where an army may go.

import { emptyMen } from "./army.js";
import { START_TECHS } from "./costs.js";
import { seedRandom } from "./random.js";
import { friendly, grantsAccess } from "./relations.js";

// bump when the same commands on the same seed would play out differently, or replays of older games break
export const RULES_VERSION = 8;
// bump when the shape of the state changes
export const FORMAT = 5;

export function emptyReserve() {
    return { swords: 0, pikes: 0, cavalry: 0, handCannons: 0, arquebuses: 0, muskets: 0, cannons: 0 };
}

export function initialState(map, seed, humans = []) {
    const sc = map.scenario;
    const state = {
        format: FORMAT, rulesVersion: RULES_VERSION, seed, rng: seedRandom(seed), day: 0, nextId: 1,
        countries: {}, settlements: {}, armies: {}, fleets: {}, posts: {}, wars: [], cooldowns: {}, rebels: 0,
        // diplomacy (src/engine/diplomacy.js): who the humans are, agreements, a record of each war, what the world
        // remembers, questions waiting for a human's answer, and the winner once there is one
        humans: [...humans], agreements: [], warInfo: {}, memory: { lastWar: {}, broke: {}, refused: {}, proposed: {}, empire: {} },
        offers: [], offerSeq: 0, winner: null,
    };
    for (const c of sc.countries) {
        state.countries[c.code] = {
            code: c.code, name: c.name, capital: c.capital,
            // treasury x × pop × 2 (RULES.md §2)
            treasury: sc.scaleX * c.pop * 2, bank: 0, loans: 0, noBorrowUntil: 0, debtSince: null,
            tax: 2, taxSum: 0, harvest: false, slider: 50, law: "feudal", lawDay: null,
            techs: [...START_TECHS], target: null, r: 0, reserve: emptyReserve(), training: [], hires: [],
            warmonger: 0, overlord: null, subjectKind: null,
            // the day it lost its last settlement and was out of the game (elimination.js), or null
            out: null,
        };
    }
    for (const s of sc.settlements) {
        state.settlements[s.id] = {
            id: s.id, owner: s.country, pop: s.pop, cores: [s.country], heldSince: 0, siege: null,
            walls: false, library: false, workshop: false, market: false, courthouse: false,
        };
        state.nextId = Math.max(state.nextId, s.id + 1);
    }
    // a sword-armed garrison of pop ÷ 25 in every settlement, numbered like its settlement
    for (const s of [...sc.settlements].sort((a, b) => a.id - b.id)) {
        const men = emptyMen();
        men.swords = s.pop / 25;
        state.armies[s.id] = makeArmy(s.id, s.country, String(s.id), men);
    }
    // a coastal country's ships, as cogs in one fleet, in its capital's port or else its lowest-numbered port
    for (const c of sc.countries) {
        if (!c.ships) continue;
        const ports = sc.settlements.filter((s) => s.country === c.code && s.port).map((s) => s.id).sort((a, b) => a - b);
        if (!ports.length) continue;
        const port = ports.includes(c.capital) ? c.capital : ports[0];
        const f = makeFleet(state.nextId++, c.code, { cogs: c.ships }, port, map.nodes.get(String(port)).zone, 0);
        state.fleets[f.id] = f;
    }
    return state;
}

function makeArmy(id, owner, at, men, cannons = 0, crew = 0) {
    return { id, owner, men, mercs: 0, cannons, crew, at, march: null, path: [], storm: false, retreating: false, relief: false, arrived: 0 };
}

// a fleet is in a port (port is the settlement), or at sea (port null) in the sea zone `zone`; on its way to the
// next zone it has `moving`, and until it arrives it can neither fight, blockade nor be fought
export function makeFleet(id, owner, ships, port, zone, since) {
    return { id, owner, ships: { cogs: 0, carracks: 0, galleons: 0, menOfWar: 0, ...ships }, port, zone, since, order: null, moving: null };
}

export function newArmy(state, owner, at, men, cannons = 0, crew = 0, mercs = 0) {
    const army = makeArmy(state.nextId++, owner, at, men, cannons, crew);
    army.mercs = mercs;
    state.armies[army.id] = army;
    return army;
}

export function newFleet(state, owner, ships, port, zone) {
    const f = makeFleet(state.nextId++, owner, ships, port, zone, state.day);
    state.fleets[f.id] = f;
    return f;
}

export function removeArmy(state, army) {
    delete state.armies[army.id];
}

export const isAlive = (state, army) => state.armies[army.id] === army;

// every army, in id order (the state's object keys are whole numbers, which JavaScript keeps in order)
export const armyList = (state) => Object.values(state.armies);
export const fleetList = (state) => Object.values(state.fleets);
export const armiesAt = (state, key) => armyList(state).filter((a) => a.at === key);

export const warKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const atWar = (state, a, b) => a !== b && state.wars.includes(warKey(a, b));

// peasant rebels are a country of their own (src/engine/events.js), made of the people of `of`
export const isRebel = (state, code) => Boolean(state.countries[code]?.rebel);

// a place's owner: a settlement's, or for a pass the owner of the settlement whose land it lies in (RULES.md §8)
export const ownerOf = (game, key) => game.state.settlements[game.map.nodes.get(key).land].owner;

// is the settlement core for the country? Peasant rebels hold cores on everything (RULES.md §11).
export const isCore = (state, s, code) => s.cores.includes(code) || isRebel(state, code);

// neutral land is closed (RULES.md §10): an army may enter land that is its own country's, its subjects' or
// overlord's, its allies' (either kind), a country's that gives it military access, or an enemy's
export function canEnter(game, country, key) {
    const owner = ownerOf(game, key);
    return owner === country || atWar(game.state, country, owner) || friendly(game.state, country, owner) || grantsAccess(game.state, owner, country);
}

// is `b` a friend of `a`: the same country, an ally, a subject or an overlord
export const isFriend = (state, a, b) => friendly(state, a, b);

// casualties cost population, spread over the country's settlements by their pop (RULES.md §2). Rebels are people
// of the country they rose against.
export function killPeople(state, country, n) {
    if (n <= 0) return;
    country = state.countries[country]?.of ?? country;
    const owned = Object.values(state.settlements).filter((s) => s.owner === country);
    const total = owned.reduce((t, s) => t + s.pop, 0);
    if (total <= 0) return;
    for (const s of owned) s.pop = Math.max(0, s.pop - n * s.pop / total);
}
