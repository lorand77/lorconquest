// Marching (RULES.md §8): timing, passes, passing through, taking undefended settlements, stopping where an
// enemy stands, turning back and stopping.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { progress } = require("../../src/engine/index.mjs");
const { tinyGame, setArmy, runTo, order } = require("../helpers/tiny");

test("an army takes its route's days, at an even pace", () => {
    const game = tinyGame();
    order(game, { type: "move", country: "AAA", army: 1, to: 2 });
    const a = game.state.armies[1];
    assert.deepEqual(a.march, { from: "1", to: "2", start: 0, end: 73 });
    runTo(game, 36);
    assert.ok(Math.abs(progress(a.march, game.day) - 36 / 73) < 1e-9);
    const events = runTo(game, 73);
    assert.equal(a.at, "2");
    assert.deepEqual(events.map((e) => [e.type, e.day]), [["arrive", 73]]);
});

test("a route through a pass is two legs, and an army can stop at the pass", () => {
    const game = tinyGame();
    order(game, { type: "move", country: "AAA", army: 3, to: "P1" });
    runTo(game, 91);
    assert.equal(game.state.armies[3].at, "P1");
    order(game, { type: "declareWar", country: "AAA", target: "CCC" });   // not BBB: 5 stays closed
    assert.equal(game.command({ type: "move", country: "AAA", army: 3, to: 5 }).ok, false);
});

test("an army passes through its own places and takes undefended enemy ones on the way", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    order(game, { type: "move", country: "AAA", army: 3, to: "P1" });
    runTo(game, 91);
    order(game, { type: "move", country: "BBB", army: 5, to: 4 });         // 5 is left empty
    order(game, { type: "move", country: "AAA", army: 3, to: 4 });         // P1 -> 5 -> 4
    const events = runTo(game, 182);
    assert.deepEqual(events.filter((e) => e.type === "capture").map((e) => [e.settlement, e.to, e.how, e.day]), [[5, "AAA", "undefended", 182]]);
    assert.equal(game.state.armies[3].march.to, "4");                       // and carries on
    assert.equal(game.state.armies[3].march.start, 182);
});

test("an army stops where an enemy stands: at a defended settlement it begins a siege", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    order(game, { type: "move", country: "AAA", army: 3, to: "P1" });
    runTo(game, 91);
    order(game, { type: "move", country: "AAA", army: 3, to: 4 });         // P1 -> 5 -> 4, but 5 is held
    const events = runTo(game, 200);
    const a = game.state.armies[3];
    assert.equal(a.at, "5");
    assert.deepEqual(a.path, []);
    const siege = events.find((e) => e.type === "siegeStart");
    assert.deepEqual([siege.settlement, siege.by, siege.day, siege.days], [5, "AAA", 182, 183]);
    assert.equal(game.state.settlements[5].siege.end, 182 + 183);
});

test("a new order turns an army back from where it is; stop halts it at the next place", () => {
    const game = tinyGame();
    order(game, { type: "move", country: "AAA", army: 1, to: 2 });
    runTo(game, 20);
    order(game, { type: "move", country: "AAA", army: 1, to: 1 });
    assert.equal(game.state.armies[1].march.to, "1");
    runTo(game, 39);
    assert.ok(game.state.armies[1].march);
    runTo(game, 40);
    assert.equal(game.state.armies[1].at, "1");                             // 20 days out, 20 back

    order(game, { type: "move", country: "AAA", army: 2, to: 3 });         // 2 -> 1 -> 3
    order(game, { type: "stop", country: "AAA", army: 2 });
    runTo(game, 120);
    assert.equal(game.state.armies[2].at, "1");
});

test("a besieger that leaves lifts the siege", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    assert.ok(game.state.settlements[5].siege);
    const r = order(game, { type: "move", country: "AAA", army: 3, to: 3 });
    assert.equal(r[0].type, "siegeLifted");
    assert.equal(game.state.settlements[5].siege, null);
});
