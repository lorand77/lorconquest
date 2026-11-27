// The Diplomacy tab (design.md, "The game screen"): questions waiting for the player, wars and how they stand, agreements,
// subjects, and a country picked to deal with — declaring war, a peace with terms and what the computer will make of
// them, agreements with what to expect, demands — and the Empire, a section of its own. Like panels.js it only sends commands; the numbers (opinion,
// war score, the bar an agreement must reach, the chance of a demand) are the engine's own, worked out in the browser from
// the state it holds. Nothing here changes the game.
import { COALITION_SCORE, boundTo, coalitionError, reformPassed, victoryOf, betrayalPenalty, BAN_COST, BAN_WARMONGER, REFORMS, banError, dietVotes, isGermanState, reformError, CANDIDATE_GERMAN, PROMISE_MONEY, candidatesOf, electorsOf, voteOf, ALLIANCE_YEARS, BAR, NEAR_VICTORY, agreementAnswer, areRivals, isAlliance, subjectChance, bordering, demandChance, germanStates, hreSettlementsOf, integrateError, integratePrice, integrateDays, INTEGRATE_DAYS, outOfReach, subjectWarmonger, withinDemandReach, unionError, unionInto, RELIGION_NAMES, faithOpinion, religionOf, isVassal, wouldCycle, longDate, militaryPowerOf, opinion, peaceAnswer, scores, subjectsOf, validateTerms, warJoiners, warScore } from "/engine/index.js";
import { formatNumber } from "./mirror.js";

// a settlement by its name alone, as peace terms show it (names are unique within a scenario)
const town = (ctx, id) => ctx.game.map.nodes.get(String(id))?.name ?? String(id);

const n = formatNumber;
const AGREEMENT_NAMES = { defensive: "defensive alliance", military: "military alliance", guarantee: "guarantee (20 years)", pact: "non-aggression pact (10 years)", access: "military access" };
const ASK_LABEL = { defensive: "Propose a defensive alliance", military: "Propose a military alliance", guarantee: "Guarantee them", pact: "Propose a non-aggression pact", access: "Ask for military access" };
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const section = (ctx, title, ...children) => ctx.make("section", { class: "block" }, ctx.make("h3", {}, title), ...children);
const row = (ctx, ...children) => ctx.make("div", { class: "row" }, ...children);
const act = (ctx, cmd) => async () => { await ctx.send(cmd()); ctx.redraw(); };

// in a union every ruler must agree to take a country in (RULES.md §10; rooms.js, consent): who has, and whether we have; and
// the button's words — "Propose a union…" alone, "… (alice has)" once another ruler has, "Waiting for bobby" once we have
function agreedBy(ctx, what) {
    const yes = ctx.agreed?.(what) ?? [];
    return { yes, mine: yes.includes(ctx.myName), others: yes.filter((n) => n !== ctx.myName) };
}
function unionLabel(ctx, what, label) {
    const a = agreedBy(ctx, what), fellows = ctx.fellows ?? [];
    if (!fellows.length) return label;
    if (a.mine) return `Waiting for ${fellows.filter((n) => !a.yes.includes(n)).join(" and ")}`;
    return a.others.length ? `${label} (${a.others.join(" and ")} ${a.others.length === 1 ? "has" : "have"})` : `${label} (all of you must)`;
}

