#!/usr/bin/env node
// Build the map and game data from a scenario folder's SCENARIO.md (map facts) and map-base.svg (map geometry):
//   map.svg         the map, every part addressable by id/class for the web game
//   scenario.json   the scenario as data for the game
// and refresh the generated parts of SCENARIO.md. The folder is docs unless another is given; the rules are
// always docs/RULES.md.
//
//   node tools/map.js [folder]              check the data, rebuild map.svg and scenario.json, refresh SCENARIO.md
//   node tools/map.js [folder] mountains    the same, but first move any mountain that touches something
//
// Node built-ins only. Pixel grids are typed arrays indexed y * W + x.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(import.meta.dirname);
function die(msg) { process.stderr.write(msg.endsWith("\n") ? msg : msg + "\n"); process.exit(1); }
function warn(msg) { process.stderr.write(msg + "\n"); }
const abs = (p) => (p.startsWith("/") ? p : path.join(ROOT, p));
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const num = (a, b) => a - b;
// "a-b" route keys, by first then second settlement
const byKey = (x, y) => { const a = x.split("-").map(Number), b = y.split("-").map(Number); return a[0] - b[0] || a[1] - b[1]; };

let MODE = "draw";
let DIR = "docs";
for (const a of process.argv.slice(2)) {
    if (/^(draw|mountains)$/.test(a)) MODE = a;
    else if (isDir(abs(a))) DIR = a.replace(/\/+$/, "");
    else die("usage: node tools/map.js [folder] [mountains]");
}
const [DOC, BASE, SVG, JSONF] = ["SCENARIO.md", "map-base.svg", "map.svg", "scenario.json"].map((f) => abs(DIR) + "/" + f);

// ---------- look (sizes in map units = pixels at 100%) ----------
const STYLE = `.sea{fill:#99d9ea}
.landmass{fill:#fff}
.land{fill:#fff}
.coast{fill:none;stroke:#000;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.frame{fill:none;stroke:#7f7f7f;stroke-width:4}
.edge{fill:none;stroke-linejoin:round;stroke-linecap:round}
.border{stroke:#7f7f7f;stroke-width:2.5}
.province{stroke:none}
.river{fill:none;stroke:#00a2e8;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.route{fill:none;stroke:#bebebe;stroke-width:1.4}
.strait{stroke-dasharray:3.5 3.5}
.mtn-lit{fill:#c4aa88}
.mtn-shade{fill:#967656}
.mtn-snow{fill:#fcfcfc}
.mtn-snow-shade{fill:#d6dce4}
.mtn-outline{fill:none;stroke:#5f4128;stroke-width:1.4;stroke-linejoin:round}
.pass{fill:#ffe600;stroke:#282828;stroke-width:1.5;stroke-linejoin:round}
.marker{fill:#c9161f}
.number{fill:#fff;font-size:10px;font-weight:bold;text-anchor:middle}
.label{fill:#464646;font-size:15px;text-anchor:middle}
.label.small{font-size:10px}
.sea-divider{fill:none;stroke:#3d7f9c;stroke-width:1.5;stroke-dasharray:6 4}
.sea-label{fill:#3d7f9c;font-size:11px;font-style:italic;text-anchor:middle}
`;
const [PASS_SIDE, TOWN_R, CITY_SIDE] = [20, 9, 22];
const [MTN_W, MTN_H] = [30, 26];
const [MTN_GAP, MTN_REACH] = [5, 40];     // clear space around a mountain; how far `mountains` may move one
const RIVER_NEAR = 24;                    // a settlement this close to a river is "on a river" (RULES.md §2)
const CHAR_W = 0.72;                      // rough width of a capital letter, in em, for placing labels
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];

// =====================================================================================
// SCENARIO.md
// =====================================================================================
const doc = fs.readFileSync(DOC, "utf8").split("\n");
if (doc.length && doc[doc.length - 1] === "") doc.pop();
const ERR = [];
const err = (msg) => ERR.push(msg);
function check(what) { if (ERR.length) die(`${what} has errors:\n` + ERR.map((e) => `  ${e}\n`).join("")); }

