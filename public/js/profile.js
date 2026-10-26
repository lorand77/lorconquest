// A profile (a section of the shell, shell.js): who and since when, and two tabs — Stats, the numbers over their games
// (lobbylogic.js, statsOf), and Games. Your own (My Profile) has every game of yours: the ones going to open, the finished ones
// to watch as replays. Someone else's (profile.html?name=…, opened from the leaderboard) has only what anyone signed in may
// see of them (GET /api/players/:name): their games that are over, with their replays, and the numbers over those, and a
// friend control under their name. Friends (friends.js): your own requests to answer, your friends and the requests you sent;
// someone else's accepted friends. Achievements (achievements.js): every one there is, earned or not, fetched when the tab is
// first opened. The tab is the page's hash (#stats, #games, #achievements, #friends), so the rail's links open it.
import { longDate } from "/engine/calendar.js";          // calendar.js alone: index.js would bring the whole engine
import { requireUser } from "./auth.js";
import { gameLine, statsOf } from "./lobbylogic.js";
import { mountShell, profileTab } from "./shell.js";
import * as Friends from "./friends.js";
import { card } from "./achievements.js";

const $ = (id) => document.getElementById(id);
let achievementsDrawn = false;                          // the Achievements tab is drawn when first opened
const make = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "class") e.className = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v);
    }
    e.append(...children);
    return e;
};

// whose profile: ?name=… is someone else's (unless it is yours)
const asked = new URLSearchParams(location.search).get("name");
const json = (r) => r.json().then((body) => ({ ok: r.ok, body }));
// everything at once: who you are, the games, the leaderboard (for your own row) and the scenarios' names
const [me, theirs, mine, board, scenarios] = await Promise.all([requireUser(),
    asked ? fetch(`/api/players/${encodeURIComponent(asked)}`).then(json) : null,
    asked ? null : fetch("/api/games").then((r) => (r.ok ? r.json() : [])).catch(() => []),          // drawn empty, not broken, if the server fails
    asked ? null : fetch("/api/leaderboard").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch("/api/scenarios").then((r) => r.json())]);
mountShell(me);
const own = !asked || theirs?.body?.username === me.username;
if (asked && !theirs.ok) {
    $("name").textContent = asked;
    $("joined").textContent = "There is no such player.";
    document.querySelector(".profile-tabs").hidden = true;
    $("stats-panel").hidden = true;
    throw new Error("no such player");
}
const person = asked ? theirs.body : { username: me.username, joined: me.joined };
const games = asked ? theirs.body.games : mine;
const row = asked ? theirs.body.row : board.find((r) => r.username === me.username);

