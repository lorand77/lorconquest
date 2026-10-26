// Achievements in the browser (design.md, "Achievements"), as in LorCiv: the profile's cards (card) and the "Achievement
// unlocked" toasts (toast) the lobby and the game page show when the server sends "achievements:earned". The server sends
// every achievement fully described (src/achievements/service.js), so nothing here knows the catalogue. tierLine is the pure
// part, tested in Node.

// a tiered achievement's line under its pips: the tier held and how far along the next, or the top tier
export function tierLine(item) {
    if (!item.tiers) return null;
    if (item.tier >= item.max) return item.tierName;
    return `${item.tier ? `${item.tierName} · ` : ""}${item.progress ?? 0} / ${item.tiers[item.tier]}`;
}

// SQLite's datetime('now') is UTC, like "2026-10-12 13:35:07"
const dateOf = (s) => {
    const d = new Date(String(s).replace(" ", "T") + "Z");
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

// one achievement: greyed while locked, gold-edged at its top tier, with when and the game that earned it
export function card(make, item) {
    const pips = item.tiers ? [make("div", { class: "ach-tiers" }, ...item.tiers.map((n, i) => make("span", { class: `ach-pip${i < item.tier ? " on" : ""}` })),
        make("span", { class: "ach-tier-label" }, tierLine(item)))] : [];
    const meta = item.earnedAt ? [make("div", { class: "ach-meta" }, `Earned ${dateOf(item.earnedAt)}`,
        ...(item.gameId ? [" · ", make("a", { href: `/replay.html?id=${item.gameId}` }, "replay")] : []))] : [];
    const cls = `ach-card${item.tier ? "" : " locked"}${item.tier && item.tier >= item.max ? " maxed" : ""}`;
    return make("div", { class: cls }, make("div", { class: "ach-icon" }, item.icon),
        make("div", { class: "ach-body" }, make("div", { class: "ach-name" }, item.name), make("div", { class: "ach-desc" }, item.desc), ...pips, ...meta));
}

// "Achievement unlocked" (or upgraded, when a lower tier was held), one after another, each a link to the profile's tab
let host = null;
export function toast(list) {
    if (!Array.isArray(list)) return;
    list.forEach((a, i) => setTimeout(() => one(a), i * 600));
}
function one(a) {
    if (!host) {
        host = document.createElement("div");
        host.className = "ach-toasts";
        host.setAttribute("aria-live", "polite");
        document.body.append(host);
    }
    const span = (cls, text) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; };
    const box = document.createElement("a");
    box.className = "ach-toast";
    box.href = "/profile.html#achievements";
    box.title = "See all achievements";
    const body = span("ach-toast-body", "");
    body.append(span("ach-toast-head", a.upgraded ? "Achievement upgraded" : "Achievement unlocked"),
        span("ach-toast-name", a.name + (a.tierName ? ` · ${a.tierName}` : "")), span("ach-toast-desc", a.desc ?? ""));
    box.append(span("ach-toast-icon", a.icon || "🏅"), body);
    host.append(box);
    requestAnimationFrame(() => box.classList.add("show"));
    setTimeout(() => { box.classList.remove("show"); setTimeout(() => box.remove(), 400); }, 7000);
}
