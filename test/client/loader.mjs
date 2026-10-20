// Lets the browser modules run in Node: "/engine/x.js", which the page loads from the server, is src/engine/x.js here.
export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("/engine/")) return nextResolve(new URL(`../../src/engine/${specifier.slice(8)}`, import.meta.url).href, context);
    return nextResolve(specifier, context);
}