function section(t) {
    const s = doc.findIndex((l) => l.startsWith("## " + t) && /^\s*$/.test(l.slice(3 + t.length)));
    if (s < 0) die(`SCENARIO.md: no '## ${t}' section`);
    let e = s + 1;
    while (e < doc.length && !/^#{1,2} /.test(doc[e])) e++;
    return [s, e - 1];
}
function cells(l) {
    l = l.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
    return l.split("|").map((c) => c.replace(/\*\*/g, "").replace(/^\s+|\s+$/g, ""));
}
// table(section) -> [header, rows as objects, first line, last line]
function table(name) {
    const [s, e] = section(name);
    let i = s;
    while (i <= e && !doc[i].startsWith("|")) i++;
    if (i > e) die(`SCENARIO.md: no table under '${doc[s]}'`);
    const h = cells(doc[i]);
    let j = i + 2;
    const rows = [];
    while (j < doc.length && doc[j].startsWith("|")) {
        const c = cells(doc[j]);
        const r = {};
        h.forEach((k, n) => { r[k] = c[n] ?? ""; });
        r._line = j + 1;
        rows.push(r);
        j++;
    }
    return [h, rows, i, j - 1];
}
const ids = (s) => (s ?? "").split(/\s*,\s*/).filter((x) => /\S/.test(x));
const whole = (x, y) => /^\d+ \d+$/.test(`${x} ${y}`);

const CN = new Map(), CAP = new Map(), CORDER = [];   // country code -> name, capital settlement id; codes in table order
const COLOUR = new Map();                             // country code -> colour from the optional Colour column
let HAS_COLOUR = false;
{
    const [h, rows] = table("Countries");
    HAS_COLOUR = h.includes("Colour");
    for (const r of rows) {
        const c = r.Code;
        if (CN.has(c)) err(`Countries line ${r._line}: duplicate code ${c}`);
        if (!/^[A-Z]+$/.test(c)) err(`Countries line ${r._line}: code '${c}' must be capital letters`);
        CN.set(c, r.Country);
        CORDER.push(c);
        const m = /^(\d+)\b/.exec(r.Capital);
        if (m) CAP.set(c, Number(m[1]));
        else err(`country ${c}: Capital must be a settlement ID`);
        if (r.Colour) {
            if (/^#[0-9a-fA-F]{6}$/.test(r.Colour)) COLOUR.set(c, r.Colour.toLowerCase());
            else err(`country ${c}: Colour must be like #3a7bd5`);
        }
    }
}

const S = new Map();                                  // id -> { name country city port hre x y nb[] st[] }
{
    const [, rows] = table("Settlements");
    for (const r of rows) {
        const l = r._line;
        if (!/^\d+$/.test(r.ID)) { err(`Settlements line ${l}: bad ID '${r.ID}'`); continue; }
        const id = Number(r.ID);
        if (S.has(id)) err(`Settlements line ${l}: duplicate ID ${id}`);
        if (!CN.has(r.Country)) err(`settlement ${id}: unknown country '${r.Country}'`);
        if (!/^(town|city)$/.test(r.Type)) err(`settlement ${id}: Type must be town or city`);
        if (!/^(port|)$/.test(r.Port)) err(`settlement ${id}: Port must be 'port' or empty`);
        if (!/^(HRE|)$/.test(r.HRE)) err(`settlement ${id}: HRE must be 'HRE' or empty`);
        if (!whole(r.X, r.Y)) err(`settlement ${id}: X and Y must be whole numbers`);
        S.set(id, { name: r.Name, country: r.Country, city: r.Type === "city", port: r.Port === "port", hre: r.HRE === "HRE",
            x: Number(r.X), y: Number(r.Y), nb: ids(r.Borders), st: ids(r.Straits) });
    }
}
const SIDS = [...S.keys()].sort(num);
const ekey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const LAND = new Set(), STRAIT = new Set();           // "a-b" with a < b
for (const a of SIDS) {
    for (const [k, set, col] of [["nb", LAND, "Borders"], ["st", STRAIT, "Straits"]]) {
        for (const bs of S.get(a)[k]) {
            const b = Number(bs);
            if (!/^\d+$/.test(bs) || !S.has(b)) { err(`settlement ${a} ${col}: unknown settlement '${bs}'`); continue; }
            if (!S.get(b)[k].some((x) => Number(x) === a)) err(`settlement ${a} ${col} lists ${b}, but ${b} does not list ${a}`);
            set.add(ekey(a, b));
        }
    }
}
for (const c of CORDER) if (![...S.values()].some((s) => s.country === c)) err(`country ${c} has no settlements`);
// the capital is one of the country's own settlements, and a city if it owns one (RULES.md §2)
for (const c of CORDER.filter((c) => CAP.has(c))) {
    const s = S.get(CAP.get(c));
    if (!s) { err(`country ${c}: capital ${CAP.get(c)} is not a settlement`); continue; }
    if (s.country !== c) { err(`country ${c}: capital ${CAP.get(c)} ${s.name} belongs to ${s.country}`); continue; }
    if (!s.city && [...S.values()].some((o) => o.country === c && o.city)) err(`country ${c}: capital ${CAP.get(c)} ${s.name} is a town, but the country owns a city`);
}

const PASSES = [];
{
    const [, rows] = table("Mountain passes");
    for (const r of rows) {
        const routes = ids(r.Routes).map((s) => { const [a, b] = s.split("-").sort(num); return `${a}-${b}`; });
        if (!whole(r.X, r.Y)) err(`pass ${r.Pass}: X and Y must be whole numbers`);
        for (const e of routes) if (!LAND.has(e)) err(`pass ${r.Pass}: route ${e} is not in Borders`);
        PASSES.push({ id: r.Pass, x: Number(r.X), y: Number(r.Y), routes });
    }
}
const VIA = new Map();
for (const p of PASSES) for (const e of p.routes) { if (VIA.has(e)) err(`route ${e} goes through two passes`); VIA.set(e, p); }
const BEND = new Map();                               // route -> points it is bent through, from the lower-numbered end
{
    const [, rows] = table("Route bends");
    for (const r of rows) {
        const [a, b] = r.Route.split("-").sort(num);
        const e = `${a}-${b}`, l = r._line;
        if (!LAND.has(e)) { err(`Route bends line ${l}: route ${r.Route} is not in Borders`); continue; }
        if (VIA.has(e)) { err(`Route bends line ${l}: route ${e} goes through a pass`); continue; }
        if (BEND.has(e)) { err(`Route bends line ${l}: route ${e} is listed twice`); continue; }
        const p = r.Through.trim().split(/\s+/).filter(Boolean).map((t) => t.split(","));
        if (!p.length || p.some((q) => !/^\d+ \d+$/.test(q.join(" ")))) { err(`Route bends line ${l}: Through must be x,y points in whole map units`); continue; }
        BEND.set(e, p.map((q) => q.map(Number)));
    }
}

const PEAKS = [];                                     // the ``` block under ## Mountains
{
    const [s, e] = section("Mountains");
    const f = [];
    for (let i = s; i <= e; i++) if (/^```/.test(doc[i])) f.push(i);
    if (f.length < 2) die("SCENARIO.md: no ``` block under ## Mountains");
    for (let i = f[0] + 1; i < f[1]; i++) for (const m of doc[i].matchAll(/(\d+),(\d+)/g)) PEAKS.push([Number(m[1]), Number(m[2])]);
}
const firstMatch = (re) => { for (const l of doc) { const m = re.exec(l); if (m) return m[1]; } return undefined; };
const SPEED = firstMatch(/^\*\*Army speed:\*\*\s*(\d+(?:\.\d+)?)/);   // army speed, map units per year
const XS = firstMatch(/^\*\*x = (\d+(?:\.\d+)?)\*\*/);                 // scenario scaling x (RULES.md, top)
if (!XS) err("SCENARIO.md: no '**x = N**' line");
const STRAITN = Math.ceil(Number((10 * Number(XS ?? 1)).toFixed(6))); // ships needed to cross a strait: at least 10 × x (RULES.md §8), so rounded up
if (!SPEED) err("SCENARIO.md: no '**Army speed:** N map units per year' line");
const SPEEDN = Number(SPEED);
const DELAY = {};                                     // months from RULES.md §8: crossing a river, each leg to or from a pass, a fleet's hop between zones
for (const l of fs.readFileSync(path.join(ROOT, "docs/RULES.md"), "utf8").split("\n")) {
    let m;
    if ((m = /^\| River crossing \| \+(\d+) months? \|/.exec(l))) DELAY.river = Number(m[1]);
    if ((m = /^\| Leg to or from a mountain pass \| \+(\d+) months? \|/.exec(l))) DELAY.pass = Number(m[1]);
    if ((m = /^\| Fleet, to a neighbouring sea zone \| (\d+) months? \|/.exec(l))) DELAY.fleet = Number(m[1]);
}
if (DELAY.river === undefined) err("RULES.md: no '| River crossing | +N months |' row in the movement table");
if (DELAY.pass === undefined) err("RULES.md: no '| Leg to or from a mountain pass | +N months |' row in the movement table");
if (DELAY.fleet === undefined) err("RULES.md: no '| Fleet, to a neighbouring sea zone | N months |' row in the movement table");

const ZONES = [];                                     // sea zones: name, and a point inside it (where the name is drawn)
{
    const [, rows] = table("Sea zones");
    const seen = new Set();
    for (const r of rows) {
        if (!whole(r.X, r.Y)) err(`Sea zones line ${r._line}: X and Y must be whole numbers`);
        if (seen.has(r.Zone)) err(`Sea zones line ${r._line}: duplicate zone ${r.Zone}`);
        seen.add(r.Zone);
        ZONES.push({ name: r.Zone, id: r.Zone.toLowerCase().replace(/[^a-z0-9]+/g, "-"), x: Number(r.X), y: Number(r.Y), next: new Set() });
    }
}
check("SCENARIO.md");

// =====================================================================================
// map-base.svg: one shape per settlement's land, and the rivers
// =====================================================================================
const base = fs.readFileSync(BASE, "utf8").replace(/<!--[\s\S]*?-->/g, "");
const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(base);
if (!vb) die("map-base.svg: no viewBox");
const W = Number(vb[1]), H = Number(vb[2]);
if (!Number.isInteger(W) || !Number.isInteger(H)) die("map-base.svg: the viewBox width and height must be whole numbers");
if (/transform=/.test(base)) die("map-base.svg: transforms are not supported (in Inkscape: Edit > Preferences > Behavior > Transforms > Store transformation: optimized, then nudge the item)");
// path data -> [rings, the last open run] (straight segments only)
function parseD(d, what) {
    if (/[CcSsQqTtAa]/.test(d)) die(`map-base.svg: ${what} uses curves; only straight segments are allowed`);
    const tok = [...d.matchAll(/([MmLlHhVvZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g)].map((m) => m[1] ?? m[2]);
    const rings = [];
    let cur = [], cx, cy, sx, sy, cmd;
    const close = () => { if (cur.length >= 3) rings.push(cur); cur = []; };
    let i = 0;
    while (i < tok.length) {
        if (/^[A-Za-z]$/.test(tok[i])) {
            cmd = tok[i++];
            if (/[Zz]/.test(cmd)) { close(); cx = sx; cy = sy; continue; }
        }
        if (cmd === undefined) die(`map-base.svg: ${what}: bad path data`);
        if (/[MmLl]/.test(cmd)) {
            let x = Number(tok[i]), y = Number(tok[i + 1]);
            i += 2;
            if (/[ml]/.test(cmd) && cx !== undefined) { x += cx; y += cy; }
            if (/[Mm]/.test(cmd)) { close(); sx = x; sy = y; cmd = cmd === "m" ? "l" : "L"; }
            cx = x; cy = y;
            cur.push([x, y]);
        } else if (cmd === "H") { cx = Number(tok[i++]); cur.push([cx, cy]); }
        else if (cmd === "h") { cx += Number(tok[i++]); cur.push([cx, cy]); }
        else if (cmd === "V") { cy = Number(tok[i++]); cur.push([cx, cy]); }
        else if (cmd === "v") { cy += Number(tok[i++]); cur.push([cx, cy]); }
        else die(`map-base.svg: ${what}: bad path data`);
    }
    const open = cur;
    close();
    return [rings, open];
}
const rnd = (v) => Number(v.toFixed(2));
const attr = (a, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(a)?.[1];
const LANDS = new Map(), RIVERS = [], DIVIDERS = [];
for (const m of base.matchAll(/<path\b([^>]*)>/g)) {
    const id = attr(m[1], "id"), d = attr(m[1], "d");
    if (d === undefined) continue;
    const lm = id !== undefined && /^land-(\d+)$/.exec(id);
    if (lm) {
        const [r] = parseD(d, id);
        LANDS.set(Number(lm[1]), r.map((ring) => ring.map((p) => [rnd(p[0]), rnd(p[1])])));
        if (!r.length) err(`map-base.svg: ${id} has no closed shape`);
    }
}
// rivers: the paths in the group with id "rivers"; sea zone dividers: the paths in the group with id "sea-zones"
for (const [gid, list, what] of [["rivers", RIVERS, "a river"], ["sea-zones", DIVIDERS, "a sea zone divider"]]) {
    const g = new RegExp(`<g\\b[^>]*\\bid="${gid}"[^>]*>([\\s\\S]*?)</g>`).exec(base)?.[1] ?? "";
    for (const m of g.matchAll(/<path\b([^>]*)>/g)) {
        const d = attr(m[1], "d");
        if (d === undefined) continue;
        const [, open] = parseD(d, what);
        if (open.length >= 2) list.push(open);
    }
}
for (const id of SIDS) if (!LANDS.has(id)) err(`map-base.svg: no land-${id} for settlement ${id}`);
const LIDS = [...LANDS.keys()].sort(num);
for (const id of LIDS) if (!S.has(id)) err(`map-base.svg: land-${id} has no settlement in SCENARIO.md`);
check("map-base.svg");
const LC = [];                                        // land id -> country
for (const [id, s] of S) LC[id] = s.country;

function inside(x, y, rings) {
    let inn = false;
    for (const r of rings) {
        for (let i = 0; i < r.length; i++) {
            const a = r[i], b = r[(i - 1 + r.length) % r.length];
            if ((a[1] > y) !== (b[1] > y) && x < a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])) inn = !inn;
        }
    }
    return inn;
}
function landAt(x, y) { for (const id of LIDS) if (inside(x, y, LANDS.get(id))) return id; return 0; }
for (const id of SIDS) { const s = S.get(id); if (!inside(s.x, s.y, LANDS.get(id))) err(`settlement ${id} (${s.x},${s.y}) is not inside land-${id}`); }
for (const p of PASSES) { p.owner = landAt(p.x, p.y); if (!p.owner) err(`pass ${p.id} (${p.x},${p.y}) is not on land`); }

// edges: every side of every land is shared with exactly one neighbour, or is coast, or lies on the frame
const SEG = new Map(), PK = new Map();
const pk = (p) => `${p[0]},${p[1]}`;
for (const id of LIDS) {
    for (const r of LANDS.get(id)) {
        for (let i = 0; i < r.length; i++) {
            const a = r[i], b = r[(i + 1) % r.length];
            if (pk(a) === pk(b)) continue;
            const k = pk(a) < pk(b) ? pk(a) + "|" + pk(b) : pk(b) + "|" + pk(a);
            PK.set(pk(a), a); PK.set(pk(b), b);
            if (!SEG.has(k)) SEG.set(k, []);
            SEG.get(k).push(id);
        }
    }
}
const PAIR = new Map(), COAST = [], FRAME = [];       // "a-b" -> segments; segment = [p, q]
for (const k of [...SEG.keys()].sort()) {
    const own = SEG.get(k);
    const [p, q] = k.split("|").map((s) => PK.get(s));
    if (own.length > 2) { err(`edge ${k} is shared by more than two lands (${own.map((x) => "land-" + x).join(", ")})`); continue; }
    if (own.length === 2) {
        const [a, b] = [...own].sort(num);
        if (a === b) err(`land-${a} overlaps itself at ${k}`);
        if (!PAIR.has(`${a}-${b}`)) PAIR.set(`${a}-${b}`, []);
        PAIR.get(`${a}-${b}`).push([p, q]);
        continue;
    }
    if ((p[0] === 0 && q[0] === 0) || (p[0] === W && q[0] === W) || (p[1] === 0 && q[1] === 0) || (p[1] === H && q[1] === H)) { FRAME.push([p, q]); continue; }
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    let nx = q[1] - p[1], ny = p[0] - q[0];
    const nl = Math.sqrt(nx * nx + ny * ny) || 1;
    nx = nx / nl * 0.75; ny = ny / nl * 0.75;
    if (landAt(mx + nx, my + ny) && landAt(mx - nx, my - ny)) { err(`land-${own[0]}: its edge near ${mx.toFixed(0)},${my.toFixed(0)} does not match its neighbour's points exactly`); continue; }
    COAST.push([p, q]);
}
check("map-base.svg");
// a river that reaches the sea must end exactly on the coastline
for (const r of RIVERS) {
    for (const p of [r[0], r[r.length - 1]]) {
        const d = Math.min(...COAST.map((s) => segDist(p[0], p[1], s[0], s[1])));
        if (d > 0.3 && d < 12) warn(`map-base.svg: a river ends ${d.toFixed(1)} from the coast near ${p[0].toFixed(0)},${p[1].toFixed(0)} -- move its end onto the coastline`);
    }
}
// a sea zone divider must run from coast (or the map edge) to coast
for (const r of DIVIDERS) {
    for (const p of [r[0], r[r.length - 1]]) {
        const d = Math.min(...COAST.map((s) => segDist(p[0], p[1], s[0], s[1])));
        const edge = Math.min(p[0], p[1], W - p[0], H - p[1]);
        if (d > 0.5 && edge > 0.5) warn(`map-base.svg: a sea zone divider ends ${d.toFixed(1)} from the coast near ${p[0].toFixed(0)},${p[1].toFixed(0)} -- move its end onto the coastline`);
    }
}
// join segments into as few polylines as possible
function chains(segs) {
    const adj = new Map();
    segs.forEach((s, i) => { for (const p of [s[0], s[1]]) { const k = pk(p); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
    const used = new Set(), out = [];
    const walk = (start, i) => {
        const pts = [PK.get(start)];
        let cur = start;
        while (i !== undefined && !used.has(i)) {
            used.add(i);
            const [a, b] = segs[i].map(pk);
            cur = a === cur ? b : a;
            pts.push(PK.get(cur));
            i = adj.get(cur).find((j) => !used.has(j));
            if (adj.get(cur).length !== 2) break;
        }
        out.push(pts);
    };
    for (const v of [...adj.keys()].filter((k) => adj.get(k).length !== 2).sort()) for (const i of adj.get(v)) if (!used.has(i)) walk(v, i);
    segs.forEach((s, i) => { if (!used.has(i)) walk(pk(s[0]), i); });
    return out;
}

// =====================================================================================
// layout on a pixel grid: which land each pixel is in, what is already drawn there
// =====================================================================================
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const REG = new Int32Array(W * H);
const OVER = new Map();
for (const id of LIDS) {
    const e = [];
    for (const r of LANDS.get(id)) for (let i = 0; i < r.length; i++) e.push([r[i], r[(i - 1 + r.length) % r.length]]);
    let y0 = 1e9, y1 = -1;
    for (const s of e) for (const p of s) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const yEnd = y1 >= H ? H - 1 : Math.trunc(y1);
    for (let y = y0 < 0 ? 0 : Math.trunc(y0); y <= yEnd; y++) {
        const py = y + 0.5;
        const xs = [];
        for (const [a, b] of e) if ((a[1] > py) !== (b[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        xs.sort(num);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            const xEnd = Math.trunc(xs[k + 1] + 0.5) - 1;
            for (let x = Math.trunc(xs[k] + 0.5); x <= xEnd; x++) {
                if (x < 0 || x >= W) continue;
                const i = y * W + x, o = REG[i];
                if (o) { const key = o < id ? `${o}-${id}` : `${id}-${o}`; OVER.set(key, (OVER.get(key) || 0) + 1); }
                REG[i] = id;
            }
        }
    }
}
for (const k of [...OVER.keys()].sort()) { const [a, b] = k.split("-"); if (OVER.get(k) > 3) err(`land-${a} and land-${b} overlap (${OVER.get(k)} px)`); }
{ // anything that is not land must be sea: a small patch of it is a gap between lands
    const seen = new Uint8Array(W * H);
    const gaps = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i0 = y * W + x;
            if (REG[i0] || seen[i0]) continue;
            const st = [i0];
            seen[i0] = 1;
            let n = 0;
            while (st.length) {
                const p = st.pop();
                n++;
                const px = p % W, py = (p - px) / W;
                for (const [dx, dy] of N4) {
                    const u = px + dx, v = py + dy;
                    if (!inb(u, v)) continue;
                    const j = v * W + u;
                    if (REG[j] || seen[j]) continue;
                    seen[j] = 1;
                    st.push(j);
                }
            }
            if (n < 2000) gaps.push(`${x},${y}`);
        }
    }
    if (gaps.length) err(`${gaps.length} gap(s) between lands, first near ${gaps.slice(0, 3).join(" ")}: neighbouring lands must share exactly the same points`);
}
check("map-base.svg");

// sea zones: the sea split by the dividers, each stretch named by the label point inside it
const ZG = new Int32Array(W * H);                     // pixel -> stretch of sea (1, 2, ...)
const ZOFC = new Map();                               // stretch -> zone
{
    const bar = new Set();
    for (const r of DIVIDERS) {
        for (let i = 1; i < r.length; i++) {
            const a = r[i - 1], b = r[i];
            const L = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
            for (let k = 0; k <= Math.trunc(L * 2); k++) {
                const t = L ? k / (L * 2) : 0;
                const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) bar.add(`${Math.trunc(x + dx * 0.75)},${Math.trunc(y + dy * 0.75)}`);
            }
        }
    }
    const barGrid = new Uint8Array(W * H);
    for (const k of bar) { const [x, y] = k.split(",").map(Number); if (inb(x, y)) barGrid[y * W + x] = 1; }
    let n = 0;
    const size = [], first = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i0 = y * W + x;
            if (REG[i0] || ZG[i0] || barGrid[i0]) continue;
            n++;
            const st = [i0];
            ZG[i0] = n; first[n] = `${x},${y}`; size[n] = 0;
            while (st.length) {
                const p = st.pop();
                size[n]++;
                const px = p % W, py = (p - px) / W;
                for (const [dx, dy] of N4) {
                    const u = px + dx, v = py + dy;
                    if (!inb(u, v)) continue;
                    const j = v * W + u;
                    if (REG[j] || ZG[j] || barGrid[j]) continue;
                    ZG[j] = n;
                    st.push(j);
                }
            }
        }
    }
    // divider pixels join a neighbouring stretch
    let q = [...bar].sort().map((k) => k.split(",").map(Number)).filter(([x, y]) => inb(x, y) && !REG[y * W + x]);
    while (q.length) {
        const rest = [];
        for (const p of q) {
            let z = 0;
            for (const [dx, dy] of N4) { const u = p[0] + dx, v = p[1] + dy; const zz = inb(u, v) ? ZG[v * W + u] : 0; if (zz) { z = zz; break; } }
            if (z) ZG[p[1] * W + p[0]] = z;
            else rest.push(p);
        }
        if (rest.length === q.length) break;
        q = rest;
    }
    for (const z of ZONES) {
        const c = inb(z.x, z.y) ? ZG[z.y * W + z.x] : 0;
        if (!c) { err(`sea zone ${z.name}: ${z.x},${z.y} is not in the sea`); continue; }
        if (ZOFC.has(c)) { err(`sea zones ${ZOFC.get(c).name} and ${z.name} are one stretch of sea: a divider is missing or does not reach the coast`); continue; }
        ZOFC.set(c, z);
    }
    for (let c = 1; c <= n; c++) if (!ZOFC.has(c) && size[c] > 2000) err(`the stretch of sea around ${first[c]} has no name in the Sea zones table`);
}
function zoneAt(x, y) {
    x = Math.trunc(x); y = Math.trunc(y);
    return inb(x, y) && ZG[y * W + x] ? ZOFC.get(ZG[y * W + x]) : undefined;
}
for (const id of SIDS) {                              // a port faces the nearest sea
    const s = S.get(id);
    if (!s.port) continue;
    let z, bd;
    for (let dy = -40; dy <= 40; dy++) {
        for (let dx = -40; dx <= 40; dx++) {
            const zz = zoneAt(s.x + dx, s.y + dy);
            if (!zz) continue;
            const d = dx * dx + dy * dy;
            if (bd === undefined || d < bd) { z = zz; bd = d; }
        }
    }
    if (z) s.zone = z;
    else err(`port ${id} ${s.name} has no sea within 40 of it`);
}
const SZ = new Map();                                 // strait -> zone it lies in
for (const e of [...STRAIT].sort()) {
    const [p, q] = e.split("-").map((x) => S.get(Number(x)));
    const L = Math.sqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
    const cnt = new Map();
    for (let i = 12; i <= Math.trunc(L) - 12; i++) {
        const z = zoneAt(p.x + (q.x - p.x) * i / L, p.y + (q.y - p.y) * i / L);
        if (z) cnt.set(z.name, (cnt.get(z.name) || 0) + 1);
    }
    const zs = [...cnt.keys()].sort((a, b) => cnt.get(b) - cnt.get(a) || (a < b ? -1 : a > b ? 1 : 0));
    if (!zs.length) { err(`strait ${e} does not cross the sea`); continue; }
    if (zs.length > 1) warn(`strait ${e} crosses several sea zones (${zs.join(", ")}); it counts as ${zs[0]}`);
    SZ.set(e, ZONES.find((z) => z.name === zs[0]));
}
for (const r of DIVIDERS) {                           // zones either side of a divider
    for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        let nx = b[1] - a[1], ny = a[0] - b[0];
        const nl = Math.sqrt(nx * nx + ny * ny) || 1;
        nx = nx / nl * 4; ny = ny / nl * 4;
        const p = zoneAt(mx + nx, my + ny), q = zoneAt(mx - nx, my - ny);
        if (!(p && q && p !== q)) continue;
        p.next.add(q.name); q.next.add(p.name);
    }
}
check("map-base.svg");
const seaLabelBox = (z) => { const w = z.name.length * 6.2; return [z.x - w / 2, z.y - 9, z.x + w / 2, z.y + 2]; };
const OCC = new Uint8Array(W * H);
function occSeg(x1, y1, x2, y2, hw) {
    const dx = x2 - x1, dy = y2 - y1;
    const L2 = dx * dx + dy * dy;
    const yEnd = Math.trunc((y1 > y2 ? y1 : y2) + hw) + 1, xEnd = Math.trunc((x1 > x2 ? x1 : x2) + hw) + 1;
    for (let y = Math.trunc((y1 < y2 ? y1 : y2) - hw) - 1; y <= yEnd; y++) {
        for (let x = Math.trunc((x1 < x2 ? x1 : x2) - hw) - 1; x <= xEnd; x++) {
            if (!inb(x, y)) continue;
            const px = x + 0.5, py = y + 0.5;
            let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            if ((px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2 <= (hw + 0.5) ** 2) OCC[y * W + x] = 1;
        }
    }
}
const occLine = (pts, hw) => { for (let i = 1; i < pts.length; i++) occSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], hw); };
function occBox(x0, y0, x1, y1) {
    for (let y = Math.trunc(y0); y <= Math.trunc(y1); y++) for (let x = Math.trunc(x0); x <= Math.trunc(x1); x++) if (inb(x, y)) OCC[y * W + x] = 1;
}

// routes as polylines: settlement -> [pass ->] settlement. A land route may only cross land of the countries it
// joins (and of its pass). One whose straight line leaves that land - out to sea or through a third country - is
// bent: the shortest way over the allowed land, kept off the shore and other countries, pulled as straight as it allows.
const SEAD = new Uint8Array(W * H).fill(99);          // distance to the sea, up to 12
{
    let q = [];
    for (let i = 0; i < W * H; i++) if (!REG[i]) { SEAD[i] = 0; q.push(i); }
    for (let d = 1; d <= 12; d++) {
        const nq = [];
        for (const c of q) {
            const cx = c % W, cy = (c - cx) / W;
            for (const [dx, dy] of N4) {
                const u = cx + dx, v = cy + dy;
                if (!inb(u, v)) continue;
                const j = v * W + u;
                if (SEAD[j] <= d) continue;
                SEAD[j] = d;
                nq.push(j);
            }
        }
        q = nq;
    }
}
const [ROUTE_SHORE, ROUTE_MARGIN] = [8, 6];           // a bent route keeps this far from the sea / from other countries where it can
const NEARC = new Array(W * H);                       // pixels within ROUTE_MARGIN of another country: every country that close
{
    let q = [];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const id = REG[y * W + x];
            if (!id) continue;
            if (N4.some(([dx, dy]) => { const u = x + dx, v = y + dy; return inb(u, v) && REG[v * W + u] && LC[REG[v * W + u]] !== LC[id]; })) q.push(y * W + x);
        }
    }
    const near = new Uint8Array(W * H);
    for (const i of q) near[i] = 1;
    for (let k = 1; k <= ROUTE_MARGIN; k++) {
        const nq = [];
        for (const c of q) {
            const cx = c % W, cy = (c - cx) / W;
            for (const [dx, dy] of N4) {
                const u = cx + dx, v = cy + dy;
                if (!inb(u, v)) continue;
                const j = v * W + u;
                if (near[j]) continue;
                near[j] = 1;
                nq.push(j);
            }
        }
        q = nq;
    }
    const disc = [];
    for (let dy = -ROUTE_MARGIN; dy <= ROUTE_MARGIN; dy++) for (let dx = -ROUTE_MARGIN; dx <= ROUTE_MARGIN; dx++) if (dx ** 2 + dy ** 2 <= ROUTE_MARGIN ** 2) disc.push([dx, dy]);
    for (let i = 0; i < W * H; i++) {
        if (!near[i]) continue;
        const x = i % W, y = (i - x) / W;
        const cs = new Set();
        for (const [dx, dy] of disc) { const u = x + dx, v = y + dy; if (inb(u, v) && REG[v * W + u]) cs.add(LC[REG[v * W + u]]); }
        if (cs.size > 1) NEARC[i] = [...cs];
    }
}
// may a route pass this pixel? land at least `clear` from the sea, in an allowed country, and (with margin) not near any other country
function pixOk(x, y, clear, allow, margin) {
    if (!inb(x, y)) return false;
    const i = y * W + x;
    if (SEAD[i] < clear || !allow.has(LC[REG[i]])) return false;
    if (margin && NEARC[i] && NEARC[i].some((c) => !allow.has(c))) return false;
    return true;
}
// does the straight leg a-b only pass such pixels? the part under a marker at either end does not count
function legOk(a, b, clear, margin, allow, skipa, skipb) {
    const L = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    for (let i = 0; i <= Math.trunc(L); i++) {
        if ((skipa && i < 12) || (skipb && L - i < 12)) continue;
        const t = L ? i / L : 0;
        if (!pixOk(Math.trunc(a[0] + (b[0] - a[0]) * t), Math.trunc(a[1] + (b[1] - a[1]) * t), clear, allow, margin)) return false;
    }
    return true;
}
function landPath(a, b, allow, margin) {
    const [sx, sy, tx, ty] = [a[0], a[1], b[0], b[1]].map(Math.trunc);
    const x0 = Math.min(sx, tx) - 200, x1 = Math.max(sx, tx) + 200, y0 = Math.min(sy, ty) - 200, y1 = Math.max(sy, ty) + 200;
    const start = sy * W + sx, target = ty * W + tx;
    const cost = new Map([[start, 0]]), par = new Map(), bucket = [[start]];
    let found = false;
    B: for (let c = 0; c < bucket.length; c++) {
        if (!bucket[c]) continue;
        for (const k of bucket[c]) {
            if (cost.get(k) < c) continue;
            if (k === target) { found = true; break B; }
            const x = k % W, y = (k - x) / W;
            for (const [dx, dy, step] of N8) {
                const u = x + dx, v = y + dy;
                if (u < x0 || u > x1 || v < y0 || v > y1 || !inb(u, v)) continue;
                const under = (u - sx) ** 2 + (v - sy) ** 2 < 144 || (u - tx) ** 2 + (v - ty) ** 2 < 144;
                if (!under && !pixOk(u, v, 1, allow, margin)) continue;
                const sd = SEAD[v * W + u];
                const nc = c + step + (under || sd >= 11 ? 0 : (11 - sd) * 6);
                const kk = v * W + u;
                if (cost.has(kk) && cost.get(kk) <= nc) continue;
                cost.set(kk, nc);
                par.set(kk, k);
                (bucket[nc] ||= []).push(kk);
            }
        }
    }
    if (!found) return undefined;
    const p = [];
    for (let k = target; k !== undefined; k = par.get(k)) { const x = k % W; p.unshift([x + 0.5, (k - x) / W + 0.5]); }
    p[0] = [...a];
    p[p.length - 1] = [...b];
    const out = [p[0]];
    let i = 0;
    while (i < p.length - 1) {
        let j = p.length - 1;
        while (j > i + 1 && !legOk(p[i], p[j], ROUTE_SHORE, margin, allow, i === 0, j === p.length - 1)) j--;
        out.push(p[j]);
        i = j;
    }
    for (let k = 1; k < out.length - 1; k++) {                       // merge corners closer than 8
        if ((out[k][0] - out[k - 1][0]) ** 2 + (out[k][1] - out[k - 1][1]) ** 2 >= 64) continue;
        out.splice(k, 1);
        k--;
    }
    return out;
}
const RPATH = new Map();
const BENT = { sea: new Set(), country: new Set(), tight: new Set() };
const ANY = new Set(CORDER);
for (const e of [...LAND].sort()) {
    const [a, b] = e.split("-").map(Number);
    const via = VIA.get(e), sa = S.get(a), sb = S.get(b);
    const stops = [[sa.x, sa.y], ...(via ? [[via.x, via.y]] : []), ...(BEND.get(e) ?? []), [sb.x, sb.y]];
    const allow = new Set([sa.country, sb.country, ...(via ? [LC[via.owner]] : [])]);
    const allowed = [...allow].sort().join("/");
    for (const bp of BEND.get(e) ?? []) { const id = landAt(bp[0], bp[1]); if (!(id && allow.has(LC[id]))) err(`route ${e}: bend point ${bp[0]},${bp[1]} is not on land of ${allowed}`); }
    const pts = [stops[0]];
    for (let i = 1; i < stops.length; i++) {
        const p = stops[i - 1], q = stops[i];
        if (legOk(p, q, 1, 0, allow, true, true)) { pts.push(q); continue; }
        const why = legOk(p, q, 1, 0, ANY, true, true) ? "country" : "sea";
        let bent = landPath(p, q, allow, ROUTE_MARGIN);
        if (!bent && (bent = landPath(p, q, allow, 0))) BENT.tight.add(e);
        if (!bent) { warn(`route ${e}: no way over land of ${allowed} only; drawn straight`); pts.push(q); continue; }
        pts.push(...bent.slice(1));
        BENT[why].add(e);
    }
    for (let i = 1; i < pts.length; i++) if (!legOk(pts[i - 1], pts[i], 1, 0, allow, true, true)) warn(`route ${e} still leaves its countries near ${pts[i].map(Math.trunc).join(",")}`);
    RPATH.set(e, pts);
}
check("SCENARIO.md");
for (const e of STRAIT) RPATH.set(e, e.split("-").map((id) => [S.get(Number(id)).x, S.get(Number(id)).y]));
// route segments: [x1, y1, x2, y2, key, strait]
const ROUTESEG = [];
for (const e of [...RPATH.keys()].sort()) { const p = RPATH.get(e); for (let i = 1; i < p.length; i++) ROUTESEG.push([p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], e, STRAIT.has(e)]); }
const plen = (p) => { let l = 0; for (let i = 1; i < p.length; i++) l += Math.sqrt((p[i][0] - p[i - 1][0]) ** 2 + (p[i][1] - p[i - 1][1]) ** 2); return l; };
const RLEN = new Map(), RLEGS = new Map(), RLEGPTS = new Map();   // route length on the map; for a route through a pass, each leg's length and points
for (const [e, p] of RPATH) {
    RLEN.set(e, plen(p));
    const v = VIA.get(e);
    if (!v) continue;
    let k;
    for (let i = 1; i <= p.length - 2; i++) if (p[i][0] === v.x && p[i][1] === v.y) { k = i; break; }
    if (!k) continue;
    const legs = [p.slice(0, k + 1), p.slice(k)];
    RLEGPTS.set(e, legs);
    RLEGS.set(e, legs.map(plen));
}

