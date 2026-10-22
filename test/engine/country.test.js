// Running a country by command (RULES.md §2-§4, §8, §9): tax, the slider, the law, the bank and loans, the shop,
// raising and equipping forces, mercenaries, special coring and the capital. On the tiny map: AAA has 1, 2 and 3,
// treasury 80,000, 1,600 soldiers, an army cap of 2,000.
import test from "node:test";
import assert from "node:assert/strict";
import { economyOf, longDate } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused } from "../helpers/tiny.js";

const cmd = (type, rest = {}) => ({ type, country: "AAA", ...rest });
const AAA = (game) => game.state.countries.AAA;
const rich = (game) => { AAA(game).treasury = 5000000; };

test("tax is 2 to 3 in steps of 0.1; the slider 0 to 100 in steps of 10", () => {
    const game = tinyGame();
    for (const tax of [1.9, 3.1, 2.25, "2", NaN]) assert.match(refused(game, cmd("setTax", { tax })), /from 2 to 3/);
    order(game, cmd("setTax", { tax: 2.7 }));
    assert.equal(AAA(game).tax, 2.7);
    for (const slider of [55, -10, 110, 0.5]) assert.match(refused(game, cmd("setSlider", { slider })), /0% to 100%/);
    order(game, cmd("setSlider", { slider: 80 }));
    assert.equal(AAA(game).slider, 80);
});

test("the average tax over the year, not the tax on the day, decides the uprising", () => {
    const game = tinyGame();
    order(game, cmd("setTax", { tax: 3 }));
    runTo(game, 100);
    order(game, cmd("setTax", { tax: 2 }));
    runTo(game, 364);
    assert.ok(Math.abs(AAA(game).taxSum / 364 - (3 * 100 + 2 * 264) / 364) < 1e-9);
});

test("the law changes at most once in five years, and moves the caps", () => {
    const game = tinyGame();
    assert.match(refused(game, cmd("setLaw", { law: "feudal" })), /already/);
    assert.match(refused(game, cmd("setLaw", { law: "tyranny" })), /no law/);
    order(game, cmd("setLaw", { law: "standing" }));
    const e = economyOf(game, "AAA");
    assert.deepEqual([e.armyCap, e.navyCap], [3000, 1200]);
    assert.match(refused(game, cmd("setLaw", { law: "mass" })), new RegExp(`until ${longDate(1825)}`));
    runTo(game, 1825);
    order(game, cmd("setLaw", { law: "mass" }));
    assert.equal(economyOf(game, "AAA").armyCap, 0.15 * game.state.settlements[1].pop + 0.15 * game.state.settlements[2].pop + 0.15 * game.state.settlements[3].pop);
});

test("the bank: nothing that takes the treasury below zero; loans in chunks within two years of money", () => {
    const game = tinyGame(), c = AAA(game);
    assert.match(refused(game, cmd("deposit", { amount: 80001 })), /costs|holds/);
    assert.match(refused(game, cmd("withdraw", { amount: 1 })), /bank holds 0/);
    assert.match(refused(game, cmd("borrow", { chunks: 0 })), /whole number/);
    assert.match(refused(game, cmd("borrow", { chunks: 4 })), /153,600/);       // 4 × 50,000 is over 2 years of 76,800
    order(game, cmd("borrow", { chunks: 3 }));
    assert.deepEqual([c.loans, c.treasury], [150000, 230000]);
    assert.match(refused(game, cmd("borrow", { chunks: 1 })), /153,600/);
    assert.match(refused(game, cmd("repay", { chunks: 4 })), /you owe 150,000/);
    order(game, cmd("repay", { chunks: 1 }));
    assert.deepEqual([c.loans, c.treasury], [100000, 180000]);
    const e = economyOf(game, "AAA");
    assert.equal(e.interest, 8000);                                            // 8% a year
});

test("default: loans cancelled, no loans for 20 years, half the mercenaries desert", () => {
    const game = tinyGame(), c = AAA(game);
    assert.match(refused(game, cmd("defaultOnLoans")), /owe nothing/);
    order(game, cmd("borrow", { chunks: 2 }));
    setArmy(game, 2, { swords: 100, pikes: 300 }).mercs = 300;
    const events = order(game, cmd("defaultOnLoans"));
    assert.equal(c.loans, 0);
    assert.equal(game.state.armies[2].mercs, 150);
    assert.equal(events.find((e) => e.type === "desertion").men, 150);
    assert.match(refused(game, cmd("borrow", { chunks: 1 })), /until/);
    runTo(game, 7300);
    order(game, cmd("borrow", { chunks: 1 }));
});

