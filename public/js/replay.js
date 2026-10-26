// The replay page (design.md, "Replays"): a finished game played over in the browser by the engine, from its seed and its
// command log, with a speed, a slider to go to any day, who is ahead, the events that mattered — and, at the end, whether
// this replay came out exactly as the game did. Everything is drawn by the same code as the game page (mapdraw.js).
import { buildMap, describeEvent, longDate, scores } from "/engine/index.js";
import { requireUser } from "./auth.js";
import { countryLabels, ownersKey, paintMap } from "./mapdraw.js";
import { createMapView } from "./mapview.js";
import { buildLegs } from "./mirror.js";
import { createReplayer } from "./replayer.js";

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

// the events worth a line in the feed
const WORTHY = new Set(["war", "peace", "capture", "victory", "empire", "integrated", "subject", "freedom", "joins", "uprising", "bankruptcy"]);

// the requests run side by side, not one after another
const id = Number(new URLSearchParams(location.search).get("id"));
const [, res] = await Promise.all([requireUser(), fetch(`/api/games/${id}/replay`)]);
const data = await res.json();
if (!res.ok) { $("title").textContent = data.error ?? "No such replay."; throw new Error(data.error); }

const [scenario, scenarios, map] = await Promise.all([fetch(`/scenario/${data.scenario}/scenario.json`).then((r) => r.json()),
    fetch("/api/scenarios").then((r) => r.json()), createMapView($("map"), `/scenario/${data.scenario}/map.svg`, () => {})]);
// the name the lobby shows (scenario.json has none: it is the first line of the scenario's SCENARIO.md)
const scenarioName = scenarios.find((s) => s.id === data.scenario)?.name ?? data.scenario;
const replayer = createReplayer(scenario, data);
const built = buildMap(scenario), nodes = built.nodes, zones = built.zones, legs = buildLegs(scenario);
const player = new Map(data.humans.map((h) => [h.country, h.username]));
const colourOf = (code) => (replayer.state.countries[code]?.rebel ? "#8c3a3a" : scenario.countries.find((c) => c.code === code)?.colour ?? "#ddd");
const ownerOfLand = (key) => replayer.state.settlements[key]?.owner;
const nameOf = (code) => replayer.state.countries[code]?.name ?? code;

$("zoom-in").addEventListener("click", () => map.zoom(1 / 1.4));
$("zoom-out").addEventListener("click", () => map.zoom(1.4));
$("title").textContent = `Game ${id}: ${scenarioName}${data.humans.length ? ` — ${data.humans.map((h) => `${nameOf(h.country)} (${h.username})`).join(", ")}` : ""}`;
$("seek").max = data.endDay;

let playing = false, owners = "", lastDraw = -1, working = false;

function feed(events) {
    for (const e of events) {
        if (!WORTHY.has(e.type)) continue;
        $("events").prepend(make("li", {}, make("span", { class: "when" }, longDate(e.day)), " ", describeEvent(replayer.game.map, e)));
    }
    while ($("events").children.length > 150) $("events").lastChild.remove();
}

function standing() {
    const table = scores(replayer.state);
    const rows = Object.entries(table).sort((a, b) => b[1].settlements - a[1].settlements || b[1].pop - a[1].pop).slice(0, 12);
    $("standing").replaceChildren(...rows.map(([code, s]) => make("li", { class: player.has(code) ? "person" : "" },
        make("span", { class: "swatch", style: `background:${colourOf(code)}` }), ` ${nameOf(code)}${player.has(code) ? ` (${player.get(code)})` : ""} — ${s.settlements}`)));
}

function draw() {
    const now = ownersKey(replayer.state);
    if (now !== owners) { owners = now; map.colourLands(ownerOfLand, colourOf); map.setLabels(countryLabels(replayer.state, scenario)); }
    paintMap(map, replayer.state, nodes, zones, legs, replayer.day, colourOf, {});
    $("date").textContent = longDate(replayer.day);
    $("seek").value = replayer.day;
    standing();
    lastDraw = replayer.day;
    if (replayer.done) {
        playing = false;
        $("play").textContent = "▶ Again";
        const ok = replayer.verified();
        $("verdict").textContent = ok === null ? "" : ok ? "✓ This replay ends exactly as the game did." : "⚠ This replay ends differently from the game: this browser's engine may not match the server's.";
        $("verdict").className = `verdict ${ok === false ? "bad" : "good"}`;
    } else $("verdict").textContent = "";
}

// as many days as the speed asks for since the last frame, within what a frame can spare
let last = performance.now(), owed = 0;
function frame(now) {
    if (playing && !working) {
        owed += (now - last) / 1000 * Number($("speed").value);
        const stop = performance.now() + 12;
        while (owed >= 1 && !replayer.done && performance.now() < stop) { feed(replayer.advance(1)); owed -= 1; }
        if (owed > 1000) owed = 0;                     // a slow machine does not save up days
        if (replayer.day !== lastDraw) draw();
    }
    last = now;
    requestAnimationFrame(frame);
}

$("play").addEventListener("click", () => {
    if (replayer.done) { replayer.seek(0); $("events").replaceChildren(); }
    playing = !playing;
    $("play").textContent = playing ? "⏸ Pause" : "▶ Play";
    draw();
});

// going to a day: back is quick (a keyframe), forward plays through in chunks so the page stays alive
$("seek").addEventListener("change", async () => {
    const day = Number($("seek").value);
    working = true;
    $("verdict").textContent = "Going there…";
    $("events").replaceChildren();
    do { replayer.seek(day, 500); await new Promise((r) => setTimeout(r, 0)); } while (replayer.day < day && !replayer.done);
    working = false;
    draw();
});

draw();
requestAnimationFrame(frame);
