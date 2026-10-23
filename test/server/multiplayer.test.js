// Multiplayer (docs/plan.md, milestone 6): tables and seats in the lobby, a game of several people — the setup minute, no
// pauses, each player's own country, chat — and what happens when a player goes away, comes back or quits, when none is
// left, and when the server restarts. Times are short: the setup minute and the two minutes are a few hundred
// milliseconds here, and a game day takes 2 ms.
import test from "node:test";
import assert from "node:assert/strict";
import { api, connect, emitAck, newGame, startServer, tempDb, waitFor } from "./helpers.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, what, timeoutMs = 8000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { const v = await check(); if (v) return v; await wait(10); }
    throw new Error(`gave up waiting for ${what}`);
}

// a table with `players` ([[name, country], ...], the first the host), not started
async function makeTable(server, players, seed = 5) {
    const [[host, country], ...rest] = players;
    const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country, seed }, host);
    assert.equal(made.status, 201, JSON.stringify(made.body));
    for (const [name, c] of rest) assert.equal((await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: c }, name)).status, 200);
    return made.body.id;
}

// start it and have everyone open the game: [{ name, socket, joined }]
async function play(server, id, players) {
    assert.equal((await api(server, "POST", `/api/tables/${id}/start`, {}, players[0][0])).status, 200);
    const out = [];
    for (const [name] of players) {
        const socket = await connect(server, name);
        out.push({ name, socket, joined: await emitAck(socket, "join", { gameId: id }) });
    }
    return out;
}

const status = (server, id) => server.app.db.q.game.get(id).status;
const ALICE_BOB = [["alice", "BAV"], ["bobby", "ULM"]];

test("a table: seats first come first served, at most four people, a host who starts or cancels it", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const lobby = await connect(server, "carol");
        await emitAck(lobby, "lobby:enter", {});
        const changed = () => waitFor(lobby, "lobby:changed");
        let ch = changed();
        const id = await makeTable(server, [["alice", "BAV"]]);
        await ch;
        const tables = (await api(server, "GET", "/api/tables", null, "carol")).body;
        assert.deepEqual(tables.map((t) => [t.id, t.scenario, t.host, t.seats]), [[id, "mitteleuropa", "alice", [{ country: "BAV", username: "alice" }]]]);

        const join = (name, country) => api(server, "POST", `/api/tables/${id}/join`, { country }, name);
        assert.equal((await join("bobby", "BAV")).body.error, "BAV is taken");
        assert.match((await join("bobby", "XXX")).body.error, /no country XXX/);
        ch = changed();
        assert.equal((await join("bobby", "ULM")).status, 200);
        await ch;
        assert.equal((await join("bobby", "SAX")).body.error, "you already have a seat in this room");
        assert.equal((await join("carol", "SAX")).status, 200);
        assert.equal((await join("dave_d", "BOH")).status, 200);
        assert.equal((await join("erin_e", "AUS")).body.error, "a game has at most 4 people");

        // leaving frees a seat; the host cannot leave, only cancel
        assert.equal((await api(server, "POST", `/api/tables/${id}/leave`, {}, "carol")).status, 200);
        assert.equal((await join("erin_e", "SAX")).status, 200);
        assert.equal((await api(server, "POST", `/api/tables/${id}/leave`, {}, "alice")).body.error, "the host cancels the room instead");
        assert.equal((await api(server, "POST", `/api/tables/${id}/leave`, {}, "carol")).body.error, "you have no seat in this room");
        assert.equal((await api(server, "POST", `/api/tables/${id}/start`, {}, "bobby")).body.error, "only the host starts a game");
        assert.equal((await api(server, "POST", `/api/tables/${id}/cancel`, {}, "bobby")).body.error, "only the host cancels a room");

        // the host cancels: everyone seated is told, and the table is gone
        const bobby = await connect(server, "bobby");
        const told = waitFor(bobby, "table:cancelled");
        assert.equal((await api(server, "POST", `/api/tables/${id}/cancel`, {}, "alice")).status, 200);
        assert.deepEqual(await told, { id });
        assert.deepEqual((await api(server, "GET", "/api/tables", null, "carol")).body, []);
        assert.equal((await join("carol", "SAX")).body.error, "that room is gone or its game has started");
        assert.equal(status(server, id), "aborted");
        assert.deepEqual((await api(server, "GET", "/api/games", null, "alice")).body, [], "an aborted table is not one of anyone's games");
    } finally {
        await server.close();
    }
});

