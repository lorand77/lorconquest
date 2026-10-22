// Retreating into a friend's settlement (RULES.md §5, After the battle): a beaten army may fall back to the nearest settlement
// of its own country or of a friend, and once there it stays — it is not turned away because the settlement is not its own.
// (A bug once had it turned away at every allied settlement, so it marched between two of them for ever.)
import test from "node:test";
import assert from "node:assert/strict";
import { addAgreement } from "../../src/engine/diplomacy.js";
import { retreat } from "../../src/engine/movement.js";
import { runTo, setArmy, tinyGame } from "../helpers/tiny.js";

test("a beaten army falls back to an ally's settlement when it is the nearest, and stays there", () => {
    const game = tinyGame(1);
    const st = game.state;
    addAgreement(game, "defensive", "AAA", "BBB");
    // an army of AAA standing at Five, BBB's town: its nearest friendly settlement is Four (BBB's, 73 days), its own the
    // nearest is Three (182 days, through the pass)
    const army = setArmy(game, 3, { swords: 500 });
    army.at = "5";
    const events = [];
    retreat(game, army, events);
    assert.deepEqual(events.filter((e) => e.type === "retreat").map((e) => e.to), ["4"]);
    const later = runTo(game, 400);
    const a = st.armies[army.id];
    assert.ok(a, "the army is alive");
    assert.deepEqual([a.at, a.retreating], ["4", false], "it stays at Four");
    assert.equal(later.filter((e) => e.type === "retreat" && e.army === army.id).length, 0, "and does not set off again");
});
