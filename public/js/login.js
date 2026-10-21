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
    // only a path on this site: never an address a link could point elsewhere
    const next = new URLSearchParams(location.search).get("next");
    location.href = next && /^\/[^/\\]/.test(next) ? next : "/";
});
