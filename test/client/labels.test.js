// The countries' codes on the map follow their borders (public/js/mapdraw.js, countryLabels): each country still in the game
// gets its code on land it holds now, never over another code, and a country that is out of the game gets none.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import mitteleuropa from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import historical from "../../scenarios/historical-1440/scenario.json" with { type: "json" };

register("./loader.mjs", import.meta.url);
const { Game } = await import("../../src/engine/index.js");
const { countryLabels } = await import("../../public/js/mapdraw.js");

const CHAR_W = 0.72;
const boxOf = (l) => { const tw = CHAR_W * l.size * l.code.length, th = CHAR_W * l.size, m = l.size / 5; return [l.x - tw / 2 - m, l.y - th - m, l.x + tw / 2 + m, l.y + m]; };
// is the label on one of the spots of a land its country holds
const onOwnLand = (sc, st, l) => sc.settlements.some((s) => st.settlements[s.id].owner === l.code
    && [s.label.big, s.label.small, s.label.near].some((p) => p && p[0] === l.x && Math.abs(p[1] + CHAR_W * l.size / 2 - l.y) < 1e-9));

for (const [name, sc, folder] of [["Mitteleuropa: Balanced", mitteleuropa, "mitteleuropa"], ["Mitteleuropa: Historical 1440", historical, "historical-1440"]]) {
    test(`${name}: at the start every country the map itself could label has its code, on its own land, and no two overlap`, () => {
        const st = Game.create(sc, { seed: 1 }).state;
        const labels = countryLabels(st, sc);
        // the map drawn for 1440 has a label for each country tools/map.js found room for (it warns of the others)
        const drawn = (fs.readFileSync(path.join(import.meta.dirname, "..", "..", "scenarios", folder, "map.svg"), "utf8").match(/id="label-/g) ?? []).length;
        assert.ok(labels.length >= drawn, `${labels.length} countries labelled, the map itself ${drawn}`);
        for (const l of labels) assert.ok(onOwnLand(sc, st, l), `${l.code} is on its own land`);
        const boxes = labels.map(boxOf);
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const [a, b] = [boxes[i], boxes[j]];
            assert.ok(!(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]), `${labels[i].code} and ${labels[j].code} overlap`);
        }
    });
}

test("a code follows the land: a country that takes another's gets it, and one that is out gets no code", () => {
    const sc = mitteleuropa, st = Game.create(sc, { seed: 1 }).state;
    const before = countryLabels(st, sc);
    assert.ok(before.some((l) => l.code === "AUS"));
    for (const s of Object.values(st.settlements)) if (s.owner === "AUS") s.owner = "HUN";
    st.countries.AUS.out = 100;
    const after = countryLabels(st, sc);
    assert.ok(!after.some((l) => l.code === "AUS"), "Austria is out: no code");
    const hun = after.find((l) => l.code === "HUN");
    assert.ok(hun && onOwnLand(sc, st, hun), "Hungary's code is on land it holds, which now includes Austria's");
    assert.ok(!countryLabels({ ...st, countries: { ...st.countries, HUN: { ...st.countries.HUN, rebel: true } } }, sc).some((l) => l.code === "HUN"), "peasant rebels get none");
});
