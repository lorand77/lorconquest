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
    for (const text of [i + 1, r.username, r.games, r.shared, r.firsts, r.averagePlace ?? "—", r.victories]) {
        const td = document.createElement("td");
        td.textContent = String(text);
        tr.append(td);
    }
    return tr;
}));
