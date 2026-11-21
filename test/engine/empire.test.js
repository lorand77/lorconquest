// The Empire's crown (RULES.md §10, The Emperor; src/engine/empire.js) on the tiny map made an Empire: every settlement in it, AAA
// the Emperor, seven votes on settlements 2 to 8 — AAA holds two (2, 3), BBB two (4, 5), CCC, DDD and EEE one each; the vote on 7 is
// a church vote (DDD's see) and its archbishop the arch-chancellor. Two and Five are made a city's size, so that only AAA (50,000
// people) and BBB (40,000) are big enough to stand, AAA the greater. Every capital lies in the Empire: all five are German states.
import test from "node:test";
import assert from "node:assert/strict";
import { CAPITULATION_DAY, INTERREGNUM_DAYS, YEAR_DAYS, candidatesOf, electorsOf, isGermanState, voteOf } from "../../src/engine/index.js";
import { empireDay, holdElection } from "../../src/engine/empire.js";
import { random } from "../../src/engine/random.js";
import { tinyGame, runTo, order, refused } from "../helpers/tiny.js";

const cmd = (country, type, rest = {}) => ({ type, country, ...rest });
const ofType = (events, type) => events.filter((e) => e.type === type);
const empire = (seed = 1, change = () => {}, humans = []) => tinyGame(seed, (sc) => {
    for (const s of sc.settlements) s.hre = true;
    sc.settlements[1].pop = 20000;
    sc.settlements[4].pop = 20000;
    sc.empire = { emperor: "AAA", electors: [2, 3, 4, 5, 6, 7, 8].map((id) => ({ vote: `vote ${id}`, settlement: id, ...(id === 7 ? { church: true, see: "DDD", chancellor: true } : {}) })) };
    change(sc);
}, humans);
// EEE made an outsider (its one town, 8, its capital, taken out of the Empire); CCC a free city
const outsider = (humans = []) => empire(1, (sc) => { sc.settlements[7].hre = false; sc.empire.freeCities = ["CCC"]; }, humans);
const votes = (game) => { const c = candidatesOf(game); return electorsOf(game).map((e) => voteOf(game, e, c)); };
// the game's dice set so that the next roll comes up under `p`
const rigBelow = (game, p) => { for (let s = 0; ; s++) { const st = { rng: s }; if (random(st) < p) { game.state.rng = s; return; } } };

// ---------- the crown and its elections ----------

test("the crown at the start, who stands, and how a computer elector votes: another it likes best, itself only crowned or greater", () => {
    const game = empire(), st = game.state;
    assert.deepEqual([st.empire.emperor, st.empire.called, st.empire.next, st.empire.authority], ["AAA", false, null, 20]);
    assert.deepEqual(candidatesOf(game), ["AAA", "BBB"]);
    assert.deepEqual(votes(game), ["AAA", "AAA", "AAA", "AAA", "AAA", "AAA", "AAA"]);
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.equal(votes(game)[4], "BBB", "at war with AAA, CCC's vote is not its (−50)");
    assert.equal(tinyGame().state.empire, null, "no crown without electors");
});

test("a German state has its capital in the Empire: an outsider taking a town of it stays an outsider", async () => {
    const { capture } = await import("../../src/engine/fighting.js");
    const game = outsider(), st = game.state;
    assert.deepEqual(["AAA", "DDD", "EEE"].map((c) => isGermanState(game, c)), [true, true, false]);
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    capture(game, st.settlements[7], "EEE", [], "storm");
    assert.equal(isGermanState(game, "EEE"), false);
});

test("only Catholics stand — Protestants too after 31 October 1517; another faith costs a candidate 20 with an elector", async () => {
    const { REFORMATION_DAY } = await import("../../src/engine/index.js");
    const faiths = (map) => (sc) => { for (const c of sc.countries) c.religion = map[c.code] ?? "catholic"; };
    assert.deepEqual(candidatesOf(empire(1, faiths({ BBB: "hussite" }))), ["AAA"], "Hussite BBB does not stand");
    const reformed = empire(1, faiths({ BBB: "protestant" }));
    assert.deepEqual(candidatesOf(reformed), ["AAA"]);
    reformed.state.day = REFORMATION_DAY;
    assert.deepEqual(candidatesOf(reformed), ["AAA", "BBB"]);
    // a Protestant Emperor: the small Catholic electors' votes go to Catholic BBB, AAA's +20 not enough against −20
    const game = empire(1, faiths({ AAA: "protestant" }));
    game.state.day = REFORMATION_DAY;
    assert.deepEqual(votes(game).slice(4), ["BBB", "BBB", "BBB"]);
});

