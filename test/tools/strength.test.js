// The strength benchmark (tools/strength.js): two versions of the computer players on one engine, the same games played whichever
// version is told to play a country when the two are the same, salted dice making them differ, halves of like size, the interval.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { Game } from "../../src/engine/index.js";
import { aiAt, halvesOf, meanCI, play, salted } from "../../tools/strength.js";

const load = async (v) => import(pathToFileURL(path.join(v.dir, "index.js")).href);

test("a commit's computer players run on the working copy's engine: one engine for both versions and the game", async () => {
    const head = aiAt("HEAD");
    assert.match(head.dir, /lc-strength/);
    const engine = await import(pathToFileURL(path.join(head.dir, "..", "engine", "index.js")).href);
    assert.equal(engine.Game, Game, "the very module, not a copy: the rules are today's");
    assert.equal(typeof (await load(head)).createAI, "function");
});

test("the same computer players play the very same game whichever version plays a country; salted dice change the game", async () => {
    const v = await load(aiAt("working")), ai = { base: v, cand: v }, years = 2, seed = 101;
    const control = play({ scenario, seed, years, ai, assign: { rest: "base" } });
    const one = play({ scenario, seed, years, ai, assign: { rest: "base", BAV: "cand" } });
    assert.equal(one.fingerprint, control.fingerprint, "BAV on the candidate: the same game, to the last coin");
    assert.equal(one.countries.BAV.side, "cand");
    const { A } = halvesOf(scenario);
    const halves = play({ scenario, seed, years, ai, salt: "aa", assign: { rest: "base", ...Object.fromEntries(A.map((c) => [c, "cand"])) } });
    assert.notEqual(halves.fingerprint, control.fingerprint, "half the countries with other dice: another game");
    const game = Game.create(scenario, { seed: 7 }), view = salted(game, "x");
    assert.deepEqual([view.state.seed, view.state.day, view.map], ["7~x", 0, game.map], "only the seed is changed");
    assert.equal(salted(game, ""), game);
});

test("the halves: every country in one, of like size", () => {
    const { A, B } = halvesOf(scenario), pop = (list) => list.reduce((n, c) => n + scenario.countries.find((x) => x.code === c).pop, 0);
    assert.equal(A.length + B.length, scenario.countries.length);
    assert.equal(new Set([...A, ...B]).size, scenario.countries.length);
    assert.ok(Math.abs(pop(A) - pop(B)) <= Math.max(...scenario.countries.map((c) => c.pop)), `${pop(A)} against ${pop(B)}`);
});

test("the 95% interval of a mean, by the t distribution", () => {
    const c = meanCI([1, 2, 3, 4]);
    assert.equal(c.mean, 2.5);
    assert.ok(Math.abs(c.hi - (2.5 + 3.18 * Math.sqrt(5 / 3) / 2)) < 1e-9);
    assert.ok(Number.isNaN(meanCI([5]).lo), "one is no interval");
});
