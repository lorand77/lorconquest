// Peace, the warmonger score, military access and what closes land (RULES.md §10), on the tiny map (see
// diplomacy.test.js for who is who).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { capture } from "../../src/engine/fighting.js";
import { addAgreement, setSubject } from "../../src/engine/diplomacy.js";
import { Game, economyOf, hasAgreement, isCore, peaceAnswer, peaceCost, routeFor, situation } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const take = (game, id, by) => capture(game, game.state.settlements[id], by, [], "storm");

test("a peace: the war ends, a truce of 5 years starts, the world remembers, and each side is scored for what it holds", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    game.state.settlements[5].courthouse = true;
    take(game, 5, "AAA");                                                      // 10,000 of BBB's people
    assert.deepEqual([game.state.settlements[5].heldSince, game.state.settlements[5].courthouse, game.state.settlements[5].cores], [0, false, ["BBB"]]);
    take(game, 2, "BBB");                                                      // BBB takes one of AAA's, a core of AAA
    const events = order(game, cmd("AAA", "proposePeace", { with: "BBB" }));
    assert.deepEqual(ofType(events, "answer").map((e) => e.accepted), [true]);
    assert.deepEqual(game.state.wars, []);
    assert.deepEqual(game.state.warInfo, {});
    assert.ok(hasAgreement(game.state, "truce", "AAA", "BBB"));
    assert.equal(game.state.agreements.find((x) => x.kind === "truce").until, 5 * 365);
    assert.equal(game.state.memory.lastWar["AAA|BBB"], 0);
    // AAA declared (+5) and holds 10,000 people taken as the attacker: +10; BBB holds 10,000 taken as the defender: half, +5
    assert.deepEqual([game.state.countries.AAA.warmonger, game.state.countries.BBB.warmonger], [15, 5]);
});

test("a scenario's warmonger scale counts the settlements taken, not the declaring", () => {
    const game = tinyGame(1, (sc) => { sc.warmongerScale = 0.25; });
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    take(game, 5, "AAA");
    take(game, 2, "BBB");
    order(game, cmd("AAA", "proposePeace", { with: "BBB" }));
    // +5 for declaring, then a quarter of +10 and of +5
    assert.deepEqual([game.state.countries.AAA.warmonger, game.state.countries.BBB.warmonger], [5 + 2.5, 1.25]);
});

test("retaking a settlement that was your core adds nothing, on either side", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    take(game, 5, "AAA");
    take(game, 5, "BBB");                                                      // BBB takes it back: its own core
    order(game, cmd("AAA", "proposePeace", { with: "BBB" }));
    assert.deepEqual([game.state.countries.AAA.warmonger, game.state.countries.BBB.warmonger], [5, 0]);
});

