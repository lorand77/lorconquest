// The leaderboard page, a section of the shell (shell.js): every account, ranked over the games it finished (src/game/rooms.js,
// leaderboard). A click on a column's head sorts by it, a second the other way (lobbylogic.js, sortBoard); each row keeps its
// overall rank in the first column, and your own is marked.
import { requireUser } from "./auth.js";
import { DEFAULT_DIR, sortBoard } from "./lobbylogic.js";
import { mountShell } from "./shell.js";

const $ = (id) => document.getElementById(id);
const [me, rows] = await Promise.all([requireUser(), fetch("/api/leaderboard").then((r) => r.json())]);
mountShell(me);
$("empty").hidden = rows.length > 0;
$("board").hidden = rows.length === 0;

let key = "rank", dir = DEFAULT_DIR.rank;

function render() {
    $("rows").replaceChildren(...sortBoard(rows, key, dir).map((r) => {
        const tr = document.createElement("tr");
        if (r.username === me.username) tr.className = "you";
        for (const [k, text] of [["rank", r.rank], ["username", r.username], ["games", r.games], ["shared", r.shared], ["firsts", r.firsts], ["averagePlace", r.averagePlace ?? "—"], ["victories", r.victories]]) {
            const td = document.createElement("td");
            if (k === "username") {
                // a name opens that player's profile: their stats and the games of theirs that are over
                const a = document.createElement("a");
                a.href = `/profile.html?name=${encodeURIComponent(r.username)}`;
                a.textContent = r.username;
                td.append(a);
            } else td.textContent = String(text);
            tr.append(td);
        }
        return tr;
    }));
    for (const b of document.querySelectorAll("#board button[data-key]")) {
        const on = b.dataset.key === key;
        b.classList.toggle("on", on);
        b.dataset.dir = on ? dir : "";
        b.closest("th").setAttribute("aria-sort", on ? (dir === "asc" ? "ascending" : "descending") : "none");
    }
}

for (const b of document.querySelectorAll("#board button[data-key]")) {
    b.addEventListener("click", () => {
        if (b.dataset.key === key) dir = dir === "asc" ? "desc" : "asc";
        else { key = b.dataset.key; dir = DEFAULT_DIR[key]; }
        render();
    });
}
render();
