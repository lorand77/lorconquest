// What a player may see of a game (design.md, "Messages"), and what changed since the last day. The map, every
// army and fleet, the sharpshooter posts and the wars are public, and so is a settlement with its buildings; a
// country's money, bank, loans, tax, slider, law, research, reserve and queues are private to it. Never the random
// state or the seed: with them the dice could be foreseen. Diplomacy is public — agreements, wars and how they
// stand, subjects, warmonger scores, the winner — except the questions waiting for a human's answer, which only the
// two countries concerned see. Runs in the game's worker.

// the public part of a country
const publicCountry = (c) => ({ code: c.code, name: c.name, capital: c.capital, rebel: c.rebel, of: c.of, warmonger: c.warmonger, overlord: c.overlord, subjectKind: c.subjectKind });
// the private part, for its own player
const PRIVATE = ["treasury", "bank", "loans", "noBorrowUntil", "debtSince", "tax", "taxSum", "harvest", "slider", "law", "lawDay", "techs", "target", "r", "reserve", "training", "hires"];
const privateCountry = (c, state) => ({
    ...Object.fromEntries(PRIVATE.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])),
    ...(c.rebel ? {} : { offers: state.offers.filter((o) => o.to === c.code || o.from === c.code) }),
});

// everything `country` may see: the state without the dice, with its own country's private part
export function viewFor(state, country) {
    const countries = {};
    for (const c of Object.values(state.countries)) countries[c.code] = c.code === country ? { ...publicCountry(c), ...privateCountry(c, state) } : publicCountry(c);
    return {
        day: state.day, countries, settlements: state.settlements, armies: state.armies, fleets: state.fleets, posts: state.posts, wars: state.wars,
        agreements: state.agreements, warInfo: state.warInfo, memory: state.memory, humans: state.humans, winner: state.winner,
    };
}

// Each day, only what changed: { pub, priv }. pub — { day, armies, fleets, settlements, countries, posts: { id: value |
// null }, wars }, with only the parts that changed; priv — { code: private part } for countries whose private part
// changed. Something removed is null.
export class Changes {
    constructor(state) {
        this.seen = { armies: new Map(), fleets: new Map(), settlements: new Map(), countries: new Map(), posts: new Map(), priv: new Map(), wars: "", blobs: new Map() };
        this.next(state);
    }

    next(state) {
        const pub = { day: state.day }, priv = {};
        const diff = (name, items, part = (x) => x) => {
            const seen = this.seen[name], out = {};
            let any = false;
            for (const [id, item] of Object.entries(items)) {
                const json = JSON.stringify(part(item));
                if (seen.get(id) !== json) { seen.set(id, json); out[id] = JSON.parse(json); any = true; }
            }
            for (const id of [...seen.keys()]) if (!(id in items)) { seen.delete(id); out[id] = null; any = true; }
            return any ? out : null;
        };
        for (const [name, items, part] of [["armies", state.armies], ["fleets", state.fleets], ["settlements", state.settlements], ["countries", state.countries, publicCountry], ["posts", state.posts]]) {
            const d = diff(name, items, part);
            if (d) pub[name] = d;
        }
        const wars = JSON.stringify(state.wars);
        if (wars !== this.seen.wars) { this.seen.wars = wars; pub.wars = [...state.wars]; }
        // small whole things sent whole when they change
        for (const name of ["agreements", "warInfo", "memory", "winner"]) {
            const json = JSON.stringify(state[name]);
            if (this.seen.blobs.get(name) !== json) { this.seen.blobs.set(name, json); pub[name] = JSON.parse(json); }
        }
        for (const c of Object.values(state.countries)) {
            const json = JSON.stringify(privateCountry(c, state));
            if (this.seen.priv.get(c.code) !== json) { this.seen.priv.set(c.code, json); priv[c.code] = privateCountry(c, state); }
        }
        return { pub, priv };
    }
}