test("a declaration during a truce breaks it; a computer refuses a peace it is winning; what you give lowers the price", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    take(game, 5, "AAA");
    order(game, cmd("AAA", "proposePeace", { with: "BBB" }));
    game.state.settlements[3].owner = "BBB";
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));    // through the truce
    assert.deepEqual(ofType(events, "broke").map((e) => e.country), ["AAA"]);
    assert.equal(hasAgreement(game.state, "truce", "AAA", "BBB"), false);
    // a new war, its tally fresh: nothing taken in it yet, so strength alone wins AAA nothing — a plain peace would do
    game.state.countries.AAA.warmonger = 0;
    assert.equal(peaceAnswer(game, "BBB", "AAA", {}).accept, true);
    // AAA takes a town in this war; BBB, weaker and with a third of its people gone, asks for a plain peace and is refused; it gives its city and is not
    take(game, 3, "AAA");
    const plain = order(game, cmd("BBB", "proposePeace", { with: "AAA" }));
    assert.equal(ofType(plain, "answer")[0].accepted, false);
    assert.deepEqual(game.state.wars, ["AAA|BBB"]);
    // its city is all it has left, and a peace leaves it one settlement; with a town besides, it may give one
    assert.match(refused(game, cmd("BBB", "proposePeace", { with: "AAA", terms: { give: [4] } })), /you would be left with no settlement/);
    game.state.settlements[3].owner = "BBB";
    assert.match(refused(game, cmd("BBB", "proposePeace", { with: "AAA", terms: { give: [4] } })), /less than 5 years ago/);
    game.state.memory.proposed = {};
    // land pays only as far as AAA took land in this war (RULES.md §10): the city's 20,000 count no more than the town's 10,000 it
    // took — 25 of BBB's 40,000 at the start, short of the 35.8 its war score asks; the rest is paid in money
    const city = peaceAnswer(game, "AAA", "BBB", { give: [4] }), town = peaceAnswer(game, "AAA", "BBB", { give: [3] });
    assert.deepEqual([city.accept, city.cost, town.cost], [false, -25, -25]);
    game.state.countries.BBB.treasury = 100000;
    const gift = order(game, cmd("BBB", "proposePeace", { with: "AAA", terms: { give: [3], money: -70000 } }));
    assert.equal(ofType(gift, "answer")[0].accepted, true);
    assert.equal(game.state.settlements[3].owner, "AAA");
    assert.equal(game.state.settlements[3].heldSince, game.day);
});

test("peace terms: settlements, money, subjects — checked, applied, and scored", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    take(game, 5, "AAA");
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "BBB", terms: { take: [1] } })), /1 is not BBB's/);
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "BBB", terms: { give: [4] } })), /4 is not AAA's/);
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "BBB", terms: { money: 1e9 } })), /cannot pay/);
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "BBB", terms: { makeSubject: "king" } })), /vassal or protectorate/);
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "CCC" })), /not at war/);
    const money = Math.floor(game.state.countries.BBB.treasury / 6);
    const events = order(game, cmd("AAA", "proposePeace", { with: "BBB", terms: { money, makeSubject: "protectorate" } }));
    assert.equal(ofType(events, "answer")[0].accepted, true);                  // costs ~2.4 + 31.25 (BBB 1 settlement, AAA 4) against a score of ~37
    assert.deepEqual([game.state.countries.BBB.overlord, game.state.countries.BBB.subjectKind], ["AAA", "protectorate"]);
    assert.equal(game.state.countries.AAA.treasury, 80000 + money);
    // 5 declared + 10 for the settlement held + 5 for a protectorate made, as the attacking side
    assert.equal(game.state.countries.AAA.warmonger, 5 + 10 + 5);
});

test("a country with no settlements left is out of the game, and nobody makes peace with it; a human is asked and may refuse", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    take(game, 4, "AAA");
    take(game, 5, "AAA");
    delete game.state.armies[4];                                                // (its garrisons, or they would take them back)
    delete game.state.armies[5];
    runTo(game, 1);
    assert.equal(game.state.countries.BBB.out, 1);
    assert.equal(game.state.wars.length, 0);
    assert.equal(refused(game, cmd("AAA", "proposePeace", { with: "BBB" })), "BBB is no more");
    assert.equal(refused(game, cmd("CCC", "declareWar", { target: "BBB" })), "BBB is no more");

    const h = tinyGame(1, () => {}, ["BBB"]);
    order(h, cmd("AAA", "declareWar", { target: "BBB" }));
    const [offer] = order(h, cmd("AAA", "proposePeace", { with: "BBB" }));
    assert.equal(offer.type, "offer");
    assert.equal(h.state.wars.length, 1);
    order(h, cmd("BBB", "answerOffer", { id: h.state.offers[0].id, accept: false }));
    assert.deepEqual([h.state.wars.length, h.state.offers.length], [1, 0]);
    order(h, cmd("AAA", "proposePeace", { with: "BBB", terms: { take: [5] } }));
    order(h, cmd("BBB", "answerOffer", { id: h.state.offers[0].id, accept: true }));
    assert.deepEqual([h.state.wars.length, h.state.settlements[5].owner], [0, "AAA"]);
});

