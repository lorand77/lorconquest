// The live game (docs/plan.md, milestone 2): a game created over REST, played over sockets in its worker, its
// changes kept in step on the client, saved, and resumed exactly after a restart.
import test from "node:test";
import assert from "node:assert/strict";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { replay } from "../../src/engine/index.js";
import { openDb } from "../../src/db.js";
import { viewFor } from "../../src/game/view.js";
import { applyChanges, applyPrivate } from "../../public/js/mirror.js";
import { api, connect, emitAck, newGame, runUntil, startServer, tempDb, waitFor } from "./helpers.js";

test("scenarios, and starting a game", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const scenarios = (await api(server, "GET", "/api/scenarios")).body;
        assert.deepEqual(scenarios.map((s) => [s.id, s.name]), [["mitteleuropa", "Mitteleuropa: Balanced"], ["historical-1440", "Mitteleuropa: Historical 1440"]]);
        assert.equal(scenarios[0].countries.length, 45);
        assert.equal((await api(server, "POST", "/api/tables", { scenario: "nowhere", country: "BAV" })).status, 400);
        assert.equal((await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "XXX" })).status, 400);
        assert.equal((await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "BAV", seed: -1 })).status, 400);
        const id = await newGame(server);
        const games = (await api(server, "GET", "/api/games")).body;
        assert.deepEqual(games.map((g) => [g.id, g.scenario, g.country, g.day, g.paused, g.live]), [[id, "mitteleuropa", "BAV", 0, true, true]]);
    } finally {
        await server.close();
    }
});

test("the pages come with every module their script needs to preload, so the browser asks for them all at once", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const page = await (await fetch(server.baseUrl + "/game.html")).text();
        const preloads = [...page.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
        // the page's own script, the screen's modules and the whole engine, each of them there to be had
        for (const u of ["/js/game.js", "/js/mirror.js", "/js/panels.js", "/engine/index.js", "/engine/state.js", "/engine/calendar.js"]) assert.ok(preloads.includes(u), u);
        assert.ok(preloads.length >= 30, `${preloads.length} modules`);
        for (const u of preloads) assert.equal((await fetch(server.baseUrl + u)).status, 200, u);
        assert.ok(page.indexOf("modulepreload") < page.indexOf("</head>"));
        // / is the lobby, which no longer needs the engine; a page without a module script is left as it is
        const lobby = await (await fetch(server.baseUrl + "/")).text();
        assert.match(lobby, /<link rel="modulepreload" href="\/js\/lobby\.js">/);
        assert.doesNotMatch(lobby, /href="\/engine\/index\.js"/);
        assert.doesNotMatch(await (await fetch(server.baseUrl + "/terms.html")).text(), /modulepreload/);
        assert.equal((await fetch(server.baseUrl + "/nothing.html")).status, 404);
    } finally {
        await server.close();
    }
});

test("a command is applied and answered at once, not at the next day, paused or running", async () => {
    // days 5 s apart: an answer that waited for the day would come after the next one (orders, not timings, so a busy machine
    // running the whole suite cannot fail it)
    const server = await startServer({ dbPath: tempDb(), tickMs: 5000 });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        const days = [];
        s.on("tick", (m) => days.push(m.day));
        // paused (a new game alone starts paused): answered, and its change sent, with no day gone by
        const seen = waitFor(s, "private", () => true);
        const r1 = await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.7 } });
        assert.equal(r1.ok, true);
        assert.equal((await seen).changes.tax, 2.7);
        // running: just after a day, the answer comes before the next
        await emitAck(s, "pause", { paused: false });
        await waitFor(s, "tick", () => true, 15000);
        const before = days.length;
        const r2 = await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.2 } });
        assert.equal(r2.ok, true);
        assert.equal(new Set(days.slice(before)).size <= 1 && days.slice(before).every((d) => d === days[before - 1]), true, `days went by: ${days.slice(before - 1)}`);
        const r3 = await emitAck(s, "command", { cmd: { type: "setTax", tax: 9 } });
        assert.equal(r3.ok, false);                                                // refused at once too, with the reason
    } finally {
        await server.close();
    }
});

