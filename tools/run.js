// The runner: plays a game from a script of commands at given dates and prints what happened, as fast as the
// machine allows — the engine with no server and no screen (docs/plan.md, milestone 1).
//
//   node tools/run.js <script> [--quiet] [--json]
//
// A script is lines of:
//   seed 7                                      the random seed (default 1)
//   scenario docs/scenario.json                 the scenario (default docs/scenario.json)
//   1440-01-01 BAV declare-war target=ULM       a command on that date: country, command, key=value...
//   1440-01-01 BAV move army=37 to=48 storm=yes
//   1440-01-01 BAV split army=37 men.swords=300
//   until 1441-01-01                            play to that date
// Commands are kebab-case versions of the engine's (src/engine/commands.mjs); "#" starts a comment.
// --quiet prints only the summary, --json the final state instead of the summary.
"use strict";
const fs = require("fs");
const path = require("path");
const { Game, formatDate, parseDate, menOf } = require("../src/engine/index.mjs");

const ROOT = path.dirname(__dirname);
const fmt = (n) => Math.round(n).toLocaleString("en-GB");

function value(text) {
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if (/^(yes|true)$/.test(text)) return true;
    if (/^(no|false)$/.test(text)) return false;
    return text;
}

// a script line's command: "BAV move army=37 to=48" -> { type: "move", country: "BAV", army: 37, to: 48 }
function parseCommand(country, name, args) {
    const cmd = { type: name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), country };
    for (const a of args) {
        const m = /^([\w.]+)=(.*)$/.exec(a);
        if (!m) throw new Error(`not key=value: ${a}`);
        const keys = m[1].split(".");
        let o = cmd;
        for (const k of keys.slice(0, -1)) o = o[k] ??= {};
        o[keys[keys.length - 1]] = value(m[2]);
    }
    return cmd;
}

function parseScript(text) {
    const script = { seed: 1, scenario: "docs/scenario.json", steps: [] };
    text.split("\n").forEach((raw, i) => {
        const line = raw.replace(/#.*/, "").trim();
        if (!line) return;
        const [head, ...rest] = line.split(/\s+/);
        const where = `line ${i + 1}`;
        if (head === "seed") script.seed = Number(rest[0]);
        else if (head === "scenario") script.scenario = rest[0];
        else if (head === "until") script.steps.push({ until: parseDate(rest[0]), where });
        else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(head)) {
            if (rest.length < 2) throw new Error(`${where}: a command needs a country and a name`);
            script.steps.push({ day: parseDate(head), cmd: parseCommand(rest[0], rest[1], rest.slice(2)), where });
        } else throw new Error(`${where}: cannot read "${line}"`);
    });
    return script;
}

// one event as a line of text
function describe(game, e) {
    const place = (key) => {
        if (String(key).includes("|")) return `the road ${String(key).split("|").map(place).join("–")}`;
        const n = game.map.nodes.get(String(key));
        return n.kind === "pass" ? `pass ${n.id}` : `${n.id} ${n.name}`;
    };
    const side = (s) => `${s.countries.join("+")} ${fmt(s.men)} men${s.cannons ? ` ${s.cannons} cannons` : ""} (×${s.roll}, power ${fmt(s.power)})`;
    switch (e.type) {
        case "war": return `${e.country} declares war on ${e.target}`;
        case "arrive": return `army ${e.army} (${e.owner}) halts at ${place(e.at)}`;
        case "blocked": return `army ${e.army} (${e.owner}) finds its way closed at ${place(e.at)}`;
        case "capture": return `${e.to} takes ${place(e.settlement)} from ${e.from} (${e.how})`;
        case "siegeStart": return `${e.by} besieges ${place(e.settlement)}: ${e.days} days`;
        case "siegeLifted": return `the siege of ${place(e.settlement)} is lifted`;
        case "surrender": return `${place(e.settlement)} surrenders to ${e.by}; ${fmt(e.disbanded)} men of ${e.owner} go home`;
        case "retreat": return `army ${e.army} (${e.owner}) retreats to ${place(e.to)}, ${Math.round(e.days)} days`;
        case "destroyed": return `army ${e.army} (${e.owner}) is destroyed: ${e.why}${e.dead ? `, ${fmt(e.dead)} dead` : ""}`;
        case "attrition": return `army ${e.army} (${e.owner}) loses ${fmt(e.dead)} men to ${[e.sick && "disease", e.hungry && "hunger"].filter(Boolean).join(" and ")}`;
        case "split": return `army ${e.army} (${e.owner}) splits off army ${e.into}`;
        case "merge": return `army ${e.army} (${e.owner}) joins army ${e.into}`;
        case "battle": {
            const win = e.winner === "a" ? e.a : e.b, lose = e.winner === "a" ? e.b : e.a;
            const extra = e.kind === "storm" && e.winner === "a" ? ` The garrison rolls ${e.escape}: ${e.escape <= 3 ? "it escapes" : "it is lost"}.` : "";
            return `${e.kind} at ${place(e.place)}: ${side(e.a)} against ${side(e.b)} — ${win.countries.join("+")} wins; dead ${win.countries.join("+")} ${fmt(win.dead)}, ${lose.countries.join("+")} ${fmt(lose.dead)}.${extra}`;
        }
        default: return JSON.stringify(e);
    }
}

