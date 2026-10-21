// Elimination (RULES.md §10): a country that loses its last settlement is out of the game — by storm, by an undefended
// capture, or by a peace that hands it away — and with it go its armies (wherever they are), its fleets, its wars, its
// agreements, its subjects and the questions to and from it. Peasant rebels, who hold no land of their own, are not eliminated.
import test from "node:test";
import assert from "node:assert/strict";
import { giveFleet, order, refused, rig, runTo, setArmy, tinyGame } from "../helpers/tiny.js";
import { addAgreement } from "../../src/engine/diplomacy.js";

// DDD holds one town, 7, between CCC (6) and EEE (8)
test("a country whose last settlement falls is out: its armies anywhere, its fleets, wars, agreements, subjects and questions go", () => {
    const game = tinyGame(1, () => {}, ["DDD"]);
    const st = game.state;
    order(game, { type: "declareWar", country: "CCC", target: "DDD" });
    // DDD has an army out in the field at 8 (EEE's, which lets it in), a fleet, an agreement, a subject, and a question waiting
    addAgreement(game, "access", "EEE", "DDD");
    addAgreement(game, "pact", "DDD", "BBB", 3650);
    order(game, { type: "split", country: "DDD", army: 7, men: { swords: 100 } });
    const field = Object.values(st.armies).find((a) => a.owner === "DDD" && a.id !== 7);
    order(game, { type: "move", country: "DDD", army: field.id, to: "8" });
    giveFleet(game, "DDD", { cogs: 10 }, 4, "south");
    st.countries.EEE.overlord = "DDD";
    st.countries.EEE.subjectKind = "protectorate";
    order(game, { type: "proposeAgreement", country: "AAA", with: "DDD", kind: "pact" });
    assert.equal(st.offers.length, 1);
    runTo(game, 60);
    assert.equal(Object.values(st.armies).find((a) => a.id === field.id)?.at, "8", "the field army stands at 8");
    // CCC storms Seven with an army that cannot lose
    setArmy(game, 6, { pikes: 3000 });
    order(game, { type: "move", country: "CCC", army: 6, to: "7", storm: true });
    rig(game, 6, 6, 1, 1, 6);
    const events = runTo(game, 120);
    assert.equal(st.settlements[7].owner, "CCC");
    const gone = events.find((e) => e.type === "eliminated");
    assert.deepEqual([gone?.country, st.countries.DDD.out], ["DDD", gone?.day]);
    assert.ok(!Object.values(st.armies).some((a) => a.owner === "DDD"), "every army of DDD is gone, the one at 8 too");
    assert.ok(!Object.values(st.fleets).some((f) => f.owner === "DDD"), "and its fleet");
    assert.ok(!st.wars.some((w) => w.includes("DDD")) && !st.warInfo["CCC|DDD"], "its war is over, with no truce");
    assert.ok(!st.agreements.some((x) => x.a === "DDD" || x.b === "DDD"), "its agreements have lapsed, the truce too");
    assert.equal(st.countries.EEE.overlord, null, "its subject is free");
    assert.ok(events.some((e) => e.type === "freedom" && e.country === "EEE"));
    assert.equal(st.offers.length, 0, "the question to it has lapsed");
    assert.equal(refused(game, { type: "setTax", country: "DDD", tax: 2.5 }), "your country is no more");
    // it stays on the books, for scores and replays, and is checked once only
    assert.ok(st.countries.DDD);
    assert.equal(runTo(game, 200).filter((e) => e.type === "eliminated").length, 0);
});

test("a peace that gives away a country's last settlement puts it out at once", () => {
    const game = tinyGame(1);
    const st = game.state;
    order(game, { type: "declareWar", country: "DDD", target: "CCC" });
    game.state.day = 400;
    game.state.warInfo["CCC|DDD"].start = 0;
    game.state.warInfo["CCC|DDD"].taken.CCC = 10000;          // CCC is far ahead: DDD would give it everything
    const events = order(game, { type: "proposePeace", country: "CCC", with: "DDD", terms: { take: [7] } });
    assert.equal(st.settlements[7].owner, "CCC");
    assert.ok(events.some((e) => e.type === "peace") && events.some((e) => e.type === "eliminated" && e.country === "DDD"));
    assert.equal(st.countries.DDD.out, 400);
    assert.ok(!st.agreements.some((x) => x.a === "DDD" || x.b === "DDD"), "not even the truce the peace signed");
});

test("peasant rebels, who start with no land, are never put out", () => {
    const game = tinyGame(1);
    const st = game.state;
    st.countries.REB1 = { code: "REB1", name: "Peasants", rebel: true, of: "AAA", out: null, overlord: null, subjectKind: null, warmonger: 0, tax: 2, taxSum: 0 };
    runTo(game, 3);
    assert.equal(st.countries.REB1.out, null);
});