test("anyone may watch a game being played: the public view and the days, never a private part, and no orders", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);                                         // tester's, as Bavaria
        const p = await connect(server);
        await emitAck(p, "join", { gameId: id });
        // carol sees it among the live games, not hers; tester sees it as his
        const live = (await api(server, "GET", "/api/live", null, "carol")).body;
        assert.deepEqual(live.map((g) => [g.id, g.mine, g.people.map((x) => x.username)]), [[id, false, ["tester"]]]);
        assert.equal((await api(server, "GET", "/api/live")).body[0].mine, true);
        const w = await connect(server, "carol");
        const watched = await emitAck(w, "watch", { gameId: id });
        assert.equal(watched.ok, true);
        assert.equal(watched.me, undefined);
        assert.equal(watched.view.countries.BAV.treasury, undefined);             // the public view only
        assert.equal(watched.view.countries.BAV.name, "Bavaria");
        let privates = 0;
        w.on("private", () => privates++);
        const tick = waitFor(w, "tick", (m) => m.day > watched.view.day);
        await emitAck(p, "pause", { paused: false });
        await tick;                                                               // the days come to the watcher
        assert.equal((await emitAck(w, "command", { cmd: { type: "setTax", tax: 2.5 } })).error, "join a game first");
        assert.equal((await emitAck(w, "pause", { paused: true })).ok, false);
        await emitAck(p, "command", { cmd: { type: "setTax", tax: 2.6 } });       // the player's private change...
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(privates, 0);                                                // ...never reaches the watcher
        assert.equal((await emitAck(w, "watch", { gameId: 999 })).ok, false);
    } finally {
        await server.close();
    }
});

test("a player sees the game without its dice and without other countries' treasuries", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        assert.equal((await emitAck(s, "join", { gameId: 999 })).ok, false);
        const j = await emitAck(s, "join", { gameId: id });
        assert.deepEqual([j.ok, j.me, j.paused, j.scenario, j.tickMs, j.view.day], [true, "BAV", true, "mitteleuropa", 2, 0]);
        assert.deepEqual(Object.keys(j.view).sort(), ["agreements", "armies", "countries", "day", "fleets", "humans", "memory", "posts", "settlements", "warInfo", "wars", "winner"]);
        assert.equal(j.view.countries.BAV.treasury, 100000);
        assert.equal(j.view.countries.ULM.treasury, undefined);
        assert.equal(Object.keys(j.view.armies).length, 87);
    } finally {
        await server.close();
    }
});

test("commands are always the player's country's, whatever the client says", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        assert.equal((await emitAck(s, "command", { cmd: { type: "stop", army: 37 } })).error, "join a game first");
        await emitAck(s, "join", { gameId: id });
        assert.equal((await emitAck(s, "command", { cmd: "move" })).error, "no command");
        const theirs = await emitAck(s, "command", { cmd: { type: "move", country: "ULM", army: 48, to: 49 } });
        assert.deepEqual([theirs.ok, theirs.error], [false, "army 48 is not BAV's"]);
        const ok = await emitAck(s, "command", { cmd: { type: "move", army: 37, to: 36 } });
        assert.equal(ok.ok, true);
    } finally {
        await server.close();
    }
});

test("each day's changes keep the client's copy exactly in step with the game", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        const j = await emitAck(s, "join", { gameId: id });
        const copy = j.view;
        s.on("tick", (t) => applyChanges(copy, t.changes));
        s.on("private", (p) => applyPrivate(copy, j.me, p.changes));
        await emitAck(s, "command", { cmd: { type: "move", army: 37, to: 36 } });
        const day = await runUntil(s, 200);
        await new Promise((r) => setTimeout(r, 50));                       // the last tick's messages
        const fresh = (await emitAck(s, "join", { gameId: id })).view;
        assert.equal(copy.day, day);
        assert.deepEqual(copy, fresh);
        assert.equal(fresh.armies[37].at, "36");                          // Munich's garrison went to Passau
    } finally {
        await server.close();
    }
});

test("leaving pauses a single-player game", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        await emitAck(s, "pause", { paused: false });
        await waitFor(s, "tick", (t) => t.day >= 20);
        s.close();
        await new Promise((r) => setTimeout(r, 200));
        const room = server.app.rooms.get(id);
        assert.equal(room.paused, true);
        const day = room.day;
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(room.day, day);
    } finally {
        await server.close();
    }
});

