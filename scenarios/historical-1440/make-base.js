#!/usr/bin/env node
// Build this scenario's map-base.svg and the data tables of SCENARIO.md from real geography (data.js).
//
//   node scenarios/historical-1440/make-base.js            write map-base.svg and the data tables of SCENARIO.md, then run
//                                                          node tools/map.js scenarios/historical-1440 mountains
//   node scenarios/historical-1440/make-base.js preview    only draw preview.png (lands, coasts, rivers)
//
// Running it again OVERWRITES map-base.svg and the data tables of SCENARIO.md: once you edit those by hand,
// edit them and run tools/map.js only. Node built-ins only.
//
// Ported from make-base.pl (see git history) with the same sections, algorithm and output. Pixel grids are
// typed arrays indexed y * W + x; corners of the pixel grid are y * VW + x.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const HERE = import.meta.dirname;
const MODE = process.argv[2] ?? "build";
if (!/^(build|preview)$/.test(MODE)) die(`usage: ${process.argv[1]} [preview]\n`);
import {
    FORMABLES, COUNTRIES, SETTLEMENTS, SEEDS, ISLAND_OWNER, PIECE_OWNER, COAST, RIVERS, PASSES, MOUNTAINS, DIVIDERS,
    ZONES, STRAITS, NO_ROUTE,
} from "./data.js";

// ---------- helpers for the port ----------
function die(msg) { process.stderr.write(msg); process.exit(1); }
function warn(msg) { process.stderr.write(msg); }
function print(msg) { process.stdout.write(msg); }
function writeFile(file, data) { try { fs.writeFileSync(file, data); } catch (e) { die(`${file}: ${e.message}\n`); } }
// printf "%.Nf" as C does it: toFixed, except that an exact half rounds to even (toFixed rounds it away
// from zero).
// An exact half needs v * 2^(N+1) to be a whole number, so the slow check runs only then.
function fixed(v, digits) {
    const s = v.toFixed(digits);
    if (!Number.isInteger(v * 2 ** (digits + 1))) return s;
    const exact = Math.abs(v).toFixed(100).replace(/0+$/, "");
    const dot = exact.indexOf(".");
    if (dot < 0 || exact.length !== dot + digits + 2 || !exact.endsWith("5")) return s;
    const down = exact.slice(0, digits ? -1 : -2);                       // the half dropped (and the point, for %.0f)
    return +down.at(-1) % 2 ? s : (v < 0 ? "-" : "") + down;
}
function own(obj, key) { return Object.hasOwn(obj, key) ? obj[key] : undefined; }   // $h{$key} on a data hash
function pushTo(map, key, value) { if (!map.has(key)) map.set(key, []); map.get(key).push(value); }
function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }   // a .. b
function byNumber(a, b) { return a - b; }                                             // sort { $a <=> $b }

// ---------- projection: Lambert conformal conic, standard parallels 47 and 57 N, centred on 14 E ----------
function tan(z) { return Math.sin(z) / Math.cos(z); }                    // as Math::Trig's tan
const DEG = Math.atan2(1, 1) / 45;
const Q = Math.atan2(1, 1);
const [P1, P2, P0, L0] = [47, 57, 52.5, 14].map(d => d * DEG);
const NC = Math.log(Math.cos(P1) / Math.cos(P2)) / Math.log(tan(Q + P2 / 2) / tan(Q + P1 / 2));
const FC = Math.cos(P1) * tan(Q + P1 / 2) ** NC / NC;
const R0 = FC / tan(Q + P0 / 2) ** NC;
function km(la, lo) {
    const r = FC / tan(Q + la * DEG / 2) ** NC;
    const t = NC * (lo * DEG - L0);
    return [6371 * r * Math.sin(t), 6371 * (R0 - r * Math.cos(t))];
}
const KM_PER_UNIT = 1.2, MARGIN = 45;                                   // map units
const sk = SETTLEMENTS.map(s => km(s.lat, s.lon));
const X0 = Math.min(...sk.map(p => p[0])) - MARGIN * KM_PER_UNIT;
const Y1 = Math.max(...sk.map(p => p[1])) + MARGIN * KM_PER_UNIT;
const W = Math.trunc((Math.max(...sk.map(p => p[0])) + MARGIN * KM_PER_UNIT - X0) / KM_PER_UNIT + 0.5);
const H = Math.trunc((Y1 - Math.min(...sk.map(p => p[1])) + MARGIN * KM_PER_UNIT) / KM_PER_UNIT + 0.5);
function proj(la, lo) {
    const [x, y] = km(la, lo);
    return [(x - X0) / KM_PER_UNIT, (Y1 - y) / KM_PER_UNIT];
}
function pts(s) {
    const n = s.split(/\s+/).filter(t => t !== "");
    if (n.length % 2) die("odd number of coordinates\n");
    const p = [];
    for (let i = 0; i < n.length; i += 2) p.push([Number(n[i]), Number(n[i + 1])]);
    return p;
}
print(`map ${W} x ${H} units, 1 unit = ${fixed(KM_PER_UNIT, 1)} km\n`);

// ---------- settlements ----------
const SID = new Map();
const S = [undefined];                                                  // ids from 1, in data order
const ORD = new Map(COUNTRIES.map((c, i) => [c[0], i]));
for (const s of SETTLEMENTS) {
    if (!ORD.has(s.country)) die(`settlement ${s.name}: unknown country ${s.country}\n`);
    if (SID.get(s.name)) die(`duplicate settlement ${s.name}\n`);
    S.push(s);
    s.id = S.length - 1;
    SID.set(s.name, s.id);
    const [x, y] = proj(s.lat, s.lon);
    s.x = Math.trunc(x);
    s.y = Math.trunc(y);
}
for (const c of COUNTRIES) if (!SID.get(c[2])) die(`country ${c[0]}: capital ${c[2]} is not a settlement\n`);

