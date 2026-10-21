// tools/abbreviations.js: settlement names shortened to 3 or 4 letters for the map at a distance — taken from the name in
// order, mixed case, unique within a scenario, the most important places choosing first.
import test from "node:test";
import assert from "node:assert/strict";
import { abbreviate, candidates, wordsOf } from "../../tools/abbreviations.js";
import mitteleuropa from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import historical from "../../scenarios/historical-1440/scenario.json" with { type: "json" };

test("the words of a name, without brackets and punctuation", () => {
    assert.deepEqual(wordsOf("Frankfurt (Oder)"), ["Frankfurt", "Oder"]);
    assert.deepEqual(wordsOf("St. Pölten"), ["St", "Pölten"]);
    assert.deepEqual(wordsOf("Hradec Králové"), ["Hradec", "Králové"]);
});

test("a name's short forms, best first: its first three letters, then with the next word, then later letters", () => {
    assert.equal(candidates("Vienna")[0], "Vie");
    assert.equal(candidates("Königsberg")[0], "Kön");
    assert.deepEqual(candidates("Frankfurt (Oder)").slice(0, 3), ["Fra", "FrO", "FOd"]);
    assert.ok(candidates("Ulm").includes("Ulm"));
    for (const name of ["Vienna", "Łódź", "St. Veit", "Wiener Neustadt"]) {
        for (const c of candidates(name)) {
            assert.ok([...c].length >= 3 && [...c].length <= 4, `${name}: ${c}`);
            assert.equal(c[0], c[0].toUpperCase(), `${name}: ${c} starts with a capital`);
        }
    }
});

test("the first to choose gets the plain form; the next finds another; none is ever shared", () => {
    const ab = abbreviate([{ id: 1, name: "Bremen" }, { id: 2, name: "Breslau" }, { id: 3, name: "Brest" }]);
    assert.deepEqual([...ab.values()], ["Bre", "Brs", "Brt"]);
    assert.throws(() => abbreviate([{ id: 1, name: "Ab" }]), /no free short form for Ab/);
    for (const sc of [mitteleuropa, historical]) {
        const forms = sc.settlements.map((s) => s.abbr);
        assert.ok(forms.every((a) => /^\p{Lu}[\p{L}]{2,3}$/u.test(a)), "3 or 4 letters, a capital first");
        assert.equal(new Set(forms.map((a) => a.toLowerCase())).size, forms.length, "no two alike");
        const city = sc.settlements.find((s) => s.name === "Vienna");
        assert.equal(city.abbr, "Vie");
    }
});
