// The starting state from the real scenario (RULES.md §2) and the map built from it.
import test from "node:test";
import assert from "node:assert/strict";
import scenario from "../../docs/scenario.json" with { type: "json" };
import { Game, menOf, soldiersOf, routeFor } from "../../src/engine/index.js";
import { tinyGame } from "../helpers/tiny.js";

test("every settlement starts with a sword-armed garrison of pop ÷ 25, numbered like it", () => {
    const game = Game.create(scenario);
    const st = game.state;
    assert.equal(Object.keys(st.settlements).length, 87);
    assert.equal(Object.keys(st.countries).length, 45);
    assert.equal(Object.keys(st.armies).length, 87);
    for (const s of scenario.settlements) {
        const a = st.armies[s.id];
        assert.equal(a.owner, s.country);
        assert.equal(a.at, String(s.id));
        assert.equal(a.men.swords, s.pop / 25);
        assert.equal(menOf(a), s.pop / 25);
        assert.deepEqual(st.settlements[s.id].cores, [s.country]);
    }
    assert.equal(st.nextId, 90);
    assert.equal(Object.values(st.armies).reduce((n, a) => n + menOf(a), 0), 1060000 / 25);
    assert.equal(soldiersOf(st, "BAV"), 2000);
    assert.equal(st.countries.BAV.treasury, 100000);                       // x × pop × 2
    assert.equal(st.countries.GOT.treasury, 20000);
    assert.equal(st.day, 0);
    assert.deepEqual(st.wars, []);
});

test("the map: one leg per route, two through a pass, and each pass leg once", () => {
    const game = Game.create(scenario);
    const r = scenario.routes.find((x) => x.id === "route-37-48");
    assert.equal(game.map.legDays.get("37|48"), Math.round(r.years * 365));
    const p6 = game.map.adj.get("28").filter((e) => e.to === "P6");
    assert.equal(p6.length, 1);                                            // three routes share the leg from Brno to P6
    assert.equal(game.map.nodes.get("P6").land, 28);
    assert.ok(!game.map.legDays.has("28|33"));                             // Brno-Vienna goes through the pass
});

test("routes: the fastest way, through land the army may enter", () => {
    const game = tinyGame();
    const a = game.state.armies[3];
    assert.equal(routeFor(game, a, "5"), null);                            // BBB is neutral: closed
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    const found = routeFor(game, a, "5");
    assert.deepEqual(found.path, ["P1", "5"]);
    assert.equal(found.days, 182);
    const fromOne = routeFor(game, game.state.armies[1], "5");
    assert.deepEqual(fromOne.path, ["3", "P1", "5"]);                      // 37 + 91 + 91 beats 73 + 110 + 73
    assert.equal(routeFor(game, game.state.armies[1], "6"), null);         // CCC is still neutral
});