// what a question put to the player says
function offerText(ctx, o) {
    const who = (c) => ctx.state.countries[c].name;
    const union = (a, b) => { const into = unionInto(ctx.state, a, b), other = into === a ? b : a; return { into, name: `${who(into)}–${who(other)}` }; };
    if (o.kind === "call" && o.execution) return `The Emperor, ${who(o.from)}, calls the German states to its war of execution against ${who(o.enemy)}, under the imperial ban. Joining costs you no warmonger score; refusing costs nothing, and no answer by ${longDate(o.deadline)} is a no.`;
    if (o.kind === "call" && o.circle) return `${who(o.enemy)}, from outside the Empire, has attacked ${who(o.from)}: the Imperial Circles call you to its defence. Refusing costs nothing; no answer by ${longDate(o.deadline)} is a yes.`;
    if (o.kind === "call" && o.defender) return `${who(o.enemy)}, from outside the Empire, has attacked ${who(o.from)}: as Emperor you are called to defend the Empire. Refusing costs the crown 10 authority; no answer by ${longDate(o.deadline)} is a yes.`;
    if (o.kind === "call") return `${who(o.from)} calls you to arms against ${who(o.enemy)} (${o.side === "att" ? "their attack" : "their defence"}). Refusing ends the alliance; no answer by ${longDate(o.deadline)} is a yes.`;
    if (o.kind === "coalition") return `${who(o.from)} proposes a coalition against ${who(o.against)}: a defensive alliance that brings each of you into a war only when ${who(o.against)} declares it, and lapses when it is a warmonger no more. No answer by ${longDate(o.deadline)} is a no.`;
    if (o.kind === "agreement") return `${who(o.from)} proposes a ${AGREEMENT_NAMES[o.agreement]}${o.years ? ` for ${o.years} years` : ""}.`;
    if (o.kind === "demand") return `${who(o.from)} demands that you become its ${o.subject}.`;
    if (o.kind === "empire") return `${who(o.from)} demands the Empire: join as its protectorate, or join the League against it.`;
    if (o.kind === "union") { const u = union(o.from, o.to); return `${who(o.from)} proposes a union, ${u.name}: ${u.into === o.from ? `your country becomes part of ${who(o.from)}` : `${who(o.from)} becomes part of your country`} — land, armies, treasury and research — and you rule it together, to win or lose as one.`; }
    if (o.kind === "integrate") return `${who(o.from)} asks to integrate you: your land, armies and treasury become its own, and you are out of the game.`;
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
            row(ctx, mk("button", { class: "primary", disabled: o.kind === "union" && agreedBy(ctx, `answer:${o.id}`).mine ? "disabled" : undefined, onclick: act(ctx, () => ({ type: "answerOffer", id: o.id, accept: true })) },
                o.kind === "call" ? "Join" : o.kind === "union" ? unionLabel(ctx, `answer:${o.id}`, "Accept") : "Accept"),
                mk("button", { onclick: act(ctx, () => ({ type: "answerOffer", id: o.id, accept: false })) }, o.kind === "call" ? (o.defender ? "Refuse (−10 authority)" : o.execution || o.circle ? "Refuse" : "Refuse (the alliance ends)") : "Refuse"))))));
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
                s === null || isVassal(state, me) ? "" : mk("button", { onclick: () => { ctx.ui.target = e; ctx.redraw(); } }, "Peace…"));
        })) : mk("p", { class: "hint" }, "At peace.")));

    // agreements
    const mine = state.agreements.filter((x) => x.a === me || x.b === me);
    const line = (x) => {
        // an alliance whose term is up while the two fight a common enemy lasts until that war is over (RULES.md §10)
        const other = x.a === me ? x.b : x.a, until = x.until === null ? "" : x.until <= state.day ? " until the war is over" : ` until ${longDate(x.until)}`;
        if (x.kind === "guarantee") return [x.a === me ? `You guarantee ${name(other)}` : `${name(other)} guarantees you`, x.a === me ? { type: "breakAgreement", with: other, kind: "guarantee" } : null, "Break"];
        if (x.kind === "access") return [x.a === me ? `You give ${name(other)} military access` : `${name(other)} gives you military access`, x.a === me ? { type: "cancelAccess", with: other } : null, "Cancel"];
        return [`${AGREEMENT_NAMES[x.kind] ?? x.kind} with ${name(other)}${until}`, { type: "breakAgreement", with: other, kind: x.kind }, "Break"];
    };
    out.push(section(ctx, "Agreements", mine.length ? mk("div", {}, ...mine.map((x) => {
        const [text, cmd, label] = line(x);
        return row(ctx, mk("span", { class: "w" }, text), cmd ? mk("button", { class: "danger", onclick: async () => {
            const breaks = cmd.type === "breakAgreement" ? ` Breaking an agreement ends all your alliances, and ${breachText(ctx, cmd.with)}.` : "";
            if (confirm(`${label}: ${text}?${breaks}`)) { await ctx.send(cmd); ctx.redraw(); }
        } }, label) : "");
    })) : mk("p", { class: "hint" }, "None.")));

    // the Empire
    out.push(empireSection(ctx));

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