for (const c of chains(COAST)) occLine(c, 1.0);
for (const [k, segs] of PAIR) { const [a, b] = k.split("-").map(Number); if (LC[a] !== LC[b]) for (const c of chains(segs)) occLine(c, 1.25); }
for (const r of RIVERS) occLine(r, 1.25);
for (const s of ROUTESEG) occSeg(s[0], s[1], s[2], s[3], 1.0);
for (const r of DIVIDERS) occLine(r, 1.0);
for (const z of ZONES) occBox(...seaLabelBox(z));
for (const s of S.values()) occBox(s.x - 11, s.y - 11, s.x + 10, s.y + 10);
for (const p of PASSES) occBox(p.x - 11, p.y - 13, p.x + 11, p.y + 7);
occBox(0, 0, W - 1, 1); occBox(0, H - 2, W - 1, H - 1); occBox(0, 0, 1, H - 1); occBox(W - 2, 0, W - 1, H - 1);

// ---------- mountains: each needs clear space all round, inside its starting country ----------
const DIST = new Int32Array(W * H).fill(1e9);
let DQ = [];
function obstacle(x, y) { if (!inb(x, y)) return; const i = y * W + x; if (!DIST[i]) return; DIST[i] = 0; DQ.push(i); }
function spread() {
    while (DQ.length) {
        const nq = [];
        for (const c of DQ) {
            const d = DIST[c] + 1;
            if (d > 12) continue;
            const cx = c % W, cy = (c - cx) / W;
            for (const [dx, dy] of N4) {
                const u = cx + dx, v = cy + dy;
                if (!inb(u, v)) continue;
                const j = v * W + u;
                if (DIST[j] <= d) continue;
                DIST[j] = d;
                nq.push(j);
            }
        }
        DQ = nq;
    }
}
for (let i = 0; i < W * H; i++) if (OCC[i] || !REG[i]) { const x = i % W; obstacle(x, (i - x) / W); }
spread();
function mtnInside(ax, ay, x, y, grow) {
    const hw = MTN_W / 2, h = MTN_H;
    if (y > ay + h + grow || y < ay - grow * 2) return false;
    return Math.abs(x - ax) <= hw * (y - ay) / h + grow * (1 + hw / h);
}
const OUTLINE = [];                                   // sample points just outside the symbol, relative to the apex
{
    const hw = MTN_W / 2, h = MTN_H;
    const v = [[0, -1.5], [-hw - 1.5, h + 1.2], [hw + 1.5, h + 1.2]];
    for (let i = 0; i < 3; i++) {
        const a = v[i], b = v[(i + 1) % 3];
        const n = Math.trunc(Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2));
        for (let k = 0; k < n; k++) OUTLINE.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    OUTLINE.push([0, h * 0.66], [-hw / 2, h * 0.85], [hw / 2, h * 0.85], [0, h * 0.3]);
}
const mtnClear = (ax, ay) => OUTLINE.every((s) => { const x = Math.trunc(ax + s[0]), y = Math.trunc(ay + s[1]); return inb(x, y) && DIST[y * W + x] >= MTN_GAP; });
function countryAt(x, y) {
    x = Math.trunc(x); y = Math.trunc(y);
    if (!inb(x, y)) return "";
    const id = REG[y * W + x];
    return id ? LC[id] : "";
}
let offsets = [[0, 0, 0]];
if (MODE === "mountains") {
    offsets = [];
    for (let dy = -MTN_REACH; dy <= MTN_REACH; dy++) for (let dx = -MTN_REACH; dx <= MTN_REACH; dx++) if (dx * dx + dy * dy <= MTN_REACH ** 2) offsets.push([dx, dy, dx * dx + dy * dy]);
    offsets.sort((a, b) => a[2] - b[2]);
}
const placed = [], touching = [], dropped = [];
for (const peak of [...PEAKS].sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    const [px, py] = peak;
    const home = countryAt(px, py + MTN_H * 0.66);
    const off = offsets.find(([dx, dy]) => countryAt(px + dx, py + dy + MTN_H * 0.66) === home && mtnClear(px + dx, py + dy));
    let spot = off && [px + off[0], py + off[1]];
    if (!spot) {
        if (MODE === "mountains") { dropped.push(peak); continue; }
        touching.push(peak);
        spot = peak;
    }
    placed.push(spot);
    const [ax, ay] = spot;
    for (let y = Math.trunc(ay) - 3; y <= Math.trunc(ay + MTN_H) + 3; y++) {
        for (let x = Math.trunc(ax - MTN_W / 2) - 3; x <= Math.trunc(ax + MTN_W / 2) + 3; x++) {
            if (!inb(x, y) || !mtnInside(ax, ay, x + 0.5, y + 0.5, 1.0)) continue;
            obstacle(x, y);
            OCC[y * W + x] = 1;
        }
    }
    spread();
}
placed.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

