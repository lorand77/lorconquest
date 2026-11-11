// The notices over the game's map (design.md, "The game screen"): which kinds pop up, chosen by the player and kept in this
// browser (with the march click below, the only things kept there besides the colours: public/privacy.html), and how many at once. Every notice is in the
// Events tab whatever is chosen; this is only what interrupts. The Customize page and the game's ⚙ edit the same choice.
//
// A notice belongs to a kind (kindOf); a kind is on or off, by default as the screen suits — a phone shows fewer. At most 3
// notices are on the map at once, 2 on a phone; one like a notice showing adds to its count ("×3") instead of stacking
// (pushNotice). Everything but the storage is pure, tested in Node.

export const STORAGE_KEY = "lorconquest.notices";

// What a click on a destination does with an army selected, kept in this browser too: "ask" (the route, with March and March
// and storm), "march" at once, or "storm": march and storm at once — at an enemy settlement; anywhere else it just marches.
export const MARCH_KEY = "lorconquest.march";
export const MARCH_CHOICES = [
    ["ask", "Ask: show the route, with March and March and storm"],
    ["march", "March at once"],
    ["storm", "March and storm at once (at an enemy settlement; elsewhere, march)"],
];
export function loadMarch(storage = globalThis.localStorage) {
    let v = null;
    try { v = storage?.getItem(MARCH_KEY); } catch { v = null; }
    return MARCH_CHOICES.some(([k]) => k === v) ? v : "ask";
}
export function saveMarch(v, storage = globalThis.localStorage) {
    try { storage?.setItem(MARCH_KEY, v); } catch { /* private browsing: kept for this page only */ }
}
// the three choices as radio buttons: each change saved at once, `changed(choice)` told
export function marchChoice(make, current, changed = () => {}) {
    return make("div", { class: "notice-kinds" }, ...MARCH_CHOICES.map(([k, label]) => {
        const r = make("input", { type: "radio", name: "march-click", value: k, checked: k === current ? "checked" : undefined });
        r.addEventListener("change", () => { if (r.checked) { saveMarch(k); changed(k); } });
        return make("label", { class: "notice-kind" }, r, make("span", {}, label));
    }));
}
// what a click on `to` does with the choice made: "ask", or march with storm true or false
export const marchFor = (choice, enemyTown) => (choice === "ask" ? "ask" : { storm: choice === "storm" && enemyTown });

// each kind, what it covers, and whether it is on unless chosen otherwise, on a computer and on a phone
export const NOTICE_KINDS = [
    { key: "war", label: "War", text: "a war declared on you, a siege of one of your settlements, one lost, peasants rising", computer: true, phone: true },
    { key: "questions", label: "Questions", text: "an offer, a demand or a call to arms waiting for your answer, and one that lapses; a protectorate's war you may join", computer: true, phone: true },
    { key: "refused", label: "Refused orders", text: "an order the rules do not allow, and why", computer: true, phone: true },
    { key: "research", label: "Research", text: "a technology done", computer: true, phone: true },
    { key: "diplomacy", label: "Diplomacy", text: "answers, agreements, allies and protectorates joining a war, peace, subjects, the Empire", computer: true, phone: false },
    { key: "armies", label: "Armies", text: "soldiers ready, mercenaries deserting, a strait not crossed, sharpshooters lost, a fleet paid off", computer: true, phone: false },
    { key: "country", label: "Your country", text: "plague, bankruptcy, a default on loans, a good harvest", computer: true, phone: false },
];

const KIND_OF_TYPE = {
    uprising: "war",
    offer: "questions", lapsed: "questions",
    tech: "research",
    answer: "diplomacy", joins: "diplomacy", peace: "diplomacy", subject: "diplomacy", freedom: "diplomacy", agreement: "diplomacy",
    ended: "diplomacy", expired: "diplomacy", refused: "diplomacy", empire: "diplomacy", integrated: "diplomacy", broke: "diplomacy",
    ready: "armies", cancelled: "armies", desertion: "armies", crossFailed: "armies", postLost: "armies", scattered: "armies", fleetPaidOff: "armies",
    bankruptcy: "country", plague: "country", default: "country", harvest: "country",
};

// the kind of notice an event is for `me` (its countries: `who`), or null if it is none of theirs to pop up
export function kindOf(e, me, who, state) {
    if (!me) return null;
    if (e.type === "siegeStart" && state.settlements[e.settlement]?.owner === me) return "war";
    if (e.type === "capture" && e.from === me) return "war";
    return who.includes(me) ? KIND_OF_TYPE[e.type] ?? null : null;
}

// the choice as it stands: what is stored, the rest by the screen's defaults
export function noticePrefs(stored, phone) {
    const out = {};
    for (const k of NOTICE_KINDS) out[k.key] = typeof stored?.[k.key] === "boolean" ? stored[k.key] : k[phone ? "phone" : "computer"];
    return out;
}

// the notices on the map, a new one added: one with the same text counts up and stays longer; the oldest go past `max`
// (list: [{ text, kind, count, until }], newest last)
export function pushNotice(list, text, kind, now, { max = 3, ms = 6000 } = {}) {
    const live = list.filter((n) => n.until > now);
    const same = live.find((n) => n.text === text);
    if (same) return live.map((n) => (n === same ? { ...n, count: n.count + 1, until: now + ms } : n));
    return [...live, { text, kind, count: 1, until: now + ms }].slice(-max);
}

// ---------- the browser's side ----------
export const isPhone = () => typeof matchMedia === "function" && matchMedia("(max-width: 700px), (max-height: 500px)").matches;

export function loadNotices(storage = globalThis.localStorage, phone = isPhone()) {
    let stored = null;
    try { stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null"); } catch { stored = null; }
    return noticePrefs(stored, phone);
}

export function saveNotices(prefs, storage = globalThis.localStorage) {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* private browsing: kept for this page only */ }
}

export function resetNotices(storage = globalThis.localStorage) {
    try { storage?.removeItem(STORAGE_KEY); } catch { /* as above */ }
}

// a checklist of the kinds, for the Customize page and the game's ⚙: each change saved at once, `changed(prefs)` told
export function noticeChecklist(make, prefs, changed = () => {}) {
    return make("div", { class: "notice-kinds" }, ...NOTICE_KINDS.map((k) => {
        const box = make("input", { type: "checkbox", checked: prefs[k.key] ? "checked" : undefined });
        box.addEventListener("change", () => { prefs[k.key] = box.checked; saveNotices(prefs); changed(prefs); });
        return make("label", { class: "notice-kind" }, box, make("span", {}, make("b", {}, k.label), make("small", {}, k.text)));
    }));
}
