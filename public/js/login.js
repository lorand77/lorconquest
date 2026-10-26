// The sign-in page: sign in or create an account, then on to where the visitor was going (or the lobby).
const $ = (id) => document.getElementById(id);
let action = "login";
for (const b of document.querySelectorAll("button[data-action]")) b.addEventListener("click", () => { action = b.dataset.action; });

$("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("error").textContent = "";
    const res = await fetch(`/api/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { $("error").textContent = out.error ?? "Something went wrong."; return; }
    const next = new URLSearchParams(location.search).get("next");
    // only a page of this site: the browser drops tabs and newlines from a URL, so "/%09/evil.com" would be "//evil.com"
    const url = next ? new URL(next, location.origin) : null;
    location.href = url && url.origin === location.origin && next.startsWith("/") ? url.pathname + url.search + url.hash : "/";
});