test("a vassal cannot make peace or war; its overlord's peace ends its wars too", () => {
    const game = tinyGame();
    setSubject(game, "EEE", "AAA", "vassal", []);
    for (const c of [cmd("EEE", "declareWar", { target: "DDD" }), cmd("EEE", "proposePeace", { with: "DDD" }), cmd("EEE", "proposeAgreement", { with: "DDD", kind: "pact" })]) {
        assert.match(refused(game, c), /vassal has no diplomacy/);
    }
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "EEE" })), /not at war/);
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(game.state.wars.sort(), ["AAA|BBB", "BBB|EEE"]);          // the vassal joined
    order(game, cmd("AAA", "proposePeace", { with: "BBB" }));
    assert.deepEqual(game.state.wars, []);                                      // and its war ended with its overlord's
});

test("neutral land is closed; allies, subjects and military access open it", () => {
    const route = (g) => routeFor(g, g.state.armies[3], "5");
    let game = tinyGame();
    assert.equal(route(game), null);
    addAgreement(game, "access", "BBB", "AAA");                                  // BBB gives AAA access
    assert.ok(route(game));
    game = tinyGame();
    addAgreement(game, "defensive", "AAA", "BBB");
    assert.ok(route(game));
    game = tinyGame();
    setSubject(game, "BBB", "AAA", "protectorate", []);
    assert.ok(route(game));
    game = tinyGame();
    addAgreement(game, "access", "AAA", "BBB");                                  // the other way round: BBB may enter AAA, not the reverse
    assert.equal(route(game), null);
});

test("when access, an alliance or a war ends, armies left in the land go home", () => {
    const stand = (game, kind) => {
        addAgreement(game, kind, ...(kind === "access" ? ["BBB", "AAA"] : ["AAA", "BBB"]));
        game.state.armies[3].at = "5";                                         // AAA's garrison stands in BBB's settlement 5
        game.state.armies[3].arrived = 0;
    };
    let game = tinyGame();
    stand(game, "access");
    const events = order(game, cmd("BBB", "cancelAccess", { with: "AAA" }));
    assert.equal(game.state.armies[3].retreating, "home");
    assert.ok(ofType(events, "retreat").length === 1 && game.state.memory.broke.BBB === undefined);
    game = tinyGame();
    stand(game, "defensive");
    order(game, cmd("BBB", "breakAgreement", { with: "AAA", kind: "defensive" }));
    assert.equal(game.state.armies[3].retreating, "home");
    game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    game.state.armies[3].at = "5";
    order(game, cmd("AAA", "proposePeace", { with: "BBB" }));                  // the peace sends the besieger home
    assert.equal(game.state.armies[3].retreating, "home");
    // two steps inside: from CCC's 6 home through BBB's land, closed to it but not an enemy's — not destroyed for want of a way
    game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    Object.assign(game.state.armies[2], { at: "6", arrived: 0 });
    const peace = order(game, cmd("AAA", "proposePeace", { with: "CCC" }));
    assert.equal(ofType(peace, "destroyed").length, 0);
    assert.equal(game.state.armies[2].retreating, "home");
    runTo(game, 400);
    assert.ok(["1", "2", "3"].includes(game.state.armies[2].at), `home at ${game.state.armies[2].at}`);
    assert.equal(game.state.armies[2].retreating, false);
});

test("friendly land feeds an army; land opened by access does not", () => {
    const hungry = (kind) => {
        const game = tinyGame();
        addAgreement(game, kind, ...(kind === "access" ? ["BBB", "AAA"] : ["AAA", "BBB"]));
        setArmy(game, 3, { swords: 20000 });
        game.state.armies[3].at = "5";                                          // 20,000 men where the land feeds 5,000
        const events = runTo(game, 31);
        return ofType(events, "attrition").filter((e) => e.army === 3).length;
    };
    assert.equal(hungry("defensive"), 0);
    assert.equal(hungry("access"), 1);
});

