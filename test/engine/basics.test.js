// The engine's pure parts: the calendar, the dice, army arithmetic and the battle and siege formulas, checked
// against RULES.md's own numbers.
import test from "node:test";
import assert from "node:assert/strict";
import * as cal from "../../src/engine/calendar.js";
import * as rnd from "../../src/engine/random.js";
import * as army from "../../src/engine/army.js";
import { damage, COOLDOWN_DAYS } from "../../src/engine/battle.js";
import { wallDefence, siegeDays } from "../../src/engine/fighting.js";

const men = (parts) => ({ ...army.emptyMen(), ...parts });
const anArmy = (parts, cannons = 0, crew = 0) => ({ men: men(parts), cannons, crew });

test("calendar: 365 days, the usual months, no leap years", () => {
    assert.deepEqual(cal.dateOf(0), { year: 1440, month: 1, day: 1 });
    assert.deepEqual(cal.dateOf(31), { year: 1440, month: 2, day: 1 });
    assert.deepEqual(cal.dateOf(59), { year: 1440, month: 3, day: 1 });     // February has 28 days in 1440 too
    assert.deepEqual(cal.dateOf(364), { year: 1440, month: 12, day: 31 });
    assert.deepEqual(cal.dateOf(365), { year: 1441, month: 1, day: 1 });
    for (let d = 0; d < 730; d++) assert.equal(cal.parseDate(cal.formatDate(d)), d);
    assert.equal([...Array(365).keys()].filter(cal.isMonthStart).length, 12);
    assert.throws(() => cal.parseDate("1440-02-29"));
    assert.equal(COOLDOWN_DAYS, 91);                                       // 3 months
});

test("random: a seed gives the same dice every time", () => {
    const a = { rng: rnd.seedRandom(7) }, b = { rng: rnd.seedRandom(7) }, c = { rng: rnd.seedRandom(8) };
    const rolls = (s) => Array.from({ length: 50 }, () => rnd.d6(s));
    const ra = rolls(a);
    assert.deepEqual(ra, rolls(b));
    assert.notDeepEqual(ra, rolls(c));
    const seen = new Set(Array.from({ length: 600 }, () => rnd.d6(a)));
    assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < 500; i++) { const r = rnd.battleRoll(a); assert.ok(r >= 6 && r <= 16); }
});

test("power: weapon multipliers, unarmed men, cannons", () => {
    assert.equal(army.power(anArmy({ swords: 1000 }), 1.4), 1000);
    assert.equal(army.power(anArmy({ pikes: 1000 }), 1.4), 1200);
    assert.equal(army.power(anArmy({ cavalry: 1000 }), 1.4), 1400);
    assert.equal(army.power(anArmy({ cavalry: 1000 }), 1), 1000);
    assert.equal(army.power(anArmy({ muskets: 1000 }), 1.4), 2000);
    assert.equal(army.power(anArmy({ unarmed: 5000 }), 1.4), 0);
    assert.ok(Math.abs(army.power(anArmy({}, 100), 1.4) - 1560) < 1e-9);   // 100 cannons are worth 1,560 men
});

test("power: pike and shot from a third pikes", () => {
    // "A third pikes and two thirds arquebuses averages ×1.68"
    assert.ok(Math.abs(army.power(anArmy({ pikes: 1000, arquebuses: 2000 }), 1.4) / 3000 - 1.68) < 1e-9);
    assert.ok(Math.abs(army.power(anArmy({ pikes: 1000, muskets: 2000 }), 1.4) - (1200 + 2000 * 2.4)) < 1e-9);
    assert.equal(army.power(anArmy({ pikes: 999, arquebuses: 2001 }), 1.4), 999 * 1.2 + 2001 * 1.6);   // just under a third
    assert.equal(army.pikeAndShot(men({ pikes: 1000, swords: 2000, unarmed: 9000 })), true);           // unarmed men don't count
});

