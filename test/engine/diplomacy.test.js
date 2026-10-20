// War, agreements, calls to arms and the computer countries' opinions (RULES.md §10), on the tiny map. AAA has 1, 2, 3
// (40,000 people, 1,600 men), BBB 4, 5 (30,000, 1,200), CCC 6 (10,000, 400), DDD 7 and EEE 8 (10,000 each). By land
// route AAA borders BBB, BBB borders AAA and CCC, CCC borders BBB and DDD, DDD borders CCC and EEE.
import test from "node:test";
import assert from "node:assert/strict";
import { agreementAnswer, need, opinion, peaceAnswer, peaceCost, warScore, demandChance } from "../../src/engine/opinion.js";
import { addAgreement, openWar, recordCapture, setSubject } from "../../src/engine/diplomacy.js";
import { economyOf, hasAgreement, isFriend, longDate } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused, rigRoll } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const agree = (game, kind, a, b, days) => addAgreement(game, kind, a, b, days);

test("declaring war: a record of the war, +5 warmonger for the declarer, and the pair at war", () => {
    const game = tinyGame();
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(ofType(events, "war").map((e) => [e.country, e.target]), [["AAA", "BBB"]]);
    assert.deepEqual(game.state.wars, ["AAA|BBB"]);
    assert.deepEqual(game.state.warInfo["AAA|BBB"], { start: 0, attacker: "AAA", startPop: { AAA: 40000, BBB: 30000 }, taken: { AAA: 0, BBB: 0 }, gained: {} });
    assert.deepEqual([game.state.countries.AAA.warmonger, game.state.countries.BBB.warmonger], [5, 0]);
    assert.match(refused(game, cmd("AAA", "declareWar", { target: "BBB" })), /already at war/);
    assert.match(refused(game, cmd("AAA", "declareWar", { target: "AAA" })), /own country/);
    assert.match(refused(game, cmd("AAA", "declareWar", { target: "ZZZ" })), /no country/);
});

test("a scenario's starting wars and agreements count as if made in play, with no warmonger score", () => {
    const game = tinyGame(1, (sc) => {
        sc.start = { wars: [{ attackers: ["AAA", "CCC"], defenders: ["BBB"] }], agreements: [{ kind: "pact", a: "DDD", b: "EEE", yearsLeft: 5 }, { kind: "guarantee", a: "DDD", b: "CCC" }, { kind: "military", a: "AAA", b: "CCC" }] };
    });
    assert.deepEqual(game.state.wars, ["AAA|BBB", "BBB|CCC"]);
    assert.deepEqual(game.state.warInfo["BBB|CCC"].attacker, "CCC");
    assert.equal(game.state.countries.AAA.warmonger, 0);
    assert.ok(hasAgreement(game.state, "pact", "DDD", "EEE") && hasAgreement(game.state, "guarantee", "DDD", "CCC") && !hasAgreement(game.state, "guarantee", "CCC", "DDD"));
    const pact = game.state.agreements.find((x) => x.kind === "pact");
    assert.equal(pact.until, 5 * 365);
    const events = runTo(game, 5 * 365);
    assert.deepEqual(ofType(events, "expired").map((e) => [e.kind, e.a, e.b]), [["pact", "DDD", "EEE"]]);
    assert.ok(!hasAgreement(game.state, "pact", "DDD", "EEE"));
});

test("defensive allies, guarantors and military allies of the target join; each pair has its attacking side", () => {
    const game = tinyGame();
    agree(game, "defensive", "BBB", "CCC");
    agree(game, "military", "BBB", "DDD");
    agree(game, "guarantee", "EEE", "BBB");
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(ofType(events, "joins").map((e) => [e.country, e.enemy, e.side]).sort(), [["CCC", "AAA", "def"], ["DDD", "AAA", "def"], ["EEE", "AAA", "def"]]);
    assert.deepEqual(game.state.wars, ["AAA|BBB", "AAA|CCC", "AAA|DDD", "AAA|EEE"]);
    for (const w of game.state.wars) assert.equal(game.state.warInfo[w].attacker, "AAA");
    // only the one who declared gets the warmonger score; nobody joined drags in others
    assert.deepEqual([game.state.countries.AAA.warmonger, game.state.countries.CCC.warmonger], [5, 0]);
});

test("a military ally of the declarer is called and, as a computer, joins on the attacking side", () => {
    const game = tinyGame();
    agree(game, "military", "AAA", "DDD");
    agree(game, "defensive", "AAA", "CCC");                                   // a defensive ally is not called into an attack
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(ofType(events, "joins").map((e) => [e.country, e.enemy, e.side]), [["DDD", "BBB", "att"]]);
    assert.deepEqual(game.state.wars, ["AAA|BBB", "BBB|DDD"]);
    assert.equal(game.state.warInfo["BBB|DDD"].attacker, "DDD");
});

