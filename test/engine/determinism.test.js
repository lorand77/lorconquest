// A game replays exactly (design.md, "Saving, restarting, replays"): the same script gives the same game, a
// snapshot plus the commands after it gives the same game as one unbroken run, and the engine stays runnable in
// the browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Game, replay } from "../../src/engine/index.js";
import { runScript } from "../../tools/run.js";

const script = fs.readFileSync(path.join(import.meta.dirname, "..", "wars", "vienna.txt"), "utf8");

test("the same script plays out the same, to the last die", () => {
    const a = runScript(script), b = runScript(script);
    assert.equal(a.game.snapshot(), b.game.snapshot());
    assert.notEqual(runScript(script.replace("seed 3", "seed 4")).game.snapshot(), a.game.snapshot());
});

test("a snapshot and the commands after it give exactly the unbroken game", () => {
    const { game, scenario } = runScript(script);
    const end = game.day;
    assert.equal(replay(scenario, game.state.seed, game.log, end).snapshot(), game.snapshot());
    for (const cut of [100, 300, 395, 450]) {
        const resumed = Game.restore(scenario, replay(scenario, game.state.seed, game.log, cut).snapshot());
        const rest = game.log.filter((e) => e.day > cut);
        while (resumed.day < end) {
            resumed.advance();
            for (const e of rest.filter((x) => x.day === resumed.day)) assert.equal(resumed.command(e.cmd).ok, true);
        }
        assert.equal(resumed.snapshot(), game.snapshot(), `resumed from day ${cut}`);
    }
});

test("a snapshot from another format or rules version is refused", () => {
    const { game, scenario } = runScript(script);
    const state = JSON.parse(game.snapshot());
    assert.throws(() => Game.restore(scenario, { ...state, rulesVersion: state.rulesVersion + 1 }), /rules version/);
    assert.throws(() => Game.restore(scenario, { ...state, format: state.format + 1 }), /format/);
});

test("the engine uses nothing that only Node or only a browser has, no clock and no Math.random", () => {
    const dir = path.join(import.meta.dirname, "..", "..", "src", "engine");
    for (const f of fs.readdirSync(dir)) {
        const src = fs.readFileSync(path.join(dir, f), "utf8").replace(/^\s*\/\/.*$/gm, "");
        for (const bad of [/\brequire\(/, /\bprocess\./, /\bDate\b/, /Math\.random/, /\bset(Timeout|Interval)\b/, /\b(document|window|localStorage)\b/, /from "(node:|fs|path)/]) {
            assert.doesNotMatch(src, bad, `${f} uses ${bad}`);
        }
        assert.match(f, /\.js$/);
    }
});
