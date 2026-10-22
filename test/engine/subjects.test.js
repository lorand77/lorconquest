// Subjects and tribute, demands, the Empire, coalitions and victory (RULES.md §10; SCENARIO.md, Victory) on the tiny
// map (see diplomacy.test.js for who is who). BBB's money a year is 51,600 (28,800 civilians × 2 less 1,200 × 5), AAA's
// 68,800, CCC's 17,200.
import test from "node:test";
import assert from "node:assert/strict";
import { addAgreement, formLeague, setSubject } from "../../src/engine/diplomacy.js";
import { atWar, demandChance, economyOf, germanStates, hasAgreement, opinion, scores, wouldCycle } from "../../src/engine/index.js";
import { tinyGame, setArmy, runTo, order, refused, rigRoll } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test("a vassal pays 40% of its money a year to its overlord, a protectorate 10%, only when positive", () => {
    const game = tinyGame();
    setSubject(game, "BBB", "AAA", "vassal", []);
    let a = economyOf(game, "AAA"), b = economyOf(game, "BBB");
    near(b.tributePaid, 0.4 * 51600);
    near(a.tributeReceived, 0.4 * 51600);
    near(a.moneyPerYear, 68800 + 20640);
    near(b.moneyPerYear, 51600 - 20640);
    near(a.rPerYear, 89440 + 10000);                                            // tribute received is investable: slider 50%
    game.state.countries.BBB.subjectKind = "protectorate";
    near(economyOf(game, "AAA").moneyPerYear, 68800 + 5160);
    game.state.countries.BBB.loans = 5e6;                                       // interest far over its income: nothing to pay out of
    b = economyOf(game, "BBB");
    assert.ok(b.moneyPerYear < 0);
    assert.equal(b.tributePaid, 0);
    assert.equal(economyOf(game, "AAA").tributeReceived, 0);
});

test("a subject pays on its money before its own tribute is counted", () => {
    const game = tinyGame();
    setSubject(game, "BBB", "AAA", "vassal", []);
    setSubject(game, "CCC", "BBB", "vassal", []);
    const c = economyOf(game, "CCC"), b = economyOf(game, "BBB");
    near(c.tributePaid, 0.4 * 17200);
    near(b.tributeReceived, 0.4 * 17200);
    near(b.tributePaid, 0.4 * 51600);                                           // of BBB's own 51,600, not of what CCC sends it
    near(b.moneyPerYear, 51600 + 6880 - 20640);
});

test("becoming a vassal: its agreements and its war with the overlord end, it joins the overlord's wars", () => {
    const game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    order(game, cmd("BBB", "declareWar", { target: "AAA" }));
    order(game, cmd("BBB", "proposeAgreement", { with: "EEE", kind: "guarantee" }));
    setSubject(game, "BBB", "AAA", "vassal", []);
    assert.equal(game.state.wars.includes("AAA|BBB"), false);
    assert.ok(game.state.wars.includes("BBB|CCC"));                             // it fights its overlord's enemy
    assert.equal(game.state.warInfo["BBB|CCC"].attacker, "BBB");
    assert.equal(game.state.agreements.some((x) => x.a === "BBB" || x.b === "BBB"), false);
    assert.equal(setSubject(game, "AAA", "BBB", "vassal", []), false);          // no ring of overlords
    assert.ok(wouldCycle(game.state, "AAA", "BBB"));
});

test("a subject breaks free the moment its military power is greater than its overlord's — its overlord's own forces only", () => {
    const game = tinyGame();
    setSubject(game, "BBB", "AAA", "vassal", []);
    setSubject(game, "EEE", "AAA", "vassal", []);
    setArmy(game, 4, { unarmed: 100000 });                                      // men without weapons are worth nothing
    assert.equal(ofType(runTo(game, 3), "freedom").length, 0);
    setArmy(game, 4, { swords: 1000 });                                         // 1,000 + 400 against AAA's 1,600
    assert.equal(ofType(runTo(game, 5), "freedom").length, 0);
    setArmy(game, 4, { swords: 1300 });                                         // 1,700 against 1,600 — though AAA and its vassal EEE (400) make 2,000
    const events = runTo(game, 6);
    assert.deepEqual(ofType(events, "freedom").map((e) => [e.country, e.overlord]), [["BBB", "AAA"]]);
    assert.equal(game.state.countries.BBB.overlord, null);
    assert.equal(game.state.countries.EEE.overlord, "AAA");
    assert.equal(game.state.memory.broke.AAA, undefined);                       // breaking free is no breaking of an agreement
});

