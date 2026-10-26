// The shell of the signed-in pages, as in LorCiv: a top bar (the name, who is signed in, Log out) and a rail of sections on
// the left — Play, My Profile with its Stats, My Games and Friends, Customize and the Leaderboard, with the legal pages at its foot.
// Built here so the sections are listed once. Each page reserves the room for it (body.shell, game.css), so nothing moves
// when it appears; the game and the replay have no shell.
import { signOut } from "./auth.js";

const ITEMS = [
    { href: "/", icon: "▶", label: "Play" },
    { href: "/profile.html", icon: "👤", label: "My Profile", children: [
        { hash: "#stats", icon: "📊", label: "Stats" },
        { hash: "#games", icon: "📜", label: "My Games" },
        { hash: "#achievements", icon: "🏅", label: "Achievements" },
        { hash: "#friends", icon: "👥", label: "Friends" },
    ] },
    { href: "/customize.html", icon: "🎨", label: "Customize" },
    { href: "/leaderboard.html", icon: "🏆", label: "Leaderboard" },
];

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

// the tab of My Profile a hash names; Stats when it names none
export const profileTab = (hash) => (["#games", "#achievements", "#friends"].includes(hash) ? hash : "#stats");

export function mountShell(user) {
    const path = location.pathname === "/index.html" ? "/" : location.pathname;
    // someone else's profile (profile.html?name=…) is not My Profile: its rail items stay links back to yours
    const name = new URLSearchParams(location.search).get("name");
    const yours = path !== "/profile.html" || !name || name.toLowerCase() === user.username.toLowerCase();
    const item = (href, icon, label, cls = "") => make("a", { class: `rail-item ${cls}`.trim(), href }, make("span", { class: "rail-icon" }, icon), make("span", {}, label));
    const rail = make("nav", { class: "app-rail", "aria-label": "Sections" });
    const subs = [];
    for (const it of ITEMS) {
        const parent = item(it.href, it.icon, it.label, it.children ? "rail-parent" : "");
        if (path === it.href && yours) parent.classList.add("current");
        rail.append(parent);
        for (const c of it.children ?? []) {
            const sub = item(it.href + c.hash, c.icon, c.label, "rail-sub");
            subs.push([sub, c.hash]);
            rail.append(sub);
        }
    }
    // the open tab of My Profile is marked, and follows the hash
    const markTab = () => { for (const [sub, hash] of subs) sub.classList.toggle("current", path === "/profile.html" && yours && profileTab(location.hash) === hash); };
    markTab();
    window.addEventListener("hashchange", markTab);
    rail.append(make("div", { class: "rail-legal" }, make("a", { href: "/terms.html" }, "Terms"), make("a", { href: "/privacy.html" }, "Privacy")));
    const top = make("header", { class: "app-topbar" },
        make("a", { class: "brand", href: "/" }, "⬡ LorConquest"),
        make("div", { class: "userbar" }, make("span", { class: "who" }, user.username), make("button", { onclick: signOut }, "Log out")));
    document.body.prepend(top, rail);
}
