// The Empire's crown (RULES.md §10, The Emperor; src/engine/empire.js) on the tiny map made an Empire: every settlement in it, AAA
// the Emperor, seven votes on settlements 2 to 8 — AAA holds two (2, 3), BBB two (4, 5), CCC, DDD and EEE one each. Two and Five are
// made a city's size, so that only AAA (50,000 people) and BBB (40,000) are big enough to stand, AAA the greater.
import test from "node:test";
import assert from "node:assert/strict";
import { ELECTION_YEARS, YEAR_DAYS, candidatesOf, electorsOf, voteOf } from "../../src/engine/index.js";
import { tinyGame, runTo, order, refused } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const empire = (seed = 1, change = () => {}, humans = []) => tinyGame(seed, (sc) => {
    for (const s of sc.settlements) s.hre = true;
    sc.settlements[1].pop = 20000;
    sc.settlements[4].pop = 20000;
    sc.empire = { emperor: "AAA", electors: [2, 3, 4, 5, 6, 7, 8].map((id) => ({ vote: `vote ${id}`, settlement: id })) };
    change(sc);
}, humans);
const votes = (game) => { const c = candidatesOf(game); return electorsOf(game).map((e) => voteOf(game, e, c)); };

test("the crown at the start, who stands, and how a computer elector votes: another it likes best, itself only crowned or greater", () => {
    const game = empire(), st = game.state;
    assert.deepEqual([st.empire.emperor, st.empire.next, st.empire.called], ["AAA", ELECTION_YEARS * YEAR_DAYS, false]);
    assert.deepEqual(candidatesOf(game), ["AAA", "BBB"]);
    // AAA crowned votes for itself; BBB, smaller than AAA, for AAA (the reigning Emperor's +20); the small three for AAA
    assert.deepEqual(votes(game), ["AAA", "AAA", "AAA", "AAA", "AAA", "AAA", "AAA"]);
    // at war with BBB, CCC's vote is not AAA's (−50); and no game without electors has a crown
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.equal(votes(game)[4], "BBB");
    assert.equal(tinyGame().state.empire, null);
});

test("an election called a year ahead, promises kept until it and paid whoever wins, the most votes crowned", () => {
    // the first election brought forward to a year and a month in, so that it is played to without 25 years of the tiny map
    const game = empire(), st = game.state, on = YEAR_DAYS + 30;
    st.empire.next = on;
    assert.match(refused(game, cmd("BBB", "promise", { elector: 6, money: 1000 })), /no election has been called/);
    const called = runTo(game, 30);
    assert.deepEqual(ofType(called, "electionCalled").map((e) => [e.day, e.on, e.candidates]), [[30, on, ["AAA", "BBB"]]]);
    assert.match(refused(game, cmd("CCC", "promise", { elector: 7, money: 1000 })), /you do not stand/);
    assert.match(refused(game, cmd("BBB", "promise", { elector: 4, money: 1000 })), /nobody else holds that vote/);
    assert.match(refused(game, cmd("BBB", "promise", { elector: 6, money: 1e9 })), /more than you hold/);
    // BBB buys the three small votes: 1 point for each 2,000, at most 30 — enough to outbid AAA's +20 as reigning Emperor
    st.countries.BBB.treasury = 1e6;
    for (const id of [6, 7, 8]) order(game, cmd("BBB", "promise", { elector: id, money: 30 * 2000 }));
    // DDD and EEE turn; CCC, BBB's neighbour (−15), likes AAA better still; BBB itself votes AAA, the greater
    assert.deepEqual(votes(game), ["AAA", "AAA", "AAA", "AAA", "AAA", "BBB", "BBB"]);
    runTo(game, on - 1);
    const before = { BBB: st.countries.BBB.treasury, CCC: st.countries.CCC.treasury };
    const held = runTo(game, on);
    const [e] = ofType(held, "elected");
    assert.deepEqual([e.country, e.previous, e.votes, e.why], ["AAA", "AAA", { AAA: 5, BBB: 2 }, "due"]);
    assert.ok(before.BBB - st.countries.BBB.treasury > 3 * 60000 - 20000, "BBB paid its three promises, though it lost (a day's money aside)");
    assert.ok(st.countries.CCC.treasury > before.CCC + 50000, "and CCC was paid, though it voted AAA");
    assert.deepEqual([st.empire.promises, st.empire.next], [{}, on + ELECTION_YEARS * YEAR_DAYS]);
});

