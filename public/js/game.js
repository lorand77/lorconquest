// The game page (design.md, "The game screen"): joins the game, keeps a copy of its state from each day's changes,
// draws it, and turns clicks into commands. The page never changes the game itself: every order goes to the
// server, whose engine decides; the copy of the engine here only previews (routes and their days). Between ticks
// marching armies glide, from their march's start and end days.
import { Game, buildMap, describeEvent, eventCountries, economyOf, longDate, menOf, placeName, routeFor, WEAPONS } from "/engine/index.js";
import { applyChanges, applyPrivate, armyPoint, buildLegs, fleetPoints, formatMen, formatNumber, routeLine } from "./mirror.js";
import { createMapView } from "./mapview.js";
import { armyEquipment, countryTab, fleetPanel, researchTab, shopTab } from "./panels.js";
import { diplomacyTab } from "./diplomacy.js";

const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
    }
    e.append(...children);
    return e;
};

const WEAPON_NAMES = { unarmed: "unarmed", swords: "swords", pikes: "pikes", cavalry: "cavalry", handCannons: "hand cannons", arquebuses: "arquebuses", muskets: "muskets" };
const gameId = Number(new URLSearchParams(location.search).get("id"));
const socket = globalThis.io({ transports: ["websocket"] });
const ask = (event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

let me, state, game, scenario, map, legs, tickMs = 100, paused = true, lastTick = performance.now();
let sel = null;            // { kind: "army", id } | { kind: "fleet", id } | { kind: "place", key } | { kind: "country", code }
let tab = "selection";     // selection | country | shop | research | diplomacy
const ui = { target: null };   // the country the Diplomacy tab deals with
let panelHtml = "";        // what the panel shows now, so it is rebuilt only when it changes
let plan = null;           // { army, to, path, days }
let splitOpen = false;
let owners = "";             // who owned what when the lands were last coloured

// ---------- start ----------
async function start() {
    const joined = await ask("join", { gameId });
    if (!joined.ok) { $("panel").textContent = `Cannot open this game: ${joined.error}`; return; }
    ({ me, paused, tickMs } = joined);
    state = joined.view;
    scenario = await (await fetch(`/scenario/${joined.scenario}/scenario.json`)).json();
    game = new Game(buildMap(scenario), state);
    legs = buildLegs(scenario);
    map = await createMapView($("map"), `/scenario/${joined.scenario}/map.svg`, onPick);
    $("zoom-in").addEventListener("click", () => map.zoom(1 / 1.4));
    $("zoom-out").addEventListener("click", () => map.zoom(1.4));
    $("pause").addEventListener("click", togglePause);
    for (const b of document.querySelectorAll("#tabs button")) b.addEventListener("click", () => setTab(b.dataset.tab));
    document.addEventListener("keydown", onKey);
    socket.on("tick", onTick);
    socket.on("private", (m) => { applyPrivate(state, me, m.changes); renderTop(); });
    socket.on("paused", (m) => { paused = m.paused; renderTop(); });
    socket.on("over", (m) => { state.winner = m.winner; paused = true; toast(m.youWon ? "You have won!" : `${state.countries[m.winner].name} has won the game.`, 600000); renderAll(true); });
    socket.on("failed", (m) => toast(`The game stopped: ${m.error}`));
    socket.on("disconnect", () => toast("Lost the connection to the server; trying again…"));
    socket.on("connect", () => { if (state) ask("join", { gameId }).then((j) => { if (j.ok) { state = Object.assign(state, j.view); paused = j.paused; renderAll(); } }); });
    renderAll();
    requestAnimationFrame(frame);
}

function onTick(m) {
    applyChanges(state, m.changes);
    lastTick = performance.now();
    for (const e of m.events) {
        const who = eventCountries(e);
        if (who.includes(me) || who.some((c) => enemies().includes(c))) feed(e);
        const mine = who.includes(me);
        if ((e.type === "war" && e.target === me) || (e.type === "siegeStart" && state.settlements[e.settlement].owner === me) || (e.type === "capture" && e.from === me)
            || (mine && ["uprising", "bankruptcy", "desertion", "tech", "ready", "cancelled", "plague", "default", "crossFailed", "postLost", "scattered",
                "offer", "answer", "joins", "peace", "subject", "freedom", "agreement", "ended", "expired", "lapsed", "refused", "empire", "broke"].includes(e.type))) toast(describeEvent(game.map, e));
    }
    if (sel?.kind === "army" && !state.armies[sel.id]) { sel = null; plan = null; }
    if (sel?.kind === "fleet" && !state.fleets[sel.id]) sel = null;
    if (plan && !state.armies[plan.army]) plan = null;
    renderAll();
}

// ---------- helpers ----------
const country = (code) => state.countries[code];
const colourOf = (code) => (state.countries[code]?.rebel ? "#8c3a3a" : scenario.countries.find((c) => c.code === code)?.colour ?? "#ddd");
const ownerOfLand = (id) => state.settlements[id]?.owner;
const atWar = (a, b) => state.wars.includes(a < b ? `${a}|${b}` : `${b}|${a}`);
const enemies = () => Object.keys(state.countries).filter((c) => atWar(me, c));
const armiesAt = (key) => Object.values(state.armies).filter((a) => a.at === key);
const name = (key) => placeName(game.map, key);
const destinationOf = (a) => (a.path.length ? a.path[a.path.length - 1] : a.march?.to);
const displayDay = () => (paused ? state.day : state.day + Math.min(1, (performance.now() - lastTick) / tickMs));
const swatch = (code) => make("span", { class: "swatch", style: `background:${colourOf(code)}` });

async function send(cmd) {
    const r = await ask("command", { cmd });
    if (!r.ok) toast(r.error);
    return r;
}

// ---------- clicks and keys ----------
function onPick(hit) {
    const mine = sel?.kind === "army" && state.armies[sel.id]?.owner === me && !state.armies[sel.id].retreating ? state.armies[sel.id] : null;
    if (hit.kind === "army") { select({ kind: "army", id: hit.id }); return; }
    if (hit.kind === "fleet") { select({ kind: "fleet", id: hit.id }); return; }
    if (hit.kind === "sea") { select(null); return; }
    if (mine) { planMove(mine, hit.key); return; }
    if (hit.kind === "place") select({ kind: "place", key: hit.key });
    else select({ kind: "country", code: ownerOfLand(hit.key) });
}

function select(s) {
    sel = s;
    plan = null;
    splitOpen = false;
    if (tab === "diplomacy" && s?.kind === "country") ui.target = s.code;       // a click on a country's land picks it to deal with
    else if (tab !== "shop") tab = "selection";       // the shop keeps the selected settlement in view
    renderAll(true);
}

function setTab(t) {
    tab = t;
    renderAll(true);
}

function planMove(army, to) {
    if (army.at === to) { plan = null; renderAll(); return; }
    const found = routeFor(game, army, to);
    if (!found) { plan = null; toast(`No way to ${name(to)} through land army ${army.id} may enter.`); renderAll(); return; }
    plan = { army: army.id, to, path: found.path, days: found.days };
    renderAll();
}

async function march(storm) {
    if (!plan) return;
    const p = plan;
    plan = null;
    await send({ type: "move", army: p.army, to: p.to, storm });
    renderAll();
}

function togglePause() {
    ask("pause", { paused: !paused });
}

function onKey(e) {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === " ") { e.preventDefault(); togglePause(); }
    else if (e.key === "Enter" && plan) { e.preventDefault(); march(false); }
    else if (e.key === "Escape") { if (plan) { plan = null; renderAll(); } else select(null); }
}

