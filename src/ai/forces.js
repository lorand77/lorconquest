// The computer player's forces (docs/design.md, "The computer players"): it raises soldiers up to what its law allows
// (all of it at war or under threat, most of it otherwise), arms the unarmed with pikes and the best shot it has
// researched — a third pikes, for pike and shot — and hires mercenaries when a war is going badly, sending them home in
// peace. What it spends comes out of `ctx.budget`, which the economy then shares. Its fleets stay in port — it fights
// no war at sea — and one that ends up at sea, put out of a port that fell, sails home (fleetsHome).
import { menOf } from "../engine/army.js";
import { MERCENARY_PRICE, MERCENARY_UPKEEP, PEOPLE_PRICE, SHARPSHOOTERS_PER_PASS, SHARPSHOOTER_PRICE, SOLDIER_UPKEEP, WEAPON_PRICE } from "../engine/costs.js";
import { armiesAt, armyCapOf, armySoldiersOf, economyOf, mercenariesOf, militaryPowerOf } from "../engine/index.js";
import { exposed, ownArmies, ownSettlements, stagingSettlement, threatsOf } from "./util.js";
import { threatRatio } from "./economy.js";

const SHOT = ["muskets", "arquebuses", "handCannons"];

// fleets of the country at sea with nothing to do — its port taken from under them (RULES.md §7) — make for a port of its
// own: in their zone if it has one, else they sail to the first neighbouring zone that does (and enter port on a later think).
// At sea they cost crew and count on the navy cap for nothing.
export function fleetsHome(game, code) {
    const st = game.state, out = [], zones = game.map.zones;
    const ownPort = (z) => (zones.get(z)?.ports ?? []).filter((p) => st.settlements[p]?.owner === code).sort((a, b) => a - b)[0];
    for (const f of Object.values(st.fleets)) {
        if (f.owner !== code || f.port || f.moving || f.order) continue;
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

    // soldiers
    const wantShare = atWarNow || threatRatio(game, code) > 1 ? 1 : 0.6 + 0.2 * fl.aggression;
    let lots = Math.floor((wantShare * cap - have) / 1000);
    lots = Math.max(0, Math.min(lots, 3, Math.floor(e.civilians / 1000)));
    while (lots > 0 && e.moneyPerYear - 1000 * lots * SOLDIER_UPKEEP < (atWarNow ? -0.2 : 0) * e.settlementMoney) lots--;
    if (lots > 0) {
        const own = ownSettlements(st, code).filter((s) => s.cores.includes(code));
        const capital = own.find((s) => s.id === c.capital), staging = stagingSettlement(game, code);
        const site = capital ?? (staging && own.includes(staging) ? staging : own.sort((a, b) => b.pop - a.pop || a.id - b.id)[0]);
        if (site) cmd("raise", { settlement: site.id, kind: "soldiers", lots });
    }

    // arms: the unarmed first, then old swords if there is money to spare
    const rich = ctx.budget > 3 * 0.3 * e.settlementMoney;
    const shot = SHOT.find((w) => c.techs.includes(w));
    const jobs = [];
    let pikes = 0, armed = 0;
    for (const a of ownArmies(st, code)) { pikes += a.men.pikes; armed += menOf(a) - a.men.unarmed; }
    const want = (n) => {
        // pikes up to a third of the armed, then shot (or pikes if there is none)
        const toPikes = shot ? Math.max(0, Math.min(n, Math.ceil((armed + n) / 3) - pikes)) : n;
        pikes += toPikes;
        armed += n;
        return shot ? { pikes: toPikes, [shot]: n - toPikes } : { pikes: n };
    };
    const demand = {};
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
    }
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
        const n = Math.min(j.n, Math.floor(bought[j.to] ?? 0));
        if (n < 1) continue;
        bought[j.to] -= n;
        cmd("equip", { army: j.army, from: j.from, to: j.to, n });
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
