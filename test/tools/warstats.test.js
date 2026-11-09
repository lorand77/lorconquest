// The measures of war and arms (tools/warstats.js): taken on the 1st of each month over the countries living, counted from a day's
// events, and given by era; the summary's interval.
import test from "node:test";
import assert from "node:assert/strict";
import { ERAS, meanCI, warSampler, warSummary } from "../../tools/warstats.js";
import { economyOf, popOf, soldiersOf } from "../../src/engine/index.js";
import { tinyGame } from "../helpers/tiny.js";

test("a game's measures: war exposure and arms on the 1st of the month, captures and the dead from the day's events", () => {
    const game = tinyGame(), st = game.state, w = warSampler(game);
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    w.day([]);                                                                    // 1 January 1440: a sample
    const codes = Object.keys(st.countries), people = codes.reduce((n, c) => n + popOf(st, c), 0);
    const atWar = popOf(st, "AAA") + popOf(st, "BBB"), soldiers = codes.reduce((n, c) => n + soldiersOf(st, c), 0);
    const upkeep = codes.reduce((n, c) => n + economyOf(game, c).upkeep + economyOf(game, c).mercenaryUpkeep, 0);
    const money = codes.reduce((n, c) => n + economyOf(game, c).settlementMoney, 0);
    st.day = 10;                                                                  // not the 1st: only the events count
    w.day([{ type: "capture" }, { type: "battle", a: { dead: 100 }, b: { dead: 50 } }, { type: "attrition", dead: 10 }, { type: "surrender", disbanded: 500 }]);
    const r = w.result(), settlements = game.map.scenario.settlements.length;
    assert.ok(Math.abs(r.exposure - atWar / people) < 1e-12, "the people of AAA and BBB, at war");
    assert.ok(Math.abs(r.mobilization - soldiers / people) < 1e-12);
    assert.ok(Math.abs(r.burden - upkeep / money) < 1e-12);
    assert.ok(Math.abs(r.churn - 100 * 1 / (settlements / 12)) < 1e-9, "one capture in a month of the map");
    assert.ok(Math.abs(r.bloodiness - 1000 * 160 / (people / 12)) < 1e-9, "the battle's 150 and the 10 lost to hunger — not the 500 sent home");
    assert.equal(r.years, 1 / 12);
    assert.deepEqual(Object.keys(r.eras), ERAS.map(([name]) => name));
    assert.equal(r.eras["1440–1499"].exposure, r.exposure);
    assert.equal(r.eras["1575–1650"], null, "an era the game never reached");
});

test("the summary: each measure's mean over the games with its interval, and by era over the games that reached it", () => {
    const one = (x) => ({ wars: { years: 100, exposure: x, churn: x, bloodiness: x, mobilization: x, burden: x, eras: { "1440–1499": { exposure: x, churn: x, bloodiness: x, mobilization: x, burden: x }, "1500–1574": null, "1575–1650": null } } });
    const text = warSummary([one(0.1), one(0.3)], { byEra: true });
    assert.match(text, /mean of 2 games/);
    assert.match(text, /war exposure\s+20\.0% \[/);
    assert.match(text, /1440–1499 \(2 games\)/);
    assert.doesNotMatch(text, /1500–1574/, "no game reached it");
    assert.equal(meanCI([1, 2, 3, 4]).mean, 2.5);
});
