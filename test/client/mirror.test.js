// The browser's state copy and map geometry (public/js/mirror.js), run in Node.
import test from "node:test";
import assert from "node:assert/strict";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { buildMap } from "../../src/engine/index.js";
import { applyChanges, applyPrivate, along, armyPoint, buildLegs, formatMen, routeLine } from "../../public/js/mirror.js";

test("a day's changes and private parts go into the copy of the state", () => {
    const state = { day: 3, countries: { BAV: { code: "BAV", name: "Bavaria" } }, settlements: { 48: { owner: "ULM" } }, armies: { 37: { id: 37 }, 48: { id: 48 } }, wars: [] };
    applyChanges(state, { day: 4, armies: { 37: { id: 37, at: "48" }, 48: null }, settlements: { 48: { owner: "BAV" } }, wars: ["BAV|ULM"] });
    assert.deepEqual(state, { day: 4, countries: { BAV: { code: "BAV", name: "Bavaria" } }, settlements: { 48: { owner: "BAV" } }, armies: { 37: { id: 37, at: "48" } }, wars: ["BAV|ULM"] });
    applyChanges(state, { day: 5 });
    assert.equal(state.day, 5);
    applyPrivate(state, "BAV", { treasury: 12 });
    assert.deepEqual(state.countries.BAV, { code: "BAV", name: "Bavaria", treasury: 12 });
});

test("legs: every route's line both ways, split at its pass", () => {
    const legs = buildLegs(scenario);
    const r = scenario.routes.find((x) => x.id === "route-37-48");
    assert.deepEqual(legs.get("37>48"), r.points);
    assert.deepEqual(legs.get("48>37"), [...r.points].reverse());
    const p6 = scenario.passes.find((p) => p.id === "P6");
    assert.deepEqual(legs.get("28>P6").at(-1), [p6.x, p6.y]);
    assert.deepEqual(legs.get("P6>33")[0], [p6.x, p6.y]);
    assert.ok(!legs.has("28>33"));
});

test("along a line, and where an army is drawn", () => {
    const line = [[0, 0], [10, 0], [10, 10]];
    assert.deepEqual(along(line, 0).at, [0, 0]);
    assert.deepEqual(along(line, 0.5).at, [10, 0]);
    assert.deepEqual(along(line, 0.75).at, [10, 5]);
    assert.deepEqual(along(line, 0.75).rest, [[10, 5], [10, 10]]);
    assert.deepEqual(along(line, 1).at, [10, 10]);
    const map = buildMap(scenario), legs = buildLegs(scenario);
    const s37 = scenario.settlements.find((s) => s.id === 37);
    assert.deepEqual(armyPoint({ at: "37" }, 5, legs, map.nodes), [s37.x, s37.y]);
    const halfway = armyPoint({ at: null, march: { from: "37", to: "48", start: 0, end: 84 } }, 42, legs, map.nodes);
    assert.deepEqual(halfway, along(legs.get("37>48"), 0.5).at);
});

test("the line of a planned route, from a place or from the middle of a leg", () => {
    const map = buildMap(scenario), legs = buildLegs(scenario);
    const fromPlace = routeLine({ at: "37" }, ["48", "49"], 0, legs, map.nodes);
    assert.deepEqual(fromPlace, [...legs.get("37>48"), ...legs.get("48>49").slice(1)]);
    const marching = { at: null, march: { from: "37", to: "48", start: 0, end: 84 } };
    const onwards = routeLine(marching, ["48"], 42, legs, map.nodes);
    assert.deepEqual(onwards[0], along(legs.get("37>48"), 0.5).at);
    assert.deepEqual(onwards.at(-1), legs.get("37>48").at(-1));
    const back = routeLine(marching, ["37"], 42, legs, map.nodes);
    assert.deepEqual(back.at(-1), legs.get("37>48")[0]);              // turned back: it ends where it started
});

test("men on a marker", () => {
    assert.deepEqual([0, 750, 1000, 1234, 9999, 12400].map(formatMen), ["0", "750", "1k", "1.2k", "10k", "12k"]);
});

test("where fleets are drawn: in a port, at sea in their zone, or between zones", async () => {
    const { fleetPoints } = await import("../../public/js/mirror.js");
    const map = buildMap(scenario);
    const state = { fleets: {
        1: { id: 1, port: 2, zone: "oslofjord", moving: null },
        2: { id: 2, port: 2, zone: "oslofjord", moving: null },
        3: { id: 3, port: null, zone: "skagerrak", moving: null },
        4: { id: 4, port: null, zone: "oslofjord", moving: { to: "skagerrak", start: 0, end: 61 } },
    } };
    const pts = fleetPoints(state, map.nodes, map.zones, 30.5);
    const oslo = map.nodes.get("2"), sk = map.zones.get("skagerrak").label, of = map.zones.get("oslofjord").label;
    assert.deepEqual(pts.get(1), [oslo.x - 8, oslo.y + 20]);
    assert.deepEqual(pts.get(2), [oslo.x - 8, oslo.y + 36]);                  // a second fleet in the same port sits below
    assert.deepEqual(pts.get(3), [sk.x, sk.y + 14]);
    assert.deepEqual(pts.get(4), [(of.x + sk.x) / 2, (of.y + sk.y) / 2 + 14]); // halfway between the zones
});