// the context the panels in panels.js draw with
const ctx = {
    make, swatch, send, redraw: () => renderAll(true), name: (key) => name(key), ui,
    get state() { return state; }, get game() { return game; }, get me() { return me; }, get sel() { return sel; },
};

// ---------- drawing ----------
function renderAll(force = false) {
    renderTop();
    renderMap();
    renderPanel(force);
}

function renderTop() {
    $("me").replaceChildren(swatch(me), ` ${country(me).name}`);
    $("date").textContent = longDate(state.day);
    $("pause").textContent = state.winner ? "Game over" : paused ? "▶ Play" : "⏸ Pause";
    $("pause").disabled = Boolean(state.winner);
    $("pause").classList.toggle("paused", paused);
    if (country(me).treasury !== undefined) {
        const e = economyOf(game, me);
        $("treasury").textContent = `Treasury ${formatNumber(country(me).treasury)} (${e.moneyPerYear >= 0 ? "+" : "−"}${formatNumber(Math.abs(e.moneyPerYear))} a year)`;
        $("treasury").classList.toggle("bad", country(me).treasury < 0);
    }
    for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("active", b.dataset.tab === tab);
}

// armies at one place are drawn in a column beside its marker
function armyMarkers(day) {
    const at = new Map();
    return Object.values(state.armies).map((a) => {
        let [x, y] = armyPoint(a, day, legs, game.map.nodes);
        if (a.at) {
            const i = at.get(a.at) ?? 0;
            at.set(a.at, i + 1);
            x += 13;
            y += -7 + i * 16;
        } else y -= 12;
        return { id: a.id, x, y, colour: colourOf(a.owner), label: formatMen(menOf(a)), mine: a.owner === me, selected: sel?.kind === "army" && sel.id === a.id, retreating: a.retreating };
    });
}

