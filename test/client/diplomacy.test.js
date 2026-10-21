// The Diplomacy tab (public/js/diplomacy.js) in Node against a fake element, on a real game's view: it shows the engine's
// numbers and its controls send the right commands.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };

register("./loader.mjs", import.meta.url);
globalThis.confirm = () => true;
const { Game, buildMap } = await import("../../src/engine/index.js");
const { viewFor } = await import("../../src/game/view.js");
const { diplomacyTab } = await import("../../public/js/diplomacy.js");

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
        this.checked = false;
    }
    addEventListener(ev, fn) { this.handlers[ev] = fn; }
    set textContent(t) { this.children = [t]; }
    get text() { return this.children.map((c) => (typeof c === "string" ? c : c.text)).join(" "); }
    all(pred, out = []) { if (pred(this)) out.push(this); for (const c of this.children) if (c instanceof El) c.all(pred, out); return out; }
}
const make = (tag, props = {}, ...children) => new El(tag, props, children);
const find = (nodes, pred) => nodes.flatMap((n) => (n instanceof El ? n.all(pred) : []));
const button = (nodes, label) => find(nodes, (e) => e.tag === "button" && e.text.includes(label))[0];
const textOf = (nodes) => nodes.map((n) => n.text).join(" | ");

function setup(prepare = () => {}, target = null) {
    const game = Game.create(scenario, { seed: 2, humans: ["BAV"] });
    prepare(game);
    const mirror = JSON.parse(JSON.stringify(viewFor(game.state, "BAV")));
    const sent = [];
    const ctx = {
        make, swatch: (code) => make("span", {}, code), state: mirror, game: new Game(buildMap(scenario), mirror), me: "BAV", sel: null, ui: { target },
        send: async (cmd) => { sent.push(cmd); return { ok: true, events: [] }; }, redraw: () => {}, name: (key) => `place ${key}`,
    };
    return { ctx, sent, game };
}

test("the tab shows your standing, a neighbour to deal with, and what each proposal is likely to meet", async () => {
    const { ctx, sent } = setup(() => {}, "SWI");
    const nodes = diplomacyTab(ctx);
    const text = textOf(nodes);
    assert.match(text, /Standing — warmonger score 0/);
    assert.match(text, /At peace\./);
    assert.match(text, /Switzerland/);
    assert.match(text, /Its opinion of you: [+-]?\d+/);
    assert.match(text, /(likely|unlikely): opinion -?\d+ \+ need \d+ against 20/);                   // a defensive alliance: the bar is 20
    await button(nodes, "Guarantee them").handlers.click();
    await button(nodes, "Propose a defensive alliance").handlers.click();
    await button(nodes, "Ask for military access").handlers.click();
    await button(nodes, "Demand a vassal").handlers.click();
    assert.deepEqual(sent, [{ type: "proposeAgreement", with: "SWI", kind: "guarantee" }, { type: "proposeAgreement", with: "SWI", kind: "defensive" },
        { type: "proposeAgreement", with: "SWI", kind: "access" }, { type: "demandSubject", target: "SWI", kind: "vassal" }]);
    assert.match(text, /\d+% chance/);
});

test("declaring war says who would join and what it breaks", async () => {
    const { ctx, sent } = setup((game) => {
        game.command({ type: "proposeAgreement", country: "BAV", with: "ULM", kind: "pact" });
        game.state.agreements.push({ kind: "defensive", a: "STU", b: "ULM", since: 0, until: null });
    }, "ULM");
    const nodes = diplomacyTab(ctx), text = textOf(nodes);
    assert.match(text, /Would join Ulm: Stuttgart/);
    assert.match(text, /breaks non-aggression pact/);
    await button(nodes, "Declare war").handlers.click();
    assert.deepEqual(sent, [{ type: "declareWar", target: "ULM" }]);
});

