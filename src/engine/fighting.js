// War on the map (RULES.md §5, §6, §8): what an arriving army does — take, besiege, stop, fight — battles at
// passes and to relieve sieges, head-on meetings on routes, storms, sorties, and sieges to their surrender.
//
// At a settlement its owner's armies are the garrison, inside; the owner's armies that arrived while it was
// besieged are a relief force, outside, until they have fought the besiegers; the owner's enemies there are
// besiegers. A garrison only fights when it sorties or is stormed.

import { YEAR_DAYS } from "./calendar.js";
import { fight, mayFight } from "./battle.js";
import { legKey } from "./map.js";
import { recordCapture } from "./diplomacy.js";
import { cancelAt } from "./forces.js";
import { destroy, mayDepart, progress, retreat, routeFor, startLeg } from "./movement.js";
import { fireSharpshooters, postsLost, stormPost } from "./passes.js";
import { d6 } from "./random.js";
import { armiesAt, armyList, atWar, canEnter, isAlive, isFriend, ownerOf, removeArmy } from "./state.js";
import { menOf } from "./army.js";

export function situation(game, key) {
    const st = game.state, node = game.map.nodes.get(key), here = armiesAt(st, key);
    if (node.kind !== "settlement") return { node, here };
    const s = st.settlements[node.id];
    // the settlement's defenders are its owner's armies and its friends' (allies, subjects, an overlord) that are at war
    // with someone besieging it; its enemies there are the armies at war with its owner
    const hostile = here.filter((a) => atWar(st, a.owner, s.owner));
    const defends = (a) => a.owner === s.owner || (isFriend(st, a.owner, s.owner) && hostile.some((h) => atWar(st, a.owner, h.owner)));
    return {
        node, here, s, hostile,
        garrison: here.filter((a) => defends(a) && !a.relief),
        relief: here.filter((a) => defends(a) && a.relief),
    };
}

// siege length (RULES.md §6): pop ÷ 20000 years, ×2 with walls, less 20% per full 100 × x cannons, at least 40%
export function siegeDays(game, s, cannons) {
    const years = s.pop / 20000 * (s.walls ? 2 : 1) * Math.max(0.4, 1 - 0.2 * Math.floor(cannons / (100 * game.map.x)));
    return Math.max(1, Math.round(years * YEAR_DAYS));
}

// a garrison's defence in a storm (RULES.md §5): ×1.2, or ×1.8 behind walls less 0.3 for every 100 × x cannons
// the attacker brings, never below 1.2
export const wallDefence = (walls, cannons, x) => (walls ? Math.max(1.2, 1.8 - 0.3 * Math.floor(cannons / (100 * x))) : 1.2);

// a settlement falls (RULES.md §6, §8): it is held from today, loses its courthouse, the training and hires queued in
// it are cancelled, and sharpshooters of a pass in its land die. It keeps its walls, library, workshop and market,
// and stays core for every country that had it core, so retaking it makes it core again.
export function capture(game, s, country, events, how) {
    const from = s.owner;
    if (how !== "peace") recordCapture(game, s, from, country);
    s.owner = country;
    s.siege = null;
    s.heldSince = game.state.day;
    s.courthouse = false;
    cancelAt(game.state, s.id);
    events.push({ type: "capture", day: game.state.day, settlement: s.id, from, to: country, how });
    postsLost(game, s.id, events);
    for (const a of armiesAt(game.state, String(s.id))) if (!isFriend(game.state, a.owner, country)) a.relief = false;
}

// bring a settlement in line with who is there: enemies with nobody inside to stop them take it, enemies facing a
// garrison besiege it, and a siege with no besiegers left is lifted
export function settle(game, key, events) {
    const st = game.state;
    for (let guard = 0; guard < 8; guard++) {
        const { s, garrison, relief, hostile } = situation(game, key);
        if (!s) return;
        if (!hostile.length) {
            if (s.siege) {
                events.push({ type: "siegeLifted", day: st.day, settlement: s.id, by: s.siege.by });
                s.siege = null;
            }
            for (const a of relief) a.relief = false;
            return;
        }
        if (!garrison.length && relief.length) {        // nobody left inside: the relief force goes in
            for (const a of relief) a.relief = false;
            continue;
        }
        if (!garrison.length) {
            capture(game, s, hostile[0].owner, events, s.siege ? "siege" : "undefended");
            continue;
        }
        if (!s.siege) {
            const by = hostile[0].owner;
            const days = siegeDays(game, s, hostile.filter((a) => a.owner === by).reduce((n, a) => n + a.cannons, 0));
            s.siege = { by, start: st.day, end: st.day + days };
            events.push({ type: "siegeStart", day: st.day, settlement: s.id, by, days });
        }
        return;
    }
}

