// Random play: many seeded games of 45 countries giving random commands of every kind, checking after each month
// that the state is still sane — no NaN, no negative men or people, ids and positions consistent, nothing in a
// place that does not exist — and that a snapshot restores exactly. Most commands are refused; what matters is that
// none throws and none leaves the state broken.
import test from "node:test";
import assert from "node:assert/strict";
import docsScenario from "../../docs/scenario.json" with { type: "json" };
import fs from "node:fs";
import path from "node:path";
import { COMMAND_TYPES, Game, WEAPONS, menOf } from "../../src/engine/index.js";
import { isMonthStart } from "../../src/engine/calendar.js";

function dice(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function check(game, where) {
    const st = game.state, nodes = game.map.nodes;
    const walk = (x, path) => {
        if (typeof x === "number") assert.ok(Number.isFinite(x), `${where}: ${path} is ${x}`);
        else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
    };
    walk(st, "state");
    for (const [id, a] of Object.entries(st.armies)) {
        assert.equal(a.id, Number(id), `${where}: army key`);
        assert.ok(st.countries[a.owner], `${where}: army ${id} of nobody`);
        assert.ok(a.at ? nodes.has(a.at) : a.march && nodes.has(a.march.from) && nodes.has(a.march.to), `${where}: army ${id} is nowhere`);
        assert.ok(!(a.at && a.march), `${where}: army ${id} is at a place and on a road`);
        for (const w of WEAPONS) assert.ok(Number.isInteger(a.men[w]) && a.men[w] >= 0, `${where}: army ${id} has ${a.men[w]} ${w}`);
        assert.ok(a.cannons >= 0 && Number.isInteger(a.cannons) && a.crew >= 0 && Number.isInteger(a.crew), `${where}: army ${id} cannons/crew`);
        assert.ok(a.mercs >= 0 && a.mercs <= menOf(a), `${where}: army ${id} has ${a.mercs} mercenaries of ${menOf(a)} men`);
        assert.ok(menOf(a) + a.cannons + a.crew > 0, `${where}: army ${id} is empty`);
    }
    for (const [id, f] of Object.entries(st.fleets)) {
        assert.equal(f.id, Number(id));
        assert.ok(st.countries[f.owner], `${where}: fleet ${id} of nobody`);
        const ships = Object.values(f.ships);
        assert.ok(ships.every((n) => Number.isInteger(n) && n >= 0) && ships.some((n) => n > 0), `${where}: fleet ${id} ships ${JSON.stringify(f.ships)}`);
        assert.ok(game.map.zones.has(f.zone), `${where}: fleet ${id} in no zone`);
        assert.ok(!(f.port && f.moving), `${where}: fleet ${id} in port and sailing`);
    }
    for (const s of Object.values(st.settlements)) {
        assert.ok(s.pop >= 0 && st.countries[s.owner], `${where}: settlement ${s.id}`);
        assert.ok(!s.siege || (s.siege.end > s.siege.start && st.countries[s.siege.by]), `${where}: siege of ${s.id}`);
    }
    for (const c of Object.values(st.countries)) {
        if (c.rebel) { assert.ok(st.countries[c.of], `${where}: ${c.code} rose against nobody`); continue; }
        assert.ok(c.bank >= 0 && c.loans >= 0 && c.loans % 50000 === 0, `${where}: ${c.code} bank/loans`);
        for (const [w, n] of Object.entries(c.reserve)) assert.ok(Number.isInteger(n) && n >= 0, `${where}: ${c.code} reserve ${w} ${n}`);
    }
    for (const w of st.wars) for (const code of w.split("|")) assert.ok(st.countries[code], `${where}: war with ${code}`);
    for (const w of st.wars) {
        const [a, b] = w.split("|");
        if (!st.countries[a].rebel && !st.countries[b].rebel) assert.ok(st.warInfo[w], `${where}: war ${w} has no record`);
    }
    for (const k of Object.keys(st.warInfo)) assert.ok(st.wars.includes(k), `${where}: a record of a war that is over: ${k}`);
    for (const x of st.agreements) {
        assert.ok(["defensive", "military", "guarantee", "access", "pact", "truce"].includes(x.kind), `${where}: agreement ${x.kind}`);
        assert.ok(st.countries[x.a] && st.countries[x.b] && !st.countries[x.a].rebel && !st.countries[x.b].rebel && x.a !== x.b, `${where}: agreement of ${x.a} and ${x.b}`);
        assert.ok(x.until === null || x.until > st.day, `${where}: an agreement that has run out`);
        if (x.kind === "defensive" || x.kind === "military") assert.ok(!st.countries[x.a].subjectKind || st.countries[x.a].subjectKind !== "vassal", `${where}: a vassal in an alliance`);
    }
    for (const c of Object.values(st.countries)) {
        assert.ok(c.rebel || c.warmonger >= 0, `${where}: ${c.code} warmonger ${c.warmonger}`);
        if (c.overlord) {
            assert.ok(st.countries[c.overlord] && !st.countries[c.overlord].rebel && c.overlord !== c.code, `${where}: ${c.code} overlord ${c.overlord}`);
            assert.ok(["vassal", "protectorate"].includes(c.subjectKind), `${where}: ${c.code} kind ${c.subjectKind}`);
            assert.ok(st.countries[c.overlord].overlord !== c.code, `${where}: ${c.code} and ${c.overlord} are each other's overlords`);
        }
    }
    for (const o of st.offers) assert.ok(st.countries[o.from] && st.countries[o.to] && o.deadline > st.day && st.humans.includes(o.to), `${where}: offer ${JSON.stringify(o)}`);
    for (const [k, p] of Object.entries(st.posts)) assert.ok(p.n > 0 && nodes.get(k).kind === "pass", `${where}: post ${k}`);
}

// commands that need the right setting to be accepted at all are built from a setting that fits
function targetedCommand(game, r) {
    const st = game.state, pick = (list) => list[Math.floor(r() * list.length)], int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    const armies = Object.values(st.armies).filter((a) => a.at && !a.retreating);
    const kind = pick(["equip", "break", "fleets", "peace", "peace", "answer", "answer", "attack", "attack", "attack", "besiege", "storm", "merge", "split", "equipCannons", "disband", "buySharpshooters", "stormPost", "sortie"]);
    if (kind === "peace") {                                           // a country at war asks its enemy for peace on some terms
        const w = pick(st.wars.filter((x) => !x.split("|").some((c) => st.countries[c].rebel)));
        if (!w) return null;
        const [a, b] = r() < 0.5 ? w.split("|") : w.split("|").reverse();
        const mine = Object.values(st.settlements).filter((x) => x.owner === a), theirs = Object.values(st.settlements).filter((x) => x.owner === b);
        const terms = {};
        if (r() < 0.5 && theirs.length) terms.take = [pick(theirs).id];
        if (r() < 0.3 && mine.length) terms.give = [pick(mine).id];
        if (r() < 0.3) terms.money = int(-50000, 50000);
        if (r() < 0.2) terms[pick(["makeSubject", "becomeSubject"])] = pick(["vassal", "protectorate"]);
        return { type: "proposePeace", country: a, with: b, terms };
    }
    if (kind === "equip") {                                           // arm men with what the reserve holds
        const pairs = armies.filter((a) => !st.countries[a.owner].rebel).flatMap((a) => WEAPONS.filter((w) => a.men[w] > 0).flatMap((from) => ["swords", "pikes", "cavalry", "handCannons", "arquebuses", "muskets"]
            .filter((to) => to !== from && st.countries[a.owner].reserve[to] > 0).map((to) => [a, from, to])));
        if (!pairs.length) return null;
        const [a, from, to] = pick(pairs);
        return { type: "equip", country: a.owner, army: a.id, from, to, n: Math.max(1, Math.min(a.men[from], st.countries[a.owner].reserve[to], int(1, 400))) };
    }
    if (kind === "break") {                                           // a country breaks one of its agreements
        const x = pick(st.agreements);
        if (!x) return null;
        return { type: "breakAgreement", country: x.kind === "guarantee" ? x.a : pick([x.a, x.b]), with: undefined, kind: x.kind, _x: x };
    }
    if (kind === "fleets") {                                          // two fleets of one country in one place merge
        const fleets = Object.values(st.fleets);
        const pairs = fleets.flatMap((a) => fleets.filter((b) => b.id !== a.id && b.owner === a.owner && b.zone === a.zone && b.port === a.port && !a.moving && !b.moving).map((b) => [a, b]));
        if (!pairs.length) return null;
        const [a, b] = pick(pairs);
        return { type: "mergeFleet", country: a.owner, fleet: a.id, into: b.id };
    }
    if (kind === "answer") {                                          // a human answers what it was asked
        const o = pick(st.offers);
        return o ? { type: "answerOffer", country: o.to, id: o.id, accept: r() < 0.6 } : null;
    }
    if (kind === "attack") {                                          // declare war on a neighbour, then march on it
        const a = pick(armies);
        if (!a) return null;
        const owner = (key) => st.settlements[game.map.nodes.get(key).land].owner;
        const edges = game.map.adj.get(a.at).filter((e) => owner(e.to) !== a.owner);
        if (!edges.length) return null;
        const e = pick(edges), o = owner(e.to);
        const war = st.wars.includes(a.owner < o ? `${a.owner}|${o}` : `${o}|${a.owner}`);
        return war ? { type: "move", country: a.owner, army: a.id, to: e.to, storm: r() < 0.4 } : { type: "declareWar", country: a.owner, target: o };
    }
    if (kind === "buySharpshooters") {
        const p = pick(game.map.scenario.passes);
        return { type: kind, country: st.settlements[p.land].owner, pass: p.id, lots: int(1, 2) };
    }
    if (kind === "stormPost") {
        const posted = armies.filter((a) => st.posts[a.at]);
        return posted.length ? { type: kind, country: pick(posted).owner, army: pick(posted).id } : null;
    }
    if (kind === "besiege" || kind === "storm") {
        const there = armies.filter((a) => game.map.nodes.get(a.at).kind === "settlement" && st.settlements[a.at].owner !== a.owner);
        if (!there.length) return null;
        const a = pick(there);
        if (r() < 0.5 && !st.wars.includes(a.owner < st.settlements[a.at].owner ? `${a.owner}|${st.settlements[a.at].owner}` : `${st.settlements[a.at].owner}|${a.owner}`)) {
            return { type: "declareWar", country: a.owner, target: st.settlements[a.at].owner };
        }
        return { type: kind, country: a.owner, army: a.id };
    }
    if (kind === "sortie") {
        const besieged = armies.filter((a) => game.map.nodes.get(a.at).kind === "settlement" && st.settlements[a.at].siege && st.settlements[a.at].owner === a.owner);
        return besieged.length ? { type: kind, country: pick(besieged).owner, army: pick(besieged).id } : null;
    }
    if (kind === "merge") {
        const pairs = armies.flatMap((a) => armies.filter((b) => b.id !== a.id && b.at === a.at && b.owner === a.owner).map((b) => [a, b]));
        if (!pairs.length) return null;
        const [a, b] = pick(pairs);
        return { type: kind, country: a.owner, army: a.id, into: b.id };
    }
    const a = pick(armies.filter((x) => menOf(x) > 1));
    if (!a) return null;
    if (kind === "equipCannons") return { type: kind, country: a.owner, army: a.id, n: int(1, 3) };
    const w = pick(WEAPONS.filter((x) => a.men[x] > 0));
    if (kind === "disband") return { type: kind, country: a.owner, army: a.id, men: { [w]: int(1, a.men[w]) } };
    return { type: "split", country: a.owner, army: a.id, men: { [w]: int(1, Math.max(1, Math.floor(a.men[w] / 2))) }, cannons: 0, crew: 0 };
}

function randomCommand(game, r) {
    if (r() < 0.4) {
        const t = targetedCommand(game, r);
        if (t?._x) { const x = t._x; delete t._x; t.with = t.country === x.a ? x.b : x.a; }
        if (t) return t;
    }
    const st = game.state, codes = Object.keys(st.countries).filter((c) => !st.countries[c].rebel);
    const pick = (list) => list[Math.floor(r() * list.length)];
    const country = pick(codes);
    const armies = Object.values(st.armies).filter((a) => a.owner === country), fleets = Object.values(st.fleets).filter((f) => f.owner === country);
    const own = Object.values(st.settlements).filter((s) => s.owner === country);
    const army = armies.length ? pick(armies) : null, fleet = fleets.length ? pick(fleets) : null, place = own.length ? pick(own) : null;
    const type = pick(COMMAND_TYPES), int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    const nodeKeys = game.map.keys, passes = game.map.scenario.passes, zones = [...game.map.zones.keys()];
    const w = pick(WEAPONS), a = { type, country };
    switch (type) {
        case "declareWar": return { ...a, target: pick(codes) };
        case "proposePeace": return { ...a, with: pick(codes), terms: {} };
        case "proposeAgreement": return { ...a, with: pick(codes), kind: pick(["defensive", "military", "guarantee", "pact", "access"]) };
        case "breakAgreement": return { ...a, with: pick(codes), kind: pick(["defensive", "military", "guarantee", "pact", "truce"]) };
        case "cancelAccess": return { ...a, with: pick(codes) };
        case "demandSubject": return { ...a, target: pick(codes), kind: pick(["vassal", "protectorate"]) };
        case "proposeEmpire": return a;
        case "answerOffer": { const o = pick(st.offers); return { ...a, id: o?.id, accept: r() < 0.5 }; }
        case "move": return { ...a, army: army?.id, to: pick(nodeKeys), storm: r() < 0.3 };
        case "stop": case "besiege": case "storm": case "sortie": case "stormPost": return { ...a, army: army?.id };
        case "split": return { ...a, army: army?.id, men: { [w]: int(0, 600) }, cannons: int(0, 2), crew: int(0, 30) };
        case "merge": return { ...a, army: army?.id, into: pick(armies)?.id };
        case "setTax": return { ...a, tax: 2 + int(0, 10) / 10 };
        case "setSlider": return { ...a, slider: int(0, 10) * 10 };
        case "setLaw": return { ...a, law: pick(["feudal", "standing", "militarized", "mass", "barrel"]) };
        case "research": return { ...a, tech: pick(["handCannons", "arquebuses", "muskets", "sharpshooters", "carracks", "galleons", "menOfWar"]) };
        case "setCapital": return { ...a, settlement: place?.id };
        case "defaultOnLoans": return a;
        case "deposit": case "withdraw": return { ...a, amount: int(1, 200000) };
        case "borrow": case "repay": return { ...a, chunks: int(1, 4) };
        case "buyBuilding": return { ...a, building: pick(["walls", "library", "workshop", "market", "courthouse"]), settlement: place?.id };
        case "buyWeapons": return { ...a, weapon: pick(["swords", "pikes", "cavalry", "handCannons", "arquebuses", "muskets", "cannons"]), lots: int(1, 3) };
        case "buyPeople": return { ...a, lots: int(1, 2) };
        case "buySharpshooters": return { ...a, pass: pick(passes).id, lots: int(1, 3) };
        case "buyShips": return { ...a, kind: pick(["cogs", "carracks", "galleons", "menOfWar"]), port: place?.id, lots: int(1, 2) };
        case "raise": return { ...a, settlement: place?.id, kind: pick(["soldiers", "crew"]), lots: int(1, 2) };
        case "hireMercenaries": return { ...a, settlement: place?.id, lots: 1 };
        case "equip": return { ...a, army: army?.id, from: pick(WEAPONS), to: pick(WEAPONS), n: int(1, 500) };
        case "equipCannons": return { ...a, army: army?.id, n: int(-3, 6) };
        case "disband": return { ...a, army: army?.id, men: { [w]: int(0, 400) }, cannons: int(0, 1), crew: int(0, 20) };
        case "dismissMercenaries": return { ...a, army: army?.id, n: int(1, 300) };
        case "proclaim": return { ...a, region: pick(game.map.scenario.formables).id };
        case "sail": return r() < 0.3 ? { ...a, fleet: fleet?.id, port: place?.id } : { ...a, fleet: fleet?.id, zone: pick(zones) };
        case "blockade": return { ...a, fleet: fleet?.id, port: pick(Object.values(st.settlements)).id };
        case "patrol": case "hold": return { ...a, fleet: fleet?.id };
        case "splitFleet": return { ...a, fleet: fleet?.id, ships: { cogs: int(0, 8), carracks: int(0, 2) } };
        case "mergeFleet": return { ...a, fleet: fleet?.id, into: pick(fleets)?.id };
        default: throw new Error(`the fuzz does not know ${type}`);
    }
}

// FUZZ_SCENARIO=historical-1440 plays the other scenario, which opens with wars and alliances
const scenario = process.env.FUZZ_SCENARIO ? JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "..", "scenarios", process.env.FUZZ_SCENARIO, "scenario.json"), "utf8")) : docsScenario;
// FUZZ_SEEDS and FUZZ_YEARS make it bigger, for a hunt (the defaults keep `npm test` quick)
const SEEDS = Number(process.env.FUZZ_SEEDS ?? 4), YEARS = Number(process.env.FUZZ_YEARS ?? 3);

