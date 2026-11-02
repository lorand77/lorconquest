// Customize (a section of the shell, shell.js): the colours, dark or light — theme.js's choice, which keeps it in the browser
// and applies it on every page — and which notices pop up in the game (notices.js), kept in the browser too. This page only
// shows the two choices and changes them.
import { requireUser } from "./auth.js";
import { mountShell } from "./shell.js";
import { loadNotices, noticeChecklist, resetNotices } from "./notices.js";

const $ = (id) => document.getElementById(id);
mountShell(await requireUser());

const scheme = globalThis.lorconquestScheme;
const radios = [...$("schemes").querySelectorAll("input[name=scheme]")];
const show = () => { for (const r of radios) r.checked = r.value === scheme.current; };
for (const r of radios) r.addEventListener("change", () => { if (r.checked) scheme.choose(r.value); });
window.addEventListener("storage", show);                 // chosen in another tab
show();

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
const drawNotices = () => $("notice-list").replaceChildren(noticeChecklist(make, loadNotices()));
$("notice-reset").addEventListener("click", () => { resetNotices(); drawNotices(); });
window.addEventListener("storage", (e) => { if (e.key === null || e.key === "lorconquest.notices") drawNotices(); });
drawNotices();
