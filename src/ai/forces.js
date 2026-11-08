// The computer player's forces (docs/design.md, "The computer players"): it raises soldiers up to what its law allows
// (all of it at war or under threat, most of it otherwise), arms the unarmed with pikes and the best shot it has
// researched — a third pikes, for pike and shot, till it is rich and has muskets, then muskets alone — replaces old swords and old
// guns with the best gun when rich, and hires mercenaries when a war is going badly, sending them home in
// peace, and buys cannons for its sieges in a war. What it spends comes out of `ctx.budget`, which the economy then shares. Its fleets stay in port — it fights
// no war at sea — and one that ends up at sea, put out of a port that fell, sails home (fleetsHome). Armies piling up in one
// of its settlements — soldiers raised and mercenaries hired come as armies of their own, raiders come home — are merged
// (tidyOrders).
import { menOf } from "../engine/army.js";
import { CANNON_PRICE, MERCENARY_PRICE, MERCENARY_UPKEEP, PEOPLE_PRICE, SHARPSHOOTERS_PER_PASS, SHARPSHOOTER_PRICE, SOLDIER_UPKEEP, WEAPON_PRICE } from "../engine/costs.js";
import { armiesAt, armyCapOf, armySoldiersOf, economyOf, mercenariesOf, militaryPowerOf } from "../engine/index.js";
import { exposed, inland, ownArmies, ownSettlements, stagingSettlement, threatsOf } from "./util.js";
import { routeFor } from "../engine/index.js";
import { threatRatio } from "./economy.js";

const SHOT = ["muskets", "arquebuses", "handCannons"];

// fleets of the country at sea with nothing to do — its port taken from under them (RULES.md §7) — make for a port of its
// own: in their zone if it has one, else they sail to the first neighbouring zone that does (and enter port on a later think).
// At sea they cost crew and count on the navy cap for nothing.
export function fleetsHome(game, code, keep = new Set()) {
    const st = game.state, out = [], zones = game.map.zones;
    const ownPort = (z) => (zones.get(z)?.ports ?? []).filter((p) => st.settlements[p]?.owner === code).sort((a, b) => a - b)[0];
    for (const f of Object.values(st.fleets)) {
        if (f.owner !== code || f.port || f.moving || f.order || keep.has(f.id)) continue;      // (keep: the navy's, navy.js)
        const port = ownPort(f.zone);
        if (port !== undefined) { out.push({ type: "sail", country: code, fleet: f.id, port }); continue; }
        const next = [...zones.get(f.zone).next].sort().find((z) => ownPort(z) !== undefined);
        if (next) out.push({ type: "sail", country: code, fleet: f.id, zone: next });
    }
    return out;
}