test("cavalry loses its bonus against a third pikes or half muskets", () => {
    assert.equal(army.stopsCavalry(men({ pikes: 1000, swords: 2000 })), true);
    assert.equal(army.stopsCavalry(men({ muskets: 1000, swords: 1000 })), true);
    assert.equal(army.stopsCavalry(men({ muskets: 999, swords: 1001 })), false);
    assert.equal(army.stopsCavalry(men({ unarmed: 100 })), false);
});

test("military power: plain multipliers, no pike and shot", () => {
    const a = anArmy({ cavalry: 1000, pikes: 1000, arquebuses: 1000, unarmed: 500 }, 100, 1000);
    assert.ok(Math.abs(army.militaryPower(a) - (1400 + 1200 + 1600 + 1560)) < 1e-9);
});

test("damage: RULES.md's table", () => {
    const close = (x, y) => Math.abs(x - y) < 1e-9;
    let d = damage(1, 1); assert.ok(close(d.winner, 0.1) && close(d.loser, 0.25));
    d = damage(2, 1); assert.ok(close(d.winner, 0.05) && close(d.loser, 0.5));
    d = damage(3, 1); assert.ok(close(d.winner, 0.1 / 3) && close(d.loser, 0.75));
    d = damage(4, 1); assert.ok(close(d.winner, 0.025) && close(d.loser, 1));
    d = damage(10, 1); assert.ok(close(d.winner, 0.01) && close(d.loser, 1));   // wiped out, no more
    d = damage(5, 0); assert.ok(close(d.winner, 0) && close(d.loser, 1));
    d = damage(0, 0); assert.ok(close(d.winner, 0.1) && close(d.loser, 0.25));
});

test("losses come in whole men, shared over the weapons", () => {
    const a = anArmy({ swords: 333, pikes: 333, muskets: 334 }, 5, 60);
    const l = army.lossesFor(a, 0.25);
    assert.equal(l.dead, 250);
    assert.equal(l.men.swords + l.men.pikes + l.men.muskets, 250);
    assert.equal(l.cannons, 1);                                             // 1.25 cannons -> 1
    assert.equal(l.crew, 10 + 3);                                           // its 10 crew, and a quarter of the 10 idle crew
    const all = army.lossesFor(a, 1);
    assert.deepEqual([all.dead, all.cannons, all.crew], [1000, 5, 60]);
    const sick = army.lossesFor(a, 0.01, true);
    assert.deepEqual([sick.dead, sick.cannons, sick.crew], [10, 0, 0]);
});

test("walls: ×1.8, less 0.3 per 100 × x cannons, never below the plain ×1.2", () => {
    assert.equal(wallDefence(false, 500, 1), 1.2);
    assert.equal(wallDefence(true, 0, 1), 1.8);
    assert.equal(wallDefence(true, 99, 1), 1.8);
    assert.ok(Math.abs(wallDefence(true, 100, 1) - 1.5) < 1e-9);
    assert.ok(Math.abs(wallDefence(true, 200, 1) - 1.2) < 1e-9);
    assert.equal(wallDefence(true, 900, 1), 1.2);
    assert.equal(wallDefence(true, 100, 2), 1.8);                          // with x = 2 a step takes 200 cannons
});

test("siege length: pop ÷ 20000 years, walls double it, cannons cut it to no less than 40%", () => {
    const game = { map: { x: 1 } };
    assert.equal(siegeDays(game, { pop: 10000, walls: false }, 0), 183);    // half a year
    assert.equal(siegeDays(game, { pop: 20000, walls: false }, 0), 365);
    assert.equal(siegeDays(game, { pop: 20000, walls: true }, 0), 730);
    assert.equal(siegeDays(game, { pop: 20000, walls: false }, 100), 292);  // × 0.8
    assert.equal(siegeDays(game, { pop: 20000, walls: false }, 299), 219);  // full hundreds only: × 0.6
    assert.equal(siegeDays(game, { pop: 20000, walls: false }, 1000), 146); // × 0.4 at most
});