function fleetMarkers(day) {
    const points = fleetPoints(state, game.map.nodes, game.map.zones, day);
    return Object.values(state.fleets).map((f) => {
        const [x, y] = points.get(f.id);
        const ships = Object.values(f.ships).reduce((k, v) => k + v, 0);
        return { id: f.id, x, y, colour: colourOf(f.owner), label: String(ships), mine: f.owner === me, selected: sel?.kind === "fleet" && sel.id === f.id, sailing: Boolean(f.moving) };
    });
}

function renderMap() {
    const now = Object.values(state.settlements).map((s) => s.owner).join();
    if (now !== owners) { owners = now; map.colourLands(ownerOfLand, colourOf); }
    map.setArmies(armyMarkers(displayDay()));
    map.setFleets(fleetMarkers(displayDay()));
    map.setPosts(Object.entries(state.posts).map(([key, p]) => { const n = game.map.nodes.get(key); return { x: n.x, y: n.y, n: p.n, colour: "#222" }; }));
    map.setSieges(Object.values(state.settlements).filter((s) => s.siege).map((s) => {
        const n = game.map.nodes.get(String(s.id));
        return { x: n.x, y: n.y, frac: Math.min(1, (state.day - s.siege.start) / (s.siege.end - s.siege.start)) };
    }));
    const a = plan && state.armies[plan.army];
    map.setRoute(a ? routeLine(a, plan.path, displayDay(), legs, game.map.nodes) : null);
}

// marching armies glide between ticks
function frame() {
    if (state && !paused) {
        for (const m of armyMarkers(displayDay())) if (state.armies[m.id]?.march) map.moveArmy(m.id, m.x, m.y);
        for (const m of fleetMarkers(displayDay())) if (state.fleets[m.id]?.moving) map.moveFleet(m.id, m.x, m.y);
    }
    requestAnimationFrame(frame);
}

function renderPanel(force = false) {
    const panel = $("panel");
    let nodes;
    if (tab === "country") nodes = countryTab(ctx);
    else if (tab === "shop") nodes = shopTab(ctx);
    else if (tab === "research") nodes = researchTab(ctx);
    else if (tab === "diplomacy") nodes = diplomacyTab(ctx);
    else if (!sel) nodes = [make("p", { class: "hint" }, "Click an army or fleet to select it; with an army selected, click where it should go. Click a settlement or a country's land to see it. Space pauses. The tabs above run your country.")];
    else if (sel.kind === "army") nodes = armyPanel(state.armies[sel.id]);
    else if (sel.kind === "fleet") nodes = fleetPanel(ctx, state.fleets[sel.id]);
    else if (sel.kind === "place") nodes = placePanel(sel.key);
    else nodes = countryPanel(sel.code);
    // rebuilt only when it changed, and never under a hand that is typing or dragging in it
    const box = make("div", {}, ...nodes.filter((x) => x !== "" && x !== undefined));
    const html = box.innerHTML;
    if (!force && html === panelHtml) return;
    const focus = document.activeElement;
    if (!force && panel.contains(focus) && focus.matches("input, select, textarea")) return;
    panelHtml = html;
    panel.replaceChildren(...box.childNodes);
}

