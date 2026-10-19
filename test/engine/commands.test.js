// The one validator (src/engine/commands.mjs): what it refuses, and splitting and merging armies.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { tinyGame, setArmy, runTo, order } = require("../helpers/tiny");

const refused = (game, cmd) => {
    const r = game.command(cmd);
    assert.equal(r.ok, false, `accepted: ${JSON.stringify(cmd)}`);
    return r.error;
};

test("commands that are refused, and why", () => {
    const game = tinyGame();
    assert.match(refused(game, { type: "fly", country: "AAA" }), /unknown command/);
    assert.match(refused(game, { type: "move", country: "ZZZ", army: 1, to: 2 }), /no country/);
    assert.match(refused(game, { type: "move", country: "AAA", army: 99, to: 2 }), /no army/);
    assert.match(refused(game, { type: "move", country: "AAA", army: 4, to: 2 }), /not AAA's/);
    assert.match(refused(game, { type: "move", country: "AAA", army: 1, to: 1 }), /already at/);
    assert.match(refused(game, { type: "move", country: "AAA", army: 1, to: 77 }), /no place/);
    assert.match(refused(game, { type: "move", country: "AAA", army: 1, to: 4 }), /no way/);            // BBB is neutral
    assert.match(refused(game, { type: "declareWar", country: "AAA", target: "AAA" }), /itself/);
    assert.match(refused(game, { type: "declareWar", country: "AAA", target: "XYZ" }), /no country/);
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    assert.match(refused(game, { type: "declareWar", country: "BBB", target: "AAA" }), /already at war/);
    assert.match(refused(game, { type: "storm", country: "AAA", army: 1 }), /not at an enemy settlement/);
    assert.match(refused(game, { type: "besiege", country: "AAA", army: 1 }), /not at an enemy settlement/);
    assert.match(refused(game, { type: "sortie", country: "AAA", army: 1 }), /not in a besieged settlement/);
    order(game, { type: "move", country: "AAA", army: 1, to: 2 });
    assert.match(refused(game, { type: "storm", country: "AAA", army: 1 }), /on the march/);
    assert.match(refused(game, { type: "split", country: "AAA", army: 1, men: { swords: 1 } }), /on the march/);
    assert.equal(game.log.length, 2);                                      // only accepted commands are logged
});

test("a storm within 3 months of the last battle between the same armies is refused", () => {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    setArmy(game, 3, { swords: 5000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    setArmy(game, 5, { swords: 20000 });
    order(game, { type: "sortie", country: "BBB", army: 5 });              // army 3 is beaten and retreats...
    order(game, { type: "move", country: "BBB", army: 5, to: "P1" });
    assert.equal(game.state.cooldowns["3|5"], 182 + 91);
});

test("split and merge", () => {
    const game = tinyGame();
    setArmy(game, 1, { swords: 500, pikes: 300, cannons: 2, crew: 20 });
    assert.match(refused(game, { type: "split", country: "AAA", army: 1, men: { swords: 600 } }), /has 500 swords/);
    assert.match(refused(game, { type: "split", country: "AAA", army: 1, men: { lances: 5 } }), /no weapon/);
    assert.match(refused(game, { type: "split", country: "AAA", army: 1, men: { swords: 1.5 } }), /not 1.5/);
    assert.match(refused(game, { type: "split", country: "AAA", army: 1 }), /nothing to split/);
    assert.match(refused(game, { type: "split", country: "AAA", army: 1, men: { swords: 500, pikes: 300 }, cannons: 2, crew: 20 }), /whole army/);
    assert.match(refused(game, { type: "split", country: "AAA", army: 1, cannons: 1, crew: 5 }), /10 crew/);
    const [ev] = order(game, { type: "split", country: "AAA", army: 1, men: { pikes: 100 }, cannons: 1, crew: 10 });
    const part = game.state.armies[ev.into];
    assert.equal(part.id, 7);                                              // the next id after the six garrisons
    assert.deepEqual([part.at, part.men.pikes, part.cannons, part.crew], ["1", 100, 1, 10]);
    assert.deepEqual([game.state.armies[1].men.pikes, game.state.armies[1].cannons], [200, 1]);
    assert.match(refused(game, { type: "merge", country: "AAA", army: 7, into: 2 }), /not in the same place/);
    assert.match(refused(game, { type: "merge", country: "AAA", army: 7, into: 7 }), /itself/);
    order(game, { type: "merge", country: "AAA", army: 7, into: 1 });
    assert.equal(game.state.armies[7], undefined);
    assert.deepEqual([game.state.armies[1].men.pikes, game.state.armies[1].cannons, game.state.armies[1].crew], [300, 2, 20]);
});
