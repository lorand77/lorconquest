// Subjects and tribute, demands, the Empire, coalitions and victory (RULES.md §10; SCENARIO.md, Victory) on the tiny
// map (see diplomacy.test.js for who is who). BBB's money a year is 51,600 (28,800 civilians × 2 less 1,200 × 5), AAA's
// 68,800, CCC's 17,200.
import test from "node:test";
import assert from "node:assert/strict";
import { addAgreement, formLeague, setSubject, warJoiners } from "../../src/engine/diplomacy.js";
import { INTEGRATE_DAYS, atWar, demandChance, subjectChance, economyOf, germanStates, hasAgreement, opinion, scores, wouldCycle } from "../../src/engine/index.js";
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
    near(a.moneyPerYear, 78800 + 20640);                                       // no tribute on BBB's capital's 10,000
    near(b.moneyPerYear, 61600 - 20640);
    near(a.rPerYear, 99440 + 10000);                                            // tribute received is investable: slider 50%
    game.state.countries.BBB.subjectKind = "protectorate";
    near(economyOf(game, "AAA").moneyPerYear, 78800 + 5160);
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
    near(b.moneyPerYear, 61600 + 6880 - 20640);
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

test("a rival never agrees to be your subject, nor anyone to one at 75% of victory or whom it would carry there; a yes adds warmonger", () => {
    // (with a road from 2 to 6, AAA borders CCC: a subject is demanded only of a neighbour)
    const game = neighbours(1, (sc) => { sc.rivalries = [["AAA", "DDD"]]; sc.victory.settlements = 5; }), st = game.state;
    assert.deepEqual(subjectChance(game, "DDD", "AAA", "protectorate"), { chance: 0, opinion: opinion(game, "DDD", "AAA"), why: "rival" });
    assert.ok(demandChance(game, "DDD", "AAA", "protectorate").chance > 0, "which the plain formula (the Empire's vote) does not ask");
    // AAA holds 3 of the 5 that win (60%): CCC as a vassal makes 4, BBB's 2 as a vassal would make 5, as a protectorate 4
    assert.equal(subjectChance(game, "CCC", "AAA", "vassal").chance, demandChance(game, "CCC", "AAA", "vassal").chance);
    assert.deepEqual(["why", "count", "target"].map((k) => subjectChance(game, "BBB", "AAA", "vassal")[k]), ["victory", 3, 5]);
    assert.ok(subjectChance(game, "BBB", "AAA", "protectorate").chance > 0);
    rigRoll(game, 1, true);
    order(game, cmd("AAA", "demandSubject", { target: "CCC", kind: "vassal" }));
    assert.deepEqual([st.countries.CCC.overlord, st.countries.AAA.warmonger], ["AAA", 5], "a vassal on demand: +5");
    // now 4 of 5: at 75%, nobody agrees
    assert.deepEqual(["chance", "why", "count"].map((k) => subjectChance(game, "BBB", "AAA", "protectorate")[k]), [0, "victory", 4]);
    rigRoll(game, 1, true);
    order(game, cmd("AAA", "demandSubject", { target: "BBB", kind: "protectorate" }));
    assert.equal(st.countries.BBB.overlord, null);
    // a person asked answers for itself; a yes adds to the warmonger score all the same
    const human = neighbours(1, () => {}, ["CCC"]);
    order(human, cmd("AAA", "demandSubject", { target: "CCC", kind: "protectorate" }));
    order(human, cmd("CCC", "answerOffer", { id: human.state.offers[0].id, accept: true }));
    assert.deepEqual([human.state.countries.CCC.subjectKind, human.state.countries.AAA.warmonger], ["protectorate", 2.5]);
});

