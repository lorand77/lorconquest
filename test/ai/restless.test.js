// A country long at peace grows restless (src/ai/util.js, restlessOf): nothing in its first 10 years without a war, all after
// 40, nothing while it is at war — and peasants in arms do not count as a war. On the tiny map.
import test from "node:test";
import assert from "node:assert/strict";
import { restlessOf } from "../../src/ai/util.js";
import { order, tinyGame } from "../helpers/tiny.js";

test("restlessness: from 10 years of peace to 40, none at war", () => {
    const game = tinyGame(), st = game.state;
    assert.equal(restlessOf(game, "AAA"), 0, "1440: none");
    st.day = 25 * 365;
    assert.equal(restlessOf(game, "AAA"), 0.5, "25 years without a war");
    st.memory.lastWar["AAA|BBB"] = 20 * 365;
    st.day += 1;                                                                   // worked out again for a new day
    assert.ok(restlessOf(game, "AAA") === 0 && restlessOf(game, "BBB") === 0, "a war 5 years ago");
    st.day = 70 * 365;
    assert.equal(restlessOf(game, "AAA"), 1, "50 years after it: all");
    order(game, { type: "declareWar", country: "AAA", target: "CCC" });
    assert.equal(restlessOf(game, "AAA"), 0, "at war");
});
