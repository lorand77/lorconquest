// Supply and retreats (RULES.md §5, §8): hunger outside friendly land, retreats to the nearest refuge, armies
// with nowhere to go, and what a retreating army may and may not do.
import test from "node:test";
import assert from "node:assert/strict";
import { tinyGame, setArmy, runTo, order, rig } from "../helpers/tiny.js";

const ofType = (events, type) => events.filter((e) => e.type === type);
// put an army on the road to `to`, arriving long after the next month starts
const marchTo = (game, id, from, to) => { Object.assign(game.state.armies[id], { at: null, march: { from, to, start: game.day, end: game.day + 300 } }); };

test("an army outside friendly land with more men than the land feeds loses 1% a month", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    setArmy(game, 3, { swords: 6000 });
    marchTo(game, 3, "P1", "5");                                           // counts in the land of 5: feeds 5,000
    setArmy(game, 2, { swords: 4000 });
    marchTo(game, 2, "2", "4");                                            // the land of 4, a city: feeds 10,000
    const events = runTo(game, 31);                                        // 1 February
    const lost = ofType(events, "attrition");
    assert.deepEqual(lost.map((e) => [e.army, e.dead, e.hungry, e.sick]), [[3, 60, true, false]]);
});

test("a river feeds half as many again; armies of one country in one land count together", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    setArmy(game, 4, { swords: 14000 });
    marchTo(game, 4, "2", "1");                                            // 1 is a city on a river: feeds 15,000
    setArmy(game, 3, { swords: 3000 });
    marchTo(game, 3, "P1", "5");
    setArmy(game, 1, { swords: 3000 });
    marchTo(game, 1, "P1", "5");                                           // 6,000 together in the land of 5
    const events = runTo(game, 31);
    assert.deepEqual(ofType(events, "attrition").map((e) => [e.army, e.dead]), [[1, 30], [3, 30]]);
});

test("at home an army never goes hungry; a hungry besieger loses 2%", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    setArmy(game, 1, { swords: 100000 });
    setArmy(game, 3, { swords: 6000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });         // 3 -> P1 -> 5, a siege from day 182
    const before = runTo(game, 211);                                       // hungry on the road from P1 already
    const men = game.state.armies[3].men.swords;
    const events = runTo(game, 212);                                       // 1 August
    assert.deepEqual(ofType(events, "attrition").map((e) => [e.army, e.sick, e.hungry, e.dead]), [[3, true, true, Math.round(0.02 * men)]]);
    assert.ok(![...before, ...events].some((e) => e.type === "attrition" && e.army === 1));
});

test("a beaten army with nowhere to go dies to the last man", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    setArmy(game, 3, { swords: 1000 });
    order(game, { type: "move", country: "AAA", army: 3, to: "P1" });
    setArmy(game, 4, { swords: 4000 });
    order(game, { type: "move", country: "BBB", army: 4, to: "P1" });     // 4 -> 5 -> P1, there at day 164
    runTo(game, 100);
    game.state.settlements[4].owner = game.state.settlements[5].owner = "AAA";   // BBB has lost everything meanwhile
    delete game.state.armies[5];
    rig(game, 1, 1, 6, 6);
    const events = runTo(game, 164);
    const pass = ofType(events, "battle")[0];
    assert.deepEqual([pass.kind, pass.winner, pass.a.power, pass.b.power], ["pass", "b", 24000, 32000]);
    assert.deepEqual(ofType(events, "destroyed").map((e) => [e.army, e.why, e.dead]), [[4, "nowhere to retreat", 2667]]);
});

test("a retreating army takes no orders and takes nothing on its way", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    game.state.settlements[1].owner = "BBB";                               // its refuge
    order(game, { type: "move", country: "AAA", army: 2, to: 3 });         // 2 is left empty
    game.state.armies[1].owner = "BBB";
    Object.assign(game.state.armies[4], { retreating: true, at: null, march: { from: "4", to: "2", start: 0, end: 110 }, path: ["1"] });
    assert.equal(game.command({ type: "move", country: "BBB", army: 4, to: 5 }).ok, false);
    runTo(game, 111);
    assert.equal(game.state.settlements[2].owner, "AAA");                 // passed through, not taken
    assert.equal(game.state.armies[4].march.to, "1");
});

test("enemies standing at a pass attack a retreating army passing through", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    order(game, { type: "move", country: "AAA", army: 3, to: "P1" });
    runTo(game, 91);
    game.state.settlements[3].owner = "BBB";                               // its refuge, behind the pass
    Object.assign(game.state.armies[5], { retreating: true, at: null, march: { from: "5", to: "P1", start: 91, end: 182 }, path: ["3"] });
    rig(game, 6, 6, 1, 1);
    const events = runTo(game, 182);
    const b = ofType(events, "battle")[0];
    assert.deepEqual([b.kind, b.a.armies, b.b.armies, b.winner], ["pursuit", [3], [5], "a"]);
    assert.equal(b.b.power, 400 * 6);                                      // no defence bonus for the fleeing army
});