test("a demand to a computer is rolled once; a refusal is remembered 10 years and cannot be repeated for 5", () => {
    const game = neighbours();                                                  // AAA borders CCC by the road from 2 to 6
    rigRoll(game, 20, false);                                                   // a roll of 20 or more: CCC refuses a vassal (20%)
    let events = order(game, cmd("AAA", "demandSubject", { target: "CCC", kind: "vassal" }));
    assert.deepEqual([ofType(events, "refused").length, ofType(events, "answer").length], [1, 0]);
    assert.equal(game.state.countries.CCC.overlord, null);
    assert.equal(game.state.memory.refused["CCC>AAA"], 0);
    near(opinion(game, "CCC", "AAA"), -45);                                    // refused you: −30; neighbours: −15
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

test("the Empire near victory: once the proposer holds three quarters of the number that wins, the rest refuse unrolled and join the League", () => {
    const make = (seed, target) => tinyGame(seed, (sc) => { for (const x of sc.settlements) x.hre = true; sc.empire = { needed: 3 }; sc.victory.settlements = target; });
    // AAA holds 3: at 4 it is at three quarters already — nobody joins, all four are the League
    const g = make(1, 4), events = order(g, cmd("AAA", "proposeEmpire"));
    assert.equal(ofType(events, "empire")[0].joined, 0);
    assert.ok(hasAgreement(g.state, "defensive", "BBB", "EEE"));
    // at 5 the line is 3.75: two protectorates of one settlement each (half apiece) take AAA to 4, and the rest refuse
    let most = 0;
    for (let seed = 1; seed <= 60; seed++) {
        const h = make(seed, 5);
        order(h, cmd("AAA", "proposeEmpire"));
        const members = ["BBB", "CCC", "DDD", "EEE"].filter((c) => h.state.countries[c].overlord === "AAA");
        most = Math.max(most, members.length);
        assert.ok(scores(h.state).AAA.settlements <= 4, `seed ${seed}: ${members}`);
    }
    assert.equal(most, 2, "two join at most, and sometimes two do");
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
    // a state that became someone's subject while asked: its yes changes nothing (a vassal of the proposer stays a vassal)
    game = make();
    order(game, cmd("AAA", "proposeEmpire"));
    game.state.countries.DDD.overlord = "AAA";
    game.state.countries.DDD.subjectKind = "vassal";
    order(game, cmd("DDD", "answerOffer", { id: game.state.offers.find((o) => o.kind === "empire").id, accept: true }));
    assert.equal(game.state.countries.DDD.subjectKind, "vassal");
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

// a road from 2 to 6: AAA and CCC, who both border BBB, border each other too — as the members of a coalition must
const road = (sc) => { sc.routes.push({ id: "route-2-6", from: 2, to: 6, type: "land", length: 0, crossesRiver: false, seaZone: null, points: [], pass: null, years: 0.2, legs: null }); };
const neighbours = (seed = 1, change = () => {}, humans = []) => tinyGame(seed, (sc) => { road(sc); change(sc); }, humans);

test("each year the warmonger score falls by 2, and computer countries bordering a warmonger of 30 or more ally against it", () => {
    const game = neighbours();
    game.state.countries.BBB.warmonger = 40;
    game.state.countries.AAA.warmonger = 1;
    const events = runTo(game, 365);
    assert.deepEqual([game.state.countries.BBB.warmonger, game.state.countries.AAA.warmonger], [38, 0]);
    // AAA and CCC both border BBB; CCC's need is 20 for BBB's size and 20 for the warmonger: well over the bar
    assert.ok(hasAgreement(game.state, "defensive", "AAA", "CCC"));
    assert.deepEqual(ofType(events, "agreement").map((e) => [e.kind, e.why]).filter((x) => x[1] === "against BBB").length > 0, true);
    // no alliance forms against a warmonger under 30, nor with a human or a vassal
    const quiet = neighbours();
    quiet.state.countries.BBB.warmonger = 31;                                   // 29 after the year's fall
    runTo(quiet, 365);
    assert.equal(hasAgreement(quiet.state, "defensive", "AAA", "CCC"), false);
    const humans = neighbours(1, () => {}, ["CCC"]);
    humans.state.countries.BBB.warmonger = 40;
    runTo(humans, 365);
    assert.equal(hasAgreement(humans.state, "defensive", "AAA", "CCC"), false);
});

test("a coalition's alliances lapse when the warmonger they were made against is one no more, or is out of the game", () => {
    const game = neighbours();
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
    const out = neighbours();
    out.state.countries.BBB.warmonger = 60;
    runTo(out, 365);
    assert.ok(hasAgreement(out.state, "defensive", "AAA", "CCC"));
    for (const id of [4, 5]) { out.state.settlements[id].owner = "AAA"; delete out.state.armies[id]; }
    const gone = runTo(out, 366);
    assert.ok(ofType(gone, "eliminated").some((e) => e.country === "BBB"));
    assert.equal(hasAgreement(out.state, "defensive", "AAA", "CCC"), false);
});

test("a coalition: only of countries that border each other, never across faiths at −20 or worse, and only against its warmonger", () => {
    // without the road AAA and CCC both border BBB, but not each other: no coalition
    const apart = tinyGame();
    apart.state.countries.BBB.warmonger = 40;
    runTo(apart, 365);
    assert.equal(hasAgreement(apart.state, "defensive", "AAA", "CCC"), false);
    // Catholic AAA and Sunni CCC: none either
    const faiths = neighbours(1, (sc) => { for (const c of sc.countries) c.religion = c.code === "CCC" ? "sunni" : "catholic"; });
    faiths.state.countries.BBB.warmonger = 40;
    runTo(faiths, 365);
    assert.equal(hasAgreement(faiths.state, "defensive", "AAA", "CCC"), false);
    // the coalition brings AAA in when BBB attacks CCC, not when DDD does
    const game = neighbours();
    game.state.countries.BBB.warmonger = 40;
    runTo(game, 365);
    assert.ok(hasAgreement(game.state, "defensive", "AAA", "CCC"));
    assert.ok(warJoiners(game, "BBB", "CCC").auto.some(([c]) => c === "AAA"), "against the warmonger: AAA joins");
    assert.ok(!warJoiners(game, "DDD", "CCC").auto.some(([c]) => c === "AAA"), "against anyone else: CCC stands alone");
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

test("integration: a vassal of 15 years, neither at war, for a courthouse a settlement — its land core, its forces and money the overlord's", () => {
    const make = (humans = []) => {
        const game = tinyGame(1, () => {}, humans);
        setSubject(game, "BBB", "AAA", "vassal", []);
        return game;
    };
    let game = make();
    const b = game.state.countries.BBB, a = game.state.countries.AAA;
    assert.equal(b.vassalSince, 0);
    assert.match(refused(game, cmd("AAA", "integrate", { target: "BBB" })), /after 15 years: BBB on 1 January 1455/);
    assert.match(refused(game, cmd("AAA", "integrate", { target: "CCC" })), /CCC is not your vassal/);
    game.state.day = INTEGRATE_DAYS;
    a.treasury = 99999;
    assert.match(refused(game, cmd("AAA", "integrate", { target: "BBB" })), /costs 100,000/);
    a.treasury = 200000;
    b.treasury = 30000;
    b.loans = 5000;
    const events = order(game, cmd("AAA", "integrate", { target: "BBB" }));
    assert.deepEqual(ofType(events, "integrated")[0], { type: "integrated", day: INTEGRATE_DAYS, country: "AAA", subject: "BBB", settlements: 2 });
    assert.equal(ofType(events, "eliminated").length, 0, "integrated, not eliminated");
    for (const id of [4, 5]) {
        assert.equal(game.state.settlements[id].owner, "AAA");
        assert.ok(game.state.settlements[id].cores.includes("AAA"));
        assert.equal(game.state.armies[id].owner, "AAA", "its garrisons are the overlord's now");
    }
    assert.deepEqual([a.treasury, a.loans, a.warmonger, b.out, b.overlord], [200000 - 100000 + 30000, 5000, 2, INTEGRATE_DAYS, null]);
    // not while at war
    game = make();
    game.state.day = INTEGRATE_DAYS;
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.match(refused(game, cmd("AAA", "integrate", { target: "BBB" })), /not while either of you is at war/);
    // the peasants of another country do not count; one's own, or the vassal's, do
    const peasants = (of) => {
        const g = make();
        g.state.day = INTEGRATE_DAYS;
        g.state.countries.AAA.treasury = 200000;
        g.state.countries.R1 = { code: "R1", name: `Rebels of ${of}`, capital: null, rebel: true, of, treasury: 0, overlord: null, subjectKind: null, out: null };
        g.state.wars.push("AAA|R1");
        return g;
    };
    assert.equal(peasants("CCC").command(cmd("AAA", "integrate", { target: "BBB" })).ok, true, "CCC's peasants, at war with AAA, are no bar");
    assert.match(refused(peasants("AAA"), cmd("AAA", "integrate", { target: "BBB" })), /your own peasants are up in arms/);
    assert.match(refused(peasants("BBB"), cmd("AAA", "integrate", { target: "BBB" })), /your own peasants are up in arms/);
    // a person's vassal is asked, and their yes integrates them
    game = make(["BBB"]);
    game.state.day = INTEGRATE_DAYS;
    game.state.countries.AAA.treasury = 200000;
    order(game, cmd("AAA", "integrate", { target: "BBB" }));
    assert.match(refused(game, cmd("AAA", "integrate", { target: "BBB" })), /asked BBB already/);
    const offer = game.state.offers.find((o) => o.kind === "integrate");
    assert.equal(game.state.countries.BBB.out, null);
    order(game, cmd("BBB", "answerOffer", { id: offer.id, accept: true }));
    assert.equal(game.state.countries.BBB.out, INTEGRATE_DAYS);
});

test("the Empire: a state at war with the proposer refuses and joins the League — a person too, even with a yes; `joined` counts only the new", () => {
    const make = (humans = []) => tinyGame(1, (sc) => { for (const s of sc.settlements) s.hre = true; sc.empire = { needed: 3 }; }, humans);
    for (let seed = 1; seed <= 20; seed++) {
        const g = make();
        g.state.rng = seed;
        setSubject(g, "EEE", "AAA", "protectorate", []);                     // a subject it had already
        order(g, cmd("AAA", "declareWar", { target: "BBB" }));
        const events = order(g, cmd("AAA", "proposeEmpire"));
        assert.ok(atWar(g.state, "AAA", "BBB") && g.state.countries.BBB.overlord === null, "joining is no way out of a war");
        assert.ok(g.state.memory.empire.AAA.league.includes("BBB"));
        const now = ["CCC", "DDD"].filter((c) => g.state.countries[c].overlord === "AAA").length;
        assert.equal(ofType(events, "empire")[0].joined, now, "EEE was a subject before");
    }
    // a person asked, at war with the proposer by the time they answer: their yes is a refusal
    const g = make(["DDD"]);
    g.state.countries.AAA.treasury = 1e9;
    order(g, cmd("AAA", "proposeEmpire"));
    const offer = g.state.offers.find((o) => o.kind === "empire" && o.to === "DDD");
    order(g, cmd("AAA", "declareWar", { target: "DDD" }));
    order(g, cmd("DDD", "answerOffer", { id: offer.id, accept: true }));
    assert.equal(g.state.countries.DDD.overlord, null);
    assert.ok(g.state.memory.empire.AAA.league.includes("DDD"));
});

test("found by review: a vassal's own wars end and none is declared on it; peace terms by number; stale questions; one question at a time", () => {
    // becoming a vassal ends its wars with anyone its overlord is not fighting; a war on a vassal is declared on its overlord
    let game = tinyGame();
    order(game, cmd("DDD", "declareWar", { target: "CCC" }));
    setSubject(game, "CCC", "BBB", "vassal", []);
    assert.ok(!atWar(game.state, "CCC", "DDD"), "nobody could ever have ended that war");
    assert.match(refused(game, cmd("DDD", "declareWar", { target: "CCC" })), /CCC is a vassal of BBB: its overlord answers for it/);
    // "2" and 2 are the same settlement
    game = tinyGame();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.match(refused(game, cmd("AAA", "proposePeace", { with: "BBB", terms: { give: [2, "2"] } })), /give names settlements by their numbers/);
    // a call to arms answered after its war ended joins nothing
    game = tinyGame(1, () => {}, ["AAA"]);
    addAgreement(game, "military", "AAA", "BBB");
    order(game, cmd("BBB", "declareWar", { target: "CCC" }));
    const call = game.state.offers.find((o) => o.kind === "call");
    game.state.wars = game.state.wars.filter((w) => w !== "BBB|CCC");
    order(game, cmd("AAA", "answerOffer", { id: call.id, accept: true }));
    assert.ok(!atWar(game.state, "AAA", "CCC"));
    // a person is asked one thing of a kind at a time; a demand accepted while at war is a refusal
    game = tinyGame(1, () => {}, ["BBB"]);
    order(game, cmd("AAA", "demandSubject", { target: "BBB", kind: "protectorate" }));
    assert.match(refused(game, cmd("AAA", "demandSubject", { target: "BBB", kind: "protectorate" })), /asked BBB already/);
    order(game, cmd("BBB", "declareWar", { target: "AAA" }));
    order(game, cmd("BBB", "answerOffer", { id: game.state.offers.find((o) => o.kind === "demand").id, accept: true }));
    assert.ok(atWar(game.state, "AAA", "BBB") && game.state.countries.BBB.overlord === null, "a yes is no way out of a war");
});

test("winning with subjects: a chain counts to the top; a subject and its overlord reaching it the same day — the most settlements wins", () => {
    const strong = (g, army) => setArmy(g, army, { swords: 50000 });          // or the subject breaks free first
    const make = (target) => tinyGame(1, (sc) => { sc.victory = { settlements: target, endYear: 1500 }; });
    const sub = (g, c, o, kind) => Object.assign(g.state.countries[c], { overlord: o, subjectKind: kind });
    // CCC vassal of BBB, BBB vassal of AAA: AAA counts 3 + 2 + 1
    let g = make(6);
    strong(g, 1);
    sub(g, "BBB", "AAA", "vassal");
    sub(g, "CCC", "BBB", "vassal");
    assert.deepEqual([scores(g.state).AAA.settlements, scores(g.state).BBB.settlements], [6, 3]);
    assert.equal(ofType(g.advance(), "victory")[0]?.country, "AAA");
    // a protectorate's vassal counts ½ for the top
    g = make(99);
    sub(g, "BBB", "AAA", "protectorate");
    sub(g, "CCC", "BBB", "vassal");
    assert.equal(scores(g.state).AAA.settlements, 3 + 1 + 0.5);
    // AAA (3) protectorate of CCC (1 + 1½): both have 2 — the protectorate, with more, wins; a vassal never beats its overlord
    g = make(2);
    strong(g, 6);
    sub(g, "AAA", "CCC", "protectorate");
    assert.equal(ofType(g.advance(), "victory")[0]?.country, "AAA");
    g = make(2);
    strong(g, 6);
    sub(g, "AAA", "CCC", "vassal");
    assert.equal(ofType(g.advance(), "victory")[0]?.country, "CCC");
});

test("a war joined by choice: an overlord joins its protectorate's, a protectorate its overlord's — on its side, a pact with the enemy broken", () => {
    const game = tinyGame(), st = game.state;
    Object.assign(st.countries.CCC, { overlord: "AAA", subjectKind: "protectorate" });
    assert.match(refused(game, cmd("AAA", "joinWar", { ally: "CCC", enemy: "BBB" })), /CCC is not at war with BBB/);
    order(game, cmd("BBB", "declareWar", { target: "CCC" }));
    assert.equal(atWar(st, "AAA", "BBB"), false, "a protectorate's war is not its overlord's");
    addAgreement(game, "pact", "AAA", "BBB", 3650);
    const before = st.countries.AAA.warmonger;
    const events = order(game, cmd("AAA", "joinWar", { ally: "CCC", enemy: "BBB" }));
    assert.ok(atWar(st, "AAA", "BBB"));
    assert.deepEqual(ofType(events, "joins").map((e) => [e.country, e.enemy, e.side]), [["AAA", "BBB", "def"]], "on the defending side: CCC was attacked");
    assert.equal(st.countries.AAA.warmonger, before, "no declarer's score");
    assert.equal(hasAgreement(st, "pact", "AAA", "BBB"), false);
    assert.equal(st.memory.broke.AAA, st.day, "fighting one it had a pact with breaks the pact");
    assert.match(refused(game, cmd("AAA", "joinWar", { ally: "CCC", enemy: "BBB" })), /at war with BBB already/);
    assert.match(refused(game, cmd("AAA", "joinWar", { ally: "DDD", enemy: "BBB" })), /not your protectorate/);
    // the other way: the protectorate joins a war its overlord began, on the attacking side
    order(game, cmd("AAA", "declareWar", { target: "DDD" }));
    order(game, cmd("CCC", "joinWar", { ally: "AAA", enemy: "DDD" }));
    assert.ok(atWar(st, "CCC", "DDD"));
    assert.equal(st.warInfo[["CCC", "DDD"].sort().join("|")].attacker, "CCC");
    // a vassal has no such choice: it is in its overlord's wars already, and has no diplomacy
    st.countries.CCC.subjectKind = "vassal";
    assert.match(refused(game, cmd("CCC", "joinWar", { ally: "AAA", enemy: "EEE" })), /no diplomacy/);
});

test("a subject's price in a peace grows with its size, twice for a rival; a vassal of another faith takes longer to integrate", async () => {
    const { peaceCost, integrateDays } = await import("../../src/engine/index.js");
    const rivals = tinyGame(1, (sc) => { sc.rivalries = [["AAA", "BBB"]]; }), plain = tinyGame();
    for (const g of [rivals, plain]) order(g, cmd("AAA", "declareWar", { target: "BBB" }));
    // BBB, 2 settlements, under AAA, 3: × (1 + 2/3); a rival twice that
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
    near(peaceCost(plain, "AAA", "BBB", { makeSubject: "vassal" }), 50 * 5 / 3);
    near(peaceCost(rivals, "AAA", "BBB", { makeSubject: "vassal" }), 100 * 5 / 3);
    near(peaceCost(rivals, "AAA", "BBB", { makeSubject: "protectorate" }), 50 * 5 / 3);
    // a one-town country (DDD, 1) under AAA: little more than the base; AAA under one-town DDD: four times it
    order(plain, cmd("AAA", "declareWar", { target: "DDD" }));
    near(peaceCost(plain, "AAA", "DDD", { makeSubject: "vassal" }), 50 * (1 + 1 / 3));
    near(peaceCost(plain, "DDD", "AAA", { makeSubject: "vassal" }), 50 * (1 + 3 / 1));
    // 15 years for the same faith (or none), × (1 + the gap): 21 for Catholic over Orthodox, 30 for Catholic over Sunni
    const faiths = tinyGame(1, (sc) => { for (const c of sc.countries) c.religion = { AAA: "catholic", BBB: "sunni", CCC: "orthodox" }[c.code] ?? "catholic"; });
    assert.deepEqual(["BBB", "CCC", "EEE"].map((c) => integrateDays(faiths, "AAA", c) / 365), [30, 21, 15]);
    assert.equal(integrateDays(plain, "AAA", "BBB"), INTEGRATE_DAYS);
});

test("a demand only of a neighbour; a subject's warmonger by its size; a peace hands over only what is within reach, and makes a subject only of a neighbour", async () => {
    const { outOfReach, subjectWarmonger, validateTerms } = await import("../../src/engine/diplomacy.js");
    // AAA borders BBB by land and CCC across the strait 3-6: it may ask either; EEE (only next to DDD) it may not
    const game = tinyGame(), st = game.state;
    assert.match(refused(game, cmd("AAA", "demandSubject", { target: "EEE", kind: "protectorate" })), /borders neither you nor your subjects/);
    const across = game.command(cmd("AAA", "demandSubject", { target: "CCC", kind: "protectorate" }));
    assert.ok(across.ok, across.error);
    // DDD borders CCC (6-7): once CCC is AAA's subject — made so here — AAA reaches DDD through it
    assert.match(refused(game, cmd("AAA", "demandSubject", { target: "DDD", kind: "protectorate" })), /borders neither/);
    if (!st.countries.CCC.overlord) setSubject(game, "CCC", "AAA", "protectorate", []);
    const through = game.command(cmd("AAA", "demandSubject", { target: "DDD", kind: "protectorate" }));
    assert.ok(through.ok, through.error);
    // the warmonger of a subject: at least the flat 10, or half of taking it — BBB's 30,000 people: 15
    assert.equal(subjectWarmonger(game, "EEE", "vassal", 10), 10);
    assert.equal(subjectWarmonger(game, "BBB", "vassal", 10), 15);
    assert.equal(subjectWarmonger(game, "BBB", "protectorate", 10), 7.5);
    // a peace: EEE's settlement 8 is beyond AAA's reach (EEE borders only DDD); DDD's 7 borders CCC
    const g2 = tinyGame();
    order(g2, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual(outOfReach(g2, "AAA", [4, 5]), [], "5 borders 3 (by the pass); 4 borders 2");
    assert.deepEqual(outOfReach(g2, "CCC", [4]), [], "4 borders 6");
    assert.deepEqual(outOfReach(g2, "AAA", [7, 8]), [7, 8], "far off, and not joined to AAA through the peace");
    // One is a port, and Four is BBB's: a landing away, two zones, so within its reach (RULES.md §8, Sea lanes)
    assert.equal(validateTerms(g2, "BBB", "AAA", { take: [1] }), null);
    // nor is a subject made in a peace of a country out of reach, either way round; CCC, across the strait, may be
    const g3 = tinyGame();
    order(g3, cmd("AAA", "declareWar", { target: "EEE" }));
    order(g3, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.match(validateTerms(g3, "AAA", "EEE", { makeSubject: "protectorate" }), /EEE borders neither you nor your subjects/);
    assert.match(validateTerms(g3, "EEE", "AAA", { becomeSubject: "protectorate" }), /you border neither AAA nor its subjects/);
    assert.equal(validateTerms(g3, "AAA", "CCC", { makeSubject: "protectorate" }), null);
    assert.equal(validateTerms(g3, "CCC", "AAA", { becomeSubject: "protectorate" }), null);
    void st;
});

test("found by the fuzz: a vassal integrated while leftover peasants of a fallen country fight it is at war with nobody once out", async () => {
    const { integrate } = await import("../../src/engine/diplomacy.js");
    const game = tinyGame(), st = game.state;
    setSubject(game, "BBB", "AAA", "vassal", []);
    // a rebel band whose own country is gone: at war with every country still in the game (events.js, rebelWars)
    st.countries.REB1 = { ...st.countries.EEE, code: "REB1", name: "Peasants", rebel: true, of: "ZZZ" };
    st.wars.push("BBB|REB1");
    st.wars.sort();
    integrate(game, "AAA", "BBB", []);
    assert.equal(st.countries.BBB.out, st.day);
    assert.deepEqual(st.wars.filter((w) => w.split("|").includes("BBB")), []);
});

test("an overlord may turn on its own protectorate — the protection ends and it is a broken agreement — but not on its vassal", () => {
    const game = tinyGame(), st = game.state;
    setSubject(game, "BBB", "AAA", "protectorate", []);
    assert.match(refused(game, cmd("BBB", "declareWar", { target: "AAA" })), /does not make war on its overlord/);
    const events = order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.deepEqual([st.countries.BBB.overlord, atWar(st, "AAA", "BBB"), ofType(events, "betrayed").length, ofType(events, "broke").map((e) => e.country)], [null, true, 1, ["AAA"]]);
    const vassal = tinyGame();
    setSubject(vassal, "BBB", "AAA", "vassal", []);
    assert.match(refused(vassal, cmd("AAA", "declareWar", { target: "BBB" })), /integrated, not attacked/);
});

test("a broken agreement weighed by faith: 40 × (1 + regard for the victim's faith − regard for the betrayer's) ÷ 40, ×0 to ×2", async () => {
    const { betrayalPenalty } = await import("../../src/engine/index.js");
    // AAA Sunni turns on BBB, its Orthodox protectorate; CCC is Sunni, DDD Catholic, EEE Orthodox
    const faiths = { AAA: "sunni", BBB: "orthodox", CCC: "sunni", DDD: "catholic", EEE: "orthodox" };
    const game = tinyGame(1, (sc) => { for (const c of sc.countries) c.religion = faiths[c.code]; }), st = game.state;
    assert.deepEqual(["CCC", "DDD", "EEE"].map((c) => betrayalPenalty(game, c, "AAA", "BBB")), [5, 55, 75]);
    setSubject(game, "BBB", "AAA", "protectorate", []);
    const plain = { CCC: opinion(game, "CCC", "AAA"), EEE: opinion(game, "EEE", "AAA") };
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    st.countries.AAA.warmonger = 0;                                            // the declaration's +5 aside: the betrayal alone
    assert.equal(st.memory.betrayed.AAA, "BBB");
    near(opinion(game, "CCC", "AAA") - plain.CCC, -5);
    assert.ok(opinion(game, "EEE", "AAA") - plain.EEE <= -75);
    // no faiths: the plain 40
    assert.equal(betrayalPenalty(tinyGame(), "CCC", "AAA", "BBB"), 40);
});
