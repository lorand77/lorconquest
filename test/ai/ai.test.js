// The computer players (docs/plan.md, milestone 5): what each layer decides on the tiny map, the caretaker's answers, and,
// on the real map, that a game played by computers alone replays from its commands without them, stays sane and
// keeps inside the tick's budget.
import test from "node:test";
import assert from "node:assert/strict";
import docsScenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { Game, armyCapOf, armyList, armySoldiersOf, atWar, economyOf, replay, scores } from "../../src/engine/index.js";
import { warKey } from "../../src/engine/state.js";
import { createAI } from "../../src/ai/index.js";
import { answerOffers, callAnswers } from "../../src/ai/caretaker.js";
import { addAgreement } from "../../src/engine/diplomacy.js";
import { bestTarget, diplomacyOrders } from "../../src/ai/diplomacy.js";
import { CHARACTERS, NOISE } from "../../src/ai/characters.js";
import historical from "../../scenarios/historical-1440/scenario.json" with { type: "json" };
import { economyOrders } from "../../src/ai/economy.js";
import { fleetsHome, forceOrders } from "../../src/ai/forces.js";
import { THINK_DAYS, dice, flavorOf, hash, thinksOn } from "../../src/ai/util.js";
import { isMonthStart } from "../../src/engine/calendar.js";
import { check } from "../helpers/invariants.js";
import { giveFleet, setArmy, tinyGame } from "../helpers/tiny.js";
import fs from "node:fs";
import path from "node:path";

const fl = { aggression: 0.5, friendliness: 0.5, builder: 0.5 };

// play `days` days as the worker does: the orders of the last day, then the day, then new orders; returns the refusals
function play(game, ai, days, { onDay } = {}) {
    const refused = [], end = game.day + days;
    let pending = [];
    while (game.day < end && !game.state.winner) {
        const events = [];
        for (const o of pending) {
            const r = game.command({ ...o.cmd, country: o.country });
            if (r.ok) events.push(...r.events);
            else refused.push({ day: game.day, country: o.country, cmd: o.cmd, error: r.error });
        }
        events.push(...game.advance());
        pending = game.state.winner ? [] : ai.orders(game, events);
        onDay?.(game, events);
    }
    return refused;
}

// apply commands in order, as the worker would; all must be accepted
function applyAll(game, orders) {
    for (const o of orders) {
        const r = game.command({ ...(o.cmd ?? o), country: o.country ?? o.cmd.country });
        assert.equal(r.ok, true, `${JSON.stringify(o)}: ${r.error}`);
    }
}

test("the AI's dice and characters depend on the seed and the country alone", () => {
    const a = dice(hash("x")), b = dice(hash("x"));
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
    assert.deepEqual(flavorOf(1, "BAV"), flavorOf(1, "BAV"));
    assert.notDeepEqual(flavorOf(1, "BAV"), flavorOf(2, "BAV"));
    for (const code of ["BAV", "AUS", "NOR"]) {
        const f = flavorOf(7, code);
        assert.ok(f.aggression >= 0.25 && f.aggression <= 1 && f.friendliness >= 0.3 && f.builder >= 0.3, code);
    }
});

test("a country's character is its scenario's, varied a little by the seed; one the scenario does not give is rolled", () => {
    for (const [seed, code, ch] of [[1, "AUS", "diplomat"], [2, "BUR", "conqueror"], [3, "LUB", "merchant"], [9, "TEU", "zealot"]]) {
        const f = flavorOf(seed, code, ch), base = CHARACTERS[ch];
        assert.equal(f.character, ch);
        for (const k of ["aggression", "friendliness", "builder"]) assert.ok(Math.abs(f[k] - base[k]) <= NOISE + 1e-9 || f[k] === 1 || f[k] === 0.1, `${code} ${k}: ${f[k]} against ${base[k]}`);
        assert.deepEqual(flavorOf(seed, code, ch), f, "the same seed gives the same");
    }
    assert.notDeepEqual(flavorOf(1, "AUS", "diplomat"), flavorOf(2, "AUS", "diplomat"), "another seed varies it");
    // the noise never turns one character into another: a diplomat stays far less warlike than a conqueror
    for (let seed = 1; seed < 50; seed++) assert.ok(flavorOf(seed, "AUS", "diplomat").aggression < flavorOf(seed, "BUR", "conqueror").aggression);
    assert.equal(flavorOf(1, "AAA", null).character, null);
    // both scenarios give every country one
    for (const sc of [docsScenario, historical]) assert.ok(sc.countries.every((c) => CHARACTERS[c.character]), "every country has a character");
});

