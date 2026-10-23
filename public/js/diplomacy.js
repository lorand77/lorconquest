// The Diplomacy tab (design.md, "The game screen"): questions waiting for the player, wars and how they stand, agreements,
// subjects, and a country picked to deal with — declaring war, a peace with terms and what the computer will make of
// them, agreements with what to expect, demands, the Empire. Like panels.js it only sends commands; the numbers (opinion,
// war score, the bar an agreement must reach, the chance of a demand) are the engine's own, worked out in the browser from
// the state it holds. Nothing here changes the game.
import { BAR, agreementAnswer, bordering, demandChance, hreSettlementsOf, longDate, militaryPowerOf, opinion, peaceAnswer, subjectsOf, validateTerms, warJoiners, warScore } from "/engine/index.js";
import { formatNumber } from "./mirror.js";

// a settlement by its name alone, as peace terms show it (names are unique within a scenario)
const town = (ctx, id) => ctx.game.map.nodes.get(String(id))?.name ?? String(id);

const n = formatNumber;
const AGREEMENT_NAMES = { defensive: "defensive alliance", military: "military alliance", guarantee: "guarantee", pact: "non-aggression pact (10 years)", access: "military access" };
const ASK_LABEL = { defensive: "Propose a defensive alliance", military: "Propose a military alliance", guarantee: "Guarantee them", pact: "Propose a non-aggression pact", access: "Ask for military access" };
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const section = (ctx, title, ...children) => ctx.make("section", { class: "block" }, ctx.make("h3", {}, title), ...children);
const row = (ctx, ...children) => ctx.make("div", { class: "row" }, ...children);
const act = (ctx, cmd) => async () => { await ctx.send(cmd()); ctx.redraw(); };

// what a question put to the player says
function offerText(ctx, o) {
    const who = (c) => ctx.state.countries[c].name;
    if (o.kind === "call") return `${who(o.from)} calls you to arms against ${who(o.enemy)} (${o.side === "att" ? "their attack" : "their defence"}). Refusing ends the alliance; no answer by ${longDate(o.deadline)} is a yes.`;
    if (o.kind === "agreement") return `${who(o.from)} proposes a ${AGREEMENT_NAMES[o.agreement]}.`;
    if (o.kind === "demand") return `${who(o.from)} demands that you become its ${o.subject}.`;
    if (o.kind === "empire") return `${who(o.from)} demands the Empire: join as its protectorate, or join the League against it.`;
    const t = o.terms ?? {};
    const parts = [t.take?.length && `it takes ${t.take.map((id) => town(ctx, id)).join(", ")}`, t.give?.length && `it gives you ${t.give.map((id) => town(ctx, id)).join(", ")}`,
        t.money && `${t.money > 0 ? "you pay" : "it pays"} ${n(Math.abs(t.money))}`, t.makeSubject && `you become its ${t.makeSubject}`, t.becomeSubject && `it becomes your ${t.becomeSubject}`].filter(Boolean);
    return `${who(o.from)} proposes peace${parts.length ? `: ${parts.join("; ")}` : ""}.`;
}

