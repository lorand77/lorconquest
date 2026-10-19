// The scenarios a game can be played on: docs/ (Mitteleuropa) and every folder under scenarios/ with a
// scenario.json. Read once when the server starts; each has an id ("docs", "historical-1440"), a name from the
// first line of its SCENARIO.md, its folder, and its data.
import fs from "node:fs";
import path from "node:path";

function nameOf(dir, id) {
    const first = fs.existsSync(path.join(dir, "SCENARIO.md")) ? fs.readFileSync(path.join(dir, "SCENARIO.md"), "utf8").split("\n")[0] : "";
    const m = /^#\s*SCENARIO:\s*(.+)$/.exec(first);
    const raw = m ? m[1] : id;
    return raw.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, s, c) => s + c.toUpperCase());
}

export function loadScenarios(root) {
    const dirs = [["docs", path.join(root, "docs")]];
    const extra = path.join(root, "scenarios");
    if (fs.existsSync(extra)) {
        for (const d of fs.readdirSync(extra).sort()) {
            if (fs.existsSync(path.join(extra, d, "scenario.json"))) dirs.push([d, path.join(extra, d)]);
        }
    }
    const scenarios = new Map();
    for (const [id, dir] of dirs) {
        const data = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8"));
        scenarios.set(id, { id, name: nameOf(dir, id), dir, data });
    }
    return scenarios;
}