// ---------- land mask: every coast ring, filled at pixel centres ----------
const LAND = new Uint16Array(W * H);                                    // 0 sea, else ring number + 1
const RINGNAME = [];
// x of every crossing of the edges [a, b] with the line y = py, in order
function crossings(e, py) {
    const xs = [];
    for (const [a, b] of e) {
        if ((a[1] > py) !== (b[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    return xs.sort(byNumber);
}
for (let ri = 0; ri < COAST.length; ri++) {
    const [name, txt] = COAST[ri];
    RINGNAME.push(name);
    const p = pts(txt).map(q => proj(...q));
    const e = p.map((q, i) => [p.at(i - 1), q]);
    for (let y = 0; y < H; y++) {
        const xs = crossings(e, y + 0.5);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            const [l, r] = [xs[k], xs[k + 1]];
            for (let x = Math.max(0, Math.trunc(l + 0.5)); x <= Math.min(W - 1, Math.trunc(r + 0.5) - 1); x++) LAND[y * W + x] = ri + 1;
        }
    }
}

// the 4 neighbours of pixel i on the map, in the order left, right, up, down
function nb4(i) {
    const x = i % W, y = Math.trunc(i / W);
    const n = [];
    if (x > 0) n.push(i - 1);
    if (x < W - 1) n.push(i + 1);
    if (y > 0) n.push(i - W);
    if (y < H - 1) n.push(i + W);
    return n;
}
// connected pieces of land and of sea (4-neighbours)
function pieces(test) {
    const id = new Int32Array(W * H);
    const size = [0];
    let n = 0;
    for (let i = 0; i < W * H; i++) {
        if (id[i] || !test(i)) continue;
        n++;
        const st = [i];
        id[i] = n;
        let c = 0;
        while (st.length) {
            const j = st.pop();
            c++;
            for (const k of nb4(j)) {
                if (id[k] || !test(k)) continue;
                id[k] = n;
                st.push(k);
            }
        }
        size.push(c);
    }
    return [id, size];
}
// small patches of sea enclosed by land (lakes left by the drawing) become land; a lagoon that closed up is reported
{
    const [sid, ssize] = pieces(i => !LAND[i]);
    const edge = new Set();
    for (let x = 0; x < W; x++) { edge.add(sid[x]); edge.add(sid[(H - 1) * W + x]); }
    for (let y = 0; y < H; y++) { edge.add(sid[y * W]); edge.add(sid[y * W + W - 1]); }
    for (let i = 0; i < W * H; i++) {
        const p = sid[i];
        if (!p || edge.has(p) || ssize[p] >= 2000) continue;
        const nb = [i - 1, i + 1, i - W, i + W].filter(j => j >= 0 && j < W * H).map(j => LAND[j]).find(v => v);
        LAND[i] = nb || 1;
    }
    const rep = new Set();
    for (let i = 0; i < W * H; i++) {
        const p = sid[i];
        if (!p || edge.has(p) || ssize[p] >= 2000 || rep.has(p)) continue;
        rep.add(p);
        if (ssize[p] < 30) continue;
        print(`  enclosed sea of ${ssize[p]} units near ${i % W},${Math.trunc(i / W)} filled in\n`);
    }
}

// sea narrower than 3 units (the tips of estuaries) becomes land, so the coast can be straightened without pinching
{
    const sea = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) sea[i] = LAND[i] ? 0 : 1;
    const core = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) core[i] = sea[i] && !nb4(i).some(j => !sea[j]) ? 1 : 0;
    let n = 0;
    for (let i = 0; i < W * H; i++) {
        if (!(sea[i] && !core[i] && !nb4(i).some(j => core[j]))) continue;
        const l = nb4(i).map(j => LAND[j]).find(v => v);
        LAND[i] = l || 1;
        n++;
    }
    print(`  ${n} units of sea in channels under 3 units wide made land\n`);
}

// ---------- give the land to the settlements: nearest seed, measured over land ----------
const SIDE4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (const s of S.slice(1)) {
    if (LAND[s.y * W + s.x]) continue;                                  // a coastal town drawn just off the coast moves onto it
    const cand = [];
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) cand.push([s.x + dx, s.y + dy, dx * dx + dy * dy]);
    const best = cand.filter(c => LAND[c[1] * W + c[0]]).sort((a, b) => a[2] - b[2])[0];
    if (!best) die(`${s.name} is more than 10 units out to sea\n`);
    print(`  ${s.name} moved ${fixed(Math.sqrt(best[2]), 0)} units onto the coast\n`);
    [s.x, s.y] = [best[0], best[1]];
    // well inside the land: 3 units from the sea where it can be
    for (let k = 1; k <= 3; k++) {
        const { x, y } = s;
        const step = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
            .map(d => [x + d[0], y + d[1]])
            .find(([u, v]) => !SIDE4.some(d => !LAND[(v + d[1]) * W + u + d[0]]));
        if (!step) break;
        [s.x, s.y] = step;
    }
}
const [PIECE, PSIZE] = pieces(i => LAND[i]);
const SEED = [];                                                        // [x, y, settlement id]
for (const s of S.slice(1)) {
    SEED.push([s.x, s.y, s.id]);
    for (const q of own(SEEDS, s.name) ?? []) {
        const [x, y] = proj(...q);
        SEED.push([Math.trunc(x), Math.trunc(y), s.id]);
    }
}
for (const sd of SEED) {
    if (sd[0] < 0 || sd[1] < 0 || sd[0] >= W || sd[1] >= H) die(`a seed of ${S[sd[2]].name} (${sd[0]},${sd[1]}) is off the map\n`);
    const i = sd[1] * W + sd[0];
    if (!LAND[i]) {
        const s = S[sd[2]];
        die(`seed of ${s.name} at ${sd[0]},${sd[1]} (${sd[0] === s.x && sd[1] === s.y ? "the settlement" : "an extra seed"}) is in the sea\n`);
    }
}
for (const s of S.slice(1)) if (!PIECE[s.y * W + s.x]) die(`${s.name} lies on a piece of land with no room\n`);
const OWN = new Int32Array(W * H);
const COST = new Float64Array(W * H).fill(1e18);
const bucket = [];
for (const sd of SEED) {
    const i = sd[1] * W + sd[0];
    COST[i] = 0;
    OWN[i] = sd[2];
    (bucket[0] ??= []).push(i);
}
const STEPS = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
for (let c = 0; c < bucket.length; c++) {
    const b = bucket[c];
    if (!b) continue;
    for (const i of b) {
        if (COST[i] < c) continue;
        const x = i % W, y = Math.trunc(i / W);
        for (const [dx, dy, w] of STEPS) {
            const u = x + dx, v = y + dy;
            if (u < 0 || v < 0 || u >= W || v >= H) continue;
            const j = v * W + u;
            if (!LAND[j]) continue;
            if (dx && dy && !(LAND[y * W + u] && LAND[v * W + x])) continue;      // no corner-cutting across water
            const nc = c + w;
            if (COST[j] <= nc) continue;
            COST[j] = nc;
            OWN[j] = OWN[i];
            (bucket[nc] ??= []).push(j);
        }
    }
    bucket[c] = undefined;
}
// pieces nobody reached: islands, by their owner in ISLAND_OWNER, else dropped if tiny, else the nearest settlement
{
    const done = new Map();
    for (const [la, lo, name] of PIECE_OWNER) {
        const [x, y] = proj(la, lo).map(Math.trunc);
        const i = y * W + x;
        if (x < 0 || y < 0 || x >= W || y >= H || !LAND[i]) die(`PIECE_OWNER ${la} ${lo} is not on land of the map\n`);
        if (!OWN[i]) done.set(PIECE[i], SID.get(name) ?? die(`PIECE_OWNER: no settlement ${name}\n`));
    }
    for (let i = 0; i < W * H; i++) {
        if (!LAND[i] || OWN[i]) continue;
        const p = PIECE[i];
        if (done.has(p)) continue;
        done.set(p, 0);
        const ring = RINGNAME[LAND[i] - 1];
        let owner = own(ISLAND_OWNER, ring) ? SID.get(ISLAND_OWNER[ring]) : undefined;
        if (!owner && PSIZE[p] < 60) done.set(p, "drop");
        else if (!owner) {
            const x = i % W, y = Math.trunc(i / W);
            const d2 = s => (s.x - x) ** 2 + (s.y - y) ** 2;
            owner = S.slice(1).sort((a, b) => d2(a) - d2(b)).map(s => s.id)[0];
            print(`  land near ${x},${y} (${ring}, ${PSIZE[p]} units) has no settlement: given to ${S[owner].name}\n`);
        }
        if (owner) done.set(p, owner);
    }
    for (let i = 0; i < W * H; i++) {
        if (!LAND[i] || OWN[i]) continue;
        const o = done.get(PIECE[i]);
        if (o === "drop") LAND[i] = 0;
        else OWN[i] = o;
    }
}

