// Diplomacy through the server (docs/plan.md, milestone 4): what a player sees of it, commands over a socket, and a game
// that ends when someone wins.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Game } from "../../src/engine/index.js";
import { Changes, viewFor } from "../../src/game/view.js";
import { applyChanges, applyPrivate } from "../../public/js/mirror.js";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { connect, emitAck, newGame, api, runUntil, startServer, tempDb, waitFor } from "./helpers.js";

test("diplomacy is public, except the questions put to a human, which only the two countries see", () => {
    const game = Game.create(scenario, { seed: 1, humans: ["BAV", "ULM"] });
    game.command({ type: "proposeAgreement", country: "RUH", with: "BAV", kind: "pact" });
    game.command({ type: "declareWar", country: "BRB", target: "SAX" });
    assert.equal(game.state.offers.length, 1);
    const bav = viewFor(game.state, "BAV"), ulm = viewFor(game.state, "ULM"), ruh = viewFor(game.state, "RUH");
    assert.equal(bav.countries.BAV.offers.length, 1);
    assert.deepEqual(ruh.countries.RUH.offers.map((o) => o.kind), ["agreement"]);          // the one who asked sees it too
    assert.deepEqual(ulm.countries.ULM.offers, []);
    assert.equal(ulm.countries.BAV.offers, undefined);                                      // not another country's questions
    for (const v of [bav, ulm]) {
        assert.deepEqual(v.wars, ["BRB|SAX"]);
        assert.equal(v.countries.BRB.warmonger, 5);
        assert.ok(v.warInfo["BRB|SAX"]);
        assert.deepEqual(v.humans, ["BAV", "ULM"]);
    }
});

test("a player's copy of the diplomatic state stays in step with the game", () => {
    const game = Game.create(scenario, { seed: 1, humans: ["BAV"] });
    const changes = new Changes(game.state), copy = JSON.parse(JSON.stringify(viewFor(game.state, "BAV")));
    const step = () => { const { pub, priv } = changes.next(game.state); applyChanges(copy, pub); if (priv.BAV) applyPrivate(copy, "BAV", priv.BAV); };
    game.command({ type: "declareWar", country: "BRB", target: "SAX" });
    game.command({ type: "proposeAgreement", country: "RUH", with: "BAV", kind: "pact" });
    game.command({ type: "proposeAgreement", country: "NED", with: "BEL", kind: "guarantee" });
    step();
    game.advance();
    step();
    assert.deepEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(viewFor(game.state, "BAV"))));
    game.command({ type: "answerOffer", country: "BAV", id: game.state.offers[0].id, accept: true });
    game.command({ type: "proposePeace", country: "BRB", with: "SAX" });
    step();
    assert.deepEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(viewFor(game.state, "BAV"))));
});

test("over a socket a player proposes, is answered at once, and everyone sees the agreement", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        const j = await emitAck(s, "join", { gameId: id });
        const copy = j.view;
        s.on("tick", (t) => applyChanges(copy, t.changes));
        s.on("private", (p) => applyPrivate(copy, j.me, p.changes));
        assert.deepEqual(copy.humans, ["BAV"]);
        const r = await emitAck(s, "command", { cmd: { type: "proposeAgreement", with: "SWI", kind: "guarantee" } });
        assert.equal(r.ok, true);
        const answer = r.events.find((e) => e.type === "answer");
        assert.deepEqual([answer.country, answer.what], ["SWI", "guarantee"]);
        const war = await emitAck(s, "command", { cmd: { type: "declareWar", target: "ULM" } });
        assert.equal(war.ok, true);
        assert.equal((await emitAck(s, "command", { cmd: { type: "declareWar", target: "ULM" } })).ok, false);
        await runUntil(s, 30);
        await new Promise((r) => setTimeout(r, 80));                                        // the last tick's messages
        const fresh = (await emitAck(s, "join", { gameId: id })).view;
        assert.ok(copy.wars.includes("BAV|ULM"));                                           // the computer countries declare wars too
        assert.deepEqual(copy, fresh);
        // +5 for the war, less 2 at each New Year the game has run through (with 2 ms days a loaded machine may run several)
        assert.equal(fresh.countries.BAV.warmonger, Math.max(0, 5 - 2 * Math.floor(fresh.day / 365)));
    } finally {
        await server.close();
    }
});

test("a game with a winner is saved as finished, tells its players, and is not resumed", async () => {
    // a scenario where 6 settlements win: the computer countries' wars decide who gets there first
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lc-root-"));
    fs.mkdirSync(path.join(root, "scenarios", "mitteleuropa"), { recursive: true });
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "scenario.json"), JSON.stringify({ ...scenario, victory: { settlements: 6, endYear: 1700 } }));
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "SCENARIO.md"), "# SCENARIO: TEST\n");
    const dbPath = tempDb();
    let server = await startServer({ dbPath, root });
    let id;
    try {
        id = await newGame(server, { scenario: "mitteleuropa", country: "BAV", seed: 5 });
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        const over = waitFor(s, "over");
        const ticks = [];
        s.on("tick", (t) => ticks.push(t));
        await emitAck(s, "pause", { paused: false });
        const o = await over;
        const victory = ticks.flatMap((t) => t.events).find((e) => e.type === "victory");
        assert.deepEqual([victory.country, victory.why], [o.winner, "reached"]);
        assert.ok(victory.settlements >= 6);
        assert.equal(o.abandoned, undefined);
        const last = ticks.at(-1).day;
        await new Promise((r) => setTimeout(r, 100));
        assert.equal(ticks.at(-1).day, last);                                               // time stands still
        assert.match((await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.5 } })).error, /game is over/);
        const games = (await api(server, "GET", "/api/games")).body;
        assert.deepEqual(games.map((g) => [g.id, g.status]), [[id, "finished"]]);
    } finally {
        await server.close();
    }
    server = await startServer({ dbPath, root });
    try {
        assert.equal(server.app.rooms.get(id), undefined);                                  // not brought back
        const games = (await api(server, "GET", "/api/games")).body;
        assert.deepEqual(games.map((g) => [g.id, g.status, g.live]), [[id, "finished", false]]);
        assert.equal(server.app.db.q.game.get(id).winner !== null, true);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
