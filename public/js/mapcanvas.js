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
// `progress(i)` is told how far it has got; `stopped()` true ends it early (what is recorded so far is kept).
// The video's clock is the wall clock, so while the page is hidden — another tab in front, where the browser slows its timers to
// one a second — the recording pauses, and goes on when the page is back. A browser whose canvas stream cannot be given its
// frames one by one (requestFrame) streams the canvas at `fps` instead. A WebM is given the duration browsers leave out of it.
export async function record(canvas, count, paint, { fps = 30, type = videoType(), progress = () => {}, stopped = () => false,
    hidden = () => document.hidden } = {}) {
    const byFrame = typeof CanvasCaptureMediaStreamTrack !== "undefined" && "requestFrame" in CanvasCaptureMediaStreamTrack.prototype;
    const stream = canvas.captureStream(byFrame ? 0 : fps), track = stream.getVideoTracks()[0];
    const chunks = [], recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    const frameMs = 1000 / fps;
    paint(0);                                               // something on the canvas before the first frame is taken
    recorder.start(1000);
    let clock = performance.now(), shown = 0, i = 0;
    for (; i < count && !stopped(); i++) {
        if (hidden()) {
            recorder.pause();
            await new Promise((r) => { const back = () => { if (!hidden()) { document.removeEventListener("visibilitychange", back); r(); } }; document.addEventListener("visibilitychange", back); });
            recorder.resume();
            clock = performance.now();
            shown = 0;
        }
        paint(i);
        if (byFrame) track.requestFrame();
        progress(i);
        // the frame stays on screen until its time is up
        shown++;
        const wait = clock + shown * frameMs - performance.now();
        await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
    recorder.stop();
    await done;
    track.stop();
    const blob = new Blob(chunks, { type: type.split(";")[0] });
    if (!type.startsWith("video/webm")) return blob;
    return new Blob([withDuration(new Uint8Array(await blob.arrayBuffer()), i * frameMs)], { type: "video/webm" });
}

// ---------- a WebM's duration ----------
// Browsers' recorders write a WebM as it streams, so its Segment Info has no Duration: players show no length and cannot seek.
// We know the length, so it is written in: the Duration (in the file's own time units, TimecodeScale) put in place of one that is
// there, or added to the Info — unless a SeekHead before it would point past the bytes added, when the file is left as it was.
// EBML: an element is an id, a size (both variable-length integers), then its body; the Segment's size is usually "unknown".
const SEGMENT = 0x18538067, INFO = 0x1549a966, DURATION = 0x4489, TIMECODE_SCALE = 0x2ad7b1, SEEK_HEAD = 0x114d9b74, CLUSTER = 0x1f43b675;
function readId(b, at) {
    const len = Math.clz32(b[at]) - 23;                     // 1 to 4 bytes, the length marked by the first byte's leading zeros
    if (len < 1 || len > 4) return null;
    let id = 0;
    for (let k = 0; k < len; k++) id = id * 256 + b[at + k];
    return { id, len };
}
function readSize(b, at) {
    const len = Math.clz32(b[at]) - 23;
    if (len < 1 || len > 8) return null;
    let size = b[at] & (0xff >> len), unknown = size === (0xff >> len);
    for (let k = 1; k < len; k++) { size = size * 256 + b[at + k]; unknown &&= b[at + k] === 0xff; }
    return { size: unknown ? Infinity : size, len };
}
const element = (b, at) => {
    const id = readId(b, at); if (!id) return null;
    const sz = readSize(b, at + id.len); if (!sz) return null;
    return { id: id.id, start: at, body: at + id.len + sz.len, end: sz.size === Infinity ? Infinity : at + id.len + sz.len + sz.size, sizeAt: at + id.len, sizeLen: sz.len };
};
export function withDuration(bytes, ms) {
    const b = bytes;
    let at = 0, segment = null;
    while (at < b.length) {                                 // the EBML header, then the Segment
        const e = element(b, at);
        if (!e) return b;
        if (e.id === SEGMENT) { segment = e; break; }
        if (e.end === Infinity) return b;
        at = e.end;
    }
    if (!segment) return b;
    let info = null, seekHead = false;
    for (at = segment.body; at < b.length;) {
        const e = element(b, at);
        if (!e || e.id === CLUSTER) break;
        if (e.id === SEEK_HEAD) seekHead = true;
        if (e.id === INFO) { info = e; break; }
        if (e.end === Infinity) break;
        at = e.end;
    }
    if (!info || info.end > b.length) return b;
    let scale = 1e6, duration = null;
    for (at = info.body; at < info.end;) {
        const e = element(b, at);
        if (!e || e.end > info.end) return b;
        if (e.id === TIMECODE_SCALE) { scale = 0; for (let k = e.body; k < e.end; k++) scale = scale * 256 + b[k]; }
        if (e.id === DURATION) duration = { e };
        at = e.end;
    }
    const units = ms * 1e6 / scale;
    if (duration) {                                         // one is there already: written over, in its own width
        const out = b.slice(), view = new DataView(out.buffer, out.byteOffset + duration.e.body, duration.e.end - duration.e.body);
        if (view.byteLength === 8) view.setFloat64(0, units); else if (view.byteLength === 4) view.setFloat32(0, units); else return b;
        return out;
    }
    if (seekHead) return b;                                 // positions after the Info would be off by the bytes added
    // the Info written again with a Duration (id 0x4489, size 8, a float64) at its end, its size as an 8-byte integer
    const body = b.subarray(info.body, info.end), add = new Uint8Array(11);
    add.set([0x44, 0x89, 0x88]);
    new DataView(add.buffer).setFloat64(3, units);
    const size = body.length + add.length, head = new Uint8Array(4 + 8);
    head.set(b.subarray(info.start, info.sizeAt));            // the Info's id, 4 bytes
    head[4] = 0x01;
    for (let k = 0, v = size; k < 7; k++, v = Math.floor(v / 256)) head[11 - k] = v % 256;
    const grow = head.length + size - (info.end - info.start);
    const out = new Uint8Array(b.length + grow);
    out.set(b.subarray(0, info.start), 0);
    out.set(head, info.start);
    out.set(body, info.start + head.length);
    out.set(add, info.start + head.length + body.length);
    out.set(b.subarray(info.end), info.start + head.length + size);
    // a Segment of known size grows by as much, its size kept in the same width
    if (segment.end !== Infinity) {
        let v = segment.end - segment.body + grow;
        for (let k = segment.sizeLen - 1; k >= 1; k--, v = Math.floor(v / 256)) out[segment.sizeAt + k] = v % 256;
        out[segment.sizeAt] = (0x80 >> (segment.sizeLen - 1)) | v;
    }
    return out;
}
