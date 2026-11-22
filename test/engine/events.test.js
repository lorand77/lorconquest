// Random events and peasant rebels (RULES.md §11) on the tiny map.
import test from "node:test";
import assert from "node:assert/strict";
import { economyOf, isRebel, menOf, rebelsOf } from "../../src/engine/index.js";
import { rebelWars, uprising, yearly } from "../../src/engine/events.js";
import { makePeace } from "../../src/engine/diplomacy.js";
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
    setArmy(big, 1, { swords: 20000 });                                        // a garrison they will not storm: the siege goes on
    const events = runTo(big, 31);
    const lost = ofType(events, "attrition").filter((e) => e.army === army.id);
    assert.deepEqual(lost.map((e) => [e.sick, e.hungry, e.dead]), [[true, false, 200]]);
});

test("peasants are at war with their country and its enemies — with everyone once it is gone — and the war ends with a peace", () => {
    const game = tinyGame(), st = game.state;
    const atWarWith = (a, b) => st.wars.includes(a < b ? `${a}|${b}` : `${b}|${a}`);
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    uprising(game, "BBB", []);
    const reb = Object.keys(st.countries).find((c) => st.countries[c].rebel);
    runTo(game, st.day + 1);
    // BBB's peasants: at war with BBB and with AAA, BBB's enemy; not with CCC
    assert.deepEqual([atWarWith(reb, "BBB"), atWarWith(reb, "AAA"), atWarWith(reb, "CCC")], [true, true, false]);
    // they hold Five: AAA may march on it, as on any enemy town; nobody may declare war on them or make peace with them
    st.settlements[5].owner = reb;
    for (const a of Object.values(st.armies)) if (a.at === "5") a.owner = reb;
    setArmy(game, 3, { swords: 3000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    assert.match(refused(game, { type: "declareWar", country: "CCC", target: reb }), /peasants/);
    assert.match(refused(game, { type: "proposePeace", country: "AAA", with: reb }), /peasants/);
    // a peace with BBB ends the war with its peasants too, and AAA's army leaves their land
    const events = [];
    makePeace(game, "AAA", "BBB", {}, events);
    rebelWars(game, events);
    assert.deepEqual([atWarWith("AAA", "BBB"), atWarWith(reb, "AAA"), atWarWith(reb, "BBB")], [false, false, true]);
    assert.match(refused(game, { type: "move", country: "AAA", army: 3, to: 5 }), /no way/);   // their land is closed to it again
    // BBB gone from the game: its peasants are at war with every country there is
    st.countries.BBB.out = st.day;
    st.wars = st.wars.filter((w) => !w.split("|").includes("BBB"));
    runTo(game, st.day + 1);
    for (const c of ["AAA", "CCC", "DDD", "EEE"]) assert.equal(atWarWith(reb, c), true, c);
});

test("a new uprising joins the country's rebels already up — their army where they rise, if they have one there", () => {
    const game = tinyGame(), st = game.state;
    const first = [], second = [], third = [];
    uprising(game, "BBB", first);
    const reb = first[0].rebels, army = st.armies[first[0].army];
    assert.equal(first[0].joined, undefined);
    const men = menOf(army);
    uprising(game, "BBB", second);                                  // the same place: the same army grows
    assert.deepEqual([second[0].rebels, second[0].joined, second[0].army], [reb, true, army.id]);
    assert.equal(menOf(army), men + second[0].men);
    assert.equal(Object.values(st.countries).filter((c) => c.rebel).length, 1, "one band, not two");
    // the band\x27s army has marched off: the next rising is a new army of the same band
    army.at = "5";
    uprising(game, "BBB", third);
    assert.deepEqual([third[0].rebels, third[0].joined], [reb, true]);
    assert.notEqual(third[0].army, army.id);
    assert.equal(st.armies[third[0].army].owner, reb);
    // another country\x27s peasants are a band of their own
    const other = [];
    uprising(game, "AAA", other);
    assert.notEqual(other[0].rebels, reb);
});

// ---------- the rebels' wits, and religious rebels ----------

const rebelsAt = (game, key) => Object.values(game.state.armies).filter((a) => a.owner.startsWith("REB") && a.at === key);

test("rebels storm a town they besiege once they are 1.35 times its garrison, and wait out the siege below that", async () => {
    const { rebelOrders } = await import("../../src/engine/events.js");
    const game = tinyGame(), st = game.state;
    uprising(game, "AAA", []);
    const band = rebelsAt(game, "1")[0];
    band.men.swords = 1000;                                                    // 1,000 against 800 behind the city's 1.2: no storm
    st.day = 10;
    rebelOrders(game, []);
    assert.equal(st.settlements[1].owner, "AAA");
    band.men.swords = 2000;                                                    // 2,000 against 960: storm, and the city falls
    st.day = 20;
    rebelOrders(game, []);
    assert.equal(st.settlements[1].owner, band.owner);
});

test("rebels march only on a garrison they can beat, past no stronger army; leaving a town they hold, a fifth stays to hold it", async () => {
    const { rebelOrders } = await import("../../src/engine/events.js");
    const game = tinyGame(), st = game.state;
    uprising(game, "AAA", []);
    const band = rebelsAt(game, "1")[0], reb = band.owner;
    // the band stands in Three, a town of its own; Two is held by 2,000, One by 800 — it can beat neither; Five is BBB's
    st.settlements[1].siege = null;
    st.settlements[3].owner = reb;
    for (const a of Object.values(st.armies)) if (a.at === "3" && a.owner === "AAA") delete st.armies[a.id];
    band.at = "3";
    band.men.swords = 1000;
    setArmy(game, 2, { swords: 2000 });
    st.day = 10;
    rebelOrders(game, []);
    assert.equal(band.march ?? null, null, "nowhere it can win: it stays");
    // Two's garrison down to 500: 1,000 against 600 — it marches, and 200 stay behind in Three
    setArmy(game, 2, { swords: 500 });
    st.day = 20;
    rebelOrders(game, []);
    assert.ok(band.march && band.path.concat(band.march.to).includes("2"), "on its way to Two");
    assert.deepEqual(rebelsAt(game, "3").map((a) => a.men.swords), [200]);
});

test("bands of the same rebels in one place become one", async () => {
    const { rebelOrders } = await import("../../src/engine/events.js");
    const game = tinyGame(), st = game.state;
    uprising(game, "AAA", []);
    const band = rebelsAt(game, "1")[0];
    const { newArmy } = await import("../../src/engine/state.js"), { emptyMen } = await import("../../src/engine/army.js");
    setArmy(game, 1, { swords: 5000 });                                        // a garrison too strong to storm: they only gather
    const men = emptyMen();
    men.swords = 300;
    newArmy(st, band.owner, "1", men);
    const before = band.men.swords;
    st.day = 10;
    rebelOrders(game, []);
    assert.deepEqual(rebelsAt(game, "1").map((a) => a.men.swords), [before + 300]);
});

test("a religious uprising: the people of another faith rise where they live, as their faith's rebels, and fight for their land alone", async () => {
    const { religiousUprising, rebelOrders } = await import("../../src/engine/events.js");
    // AAA Catholic; its Two Orthodox
    const game = tinyGame(1, (sc) => { for (const c of sc.countries) c.religion = "catholic"; sc.settlements[1].faith = "orthodox"; }), st = game.state;
    const events = [];
    assert.equal(religiousUprising(game, "AAA", events), true);
    const [ev] = ofType(events, "uprising"), reb = st.countries[ev.rebels];
    assert.deepEqual([ev.at, ev.men, ev.faith, reb.faith, reb.name], [2, 300, "orthodox", "orthodox", "Orthodox rebels of AAA"]);
    // a tax uprising later forms rebels of its own, not of that faith
    uprising(game, "AAA", []);
    assert.equal(Object.values(st.countries).filter((c) => c.rebel && c.of === "AAA").length, 2);
    // they march on no settlement of another faith: Two is all theirs to fight for
    const band = Object.values(st.armies).find((a) => a.owner === ev.rebels);
    st.settlements[2].siege = null;
    band.men.swords = 50000;
    st.day = 10;
    rebelOrders(game, []);
    assert.ok(!band.march || band.march.to === "2");
    // a country with no people of another faith has no religious uprising
    assert.equal(religiousUprising(tinyGame(), "AAA", []), false);
});