test("a church vote is cast only by its see: in a conqueror's hands it is silent", async () => {
    const { capture } = await import("../../src/engine/fighting.js");
    const game = empire(), st = game.state;
    assert.equal(electorsOf(game)[5].holder, "DDD");
    order(game, cmd("CCC", "declareWar", { target: "DDD" }));
    st.settlements[1].owner = "DDD";                                           // DDD a second town, so that Seven may fall
    capture(game, st.settlements[7], "CCC", [], "storm");
    assert.deepEqual([electorsOf(game)[5].holder, votes(game)[5]], [null, null]);
    const events = [];
    holdElection(game, events, "due");
    assert.equal(Object.values(ofType(events, "elected")[0].votes).reduce((n, v) => n + v, 0), 6, "six votes cast");
});

test("the Emperor rules for life: his death empties the throne, and the electors meet six months later", () => {
    const game = empire(), st = game.state, events = [];
    st.day = YEAR_DAYS;
    rigBelow(game, 0.04);
    empireDay(game, events);
    assert.deepEqual(ofType(events, "emperorDies").map((e) => e.country), ["AAA"]);
    assert.deepEqual([st.empire.emperor, st.empire.late, st.empire.called, st.empire.next], [null, "AAA", true, YEAR_DAYS + INTERREGNUM_DAYS]);
    assert.deepEqual(candidatesOf(game), ["AAA", "BBB"], "the late Emperor's country stands, its +20 still with it");
    const held = runTo(game, YEAR_DAYS + INTERREGNUM_DAYS);
    assert.deepEqual([ofType(held, "elected")[0].country, st.empire.emperor, st.empire.late, st.empire.called], ["AAA", "AAA", null, false]);
});

test("a throne fallen vacant is filled the same way: the Emperor no German state, an election six months on", () => {
    const game = empire(1, () => {}, ["BBB"]), st = game.state;
    for (const id of [1, 2, 3]) st.settlements[id].owner = "BBB";
    const events = runTo(game, st.day + 1);
    assert.equal(ofType(events, "vacant")[0].country, "AAA");
    assert.equal(st.empire.called, true);
    order(game, cmd("BBB", "electorVote", { candidate: "BBB" }));
    assert.equal(ofType(runTo(game, st.empire.next), "elected")[0].country, "BBB");
});

test("an election: promises made in the interregnum and paid whoever wins", () => {
    const game = empire(), st = game.state;
    assert.match(refused(game, cmd("BBB", "promise", { elector: 6, money: 1000 })), /no election has been called/);
    st.day = YEAR_DAYS;
    rigBelow(game, 0.04);
    empireDay(game, []);
    assert.match(refused(game, cmd("CCC", "promise", { elector: 8, money: 1000 })), /you do not stand/);
    st.countries.BBB.treasury = 1e6;
    for (const id of [6, 7, 8]) order(game, cmd("BBB", "promise", { elector: id, money: 30 * 2000 }));
    // DDD and EEE turn; CCC, BBB's neighbour (−15), keeps to AAA; BBB itself votes AAA, the greater
    assert.deepEqual(votes(game), ["AAA", "AAA", "AAA", "AAA", "AAA", "BBB", "BBB"]);
    const before = { BBB: st.countries.BBB.treasury, CCC: st.countries.CCC.treasury }, events = [];
    holdElection(game, events, "due");
    assert.deepEqual([ofType(events, "elected")[0].votes, st.empire.promises], [{ AAA: 5, BBB: 2 }, {}]);
    assert.deepEqual([before.BBB - st.countries.BBB.treasury, st.countries.CCC.treasury - before.CCC], [180000, 60000], "paid, though it lost");
});

test("no majority of the votes cast: a second round between the two leaders, each elector choosing the one it scores higher", () => {
    const game = empire(1, (sc) => { sc.settlements[5].pop = 40000; }, ["BBB", "CCC", "DDD"]), events = [];
    order(game, cmd("BBB", "electorVote", { candidate: "BBB" }));
    order(game, cmd("DDD", "electorVote", { candidate: "BBB" }));
    order(game, cmd("CCC", "electorVote", { candidate: "CCC" }));
    holdElection(game, events, "due");
    const [e] = ofType(events, "elected");
    assert.deepEqual([e.votes, e.runoff, e.country], [{ AAA: 3, BBB: 3, CCC: 1 }, { AAA: 4, BBB: 3 }, "AAA"]);
});