export function forceOrders(game, code, fl, ctx) {
    const st = game.state, c = st.countries[code], e = economyOf(game, code), out = [];
    const foes = threatsOf(st, code), atWarNow = foes.length > 0;
    const cmd = (type, rest) => out.push({ type, country: code, ...rest });

    // distress: in the red and losing money, the soldiers above what the law allows go home (their weapons to the reserve),
    // biggest armies first and the least useful men first, never the mercenaries (they are dismissed, not disbanded)
    const cap = armyCapOf(st, code), have = armySoldiersOf(st, code);
    if (c.treasury < 0 && e.moneyPerYear < 0 && have > cap) {
        let over = Math.floor(have - cap);
        for (const a of ownArmies(st, code).sort((x, y) => menOf(y) - menOf(x) || x.id - y.id)) {
            if (over < 1) break;
            if (a.retreating) continue;                    // a retreating army takes no orders
            let free = menOf(a) - a.mercs;
            const men = {};
            for (const w of ["unarmed", "swords", "pikes", "cavalry", "handCannons", "arquebuses", "muskets"]) {
                const n = Math.min(over, free, w === "pikes" ? Math.max(0, a.men.pikes - a.mercs) : a.men[w]);
                if (n < 1) continue;
                men[w] = n;
                over -= n;
                free -= n;
            }
            if (Object.keys(men).length) cmd("disband", { army: a.id, men });
        }
    }

    // rich and with muskets, it gives up pike and shot for muskets alone: no stronger in battle — a third pikes and the rest muskets
    // ties all muskets, man for man — but no weaker after losses or a split (under a third, the guns lose their +20%) and much
    // the stronger on paper (military power counts pikes ×1.2, muskets ×2: RULES.md §5), which is what neighbours and subjects weigh
    const musketsOnly = c.techs.includes("muskets") && ctx.budget > 3 * 0.3 * e.settlementMoney;

    // soldiers
    const wantShare = atWarNow || threatRatio(game, code) > 1 ? 1 : 0.6 + 0.2 * fl.aggression;
    let lots = Math.floor((wantShare * cap - have) / 1000);
    lots = Math.max(0, Math.min(lots, 3, Math.floor(e.civilians / 1000)));
    const affords = (n) => e.moneyPerYear - n * SOLDIER_UPKEEP >= (atWarNow ? -0.2 : 0) * e.settlementMoney;
    while (lots > 0 && !affords(1000 * lots)) lots--;
    // by the hundred, once there is room for fewer than 1000 more (RULES.md §8): the last of what the law allows is raised too
    let hundreds = 0;
    if (!lots && e.raiseRoom < 1000) {
        hundreds = Math.max(0, Math.min(9, Math.floor(Math.min(wantShare * cap - have, e.raiseRoom) / 100)));
        while (hundreds > 0 && !affords(100 * hundreds)) hundreds--;
    }
    const raising = lots * 1000 || hundreds * 100;
    if (raising > 0) {
        const own = ownSettlements(st, code).filter((s) => s.cores.includes(code));
        const capital = own.find((s) => s.id === c.capital), staging = stagingSettlement(game, code);
        const site = capital ?? (staging && own.includes(staging) ? staging : own.sort((a, b) => b.pop - a.pop || a.id - b.id)[0]);
        if (site) {
            // raised armed (RULES.md §8): pikes while they are under a third of the armed men, else the best shot it has — the
            // weapons from the reserve, the lots missing bought now — or unarmed, to be armed later, if the money is not there
            let pikesNow = 0, armedNow = 0;
            for (const a of ownArmies(st, code)) { pikesNow += a.men.pikes; armedNow += menOf(a) - a.men.unarmed; }
            const best = SHOT.find((w) => c.techs.includes(w));
            const weapon = musketsOnly ? "muskets" : !best || pikesNow < (armedNow + raising) / 3 ? "pikes" : best;
            // what the reserve lacks is bought by the lot of 1000, or raising by the hundred, by the hundred at a tenth of the price
            const lot = lots ? 1000 : 100, cost = Math.ceil(Math.max(0, raising - c.reserve[weapon]) / lot) * WEAPON_PRICE[weapon] * lot / 1000;
            const armed = cost <= ctx.budget - 0.3 * e.settlementMoney;
            cmd("raise", { settlement: site.id, kind: "soldiers", ...(lots ? { lots } : { hundreds }), ...(armed ? { weapon } : {}) });
            if (armed) ctx.budget -= cost;
        }
    }

    // arms: the unarmed first, then old swords if there is money to spare, and old guns — hand cannons and arquebuses — given the
    // best gun researched (researching a gun arms nobody: RULES.md §4); pikes stay, for pike and shot — but for muskets alone
    // (musketsOnly), when the money is there for every pikeman of an army at once
    const rich = ctx.budget > 3 * 0.3 * e.settlementMoney;
    const shot = SHOT.find((w) => c.techs.includes(w));
    const jobs = [];
    let pikes = 0, armed = 0;
    for (const a of ownArmies(st, code)) { pikes += a.men.pikes; armed += menOf(a) - a.men.unarmed; }
    const want = (n) => {
        // pikes up to a third of the armed, then shot (or pikes if there is none)
        const toPikes = musketsOnly ? 0 : shot ? Math.max(0, Math.min(n, Math.ceil((armed + n) / 3) - pikes)) : n;
        pikes += toPikes;
        armed += n;
        return shot ? { pikes: toPikes, [shot]: n - toPikes } : { pikes: n };
    };
    const demand = {}, pikemen = [];
    for (const a of ownArmies(st, code).sort((x, y) => x.id - y.id)) {
        if (a.retreating) continue;                       // a retreating army takes no orders
        for (const from of rich ? ["unarmed", "swords"] : ["unarmed"]) {
            const n = Math.min(a.men[from], from === "swords" ? 1500 : a.men[from]);
            if (n < 1 || (from === "swords" && !shot)) continue;
            for (const [to, k] of Object.entries(want(n))) {
                if (k < 1) continue;
                jobs.push({ army: a.id, from, to, n: k });
                demand[to] = (demand[to] ?? 0) + k;
            }
        }
        // guns for guns, so the share of pikes stays as it is — the worst first, which gain the most; up to 1500 an army a think
        for (const from of rich && shot ? SHOT.slice(SHOT.indexOf(shot) + 1).reverse() : []) {
            const n = Math.min(a.men[from], 1500);
            if (n < 1) continue;
            jobs.push({ army: a.id, from, to: shot, n });
            demand[shot] = (demand[shot] ?? 0) + n;
        }
        // an army's pikes all at once or not at all: some of them only would leave it under a third, its guns without their +20%
        if (rich && musketsOnly && a.men.pikes >= 1) {
            pikemen.push({ army: a.id, from: "pikes", to: "muskets", n: a.men.pikes, whole: true });
            demand.muskets = (demand.muskets ?? 0) + a.men.pikes;
        }
    }
    jobs.push(...pikemen);                                // last: what is left of the muskets once the rest are armed
    const bought = {};
    for (const [w, need] of Object.entries(demand)) {
        const short = Math.max(0, need - c.reserve[w]);
        let lotsNeeded = Math.ceil(short / 1000);
        const price = WEAPON_PRICE[w];
        while (lotsNeeded > 0 && lotsNeeded * price > ctx.budget) lotsNeeded--;
        if (lotsNeeded > 0) { cmd("buyWeapons", { weapon: w, lots: lotsNeeded }); ctx.budget -= lotsNeeded * price; }
        bought[w] = c.reserve[w] + lotsNeeded * 1000;
    }
    for (const j of jobs) {
        if (j.whole && (bought[j.to] ?? 0) < j.n) continue;
        const n = Math.min(j.n, Math.floor(bought[j.to] ?? 0));
        if (n < 1) continue;
        bought[j.to] -= n;
        cmd("equip", { army: j.army, from: j.from, to: j.to, n });
    }

    // cannons, in a war with a real country: 100 × x once its law allows 2,000 soldiers, a hundred more for every 4,000, up to
    // three hundreds — each
    // hundred shortens a siege by a fifth and takes 0.3 off the walls in a storm (RULES.md §6). Bought into the reserve a
    // hundred at a time; the main host takes them on (war.js, siege guns).
    if (foes.some((f) => !st.countries[f].rebel)) {
        const lots = Math.max(1, Math.round(game.map.x)), step = 100 * lots, want = cap < 2000 ? 0 : step * Math.min(3, Math.max(1, Math.floor(cap / 4000)));
        const held = c.reserve.cannons + ownArmies(st, code).reduce((n, a) => n + a.cannons, 0);
        const price = CANNON_PRICE * lots;
        if (held < want && ctx.budget >= price + 0.3 * e.settlementMoney) {
            cmd("buyWeapons", { weapon: "cannons", lots });
            ctx.budget -= price;
        }
    }

    // mercenaries — they come on top of the army cap — in a war, as many as the money allows: more when it is going badly, and
    // all of them sent home in peace
    const mine = Math.max(1, militaryPowerOf(st, code));
    const strongest = Math.max(0, ...foes.filter((f) => !st.countries[f].rebel).map((f) => militaryPowerOf(st, f)));
    const hired = mercenariesOf(st, code) + c.hires.reduce((n, h) => n + h.n, 0);
    if (atWarNow && hired + 1000 <= cap && e.moneyPerYear > 2 * MERCENARY_UPKEEP * 1000) {              // 1000 more cost 15 a year each: income must cover it twice over
        const rich = ctx.budget >= 3 * MERCENARY_PRICE, badly = strongest > 1.2 * mine && ctx.budget >= MERCENARY_PRICE;
        const site = stagingSettlement(game, code);
        if ((rich || badly) && site && site.cores.includes(code)) {
            const lotsToHire = Math.min(rich ? 2 : 1, Math.floor((cap - hired) / 1000), Math.floor(ctx.budget / MERCENARY_PRICE));
            if (lotsToHire > 0) { cmd("hireMercenaries", { settlement: site.id, lots: lotsToHire }); ctx.budget -= lotsToHire * MERCENARY_PRICE; }
        }
    } else if (!atWarNow) {
        for (const a of ownArmies(st, code)) if (a.mercs > 0 && a.at && armiesAt(st, a.at).includes(a)) cmd("dismissMercenaries", { army: a.id, n: a.mercs });
    }

    // sharpshooters at the passes of its land that face another country, while its law has room for them
    if (c.techs.includes("sharpshooters")) {
        let room = armyCapOf(st, code) - armySoldiersOf(st, code) - lots * 1000;
        const most = SHARPSHOOTERS_PER_PASS * game.map.x;
        for (const [key, node] of game.map.nodes) {
            if (node.kind !== "pass" || st.settlements[node.land].owner !== code || room < 100) continue;
            if (!game.map.adj.get(key).some((e) => game.map.nodes.get(e.to).kind === "pass" || st.settlements[game.map.nodes.get(e.to).land].owner !== code)) continue;
            const held = st.posts[key]?.n ?? 0, n = Math.min(most - held, room, Math.floor(ctx.budget / SHARPSHOOTER_PRICE) * 100, 500);
            const lotsOf = Math.floor(n / 100);
            if (lotsOf < 1) continue;
            cmd("buySharpshooters", { pass: key, lots: lotsOf });
            ctx.budget -= lotsOf * SHARPSHOOTER_PRICE;
            room -= lotsOf * 100;
        }
    }

    // people: what is left of a hoard buys population, which pays tax, feeds the army cap and counts in the score
    const reserve = 0.3 * e.settlementMoney;
    const peopleLots = Math.min(3, Math.floor((ctx.budget - 4 * reserve) / PEOPLE_PRICE));
    if (peopleLots > 0 && c.treasury > 0) { cmd("buyPeople", { lots: peopleLots }); ctx.budget -= peopleLots * PEOPLE_PRICE; }
    return out;
}

