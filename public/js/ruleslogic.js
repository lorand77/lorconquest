// What the Rules page (rules.js) works out without a page: which tab and section an address names, the address of each section
// of RULES.md, its title as the page shows it, and where RULES.md's links go on the site — a scenario's SCENARIO.md to that
// scenario's tab, the rules' own anchors to their sections, any other file to nowhere (just its text). Pure, tested in Node.

// "#start" (and nothing) → Start here; "#rules" → the rules' opening note; "#rules-5" → §5; "#scenario-europe-1440" → that scenario
export function parseHash(hash) {
    const h = decodeURIComponent(String(hash ?? "").replace(/^#/, ""));
    if (h === "rules") return { tab: "rules", section: null };
    const r = /^rules-(\d+)$/.exec(h);
    if (r) return { tab: "rules", section: Number(r[1]) };
    if (h === "scenarios") return { tab: "scenarios", scenario: null };
    const s = /^scenario-([\w-]+)$/.exec(h);
    if (s) return { tab: "scenarios", scenario: s[1] };
    return { tab: "start" };
}

// a RULES.md section's number ("5. LAND COMBAT" → 5), or null for one without
export const sectionNumber = (title) => (/^(\d+)\.\s/.exec(title ?? "") ? Number(/^(\d+)\./.exec(title)[1]) : null);
// its title as the page shows it: "5. LAND COMBAT" → "5. Land combat"
export const sectionLabel = (title) => title.replace(/^(\d+\.\s+)?(.*)$/, (_, n = "", t) => n + t.charAt(0) + t.slice(1).toLowerCase());

// where a link in RULES.md goes on the page, or null for none
export function rulesLink(url) {
    const scenario = /(?:^|\/)scenarios\/([\w-]+)\/SCENARIO\.md(?:#.*)?$/.exec(url);
    if (scenario) return `#scenario-${scenario[1]}`;
    if (/^https?:\/\//.test(url)) return url;
    return null;
}
