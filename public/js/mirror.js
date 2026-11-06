// The browser's copy of the game and the geometry of drawing it: the state kept up to date from each day's
// changes (src/game/view.js), where an army stands or marches on the map, the roads an order would take.
// Pure functions, no DOM, so the tests run them in Node.

// one day's public changes into the mirrored state
export function applyChanges(state, changes) {
    state.day = changes.day;
    for (const name of ["armies", "fleets", "settlements", "posts"]) {
        for (const [id, x] of Object.entries(changes[name] ?? {})) {
            if (x === null) delete state[name][id];
            else state[name][id] = x;
        }
    }
    for (const [code, c] of Object.entries(changes.countries ?? {})) {
        if (c === null) delete state.countries[code];               // an uprising that is over
        else state.countries[code] = { ...state.countries[code], ...c };
    }
    if (changes.wars) state.wars = changes.wars;
    for (const name of ["agreements", "warInfo", "memory"]) if (changes[name]) state[name] = changes[name];
    if ("winner" in changes) state.winner = changes.winner;
}

// one's own country's private changes (its treasury)
export function applyPrivate(state, code, changes) {
    state.countries[code] = { ...state.countries[code], ...changes };
}

// every leg's line on the map, both ways: "37>48" -> [[x, y], ...]. A route through a pass is split at the pass.
export function buildLegs(scenario) {
    const legs = new Map(), passes = new Map(scenario.passes.map((p) => [p.id, p]));
    const xy = new Map(scenario.settlements.map((s) => [String(s.id), [s.x, s.y]]));
    for (const p of scenario.passes) xy.set(p.id, [p.x, p.y]);
    const add = (a, b, pts) => {
        if (legs.has(`${a}>${b}`)) return;
        legs.set(`${a}>${b}`, pts);
        legs.set(`${b}>${a}`, [...pts].reverse());
    };
    for (const r of scenario.routes) {
        if (r.type !== "land") continue;
        const a = String(r.from), b = String(r.to);
        if (r.pass) {
            const p = passes.get(r.pass), i = r.points.findIndex((q) => q[0] === p.x && q[1] === p.y);
            if (i > 0) {
                add(a, r.pass, r.points.slice(0, i + 1));
                add(r.pass, b, r.points.slice(i));
            } else {
                add(a, r.pass, [xy.get(a), xy.get(r.pass)]);
                add(r.pass, b, [xy.get(r.pass), xy.get(b)]);
            }
        } else add(a, b, r.points);
    }
    return legs;
}

const clamp01 = (f) => Math.min(1, Math.max(0, f));
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

// the point a fraction `f` of the way along a line, and the line from there on
export function along(points, f) {
    const lengths = points.slice(1).map((p, i) => dist(points[i], p));
    let left = clamp01(f) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
        if (left <= lengths[i] || i === lengths.length - 1) {
            const t = lengths[i] ? Math.min(1, left / lengths[i]) : 0;
            const at = [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
            return { at, rest: [at, ...points.slice(i + 1)] };
        }
        left -= lengths[i];
    }
    return { at: points[0], rest: points };
}

export const progress = (march, day) => clamp01((day - march.start) / (march.end - march.start));

// where an army is drawn on `day` (a fraction of a day between ticks): its place, or along its leg
export function armyPoint(army, day, legs, nodes) {
    if (army.at) { const n = nodes.get(army.at); return [n.x, n.y]; }
    const pts = legs.get(`${army.march.from}>${army.march.to}`);
    return pts ? along(pts, progress(army.march, day)).at : [nodes.get(army.march.to).x, nodes.get(army.march.to).y];
}

