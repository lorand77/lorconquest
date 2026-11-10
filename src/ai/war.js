// The computer player's war (docs/design.md, "The computer players", operations and reflexes): it keeps a garrison in
// every settlement (and, when it means to declare a war, even before it), musters the rest of its armed men into one host at a staging settlement, and marches the host on
// the settlement it can take soonest — by storm if it is strong enough, else by siege — or on an enemy army it can
// beat, or to the relief of a besieged settlement of its own. Garrisons sortie when they outmatch the besiegers.
//
// Everything is read from the state, nothing is remembered: a restarted game plays on as before. An army's id is only
// known once its split has been applied, so musters take two thinks (the second a tick after the first, see index.js).
import { mayFight } from "../engine/battle.js";
import { CREW_PER_CANNON, MERCENARY_DAYS, MERCENARY_PRICE, armyCapOf, armyList, besiegedIn, economyOf, isFriend, isRebel, mercenariesOf, routeFor, situation, siegeDays, wallDefence } from "../engine/index.js";
import { WEAPONS, emptyMen } from "../engine/army.js";
import { legKey } from "../engine/map.js";
import { armyPower, enemiesOf, forcePower, garrisonFloor, garrisons, inland, ownArmies, ownSettlements, reachFrom, reserveOf, stagingSettlement, threatsOf, winChance } from "./util.js";

// a garrison's defence in a storm against `guns` cannons (RULES.md §5): ×1.2, or behind walls ×1.8 less 0.3 a hundred × x
const wallsFactor = (game, s, guns = 0) => wallDefence(s.walls, guns, game.map.x);
// the strength of an enemy sharpshooter post at a pass, as a storm of it weighs it (passes.js): its men × 2.5 × 2
const postPower = (post) => post.n * 5;
// raiding parties: a host of RAID_FROM men or more splits off RAID armed men for an undefended enemy town it is not going to
// itself, up to RAIDERS of them; an army under RAIDER men is a raiding party — never merged into a host, it goes only for
// undefended towns, and waits at the staging settlement when there is none left within reach
const RAID = 600, RAID_FROM = 3000, RAIDERS = 3, RAIDER = 800, RAID_DAYS = 60;
const isRaider = (a) => menIn(a) < RAIDER;
const menIn = (a) => WEAPONS.reduce((n, w) => n + a.men[w], 0);
const armedIn = (a) => menIn(a) - a.men.unarmed;

// an enemy army out in the open: not inside a settlement of its own country
const inTheOpen = (st, a) => !a.at || st.settlements[a.at]?.owner !== a.owner;

// the place an army is, or is on its way to
const placeOf = (a) => a.at ?? a.march?.to ?? null;
// where a marching army is going, and the day it gets there: the end of its leg, then the days of the legs after it (no route
// to find again)
const destinationOf = (a) => (a.path.length ? a.path[a.path.length - 1] : a.march?.to ?? a.at);
const arrivalOf = (game, a) => {
    const legDays = (from, to) => game.map.legDays.get(legKey(from, to)) ?? 0;
    let d = a.march.end, at = a.march.to;
    for (const k of a.path) { d += legDays(at, k); at = k; }
    return d;
};
// a garrison sized to the threat (garrisonNeed): the enemy forces within REACH days no stronger than the garrison behind its walls
// (HOLD) — a storm then a coin flip at best for them (44%), and none at all from a computer player, who storms only at 1.35 times
// it (82% to win): a siege, months long, time for help to come
const REACH = 60, HOLD = 1.0;

// the enemy forces that could come for a town: every army of theirs but the garrisons holding their own towns
function fieldForces(st, foes) {
    const out = [];
    for (const f of [...foes].sort()) {
        const held = new Set([...garrisons(st, f).values()].map((a) => a.id));
        for (const a of ownArmies(st, f)) if (!held.has(a.id) && !a.retreating) out.push(a);
    }
    return out;
}

