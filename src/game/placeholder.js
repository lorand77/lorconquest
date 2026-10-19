// Placeholder computer countries (docs/plan.md, milestone 2). Until the real AI (milestone 5), every country
// without a human gives random legal orders on the real AI's staggered schedule — each thinks every 10-20 days,
// on days of its own — so the live loop carries a realistic load. Its dice are its own, seeded from the game's
// seed, the country and the day, never the game's state.rng: its orders are logged like anyone's, and a replay
// applies them without running it. Its schedule depends on nothing but the day, so a restarted game picks it up.
import { armyList, atWar, canEnter } from "../engine/index.js";

function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

function dice(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// does `country` think on `day`? every 10-20 days, its own period and offset
export function thinksOn(country, day) {
    const period = 10 + (hash(country) % 11), offset = hash(`${country}*`) % period;
    return (day + offset) % period === 0;
}

// the orders the placeholder countries give at the end of `game.day`, to be applied at the start of the next
export function placeholderOrders(game, humans) {
    const st = game.state, orders = [];
    for (const country of Object.keys(st.countries)) {
        if (humans.includes(country) || !thinksOn(country, st.day)) continue;
        const r = dice(hash(`${st.seed}:${country}:${st.day}`));
        const pick = (list) => list[Math.floor(r() * list.length)];
        // now and then a war on a neighbour
        if (r() < 0.005) {
            const near = new Set();
            for (const a of armyList(st)) {
                if (a.owner !== country || !a.at) continue;
                for (const e of game.map.adj.get(a.at)) {
                    const o = st.settlements[game.map.nodes.get(e.to).land].owner;
                    if (o !== country && !atWar(st, country, o)) near.add(o);
                }
            }
            if (near.size) orders.push({ type: "declareWar", country, target: pick([...near].sort()) });
        }
        // some of its idle armies set off one to three places away
        for (const a of armyList(st)) {
            if (a.owner !== country || !a.at || a.retreating || r() > 0.3) continue;
            let k = a.at;
            for (let hops = 1 + Math.floor(r() * 3); hops > 0; hops--) {
                const next = game.map.adj.get(k).map((e) => e.to).filter((t) => canEnter(game, country, t));
                if (!next.length) break;
                k = pick(next);
            }
            if (k !== a.at) orders.push({ type: "move", country, army: a.id, to: k, storm: r() < 0.2 });
        }
    }
    return orders;
}