export function diplomacyTab(ctx) {
    const { state, game, me, make: mk } = ctx, c = state.countries[me];
    const out = [];
    const name = (code) => state.countries[code]?.name ?? code;
    const offers = c.offers ?? [];

    // questions waiting
    const asked = offers.filter((o) => o.to === me);
    if (asked.length) {
        out.push(section(ctx, "Waiting for your answer", ...asked.map((o) => mk("div", { class: "offer" }, mk("p", {}, offerText(ctx, o)),
            row(ctx, mk("button", { class: "primary", onclick: act(ctx, () => ({ type: "answerOffer", id: o.id, accept: true })) }, o.kind === "call" ? "Join" : "Accept"),
                mk("button", { onclick: act(ctx, () => ({ type: "answerOffer", id: o.id, accept: false })) }, o.kind === "call" ? "Refuse (the alliance ends)" : "Refuse"))))));
    }
    const waiting = offers.filter((o) => o.from === me);
    if (waiting.length) out.push(section(ctx, "Waiting for an answer", ...waiting.map((o) => mk("p", {}, `${name(o.to)}: ${offerText(ctx, o).replace(`${name(o.from)} `, "you ")}`))));

    // wars and how they stand
    const wars = state.wars.filter((w) => w.split("|").includes(me)).map((w) => w.split("|").find((x) => x !== me));
    out.push(section(ctx, `Standing — warmonger score ${Math.round(c.warmonger ?? 0)}`,
        c.overlord ? mk("p", {}, `You are a ${c.subjectKind} of ${name(c.overlord)}.`) : "",
        subjectsOf(state, me).length ? mk("p", {}, `Your subjects: ${subjectsOf(state, me).map((s) => `${name(s)} (${state.countries[s].subjectKind})`).join(", ")}.`) : "",
        wars.length ? mk("div", {}, ...wars.map((e) => {
            const w = state.warInfo[pairKey(me, e)], s = state.countries[e].rebel ? null : warScore(game, me, e);
            return row(ctx, mk("span", { class: "w" }, ctx.swatch(e), ` ${name(e)}${w ? ` since ${longDate(w.start)}` : ""}${s === null ? " (peasants: no peace)" : `: war score ${s >= 0 ? "+" : ""}${s.toFixed(1)}`}`),
                s === null ? "" : mk("button", { onclick: () => { ctx.ui.target = e; ctx.redraw(); } }, "Peace…"));
        })) : mk("p", { class: "hint" }, "At peace.")));

    // agreements
    const mine = state.agreements.filter((x) => x.a === me || x.b === me);
    const line = (x) => {
        const other = x.a === me ? x.b : x.a, until = x.until !== null ? ` until ${longDate(x.until)}` : "";
        if (x.kind === "guarantee") return [x.a === me ? `You guarantee ${name(other)}` : `${name(other)} guarantees you`, x.a === me ? { type: "breakAgreement", with: other, kind: "guarantee" } : null, "Break"];
        if (x.kind === "access") return [x.a === me ? `You give ${name(other)} military access` : `${name(other)} gives you military access`, x.a === me ? { type: "cancelAccess", with: other } : null, "Cancel"];
        return [`${AGREEMENT_NAMES[x.kind] ?? x.kind} with ${name(other)}${until}`, { type: "breakAgreement", with: other, kind: x.kind }, "Break"];
    };
    out.push(section(ctx, "Agreements", mine.length ? mk("div", {}, ...mine.map((x) => {
        const [text, cmd, label] = line(x);
        return row(ctx, mk("span", { class: "w" }, text), cmd ? mk("button", { class: "danger", onclick: async () => {
            const breaks = cmd.type === "breakAgreement" ? " Breaking an agreement ends all your alliances and every computer country's opinion of you falls by 40 for 10 years." : "";
            if (confirm(`${label}: ${text}?${breaks}`)) { await ctx.send(cmd); ctx.redraw(); }
        } }, label) : "");
    })) : mk("p", { class: "hint" }, "None.")));

    // a country to deal with
    // (a country that is out of the game is no one to deal with)
    const others = Object.values(state.countries).filter((x) => x.code !== me && !x.rebel && (x.out ?? null) === null).sort((a, b) => a.name.localeCompare(b.name));
    const pick = ctx.ui.target && ctx.state.countries[ctx.ui.target] ? ctx.ui.target : others.find((x) => bordering(game, me, x.code))?.code ?? others[0]?.code;
    const sel = mk("select", {}, ...others.map((x) => mk("option", { value: x.code, ...(x.code === pick ? { selected: "selected" } : {}) }, `${x.name}${bordering(game, me, x.code) ? " ·" : ""}`)));
    sel.addEventListener("change", () => { ctx.ui.target = sel.value; ctx.redraw(); });
    out.push(section(ctx, "Deal with", row(ctx, sel), mk("p", { class: "hint" }, "· borders you. Or click a country's land on the map.")));
    if (pick) out.push(...dealWith(ctx, pick));
    return out;
}

// who a country is at war with, and since when: you first, then the others by name; peasant rebels as an uprising
function warsOf(ctx, t) {
    const { state, me, make: mk } = ctx;
    const foes = state.wars.filter((w) => w.split("|").includes(t)).map((w) => w.split("|").find((x) => x !== t))
        .sort((a, b) => (b === me) - (a === me) || (state.countries[a]?.name ?? a).localeCompare(state.countries[b]?.name ?? b));
    if (!foes.length) return mk("p", { class: "hint" }, "At peace.");
    const since = (e) => { const w = state.warInfo[pairKey(t, e)]; return w ? ` since ${longDate(w.start)}` : ""; };
    return mk("p", {}, "At war with: ", ...foes.flatMap((e, i) => [i ? ", " : "", ctx.swatch(e),
        state.countries[e]?.rebel ? ` peasant rebels` : ` ${e === me ? "you" : state.countries[e]?.name ?? e}`, since(e)]), ".");
}

