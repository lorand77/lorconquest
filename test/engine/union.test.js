// A union of two people's countries (RULES.md §10, Union): proposed to the other person and answered, or lapsing as a no; the
// second country made part of the first at once, with all it had and its research; once in a game; never for a computer, a
// subject, at war with each other or with other enemies, nor near victory. On the tiny map, AAA and CCC played by people.
import test from "node:test";
import assert from "node:assert/strict";
import { economyOf, scores } from "../../src/engine/index.js";
import { order, refused, runTo, tinyGame } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const people = (seed = 1, change = () => {}) => tinyGame(seed, change, ["AAA", "CCC"]);
const answer = (game, accept = true) => {
    const offer = game.state.offers.find((o) => o.kind === "union");
    return order(game, cmd(offer.to, "answerOffer", { id: offer.id, accept }));
};

test("a union: asked, accepted, and the second country part of the first, with all it had", () => {
    const game = people(), st = game.state;
    st.countries.CCC.techs.push("handCannons");
    st.countries.CCC.treasury = 30000;
    const before = { treasury: st.countries.AAA.treasury, armies: Object.values(st.armies).filter((a) => a.owner === "CCC").map((a) => a.id) };
    const [offer] = order(game, cmd("AAA", "proposeUnion", { with: "CCC" }));
    assert.deepEqual([offer.type, offer.country, offer.from], ["offer", "CCC", "AAA"]);
    assert.match(refused(game, cmd("AAA", "proposeUnion", { with: "CCC" })), /asked CCC already/);
    const events = answer(game);
    const [u] = ofType(events, "union");
    assert.deepEqual([u.country, u.with, u.settlements], ["AAA", "CCC", 1]);
    assert.deepEqual([st.settlements[6].owner, st.settlements[6].cores.includes("AAA")], ["AAA", true], "core at once: it pays in full");
    assert.equal(st.countries.CCC.out, st.day, "out of the game, absorbed — not eliminated");
    assert.ok(before.armies.every((id) => st.armies[id].owner === "AAA"));
    assert.equal(st.countries.AAA.treasury, before.treasury + 30000);
    assert.ok(st.countries.AAA.techs.includes("handCannons"), "its research too");
    assert.equal(scores(st).AAA.settlements, 4);
    assert.equal(economyOf(game, "AAA").capitalMoney, 10000, "one capital: AAA's");
    assert.match(refused(game, cmd("AAA", "proposeUnion", { with: "CCC" })), /CCC is no more/);
    // once in a game: AAA, united, may not unite again with a third person's country
    const three = tinyGame(1, () => {}, ["AAA", "CCC", "EEE"]);
    order(three, cmd("AAA", "proposeUnion", { with: "CCC" }));
    answer(three);
    assert.match(refused(three, cmd("AAA", "proposeUnion", { with: "EEE" })), /unites once/);
});

test("a union is of people's countries at peace with each other, free, with the same enemies, and not near victory", () => {
    assert.match(refused(people(), cmd("AAA", "proposeUnion", { with: "BBB" })), /two countries played by people/);
    let game = people();
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.match(refused(game, cmd("AAA", "proposeUnion", { with: "CCC" })), /at war with each other/);
    game = people();
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    assert.match(refused(game, cmd("AAA", "proposeUnion", { with: "CCC" })), /same countries/);
    game = people();
    Object.assign(game.state.countries.CCC, { overlord: "DDD", subjectKind: "protectorate" });
    assert.match(refused(game, cmd("AAA", "proposeUnion", { with: "CCC" })), /subject/);
    // 3 and 1 of the 5 that win: 4 is past three quarters
    game = people(1, (sc) => { sc.victory.settlements = 5; });
    assert.match(refused(game, cmd("AAA", "proposeUnion", { with: "CCC" })), /too near victory/);
});

test("in a war against the same enemy: the second's war is the first's, and its sieges go on as the first's", () => {
    const game = people(), st = game.state;
    order(game, cmd("AAA", "declareWar", { target: "BBB" }));
    order(game, cmd("CCC", "declareWar", { target: "BBB" }));
    st.settlements[4].siege = { by: "CCC", start: 0, end: 300 };
    order(game, cmd("AAA", "proposeUnion", { with: "CCC" }));
    answer(game);
    assert.deepEqual(st.wars, ["AAA|BBB"]);
    assert.equal(st.settlements[4].siege.by, "AAA");
});

test("a union refused, or not answered in 6 months, changes nothing", () => {
    let game = people();
    order(game, cmd("AAA", "proposeUnion", { with: "CCC" }));
    answer(game, false);
    assert.equal(game.state.countries.CCC.out, null);
    game = people();
    order(game, cmd("AAA", "proposeUnion", { with: "CCC" }));
    const events = runTo(game, 200);
    assert.deepEqual(ofType(events, "lapsed").map((e) => e.kind), ["union"]);
    assert.equal(game.state.countries.CCC.out, null);
    assert.equal(ofType(events, "union").length, 0);
});