// ---------- country codes, each in the clearest spot of its land (or the sea next to it) ----------
const LABELS = [];                                    // [x0, y0, x1, y1, size, room, x, y, height, code]
{
    const W1 = W + 1;
    const sat = (f) => {                                // summed-area table
        const t = new Int32Array(W1 * (H + 1));
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) t[(y + 1) * W1 + x + 1] = f(y * W + x) + t[y * W1 + x + 1] + t[(y + 1) * W1 + x] - t[y * W1 + x];
        return t;
    };
    const onland = sat((i) => (OCC[i] || !REG[i] ? 1 : 0));
    const anywhere = sat((i) => OCC[i]);
    const busy = (t, x0, y0, x1, y1) => {
        [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.trunc);
        if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) return 1;
        return t[(y1 + 1) * W1 + x1 + 1] - t[y0 * W1 + x1 + 1] - t[(y1 + 1) * W1 + x0] + t[y0 * W1 + x0];
    };
    const land = new Map(), near = new Map();
    const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const id = REG[y * W + x]; if (id) add(land, LC[id], [x, y]); }
    for (const id of SIDS) {
        const s = S.get(id);
        for (let y = s.y - 40; y <= s.y + 40; y += 2) for (let x = s.x - 40; x <= s.x + 40; x += 2) add(near, s.country, [x, y]);
    }
    for (const c of CORDER) {
        let best;
        for (const [size, pts, t] of [[15, land, onland], [10, land, onland], [15, near, anywhere], [10, near, anywhere]]) {
            const tw = CHAR_W * size * c.length, th = CHAR_W * size, m = size / 5;
            for (const pt of pts.get(c) ?? []) {
                const x0 = pt[0] - tw / 2 - m, y0 = pt[1] - th / 2 - m, x1 = pt[0] + tw / 2 + m, y1 = pt[1] + th / 2 + m;
                if (busy(t, x0, y0, x1, y1) || LABELS.some((l) => x0 <= l[2] && x1 >= l[0] && y0 <= l[3] && y1 >= l[1])) continue;
                let room = 0;
                while (room < 40 && !busy(t, x0 - room, y0 - room, x1 + room, y1 + room)) room++;
                if (!best || room > best[5]) best = [x0, y0, x1, y1, size, room, pt[0], pt[1], th];
            }
            if (best) break;
        }
        if (best) LABELS.push([...best, c]);
        else warn(`no room for the label of country ${c}`);
    }
}

