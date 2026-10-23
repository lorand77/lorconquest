// The leaderboard page, a section of the shell (shell.js): every account, ranked over the games it finished (src/game/rooms.js,
// leaderboard).
import { requireUser } from "./auth.js";
import { mountShell } from "./shell.js";

const $ = (id) => document.getElementById(id);
mountShell(await requireUser());
const rows = await (await fetch("/api/leaderboard")).json();
$("empty").hidden = rows.length > 0;
$("board").hidden = rows.length === 0;
$("rows").replaceChildren(...rows.map((r, i) => {
    const tr = document.createElement("tr");
    for (const [k, text] of [[0, i + 1], [1, r.username], [2, r.games], [3, r.shared], [4, r.firsts], [5, r.averagePlace ?? "—"], [6, r.victories]]) {
        const td = document.createElement("td");
        if (k === 1) {
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
