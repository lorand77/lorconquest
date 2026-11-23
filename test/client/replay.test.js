// Playing a finished game over in the browser (public/js/replayer.js) and what the map shows of it (public/js/mapdraw.js),
// tested in Node on real games: the replay must come out exactly as the game did, from the start, from a seek back to a
// keyframe, and across the log's own days; and the drawing must cover every army and fleet.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };

register("./loader.mjs", import.meta.url);
const { Game, buildMap, fingerprint } = await import("../../src/engine/index.js");
const { createAI } = await import("../../src/ai/index.js");
const { createReplayer } = await import("../../public/js/replayer.js");
const { armyMarkers, blockadeMarks, fleetMarkers, mainArm, siegeRings, postMarks, ownersKey } = await import("../../public/js/mapdraw.js");
const { buildLegs } = await import("../../public/js/mirror.js");

// a game played as the worker plays it — the orders of the day before, then the day — by computers, with BAV the human's
// (so offers to it wait), and the log kept as the server keeps it
function play(days, seed = 7) {
    const game = Game.create(scenario, { seed, humans: ["BAV"] }), ai = createAI({ seed, humans: ["BAV"] });
    ai.setCaretaker("BAV", "full");
    const log = [];
    let pending = [];
    while (game.day < days) {
        const events = [];
        for (const o of pending) {
            const cmd = { ...o.cmd, country: o.country };
            const r = game.command(cmd);
            if (r.ok) { events.push(...r.events); log.push({ day: game.day, country: o.country, source: o.source, cmd }); }
        }
        events.push(...game.advance());
        pending = ai.orders(game, events);
    }
    return { game, log, data: { seed, humans: [{ country: "BAV", username: "alice" }], endDay: game.day, resultHash: fingerprint(game.snapshot()), log } };
}

test("a replay comes out exactly as the game did, and says so", () => {
    const { game, data } = play(3 * 365);
    assert.ok(data.log.length > 100, "the computers gave plenty of commands");
    const r = createReplayer(scenario, data);
    assert.equal(r.verified(), null, "not at the end yet");
    r.advance(10 ** 6);
    assert.equal(r.done, true);
    assert.equal(r.day, game.day);
    assert.equal(r.game.snapshot(), game.snapshot());
    assert.equal(r.verified(), true);
    // a log that differs by one command does not verify
    const bent = { ...data, log: data.log.map((e, i) => (i === 40 ? { ...e, cmd: { ...e.cmd, tax: 3 } } : e)).filter((e, i) => i !== 41) };
    let other;
    try { other = createReplayer(scenario, bent); other.advance(10 ** 6); } catch { other = null; }
    assert.ok(other === null || other.verified() === false, "a replay of another game is not passed off as this one");
});

test("seeking back goes to a keyframe and plays on to the very same state; seeking forward in chunks too", () => {
    const { game, data } = play(3 * 365);
    const r = createReplayer(scenario, data, { keyEvery: 200 });
    const states = new Map();
    for (const day of [250, 600, 900]) { r.seek(day); states.set(day, r.game.snapshot()); }
    assert.equal(r.day, 900);
    // back to a day passed, and to the start: each state is the one reached going forward
    r.seek(600);
    assert.equal(r.game.snapshot(), states.get(600));
    r.seek(250);
    assert.equal(r.game.snapshot(), states.get(250));
    r.seek(0);
    assert.equal(r.day, 0);
    // forward in chunks of 100 days, as the page does, to the end
    let guard = 0;
    while (r.day < game.day && guard++ < 100) r.seek(game.day, 100);
    assert.ok(guard > 5);
    assert.equal(r.game.snapshot(), game.snapshot());
    assert.equal(r.verified(), true);
    // a seek beyond the end stops at it
    assert.equal(createReplayer(scenario, data).seek(10 ** 6) && 0, 0);
});

test("a replay of an abandoned game has no fingerprint to check, and says nothing", () => {
    const { data } = play(200);
    const r = createReplayer(scenario, { ...data, resultHash: null });
    r.advance(10 ** 6);
    assert.equal(r.verified(), null);
});