test("from 1519 every Emperor elected signs a capitulation: −10; the crown passing to another country −10 more", () => {
    const game = empire(1, () => {}, ["BBB", "DDD", "EEE"]), st = game.state;
    st.day = CAPITULATION_DAY;
    st.empire.authority = 30;
    holdElection(game, [], "due");
    assert.deepEqual([st.empire.emperor, st.empire.authority], ["AAA", 20]);
    for (const c of ["BBB", "DDD", "EEE"]) st.empire.choices[c] = "BBB";
    holdElection(game, [], "due");
    assert.deepEqual([st.empire.emperor, st.empire.authority], ["BBB", 0]);
});

// ---------- Imperial Authority, Defender of the Empire, the free cities' dues ----------

test("authority: a German state's regard for the Emperor ÷ 5; a year of peace +1, a year of wars −1 for each; the Emperor attacking −15", async () => {
    const { opinion } = await import("../../src/engine/index.js");
    const game = empire(), st = game.state;
    const regard = (a) => { st.empire.authority = a; return opinion(game, "BBB", "AAA"); };
    assert.equal(regard(100) - regard(0), 20);
    st.empire.authority = 20;
    st.rng = 99;                                                               // dice that spare the Emperor's life this year
    const year = runTo(game, YEAR_DAYS);
    assert.deepEqual([st.empire.authority, ofType(year, "authority").map((e) => e.why)], [21, ["peace"]]);
    order(game, cmd("BBB", "declareWar", { target: "CCC" }));
    order(game, cmd("DDD", "declareWar", { target: "EEE" }));
    order(game, cmd("CCC", "declareWar", { target: "DDD" }));
    runTo(game, 2 * YEAR_DAYS);
    assert.equal(st.empire.authority, 18);
    if (st.empire.emperor === "AAA") { order(game, cmd("AAA", "declareWar", { target: "BBB" })); assert.equal(st.empire.authority, 3); }
});

test("Defender of the Empire: an outsider's attack calls the Emperor in; a war not lost +5; bound to the attacker, it refuses: −10", () => {
    const game = outsider(), st = game.state;
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    assert.equal(st.warInfo["AAA|EEE"]?.defender, true);
    order(game, cmd("EEE", "proposePeace", { with: "AAA" }));
    assert.equal(st.empire.authority, 25);
    const bound = outsider();
    order(bound, cmd("AAA", "proposeAgreement", { with: "EEE", kind: "pact" }));
    const events = order(bound, cmd("EEE", "declareWar", { target: "DDD" }));
    assert.deepEqual([ofType(events, "defenderRefuses").length, bound.state.empire.authority], [1, 10]);
});

test("a person as Emperor is asked to defend the Empire: a refusal costs 10, a yes brings it in", () => {
    const game = outsider(["AAA"]), st = game.state;
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    order(game, cmd("AAA", "answerOffer", { id: st.offers.find((o) => o.defender).id, accept: false }));
    assert.equal(st.empire.authority, 10);
    const yes = outsider(["AAA"]);
    order(yes, cmd("EEE", "declareWar", { target: "DDD" }));
    order(yes, cmd("AAA", "answerOffer", { id: yes.state.offers.find((o) => o.defender).id, accept: true }));
    assert.equal(yes.state.warInfo["AAA|EEE"]?.defender, true);
});

test("an outsider keeping a German state's land of the Empire at a peace costs the crown 5 a settlement", async () => {
    const { capture } = await import("../../src/engine/fighting.js");
    const game = outsider(), st = game.state;
    st.agreements.push({ kind: "pact", a: "AAA", b: "EEE", until: 99999 });
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    st.settlements[1].owner = "DDD";
    capture(game, st.settlements[7], "EEE", [], "storm");
    order(game, cmd("EEE", "proposePeace", { with: "DDD" }));
    assert.equal(st.empire.authority, 5);
});

test("the free cities' dues: 5% of a free city's money to the Emperor, as tribute, while the two are not at war", async () => {
    const { economyOf } = await import("../../src/engine/index.js");
    const game = outsider(), base = economyOf(game, "CCC").moneyPerYear + economyOf(game, "CCC").tributePaid;
    assert.ok(Math.abs(economyOf(game, "CCC").tributePaid - 0.05 * base) < 1e-6);
    assert.ok(Math.abs(economyOf(game, "AAA").tributeReceived - 0.05 * base) < 1e-6);
    order(game, cmd("AAA", "declareWar", { target: "CCC" }));
    assert.deepEqual([economyOf(game, "CCC").tributePaid, economyOf(game, "AAA").tributeReceived], [0, 0]);
});

// ---------- the imperial ban ----------

