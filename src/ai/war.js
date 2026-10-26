// The computer player's war (docs/design.md, "The computer players", operations and reflexes): it keeps a garrison in
// every settlement (and, when it means to declare a war, even before it), musters the rest of its armed men into one host at a staging settlement, and marches the host on
// the settlement it can take soonest — by storm if it is strong enough, else by siege — or on an enemy army it can
// beat, or to the relief of a besieged settlement of its own. Garrisons sortie when they outmatch the besiegers.
//
// Everything is read from the state, nothing is remembered: a restarted game plays on as before. An army's id is only
// known once its split has been applied, so musters take two thinks (the second a tick after the first, see index.js).
import { mayFight } from "../engine/battle.js";
import { CREW_PER_CANNON, armyList, besiegedIn, isFriend, isRebel, routeFor, situation, siegeDays, wallDefence } from "../engine/index.js";
import { WEAPONS } from "../engine/army.js";
import { armyPower, enemiesOf, forcePower, garrisonFloor, garrisons, ownArmies, ownSettlements, reachFrom, stagingSettlement, threatsOf } from "./util.js";

// a garrison's defence in a storm against `guns` cannons (RULES.md §5): ×1.2, or behind walls ×1.8 less 0.3 a hundred × x
const wallsFactor = (game, s, guns = 0) => wallDefence(s.walls, guns, game.map.x);
// the strength of an enemy sharpshooter post at a pass, as a storm of it weighs it (passes.js): its men × 2.5 × 2
const postPower = (post) => post.n * 5;
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

// idle armies of ours outside the garrisons, grouped by the place they stand in; one shut in a besieged settlement may only sortie
function hostsOf(game, code) {
    const st = game.state;
    const keep = new Set([...garrisons(st, code).values()].map((a) => a.id)), groups = new Map();
    for (const a of ownArmies(st, code)) {
        if (keep.has(a.id) || !a.at || a.retreating || a.relief || a.path.length || isRebel(st, code) || besiegedIn(game, a)) continue;
        if (!groups.has(a.at)) groups.set(a.at, []);
        groups.get(a.at).push(a);
    }
    return groups;
}

