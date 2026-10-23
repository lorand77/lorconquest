// My Profile (a section of the shell, shell.js): who you are and since when, and two tabs — Stats, your numbers over every
// game you have played (lobbylogic.js, statsOf), and My Games, all of them: the ones going to open, the finished ones to watch
// as replays. The tab is the page's hash (#stats, #games), so the rail's links open the one they name.
import { longDate } from "/engine/calendar.js";          // calendar.js alone: index.js would bring the whole engine
import { requireUser } from "./auth.js";
import { gameLine, statsOf } from "./lobbylogic.js";
import { mountShell, profileTab } from "./shell.js";

const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else e.setAttribute(k, v);
    }
    e.append(...children);
    return e;
};

// everything at once: who you are, your games, the leaderboard and the scenarios' names
const [me, games, board, scenarios] = await Promise.all([requireUser(),
    fetch("/api/games").then((r) => r.json()), fetch("/api/leaderboard").then((r) => r.json()), fetch("/api/scenarios").then((r) => r.json())]);
mountShell(me);
$("name").textContent = me.username;
if (me.joined) {
    const when = new Date(me.joined.replace(" ", "T") + "Z");
    $("joined").textContent = `Playing since ${when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
}

// the tab the hash names
function showTab() {
    const tab = profileTab(location.hash);
    $("stats-panel").hidden = tab !== "#stats";
    $("games-panel").hidden = tab !== "#games";
    $("tab-stats").classList.toggle("current", tab === "#stats");
    $("tab-games").classList.toggle("current", tab === "#games");
}
window.addEventListener("hashchange", showTab);
showTab();

const scenarioOf = (id) => scenarios.find((s) => s.id === id);
const nameOf = (id, code) => scenarioOf(id)?.countries.find((c) => c.code === code)?.name ?? code;

// ---------- Stats ----------
const s = statsOf(games, board.find((r) => r.username === me.username));
const stat = (value, label) => make("div", { class: "stat" }, make("b", {}, String(value)), make("span", {}, label));
$("stat-grid").replaceChildren(
    stat(s.games, "games played"),
    stat(s.going, "going now"),
    stat(s.finished, "finished"),
    stat(s.won, "won"),
    stat(s.winRate === null ? "—" : `${s.winRate}%`, "of finished games won"),
    stat(s.alone, "alone"),
    stat(s.withOthers, "with other people"),
    stat(s.firsts, "first among people"),
    stat(s.averagePlace ?? "—", "average place among people"),
    stat(s.abandoned, "abandoned"),
);

// ---------- My Games ----------
const played = games.filter((g) => g.status !== "lobby");
$("game-list").replaceChildren(...played.map((g) => {
    const line = gameLine(g, scenarioOf(g.scenario)?.name ?? g.scenario, nameOf(g.scenario, g.country), longDate(g.day));
    return make("li", {}, line.open ? make("a", { href: `/game.html?id=${g.id}` }, line.text) : line.text,
        line.replay ? make("span", {}, " — ", make("a", { href: `/replay.html?id=${g.id}` }, "watch the replay")) : "");
}));
if (!played.length) $("game-list").textContent = "None yet: start one under Play.";
