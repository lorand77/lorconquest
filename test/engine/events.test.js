// Random events and peasant rebels (RULES.md §11) on the tiny map.
import test from "node:test";
import assert from "node:assert/strict";
import { economyOf, isRebel, menOf, rebelsOf } from "../../src/engine/index.js";
import { uprising, yearly } from "../../src/engine/events.js";
import { plague } from "../../src/engine/economy.js";
import { retreat } from "../../src/engine/movement.js";
import { tinyGame, setArmy, runTo, order, refused, rig } from "../helpers/tiny.js";

const cmd = (type, rest = {}) => ({ type, country: "AAA", ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const popOf = (game, country) => Object.values(game.state.settlements).filter((s) => s.owner === country).reduce((n, s) => n + s.pop, 0);

test("each year a country rolls a harvest at 10%, a plague at 5% and an uprising at (average tax − 2)² × 25%", () => {
    let harvests = 0, plagues = 0, risen = 0;
    for (let seed = 0; seed < 400; seed++) {
        const game = tinyGame(seed);
        game.state.countries.AAA.taxSum = 3 * 365;                              // an average tax of 3: 25%
        game.state.countries.BBB.taxSum = 2 * 365;                              // 0%
        const events = [];
        yearly(game, events);
        if (game.state.countries.AAA.harvest) harvests++;
        plagues += ofType(events, "plague").filter((e) => e.country === "AAA").length;
        risen += ofType(events, "uprising").filter((e) => e.country === "AAA").length;
        assert.equal(ofType(events, "uprising").filter((e) => e.country === "BBB").length, 0);   // at tax 2, never
        assert.equal(game.state.countries.AAA.taxSum, 0);
    }
    assert.ok(harvests > 20 && harvests < 65, `${harvests} harvests of 400`);
    assert.ok(plagues > 6 && plagues < 40, `${plagues} plagues of 400`);
    assert.ok(risen > 70 && risen < 130, `${risen} uprisings of 400`);
});

test("a harvest lasts the year; the next roll replaces it", () => {
    const game = tinyGame();
    game.state.countries.AAA.harvest = true;
    for (let i = 0; i < 40 && game.state.countries.AAA.harvest; i++) yearly(game, []);
    assert.equal(game.state.countries.AAA.harvest, false);
});

test("a plague takes 10% of the people, spread by pop", () => {
    const game = tinyGame();
    const events = [];
    plague(game, "AAA", 0.1, events);
    assert.deepEqual([1, 2, 3].map((id) => game.state.settlements[id].pop), [18000, 9000, 9000]);
    assert.equal(events[0].dead, 4000);
});

test("an uprising: rebels of 3% of the people, outside the capital, at war with their country for good", () => {
    const game = tinyGame();
    const events = [];
    uprising(game, "AAA", events);
    const [rise] = ofType(events, "uprising");
    assert.deepEqual([rise.rebels, rise.men, rise.at], ["REB1", 1200, 1]);
    const rebel = game.state.countries.REB1;
    assert.deepEqual([rebel.rebel, rebel.of, isRebel(game.state, "REB1")], [true, "AAA", true]);
    assert.deepEqual(game.state.wars, ["AAA|REB1"]);
    const army = game.state.armies[rise.army];
    assert.deepEqual([army.owner, army.at, army.men.swords], ["REB1", "1", 1200]);
    assert.deepEqual(ofType(events, "siegeStart").map((e) => [e.settlement, e.by]), [[1, "REB1"]]);   // the capital's garrison is besieged
    // they are AAA's own people: no longer civilians, not soldiers either
    const e = economyOf(game, "AAA");
    assert.deepEqual([e.rebels, e.civilians, e.soldiers], [1200, 38400 - 1200, 1600]);
    assert.equal(rebelsOf(game.state, "AAA"), 1200);
    assert.match(refused(game, { type: "move", country: "REB1", army: army.id, to: 2 }), /peasant rebels take no orders/);
    assert.match(refused(game, cmd("declareWar", { target: "REB1" })), /always at war/);
});

test("rebels rise outside the largest settlement when the capital is lost", () => {
    const game = tinyGame();
    game.state.settlements[1].owner = "BBB";
    const events = [];
    uprising(game, "AAA", events);
    assert.equal(ofType(events, "uprising")[0].at, 2);                         // the largest left; 2 and 3 tie, the lower id
});

test("every 10 days an idle rebel army marches on a settlement of its country: undefended first, then the nearest", () => {
    const game = tinyGame();
    delete game.state.armies[1];                                               // the capital has no garrison
    uprising(game, "AAA", []);
    assert.equal(game.state.settlements[1].owner, "REB1");                     // walked into the undefended capital
    runTo(game, 10);
    const army = Object.values(game.state.armies).find((a) => a.owner === "REB1");
    assert.deepEqual([army.march.from, army.march.to], ["1", "3"]);            // 3 is nearer than 2, both defended and core
    delete game.state.armies[2];
    runTo(game, 20);
    assert.ok(!army.march || army.march.to === "3");
});

test("rebels beaten with no settlement to fall back to scatter home; the uprising ends", () => {
    const game = tinyGame();
    uprising(game, "AAA", []);
    rig(game, 6, 6, 1, 1);                                                     // the garrison rolls 16, the rebels 6
    const events = order(game, cmd("sortie", { army: 1 }));
    assert.equal(ofType(events, "battle")[0].winner, "a");
    const scattered = ofType(events, "scattered");
    assert.equal(scattered.length, 1);
    assert.equal(Object.values(game.state.armies).some((a) => a.owner === "REB1"), false);
    runTo(game, 31);
    assert.equal(game.state.countries.REB1, undefined);
    assert.deepEqual(game.state.wars, []);
    assert.equal(economyOf(game, "AAA").rebels, 0);
});

test("scattering costs no lives, and rebels, fed by their own people, never go hungry but still sicken in a siege", () => {
    const game = tinyGame();
    uprising(game, "AAA", []);
    const rebel = Object.values(game.state.armies).find((a) => a.owner === "REB1");
    const pop = popOf(game, "AAA");
    retreat(game, rebel, []);                                                  // no refuge of their own: they scatter
    assert.equal(game.state.armies[rebel.id], undefined);
    assert.equal(popOf(game, "AAA"), pop);

    // 20,000 rebels outside settlement 1, whose land feeds 15,000: an ordinary besieger would lose 2% a month
    const big = tinyGame();
    uprising(big, "AAA", []);
    const army = Object.values(big.state.armies).find((a) => a.owner === "REB1");
    army.men.swords = 20000;
    const events = runTo(big, 31);
    const lost = ofType(events, "attrition").filter((e) => e.army === army.id);
    assert.deepEqual(lost.map((e) => [e.sick, e.hungry, e.dead]), [[true, false, 200]]);
});