test("an ally inside a besieged settlement defends it once it is at war with the besieger; it falls back when the settlement surrenders", () => {
    const game = tinyGame(1, () => {}, ["CCC"]);
    addAgreement(game, "military", "BBB", "CCC");
    game.state.armies[6].at = "5";                                              // CCC's garrison stands in BBB's settlement 5
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));                  // CCC is called, and a human has time to answer
    game.state.armies[3].at = "5";
    let sit = situation(game, "5");
    assert.deepEqual([sit.garrison.map((a) => a.id), sit.hostile.map((a) => a.id)], [[5], [3]]);   // not at war yet: it ignores them
    order(game, cmd("CCC", "answerOffer", { id: game.state.offers[0].id, accept: true }));
    sit = situation(game, "5");
    assert.deepEqual([sit.garrison.map((a) => a.id), sit.hostile.map((a) => a.id)], [[5, 6], [3]]);
    // the siege runs out: BBB's own garrison is disbanded, CCC's army falls back instead
    game.state.settlements[5].siege = { by: "AAA", start: 0, end: 1 };
    const events = runTo(game, 1);
    assert.equal(game.state.settlements[5].owner, "AAA");
    assert.equal(game.state.armies[5], undefined);
    assert.deepEqual([game.state.armies[6].retreating, ofType(events, "retreat").map((e) => e.army)], [true, [6]]);
});

test("the historical scenario opens with its four wars and thirteen agreements", () => {
    const scenario = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "..", "scenarios", "historical-1440", "scenario.json"), "utf8"));
    const game = Game.create(scenario, { seed: 1 });
    assert.deepEqual(game.state.wars, ["BUR|HAM", "BUR|LUB", "HUN|JIS", "MIL|VEN", "SWI|ZUR"]);
    assert.equal(game.state.agreements.length, 13);
    assert.ok(hasAgreement(game.state, "military", "HUN", "POL") && hasAgreement(game.state, "guarantee", "STY", "JIS") && !hasAgreement(game.state, "guarantee", "JIS", "STY"));
    assert.ok(["DEN", "SWE", "NOR"].every((a) => ["DEN", "SWE", "NOR"].every((b) => a === b || hasAgreement(game.state, "defensive", a, b))));
    const pact = game.state.agreements.find((x) => x.kind === "pact");
    assert.deepEqual([pact.a, pact.b, pact.until], ["POL", "TEU", 5 * 365]);
    assert.equal(Object.values(game.state.countries).every((c) => c.warmonger === 0), true);
    assert.equal(isCore(game.state, game.state.settlements[1], "NOR"), true);
});

test("the capital a country began with, taken back, is its capital again at once — after another was named meanwhile", () => {
    const game = tinyGame(), st = game.state;
    order(game, cmd("BBB", "declareWar", { target: "AAA" }));
    capture(game, st.settlements[1], "BBB", [], "storm");                       // AAA's capital, One, falls
    assert.equal(st.countries.BBB.capital, 4, "not BBB's: its own stays");
    order(game, cmd("AAA", "setCapital", { settlement: 2 }));
    assert.equal(st.countries.AAA.capital, 2);
    const events = [];
    capture(game, st.settlements[1], "AAA", events, "storm");                   // taken back
    assert.equal(st.countries.AAA.capital, 1);
    assert.deepEqual(ofType(events, "capital").map((e) => [e.country, e.settlement]), [["AAA", 1]]);
});