function armyList(armies) {
    return make("ul", { class: "armies" }, ...armies.map((a) => make("li", {},
        make("button", { class: "link", onclick: () => select({ kind: "army", id: a.id }) }, swatch(a.owner), ` army ${a.id}: ${formatNumber(menOf(a))} men${a.relief ? " (outside the walls)" : ""}`))));
}

function armyPanel(a) {
    const out = [make("h2", {}, swatch(a.owner), ` Army ${a.id} · ${country(a.owner).name}`)];
    const kinds = WEAPONS.filter((w) => a.men[w]).map((w) => `${formatNumber(a.men[w])} ${WEAPON_NAMES[w]}`);
    if (a.cannons) kinds.push(`${a.cannons} cannons`);
    if (a.crew) kinds.push(`${formatNumber(a.crew)} crew`);
    if (a.mercs) kinds.push(`(${formatNumber(a.mercs)} mercenaries)`);
    out.push(make("p", { class: "men" }, kinds.join(" · ") || "nobody"));
    out.push(make("p", {}, armyStatus(a)));
    if (a.owner !== me) return out;
    if (plan && plan.army === a.id) {
        const s = state.settlements[game.map.nodes.get(plan.to).land];
        const enemyTown = game.map.nodes.get(plan.to).kind === "settlement" && atWar(me, s.owner);
        out.push(make("div", { class: "plan" },
            make("p", {}, `To ${name(plan.to)}: ${Math.ceil(plan.days)} days, there ${longDate(state.day + Math.ceil(plan.days))}.`),
            make("button", { class: "primary", onclick: () => march(false) }, "March (Enter)"),
            ...(enemyTown ? [make("button", { onclick: () => march(true) }, "March and storm")] : []),
            make("button", { onclick: () => { plan = null; renderAll(); } }, "Cancel")));
        return out;
    }
    if (a.retreating) return out;
    const buttons = [];
    if (a.march) buttons.push(make("button", { onclick: () => send({ type: "stop", army: a.id }) }, "Stop at the next place"));
    if (a.at) {
        const node = game.map.nodes.get(a.at), s = node.kind === "settlement" ? state.settlements[node.id] : null;
        const here = armiesAt(a.at);
        if (s && atWar(me, s.owner) && here.some((x) => x.owner === s.owner && !x.relief)) buttons.push(make("button", { onclick: () => send({ type: "storm", army: a.id }) }, "Storm"));
        if (s && s.owner === me && s.siege && !a.relief) buttons.push(make("button", { onclick: () => send({ type: "sortie", army: a.id }) }, "Sortie"));
        if (menOf(a) + a.cannons > 1) buttons.push(make("button", { onclick: () => { splitOpen = !splitOpen; renderPanel(); } }, "Split…"));
        const post = state.posts[a.at];
        if (post && atWar(me, post.owner)) buttons.push(make("button", { onclick: () => send({ type: "stormPost", army: a.id }) }, `Storm the post (${formatNumber(post.n)} sharpshooters)`));
        const others = here.filter((x) => x.owner === me && x.id !== a.id && x.relief === a.relief && !x.retreating);
        for (const o of others) buttons.push(make("button", { onclick: () => send({ type: "merge", army: a.id, into: o.id }) }, `Merge into army ${o.id}`));
    }
    out.push(make("div", { class: "buttons" }, ...buttons));
    if (splitOpen && a.at) out.push(splitForm(a));
    out.push(...armyEquipment(ctx, a));
    return out;
}

function armyStatus(a) {
    if (a.retreating) return `Retreating to ${name(destinationOf(a))}, there ${longDate(Math.ceil(a.march?.end ?? state.day))}.`;
    if (a.march) {
        const to = destinationOf(a);
        return a.path.length ? `Marching to ${name(to)}, next ${name(a.march.to)} on ${longDate(Math.ceil(a.march.end))}.` : `Marching to ${name(to)}, there ${longDate(Math.ceil(a.march.end))}.`;
    }
    const node = game.map.nodes.get(a.at), s = node.kind === "settlement" ? state.settlements[node.id] : null;
    if (s && s.siege && atWar(a.owner, s.owner)) return `Besieging ${name(a.at)}: it falls ${longDate(s.siege.end)}.`;
    if (s && s.siege && a.relief) return `Outside ${name(a.at)}, to relieve it.`;
    if (s && s.siege) return `Holding ${name(a.at)} against a siege: it falls ${longDate(s.siege.end)}.`;
    return `At ${name(a.at)}.`;
}

