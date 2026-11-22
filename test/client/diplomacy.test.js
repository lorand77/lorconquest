// The Diplomacy tab (public/js/diplomacy.js) in Node against a fake element, on a real game's view: it shows the engine's
// numbers and its controls send the right commands.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };

register("./loader.mjs", import.meta.url);
globalThis.confirm = () => true;
const { Game, buildMap, describeEvent } = await import("../../src/engine/index.js");
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
    // a defensive alliance: the bar is 20 for 10 years, 30 for 20
    assert.match(text, /10 years (likely|unlikely), 20 years (likely|unlikely): opinion -?\d+ \+ need \d+ against 20 or 30/);
    await button(nodes, "Guarantee them").handlers.click();
    await button(nodes, "Propose a defensive alliance: 10 years").handlers.click();
    const twenty = find(nodes, (e) => e.tag === "button" && e.text === "20 years");
    assert.equal(twenty.length, 2, "a defensive and a military alliance, each for 10 or 20 years");
    await twenty[0].handlers.click();
    await button(nodes, "Ask for military access").handlers.click();
    assert.deepEqual(sent, [{ type: "proposeAgreement", with: "SWI", kind: "guarantee" }, { type: "proposeAgreement", with: "SWI", kind: "defensive", years: 10 },
        { type: "proposeAgreement", with: "SWI", kind: "defensive", years: 20 },
        { type: "proposeAgreement", with: "SWI", kind: "access" }]);
    // Switzerland borders neither Bavaria nor its subjects: no demand (a neighbour's, with its odds: the tests below)
    assert.match(text, /a subject is made only of a neighbour/);
    assert.match(textOf(diplomacyTab(setup(() => {}, "TYR").ctx)), /\d+% chance/);
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
    assert.match(preview.text, /Not possible: ULM would be left with no settlement/);               // Ulm is one town: a peace leaves it that
    const money = find(nodes, (e) => e.attrs.type === "number")[0];
    takes.checked = false;
    money.value = "1000";
    await money.handlers.input();
    assert.match(preview.text, /it will refuse/);                                               // nothing taken yet: strength alone wins nothing
    await button(nodes, "Propose peace").handlers.click();
    assert.deepEqual(sent, [{ type: "proposePeace", with: "ULM", terms: { take: [], give: [], money: 1000 } }]);
    assert.equal(button(nodes, "Declare war"), undefined);
    assert.match(textOf(find(nodes, (e) => e.tag === "section" && e.text.includes("Agreements"))), /Not while at war/);
});

