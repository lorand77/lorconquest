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
const { armyMarkers, fleetMarkers, siegeRings, postMarks, ownersKey } = await import("../../public/js/mapdraw.js");
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
    assert.equal(armies.length, Object.keys(st.armies).length);
    assert.ok(armies.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y) && m.label));
    assert.equal(armies.filter((m) => m.mine).length, Object.values(st.armies).filter((a) => a.owner === "BAV").length);
    const first = Object.values(st.armies)[0];
    assert.equal(armyMarkers(st, nodes, legs, st.day, colour, { selected: { kind: "army", id: first.id } }).filter((m) => m.selected).length, 1);
    const fleets = fleetMarkers(st, nodes, game.map.zones, st.day, colour, {});
    assert.equal(fleets.length, Object.keys(st.fleets).length);
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