test("a company of mercenaries that all desert leaves no empty army behind", () => {
    const game = tinyGame();
    setArmy(game, 2, { pikes: 3 }).mercs = 3;
    order(game, cmd("borrow", { chunks: 1 }));
    order(game, cmd("defaultOnLoans"));                                        // half of 3, rounded up per army: 2 leave
    assert.equal(game.state.armies[2].mercs, 1);
    game.state.countries.AAA.treasury = -1;
    runTo(game, 31);                                                           // 10% of 1, rounded up: the last one leaves
    assert.equal(game.state.armies[2], undefined);
});

test("buildings: one of each a settlement, only in your own, only with the money", () => {
    const game = tinyGame(), c = AAA(game);
    order(game, cmd("buyBuilding", { building: "workshop", settlement: 2 }));
    assert.deepEqual([game.state.settlements[2].workshop, c.treasury], [true, 80000 - 75000]);
    assert.match(refused(game, cmd("buyBuilding", { building: "workshop", settlement: 2 })), /already/);
    assert.match(refused(game, cmd("buyBuilding", { building: "walls", settlement: 2 })), /costs 100,000/);
    assert.match(refused(game, cmd("buyBuilding", { building: "walls", settlement: 4 })), /not AAA's/);
    assert.match(refused(game, cmd("buyBuilding", { building: "moat", settlement: 2 })), /no building/);
    rich(game);
    for (const b of ["walls", "library", "market"]) order(game, cmd("buyBuilding", { building: b, settlement: 3 }));
    // a courthouse only where the settlement is not core already: Three is AAA's core
    assert.match(refused(game, cmd("buyBuilding", { building: "courthouse", settlement: 3 })), /is your core already/);
    game.state.settlements[3].cores = [];                                      // held, but not core
    order(game, cmd("buyBuilding", { building: "courthouse", settlement: 3 }));
    assert.equal(c.treasury, 5000000 - 100000 - 75000 - 75000 - 50000);
});

test("weapons go to the reserve by the lot, gated by tech", () => {
    const game = tinyGame(), c = AAA(game);
    order(game, cmd("buyWeapons", { weapon: "swords", lots: 2 }));
    assert.deepEqual([c.reserve.swords, c.treasury], [2000, 80000 - 50000]);
    assert.match(refused(game, cmd("buyWeapons", { weapon: "muskets", lots: 1 })), /not unlocked/);
    assert.match(refused(game, cmd("buyWeapons", { weapon: "lances", lots: 1 })), /no weapon/);
    assert.match(refused(game, cmd("buyWeapons", { weapon: "pikes", lots: 2.5 })), /whole number/);
    assert.match(refused(game, cmd("buyWeapons", { weapon: "cavalry", lots: 1 })), /costs 60,000/);
    rich(game);
    order(game, cmd("buyWeapons", { weapon: "cannons", lots: 1 }));            // by the hundred
    assert.equal(c.reserve.cannons, 100);
    c.techs.push("handCannons");
    order(game, cmd("buyWeapons", { weapon: "handCannons", lots: 1 }));
    assert.equal(c.reserve.handCannons, 1000);
});

test("buying people spreads them over the settlements by their pop", () => {
    const game = tinyGame();
    assert.match(refused(game, cmd("buyPeople", { lots: 1 })), /costs 100,000/);
    rich(game);
    order(game, cmd("buyPeople", { lots: 1 }));
    const pops = [1, 2, 3].map((id) => game.state.settlements[id].pop);
    assert.deepEqual(pops, [20500, 10250, 10250]);
    assert.equal(AAA(game).treasury, 5000000 - 100000);
});

test("equipping: new weapons from the reserve, the old back to it; cannons manned by the army's own soldiers", () => {
    const game = tinyGame(), c = AAA(game);
    order(game, cmd("buyWeapons", { weapon: "pikes", lots: 1 }));
    order(game, cmd("equip", { army: 1, from: "swords", to: "pikes", n: 300 }));
    assert.deepEqual([game.state.armies[1].men.swords, game.state.armies[1].men.pikes, c.reserve.pikes, c.reserve.swords], [500, 300, 700, 300]);
    assert.match(refused(game, cmd("equip", { army: 1, from: "swords", to: "pikes", n: 800 })), /has 500 swords/);
    assert.match(refused(game, cmd("equip", { army: 1, from: "swords", to: "pikes", n: 600 })), /reserve holds 700|has 500/);
    assert.match(refused(game, cmd("equip", { army: 1, from: "swords", to: "swords", n: 1 })), /two different/);
    order(game, cmd("equip", { army: 1, from: "pikes", to: "unarmed", n: 100 }));      // disarm
    assert.deepEqual([game.state.armies[1].men.unarmed, c.reserve.pikes], [100, 800]);
    // each cannon takes 10 of the army's men as its crew: the unarmed first, then the weakest weapons, which go to the reserve
    c.reserve.cannons = 3;
    const a = setArmy(game, 2, { unarmed: 10, swords: 15, muskets: 5 });       // 30 men
    assert.match(refused(game, cmd("equipCannons", { army: 2, n: 4 })), /reserve holds 3/);
    const swords = c.reserve.swords;
    order(game, cmd("equipCannons", { army: 2, n: 2 }));
    assert.deepEqual([a.cannons, a.crew, a.men.unarmed, a.men.swords, a.men.muskets, c.reserve.cannons, c.reserve.swords],
        [2, 20, 0, 5, 5, 1, swords + 10]);
    assert.match(refused(game, cmd("equipCannons", { army: 2, n: 2 })), /reserve holds 1/);
    // returned, a cannon's crew are soldiers again, unarmed
    order(game, cmd("equipCannons", { army: 2, n: -1 }));
    assert.deepEqual([a.cannons, a.crew, a.men.unarmed, c.reserve.cannons], [1, 10, 10, 2]);
    assert.match(refused(game, cmd("equipCannons", { army: 2, n: -2 })), /has 1 cannons/);
    // not enough men, or only mercenaries: no crew
    setArmy(game, 3, { pikes: 100 }).mercs = 95;
    assert.match(refused(game, cmd("equipCannons", { army: 3, n: 1 })), /manned by 10 of the army's soldiers; army 3 has 5, not counting mercenaries/);
});

test("disbanding sends men home and weapons to the reserve, but dismisses no mercenary", () => {
    const game = tinyGame(), c = AAA(game);
    setArmy(game, 2, { swords: 300, pikes: 100, cannons: 1, crew: 50 }).mercs = 100;
    assert.match(refused(game, cmd("disband", { army: 2, men: { swords: 301 } })), /has 300 swords/);
    assert.match(refused(game, cmd("disband", { army: 2, men: { swords: 300, pikes: 1 } })), /dismissed/);
    assert.match(refused(game, cmd("disband", { army: 2, crew: 45 })), /10 crew/);
    order(game, cmd("disband", { army: 2, men: { swords: 200 }, crew: 40 }));
    assert.deepEqual([game.state.armies[2].men.swords, game.state.armies[2].crew, c.reserve.swords], [100, 10, 200]);
    order(game, cmd("dismissMercenaries", { army: 2, n: 60 }));
    assert.deepEqual([game.state.armies[2].mercs, game.state.armies[2].men.pikes, c.reserve.pikes], [40, 40, 60]);
    assert.match(refused(game, cmd("dismissMercenaries", { army: 2, n: 41 })), /has 40/);
});

test("soldiers are trained for free in a core settlement: 3 months in the capital, 6 elsewhere, within the cap", () => {
    const game = tinyGame(), c = AAA(game);
    assert.match(refused(game, cmd("raise", { settlement: 1, kind: "soldiers", lots: 1 })), /more soldiers than your law allows/);   // 1,600 + 1,000 > 2,000
    order(game, cmd("setLaw", { law: "mass" }));                               // cap 6,000
    game.state.settlements[2].cores = [];
    assert.match(refused(game, cmd("raise", { settlement: 2, kind: "soldiers", lots: 1 })), /not core/);
    assert.match(refused(game, cmd("raise", { settlement: 4, kind: "soldiers", lots: 1 })), /not AAA's/);
    game.state.settlements[2].cores = ["AAA"];
    order(game, cmd("raise", { settlement: 1, kind: "soldiers", lots: 1 }));
    order(game, cmd("raise", { settlement: 2, lots: 1 }));                    // soldiers are what is raised
    assert.match(refused(game, cmd("raise", { settlement: 2, kind: "crew", lots: 1 })), /only soldiers are raised/);
    assert.deepEqual(c.training.map((t) => [t.settlement, t.kind, t.n, t.ready]), [[1, "soldiers", 1000, 91], [2, "soldiers", 1000, 183]]);
    assert.equal(economyOf(game, "AAA").soldiers, 3600);                       // training soldiers already pay upkeep
    assert.match(refused(game, cmd("raise", { settlement: 3, kind: "soldiers", lots: 3 })), /more soldiers/);   // 3,600 + 3,000 > 6,000
    runTo(game, 91);
    assert.deepEqual([game.state.armies[1].men.unarmed, game.state.armies[1].men.swords], [1000, 800]);   // joined the garrison
    assert.equal(c.training.length, 1);
    const events = runTo(game, 183);
    assert.equal(game.state.armies[2].men.unarmed, 1000);
    assert.deepEqual(events.filter((e) => e.type === "ready").map((e) => [e.what, e.n, e.army]), [["soldiers", 1000, 2]]);
});

test("training in a settlement that falls is cancelled", () => {
    const game = tinyGame();
    order(game, cmd("setLaw", { law: "standing" }));
    order(game, cmd("raise", { settlement: 2, kind: "soldiers", lots: 1 }));
    game.state.settlements[2].owner = "BBB";                                   // captured meanwhile
    const events = runTo(game, 183);
    assert.deepEqual(events.filter((e) => e.type === "cancelled").map((e) => [e.what, e.n]), [["training", 1000]]);
    assert.equal(game.state.armies[2].men.unarmed, 0);
    assert.equal(AAA(game).training.length, 0);
});

test("soldiers raised with a weapon take it from the reserve, buy the lots missing, and arrive carrying it", () => {
    const game = tinyGame(), c = AAA(game);
    order(game, cmd("setLaw", { law: "mass" }));
    rich(game);
    c.reserve.pikes = 300;
    assert.match(refused(game, cmd("raise", { settlement: 1, lots: 1, weapon: "muskets" })), /not unlocked/);
    assert.match(refused(game, cmd("raise", { settlement: 1, lots: 1, weapon: "ships" })), /no weapon/);
    order(game, cmd("raise", { settlement: 1, lots: 1, weapon: "pikes" }));      // 700 missing: one lot of 1000 bought
    assert.deepEqual([c.treasury, c.reserve.pikes], [5000000 - 30000, 300]);
    order(game, cmd("raise", { settlement: 2, lots: 2, weapon: "swords" }));     // none in reserve: two lots
    assert.deepEqual([c.treasury, c.reserve.swords], [5000000 - 30000 - 50000, 0]);
    c.treasury = 1000;
    assert.match(refused(game, cmd("raise", { settlement: 1, lots: 1, weapon: "cavalry" })), /that costs/);
    assert.match(refused(game, cmd("raise", { settlement: 1, lots: 1, weapon: "pikes" })), /that costs/);   // 300 in reserve, 700 to buy
    assert.equal(c.reserve.pikes, 300);
    runTo(game, 91);
    assert.deepEqual([game.state.armies[1].men.pikes, game.state.armies[1].men.unarmed], [1000, 0]);
    game.state.settlements[2].owner = "BBB";                                    // the swords' settlement falls: they go back
    runTo(game, 183);
    assert.equal(c.reserve.swords, 2000);
});

test("soldiers raised with cannons get one for every 10 of them, and arrive as its crew", () => {
    const game = tinyGame(), c = AAA(game);
    order(game, cmd("setLaw", { law: "mass" }));
    rich(game);
    c.reserve.cannons = 30;
    order(game, cmd("raise", { settlement: 1, lots: 1, weapon: "cannons" }));    // 100 cannons: 30 in reserve, a lot of 100 bought
    assert.deepEqual([c.treasury, c.reserve.cannons], [5000000 - 100000, 30]);
    order(game, cmd("raise", { settlement: 2, lots: 2, weapon: "cannons" }));    // 200 more: 30 in reserve, two lots bought
    assert.deepEqual([c.treasury, c.reserve.cannons], [5000000 - 300000, 30]);
    const before = { ...game.state.armies[1] };
    runTo(game, 91);
    const a = game.state.armies[1];
    assert.deepEqual([a.cannons - before.cannons, a.crew - before.crew, a.men.unarmed], [100, 1000, 0]);
    game.state.settlements[2].owner = "BBB";                                   // the second lot's settlement falls: its cannons go back
    runTo(game, 183);
    assert.equal(c.reserve.cannons, 230);
});

test("mercenaries arrive in a month with pikes, up to the army cap, and add no soldiers", () => {
    const game = tinyGame(), c = AAA(game);
    rich(game);
    assert.match(refused(game, cmd("hireMercenaries", { settlement: 1, lots: 3 })), /army cap/);   // 3,000 over 2,000
    order(game, cmd("hireMercenaries", { settlement: 1, lots: 1 }));
    assert.equal(c.treasury, 5000000 - 50000);
    order(game, cmd("hireMercenaries", { settlement: 2, lots: 1 }));
    assert.match(refused(game, cmd("hireMercenaries", { settlement: 3, lots: 1 })), /army cap/);     // already hired 2,000
    const events = runTo(game, 30);
    assert.deepEqual(events.filter((e) => e.type === "ready").map((e) => [e.what, e.army]), [["mercenaries", 1], ["mercenaries", 2]]);
    assert.deepEqual([game.state.armies[1].men.pikes, game.state.armies[1].mercs, game.state.armies[1].men.swords], [1000, 1000, 800]);
    const e = economyOf(game, "AAA");
    assert.deepEqual([e.mercenaries, e.soldiers, e.mercenaryUpkeep], [2000, 1600, 30000]);
});

test("special coring: the capital in the region, all of it held, and every settlement is core at once", () => {
    const game = tinyGame();
    for (const id of [1, 2, 3]) game.state.settlements[id].cores = [];
    assert.match(refused(game, cmd("proclaim", { region: "nowhere" })), /no region/);
    game.state.settlements[3].owner = "BBB";
    assert.match(refused(game, cmd("proclaim", { region: "aaa-lands" })), /control all of AAA lands; 1 settlements/);
    game.state.settlements[3].owner = "AAA";
    const [ev] = order(game, cmd("proclaim", { region: "aaa-lands" }));
    assert.equal(ev.settlements, 3);
    assert.deepEqual([1, 2, 3].map((id) => game.state.settlements[id].cores), [["AAA"], ["AAA"], ["AAA"]]);
    assert.match(refused(game, cmd("proclaim", { region: "aaa-lands" })), /already core/);
    assert.match(refused(game, { type: "proclaim", country: "BBB", region: "aaa-lands" }), /capital must lie/);
});

test("a captured settlement stays core for those who had it, so retaking it makes it core again", () => {
    const game = tinyGame();
    order(game, cmd("declareWar", { target: "BBB" }));
    game.state.settlements[5].owner = "AAA";                                   // simulate: AAA holds a BBB settlement
    assert.deepEqual(game.state.settlements[5].cores, ["BBB"]);               // core for BBB, not AAA
    game.state.settlements[5].owner = "BBB";
    assert.deepEqual(game.state.settlements[5].cores, ["BBB"]);
});

test("naming a capital: only when the old one is lost, a city if you have one", () => {
    const game = tinyGame();
    assert.match(refused(game, cmd("setCapital", { settlement: 2 })), /still stands/);
    game.state.settlements[1].owner = "BBB";                                   // the capital falls; AAA has no city left
    assert.match(refused(game, cmd("setCapital", { settlement: 4 })), /not AAA's/);
    order(game, cmd("setCapital", { settlement: 3 }));
    assert.equal(AAA(game).capital, 3);
    order(game, cmd("setLaw", { law: "mass" }));
    order(game, cmd("raise", { settlement: 3, kind: "soldiers", lots: 1 }));
    assert.equal(AAA(game).training[0].ready, 91);                             // the new capital trains fast
});
