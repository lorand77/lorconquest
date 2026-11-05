// The replay page (design.md, "Replays"): a finished game played over in the browser by the engine, from its seed and its
// command log, with a speed, a slider to go to any day, who is ahead, the events that mattered — and, at the end, whether
// this replay came out exactly as the game did. Everything is drawn by the same code as the game page (mapdraw.js). A picture of
// the day shown, and a timelapse video of any span of the game (mapcanvas.js), are a click away.
import { START_YEAR, YEAR_DAYS, buildMap, describeEvent, longDate, scores } from "/engine/index.js";
import { requireUser } from "./auth.js";
import { countryColour, countryLabels, landFill, ownersKey, paintMap } from "./mapdraw.js";
import { createMapView } from "./mapview.js";
import { canvasFor, createMapCanvas, download, exportSpan, framePlan, frameOf, record, videoName, videoType } from "./mapcanvas.js";
import { buildLegs } from "./mirror.js";
import { createReplayer } from "./replayer.js";

const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v);
    }
    e.append(...children);
    return e;
};

// the events worth a line in the feed
const WORTHY = new Set(["war", "peace", "capture", "victory", "empire", "integrated", "subject", "freedom", "joins", "uprising", "bankruptcy"]);

// the requests run side by side, not one after another
const id = Number(new URLSearchParams(location.search).get("id"));
const [me, res] = await Promise.all([requireUser(), fetch(`/api/games/${id}/replay`)]);
const data = await res.json();
if (!res.ok) { $("title").textContent = data.error ?? "No such replay."; throw new Error(data.error); }

const [scenario, scenarios, map] = await Promise.all([fetch(`/scenario/${data.scenario}/scenario.json`).then((r) => r.json()),
    fetch("/api/scenarios").then((r) => r.json()), createMapView($("map"), `/scenario/${data.scenario}/map.svg`, () => {})]);
// the name the lobby shows (scenario.json has none: it is the first line of the scenario's SCENARIO.md)
const scenarioName = scenarios.find((s) => s.id === data.scenario)?.name ?? data.scenario;
const replayer = createReplayer(scenario, data);
const built = buildMap(scenario), nodes = built.nodes, zones = built.zones, legs = buildLegs(scenario);
const player = new Map(data.humans.map((h) => [h.country, h.username]));
const colourOf = (code) => countryColour(replayer.state, scenario, code);
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
    if (now !== owners) { owners = now; map.colourLands(ownerOfLand, landFill(replayer.state, colourOf)); map.setLabels(countryLabels(replayer.state, scenario)); }
    paintMap(map, replayer.state, nodes, zones, legs, replayer.day, colourOf, {});
    $("date").textContent = longDate(replayer.day);
    if (!dragging) $("seek").value = replayer.day;     // not under a hand moving it
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

// going to a day: back is quick (a keyframe), forward plays through in chunks so the page stays alive. A newer seek (the
// slider moved again, or arrowed) takes over from one still under way: only the last one counts.
let dragging = false, seeking = 0;
$("seek").addEventListener("pointerdown", () => { dragging = true; });
window.addEventListener("pointerup", () => { dragging = false; });
$("seek").addEventListener("change", async () => {
    const day = Number($("seek").value), mine = ++seeking;
    dragging = false;
    working = true;
    $("verdict").textContent = "Going there…";
    $("events").replaceChildren();
    do {
        replayer.seek(day, 500);
        await new Promise((r) => setTimeout(r, 0));
        if (mine !== seeking) return;                      // a newer seek has the replay now
    } while (replayer.day < day && !replayer.done);
    working = false;
    draw();
});

draw();
requestAnimationFrame(frame);

// ---------- a picture, a timelapse ----------
const painter = createMapCanvas($("map").querySelector("svg"), scenario);
const title = `${scenarioName} · game ${id}`;
const yearOf = (day) => START_YEAR + Math.floor(day / YEAR_DAYS);
$("snapshot").addEventListener("click", () => {
    const canvas = canvasFor(painter, 1080);
    painter.draw(canvas.getContext("2d"), frameOf(replayer.state, scores(replayer.state)), { title });
    canvas.toBlob((blob) => download(blob, `lorconquest-${id}-${longDate(replayer.day).replace(/\s+/g, "-")}.png`), "image/png");
});