// the places within REACH days of a place, by the map's legs alone — who may enter where aside: an estimate of who could come
function within(game, from) {
    const dist = new Map([[from, 0]]), queue = [[0, from]];
    while (queue.length) {
        queue.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
        const [d, k] = queue.shift();
        if (d > dist.get(k)) continue;
        for (const e of game.map.adj.get(k) ?? []) {
            const nd = d + e.days;
            if (nd > REACH || nd >= (dist.get(e.to) ?? Infinity)) continue;
            dist.set(e.to, nd);
            queue.push([nd, e.to]);
        }
    }
    return dist;
}

// the armed men a garrison keeps when the rest muster: at war, enough that the enemy forces within REACH days are no stronger
// — and with none of them near, only an inner town's share (1.5% of its people) whatever its border; if not even all it has
// could hold it, the usual floor (util.js, garrisonFloor), not men thrown away. In peace, the usual floor.
export function garrisonNeed(game, code, s, g, field) {
    const base = garrisonFloor(game, code, s);
    if (!field.length) return base;
    const near = within(game, String(s.id)), coming = field.filter((a) => near.has(placeOf(a)));
    if (!coming.length) return Math.min(base, 0.015 * s.pop);
    const armed = armedIn(g), perMan = armed > 0 ? forcePower([g]) / armed : forcePower([{ men: { ...emptyMen(), pikes: 1 }, cannons: 0 }]);
    const guns = coming.reduce((n, a) => n + a.cannons, 0);
    const men = forcePower(coming) / (HOLD * wallsFactor(game, s, guns) * perMan);
    return men > 2 * armed ? base : Math.max(Math.min(base, 0.015 * s.pop), men);
}

// the strength of `n` mercenaries, who come with pikes
const mercPower = (n) => forcePower([{ men: { ...emptyMen(), pikes: n }, cannons: 0 }]);

// our towns an enemy force is marching on and would take: not besieged yet (a relief is for those), what is coming stronger than
// its garrison behind its walls and the mercenaries already hired for it — { key, s, against, inside, arrives }, the soonest first
function threatenedOwn(game, code, enemyArmies) {
    const st = game.state, c = st.countries[code], out = [], garrison = garrisons(st, code);
    for (const s of ownSettlements(st, code)) {
        const key = String(s.id);
        if (s.siege) continue;
        const coming = enemyArmies.filter((a) => a.march && !a.retreating && destinationOf(a) === key);
        if (!coming.length) continue;
        const against = forcePower(coming), guns = coming.reduce((n, a) => n + a.cannons, 0);
        const hired = c.hires.filter((h) => h.settlement === s.id).reduce((n, h) => n + h.n, 0);
        // the garrison alone — a host standing in the town is weighed apart, as one that may stay to hold it (warOrders)
        const g = garrison.get(key), inside = forcePower(g ? [g] : []) * wallsFactor(game, s, guns) + mercPower(hired);
        if (against > inside) out.push({ key, s, against, inside, arrives: Math.min(...coming.map((a) => arrivalOf(game, a))) });
    }
    return out.sort((a, b) => a.arrives - b.arrives || a.s.id - b.s.id);
}

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

// the day before a siege of ours ends — the town would fall, and its garrison be sent home — a last sortie, if the dice give it a
// fair chance (LAST_SORTIE): won, the besiegers are driven off; lost, the men fall back inside with their losses, and the town
// falls as it was going to. Checked every day (index.js), for the day matters.
const LAST_SORTIE = 0.25;
export function lastSorties(game, code, out) {
    const st = game.state;
    for (const b of besiegedOwn(game, code)) {
        if (b.s.siege.end - st.day !== 1 || !b.garrison.length || !b.hostile.length) continue;
        const mine = b.garrison.filter((a) => a.owner === code);
        if (!mine.length || !mayFight(st, mine, b.hostile)) continue;
        // a sortie is fought in the open, no walls; the garrison wins a tie
        if (winChance(forcePower(b.garrison), forcePower(b.hostile), true) >= LAST_SORTIE) out.push({ type: "sortie", country: code, army: mine[0].id });
    }
}