test("what a demand is worth: mostly size, a little opinion, at most 75%, none from the smaller or the disliked", () => {
    const game = tinyGame();
    // AAA (40,000) against CCC (10,000): size 4; opinion 0
    near(demandChance(game, "CCC", "AAA", "vassal").chance, 4 * 5);
    near(demandChance(game, "CCC", "AAA", "protectorate").chance, 4 * 10);
    game.state.day = 10 * 365;                                                  // ten years of peace: opinion +10, so +1%
    near(demandChance(game, "CCC", "AAA", "vassal").chance, 21);
    // BBB (30,000) against AAA: the smaller asks nothing; AAA against BBB: size 1.33, opinion −15 beside it
    assert.equal(demandChance(game, "AAA", "BBB", "vassal").chance, 0);
    game.state.day = 0;
    near(demandChance(game, "BBB", "AAA", "protectorate").chance, 40 / 3 - 1.5);
    game.state.memory.broke.AAA = 0;                                            // −40 and −15: below −50
    assert.equal(demandChance(game, "BBB", "AAA", "protectorate").chance, 0);
    // a giant against a dwarf is held to 75%
    game.state.settlements[1].pop = 1e6;
    assert.equal(demandChance(game, "CCC", "AAA", "protectorate").chance, 75);
});

test("a demand to a computer is rolled once; a refusal is remembered 10 years and cannot be repeated for 5", () => {
    const game = tinyGame();
    rigRoll(game, 20, false);                                                   // a roll of 20 or more: CCC refuses a vassal (20%)
    let events = order(game, cmd("AAA", "demandSubject", { target: "CCC", kind: "vassal" }));
    assert.deepEqual([ofType(events, "refused").length, ofType(events, "answer").length], [1, 0]);
    assert.equal(game.state.countries.CCC.overlord, null);
    assert.equal(game.state.memory.refused["CCC>AAA"], 0);
    near(opinion(game, "CCC", "AAA"), -30);
    assert.match(refused(game, cmd("AAA", "demandSubject", { target: "CCC", kind: "vassal" })), /less than 5 years ago/);
    runTo(game, 5 * 365);
    rigRoll(game, 20, true);                                                    // the roll is below the chance (now ~21%... under 20)
    events = order(game, cmd("AAA", "demandSubject", { target: "CCC", kind: "protectorate" }));
    assert.equal(ofType(events, "answer")[0].accepted, true);
    assert.deepEqual([game.state.countries.CCC.overlord, game.state.countries.CCC.subjectKind], ["AAA", "protectorate"]);
    // a protectorate may be asked to become a vassal; a subject of another may not be asked
    rigRoll(game, 5, true);
    order(game, cmd("AAA", "demandSubject", { target: "CCC", kind: "vassal" }));
    assert.equal(game.state.countries.CCC.subjectKind, "vassal");
    assert.match(refused(game, cmd("BBB", "demandSubject", { target: "CCC", kind: "vassal" })), /already a subject/);
    assert.match(refused(game, cmd("AAA", "demandSubject", { target: "DDD", kind: "king" })), /vassal or a protectorate/);
    order(game, cmd("AAA", "declareWar", { target: "DDD" }));
    assert.match(refused(game, cmd("AAA", "demandSubject", { target: "DDD", kind: "vassal" })), /while at war/);
});

test("the Empire: demanded once, ever, with enough settlements inside it; those that join become protectorates, the rest form the League", () => {
    const make = (seed, humans = []) => tinyGame(seed, (sc) => { for (const s of sc.settlements) s.hre = true; sc.empire = { needed: 3 }; }, humans);
    const game = make(1);
    assert.deepEqual(germanStates(game), ["AAA", "BBB", "CCC", "DDD", "EEE"]);
    assert.match(refused(tinyGame(1), cmd("AAA", "proposeEmpire")), /no plain proposal/);
    assert.match(refused(game, cmd("BBB", "proposeEmpire")), /at least 3 settlements inside the Empire; you hold 2/);
    // over many games the shares are about what the rules say: CCC, DDD, EEE ~40% (size 4), BBB ~12%
    const joined = { BBB: 0, CCC: 0, DDD: 0, EEE: 0 };
    for (let seed = 1; seed <= 100; seed++) {
        const g = make(seed);
        const events = order(g, cmd("AAA", "proposeEmpire"));
        const members = Object.keys(joined).filter((c) => g.state.countries[c].overlord === "AAA");
        for (const c of members) { joined[c]++; assert.equal(g.state.countries[c].subjectKind, "protectorate"); }
        const refusers = Object.keys(joined).filter((c) => !members.includes(c));
        for (const x of refusers) for (const y of refusers) if (x < y) assert.ok(hasAgreement(g.state, "defensive", x, y), `${x} and ${y} refused and are not in the League`);
        assert.equal(ofType(events, "empire")[0].joined, members.length);
        assert.match(refused(g, cmd("AAA", "proposeEmpire")), /only once, ever/);
        assert.equal(g.state.countries.AAA.warmonger, 0);                      // subjects it brings add nothing to the warmonger score
    }
    assert.ok(joined.CCC > 20 && joined.CCC < 60 && joined.EEE > 20 && joined.EEE < 60, JSON.stringify(joined));
    assert.ok(joined.BBB < 30, JSON.stringify(joined));
});