test("money in a peace: what is asked in years of the loser's money, what is paid in years of the richer side's; a subject is never bought", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    const year = (c) => { const e = economyOf(game, c); return Math.max(1, e.moneyPerYear, 0.25 * e.settlementMoney); };
    const X = 100000;
    assert.ok(Math.abs(peaceCost(game, "AAA", "BBB", { money: X }) - 10 * X / year("BBB")) < 1e-9, "asked: in years of BBB's money");
    assert.ok(Math.abs(peaceCost(game, "AAA", "BBB", { money: -X }) + 10 * X / Math.max(year("AAA"), year("BBB"))) < 1e-9, "paid: in years of the richer of the two");
    // a poor payer's coin is no rich receiver's treasure: BBB grown ten times richer, AAA's money buys a tenth as much
    const before = peaceCost(game, "AAA", "BBB", { money: -X });
    for (const id of [4, 5]) game.state.settlements[id].pop *= 10;
    assert.ok(Math.abs(peaceCost(game, "AAA", "BBB", { money: -X }) + 10 * X / year("BBB")) < 1e-9 && year("BBB") > year("AAA"));
    assert.ok(peaceCost(game, "AAA", "BBB", { money: -X }) > before, "worth less to the richer receiver");
    for (const id of [4, 5]) game.state.settlements[id].pop /= 10;
    // however much AAA pays, BBB as its vassal costs its price — 50 × (1 + its 2 settlements ÷ AAA's 3); paid money offsets only
    // what else is asked
    const vassal = 50 * (1 + 2 / 3), protectorate = 25 * (1 + 2 / 3);
    assert.ok(Math.abs(peaceCost(game, "AAA", "BBB", { money: -1e9, makeSubject: "vassal" }) - vassal) < 1e-9);
    const five = 10000 / Math.max(1, game.state.warInfo["AAA|BBB"].startPop.BBB) * 100;  // settlement 5, as % of BBB's people
    assert.ok(Math.abs(peaceCost(game, "AAA", "BBB", { take: [5], money: -1e9, makeSubject: "protectorate" }) - protectorate) < 1e-9, "the land bought, the protectorate not");
    assert.ok(Math.abs(peaceCost(game, "AAA", "BBB", { take: [5], makeSubject: "protectorate" }) - (five + protectorate)) < 1e-9);
});

test("land is won in the field: a peace asks at most as many people's land as the war took, less what it lost — whatever the war score", async () => {
    const { landOf } = await import("../../src/engine/opinion.js");
    // BBB holds Three (10,000) besides its own Four (20,000) and Five (10,000) when the war begins
    const game = tinyGame(), st = game.state;
    st.settlements[3].owner = "BBB";
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    st.countries.AAA.warmonger = 0;
    // nothing taken yet: no land at all, however strong
    const none = peaceAnswer(game, "BBB", "AAA", { take: [5] });
    assert.deepEqual([none.accept, none.land], [false, { gain: 10000, won: 0 }]);
    // Five taken by storm: 10,000 won — Three (10,000) may be asked, Four (20,000) may not
    take(game, 5, "AAA");
    assert.deepEqual(landOf(game, "AAA", "BBB", { take: [4] }), { gain: 20000, won: 10000 });
    const four = peaceAnswer(game, "BBB", "AAA", { take: [4] });
    assert.deepEqual([four.accept, four.land], [false, { gain: 20000, won: 10000 }]);
    assert.equal(peaceAnswer(game, "BBB", "AAA", { take: [3] }).land, undefined, "within what was won: the score decides");
    // what AAA gives counts against what it asks: Four (20,000) for Five and Two (10,000 each) is no gain at all
    assert.deepEqual(landOf(game, "AAA", "BBB", { take: [4], give: [5, 2] }).gain, 0);
    // BBB taking back a town of its own: what AAA won falls by as much
    st.settlements[2].owner = "AAA";
    take(game, 2, "BBB");
    assert.deepEqual(landOf(game, "AAA", "BBB", {}).won, 0);
    const refusedNow = peaceAnswer(game, "BBB", "AAA", { take: [3] });
    assert.deepEqual([refusedNow.accept, refusedNow.land], [false, { gain: 10000, won: 0 }]);
});