// A host on the march re-weighs its odds as it goes: what it will meet where it is going — the enemy armies there, those on
// their way that get there first, and for a storm the garrison behind its walls — against what goes with it. Badly outmatched
// (TURN_BACK, by its character: worse odds than any it would set out at, so it does not turn back and forth), it turns back
// to the town of its own or a friend's it came from, or else to its staging settlement.
const TURN_BACK = (fl) => 0.5 + 0.2 * (1 - fl.aggression);
export function turnBacks(game, code, fl, out) {
    const st = game.state, staging = stagingSettlement(game, code);
    const marching = ownArmies(st, code).filter((a) => a.march && !a.retreating && !out.some((o) => o.army === a.id));   // (one order an army a think)
    if (!marching.length) return;
    const friendlyTown = (k) => st.settlements[game.map.nodes.get(k)?.kind === "settlement" ? game.map.nodes.get(k).id : -1] && isFriend(st, code, st.settlements[game.map.nodes.get(k).id].owner);
    const arrival = (a) => arrivalOf(game, a);
    const foes = new Set(enemiesOf(st, code)), enemyArmies = armyList(st).filter((e) => foes.has(e.owner));
    for (const a of marching) {
        const dest = destinationOf(a);
        if (!dest || friendlyTown(dest) && !situation(game, dest).hostile.length) continue;      // going home, or to a quiet town of ours
        const arrive = arrival(a);
        const theirs = enemyArmies.filter((e) => e.at === dest || (e.march && destinationOf(e) === dest && e.march.end <= arrive + 5));
        const ours = ownArmies(st, code).filter((x) => x === a || (destinationOf(x) === dest && !x.retreating));
        const node = game.map.nodes.get(dest), s = node.kind === "settlement" ? st.settlements[node.id] : null;
        // a storm meets the garrison behind its walls; a siege, only the armies in the field (relief) and a sortie's worth of it
        const garrison = s && foes.has(s.owner) ? theirs.filter((e) => e.at === dest && e.owner === s.owner && !e.relief) : [];
        const field = theirs.filter((e) => !garrison.includes(e));
        const against = forcePower(field) + forcePower(garrison) * (a.storm ? wallsFactor(game, s, ours.reduce((n, x) => n + x.cannons, 0)) : 1);
        if (against <= 0 || forcePower(ours) >= TURN_BACK(fl) * against) continue;
        const from = a.march?.from && friendlyTown(a.march.from) ? a.march.from : null;
        const home = from ?? (staging ? String(staging.id) : null);
        if (home && home !== dest) out.push({ type: "move", country: code, army: a.id, to: home, storm: false });
    }
}

// idle armies of ours outside the garrisons, grouped by the place they stand in; one shut in a besieged settlement may only sortie
function hostsOf(game, code) {
    const st = game.state;
    const keep = new Set([...garrisons(st, code).values()].map((a) => a.id)), groups = new Map();
    for (const a of ownArmies(st, code)) {
        if (keep.has(a.id) || !a.at || a.retreating || a.relief || a.path.length || isRebel(st, code) || besiegedIn(game, a)) continue;
        const key = isRaider(a) ? `${a.at}#${a.id}` : a.at;                // a raiding party is a host of its own
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    }
    return groups;
}