test("a restarted server resumes the game exactly, and its log replays it from the seed", async () => {
    const dbPath = tempDb();
    let server = await startServer({ dbPath });
    let before, id;
    try {
        id = await newGame(server);
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        await emitAck(s, "command", { cmd: { type: "move", army: 37, to: 48 } });   // refused: Ulm is neutral
        await emitAck(s, "command", { cmd: { type: "declareWar", target: "ULM" } });
        await emitAck(s, "command", { cmd: { type: "move", army: 37, to: 48 } });
        await runUntil(s, 450);                                            // past the snapshot of day 365
        before = (await emitAck(s, "join", { gameId: id })).view;
    } finally {
        await server.close();
    }

    // what was saved: the commands, human and computer, and the snapshot of 1 January 1441
    const db = openDb(dbPath);
    const rows = db.db.prepare("SELECT day, country, source, cmd FROM commands WHERE game_id = ? ORDER BY seq").all(id);
    assert.deepEqual(rows.slice(0, 2).map((r) => [r.day, r.country, r.source, JSON.parse(r.cmd).type]), [[0, "BAV", "human", "declareWar"], [0, "BAV", "human", "move"]]);
    assert.ok(rows.some((r) => r.source === "computer"));
    assert.equal(db.q.snapshot.get(id).day, 365);
    const game = db.q.game.get(id);
    assert.equal(game.day, before.day);
    // the log alone rebuilds the game from its seed
    const rebuilt = replay(scenario, game.seed, rows.map((r) => ({ day: r.day, cmd: JSON.parse(r.cmd) })), game.day, ["BAV"]);
    assert.deepEqual(JSON.parse(JSON.stringify(viewFor(rebuilt.state, "BAV"))), before);
    db.close();

    server = await startServer({ dbPath });
    try {
        const s = await connect(server);
        const j = await emitAck(s, "join", { gameId: id });
        assert.equal(j.paused, true);
        assert.deepEqual(j.view, before);
    } finally {
        await server.close();
    }
});

test("each game logs how long its days take", async () => {
    const lines = [];
    const server = await startServer({ dbPath: tempDb(), statsEvery: 50, lines });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        await runUntil(s, 120);
        const timing = lines.filter((l) => l.includes("game.timing"));
        assert.ok(timing.length >= 2);
        assert.match(timing[0], new RegExp(`game=${id} days=50 mean_ms=[\\d.]+ max_ms=[\\d.]+ budget_ms=2`));
    } finally {
        await server.close();
    }
});

test("money orders go through the worker; a country's private part reaches only its player", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        const j = await emitAck(s, "join", { gameId: id });
        assert.deepEqual([j.view.countries.BAV.tax, j.view.countries.BAV.law, j.view.countries.BAV.techs.length, j.view.countries.BAV.slider], [2, "feudal", 5, 50]);
        assert.equal(j.view.countries.ULM.tax, undefined);
        assert.equal(j.view.countries.ULM.reserve, undefined);
        const seen = [];
        s.on("tick", (t) => seen.push(t.changes));
        const mine = waitFor(s, "private", (p) => p.changes.tax === 2.5);
        const ok = await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.5 } });
        assert.equal(ok.ok, true);
        const got = await mine;
        assert.equal(got.changes.tax, 2.5);
        const refused = await emitAck(s, "command", { cmd: { type: "setTax", tax: 9 } });
        assert.deepEqual([refused.ok, refused.error], [false, "the tax is from 2 to 3 in steps of 0.1"]);
        const bought = await emitAck(s, "command", { cmd: { type: "buyBuilding", building: "workshop", settlement: 37 } });
        assert.equal(bought.ok, true);
        await runUntil(s, 70);
        for (const c of seen) for (const country of Object.values(c.countries ?? {})) {
            for (const secret of ["treasury", "tax", "law", "bank", "loans", "reserve", "techs"]) assert.equal(secret in country, false, `${secret} was sent to everyone`);
        }
        const fresh = (await emitAck(s, "join", { gameId: id })).view;
        assert.equal(fresh.settlements[37].workshop, true);
        assert.equal(fresh.countries.BAV.tax, 2.5);
        assert.ok(Object.keys(fresh.fleets).length >= 14);
    } finally {
        await server.close();
    }
});

test("a player's country is played by the computer while it is handed over, and by nobody once it is handed back", async () => {
    const dbPath = tempDb();
    const server = await startServer({ dbPath });
    let id;
    try {
        id = await newGame(server);
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        const room = server.app.rooms.get(id);
        await runUntil(s, 100);                                            // the player's country does nothing by itself
        server.app.rooms.setCaretaker(room, "BAV", "full");
        await runUntil(s, 400);
        server.app.rooms.setCaretaker(room, "BAV", null);
        await runUntil(s, 700);
    } finally {
        await server.close();
    }
    const db = openDb(dbPath);
    const rows = db.db.prepare("SELECT day, source, cmd FROM commands WHERE game_id = ? AND country = 'BAV' ORDER BY seq").all(id);
    db.close();
    assert.ok(rows.length > 0 && rows.every((r) => r.source === "caretaker"), "BAV's only commands are the computer's");
    assert.ok(rows.every((r) => r.day > 100 && r.day <= 401), `from the day it was handed over to the day it was handed back (${rows.map((r) => r.day).slice(-3)})`);
});
