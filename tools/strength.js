// How strong the computer players are (experiments/README.md, 11): a candidate version of src/ai against a baseline one, in
// matched games on the same scenario, seeds and engine — the rules are always the working copy's, whichever computer players
// play by them, so a change of the AI is measured apart from a change of the rules. For each seed a control game, every country
// on the baseline, then a game for each test country with that country alone on the candidate: the country's outcome on the
// candidate less on the baseline, paired by seed and country. It asks "does the candidate make a country stronger?" with every
// opponent unchanged.
//
//   node tools/strength.js [--baseline HEAD] [--candidate working|<commit>] [--seeds 20] [--seed 101] [--years 210]
//       [--countries BAV,BRB,...] [--salt S] [--scenario mitteleuropa] [--jobs N] [--label x] [--report]
//
// Each game is written down as it ends, in experiments/strength/<label>.partial.jsonl — its first line the run's settings — so a
// run cut short (a restart of the container) loses only the games then being played: the same command again plays only the rest,
// and refuses if the settings (the versions, uncommitted changes and all) are not the same. --report prints what the games played
// so far say, playing none. The finished run is written whole, as <date>-<label>.json, and its partial file removed.
//
// --salt S changes the candidate's dice (its diplomacy's: util.js) and nothing else: with --candidate equal to the baseline it
// is the A/A test — the same computer players, a small difference in luck — whose spread is the noise any real difference must
// stand out from; without it the two play the very same games (test/tools/strength.test.js holds that true).
//
// Each game's outcome is taken when it ends — at the scenario's end year, at --years, or the day someone wins. The seeds are the
// evaluation's (101 on): tune on others (simulate.js plays 1 on). Everything is written to experiments/strength/, with the
// commits, the seeds and the countries.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { Game, fingerprint, scores } from "../src/engine/index.js";

const root = path.join(import.meta.dirname, "..");

// the fixed test countries (Balanced): the large and medium, inland and coastal — the small ones (Elsass-Lothringen, Jena,
// Hamburg) were dropped after section 12 of experiments/README.md: what changes the AI's play seldom reaches them, and their
// rows of zeros only pulled the average toward nothing
export const COUNTRIES = ["BAV", "BRB", "AUS", "SAX", "PRU", "GDA"];

// a version of src/ai: the working copy's, or a commit's, unpacked beside a link to the working copy's engine (Node follows the
// link to the real files, so both versions and the game share one engine)
export function aiAt(ref) {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root }).toString().trim();
    if (ref === "working") {
        const diff = execFileSync("git", ["diff", "HEAD", "--", "src/ai"], { cwd: root });
        const changed = diff.length ? `, src/ai changed (${createHash("sha256").update(diff).digest("hex").slice(0, 8)})` : "";
        return { dir: path.join(root, "src", "ai"), label: `the working copy (on ${head.slice(0, 7)}${changed})` };
    }
    const sha = execFileSync("git", ["rev-parse", ref], { cwd: root }).toString().trim();
    const base = path.join(os.tmpdir(), "lc-strength", sha), dir = path.join(base, "src", "ai");
    if (!fs.existsSync(path.join(dir, "index.js"))) {
        fs.mkdirSync(path.join(base, "src"), { recursive: true });
        execFileSync("tar", ["-x", "-C", base], { input: execFileSync("git", ["archive", sha, "src/ai"], { cwd: root }) });
    }
    const engine = path.join(base, "src", "engine");
    if (!fs.existsSync(engine)) fs.symlinkSync(path.join(root, "src", "engine"), engine, "dir");
    return { dir, label: `${ref} (${sha.slice(0, 7)})` };
}

// the game as a computer player with other dice sees it: its seed salted, all else the game itself
export function salted(game, salt) {
    if (!salt) return game;
    const state = new Proxy(game.state, { get: (t, k) => (k === "seed" ? `${t.seed}~${salt}` : Reflect.get(t, k)) });
    return Object.create(game, { state: { value: state } });
}