test("a rival is the target of choice, and is never proposed anything", () => {
    const strong = { aggression: 0.9, friendliness: 1, builder: 0.5 };
    // BBB borders AAA and CCC, a town of each next to its land, both as strong (1,600 men): alike to it, the tie goes to AAA
    const setup = (rivalries) => {
        const game = tinyGame(1, (sc) => { sc.rivalries = rivalries; });
        setArmy(game, 4, { pikes: 20000 });                                 // BBB is far the strongest
        setArmy(game, 6, { swords: 1600 });
        return game;
    };
    assert.equal(bestTarget(setup([]), "BBB", strong).target, "AAA");
    assert.equal(bestTarget(setup([["BBB", "CCC"]]), "BBB", strong).target, "CCC", "a rival comes first");
    // but a rival is not attacked at worse odds: one too strong to take on is left alone
    const tough = setup([["BBB", "CCC"]]);
    setArmy(tough, 4, { pikes: 1700 });
    setArmy(tough, 6, { swords: 1600, pikes: 1000 });
    assert.notEqual(bestTarget(tough, "BBB", strong)?.target, "CCC");
    // twenty years of peace make AAA and BBB friends enough for a pact, but not if they are rivals
    const proposals = (rivalries) => {
        const game = setup(rivalries);
        game.state.day = 7300;
        const mem = { plans: new Map(), asked: new Map() }, out = [];
        for (let d = 0; d < 200; d++) { game.state.day++; out.push(...diplomacyOrders(game, "AAA", { ...strong, aggression: 0.3 }, mem).orders.filter((o) => o.type === "proposeAgreement")); }
        return out.map((o) => o.with);
    };
    assert.ok(proposals([]).includes("BBB"));
    assert.ok(!proposals([["AAA", "BBB"]]).includes("BBB"));
});

test("every country thinks every 15 days, the same for all, each on days of its own", () => {
    for (const code of ["BAV", "AUS", "NOR", "AAA"]) {
        const days = [];
        for (let d = 0; d < 600; d++) if (thinksOn(code, d)) days.push(d);
        const gaps = days.slice(1).map((d, i) => d - days[i]);
        assert.ok(gaps.length >= 39 && gaps.every((g) => g === THINK_DAYS), `${code}: ${gaps}`);
    }
    // nobody thinks more often than anybody else, and the countries are spread over the days of the cycle, not all at once
    const codes = docsScenario.countries.map((c) => c.code);
    const count = (code) => [...Array(3650).keys()].filter((d) => thinksOn(code, d)).length;
    assert.ok(Math.max(...codes.map(count)) - Math.min(...codes.map(count)) <= 1, "equal, to within the day the span ends on");
    const perDay = [...Array(THINK_DAYS).keys()].map((d) => codes.filter((c) => thinksOn(c, d)).length);
    assert.equal(perDay.reduce((n, k) => n + k, 0), codes.length);
    assert.ok(Math.max(...perDay) <= 8, `the busiest day has ${Math.max(...perDay)} countries thinking: ${perDay}`);
});

