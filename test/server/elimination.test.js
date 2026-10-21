// Elimination through the server (RULES.md §10; docs/plan.md): a single-player game ends as a defeat when the player's country
// falls, and its replay ends exactly there; in a game of several people the player whose country falls is out — they may
// watch to the end but give no orders, and rank after everyone still in — and when every player's country has fallen the game
// ends as a defeat for all. To make a country fall at once, these games are played on a map where it starts with no land.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { fingerprint, replay } from "../../src/engine/index.js";
import { api, connect, emitAck, newGame, startServer, tempDb, waitFor } from "./helpers.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, what, timeoutMs = 8000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { const v = await check(); if (v) return v; await wait(10); }
    throw new Error(`gave up waiting for ${what}`);
}

// Mitteleuropa, but Ulm (48) belongs to Bavaria and Liège (55) to Belgium: ULM and LIE start with no land, and are out on day 1
function doomedRoot() {
    const sc = structuredClone(scenario);
    for (const [town, from, to] of [[48, "ULM", "BAV"], [55, "LIE", "BEL"]]) {
        sc.settlements.find((s) => s.id === town).country = to;
        sc.countries.find((c) => c.code === from).settlements = [];
        sc.countries.find((c) => c.code === to).settlements.push(town);
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lc-root-"));
    fs.mkdirSync(path.join(root, "scenarios", "mitteleuropa"), { recursive: true });
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "scenario.json"), JSON.stringify(sc));
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "SCENARIO.md"), "# SCENARIO: TEST\n");
    return { root, sc };
}

test("a single-player game ends as a defeat when the player's country falls, and its replay ends exactly there", async () => {
    const { root, sc } = doomedRoot();
    const server = await startServer({ dbPath: tempDb(), root });
    try {
        const id = await newGame(server, { scenario: "mitteleuropa", country: "ULM", seed: 3 }, "alice");
        const s = await connect(server, "alice");
        await emitAck(s, "join", { gameId: id });
        const over = waitFor(s, "over");
        await emitAck(s, "pause", { paused: false });
        const o = await over;
        assert.deepEqual([o.winner, o.defeated], [null, true]);
        const game = server.app.db.q.game.get(id);
        assert.deepEqual([game.status, game.winner], ["finished", null]);
        assert.match(game.result_hash, /^[0-9a-f]{8}$/);
        assert.equal((await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.5 } })).error, "the game is over");
        // the log alone rebuilds the game to the very state it ended in
        const log = server.app.db.q.allCommands.all(id).map((c) => ({ day: c.day, cmd: JSON.parse(c.cmd) }));
        const rebuilt = replay(sc, game.seed, log, game.day, ["ULM"]);
        assert.equal(fingerprint(rebuilt.snapshot()), game.result_hash);
        assert.equal(rebuilt.state.countries.ULM.out, game.day);
        const seat = server.app.db.db.prepare("SELECT place, out_day FROM game_seats WHERE game_id = ?").get(id);
        assert.deepEqual([seat.place, seat.out_day], [1, game.day]);
        assert.match((await api(server, "GET", "/api/games", null, "alice")).body[0].status, /finished/);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

// a table of `players` ([[name, country]...]), started, everyone in the game
async function play(server, players) {
    const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: players[0][1], seed: 4 }, players[0][0]);
    for (const [name, c] of players.slice(1)) await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: c }, name);
    await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, players[0][0]);
    const out = [];
    for (const [name] of players) { const socket = await connect(server, name); out.push({ socket, joined: await emitAck(socket, "join", { gameId: made.body.id }) }); }
    return { id: made.body.id, out };
}

test("with others in the game, a player whose country falls is out: watches, gives no orders, and ranks after the rest", async () => {
    const { root } = doomedRoot();
    const server = await startServer({ dbPath: tempDb(), root, setupMs: 0 });
    try {
        // (ULM falls on day 1, before anyone's page has opened the game: the seats say so when they do)
        const { id, out: [a, b] } = await play(server, [["alice", "ULM"], ["bobby", "BAV"]]);
        await until(() => server.app.rooms.get(id)?.seats.get("ULM").state === "out", "ULM to be out");
        // alice may still open the game and watch; her orders are refused; the game goes on
        const again = await emitAck(a.socket, "join", { gameId: id });
        assert.deepEqual([again.ok, again.me], [true, "ULM"]);
        assert.equal(again.seats.find((s) => s.country === "ULM").state, "out");
        assert.equal((await emitAck(a.socket, "command", { cmd: { type: "setTax", tax: 2.5 } })).error, "your country is no more");
        const ticks = [];
        a.socket.on("tick", (t) => ticks.push(t.day));
        await until(() => ticks.length > 10, "the game to run on for the watcher");
        assert.equal(server.app.db.q.game.get(id).status, "active");
        assert.ok(server.app.db.db.prepare("SELECT out_day FROM game_seats WHERE game_id = ? AND country = 'ULM'").get(id).out_day >= 1);
        // her leaving does not make her "away", and bobby leaving for good, with nobody else playing, ends it: abandoned
        a.socket.close();
        await wait(50);
        assert.equal(server.app.rooms.get(id).seats.get("ULM").state, "out");
        await emitAck(b.socket, "quit", {});
        await until(() => server.app.db.q.game.get(id).status === "abandoned", "the game to end with nobody playing");
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("when every player's country falls, the game ends as a defeat for all, ranked by when each fell", async () => {
    const { root } = doomedRoot();
    const server = await startServer({ dbPath: tempDb(), root, setupMs: 0 });
    try {
        const { id } = await play(server, [["alice", "ULM"], ["carol", "LIE"]]);
        await until(() => server.app.db.q.game.get(id).status === "finished", "the game to end");
        const game = server.app.db.q.game.get(id);
        assert.deepEqual([game.status, game.winner], ["finished", null]);
        const seats = server.app.db.db.prepare("SELECT country, place FROM game_seats WHERE game_id = ? ORDER BY place").all(id);
        assert.deepEqual(seats.map((s) => s.place), [1, 2]);
        assert.equal((await api(server, "GET", "/api/leaderboard", null, "alice")).body.find((r) => r.username === "alice").victories, 0);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