test("a question put to you is answered with Accept or Refuse; a call to arms with Join or Refuse", async () => {
    const { ctx, sent, game } = setup((g) => {
        g.command({ type: "proposeAgreement", country: "RUH", with: "BAV", kind: "pact" });
        g.state.agreements.push({ kind: "military", a: "BAV", b: "SAX", since: 0, until: null });
        g.command({ type: "declareWar", country: "SAX", target: "BRB" });
    });
    const nodes = diplomacyTab(ctx), text = textOf(nodes);
    assert.match(text, /Waiting for your answer/);
    assert.match(text, /Ruhr proposes a non-aggression pact/);
    assert.match(text, /Saxony calls you to arms against Brandenburg \(their attack\)\. Refusing ends the alliance/);
    const accepts = find(nodes, (e) => e.tag === "button" && (e.text === "Accept" || e.text === "Join"));
    await accepts[0].handlers.click();
    await button(nodes, "Refuse (the alliance ends)").handlers.click();
    assert.deepEqual(sent.map((c) => [c.type, c.accept]), [["answerOffer", true], ["answerOffer", false]]);
    assert.deepEqual(game.state.offers.map((o) => o.kind).sort(), ["agreement", "call"]);
});

test("at war: the war score, and a peace form whose preview is the computer's own answer", async () => {
    const { ctx, sent } = setup((game) => { game.command({ type: "declareWar", country: "BAV", target: "ULM" }); });
    const nodes = diplomacyTab({ ...ctx, ui: { target: "ULM" } }), text = textOf(nodes);
    assert.match(text, /Ulm since 1 January 1440: war score \+\d+\.\d/);
    assert.match(text, /Peace with Ulm/);
    assert.match(text, /War score \d+\.\d against a price of 0\.0: it will accept\./);               // a plain peace while ahead
    const takes = find(nodes, (e) => e.attrs.type === "checkbox" && e.attrs.value === "48")[0];
    takes.checked = true;
    await takes.handlers.change();
    const preview = find(nodes, (e) => e.attrs.class?.startsWith("preview"))[0];
    assert.match(preview.text, /against a price of 100\.0: it will refuse\./);                        // all of Ulm's people
    const money = find(nodes, (e) => e.attrs.type === "number")[0];
    takes.checked = false;
    money.value = "1000";
    await money.handlers.input();
    assert.match(preview.text, /it will accept/);
    await button(nodes, "Propose peace").handlers.click();
    assert.deepEqual(sent, [{ type: "proposePeace", with: "ULM", terms: { take: [], give: [], money: 1000 } }]);
    assert.equal(button(nodes, "Declare war"), undefined);
    assert.match(textOf(find(nodes, (e) => e.tag === "section" && e.text.includes("Agreements"))), /Not while at war/);
});

test("agreements you hold can be broken or cancelled; a vassal is not dealt with; the Empire asks for enough settlements", async () => {
    const { ctx, sent } = setup((game) => {
        game.state.agreements.push({ kind: "defensive", a: "BAV", b: "TYR", since: 0, until: null }, { kind: "access", a: "BAV", b: "AUS", since: 0, until: null },
            { kind: "guarantee", a: "SAL", b: "BAV", since: 0, until: null });
        game.state.countries.ULM.overlord = "STU";
        game.state.countries.ULM.subjectKind = "vassal";
    }, "ULM");
    const nodes = diplomacyTab(ctx), text = textOf(nodes);
    assert.match(text, /defensive alliance with Tyrol/);
    assert.match(text, /You give Austria military access/);
    assert.match(text, /Salzburg guarantees you/);
    assert.match(text, /A vassal of Stuttgart: it has no diplomacy of its own/);
    assert.equal(button(nodes, "Declare war"), undefined);
    await button(nodes, "Break").handlers.click();
    await button(nodes, "Cancel").handlers.click();
    assert.deepEqual(sent, [{ type: "breakAgreement", with: "TYR", kind: "defensive" }, { type: "cancelAccess", with: "AUS" }]);
    const emp = diplomacyTab({ ...ctx, ui: { target: "SWI" } });
    assert.match(textOf(emp), /at least 10 settlements inside the Empire \(you hold 4\)/);
    assert.equal(button(emp, "Demand the Empire").attrs.disabled, "disabled");
});
