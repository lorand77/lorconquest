// The lobby, the Play section of the shell (shell.js): start a game alone or open a room, take a free country in someone
// else's, start or cancel your own, and open the games you are in that are still going (the finished ones are under My
// Profile, My Games). The server decides everything (src/game/routes.js); this page asks, and listens for the
// lobby changing and for a room it has a seat in starting. (People see "rooms"; the code and the API say "tables", since
// "rooms" are the games running in src/game/rooms.js.)
import { longDate } from "/engine/calendar.js";          // calendar.js alone: index.js would bring the whole engine
import { requireUser } from "./auth.js";
import { mountShell } from "./shell.js";
import { gameLine, tableActions } from "./lobbylogic.js";

const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
    }
    e.append(...children);
    return e;
};
const post = async (url, body = {}) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, ...(await res.json().catch(() => ({}))) };
};

const [me, scenarios] = await Promise.all([requireUser(), fetch("/api/scenarios").then((r) => r.json())]);
mountShell(me);
const scenarioOf = (id) => scenarios.find((s) => s.id === id);
const nameOf = (id, code) => scenarioOf(id)?.countries.find((c) => c.code === code)?.name ?? code;
// a country's people at the start, as the lists show them: "50K"
const popOf = (id, code) => `${(scenarioOf(id)?.countries.find((c) => c.code === code)?.pop ?? 0) / 1000}K`;

// ---------- a new game ----------
$("scenario").replaceChildren(...scenarios.map((s) => new Option(s.name, s.id)));
function fillCountries() {
    const countries = [...scenarioOf($("scenario").value).countries].sort((a, b) => a.name.localeCompare(b.name));
    $("country").replaceChildren(...countries.map((c) => new Option(`${c.name} (${c.code}, ${c.pop / 1000}K)`, c.code)));
}
$("scenario").addEventListener("change", fillCountries);
fillCountries();

let solo = true;
for (const b of document.querySelectorAll("#start button[data-solo]")) b.addEventListener("click", () => { solo = b.dataset.solo === "1"; });
$("start").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("error").textContent = "";
    const body = { scenario: $("scenario").value, country: $("country").value, solo };
    const r = await post("/api/tables", body);
    if (!r.ok) { $("error").textContent = r.error; return; }
    if (r.started) location.href = `/game.html?id=${r.id}`;
    else refresh();
});

// ---------- tables ----------
function tableItem(t) {
    const scenario = scenarioOf(t.scenario), a = tableActions(t, me, scenario);
    const li = make("li", { class: "table" });
    li.append(make("b", {}, `${scenario.name}, ${t.host}'s room`), ` — ${t.seats.map((s) => `${nameOf(t.scenario, s.country)} ${popOf(t.scenario, s.country)} (${s.username})`).join(", ")}`);
    const row = make("div", { class: "row" });
    const err = make("span", { class: "error" });
    const act = async (url, body) => { const r = await post(url, body); if (!r.ok) err.textContent = r.error; else if (r.id !== undefined && url.endsWith("/start")) location.href = `/game.html?id=${r.id}`; else refresh(); };
    if (a.canJoin) {
        const pick = make("select", {}, ...a.free.map((c) => new Option(`${c.name} (${c.code}, ${c.pop / 1000}K)`, c.code)));
        row.append(pick, make("button", { class: "primary", onclick: () => act(`/api/tables/${t.id}/join`, { country: pick.value }) }, "Take this country"));
    }
    if (a.canLeave) row.append(make("button", { onclick: () => act(`/api/tables/${t.id}/leave`) }, "Give up my seat"));
    if (a.canStart) row.append(make("button", { class: "primary", onclick: () => act(`/api/tables/${t.id}/start`) }, `Start now (the computer plays ${a.computerCountries} countries)`));
    if (a.canCancel) row.append(make("button", { class: "danger", onclick: () => act(`/api/tables/${t.id}/cancel`) }, "Cancel the room"));
    row.append(err);
    li.append(row);
    return li;
}

async function refresh() {
    const [tables, games] = await Promise.all([fetch("/api/tables").then((r) => r.json()), fetch("/api/games").then((r) => r.json())]);
    $("tables").replaceChildren(...tables.map(tableItem));
    if (!tables.length) $("tables").textContent = "None. Open one above.";
    const going = games.filter((g) => g.status === "active");                 // a room not yet started is under Rooms
    $("games").replaceChildren(...going.map((g) => {
        const line = gameLine(g, scenarioOf(g.scenario)?.name ?? g.scenario, nameOf(g.scenario, g.country), longDate(g.day));
        return make("li", {}, line.open ? make("a", { href: `/game.html?id=${g.id}` }, line.text) : line.text, line.replay ? make("span", {}, " — ", make("a", { href: `/replay.html?id=${g.id}` }, "watch the replay")) : "");
    }));
    if (!going.length) $("games").textContent = "None going.";
}

// ---------- live ----------
const socket = globalThis.io({ transports: ["websocket"] });
socket.on("connect", () => { socket.emit("lobby:enter", {}); refresh(); });
socket.on("lobby:changed", refresh);
socket.on("table:started", (m) => { location.href = `/game.html?id=${m.id}`; });
socket.on("table:cancelled", refresh);
socket.on("connect_error", (e) => { if (e.message === "sign in first") location.href = "/login.html"; });
refresh();