test("economy: light tax in peace, heavier in war, loans only when poor at war, buildings bought from the surplus", () => {
    const game = tinyGame(1);
    const c = game.state.countries.AAA;
    c.treasury = 2e6;
    const ctx = { budget: 2e6 };
    let orders = economyOrders(game, "AAA", fl, ctx);
    assert.ok(!orders.some((o) => o.type === "setTax"), "peace: the tax stays at 2");
    assert.ok(!orders.some((o) => o.type === "borrow"));
    assert.ok(orders.some((o) => o.type === "buyBuilding"), "a rich country builds");
    assert.ok(ctx.budget < 2e6, "and what it buys comes off the budget");
    applyAll(game, orders);
    // at war and poor: a higher tax and a loan
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    c.treasury = 1000;
    orders = economyOrders(game, "AAA", fl, { budget: 0 });
    assert.ok(orders.some((o) => o.type === "setTax" && o.tax > 2), "war: taxes rise");
    assert.ok(orders.some((o) => o.type === "borrow"), "a poor country at war borrows");
    assert.ok(!orders.some((o) => o.type === "buyBuilding"), "and builds nothing");
    applyAll(game, orders);
});

test("distress: in the red and losing money, a country taxes to the limit, sends home the soldiers over its cap, and defaults on loans it cannot carry", () => {
    const game = tinyGame(1);
    const c = game.state.countries.AAA;
    game.state.day = 800;
    c.loans = 1000000;                                 // 80,000 a year of interest: more than the country earns
    c.treasury = -100000;
    c.debtSince = 300;                                 // in debt for 500 days
    setArmy(game, 1, { swords: 1500, unarmed: 1500, pikes: 1000 });
    const e = economyOf(game, "AAA");
    assert.ok(e.moneyPerYear < 0 && armySoldiersOf(game.state, "AAA") > armyCapOf(game.state, "AAA"), "it is in distress");
    const orders = [...economyOrders(game, "AAA", fl, { budget: 0 }), ...forceOrders(game, "AAA", fl, { budget: 0 })];
    assert.ok(orders.some((o) => o.type === "setTax" && o.tax === 3), "the tax goes to its limit");
    assert.ok(orders.some((o) => o.type === "defaultOnLoans"), "the loans are defaulted on");
    assert.ok(!orders.some((o) => o.type === "borrow" || o.type === "raise" || o.type === "buyBuilding"), "and nothing is borrowed, raised or built");
    const sent = orders.filter((o) => o.type === "disband");
    assert.ok(sent.length > 0, "soldiers go home");
    const over = Math.floor(armySoldiersOf(game.state, "AAA") - armyCapOf(game.state, "AAA"));
    assert.equal(sent.reduce((n, o) => n + Object.values(o.men).reduce((x, y) => x + y, 0), 0), over, "exactly the soldiers over the cap");
    assert.ok(sent[0].men.unarmed > 0, "the unarmed go first");
    applyAll(game, orders);
    assert.deepEqual([c.loans, c.tax], [0, 3]);
    assert.ok(c.noBorrowUntil > game.state.day, "and no banker lends for a long time");
    assert.ok(armySoldiersOf(game.state, "AAA") <= armyCapOf(game.state, "AAA") + 1);
    // not in distress — in the red but earning — none of this happens
    const calm = tinyGame(1);
    calm.state.countries.AAA.treasury = -5000;
    const quiet = [...economyOrders(calm, "AAA", fl, { budget: 0 }), ...forceOrders(calm, "AAA", fl, { budget: 0 })];
    assert.ok(!quiet.some((o) => ["defaultOnLoans", "disband"].includes(o.type)) && !quiet.some((o) => o.type === "setTax" && o.tax === 3));
});

