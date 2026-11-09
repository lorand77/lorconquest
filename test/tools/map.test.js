// tools/map.js: country colours — every country gets one, neighbours never share one, and a Colour column in
// SCENARIO.md overrides the pick and stays in the table.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };

const ROOT = path.join(import.meta.dirname, "..", "..");

function build(edit = (doc) => doc) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-map-"));
    fs.writeFileSync(path.join(dir, "SCENARIO.md"), edit(fs.readFileSync(path.join(ROOT, "scenarios", "mitteleuropa", "SCENARIO.md"), "utf8")));
    fs.copyFileSync(path.join(ROOT, "scenarios", "mitteleuropa", "map-base.svg"), path.join(dir, "map-base.svg"));
    execFileSync("node", [path.join(ROOT, "tools", "map.js"), dir], { stdio: "pipe" });
    const out = { json: JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8")), doc: fs.readFileSync(path.join(dir, "SCENARIO.md"), "utf8") };
    fs.rmSync(dir, { recursive: true, force: true });
    return out;
}

test("every country gets a colour, and no two neighbours share one", () => {
    const { json } = build();
    const colour = new Map(json.countries.map((c) => [c.code, c.colour]));
    assert.ok([...colour.values()].every((c) => /^#[0-9a-f]{6}$/.test(c)));
    const owner = new Map(json.settlements.map((s) => [s.id, s.country]));
    for (const r of json.routes) {
        const a = owner.get(r.from), b = owner.get(r.to);
        if (a !== b) assert.notEqual(colour.get(a), colour.get(b), `${a} and ${b} share a colour`);
    }
});

test("a Colour column overrides the pick and is kept", () => {
    const { json, doc } = build((d) => d
        .replace("| Code | Country | Capital | Settlements |", "| Code | Country | Capital | Colour | Settlements |")
        .replace("|---|---|---|---|---|---|---|---|\n| NOR", "|---|---|---|---|---|---|---|---|---|\n| NOR")
        .replace(/^\| (\w+) \| ([^|]+) \| ([^|]+) \|/gm, (m, code, name, cap) => (scenario.countries.some((c) => c.code === code) ? `| ${code} | ${name} | ${cap} | ${code === "BAV" ? "#3A7BD5" : ""} |` : m)));
    assert.equal(json.countries.find((c) => c.code === "BAV").colour, "#3a7bd5");
    assert.match(doc, /\| BAV \| Bavaria \| 37 Munich \| #3A7BD5 \| 36, 37, 38, 71 \|/);
    assert.match(doc, /\| NOR \| Norway \| 2 Oslo \|  \| 1, 2 \|/);
});

// building must fail, with `message` among the errors
function refuses(edit, message) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-map-"));
    fs.writeFileSync(path.join(dir, "SCENARIO.md"), edit(fs.readFileSync(path.join(ROOT, "scenarios", "mitteleuropa", "SCENARIO.md"), "utf8")));
    fs.copyFileSync(path.join(ROOT, "scenarios", "mitteleuropa", "map-base.svg"), path.join(dir, "map-base.svg"));
    try {
        execFileSync("node", [path.join(ROOT, "tools", "map.js"), dir], { stdio: "pipe" });
        assert.fail("it built");
    } catch (e) {
        assert.match(String(e.stderr ?? e.message), message);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test("a new state's code is no country's, and its colour unlike every country's", () => {
    refuses((d) => d.replace("Czechoslovakia, CSK, #6cc0b0", "Czechoslovakia, BAV, #6cc0b0").replace("Benelux, BNX, #f08030", "Benelux, BNX, #a9c8e9"),
        /(?=[\s\S]*Unite Czechoslovakia becomes BAV, which is a country's code)(?=[\s\S]*Unite the Benelux's colour #a9c8e9 is too like)/);
});

test("characters and rivalries: every country has one of the characters, the spread is varied, rivals are two real countries", () => {
    const { json } = build();
    assert.ok(json.countries.every((c) => c.character), "every country has a character");
    assert.ok(json.rivalries.length > 0 && json.rivalries.every(([a, b]) => a !== b && json.countries.some((c) => c.code === a) && json.countries.some((c) => c.code === b)));
    refuses((d) => d.replace("| NOR | Defender |", "| NOR | Pirate |"), /'Pirate' is none of conqueror/);
    refuses((d) => d.replace(/^\| NOR \| Defender \|.*\n/m, ""), /no character for NOR/);
    refuses((d) => d.replace(/^\| (\w+) \| (Defender|Merchant|Diplomat) \|/gm, "| $1 | Conqueror |"), /conqueror is given to \d+ of 45 countries; no character to more than 30%/);
    refuses((d) => d.replace(/^\| (\w+) \| Zealot \|/gm, "| $1 | Defender |"), /zealot is given to 0 countries/);
    refuses((d) => d.replace("| CPH Copenhagen – STO Stockholm |", "| CPH Copenhagen – XXX Nowhere |"), /Rivalries line \d+: needs two countries/);
    refuses((d) => d.replace("| NED Netherlands – HAM Hamburg |", "| CPH Copenhagen – STO Stockholm |"), /CPH and STO are listed twice/);
});

test("the map shows no settlement numbers: each marker holds its short form, and its name is beside it, for the game to show zoomed in", () => {
    const svg = fs.readFileSync(path.join(ROOT, "scenarios", "mitteleuropa", "map.svg"), "utf8");
    assert.doesNotMatch(svg, /class="number"/);
    for (const s of scenario.settlements) {
        const g = new RegExp(`<g id="settlement-${s.id}" [^>]*>(.*?)</g>`).exec(svg);
        assert.ok(g, `settlement ${s.id} is drawn`);
        assert.match(g[1], new RegExp(`<text class="abbr"[^>]*>${s.abbr}</text>`));
        assert.match(g[1], new RegExp(`<text class="name"[^>]*>${s.name}</text>`));
        assert.doesNotMatch(g[1], new RegExp(`>${s.id}<`), "no number");
    }
    assert.match(svg, /\.name\{display:none;/, "names are hidden unless the game shows them");
});

test("no fleet is drawn on land: every port's spots, every zone's column and every lane between zones lie in the water", () => {
    for (const name of ["mitteleuropa", "historical-1440"]) {
        const dir = path.join(ROOT, "scenarios", name), sc = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
        const d = /id="landmass"[^>]*?d="([^"]+)"/.exec(fs.readFileSync(path.join(dir, "map.svg"), "utf8"))[1];
        const polys = d.split("Z").map((p) => [...p.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])).filter((p) => p.length > 2);
        // even-odd: an island is land, a lake in it water
        const onLand = ([x, y]) => {
            let inside = false;
            for (const p of polys) for (let i = 0, k = p.length - 1; i < p.length; k = i++) {
                const [xi, yi] = p[i], [xk, yk] = p[k];
                if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) inside = !inside;
            }
            return inside;
        };
        for (const s of sc.settlements.filter((x) => x.port)) {
            const spots = sc.seaZones.find((z) => z.id === s.seaZone).harbours[s.id];
            assert.equal(spots?.length, 4, `${name}: ${s.name} has its four spots`);
            for (const q of spots) assert.ok(!onLand(q), `${name}: a fleet in ${s.name} at ${q} is on land`);
        }
        for (const z of sc.seaZones) {
            for (const q of z.fleets) assert.ok(!onLand(q), `${name}: a fleet at sea in ${z.name} at ${q} is on land`);
            for (const [to, lane] of Object.entries(z.lanes)) for (let i = 1; i < lane.length; i++) {
                const [a, b] = [lane[i - 1], lane[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
                for (let t = 0; t <= L; t++) assert.ok(!onLand([a[0] + (b[0] - a[0]) * t / (L || 1), a[1] + (b[1] - a[1]) * t / (L || 1)]), `${name}: the lane ${z.id} → ${to} crosses land`);
            }
        }
    }
});

test("every road is drawn through its own two lands only (and its pass's): whoever comes to own the lands about it, it crosses no other", () => {
    for (const name of ["mitteleuropa", "historical-1440"]) {
        const dir = path.join(ROOT, "scenarios", name), sc = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
        const svg = fs.readFileSync(path.join(dir, "map.svg"), "utf8"), lands = new Map();
        for (const m of svg.matchAll(/<path id="land-(\d+)"[^>]*? d="([^"]+)"/g)) {
            lands.set(Number(m[1]), m[2].split("Z").map((p) => [...p.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((q) => [Number(q[1]), Number(q[2])])).filter((p) => p.length > 2));
        }
        const inside = (polys, [x, y]) => {
            let c = false;
            for (const p of polys) for (let i = 0, k = p.length - 1; i < p.length; k = i++) {
                const [xi, yi] = p[i], [xk, yk] = p[k];
                if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) c = !c;
            }
            return c;
        };
        // how far a point is from a land's edge: a road may graze a border by a pixel or two, as the map's pixels are not its lines
        const edge = (polys, [x, y]) => Math.min(...polys.flatMap((p) => p.map((a, i) => {
            const b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
        })));
        const passes = new Map(sc.passes.map((p) => [p.id, p]));
        // a road between lands that do not touch has no line through them alone: drawn as measured, with tools/map.js's warning
        // (Balanced's 58-59, Utrecht–Düsseldorf: SCENARIO.md, Notes to check)
        const apart = new Set(name === "mitteleuropa" ? ["route-58-59"] : []);
        for (const r of sc.routes.filter((x) => x.type === "land" && !apart.has(x.id))) {
            const own = new Set([r.from, r.to, ...(r.pass ? [passes.get(r.pass).land] : [])]);
            const ends = [r.points[0], r.points[r.points.length - 1], ...(r.pass ? [[passes.get(r.pass).x, passes.get(r.pass).y]] : [])];
            for (let i = 1; i < r.points.length; i++) {
                const [a, b] = [r.points[i - 1], r.points[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
                for (let t = 0; t <= L; t += 2) {
                    const q = [a[0] + (b[0] - a[0]) * t / (L || 1), a[1] + (b[1] - a[1]) * t / (L || 1)];
                    if (ends.some((e) => Math.hypot(q[0] - e[0], q[1] - e[1]) < 12)) continue;      // under a marker
                    for (const [id, polys] of lands) {
                        if (own.has(id) || !inside(polys, q)) continue;
                        assert.ok(edge(polys, q) <= 2, `${name}: road ${r.id} crosses land-${id} near ${q.map(Math.round)}`);
                    }
                }
            }
        }
    }
});