test("vassals join every war of their overlord, whether it declares or is declared on", () => {
    const game = tinyGame();
    setSubject(game, "EEE", "AAA", "vassal", []);
    setSubject(game, "CCC", "BBB", "vassal", []);
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(ofType(events, "joins").map((e) => [e.country, e.side]).sort(), [["CCC", "def"], ["EEE", "att"]]);
    assert.deepEqual(game.state.wars, ["AAA|BBB", "AAA|CCC", "BBB|EEE", "CCC|EEE"].filter((w) => game.state.wars.includes(w)));
    assert.ok(game.state.wars.includes("AAA|BBB") && game.state.wars.includes("BBB|EEE") && game.state.wars.includes("AAA|CCC"));
});

test("a human who is called answers; no answer in 6 months is a yes; a no ends the alliance", () => {
    const make = () => { const g = tinyGame(1, () => {}, ["DDD"]); agree(g, "military", "AAA", "DDD"); return g; };
    let game = make();
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.equal(ofType(events, "joins").length, 0);
    assert.equal(game.state.offers.length, 1);
    const offer = game.state.offers[0];
    assert.deepEqual([offer.kind, offer.from, offer.to, offer.enemy, offer.side, offer.deadline], ["call", "AAA", "DDD", "BBB", "att", 183]);
    assert.match(refused(game, cmd("EEE", "answerOffer", { id: offer.id, accept: true })), /not put to you/);
    assert.match(refused(game, cmd("DDD", "answerOffer", { id: 99, accept: true })), /no question/);
    order(game, cmd("DDD", "answerOffer", { id: offer.id, accept: true }));
    assert.deepEqual([game.state.wars.includes("BBB|DDD"), game.state.offers.length], [true, 0]);

    game = make();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    order(game, cmd("DDD", "answerOffer", { id: game.state.offers[0].id, accept: false }));
    assert.deepEqual([game.state.wars.includes("BBB|DDD"), hasAgreement(game.state, "military", "AAA", "DDD")], [false, false]);

    game = make();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    const late = runTo(game, 183);
    assert.deepEqual(ofType(late, "joins").map((e) => e.country), ["DDD"]);
    assert.deepEqual(ofType(late, "lapsed").map((e) => [e.country, e.kind]), [["DDD", "call"]]);
});

test("a country called by both sides, or allied with the enemy, cannot stay allied with it once at war", () => {
    const game = tinyGame();
    agree(game, "military", "AAA", "DDD");
    agree(game, "military", "BBB", "DDD");
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.equal(game.state.wars.filter((w) => w.includes("DDD")).length, 1);   // it joined one side only
    assert.equal(game.state.agreements.filter((x) => x.kind === "military" && [x.a, x.b].includes("DDD")).length, 1);
    assert.ok(ofType(events, "joins").length === 1);
    for (const w of game.state.wars) { const [a, b] = w.split("|"); assert.equal(isFriend(game.state, a, b), false, `${a} and ${b} are at war and friends`); }
});

test("declaring war through a pact, a truce or an alliance breaks it: alliances end, the world remembers", () => {
    const game = tinyGame();
    agree(game, "pact", "AAA", "BBB", 3650);
    agree(game, "defensive", "AAA", "CCC");
    agree(game, "military", "AAA", "DDD");
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(ofType(events, "broke").map((e) => e.country), ["AAA"]);
    assert.deepEqual(game.state.agreements.filter((x) => x.kind !== "military" || x.b !== "BBB"), []);   // the pact and every alliance are gone
    assert.equal(game.state.memory.broke.AAA, 0);
    // every computer country's opinion of AAA falls by 40 for 10 years (and by half its warmonger score of 5: it is far off)
    near(opinion(game, "EEE", "AAA"), -40 - 2.5);
    game.state.day = 10 * 365 + 1;
    near(opinion(game, "EEE", "AAA"), -2.5 + 0 + 10);                           // the 40 is forgotten; ten years since the start: +10
});

test("breaking an agreement on purpose does the same; cancelling military access you give does not", () => {
    const game = tinyGame();
    agree(game, "military", "AAA", "DDD");
    agree(game, "guarantee", "AAA", "CCC");
    agree(game, "access", "AAA", "BBB");                                       // AAA gives BBB access
    order(game, cmd("AAA", "cancelAccess", { with: "BBB" }));
    assert.equal(game.state.memory.broke.AAA, undefined);
    assert.match(refused(game, cmd("AAA", "cancelAccess", { with: "BBB" })), /no military access/);
    assert.match(refused(game, cmd("CCC", "breakAgreement", { with: "AAA", kind: "guarantee" })), /no such guarantee/);   // only the guarantor may
    order(game, cmd("AAA", "breakAgreement", { with: "CCC", kind: "guarantee" }));
    assert.equal(game.state.memory.broke.AAA, 0);
    assert.equal(hasAgreement(game.state, "military", "AAA", "DDD"), false);   // every alliance ended with it
});