// the line of a route from where an army is now along `path` (the places it will reach, as the engine's route
// finding gives them): from a place, or from a point on its leg — onwards, or back the way it came
export function routeLine(army, path, day, legs, nodes) {
    const pts = [];
    let from;
    if (army.at) {
        from = army.at;
        pts.push([nodes.get(from).x, nodes.get(from).y]);
    } else {
        const m = army.march, f = progress(m, day);
        const back = path[0] === m.from;
        const leg = back ? legs.get(`${m.to}>${m.from}`) : legs.get(`${m.from}>${m.to}`);
        pts.push(...along(leg, back ? 1 - f : f).rest);
        from = path[0];
        path = path.slice(1);
    }
    for (const k of path) {
        const leg = legs.get(`${from}>${k}`) ?? [[nodes.get(from).x, nodes.get(from).y], [nodes.get(k).x, nodes.get(k).y]];
        pts.push(...leg.slice(1));
        from = k;
    }
    return pts;
}

// "750", "1.2k", "12k"
export function formatMen(n) {
    if (n < 1000) return String(n);
    if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `${Math.round(n / 1000)}k`;
}

// a whole number with thousands separated: "1,060,000"
export const formatNumber = (n) => Math.round(n).toLocaleString("en-GB");

// money in a few characters, for a phone's slim bar: 980, 12K, 123K, 1.2M, 12M — a minus sign before a debt
export function shortMoney(n) {
    const a = Math.abs(n), sign = n < 0 ? "−" : "";
    if (a < 1000) return sign + Math.round(a);
    if (a < 1e6) return sign + (a < 1e4 ? (Math.floor(a / 100) / 10).toFixed(1).replace(/\.0$/, "") : Math.floor(a / 1000)) + "K";
    return sign + (a < 1e7 ? (Math.floor(a / 1e5) / 10).toFixed(1).replace(/\.0$/, "") : Math.floor(a / 1e6)) + "M";
}

// a date in few characters: "3 Mar 1452"
export const shortDate = (longText) => longText.replace(/^(\d+) (\w{3})\w* (\d+)$/, "$1 $2 $3");

