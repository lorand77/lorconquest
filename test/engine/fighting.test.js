// Taking settlements and fighting (RULES.md §5, §6, §8): sieges and their surrender, storms, sorties, relief,
// battles at passes and head-on on routes. rig() loads the dice, so every number can be worked out by hand.
import test from "node:test";
import assert from "node:assert/strict";
import { tinyGame, setArmy, runTo, order, rig, refused } from "../helpers/tiny.js";

const ofType = (events, type) => events.filter((e) => e.type === type);
const popOf = (game, country) => Object.values(game.state.settlements).filter((s) => s.owner === country).reduce((n, s) => n + s.pop, 0);

// AAA at war with BBB, army 3 standing at the pass, ready to come down on 5
function atThePass() {
    const game = tinyGame();
    order(game, { type: "declareWar", country: "AAA", target: "BBB" });
    order(game, { type: "move", country: "AAA", army: 3, to: "P1" });
    runTo(game, 91);
    return game;
}

test("a siege runs its days, costs 1% of the besiegers a month, and the garrison surrenders", () => {
    const game = atThePass();
    setArmy(game, 3, { swords: 1000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    let events = runTo(game, 182);
    assert.equal(game.state.settlements[5].siege.end, 365);
    // the same game with no siege: the difference in AAA's people is what the disease killed (people also grow monthly)
    const control = atThePass();
    runTo(control, 364);
    events = runTo(game, 364);
    const sick = ofType(events, "attrition");
    assert.ok(sick.length >= 5 && sick.every((e) => e.sick && !e.hungry && e.army === 3));
    assert.equal(sick[0].dead, 10);                                         // 1% of 1,000
    const dead = sick.reduce((n, e) => n + e.dead, 0);
    const lost = popOf(control, "AAA") - popOf(game, "AAA");
    assert.ok(dead >= 50 && lost > dead * 0.95 && lost < dead * 1.05, `${dead} died, AAA lost ${lost} people`);   // the dead are lost from its people
    assert.equal(game.state.settlements[5].owner, "BBB");
    events = runTo(game, 365);
    assert.equal(ofType(events, "surrender").length, 1);
    assert.equal(game.state.settlements[5].owner, "AAA");
    assert.equal(game.state.armies[5], undefined);                         // disbanded: its men went home
});

test("the siege length is fixed when it begins: later cannons do not shorten it", () => {
    const game = atThePass();
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    const end = game.state.settlements[5].siege.end;
    setArmy(game, 3, { swords: 400, cannons: 300, crew: 3000 });
    runTo(game, 200);
    assert.equal(game.state.settlements[5].siege.end, end);
});

test("a storm that wins takes the settlement; the garrison escapes on 1-3 and is lost on 4-6", () => {
    for (const [escape, fate] of [[2, "escapes"], [5, "is lost"]]) {
        const game = atThePass();
        setArmy(game, 3, { swords: 600 });
        order(game, { type: "move", country: "AAA", army: 3, to: 5, storm: true });
        rig(game, 5, 5, 3, 3, escape);
        const events = runTo(game, 182);
        const storm = ofType(events, "battle")[0];
        assert.equal(storm.kind, "storm");
        assert.deepEqual([storm.a.power, storm.b.power, storm.winner], [600 * 14, 400 * 10 * 1.2, "a"]);   // ×1.2 behind no walls
        assert.deepEqual([storm.a.dead, storm.b.dead, storm.escape], [34, 175, escape]);                  // 5.7% and 43.75%
        assert.equal(game.state.settlements[5].owner, "AAA");
        assert.equal(game.state.armies[3].men.swords, 566);
        if (fate === "escapes") {
            const g = game.state.armies[5];
            assert.deepEqual([g.men.swords, g.retreating, g.march.to], [225, true, "4"]);
        } else {
            assert.equal(game.state.armies[5], undefined);
            assert.equal(ofType(events, "destroyed")[0].dead, 225);
        }
    }
});

test("a storm that fails sends the attackers back and ends the siege", () => {
    const game = atThePass();
    setArmy(game, 3, { swords: 300 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    rig(game, 4, 4, 5, 5);
    const events = order(game, { type: "storm", country: "AAA", army: 3 });
    const storm = ofType(events, "battle")[0];
    assert.deepEqual([storm.a.power, storm.b.power, storm.winner, storm.a.dead, storm.b.dead], [3600, 6720, "b", 140, 21]);
    assert.deepEqual([ofType(events, "retreat")[0].army, ofType(events, "retreat")[0].to], [3, "3"]);
    assert.equal(ofType(events, "siegeLifted").length, 1);
    assert.equal(game.state.settlements[5].owner, "BBB");
});

test("a sortie that wins drives the besiegers off; one that loses falls back inside", () => {
    let game = atThePass();
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    setArmy(game, 5, { swords: 1000 });
    rig(game, 5, 5, 3, 3);
    let events = order(game, { type: "sortie", country: "BBB", army: 5 });
    let b = ofType(events, "battle")[0];
    assert.deepEqual([b.a.power, b.b.power, b.winner, b.a.dead, b.b.dead], [14000, 4000, "a", 29, 350]);   // no bonus in the open
    assert.equal(game.state.armies[3].retreating, true);
    assert.equal(game.state.settlements[5].siege, null);

    game = atThePass();
    setArmy(game, 3, { swords: 1000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    const end = game.state.settlements[5].siege.end;
    rig(game, 3, 3, 4, 4);
    events = order(game, { type: "sortie", country: "BBB", army: 5 });
    b = ofType(events, "battle")[0];
    assert.deepEqual([b.a.power, b.b.power, b.winner, b.a.dead, b.b.dead], [4000, 12000, "b", 300, 33]);
    assert.equal(ofType(events, "retreat").length, 0);
    assert.deepEqual([game.state.armies[5].at, game.state.armies[5].men.swords], ["5", 100]);
    assert.equal(game.state.settlements[5].siege.end, end);
});

test("a besieged garrison cannot march out, nor a part split off from it, until a sortie wins", () => {
    const game = atThePass();
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    assert.match(refused(game, { type: "move", country: "BBB", army: 5, to: 4 }), /army 5 is besieged in .*only break out by a sortie/);
    order(game, { type: "split", country: "BBB", army: 5, men: { swords: 100 } });
    const part = Math.max(...Object.keys(game.state.armies).map(Number));
    assert.match(refused(game, { type: "move", country: "BBB", army: part, to: 4 }), /is besieged/);
    assert.equal(game.state.settlements[5].owner, "BBB");
    setArmy(game, 5, { swords: 1000 });
    rig(game, 5, 5, 3, 3);
    order(game, { type: "sortie", country: "BBB", army: 5 });
    assert.equal(game.state.settlements[5].siege, null);
    order(game, { type: "move", country: "BBB", army: 5, to: 4 });            // the siege broken, it may go
    assert.equal(game.state.armies[5].march.to, "4");
});

test("splitting or merging dodges no rest: a part split off, or an army merged into another, keeps the 3 months", () => {
    const game = atThePass(), st = game.state;
    setArmy(game, 3, { swords: 2000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    setArmy(game, 5, { swords: 1800 });
    rig(game, 4, 4, 5, 5);
    order(game, { type: "sortie", country: "BBB", army: 5 });                     // lost: the garrison falls back inside
    assert.match(refused(game, { type: "sortie", country: "BBB", army: 5 }), /less than 3 months/);
    const [split] = order(game, { type: "split", country: "BBB", army: 5, men: { swords: 1 } });
    assert.match(refused(game, { type: "sortie", country: "BBB", army: split.into }), /less than 3 months/);   // the part too
    // merged back, or merged the other way round, the wait stays
    order(game, { type: "merge", country: "BBB", army: 5, into: split.into });
    assert.match(refused(game, { type: "sortie", country: "BBB", army: split.into }), /less than 3 months/);
    runTo(game, st.day + 92);                                                      // three months on: it may
    rig(game, 4, 4, 5, 5);
    assert.equal(game.command({ type: "sortie", country: "BBB", army: split.into }).ok, true);
});

test("a relief force fights the besiegers in the open with the garrison beside it; beaten, the garrison goes back inside", () => {
    // won: relief and garrison together, the besiegers fall back, the siege is lifted and the relief force goes inside
    let game = atThePass();
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    setArmy(game, 4, { swords: 600 });
    setArmy(game, 3, { swords: 900 });                                      // more than the relief force alone (600)
    order(game, { type: "move", country: "BBB", army: 4, to: 5 });
    rig(game, 4, 4, 4, 4);
    let events = runTo(game, 182 + 73);
    let relief = ofType(events, "battle")[0];
    assert.equal(relief.kind, "relief");
    assert.deepEqual([relief.a.armies, relief.b.armies, relief.a.men, relief.winner], [[4, 5], [3], 1000, "a"]);   // 600 + the 400 inside
    assert.ok(game.state.armies[5].men.swords < 400, "the garrison fought, and lost men");
    assert.equal(game.state.settlements[5].siege, null);
    assert.equal(game.state.armies[4].relief, false);                       // the relief force is inside too
    assert.equal(game.state.armies[3].retreating, true);
    // lost: the relief force falls back; the garrison goes back inside and the siege goes on, on the same timer
    game = atThePass();
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    runTo(game, 182);
    const end = game.state.settlements[5].siege.end;
    setArmy(game, 4, { swords: 300 });
    setArmy(game, 3, { swords: 900 });                                      // more than relief and garrison together (700)
    order(game, { type: "move", country: "BBB", army: 4, to: 5 });
    rig(game, 4, 4, 4, 4);
    events = runTo(game, 182 + 73);
    relief = ofType(events, "battle")[0];
    assert.deepEqual([relief.a.armies, relief.winner], [[4, 5], "b"]);
    assert.equal(ofType(events, "retreat").some((e) => e.army === 4), true);
    assert.equal(ofType(events, "retreat").some((e) => e.army === 5), false);
    assert.deepEqual([game.state.armies[5].at, game.state.armies[5].relief, game.state.settlements[5].owner], ["5", false, "BBB"]);
    assert.equal(game.state.settlements[5].siege?.end, end);
});

test("at a pass the army that got there first defends at ×2", () => {
    const game = atThePass();
    order(game, { type: "move", country: "BBB", army: 5, to: 3 });         // straight into army 3 at P1
    const events = runTo(game, 182);
    const b = ofType(events, "battle")[0];
    assert.equal(b.kind, "pass");
    assert.deepEqual(b.b.armies, [3]);                                     // AAA was there first
    assert.equal(b.b.power, 400 * b.b.roll * 2);
});

test("enemies marching towards each other on a leg fight where they cross", () => {
    const game = atThePass();
    setArmy(game, 3, { swords: 1000 });
    order(game, { type: "move", country: "AAA", army: 3, to: 5 });
    order(game, { type: "move", country: "BBB", army: 5, to: "P1" });
    rig(game, 4, 4, 3, 3);
    let events = runTo(game, 137);
    const b = ofType(events, "battle")[0];
    assert.deepEqual([b.kind, b.day, b.along.f], ["route", 137, 0.5]);     // they crossed halfway, at day 136.5
    assert.deepEqual(b.a.armies, [3]);                                     // BBB holds the nearer end, so it defends
    assert.deepEqual([b.a.power, b.b.power, b.winner, b.a.dead, b.b.dead], [12000, 4000, "a", 33, 300]);
    const loser = game.state.armies[5], winner = game.state.armies[3];
    assert.deepEqual([loser.retreating, loser.march.to, loser.march.end], [true, "5", 182.5]);   // back the way it came
    assert.deepEqual([winner.march.to, winner.march.end], ["5", 182.5]);   // the winner carries on, from where they met
    events = runTo(game, 183);
    assert.equal(game.state.armies[5].at, "5");                            // the beaten army gets home first
    assert.equal(game.state.settlements[5].owner, "BBB");
    assert.equal(game.state.settlements[5].siege.by, "AAA");
});

test("armies marching the same way, or not at war, never meet", () => {
    const game = tinyGame();
    order(game, { type: "move", country: "AAA", army: 1, to: 2 });
    order(game, { type: "move", country: "AAA", army: 2, to: 1 });
    const events = runTo(game, 80);
    assert.equal(ofType(events, "battle").length, 0);
});
