// AI-only games, headless, as fast as the machine allows (docs/plan.md, milestone 5): every country is played by the
// computer players of src/ai, as in the live game (orders given at the end of a day are applied at the start of the next).
// Prints for each game who won, when and how (reaching the scenario's number of settlements, or on time: the most at the end
// year), and what happened, then the win rates by country, the commands the game refused, and
// the time a game day took. What it shows goes into experiments/.
//
//   node tools/simulate.js [--games 8] [--years 210] [--seed 1] [--scenario mitteleuropa] [--jobs 4] [--quiet]
//
// --scenario is a folder of scenarios/ (or a path to one). For experiments, --without characters and/or --without rivalries
// play the scenario as if it gave none (characters are then rolled at random, as for a scenario without them).
//
// --years stops a game early (the scenario's own end is 1650); --jobs plays games on worker threads at once.
import fs from "node:fs";
import path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { Game, armyList, formatDate, isRebel, scores } from "../src/engine/index.js";
import { createAI } from "../src/ai/index.js";

const root = path.join(import.meta.dirname, "..");

// one game to its end; the figures worth keeping
export function simulate(scenario, { seed, years }) {
    const game = Game.create(scenario, { seed, humans: [] }), ai = createAI({ seed, humans: [] });
    const count = { war: 0, joins: 0, peace: 0, capture: 0, battle: 0, uprising: 0, agreement: 0, subject: 0, empire: 0, bankruptcy: 0, eliminated: 0 };
    const refused = {}, starts = {}, aiMs = [], dayMs = [];
    let lastWar = 0, how = null;
    const end = Math.min(years * 365, 1e9);
    let pending = [];
    while (game.day < end && !game.state.winner) {
        // as in the worker's tick: the orders given at the end of the last day, then the day, then the new orders
        const t0 = performance.now(), events = [];
        for (const o of pending) {
            const r = game.command({ ...o.cmd, country: o.country });
            if (r.ok) events.push(...r.events);
            else {
                const k = o.cmd.type;
                if (process.env.SIM_DEBUG) console.log(`day ${game.day} ${o.country} ${JSON.stringify(o.cmd)}: ${r.error}`);
                refused[k] ??= { n: 0, example: r.error };
                refused[k].n++;
            }
        }
        events.push(...game.advance());
        const t1 = performance.now();
        for (const e of events) {
            if (e.type in count) count[e.type]++;
            if (e.type === "war") { starts[e.country] = (starts[e.country] ?? 0) + 1; lastWar = game.day; }
            if (e.type === "victory") how = e.why === "end" ? "time" : "reached";
        }
        pending = game.state.winner ? [] : ai.orders(game, events);
        const t2 = performance.now();
        dayMs.push(t1 - t0);
        aiMs.push(t2 - t1);
    }
    const st = game.state, table = scores(st);
    const owned = Object.entries(table).map(([code, s]) => ({ code, ...s })).sort((a, b) => b.settlements - a.settlements || b.pop - a.pop);
    const armies = armyList(st);
    return {
        seed, day: game.day, date: formatDate(game.day), winner: st.winner?.country ?? st.winner ?? null, over: Boolean(st.winner), how,
        count, starts, refused, top: owned.slice(0, 5), alive: owned.filter((o) => o.settlements > 0).length,
        wars: st.wars.length, warsAtEnd: st.wars.filter((w) => !w.split("|").some((c) => isRebel(st, c))).length, armies: armies.length, lastWar,
        aiMean: aiMs.reduce((a, b) => a + b, 0) / aiMs.length, aiMax: Math.max(...aiMs), dayMean: dayMs.reduce((a, b) => a + b, 0) / dayMs.length,
        aiSamples: Float32Array.from(aiMs),                // every day's time, to pool across games for the percentiles
    };
}

const loadScenario = (name, without = []) => {
    const dir = fs.existsSync(path.join(root, name, "scenario.json")) ? path.join(root, name) : path.join(root, "scenarios", name);
    const sc = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
    if (without.includes("characters")) for (const c of sc.countries) delete c.character;
    if (without.includes("rivalries")) sc.rivalries = [];
    return sc;
};