test("forces: soldiers raised up to the law, the unarmed armed with pikes, mercenaries dismissed in peace", () => {
    const game = tinyGame(1);
    const c = game.state.countries.AAA;
    c.treasury = 1e6;
    c.law = "mass";                                    // 15% of its people may be soldiers: far more than it has
    const ctx = { budget: 1e6 };
    const orders = forceOrders(game, "AAA", fl, ctx);
    assert.ok(orders.some((o) => o.type === "raise" && o.lots >= 1), "AAA's army is below what its law allows");
    applyAll(game, orders);
    // unarmed men in an army are armed from the shop: a third pikes, the rest the best shot researched (none yet: pikes)
    setArmy(game, 1, { swords: 100, unarmed: 600 });
    const arm = forceOrders(game, "AAA", fl, { budget: 1e6 });
    assert.ok(arm.some((o) => o.type === "buyWeapons" && o.weapon === "pikes"));
    const eq = arm.find((o) => o.type === "equip");
    assert.deepEqual([eq.army, eq.from, eq.to, eq.n], [1, "unarmed", "pikes", 600]);
    applyAll(game, arm);
    assert.equal(game.state.armies[1].men.pikes, 600);
    // mercenaries go home in peace
    game.state.armies[1].mercs = 100;
    const home = forceOrders(game, "AAA", fl, { budget: 0 });
    assert.ok(home.some((o) => o.type === "dismissMercenaries" && o.army === 1 && o.n === 100));
});

test("fleets: one at sea with nothing to do goes home — into a port in its zone, else to the next zone with one", () => {
    const game = tinyGame();
    const near = giveFleet(game, "AAA", { cogs: 5 }, null, "north");          // AAA's port 1 is in the north
    const far = giveFleet(game, "AAA", { cogs: 5 }, null, "south");           // none in the south: it sails north
    giveFleet(game, "AAA", { cogs: 5 }, 1, "north");                          // in port already: left alone
    const patrol = giveFleet(game, "AAA", { cogs: 5 }, null, "north");
    patrol.order = { type: "patrol" };                                         // under orders: left alone
    const orders = fleetsHome(game, "AAA");
    assert.deepEqual(orders, [
        { type: "sail", country: "AAA", fleet: near.id, port: 1 },
        { type: "sail", country: "AAA", fleet: far.id, zone: "north" },
    ]);
    for (const o of orders) assert.ok(game.command(o).ok);
    assert.deepEqual(fleetsHome(game, "CCC"), []);                            // no port anywhere: nothing to do
});

test("war: an overwhelming country takes what it is next to, with no command refused", () => {
    const game = tinyGame(3, (s) => { s.victory.settlements = 99; });
    const ai = createAI({ seed: 3, humans: [] });
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    // AAA has the men, and the weapons for them
    setArmy(game, 1, { pikes: 3200 });
    game.state.countries.AAA.treasury = 1e6;
    const refused = play(game, ai, 3 * 365);
    const mine = Object.values(game.state.settlements).filter((s) => s.owner === "AAA").length;
    assert.ok(mine > 3, `AAA holds ${mine} settlements`);
    assert.deepEqual(refused.filter((r) => ["move", "merge", "split", "storm", "besiege", "sortie"].includes(r.cmd.type)), []);
});

test("peace: a country far ahead dictates terms the other will accept; one losing buys peace", () => {
    const game = tinyGame(1);
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    const key = warKey("AAA", "BBB");
    game.state.day = 400;
    game.state.warInfo[key].start = 0;
    const memory = () => ({ plans: new Map(), asked: new Map() });
    // AAA has taken a third of BBB's people: it asks for more, and BBB accepts
    game.state.warInfo[key].taken.AAA = 10000;
    const winning = diplomacyOrders(game, "AAA", fl, memory()).orders.find((o) => o.type === "proposePeace");
    assert.ok(winning, "AAA asks for peace");
    assert.ok(winning.terms.take.length > 0 || winning.terms.money > 0, "on terms of its own");
    applyAll(game, [winning]);
    assert.equal(atWar(game.state, "AAA", "BBB"), false);
    // the other way round: BBB has taken AAA's people and AAA's army is weaker
    const game2 = tinyGame(1);
    game2.command({ type: "declareWar", country: "AAA", target: "BBB" });
    game2.state.day = 1300;
    game2.state.warInfo[key].start = 0;
    game2.state.warInfo[key].taken.BBB = 8000;
    setArmy(game2, 1, { swords: 100 });
    game2.state.countries.AAA.treasury = 100000;
    const losing = diplomacyOrders(game2, "AAA", fl, memory()).orders.find((o) => o.type === "proposePeace");
    assert.ok(losing, "AAA buys its peace");
    assert.ok(losing.terms.money < 0 || losing.terms.give.length > 0);
    applyAll(game2, [losing]);
    assert.equal(atWar(game2.state, "AAA", "BBB"), false);
});