test("the ban: a warmonger of 30, or one that took the Empire's land from a German state; not through a truce; a war of execution", async () => {
    const { banError, opinion } = await import("../../src/engine/index.js");
    const game = empire(), st = game.state;
    assert.match(banError(game, "BBB", "CCC"), /only the Emperor/);
    assert.match(banError(game, "AAA", "BBB"), /warmonger score under 30/);
    st.countries.BBB.warmonger = 30;
    st.agreements.push({ kind: "truce", a: "AAA", b: "BBB", until: 99999 });
    assert.match(banError(game, "AAA", "BBB"), /a truce or a pact binds you/);
    st.agreements = st.agreements.filter((x) => x.kind !== "truce");
    assert.equal(banError(game, "AAA", "BBB"), null);
    const willing = ["CCC", "DDD", "EEE"].filter((c) => opinion(game, c, "AAA") >= 0);
    const events = order(game, cmd("AAA", "ban", { target: "BBB" }));
    assert.deepEqual([st.empire.banned, st.empire.authority, st.warInfo["AAA|BBB"].execution, st.countries.AAA.warmonger], [["BBB"], 10, true, 0]);
    assert.deepEqual(ofType(events, "joins").map((e) => e.country).sort(), willing);
});

test("the ban lasts as long as its war: won by the Emperor +10; ended with the crown passed on, it is lifted all the same", () => {
    const game = empire(), st = game.state;
    st.countries.BBB.warmonger = 40;
    order(game, cmd("AAA", "ban", { target: "BBB" }));
    order(game, cmd("BBB", "proposePeace", { with: "AAA" }));
    runTo(game, st.day + 1);
    assert.deepEqual([st.empire.banned, st.empire.authority], [[], 20]);
    const other = empire(), s2 = other.state;
    s2.countries.BBB.warmonger = 40;
    order(other, cmd("AAA", "ban", { target: "BBB" }));
    s2.empire.emperor = "CCC";
    order(other, cmd("BBB", "proposePeace", { with: "AAA" }));
    runTo(other, s2.day + 1);
    assert.deepEqual([s2.empire.banned, s2.empire.authority], [[], 10], "lifted, and no +10 for CCC");
});

test("taking a settlement of the Empire from a German state marks the taker for 10 years — not from one under the ban", async () => {
    const { capture } = await import("../../src/engine/fighting.js");
    const game = empire(), st = game.state;
    order(game, cmd("BBB", "declareWar", { target: "CCC" }));
    capture(game, st.settlements[6], "BBB", [], "storm");
    assert.equal(st.empire.seized.BBB, st.day);
    const banned = empire(), s2 = banned.state;
    s2.empire.banned = ["CCC"];
    order(banned, cmd("BBB", "declareWar", { target: "CCC" }));
    capture(banned, s2.settlements[6], "BBB", [], "storm");
    assert.equal(s2.empire.seized.BBB, undefined);
});

// ---------- the estates' reforms ----------

test("a reform is put to the Diet by the Emperor or the Archbishop of Mainz; two colleges of three pass it; voted down, 5 years to wait", async () => {
    const { dietVotes, reformError } = await import("../../src/engine/index.js");
    const game = empire(1, (sc) => { sc.empire.freeCities = ["EEE"]; }, ["BBB", "CCC"]), st = game.state;
    assert.match(refused(game, cmd("AAA", "proposeReform")), /needs Imperial Authority 40; it is 20/);
    assert.match(refused(game, cmd("BBB", "proposeReform")), /only the Emperor or the Archbishop of Mainz/);
    st.empire.authority = 45;
    // BBB and CCC, people, say no: electors 4–3 for (AAA's two, DDD's, EEE's), princes 2–2, the city EEE 1–0 for
    order(game, cmd("BBB", "reformVote", { yes: false }));
    order(game, cmd("CCC", "reformVote", { yes: false }));
    const v = dietVotes(game, "AAA");
    assert.deepEqual([v.electors, v.princes, v.cities, v.passed], [{ yes: 4, no: 3 }, { yes: 2, no: 2 }, { yes: 1, no: 0 }, true]);
    // the Archbishop of Mainz may put it as well as the Emperor (each state then weighs the archbishop, not the Emperor)
    assert.equal(reformError(game, "DDD"), null);
    const up = order(game, cmd("AAA", "proposeReform"));
    assert.deepEqual([ofType(up, "reform")[0].name, ofType(up, "reform")[0].passed, st.empire.reforms], ["Eternal Public Peace", true, 1]);
    // EEE a person too, saying no: the cities against, the princes split — voted down, and 5 years to wait
    st.humans.push("EEE");
    st.empire.authority = 60;
    order(game, cmd("EEE", "reformVote", { yes: false }));
    const down = order(game, cmd("AAA", "proposeReform"));
    assert.deepEqual([ofType(down, "reform")[0].passed, st.empire.reforms, st.empire.tried], [false, 1, st.day]);
    assert.match(refused(game, cmd("AAA", "proposeReform")), /less than 5 years ago/);
});