// play a script; `print` gets every line of output. Returns the game, its scenario, every event and the refused
// commands.
function runScript(text, { print = () => {}, quiet = false } = {}) {
    const script = parseScript(text);
    const scenarioFile = path.isAbsolute(script.scenario) ? script.scenario : path.join(ROOT, script.scenario);
    const scenario = JSON.parse(fs.readFileSync(scenarioFile, "utf8"));
    const game = Game.create(scenario, { seed: script.seed });
    const rejected = [], events = [];
    const log = (day, line) => { if (!quiet) print(`${formatDate(day)}  ${line}`); };
    const record = (list) => { for (const e of list) { events.push(e); log(e.day, describe(game, e)); } };
    const to = (day) => {
        while (game.day < day) record(game.advance());
    };
    for (const step of script.steps) {
        if (step.until !== undefined) { to(step.until); continue; }
        if (step.day < game.day) throw new Error(`${step.where}: ${formatDate(step.day)} is before ${formatDate(game.day)}`);
        to(step.day);
        const r = game.command(step.cmd);
        if (!r.ok) { rejected.push({ ...step, error: r.error }); log(game.day, `REFUSED ${step.cmd.country} ${step.cmd.type}: ${r.error}`); continue; }
        record(r.events);
    }
    return { game, scenario, events, rejected };
}

function summary(game, scenario) {
    const st = game.state, lines = [`--- ${formatDate(game.day)}`];
    if (st.wars.length) lines.push(`wars: ${st.wars.join(", ")}`);
    const changed = scenario.settlements.filter((s) => st.settlements[s.id].owner !== s.country);
    lines.push(changed.length ? `changed hands: ${changed.map((s) => `${s.id} ${s.name} ${s.country} -> ${st.settlements[s.id].owner}`).join("; ")}` : "no settlement changed hands");
    const involved = new Set(st.wars.flatMap((w) => w.split("|")));
    for (const c of involved) {
        const armies = Object.values(st.armies).filter((a) => a.owner === c);
        const where = armies.map((a) => `${a.id}:${fmt(menOf(a))}@${a.at ?? `${a.march.from}>${a.march.to}`}${a.retreating ? "(retreating)" : ""}`);
        lines.push(`${c}: ${armies.length ? where.join(" ") : "no armies"}`);
    }
    return lines;
}

module.exports = { runScript, parseScript, describe, summary };

if (require.main === module) {
    const args = process.argv.slice(2);
    const file = args.find((a) => !a.startsWith("--"));
    if (!file) {
        process.stderr.write("usage: node tools/run.js <script> [--quiet] [--json]\n");
        process.exit(1);
    }
    try {
        const { game, scenario } = runScript(fs.readFileSync(file, "utf8"), { print: (l) => console.log(l), quiet: args.includes("--quiet") || args.includes("--json") });
        if (args.includes("--json")) console.log(game.snapshot());
        else for (const l of summary(game, scenario)) console.log(l);
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exit(1);
    }
}
