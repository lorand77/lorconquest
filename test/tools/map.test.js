// tools/map.js: country colours — every country gets one, neighbours never share one, and a Colour column in
// SCENARIO.md overrides the pick and stays in the table.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import scenario from "../../docs/scenario.json" with { type: "json" };

const ROOT = path.join(import.meta.dirname, "..", "..");

function build(edit = (doc) => doc) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-map-"));
    fs.writeFileSync(path.join(dir, "SCENARIO.md"), edit(fs.readFileSync(path.join(ROOT, "docs", "SCENARIO.md"), "utf8")));
    fs.copyFileSync(path.join(ROOT, "docs", "map-base.svg"), path.join(dir, "map-base.svg"));
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
