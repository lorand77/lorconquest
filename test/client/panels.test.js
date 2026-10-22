// The country panels (public/js/panels.js) run in Node against a fake element, on a real game's view: they draw
// without error, show the engine's own numbers, and their controls send the right commands.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };

register("./loader.mjs", import.meta.url);
const { Game, buildMap } = await import("../../src/engine/index.js");
const { viewFor } = await import("../../src/game/view.js");
const { armyEquipment, countryTab, fleetPanel, researchTab, shopTab } = await import("../../public/js/panels.js");

// the least element the panels use
class El {
    constructor(tag, props, children) {
        this.tag = tag;
        this.attrs = {};
        this.handlers = {};
        this.children = children.flat().filter((c) => c !== "" && c !== undefined && c !== null);
        for (const [k, v] of Object.entries(props)) {
            if (k.startsWith("on")) this.handlers[k.slice(2)] = v;
            else this.attrs[k] = v;
        }
        const chosen = this.children.find((c) => c.attrs?.selected) ?? this.children[0];
        this.value = this.attrs.value ?? (tag === "select" ? chosen?.attrs.value : "");
    }
    addEventListener(ev, fn) { this.handlers[ev] = fn; }
    set textContent(t) { this.children = [t]; }
    get text() { return this.children.map((c) => (typeof c === "string" ? c : c.text)).join(" "); }
    all(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof El) c.all(pred, out); return out; }
}
const make = (tag, props = {}, ...children) => new El(tag, props, children);
const find = (nodes, pred) => nodes.flatMap((n) => (n instanceof El ? n.all(pred) : []));
const button = (nodes, label) => find(nodes, (e) => e.tag === "button" && e.text.includes(label))[0];

// a context on a real game as Bavaria sees it, which records what it is asked to send
function setup(prepare = () => {}, me = "BAV") {
    const game = Game.create(scenario, { seed: 2 });
    prepare(game);
    const mirror = JSON.parse(JSON.stringify(viewFor(game.state, me)));
    const view = new Game(buildMap(scenario), mirror);
    const sent = [];
    const ctx = {
        make, swatch: (code) => make("span", {}, code), state: mirror, game: view, me, sel: null,
        send: async (cmd) => { sent.push(cmd); return { ok: true }; }, redraw: () => {}, name: (key) => `place ${key}`,
    };
    return { ctx, sent, game };
}

test("the Country tab shows the engine's numbers and its controls send commands", async () => {
    const { ctx, sent } = setup();
    const nodes = countryTab(ctx);
    const text = nodes.map((n) => n.text).join(" | ");
    assert.match(text, /Settlement money a year\s+\S+/);
    assert.match(text, /Treasury\s+100,000/);
    assert.match(text, /Soldiers\s+2,000 of 2,500 allowed/);                  // 50,000 people: 5% is 2,500
    const [taxInput] = find(nodes, (e) => e.attrs.type === "range" && e.attrs.max === 30);
    taxInput.value = "27";
    await taxInput.handlers.change();
    const [slider] = find(nodes, (e) => e.attrs.type === "range" && e.attrs.max === 100);
    slider.value = "80";
    await slider.handlers.change();
    const law = find(nodes, (e) => e.tag === "select")[0];
    law.value = "standing";
    await law.handlers.change();
    await button(nodes, "Borrow").handlers.click();
    await button(nodes, "Deposit").handlers.click();
    assert.deepEqual(sent, [
        { type: "setTax", tax: 2.7 }, { type: "setSlider", slider: 80 }, { type: "setLaw", law: "standing" },
        { type: "borrow", chunks: 1 }, { type: "deposit", amount: 10000 },
    ]);
});

test("the Country tab shows the debt clock, rebels, a lost capital and regions ready to proclaim", () => {
    const { ctx } = setup((game) => {
        const c = game.state.countries.BAV;
        c.debtSince = -100; c.loans = 100000;
        game.state.settlements[37].owner = "ULM";                              // Munich, the capital, lost
        for (const id of [32, 33, 34, 35, 39]) game.state.settlements[id].owner = "BAV";
    });
    const text = countryTab(ctx).map((n) => n.text).join(" | ");
    assert.match(text, /In debt since/);
    assert.match(text, /Loans\s+100,000 of/);
    assert.match(text, /Capital lost/);
});