// the Holy Roman Empire: which land is in it (shown on the map at a click), who has demanded it and what came of it, and the
// player's own demand — once, ever, with the scenario's number of settlements inside it — with how the German states would
// answer (RULES.md §10)
function empireSection(ctx) {
    const { state, game, me, make: mk } = ctx, c = state.countries[me];
    const name = (code) => state.countries[code]?.name ?? code;
    const needed = game.map.scenario.empire?.needed, inside = game.map.scenario.settlements.filter((s) => s.hre).length;
    const german = germanStates(game), held = hreSettlementsOf(game, me);
    const list = (codes) => (codes.length ? codes.map(name).join(", ") : "none");
    // one line and the map button, and more only where there is more to say: demands made, and yours once you could make it
    const out = [row(ctx, mk("span", { class: "w" }, `You hold ${held} of its ${inside} settlements${needed && !state.memory.empire[me] ? `; a demand needs ${needed}` : ""}.`),
        mk("button", { onclick: () => { ctx.ui.empire = !ctx.ui.empire; ctx.redraw(); } }, ctx.ui.empire ? "Whole map" : "Show on map"))];
    if (state.empire) out.push(...crownParts(ctx));
    // (with electors the demand is Renovatio Imperii: the crown's section has it)
    if (!needed) return section(ctx, "The Holy Roman Empire", ...out);
    // the demands made so far: the proposer's protectorates inside the Empire now, and the League as it stands
    for (const p of Object.keys(state.memory.empire)) {
        const joined = german.filter((x) => state.countries[x].overlord === p && state.countries[x].subjectKind === "protectorate");
        const league = state.memory.empire[p].league.filter((x) => (state.countries[x]?.out ?? null) === null && !isVassal(state, x));
        out.push(mk("p", {}, `${p === me ? "You" : name(p)} demanded the Empire. Its protectorates in the Empire: ${list(joined)}. The League against it: ${list(league)}.`));
    }
    if (state.memory.empire[me]) return section(ctx, "The Holy Roman Empire", ...out);
    if (isVassal(state, me) || held < needed) return section(ctx, "The Holy Roman Empire", ...out);
    // how the German states would answer now: one at war with you refuses; the rest roll like a protectorate demand, a person is asked
    const eligible = german.filter((x) => x !== me && !state.countries[x].overlord && !wouldCycle(state, x, me));
    const foes = eligible.filter((x) => state.wars.includes(pairKey(me, x))), asked = eligible.filter((x) => !foes.includes(x));
    const people = asked.filter((x) => state.humans.includes(x)), rolled = asked.filter((x) => !state.humans.includes(x));
    const expect = rolled.reduce((k, x) => k + demandChance(game, x, me, "protectorate").chance / 100, 0);
    // near victory nobody bows (RULES.md §10): they roll in turn, and once you hold three quarters of what wins, or the next would
    // carry you to it, the rest refuse — at most this many, were every one before it to join
    const table = scores(state), target = victoryOf(game)?.settlements ?? Infinity;
    let count = table[me]?.settlements ?? 0, most = 0;
    for (const x of rolled) {
        const gain = 0.5 * (table[x]?.settlements ?? 0);
        if (count >= NEAR_VICTORY * target || count + gain >= target) break;
        count += gain;
        most++;
    }
    const capped = most < rolled.length;
    out.push(mk("p", { class: "hint" }, "Every German state becomes your protectorate or joins the League against you: once, ever. Near victory nobody bows: once you hold three quarters of what wins, or the next state would carry you to it, the rest refuse."),
        mk("p", {}, most === 0 && rolled.length ? `Now: you are too near victory — every computer state would refuse and join the League${people.length ? `, and ${list(people)} would be asked` : ""}.`
            : `Now: about ${Math.round(Math.min(expect, most))} of ${rolled.length} computer states would join${capped ? ` (at most ${most} before you are near victory)` : ""}${people.length ? `, and ${list(people)} would be asked` : ""}${foes.length ? `; ${list(foes)}, at war with you, would refuse` : ""}.`),
        row(ctx, mk("button", { class: "danger", onclick: async () => { if (confirm("Demand the Empire? You may do this only once, ever.")) { await ctx.send({ type: "proposeEmpire" }); ctx.redraw(); } } }, "Demand the Empire")));
    return section(ctx, "The Holy Roman Empire", ...out);
}

