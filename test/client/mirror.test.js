// The browser's state copy and map geometry (public/js/mirror.js), run in Node.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { buildMap } from "../../src/engine/index.js";
import { sheetAfter, applyChanges, applyPrivate, along, armingCost, armyPoint, bestArming, modernising, outdatedMen, pikesToMuskets, buildLegs, cheapestOpenTech, compliance, endScreen, fitView, formatMen, isSelected, pinchView, pressGuard, routeLine, scoreboard, tabForSelection, warAlert } from "../../public/js/mirror.js";

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

test("where fleets are drawn: in a port out in the water it faces, at sea in their zone, or between zones — never on land", async () => {
    const { fleetPoints } = await import("../../public/js/mirror.js");
    const map = buildMap(scenario);
    const state = { fleets: {
        1: { id: 1, port: 2, zone: "oslofjord", moving: null },
        2: { id: 2, port: 2, zone: "oslofjord", moving: null },
        3: { id: 3, port: null, zone: "skagerrak", moving: null },
        4: { id: 4, port: null, zone: "oslofjord", moving: { to: "skagerrak", start: 0, end: 61 } },
    } };
    const pts = fleetPoints(state, map.nodes, map.zones, 30.5);
    const harbour = map.zones.get("oslofjord").harbours["2"], sk = map.zones.get("skagerrak");
    assert.equal(harbour.length, 4, "tools/map.js gives a port four spots in clear water");
    assert.deepEqual([pts.get(1), pts.get(2)], [harbour[0], harbour[1]], "a second fleet in the same port sits further out");
    assert.deepEqual(pts.get(3), sk.fleets[0]);
    assert.deepEqual(pts.get(4), along(map.zones.get("oslofjord").lanes.skagerrak, 30.5 / 61).at, "halfway along the lane");
    assert.deepEqual(map.zones.get("oslofjord").lanes.skagerrak[0], map.zones.get("oslofjord").fleets[0], "which starts where a fleet at sea is drawn");
    // more fleets than spots go on along the column's line
    const many = { fleets: Object.fromEntries([1, 2, 3, 4, 5].map((id) => [id, { id, port: 2, zone: "oslofjord", moving: null }])) };
    const [x3, y3] = harbour[3], [x2, y2] = harbour[2];
    assert.deepEqual(fleetPoints(many, map.nodes, map.zones, 0).get(5), [2 * x3 - x2, 2 * y3 - y2]);
    // a fleet blockading a port is drawn off it, on the port's outer spots; a second one beyond it
    const shut = { fleets: { 7: { id: 7, port: null, zone: "oslofjord", moving: null, order: { type: "blockade", port: 2 } },
        8: { id: 8, port: null, zone: "oslofjord", moving: null, order: { type: "blockade", port: 2 } }, 9: { id: 9, port: null, zone: "oslofjord", moving: null, order: { type: "patrol" } } } };
    const at = fleetPoints(shut, map.nodes, map.zones, 0);
    assert.deepEqual([at.get(7), at.get(8), at.get(9)], [harbour[2], harbour[3], map.zones.get("oslofjord").fleets[0]], "a patrol stays in the zone's column");
    // a map without the spots: below the port's marker and the zone's name, as before
    const bare = new Map([...map.zones].map(([id, z]) => [id, { ...z, fleets: undefined, harbours: undefined }]));
    const oslo = map.nodes.get("2"), old = fleetPoints(state, map.nodes, bare, 30.5);
    assert.deepEqual([old.get(1), old.get(2), old.get(3)], [[oslo.x - 8, oslo.y + 20], [oslo.x - 8, oslo.y + 36], [sk.label.x, sk.label.y + 14]]);
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

test("someone watching gets the end as Game over, with who won: neither a victory nor a defeat of theirs", () => {
    const table = { BAV: { settlements: 45, pop: 900000 }, SAX: { settlements: 20, pop: 400000 } };
    const s = endScreen({ me: null, end: { winner: "BAV", why: "reached" }, table, names: { BAV: "Bavaria", SAX: "Saxony" }, players: { BAV: "alice" }, target: 45, endYear: 1650 });
    assert.deepEqual([s.kind, s.title, s.subtitle, s.final], ["over", "Game over", "Bavaria (alice) wins, holding 45 settlements of the 45 needed.", true]);
    assert.ok(!s.rows.some((r) => r.you));
    assert.equal(endScreen({ me: null, end: { winner: null, defeated: true }, table, names: {}, target: 45, endYear: 1650 }).subtitle, "Every player's country has fallen.");
});

test("the tech offered at one click when nothing is researched: the cheapest open now, or none", () => {
    const techs = { handCannons: { cost: 1.5, needs: "swords" }, arquebuses: { cost: 2, needs: "handCannons" }, carracks: { cost: 3, needs: "cogs" } };
    const cost = (id) => techs[id].cost;
    assert.equal(cheapestOpenTech(techs, ["swords", "cogs"], cost), "handCannons");
    assert.equal(cheapestOpenTech(techs, ["swords", "cogs", "handCannons"], cost), "arquebuses");      // now open, and cheaper than carracks
    assert.equal(cheapestOpenTech(techs, ["cogs"], cost), "carracks");
    assert.equal(cheapestOpenTech(techs, ["swords", "cogs", "handCannons", "arquebuses", "carracks"], cost), null);
});

test("a press in the panel holds the days' rebuilds, but a click's own redraw goes through at once (the Split… form)", () => {
    const deferred = [], press = pressGuard((fn) => deferred.push(fn));
    // a click on a button: down, up (the release defers its end), then the click — which ends the press before its handler
    press.down();
    assert.equal(press.pressed, true);                      // a day's rebuild now would swallow the click: held
    press.up();
    assert.equal(press.pressed, true);
    press.click();
    assert.equal(press.pressed, false, "the button's handler may redraw the panel");
    deferred.splice(0).forEach((fn) => fn());
    assert.equal(press.pressed, false);
    // a press released without a click (a drag off the button) ends just after the release
    press.down();
    press.up();
    assert.equal(press.pressed, true);
    deferred.splice(0).forEach((fn) => fn());
    assert.equal(press.pressed, false);
    press.up();                                             // a release with no press: nothing to end
    assert.equal(deferred.length, 0);
});

test("the scoreboard: the five ahead by settlements, people or military, and you after them if not among them", () => {
    const table = {
        BAV: { settlements: 9, pop: 300000 }, SAX: { settlements: 9, pop: 350000 }, AUS: { settlements: 12.5, pop: 280000 },
        BOH: { settlements: 4, pop: 500000 }, HUN: { settlements: 6, pop: 200000 }, POL: { settlements: 5, pop: 210000 },
        ULM: { settlements: 1, pop: 10000 }, OUT: { settlements: 0, pop: 0 },
    };
    const power = { BAV: 50, SAX: 20, AUS: 30, BOH: 10, HUN: 90, POL: 40, ULM: 5 };
    const alive = ["BAV", "SAX", "AUS", "BOH", "HUN", "POL", "ULM"];                  // OUT is out of the game
    const codes = (rows) => rows.map((r) => `${r.rank}${r.code}${r.you ? "*" : ""}`);
    // settlements as victory counts them, ties to the more people
    assert.deepEqual(codes(scoreboard({ table, power, alive, me: "BAV" })), ["1AUS", "2SAX", "3BAV*", "4HUN", "5POL"]);
    assert.deepEqual(codes(scoreboard({ table, power, alive, me: "ULM" })), ["1AUS", "2SAX", "3BAV", "4HUN", "5POL", "7ULM*"]);
    assert.deepEqual(codes(scoreboard({ table, power, alive, me: "ULM", key: "people" })), ["1BOH", "2SAX", "3BAV", "4AUS", "5POL", "7ULM*"]);
    assert.deepEqual(codes(scoreboard({ table, power, alive, me: null, key: "military" })), ["1HUN", "2BAV", "3POL", "4AUS", "5SAX"]);
    assert.equal(scoreboard({ table, power, alive, me: "BAV" })[0].value, 12.5);
});

test("pinching the map zooms by the fingers' spread and keeps the point under them where it was", () => {
    const W = 1200, H = 800, aspect = 1.5, start = { x: 0, y: 0, w: 1200 };       // the whole map, in a box 600 px wide
    // fingers twice as far apart, at the box's middle (300, 200 px), which showed the map's middle (600, 400): half the width,
    // still centred there
    assert.deepEqual(pinchView(start, { from: 100, to: 200, anchor: { x: 600, y: 400 }, at: { x: 300, y: 200 }, width: 600 }, W, H, aspect),
        { x: 300, y: 200, w: 600, h: 400 });
    // the fingers also moved 100 px left: the point under them moves with them
    assert.deepEqual(pinchView(start, { from: 100, to: 200, anchor: { x: 600, y: 400 }, at: { x: 200, y: 200 }, width: 600 }, W, H, aspect),
        { x: 400, y: 200, w: 600, h: 400 });
    // pinched in past the whole map: no further out than the map
    assert.equal(pinchView(start, { from: 200, to: 50, anchor: { x: 600, y: 400 }, at: { x: 300, y: 200 }, width: 600 }, W, H, aspect).w, 1200);
});

test("compliance: the share of 20 years held, ready at 100%; nothing for a settlement core already", () => {
    const years = 20 * 365, s = { owner: "AAA", cores: [], heldSince: 100 };
    assert.deepEqual(compliance(s, 100 + 5 * 365, years), { core: false, pct: 25, daysLeft: 15 * 365, ready: false });
    assert.deepEqual(compliance(s, 100 + years + 50, years), { core: false, pct: 100, daysLeft: 0, ready: true });
    assert.deepEqual(compliance({ ...s, cores: ["AAA"] }, 5000, years), { core: true });
});

test("the panel as a sheet on a phone: a tap steps it up and round, a swipe one step, picking something or a tab shows at least half", () => {
    assert.deepEqual(["collapsed", "half", "full"].map((s) => sheetAfter(s, "tap")), ["half", "full", "collapsed"]);
    assert.deepEqual(["collapsed", "half", "full"].map((s) => sheetAfter(s, "up")), ["half", "full", "full"]);
    assert.deepEqual(["collapsed", "half", "full"].map((s) => sheetAfter(s, "down")), ["collapsed", "collapsed", "half"]);
    assert.deepEqual(["collapsed", "half", "full"].map((s) => sheetAfter(s, "select")), ["half", "half", "full"]);
    assert.equal(sheetAfter("collapsed", "tab"), "half");
    assert.equal(sheetAfter("full", "deselect"), "full");
    assert.equal(sheetAfter(undefined, "tap"), "half");
});

test("a phone's slim bar: money and the date in few characters", async () => {
    const { shortMoney, shortDate } = await import("../../public/js/mirror.js");
    assert.deepEqual([980, 1234, 12345, 123456, 1234567, 12345678, -45678].map(shortMoney), ["980", "1.2K", "12K", "123K", "1.2M", "12M", "−45K"]);
    assert.equal(shortMoney(999999), "999K", "rounded down, never up into the next unit");
    assert.equal(shortDate("3 March 1452"), "3 Mar 1452");
    assert.equal(shortDate("1 May 1500"), "1 May 1500");
});

test("the keys: arrows pan, W A S D are letters with jobs of their own, nothing with Ctrl, Alt or ⌘", async () => {
    const { hotkey, HOTKEYS } = await import("../../public/js/mirror.js");
    const k = (key, mods = {}) => hotkey({ key, ...mods });
    assert.deepEqual(["1", "3", "6", "d", "D"].map((x) => k(x)), ["tab:selection", "tab:shop", "tab:events", "tab:diplomacy", "tab:diplomacy"]);
    assert.deepEqual(["ArrowLeft", "ArrowDown"].map((x) => k(x)), ["pan:-1,0", "pan:0,1"]);
    assert.deepEqual(["w", "a", "s"].map((x) => k(x)), ["whole", "army:1", "split"]);
    assert.equal(k("Tab", { shiftKey: true }), "army:-1");
    assert.equal(k("A", { shiftKey: true }), "army:-1");
    assert.deepEqual([k("Enter"), k("Enter", { shiftKey: true })], ["march", "marchStorm"]);
    assert.deepEqual([k(" "), k("+"), k("="), k("-"), k("?"), k("Escape"), k("t"), k("b"), k("m"), k("f"), k("c"), k("n"), k("p")],
        ["pause", "zoomIn", "zoomIn", "zoomOut", "help", "escape", "storm", "sortie", "merge", "fleet", "chat", "notices", "picture"]);
    assert.equal(k("s", { ctrlKey: true }), null, "Ctrl+S is the browser's");
    assert.equal(k("r", { metaKey: true }), null);
    assert.equal(k("x"), null);
    assert.ok(HOTKEYS.length >= 15 && HOTKEYS.every(([keys, does]) => keys && does));
});

test("a fleet sailing between two sea zones is drawn along the lane between them (through the water), every neighbour having one", async () => {
    const { fleetPoints } = await import("../../public/js/mirror.js");
    for (const sc of [JSON.parse(fs.readFileSync(new URL("../../scenarios/mitteleuropa/scenario.json", import.meta.url))),
        JSON.parse(fs.readFileSync(new URL("../../scenarios/historical-1440/scenario.json", import.meta.url)))]) {
        const zones = new Map(sc.seaZones.map((z) => [z.id, z]));
        for (const z of sc.seaZones) for (const o of z.next) {
            const lane = z.lanes[o];
            assert.ok(lane?.length >= 2, `${z.id} to ${o}`);
            assert.deepEqual(lane[0], [z.label.x, z.label.y + 14], "from the one zone's fleet mark");
            assert.deepEqual(lane.at(-1), [zones.get(o).label.x, zones.get(o).label.y + 14], "to the other's");
            assert.deepEqual(zones.get(o).lanes[z.id], [...lane].reverse(), "the same water both ways");
        }
    }
    // halfway along a bent lane, the fleet is on the lane, not on the straight line between its ends
    const sc = JSON.parse(fs.readFileSync(new URL("../../scenarios/historical-1440/scenario.json", import.meta.url)));
    const zones = new Map(sc.seaZones.map((z) => [z.id, z]));
    const lane = zones.get("kattegat").lanes["baltic-sea"];
    const state = { fleets: { 1: { id: 1, zone: "kattegat", moving: { to: "baltic-sea", start: 0, end: 100 }, port: null } } };
    const [x, y] = fleetPoints(state, new Map(), zones, 50).get(1);
    const onSegment = lane.slice(1).some((b, i) => {
        const a = lane[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return Math.abs(Math.hypot(x - a[0], y - a[1]) + Math.hypot(b[0] - x, b[1] - y) - len) < 1e-6;
    });
    assert.ok(lane.length > 2 && onSegment, "on the lane's bends");
});

test("modernising: swords, older guns and — with muskets — cavalry given the best gun, the worst first, as the money allows; never pikes", () => {
    const prices = { muskets: 100000, arquebuses: 70000, handCannons: 50000 };
    const men = { unarmed: 50, swords: 1200, pikes: 900, cavalry: 300, handCannons: 600, arquebuses: 400, muskets: 100 };
    const country = (techs, treasury, reserve = {}) => ({ techs, treasury, reserve });
    assert.equal(modernising(country(["swords", "pikes"], 1e6), men, prices), null, "no gun researched: nothing to modernise to");
    assert.deepEqual(modernising(country(["handCannons", "arquebuses", "muskets"], 1e6, { muskets: 200 }), men, prices),
        { weapon: "muskets", want: 2500, n: 2500, lots: 3, cost: 300000, jobs: [{ from: "swords", n: 1200 }, { from: "handCannons", n: 600 }, { from: "cavalry", n: 300 }, { from: "arquebuses", n: 400 }] });
    assert.ok(!modernising(country(["arquebuses"], 1e6), men, prices).jobs.some((j) => j.from === "cavalry"), "before muskets the cavalry stays");
    // a treasury for one lot: 200 from the reserve and 1000 bought, the swords first
    assert.deepEqual(modernising(country(["muskets"], 150000, { muskets: 200 }), men, prices), { weapon: "muskets", want: 2500, n: 1200, lots: 1, cost: 100000, jobs: [{ from: "swords", n: 1200 }] });
    assert.deepEqual(modernising(country(["handCannons"], 0), men, prices), { weapon: "handCannons", want: 1200, n: 0, lots: 0, cost: 0, jobs: [] }, "nothing to pay with");
    assert.equal(modernising(country(["handCannons"], 1e6), { ...men, swords: 0 }, prices), null, "only pikes, cavalry and guns as good");
    const state = { armies: { 1: { owner: "BAV", men }, 2: { owner: "BAV", men: { ...men, swords: 0 } }, 3: { owner: "AUS", men } } };
    assert.deepEqual([outdatedMen(state, "BAV", "muskets"), outdatedMen(state, "BAV", "arquebuses"), outdatedMen(state, "BAV", "sharpshooters")], [2500 + 1300, 1800 + 600, 0]);
});

test("pikes to muskets: every pikeman of an army or none, once muskets are researched — the reserve first, whole lots bought", () => {
    const prices = { muskets: 100000 }, men = { pikes: 2500, muskets: 5000 };
    assert.equal(pikesToMuskets({ techs: ["arquebuses"], reserve: {}, treasury: 1e6 }, men, prices), null, "no muskets yet");
    assert.equal(pikesToMuskets({ techs: ["muskets"], reserve: {}, treasury: 1e6 }, { ...men, pikes: 0 }, prices), null, "no pikes");
    assert.deepEqual(pikesToMuskets({ techs: ["muskets"], reserve: { muskets: 600 }, treasury: 250000 }, men, prices), { n: 2500, lots: 2, cost: 200000, affordable: true });
    assert.equal(pikesToMuskets({ techs: ["muskets"], reserve: {}, treasury: 250000 }, men, prices).affordable, false, "3 lots: 300,000");
});
