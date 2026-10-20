// Sharpshooters at passes (RULES.md §5, §8), what a capture does (RULES.md §2, §8), and mercenaries in battle. On
// the tiny map the pass P1 lies in the land of 3, AAA's; BBB's army 5 can reach it by the road 5 — P1.
import test from "node:test";
import assert from "node:assert/strict";
import { fight } from "../../src/engine/battle.js";
import { isCore, menOf } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused, rig } from "../helpers/tiny.js";
import { newArmy } from "../../src/engine/state.js";

const cmd = (type, rest = {}) => ({ type, country: "AAA", ...rest });
const bbb = (type, rest = {}) => ({ type, country: "BBB", ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const popOf = (game, country) => Object.values(game.state.settlements).filter((s) => s.owner === country).reduce((n, s) => n + s.pop, 0);

function withPost(n = 100) {
    const game = tinyGame();
    game.state.countries.AAA.techs.push("sharpshooters");
    game.state.posts.P1 = { owner: "AAA", n };
    order(game, cmd("declareWar", { target: "BBB" }));
    return game;
}

test("sharpshooters are bought by the hundred at a pass of yours, up to 500, within the army cap", () => {
    const game = tinyGame(), c = game.state.countries.AAA;
    assert.match(refused(game, cmd("buySharpshooters", { pass: "P1", lots: 1 })), /not unlocked/);
    c.techs.push("sharpshooters");
    assert.match(refused(game, bbb("buySharpshooters", { pass: "P1", lots: 1 })), /lies in the land of AAA/);
    assert.match(refused(game, cmd("buySharpshooters", { pass: "P9", lots: 1 })), /no pass/);
    order(game, cmd("buySharpshooters", { pass: "P1", lots: 2 }));
    assert.deepEqual([game.state.posts.P1, c.treasury], [{ owner: "AAA", n: 200 }, 80000 - 30000]);
    assert.match(refused(game, cmd("buySharpshooters", { pass: "P1", lots: 3 })), /more soldiers than your law/);   // 1,600 + 200 + 300 > 2,000
    order(game, cmd("setLaw", { law: "mass" }));
    c.treasury = 1e6;
    order(game, cmd("buySharpshooters", { pass: "P1", lots: 3 }));
    assert.match(refused(game, cmd("buySharpshooters", { pass: "P1", lots: 1 })), /at most 500/);
    assert.equal(game.state.posts.P1.n, 500);
});

test("a post fires once at each enemy army that arrives: sharpshooters × d6 men, at most a quarter", () => {
    const game = withPost(100);
    setArmy(game, 5, { swords: 4000 });
    order(game, bbb("move", { army: 5, to: "P1" }));
    rig(game, 3);                                                              // d6 = 3: 300 men
    const events = runTo(game, 91);
    assert.deepEqual(ofType(events, "sharpshooters").map((e) => [e.pass, e.dead]), [["P1", 300]]);
    assert.equal(game.state.armies[5].men.swords, 3700);
    runTo(game, 200);
    assert.equal(game.state.armies[5].men.swords, 3700);                       // staying costs nothing more
    // a weak army is capped at a quarter
    const game2 = withPost(500);
    setArmy(game2, 5, { swords: 400 });
    order(game2, bbb("move", { army: 5, to: "P1" }));
    rig(game2, 6);
    runTo(game2, 91);
    assert.equal(game2.state.armies[5].men.swords, 300);
});

test("an army that leaves and comes back is fired on again", () => {
    const game = withPost(40);
    setArmy(game, 5, { swords: 4000 });
    order(game, bbb("move", { army: 5, to: "P1" }));
    runTo(game, 91);
    const after1 = game.state.armies[5].men.swords;
    assert.ok(after1 < 4000);
    order(game, bbb("move", { army: 5, to: 5 }));
    runTo(game, 91 + 91);
    order(game, bbb("move", { army: 5, to: "P1" }));
    runTo(game, 91 + 91 + 91);
    assert.ok(game.state.armies[5].men.swords < after1);
});

test("storming a post: 2.5 power each, dug in at ×2; it falls to a stronger army and the dead are lost people", () => {
    const game = withPost(100);
    setArmy(game, 5, { swords: 4000 });
    order(game, bbb("move", { army: 5, to: "P1" }));
    runTo(game, 91);
    const pop = popOf(game, "AAA"), men = game.state.armies[5].men.swords;     // what the post's volley left
    rig(game, 4, 4, 3, 3);
    const events = order(game, bbb("stormPost", { army: 5 }));
    const [battle] = ofType(events, "battle");
    assert.deepEqual([battle.kind, battle.winner, battle.a.power, battle.b.power], ["post", "a", men * 12, 100 * 2.5 * 2 * 10]);
    assert.equal(game.state.posts.P1, undefined);                              // wiped out
    assert.equal(battle.b.dead, 100);
    assert.ok(popOf(game, "AAA") < pop);
    assert.match(refused(game, bbb("stormPost", { army: 5 })), /not at a pass held by an enemy post/);
});

test("a post that wins destroys a far weaker army and keeps nearly all its men", () => {
    const game = withPost(500);
    setArmy(game, 5, { swords: 100 });
    order(game, bbb("move", { army: 5, to: "P1" }));
    runTo(game, 91);
    assert.equal(game.state.armies[5].men.swords, 75);                         // the volley took its quarter
    const events = order(game, bbb("stormPost", { army: 5 }));
    const [battle] = ofType(events, "battle");
    assert.deepEqual([battle.winner, battle.destroyed], ["b", [5]]);
    assert.equal(game.state.armies[5], undefined);
    assert.ok(game.state.posts.P1.n >= 490 && game.state.posts.P1.n < 500);
});

test("the pass changes hands with its settlement, and its sharpshooters die", () => {
    const game = withPost(100);
    delete game.state.armies[3];                                               // AAA's garrison at 3 is gone
    const men = { ...setArmy(game, 2, { swords: 0 }).men, swords: 200 };
    newArmy(game.state, "BBB", "3", men);
    const pop = popOf(game, "AAA");
    const events = runTo(game, 1);
    assert.equal(game.state.settlements[3].owner, "BBB");
    assert.deepEqual(ofType(events, "postLost").map((e) => [e.pass, e.dead]), [["P1", 100]]);
    assert.equal(game.state.posts.P1, undefined);
    assert.ok(popOf(game, "AAA") < pop);
});

test("a captured settlement: held from today, courthouse lost, queued men cancelled, the rest and its cores stay", () => {
    const game = tinyGame();
    const s = game.state.settlements[3];
    Object.assign(s, { walls: true, library: true, workshop: true, market: true, courthouse: true });
    game.state.countries.AAA.training.push({ settlement: 3, kind: "soldiers", n: 1000, ready: 100 });
    game.state.countries.AAA.hires.push({ settlement: 3, n: 1000, ready: 100 });
    order(game, bbb("declareWar", { target: "AAA" }));
    delete game.state.armies[3];
    newArmy(game.state, "BBB", "3", { ...setArmy(game, 2, { swords: 0 }).men, swords: 100 });
    runTo(game, 5);
    assert.equal(s.owner, "BBB");
    assert.deepEqual([s.heldSince, s.courthouse, s.walls, s.library, s.workshop, s.market, s.cores], [1, false, true, true, true, true, ["AAA"]]);
    assert.deepEqual([game.state.countries.AAA.training, game.state.countries.AAA.hires], [[], []]);
    assert.equal(isCore(game.state, s, "AAA"), true);                          // so if AAA retakes it, it is core again
    assert.equal(isCore(game.state, s, "BBB"), false);
});

test("mercenaries are foreigners: their dead cost no population", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "BBB" }));
    setArmy(game, 1, { pikes: 400 }).mercs = 400;
    setArmy(game, 4, { swords: 400 });
    rig(game, 4, 4, 4, 4);                                                     // 7 and 7... both roll 12
    const aaa = popOf(game, "AAA"), bbb = popOf(game, "BBB");
    const ev = fight(game, { kind: "test", place: "1", a: [game.state.armies[4]], b: [game.state.armies[1]], tie: "b" });
    assert.equal(ev.winner, "b");                                              // pikes ×1.2 beat swords ×1
    assert.ok(ev.b.dead > 0);
    assert.equal(popOf(game, "AAA"), aaa);                                     // 40 mercenaries died: no AAA people
    assert.ok(popOf(game, "BBB") < bbb);
    const army = game.state.armies[1];
    assert.deepEqual([army.mercs, menOf(army)], [400 - ev.b.dead, 400 - ev.b.dead]);
});

test("mercenaries stay with the men taken when an army splits, and join when armies merge", () => {
    const game = tinyGame();
    setArmy(game, 1, { swords: 400, pikes: 400 }).mercs = 400;
    const [ev] = order(game, cmd("split", { army: 1, men: { pikes: 400 } }));
    const part = game.state.armies[ev.into];
    assert.deepEqual([part.mercs, game.state.armies[1].mercs], [200, 200]);    // in proportion to the men taken
    order(game, cmd("merge", { army: part.id, into: 1 }));
    assert.equal(game.state.armies[1].mercs, 400);
});
