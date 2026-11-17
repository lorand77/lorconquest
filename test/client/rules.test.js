// The Rules page's pure parts: the Markdown reader (public/js/markdown.js) on the marks the rules use and on RULES.md and
// STARTER.md themselves, the addresses and links (ruleslogic.js), and each scenario's page written from its scenario.json
// (scenarioinfo.js) — what wins, what its x makes things cost, its faiths and Empire only where it has them, never the
// computer's characters.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
const { inline, renderMarkdown, splitSections } = await import("../../public/js/markdown.js");
const { parseHash, rulesLink, sectionLabel, sectionNumber } = await import("../../public/js/ruleslogic.js");
const { scenarioPage } = await import("../../public/js/scenarioinfo.js");

const root = path.join(import.meta.dirname, "..", "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const scenario = (id) => JSON.parse(read("scenarios", id, "scenario.json"));
// the text of the HTML outside code, where no Markdown mark may be left unread
const prose = (html) => html.replace(/<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>/g, "");

test("inline: bold, italics, code and links, and everything else escaped", () => {
    assert.equal(inline("**Walls** ×1.8 and *half*, `x × 1.5M` <b>"), "<strong>Walls</strong> ×1.8 and <em>half</em>, <code>x × 1.5M</code> &lt;b&gt;");
    assert.equal(inline("see [SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md#sea-zones)", rulesLink), "see <a href=\"#scenario-mitteleuropa\">SCENARIO.md</a>");
    assert.equal(inline("see [design](docs/design.md)", rulesLink), "see design", "a file the site does not serve: just its text");
    assert.equal(inline("2 * 3 * 4"), "2 * 3 * 4", "a lone star is no italics");
});

test("blocks: headings, tables, lists with their run-on lines, quotes, fenced code, rules", () => {
    const html = renderMarkdown(["## Title", "", "A line", "and its rest.", "", "| A | B |", "|---|---|", "| 1 | **2** |", "",
        "- one", "  more of one", "- two", "", "1. first", "2. second", "", "> **Note.** quoted", "", "```", "a * b <c>", "```", "", "---"].join("\n"));
    assert.equal(html, ["<h2>Title</h2>", "<p>A line and its rest.</p>",
        "<div class=\"table-wrap\"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table></div>",
        "<ul><li>one more of one</li><li>two</li></ul>", "<ol><li>first</li><li>second</li></ol>",
        "<blockquote><p><strong>Note.</strong> quoted</p></blockquote>", "<pre><code>a * b &lt;c&gt;</code></pre>", "<hr>"].join("\n"));
});

test("RULES.md cuts into its opening note and §1 to §11, and reads with no mark left over", () => {
    const [opening, ...sections] = splitSections(read("docs", "RULES.md"));
    assert.equal(opening.title, null);
    assert.match(opening.body, /Scenario scaling/);
    assert.deepEqual(sections.map((s) => sectionNumber(s.title)).filter((n) => n !== null), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    assert.equal(sectionLabel(sections.find((s) => sectionNumber(s.title) === 5).title), "5. Land combat");
    const html = renderMarkdown(read("docs", "RULES.md"), rulesLink);
    assert.doesNotMatch(prose(html), /\*\*|```/, "every bold closed, every fence closed");
    assert.equal((html.match(/<table>/g) ?? []).length, (read("docs", "RULES.md").match(/^\|-/gm) ?? []).length, "every table");
    const starter = renderMarkdown(read("docs", "STARTER.md"), rulesLink);
    assert.doesNotMatch(prose(starter), /\*\*/);
    assert.match(starter, /<ol><li>/);
});

test("the address names a tab and a section or scenario; anything else is Start here", () => {
    assert.deepEqual(parseHash(""), { tab: "start" });
    assert.deepEqual(parseHash("#rules"), { tab: "rules", section: null });
    assert.deepEqual(parseHash("#rules-10"), { tab: "rules", section: 10 });
    assert.deepEqual(parseHash("#scenario-europe-1440"), { tab: "scenarios", scenario: "europe-1440" });
    assert.deepEqual(parseHash("#scenarios"), { tab: "scenarios", scenario: null });
    assert.deepEqual(parseHash("#nonsense"), { tab: "start" });
});

test("a scenario's page: what wins, what its x costs, the start, and faiths and the Empire only where it has them", () => {
    const eu = scenarioPage(scenario("europe-1440"), "Europe 1440"), me = scenarioPage(scenario("mitteleuropa"), "Mitteleuropa");
    assert.match(eu, /Hold \*\*227\*\* of the map's 445 settlements/);
    assert.match(eu, /## Scale: x = 3/);
    assert.match(eu, /\| Hand cannons \| Swords \| 4\.5M R \|/);
    assert.match(eu, /Crossing a strait: \*\*30\*\*/);
    assert.match(eu, /Hundred Years' War: England against France/);
    assert.match(eu, /## Religions/);
    assert.doesNotMatch(eu, /## The Holy Roman Empire/);
    assert.match(eu, /All of Europe in 1440/, "its About");
    assert.match(me, /\| Hand cannons \| Swords \| 1\.5M R \|/);
    assert.match(me, /Hold \*\*10\*\* of them/);
    assert.doesNotMatch(me, /## Religions/);
    assert.match(me, /## Achievements of this scenario/);
    for (const page of [eu, me]) {
        assert.doesNotMatch(page, /conqueror|zealot|opportunist|merchant/i, "the computer's characters are not rules");
        assert.doesNotMatch(prose(renderMarkdown(page, (u) => u)), /\*\*/);
    }
});