// the crown, where the scenario has electors (RULES.md §10, The Emperor): who wears it, when the next election is, the seven votes —
// who holds each and whom it would vote for now — your own vote if you hold one, and your promises if you stand and one is called
function crownParts(ctx) {
    const { state, game, me, make: mk } = ctx, emp = state.empire;
    const name = (code) => state.countries[code]?.name ?? code, town = (id) => game.map.nodes.get(String(id))?.name ?? String(id);
    const candidates = candidatesOf(game), electors = electorsOf(game), unit = PROMISE_MONEY * game.map.x, who = (c) => (c === me ? "you" : name(c));
    // the Emperor for life, or the throne empty and the day the electors meet
    const out = [mk("p", {}, emp.emperor ? `Emperor: ${who(emp.emperor)}, for life. An election follows his death or a vacancy.`
        : `The throne is empty${emp.late ? ` (the late Emperor: ${who(emp.late)})` : ""}: the electors meet on ${longDate(emp.next)}.`),
        // the crown's authority, and what it is worth: German states' regard for the Emperor, and the free cities' dues
        mk("p", {}, `Imperial Authority: ${emp.authority} — German states think ${Math.floor(emp.authority / 5)} better of the Emperor. The free cities pay it 5% of their money: ${(game.map.scenario.empire?.freeCities ?? []).map(name).join(", ") || "none"}.`)];
    // the seven votes: who casts each — a church vote silent in a conqueror's hands — and whom it would vote for now
    out.push(mk("div", {}, ...electors.map((e) => {
        const v = voteOf(game, e, candidates), held = state.settlements[e.settlement]?.owner;
        return row(ctx, mk("span", { class: "w" }, `${e.vote}, ${town(e.settlement)}: ${e.holder ? who(e.holder) : e.church && held ? `silent (${name(held)} holds it)` : "nobody"}${v ? ` — would vote for ${who(v)}` : ""}`));
    })));
    // the estates' reforms: those passed, the next with the authority it needs, the war chest; the states under the ban
    const passed = REFORMS.slice(0, emp.reforms).map((r) => r.name), next = REFORMS[emp.reforms];
    out.push(mk("p", {}, `Reforms: ${passed.length ? passed.join(", ") : "none yet"}.${next ? ` Next: the ${next.name}, at authority ${next.authority}.` : ""}`
        + `${reformPassed(state, "penny") ? ` The war chest: ${n(emp.chest)}, paid to the Emperor while he defends the Empire.` : ""}${emp.banned.length ? ` Under the ban: ${emp.banned.map(name).join(", ")}.` : ""}`));
    // putting the next reform to the Diet: the Emperor's or the Archbishop of Mainz's, with how the three colleges would vote
    const why = reformError(game, me);
    if (!why || !/only the Emperor or the Archbishop/.test(why)) {
        const v = !why ? dietVotes(game, me) : null, college = (k) => `${v[k].yes}–${v[k].no}`;
        out.push(row(ctx, mk("span", { class: "w" }, why ? `Put a reform to the Diet: ${why}.` : `Put the ${next.name} to the Diet: electors ${college("electors")}, princes ${college("princes")}, cities ${college("cities")} — ${v.passed ? "it would pass" : "it would fail"} (the electors and the princes must both agree; the cities only advise).`),
            mk("button", { disabled: why ? "disabled" : undefined, onclick: act(ctx, () => ({ type: "proposeReform" })) }, "Propose")));
    }
    // the Emperor's ban
    if (emp.emperor === me) {
        const bannable = germanStates(game).filter((c) => !banError(game, me, c));
        if (bannable.length) {
            const pick = mk("select", {}, ...bannable.map((c) => mk("option", { value: c }, `${name(c)} (warmonger ${Math.round(state.countries[c].warmonger ?? 0)})`)));
            out.push(row(ctx, mk("span", { class: "w" }, `The imperial ban, for ${BAN_COST} authority: a war of execution, the German states called to your side.`), pick,
                mk("button", { class: "danger", onclick: async () => { if (confirm(`Put ${name(pick.value)} under the ban? You go to war with it.`)) { await ctx.send({ type: "ban", target: pick.value }); ctx.redraw(); } } }, "Ban")));
        } else out.push(mk("p", { class: "hint" }, `The ban (${BAN_COST} authority): a German state with a warmonger score of ${BAN_WARMONGER} or more, or that took land of the Empire from another within 10 years — and no truce or pact with you. None now.`));
    }
    // your stand in the Diet, as a German state and with any electors' votes you cast
    if (isGermanState(game, me) || electors.some((e) => e.holder === me)) {
        const said = emp.reformChoices[me], stance = mk("select", {}, ...[["", "as a computer would"], ["yes", "yes"], ["no", "no"]]
            .map(([v, l]) => mk("option", { value: v, ...((said === undefined ? "" : said ? "yes" : "no") === v ? { selected: "selected" } : {}) }, l)));
        stance.addEventListener("change", async () => { await ctx.send({ type: "reformVote", yes: stance.value === "" ? null : stance.value === "yes" }); ctx.redraw(); });
        out.push(row(ctx, mk("span", {}, "On reforms, in the Diet: "), stance));
    }
    // your vote for Emperor: every elector you hold votes alike — as you choose, or as a computer would
    if (electors.some((e) => e.holder === me)) {
        const choice = mk("select", {}, mk("option", { value: "", ...(!emp.choices[me] ? { selected: "selected" } : {}) }, "as a computer elector would"),
            ...candidates.map((c) => mk("option", { value: c, ...(emp.choices[me] === c ? { selected: "selected" } : {}) }, c === me ? "yourself" : name(c))));
        choice.addEventListener("change", async () => { await ctx.send({ type: "electorVote", candidate: choice.value || null }); ctx.redraw(); });
        // a vassal's vote is its overlord's, while it stands (RULES.md §10)
        const bound = boundTo(game, me, candidates);
        out.push(bound ? mk("p", { class: "hint" }, `Your vote for Emperor goes to your overlord, ${name(bound)}: a vassal has no vote of its own.`)
            : row(ctx, mk("span", {}, "Your vote for Emperor: "), choice));
    }
    if (!candidates.includes(me)) out.push(mk("p", { class: "hint" }, `You do not stand: a Catholic (after 1517, also Protestant) German state of ${n(CANDIDATE_GERMAN)} people, nobody's vassal.`));
    else if (emp.called) {
        // promises: to each vote cast by another, paid when the votes are cast whoever wins — each 2,000 × x counts 1 with its elector,
        // at most 30
        const mine = emp.promises[me] ?? {};
        out.push(mk("p", { class: "hint" }, `You stand. Promise electors money for their votes: paid when the votes are cast, whoever wins; each ${n(unit)} counts 1 with the elector, at most 30.`));
        for (const e of electors.filter((x) => x.holder && x.holder !== me)) {
            const input = mk("input", { type: "number", min: 0, step: unit, value: mine[e.settlement] ?? 0 });
            out.push(row(ctx, mk("span", { class: "w" }, `${town(e.settlement)} (${name(e.holder)})`), input,
                mk("button", { onclick: act(ctx, () => ({ type: "promise", elector: e.settlement, money: Math.max(0, Number(input.value) || 0) })) }, "Promise")));
        }
    }
    return out;
}