// `defend`: a caretaker's war — only the armies it has, only within its own and its friends' land: to relieve a besieged
// settlement or meet an enemy army that has come in. It musters, merges, gathers and attacks nothing.
// `cash` and `hired`: the treasury once this think's other orders are paid, and the mercenaries they hire (index.js, think)
export function warOrders(game, code, fl, { muster = true, prepare = false, defend = false, thinned = new Set(), cash = null, hired = 0 } = {}) {
    const st = game.state, out = [], foes = new Set(enemiesOf(st, code));
    sorties(game, code, out);
    if (!defend) turnBacks(game, code, fl, out);               // marches against odds that have turned hopeless
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
    // allies at war beside us (design.md, *The computer players*): their towns our enemies besiege are relieved as our own, a
    // little after them; and an enemy town an ally besieges or marches on is worth more to us — one siege, not two
    const alliedSieges = Object.values(st.settlements).filter((s) => s.siege && s.owner !== code && isFriend(st, code, s.owner)).map((s) => {
        const sit = situation(game, String(s.id));
        return { s, key: String(s.id), hostile: sit.hostile.filter((h) => foes.has(h.owner)), garrison: sit.garrison };
    }).filter((b) => b.hostile.length);
    const alliedAt = new Set(armyList(st).filter((a) => a.owner !== code && isFriend(st, code, a.owner) && !a.retreating)
        .flatMap((a) => (a.march ? [destinationOf(a)] : a.at ? [a.at] : [])));
    const alliedOn = (s) => (s.siege && s.siege.by !== code && isFriend(st, code, s.siege.by)) || alliedAt.has(String(s.id));
    let spareGuns = st.countries[code].reserve.cannons;            // cannons in the reserve, for the hosts to take on
    const enemyPost = (k) => { const p = st.posts[k]; return p && p.n > 0 && foes.has(p.owner) ? p : null; };

    const garrisoning = new Set([...garrisons(st, code).values()].map((a) => a.id));
    // towns of ours an enemy force is marching on: a host that gets there first and makes it hold goes (below); one standing in
    // such a town, which would fall without it, stays; for a core town nobody can reach in time, mercenaries, if they can
    const threatened = threatenedOwn(game, code, enemyArmies), covered = new Set();
    let raiders = ownArmies(st, code).filter((a) => isRaider(a) && !garrisoning.has(a.id) && !a.retreating).length;
    for (const [, group] of [...hostsOf(game, code)].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        group.sort((a, b) => a.id - b.id);
        const host = group[0], ours = forcePower(group), at = host.at, raider = !defend && group.length === 1 && isRaider(host);
        if (defend && group.length > 1) continue;
        for (const other of group.slice(1)) if (!defend) out.push({ type: "merge", country: code, army: other.id, into: host.id });
        const reach = reachFrom(game, code, at), here = situation(game, at);
        const keep = threatened.find((t) => t.key === at && !raider);
        if (keep && keep.inside < keep.against * 1.2) { covered.add(at); continue; }        // it holds the town; it stays

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
        for (const b of alliedSieges) {
            const days = reach.get(b.key);
            if (days === undefined || b.key === at || raider) continue;
            const against = forcePower(b.hostile), inside = forcePower(b.garrison);
            if (ours + inside >= 1.2 * against) options.push({ key: b.key, score: (30 + b.s.pop / 1000) / (1 + days / 40), storm: false });
        }
        // a town of ours about to be marched on: there before the enemy, and enough with its garrison to hold it — better
        // met there than relieved later
        for (const t of threatened) {
            const days = reach.get(t.key);
            if (days === undefined || t.key === at || raider || st.day + days >= t.arrives) continue;
            if (ours + t.inside >= 1.2 * t.against) options.push({ key: t.key, score: (50 + t.s.pop / 1000 + (st.countries[code].capital === t.s.id ? 20 : 0)) / (1 + days / 40), storm: false, defends: true });
        }
        if (!defend) for (const s of Object.values(st.settlements)) {
            if (!foes.has(s.owner)) continue;                                // peasants' towns too: theirs to take back, or anyone's
            const key = String(s.id), days = reach.get(key);
            if (days === undefined) continue;
            const sit = situation(game, key), raw = forcePower(sit.garrison), def = raw * wallsFactor(game, s, guns);
            // its people in thousands, and 10 for being one more settlement towards victory (as a town's people: diplomacy.js, TOWN_WORTH)
            const value = (s.pop / 1000 + (st.countries[s.owner].capital === s.id ? 15 : 0) + (s.cores.includes(code) ? 10 : 0) + 10) * (alliedOn(s) ? 1.5 : 1);
            const danger = threat(days);
            if (ours < 1.1 * danger) continue;
            if (!sit.garrison.length) options.push({ key, score: value / (1 + days / 40), storm: false, open: !sit.relief.length, days });
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
        if (raider) {
            // a raiding party: the best undefended town within reach, else back to the host at the staging settlement
            const take = options.find((o) => o.open && o.days <= RAID_DAYS);
            if (take) out.push({ type: "move", country: code, army: host.id, to: take.key, storm: false });
            else if (baseKey && at !== baseKey && reach.has(baseKey)) out.push({ type: "move", country: code, army: host.id, to: baseKey, storm: false });
            continue;                                                // at the base, it waits for the next town to take
        }
        // a big host sends a raiding party to an undefended town it is not going to itself
        if (!defend && raiders < RAIDERS && menIn(host) >= RAID_FROM && options.some((o, i) => i > 0 && o.open && o.days <= RAID_DAYS)) {
            const armed = armedIn(host), share = RAID / Math.max(1, armed), men = {};
            for (const w of WEAPONS) if (w !== "unarmed" && host.men[w]) men[w] = Math.floor(host.men[w] * share);
            if (Object.values(men).some((n) => n > 0)) { out.push({ type: "split", country: code, army: host.id, men }); raiders++; }
        }
        // an enemy post at a pass on the way, which the host can take: stop there first, to storm it on the next think, rather
        // than be shot at in passing (and every army after it)
        const way = options.length ? routeFor(game, host, options[0].key)?.path ?? [] : [];
        const stop = way.find((k) => k !== options[0]?.key && enemyPost(k) && ours >= 1.5 * postPower(enemyPost(k)));
        if (stop) out.push({ type: "move", country: code, army: host.id, to: stop, storm: false });
        else if (options.length) {
            out.push({ type: "move", country: code, army: host.id, to: options[0].key, storm: options[0].storm });
            if (options[0].defends) covered.add(options[0].key);
        }
        else if (!defend && baseKey && at !== baseKey && reach.has(baseKey)) out.push({ type: "move", country: code, army: host.id, to: baseKey, storm: false });
    }

    // a core town nobody marches to the defence of: mercenaries, if they arrive before the enemy (a month), as many as make it hold
    // — what the money (above its reserve) and the army cap allow
    if (!defend) {
        const c = st.countries[code], e = economyOf(game, code);
        let money = (cash ?? c.treasury) - reserveOf(e), room = armyCapOf(st, code) - mercenariesOf(st, code) - c.hires.reduce((n, h) => n + h.n, 0) - hired;
        for (const t of threatened) {
            if (covered.has(t.key) || !t.s.cores.includes(code) || t.arrives - st.day <= MERCENARY_DAYS) continue;
            let lots = 1;
            while (lots < 10 && t.inside + mercPower(lots * 1000) < 1.2 * t.against) lots++;
            lots = Math.min(lots, Math.floor(money / MERCENARY_PRICE), Math.floor(room / 1000));
            if (lots < 1) continue;
            out.push({ type: "hireMercenaries", country: code, settlement: t.s.id, lots });
            money -= lots * MERCENARY_PRICE;
            room -= lots * 1000;
        }
    }

    // muster: the armed men a garrison has over what it needs (garrisonNeed: to the threat) split off as one more host, which
    // gathers at the staging settlement
    if (muster && baseKey && !defend && !fl.defending) {            // a first holding its lead in the endgame keeps its men home
        const field = fieldForces(st, foes);                        // peasants too: they go for the poorly held first
        for (const [key, g] of [...garrisons(st, code)].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
            const s = st.settlements[key];
            // (an inland settlement keeps nobody: its whole army marches to the staging settlement instead, forces.js, tidyOrders)
            if (!s || s.owner !== code || s.siege || g.march || thinned.has(g.id) || inland(game, code, s)) continue;
            // only armed men leave, so only armed men count towards the floor that stays: never a garrison of unarmed men alone
            const armed = armedIn(g), excess = armed - garrisonNeed(game, code, s, g, field);
            if (excess < Math.max(400, 0.2 * armed)) continue;
            const f = excess / armed, men = {};
            for (const w of WEAPONS) if (w !== "unarmed" && g.men[w]) men[w] = Math.floor(g.men[w] * f);
            if (Object.values(men).some((n) => n > 0)) out.push({ type: "split", country: code, army: g.id, men });
        }
    }
    return out;
}
