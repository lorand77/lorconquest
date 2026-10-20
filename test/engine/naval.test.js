// Fleets (RULES.md §7, §8): ships bought in ports, crew at sea, sailing between zones, patrols and naval battles,
// blockades, and armies crossing straits. On the tiny map: AAA's port 1 is in the zone "north", BBB's port 4 in
// "south"; north and south are next to each other; the strait 3-6 lies in north (CCC's side is 6).
import test from "node:test";
import assert from "node:assert/strict";
import { economyOf, fleetList, shipsIn } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused, rig, giveFleet } from "../helpers/tiny.js";

const cmd = (type, rest = {}) => ({ type, country: "AAA", ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const rich = (game, code = "AAA") => { game.state.countries[code].treasury = 5000000; };
const popOf = (game, country) => Object.values(game.state.settlements).filter((s) => s.owner === country).reduce((n, s) => n + s.pop, 0);

test("ships are bought ten at a time in a port of yours, joining the fleet there", () => {
    const game = tinyGame(), c = game.state.countries.AAA;
    assert.match(refused(game, cmd("buyShips", { kind: "carracks", port: 1, lots: 1 })), /not unlocked/);
    assert.match(refused(game, cmd("buyShips", { kind: "cogs", port: 2, lots: 1 })), /not a port/);
    assert.match(refused(game, cmd("buyShips", { kind: "cogs", port: 4, lots: 1 })), /not AAA's/);
    assert.match(refused(game, cmd("buyShips", { kind: "cogs", port: 1, lots: 1.5 })), /whole number/);
    assert.match(refused(game, cmd("buyShips", { kind: "cogs", port: 1, lots: 1 })), /costs 100,000/);
    rich(game);
    const [ev] = order(game, cmd("buyShips", { kind: "cogs", port: 1, lots: 1 }));
    const fleet = game.state.fleets[ev.fleet];
    assert.deepEqual([fleet.ships.cogs, fleet.port, fleet.zone, c.treasury], [10, 1, "north", 5000000 - 100000]);
    const [again] = order(game, cmd("buyShips", { kind: "cogs", port: 1, lots: 1 }));
    assert.deepEqual([again.fleet, fleet.ships.cogs], [fleet.id, 20]);
});

test("ships in port need no crew; at sea they take 50 each, as soldiers, within the navy cap", () => {
    const game = tinyGame(), c = game.state.countries.AAA;
    rich(game);
    const [ev] = order(game, cmd("buyShips", { kind: "cogs", port: 1, lots: 1 }));
    assert.equal(c.treasury, 5000000 - 100000);
    const fleet = game.state.fleets[ev.fleet];
    assert.deepEqual([economyOf(game, "AAA").soldiers, economyOf(game, "AAA").crewAtSea], [1600, 0]);
    order(game, cmd("sail", { fleet: fleet.id, zone: "north" }));              // out of port to sea
    assert.equal(fleet.port, null);
    let e = economyOf(game, "AAA");
    assert.deepEqual([e.soldiers, e.crewAtSea, e.civilians, e.upkeep], [2100, 500, 37900, 2100 * 5]);
    assert.match(refused(game, cmd("sail", { fleet: fleet.id, zone: "north" })), /already at sea/);
    order(game, cmd("sail", { fleet: fleet.id, port: 1 }));                    // back in: instant, no crew
    assert.equal(economyOf(game, "AAA").crewAtSea, 0);
    // 30 ships need 1,500 crew; the feudal navy cap is 1,000
    const [more] = order(game, cmd("buyShips", { kind: "cogs", port: 1, lots: 2 }));
    assert.equal(more.fleet, fleet.id);
    assert.equal(fleet.ships.cogs, 30);
    assert.match(refused(game, cmd("sail", { fleet: fleet.id, zone: "north" })), /navy cap/);
    order(game, cmd("splitFleet", { fleet: fleet.id, ships: { cogs: 10 } }));
    order(game, cmd("sail", { fleet: fleet.id, zone: "north" }));              // 20 ships, 1,000 crew: exactly the cap
    assert.match(refused(game, cmd("sail", { fleet: 7 + 1, zone: "north" })), /no fleet|navy cap/);
});

test("a fleet sails to the next zone in 2 months and is nowhere else on the way", () => {
    const game = tinyGame();
    const f = giveFleet(game, "AAA", { cogs: 10 });
    assert.match(refused(game, cmd("sail", { fleet: f.id, zone: "nowhere" })), /not next to/);
    assert.match(refused(game, cmd("sail", { fleet: f.id, port: 4 })), /not a port of AAA/);
    const [ev] = order(game, cmd("sail", { fleet: f.id, zone: "south" }));
    assert.deepEqual([ev.days, f.moving.end, f.zone, f.port], [61, 61, "north", null]);
    assert.match(refused(game, cmd("sail", { fleet: f.id, zone: "north" })), /on its way/);
    assert.match(refused(game, cmd("patrol", { fleet: f.id })), /at sea/);
    assert.equal(shipsIn(game.state, "AAA", "north"), 0);                      // on its way, it counts in no zone
    const events = runTo(game, 61);
    assert.deepEqual(ofType(events, "fleetArrives").map((e) => [e.fleet, e.zone, e.day]), [[f.id, "south", 61]]);
    assert.deepEqual([f.zone, f.moving], ["south", null]);
    assert.match(refused(game, cmd("sail", { fleet: f.id, port: 4 })), /not a port of AAA/);   // BBB's port
});

test("a patrol engages enemy fleets at sea in its zone: power × (2d6 + 4), losses as on land, crew of sunk ships lost", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "BBB" }));
    const a = giveFleet(game, "AAA", { cogs: 12 }, null, "north");
    const b = giveFleet(game, "BBB", { cogs: 6 }, 4, "south");
    order(game, { type: "sail", country: "BBB", fleet: b.id, zone: "north" });
    order(game, cmd("patrol", { fleet: a.id }));
    rig(game, 4, 4, 3, 3);                                                     // the patrol rolls 12, the other 10
    const pop = popOf(game, "BBB");
    const events = runTo(game, 61);
    const [battle] = ofType(events, "battle");
    assert.deepEqual([battle.kind, battle.day, battle.place, battle.winner], ["naval", 61, "north", "a"]);
    assert.deepEqual([battle.a.power, battle.b.power], [12 * 12, 6 * 10]);
    assert.deepEqual([battle.a.dead, battle.b.dead], [1, 4]);                  // 4.2% of 12 → 1; 60% of 6 → 4
    assert.deepEqual([a.ships.cogs, b.ships.cogs], [11, 2]);
    assert.ok(Math.abs(pop - popOf(game, "BBB") - 4 * 50) < 150);              // 4 × 50 crew died (people also grew a little)
    assert.equal(battle.b.unit, "ships");
    // no second battle within 3 months
    assert.equal(ofType(runTo(game, 150), "battle").length, 0);
});