test("a human state asked to join the Empire answers; a refusal, or none in 6 months, joins the League", () => {
    const make = () => tinyGame(3, (sc) => { for (const s of sc.settlements) s.hre = true; sc.empire = { needed: 3 }; }, ["DDD"]);
    let game = make();
    order(game, cmd("AAA", "proposeEmpire"));
    assert.equal(game.state.offers.filter((o) => o.kind === "empire" && o.to === "DDD").length, 1);
    const id = game.state.offers[0].id;
    order(game, cmd("DDD", "answerOffer", { id, accept: true }));
    assert.equal(game.state.countries.DDD.overlord, "AAA");
    game = make();
    order(game, cmd("AAA", "proposeEmpire"));
    const refusers = [...game.state.memory.empire.AAA.league];
    order(game, cmd("DDD", "answerOffer", { id: game.state.offers[0].id, accept: false }));
    for (const r of refusers) assert.ok(hasAgreement(game.state, "defensive", "DDD", r));
    game = make();
    order(game, cmd("AAA", "proposeEmpire"));
    const lapsed = runTo(game, 183);
    assert.deepEqual(ofType(lapsed, "lapsed").map((e) => e.kind), ["empire"]);
});

test("the League allies no two members at war with each other, nor a vassal, nor a country that is out", () => {
    const game = tinyGame();
    order(game, cmd("CCC", "declareWar", { target: "EEE" }));
    game.state.countries.BBB.overlord = "AAA";
    game.state.countries.BBB.subjectKind = "vassal";
    const events = [];
    formLeague(game, ["BBB", "CCC", "DDD", "EEE"], events);
    assert.ok(hasAgreement(game.state, "defensive", "CCC", "DDD") && hasAgreement(game.state, "defensive", "DDD", "EEE"));
    assert.ok(!hasAgreement(game.state, "defensive", "CCC", "EEE"), "at war: no alliance");
    assert.ok(!game.state.agreements.some((x) => x.a === "BBB" || x.b === "BBB"), "a vassal makes none");
    assert.deepEqual(ofType(events, "league")[0].members, ["CCC", "DDD", "EEE"]);
    // a human's refusal months later: a refuser now at war with it gets no alliance with it
    const g = tinyGame(3, (sc) => { for (const s of sc.settlements) s.hre = true; sc.empire = { needed: 3 }; }, ["DDD"]);
    order(g, cmd("AAA", "proposeEmpire"));
    const [foe, ...rest] = g.state.memory.empire.AAA.league;
    order(g, cmd(foe, "declareWar", { target: "DDD" }));
    order(g, cmd("DDD", "answerOffer", { id: g.state.offers.find((o) => o.kind === "empire").id, accept: false }));
    assert.ok(!hasAgreement(g.state, "defensive", foe, "DDD"));
    for (const r of rest) if (!atWar(g.state, r, "DDD")) assert.ok(hasAgreement(g.state, "defensive", r, "DDD"));
});

test("each year the warmonger score falls by 2, and computer countries bordering a warmonger of 30 or more ally against it", () => {
    const game = tinyGame();
    game.state.countries.BBB.warmonger = 40;
    game.state.countries.AAA.warmonger = 1;
    const events = runTo(game, 365);
    assert.deepEqual([game.state.countries.BBB.warmonger, game.state.countries.AAA.warmonger], [38, 0]);
    // AAA and CCC both border BBB; CCC's need is 20 for BBB's size and 20 for the warmonger: well over the bar
    assert.ok(hasAgreement(game.state, "defensive", "AAA", "CCC"));
    assert.deepEqual(ofType(events, "agreement").map((e) => [e.kind, e.why]).filter((x) => x[1] === "against BBB").length > 0, true);
    // no alliance forms against a warmonger under 30, nor with a human or a vassal
    const quiet = tinyGame();
    quiet.state.countries.BBB.warmonger = 31;                                   // 29 after the year's fall
    runTo(quiet, 365);
    assert.equal(hasAgreement(quiet.state, "defensive", "AAA", "CCC"), false);
    const humans = tinyGame(1, () => {}, ["CCC"]);
    humans.state.countries.BBB.warmonger = 40;
    runTo(humans, 365);
    assert.equal(hasAgreement(humans.state, "defensive", "AAA", "CCC"), false);
});