const loadScenario = (name) => {
    const dir = fs.existsSync(path.join(root, name, "scenario.json")) ? path.join(root, name) : path.join(root, "scenarios", name);
    return JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
};

// one game to its end: `country` on the candidate and every other on the baseline — or, with none, all on the baseline (the
// control). `ai`: { base, cand }, the two versions' modules. Every country's outcome is kept.
export function play({ scenario, seed, years, ai, country = null, salt = "" }) {
    const game = Game.create(scenario, { seed, humans: [] }), st = game.state, codes = Object.keys(st.countries);
    // each version is told every other country is a person's, which it leaves alone (src/ai/index.js)
    const base = { ai: ai.base.createAI({ seed, humans: country ? [country] : [] }), view: game, ms: 0, n: codes.length - (country ? 1 : 0) };
    const versions = country ? [base, { ai: ai.cand.createAI({ seed, humans: codes.filter((c) => c !== country) }), view: salted(game, salt), ms: 0, n: 1 }] : [base];
    const out = Object.fromEntries(codes.map((c) => [c, { peak: 0, coresLost: 0, refused: 0 }]));
    const end = Math.min(years * 365, 1e9);
    let pending = [], how = null;
    while (game.day < end && !st.winner) {
        const events = [];
        for (const o of pending) {
            const r = game.command({ ...o.cmd, country: o.country });
            if (r.ok) events.push(...r.events);
            else if (out[o.country]) out[o.country].refused++;
        }
        events.push(...game.advance());
        for (const e of events) {
            // a core of its own lost: what trains its soldiers and makes its money
            if (e.type === "capture" && out[e.from] && st.settlements[e.settlement]?.cores.includes(e.from)) out[e.from].coresLost++;
            if (e.type === "victory") how = e.why === "end" ? "time" : "reached";
        }
        if (game.day % 30 === 0) { const t = scores(st); for (const c of codes) if (t[c]) out[c].peak = Math.max(out[c].peak, t[c].settlements); }
        if (st.winner) break;
        // both versions' orders in the order of the countries — as one computer player gives them all
        const orders = [];
        for (const x of versions) {
            const t0 = performance.now();
            orders.push(...x.ai.orders(x.view, events));
            x.ms += performance.now() - t0;
        }
        pending = orders.map((o, i) => [o, i]).sort((a, b) => (a[0].country < b[0].country ? -1 : a[0].country > b[0].country ? 1 : a[1] - b[1])).map(([o]) => o);
    }
    const table = scores(st);
    for (const c of codes) {
        const s = table[c] ?? { settlements: 0, pop: 0 };
        Object.assign(out[c], { score: s.settlements, pop: Math.round(s.pop), held: Object.values(st.settlements).filter((x) => x.owner === c).length,
            alive: (st.countries[c].out ?? null) === null, won: (st.winner?.country ?? st.winner) === c, peak: Math.max(out[c].peak, s.settlements) });
    }
    const cost = (x) => ({ ms: Math.round(x.ms), countryDays: x.n * game.day });
    return { seed, country, day: game.day, winner: st.winner?.country ?? st.winner ?? null, how, countries: out, fingerprint: fingerprint(JSON.stringify(st)),
        ms: { base: cost(versions[0]), ...(country ? { cand: cost(versions[1]) } : {}) } };
}

// ---------- statistics ----------
// the 95% two-sided t value for `df` degrees of freedom
const T95 = [12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.10, 2.09, 2.09, 2.08, 2.07, 2.07, 2.06, 2.06, 2.06, 2.05, 2.05, 2.05, 2.04];
export function meanCI(xs) {
    const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
    if (n < 2) return { n, mean, lo: NaN, hi: NaN, sd: NaN };
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)), h = (T95[n - 2] ?? 1.96) * sd / Math.sqrt(n);
    return { n, mean, sd, lo: mean - h, hi: mean + h };
}
const f = (x, d = 2) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(d) : "—");
const ci = (c) => `${f(c.mean)} [${f(c.lo)}, ${f(c.hi)}]`;