test("the beaten side runs for its nearest port in the zone; a fleet with no ships left is gone", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "BBB" }));
    const mine = giveFleet(game, "AAA", { cogs: 8 }, null, "north");
    const b = giveFleet(game, "BBB", { cogs: 12 }, 4, "south");
    order(game, { type: "sail", country: "BBB", fleet: b.id, zone: "north" });
    runTo(game, 61);
    assert.equal(ofType(runTo(game, 62), "battle").length, 0);                 // nobody patrols: they pass in the night
    order(game, { type: "patrol", country: "BBB", fleet: b.id });
    rig(game, 4, 4, 3, 3);
    const events = runTo(game, 63);
    const [battle] = ofType(events, "battle");
    assert.equal(battle.winner, "a");
    assert.deepEqual([mine.ships.cogs, mine.port], [4, 1]);                    // 8 cogs less 45%, running into AAA's port 1
    assert.equal(ofType(events, "fleetInPort").length, 1);
    // a fleet wiped out is removed
    const doomed = giveFleet(game, "AAA", { cogs: 1 }, null, "north");
    order(game, { type: "patrol", country: "BBB", fleet: b.id });
    game.state.cooldowns = {};
    rig(game, 6, 6, 1, 1);
    runTo(game, 64);
    assert.equal(game.state.fleets[doomed.id], undefined);
});

test("a blockade halves an enemy port's money while it holds", () => {
    const game = tinyGame();
    const before = economyOf(game, "BBB").settlementMoney;
    assert.equal(before, 57600);
    const f = giveFleet(game, "AAA", { cogs: 5 }, null, "south");
    assert.match(refused(game, cmd("blockade", { fleet: f.id, port: 4 })), /not your enemy/);
    order(game, cmd("declareWar", { target: "BBB" }));
    assert.match(refused(game, cmd("blockade", { fleet: f.id, port: 1 })), /another sea zone/);
    assert.match(refused(game, cmd("blockade", { fleet: f.id, port: 5 })), /not a port/);
    const inPort = giveFleet(game, "AAA", { cogs: 5 }, 1, "north");
    assert.match(refused(game, cmd("blockade", { fleet: inPort.id, port: 4 })), /at sea/);
    order(game, cmd("blockade", { fleet: f.id, port: 4 }));
    assert.equal(economyOf(game, "BBB").settlementMoney, 57600 - 19200);       // settlement 4's 38,400 halved
    order(game, cmd("hold", { fleet: f.id }));
    assert.equal(economyOf(game, "BBB").settlementMoney, 57600);
    order(game, cmd("blockade", { fleet: f.id, port: 4 }));
    delete game.state.fleets[f.id];                                            // sunk: the blockade is gone
    assert.equal(economyOf(game, "BBB").settlementMoney, 57600);
});

