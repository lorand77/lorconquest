// Sea lanes (RULES.md §8): an army sails from port to port up to three sea zones away, with ships of its country at both ends
// and no enemy fleet at sea on the way, 2 months a zone; it fights at ×0.75 the day it lands unless its side blockades the port;
// it never retreats by sea; a peace may hand over a port it could land at. On the tiny map 1 (AAA) is a port in "north", 4 (BBB)
// one in "south", the two zones next to each other: 1 to 4 is 6 months by road, 4 by sea.
import test from "node:test";
import assert from "node:assert/strict";
import { fight } from "../../src/engine/battle.js";
import { outOfReach } from "../../src/engine/diplomacy.js";
import { routeFor, withinDemandReach } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, giveFleet } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });

test("a voyage: port to port with ships at both ends, none of the enemy's at sea, two months a zone, at sea all the way", () => {
    const game = tinyGame(), st = game.state, army = st.armies[1];
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(routeFor(game, army, "4").path, ["2", "4"], "no ships: by road");
    giveFleet(game, "AAA", { cogs: 10 }, 1, "north");
    assert.deepEqual(routeFor(game, army, "4").path, ["2", "4"], "ships at one end only");
    giveFleet(game, "AAA", { cogs: 10 }, null, "south");
    assert.deepEqual((({ path, days }) => [path, days])(routeFor(game, army, "4")), [["4"], 122]);
    const enemy = giveFleet(game, "BBB", { cogs: 1 }, null, "south");
    assert.deepEqual(routeFor(game, army, "4").path, ["2", "4"], "an enemy fleet at sea where it would land");
    enemy.port = 4;                                                            // in port it stops nobody
    assert.deepEqual(routeFor(game, army, "4").path, ["4"]);
    assert.deepEqual(routeFor(game, { ...army, retreating: true }, "4").path, ["2", "4"], "never in retreat");
    order(game, cmd("AAA", "move", { army: 1, to: 4 }));
    assert.deepEqual([army.march.from, army.march.to, army.march.sea, army.march.end - army.march.start], ["1", "4", ["north", "south"], 122]);
    runTo(game, 122);
    assert.deepEqual([army.at, army.landed], ["4", 122], "ashore at 4 the day it arrives");
});

test("a voyage is checked as it sets out: the ships must be at both ends then; and a neutral's port is no landing", async () => {
    const { follow } = await import("../../src/engine/movement.js");
    const game = tinyGame(), st = game.state;
    giveFleet(game, "AAA", { cogs: 10 }, 1, "north");
    const south = giveFleet(game, "AAA", { cogs: 10 }, null, "south");
    assert.equal(routeFor(game, st.armies[1], "4"), null, "at peace with BBB: no way into its land, by sea or road");
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    south.zone = "north";                                                      // the ships at the far end have sailed off
    const events = [];
    assert.equal(follow(game, st.armies[1], ["4"], events), false);
    assert.deepEqual(events.map((e) => [e.type, e.zone, e.why]), [["crossFailed", "south", "too few ships"]]);
    assert.equal(st.armies[1].at, "1");
});

test("landing: ×0.75 the day it lands, for the landed men's share of a side — unless a fleet of its side blockades the port", () => {
    const battle = (blockade, partner = 0) => {
        const game = tinyGame(), st = game.state;
        order(game, cmd("AAA", "declareWar", { target: "BBB" }));
        const a = setArmy(game, 1, { swords: 1000 });
        a.at = "4";
        a.landed = st.day;
        const side = [a];
        if (partner) { const p = setArmy(game, 2, { swords: partner }); p.at = "4"; side.push(p); }
        if (blockade) giveFleet(game, "AAA", { cogs: 10 }, null, "south").order = { type: "blockade", port: 4 };
        return fight(game, { kind: "field", place: "4", a: side, b: [st.armies[4]], tie: "b" });
    };
    assert.equal(battle(false).a.landing, 0.75);
    assert.equal(battle(false).b.landing, undefined);
    assert.equal(battle(false, 1000).a.landing, 0.875, "half the side ashore");
    assert.equal(battle(true).a.landing, undefined, "the blockade covers it");
});

test("a peace may hand over a port its winner could land at, whatever the fleets — but a sea lane makes no neighbours", () => {
    // Eight (EEE's) made a port in "south": two zones from AAA's One
    const game = tinyGame(1, (sc) => { sc.settlements[7].port = true; sc.settlements[7].seaZone = "south"; sc.seaZones[1].ports.push(8); });
    order(game, cmd("AAA", "declareWar", { target: "EEE" }));
    assert.deepEqual(outOfReach(game, "AAA", [8]), [], "by sea from One");
    assert.deepEqual(outOfReach(game, "AAA", [7]), [7], "no port: by land only");
    assert.equal(withinDemandReach(game, "AAA", "EEE"), false, "no neighbour by sea");
});