test("a person's electors vote as the person chooses; a tie goes to the reigning Emperor; a throne vacant is filled at once", () => {
    const game = empire(1, () => {}, ["BBB"]), st = game.state;
    order(game, cmd("BBB", "electorVote", { candidate: "BBB" }));
    assert.match(refused(game, cmd("BBB", "electorVote", { candidate: "CCC" })), /does not stand/);
    assert.deepEqual(votes(game), ["AAA", "AAA", "BBB", "BBB", "AAA", "AAA", "AAA"]);
    // AAA loses every settlement of the Empire: the throne is vacant, and an election held the same day
    for (const id of [1, 2, 3]) st.settlements[id].owner = "BBB";
    const events = runTo(game, st.day + 1);
    assert.equal(ofType(events, "vacant")[0].country, "AAA");
    assert.deepEqual([ofType(events, "elected")[0].country, ofType(events, "elected")[0].why], ["BBB", "vacant"]);
});

test("another faith costs a candidate 20 with a computer elector", () => {
    const game = empire(1, (sc) => { for (const c of sc.countries) c.religion = c.code === "AAA" ? "hussite" : "catholic"; });
    // a Hussite Emperor: the small Catholic electors' votes now go to BBB, Catholic like them — AAA's +20 crowned no longer enough
    assert.deepEqual(votes(game).slice(4), ["BBB", "BBB", "BBB"]);
});

test("no majority of the votes cast: a second round between the two leaders, each elector choosing the one it scores higher", async () => {
    const { holdElection } = await import("../../src/engine/empire.js");
    // CCC made big enough to stand; BBB, CCC and DDD people, who choose: BBB and DDD for BBB, CCC for itself
    const game = empire(1, (sc) => { sc.settlements[5].pop = 40000; }, ["BBB", "CCC", "DDD"]), st = game.state;
    order(game, cmd("BBB", "electorVote", { candidate: "BBB" }));
    order(game, cmd("DDD", "electorVote", { candidate: "BBB" }));
    order(game, cmd("CCC", "electorVote", { candidate: "CCC" }));
    const events = [];
    holdElection(game, events, "due");
    const [e] = ofType(events, "elected");
    // the first round: AAA 3 (its two, and EEE's for the reigning Emperor), BBB 3, CCC 1 — no 4. The second, AAA against BBB: CCC's
    // own choice is out, and it scores AAA higher (BBB is its neighbour, −15)
    assert.deepEqual([e.votes, e.runoff, e.country], [{ AAA: 3, BBB: 3, CCC: 1 }, { AAA: 4, BBB: 3 }, "AAA"]);
    assert.deepEqual(st.empire.last.runoff, { AAA: 4, BBB: 3 });
    // a majority in the first round needs no second
    const plain = empire(), out = [];
    holdElection(plain, out, "due");
    assert.equal(ofType(out, "elected")[0].runoff, undefined);
});

// ---------- stage 2: Imperial Authority, Defender of the Empire, the free cities' dues ----------
// EEE made an outsider (its one town, 8, taken out of the Empire); CCC a free city
const outsider = (humans = []) => empire(1, (sc) => { sc.settlements[7].hre = false; sc.empire.freeCities = ["CCC"]; }, humans);

test("authority: 20 at the start, a German state's regard for the Emperor ÷ 5; a year of peace +1, a year of wars −1 for each", async () => {
    const { opinion } = await import("../../src/engine/index.js");
    const game = empire(), st = game.state;
    assert.equal(st.empire.authority, 20);
    const regard = (a) => { st.empire.authority = a; return opinion(game, "BBB", "AAA"); };
    assert.equal(regard(50) - regard(0), 10);
    assert.equal(regard(100) - regard(0), 20);
    st.empire.authority = 20;
    const year = runTo(game, 365);
    assert.deepEqual([st.empire.authority, ofType(year, "authority").map((e) => e.why)], [21, ["peace"]]);
    // three wars between German states (AAA, the Emperor, in none of them)
    order(game, cmd("BBB", "declareWar", { target: "CCC" }));
    order(game, cmd("DDD", "declareWar", { target: "EEE" }));
    order(game, cmd("CCC", "declareWar", { target: "DDD" }));
    runTo(game, 2 * 365);
    assert.equal(st.empire.authority, 18);
});