// ---------- rivers and routes ----------
function cross(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}
function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.sqrt((px - a[0] - t * dx) ** 2 + (py - a[1] - t * dy) ** 2);
}
const RSEG = [];
for (const r of RIVERS) for (let i = 1; i < r.length; i++) RSEG.push([r[i - 1], r[i]]);
const CROSS = new Map();                              // route -> how many times it crosses a river
for (const s of ROUTESEG) {
    if (s[5]) continue;
    CROSS.set(s[4], (CROSS.get(s[4]) || 0) + RSEG.filter((r) => cross([s[0], s[1]], [s[2], s[3]], r[0], r[1])).length);
}
for (const e of [...CROSS.keys()].filter((e) => CROSS.get(e) > 1).sort(byKey)) warn(`route ${e} crosses a river ${CROSS.get(e)} times but is charged one crossing -- bend it in Route bends`);
// marching time in years (RULES.md §8): distance at army speed, plus the river and pass delays
const crossesRiver = (p) => { for (let i = 1; i < p.length; i++) if (RSEG.some((r) => cross(p[i - 1], p[i], r[0], r[1]))) return true; return false; };
const YEARS = new Map(), LEGYEARS = new Map();
for (const e of LAND) {
    if (RLEGPTS.has(e)) {
        const ly = RLEGPTS.get(e).map((p) => plen(p) / SPEEDN + DELAY.pass / 12 + (crossesRiver(p) ? DELAY.river / 12 : 0));
        LEGYEARS.set(e, ly);
        YEARS.set(e, ly[0] + ly[1]);
    } else YEARS.set(e, RLEN.get(e) / SPEEDN + (CROSS.get(e) ? DELAY.river / 12 : 0));
}
for (const s of S.values()) s.river = RSEG.some((r) => segDist(s.x, s.y, r[0], r[1]) <= RIVER_NEAR);

