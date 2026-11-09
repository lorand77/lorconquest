// The strength benchmark (tools/strength.js): two versions of the computer players on one engine, the same games played whichever
// version is told to play a country when the two are the same, salted dice making them differ, the interval.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { Game } from "../../src/engine/index.js";
import { aiAt, meanCI, play, salted } from "../../tools/strength.js";

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
    const control = play({ scenario, seed, years, ai });
    const one = play({ scenario, seed, years, ai, country: "BAV" });
    assert.equal(one.fingerprint, control.fingerprint, "BAV on the candidate: the same game, to the last coin");
    assert.deepEqual([one.country, Object.keys(one.ms), Object.keys(control.ms)], ["BAV", ["base", "cand"], ["base"]]);
    const luck = play({ scenario, seed, years, ai, country: "BAV", salt: "aa" });
    assert.notEqual(luck.fingerprint, control.fingerprint, "BAV with other dice: another game");
    const game = Game.create(scenario, { seed: 7 }), view = salted(game, "x");
    assert.deepEqual([view.state.seed, view.state.day, view.map], ["7~x", 0, game.map], "only the seed is changed");
    assert.equal(salted(game, ""), game);
});

test("the 95% interval of a mean, by the t distribution", () => {
    const c = meanCI([1, 2, 3, 4]);
    assert.equal(c.mean, 2.5);
    assert.ok(Math.abs(c.hi - (2.5 + 3.18 * Math.sqrt(5 / 3) / 2)) < 1e-9);
    assert.ok(Number.isNaN(meanCI([5]).lo), "one is no interval");
});

test("a run is written down game by game: the same settings resume it, other settings are refused", async () => {
    const { readPartial, startPartial, writeGame } = await import("../../tools/strength.js");
    const fs = await import("node:fs"), os = await import("node:os");
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lc-partial-")), "x.partial.jsonl");
    const settings = { scenario: "mitteleuropa", years: 1, seeds: [101], countries: ["BAV"], salt: "", candidate: "a", baseline: "b" };
    assert.deepEqual(readPartial(file, settings), [], "nothing yet");
    startPartial(file, settings);
    writeGame(file, { seed: 101, country: null, day: 365 });
    startPartial(file, settings);                                                  // starting again keeps what is there
    assert.deepEqual(readPartial(file, settings), [{ seed: 101, country: null, day: 365 }]);
    assert.throws(() => readPartial(file, { ...settings, candidate: "c" }), /another run's/);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