// storm (RULES.md §6): `country`'s armies at an enemy settlement attack its garrison, which defends behind its
// walls (wallDefence). If they win the settlement falls and the garrison rolls a d6: 1-3 it escapes with its
// losses, 4-6 it is lost.
export function storm(game, country, key, events) {
    const st = game.state, { s, garrison, hostile } = situation(game, key);
    const attackers = hostile.filter((a) => isFriend(st, a.owner, country));
    const defence = wallDefence(s.walls, attackers.reduce((n, a) => n + a.cannons, 0), game.map.x);
    const ev = fight(game, { kind: "storm", place: key, a: attackers, b: garrison, defenceB: defence, plainCavalry: true, tie: "b" });
    events.push(ev);
    if (ev.winner === "a") {
        ev.escape = d6(st);
        for (const g of garrison) {
            if (!isAlive(st, g)) continue;
            if (ev.escape <= 3) retreat(game, g, events, key);
            else destroy(game, g, events, "lost in the storm");
        }
        if (attackers.some((a) => isAlive(st, a))) capture(game, s, country, events, "storm");
    } else {
        for (const a of attackers) if (isAlive(st, a)) retreat(game, a, events, key);
    }
    settle(game, key, events);
}

// sortie (RULES.md §6): the garrison fights the besiegers in the open, no defence bonus. If it wins the besiegers
// retreat; if it loses it falls back inside and the siege goes on.
export function sortie(game, key, events) {
    const st = game.state, { garrison, hostile } = situation(game, key);
    const ev = fight(game, { kind: "sortie", place: key, a: garrison, b: hostile, tie: "a" });
    events.push(ev);
    if (ev.winner === "a") for (const b of hostile) if (isAlive(st, b)) retreat(game, b, events, key);
    settle(game, key, events);
}

// an army storms the sharpshooter post at its pass; the beaten army falls back (RULES.md §5)
export function stormThePost(game, country, key, events) {
    const ev = stormPost(game, country, key, events);
    if (ev.winner === "b") for (const id of ev.a.armies) if (game.state.armies[id]) retreat(game, game.state.armies[id], events, key);
    return ev;
}

// battles where enemies stand at the same place: at a pass, the army that got there first defends at ×2; at a
// besieged settlement, a relief force fights the besiegers in the open. Armies on cooldown wait.
export function placeBattles(game, events) {
    const st = game.state;
    for (const key of game.map.keys) {
        for (let guard = 0; guard < 8; guard++) {
            const here = armiesAt(st, key);
            if (here.length < 2) break;
            let fought = false;
            if (game.map.nodes.get(key).kind === "pass") {
                const owners = [...new Set(here.map((a) => a.owner))].sort();
                pairs: for (let i = 0; i < owners.length; i++) {
                    for (let j = i + 1; j < owners.length; j++) {
                        if (!atWar(st, owners[i], owners[j])) continue;
                        // each side is that country's armies and its friends' that are at war with the other
                        const side = (o, foe) => here.filter((a) => a.owner === o || (isFriend(st, a.owner, o) && atWar(st, a.owner, foe)));
                        const A = side(owners[i], owners[j]), B = side(owners[j], owners[i]);
                        if (!mayFight(st, A, B)) continue;
                        const first = (side) => Math.min(...side.map((a) => a.arrived));
                        const aHolds = first(A) < first(B) || (first(A) === first(B) && A[0].id < B[0].id);
                        const [att, def] = aHolds ? [B, A] : [A, B];
                        const ev = fight(game, { kind: "pass", place: key, a: att, b: def, defenceB: 2, plainCavalry: true, tie: "b" });
                        events.push(ev);
                        for (const l of ev.winner === "a" ? def : att) if (isAlive(st, l)) retreat(game, l, events, key);
                        fought = true;
                        break pairs;
                    }
                }
            } else {
                const { relief, hostile } = situation(game, key);
                if (relief.length && hostile.length && mayFight(st, relief, hostile)) {
                    const ev = fight(game, { kind: "relief", place: key, a: relief, b: hostile, tie: "a" });
                    events.push(ev);
                    for (const l of ev.winner === "a" ? hostile : relief) if (isAlive(st, l)) retreat(game, l, events, key);
                    fought = true;
                }
                settle(game, key, events);
            }
            if (!fought) break;
        }
    }
}