test("the host starts with seats open: those seated are told, the game is theirs, the rest is the computer's", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 100000 });
    try {
        const id = await makeTable(server, ALICE_BOB);
        const bobby = await connect(server, "bobby");
        const started = waitFor(bobby, "table:started");
        const [a, b] = await play(server, id, ALICE_BOB);
        assert.deepEqual(await started, { id });
        assert.deepEqual((await api(server, "GET", "/api/tables", null, "carol")).body, [], "no longer a table");
        // each player has their own country, sees only their own private part, and the game knows its humans
        assert.deepEqual([a.joined.me, b.joined.me, a.joined.multi], ["BAV", "ULM", true]);
        assert.deepEqual(a.joined.view.humans, ["BAV", "ULM"]);
        assert.equal(a.joined.view.countries.BAV.treasury, 100000);
        assert.equal(a.joined.view.countries.ULM.treasury, undefined);
        assert.equal(b.joined.view.countries.ULM.treasury, 20000);
        assert.equal(b.joined.view.countries.BAV.treasury, undefined);
        assert.deepEqual(a.joined.seats.map((s) => [s.country, s.username]), [["BAV", "alice"], ["ULM", "bobby"]]);
        // someone with no seat cannot open it
        const carol = await connect(server, "carol");
        assert.equal((await emitAck(carol, "join", { gameId: id })).error, "you have no seat in this game");
        // a country is only ever commanded by its own player
        const theirs = await emitAck(b.socket, "command", { cmd: { type: "move", army: 37, to: 36 } });
        assert.deepEqual([theirs.ok, theirs.error], [false, "army 37 is not ULM's"]);
        assert.equal((await emitAck(a.socket, "command", { cmd: { type: "move", army: 37, to: 36 } })).ok, true);
        assert.equal((await api(server, "GET", "/api/games", null, "bobby")).body[0].people, 2);
    } finally {
        await server.close();
    }
});

test("the clock stands still for the setup minute while orders are given, then runs and never pauses again", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 400 });
    try {
        const id = await makeTable(server, ALICE_BOB);
        const [a, b] = await play(server, id, ALICE_BOB);
        assert.equal(a.joined.paused, true);
        assert.ok(a.joined.setup > 0 && a.joined.setup <= 400, `setup ${a.joined.setup} ms left`);
        const ticks = [];
        a.socket.on("tick", (t) => ticks.push(t.day));
        const go = waitFor(a.socket, "paused", (p) => p.paused === false);
        // orders are taken while the clock stands still
        assert.equal((await emitAck(a.socket, "command", { cmd: { type: "setTax", tax: 2.5 } })).ok, true);
        assert.equal((await emitAck(b.socket, "command", { cmd: { type: "setTax", tax: 2.2 } })).ok, true);
        assert.ok(ticks.every((d) => d === 0), "no day has passed");
        await go;
        await until(() => ticks.length > 20, "days to pass");
        assert.equal((await emitAck(a.socket, "join", { gameId: id })).setup, 0);
        // nobody can pause it, and a player leaving does not
        assert.deepEqual((({ ok, error }) => [ok, error])(await emitAck(a.socket, "pause", { paused: true })), [false, "a game with other people never pauses"]);
        const before = ticks.length;
        b.socket.close();
        await until(() => ticks.length > before + 20, "the game to run on without bobby");
        assert.equal(server.app.rooms.get(id).paused, false);
    } finally {
        await server.close();
    }
});

