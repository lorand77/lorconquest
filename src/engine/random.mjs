// Seeded random numbers kept in the game state (state.rng), so a game replays exactly from its seed and its
// commands, and a snapshot carries on where it left off. mulberry32: one 32-bit word of state. The engine never
// uses Math.random.

export function seedRandom(seed) {
    return Number(seed) >>> 0;
}

// a number in [0, 1); advances state.rng
export function random(state) {
    state.rng = (state.rng + 0x6d2b79f5) >>> 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const d6 = (state) => Math.floor(random(state) * 6) + 1;

// every battle's factor (RULES.md §5): two dice plus 4, so 6-16
export const battleRoll = (state) => d6(state) + d6(state) + 4;
