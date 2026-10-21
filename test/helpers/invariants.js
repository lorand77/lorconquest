// What must be true of any game's state at any time, whoever played it: no NaN, no negative men or people, ids and
// positions consistent, nothing in a place that does not exist, no army without men. The random-play fuzz checks it every
// month, and so do the games of computer players.
import assert from "node:assert/strict";
import { WEAPONS, menOf } from "../../src/engine/index.js";

export function check(game, where) {
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
    // a country with no settlement is out of the game, and one that is out has nothing left (RULES.md §10, Elimination)
    const landed = new Set(Object.values(st.settlements).map((s) => s.owner));
    for (const c of Object.values(st.countries)) {
        if (c.rebel) continue;
        if (!landed.has(c.code)) assert.ok(c.out !== null, `${where}: ${c.code} has no settlement and is still in the game`);
        if (c.out === null) continue;
        assert.ok(!landed.has(c.code), `${where}: ${c.code} is out and holds a settlement`);
        assert.ok(!Object.values(st.armies).some((a) => a.owner === c.code) && !Object.values(st.fleets).some((x) => x.owner === c.code), `${where}: ${c.code} is out and has forces`);
        assert.ok(!st.wars.some((w) => w.split("|").includes(c.code)), `${where}: ${c.code} is out and at war`);
        assert.ok(!st.agreements.some((x) => x.a === c.code || x.b === c.code), `${where}: ${c.code} is out and bound by an agreement`);
        assert.ok(!c.overlord && !Object.values(st.countries).some((x) => x.overlord === c.code), `${where}: ${c.code} is out and has an overlord or subjects`);
        assert.ok(!st.offers.some((o) => o.from === c.code || o.to === c.code), `${where}: a question to or from ${c.code}, which is out`);
    }
}