// =====================================================================================
// map.svg
// =====================================================================================
function n(v) { const s = v.toFixed(2).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s; }
const dLine = (pts) => "M" + pts.map((p) => n(p[0]) + " " + n(p[1])).join(" L");
const dRings = (rings) => rings.map((r) => dLine(r) + " Z").join(" ");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const o = [];
o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">`,
    `<!-- Generated by tools/map.js from ${DIR}/SCENARIO.md and ${DIR}/map-base.svg. Do not edit: change those and rerun. -->`, `<style>\n${STYLE}</style>`,
    `<rect id="sea" class="sea" width="${W}" height="${H}"/>`,
    `<path id="landmass" class="landmass" d="${LIDS.map((id) => dRings(LANDS.get(id))).join(" ")}"/>`,   // under the lands: hides hairline seams between them
    '<g id="lands">');
for (const id of LIDS) o.push(`  <path id="land-${id}" class="land ${LC[id]}" d="${dRings(LANDS.get(id))}"/>`);
o.push("</g>", '<g id="edges">', `  <path id="frame" class="frame" d="${chains(FRAME).map(dLine).join(" ")}"/>`,
    `  <path id="coast" class="coast" d="${chains(COAST).map(dLine).join(" ")}"/>`);
for (const k of [...PAIR.keys()].sort(byKey)) {
    const [a, b] = k.split("-").map(Number);
    o.push(`  <path id="edge-${k}" class="edge ${LC[a] === LC[b] ? "province" : "border"}" d="${chains(PAIR.get(k)).map(dLine).join(" ")}"/>`);
}
o.push("</g>", '<g id="rivers">', ...RIVERS.map((r) => `  <path class="river" d="${dLine(r)}"/>`), "</g>", '<g id="sea-zones">',
    ...DIVIDERS.map((r) => `  <path class="sea-divider" d="${dLine(r)}"/>`),
    ...ZONES.map((z) => `  <text id="sea-${z.id}" class="sea-label" x="${z.x}" y="${z.y}">${esc(z.name)}</text>`), "</g>", '<g id="routes">');
