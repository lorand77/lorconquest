// The pages served with the list of every module their script needs, as <link rel="modulepreload"> tags, so the browser asks
// for all of them at once. Without it a page finds its modules one import at a time: the game page's chain runs 14 imports
// deep (game.js → the engine's index.js → … ), each step a round trip to the server, which over the internet is seconds before
// anything shows. The tags are only hints: a module missing from them still loads, a little later.
import fs from "node:fs";
import path from "node:path";

// an import or a re-export, at the start of a line (the modules here have no dynamic imports)
const IMPORT = /^\s*(?:import|export)\s[^;]*?\sfrom\s+"([^"]+)"/gm;
const MODULE_SCRIPT = /<script type="module" src="([^"]+)"><\/script>/g;

// every module the script at `url` ("/js/game.js") needs, itself first; /engine/ is src/engine, the rest public/
export function moduleTree(root, url) {
    const file = (u) => (u.startsWith("/engine/") ? path.join(root, "src", u) : path.join(root, "public", u));
    const seen = new Set();
    const walk = (u) => {
        if (seen.has(u) || !fs.existsSync(file(u))) return;
        seen.add(u);
        for (const m of fs.readFileSync(file(u), "utf8").matchAll(IMPORT)) {
            const spec = m[1];
            if (spec.startsWith("node:")) continue;
            walk(spec.startsWith("/") ? spec : path.posix.join(path.posix.dirname(u), spec));
        }
    };
    walk(url);
    return [...seen];
}

// a page of public/ with the tags for its module scripts' trees put in its <head>
export function withPreloads(root, page) {
    const html = fs.readFileSync(path.join(root, "public", page), "utf8");
    const urls = new Set([...html.matchAll(MODULE_SCRIPT)].flatMap((m) => moduleTree(root, m[1])));
    if (!urls.size) return html;
    const links = [...urls].map((u) => `    <link rel="modulepreload" href="${u}">\n`).join("");
    return html.replace("</head>", `${links}</head>`);
}

// middleware: the pages (and / for index.html) with their preloads — worked out once in production, at each request otherwise,
// so a page edited while the server runs is right at once
export function preloadPages(root, production) {
    const cache = new Map();
    return (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const page = req.path === "/" ? "index.html" : req.path.slice(1);
        if (!/^[\w-]+\.html$/.test(page) || !fs.existsSync(path.join(root, "public", page))) return next();
        let html = production ? cache.get(page) : undefined;
        if (html === undefined) {
            html = withPreloads(root, page);
            if (production) cache.set(page, html);
        }
        res.type("html").send(html);
    };
}