test("diplomacy: it asks once a year of a human, and never something the other side would refuse", () => {
    const game = tinyGame(1, () => {}, ["BBB"]);
    game.state.day = 7300;                             // twenty years of peace: BBB thinks well enough of AAA for a pact
    const mem = { plans: new Map(), asked: new Map() };
    let asked = 0;
    for (let d = 0; d < 400; d++) {
        game.advance();
        const { orders } = diplomacyOrders(game, "AAA", { ...fl, friendliness: 1 }, mem);
        for (const o of orders.filter((x) => x.type === "proposeAgreement" && x.with === "BBB")) { asked++; applyAll(game, [o]); }
    }
    assert.ok(asked >= 1 && asked <= 2, `asked a human ${asked} times in a year and a bit`);
    assert.ok(game.state.offers.every((o) => o.kind === "agreement" && o.to === "BBB"), "as questions, not as agreements made");
});

test("alliances are sought sparingly: only when threatened, only with a neighbour as strong, and not past two", () => {
    // AAA is small beside BBB; BBB in turn is small beside CCC, so it would welcome an ally. Twenty years of peace.
    const setup = (aaa = 100) => {
        const game = tinyGame(1);
        for (const id of [1, 2, 3]) setArmy(game, id, { swords: aaa });
        setArmy(game, 4, { swords: 1000 });
        setArmy(game, 5, { swords: 1000 });
        setArmy(game, 6, { swords: 20000 });
        game.state.day = 7300;
        return game;
    };
    const asks = (game) => {
        const mem = { plans: new Map(), asked: new Map() }, out = [];
        for (let d = 0; d < 200; d++) { game.state.day++; out.push(...diplomacyOrders(game, "AAA", { aggression: 0.3, friendliness: 1, builder: 0.5 }, mem).orders); }
        return out.filter((o) => o.type === "proposeAgreement" && o.kind === "defensive").map((o) => o.with);
    };
    assert.deepEqual([...new Set(asks(setup()))], ["BBB"], "threatened, it asks its strong neighbour");
    assert.deepEqual(asks(setup(5000)), [], "not threatened, it asks nobody");
    const full = setup();
    addAgreement(full, "defensive", "BBB", "DDD");
    addAgreement(full, "defensive", "BBB", "EEE");
    assert.deepEqual(asks(full), [], "nor a neighbour that has two alliances already");
});

