// What a player may see of a game (design.md, "Messages"), and what changed since the last day. The map, every
// army and the wars are public; a country's treasury is private to it. Never the random state or the seed: with
// them the dice could be foreseen. Runs in the game's worker.

// the public part of a country
const publicCountry = (c) => ({ code: c.code, name: c.name, capital: c.capital });
// the private part, for its own player
const privateCountry = (c) => ({ treasury: c.treasury });

// everything `country` may see: the state without the dice, with its own country's private part
export function viewFor(state, country) {
    const countries = {};
    for (const c of Object.values(state.countries)) countries[c.code] = c.code === country ? { ...publicCountry(c), ...privateCountry(c) } : publicCountry(c);
    return { day: state.day, countries, settlements: state.settlements, armies: state.armies, wars: state.wars };
}

// Each day, only what changed: { pub, priv }. pub — { day, armies: { id: army | null }, settlements: { id: s },
// countries: { code: public part }, wars }, with only the parts that changed; priv — { code: private part } for
// countries whose private part changed. An army removed is null.
export class Changes {
    constructor(state) {
        this.seen = { armies: new Map(), settlements: new Map(), countries: new Map(), priv: new Map(), wars: "" };
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
        const armies = diff("armies", state.armies), settlements = diff("settlements", state.settlements);
        const countries = diff("countries", state.countries, publicCountry);
        if (armies) pub.armies = armies;
        if (settlements) pub.settlements = settlements;
        if (countries) pub.countries = countries;
        const wars = JSON.stringify(state.wars);
        if (wars !== this.seen.wars) { this.seen.wars = wars; pub.wars = [...state.wars]; }
        for (const c of Object.values(state.countries)) {
            const json = JSON.stringify(privateCountry(c));
            if (this.seen.priv.get(c.code) !== json) { this.seen.priv.set(c.code, json); priv[c.code] = privateCountry(c); }
        }
        return { pub, priv };
    }
}