$("name").textContent = person.username;
document.title = `LorConquest — ${person.username}`;
if (person.joined) {
    const when = new Date(person.joined.replace(" ", "T") + "Z");
    $("joined").textContent = `Playing since ${when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
}
$("tab-games").textContent = own ? "📜 My Games" : "📜 Games";
$("games-title").textContent = own ? "My Games" : `${person.username}'s games that are over`;

// the tab the hash names
function showTab() {
    const tab = profileTab(location.hash);
    $("stats-panel").hidden = tab !== "#stats";
    $("games-panel").hidden = tab !== "#games";
    $("friends-panel").hidden = tab !== "#friends";
    $("achievements-panel").hidden = tab !== "#achievements";
    $("tab-achievements").classList.toggle("current", tab === "#achievements");
    if (tab === "#achievements") drawAchievements();
    $("tab-stats").classList.toggle("current", tab === "#stats");
    $("tab-games").classList.toggle("current", tab === "#games");
    $("tab-friends").classList.toggle("current", tab === "#friends");
}
window.addEventListener("hashchange", showTab);
showTab();

const scenarioOf = (id) => scenarios.find((s) => s.id === id);
const nameOf = (id, code) => scenarioOf(id)?.countries.find((c) => c.code === code)?.name ?? code;

// ---------- Stats ----------
// someone else's count only the games that are over: what is going on in theirs is theirs alone
const s = statsOf(games, row);
const stat = (value, label) => make("div", { class: "stat" }, make("b", {}, String(value)), make("span", {}, label));
$("stat-grid").replaceChildren(...[
    own && stat(s.games, "games played"),
    own && stat(s.going, "going now"),
    stat(s.finished, "finished"),
    stat(s.won, "won"),
    stat(s.winRate === null ? "—" : `${s.winRate}%`, "of finished games won"),
    stat(s.alone, own ? "alone" : "alone, over"),
    stat(s.withOthers, own ? "with other people" : "with other people, over"),
    stat(s.firsts, "first among people"),
    stat(s.averagePlace ?? "—", "average place among people"),
    stat(s.abandoned, "abandoned"),
].filter(Boolean));

// ---------- Games ----------
const played = games.filter((g) => g.status !== "lobby");
$("game-list").replaceChildren(...played.map((g) => {
    const line = gameLine(g, scenarioOf(g.scenario)?.name ?? g.scenario, nameOf(g.scenario, g.country), longDate(g.day), nameOf(g.scenario, g.winner));
    return make("li", {}, line.open && own ? make("a", { href: `/game.html?id=${g.id}` }, line.text) : line.text,
        line.replay ? make("span", {}, " — ", make("a", { href: `/replay.html?id=${g.id}` }, "watch the replay")) : "");
}));
if (!played.length) $("game-list").textContent = own ? "None yet: start one under Play." : "None over yet.";

// ---------- Achievements ----------
// the regular ones by group, then each scenario's own; drawn once, when the tab is first opened
async function drawAchievements() {
    if (achievementsDrawn) return;
    achievementsDrawn = true;
    const r = await fetch(own ? "/api/achievements" : `/api/achievements/user/${encodeURIComponent(person.username)}`).catch(() => null);
    if (!r?.ok) { $("ach-summary").textContent = "Couldn't load the achievements."; achievementsDrawn = false; return; }
    const data = await r.json();
    $("ach-summary").textContent = `${data.earned} of ${data.total} unlocked. Achievements are awarded when a game is finished, by playing it over: it may take a minute.`;
    $("ach-content").replaceChildren(...data.groups.map((g) => make("section", { class: "ach-group" },
        make("h3", {}, `${g.title} `, make("span", { class: "count" }, `${g.items.filter((a) => a.tier).length}/${g.items.length}`)),
        make("div", { class: "ach-grid" }, ...g.items.map((a) => card(make, a))))));
}

// ---------- Friends ----------
const personLink = (name) => make("a", { href: `/profile.html?name=${encodeURIComponent(name)}` }, name);
const friendRow = (name, ...rest) => make("div", { class: "row friend-row" }, make("span", { class: "who" }, personLink(name)), ...rest);
async function drawFriends() {
    try { await Friends.load(); } catch (e) { $("friends-error").textContent = e.message; }
    if (!own) {
        // someone else's: the control under their name, and their friends
        $("friend-ctl").replaceChildren(Friends.control(make, person.username, me.username, drawFriends));
        const theirs = await Friends.friendsOf(person.username).catch(() => []);
        $("friend-requests").replaceChildren();
        $("friend-list").replaceChildren(...theirs.map((f) => friendRow(f.username)));
        if (!theirs.length) $("friend-list").textContent = "No friends yet.";
        return;
    }
    const { friends, incoming, outgoing } = Friends.current();
    const act = (fn) => async () => { try { await fn(); } catch (e) { $("friends-error").textContent = e.message; } drawFriends(); };
    $("friend-requests").replaceChildren(...incoming.map((r) => friendRow(r.username, make("span", { class: "hint" }, "wants to be friends"),
        make("button", { class: "primary", onclick: act(() => Friends.accept(r.id)) }, "Accept"), make("button", { onclick: act(() => Friends.decline(r.id)) }, "Decline"))));
    $("friend-list").replaceChildren(
        ...friends.map((f) => friendRow(f.username, make("button", { onclick: async () => { if (confirm(`Remove ${f.username} from your friends?`)) await act(() => Friends.remove(f.id))(); } }, "Remove"))),
        ...outgoing.map((r) => friendRow(r.username, make("span", { class: "tag" }, "request sent"), make("button", { onclick: act(() => Friends.remove(r.id)) }, "Withdraw"))));
    if (!friends.length && !incoming.length && !outgoing.length) $("friend-list").textContent = "No friends yet: add one from their profile or the leaderboard.";
}
drawFriends();
