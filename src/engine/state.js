// The game state and its starting values (RULES.md §2). The state is plain JSON — a snapshot is the state as a
// string — and holds everything that changes; the map (map.js) holds what does not. Also the questions every
// other module asks of it: who owns a place, who is at war, where an army may go.

import { emptyMen, menOf } from "./army.js";
import { seedRandom } from "./random.js";

// bump when the same commands on the same seed would play out differently, or replays of older games break
export const RULES_VERSION = 1;
// bump when the shape of the state changes
export const FORMAT = 1;

export function initialState(map, seed) {
    const sc = map.scenario;
    const state = {
        format: FORMAT, rulesVersion: RULES_VERSION, seed, rng: seedRandom(seed), day: 0, nextId: 1,
        countries: {}, settlements: {}, armies: {}, wars: [], cooldowns: {},
    };
    for (const c of sc.countries) {
        // treasury x × pop × 2 (RULES.md §2)
        state.countries[c.code] = { code: c.code, name: c.name, capital: c.capital, treasury: sc.scaleX * c.pop * 2 };
    }
    for (const s of sc.settlements) {
        state.settlements[s.id] = { id: s.id, owner: s.country, pop: s.pop, cores: [s.country], walls: false, siege: null };
    }
    // a sword-armed garrison of pop ÷ 25 in every settlement, numbered like its settlement
    for (const s of [...sc.settlements].sort((a, b) => a.id - b.id)) {
        const men = emptyMen();
        men.swords = s.pop / 25;
        state.armies[s.id] = makeArmy(s.id, s.country, String(s.id), men);
        state.nextId = Math.max(state.nextId, s.id + 1);
    }
    return state;
}

function makeArmy(id, owner, at, men, cannons = 0, crew = 0) {
    return { id, owner, men, cannons, crew, at, march: null, path: [], storm: false, retreating: false, relief: false, arrived: 0 };
}

export function newArmy(state, owner, at, men, cannons = 0, crew = 0) {
    const army = makeArmy(state.nextId++, owner, at, men, cannons, crew);
    state.armies[army.id] = army;
    return army;
}

export function removeArmy(state, army) {
    delete state.armies[army.id];
}

export const isAlive = (state, army) => state.armies[army.id] === army;

// every army, in id order (the state's object keys are whole numbers, which JavaScript keeps in order)
export const armyList = (state) => Object.values(state.armies);
export const armiesAt = (state, key) => armyList(state).filter((a) => a.at === key);

export const warKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const atWar = (state, a, b) => a !== b && state.wars.includes(warKey(a, b));

// a place's owner: a settlement's, or for a pass the owner of the settlement whose land it lies in (RULES.md §8)
export const ownerOf = (game, key) => game.state.settlements[game.map.nodes.get(key).land].owner;

// neutral land is closed (RULES.md §10): an army may enter its own country's land or an enemy's. Subjects,
// allies and military access come with diplomacy (milestone 4).
export function canEnter(game, country, key) {
    const owner = ownerOf(game, key);
    return owner === country || atWar(game.state, country, owner);
}

// casualties cost population, spread over the country's settlements by their pop (RULES.md §2)
export function killPeople(state, country, n) {
    if (n <= 0) return;
    const owned = Object.values(state.settlements).filter((s) => s.owner === country);
    const total = owned.reduce((t, s) => t + s.pop, 0);
    if (total <= 0) return;
    for (const s of owned) s.pop = Math.max(0, s.pop - n * s.pop / total);
}

export const soldiersOf = (state, country) => armyList(state).filter((a) => a.owner === country).reduce((n, a) => n + menOf(a) + a.crew, 0);