test("chat reaches everyone in the game, is kept for those who join later, and is limited", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 100000 });
    try {
        const id = await makeTable(server, ALICE_BOB);
        const [a, b] = await play(server, id, ALICE_BOB);
        const heard = waitFor(b.socket, "chat");
        assert.equal((await emitAck(a.socket, "chat", { text: "  Shall we ally against Austria?  " })).ok, true);
        const m = await heard;
        assert.deepEqual([m.username, m.text], ["alice", "Shall we ally against Austria?"]);
        assert.equal((await emitAck(a.socket, "chat", { text: "" })).ok, false);
        assert.equal((await emitAck(a.socket, "chat", { text: "x".repeat(301) })).ok, false);
        assert.equal((await emitAck(a.socket, "chat", { text: 42 })).ok, false);
        // five in five seconds; the sixth is told to slow down
        const results = [];
        for (let i = 0; i < 5; i++) results.push((await emitAck(a.socket, "chat", { text: `m${i}` })).error);
        assert.deepEqual(results.slice(-1), ["slow down"]);
        // a late opener gets the history, oldest first, and the chat is in the database
        const again = await emitAck(b.socket, "join", { gameId: id });
        assert.deepEqual(again.chat.map((c) => c.text).slice(0, 2), ["Shall we ally against Austria?", "m0"]);
        // (a message that is refused still counts against the limit, so only the first and m0 were kept)
        assert.equal(server.app.db.db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE game_id = ?").get(id).n, 2);
    } finally {
        await server.close();
    }
});

test("a player who goes away has a caretaker, then the full computer player; coming back, they have the country at once", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 0, awayMs: 1000 });
    try {
        const id = await makeTable(server, ALICE_BOB);
        const [a, b] = await play(server, id, ALICE_BOB);
        const states = [];
        a.socket.on("presence", (p) => states.push([p.country, p.state]));
        const away = waitFor(a.socket, "presence", (p) => p.country === "ULM" && p.state === "away");
        b.socket.close();
        assert.deepEqual(await away, { country: "ULM", username: "bobby", state: "away" });
        await waitFor(a.socket, "presence", (p) => p.country === "ULM" && p.state === "full");
        // the full computer player plays ULM now, and its commands are marked as the computer's
        const caretaker = () => server.app.db.db.prepare("SELECT COUNT(*) AS n FROM commands WHERE game_id = ? AND country = 'ULM' AND source = 'caretaker'").get(id).n;
        await until(() => caretaker() > 0, "the computer to give an order for Ulm");
        // bobby is back: the country is his at once, and the computer stops
        const back = waitFor(a.socket, "presence", (p) => p.country === "ULM" && p.state === "present");
        const socket = await connect(server, "bobby");
        const joined = await emitAck(socket, "join", { gameId: id });
        assert.deepEqual([joined.ok, joined.me], [true, "ULM"]);
        assert.equal((await back).state, "present");
        await wait(100);
        const n = caretaker();
        await wait(300);
        assert.equal(caretaker(), n, "no more orders from the computer");
        assert.equal((await emitAck(socket, "command", { cmd: { type: "setTax", tax: 2.3 } })).ok, true);
        assert.equal(status(server, id), "active");
        // from his going away on (the notice of his first joining may still be on its way when the list starts)
        const seen = states.map((s) => s[1]);
        assert.deepEqual(seen.slice(seen.indexOf("away")), ["away", "full", "present"]);
    } finally {
        await server.close();
    }
});

test("a player who quits gives the country to the computer for good", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 0, awayMs: 100000 });
    try {
        const id = await makeTable(server, ALICE_BOB);
        const [a, b] = await play(server, id, ALICE_BOB);
        const told = waitFor(a.socket, "presence", (p) => p.country === "ULM" && p.state === "quit");
        assert.equal((await emitAck(b.socket, "quit", {})).ok, true);
        assert.equal((await told).state, "quit");
        const again = await connect(server, "bobby");
        assert.deepEqual((({ ok, error }) => [ok, error])(await emitAck(again, "join", { gameId: id })), [false, "you left this game"]);
        assert.equal(status(server, id), "active", "alice is still there");
        const caretaker = () => server.app.db.db.prepare("SELECT COUNT(*) AS n FROM commands WHERE game_id = ? AND country = 'ULM' AND source = 'caretaker'").get(id).n;
        await until(() => caretaker() > 0, "the computer to play Ulm");
    } finally {
        await server.close();
    }
});