for (const e of [...LAND, ...STRAIT].sort(byKey)) o.push(`  <path id="route-${e}" class="route${STRAIT.has(e) ? " strait" : ""}" d="${dLine(RPATH.get(e))}"/>`);
o.push("</g>", '<g id="mountains">');
for (const [ax, ay] of placed) {
    const hw = MTN_W / 2, h = MTN_H, sx = ax + MTN_W * 0.06, sy = ay + h * 0.34, sw = hw * 0.34;
    const pts = (...ps) => ps.map((p) => n(p[0]) + "," + n(p[1])).join(" ");
    o.push('  <g class="mountain">',
        `    <polygon class="mtn-lit" points="${pts([ax, ay], [ax - hw, ay + h], [sx, ay + h])}"/>`,
        `    <polygon class="mtn-shade" points="${pts([ax, ay], [sx, ay + h], [ax + hw, ay + h])}"/>`,
        `    <polygon class="mtn-snow" points="${pts([ax, ay], [ax - sw, sy], [ax - sw * 0.5, sy + 1.5], [ax + 0.6, sy + 0.2])}"/>`,
        `    <polygon class="mtn-snow-shade" points="${pts([ax, ay], [ax + 0.6, sy + 0.2], [ax + sw * 0.55, sy + 1.3], [ax + sw, sy])}"/>`,
        `    <polygon class="mtn-outline" points="${pts([ax, ay], [ax - hw, ay + h], [ax + hw, ay + h])}"/>`, "  </g>");
}
o.push("</g>", '<g id="passes">');
for (const p of PASSES) {
    const h = PASS_SIDE * Math.sqrt(3) / 2, { x, y } = p;
    o.push(`  <polygon id="pass-${p.id}" class="pass" points="${n(x)},${n(y - 2 * h / 3)} ${n(x - PASS_SIDE / 2)},${n(y + h / 3)} ${n(x + PASS_SIDE / 2)},${n(y + h / 3)}"/>`);
}
o.push("</g>", '<g id="settlements">');
for (const id of SIDS) {
    const s = S.get(id), { x, y } = s;
    const marker = s.city ? `<rect class="marker" x="${x - CITY_SIDE / 2}" y="${y - CITY_SIDE / 2}" width="${CITY_SIDE}" height="${CITY_SIDE}"/>`
        : `<circle class="marker" cx="${x}" cy="${y}" r="${TOWN_R}"/>`;
    o.push(`  <g id="settlement-${id}" class="settlement ${s.city ? "city" : "town"} ${s.country}">${marker}<text class="number" x="${x}" y="${n(y + 3.5)}">${id}</text></g>`);
}
o.push("</g>", '<g id="labels">');
for (const l of LABELS) o.push(`  <text id="label-${l[9]}" class="label${l[4] < 15 ? " small" : ""}" x="${n(l[6])}" y="${n(l[7] + l[8] / 2)}">${l[9]}</text>`);
o.push("</g>", "</svg>");
fs.writeFileSync(SVG, o.map((l) => l + "\n").join(""));

