// The map drawn onto a canvas, for a picture of it (PNG) and a timelapse of a finished game (a video) — design.md, "Pictures and
// timelapses". It uses the map's own shapes, read from the SVG the page has already loaded (lands, borders, rivers, the coast),
// and paints them as the screen does: each land in its owner's colour, a subject's striped with its overlord's (mapdraw.js,
// landFill), borders where owners differ, the countries' codes (countryLabels), a dot for each settlement — and on top the date,
// the five countries with the most settlements, and the game's name. No library: the browser's canvas, and its MediaRecorder
// for the video (MP4 where the browser records it, else WebM).
//
// A timelapse is made in two steps: the game is played over once, keeping only what the picture needs of each frame (frameOf:
// who holds what, who is whose subject, the leaders), then the frames are drawn and recorded at an even pace. framePlan and
// frameOf are pure, tested in Node; the rest needs a browser.
import { longDate } from "/engine/calendar.js";
import { countryLabels, landFill } from "./mapdraw.js";

// the days a timelapse shows: one frame every `yearsPerSecond × 365 ÷ fps` days from `from` to `to`, the last day always among them
export function framePlan(from, to, yearsPerSecond, fps = 30) {
    const step = Math.max(1, Math.round(yearsPerSecond * 365 / fps)), days = [];
    for (let d = from; d < to; d += step) days.push(d);
    days.push(to);
    return days;
}

// what a frame needs of a state: the owner of each settlement, each country's name and whether it is a subject (and of whom),
// a rebel or out of the game, and the five with the most settlements — a few hundred values, not the whole state
export function frameOf(state, scores, day = state.day) {
    const settlements = {}, countries = {};
    for (const s of Object.values(state.settlements)) settlements[s.id] = { id: s.id, owner: s.owner };
    for (const c of Object.values(state.countries)) {
        countries[c.code] = { code: c.code, name: c.name, overlord: c.overlord ?? null, subjectKind: c.subjectKind ?? null, rebel: Boolean(c.rebel), out: c.out ?? null };
    }
    const top = Object.entries(scores).filter(([code]) => countries[code] && !countries[code].rebel)
        .sort((a, b) => b[1].settlements - a[1].settlements || b[1].pop - a[1].pop || (a[0] < b[0] ? -1 : 1)).slice(0, 5)
        .map(([code, s]) => ({ code, name: countries[code].name, settlements: s.settlements }));
    return { day, settlements, countries, top };
}