test("a coalition's alliances lapse when the warmonger they were made against is one no more, or is out of the game", () => {
    const game = tinyGame();
    game.state.countries.BBB.warmonger = 40;
    runTo(game, 365);
    const coalition = game.state.agreements.find((x) => x.kind === "defensive" && x.a === "AAA" && x.b === "CCC");
    assert.equal(coalition?.against, "BBB", "AAA and CCC ally against BBB");
    addAgreement(game, "defensive", "DDD", "EEE");                              // an alliance of their own, against nobody
    // BBB keeps the peace: its score falls under 30 by the start of a year, and the coalition lapses then — not before
    game.state.countries.BBB.warmonger = 31;
    runTo(game, 2 * 365 - 1);
    assert.ok(hasAgreement(game.state, "defensive", "AAA", "CCC"), "still standing during the year");
    const events = runTo(game, 2 * 365);
    assert.equal(hasAgreement(game.state, "defensive", "AAA", "CCC"), false);
    assert.deepEqual(ofType(events, "expired").map((e) => [e.a, e.b, e.against]), [["AAA", "CCC", "BBB"]]);
    assert.ok(hasAgreement(game.state, "defensive", "DDD", "EEE"), "an ordinary alliance does not lapse");
    // a warmonger that is eliminated takes its coalitions with it, at once
    const out = tinyGame();
    out.state.countries.BBB.warmonger = 60;
    runTo(out, 365);
    assert.ok(hasAgreement(out.state, "defensive", "AAA", "CCC"));
    for (const id of [4, 5]) { out.state.settlements[id].owner = "AAA"; delete out.state.armies[id]; }
    const gone = runTo(out, 366);
    assert.ok(ofType(gone, "eliminated").some((e) => e.country === "BBB"));
    assert.equal(hasAgreement(out.state, "defensive", "AAA", "CCC"), false);
});

test("winning: the settlements held and vassalized, protectorates half; the end year goes to the most, then the most people", () => {
    const game = tinyGame(1, (sc) => { sc.victory = { settlements: 5, endYear: 1500 }; });
    setSubject(game, "EEE", "AAA", "protectorate", []);
    setSubject(game, "CCC", "AAA", "vassal", []);
    near(scores(game.state).AAA.settlements, 3 + 0.5 + 1);
    near(scores(game.state).AAA.pop, 40000 + 10000 + 10000);
    assert.equal(game.state.winner, null);
    game.state.settlements[5].owner = "AAA";                                    // a fifth settlement: 5.5 counted
    const events = runTo(game, 1);
    assert.deepEqual(ofType(events, "victory").map((e) => [e.country, e.settlements, e.why]), [["AAA", 5.5, "reached"]]);
    assert.equal(game.state.winner, "AAA");
    // the game is over: time stands still and nothing is accepted
    assert.deepEqual([game.advance(), game.day], [[], 1]);
    assert.match(refused(game, cmd("BBB", "setTax", { tax: 2.5 })), /game is over/);
});

test("at the end date the most settlements win, a tie going to the larger population", () => {
    const game = tinyGame(1, (sc) => { sc.victory = { settlements: 99, endYear: 1441 }; });
    const events = runTo(game, 365);
    assert.deepEqual(ofType(events, "victory").map((e) => [e.country, e.why]), [["AAA", "end"]]);       // 3 settlements: the most
    const tie = tinyGame(1, (sc) => { sc.victory = { settlements: 99, endYear: 1441 }; });
    for (const id of [1, 2, 3]) tie.state.settlements[id].owner = id === 1 ? "BBB" : "AAA";
    // AAA: 2 settlements; BBB: 3 (1, 4, 5): BBB wins
    runTo(tie, 365);
    assert.equal(tie.state.winner, "BBB");
    const pop = tinyGame(1, (sc) => { sc.victory = { settlements: 99, endYear: 1441 }; });
    Object.assign(pop.state.settlements[1], { owner: "CCC" });
    Object.assign(pop.state.settlements[2], { owner: "DDD" });
    Object.assign(pop.state.settlements[3], { owner: "EEE" });                  // AAA has none; BBB, CCC, DDD and EEE hold two each
    pop.state.settlements[1].pop = 25000;                                       // CCC (1 and 6) has 35,000 people; BBB 30,000, DDD and EEE 20,000
    runTo(pop, 365);
    assert.equal(pop.state.winner, "CCC");
});
