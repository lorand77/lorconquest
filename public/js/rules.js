// The Rules page, a section of the shell (shell.js), in three tabs: Start here (docs/STARTER.md, one page for a first game), the
// Rules (docs/RULES.md itself — the file the engine follows — a section at a time) and the Scenarios (each one's facts, written
// from its scenario.json by scenarioinfo.js). The address says which (ruleslogic.js, parseHash), so a link can open any of them:
// the game's 📖 opens the scenario it is played on.
import { requireUser } from "./auth.js";
import { renderMarkdown, splitSections } from "./markdown.js";
import { parseHash, rulesLink, sectionLabel, sectionNumber } from "./ruleslogic.js";
import { scenarioPage } from "./scenarioinfo.js";
import { mountShell } from "./shell.js";

const $ = (id) => document.getElementById(id);
const text = (url) => fetch(url).then((r) => (r.ok ? r.text() : ""));
const [me, starter, rules, scenarios] = await Promise.all([requireUser(), text("/docs/STARTER.md"), text("/docs/RULES.md"),
    fetch("/api/scenarios").then((r) => r.json())]);
mountShell(me);

// RULES.md cut into its sections: the opening note (its title lines aside), then §1 to §11
const [opening, ...sections] = splitSections(rules);
const note = opening.body.split("\n").filter((l) => !/^#{1,3}\s/.test(l)).join("\n").trim();
const strip = (body) => body.replace(/\n-{3,}\s*$/, "").trim();
const data = new Map();                                   // scenario id -> its scenario.json, fetched when first shown

const navLink = (href, label, current) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (current) a.className = "current";
    return a;
};

async function show() {
    const view = parseHash(location.hash);
    for (const a of document.querySelectorAll(".doc-tabs a")) a.classList.toggle("current", a.dataset.tab === view.tab);
    const nav = $("doc-nav"), doc = $("doc");
    nav.hidden = view.tab === "start";
    if (view.tab === "start") {
        doc.innerHTML = renderMarkdown(starter.replace(/^# .*\n/, ""), rulesLink);
    } else if (view.tab === "rules") {
        nav.replaceChildren(navLink("#rules", "Scale and units", view.section === null),
            ...sections.filter((s) => sectionNumber(s.title) !== null).map((s) => navLink(`#rules-${sectionNumber(s.title)}`, sectionLabel(s.title), view.section === sectionNumber(s.title))));
        const s = sections.find((x) => sectionNumber(x.title) === view.section);
        doc.innerHTML = s ? renderMarkdown(`## ${sectionLabel(s.title)}\n\n${strip(s.body)}`, rulesLink) : renderMarkdown(`## Scale and units\n\n${note}`, rulesLink);
    } else {
        const id = scenarios.some((s) => s.id === view.scenario) ? view.scenario : scenarios[0]?.id;
        nav.replaceChildren(...scenarios.map((s) => navLink(`#scenario-${s.id}`, s.name, s.id === id)));
        if (!id) { doc.innerHTML = "<p class=\"hint\">No scenario.</p>"; return; }
        if (!data.has(id)) data.set(id, await fetch(`/scenario/${id}/scenario.json`).then((r) => r.json()));
        doc.innerHTML = renderMarkdown(scenarioPage(data.get(id), scenarios.find((s) => s.id === id).name), (url) => url);
    }
    window.scrollTo(0, 0);
}

window.addEventListener("hashchange", show);
await show();