// a painter for the map in `svg` (the page's, as mapview.js loaded it): { width, height, draw(ctx, frame, opts) } in map units
export function createMapCanvas(svg, scenario) {
    const sea = svg.querySelector("#sea");
    const width = Number(sea?.getAttribute("width")) || Number(svg.getAttribute("viewBox").split(" ")[2]);
    const height = Number(sea?.getAttribute("height")) || Number(svg.getAttribute("viewBox").split(" ")[3]);
    const path = (el) => new Path2D(el.getAttribute("d"));
    const lands = [...svg.querySelectorAll("#lands [id^='land-']")].map((el) => ({ key: el.id.slice(5), p: path(el) }));
    const edges = [...svg.querySelectorAll("#edges [id^='edge-']")].map((el) => ({ ends: el.id.slice(5).split("-"), p: path(el) }));
    const rivers = [...svg.querySelectorAll("#rivers path")].map(path);
    const coast = svg.querySelector("#coast") ? path(svg.querySelector("#coast")) : null;
    const colour = (code) => scenario.countries.find((c) => c.code === code)?.colour ?? "#ddd";
    const stripes = new Map();

    // a subject's stripes, as a pattern 10 map units across turned 45°: broad for a vassal, thin for a protectorate
    function stripeOf(ctx, fill) {
        const key = `${fill.kind}${fill.colour}${fill.stripe}`;
        if (!stripes.has(key)) {
            const tile = document.createElement("canvas");
            tile.width = tile.height = 40;                   // 4 pixels a map unit, scaled back below
            const t = tile.getContext("2d");
            t.fillStyle = fill.colour;
            t.fillRect(0, 0, 40, 40);
            t.fillStyle = fill.stripe;
            t.fillRect(0, 0, fill.kind === "vassal" ? 18 : 6.4, 40);
            const pattern = ctx.createPattern(tile, "repeat");
            pattern.setTransform(new DOMMatrix().rotate(45).scale(0.25));
            stripes.set(key, pattern);
        }
        return stripes.get(key);
    }

    // the frame drawn into a canvas of `size` pixels ([w, h]); `title` goes under the date
    function draw(ctx, frame, { size = [ctx.canvas.width, ctx.canvas.height], title = "" } = {}) {
        const [w, h] = size, k = Math.min(w / width, h / height), ox = (w - width * k) / 2, oy = (h - height * k) / 2;
        const colourOf = (code) => (frame.countries[code]?.rebel ? "#8c3a3a" : colour(code));
        const fillOf = landFill(frame, colourOf), owner = (key) => frame.settlements[key]?.owner;
        ctx.save();
        ctx.fillStyle = "#99d9ea";
        ctx.fillRect(0, 0, w, h);
        ctx.setTransform(k, 0, 0, k, ox, oy);
        for (const l of lands) {
            const f = fillOf(owner(l.key));
            ctx.fillStyle = typeof f === "string" ? f : stripeOf(ctx, f);
            ctx.fill(l.p);
        }
        ctx.lineJoin = ctx.lineCap = "round";
        ctx.strokeStyle = "#00a2e8";
        ctx.lineWidth = 2.5;
        for (const r of rivers) ctx.stroke(r);
        ctx.strokeStyle = "#7f7f7f";
        for (const e of edges) if (owner(e.ends[0]) !== owner(e.ends[1])) ctx.stroke(e.p);
        if (coast) { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke(coast); }
        // settlements: a dot each, a larger one for a city
        for (const s of scenario.settlements) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.type === "city" ? 4 : 2.8, 0, 2 * Math.PI);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = "#333";
            ctx.stroke();
        }
        // the countries' codes, with a light halo so they read on any colour
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.fillStyle = "#333";
        for (const l of countryLabels(frame, scenario)) {
            ctx.font = `bold ${l.size}px Arial, Helvetica, sans-serif`;
            ctx.strokeText(l.text ?? l.code, l.x, l.y);
            ctx.fillText(l.text ?? l.code, l.x, l.y);
        }
        ctx.restore();
        overlay(ctx, frame, w, h, title, colourOf);
    }

    // the date and the game top left, the leaders top right, the name of the game bottom right — in pixels, whatever the scale
    function overlay(ctx, frame, w, h, title, colourOf) {
        const u = Math.max(12, Math.round(h / 40)), box = (x, y, bw, bh) => { ctx.fillStyle = "rgba(20,24,32,0.78)"; ctx.fillRect(x, y, bw, bh); };
        ctx.save();
        ctx.textBaseline = "top";
        const big = `bold ${Math.round(u * 1.6)}px Arial, Helvetica, sans-serif`, small = `${u}px Arial, Helvetica, sans-serif`;
        const date = longDate(frame.day), width = (font, text) => { ctx.font = font; return ctx.measureText(text).width; };
        const dw = Math.max(width(big, date), title ? width(small, title) : 0);
        box(u * 0.6, u * 0.6, dw + u * 1.2, title ? u * 3.6 : u * 2.6);
        ctx.fillStyle = "#f0c85a";
        ctx.font = big;
        ctx.fillText(date, u * 1.2, u * 1.1);
        if (title) { ctx.fillStyle = "#ddd"; ctx.font = small; ctx.fillText(title, u * 1.2, u * 2.9); }
        // the leaders: a swatch, the name, the settlements
        ctx.font = small;
        const rows = frame.top.map((t, i) => [`${i + 1}. ${t.name}`, String(t.settlements), t.code]);
        const tw = Math.max(0, ...rows.map((r) => ctx.measureText(r[0]).width)) + u * 4.2, th = rows.length * u * 1.35 + u * 0.8;
        if (rows.length) {
            box(w - tw - u * 0.6, u * 0.6, tw, th);
            rows.forEach(([name, n, code], i) => {
                const y = u * 1.0 + i * u * 1.35;
                ctx.fillStyle = colourOf(code);
                ctx.fillRect(w - tw, y + u * 0.1, u * 0.8, u * 0.8);
                ctx.fillStyle = "#eee";
                ctx.textAlign = "left";
                ctx.fillText(name, w - tw + u * 1.2, y);
                ctx.textAlign = "right";
                ctx.fillText(n, w - u * 1.1, y);
            });
        }
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.font = `bold ${Math.round(u * 0.9)}px Arial, Helvetica, sans-serif`;
        ctx.fillStyle = "rgba(20,24,32,0.7)";
        ctx.fillText("LorConquest", w - u * 0.6, h - u * 0.4);
        ctx.restore();
    }

    return { width, height, draw };
}

// a canvas the map fills, `heightPx` tall (even sizes: video encoders want them)
export function canvasFor(painter, heightPx) {
    const canvas = document.createElement("canvas");
    canvas.height = Math.round(heightPx / 2) * 2;
    canvas.width = Math.round(canvas.height * painter.width / painter.height / 2) * 2;
    return canvas;
}

// hand a file to the browser to save
export function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// the kind of video this browser records: MP4 where it can (Chrome and Edge from version 126, Safari), the format every player
// and site takes; else WebM (Firefox records nothing else); null where it records none
export const VIDEO_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
export function videoType(supported = (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
    return VIDEO_TYPES.find(supported) ?? null;
}

// record `count` frames drawn by `paint(i)` into `canvas` at `fps`, at an even pace; resolves to the video as a Blob.
// `progress(i)` is told how far it has got; `stopped()` true ends it early (what is recorded so far is kept)
export async function record(canvas, count, paint, { fps = 30, type = videoType(), progress = () => {}, stopped = () => false } = {}) {
    const stream = canvas.captureStream(0), track = stream.getVideoTracks()[0];
    const chunks = [], recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start(1000);
    const frameMs = 1000 / fps, start = performance.now();
    for (let i = 0; i < count && !stopped(); i++) {
        paint(i);
        track.requestFrame?.();
        progress(i);
        // the frame stays on screen until its time is up: the video's clock is the wall clock
        const wait = start + (i + 1) * frameMs - performance.now();
        await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
    recorder.stop();
    await done;
    track.stop();
    return new Blob(chunks, { type: type.split(";")[0] });
}