// ---------- preview ----------
function countryRgb(c) {
    let h = 0;
    for (const ch of c.repeat(3)) h = (h * 131 + ch.codePointAt(0)) % 360;
    const [s, l] = [0.45, 0.78];
    const f = n => {
        const k = Math.trunc(n + h / 30) % 12;                           // the hue wheel works on whole numbers
        return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [0, 8, 4].map(n => Math.trunc(255 * f(n)));
}
function png(file, px) {                                                // px: r, g, b of every pixel
    const row = 1 + 3 * W;
    const raw = Buffer.alloc(H * row);                                  // each row starts with filter type 0
    for (let y = 0; y < H; y++) raw.set(px.subarray(y * 3 * W, (y + 1) * 3 * W), y * row + 1);
    const chunk = (t, d) => {
        const td = Buffer.concat([Buffer.from(t, "latin1"), d]);
        const head = Buffer.alloc(4), crc = Buffer.alloc(4);
        head.writeUInt32BE(d.length);
        crc.writeUInt32BE(zlib.crc32(td));
        return Buffer.concat([head, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0);
    ihdr.writeUInt32BE(H, 4);
    ihdr.set([8, 2, 0, 0, 0], 8);
    writeFile(file, Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
function preview(file) {
    const rgb = new Map(COUNTRIES.map(c => [c[0], countryRgb(c[0])]));
    const px = new Uint8Array(3 * W * H);
    const set = (i, c) => px.set(c, 3 * i);
    for (let i = 0; i < W * H; i++) {
        const o = OWN[i];
        set(i, o ? rgb.get(S[o].country) : [153, 217, 234]);
    }
    for (let i = 0; i < W * H; i++) {
        const o = OWN[i];
        if (!o) continue;
        const x = i % W, y = Math.trunc(i / W);
        const right = [];
        if (x < W - 1) right.push(i + 1);
        if (y < H - 1) right.push(i + W);
        for (const j of right) {
            const p = OWN[j];
            if (!p) set(i, [0, 0, 0]);
            else if (p !== o) set(i, S[p].country === S[o].country ? [170, 170, 170] : [60, 60, 60]);
        }
        if ((x && !OWN[i - 1]) || (y && !OWN[i - W])) set(i, [0, 0, 0]);
    }
    for (const r of RIVERS) {
        const p = pts(r[1]).map(q => proj(...q));
        for (let k = 1; k < p.length; k++) {
            const [a, b] = [p[k - 1], p[k]];
            const n = Math.trunc(2 * Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)) + 1;
            for (let t = 0; t <= n; t++) {
                const [x, y] = [0, 1].map(d => Math.trunc(a[d] + (b[d] - a[d]) * t / n));
                if (x >= 0 && y >= 0 && x < W && y < H) set(y * W + x, [0, 110, 220]);
            }
        }
    }
    for (const s of S.slice(1)) {
        const r = s.city ? 4 : 3;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const [x, y] = [s.x + dx, s.y + dy];
                if (x >= 0 && y >= 0 && x < W && y < H && (s.city || dx * dx + dy * dy <= r * r)) set(y * W + x, [200, 20, 30]);
            }
        }
    }
    png(file, px);
    print(`wrote ${file}\n`);
}
if (MODE === "preview") { preview(`${HERE}/preview.png`); process.exit(0); }

// =====================================================================================
// lands as polygons: walk the edge of every land along the pixel grid, then straighten each stretch of edge
// between two meeting points once, so neighbouring lands keep exactly the same points
// =====================================================================================
function lab(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? -1 : OWN[y * W + x]; }
const VW = W + 1;
let NODE, POLY, SIMPLE, SHARED, COASTSEG;   // corners where three things meet; land -> rings; chain -> simplified corners; "a-b" -> shared edge length
function vxy(k) { return [k % VW, Math.trunc(k / VW)]; }
function dp(p, eps) {
    if (p.length <= 2) return [...p];
    const [a, b] = [p[0], p.at(-1)];
    let [bi, bd] = [0, -1];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const L = Math.sqrt(dx * dx + dy * dy);
    for (let i = 1; i < p.length - 1; i++) {
        const d = L ? Math.abs((p[i][0] - a[0]) * dy - (p[i][1] - a[1]) * dx) / L : Math.sqrt((p[i][0] - a[0]) ** 2 + (p[i][1] - a[1]) ** 2);
        if (d > bd) [bi, bd] = [i, d];
    }
    if (bd <= eps) return [a, b];
    const l = dp(p.slice(0, bi + 1), eps);
    const r = dp(p.slice(bi), eps);
    l.pop();
    return l.concat(r);
}
const EPS = 1.0;
function simple(ch, closed) {
    let c = [...ch];
    let r = [...c].reverse();
    if (closed) {
        const mi = range(0, c.length - 1).sort((a, b) => c[a] - c[b])[0];
        c = [...c.slice(mi), ...c.slice(0, mi)];
        r = [c[0], ...c.slice(1).reverse()];
    }
    const flip = closed ? c[1] > r[1] : (Math.sign(c[0] - r[0]) || Math.sign(c[1] - r[1])) > 0;
    const key = (flip ? r : c).join(",");
    let s = SIMPLE.get(key);
    if (s === undefined) {
        const p = (flip ? r : c).map(k => vxy(k));
        if (closed) {
            const d2 = q => (q[0] - p[0][0]) ** 2 + (q[1] - p[0][1]) ** 2;
            const far = range(0, p.length - 1).sort((a, b) => d2(p[b]) - d2(p[a]))[0];
            const l = dp(p.slice(0, far + 1), EPS);
            const rr = dp([...p.slice(far), p[0]], EPS);
            l.pop();
            rr.pop();
            const o = [...l, ...rr];
            s = o.length >= 3 ? o : [];
        } else {
            s = dp(p, EPS);
        }
        SIMPLE.set(key, s);
    }
    // corners off the map edge move a hair, so no edge runs exactly through a pixel centre (where filling in is a coin toss)
    s = s.map(([x, y]) => [x === 0 || x === W ? x : x + 0.01, y === 0 || y === H ? y : y + 0.07]);
    return flip ? s.reverse() : s;
}
function trace() {
    NODE = new Uint8Array(VW * (H + 1));
    POLY = new Map();
    SIMPLE = new Map();
    SHARED = new Map();
    COASTSEG = [];
    for (let j = 0; j <= H; j++) {
        for (let i = 0; i <= W; i++) {
            const q = [lab(i - 1, j - 1), lab(i, j - 1), lab(i, j), lab(i - 1, j)];
            if (!q.some(v => v > 0)) continue;
            const d = new Set(q).size;
            if (d >= 3 || (d === 2 && q[0] === q[2] && q[1] === q[3])) NODE[j * VW + i] = 1;
        }
    }
    const OUT = new Map(), RINGS = new Map();                           // land -> start corner -> [end corner, dx, dy, other side]
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const l = OWN[y * W + x];
            if (!l) continue;
            for (const [nx, ny, ax, ay, bx, by, dx, dy] of [[0, -1, x, y, x + 1, y, 1, 0], [1, 0, x + 1, y, x + 1, y + 1, 0, 1],
                [0, 1, x + 1, y + 1, x, y + 1, -1, 0], [-1, 0, x, y + 1, x, y, 0, -1]]) {
                const o = lab(x + nx, y + ny);
                if (o === l) continue;
                if (!OUT.has(l)) OUT.set(l, new Map());
                pushTo(OUT.get(l), ay * VW + ax, [by * VW + bx, dx, dy, o]);
            }
        }
    }
    for (const [l, out] of OUT) {         // the land is on the right of every edge; at a crosswise corner turn right
        for (const start of [...out.keys()].sort(byNumber)) {
            while (out.get(start).length) {
                const e = out.get(start).shift();
                const ring = [[start, e[3]]];
                let [v, dx, dy] = e;
                while (v !== start) {
                    const c = out.get(v);
                    if (!c) die(`land ${l}: broken edge at corner ${v}\n`);
                    if (!c.length) break;
                    let k = 0;
                    if (c.length > 1) {
                        const pref = { [`${-dy} ${dx}`]: 0, [`${dx} ${dy}`]: 1, [`${dy} ${-dx}`]: 2 };
                        const rank = m => pref[`${c[m][1]} ${c[m][2]}`] ?? 0;      // a turn not in the list counts as 0
                        k = range(0, c.length - 1).sort((a, b) => rank(a) - rank(b))[0];
                    }
                    const n = c.splice(k, 1)[0];
                    ring.push([v, n[3]]);
                    [v, dx, dy] = n;
                }
                pushTo(RINGS, l, ring);
            }
        }
    }
    for (const l of [...RINGS.keys()].sort(byNumber)) {
        for (const ring of RINGS.get(l)) {
            const n = range(0, ring.length - 1).filter(i => NODE[ring[i][0]]);
            const out = [];
            const chains = [];                // [corners..., other side]
            if (!n.length) {
                chains.push([ring.map(rc => rc[0]), ring[0][1], 1]);
            } else {
                for (let k = 0; k < n.length; k++) {
                    const [a, b] = [n[k], n[(k + 1) % n.length]];
                    const idx = b > a ? range(a, b) : [...range(a, ring.length - 1), ...range(0, b)];
                    chains.push([idx.map(i => ring[i][0]), ring[a][1], 0]);
                }
            }
            for (const [corners, other, closed] of chains) {
                const s = simple(corners, closed);
                if (other > 0 && other !== l) {
                    const key = [l, other].sort(byNumber).join("-");
                    SHARED.set(key, (SHARED.get(key) ?? 0) + corners.length - 1 + closed);
                }
                if (other === 0 && s.length) for (let i = 1; i < s.length; i++) COASTSEG.push([s[i - 1], s[i]]);
                if (other === 0 && closed && s.length) COASTSEG.push([s.at(-1), s[0]]);
                const t = [...s];
                if (out.length && t.length && out.at(-1)[0] === t[0][0] && out.at(-1)[1] === t[0][1]) t.shift();
                for (const q of t) out.push(q);
            }
            if (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
            if (out.length >= 3) pushTo(POLY, l, out);
        }
    }
    SIMPLE = new Map();
}
function gaps() {      // fill the polygons in as tools/map.js does: patches of sea under 2000 units shut in between lands
    const reg = new Int32Array(W * H);
    for (const [l, rings] of POLY) {                                    // any fixed order gives the same fill
        const e = [];
        for (const r of rings) r.forEach((q, i) => e.push([q, r.at(i - 1)]));
        let [y0, y1] = [Infinity, -Infinity];
        for (const [a] of e) { y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); }
        for (let y = Math.max(0, Math.trunc(y0)); y <= Math.min(H - 1, Math.trunc(y1)); y++) {
            const xs = crossings(e, y + 0.5);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                const [a, b] = [xs[k], xs[k + 1]];
                for (let x = Math.max(0, Math.trunc(a + 0.5)); x <= Math.min(W - 1, Math.trunc(b + 0.5) - 1); x++) reg[y * W + x] = l;
            }
        }
    }
    const seen = new Uint8Array(W * H);
    const fill = [];
    for (let i = 0; i < W * H; i++) {
        if (reg[i] || seen[i]) continue;
        const st = [i];
        seen[i] = 1;
        const patch = [];
        while (st.length) {
            const j = st.pop();
            patch.push(j);
            for (const k of nb4(j)) {
                if (reg[k] || seen[k]) continue;
                seen[k] = 1;
                st.push(k);
            }
        }
        if (patch.length < 2000) for (const j of patch) fill.push(j);
    }
    return [reg, fill];
}
for (let round = 1; round <= 5; round++) {
    trace();
    const [reg, fill] = gaps();
    if (!fill.length) break;
    if (round === 5) die("could not close the gaps between lands\n");
    print(`  ${fill.length} units of sea shut in between lands: filled in (${fill.slice(0, Math.min(5, fill.length - 1) + 1).map(i => `${i % W},${Math.trunc(i / W)}`).join(" ")})\n`);
    const f = new Set(fill);
    while (f.size) {
        const n = f.size;
        for (const i of [...f].sort(byNumber)) {                        // ascending, so runs repeat exactly
            const nb = [i - 1, i + 1, i - W, i + W].filter(j => j >= 0 && j < W * H).map(j => f.has(j) ? 0 : (reg[j] || OWN[j])).find(v => v);
            if (!nb) continue;
            OWN[i] = nb;
            reg[i] = nb;
            f.delete(i);
        }
        if (f.size === n) die("a shut-in patch has no land next to it\n");
    }
}
function inside(x, y, rings) {
    let inn = false;
    for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
            const [a, b] = [r[i], r.at(i - 1)];
            if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])) inn = !inn;
        }
    }
    return inn;
}
function edgeDist(x, y, rings) {
    let m = 1e9;
    for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
            const [a, b] = [r[i], r.at(i - 1)];
            const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
            const L2 = dx * dx + dy * dy;
            let t = L2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / L2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const d = Math.sqrt((x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2);
            if (d < m) m = d;
        }
    }
    return m;
}
for (const s of S.slice(1)) {
    const p = POLY.get(s.id);                                           // marker well inside its land
    if (!p) die(`${s.name} has no land\n`);
    if (inside(s.x, s.y, p) && edgeDist(s.x, s.y, p) >= 3) continue;
    const cand = [];
    for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
            const [u, v] = [s.x + dx, s.y + dy];
            if (inside(u, v, p)) cand.push([u, v, Math.min(4, edgeDist(u, v, p)), (u - s.x) ** 2 + (v - s.y) ** 2]);
        }
    }
    const best = cand.sort((a, b) => b[2] - a[2] || a[3] - b[3])[0];
    if (!best) die(`${s.name}: no room for its marker in its land\n`);
    [s.x, s.y] = [best[0], best[1]];
}