// what the games say, as text: each test country on the candidate against itself in its seed's control game
export function report(results, countries) {
    const lines = [], say = (s = "") => lines.push(s);
    const seeds = [...new Set(results.map((r) => r.seed))].sort((a, b) => a - b);
    const control = new Map(results.filter((r) => !r.country).map((r) => [r.seed, r]));
    const pairs = results.filter((r) => r.country && control.has(r.seed)).map((r) => ({ seed: r.seed, c: r.country, cand: r.countries[r.country], base: control.get(r.seed).countries[r.country] }));
    say(`ONE COUNTRY ON THE CANDIDATE, every other on the baseline — the country's outcome, candidate less baseline (95% interval)`);
    say(`  country   settlements at the end    peak        wins (cand/base)  survived (cand/base)  cores lost`);
    for (const c of countries) {
        const p = pairs.filter((x) => x.c === c);
        if (!p.length) continue;
        const d = (k) => meanCI(p.map((x) => x.cand[k] - x.base[k]));
        const k = (side, key) => p.filter((x) => x[side][key]).length;
        say(`  ${c.padEnd(8)}  ${ci(d("score")).padEnd(24)}  ${f(d("peak").mean).padEnd(10)}  ${`${k("cand", "won")}/${k("base", "won")}`.padEnd(16)}  ${`${k("cand", "alive")}/${k("base", "alive")}`.padEnd(20)}  ${f(d("coresLost").mean)}`);
    }
    // the seeds are the unit: the countries of a seed share its control game
    const bySeed = seeds.map((s) => pairs.filter((x) => x.seed === s)).filter((p) => p.length);
    const all = meanCI(bySeed.map((p) => p.reduce((a, x) => a + x.cand.score - x.base.score, 0) / p.length));
    say(`  all       ${ci(all)} settlements a country (the mean of ${bySeed.length} seeds' means); wins ${pairs.filter((x) => x.cand.won).length} on the candidate, ${pairs.filter((x) => x.base.won).length} on the baseline, of ${pairs.length}`);
    const refused = (side) => pairs.reduce((a, x) => a + x[side].refused, 0) / Math.max(1, pairs.length);
    say(`  refused orders a game: ${refused("cand").toFixed(2)} on the candidate, ${refused("base").toFixed(2)} on the baseline`);
    say();
    const cost = (v) => { const xs = results.map((r) => r.ms[v]).filter(Boolean); const ms = xs.reduce((a, x) => a + x.ms, 0), cd = xs.reduce((a, x) => a + x.countryDays, 0); return cd ? (1000 * ms / cd).toFixed(1) : "—"; };
    say(`COST — microseconds of thinking a country-day: candidate ${cost("cand")}, baseline ${cost("base")}`);
    return lines.join("\n");
}

// ---------- the games written down as they end ----------
export const partialFile = (label) => path.join(root, "experiments", "strength", `${label}.partial.jsonl`);
// the games already played for a run with these settings, from its partial file — none if there is no file; an error if it is
// another run's
export function readPartial(file, settings) {
    if (!fs.existsSync(file)) return [];
    const [head, ...lines] = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    if (JSON.stringify(head) !== JSON.stringify(settings)) throw new Error(`${path.relative(root, file)} is another run's (${JSON.stringify(head)}): give this one another --label, or delete it`);
    return lines;
}
export function startPartial(file, settings) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(settings) + "\n");
}
export const writeGame = (file, result) => fs.appendFileSync(file, JSON.stringify(result) + "\n");

// ---------- the command line, and the workers ----------
const loadVersions = async (dirs) => {
    const load = (dir) => import(pathToFileURL(path.join(dir, "index.js")).href);
    return { base: await load(dirs.base), cand: await load(dirs.cand) };
};