test("the caretaker joins the wars its allies call it into and lets everything else wait; the full AI answers it all", () => {
    const game = tinyGame(1, () => {}, ["AAA"]);
    const ai = createAI({ seed: 1, humans: ["AAA"] });
    addAgreement(game, "military", "AAA", "BBB", null);
    game.command({ type: "proposeAgreement", country: "CCC", with: "AAA", kind: "pact" });
    game.command({ type: "declareWar", country: "BBB", target: "CCC" });
    const kinds = game.state.offers.map((o) => o.kind).sort();
    assert.deepEqual(kinds, ["agreement", "call"], "a human is asked both");
    const call = game.state.offers.find((o) => o.kind === "call"), pact = game.state.offers.find((o) => o.kind === "agreement");
    assert.deepEqual(callAnswers(game, "AAA"), [{ type: "answerOffer", country: "AAA", id: call.id, accept: true }]);
    assert.deepEqual(answerOffers(game, "AAA").map((a) => [a.id, typeof a.accept]).sort(), [[call.id, "boolean"], [pact.id, "boolean"]].sort());
    const mine = (orders) => orders.filter((o) => o.country === "AAA");
    // while its player is there the AI does not touch the country; with a caretaker it answers the call on its think day
    const theirs = [];
    for (let d = 0; d < 25; d++) { game.advance(); theirs.push(...mine(ai.orders(game, []))); }
    assert.deepEqual(theirs, []);
    ai.setCaretaker("AAA", "caretaker");
    for (let d = 0; d < 25; d++) { game.advance(); theirs.push(...mine(ai.orders(game, []))); }
    assert.ok(theirs.length > 0 && theirs.every((o) => o.source === "caretaker"));
    assert.deepEqual([...new Set(theirs.filter((o) => o.cmd.type === "answerOffer").map((o) => `${o.cmd.id}:${o.cmd.accept}`))], [`${call.id}:true`], "the pact is left to expire");
    assert.ok(theirs.every((o) => ["answerOffer", "sortie", "move"].includes(o.cmd.type)), "and it buys, declares and proposes nothing");
    ai.setCaretaker("AAA", "full");
    const full = [];
    for (let d = 0; d < 25; d++) { game.advance(); full.push(...mine(ai.orders(game, []))); }
    assert.ok(full.some((o) => o.cmd.type === "answerOffer" && o.cmd.id === pact.id), "the full AI answers the pact too");
    ai.setCaretaker("AAA", null);
    for (let d = 0; d < 25; d++) { game.advance(); assert.deepEqual(mine(ai.orders(game, [])), []); }
});

// AI_SEEDS and AI_YEARS make it bigger, AI_SCENARIO (a folder of scenarios/) plays another map
const SEEDS = Number(process.env.AI_SEEDS ?? 2), YEARS = Number(process.env.AI_YEARS ?? 6);
const scenario = process.env.AI_SCENARIO ? JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "..", "scenarios", process.env.AI_SCENARIO, "scenario.json"), "utf8")) : docsScenario;

test("games of computers alone on the real map: legal, sane every month, and replayed exactly from their commands", { timeout: 3600000 }, () => {
    for (let seed = 5; seed < 5 + SEEDS; seed++) {
        const game = Game.create(scenario, { seed, humans: [] }), ai = createAI({ seed, humans: [] });
        const t0 = performance.now();
        const refused = play(game, ai, YEARS * 365, { onDay: (g) => { if (isMonthStart(g.day)) check(g, `seed ${seed}, day ${g.day}`); } });
        const st = game.state;
        // refusals are the odd race between two countries, not a habit
        assert.ok(refused.length < 20 * YEARS, `seed ${seed}: ${refused.length} refused: ${JSON.stringify(refused.slice(0, 3))}`);
        assert.equal(JSON.stringify(st).includes("NaN"), false);
        for (const row of Object.values(scores(st))) assert.ok(Number.isFinite(row.pop));
        // the computers' own dice never touch the game's: the commands alone replay it
        assert.ok(game.log.length > 50 * YEARS / 2, "the computers gave plenty of commands");
        assert.equal(replay(scenario, seed, game.log, game.day, []).snapshot(), game.snapshot(), `seed ${seed}`);
        // the tick's budget is 100 ms: a day of 45 computers takes a small part of it
        assert.ok((performance.now() - t0) / game.day < 20, "a day takes far less than its budget");
        assert.ok(st.wars.length >= 0 && armyList(st).length > 0);
    }
});

test("a computer that loses its capital names a new one: its largest city, else its largest settlement", () => {
    const game = tinyGame(), st = game.state;
    st.settlements[1].owner = "BBB";                                           // One, AAA's capital (its only city), falls
    const orders = economyOrders(game, "AAA", flavorOf(game, "AAA"), { budget: 0 });
    assert.deepEqual(orders.filter((o) => o.type === "setCapital").map((o) => o.settlement), [2]);   // Two and Three are towns alike: the first
    assert.equal(game.command(orders.find((o) => o.type === "setCapital")).ok, true);
    assert.equal(economyOrders(game, "AAA", flavorOf(game, "AAA"), { budget: 0 }).some((o) => o.type === "setCapital"), false);
});