// everything the player can do about one country
function dealWith(ctx, t) {
    const { state, game, me, make: mk } = ctx;
    const them = state.countries[t], out = [];
    const human = state.humans.includes(t), vassal = them.subjectKind === "vassal";
    const atWar = state.wars.includes(pairKey(me, t));
    const op = human ? null : opinion(game, t, me);
    const power = militaryPowerOf(state, t), mypower = militaryPowerOf(state, me);
    out.push(section(ctx, `${them.name}`,
        mk("p", {}, `${n(Object.values(state.settlements).filter((s) => s.owner === t).reduce((k, s) => k + s.pop, 0))} people, military power ${n(power)} against your ${n(mypower)}${bordering(game, me, t) ? ", a neighbour" : ""}.`),
        human ? mk("p", { class: "hint" }, "A person plays this country: proposals wait for its answer.") : mk("p", {}, `Its opinion of you: ${op > 0 ? "+" : ""}${Math.round(op)}. Warmonger score ${Math.round(them.warmonger ?? 0)}.`),
        them.overlord ? mk("p", {}, `A ${them.subjectKind} of ${state.countries[them.overlord].name}${vassal ? ": it has no diplomacy of its own — speak to its overlord" : ""}.`) : "",
        warsOf(ctx, t)));
    if (vassal || state.countries[t].rebel) return out;

    // war
    if (atWar) out.push(...peaceForm(ctx, t));
    else {
        const { auto, calls } = warJoiners(game, me, t);
        const bound = state.agreements.filter((x) => ["pact", "truce", "defensive", "military"].includes(x.kind) && [x.a, x.b].includes(me) && [x.a, x.b].includes(t) || (x.kind === "guarantee" && x.a === me && x.b === t));
        const join = (list) => list.map((e) => state.countries[e[0]].name).join(", ");
        const sidesOf = (side) => [...auto, ...calls].filter((e) => e[e.length - 1] === side);
        out.push(section(ctx, "War",
            sidesOf("def").length ? mk("p", {}, `Would join ${them.name}: ${join(sidesOf("def"))}${calls.some((e) => e[2] === "def") ? " (some may refuse)" : ""}.`) : "",
            sidesOf("att").length ? mk("p", {}, `Would join you: ${join(sidesOf("att"))}.`) : "",
            bound.length ? mk("p", { class: "bad" }, `This breaks ${bound.map((x) => (x.kind === "truce" ? "your truce" : AGREEMENT_NAMES[x.kind])).join(", ")}: your alliances end and the world's opinion of you falls by 40 for 10 years.`) : "",
            mk("button", { class: "danger", onclick: async () => { if (confirm(`Declare war on ${them.name}? It adds 5 to your warmonger score.`)) { await ctx.send({ type: "declareWar", target: t }); ctx.redraw(); } } }, "Declare war")));
    }

    // agreements
    const rows = Object.keys(BAR).filter((kind) => {
        const [a, b] = kind === "access" ? [t, me] : [me, t];
        return !state.agreements.some((x) => x.kind === kind && (kind === "guarantee" || kind === "access" ? x.a === a && x.b === b : [x.a, x.b].includes(me) && [x.a, x.b].includes(t)));
    }).map((kind) => {
        const ans = human ? null : agreementAnswer(game, t, me, kind);
        const hint = ans ? `${ans.accept ? "likely" : "unlikely"}: opinion ${Math.round(ans.opinion)} + need ${Math.round(ans.need)} against ${ans.bar}` : "a person will answer";
        return row(ctx, mk("button", { disabled: atWar ? "disabled" : undefined, onclick: act(ctx, () => ({ type: "proposeAgreement", with: t, kind })) }, ASK_LABEL[kind]), mk("span", { class: `hint ${ans?.accept ? "good" : ""}` }, hint));
    });
    out.push(section(ctx, "Agreements", ...(atWar ? [mk("p", { class: "hint" }, "Not while at war.")] : rows), mk("p", { class: "hint" }, "The same proposal to the same country once in 5 years.")));

    // demands
    if (!atWar && (!them.overlord || (them.overlord === me && them.subjectKind === "protectorate"))) {
        const kinds = them.overlord === me ? ["vassal"] : ["vassal", "protectorate"];
        out.push(section(ctx, "Demand", ...kinds.map((kind) => {
            const ch = human ? null : demandChance(game, t, me, kind);
            return row(ctx, mk("button", { onclick: async () => { if (confirm(`Demand that ${them.name} become your ${kind}? A refusal makes it hostile for 10 years.`)) { await ctx.send({ type: "demandSubject", target: t, kind }); ctx.redraw(); } } }, `Demand a ${kind}`),
                mk("span", { class: "hint" }, ch ? `${ch.chance.toFixed(0)}% chance` : "a person will answer"));
        })));
    }

    // the Empire
    const needed = game.map.scenario.empire?.needed;
    if (needed && !state.memory.empire[me]) {
        const held = hreSettlementsOf(game, me);
        out.push(section(ctx, "The Empire", mk("p", { class: "hint" }, `Demand that every German state become your protectorate: once, ever, with at least ${needed} settlements inside the Empire (you hold ${held}). The states that refuse form the League.`),
            mk("button", { disabled: held < needed ? "disabled" : undefined, class: "danger", onclick: async () => { if (confirm("Demand the Empire? You may do this only once, ever.")) { await ctx.send({ type: "proposeEmpire" }); ctx.redraw(); } } }, "Demand the Empire")));
    }
    return out;
}