// head-on meetings (RULES.md §8): enemy armies marching towards each other on the same leg fight on the day they
// cross. The defender is whoever holds the nearer end, else whoever set out first; the loser retreats, the
// winner carries on. Armies that crossed while on cooldown have passed each other.
export function meetings(game, events) {
    const st = game.state, day = st.day, straits = game.map.straits;
    const legs = new Map();
    for (const a of armyList(st)) {
        if (!a.march) continue;
        const k = legKey(a.march.from, a.march.to);
        if (straits.has(k)) continue;                    // armies on a strait are at sea: they pass each other
        if (!legs.has(k)) legs.set(k, []);
        legs.get(k).push(a);
    }
    const crossed = (a, b) => progress(a.march, day) + progress(b.march, day) >= 1 && progress(a.march, day - 1) + progress(b.march, day - 1) < 1;
    for (const k of [...legs.keys()].sort()) {
        for (let guard = 0; guard < 16; guard++) {
            const list = legs.get(k).filter((a) => isAlive(st, a) && a.march && legKey(a.march.from, a.march.to) === k);
            let pair = null;
            find: for (const a of list) {
                for (const b of list) {
                    if (b.id > a.id && a.march.from === b.march.to && atWar(st, a.owner, b.owner) && crossed(a, b) && mayFight(st, [a], [b])) { pair = [a, b]; break find; }
                }
            }
            if (!pair) break;
            const [a, b] = pair;
            const alongside = (x) => list.filter((y) => y.owner === x.owner && y.march.from === x.march.from && Math.abs(y.march.start - x.march.start) < 1e-9);
            const A = alongside(a), B = alongside(b);
            // they crossed during the past day, at t; both sides are put back at that point, so the battle is
            // where they met, not where they had got to by today
            const t = (a.march.end - a.march.start + a.march.start + b.march.start) / 2, late = day - t;
            for (const x of [...A, ...B]) { x.march.start += late; x.march.end += late; }
            const f = Math.min(1, Math.max(0, progress(a.march, day)));
            const holder = ownerOf(game, f < 0.5 ? a.march.from : a.march.to);
            const aDefends = holder === a.owner || (holder !== b.owner && a.march.start <= b.march.start);
            const [att, def] = aDefends ? [B, A] : [A, B];
            const ev = fight(game, { kind: "route", place: k, a: att, b: def, tie: "b" });
            ev.along = { from: a.march.from, to: a.march.to, f };
            events.push(ev);
            for (const l of ev.winner === "a" ? def : att) if (isAlive(st, l)) retreat(game, l, events);
        }
    }
}

