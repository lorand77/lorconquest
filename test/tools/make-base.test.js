// The map drawn from real geography (tools/make-base.js): run on a copy of the historical scenario's folder, it draws exactly
// the map-base.svg that scenario has — so a change to the tool, made for another map, cannot quietly change this one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.join(import.meta.dirname, "..", "..");

test("make-base.js draws the historical scenario's map-base.svg from its data.js, to the byte", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-base-"));
    try {
        for (const f of ["data.js", "SCENARIO.md"]) fs.copyFileSync(path.join(root, "scenarios", "historical-1440", f), path.join(dir, f));
        const out = execFileSync(process.execPath, [path.join(root, "tools", "make-base.js"), dir], { encoding: "utf8" });
        assert.match(out, /map-base\.svg: 168 lands/);
        assert.equal(fs.readFileSync(path.join(dir, "map-base.svg"), "utf8"), fs.readFileSync(path.join(root, "scenarios", "historical-1440", "map-base.svg"), "utf8"));
        assert.throws(() => execFileSync(process.execPath, [path.join(root, "tools", "make-base.js"), os.tmpdir()], { stdio: "pipe" }), /no data\.js/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