test("a computer's answer to an agreement: opinion + need must reach the bar, and nothing tips by chance", () => {
    // CCC does not border AAA: its opinion of AAA is 0; its strongest neighbour is BBB (1,200 against its own 400): need 20
    const game = tinyGame();
    near(opinion(game, "CCC", "AAA"), 0);
    near(need(game, "CCC", "AAA"), 20);
    const bars = { guarantee: -20, pact: 0, access: 10, defensive: 20, military: 40 };
    for (const [kind, bar] of Object.entries(bars)) {
        const a = agreementAnswer(game, "CCC", "AAA", kind);
        assert.deepEqual([a.accept, a.bar, a.opinion, a.need], [20 >= bar, bar, 0, 20], kind);
    }
    // a warmonger is disliked half as much from afar: 40 is −20, so a pact (bar 0) just passes; 50 is −25 and fails
    game.state.countries.AAA.warmonger = 40;
    assert.equal(agreementAnswer(game, "CCC", "AAA", "pact").accept, true);
    game.state.countries.AAA.warmonger = 50;
    assert.equal(agreementAnswer(game, "CCC", "AAA", "pact").accept, false);
    // BBB borders AAA: −15, and the whole warmonger score counts
    game.state.countries.AAA.warmonger = 10;
    near(opinion(game, "BBB", "AAA"), -15 - 10);
});

test("proposing an agreement: answered at once, the same proposal to the same country once in 5 years, none while at war", () => {
    const game = tinyGame();
    let events = order(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "defensive" }));
    assert.deepEqual(ofType(events, "answer").map((e) => [e.country, e.what, e.accepted, e.opinion, e.need, e.bar]), [["CCC", "defensive", true, 0, 20, 20]]);
    assert.ok(hasAgreement(game.state, "defensive", "AAA", "CCC"));
    assert.match(refused(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "defensive" })), /already stands/);
    events = order(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "military" }));
    assert.equal(ofType(events, "answer")[0].accepted, false);                 // 20 is under 40
    assert.match(refused(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "military" })), /less than 5 years ago/);
    runTo(game, 5 * 365);
    order(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "military" }));
    // a guarantee is one way; access is given by the one asked
    order(game, cmd("AAA", "proposeAgreement", { with: "DDD", kind: "guarantee" }));
    assert.ok(hasAgreement(game.state, "guarantee", "AAA", "DDD") && !hasAgreement(game.state, "guarantee", "DDD", "AAA"));
    events = order(game, cmd("AAA", "proposeAgreement", { with: "DDD", kind: "access" }));
    assert.equal(ofType(events, "answer")[0].accepted, false);                  // opinion 5 and need 0 are under the bar of 10
    runTo(game, 10 * 365);
    events = order(game, cmd("AAA", "proposeAgreement", { with: "DDD", kind: "access" }));
    assert.equal(ofType(events, "answer")[0].accepted, true);                   // ten years of peace: opinion 10
    assert.ok(hasAgreement(game.state, "access", "DDD", "AAA"));
    order(game, cmd("AAA", "declareWar", { target: "EEE" }));
    assert.match(refused(game, cmd("AAA", "proposeAgreement", { with: "EEE", kind: "pact" })), /at war/);
    assert.match(refused(game, cmd("AAA", "proposeAgreement", { with: "DDD", kind: "treaty" })), /no agreement/);
});

test("a human is asked instead, and answers", () => {
    const game = tinyGame(1, () => {}, ["CCC"]);
    const [ev] = order(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "pact" }));
    assert.equal(ev.type, "offer");
    const id = game.state.offers[0].id;
    assert.deepEqual([game.state.offers[0].kind, game.state.offers[0].agreement, game.state.offers[0].deadline], ["agreement", "pact", 183]);
    order(game, cmd("CCC", "answerOffer", { id, accept: true }));
    assert.ok(hasAgreement(game.state, "pact", "AAA", "CCC"));
    assert.equal(game.state.agreements[0].until, 10 * 365);
    // unanswered, a proposal lapses
    order(game, cmd("AAA", "proposeAgreement", { with: "CCC", kind: "defensive" }));
    const events = runTo(game, 183);
    assert.deepEqual(ofType(events, "lapsed").map((e) => e.kind), ["agreement"]);
    assert.equal(hasAgreement(game.state, "defensive", "AAA", "CCC"), false);
});

