// The computer player's war (docs/design.md, "The computer players", operations and reflexes): it keeps a garrison in
// every settlement (and, when it means to declare a war, even before it), musters the rest of its armed men into one host at a staging settlement, and marches the host on
// the settlement it can take soonest — by storm if it is strong enough, else by siege — or on an enemy army it can
// beat, or to the relief of a besieged settlement of its own. Garrisons sortie when they outmatch the besiegers.
//
// Everything is read from the state, nothing is remembered: a restarted game plays on as before. An army's id is only
// known once its split has been applied, so musters take two thinks (the second a tick after the first, see index.js).
import { mayFight } from "../engine/battle.js";
import { armyList, isFriend, isRebel, situation, siegeDays } from "../engine/index.js";
import { WEAPONS } from "../engine/army.js";
import { armyPower, enemiesOf, forcePower, garrisonFloor, garrisons, ownArmies, ownSettlements, reachFrom, stagingSettlement } from "./util.js";

const wallsFactor = (s) => (s.walls ? 1.8 : 1.2);
const menIn = (a) => WEAPONS.reduce((n, w) => n + a.men[w], 0);
const armedIn = (a) => menIn(a) - a.men.unarmed;

// an enemy army out in the open: not inside a settlement of its own country
const inTheOpen = (st, a) => !a.at || st.settlements[a.at]?.owner !== a.owner;

// the place an army is, or is on its way to
const placeOf = (a) => a.at ?? a.march?.to ?? null;

// our own settlements under siege, and the armies besieging them
function besiegedOwn(game, code) {
    const out = [];
    for (const s of ownSettlements(game.state, code)) {
        if (!s.siege) continue;
        const sit = situation(game, String(s.id));
        out.push({ s, key: String(s.id), hostile: sit.hostile, garrison: sit.garrison });
    }
    return out;
}

// garrisons that outmatch their besiegers break out (RULES.md §6)
export function sorties(game, code, out) {
    const st = game.state;
    for (const b of besiegedOwn(game, code)) {
        if (!b.garrison.length || !b.hostile.length) continue;
        const mine = b.garrison.filter((a) => a.owner === code);
        if (!mine.length || !mayFight(st, mine, b.hostile)) continue;
        if (forcePower(b.garrison) >= 1.4 * forcePower(b.hostile)) out.push({ type: "sortie", country: code, army: mine[0].id });
    }
}

// idle armies of ours outside the garrisons, grouped by the place they stand in
function hostsOf(st, code) {
    const keep = new Set([...garrisons(st, code).values()].map((a) => a.id)), groups = new Map();
    for (const a of ownArmies(st, code)) {
        if (keep.has(a.id) || !a.at || a.retreating || a.relief || a.path.length || isRebel(st, code)) continue;
        if (!groups.has(a.at)) groups.set(a.at, []);
        groups.get(a.at).push(a);
    }
    return groups;
}