function splitForm(a) {
    const inputs = [];
    const row = (label, max, key) => {
        const input = make("input", { type: "number", min: 0, max, value: 0, step: 1 });
        inputs.push([key, input]);
        return make("label", {}, `${label} (of ${formatNumber(max)}) `, input);
    };
    const rows = WEAPONS.filter((w) => a.men[w]).map((w) => row(WEAPON_NAMES[w], a.men[w], w));
    if (a.cannons) rows.push(row("cannons", a.cannons, "cannons"), row("crew", a.crew, "crew"));
    const go = async () => {
        const cmd = { type: "split", army: a.id, men: {} };
        for (const [key, input] of inputs) {
            const n = Number(input.value);
            if (key === "cannons" || key === "crew") cmd[key] = n;
            else if (n) cmd.men[key] = n;
        }
        const r = await send(cmd);
        if (r.ok) { splitOpen = false; renderPanel(); }
    };
    return make("div", { class: "split" }, make("p", {}, "Split off a new army with:"), ...rows, make("button", { class: "primary", onclick: go }, "Split"));
}

function placePanel(key) {
    const node = game.map.nodes.get(key);
    const here = armiesAt(key);
    if (node.kind === "pass") {
        const owner = state.settlements[node.land].owner;
        return [make("h2", {}, `Pass ${node.id}`), make("p", {}, `In the land of ${name(String(node.land))}: `, swatch(owner), ` ${country(owner).name}.`), ...(here.length ? [armyList(here)] : [])];
    }
    const s = state.settlements[node.id];
    const out = [make("h2", {}, swatch(s.owner), ` ${name(key)}`),
        make("p", {}, `${country(s.owner).name}. ${formatNumber(s.pop)} people.${s.cores.includes(s.owner) ? " Core." : ""}${s.walls ? " Walls." : ""}`)];
    if (s.siege) out.push(make("p", { class: "siege" }, `Besieged by ${country(s.siege.by).name}: it falls ${longDate(s.siege.end)} unless relieved.`));
    out.push(here.length ? armyList(here) : make("p", {}, "No army here."));
    return out;
}

function countryPanel(code) {
    const c = country(code);
    const towns = Object.values(state.settlements).filter((s) => s.owner === code);
    const armies = Object.values(state.armies).filter((a) => a.owner === code);
    const wars = Object.keys(state.countries).filter((x) => atWar(code, x));
    if (c.rebel) return [make("h2", {}, swatch(code), ` ${c.name}`), make("p", {}, "Peasants in arms. There is no peace with them."), make("p", {}, `${formatNumber(armies.reduce((n, a) => n + menOf(a), 0))} men, ${towns.length} settlements held.`)];
    const out = [make("h2", {}, swatch(code), ` ${c.name}`),
        make("p", {}, `${towns.length} settlements, ${formatNumber(towns.reduce((n, s) => n + s.pop, 0))} people, ${formatNumber(armies.reduce((n, a) => n + menOf(a), 0))} soldiers.`),
        make("p", {}, wars.length ? `At war with ${wars.map((w) => country(w).name).join(", ")}.` : "At peace.")];
    if (code !== me) out.push(make("button", { onclick: () => { ui.target = code; setTab("diplomacy"); } }, "Diplomacy…"));
    return out;
}

// ---------- events and notices ----------
function feed(e) {
    const list = $("events");
    const item = make("li", {}, make("span", { class: "when" }, longDate(e.day)), " ", describeEvent(game.map, e));
    const where = e.settlement ?? e.place ?? e.at;
    if (where !== undefined && !String(where).includes("|")) item.addEventListener("click", () => select({ kind: "place", key: String(where) }));
    list.prepend(item);
    while (list.children.length > 200) list.lastChild.remove();
}

function toast(text, ms = 6000) {
    const t = make("div", { class: "toast" }, text);
    $("toasts").append(t);
    setTimeout(() => t.remove(), ms);
}

start();
