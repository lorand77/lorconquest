// Answers remembered while nothing changes (design.md, The computer players): the computer players think on a state that stands
// still — they only read it and give commands, which the game applies on the next tick — so a country's economy, its military
// power, its neighbours and the scores, asked for again and again by every country that thinks that day, need working out only
// once. `withMemo` turns the memory on for the length of a call and forgets it after; outside one, nothing is remembered, and
// every answer is worked out afresh, as the commands and the screen need. What is remembered is handed out as a copy, so a caller
// that sorts or changes its answer changes nothing for the next.
let cache = null;

// `fn()` with the memory on; a call within a call shares the outer one's
export function withMemo(fn) {
    if (cache) return fn();
    cache = new Map();
    try { return fn(); } finally { cache = null; }
}

const copy = (v) => (Array.isArray(v) ? v.slice() : v && typeof v === "object" ? { ...v } : v);

// a table worked out once while the memory is on and handed out as it is, not copied — for the helpers that copy what they give
// out of it (state.js: armiesOf, armiesAt, fleetsOf, settlementsOf; relations.js: subjectsOf); null outside one
export function memoTable(name, compute) {
    if (!cache) return null;
    const k = `${name}|`;
    if (!cache.has(k)) cache.set(k, compute());
    return cache.get(k);
}

// the answer to `name` for `key`: remembered while the memory is on, worked out by `compute` otherwise or the first time
export function memo(name, key, compute) {
    if (!cache) return compute();
    const k = `${name}|${key}`;
    if (!cache.has(k)) cache.set(k, compute());
    return copy(cache.get(k));
}
