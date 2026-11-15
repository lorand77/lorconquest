// A small Markdown reader for the Rules page (rules.js): docs/RULES.md and docs/STARTER.md as they are written, and the scenario
// pages scenarioinfo.js writes, turned into HTML — the rules on the site are the very file the engine follows. Only what those
// files use: headings, paragraphs, **bold**, *italics*, `code`, links, tables, lists, quotes, fenced code and rules (---).
// Pure, and tested in Node. Everything is escaped first, so a "<" in the rules is text, never markup.

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// one line's inline marks; `link(url)` gives the href a link should have, or null to leave just its text
// (code is set aside first, as numbered stand-ins, so a mark may wrap it — **`2d6 + 4`** — but nothing inside it is read)
export function inline(text, link = (url) => url) {
    const codes = [];
    const marked = escape(text.replace(/`([^`]*)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`))
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
            const href = link(url.replace(/&amp;/g, "&"));
            return href ? `<a href="${escape(href)}">${label}</a>` : label;
        })
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])/g, "$1<em>$2</em>");
    return marked.replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${escape(codes[Number(n)])}</code>`);
}

const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

// Markdown text to HTML; `link` as for inline
export function renderMarkdown(text, link) {
    const lines = text.replace(/\r/g, "").split("\n"), out = [];
    const md = (s) => inline(s, link);
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        if (line.startsWith("```")) {
            const body = [];
            for (i++; i < lines.length && !lines[i].startsWith("```"); i++) body.push(lines[i]);
            i++;
            out.push(`<pre><code>${escape(body.join("\n"))}</code></pre>`);
            continue;
        }
        const h = /^(#{1,4})\s+(.*)$/.exec(line);
        if (h) { out.push(`<h${h[1].length}>${md(h[2])}</h${h[1].length}>`); i++; continue; }
        if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
        if (line.trimStart().startsWith("|")) {
            const rows = [];
            for (; i < lines.length && lines[i].trimStart().startsWith("|"); i++) rows.push(lines[i]);
            const separator = rows.length > 1 && /^[\s|:-]+$/.test(rows[1]);
            const head = separator ? `<thead><tr>${cells(rows[0]).map((c) => `<th>${md(c)}</th>`).join("")}</tr></thead>` : "";
            const body = (separator ? rows.slice(2) : rows).map((r) => `<tr>${cells(r).map((c) => `<td>${md(c)}</td>`).join("")}</tr>`).join("");
            out.push(`<div class="table-wrap"><table>${head}<tbody>${body}</tbody></table></div>`);
            continue;
        }
        if (line.startsWith(">")) {
            const body = [];
            for (; i < lines.length && lines[i].startsWith(">"); i++) body.push(lines[i].replace(/^>\s?/, ""));
            out.push(`<blockquote>${renderMarkdown(body.join("\n"), link)}</blockquote>`);
            continue;
        }
        if (LIST.test(line)) {
            const ordered = /^\d/.test(LIST.exec(line)[2]), items = [];
            while (i < lines.length && lines[i].trim()) {
                const m = LIST.exec(lines[i]);
                if (m && !m[1]) items.push(m[3]);
                else if (items.length && (/^\s/.test(lines[i]) || !m)) items[items.length - 1] += " " + lines[i].trim();
                else break;
                i++;
            }
            const tag = ordered ? "ol" : "ul";
            out.push(`<${tag}>${items.map((x) => `<li>${md(x)}</li>`).join("")}</${tag}>`);
            continue;
        }
        const para = [];
        for (; i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*\||\s*---+\s*$)/.test(lines[i]) && !(para.length && LIST.test(lines[i]) && !/^\s/.test(lines[i])); i++) para.push(lines[i].trim());
        out.push(`<p>${md(para.join(" "))}</p>`);
    }
    return out.join("\n");
}

// a document cut at its "## " headings: what comes before the first ({ title: null }), then each section with its title
export function splitSections(text) {
    const parts = [{ title: null, body: [] }];
    let fence = false;
    for (const line of text.replace(/\r/g, "").split("\n")) {
        if (line.startsWith("```")) fence = !fence;
        if (!fence && /^## /.test(line)) parts.push({ title: line.slice(3).trim(), body: [] });
        else parts[parts.length - 1].body.push(line);
    }
    return parts.map((p) => ({ title: p.title, body: p.body.join("\n").trim() }));
}