// Armies idle in an inland settlement of the country (util.js, inland: no route from it leads to anyone else's land) march to
// its staging settlement, where they are of use; then, wherever more than MAX_AT_ONCE of the country's idle armies stand in
// one of its own settlements, the smallest are merged into
// the largest until MAX_AT_ONCE are left: a garrison, a host and a raiding party, not a dozen bands. Only armies standing still,
// on the same side of the walls, and given no other order this think (`busy`: their ids) — a merge after a move is refused.
export const MAX_AT_ONCE = 3;
export function tidyOrders(game, code, busy = new Set()) {
    const st = game.state, out = [], places = new Map(), staging = stagingSettlement(game, code);
    for (const a of ownArmies(st, code)) {
        if (!a.at || a.retreating || a.march || a.path.length || busy.has(a.id) || st.settlements[a.at]?.owner !== code) continue;
        const s = st.settlements[a.at];
        if (staging && String(staging.id) !== a.at && !s.siege && !a.relief && inland(game, code, s) && routeFor(game, a, String(staging.id))) {
            out.push({ type: "move", country: code, army: a.id, to: String(staging.id), storm: false });
            continue;
        }
        const key = `${a.at}|${a.relief ? 1 : 0}`;
        if (!places.has(key)) places.set(key, []);
        places.get(key).push(a);
    }
    for (const [, armies] of [...places].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
        if (armies.length <= MAX_AT_ONCE) continue;
        armies.sort((x, y) => menOf(y) + y.cannons - (menOf(x) + x.cannons) || x.id - y.id);       // the largest first
        const into = armies[0];
        for (const a of armies.slice(MAX_AT_ONCE).reverse()) out.push({ type: "merge", country: code, army: a.id, into: into.id });
    }
    return out;
}
