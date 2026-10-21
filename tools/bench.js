// How long a game day takes with the whole map at war (docs/plan.md, milestone 1): every country declares war on
// a neighbour, and every few days every idle army is sent somewhere random it may go. Prints the time per day,
// to set against the 100 ms a day has in play.
//
//   node tools/bench.js [--years 10] [--seed 1]
import { Game, armyList, canEnter, menOf } from "../src/engine/index.js";
import scenario from "../scenarios/mitteleuropa/scenario.json" with { type: "json" };

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : dflt; };
const years = arg("years", 10), seed = arg("seed", 1);
const game = Game.create(scenario, { seed });

// the bench's own dice, apart from the game's
let r = seed >>> 0;
const rand = () => { r = (r + 0x6d2b79f5) >>> 0; let t = Math.imul(r ^ (r >>> 15), r | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rand() * list.length)];

// every country declares war on a random neighbour
for (const c of scenario.countries) {
    const near = new Set();
    for (const id of c.settlements) for (const e of game.map.adj.get(String(id))) {
        const o = game.state.settlements[game.map.nodes.get(e.to).land].owner;
        if (o !== c.code) near.add(o);
    }
    if (near.size) game.command({ type: "declareWar", country: c.code, target: pick([...near].sort()) });
}

// send an idle army one to three places away, somewhere it may go
function orders() {
    for (const a of armyList(game.state)) {
        if (!a.at || a.retreating || rand() > 0.3) continue;
        let k = a.at;
        for (let hops = 1 + Math.floor(rand() * 3); hops > 0; hops--) {
            const next = game.map.adj.get(k).map((e) => e.to).filter((t) => canEnter(game, a.owner, t));
            if (!next.length) break;
            k = pick(next);
        }
        if (k !== a.at) game.command({ type: "move", country: a.owner, army: a.id, to: k, storm: rand() < 0.2 });
    }
}

const times = [];
let events = 0;
const t0 = process.hrtime.bigint();
for (let d = 0; d < years * 365; d++) {
    const t = process.hrtime.bigint();
    if (d % 10 === 0) orders();
    events += game.advance().length;
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
}
const total = Number(process.hrtime.bigint() - t0) / 1e6;
times.sort((a, b) => a - b);
const at = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
const armies = armyList(game.state);
console.log(`${years} years (${times.length} days) in ${(total / 1000).toFixed(2)} s, ${game.state.wars.length} wars, ${events} events`);
console.log(`per day: mean ${(total / times.length).toFixed(3)} ms, median ${at(0.5).toFixed(3)} ms, 99% ${at(0.99).toFixed(3)} ms, max ${times[times.length - 1].toFixed(3)} ms (budget 100 ms)`);
console.log(`at the end: ${armies.length} armies, ${armies.reduce((n, a) => n + menOf(a), 0).toLocaleString("en-GB")} men, ${armies.filter((a) => a.march).length} on the march`);