// `defend`: a caretaker's war — only the armies it has, only within its own and its friends' land: to relieve a besieged
// settlement or meet an enemy army that has come in. It musters, merges, gathers and attacks nothing.
export function warOrders(game, code, fl, { muster = true, prepare = false, defend = false } = {}) {
    const st = game.state, out = [], foes = new Set(enemiesOf(st, code));
    sorties(game, code, out);
    // an army marching into the land of a country it is no longer at war with, nor friendly with (a peace made on the way),
    // stops at the next place
    if (!defend) for (const a of ownArmies(st, code)) {
        if (a.retreating || !a.march) continue;
        const dest = a.path.length ? a.path[a.path.length - 1] : a.march.to;
        const owner = st.settlements[game.map.nodes.get(dest)?.land]?.owner;
        if (owner && owner !== code && !isFriend(st, code, owner) && !foes.has(owner)) out.push({ type: "stop", country: code, army: a.id });
    }
    // other countries' peasants are enemies too (RULES.md §11): their towns are there to take, but only those next to our land
    // stir a country with no other war
    const own = new Set(ownSettlements(st, code).map((s) => String(s.id)));
    const peasantsNear = Object.values(st.settlements).some((s) => foes.has(s.owner) && isRebel(st, s.owner) && game.map.adj.get(String(s.id)).some((e) => own.has(e.to)));
    if (!threatsOf(st, code).length && !prepare && !peasantsNear) return out;

    const base = stagingSettlement(game, code), baseKey = base ? String(base.id) : null;
    const enemyArmies = armyList(st).filter((a) => foes.has(a.owner));
    const field = enemyArmies.filter((a) => inTheOpen(st, a));
    const ratio = 1.5 - 0.4 * fl.aggression;
    const sieges = besiegedOwn(game, code);
    let spareGuns = st.countries[code].reserve.cannons;            // cannons in the reserve, for the hosts to take on
    const enemyPost = (k) => { const p = st.posts[k]; return p && p.n > 0 && foes.has(p.owner) ? p : null; };

    for (const [at, group] of [...hostsOf(game, code)].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        group.sort((a, b) => a.id - b.id);
        const host = group[0], ours = forcePower(group);
        if (defend && group.length > 1) continue;
        for (const other of group.slice(1)) if (!defend) out.push({ type: "merge", country: code, army: other.id, into: host.id });
        const reach = reachFrom(game, code, at), here = situation(game, at);

        // siege guns: a host takes on the cannons in the reserve in whole hundreds × x — only full hundreds shorten a siege or
        // batter walls (RULES.md §6) — up to 40% of its men becoming their crew (10 a cannon)
        let guns = group.reduce((n, a) => n + a.cannons, 0);
        const step = 100 * game.map.x;
        if (!defend && spareGuns > 0) {
            const can = Math.floor((menIn(host) - host.mercs) * 0.4 / CREW_PER_CANNON) - host.cannons;
            const n = Math.floor((guns + Math.min(spareGuns, Math.max(0, can))) / step) * step - guns;
            if (n > 0) { out.push({ type: "equipCannons", country: code, army: host.id, n }); spareGuns -= n; guns += n; }
        }

        // at a pass held by an enemy post: storm it if the host is clearly the stronger, else go on as below
        const post = defend ? null : enemyPost(at);
        if (post && ours >= 1.5 * postPower(post)) { out.push({ type: "stormPost", country: code, army: host.id }); continue; }

        // at an enemy settlement: hold the siege, or storm if it can be won now
        if (here.s && foes.has(here.s.owner) && here.garrison.length) {
            if (defend) continue;
            const sees = forcePower(here.garrison) * wallsFactor(game, here.s, guns);
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
            if (!foes.has(s.owner)) continue;                                // peasants' towns too: theirs to take back, or anyone's
            const key = String(s.id), days = reach.get(key);
            if (days === undefined) continue;
            const sit = situation(game, key), raw = forcePower(sit.garrison), def = raw * wallsFactor(game, s, guns);
            // its people in thousands, and 10 for being one more settlement towards victory (as a town's people: diplomacy.js, TOWN_WORTH)
            const value = s.pop / 1000 + (st.countries[s.owner].capital === s.id ? 15 : 0) + (s.cores.includes(code) ? 10 : 0) + 10;
            const danger = threat(days);
            if (ours < 1.1 * danger) continue;
            if (!sit.garrison.length) options.push({ key, score: value / (1 + days / 40), storm: false });
            else if (ours >= ratio * def + danger) options.push({ key, score: value / (1 + days / 40), storm: true });
            else if (ours >= ratio * raw + danger && siegeDays(game, s, guns) <= 500) options.push({ key, score: 0.6 * value / (1 + days / 40), storm: false });
        }
        for (const a of enemyArmies) {
            if (!a.at || !inTheOpen(st, a) || a.at === at) continue;
            const days = reach.get(a.at), their = armyPower(a);
            const land = st.settlements[game.map.nodes.get(a.at).land].owner;
            if (defend && land !== code && !isFriend(st, code, land)) continue;
            if (days !== undefined && ours >= 1.5 * their) options.push({ key: a.at, score: (8 + menIn(a) / 500) / (1 + days / 40), storm: false });
        }
        options.sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : 1));
        // an enemy post at a pass on the way, which the host can take: stop there first, to storm it on the next think, rather
        // than be shot at in passing (and every army after it)
        const way = options.length ? routeFor(game, host, options[0].key)?.path ?? [] : [];
        const stop = way.find((k) => k !== options[0]?.key && enemyPost(k) && ours >= 1.5 * postPower(enemyPost(k)));
        if (stop) out.push({ type: "move", country: code, army: host.id, to: stop, storm: false });
        else if (options.length) out.push({ type: "move", country: code, army: host.id, to: options[0].key, storm: options[0].storm });
        else if (!defend && baseKey && at !== baseKey && reach.has(baseKey)) out.push({ type: "move", country: code, army: host.id, to: baseKey, storm: false });
    }

    // muster: the armed men a garrison has over its floor split off as one more host, which gathers at the staging settlement
    if (muster && baseKey && !defend && !fl.defending) {            // a first holding its lead in the endgame keeps its men home
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