if (isMainThread && import.meta.filename === process.argv[1]) {
    const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
    const scenarioName = arg("scenario", "mitteleuropa"), scenario = loadScenario(scenarioName);
    const years = Number(arg("years", 210)), salt = arg("salt", "");
    const seed0 = Number(arg("seed", 101)), seeds = Array.from({ length: Number(arg("seeds", 20)) }, (_, i) => seed0 + i);
    const countries = arg("countries", COUNTRIES.join(",")).split(",");
    for (const c of countries) if (!scenario.countries.some((x) => x.code === c)) throw new Error(`no country ${c} in ${scenarioName}`);
    const base = aiAt(arg("baseline", "HEAD")), cand = aiAt(arg("candidate", "working"));
    const jobs = Number(arg("jobs", os.availableParallelism())), label = arg("label", salt ? "aa" : "run");
    // for each seed the control game, then a game for each test country — less those its partial file has played already
    const all = seeds.flatMap((seed) => [null, ...countries].map((country) => ({ seed, country })));
    const settings = { scenario: scenarioName, years, seeds, countries, salt, candidate: cand.label, baseline: base.label };
    const partial = partialFile(label), done = readPartial(partial, settings);
    const played = new Set(done.map((r) => `${r.seed}|${r.country}`)), tasks = all.filter((t) => !played.has(`${t.seed}|${t.country}`));
    const order = (rs) => rs.sort((a, b) => a.seed - b.seed || (a.country ?? "").localeCompare(b.country ?? ""));
    if (process.argv.includes("--report")) {
        console.log(`${done.length} of ${all.length} games played (${path.relative(root, partial)}): candidate ${cand.label}, baseline ${base.label}\n\n${report(order([...done]), countries)}`);
        process.exit(0);
    }
    startPartial(partial, settings);
    console.log(`${tasks.length} games of ${years} years on ${scenarioName}${done.length ? ` (${done.length} played already)` : ""}, ${jobs} at a time: candidate ${cand.label}, baseline ${base.label}${salt ? `, the candidate's dice salted "${salt}"` : ""}`);
    const t0 = performance.now(), results = [...done];
    const run = (task) => new Promise((resolve, reject) => {
        const w = new Worker(import.meta.filename, { workerData: { task, scenarioName, years, salt, dirs: { base: base.dir, cand: cand.dir } } });
        w.once("message", resolve);
        w.once("error", reject);
    });
    const queue = [...tasks];
    await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => {
        while (queue.length) {
            const task = queue.shift();
            let r;
            try { r = await run(task); } catch (err) {
                // one game failing loses that game, not the run: the next run of the same command plays it
                console.log(`seed ${task.seed} ${task.country ?? "control"}: failed (${err.message}) — left for the next run`);
                continue;
            }
            const { fingerprint: _, ...kept } = r;
            writeGame(partial, kept);
            results.push(kept);
            console.log(`${String(results.length).padStart(3)}/${all.length} seed ${r.seed} ${r.country ?? "control"}: ${r.winner ? `${r.winner} won ${r.how === "time" ? "on time" : "by the target"}` : "no winner"}, day ${r.day}`);
        }
    }));
    order(results);
    const text = report(results, countries);
    if (results.length < all.length) {
        console.log(`\n${results.length} of ${all.length} games played: run the same command again for the rest\n\n${text}`);
        process.exit(1);
    }
    console.log(`\n${results.length} games in ${((performance.now() - t0) / 60000).toFixed(1)} minutes\n\n${text}`);
    const dir = path.join(root, "experiments", "strength"), file = path.join(dir, `${new Date().toISOString().slice(0, 10)}-${label}.json`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...settings, results, report: text }, null, 1) + "\n");
    fs.rmSync(partial, { force: true });
    console.log(`\nwritten to ${path.relative(root, file)}`);
} else if (!isMainThread) {
    const { task, scenarioName, years, salt, dirs } = workerData;
    parentPort.postMessage(play({ scenario: loadScenario(scenarioName), seed: task.seed, years, ai: await loadVersions(dirs), country: task.country, salt }));
}
