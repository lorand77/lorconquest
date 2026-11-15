// Religion (RULES.md §2): the faiths' part of the computer's opinion, the longer road to compliance for people of another faith —
// in what they pay, when a courthouse may be bought — and the unrest of land of another faith not yet core; none of it on a map
// without religions. On the tiny map, AAA and EEE Catholic, BBB Sunni, CCC Orthodox, DDD Hussite.
import test from "node:test";
import assert from "node:assert/strict";
import { CORING_DAYS, coringDays, economyOf, faithGap, faithRegard, faithUnrest, landReligion, opinion, religionOf } from "../../src/engine/index.js";
import { order, refused, tinyGame } from "../helpers/tiny.js";

const FAITHS = { AAA: "catholic", BBB: "sunni", CCC: "orthodox", DDD: "hussite", EEE: "catholic" };
const faithful = (seed = 1) => tinyGame(seed, (sc) => { for (const c of sc.countries) c.religion = FAITHS[c.code]; });
// AAA has taken settlement `id`, `years` ago: not core for it
const taken = (game, id, years) => Object.assign(game.state.settlements[id], { owner: "AAA", cores: [], heldSince: game.state.day - years * 365 });

test("two faiths regard each other by one number, the same either way round; a country or settlement of no faith by none", () => {
    assert.deepEqual(["catholic", "orthodox", "hussite", "sunni"].map((f) => faithRegard("catholic", f)), [15, -10, -20, -25]);
    assert.deepEqual([faithRegard("orthodox", "hussite"), faithRegard("sunni", "orthodox"), faithRegard("sunni", "hussite")], [0, -20, -15]);
    assert.equal(faithRegard("sunni", "catholic"), faithRegard("catholic", "sunni"));
    assert.equal(faithRegard(null, "catholic"), 0);
    const game = faithful();
    assert.deepEqual([religionOf(game, "BBB"), landReligion(game, 4), landReligion(game, "6")], ["sunni", "sunni", "orthodox"]);
    assert.equal(religionOf(tinyGame(), "BBB"), null, "a map without religions");
});

test("the computer's opinion: +15 for its own faith, down to −25 for Catholic and Sunni, all else the same", () => {
    const plain = tinyGame(), game = faithful();
    assert.equal(opinion(game, "EEE", "AAA") - opinion(plain, "EEE", "AAA"), 15);
    assert.equal(opinion(game, "BBB", "AAA") - opinion(plain, "BBB", "AAA"), -25);
    assert.equal(opinion(game, "CCC", "DDD") - opinion(plain, "CCC", "DDD"), 0, "Orthodox and Hussite bear no grudge");
});

test("people of another faith take 20 × (1 + gap) years to comply, and pay by that clock: Catholic over Sunni twice as long", () => {
    const game = faithful();
    assert.deepEqual([faithGap(game, "AAA", 4), faithGap(game, "AAA", 6), faithGap(game, "AAA", 7), faithGap(game, "AAA", 8)], [1, 0.4, 0.8, 0]);
    assert.equal(coringDays(game, "AAA", 4), 2 * CORING_DAYS);
    assert.equal(coringDays(game, "AAA", 8), CORING_DAYS, "the same faith: 20 years");
    assert.equal(coringDays(tinyGame(), "AAA", 4), CORING_DAYS, "no religions: 20 years");
    // 20 years held of a Sunni town pays what 10 years would of a town of no faith
    const plain = tinyGame();
    taken(game, 5, 20);
    taken(plain, 5, 10);
    assert.equal(economyOf(game, "AAA").settlementMoney, economyOf(plain, "AAA").settlementMoney);
});

test("a courthouse among people of another faith only once they comply: after 40 years for Catholic over Sunni", () => {
    const game = faithful();
    game.state.countries.AAA.treasury = 1e6;
    taken(game, 5, 25);
    assert.match(refused(game, { type: "buyBuilding", country: "AAA", building: "courthouse", settlement: 5 }), /not compliant yet: 62% — a courthouse once they are, after 40 years held/);
    taken(game, 5, 40);
    order(game, { type: "buyBuilding", country: "AAA", building: "courthouse", settlement: 5 });
    assert.ok(game.state.settlements[5].cores.includes("AAA"));
});

test("unrest: 10% × the gaps of the land not core ÷ all the land held, gone once it is core", () => {
    const game = faithful();
    assert.equal(faithUnrest(game, "AAA"), 0, "its own core land");
    taken(game, 5, 1);
    assert.ok(Math.abs(faithUnrest(game, "AAA") - 0.1 * 1 / 4) < 1e-12, "one Sunni town of four");
    taken(game, 6, 1);
    assert.ok(Math.abs(faithUnrest(game, "AAA") - 0.1 * 1.4 / 5) < 1e-12, "and an Orthodox one: gaps 1 and 0.4, of five");
    game.state.settlements[5].cores.push("AAA");
    assert.ok(Math.abs(faithUnrest(game, "AAA") - 0.1 * 0.4 / 5) < 1e-12, "core: its faith no longer matters");
    assert.equal(faithUnrest(tinyGame(), "AAA"), 0);
});