// `defend`: a caretaker's war — only the armies it has, only within its own and its friends' land: to relieve a besieged
// settlement or meet an enemy army that has come in. It musters, merges, gathers and attacks nothing.
export function warOrders(game, code, fl, { muster = true, prepare = false, defend = false } = {}) {
    const st = game.state, out = [], foes = new Set(enemiesOf(st, code));
    const realFoes = [...foes].filter((c) => !isRebel(st, c));
    sorties(game, code, out);
    if (!foes.size && !prepare) return out;

    const base = stagingSettlement(game, code), baseKey = base ? String(base.id) : null;
    const enemyArmies = armyList(st).filter((a) => foes.has(a.owner));
    const field = enemyArmies.filter((a) => inTheOpen(st, a));
    const ratio = 1.5 - 0.4 * fl.aggression;
    const sieges = besiegedOwn(game, code);

    for (const [at, group] of [...hostsOf(st, code)].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        group.sort((a, b) => a.id - b.id);
        const host = group[0], ours = forcePower(group);
        if (defend && group.length > 1) continue;
        for (const other of group.slice(1)) if (!defend) out.push({ type: "merge", country: code, army: other.id, into: host.id });
        const reach = reachFrom(game, code, at), here = situation(game, at);

        // at an enemy settlement: hold the siege, or storm if it can be won now
        if (here.s && foes.has(here.s.owner) && here.garrison.length) {
            if (defend) continue;
            const sees = forcePower(here.garrison) * wallsFactor(here.s);
            if (ours >= 1.35 * sees && mayFight(st, group, here.garrison)) out.push({ type: "storm", country: code, army: host.id });
            else if (!here.s.siege) out.push({ type: "besiege", country: code, army: host.id });
            continue;
        }

        // the threat: enemy armies in the open that could reach a place about as soon as we can
        const threat = (days) => field.reduce((n, a) => {
            const p = placeOf(a), d = p === null ? undefined : reach.get(p);
            return d !== undefined && d <= days + 40 ? n + armyPower(a) : n;
        }, 0);

        const options = [];
        for (const b of sieges) {
            const days = reach.get(b.key);
            if (days === undefined || b.key === at) continue;
            const against = forcePower(b.hostile), inside = forcePower(b.garrison);
            if (ours + inside >= 1.2 * against) options.push({ key: b.key, score: (40 + b.s.pop / 1000) / (1 + days / 40), storm: false });
        }
        if (!defend) for (const s of Object.values(st.settlements)) {
            if (!foes.has(s.owner) || isRebel(st, s.owner)) continue;
            const key = String(s.id), days = reach.get(key);
            if (days === undefined) continue;
            const sit = situation(game, key), raw = forcePower(sit.garrison), def = raw * wallsFactor(s);
            const value = s.pop / 1000 + (st.countries[s.owner].capital === s.id ? 15 : 0) + (s.cores.includes(code) ? 10 : 0) + 5;
            const danger = threat(days);
            if (ours < 1.1 * danger) continue;
            if (!sit.garrison.length) options.push({ key, score: value / (1 + days / 40), storm: false });
            else if (ours >= ratio * def + danger) options.push({ key, score: value / (1 + days / 40), storm: true });
            else if (ours >= ratio * raw + danger && siegeDays(game, s, 0) <= 500) options.push({ key, score: 0.6 * value / (1 + days / 40), storm: false });
        }
        for (const a of enemyArmies) {
            if (!a.at || !inTheOpen(st, a) || a.at === at) continue;
            const days = reach.get(a.at), their = armyPower(a);
            const land = st.settlements[game.map.nodes.get(a.at).land].owner;
            if (defend && land !== code && !isFriend(st, code, land)) continue;
            if (days !== undefined && ours >= 1.5 * their) options.push({ key: a.at, score: (8 + menIn(a) / 500) / (1 + days / 40), storm: false });
        }
        options.sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : 1));
        if (options.length) out.push({ type: "move", country: code, army: host.id, to: options[0].key, storm: options[0].storm });
        else if (!defend && baseKey && at !== baseKey && reach.has(baseKey)) out.push({ type: "move", country: code, army: host.id, to: baseKey, storm: false });
    }

    // muster: the armed men a garrison has over its floor split off as one more host, which gathers at the staging settlement
    if (muster && baseKey && !defend) {
        for (const [key, g] of [...garrisons(st, code)].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
            const s = st.settlements[key];
            if (!s || s.owner !== code || s.siege || g.march) continue;
            const armed = armedIn(g), excess = Math.min(armed, menIn(g) - garrisonFloor(game, code, s));
            if (excess < Math.max(400, 0.2 * armed)) continue;
            const f = excess / armed, men = {};
            for (const w of WEAPONS) if (w !== "unarmed" && g.men[w]) men[w] = Math.floor(g.men[w] * f);
            if (Object.values(men).some((n) => n > 0)) out.push({ type: "split", country: code, army: g.id, men });
        }
    }
    return out;
}
