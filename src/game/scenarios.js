// The scenarios a game can be played on: every folder under scenarios/ with a scenario.json. Read once when the server
// starts; each has an id (its folder: "mitteleuropa", "historical-1440"), a name from the first line of its SCENARIO.md,
// its folder, and its data. The default scenario comes first in the list, so the lobby offers it first.
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SCENARIO = "mitteleuropa";

function nameOf(dir, id) {
    const first = fs.existsSync(path.join(dir, "SCENARIO.md")) ? fs.readFileSync(path.join(dir, "SCENARIO.md"), "utf8").split("\n")[0] : "";
    const m = /^#\s*SCENARIO:\s*(.+)$/.exec(first);
    const raw = m ? m[1] : id;
    return raw.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, s, c) => s + c.toUpperCase());
}

export function loadScenarios(root) {
    const folder = path.join(root, "scenarios");
    const ids = fs.existsSync(folder) ? fs.readdirSync(folder).filter((d) => fs.existsSync(path.join(folder, d, "scenario.json"))) : [];
    const ordered = [...ids.filter((id) => id === DEFAULT_SCENARIO), ...ids.filter((id) => id !== DEFAULT_SCENARIO).sort()];
    const scenarios = new Map();
    for (const id of ordered) {
        const dir = path.join(folder, id);
        scenarios.set(id, { id, name: nameOf(dir, id), dir, data: JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8")) });
    }
    return scenarios;
}
