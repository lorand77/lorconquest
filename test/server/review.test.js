// What a review of the whole project found in the server, held true: the day's private events go only to the countries
// concerned, a command padded with junk is refused before it reaches the log, and a player who quits gives no orders and
// writes no chat from another tab.
import test from "node:test";
import assert from "node:assert/strict";
import { splitEvents } from "../../src/game/view.js";
import { api, connect, emitAck, newGame, startServer, tempDb } from "./helpers.js";

test("the day's events: research, a law, a default and a question to a person go only to the countries concerned", () => {
    const { pub, priv } = splitEvents([
        { type: "capture", settlement: 5, from: "BBB", to: "AAA" },
        { type: "tech", country: "AAA", tech: "muskets" },
        { type: "offer", country: "BBB", from: "AAA", what: "demand" },
        { type: "law", country: "CCC", law: "mass" },
    ]);
    assert.deepEqual(pub.map((e) => e.type), ["capture"]);
    assert.deepEqual(Object.fromEntries(Object.entries(priv).map(([c, list]) => [c, list.map((e) => e.type)])), { AAA: ["tech", "offer"], BBB: ["offer"], CCC: ["law"] });
});

test("a command longer than any real one is refused, not logged", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server);
        const s = await connect(server);
        await emitAck(s, "join", { gameId: id });
        const r = await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.5, junk: "x".repeat(20000) } });
        assert.deepEqual([r.ok, r.error], [false, "that command is too long"]);
        assert.equal((await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.5 } })).ok, true);
    } finally {
        await server.close();
    }
});

test("one who quits a game with others gives no orders and writes no chat from another tab", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 0 });
    try {
        const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "BAV", seed: 5 }, "alice");
        await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: "ULM" }, "bobby");
        await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, "alice");
        const one = await connect(server, "alice"), two = await connect(server, "alice"), bob = await connect(server, "bobby");
        for (const s of [one, two, bob]) assert.equal((await emitAck(s, "join", { gameId: made.body.id })).ok, true);
        assert.equal((await emitAck(one, "quit", {})).ok, true);
        assert.deepEqual(await emitAck(two, "command", { cmd: { type: "setTax", tax: 2.5 } }).then((r) => [r.ok, r.error]), [false, "you left this game"]);
        assert.deepEqual(await emitAck(two, "chat", { text: "still here" }).then((r) => [r.ok, r.error]), [false, "you left this game"]);
    } finally {
        await server.close();
    }
});