// where each fleet is drawn on `day`: in a port, a column out into the water it faces (scenario.json, seaZones[].harbours); at
// sea, a column below its zone's name, kept off land (seaZones[].fleets); on its way, along the sea lane between the two zones'
// first spots (seaZones[].lanes) — a Map from fleet id to [x, y]. tools/map.js finds the spots in clear water; a map without them
// gets the old ones, below the port's marker and the zone's name. More fleets than spots go on along the column's line.
const column = (spots, i) => {
    if (i < spots.length) return spots[i];
    const last = spots[spots.length - 1], prev = spots[spots.length - 2] ?? [last[0], last[1] - 16], k = i - spots.length + 1;
    return [last[0] + (last[0] - prev[0]) * k, last[1] + (last[1] - prev[1]) * k];
};
export function fleetPoints(state, nodes, zones, day) {
    const out = new Map(), slots = new Map();
    const slot = (key) => { const i = slots.get(key) ?? 0; slots.set(key, i + 1); return i; };
    const zoneAt = (id, i) => {
        const z = zones.get(id);
        return z.fleets?.length ? column(z.fleets, i) : [z.label.x, z.label.y + 14 + i * 16];
    };
    for (const f of Object.values(state.fleets)) {
        if (f.moving) {
            // along the sea lane between the two zones (tools/map.js: through the water, never across land), or straight
            const from = zoneAt(f.zone, 0), to = zoneAt(f.moving.to, 0), t = clamp01((day - f.moving.start) / (f.moving.end - f.moving.start));
            const lane = zones.get(f.zone).lanes?.[f.moving.to];
            out.set(f.id, lane?.length >= 2 ? along(lane, t).at : [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
        } else if (f.port) {
            const n = nodes.get(String(f.port)), spots = zones.get(n.zone)?.harbours?.[f.port], i = slot(`p${f.port}`);
            out.set(f.id, spots?.length ? column(spots, i) : [n.x - 8, n.y + 20 + i * 16]);
        } else out.set(f.id, zoneAt(f.zone, slot(`z${f.zone}`)));
    }
    return out;
}

// the tab a selection on the map opens (design.md, "The game screen"): an army or a fleet its panel on the Map tab, one of the
// player's own settlements the Shop (to build there), anyone else's settlement or a pass the Map tab, the player's own land the
// Country tab, another country's land the Diplomacy tab (to deal with it) — peasant rebels', with whom there is no dealing,
// the Map tab. Nothing selected (a click on the sea) keeps the tab there is. `place` is the clicked place's map node, if any.
// The game page's keys (design.md, "The game screen"): the table the ? card shows, and what a key press asks for (hotkey).
// Arrow keys pan; W A S D are plain letters. A key with Ctrl, Alt or ⌘ is the browser's, never the game's.
export const HOTKEYS = [
    ["Space", "play / pause (alone)"], ["1 – 6", "the tabs: Map, Country, Shop, Research, Diplomacy, Events"], ["D", "the Diplomacy tab"],
    ["+  −", "zoom in / out"], ["arrows", "pan the map"], ["W", "the whole map"],
    ["A or Tab", "your next army (Shift: the one before)"], ["F", "your next fleet"],
    ["Enter", "march, once a destination is picked"], ["Shift+Enter", "march and storm"], ["T", "storm"], ["B", "sortie"],
    ["S", "split the army…"], ["M", "merge it into another of yours there"],
    ["C", "chat (with other people)"], ["N", "which notices pop up"], ["P", "save a picture of the map"],
    ["?", "this card"], ["Escape", "close, cancel a march, let go of what is selected"],
];
const TABS = ["selection", "country", "shop", "research", "diplomacy", "events"];
// what a key press asks for, or null: "pause", "tab:<tab>", "zoomIn", "zoomOut", "pan:<dx>,<dy>", "whole", "army:<±1>",
// "fleet", "march", "marchStorm", "storm", "sortie", "split", "merge", "chat", "notices", "picture", "help", "escape"
export function hotkey({ key, shiftKey = false, ctrlKey = false, altKey = false, metaKey = false }) {
    if (ctrlKey || altKey || metaKey) return null;
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (/^[1-6]$/.test(k)) return `tab:${TABS[Number(k) - 1]}`;
    const arrows = { ArrowLeft: "pan:-1,0", ArrowRight: "pan:1,0", ArrowUp: "pan:0,-1", ArrowDown: "pan:0,1" };
    if (arrows[k]) return arrows[k];
    switch (k) {
        case " ": return "pause";
        case "+": case "=": return "zoomIn";
        case "-": case "_": return "zoomOut";
        case "w": return "whole";
        case "a": case "Tab": return shiftKey ? "army:-1" : "army:1";
        case "f": return "fleet";
        case "Enter": return shiftKey ? "marchStorm" : "march";
        case "t": return "storm";
        case "b": return "sortie";
        case "s": return "split";
        case "m": return "merge";
        case "d": return "tab:diplomacy";
        case "c": return "chat";
        case "n": return "notices";
        case "p": return "picture";
        case "?": return "help";
        case "Escape": return "escape";
        default: return null;
    }
}

// The panel as a sheet over the map on a phone held upright (design.md, "The game screen"; game.css, body[data-sheet]): collapsed
// to the tabs and a line of status, half the screen, or nearly all of it. What a gesture or a click makes of it:
//   "tap" the handle: collapsed → half → full → collapsed;  "up" / "down": a swipe on the handle, one step, no further;
//   "select" something on the map, or "tab" a tab: at least half, to show it;  "deselect": as it is.
export const SHEETS = ["collapsed", "half", "full"];
export function sheetAfter(sheet, action) {
    const i = Math.max(0, SHEETS.indexOf(sheet));
    if (action === "tap") return SHEETS[(i + 1) % SHEETS.length];
    if (action === "up") return SHEETS[Math.min(SHEETS.length - 1, i + 1)];
    if (action === "down") return SHEETS[Math.max(0, i - 1)];
    if (action === "select" || action === "tab") return i === 0 ? "half" : SHEETS[i];
    return SHEETS[i];
}

export function tabForSelection(sel, me, { place = null, owner = null, rebel = false } = {}) {
    if (!sel) return null;
    if (sel.kind === "army" || sel.kind === "fleet") return "selection";
    if (sel.kind === "place") return place?.kind === "settlement" && owner === me ? "shop" : "selection";
    if (sel.kind === "country") return sel.code === me ? "country" : rebel ? "selection" : "diplomacy";
    return "selection";
}

// the part of the map in view, kept on the map (design.md, "The map on screen"): shaped like the box it is shown in (its width
// over its height, `aspect`), no wider than the map nor taller, and never past an edge — so nothing beyond the map shows.
// Zoomed in at most to a twelfth of the map's width. `view` is { x, y, w } (the height follows); returns { x, y, w, h }.
export function fitView(view, W, H, aspect) {
    const most = Math.min(W, H * aspect), least = Math.min(W / 12, most);
    const w = Math.min(most, Math.max(least, view.w)), h = w / aspect;
    const x = Math.min(W - w, Math.max(0, view.x)), y = Math.min(H - h, Math.max(0, view.y));
    return { x, y, w, h };
}

// the weapons the screen offers first, the best first
export const BEST_FIRST = ["muskets", "arquebuses", "cavalry", "handCannons", "pikes", "swords"];

// what arming `n` men with `weapon` costs (RULES.md §8, Raising forces): the reserve first, then whole lots of 1000 at `price` a
// lot — or, for cannons, one for every 10 men, in lots of 100; raising by the hundred (`hundreds`), in lots a tenth of those,
// at a tenth of the price
export function armingCost(reserve, weapon, n, price, hundreds = false) {
    if (weapon === "unarmed" || n <= 0) return { lots: 0, cost: 0 };
    const part = hundreds ? 10 : 1;
    const [need, lot] = weapon === "cannons" ? [n / 10, 100 / part] : [n, 1000 / part];
    const lots = Math.ceil(Math.max(0, need - (reserve[weapon] ?? 0)) / lot);
    return { lots, cost: lots * price / part };
}

// the one-click arming of `n` men: the best weapon `country` has unlocked whose missing lots its treasury can pay, or null
export function bestArming(country, n, prices) {
    if (n <= 0) return null;
    for (const weapon of BEST_FIRST) {
        if (!country.techs.includes(weapon)) continue;
        const { lots, cost } = armingCost(country.reserve, weapon, n, prices[weapon]);
        if (cost <= country.treasury) return { weapon, n, lots, cost };
    }
    return null;
}

// Researching a gun arms nobody (RULES.md §4): the men keep what they carry until re-equipped. Modernising is that re-equipping
// at one click: the swords and the older guns an army carries — never its pikes, which make guns stronger in pike and shot, nor
// its cavalry, which does what guns cannot (§5) — given the best gun `country` has unlocked, the worst-armed first, as many as
// the reserve and the treasury (in whole lots of 1000) allow. Their old weapons go to the reserve. Null if there is nothing to do.
export const GUNS = ["muskets", "arquebuses", "handCannons"];
const BY_RANK = ["swords", "handCannons", "arquebuses", "muskets"];     // worst first
export function modernising(country, men, prices) {
    const best = GUNS.find((w) => country.techs.includes(w));
    if (!best) return null;
    const old = BY_RANK.slice(0, BY_RANK.indexOf(best)).filter((w) => men[w] > 0);
    const want = old.reduce((n, w) => n + men[w], 0);
    if (!want) return null;
    const have = country.reserve[best] ?? 0, price = prices[best];
    const lots = Math.max(0, Math.min(Math.ceil(Math.max(0, want - have) / 1000), Math.floor(Math.max(0, country.treasury) / price)));
    let left = Math.min(want, have + lots * 1000);
    if (left < 1) return { weapon: best, want, n: 0, lots: 0, cost: 0, jobs: [] };
    const jobs = [];
    for (const w of old) { const k = Math.min(men[w], left); if (k > 0) { jobs.push({ from: w, n: k }); left -= k; } }
    return { weapon: best, want, n: jobs.reduce((n, j) => n + j.n, 0), lots, cost: lots * price, jobs };
}

// the men of `me`'s armies carrying weapons older than `weapon`, just researched — what a notice says modernising would reach
export function outdatedMen(state, me, weapon) {
    if (!GUNS.includes(weapon)) return 0;
    const country = { techs: [weapon], reserve: {}, treasury: 0 };
    return Object.values(state.armies).filter((a) => a.owner === me).reduce((n, a) => n + (modernising(country, a.men, { [weapon]: 1 })?.want ?? 0), 0);
}

// is the click on the army or fleet that is selected already? Then it deselects it (design.md, "The game screen")
export const isSelected = (sel, hit) => Boolean(sel) && (hit.kind === "army" || hit.kind === "fleet") && sel.kind === hit.kind && sel.id === hit.id;

// The screen at the end (design.md, "The game screen"): what `me` sees when the game is over, or when their country falls in
// a game that goes on. `end` is the server's word — { winner, why ("reached" or "end"), defeated, abandoned } — or { out: true }
// for a country fallen while the others play on (`me` null for someone watching); `table` is the engine's scores (victory.js); `names` and `players` give each
// country's name and its person, if it has one; `target` the scenario's number of settlements and `endYear` its last year.
// Returns { kind: "victory" | "defeat" | "over", title, subtitle, final, rows }: the ten countries ahead (and `me` after them if
// not among them), each { rank, code, name, player, settlements, pop, you, winner }.
export function endScreen({ me, end, table, names, players = {}, target, endYear }) {
    const name = (c) => names[c] ?? c;
    const order = Object.keys(table).sort((a, b) => (b === end.winner) - (a === end.winner) || table[b].settlements - table[a].settlements || table[b].pop - table[a].pop || (a < b ? -1 : 1));
    const row = (code) => ({ rank: order.indexOf(code) + 1, code, name: name(code), player: players[code] ?? null, settlements: table[code].settlements, pop: table[code].pop, you: code === me, winner: code === end.winner });
    const rows = order.slice(0, 10).map(row);
    if (table[me] && !rows.some((r) => r.you)) rows.push(row(me));
    const how = (c) => (end.why === "end" ? `holding the most settlements when ${endYear} came, ${table[c]?.settlements ?? 0}`
        : `holding ${table[c]?.settlements ?? 0} settlements of the ${target} needed`);
    const who = (c) => `${name(c)}${players[c] && c !== me ? ` (${players[c]})` : ""}`;
    if (end.abandoned) return { kind: "over", title: "Game over", subtitle: "Everyone has left the game.", final: true, rows };
    // every person gone, some eliminated before: finished, the people ranked by how long they lasted (rooms.js, checkEnd)
    if (end.why === "left") return { kind: "over", title: "Game over", subtitle: "Everyone has left. The people are ranked by how long they lasted; nobody won.", final: true, rows };
    // someone watching (no country): who won, neither a victory nor a defeat of theirs
    if (!me) return { kind: "over", title: "Game over", subtitle: end.winner ? `${who(end.winner)} wins, ${how(end.winner)}.` : "Every player's country has fallen.", final: true, rows };
    if (end.out) return { kind: "defeat", title: "Defeat", subtitle: `${name(me)} is no more: its last settlement has fallen. The others play on; you may watch to the end.`, final: false, rows };
    if (end.defeated || !end.winner) {
        const many = Object.keys(players).length > 1;
        return { kind: "defeat", title: "Defeat", subtitle: many ? "Every player's country has fallen." : `${name(me)} is no more: its last settlement has fallen.`, final: true, rows };
    }
    if (end.winner === me) return { kind: "victory", title: "Victory!", subtitle: `${name(me)} wins, ${how(me)}.`, final: true, rows };
    return { kind: "defeat", title: "Defeat", subtitle: `${who(end.winner)} wins, ${how(end.winner)}.`, final: true, rows };
}

// A war declared on `me`, from one day's events, for the war banner (design.md, "The game screen"): who declared, who joins
// them against `me`, and who joins `me` against them (the countries that join a war against a declarer). Null if none was
// declared on `me` that day. `wars` carries over what an open banner already shows, so later joiners add to it.
export function warAlert(events, me, wars = { attackers: [], against: [], allies: [] }) {
    const out = { attackers: [...wars.attackers], against: [...wars.against], allies: [...wars.allies] };
    const add = (list, c) => { if (!list.includes(c)) list.push(c); };
    let any = false;
    for (const e of events) if (e.type === "war" && e.target === me) { add(out.attackers, e.country); any = true; }
    if (!any && !out.attackers.length) return null;
    for (const e of events) {
        if (e.type !== "joins" || e.country === me) continue;
        if (e.enemy === me) add(out.against, e.country);
        else if (out.attackers.includes(e.enemy)) add(out.allies, e.country);
    }
    return any || out.against.length > wars.against.length || out.allies.length > wars.allies.length ? out : null;
}

// the tech a country is offered at one click when it researches nothing: the cheapest it may research now (its prerequisite
// held, itself not), by `costOf(id)`; null if there is none. `techs` is the engine's TECHS, `owned` the country's techs.
export function cheapestOpenTech(techs, owned, costOf) {
    const open = Object.entries(techs).filter(([id, t]) => !owned.includes(id) && owned.includes(t.needs)).map(([id]) => id);
    return open.sort((a, b) => costOf(a) - costOf(b))[0] ?? null;
}

// Whether a hand is pressing in the panel, which the days' rebuilds of it must not replace (a click is a press and a release
// on the same button: a button rebuilt between them swallows it). The click itself ends the press, before the button's own
// handler runs (game.js listens for it in the capture phase), so what a click asks to redraw is redrawn at once; a press
// released without a click (a drag) ends just after the release. `later(fn)` defers, setTimeout in the browser.
export function pressGuard(later) {
    let pressed = false;
    return {
        get pressed() { return pressed; },
        down() { pressed = true; },
        click() { pressed = false; },
        up() { if (pressed) later(() => { pressed = false; }); },
    };
}

// The live scoreboard (design.md, "The game screen"): the five countries ahead by `key` — "settlements" (as victory counts
// them: vassals' 1, protectorates' ½, ties to the most people), "people" (their own and their subjects') or "military" (the
// power diplomacy weighs) — and `me` after them if not among them. `table` is the engine's scores, `power` each country's
// military power, `alive` the countries still in the game. Rows: { rank, code, value, you }.
export function scoreboard({ table, power, alive, me = null, key = "settlements", n = 5 }) {
    const value = (c) => (key === "people" ? table[c].pop : key === "military" ? power[c] ?? 0 : table[c].settlements);
    const order = alive.filter((c) => table[c]).sort((a, b) => value(b) - value(a) || table[b].pop - table[a].pop || (a < b ? -1 : 1));
    const row = (c, i) => ({ rank: i + 1, code: c, value: value(c), you: c === me });
    const rows = order.slice(0, n).map(row);
    const mine = order.indexOf(me);
    if (mine >= n) rows.push(row(me, mine));
    return rows;
}

// Two fingers on the map (mapview.js): the view zoomed by how far apart they are now against when they touched down (`from`,
// `to`, in pixels), keeping the map point that was under their midpoint (`anchor`) under it now (`at`, pixels from the box's
// top left); `width` is the box's width in pixels. Kept on the map and within its zoom as fitView keeps any view.
export function pinchView(start, { from, to, anchor, at, width }, W, H, aspect) {
    const w = fitView({ ...start, w: start.w * from / Math.max(1, to) }, W, H, aspect).w, k = w / width;
    return fitView({ x: anchor.x - at.x * k, y: anchor.y - at.y * k, w }, W, H, aspect);
}

// how compliant a settlement's people are with its owner (RULES.md §2): the share of the 20 years held after which a courthouse
// may be bought, making it core. { core } for a settlement core for its owner already; else { pct (0-100), daysLeft, ready }.
export function compliance(s, day, coringDays) {
    if (s.cores.includes(s.owner)) return { core: true };
    const held = Math.max(0, day - (s.heldSince ?? 0));
    return { core: false, pct: Math.min(100, Math.floor(held / coringDays * 100)), daysLeft: Math.max(0, Math.ceil(coringDays - held)), ready: held >= coringDays };
}
