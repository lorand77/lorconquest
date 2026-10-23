// The browser's state copy and map geometry (public/js/mirror.js), run in Node.
import test from "node:test";
import assert from "node:assert/strict";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { buildMap } from "../../src/engine/index.js";
import { applyChanges, applyPrivate, along, armingCost, armyPoint, bestArming, buildLegs, endScreen, fitView, formatMen, isSelected, routeLine, tabForSelection, warAlert } from "../../public/js/mirror.js";

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

test("what is selected on the map opens the tab that deals with it", () => {
    const town = { kind: "settlement" }, pass = { kind: "pass" };
    assert.equal(tabForSelection({ kind: "army", id: 37 }, "BAV"), "selection");
    assert.equal(tabForSelection({ kind: "fleet", id: 101 }, "BAV"), "selection");
    assert.equal(tabForSelection({ kind: "place", key: "37" }, "BAV", { place: town, owner: "BAV" }), "shop", "one's own settlement: the shop");
    assert.equal(tabForSelection({ kind: "place", key: "48" }, "BAV", { place: town, owner: "ULM" }), "selection", "another's: the map");
    assert.equal(tabForSelection({ kind: "place", key: "P1" }, "BAV", { place: pass, owner: "BAV" }), "selection", "a pass: the map");
    assert.equal(tabForSelection({ kind: "country", code: "BAV" }, "BAV"), "country", "one's own land: the country");
    assert.equal(tabForSelection({ kind: "country", code: "ULM" }, "BAV"), "diplomacy", "another country's: diplomacy");
    assert.equal(tabForSelection({ kind: "country", code: "REB1" }, "BAV", { rebel: true }), "selection", "peasant rebels: the map");
    assert.equal(tabForSelection(null, "BAV"), null, "nothing (the sea): the tab stays");
});

test("the view stays on the map: shaped like its box, no larger than the map, never past an edge", () => {
    const W = 1308, H = 1165;
    // a wide box (2:1): the whole width fits, and half of it in height (654 of 1165), which can be panned
    assert.deepEqual(fitView({ x: -500, y: -500, w: 99999 }, W, H, 2), { x: 0, y: 0, w: 1308, h: 654 });
    // a tall box (1:2): the whole height fits, and less than half the width (582.5 of 1308)
    assert.deepEqual(fitView({ x: 0, y: 0, w: 99999 }, W, H, 0.5), { x: 0, y: 0, w: 582.5, h: 1165 });
    // panned past the right and bottom edges: pulled back to them
    const v = fitView({ x: 5000, y: 5000, w: 300 }, W, H, 1.5);
    assert.deepEqual(v, { x: W - 300, y: H - 200, w: 300, h: 200 });
    // zoomed in too far: a twelfth of the map's width at most
    assert.equal(fitView({ x: 100, y: 100, w: 1 }, W, H, 1.5).w, W / 12);
});

test("arming men costs the lots of 1000 the reserve lacks; one click picks the best weapon the treasury pays for", () => {
    assert.deepEqual(armingCost({ pikes: 300 }, "pikes", 1000, 30000), { lots: 1, cost: 30000 });
    assert.deepEqual(armingCost({ pikes: 300 }, "pikes", 2500, 30000), { lots: 3, cost: 90000 });
    assert.deepEqual(armingCost({ pikes: 3000 }, "pikes", 2500, 30000), { lots: 0, cost: 0 });
    assert.deepEqual(armingCost({}, "unarmed", 1000, undefined), { lots: 0, cost: 0 });
    assert.deepEqual(armingCost({ cannons: 30 }, "cannons", 2000, 100000), { lots: 2, cost: 200000 });       // 200 cannons for 2,000 men
    const prices = { swords: 25000, pikes: 30000, cavalry: 60000, muskets: 100000 };
    const country = { techs: ["swords", "pikes", "cavalry"], reserve: { swords: 0, pikes: 0, cavalry: 0 }, treasury: 100000 };
    assert.deepEqual(bestArming(country, 1000, prices), { weapon: "cavalry", n: 1000, lots: 1, cost: 60000 });
    assert.deepEqual(bestArming(country, 2000, prices), { weapon: "pikes", n: 2000, lots: 2, cost: 60000 });
    assert.deepEqual(bestArming({ ...country, treasury: 0, reserve: { swords: 2000 } }, 2000, prices), { weapon: "swords", n: 2000, lots: 0, cost: 0 });
    assert.equal(bestArming({ ...country, treasury: 0 }, 1000, prices), null);
    assert.equal(bestArming(country, 0, prices), null);
});