test("the game ends when no player is left: all quit, or all away too long", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 0, awayMs: 1000 });
    try {
        // one quits, the other is away too long
        let id = await makeTable(server, ALICE_BOB);
        let [a, b] = await play(server, id, ALICE_BOB);
        await emitAck(b.socket, "quit", {});
        a.socket.close();
        await until(() => status(server, id) === "abandoned", "the game to be abandoned");
        await until(() => !server.app.rooms.get(id), "its worker to stop");
        assert.equal((await api(server, "GET", "/api/games", null, "alice")).body.find((g) => g.id === id).status, "abandoned");

        // both quit
        id = await makeTable(server, [["carol", "BAV"], ["dave_d", "ULM"]]);
        [a, b] = await play(server, id, [["carol", "BAV"], ["dave_d", "ULM"]]);
        await emitAck(a.socket, "quit", {});
        assert.equal(status(server, id), "active");
        await emitAck(b.socket, "quit", {});
        assert.equal(status(server, id), "abandoned");

        // both away
        id = await makeTable(server, [["erin_e", "BAV"], ["fred_f", "ULM"]]);
        [a, b] = await play(server, id, [["erin_e", "BAV"], ["fred_f", "ULM"]]);
        a.socket.close();
        b.socket.close();
        await until(() => status(server, id) === "abandoned", "both away to end it");
    } finally {
        await server.close();
    }
});

test("a game of several people survives a restart: it runs on at once, every player away until they are back", async () => {
    const dbPath = tempDb();
    let server = await startServer({ dbPath, setupMs: 0, awayMs: 100000 });
    let id, dayBefore;
    try {
        id = await makeTable(server, ALICE_BOB);
        const [a, b] = await play(server, id, ALICE_BOB);
        await emitAck(a.socket, "command", { cmd: { type: "setTax", tax: 2.5 } });
        const ticks = [];
        a.socket.on("tick", (t) => ticks.push(t.day));
        await until(() => ticks.length > 400, "a year to pass");                    // past the first snapshot
        dayBefore = ticks.at(-1);
        void b;
    } finally {
        await server.close();
    }
    server = await startServer({ dbPath, setupMs: 0, awayMs: 100000 });
    try {
        await until(() => server.app.rooms.get(id), "the game to come back");
        assert.equal(status(server, id), "active");
        const a = await connect(server, "alice");
        const joined = await emitAck(a, "join", { gameId: id });
        assert.deepEqual([joined.ok, joined.me, joined.multi, joined.view.countries.BAV.tax], [true, "BAV", true, 2.5]);
        assert.deepEqual(joined.seats.map((s) => [s.country, s.state]), [["BAV", "present"], ["ULM", "away"]]);
        const ticks = [];
        a.on("tick", (t) => ticks.push(t.day));
        await until(() => ticks.length > 30, "the game to run without anyone pressing play");
        assert.ok(ticks[0] >= dayBefore - 5, "from where it stood");
        const b = await connect(server, "bobby");
        assert.equal((await emitAck(b, "join", { gameId: id })).me, "ULM");
        assert.equal((await api(server, "GET", "/api/games", null, "bobby")).body[0].live, true);
    } finally {
        await server.close();
    }
});

test("the lobby shows who is online — the lobby or a game open — and who is playing, as it changes", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const a = await connect(server, "alice");
        const first = waitFor(a, "online", (list) => list.length === 1);
        await emitAck(a, "lobby:enter", {});
        assert.deepEqual(await first, [{ username: "alice", playing: false }]);
        // bobby opens his game: alice's list has him, playing
        const id = await newGame(server, { scenario: "mitteleuropa", country: "SAX", seed: 2 }, "bobby");
        const b = await connect(server, "bobby");
        const playing = waitFor(a, "online", (list) => list.some((p) => p.username === "bobby" && p.playing));
        await emitAck(b, "join", { gameId: id });
        assert.deepEqual(await playing, [{ username: "alice", playing: false }, { username: "bobby", playing: true }]);
        // he closes it: gone from the list
        const gone = waitFor(a, "online", (list) => !list.some((p) => p.username === "bobby"));
        b.close();
        assert.deepEqual(await gone, [{ username: "alice", playing: false }]);
    } finally {
        await server.close();
    }
});