test("opinion, factor by factor (RULES.md §10)", () => {
    const game = tinyGame(1, (sc) => { for (const id of [3, 6]) sc.settlements.find((s) => s.id === id).hre = true; });
    const o = (holder, other) => opinion(game, holder, other);
    near(o("CCC", "AAA"), 0 + 10);                                              // both hold Empire settlements: +10
    game.state.day = 3 * 365 + 5;
    near(o("CCC", "AAA"), 10 + 3);                                              // a year of peace each, +1
    game.state.day = 40 * 365;
    near(o("CCC", "AAA"), 10 + 20);                                             // at most +20
    near(o("BBB", "AAA"), 20 - 15 + 0);                                         // sharing a border: −15 (and none of the Empire)
    // both at war with the same country: +20
    openWar(game, "AAA", "BBB", "AAA");
    openWar(game, "CCC", "BBB", "CCC");
    near(o("CCC", "AAA"), 10 + 20 + 20);
    // AAA is at war with BBB, CCC's friend: −30; and CCC fights... no: only if allied with BBB
    agree(game, "defensive", "CCC", "BBB");
    near(o("CCC", "AAA"), 10 + 20 + 20 - 30);
    // a war fought against it in the last 20 years: −25; it counts while it goes on
    game.state.memory.lastWar["AAA|CCC"] = game.state.day - 5 * 365;
    near(o("CCC", "AAA"), 10 + 5 + 20 - 30 - 25);
    // an agreement broken in the last 10 years: −40; a demand it refused: −30 (not for the Empire)
    game.state.memory.broke.AAA = game.state.day - 3 * 365;
    game.state.memory.refused["CCC>AAA"] = game.state.day - 3 * 365;
    near(o("CCC", "AAA"), 10 + 5 + 20 - 30 - 25 - 40 - 30);
    game.state.memory.broke.AAA = game.state.day - 11 * 365;                   // the world forgets after 10 years
    near(o("CCC", "AAA"), 10 + 5 + 20 - 30 - 25 - 30);
    // the warmonger score: in full beside it, half if further off, at most −60, and the whole stays within ±100
    game.state.countries.AAA.warmonger = 70;
    near(o("CCC", "AAA"), 10 + 5 + 20 - 30 - 25 - 30 - 35);
    // BBB: 20 years of peace gone (it is at war with AAA: 0), −15 border, −25 a war fought, −60 for the warmonger at most
    near(o("BBB", "AAA"), -15 - 25 - 60);
    game.state.countries.AAA.warmonger = 500;
    assert.equal(o("BBB", "AAA"), -100);                                       // and the whole is held to −100…
    assert.ok(o("CCC", "BBB") <= 100);
});

test("the war score and what a peace asks, worked out by hand", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    game.state.settlements[5].owner = "AAA";                                    // AAA takes settlement 5 (10,000 of BBB's 30,000)
    recordCapture(game, { id: 5, pop: 10000 }, "BBB", "AAA");
    // 10,000 / 30,000 = 33.3% taken; strength 1,600 / 1,200 = 1.33, so + 10 × 0.33 = 3.3
    near(warScore(game, "AAA", "BBB"), 100 / 3 + 10 / 3);
    // the other way round: −10,000 / 30,000 of BBB... of AAA's people it took none; BBB lost a third and is weaker
    near(warScore(game, "BBB", "AAA"), -100 / 3 + 10 * (1200 / 1600 - 1));
    const asks = (terms) => peaceCost(game, "AAA", "BBB", terms);
    near(asks({}), 0);
    near(asks({ take: [4] }), 20000 / 30000 * 100);                             // a city of 20,000
    const year = economyOf(game, "BBB").moneyPerYear;                           // BBB, with one settlement left: 18,800 civilians × 2, less 1,200 × 5
    near(year, 31600);
    near(asks({ money: year }), 10);                                            // ten for a year of its money
    near(asks({ makeSubject: "vassal" }), 50);
    near(asks({ makeSubject: "protectorate" }), 25);
    near(asks({ take: [4], give: [1] }), 0);                                    // what the proposer gives counts the same way against it
    assert.equal(peaceAnswer(game, "BBB", "AAA", {}).accept, true);             // a plain peace: any score of 0 or more
    assert.equal(peaceAnswer(game, "BBB", "AAA", { take: [4] }).accept, false); // 66.7 against a score of 36.7
    assert.equal(peaceAnswer(game, "BBB", "AAA", { makeSubject: "protectorate" }).accept, true);    // 25 ≤ 36.7
    assert.equal(peaceAnswer(game, "BBB", "AAA", { makeSubject: "vassal" }).accept, false);         // 50 > 36.7
});