// =====================================================================================
// derived numbers, scenario.json, SCENARIO.md
// =====================================================================================
function fmt(v) { let s = String(v); while (/^(\d+)(\d{3})/.test(s)) s = s.replace(/^(\d+)(\d{3})/, "$1,$2"); return s; }
function ranges(list) {
    const ns = [...list].sort(num), r = [];
    while (ns.length) {
        const a = ns.shift();
        let b = a;
        while (ns.length && ns[0] === b + 1) b = ns.shift();
        r.push(b === a ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`);
    }
    return r.join(", ");
}
const C = new Map();                                  // country -> { ids pop ports hre army ships hrestate }
for (const id of SIDS) {
    const s = S.get(id);
    if (!C.has(s.country)) C.set(s.country, { ids: [], pop: 0, ports: [], hre: 0 });
    const c = C.get(s.country);
    s.pop = s.city ? 20000 : 10000;
    c.ids.push(id);
    c.pop += s.pop;
    if (s.port) c.ports.push(id);
    if (s.hre) c.hre++;
}
for (const c of C.values()) {
    c.army = c.pop / 25;
    c.ships = c.ports.length ? c.pop / 2000 : 0;
    c.hrestate = c.hre === c.ids.length ? "all" : c.hre ? "part" : "none";
}
const cname = (c) => `${c} ${CN.get(c)}`;

// ---------- country colours: neighbours never share one ----------
// Every country gets a colour for its land on the map. A Colour in SCENARIO.md is kept; the rest are picked,
// largest country first, from a palette of light colours (the map's markers and labels are dark): never one a
// neighbour has — countries whose lands touch or are joined by a route or strait — and of the rest the one
// used least so far.
const PALETTE = ["#e8b4a0", "#a9c8e8", "#b7d9a8", "#f2d58c", "#d5b3dc", "#9fd6c9", "#f3a9a9", "#cdcda4", "#a7b9f0",
    "#e9c4e2", "#c6e3a4", "#f1c69d", "#b4abdb", "#dcd2a2", "#acdbea", "#e2abbb", "#bfd8c6", "#e5d3b3"];
const NEAR = new Map(CORDER.map((c) => [c, new Set()]));
for (const k of [...PAIR.keys(), ...LAND, ...STRAIT]) {
    const [a, b] = k.split("-").map((x) => S.get(Number(x)).country);
    if (a !== b) { NEAR.get(a).add(b); NEAR.get(b).add(a); }
}
{
    const uses = new Map(PALETTE.map((p) => [p, 0]));
    for (const c of COLOUR.values()) if (uses.has(c)) uses.set(c, uses.get(c) + 1);
    const ord = new Map(CORDER.map((c, i) => [c, i]));
    for (const c of [...CORDER].filter((x) => !COLOUR.has(x)).sort((a, b) => C.get(b).pop - C.get(a).pop || ord.get(a) - ord.get(b))) {
        const taken = new Set([...NEAR.get(c)].map((x) => COLOUR.get(x)));
        const free = PALETTE.filter((p) => !taken.has(p));
        const pick = (free.length ? free : PALETTE).reduce((best, p) => (uses.get(p) < uses.get(best) ? p : best));
        COLOUR.set(c, pick);
        uses.set(pick, uses.get(pick) + 1);
    }
}
const zonePorts = (z) => SIDS.filter((id) => S.get(id).zone === z);
const zoneStraits = (z) => [...SZ.keys()].filter((e) => SZ.get(e) === z).sort(byKey);
const zoneNext = (z) => ZONES.filter((x) => z.next.has(x.name));

const json = {
    source: `Generated by tools/map.js from ${DIR}/SCENARIO.md and ${DIR}/map-base.svg. Do not edit.`,
    scaleX: Number(XS), armySpeed: SPEEDN, fleetHopMonths: DELAY.fleet, straitShips: STRAITN,
    map: { svg: "map.svg", width: W, height: H },
    countries: CORDER.map((code) => {
        const c = C.get(code);
        return { code, name: CN.get(code), capital: CAP.get(code), colour: COLOUR.get(code), settlements: c.ids, pop: c.pop, army: c.army, ships: c.ships, hre: c.hrestate };
    }),
    settlements: SIDS.map((id) => {
        const s = S.get(id);
        return { id, name: s.name, country: s.country, type: s.city ? "city" : "town", pop: s.pop, port: s.port, river: s.river, hre: s.hre,
            x: s.x, y: s.y, land: `land-${id}`, seaZone: s.zone ? s.zone.id : null, borders: s.nb.map(Number).sort(num), straits: s.st.map(Number).sort(num) };
    }),
    routes: [...LAND, ...STRAIT].sort(byKey).map((e) => {
        const [a, b] = e.split("-").map(Number), strait = STRAIT.has(e), legs = RLEGS.get(e);
        return { id: `route-${e}`, from: a, to: b, type: strait ? "strait" : "land", length: Number(n(RLEN.get(e))),
            years: strait ? null : Number(YEARS.get(e).toFixed(2)),
            legs: legs ? [0, 1].map((i) => ({ length: Number(n(legs[i])), years: Number(LEGYEARS.get(e)[i].toFixed(2)) })) : null,
            pass: VIA.has(e) ? VIA.get(e).id : null, seaZone: SZ.has(e) ? SZ.get(e).id : null, crossesRiver: Boolean(CROSS.get(e)),
            points: RPATH.get(e).map((p) => p.map((v) => Number(n(v)))) };
    }),
    passes: PASSES.map((p) => ({ id: p.id, x: p.x, y: p.y, land: p.owner, routes: p.routes })),
    seaZones: ZONES.map((z) => ({ id: z.id, name: z.name, label: { x: z.x, y: z.y }, ports: zonePorts(z), straits: zoneStraits(z), next: zoneNext(z).map((x) => x.id) })),
};
fs.writeFileSync(JSONF, JSON.stringify(json, null, 1) + "\n");

{
    const [, rows, i, j] = table("Countries");
    // the Colour column stays only if the table has one; what is written in it is kept as it was
    const given = new Map(rows.map((r) => [r.Code, r.Colour ?? ""]));
    const t = HAS_COLOUR
        ? ["| Code | Country | Capital | Colour | Settlements | Pop | Army | Ships | HRE |", "|---|---|---|---|---|---|---|---|---|"]
        : ["| Code | Country | Capital | Settlements | Pop | Army | Ships | HRE |", "|---|---|---|---|---|---|---|---|"];
    for (const k of CORDER) {
        const c = C.get(k);
        t.push(`| ${k} | ${CN.get(k)} | ${CAP.get(k)} ${S.get(CAP.get(k)).name} |${HAS_COLOUR ? ` ${given.get(k)} |` : ""} ${c.ids.join(", ")} | ${Math.trunc(c.pop / 1000)}K | ${fmt(c.army)} | ${c.ships || "—"} | ${{ all: "✓", part: "part", none: "—" }[c.hrestate]} |`);
    }
    doc.splice(i, j - i + 1, ...t);
}
{
    const [, , i, j] = table("Sea zones");
    const t = ["| Zone | X | Y | Ports | Straits | Next to |", "|---|---|---|---|---|---|"];
    for (const z of ZONES) t.push(`| ${z.name} | ${z.x} | ${z.y} | ${zonePorts(z).join(", ") || "—"} | ${zoneStraits(z).join(", ") || "—"} | ${zoneNext(z).map((x) => x.name).join(", ") || "—"} |`);
    doc.splice(i, j - i + 1, ...t);
}
{
    const [, , i, j] = table("Mountain passes");
    const t = ["| Pass | X | Y | Routes | In the land of | Owner at start |", "|---|---|---|---|---|---|"];
    for (const p of PASSES) t.push(`| ${p.id} | ${p.x} | ${p.y} | ${p.routes.join(", ")} | ${p.owner} ${S.get(p.owner).name} | ${cname(LC[p.owner])} |`);
    doc.splice(i, j - i + 1, ...t);
}
if (MODE === "mountains") {
    const [s, e] = section("Mountains");
    const f = [];
    for (let i = s; i <= e; i++) if (/^```/.test(doc[i])) f.push(i);
    const p = [...placed], l = [];
    while (p.length) l.push(p.splice(0, 8).map((q) => `${q[0]},${q[1]}`).join("  "));
    doc.splice(f[0] + 1, f[1] - f[0] - 1, ...l);
}
function generated(name, ...body) {
    const s = doc.indexOf(`<!-- generated:${name} -->`);
    if (s < 0) die(`SCENARIO.md: no <!-- generated:${name} --> marker`);
    let e = s + 1;
    while (e < doc.length && doc[e] !== "<!-- /generated -->") e++;
    if (e >= doc.length) die(`SCENARIO.md: <!-- generated:${name} --> is not closed`);
    doc.splice(s + 1, e - s - 1, ...body);
}
const cities = SIDS.filter((id) => S.get(id).city);
let pop = 0;
for (const c of C.values()) pop += c.pop;
const ord = new Map(CORDER.map((c, i) => [c, i]));
const naval = CORDER.filter((c) => C.get(c).ships).sort((a, b) => C.get(b).ships - C.get(a).ships || ord.get(a) - ord.get(b));
let ships = 0;
for (const c of naval) ships += C.get(c).ships;
generated("summary", `${SIDS.length} settlements (${cities.length} cities, ${SIDS.length - cities.length} towns) · ${CORDER.length} countries · ${fmt(pop)} people · ${LAND.size} land routes, ${STRAIT.size} straits, ${PASSES.length} mountain passes`);
const bypop = new Map();
for (const c of CORDER) { const p = C.get(c).pop; if (!bypop.has(p)) bypop.set(p, []); bypop.get(p).push(c); }
const hre = SIDS.filter((id) => S.get(id).hre), hrec = CORDER.filter((c) => C.get(c).hre), onriver = SIDS.filter((id) => S.get(id).river);
const crossing = [...CROSS.keys()].filter((e) => CROSS.get(e)).sort(byKey);
const ports = SIDS.filter((id) => S.get(id).port);
const months = (k) => (k === 1 ? "" : "s");
const marching = (() => {
    const y = [...LAND].map((e) => YEARS.get(e)).sort(num), p = [...LAND].filter((e) => VIA.has(e)).map((e) => YEARS.get(e)).sort(num);
    const f = (v) => (v ?? 0).toFixed(2);
    return `**Marching** at ${SPEED} map units a year, +${DELAY.river} month${months(DELAY.river)} per river crossing, +${DELAY.pass} per leg to or from a pass: `
        + `a route takes ${f(y[0])}–${f(y[y.length - 1])} years (median ${f(y[Math.trunc((y.length - 1) / 2)])}); through a pass ${f(p[0])}–${f(p[p.length - 1])}.`;
})();
const sailing = (() => {                              // the two sea zones furthest apart, in hops
    let far = 0, pair = ["", ""];
    for (const z of ZONES) {
        const d = new Map([[z.name, 0]]), q = [z];
        while (q.length) {
            const c = q.shift();
            for (const nb of zoneNext(c)) {
                if (d.has(nb.name)) continue;
                d.set(nb.name, d.get(c.name) + 1);
                q.push(nb);
                if (d.get(nb.name) > far) { far = d.get(nb.name); pair = [z.name, nb.name]; }
            }
        }
    }
    return `**Sailing:** ${DELAY.fleet} months to a neighbouring sea zone (RULES.md §8); the furthest apart, ${pair[0]} and ${pair[1]}, are ${far} hops (${far * DELAY.fleet} months).`;
})();
const navalRows = naval.map((c) => {
    const home = new Set(C.get(c).ports.map((id) => S.get(id).zone.name)), nn = C.get(c).ships;
    const st = [...SZ.keys()].filter((e) => home.has(SZ.get(e).name)).sort(byKey);
    const zn = new Set(st.map((e) => SZ.get(e).name)).size, sts = st.join(", ");
    const can = !st.length ? "no — no strait in its zones"
        : nn < STRAITN ? `no — too few ships for ${sts}`
            : nn < STRAITN * zn ? (nn === STRAITN ? `**exactly**: ${sts}` : `yes: ${sts}`) + ` — one zone at a time (${STRAITN} ships in each)`
                : nn === STRAITN ? `**exactly**: ${sts}` : `yes: ${sts}`;
    return `| ${cname(c)} | ${C.get(c).ports.join(", ")} | ${ZONES.filter((z) => home.has(z.name)).map((z) => z.name).join(", ")} | ${Math.trunc(nn)} | ${can} |`;
});
generated("overview",
    `**Cities (20K):** ${cities.join(", ")} — all other settlements are towns (10K).`, "",
    `**HRE settlements (${hre.length}):** ${ranges(hre)} — held by ${hrec.length} of the ${CORDER.length} countries.`, "",
    `**Ports (${ports.length}):** ${ports.join(", ")} — on the coast; grow +0.5% more (RULES.md §2).`, "",
    `**On a river (${onriver.length}):** ${onriver.join(", ")} — within ${RIVER_NEAR}px of a river on the map; grow +0.5% more (RULES.md §2).`, "",
    `**Routes crossing a river (${crossing.length}):** ${crossing.join(", ")} — +${DELAY.river} month${months(DELAY.river)} to march (RULES.md §8).`, "",
    marching, "",
    "| Pop | Countries |", "|---|---|",
    ...[...bypop.keys()].sort((a, b) => b - a).map((p) => `| ${Math.trunc(p / 1000)}K | ${bypop.get(p).length}: ${bypop.get(p).map(cname).join(" · ")} |`), "",
    sailing, "",
    `**Naval powers:** ${naval.length} countries, ${ships} ships. Crossing a strait needs ${STRAITN} ships (10 × x) in the sea zone the strait lies in (RULES.md §8), `
        + `so at the start a country can only cross the straits of its own ports' zones; for any other it must first sail ${STRAITN} ships there.`, "",
    "| Country | Ports held | Home zones | Ships | Can cross straits? |", "|---|---|---|---|---|",
    ...navalRows);
fs.writeFileSync(DOC, doc.map((l) => l + "\n").join(""));

// ---------- report ----------
console.log(`${SIDS.length} settlements, ${CORDER.length} countries, ${LAND.size} land routes (${crossing.length} cross a river), ${STRAIT.size} straits, ${PASSES.length} passes, ${placed.length} mountains, ${RIVERS.length} rivers -> ${DIR}/map.svg, ${DIR}/scenario.json`);
for (const p of PASSES) console.log(`${p.id} at ${p.x},${p.y}: land of ${p.owner} ${S.get(p.owner).name} (${cname(LC[p.owner])})`);
if (BENT.sea.size) console.log(`bent around the sea: ${[...BENT.sea].sort(byKey).join(", ")}`);
if (BENT.country.size) console.log(`bent around other countries: ${[...BENT.country].sort(byKey).join(", ")}`);
if (BENT.tight.size) console.log(`squeezed through a point where the lands barely touch: ${[...BENT.tight].sort(byKey).join(", ")}`);
if (touching.length) warn(`${touching.length} mountain(s) touch something: ${touching.map((p) => `${p[0]},${p[1]}`).join(" ")} -- run \`node tools/map.js ${DIR === "docs" ? "" : DIR + " "}mountains\``);
if (MODE === "mountains") {
    const moved = placed.filter((q) => !PEAKS.some((p) => p[0] === q[0] && p[1] === q[1])).length;
    console.log(`mountains: ${placed.length - moved} kept, ${moved} moved, ${dropped.length} dropped${dropped.length ? " (no clear spot near " + dropped.map((p) => `${p[0]},${p[1]}`).join(" ") + ")" : ""}`);
}
