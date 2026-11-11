// How settlements are lost (tools/losses.js): by storm, siege, peace or to rebels, and why one fell by force — the loser
// outmatched, its strength near, on another front, or out of place — on the tiny map, and the run's summary.
import test from "node:test";
import assert from "node:assert/strict";
import { lossSampler, lossSummary, whyLost } from "../../tools/losses.js";
import { setArmy, tinyGame } from "../helpers/tiny.js";

// AAA has stormed BBB's town Five with army 3, 1,000 swords; BBB's army 4 at its city Four, 73 days off, is `four` strong
function stormed(four) {
    const game = tinyGame(), st = game.state;
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    setArmy(game, 3, { swords: 1000 });
    st.armies[3].at = "5";
    delete st.armies[5];
    st.settlements[5].owner = "AAA";
    setArmy(game, 4, { swords: four });
    return game;
}
const event = { type: "capture", settlement: 5, from: "BBB", to: "AAA", how: "storm" };

test("why a settlement fell by force: nothing to send, enough near, its strength on another front, or out of place", () => {
    assert.deepEqual(whyLost(stormed(800), stormed(800).state.settlements[5], "BBB", "AAA").why, "outmatched", "800 in all against 1,000");
    let game = stormed(3000);
    assert.deepEqual(whyLost(game, game.state.settlements[5], "BBB", "AAA"), { why: "away", hostDays: 73 }, "3,000, but 73 days off, in one war");
    game = stormed(3000);
    game.command({ type: "declareWar", country: "CCC", target: "BBB" });
    assert.equal(whyLost(game, game.state.settlements[5], "BBB", "AAA").why, "fronts", "and at war with CCC too");
    game = stormed(3000);
    Object.assign(game.state.armies[4], { at: null, march: { from: "4", to: "5", start: 0, end: 73 } });
    assert.deepEqual(whyLost(game, game.state.settlements[5], "BBB", "AAA"), { why: "near", hostDays: 0 }, "on its way: there");
});

test("a game's losses by how, peasant rebels' own aside, and integration no loss; the summary", () => {
    const game = stormed(3000), losses = lossSampler(game);
    game.state.countries.REB = { code: "REB", rebel: true, out: null };
    losses.day([event, { ...event, how: "siege", settlement: 2, from: "AAA", to: "BBB" }, { ...event, how: "peace" }, { ...event, to: "REB" },
        { ...event, from: "REB" }, { type: "integrated", country: "AAA", subject: "CCC", settlements: 2 }]);
    const r = losses.result();
    assert.deepEqual(r.how, { storm: 1, siege: 1, undefended: 0, peace: 1, rebels: 1 });
    assert.equal(Object.values(r.why).reduce((a, b) => a + b, 0), 2, "the storm and the siege, not the peace nor the rebels'");
    assert.equal(r.integrated, 2);
    const text = lossSummary([{ losses: r }, { losses: r }]);
    assert.match(text, /settlements lost \(2 games/);
    assert.match(text, /by storm 1\.0 \(25%\)/);
    assert.match(text, /lost by force to a country, why \(2\.0 a game\)/);
});
