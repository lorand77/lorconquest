// The scripted wars in test/wars play out as they should on the real map (docs/plan.md, milestone 1).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { runScript } = require("../tools/run.js");

function play(name) {
    const { game, events, rejected } = runScript(fs.readFileSync(path.join(__dirname, "wars", `${name}.txt`), "utf8"));
    assert.deepEqual(rejected, [], "no command was refused");
    return { st: game.state, events, battles: events.filter((e) => e.type === "battle") };
}

test("Bavaria takes Ulm by storm", () => {
    const { st, battles } = play("bavaria-ulm");
    assert.equal(st.settlements[48].owner, "BAV");
    assert.deepEqual(battles.map((b) => [b.kind, b.winner]), [["storm", "a"]]);
    assert.deepEqual(battles[0].a.armies, [37, 38]);                       // both Bavarian armies storm together
});

test("Ulm and Bavaria meet on the road between them", () => {
    const { st, battles, events } = play("head-on");
    assert.deepEqual(battles.map((b) => b.kind), ["route"]);
    assert.equal(st.settlements[48].owner, "ULM");                         // the beaten army got home first
    assert.ok(events.some((e) => e.type === "siegeStart" && e.settlement === 48));
});

test("Bohemia holds the pass at ×2", () => {
    const { battles } = play("pass");
    assert.deepEqual(battles.map((b) => [b.kind, b.winner, b.b.countries[0]]), [["pass", "b", "BOH"]]);
});

test("Vienna is relieved, then breaks the second siege with a sortie", () => {
    const { st, battles } = play("vienna");
    assert.deepEqual(battles.map((b) => [b.kind, b.winner]), [["relief", "a"], ["sortie", "a"]]);
    assert.equal(st.settlements[33].owner, "AUS");
    assert.equal(st.settlements[33].siege, null);
});