// a peace with terms: what to take and give, money, a subject — and what the other side makes of it
function peaceForm(ctx, t) {
    const { state, game, me, make: mk } = ctx, them = state.countries[t];
    const theirs = Object.values(state.settlements).filter((s) => s.owner === t), mine = Object.values(state.settlements).filter((s) => s.owner === me);
    const human = state.humans.includes(t);
    const checks = (list, label) => list.map((s) => { const box = mk("input", { type: "checkbox", value: String(s.id) }); return [s.id, box, mk("label", { class: "check" }, box, ` ${label(s)}`)]; });
    const takes = checks(theirs, (s) => `${town(ctx, s.id)} (${n(s.pop)})`), gives = checks(mine, (s) => `${town(ctx, s.id)} (${n(s.pop)})`);
    const money = mk("input", { type: "number", step: 1000, value: 0 });
    const subject = mk("select", {}, ...[["", "no subject"], ["makeSubject:vassal", `${them.name} becomes your vassal`], ["makeSubject:protectorate", `${them.name} becomes your protectorate`],
        ["becomeSubject:vassal", `you become ${them.name}'s vassal`], ["becomeSubject:protectorate", `you become ${them.name}'s protectorate`]].map(([v, l]) => mk("option", { value: v }, l)));
    const preview = mk("p", { class: "preview" }, "");
    const terms = () => {
        const t2 = { take: takes.filter(([, b]) => b.checked).map(([id]) => id), give: gives.filter(([, b]) => b.checked).map(([id]) => id), money: Number(money.value) || 0 };
        if (subject.value) { const [k, v] = subject.value.split(":"); t2[k] = v; }
        return t2;
    };
    const update = () => {
        // terms the engine would refuse whoever answers, such as taking its last settlement
        const bad = validateTerms(game, me, t, terms());
        if (bad) { preview.textContent = `Not possible: ${bad}.`; preview.className = "preview bad"; return; }
        if (human) { preview.textContent = "A person will answer."; preview.className = "preview"; return; }
        const a = peaceAnswer(game, t, me, terms());
        preview.textContent = `War score ${a.score.toFixed(1)} against a price of ${a.cost.toFixed(1)}: ${a.accept ? "it will accept" : "it will refuse"}.`;
        preview.className = `preview ${a.accept ? "good" : "bad"}`;
    };
    for (const [, b] of [...takes, ...gives]) b.addEventListener("change", update);
    money.addEventListener("input", update);
    subject.addEventListener("change", update);
    update();
    return [section(ctx, `Peace with ${them.name}`,
        mk("details", { open: "open" }, mk("summary", {}, `Take from ${them.name}`), mk("div", { class: "checks" }, ...takes.map((x) => x[2]))),
        mk("details", {}, mk("summary", {}, "Give to them"), mk("div", { class: "checks" }, ...gives.map((x) => x[2]))),
        row(ctx, mk("label", {}, "Money (+ they pay you) "), money),
        row(ctx, subject),
        preview,
        mk("button", { class: "primary", onclick: async () => { const r = await ctx.send({ type: "proposePeace", with: t, terms: terms() }); if (r.ok) ctx.redraw(); } }, "Propose peace"),
        mk("p", { class: "hint" }, "Price: what you ask, in % of its people, 10 for a year of its money, 50 for a vassal or 25 for a protectorate — less what you give. A peace leaves each side at least one settlement. War score: the share of its people you took, less the share of yours it took, plus how much stronger you are."))];
}
