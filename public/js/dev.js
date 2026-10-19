// The development page: start a single-player game on any scenario as any country, or open one already played.
// Until accounts and the lobby (milestone 6) this is the way into a game.
import { longDate } from "/engine/index.js";

const $ = (id) => document.getElementById(id);
const scenarios = await (await fetch("/api/scenarios")).json();

$("scenario").replaceChildren(...scenarios.map((s) => new Option(s.name, s.id)));
function fillCountries() {
    const s = scenarios.find((x) => x.id === $("scenario").value);
    const countries = [...s.countries].sort((a, b) => a.name.localeCompare(b.name));
    $("country").replaceChildren(...countries.map((c) => new Option(`${c.name} (${c.code}, ${c.pop / 1000}K)`, c.code)));
}
$("scenario").addEventListener("change", fillCountries);
fillCountries();

$("start").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { scenario: $("scenario").value, country: $("country").value };
    if ($("seed").value !== "") body.seed = Number($("seed").value);
    const res = await fetch("/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) { $("error").textContent = out.error; return; }
    location.href = `/game.html?id=${out.id}`;
});

const names = new Map(scenarios.map((s) => [s.id, s.name]));
const games = await (await fetch("/api/games")).json();
$("games").replaceChildren(...games.map((g) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `/game.html?id=${g.id}`;
    a.textContent = `Game ${g.id}: ${names.get(g.scenario) ?? g.scenario}, ${g.human}, ${longDate(g.day)}`;
    li.append(a, g.status === "active" ? (g.live ? "" : " (could not be started)") : ` (${g.status})`);
    return li;
}));
if (!games.length) $("games").textContent = "None yet.";