test("authority: the Emperor attacking a German state −15; the crown passing −10; never below 0 nor above 100", async () => {
    const { holdElection } = await import("../../src/engine/empire.js");
    const game = empire(1, () => {}, ["BBB"]), st = game.state;
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.equal(st.empire.authority, 5);
    // BBB, a person, votes itself — and so do DDD and EEE, made people for it: BBB crowned, the crown passing
    st.humans.push("DDD", "EEE");
    for (const c of ["BBB", "DDD", "EEE"]) st.empire.choices[c] = "BBB";
    st.empire.authority = 8;
    const events = [];
    holdElection(game, events, "due");
    assert.deepEqual([st.empire.emperor, st.empire.authority], ["BBB", 0], "−10, but not below 0");
});

test("Defender of the Empire: an outsider attacking a German state calls the Emperor in; a war won raises the crown, refusing lowers it", () => {
    const game = outsider(), st = game.state;
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    assert.equal(st.warInfo["AAA|EEE"]?.defender, true, "AAA, the Emperor and far the stronger, comes");
    // a peace it has not lost: +5
    order(game, cmd("EEE", "proposePeace", { with: "AAA" }));
    assert.equal(st.wars.includes("AAA|EEE"), false);
    assert.equal(st.empire.authority, 25);
    // bound to the attacker by a pact, a computer Emperor refuses: −10
    const bound = outsider(), s2 = bound.state;
    order(bound, cmd("AAA", "proposeAgreement", { with: "EEE", kind: "pact" }));
    const events = order(bound, cmd("EEE", "declareWar", { target: "DDD" }));
    assert.deepEqual([ofType(events, "defenderRefuses").length, s2.empire.authority, s2.wars.includes("AAA|EEE")], [1, 10, false]);
});

test("a person as Emperor is asked to defend the Empire: a refusal costs 10, a yes brings it in as defender", () => {
    const game = outsider(["AAA"]), st = game.state;
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    const call = st.offers.find((o) => o.kind === "call" && o.defender);
    assert.deepEqual([call.to, call.from, call.enemy], ["AAA", "DDD", "EEE"]);
    order(game, cmd("AAA", "answerOffer", { id: call.id, accept: false }));
    assert.equal(st.empire.authority, 10);
    const yes = outsider(["AAA"]);
    order(yes, cmd("EEE", "declareWar", { target: "DDD" }));
    order(yes, cmd("AAA", "answerOffer", { id: yes.state.offers.find((o) => o.defender).id, accept: true }));
    assert.equal(yes.state.warInfo["AAA|EEE"]?.defender, true);
});

test("an outsider keeping a German state's land of the Empire at a peace costs the crown 5 a settlement", async () => {
    const { capture } = await import("../../src/engine/fighting.js");
    const game = outsider(), st = game.state;
    st.agreements.push({ kind: "pact", a: "AAA", b: "EEE", until: 99999 });   // the Emperor stays out (and refuses: −10)
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    assert.equal(st.empire.authority, 10);
    st.settlements[1].owner = "DDD";                                           // DDD a second town, so that it may lose one
    capture(game, st.settlements[7], "EEE", [], "storm");                      // Seven, DDD's core, taken by EEE
    order(game, cmd("EEE", "proposePeace", { with: "DDD" }));                  // the winner keeps what it holds
    assert.equal(st.wars.includes("DDD|EEE"), false);
    assert.equal(st.empire.authority, 5);
});

test("the free cities' dues: 5% of a free city's money to the Emperor, as tribute, while the two are not at war", async () => {
    const { economyOf } = await import("../../src/engine/index.js");
    const game = outsider(), base = economyOf(game, "CCC").moneyPerYear + economyOf(game, "CCC").tributePaid;
    assert.ok(Math.abs(economyOf(game, "CCC").tributePaid - 0.05 * base) < 1e-6);
    const before = economyOf(game, "AAA").tributeReceived;
    assert.ok(Math.abs(before - 0.05 * base) < 1e-6, "the Emperor receives it");
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.deepEqual([economyOf(game, "CCC").tributePaid, economyOf(game, "AAA").tributeReceived], [0, 0], "not at war");
});