$("ex-from").value = START_YEAR;
$("ex-to").value = yearOf(data.endDay);
$("ex-from").min = $("ex-to").min = START_YEAR;
$("ex-from").max = $("ex-to").max = yearOf(data.endDay);
const type = videoType();
if (!type) { $("ex-video").disabled = true; $("ex-status").textContent = "This browser cannot record video."; }
let stop = false;
$("ex-stop").addEventListener("click", () => { stop = true; });
$("ex-video").addEventListener("click", async () => {
    // the years asked for, made sense of: whole years within the game, the earlier first (mapcanvas.js, exportSpan)
    const span = exportSpan($("ex-from").value, $("ex-to").value, data.endDay);
    [$("ex-from").value, $("ex-to").value] = [span.fromYear, span.toYear];
    const fps = 30, days = framePlan(span.from, span.to, Number($("ex-speed").value), fps);
    stop = false;
    // the replay on screen stops: it would take time from the recording, which must keep pace with the clock
    if (playing) $("play").click();
    $("ex-video").disabled = true;
    $("ex-stop").hidden = false;
    try {
        // first the game is played over once, apart from the replay on screen, keeping what each frame shows
        const game = createReplayer(scenario, data), frames = [];
        for (const day of days) {
            while (game.day < day && !game.done) {
                game.seek(day, document.hidden ? 20000 : 400);     // a hidden tab gets a timer a second: more days each
                $("ex-status").textContent = `Playing the game over: ${longDate(game.day)}…`;
                await new Promise((r) => setTimeout(r, 0));
                if (stop) throw new Error("stopped");
            }
            frames.push(frameOf(game.state, scores(game.state), day));
        }
        // then each frame drawn and recorded, the last held for two seconds
        const canvas = canvasFor(painter, Number($("ex-size").value)), ctx = canvas.getContext("2d"), hold = 2 * fps;
        const blob = await record(canvas, frames.length + hold, (i) => painter.draw(ctx, frames[Math.min(i, frames.length - 1)], { title }), {
            fps, type, stopped: () => stop,
            progress: (i) => { if (i % fps === 0) $("ex-status").textContent = `Recording: ${Math.min(100, Math.round(i / (frames.length + hold) * 100))}% — keep this tab in front`; },
        });
        // the file is named for the country you played in this game, or else every person's
        const mine = data.humans.filter((h) => h.username === me.username), named = (mine.length ? mine : data.humans).map((h) => nameOf(h.country));
        download(blob, videoName({ id, countries: named, fromYear: span.fromYear, toYear: span.toYear, ext: type.includes("mp4") ? "mp4" : "webm" }));
        $("ex-status").textContent = `Saved: ${(blob.size / 1e6).toFixed(1)} MB${stop ? " (stopped early)" : ""}.`;
    } catch (err) {
        $("ex-status").textContent = err.message === "stopped" ? "Stopped." : `Could not make the video: ${err.message}`;
    } finally {
        $("ex-video").disabled = false;
        $("ex-stop").hidden = true;
    }
});

// ---------- keys ----------
// Space plays or pauses; ← → go back or on a year (with Shift, ten); 1 – 4 choose the speed. Not while typing in a box, and
// not with Ctrl, Alt or ⌘ (the browser's)
document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select") || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === " " && !e.target.closest("button, a")) { e.preventDefault(); $("play").click(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * YEAR_DAYS * (e.key === "ArrowLeft" ? -1 : 1);
        $("seek").value = String(Math.max(0, Math.min(data.endDay, replayer.day + step)));
        $("seek").dispatchEvent(new Event("change"));
    } else if (/^[1-4]$/.test(e.key)) {
        const speed = $("speed");
        speed.selectedIndex = Math.min(speed.options.length - 1, Number(e.key) - 1);
        speed.dispatchEvent(new Event("change"));
    }
});