test("random play: 45 countries giving every kind of command keep the state sane, and a snapshot restores exactly", { timeout: 3600000 }, () => {
    const accepted = new Map(), happened = new Map();
    const note = (events) => { for (const e of events) happened.set(e.type, (happened.get(e.type) ?? 0) + 1); };
    for (let seed = 1; seed <= SEEDS; seed++) {
        const game = Game.create(scenario, { seed, humans: scenario.countries.filter((c, i) => i % 15 === 3).map((c) => c.code) }), r = dice(seed * 7919);
        // so that buying often works, and cannons, crews and sharpshooters have something to do
        Object.values(game.state.countries).forEach((c, i) => {
            Object.assign(c, { treasury: 3e6, tax: 2.5, techs: i % 2 ? c.techs : [...c.techs, "handCannons", "arquebuses", "muskets", "sharpshooters", "carracks", "galleons", "menOfWar"] });
            c.reserve.cannons = 20;
        });
        Object.values(game.state.armies).forEach((a, i) => { if (i % 3 === 0) a.crew = 200; });
        for (let day = 0; day < 365 * YEARS; day++) {
            if (day % 3 === 0) {
                for (let k = 0; k < 6; k++) {
                    const cmd = randomCommand(game, r), res = game.command(cmd);
                    if (res.ok) { accepted.set(cmd.type, (accepted.get(cmd.type) ?? 0) + 1); note(res.events); }
                }
            }
            note(game.advance());
            if (isMonthStart(game.day)) check(game, `seed ${seed} day ${game.day}`);
        }
        check(game, `seed ${seed} end`);
        assert.equal(Game.restore(scenario, game.snapshot()).snapshot(), game.snapshot());
    }
    if (process.env.FUZZ_REPORT) console.log([...happened].sort().map(([k, v]) => `${k}:${v}`).join(" "));
    // diplomacy really happened: wars joined by others, agreements signed, peaces made, subjects made
    for (const type of ["joins", "agreement", "peace", "subject"]) assert.ok(happened.get(type) > 0, `no ${type} event in the whole fuzz`);
    // the fuzz is only worth anything if it does things: nearly every kind of command was accepted at least once
    const never = COMMAND_TYPES.filter((t) => !accepted.has(t));
    assert.deepEqual(never.filter((t) => !["stormPost", "setCapital", "proclaim", "blockade", "cancelAccess", "proposeEmpire"].includes(t)), [], "never accepted");
});