test("fleets split and merge in the same place", () => {
    const game = tinyGame();
    const f = giveFleet(game, "AAA", { cogs: 10 });
    assert.match(refused(game, cmd("splitFleet", { fleet: f.id, ships: { cogs: 11 } })), /has 10 cogs/);
    assert.match(refused(game, cmd("splitFleet", { fleet: f.id, ships: { cogs: 10 } })), /whole fleet/);
    assert.match(refused(game, cmd("splitFleet", { fleet: f.id, ships: { frigates: 1 } })), /no ship/);
    const [ev] = order(game, cmd("splitFleet", { fleet: f.id, ships: { cogs: 4 } }));
    const part = game.state.fleets[ev.into];
    assert.deepEqual([f.ships.cogs, part.ships.cogs, part.port, part.zone], [6, 4, 1, "north"]);
    order(game, cmd("sail", { fleet: part.id, zone: "north" }));
    assert.match(refused(game, cmd("mergeFleet", { fleet: part.id, into: f.id })), /not in the same place/);
    order(game, cmd("sail", { fleet: part.id, port: 1 }));
    order(game, cmd("mergeFleet", { fleet: part.id, into: f.id }));
    assert.deepEqual([f.ships.cogs, game.state.fleets[part.id]], [10, undefined]);
});

test("an army crosses a strait in 3 months, only where its country has 10 ships in the zone", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "CCC" }));
    assert.match(refused(game, cmd("move", { army: 3, to: 6 })), /no way/);   // no ships
    giveFleet(game, "AAA", { cogs: 9 });
    assert.match(refused(game, cmd("move", { army: 3, to: 6 })), /no way/);   // 9 are not 10
    giveFleet(game, "AAA", { cogs: 1 });                                       // in port counts, if it is in the zone
    order(game, cmd("move", { army: 3, to: 6 }));
    assert.deepEqual([game.state.armies[3].march.from, game.state.armies[3].march.to, game.state.armies[3].march.end], ["3", "6", 91]);
    const events = runTo(game, 91);
    assert.deepEqual(ofType(events, "siegeStart").map((e) => [e.settlement, e.by]), [[6, "AAA"]]);
});

test("an enemy fleet holding the strait must be beaten first; lose and the crossing fails", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "CCC" }));
    const mine = giveFleet(game, "AAA", { cogs: 10 });
    const foe = giveFleet(game, "CCC", { cogs: 20 }, null, "north");
    rig(game, 1, 1, 6, 6);                                                     // 6 against 16
    const events = order(game, cmd("move", { army: 3, to: 6 }));
    assert.deepEqual(ofType(events, "battle").map((e) => [e.kind, e.winner]), [["strait", "b"]]);
    assert.deepEqual(ofType(events, "crossFailed").map((e) => e.why), ["lost the naval battle"]);
    assert.equal(game.state.armies[3].at, "3");                                // it stays
    assert.equal(game.state.fleets[mine.id], undefined);                       // 10 against 20 at 6:16: wiped out
    assert.ok(foe.ships.cogs >= 19);
});

test("beating the fleet that holds the strait lets the army cross", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "CCC" }));
    giveFleet(game, "AAA", { cogs: 30 });
    giveFleet(game, "CCC", { cogs: 5 }, null, "north");
    rig(game, 6, 6, 1, 1);
    const events = order(game, cmd("move", { army: 3, to: 6 }));
    assert.deepEqual(ofType(events, "battle").map((e) => [e.kind, e.winner]), [["strait", "a"]]);
    assert.equal(game.state.armies[3].march.to, "6");
});

test("armies on a strait are at sea: they pass each other", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "CCC" }));
    giveFleet(game, "AAA", { cogs: 10 });
    giveFleet(game, "CCC", { cogs: 10 }, null, "north");
    game.state.cooldowns = {};
    setArmy(game, 3, { swords: 400 });
    order(game, cmd("move", { army: 3, to: 6 }));
    assert.equal(fleetList(game.state).length, 2);
});