test("a second click on the selected army or fleet lets it go; anything else is a new pick", () => {
    assert.equal(isSelected({ kind: "army", id: 3 }, { kind: "army", id: 3 }), true);
    assert.equal(isSelected({ kind: "fleet", id: 2 }, { kind: "fleet", id: 2 }), true);
    assert.equal(isSelected({ kind: "army", id: 3 }, { kind: "army", id: 4 }), false);
    assert.equal(isSelected({ kind: "army", id: 3 }, { kind: "fleet", id: 3 }), false);       // a fleet with the same number
    assert.equal(isSelected({ kind: "place", key: "37" }, { kind: "place", key: "37" }), false); // a place: clicking it again keeps it
    assert.equal(isSelected(null, { kind: "army", id: 3 }), false);
});

test("the end screen: victory, defeat by another or by falling, game over; the standings with the winner first and you marked", () => {
    const table = { BAV: { settlements: 45, pop: 900000 }, SAX: { settlements: 20, pop: 400000 }, AUS: { settlements: 20.5, pop: 380000 } };
    for (let i = 0; i < 12; i++) table[`C${i}`] = { settlements: 1, pop: 10000 + i };
    table.ZZZ = { settlements: 0, pop: 0 };
    const names = { BAV: "Bavaria", SAX: "Saxony", AUS: "Austria", ZZZ: "Zed" };
    const base = { table, names, target: 45, endYear: 1650 };
    const won = endScreen({ ...base, me: "BAV", end: { winner: "BAV", why: "reached" } });
    assert.deepEqual([won.kind, won.title, won.subtitle, won.final], ["victory", "Victory!", "Bavaria wins, holding 45 settlements of the 45 needed.", true]);
    assert.deepEqual(won.rows.slice(0, 3).map((r) => [r.rank, r.code, r.you, r.winner]), [[1, "BAV", true, true], [2, "AUS", false, false], [3, "SAX", false, false]]);
    assert.equal(won.rows.length, 10);
    // beaten by another person, on time: their name is given; you are added after the ten if you are not among them
    const lost = endScreen({ ...base, me: "ZZZ", players: { BAV: "alice", ZZZ: "bob" }, end: { winner: "BAV", why: "end" } });
    assert.deepEqual([lost.kind, lost.subtitle], ["defeat", "Bavaria (alice) wins, holding the most settlements when 1650 came, 45."]);
    assert.deepEqual([lost.rows.length, lost.rows[10].code, lost.rows[10].you, lost.rows[10].rank], [11, "ZZZ", true, 16]);
    // fallen: alone the game ends; with others it goes on, and the screen is not the last word
    assert.equal(endScreen({ ...base, me: "SAX", end: { winner: null, defeated: true } }).subtitle, "Saxony is no more: its last settlement has fallen.");
    assert.equal(endScreen({ ...base, me: "SAX", players: { SAX: "a", AUS: "b" }, end: { winner: null, defeated: true } }).subtitle, "Every player's country has fallen.");
    const out = endScreen({ ...base, me: "SAX", players: { SAX: "a", AUS: "b" }, end: { out: true } });
    assert.deepEqual([out.kind, out.final], ["defeat", false]);
    assert.match(out.subtitle, /you may watch to the end/);
    const gone = endScreen({ ...base, me: "SAX", end: { winner: null, abandoned: true } });
    assert.deepEqual([gone.kind, gone.title, gone.final], ["over", "Game over", true]);
});

test("the war banner: who declared war on you, who joins them, who joins you — and later joiners added while it shows", () => {
    assert.equal(warAlert([{ type: "war", country: "AUS", target: "SAX" }], "BAV"), null);         // a war of others
    const w = warAlert([
        { type: "war", country: "AUS", target: "BAV" },
        { type: "joins", country: "HUN", enemy: "BAV", side: "att" },
        { type: "joins", country: "SAX", enemy: "AUS", side: "def" },
        { type: "joins", country: "POL", enemy: "BRB", side: "att" },                                // another war
    ], "BAV");
    assert.deepEqual(w, { attackers: ["AUS"], against: ["HUN"], allies: ["SAX"] });
    // a day later an ally answers its call: added; a day with nothing new for the banner: nothing
    assert.deepEqual(warAlert([{ type: "joins", country: "BOH", enemy: "AUS", side: "def" }], "BAV", w), { attackers: ["AUS"], against: ["HUN"], allies: ["SAX", "BOH"] });
    assert.equal(warAlert([{ type: "capture" }], "BAV", w), null);
    // with the banner closed, joiners alone raise nothing; a second declaration adds to an open one
    assert.equal(warAlert([{ type: "joins", country: "BOH", enemy: "BAV", side: "att" }], "BAV"), null);
    assert.deepEqual(warAlert([{ type: "war", country: "STY", target: "BAV" }], "BAV", w).attackers, ["AUS", "STY"]);
});
