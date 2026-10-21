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