test("a peace makes a subject only of a neighbour: the form offers none with a country out of reach", () => {
    const near = textOf(diplomacyTab({ ...setup((game) => { game.command({ type: "declareWar", country: "BAV", target: "ULM" }); }).ctx, ui: { target: "ULM" } }));
    assert.match(near, /Ulm becomes your vassal/);
    assert.match(near, /you become Ulm's protectorate/);
    const far = textOf(diplomacyTab({ ...setup((game) => { game.command({ type: "declareWar", country: "BAV", target: "HUN" }); }).ctx, ui: { target: "HUN" } }));
    assert.match(far, /Peace with Hungary/);
    assert.doesNotMatch(far, /becomes your vassal|Hungary's protectorate/);
});

test("a peace can give money as well as ask it: who pays, how much — and a quarter, half or all of the treasury at a click", async () => {
    const { ctx, sent } = setup((game) => { game.command({ type: "declareWar", country: "BAV", target: "ULM" }); });
    const nodes = diplomacyTab({ ...ctx, ui: { target: "ULM" } });
    const payer = find(nodes, (e) => e.tag === "select" && e.children.some((o) => o.attrs?.value === "you"))[0];
    const money = find(nodes, (e) => e.attrs.type === "number")[0];
    assert.match(textOf(nodes), /Your treasury: 100,000\. Offer/);
    payer.value = "you";
    money.value = "5000";
    await payer.handlers.change();
    await button(nodes, "Propose peace").handlers.click();
    assert.deepEqual(sent.at(-1).terms.money, -5000, "you pay them: the terms' money is negative");
    await button(nodes, "½").handlers.click();
    assert.deepEqual([payer.value, money.value], ["you", "50000"]);
    await button(nodes, "Propose peace").handlers.click();
    assert.equal(sent.at(-1).terms.money, -50000);
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
    // the Empire is a section of its own, whoever is picked — even a vassal
    const emp = diplomacyTab(ctx), ui = ctx.ui;
    // one line while a demand is out of reach — no estimate, no button that can only be refused
    assert.match(textOf(emp), /You hold 4 of its 55 settlements; a demand needs 10\./);
    assert.doesNotMatch(textOf(emp), /would join/);
    assert.equal(button(emp, "Demand the Empire"), undefined);
    button(emp, "Show on map").handlers.click();
    assert.equal(ui.empire, true);
    assert.ok(button(diplomacyTab(ctx), "Whole map"));
    // with enough of it held: what the German states would do, and the button
    const others = ctx.game.map.scenario.settlements.filter((x) => x.hre && ctx.state.settlements[x.id].owner !== "BAV");
    for (const x of others.slice(0, 6)) ctx.state.settlements[x.id].owner = "BAV";                       // 4 + 6 = the 10 needed
    const able = diplomacyTab(ctx);
    assert.match(textOf(able), /Now: about \d+ of \d+ computer states would join/);
    assert.equal(button(able, "Demand the Empire").attrs.disabled, undefined);
    // near victory nobody bows: at three quarters of the 45 that win, every computer state would refuse
    const saved = Object.fromEntries(Object.values(ctx.state.settlements).map((x) => [x.id, x.owner]));
    for (const x of Object.values(ctx.state.settlements).filter((x) => x.owner !== "BAV").slice(0, 25)) x.owner = "BAV";
    assert.match(textOf(diplomacyTab(ctx)), /Now: you are too near victory — every computer state would refuse and join the League/);
    for (const x of Object.values(ctx.state.settlements)) x.owner = saved[x.id];
    // once demanded: what came of it, and no button
    ctx.state.memory.empire.BAV = { league: ["SAX"] };
    ctx.state.countries.ULM.overlord = "BAV";
    ctx.state.countries.ULM.subjectKind = "protectorate";
    const after = diplomacyTab(ctx);
    assert.match(textOf(after), /You demanded the Empire\. Its protectorates in the Empire: Ulm\. The League against it: Saxony\./);
    assert.equal(button(after, "Demand the Empire"), undefined);
});

test("peace terms name settlements without their numbers: in a question, in the form and in the news", () => {
    const { ctx } = setup((g) => {
        g.command({ type: "declareWar", country: "BAV", target: "ULM" });
        g.command({ type: "proposePeace", country: "ULM", with: "BAV", terms: { take: [38] } });   // Memmingen, next to Ulm
    });
    const nodes = diplomacyTab({ ...ctx, ui: { target: "ULM" } }), text = textOf(nodes);
    assert.match(text, /Ulm proposes peace: it takes Memmingen\./);
    assert.match(text, /Ulm \(\d[\d,]*\)/);                                     // the form's box: name and people, no number
    assert.ok(!/\b(38|48) (Memmingen|Ulm)/.test(text), text);
    assert.equal(describeEvent(ctx.game.map, { type: "peace", country: "ULM", with: "BAV", terms: { take: [36], give: [48] } }),
        "ULM and BAV make peace, ULM takes Passau, ULM gives Ulm");
});

test("the country dealt with shows who it is at war with, and since when — you first — or that it is at peace", () => {
    const { ctx } = setup((game) => {
        game.command({ type: "declareWar", country: "SAX", target: "BAV" });
        game.command({ type: "declareWar", country: "SAX", target: "BRB" });
    });
    const text = textOf(diplomacyTab({ ...ctx, ui: { target: "SAX" } }));
    assert.match(text, /At war with:\s+BAV\s+you\s+since 1 January 1440\s*,\s+BRB\s+Brandenburg\s+since 1 January 1440\s*\./);
    assert.match(textOf(diplomacyTab({ ...ctx, ui: { target: "ULM" } })), /At peace\./);
});

test("your own vassal shows Integrate: why not until it may, then the button, which integrates at once, with no question", async () => {
    const vassal = (game) => {
        const u = game.state.countries.ULM;
        Object.assign(u, { overlord: "BAV", subjectKind: "vassal", vassalSince: 0 });
    };
    let { ctx } = setup(vassal, "ULM");
    let nodes = diplomacyTab(ctx);
    assert.match(textOf(nodes), /Your vassal since 1 January 1440/);
    assert.equal(button(nodes, "Integrate").attrs.disabled, "disabled");
    assert.match(textOf(nodes), /after 15 years: ULM on 1 January 1455/);
    let sent;
    ({ ctx, sent } = setup((game) => { vassal(game); game.state.day = 15 * 365; }, "ULM"));
    nodes = diplomacyTab(ctx);
    assert.equal(button(nodes, "Integrate").attrs.disabled, undefined);
    const asked = globalThis.confirm;
    globalThis.confirm = () => { throw new Error("no question for an integration"); };
    try {
        await button(nodes, "Integrate").handlers.click();
    } finally {
        globalThis.confirm = asked;
    }
    assert.deepEqual(sent, [{ type: "integrate", target: "ULM" }]);
});

test("a rival is shown as one, and never agrees to become your subject; every demand says what a yes adds to your warmonger score", () => {
    const { ctx } = setup(() => {}, "AUS");                                   // Bavaria and Austria are rivals in the scenario
    const text = textOf(diplomacyTab(ctx));
    assert.match(text, /Rivals: (.+, )?you(, .+)? — it will never agree to become your subject/);
    assert.match(text, /Demand a vassal\s*never: your rival · \+[\d.]+ warmonger if it agrees/);
    assert.match(text, /Demand a protectorate\s*never: your rival · \+[\d.]+ warmonger if it agrees/);
    const other = textOf(diplomacyTab(setup(() => {}, "TYR").ctx));
    assert.doesNotMatch(other, /never: your rival/);
    assert.match(other, /Rivals: .*Switzerland/);
    assert.match(other, /No country agrees to become the subject of one at 75% of victory/);
    // a country Bavaria does not border: no demand, and why
    assert.match(textOf(diplomacyTab(setup(() => {}, "SWI").ctx)), /Switzerland borders neither you nor your subjects: a subject is made only of a neighbour/);
});

test("Declare war says how many planned marches go with it", () => {
    const { ctx } = setup(() => {}, "AUS");
    assert.ok(find(diplomacyTab(ctx), (e) => e.tag === "button" && e.text === "Declare war").length, "none planned: as before");
    ctx.planned = (t) => (t === "AUS" ? 2 : 0);
    assert.ok(find(diplomacyTab(ctx), (e) => e.tag === "button" && e.text === "Declare war — and send 2 planned marches").length);
    ctx.planned = () => 1;
    assert.ok(find(diplomacyTab(ctx), (e) => e.tag === "button" && e.text === "Declare war — and send 1 planned march").length);
});

test("a protectorate's war can be joined from the Diplomacy tab, on its side", async () => {
    const { ctx, sent } = setup((game) => {
        Object.assign(game.state.countries.ULM, { overlord: "BAV", subjectKind: "protectorate" });
        game.command({ type: "declareWar", country: "STU", target: "ULM" });
    }, "ULM");
    globalThis.confirm = () => true;
    const join = find(diplomacyTab(ctx), (e) => e.tag === "button" && e.text.startsWith("Join its war against"))[0];
    assert.ok(join, "Ulm, Bavaria's protectorate, at war with Stuttgart");
    await join.handlers.click();
    assert.deepEqual(sent.at(-1), { type: "joinWar", ally: "ULM", enemy: "STU" });
    delete globalThis.confirm;
});

test("a demand goes at once, with no question to answer: the button says what a refusal costs", async () => {
    const { ctx, sent } = setup(() => {}, "TYR");
    const asked = globalThis.confirm;
    globalThis.confirm = () => { throw new Error("no question for a demand"); };
    try {
        const nodes = diplomacyTab(ctx);
        const demand = button(nodes, "Demand a protectorate");
        assert.match(demand.props?.title ?? demand.attrs?.title ?? "", /A refusal makes Tyrol hostile for 10 years/);
        await demand.handlers.click();
        assert.deepEqual(sent, [{ type: "demandSubject", target: "TYR", kind: "protectorate" }]);
    } finally {
        globalThis.confirm = asked;
    }
});

test("the crown, where the scenario has electors: the Emperor, the next election, each vote and its leaning; your vote; your promises", async () => {
    const fs = await import("node:fs"), path = await import("node:path");
    const hist = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "..", "scenarios", "historical-1440", "scenario.json"), "utf8"));
    // Bohemia, a person: it holds Prague's vote and stands
    const game = Game.create(hist, { seed: 2, humans: ["BOH"] });
    Object.assign(game.state.empire, { emperor: null, late: "STY", called: true, next: 182 });   // the Emperor dead, the electors to meet
    const mirror = JSON.parse(JSON.stringify(viewFor(game.state, "BOH"))), sent = [];
    const ctx = {
        make, swatch: (code) => make("span", {}, code), state: mirror, game: new Game(buildMap(hist), mirror), me: "BOH", sel: null, ui: { target: null },
        send: async (cmd) => { sent.push(cmd); return { ok: true, events: [] }; }, redraw: () => {}, name: (key) => `place ${key}`,
    };
    const nodes = diplomacyTab(ctx), text = textOf(nodes);
    assert.match(text, /The throne is empty \(the late Emperor: Inner Austria\): the electors meet on 2 July 1440\./);
    assert.match(text, /Imperial Authority: 20 — German states think 4 better of the Emperor\. The free cities pay it 5% of their money: Augsburg, Basel/);
    assert.match(text, /Archbishop of Mainz, Mainz: Mainz — would vote for Inner Austria/);
    assert.match(text, /King of Bohemia, Prague: you — would vote for you/);
    const vote = find(nodes, (e) => e.tag === "select" && e.children.some((o) => o.attrs?.value === "STY"))[0];
    vote.value = "STY";
    await vote.handlers.change();
    assert.deepEqual(sent.at(-1), { type: "electorVote", candidate: "STY" });
    assert.match(text, /You stand\. Promise electors money/);
    await button(nodes, "Promise").handlers.click();
    assert.equal(sent.at(-1).type, "promise");
});

test("the peace form says why land not won in the field is refused: a town asked of a country nothing has been taken from", async () => {
    const { ctx } = setup((game) => { game.command({ type: "declareWar", country: "BAV", target: "LGE" }); });
    const nodes = diplomacyTab({ ...ctx, ui: { target: "LGE" } });
    const town = find(nodes, (e) => e.attrs.type === "checkbox" && e.attrs.value === "47")[0];
    town.checked = true;
    await town.handlers.change();
    const preview = find(nodes, (e) => e.attrs.class?.startsWith("preview"))[0];
    assert.match(preview.text, /You ask for settlements of [\d,]+ people, and have taken none in this war: land is won in the field, not at the table — it will refuse\./);
});