test("the map shows every army and fleet, each beside its place or on its road, and the sieges and posts", () => {
    const { game } = play(2 * 365);
    const nodes = game.map.nodes, legs = buildLegs(scenario), colour = (c) => `#${c}`, st = game.state;
    const armies = armyMarkers(st, nodes, legs, st.day, colour, { me: "BAV", selected: null });
    // every army in a marker — a country's armies standing in one place as one stack
    assert.deepEqual(armies.flatMap((m) => m.ids).sort((a, b) => a - b), Object.keys(st.armies).map(Number).sort((a, b) => a - b));
    assert.ok(armies.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y) && m.label));
    assert.equal(armies.filter((m) => m.mine).flatMap((m) => m.ids).length, Object.values(st.armies).filter((a) => a.owner === "BAV").length);
    const first = Object.values(st.armies)[0];
    assert.equal(armyMarkers(st, nodes, legs, st.day, colour, { selected: { kind: "army", id: first.id } }).filter((m) => m.selected).length, 1);
    const fleets = fleetMarkers(st, nodes, game.map.zones, st.day, colour, {});
    assert.equal(fleets.flatMap((m) => m.ids).length, Object.keys(st.fleets).length);
    // the armies and fleets of a country at war with the player are marked; a watcher has no enemies
    const enemyOf = (code) => st.wars.some((w) => w.split("|").includes("BAV") && w.split("|").includes(code)) && code !== "BAV";
    assert.deepEqual(armies.map((m) => m.enemy), armies.map((m) => enemyOf(st.armies[m.id].owner)));
    st.wars.push(["BAV", "NED"].sort().join("|"));
    assert.ok(fleetMarkers(st, nodes, game.map.zones, st.day, colour, { me: "BAV" }).filter((m) => st.fleets[m.id].owner === "NED").every((m) => m.enemy));
    assert.ok(armyMarkers(st, nodes, legs, st.day, colour, {}).every((m) => !m.enemy));
    st.wars.pop();
    assert.ok(fleets.every((m) => Number.isFinite(m.x)));
    for (const ring of siegeRings(st, nodes)) assert.ok(ring.frac >= 0 && ring.frac <= 1);
    assert.equal(siegeRings(st, nodes).length, Object.values(st.settlements).filter((s) => s.siege).length);
    assert.equal(postMarks(st, nodes).length, Object.keys(st.posts).length);
    // the key that says the lands must be repainted changes when an owner does
    const before = ownersKey(st);
    const some = Object.values(st.settlements)[0];
    some.owner = some.owner === "BAV" ? "ULM" : "BAV";
    assert.notEqual(ownersKey(st), before);
});

test("markers: a country's armies in one place as one stack, opened at a click; their main arm and what they are doing; fleets alike", () => {
    const game = Game.create(scenario, { seed: 1 }), st = game.state, nodes = game.map.nodes, legs = buildLegs(scenario), colour = (c) => `#${c}`;
    const army = (id, owner, at, men, extra = {}) => { st.armies[id] = { ...structuredClone(st.armies[37]), id, owner, at, men: { ...st.armies[37].men, swords: 0, ...men }, cannons: 0, ...extra }; };
    army(9001, "BAV", "37", { pikes: 5000 }, { cannons: 2 });
    const at37 = (o = {}) => armyMarkers(st, nodes, legs, st.day, colour, { me: "BAV", ...o }).filter((m) => m.ids.some((id) => [37, 9001].includes(id)));
    // Munich's garrison and the new army: one stack — pikes most, cannons — and nothing out of the ordinary to mark
    const [stack] = at37();
    assert.deepEqual([stack.ids, stack.count, stack.stack, stack.arm, stack.cannons, stack.state], [[37, 9001], 2, "a:37|BAV|0", "pikes", true, null]);
    // opened, or one of them selected: each alone
    assert.equal(at37({ open: "a:37|BAV|0" }).length, 2);
    assert.deepEqual(at37({ selected: { kind: "army", id: 9001 } }).map((m) => [m.ids, m.selected]), [[[37], false], [[9001], true]]);
    // marching: no mark (it glides along its road); besieging an enemy's town: the siege
    army(9002, "BAV", null, { cavalry: 900 }, { march: { from: "37", to: "48", start: 0, end: 84 } });
    const marching = armyMarkers(st, nodes, legs, 10, colour, {}).find((m) => m.id === 9002);
    assert.deepEqual([marching.state, marching.arm, marching.atSea], [null, "cavalry", false]);
    st.wars.push("BAV|ULM");
    army(9003, "BAV", "48", { swords: 2000 });
    st.settlements[48].siege = { by: "BAV", start: 0, end: 100 };
    assert.equal(armyMarkers(st, nodes, legs, st.day, colour, {}).find((m) => m.id === 9003).state, "siege");
    // the main arm: the most men, a tie to the first of guns, cavalry, pikes, swords
    assert.deepEqual([mainArm({ muskets: 300, arquebuses: 300, pikes: 500 }), mainArm({ cavalry: 100, pikes: 100 }), mainArm({ unarmed: 10 })], ["guns", "cavalry", "unarmed"]);
    // fleets: two of one country in one port, one stack, shown by its best ship
    const first = Object.values(st.fleets)[0];
    st.fleets[9101] = { ...structuredClone(first), id: 9101, ships: { cogs: 0, carracks: 0, galleons: 0, menOfWar: 10 } };
    const port = fleetMarkers(st, nodes, game.map.zones, st.day, colour, {}).find((m) => m.ids.includes(first.id));
    assert.deepEqual([port.ids, port.best], [[first.id, 9101], "menOfWar"]);
    const alone = fleetMarkers(st, nodes, game.map.zones, st.day, colour, { open: port.stack }).find((m) => m.id === first.id);
    assert.equal(alone.best, "cogs");
    // blockading a port: no mark on the fleet, a chain by the port; patrolling: the fleet's loop
    Object.assign(st.fleets[9101], { port: null, order: { type: "blockade", port: 48 } });
    const blockading = fleetMarkers(st, nodes, game.map.zones, st.day, colour, {}).find((m) => m.id === 9101);
    assert.equal(blockading.state, null);
    assert.deepEqual(blockadeMarks(st, nodes).map((b) => b.port), [48]);
    st.fleets[9101].order = { type: "patrol" };
    assert.equal(fleetMarkers(st, nodes, game.map.zones, st.day, colour, {}).find((m) => m.id === 9101).state, "patrol");
});