// what breaking faith with `victim` costs the player in the world's eyes (RULES.md §10, Opinion): 40 for 10 years, weighed by faith —
// each faith's computer countries' figure, the same for all of one faith; on a map without religions, the plain 40
function breachText(ctx, victim) {
    const { state, game, me } = ctx, figures = new Map();
    for (const c of Object.values(state.countries)) {
        if (c.code === me || c.code === victim || c.rebel || (c.out ?? null) !== null || state.humans.includes(c.code)) continue;
        const f = religionOf(game, c.code);
        if (f && !figures.has(f)) figures.set(f, Math.round(betrayalPenalty(game, c.code, me, victim)));
    }
    if (!figures.size) return "every computer country's opinion of you falls by 40 for 10 years";
    return `the world's opinion of you falls for 10 years — ${[...figures].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([f, p]) => `${RELIGION_NAMES[f]} countries −${p}`).join(", ")}`;
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
// a country's faith and what it does to its opinion of us (RULES.md §2, Religion); nothing on a map without religions
function faithLine(ctx, t) {
    const theirs = religionOf(ctx.game, t), mine = religionOf(ctx.game, ctx.me);
    if (!theirs || !mine) return "";
    const f = faithOpinion(ctx.game, t, ctx.me);
    return ctx.make("p", {}, `${RELIGION_NAMES[theirs]}${theirs === mine ? ", as you are" : `; you are ${RELIGION_NAMES[mine]}`}: ${f > 0 ? "+" : ""}${f} to its opinion of you.`);
}

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
        faithLine(ctx, t),
        them.overlord ? mk("p", {}, `A ${them.subjectKind} of ${state.countries[them.overlord].name}${vassal ? ": it has no diplomacy of its own — speak to its overlord" : ""}.`) : "",
        rivalsLine(ctx, t),
        warsOf(ctx, t)));
    // a war of our protectorate's — or, a protectorate, our overlord's — joined by choice, on its side (RULES.md §10, Subjects)
    const ours = them.overlord === me && them.subjectKind === "protectorate", theirs = state.countries[me]?.overlord === t && state.countries[me]?.subjectKind === "protectorate";
    if (ours || theirs) {
        const joinable = state.wars.map((w) => w.split("|")).filter((w) => w.includes(t)).map((w) => w.find((x) => x !== t))
            .filter((e) => e !== me && !state.countries[e]?.rebel && !state.wars.includes(pairKey(me, e)) && state.countries[e]?.overlord !== me && state.countries[me]?.overlord !== e).sort();
        if (joinable.length) out.push(section(ctx, ours ? "Your protectorate's wars" : "Your overlord's wars",
            ...joinable.map((e) => row(ctx, mk("button", { class: "danger", onclick: async () => {
                if (confirm(`Join ${them.name}'s war against ${state.countries[e].name}? You fight ${state.countries[e].name} on ${them.name}'s side, as an ally would — no warmonger score for declaring; a pact or truce with ${state.countries[e].name} is broken.`)) { await ctx.send({ type: "joinWar", ally: t, enemy: e }); ctx.redraw(); }
            } }, `Join its war against ${state.countries[e].name}`))),
            mk("p", { class: "hint" }, ours ? "A protectorate's wars are not yours unless you join them." : "Your overlord's wars are not yours unless you join them.")));
    }
    // two people's countries made one, ruled by both (RULES.md §10, Union): proposed to the other person, who is asked
    if (t !== me && state.humans.includes(t) && state.humans.includes(me) && (them.out ?? null) === null) {
        const why = unionError(game, me, t);
        out.push(section(ctx, "Union",
            mk("p", { class: "hint" }, `${them.name} is played by a person. In a union, ${unionInto(state, me, t) === me ? `${state.countries[me].name}–${them.name}, ${them.name} becomes part of your country` : `${them.name}–${state.countries[me].name}, your country becomes part of ${them.name}`} at once — land (core), armies, fleets, treasury and research — and you rule it together: either of you gives any order, and you win or lose as one. Once in a game, at peace with each other and at war with the same countries, and not near victory.`),
            row(ctx, mk("button", { class: "primary", disabled: why || agreedBy(ctx, `propose:${t}`).mine ? "disabled" : undefined, onclick: async () => {
                if (confirm(`Propose a union to ${them.name}? If its player agrees, ${them.name} becomes part of your country, and they rule it with you for the rest of the game.`)) { await ctx.send({ type: "proposeUnion", with: t }); ctx.redraw(); }
            } }, unionLabel(ctx, `propose:${t}`, "Propose a union…")), why ? mk("span", { class: "hint" }, why) : "")));
    }
    // your vassal of 15 years — longer across faiths — may become part of your country (RULES.md §10, Integration)
    if (vassal && them.overlord === me) {
        const why = integrateError(game, me, t), since = them.vassalSince ?? 0;
        out.push(section(ctx, "Integrate",
            mk("p", { class: "hint" }, `Your vassal since ${longDate(since)}. After ${Math.round(integrateDays(game, me, t) / 365)} years${integrateDays(game, me, t) > INTEGRATE_DAYS ? " (longer for a vassal of another faith)" : ""}, while neither of you is at war, it may become part of your country for ${n(integratePrice(game, t))} (a courthouse a settlement): its settlements become your core, its armies, fleets and treasury yours. +${game.map.warmongerScale} warmonger score a settlement.${human ? " A person plays it: they are asked." : ""}`),
            row(ctx, mk("button", { class: "primary", disabled: why ? "disabled" : undefined, onclick: async () => { await ctx.send({ type: "integrate", target: t }); ctx.redraw(); } }, "Integrate"),
                why ? mk("span", { class: "hint" }, why) : "")));
    }
    if (vassal || state.countries[t].rebel) return out;
    // a vassal has no diplomacy of its own (RULES.md §10): nothing to offer that the rules would only refuse
    if (isVassal(state, me)) {
        out.push(mk("p", { class: "hint" }, `You are a vassal of ${state.countries[state.countries[me].overlord]?.name}: it speaks for you — it declares your wars and makes your peace.`));
        return out;
    }

    // war
    if (atWar) out.push(...peaceForm(ctx, t));
    else {
        const { auto, calls } = warJoiners(game, me, t);
        const bound = state.agreements.filter((x) => ["pact", "truce", "defensive", "military"].includes(x.kind) && [x.a, x.b].includes(me) && [x.a, x.b].includes(t) || (x.kind === "guarantee" && x.a === me && x.b === t));
        // each joiner, and why (RULES.md §10): a vassal, a guarantor, a coalition against you, an ally — or called, and free to
        // refuse — and its faith on a map with religions
        const why = (e) => {
            const c = e[0], side = e[e.length - 1], principal = side === "def" ? t : me;
            if (e.length === 3) return "called by its military alliance";
            if (state.countries[c].overlord === principal) return "vassal";
            if (state.agreements.some((x) => x.kind === "defensive" && x.against === me && [x.a, x.b].includes(c) && [x.a, x.b].includes(principal))) return "coalition against you";
            if (state.agreements.some((x) => x.kind === "guarantee" && x.a === c && x.b === principal)) return "guarantees it";
            return "defensive ally";
        };
        const faith = (c) => (religionOf(game, c) ? `, ${RELIGION_NAMES[religionOf(game, c)]}` : "");
        const join = (list) => list.map((e) => `${state.countries[e[0]].name} (${why(e)}${faith(e[0])})`).join(", ");
        const score = Math.round(state.countries[me].warmonger ?? 0);
        const sidesOf = (side) => [...auto, ...calls].filter((e) => e[e.length - 1] === side);
        out.push(section(ctx, "War",
            sidesOf("def").length ? mk("p", {}, `Would join ${them.name}: ${join(sidesOf("def"))}${calls.some((e) => e[2] === "def") ? " (some may refuse)" : ""}.`) : "",
            sidesOf("att").length ? mk("p", {}, `Would join you: ${join(sidesOf("att"))}.`) : "",
            mk("p", { class: score >= 30 ? "bad" : "hint" }, `Your warmonger score: ${score}. At 30 or more, the countries that border you and each other, and do not loathe each other's faith, ally against you each year (a person is asked; anyone bordering you may found one) — those alliances bring them in only when you attack, and end once your score is under 30 again.`),
            bound.length ? mk("p", { class: "bad" }, `This breaks ${bound.map((x) => (x.kind === "truce" ? "your truce" : AGREEMENT_NAMES[x.kind])).join(", ")}: your alliances end, and ${breachText(ctx, t)}.`) : "",
            // your own protectorate: turning on it breaks its protection (RULES.md §10, Subjects)
            state.countries[t].overlord === me ? mk("p", { class: "bad" }, `${them.name} is your protectorate: turning on it ends its protection and breaks faith — your alliances end, and ${breachText(ctx, t)}.`) : "",
            // with the marches planned for this war, sent the moment it is declared (game.js, premoves)
            mk("button", { class: "danger", onclick: async () => { if (confirm(`Declare war on ${them.name}? It adds 5 to your warmonger score.${ctx.planned?.(t) ? ` Your ${ctx.planned(t)} planned march${ctx.planned(t) > 1 ? "es go" : " goes"} at once.` : ""}`)) { await ctx.send({ type: "declareWar", target: t }); ctx.redraw(); } } },
                ctx.planned?.(t) ? `Declare war — and send ${ctx.planned(t)} planned march${ctx.planned(t) > 1 ? "es" : ""}` : "Declare war")));
    }

    // agreements
    const rows = Object.keys(BAR).filter((kind) => {
        const [a, b] = kind === "access" ? [t, me] : [me, t];
        return !state.agreements.some((x) => x.kind === kind && (kind === "guarantee" || kind === "access" ? x.a === a && x.b === b : [x.a, x.b].includes(me) && [x.a, x.b].includes(t)));
    }).map((kind) => {
        // an alliance for 10 or 20 years, the longer asking more: a button for each
        const terms = isAlliance(kind) ? ALLIANCE_YEARS : [undefined];
        const answers = human ? [] : terms.map((y) => agreementAnswer(game, t, me, kind, y)), [ans] = answers;
        const likely = (a) => (a.accept ? "likely" : "unlikely");
        const hint = !ans ? "a person will answer"
            : `${terms.length > 1 ? terms.map((y, i) => `${y} years ${likely(answers[i])}`).join(", ") : likely(ans)}: opinion ${Math.round(ans.opinion)} + need ${Math.round(ans.need)} against ${answers.map((a) => a.bar).join(" or ")}`;
        const buttons = terms.map((y, i) => mk("button", { disabled: atWar ? "disabled" : undefined, onclick: act(ctx, () => ({ type: "proposeAgreement", with: t, kind, ...(y ? { years: y } : {}) })) },
            i === 0 ? `${ASK_LABEL[kind]}${y ? `: ${y} years` : ""}` : `${y} years`));
        return row(ctx, ...buttons, mk("span", { class: `hint ${answers.some((a) => a.accept) ? "good" : ""}` }, hint));
    });
    // a coalition against this country, if it is a warmonger (RULES.md §10, Coalitions): offered to every country that may join it —
    // bordering it, not allied with you already, not at war with you — the computers answering at once, people asked
    if ((them.warmonger ?? 0) >= COALITION_SCORE) {
        const partners = Object.keys(state.countries).filter((c) => c !== me && c !== t && !coalitionError(game, me, c, t)).sort((a, b) => (state.countries[a].name < state.countries[b].name ? -1 : 1));
        const send = async () => { for (const c of partners) if (!(await ctx.send({ type: "proposeCoalition", with: c, against: t }))?.ok) break; ctx.redraw(); };
        out.push(section(ctx, `Coalition against ${them.name}`,
            mk("p", { class: "hint" }, `${them.name} is a warmonger (score ${Math.round(them.warmonger)}). A coalition is a defensive alliance against it alone: it brings each of you into a war only when ${them.name} declares it, and lapses when its score is under ${COALITION_SCORE}.`),
            !bordering(game, me, t) ? mk("p", { class: "hint" }, `Only countries that border ${them.name} make a coalition against it, and you do not.`)
                : partners.length ? row(ctx, mk("button", { onclick: send }, `Propose it to all (${partners.length})`), mk("span", { class: "hint" }, partners.map((c) => state.countries[c].name).join(", ")))
                    : mk("p", { class: "hint" }, `No other country that borders ${them.name} may join one with you now.`)));
    }
    out.push(section(ctx, "Agreements", ...(atWar ? [mk("p", { class: "hint" }, "Not while at war.")] : rows), mk("p", { class: "hint" }, "The same proposal to the same country once in 5 years.")));

    // demands
    if (!atWar && (!them.overlord || (them.overlord === me && them.subjectKind === "protectorate"))) {
        const kinds = them.overlord === me ? ["vassal"] : ["vassal", "protectorate"];
        // a rival never agrees, nor anyone to a country near victory; one that does adds to the asker's warmonger score (RULES.md §10).
        // Sent at once, with no question: the button's line says the odds, and its title what a refusal costs
        const upgrade = them.overlord === me;
        // only of a neighbour of yours or of your subjects' (RULES.md §10); and what a yes adds to the warmonger score, by its size
        if (!upgrade && !withinDemandReach(game, me, t)) out.push(section(ctx, "Demand", mk("p", { class: "hint" }, `${them.name} borders neither you nor your subjects: a subject is made only of a neighbour, on demand or by a peace.`)));
        else out.push(section(ctx, "Demand", ...kinds.map((kind) => {
            const ch = human ? null : subjectChance(game, t, me, kind), score = Math.round(subjectWarmonger(game, t, kind === "vassal" && !upgrade ? "vassal" : "protectorate", 10) * 5) / 10;
            const odds = !ch ? "a person will answer" : ch.why === "rival" ? "never: your rival" : ch.why === "victory" ? `refused: you hold ${n(ch.count)} of the ${ch.target} that win${ch.count >= NEAR_VICTORY * ch.target ? "" : ", and this would take you there"}` : `${ch.chance.toFixed(0)}% chance`;
            return row(ctx, mk("button", { title: `A refusal makes ${them.name} hostile for 10 years; a yes adds ${score} to your warmonger score.`, onclick: async () => { await ctx.send({ type: "demandSubject", target: t, kind }); ctx.redraw(); } }, `Demand a ${kind}`),
                mk("span", { class: `hint ${ch && !ch.chance ? "bad" : ""}` }, `${odds} · +${score} warmonger if it agrees`));
        }), human ? "" : mk("p", { class: "hint" }, `No country agrees to become the subject of one at ${NEAR_VICTORY * 100}% of victory, or that it would carry past it.`)));
    }

    return out;
}

