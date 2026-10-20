// The scripted wars in test/wars play out as they should on the real map (docs/plan.md, milestone 1).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runScript } from "../tools/run.js";

function play(name) {
    const { game, events, rejected } = runScript(fs.readFileSync(path.join(import.meta.dirname, "wars", `${name}.txt`), "utf8"));
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

test("a war that calls its allies in: Hungary on Poland's side, the Teutonic Order on Livonia's, and each ally's own peace", () => {
    const { st, events } = play("diplomacy");
    const joins = events.filter((e) => e.type === "joins").map((e) => [e.country, e.enemy, e.side]);
    assert.deepEqual(joins, [["HUN", "LIV", "att"], ["TEU", "POL", "def"]]);      // Lithuania, a defensive ally of the attacker, is not called
    assert.deepEqual(events.filter((e) => e.type === "answer").map((e) => [e.country, e.what, e.accepted]),
        [["LIV", "peace", true], ["POL", "peace", false], ["FRA", "pact", true], ["SAX", "defensive", false]]);
    assert.deepEqual(events.filter((e) => e.type === "refused").map((e) => [e.country, e.from]), [["GOT", "SWE"]]);
    // Poland and Livonia made peace in March 1440 and their truce ran out five years later; their allies' wars go on, as do the
    // wars the game opened with
    assert.deepEqual(st.wars, ["BUR|HAM", "BUR|LUB", "HUN|JIS", "HUN|LIV", "MIL|VEN", "POL|TEU", "SWI|ZUR"]);
    assert.deepEqual(events.filter((e) => e.type === "expired").map((e) => [e.kind, e.a, e.b, e.day]), [["pact", "POL", "TEU", 1825], ["truce", "LIV", "POL", 1825 + 59]]);
    assert.ok(st.agreements.some((x) => x.kind === "pact" && x.a === "DEN" && x.b === "FRA"));
    assert.equal(st.countries.POL.warmonger >= 0, true);
});

test("a country run for three years: loans, taxes, forces, research, a fleet at sea, and peasants rising", () => {
    const { st, events } = play("economy");
    const of = (type) => events.filter((e) => e.type === type);
    assert.deepEqual(of("ready").map((e) => [e.country, e.what, e.n, e.day]), [["BAV", "mercenaries", 1000, 30], ["BAV", "soldiers", 2000, 91]]);
    assert.deepEqual(of("uprising").map((e) => [e.country, e.rebels, e.day]), [["BAV", "REB1", 1095]]);
    assert.deepEqual(of("battle").map((b) => [b.kind, b.winner]), [["sortie", "b"]]);
    assert.equal(st.countries.BAV.law, "mass");
    assert.equal(st.settlements[37].library, true);
    assert.ok(st.countries.BAV.loans === 100000 && st.countries.NED.loans === 100000);
    assert.equal(st.fleets[101].port, null);                                   // still at sea, patrolling
    assert.equal(st.fleets[101].order.type, "patrol");
    assert.ok(st.countries.BAV.r > 0);
});