test("the Shop tab: buildings for the selected settlement, forces, weapons — and each button's command", async () => {
    const { ctx, sent } = setup();
    ctx.sel = { kind: "place", key: "37" };
    const nodes = shopTab(ctx);
    const text = nodes.map((n) => n.text).join(" | ");
    assert.match(text, /Buildings in place 37/);
    assert.match(text, /Raise soldiers/);
    assert.match(text, /muskets: 0 in reserve\s+not unlocked/);
    await button(nodes, "walls").handlers.click();
    assert.equal(button(nodes, "Raise").text, "Raise · 60,000 for weapons");     // the best weapon its 100,000 pays for: cavalry
    await button(nodes, "Raise").handlers.click();
    await button(nodes, "Hire").handlers.click();
    const [lots] = find(nodes, (e) => e.attrs.type === "number" && e.attrs.max === 50 && e.attrs.value === 1).slice(-1);
    lots.value = "3";
    await button(nodes, "Buy · 25,000 a lot").handlers.click();                // swords
    await button(nodes, "Buy 1000 people").handlers.click();
    assert.deepEqual(sent, [
        { type: "buyBuilding", building: "walls", settlement: 37 },
        { type: "raise", settlement: 37, kind: "soldiers", lots: 1, weapon: "cavalry" },
        { type: "hireMercenaries", settlement: 37, lots: 1 },
        { type: "buyWeapons", weapon: "swords", lots: 3 },
        { type: "buyPeople", lots: 1 },
    ]);
    const weapon = find(nodes, (e) => e.tag === "select" && e.children.some((o) => o.attrs?.value === "cavalry"))[0];
    weapon.value = "unarmed";
    weapon.handlers.change();
    assert.equal(button(nodes, "Raise").text, "Raise");
    assert.equal(button(nodes, "Build"), undefined);                           // Bavaria has no port
    assert.equal(button(nodes, "Station"), undefined);                         // and no pass, nor the tech
    const noSel = shopTab({ ...ctx, sel: null }).map((n) => n.text).join(" | ");
    assert.match(noSel, /Select one of your settlements/);
    const built = setup((game) => { Object.assign(game.state.settlements[37], { walls: true }); });
    built.ctx.sel = { kind: "place", key: "37" };
    assert.match(shopTab(built.ctx).map((n) => n.text).join(" | "), /✓ walls/);
});

test("the Shop tab stations sharpshooters at a pass of yours", async () => {
    const { ctx, sent } = setup((game) => { game.state.countries.SWI.techs.push("sharpshooters"); }, "SWI");
    const nodes = shopTab(ctx);
    assert.match(nodes.map((n) => n.text).join(" | "), /Sharpshooters/);
    await button(nodes, "Station").handlers.click();
    assert.deepEqual(sent, [{ type: "buySharpshooters", pass: "P1", lots: 1 }]);
});

test("the Shop tab builds ships for a coastal country and lists what is queued", async () => {
    const { ctx, sent } = setup((game) => {
        game.state.countries.NED.training.push({ settlement: 57, kind: "soldiers", weapon: "pikes", n: 1000, ready: 50 });
        game.state.countries.NED.hires.push({ settlement: 58, n: 1000, ready: 20 });
    }, "NED");
    const nodes = shopTab(ctx);
    await button(nodes, "Build").handlers.click();
    assert.deepEqual(sent[0], { type: "buyShips", port: 57, kind: "cogs", lots: 1 });
    assert.match(nodes.map((n) => n.text).join(" | "), /1,000 soldiers with pikes at place 57, ready 20 February 1440[\s\S]*1,000 mercenaries at place 58, arriving 21 January 1440/);
});

test("the Research tab lists the tree and researches an open tech", async () => {
    const { ctx, sent } = setup();
    const nodes = researchTab(ctx);
    const text = nodes.map((n) => n.text).join(" | ");
    assert.match(text, /Hand cannons\s+1\.50M R · needs/);
    assert.match(text, /Muskets\s+3\.50M R/);
    await button(nodes, "Research").handlers.click();                          // only hand cannons and carracks are open
    assert.equal(find(nodes, (e) => e.tag === "button" && e.text === "Research").length, 2);
    assert.equal(sent[0].type, "research");
});