// an army has just reached army.at. Take, besiege, stop or fight there as RULES.md §6 and §8 say, then carry on
// along its path if nothing stopped it.
export function arrive(game, army, events) {
    if (game.map.nodes.get(army.at).kind === "pass") {
        fireSharpshooters(game, army, events);
        if (!isAlive(game.state, army)) return;
    }
    if (army.retreating) return arriveRetreating(game, army, events);
    const st = game.state, key = army.at, node = game.map.nodes.get(key);
    const last = army.path.length === 0;
    let stop = last;
    if (node.kind === "settlement") {
        const s = st.settlements[node.id];
        if (isFriend(st, army.owner, s.owner)) {
            if (situation(game, key).hostile.length) { stop = true; army.relief = true; }
        } else if (atWar(st, army.owner, s.owner)) {
            const { garrison, relief } = situation(game, key);
            if (garrison.length || relief.length) {
                stop = true;
                settle(game, key, events);
                const { garrison: inside, hostile } = situation(game, key);
                const ours = hostile.filter((a) => isFriend(st, a.owner, army.owner));
                if (last && army.storm && inside.length && mayFight(st, ours, inside)) storm(game, army.owner, key, events);
            } else settle(game, key, events);
        }
    } else if (armiesAt(st, key).some((a) => atWar(st, a.owner, army.owner))) stop = true;
    if (!isAlive(st, army) || !army.at) return;
    if (stop) {
        army.path = [];
        army.storm = false;
        events.push({ type: "arrive", day: st.day, army: army.id, owner: army.owner, at: key });
        return;
    }
    carryOn(game, army, events);
}

// on to the next place of its path; if its way has closed, find another to the same destination
function carryOn(game, army, events) {
    if (!canEnter(game, army.owner, army.path[0])) {
        const found = routeFor(game, army, army.path[army.path.length - 1]);
        if (!found || !found.path.length) {
            if (army.retreating) return retreat(game, army, events);
            army.path = [];
            events.push({ type: "blocked", day: game.state.day, army: army.id, owner: army.owner, at: army.at });
            return;
        }
        army.path = found.path;
    }
    if (!mayDepart(game, army, army.at, army.path[0], events)) {
        army.path = [];
        if (army.retreating) retreat(game, army, events);
        return;
    }
    startLeg(game, army, army.at, army.path.shift(), army.arrived);
}

// a retreating army takes nothing and stops for nothing on its way; enemies standing in the field where it passes
// — at a pass, or besieging a settlement of its own — attack it, and garrisons stay inside (RULES.md §5)
function arriveRetreating(game, army, events) {
    const st = game.state, key = army.at;
    const sit = situation(game, key);
    const foes = (!sit.s ? sit.here.filter((a) => atWar(st, a.owner, army.owner))
        : isFriend(st, sit.s.owner, army.owner) ? sit.hostile
            : sit.relief.filter((a) => atWar(st, a.owner, army.owner))).filter((a) => a !== army && atWar(st, a.owner, army.owner));
    if (foes.length && mayFight(st, foes, [army])) {
        const ev = fight(game, { kind: "pursuit", place: key, a: foes, b: [army], plainCavalry: !sit.s, tie: "a" });
        events.push(ev);
        if (ev.winner === "a") {
            if (isAlive(st, army)) { army.path = []; retreat(game, army, events); }
            return;
        }
        for (const f of foes) if (isAlive(st, f)) retreat(game, f, events, key);
    }
    if (!isAlive(st, army)) return;
    if (army.path.length) return carryOn(game, army, events);
    army.retreating = false;
    // its refuge fell meanwhile — a refuge being a settlement of its own country or of a friend, as retreat() chose it
    if (!sit.s || !isFriend(st, army.owner, sit.s.owner)) return retreat(game, army, events, key);
    if (situation(game, key).hostile.length) army.relief = true;
    events.push({ type: "arrive", day: st.day, army: army.id, owner: army.owner, at: key });
}

// sieges whose time is up (RULES.md §6): the garrison is disbanded on the spot — its men go home, its weapons and
// cannons are lost — and the settlement falls to the besieger
export function surrenders(game, events) {
    const st = game.state;
    for (const s of Object.values(st.settlements)) {
        if (!s.siege || st.day < s.siege.end) continue;
        const key = String(s.id), { garrison, hostile } = situation(game, key);
        if (hostile.length) {
            const by = hostile.some((a) => a.owner === s.siege.by) ? s.siege.by : hostile[0].owner;
            events.push({ type: "surrender", day: st.day, settlement: s.id, owner: s.owner, by, disbanded: garrison.reduce((n, g) => n + menOf(g), 0) });
            // the owner's own armies are disbanded; a friend's inside the walls falls back instead
            for (const g of garrison) {
                if (g.owner === s.owner) removeArmy(st, g);
                else retreat(game, g, events, key);
            }
            capture(game, s, by, events, "siege");
        }
        settle(game, key, events);
    }
}