if (isMainThread) {
    const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
    if (import.meta.filename === process.argv[1]) {
        const games = Number(arg("games", 8)), years = Number(arg("years", 210)), seed0 = Number(arg("seed", 1)), jobs = Number(arg("jobs", 1));
        const scenarioName = arg("scenario", "mitteleuropa"), quiet = process.argv.includes("--quiet");
        const without = process.argv.flatMap((a, i) => (process.argv[i - 1] === "--without" ? [a] : []));
        const seeds = Array.from({ length: games }, (_, i) => seed0 + i), results = [];
        const t0 = performance.now();
        const run = async () => {
            const lanes = Array.from({ length: Math.max(1, jobs) }, async () => {
                while (seeds.length) {
                    const seed = seeds.shift();
                    const result = jobs > 1
                        ? await new Promise((resolve, reject) => {
                            const w = new Worker(import.meta.filename, { workerData: { seed, years, scenarioName, without } });
                            w.once("message", resolve);
                            w.once("error", reject);
                        })
                        : simulate(loadScenario(scenarioName, without), { seed, years });
                    results.push(result);
                    if (!quiet) console.log(`seed ${result.seed}: ${result.over ? `${result.winner} won ${result.how === "time" ? "on time" : "by reaching the target"}` : "no winner"} ${result.date} | ${result.count.war} wars, ${result.count.peace} peaces, ${result.count.capture} captures | top ${result.top.slice(0, 3).map((t) => `${t.code} ${t.settlements}`).join(", ")} | ai ${result.aiMean.toFixed(2)} ms/day (max ${result.aiMax.toFixed(0)})`);
                }
            });
            await Promise.all(lanes);
        };
        await run();
        report(results.sort((a, b) => a.seed - b.seed), (performance.now() - t0) / 1000);
    }
} else {
    parentPort.postMessage(simulate(loadScenario(workerData.scenarioName, workerData.without), workerData));
}

function report(results, seconds) {
    const n = results.length, sum = (f) => results.reduce((a, r) => a + f(r), 0);
    console.log(`\n${n} games in ${seconds.toFixed(1)} s`);
    const wins = {};
    for (const r of results) if (r.over) wins[r.winner] = (wins[r.winner] ?? 0) + 1;
    console.log(`games with a winner: ${sum((r) => (r.over ? 1 : 0))} of ${n}; wins: ${Object.entries(wins).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(", ") || "none"}`);
    const reached = results.filter((r) => r.how === "reached"), onTime = results.filter((r) => r.how === "time");
    const list = (rs) => rs.map((r) => `${r.winner} ${r.date.slice(0, 4)}`).join(", ") || "none";
    console.log(`by reaching the target: ${reached.length} (${list(reached)}); on time: ${onTime.length}`);
    const avg = (f) => (sum(f) / n).toFixed(1);
    console.log(`per game: ${avg((r) => r.count.war)} wars declared (+${avg((r) => r.count.joins)} joined), ${avg((r) => r.count.peace)} peaces, ${avg((r) => r.count.capture)} captures, ${avg((r) => r.count.battle)} battles, ${avg((r) => r.count.agreement)} agreements, ${avg((r) => r.count.subject)} subjects, ${avg((r) => r.count.uprising)} uprisings, ${avg((r) => r.count.bankruptcy)} bankruptcies, ${avg((r) => r.count.eliminated)} countries eliminated, ${avg((r) => r.alive)} left`);
    const starters = {};
    for (const r of results) for (const [c, k] of Object.entries(r.starts)) starters[c] = (starters[c] ?? 0) + k;
    console.log(`wars declared by: ${Object.entries(starters).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, k]) => `${c} ${k}`).join(", ")}`);
    const refused = {};
    for (const r of results) for (const [k, v] of Object.entries(r.refused)) { refused[k] ??= { n: 0, example: v.example }; refused[k].n += v.n; }
    const rows = Object.entries(refused).sort((a, b) => b[1].n - a[1].n);
    console.log(rows.length ? `refused commands (per game): ${rows.map(([k, v]) => `${k} ${(v.n / n).toFixed(1)} ("${v.example}")`).join("; ")}` : "no command was refused");
    // the AI's time for a whole day — every country that thinks that day, together — over every day of every game
    const all = Float32Array.from(results.flatMap((r) => [...r.aiSamples])).sort();
    const at = (q) => all[Math.min(all.length - 1, Math.floor(q * all.length))].toFixed(2);
    console.log(`time: AI a day (all countries thinking that day together), over ${all.length} days: mean ${avg((r) => r.aiMean)} ms, median ${at(0.5)}, p95 ${at(0.95)}, p99 ${at(0.99)}, slowest ${all[all.length - 1].toFixed(0)} ms; engine ${avg((r) => r.dayMean)} ms a day (budget 100)`);
}

