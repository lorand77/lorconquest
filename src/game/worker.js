// One running game, in a worker thread of its own (design.md, "Threads" and "One game, one loop"): the engine,
// the loop that advances a day every tick, and the computer players (src/ai). A slow game slows only itself.
//
// Each tick: the commands queued since the last one are applied — humans' and computer countries' alike — the
// day is advanced, the computer players give their orders for the next tick, and the day goes out to the
// main thread: what changed, its events, the commands to save, and at the start of each game year a snapshot.
// A late tick is caught up, up to 5 days at once; further behind, game time slips rather than skips. Paused,
// the loop still applies commands, so orders and their previews show at once, but the day stands still.
//
// In:  { type: "command", reqId, country, source, cmd }  { type: "pause", paused }  { type: "view", reqId, country }
//      { type: "caretaker", country, mode }  (mode "caretaker", "full" or null: who plays a human's country while away)  { type: "stop" }
// Out: { type: "ready", day }  { type: "tick", day, events, pub, priv, commands, snapshot }
//      { type: "reply", reqId, ok, error, events }  { type: "view", reqId, view }  { type: "paused", paused, day }
//      { type: "stats", days, mean, max }  { type: "over", day, winner, defeated, scores, hash }  { type: "stopped", day, commands }
// A game is over when a country has won (the engine says so), or when every person's country is out of the game (RULES.md
// §10, Elimination: a single-player game ends as a defeat when the player's does). It is saved one last time, at exactly the
// state a replay must reach, and its loop stops; a command after that is answered "the game is over".
import { parentPort, workerData } from "node:worker_threads";
import { fingerprint, replay, resume, scores } from "../engine/index.js";
import { createAI } from "../ai/index.js";
import { Changes, viewFor } from "./view.js";

const CATCH_UP = 5;
const { scenario, seed, snapshot, log, day, humans, tickMs, statsEvery } = workerData;
let paused = workerData.paused;

const game = snapshot ? resume(scenario, snapshot, log, day) : replay(scenario, seed, log, day, humans);
const changes = new Changes(game.state);
const ai = createAI({ seed: game.state.seed, humans });
for (const [country, mode] of workerData.caretakers ?? []) ai.setCaretaker(country, mode);       // players away from the start
const queue = [];
let toSave = [], snap = null, times = [], next = 0, timer = null, stopping = false, finished = false;
const isOver = () => Boolean(game.state.winner) || (humans.length > 0 && humans.every((h) => game.state.countries[h].out !== null));
const post = (m) => parentPort.postMessage(m);

function applyQueue(events) {
    while (queue.length) {
        const q = queue.shift();
        const cmd = { ...q.cmd, country: q.country };
        const r = game.command(cmd);
        if (r.ok) {
            toSave.push({ day: game.day, country: q.country, source: q.source, cmd });
            events.push(...r.events);
        }
        if (q.reqId !== undefined) post({ type: "reply", reqId: q.reqId, ok: r.ok, error: r.error, events: r.events ?? [] });
    }
}

function publish(events) {
    const { pub, priv } = changes.next(game.state);
    post({ type: "tick", day: game.day, events, pub, priv, commands: toSave, snapshot: snap });
    toSave = [];
    snap = null;
}

// the end: who won (or that every person lost), how every country stands, and the fingerprint of the final state a replay
// must come to (design.md, "Replays")
function finish(events) {
    snap = { day: game.day, state: game.snapshot() };
    const hash = fingerprint(snap.state);
    publish(events);
    post({ type: "over", day: game.day, winner: game.state.winner ?? null, defeated: !game.state.winner, scores: scores(game.state), hash });
    stopping = finished = true;
}

function tick() {
    if (stopping) return;                                   // over (a defeat does not stop the engine's days by itself)
    const t0 = performance.now(), events = [];
    applyQueue(events);
    if (isOver()) { finish(events); return; }               // a command put the last person's country out
    events.push(...game.advance());
    if (isOver()) { finish(events); return; }
    for (const o of ai.orders(game, events)) queue.push({ country: o.country, source: o.source, cmd: o.cmd });
    if (game.day % 365 === 0) snap = { day: game.day, state: game.snapshot() };
    publish(events);
    times.push(performance.now() - t0);
    if (times.length >= statsEvery) {
        post({ type: "stats", days: times.length, mean: times.reduce((a, b) => a + b, 0) / times.length, max: Math.max(...times) });
        times = [];
    }
}

function loop() {
    timer = null;
    if (stopping) return;
    if (paused) {
        if (queue.length) { const events = []; applyQueue(events); if (isOver()) finish(events); else publish(events); }
        timer = setTimeout(loop, tickMs);
        return;
    }
    const now = performance.now();
    for (let n = 0; now >= next && n < CATCH_UP; n++) { tick(); next += tickMs; }
    if (now - next > tickMs * CATCH_UP) next = now + tickMs;      // too far behind: game time slips
    timer = setTimeout(loop, Math.max(0, next - performance.now()));
}

parentPort.on("message", (m) => {
    switch (m.type) {
        case "command":
            queue.push({ reqId: m.reqId, country: m.country, source: m.source, cmd: m.cmd });
            // a finished game has no loop: it answers at once, "the game is over"
            if (finished) while (queue.length) { const q = queue.shift(); if (q.reqId !== undefined) post({ type: "reply", reqId: q.reqId, ok: false, error: "the game is over" }); }
            break;
        case "caretaker":
            ai.setCaretaker(m.country, m.mode);
            break;
        case "pause":
            if (paused !== m.paused) {
                paused = m.paused;
                if (!paused) next = performance.now() + tickMs;
            }
            post({ type: "paused", paused, day: game.day });
            break;
        case "view":
            post({ type: "view", reqId: m.reqId, view: viewFor(game.state, m.country) });
            break;
        case "stop": {
            stopping = true;
            if (timer) clearTimeout(timer);
            const events = [];
            applyQueue(events);
            post({ type: "stopped", day: game.day, commands: toSave });
            parentPort.close();
            break;
        }
    }
});

post({ type: "ready", day: game.day });
next = performance.now() + tickMs;
loop();