test("a fleet's panel: its ships and status, and orders for a fleet in port", async () => {
    const { ctx, sent } = setup();
    const fleet = Object.values(ctx.state.fleets).find((f) => f.owner === "BAV") ?? null;
    assert.equal(fleet, null);                                                 // Bavaria has none
    ctx.me = "NED";
    const f = Object.values(ctx.state.fleets).find((x) => x.owner === "NED");
    const nodes = fleetPanel(ctx, f);
    assert.match(nodes.map((n) => n.text).join(" | "), /Fleet \d+ · Netherlands[\s\S]*15 cogs[\s\S]*In port at place 57/);
    await button(nodes, "Put to sea").handlers.click();
    assert.deepEqual(sent[0], { type: "sail", fleet: f.id, zone: f.zone });
    f.port = null;                                                             // at sea
    const sea = fleetPanel(ctx, f);
    assert.match(sea.map((n) => n.text).join(" | "), /At sea in North Sea/);
    await button(sea, "Patrol").handlers.click();
    assert.equal(sent[1].type, "patrol");
    f.moving = { to: "skagerrak", start: 0, end: 61 };
    assert.equal(button(fleetPanel(ctx, f), "Patrol"), undefined);              // on its way: no orders
});

test("an army's equipment: equip, add cannons, disband, dismiss", async () => {
    const { ctx, sent } = setup((game) => { game.state.countries.BAV.reserve.swords = 500; game.state.countries.BAV.reserve.cannons = 3; game.state.armies[37].mercs = 100; });
    const a = ctx.state.armies[37];
    const nodes = armyEquipment(ctx, a);
    assert.match(nodes.map((n) => n.text).join(" | "), /Reserve: 500 swords, 3 cannons/);
    await button(nodes, "Equip").handlers.click();
    await button(nodes, "Add cannons").handlers.click();
    await button(nodes, "Dismiss mercenaries (100)").handlers.click();
    assert.deepEqual(sent, [
        { type: "equip", army: 37, from: "swords", to: "cavalry", n: a.men.swords },   // all of them, to the best it has but does not carry
        { type: "equipCannons", army: 37, n: 1 },
        { type: "dismissMercenaries", army: 37, n: 100 },
    ]);
});

test("an army's unarmed are armed at one click, with the best weapon the treasury can buy what is missing of", async () => {
    const { ctx, sent } = setup((game) => { game.state.armies[37].men.unarmed = 1500; game.state.countries.BAV.reserve.cavalry = 200; });
    const a = ctx.state.armies[37];
    const nodes = armyEquipment(ctx, a);
    // cavalry would need 2 lots, 120,000, over the 100,000 in the treasury: pikes, 2 lots for 60,000
    await button(nodes, "Arm 1,500 unarmed with pikes · 60,000").handlers.click();
    assert.deepEqual(sent, [{ type: "buyWeapons", weapon: "pikes", lots: 2 }, { type: "equip", army: 37, from: "unarmed", to: "pikes", n: 1500 }]);
    a.men.unarmed = 0;
    assert.equal(button(armyEquipment(ctx, a), "Arm "), undefined);           // nobody to arm
});

test("the weapon soldiers are raised with stays as the player chose it, redraw after redraw, until changed", async () => {
    const { ctx, sent } = setup();
    ctx.ui = { target: null, raiseWeapon: null };
    const weaponOf = (nodes) => find(nodes, (e) => e.tag === "select" && e.children.some((o) => o.attrs?.value === "cavalry"))[0];
    let nodes = shopTab(ctx);
    assert.equal(weaponOf(nodes).value, "cavalry");                           // nothing chosen yet: the best the treasury pays for
    weaponOf(nodes).value = "pikes";
    weaponOf(nodes).handlers.change();
    assert.equal(ctx.ui.raiseWeapon, "pikes");
    nodes = shopTab(ctx);                                                      // the panel is rebuilt as the days go by
    assert.equal(weaponOf(nodes).value, "pikes");
    assert.equal(button(nodes, "Raise").text, "Raise · 30,000 for weapons");
    await button(nodes, "Raise").handlers.click();
    assert.equal(sent[0].weapon, "pikes");
    weaponOf(nodes).value = "unarmed";                                         // unarmed is a choice too
    weaponOf(nodes).handlers.change();
    assert.equal(weaponOf(shopTab(ctx)).value, "unarmed");
});

test("soldiers can be raised with cannons, one to every 10 of them", async () => {
    const { ctx, sent } = setup();
    ctx.ui = { target: null, raiseWeapon: null };
    const nodes = shopTab(ctx);
    const weapon = find(nodes, (e) => e.tag === "select" && e.children.some((o) => o.attrs?.value === "cannons"))[0];
    assert.match(weapon.text, /with cannons, 1 to 10 men as its crew/);
    weapon.value = "cannons";
    weapon.handlers.change();
    assert.equal(button(nodes, "Raise").text, "Raise · 100,000 for weapons");    // 100 cannons for 1,000 men: one lot
    await button(nodes, "Raise").handlers.click();
    assert.equal(sent[0].weapon, "cannons");
});
