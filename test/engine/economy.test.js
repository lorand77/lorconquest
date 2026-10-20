// Money, people and research (RULES.md §2, §4, §9) on the tiny map. AAA has settlements 1 (a city on a river), 2 and
// 3: 40,000 people and, at the start, 1,600 soldiers in garrisons (800 + 400 + 400), so 38,400 civilians at tax 2.
import test from "node:test";
import assert from "node:assert/strict";
import { armyCapOf, economyOf, navyCapOf } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused } from "../helpers/tiny.js";

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} is not ${b}`);
const AAA = (game) => game.state.countries.AAA;

test("a country's money at the start, worked out by hand", () => {
    const game = tinyGame(), e = economyOf(game, "AAA");
    assert.deepEqual([e.pop, e.soldiers, e.civilians], [40000, 1600, 38400]);
    assert.equal(e.settlementMoney, 76800);                                // 38,400 civilians × tax 2
    assert.equal(e.upkeep, 8000);                                          // 1,600 soldiers × 5
    assert.equal(e.moneyPerYear, 68800);
    assert.equal(e.rPerYear, 2 * 0.5 * 68800 + 10000);                    // investable at 50% plus the flat x10K
    assert.deepEqual([e.armyCap, e.navyCap, e.loanLimit], [2000, 1000, 153600]);
    assert.equal(AAA(game).treasury, 80000);
    assert.deepEqual([armyCapOf(game.state, "AAA"), navyCapOf(game.state, "AAA")], [2000, 1000]);
});

test("tax: core civilians pay it, non-core half, a workshop 3500, a market +15% of the lot", () => {
    const game = tinyGame();
    game.state.countries.AAA.tax = 3;
    assert.equal(economyOf(game, "AAA").settlementMoney, 115200);          // 50% more
    game.state.countries.AAA.tax = 2;
    game.state.settlements[3].cores = [];
    assert.equal(economyOf(game, "AAA").settlementMoney, 67200);           // settlement 3's 9,600 civilians pay half
    game.state.settlements[3].cores = ["AAA"];
    game.state.settlements[2].workshop = true;
    assert.equal(economyOf(game, "AAA").settlementMoney, 80300);
    game.state.settlements[2].market = true;
    assert.equal(economyOf(game, "AAA").settlementMoney, 76800 - 19200 + (19200 + 3500) * 1.15);
});

test("conscription law, harvest, mercenaries and loans change the money per year", () => {
    const game = tinyGame(), c = AAA(game);
    c.law = "mass";
    assert.equal(economyOf(game, "AAA").settlementMoney, 76800 * 0.85);   // −15% of settlement money only
    assert.equal(economyOf(game, "AAA").upkeep, 8000);
    c.law = "feudal";
    c.harvest = true;
    close(economyOf(game, "AAA").settlementMoney, 76800 * 1.1);
    c.harvest = false;
    setArmy(game, 2, { swords: 300, pikes: 100 }).mercs = 100;
    let e = economyOf(game, "AAA");
    assert.deepEqual([e.soldiers, e.mercenaries, e.mercenaryUpkeep], [1500, 100, 1500]);   // mercenaries are not soldiers or civilians
    c.loans = 100000;
    e = economyOf(game, "AAA");
    assert.equal(e.interest, 8000);
    close(e.moneyPerYear, e.settlementMoney - 1500 * 5 - 1500 - 8000);
});

test("rebels and crew under arms are not civilians", () => {
    const game = tinyGame();
    game.state.countries.REB1 = { code: "REB1", rebel: true, of: "AAA", treasury: 0 };
    game.state.armies[99] = { id: 99, owner: "REB1", men: { unarmed: 0, swords: 1200, pikes: 0, cavalry: 0, handCannons: 0, arquebuses: 0, muskets: 0 }, mercs: 0, cannons: 0, crew: 0, at: "1", march: null, path: [], storm: false, retreating: false, relief: false, arrived: 0 };
    const e = economyOf(game, "AAA");
    assert.deepEqual([e.rebels, e.civilians], [1200, 37200]);
    setArmy(game, 2, { swords: 100, crew: 300 });
    assert.equal(economyOf(game, "AAA").soldiers, 1600 - 400 + 400);       // crew are soldiers
});

test("each month pays a twelfth of the year; the slider moves money to research and back", () => {
    for (const [slider, share] of [[50, 1], [100, 0], [0, 2]]) {
        const game = tinyGame(), c = AAA(game), start = c.treasury;
        c.slider = slider;
        runTo(game, 31);                                                   // 1 February: the first monthly step
        const e = economyOf(game, "AAA"), m = e.moneyPerYear / 12;
        close(c.treasury - start, m * share, 1e-9);
        close(c.r, (2 * slider / 100 * m + 10000 / 12) * (1 + 0), 1e-9);   // the flat x10K comes whatever the slider says
    }
});

test("libraries add 5% each to research, up to ten", () => {
    const game = tinyGame();
    for (const id of [1, 2, 3]) game.state.settlements[id].library = true;
    runTo(game, 31);
    const e = economyOf(game, "AAA"), m = e.moneyPerYear / 12;
    close(AAA(game).r, (m + 10000 / 12) * 1.15, 1e-9);
    assert.equal(e.libraries, 3);
});

test("a country with no money to invest researches only the flat x10K", () => {
    const game = tinyGame(), c = AAA(game);
    c.slider = 100;
    c.loans = 2000000;                                                     // interest far over its income
    runTo(game, 31);
    const e = economyOf(game, "AAA");
    assert.ok(e.moneyPerYear < 0);
    close(c.r, 10000 / 12, 1e-9);
    assert.ok(c.treasury < 80000);                                         // the treasury takes the loss
});

test("the bank pays 0.25% a month, into the deposit, never into research", () => {
    const game = tinyGame(), c = AAA(game);
    order(game, { type: "deposit", country: "AAA", amount: 40000 });
    assert.deepEqual([c.treasury, c.bank], [40000, 40000]);
    runTo(game, 31);
    close(c.bank, 40100);
    order(game, { type: "withdraw", country: "AAA", amount: 100 });
    close(c.bank, 40000);
});

test("people grow 1% a year, half a percent more on a river or the coast", () => {
    const game = tinyGame();
    runTo(game, 31);
    close(game.state.settlements[2].pop, 10000 * (1 + 0.01 / 12));        // inland
    close(game.state.settlements[1].pop, 20000 * (1 + 0.015 / 12));       // a river and a port
    close(game.state.settlements[4].pop, 20000 * (1 + 0.015 / 12));       // a port
});

test("research: the target unlocks when R covers its cost, which is taken from R; a tech needs its parent", () => {
    const game = tinyGame(), c = AAA(game);
    assert.match(refused(game, { type: "research", country: "AAA", tech: "arquebuses" }), /needs handCannons/);
    assert.match(refused(game, { type: "research", country: "AAA", tech: "swords" }), /no tech|already/);
    c.r = 1499000;
    order(game, { type: "research", country: "AAA", tech: "handCannons" });
    assert.equal(c.target, "handCannons");
    const events = runTo(game, 31);                                        // a month's research tops it up past 1.5M
    assert.deepEqual(events.filter((e) => e.type === "tech").map((e) => [e.country, e.tech]), [["AAA", "handCannons"]]);
    assert.ok(c.techs.includes("handCannons") && c.target === null);
    assert.ok(c.r > 0 && c.r < 10000);
    c.r = 3000000;                                                         // already enough: unlocks at once
    const [ev] = order(game, { type: "research", country: "AAA", tech: "arquebuses" });
    assert.equal(ev.tech, "arquebuses");
    assert.equal(c.r, 1000000);
});

test("unpaid mercenaries desert, 10% a month while the treasury is below zero", () => {
    const game = tinyGame(), c = AAA(game);
    setArmy(game, 2, { swords: 100, pikes: 300 }).mercs = 300;
    c.treasury = -1000;
    const events = runTo(game, 31);
    assert.deepEqual(events.filter((e) => e.type === "desertion").map((e) => e.men), [30]);
    assert.deepEqual([game.state.armies[2].mercs, game.state.armies[2].men.pikes], [270, 270]);   // their pikes went with them
});

test("debt: the clock starts below zero; after 10 years a debt over pop × 10 sells buildings first", () => {
    const game = tinyGame(), c = AAA(game);
    c.treasury = -300000;                                                  // under pop × 10 = 400,000
    runTo(game, 31);
    assert.equal(c.debtSince, 31);
    c.debtSince = game.day - 3650;
    runTo(game, 62);
    assert.ok(c.debtSince !== null && c.treasury < 0);                     // nothing is sold: the debt is not over 400,000
    for (const id of [1, 2, 3]) game.state.settlements[id].walls = true;
    c.treasury = -450000;                                                  // over pop × 10 = 400,000 even after a month's income
    const events = runTo(game, 90);
    const bankrupt = events.filter((e) => e.type === "bankruptcy");
    assert.equal(bankrupt.length, 1);
    assert.equal(bankrupt[0].buildings, 3);                                // three walls at 0.1M each...
    assert.deepEqual([1, 2, 3].map((id) => game.state.settlements[id].walls), [false, false, false]);
    assert.equal(bankrupt[0].weapons, 1600);                               // ...then the garrisons' swords, still short
    assert.equal(game.state.armies[1].men.unarmed, 800);
});

test("a repaid debt stops the clock", () => {
    const game = tinyGame(), c = AAA(game);
    c.treasury = -100;
    runTo(game, 31);
    assert.equal(c.debtSince, null);                                       // a month's income paid it off
});

test("a settlement becomes core after 20 years held and a courthouse", () => {
    const game = tinyGame(), s = game.state.settlements[3];
    s.cores = [];
    s.heldSince = -7300 + 90;                                              // 20 years on 1 April 1440
    runTo(game, 31);
    assert.deepEqual(s.cores, []);                                         // no courthouse
    s.courthouse = true;
    runTo(game, 59);
    assert.deepEqual(s.cores, []);                                         // 19.9 years
    runTo(game, 90);
    assert.deepEqual(s.cores, ["AAA"]);
});
