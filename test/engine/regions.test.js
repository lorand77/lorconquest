// A region proclaimed with part of it (SCENARIO.md, Special coring: Needs; RULES.md §2) — as Europe's Roman Empire needs Rome,
// Constantinople and 100 of its settlements: the settlements it names, that many in all with the vassals' among them, a capital
// in it; then every settlement of it becomes core, held or not, and one taken later is core the day it falls. On the tiny map:
// a region of 1–6, needing 4 and four in all; AAA (capital 1) holds 1–3.
import test from "node:test";
import assert from "node:assert/strict";
import { proclaimCheck } from "../../src/engine/index.js";
import { capture } from "../../src/engine/fighting.js";
import { order, refused, tinyGame } from "../helpers/tiny.js";

const REGION = { id: "rome", name: "Rome", settlements: [1, 2, 3, 4, 5, 6], needs: { settlements: [4], count: 4 }, becomes: { name: "Roman Empire", code: "ROM", colour: "#9c6fc8" } };
const roman = () => tinyGame(1, (sc) => { sc.formables.push(REGION); });
const proclaim = { type: "proclaim", country: "AAA", region: "rome" };

test("a region with Needs: what it names first, then the count, with a capital in it", () => {
    const game = roman(), st = game.state;
    assert.match(refused(game, proclaim), /must control Four to proclaim Rome/);
    st.settlements[5].owner = "AAA";
    assert.match(refused(game, proclaim), /must control Four/, "four held, but not the one it names");
    st.settlements[5].owner = "BBB";
    st.settlements[4].owner = "AAA";
    const p = proclaimCheck(game, "AAA", REGION);
    assert.deepEqual([p.held, p.needed, p.named, p.error], [4, 4, [], null]);
    assert.match(refused(game, { ...proclaim, country: "CCC" }), /must control Four/, "CCC's capital, 6, is in it, but it holds 6 alone");
    assert.match(refused(game, { ...proclaim, country: "EEE" }), /capital must lie within/, "EEE's, 8, is not");
});

test("proclaimed: every settlement of it core, held or not; one taken later is core the day it falls", () => {
    const game = roman(), st = game.state;
    st.settlements[4].owner = "AAA";
    const [e] = order(game, proclaim);
    assert.deepEqual([e.type, e.settlements, e.becomes, st.countries.AAA.name], ["proclaimed", 3, "Roman Empire", "Roman Empire"]);
    assert.ok([1, 2, 3, 4, 5, 6].every((id) => st.settlements[id].cores.includes("AAA")), "5 and 6 too, though BBB and CCC hold them");
    assert.equal(st.settlements[7].cores.includes("AAA"), false, "nothing outside it");
    capture(game, st.settlements[5], "AAA", [], "peace");
    assert.ok(st.settlements[5].cores.includes("AAA"));
    assert.match(refused(game, proclaim), /already core/);
});