test("at war, a computer buys cannons and its host takes them on; at a pass held by an enemy post, a host storms it", async () => {
    const { newArmy } = await import("../../src/engine/state.js");
    const { emptyMen } = await import("../../src/engine/army.js");
    const { warOrders } = await import("../../src/ai/war.js");
    const game = tinyGame(), st = game.state, c = st.countries.AAA;
    game.command({ type: "setLaw", country: "AAA", law: "mass" });             // an army cap of 6,000: a hundred cannons
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    c.treasury = 5000000;
    const buy = forceOrders(game, "AAA", flavorOf(game, "AAA"), { budget: 4000000 }).filter((o) => o.type === "buyWeapons" && o.weapon === "cannons");
    assert.deepEqual(buy.map((o) => o.lots), [1]);
    // a host of 3,000 at One with a hundred cannons in the reserve: it takes on all hundred (a third of its men as crew)
    c.reserve.cannons = 100;
    const host = newArmy(st, "AAA", "1", { ...emptyMen(), swords: 3000 });
    const orders = warOrders(game, "AAA", flavorOf(game, "AAA"));
    assert.deepEqual(orders.filter((o) => o.type === "equipCannons").map((o) => [o.army, o.n]), [[host.id, 100]]);
    assert.equal(game.command(orders.find((o) => o.type === "equipCannons")).ok, true);
    // the host at the pass, where BBB has a post of 100: it storms it
    host.at = "P1";
    st.posts.P1 = { owner: "BBB", n: 100 };
    const atPass = warOrders(game, "AAA", flavorOf(game, "AAA"));
    assert.deepEqual(atPass.filter((o) => o.type === "stormPost").map((o) => o.army), [host.id]);
});

test("a computer's navy: ships in a strait's zone its armies need, bought or sailed there, and a patrol only when the stronger", async () => {
    const { navyOrders } = await import("../../src/ai/navy.js");
    // the strait 3-6 lies in the north: AAA (3) at war with CCC (6) needs 10 ships there
    let game = tinyGame(), st = game.state;
    game.command({ type: "declareWar", country: "AAA", target: "CCC" });
    st.countries.AAA.treasury = 5000000;
    let orders = navyOrders(game, "AAA", { budget: 4000000 });
    assert.deepEqual(orders.filter((o) => o.type === "buyShips").map((o) => [o.port, o.kind, o.lots]), [[1, "cogs", 1]]);   // in its port One
    assert.equal(game.command(orders.find((o) => o.type === "buyShips")).ok, true);
    assert.equal(navyOrders(game, "AAA", { budget: 4000000 }).some((o) => o.type === "buyShips"), false);           // 10 there now
    // a fleet of its own in the south sails north rather than buying
    game = tinyGame(); st = game.state;
    game.command({ type: "declareWar", country: "AAA", target: "CCC" });
    const south = giveFleet(game, "AAA", { cogs: 12 }, null, "south");
    orders = navyOrders(game, "AAA", { budget: 4000000 });
    assert.deepEqual(orders.filter((o) => o.type === "sail").map((o) => [o.fleet, o.zone]), [[south.id, "north"]]);
    assert.equal(orders.some((o) => o.type === "buyShips"), false);
    // a patrol: AAA\x27s 20 cogs in port in the north against BBB\x27s 5 at sea there — put out and patrol; against 30, stay in
    game = tinyGame(); st = game.state;
    game.command({ type: "declareWar", country: "AAA", target: "BBB" });
    const home = giveFleet(game, "AAA", { cogs: 20 }, 1, "north");
    const foe = giveFleet(game, "BBB", { cogs: 5 }, null, "north");
    orders = navyOrders(game, "AAA", { budget: 0 });
    assert.deepEqual(orders.filter((o) => o.fleet === home.id).map((o) => o.type), ["sail", "patrol"]);
    foe.ships.cogs = 30;
    assert.equal(navyOrders(game, "AAA", { budget: 0 }).some((o) => o.fleet === home.id && o.type === "patrol"), false);
});
