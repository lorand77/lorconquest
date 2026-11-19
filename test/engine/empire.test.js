// The Empire's crown (RULES.md §10, The Emperor; src/engine/empire.js) on the tiny map made an Empire: every settlement in it, AAA
// the Emperor, seven votes on settlements 2 to 8 — AAA holds two (2, 3), BBB two (4, 5), CCC, DDD and EEE one each. Only AAA (40,000
// people) and BBB (30,000) are big enough to stand.
import test from "node:test";
import assert from "node:assert/strict";
import { ELECTION_YEARS, YEAR_DAYS, candidatesOf, electorsOf, voteOf } from "../../src/engine/index.js";
import { tinyGame, runTo, order, refused } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const empire = (seed = 1, change = () => {}, humans = []) => tinyGame(seed, (sc) => {
    for (const s of sc.settlements) s.hre = true;
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