// the scenario's rivalries of a country (SCENARIO.md, Rivalries): a rival of yours never agrees to become your subject
function rivalsLine(ctx, t) {
    const { state, game, me, make: mk } = ctx;
    const rivals = Object.keys(state.countries).filter((c) => c !== t && areRivals(game, t, c)).sort();
    if (!rivals.length) return "";
    const yours = rivals.includes(me);
    return mk("p", { class: yours ? "bad" : "" }, `Rivals: ${rivals.map((c) => (c === me ? "you" : state.countries[c].name)).join(", ")}${yours ? " — it will never agree to become your subject" : ""}.`);
}

// a peace with terms: what to take and give, money, a subject — and what the other side makes of it
function peaceForm(ctx, t) {
    const { state, game, me, make: mk } = ctx, them = state.countries[t];
    // only what a peace can hand over (RULES.md §10, Peace): within the receiver's reach, if need be through the others of the same
    // peace — so all of theirs that could be reached were all of them taken, and the like of ours (the preview says if a choice is not)
    const reachable = (owner, gainer) => { const ids = Object.values(state.settlements).filter((s) => s.owner === owner).map((s) => s.id), far = new Set(outOfReach(game, gainer, ids)); return ids.filter((id) => !far.has(id)).map((id) => state.settlements[id]); };
    const theirs = reachable(t, me), mine = reachable(me, t);
    const human = state.humans.includes(t);
    // the terms being drawn up live in ctx.ui, not in the form: the panel is rebuilt as the war score moves, almost daily
    if (ctx.ui.peace?.with !== t) ctx.ui.peace = { with: t, take: [], give: [], money: 0, subject: "", giveOpen: false };
    const draft = ctx.ui.peace;
    const checks = (list, label, kept) => list.map((s) => {
        const box = mk("input", { type: "checkbox", value: String(s.id), checked: kept.includes(s.id) ? "checked" : undefined });
        return [s.id, box, mk("label", { class: "check" }, box, ` ${label(s)}`)];
    });
    const takes = checks(theirs, (s) => `${town(ctx, s.id)} (${n(s.pop)})`, draft.take), gives = checks(mine, (s) => `${town(ctx, s.id)} (${n(s.pop)})`, draft.give);
    // money either way: who pays, and how much (a positive amount; the terms keep it signed, + they pay you)
    const payer = mk("select", {}, mk("option", { value: "they", selected: draft.money >= 0 ? "selected" : undefined }, "They pay you"),
        mk("option", { value: "you", selected: draft.money < 0 ? "selected" : undefined }, "You pay them"));
    const money = mk("input", { type: "number", min: 0, step: 1000, value: Math.abs(draft.money) });
    const treasury = state.countries[me].treasury ?? 0;
    const offer = (share) => () => { payer.value = "you"; money.value = String(Math.floor(Math.max(0, treasury) * share / 1000) * 1000); update(); };
    // a subject either way only between neighbours, counting each side's subjects (RULES.md §10)
    const ours = withinDemandReach(game, me, t), theirsToo = withinDemandReach(game, t, me);
    const subject = mk("select", {}, ...[["", "no subject"], ours && ["makeSubject:vassal", `${them.name} becomes your vassal`], ours && ["makeSubject:protectorate", `${them.name} becomes your protectorate`],
        theirsToo && ["becomeSubject:vassal", `you become ${them.name}'s vassal`], theirsToo && ["becomeSubject:protectorate", `you become ${them.name}'s protectorate`]].filter(Boolean).map(([v, l]) => mk("option", { value: v, selected: v === draft.subject ? "selected" : undefined }, l)));
    const preview = mk("p", { class: "preview" }, "");
    const terms = () => {
        const t2 = { take: takes.filter(([, b]) => b.checked).map(([id]) => id), give: gives.filter(([, b]) => b.checked).map(([id]) => id), money: (payer.value === "you" ? -1 : 1) * Math.max(0, Number(money.value) || 0) };
        if (subject.value) { const [k, v] = subject.value.split(":"); t2[k] = v; }
        return t2;
    };
    const update = () => {
        const now = terms();
        Object.assign(draft, { take: now.take, give: now.give, money: now.money, subject: subject.value });
        // terms the engine would refuse whoever answers, such as taking its last settlement
        const bad = validateTerms(game, me, t, terms());
        if (bad) { preview.textContent = `Not possible: ${bad}.`; preview.className = "preview bad"; return; }
        if (human) { preview.textContent = "A person will answer."; preview.className = "preview"; return; }
        const a = peaceAnswer(game, t, me, terms());
        // land beyond what this war has won is refused whatever the score (RULES.md §10, Peace)
        preview.textContent = a.land ? `You ask for settlements of ${n(a.land.gain)} people, and have taken ${a.land.won ? `only ${n(a.land.won)}` : "none"} in this war: land is won in the field, not at the table — it will refuse.`
            : `War score ${a.score.toFixed(1)} against a price of ${a.cost.toFixed(1)}: ${a.accept ? "it will accept" : "it will refuse"}.`;
        preview.className = `preview ${a.accept ? "good" : "bad"}`;
    };
    for (const [, b] of [...takes, ...gives]) b.addEventListener("change", update);
    money.addEventListener("input", update);
    payer.addEventListener("change", update);
    subject.addEventListener("change", update);
    update();
    const giveBox = mk("details", { open: draft.giveOpen ? "open" : undefined }, mk("summary", {}, "Give to them"), mk("div", { class: "checks" }, ...gives.map((x) => x[2])));
    giveBox.addEventListener("toggle", () => { draft.giveOpen = giveBox.open; });
    return [section(ctx, `Peace with ${them.name}`,
        mk("details", { open: "open" }, mk("summary", {}, `Take from ${them.name}`), mk("div", { class: "checks" }, ...takes.map((x) => x[2]))),
        giveBox,
        row(ctx, payer, money),
        row(ctx, mk("span", { class: "hint" }, `Your treasury: ${n(treasury)}. Offer `),
            mk("button", { onclick: offer(0.25) }, "¼"), mk("button", { onclick: offer(0.5) }, "½"), mk("button", { onclick: offer(1) }, "all")),
        row(ctx, subject),
        preview,
        mk("button", { class: "primary", onclick: async () => { const r = await ctx.send({ type: "proposePeace", with: t, terms: terms() }); if (r.ok) { ctx.ui.peace = null; ctx.redraw(); } } }, "Propose peace"),
        mk("p", { class: "hint" }, "Price: what you ask, in % of its people, 10 for a year of its money, 50 for a vassal or 25 for a protectorate — less what you give. A peace leaves each side at least one settlement. War score: the share of its people you took, less the share of yours it took, plus how much stronger you are — counted only as far as the war has been fought: in full once a side has lost a tenth of its people. Settlements, though, only up to the people you have taken in this war, less those you lost: strength buys money, freedom or a subject, never land."))];
}