// ---------- rivers, sea zone dividers ----------
function segDist(px, py, a, b) {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [[a[0] + t * dx, a[1] + t * dy], Math.sqrt((px - a[0] - t * dx) ** 2 + (py - a[1] - t * dy) ** 2)];
}
function clip(p) {      // keep the part of a line inside the map
    const runs = [];
    let cur = [];
    const isIn = q => q[0] >= 0 && q[1] >= 0 && q[0] <= W && q[1] <= H;
    const cut = (a, b) => {
        let t = 1;
        for (const [k, v] of [[0, 0], [0, W], [1, 0], [1, H]]) {
            const d = b[k] - a[k];
            if (!d) continue;
            const u = (v - a[k]) / d;
            if (!(u >= 0 && u <= 1)) continue;
            const q = [0, 1].map(m => a[m] + (b[m] - a[m]) * u);
            if (u < t && isIn(q)) t = u;
        }
        return [0, 1].map(m => a[m] + (b[m] - a[m]) * t);
    };
    for (let i = 0; i < p.length; i++) {
        if (isIn(p[i])) {
            if (i && !isIn(p[i - 1])) cur.push(cut(p[i], p[i - 1]), p[i]);
            else cur.push(p[i]);
        } else if (cur.length) {
            cur.push(cut(p[i - 1], p[i]));
            runs.push(cur);
            cur = [];
        }
    }
    if (cur.length) runs.push(cur);
    return runs.filter(r => r.length >= 2);
}
const RIVERLINES = [];
for (const r of RIVERS) {
    const p = pts(r[1]).map(q => proj(...q));
    for (const s of S.slice(1)) {
        for (const q of p) {          // a town sits on one bank: the river passes 7 units off its centre
            let [dx, dy] = [q[0] - s.x, q[1] - s.y];
            let d = Math.sqrt(dx * dx + dy * dy);
            if (d >= 7) continue;
            if (d < 0.5) [dx, dy, d] = [0.6, 0.8, 1];
            [q[0], q[1]] = [s.x + dx / d * 7, s.y + dy / d * 7];
        }
    }
    for (const run of clip(p)) {
        const q = dp(run, 1.5);
        let [best, bd] = [undefined, 1e9];
        for (const cs of COASTSEG) {
            const [c, d] = segDist(...q.at(-1), ...cs);
            if (d < bd) [best, bd] = [c, d];
        }
        if (bd < 25) q[q.length - 1] = best;                            // the mouth lies on the coast
        RIVERLINES.push([r[0], q]);
    }
}
function rayHit(o, dir) {      // nearest coast crossing from o along dir
    let best = 1e9;
    for (const [a, b] of COASTSEG) {
        const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
        const den = dir[0] * ey - dir[1] * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den;
        const u = ((a[0] - o[0]) * dir[1] - (a[1] - o[1]) * dir[0]) / den;
        if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
}
const DIVLINES = [];
for (const d of DIVIDERS) {
    const [a, b] = pts(d).map(q => proj(...q));
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const end = [a, b].map(e => {
        const [dx, dy] = [e[0] - m[0], e[1] - m[1]];
        const L = Math.sqrt(dx * dx + dy * dy);
        const t = rayHit(m, [dx / L, dy / L]);
        if (t > 400) warn(`sea zone divider near ${fixed(m[0], 0)},${fixed(m[1], 0)} reaches no coast\n`);
        return [m[0] + dx / L * t, m[1] + dy / L * t].map(v => Number(fixed(v, 2)));
    });
    DIVLINES.push(end);
}

// ---------- routes: lands that share an edge, passes, straits ----------
function pairKey(u, v) { return [u, v].sort(byNumber).join("-"); }
const NOR = new Set(NO_ROUTE.map(rt => pairKey(...rt.map(n => SID.get(n) ?? die(`NO_ROUTE: no settlement ${n}\n`)))));
const ROUTE = new Set([...SHARED.keys()].filter(k => SHARED.get(k) >= 12 && !NOR.has(k)));
const PASSOUT = [];
for (const [id, la, lo, routes] of PASSES) {
    const [x, y] = proj(la, lo).map(Math.trunc);
    const r = [];
    for (const rt of routes) {
        const [u, v] = rt.map(n => SID.get(n) ?? die(`pass ${id}: no settlement ${n}\n`));
        const k = pairKey(u, v);
        if (ROUTE.has(k)) r.push(k);
        else warn(`pass ${id}: ${rt[0]} and ${rt[1]} do not share a border; route left out\n`);
    }
    if (!OWN[y * W + x]) die(`pass ${id} is not on land\n`);
    if (r.length) PASSOUT.push([id, x, y, r]);
}
const STR = new Set(STRAITS.map(rt => pairKey(...rt.map(n => SID.get(n) ?? die(`STRAITS: no settlement ${n}\n`)))));
const NB = new Map(), ST = new Map();
for (const k of ROUTE) { const [a, b] = k.split("-").map(Number); pushTo(NB, a, b); pushTo(NB, b, a); }
for (const k of STR) { const [a, b] = k.split("-").map(Number); pushTo(ST, a, b); pushTo(ST, b, a); }
for (const s of S.slice(1)) if (!NB.has(s.id) && !ST.has(s.id)) warn(`${s.name} has no route to anywhere\n`);

// =====================================================================================
// map-base.svg
// =====================================================================================
function dl(p) { return "M" + p.map(q => q.map(v => Number(fixed(v, 2))).join(" ")).join(" L"); }
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n`
    + `<!-- Map geometry for map.svg (see SCENARIO.md). Made by make-base.js from real latitudes and longitudes (data.js);\n`
    + `     edit it by hand from here on (Inkscape, with snapping) and run tools/map.js. One shape per settlement's land (id land-N),\n`
    + `     the rivers and the sea zone dividers. Neighbouring lands share exactly the same points; straight segments only. -->\n`
    + `<rect width="${W}" height="${H}" fill="#99d9ea"/>\n<g id="lands" fill="#ffffff" stroke="#7f7f7f" stroke-width="1">\n`;
for (const l of [...POLY.keys()].sort(byNumber)) svg += `  <path id="land-${l}" d="${POLY.get(l).map(r => dl(r) + " Z").join(" ")}"/>\n`;
svg += `</g>\n<g id="rivers" fill="none" stroke="#00a2e8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n`;
for (const [name, q] of RIVERLINES) svg += `  <path d="${dl(q)}"/><!-- ${name} -->\n`;
svg += `</g>\n<g id="sea-zones" fill="none" stroke="#3d7f9c" stroke-width="1.5" stroke-dasharray="6 4">\n`;
for (const q of DIVLINES) svg += `  <path d="${dl(q)}"/>\n`;
svg += "</g>\n</svg>\n";
writeFile(`${HERE}/map-base.svg`, svg);
print(`map-base.svg: ${POLY.size} lands, ${RIVERLINES.length} rivers, ${DIVLINES.length} sea zone dividers; ${ROUTE.size} land routes, ${STR.size} straits, ${PASSOUT.length} passes\n`);

// =====================================================================================
// SCENARIO.md: the data tables are (re)written; everything else in an existing file is kept
// =====================================================================================
const DOCF = `${HERE}/SCENARIO.md`;
function lines(text, dropAllTrailing) {     // split into lines without their "\n", the trailing empty line dropped
    const l = text === "" ? [] : text.split("\n");
    if (dropAllTrailing) while (l.length && l.at(-1) === "") l.pop();
    else if (text.endsWith("\n")) l.pop();
    return l;
}
const doc = fs.existsSync(DOCF) ? lines(fs.readFileSync(DOCF, "utf8"), false) : lines(template(), true);
function ranges(list) {
    const n = [...list].sort(byNumber);
    const r = [];
    while (n.length) {
        const a = n.shift();
        let b = a;
        while (n.length && n[0] === b + 1) b = n.shift();
        r.push(b === a ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`);
    }
    return r.join(", ");
}
function putTable(title, ...t) {
    const quoted = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");         // \Q...\E
    const head = new RegExp(`^## ${quoted}\\s*$`);
    const s = doc.findIndex(l => head.test(l));
    if (s < 0) die(`SCENARIO.md: no '## ${title}'\n`);
    let i = s + 1;
    while (i < doc.length && !/^\|/.test(doc[i]) && !/^#{1,2} /.test(doc[i])) i++;
    if (!(i < doc.length && /^\|/.test(doc[i]))) die(`SCENARIO.md: no table under '## ${title}'\n`);
    let j = i;
    while (j < doc.length && /^\|/.test(doc[j])) j++;
    doc.splice(i, j - i, ...t);
}
const BYC = new Map();
for (const s of S.slice(1)) pushTo(BYC, s.country, s.id);
putTable("Countries", "| Code | Country | Capital | Settlements | Pop | Army | Ships | HRE |", "|---|---|---|---|---|---|---|---|",
    ...COUNTRIES.map(c => `| ${c[0]} | ${c[1]} | ${SID.get(c[2])} ${c[2]} |  |  |  |  |  |`));
putTable("Settlements", "| ID | Name | Country | Type | Port | HRE | X | Y | Borders | Straits |", "|---|---|---|---|---|---|---|---|---|---|",
    ...S.slice(1).map(s => `| ${s.id} | ${s.name} | ${s.country} | ${s.city ? "city" : "town"} | ${s.port ? "port" : ""} | `
        + `${s.hre ? "HRE" : ""} | ${s.x} | ${s.y} | ${[...NB.get(s.id) ?? []].sort(byNumber).join(", ")} | ${[...ST.get(s.id) ?? []].sort(byNumber).join(", ")} |`));
putTable("Mountain passes", "| Pass | X | Y | Routes | In the land of | Owner at start |", "|---|---|---|---|---|---|",
    ...PASSOUT.map(p => `| ${p[0]} | ${p[1]} | ${p[2]} | ${p[3].join(", ")} |  |  |`));
putTable("Sea zones", "| Zone | X | Y | Ports | Straits | Next to |", "|---|---|---|---|---|---|", ...ZONES.map(z => {
    const [x, y] = proj(z[1], z[2]).map(Math.trunc);
    return `| ${z[0]} | ${x} | ${y} |  |  |  |`;
}));
putTable("Special coring", "| Formable | What it was | Settlements | Count |", "|---|---|---|---|", ...FORMABLES.map(([n, what, parts]) => {
    const ids = parts.flatMap(p => BYC.get(p) ?? [SID.get(p) ?? die(`formable ${n}: no country or settlement ${p}\n`)]).sort(byNumber);
    const u = [...new Set(ids)];
    return `| **${n}** | ${what} | ${ranges(u)} | ${u.length} |`;
}));
{
    const s = Math.max(0, doc.findIndex(l => /^## Mountains\s*$/.test(l)));
    const [f, t] = range(s, doc.length - 1).filter(k => /^```/.test(doc[k]));
    const p = MOUNTAINS.flatMap(m => pts(m)).map(q => proj(...q).map(Math.trunc).join(","));
    const l = [];
    while (p.length) l.push(p.splice(0, 8).join("  "));
    doc.splice(f + 1, t - f - 1, ...l);
}
writeFile(DOCF, doc.map(l => `${l}\n`).join(""));
print("SCENARIO.md: data tables written\n");

// The first SCENARIO.md, used only when none exists. Its hand-written sections (the situation in 1440, the Empire,
// the design notes) have since been rewritten in SCENARIO.md itself, which make-base.js keeps.
function template() {
    const cities = S.slice(1).filter(s => s.city).length;
    return `# SCENARIO: HISTORICAL 1440

*Everything here is specific to this map; the general rules are in [RULES.md](../../docs/RULES.md).*

A more accurate take on the Mitteleuropa map ([scenarios/mitteleuropa](../mitteleuropa/SCENARIO.md)): the same corner of Europe
in the year 1440, with every town where it really is, the realms that really existed, and towns made cities by
how big they really were.

This file is the **only** place the map's facts are written down. The map's shapes — one per settlement's land,
plus the rivers and the sea zone dividers — are in [map-base.svg](map-base.svg). From the two, a script builds
[map.svg](map.svg), the map the game shows, and [scenario.json](scenario.json), this scenario as data for the
game. After changing either, run:

\`\`\`
node tools/map.js scenarios/historical-1440              # check everything, rebuild map.svg and scenario.json, refresh this file
node tools/map.js scenarios/historical-1440 mountains    # the same, but first move any mountain that touches something
\`\`\`

map-base.svg and the data tables here were first made by
[make-base.js](make-base.js) from real latitudes and longitudes ([data.js](data.js)); running it again
**overwrites** map-base.svg and the tables, so once you edit them by hand, use tools/map.js only.

Columns and blocks marked *generated* are rewritten by the script — edit the rest.

**x = 1** (see the scenario scaling note in RULES.md)

**Army speed:** 420 map units per year — a route takes its length on the map ÷ this (RULES.md §8). One map unit
is about 1.2 km, so an army covers about 500 km a year, as on the Mitteleuropa map.

<!-- generated:summary -->
<!-- /generated -->

![Map](map.svg)

## Countries

*Code, Country and Capital are data (Capital is a settlement ID; the script adds the name); the other columns are generated. A country that owns a city must have one as its capital (RULES.md §2).*

| Code | Country | Capital | Settlements | Pop | Army | Ships | HRE |
|---|---|---|---|---|---|---|---|

## Settlements

- **Type** — \`town\` (red circle, 10,000 pop) or \`city\` (red square, 20,000 pop). The ${cities} cities are the largest
  towns of the map around 1440.
- **Port** — the settlement sits on the coast. 46 Bremen is a port **by ruling**: it lies up the Weser.
- **HRE** — inside the Holy Roman Empire.
- **X, Y** — marker centre, in map units (the coordinates of map.svg). The settlement's land is the shape
  \`land-ID\` in map-base.svg; country borders are drawn wherever two lands belong to different countries.
- **Borders** — settlements an army can march to in one step (every route is listed under both ends). Routes
  through a mountain pass are listed here too; the pass itself is in *Mountain passes*.
- **Straits** — crossings by sea (dashed lines, RULES.md §8).

| ID | Name | Country | Type | Port | HRE | X | Y | Borders | Straits |
|---|---|---|---|---|---|---|---|---|---|

## Mountain passes

Yellow triangles on the map. Every route listed runs settlement → pass → settlement. A pass belongs to whoever
owns the settlement whose land it lies in (RULES.md §8). *Pass, X, Y and Routes are data; the other columns are
generated from where the pass lies.*

| Pass | X | Y | Routes | In the land of | Owner at start |
|---|---|---|---|---|---|

## Route bends

A route is drawn straight, and the script bends it by itself only where the straight line would leave its
countries' land. List a route here to bend it through points of your own. *All columns are data.* Points are x,y
in map units, in order from the lower-numbered settlement; the route's length (and so its marching time) follows
the bend.

| Route | Through | Why |
|---|---|---|

## Mountains

Decoration only — mountains have no rules effect outside the passes. Apex positions (x,y in map units);
\`node tools/map.js scenarios/historical-1440 mountains\` moves any that touch something else.

\`\`\`
\`\`\`

## Overview

<!-- generated:overview -->
<!-- /generated -->

## Special coring
*(no Courthouse and no 20-year wait)*

You may proclaim a region when **both** are true:

1. Your **capital** lies within the region.
2. You control **100%** of its settlements.

Every settlement in the region becomes core immediately. If you later lose one and retake it, it is core again
on capture.

| Formable | What it was | Settlements | Count |
|---|---|---|---|

## Sea zones

Seven zones, split by the dashed lines in the sea. A fleet operates in one zone at a time (RULES.md §7). A port
belongs to the zone its coast faces; crossing a strait needs 10 ships in the zone the strait lies in (RULES.md
§8). *Zone, X and Y are data — X, Y is where the name is drawn, and the zone it names is the one around that
point; the other columns are generated from the map.*

| Zone | X | Y | Ports | Straits | Next to |
|---|---|---|---|---|---|

## The Holy Roman Empire

The Empire is every settlement marked **HRE** above (listed in the *Overview*).

Demand to become leader of the Empire under your hegemony. You must control **at least 20 settlements inside
the HRE**, and may propose **only once, ever**.

Each German state — every country that holds an HRE settlement — rolls on its own, like a protectorate demand
(RULES.md §10):
\`\`\`
chance each German state joins = size × 10 % + opinion ÷ 10 %
at most 75%
0% if your pop is not larger than theirs, or if their opinion of you is below −50
\`\`\`

Every German state that joins becomes your **protectorate** (RULES.md §10) and pays you **10%** of its yearly
money.

**The states that refuse form the League.** All of them make a **defensive alliance** with each other — declare
war on one member and the rest join against you. Refusing does not change their opinion of you (RULES.md §10).

## Victory

> **Control or vassalize 85 settlements.** Protectorates count as half — unless you demand one become a vassal
> and it agrees.

**End date: 1650.** The game ends when a player reaches 85, or at the start of **1650** — 210 years, about 2 hours
8 minutes of play. At the end date the player with the most settlements wins, counted the same way: controlled
and vassalized settlements count 1, protectorates ½. A tie goes to the larger total population (own settlements
and subjects).

---

## Design notes

*Hand-written. Unlike everything above it is not checked by the script, so re-read it after changing countries
or borders.*
`;
}