test("the Eternal Public Peace binds every German state, the Emperor too — but not against one under the ban", () => {
    const game = empire(), st = game.state;
    st.empire.reforms = 1;
    assert.deepEqual(ofType(order(game, cmd("BBB", "declareWar", { target: "CCC" })), "broke").map((e) => e.country), ["BBB"]);
    assert.deepEqual(ofType(order(game, cmd("AAA", "declareWar", { target: "DDD" })), "broke").map((e) => e.country), ["AAA"]);
    const banned = empire();
    banned.state.empire.reforms = 1;
    banned.state.empire.banned = ["CCC"];
    assert.equal(ofType(order(banned, cmd("BBB", "declareWar", { target: "CCC" })), "broke").length, 0);
});

test("the Common Penny: 1% of every German state's money but the Emperor's into the war chest, paid to the Emperor defending the Empire", async () => {
    const { economyOf } = await import("../../src/engine/index.js");
    const game = outsider(), st = game.state;
    st.empire.reforms = 2;
    const base = economyOf(game, "BBB").moneyPerYear + economyOf(game, "BBB").tributePaid;
    assert.ok(Math.abs(economyOf(game, "BBB").pennyPaid - 0.01 * base) < 1e-6);
    assert.deepEqual([economyOf(game, "AAA").pennyPaid, economyOf(game, "EEE").pennyPaid], [0, 0], "not the Emperor, not an outsider");
    runTo(game, 31);
    assert.ok(st.empire.chest > 0, "a month in the chest");
    const chest = st.empire.chest;
    order(game, cmd("EEE", "declareWar", { target: "DDD" }));                   // the Emperor comes as Defender
    const paid = ofType(runTo(game, 62), "chest");
    assert.ok(paid.length === 1 && paid[0].country === "AAA" && paid[0].money >= chest && st.empire.chest === 0);
});

test("the Imperial Circles: the Emperor may enter every settlement of the Empire; an outsider's attack brings every willing German state in", async () => {
    const { canEnter, opinion } = await import("../../src/engine/index.js");
    const game = outsider(), st = game.state;
    assert.equal(canEnter(game, "AAA", "6"), false);
    st.empire.reforms = 3;
    assert.deepEqual([canEnter(game, "AAA", "6"), canEnter(game, "AAA", "8")], [true, false]);
    const willing = ["BBB", "CCC"].filter((c) => opinion(game, c, "AAA") >= 0);
    const events = order(game, cmd("EEE", "declareWar", { target: "DDD" }));
    assert.deepEqual(ofType(events, "joins").map((e) => e.country).sort(), ["AAA", ...willing].sort());
});

test("the Imperial Chamber Court: a German state that took the Empire's land from another is thought 10 worse of for 10 years", async () => {
    const { opinion } = await import("../../src/engine/index.js");
    const game = empire(), st = game.state;
    st.empire.seized.BBB = st.day;
    const without = opinion(game, "DDD", "BBB");
    st.empire.reforms = 4;
    assert.equal(opinion(game, "DDD", "BBB"), without - 10);
    st.empire.seized.BBB = st.day - 10 * YEAR_DAYS;
    assert.equal(opinion(game, "DDD", "BBB"), without, "after 10 years, no more");
});

test("an outsider never stands, however large; Imperial Italy is the Empire's land, but its holders are no German states", () => {
    const game = outsider(), st = game.state;
    st.settlements[8].pop = 200000;
    assert.deepEqual(candidatesOf(game).includes("EEE"), false, "EEE, an outsider of 200,000, does not stand");
    // Six, CCC's capital, made Imperial Italy: CCC no German state — still land of the Empire
    const italy = empire(1, (sc) => { sc.settlements[5].italy = true; });
    assert.deepEqual([isGermanState(italy, "CCC"), italy.map.hre.has(6)], [false, true]);
});

test("the war chest is paid to an Emperor at war with any outsider, not only as Defender of the Empire", () => {
    const game = outsider(), st = game.state;
    st.empire.chest = 5000;
    order(game, cmd("AAA", "declareWar", { target: "EEE" }));
    const paid = ofType(runTo(game, 31), "chest");
    assert.deepEqual([paid.length, st.empire.chest], [1, 0]);
});
