// Random events and peasant rebels (RULES.md §11). On 1 January every country rolls for a good harvest (10%,
// +10% money that year), a plague (5%, −10% of its people) and an uprising ((average tax − 2)² × 25%, and the unrest of the law
// in force: +5% under Mass levy, +15% under Scrape the barrel, RULES.md §9; and land of another faith not yet core, religion.js). An uprising
// is a country of its own — "REB1", at war with the country it rose against for ever — with soldiers equal to 3% of
// that country's people, armed with swords, outside its capital. They are its own people: they pay no tax while
// under arms, their dead are lost from its population, and survivors with nowhere to fall back scatter home. An uprising may be
// a religious one, as much as faith made the chance: then its people rise in the settlements of another faith than their ruler's,
// each a band of 3% of its people, and fight for the land of their faith alone. Rebels recruit each month: a tenth of the people of
// a town they hold over ten months, and as much as the unrest that raised them (tax and law, or faith) goes on making. Rebels who
// hold land for 5 years — or any, once their country is out — rise as a state, a country like any, which the computer plays.
//
// The rebels' behaviour is a rule, not a player's choice: every 10 days each idle rebel army storms the town it besieges once it
// is 1.35 times the garrison, or else marches on a settlement of its country it is at least 1.2 times as strong as, on a way no
// stronger enemy army stands on — undefended ones first, then the nearest, then core land; a band leaving a town of its own leaves
// a fifth of its men to hold it, bands in one place become one, and a band with nothing to attack joins the largest. It uses no
// dice, so it needs no logging and replays exactly.

import { WEAPONS, emptyMen, menOf, militaryPower } from "./army.js";
import { inheritCooldowns, mayFight } from "./battle.js";
import { YEAR_DAYS } from "./calendar.js";
import { LAWS } from "./costs.js";
import { ownedBy, plague, popOf } from "./economy.js";
import { evictClosed, openWar } from "./diplomacy.js";
import { settle, situation, storm, wallDefence } from "./fighting.js";
import { joinArmy } from "./forces.js";
import { follow, routeFor } from "./movement.js";
import { random } from "./random.js";
import { RELIGION_NAMES, faithUnrest, religionOf } from "./religion.js";
import { armiesAt, armyList, atWar, isCore, isRebel, makeCountry, newArmy, removeArmy, warKey } from "./state.js";

// the part of the chance of an uprising that tax and the law make (RULES.md §11)
const taxUnrest = (c, tax) => (tax - 2) ** 2 * 0.25 + (LAWS[c.law ?? "feudal"]?.unrest ?? 0);

export function yearly(game, events) {
    const st = game.state;
    for (const code of Object.keys(st.countries).sort()) {
        if (isRebel(st, code)) continue;
        const c = st.countries[code];
        // four rolls a year, always, so what one country rolls never changes what the next does
        const harvest = random(st), sick = random(st), rise = random(st), kind = random(st);
        if (c.out !== null) continue;                            // a country out of the game: nothing befalls it
        c.harvest = harvest < 0.10;
        if (c.harvest) events.push({ type: "harvest", day: st.day, country: code });
        if (sick < 0.05) plague(game, code, 0.10, events);
        const average = c.taxSum / YEAR_DAYS;
        c.taxSum = 0;
        const faith = faithUnrest(game, code), chance = taxUnrest(c, average) + faith;
        // a religious uprising as much as faith made the chance, where any of its people are of another faith; a tax one otherwise
        if (rise < chance) (kind * chance < faith && religiousUprising(game, code, events)) || uprising(game, code, events);
    }
}

// rebels rise outside the capital, or if it is lost in the largest settlement the country has. If peasants of the country are
// up in arms already, the new ones join them — the oldest band still standing, and its army there if it has one — rather
// than forming a band of their own (RULES.md §11).
export function uprising(game, code, events) {
    const st = game.state, c = st.countries[code], owned = ownedBy(st, code);
    if (!owned.length) return;
    const home = st.settlements[c.capital]?.owner === code ? st.settlements[c.capital] : [...owned].sort((a, b) => b.pop - a.pop || a.id - b.id)[0];
    const n = Math.round(0.03 * popOf(st, code));
    const bands = Object.keys(st.countries).filter((x) => st.countries[x].rebel && st.countries[x].of === code && !st.countries[x].faith).sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
    const joined = bands.length > 0, rebel = joined ? bands[0] : `REB${++st.rebels}`;
    if (!joined) {
        st.countries[rebel] = { code: rebel, name: `Rebels of ${c.name}`, capital: null, rebel: true, of: code, treasury: 0, raised: {}, holding: null };
        st.wars.push(warKey(rebel, code));
        st.wars.sort();
    }
    const men = emptyMen();
    men.swords = n;
    const army = joined ? joinArmy(st, rebel, String(home.id), { men }) : newArmy(st, rebel, String(home.id), men);
    events.push({ type: "uprising", day: st.day, country: code, rebels: rebel, army: army.id, men: n, at: home.id, ...(joined ? { joined: true } : {}) });
    settle(game, String(home.id), events);
}

// a religious uprising (RULES.md §11): the people of another faith than their ruler's rise where they live — a band of 3% of each
// such settlement's people, in it — as the rebels of that faith ("Orthodox rebels of Poland"), joining those of that faith already
// up. False if there is no such settlement (the uprising is then a tax one)
export function religiousUprising(game, code, events) {
    const st = game.state, c = st.countries[code], ruler = religionOf(game, code);
    const places = ownedBy(st, code).filter((s) => s.faith && ruler && s.faith !== ruler);
    if (!places.length) return false;
    for (const faith of [...new Set(places.map((s) => s.faith))].sort()) {
        const band = Object.keys(st.countries).filter((x) => st.countries[x].rebel && st.countries[x].of === code && st.countries[x].faith === faith)
            .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))[0];
        const rebel = band ?? `REB${++st.rebels}`;
        if (!band) {
            st.countries[rebel] = { code: rebel, name: `${RELIGION_NAMES[faith] ?? faith} rebels of ${c.name}`, capital: null, rebel: true, of: code, faith, treasury: 0, raised: {}, holding: null };
            st.wars.push(warKey(rebel, code));
            st.wars.sort();
        }
        for (const s of places.filter((x) => x.faith === faith)) {
            const men = emptyMen();
            men.swords = Math.round(0.03 * s.pop);
            if (!men.swords) continue;
            const army = joinArmy(st, rebel, String(s.id), { men });
            events.push({ type: "uprising", day: st.day, country: code, rebels: rebel, army: army.id, men: men.swords, at: s.id, faith, ...(band ? { joined: true } : {}) });
            settle(game, String(s.id), events);
        }
    }
    return true;
}

// every 10 days, each rebel band: bands in one place become one; one besieging a town storms it once 1.35 times the garrison; one
// leaving a town of its own leaves a fifth of its men to hold it; and an idle one marches on a settlement of its country — of its
// faith alone, for religious rebels — it is at least 1.2 times as strong as, behind its walls (wallDefence), by a way on which no
// stronger enemy army stands: undefended ones first, then the nearest, then core land. One with nothing to attack joins the largest.
const STORM_ODDS = 1.35, MARCH_ODDS = 1.2, HOLD_SHARE = 0.2;
export function rebelOrders(game, events) {
    const st = game.state;
    if (st.day % 10) return;
    for (const code of Object.keys(st.countries).sort()) {
        const rebel = st.countries[code];
        if (!rebel.rebel) continue;
        gather(game, code);
        const bands = () => armyList(st).filter((a) => a.owner === code && a.at && !a.retreating);
        for (const army of bands()) {
            if (!st.armies[army.id]) continue;
            const node = game.map.nodes.get(army.at), here = node.kind === "settlement" ? st.settlements[node.id] : null;
            const mine = militaryPower(army);
            // a siege of its own: stormed once it is strong enough, waited out otherwise
            if (here && here.owner === rebel.of && here.siege?.by === code) {
                const { garrison, hostile } = situation(game, army.at);
                const theirs = garrison.reduce((n, g) => n + militaryPower(g), 0) * wallDefence(here.walls, 0, game.map.x);
                if (garrison.length && mine >= STORM_ODDS * theirs && mayFight(st, hostile.filter((h) => h.owner === code), garrison)) storm(game, code, army.at, events);
                continue;
            }
            // a settlement worth marching on: of its faith, if it has one; beatable behind its walls; reached past no stronger army
            const strongerOn = (path) => path.slice(0, -1).some((k) => armiesAt(st, k).some((e) => atWar(st, code, e.owner) && militaryPower(e) > mine));
            const options = [];
            for (const s of ownedBy(st, rebel.of)) {
                const key = String(s.id);
                if (key === army.at || (rebel.faith && s.faith !== rebel.faith)) continue;
                const garrison = armiesAt(st, key).filter((g) => g.owner === rebel.of && !g.relief);
                const theirs = garrison.reduce((n, g) => n + militaryPower(g), 0) * wallDefence(s.walls, 0, game.map.x);
                if (garrison.length && mine < MARCH_ODDS * theirs) continue;
                const route = routeFor(game, army, key);
                if (!route || strongerOn(route.path)) continue;
                options.push({ route, rank: [garrison.length ? 1 : 0, route.days, isCore(st, s, rebel.of) ? 0 : 1, s.id] });
            }
            options.sort((x, y) => x.rank[0] - y.rank[0] || x.rank[1] - y.rank[1] || x.rank[2] - y.rank[2] || x.rank[3] - y.rank[3]);
            if (options.length) {
                // a town of its own left behind keeps a fifth of the band, if it would be left with nobody
                if (here && here.owner === code && !armiesAt(st, army.at).some((o) => o.owner === code && o !== army)) holdBack(game, army);
                follow(game, army, options[0].route.path, events);
                continue;
            }
            // nothing to attack: the largest band of its own is joined, where it stands (none if this is the largest)
            const largest = bands().filter((o) => o !== army).sort((x, y) => menOf(y) - menOf(x) || x.id - y.id)[0];
            if (largest && menOf(largest) > menOf(army) && !(here && here.owner === code && armiesAt(st, army.at).length === 1)) {
                const route = routeFor(game, army, largest.at);
                if (route && !strongerOn(route.path)) follow(game, army, route.path, events);
            }
        }
    }
}

// bands of the same rebels standing in one place become one (the lowest-numbered keeps the men)
function gather(game, code) {
    const st = game.state, seen = new Map();
    for (const a of armyList(st).filter((x) => x.owner === code && x.at && !x.retreating).sort((x, y) => x.id - y.id)) {
        const keep = seen.get(a.at);
        if (!keep || keep.relief !== a.relief) { seen.set(a.at, a); continue; }
        for (const w of WEAPONS) keep.men[w] += a.men[w];
        keep.cannons += a.cannons;
        keep.crew += a.crew;
        inheritCooldowns(st, a.id, keep.id);
        removeArmy(st, a);
    }
}

// a fifth of a band left behind to hold the town it stands in, in whole men of each weapon (none if that leaves nobody behind)
function holdBack(game, army) {
    const st = game.state, men = emptyMen();
    for (const w of WEAPONS) men[w] = Math.floor(army.men[w] * HOLD_SHARE);
    if (!menOf({ men }) || menOf({ men }) >= menOf(army)) return;
    for (const w of WEAPONS) army.men[w] -= men[w];
    const part = newArmy(st, army.owner, army.at, men);
    part.arrived = army.arrived;
    inheritCooldowns(st, army.id, part.id);
}

// the rebels' recruits (RULES.md §11), each month: a town they hold gives 1% of its people to the band in it, up to a tenth of them
// in all; and the unrest that raised them goes on feeding them — 0.3% of their country's people a month for each 100% of the
// chance of an uprising: the tax and the law's part to the tax rebels, the faith's to those of the faith, by their share of the
// country's people of another faith. A recruit is a peasant with a sword, taken from his country's civilians like the first band.
const TOWN_SHARE = 0.01, TOWN_MAX = 0.1, FEED = 0.003;
export function rebelRecruits(game) {
    const st = game.state;
    for (const code of Object.keys(st.countries).sort()) {
        const rebel = st.countries[code];
        if (!rebel.rebel) continue;
        const raised = (rebel.raised ??= {});
        for (const s of ownedBy(st, code)) {
            const n = Math.floor(Math.min(TOWN_SHARE * s.pop, TOWN_MAX * s.pop - (raised[s.id] ?? 0)));
            if (n <= 0) continue;
            raised[s.id] = (raised[s.id] ?? 0) + n;
            const men = emptyMen();
            men.swords = n;
            joinArmy(st, code, String(s.id), { men });
        }
        const c = st.countries[rebel.of];
        if (!c || c.out !== null) continue;
        let chance = taxUnrest(c, c.tax);
        if (rebel.faith) {
            const ruler = religionOf(game, rebel.of), other = ownedBy(st, rebel.of).filter((s) => s.faith && ruler && s.faith !== ruler);
            const all = other.reduce((n, s) => n + s.pop, 0), theirs = other.filter((s) => s.faith === rebel.faith).reduce((n, s) => n + s.pop, 0);
            chance = all ? faithUnrest(game, rebel.of) * theirs / all : 0;
        }
        const n = Math.floor(FEED * chance * popOf(st, rebel.of));
        const largest = armyList(st).filter((a) => a.owner === code).sort((x, y) => menOf(y) - menOf(x) || x.id - y.id)[0];
        if (n > 0 && largest) largest.men.swords += n;
    }
}

// rebels who hold out become a state (RULES.md §11): at the start of each month, rebels holding land — religious rebels, all the land
// of their faith, their country holding none of it — for 5 years on end, or holding any once their country is out of the game
const RISE_YEARS = 5;
export function rebelStates(game, events) {
    const st = game.state;
    for (const code of Object.keys(st.countries).sort()) {
        const rebel = st.countries[code];
        if (!rebel.rebel) continue;
        const parent = st.countries[rebel.of], gone = !parent || parent.out !== null;
        const holds = ownedBy(st, code).length > 0 && (!rebel.faith || gone || !ownedBy(st, rebel.of).some((s) => s.faith === rebel.faith));
        if (!holds) { rebel.holding = null; continue; }
        rebel.holding ??= st.day;
        if (gone || st.day - rebel.holding >= RISE_YEARS * YEAR_DAYS) riseAsState(game, code, events);
    }
}

// the rebels made a country: its capital their largest town, every town they hold its core, a treasury as a country of their people
// begins with (x × pop × 2), their country's knowledge, its faith or theirs. Their wars, which nobody declared, end; with the country
// they rose against, if it is still in the game, a war begins — a war like any, with a score and a peace. From now on it is a
// computer country like the others, raising men from its own people (src/ai). On the map: a code from its capital's name, and a colour
const RISEN_COLOURS = ["#6b8e23", "#b8860b", "#5f9ea0", "#9370db", "#cd853f", "#2e8b57", "#d2691e", "#4682b4", "#bc8f8f", "#808000"];
export function riseAsState(game, code, events) {
    const st = game.state, rebel = st.countries[code], of = rebel.of, parent = st.countries[of] ?? null;
    const held = ownedBy(st, code).sort((a, b) => b.pop - a.pop || a.id - b.id), capital = held[0];
    const town = game.map.nodes.get(String(capital.id)).name;
    const name = rebel.faith ? `${RELIGION_NAMES[rebel.faith] ?? rebel.faith} League of ${town}` : `Peasant Republic of ${town}`;
    const pop = held.reduce((n, s) => n + s.pop, 0);
    const c = makeCountry({ code, name, capital: capital.id, religion: rebel.faith ?? parent?.religion ?? null,
        treasury: game.map.scenario.scaleX * pop * 2, techs: parent?.techs });
    c.taxSum = c.tax * (st.day % YEAR_DAYS);                  // the year so far at the tax it begins with, for the yearly roll
    c.risen = { code: shortCode(game, town), colour: RISEN_COLOURS[(Number(code.slice(3)) - 1) % RISEN_COLOURS.length], of, day: st.day };
    st.countries[code] = c;
    for (const s of held) if (!s.cores.includes(code)) s.cores.push(code);
    st.wars = st.wars.filter((w) => !w.split("|").includes(code));
    const war = Boolean(parent && parent.out === null);
    if (war) openWar(game, code, of, code);
    evictClosed(game, events);
    events.push({ type: "risen", day: st.day, country: code, of, name, capital: capital.id, settlements: held.length, ...(war ? { war } : {}) });
}

// three letters for the map, from the town's name, that no country is known by: its first three, or its first and two others in order
function shortCode(game, town) {
    const st = game.state, letters = town.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
    const taken = new Set([...Object.keys(st.countries), ...Object.values(st.countries).map((x) => x.risen?.code),
        ...(game.map.scenario.formables ?? []).map((f) => f.becomes?.code)]);
    for (let i = 1; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) {
        const t = letters[0] + letters[i] + letters[j];
        if (!taken.has(t)) return t;
    }
    return `R${st.rebels}`;
}

// who peasant rebels are at war with (RULES.md §11): the country they rose against and every country at war with it — or, once
// that country is out of the game, every country. They take no orders, so this is worked out, not declared: kept in the wars
// list (no declaration, no warmonger score, no allies drawn in, no peace), at the end of each day and of each order. A country
// that stops being at war with them (a peace with their country) has its armies sent out of their land, as after any peace.
export function rebelWars(game, events) {
    const st = game.state;
    const real = Object.keys(st.countries).filter((c) => !st.countries[c].rebel && st.countries[c].out === null);
    let changed = false, ended = false;
    for (const code of Object.keys(st.countries)) {
        const r = st.countries[code];
        if (!r.rebel) continue;
        const theirs = real.includes(r.of);
        for (const c of real) {
            const want = !theirs || c === r.of || st.wars.includes(warKey(c, r.of));
            const k = warKey(code, c), has = st.wars.includes(k);
            if (want && !has) { st.wars.push(k); changed = true; }
            else if (!want && has) { st.wars = st.wars.filter((w) => w !== k); changed = ended = true; }
        }
    }
    if (changed) st.wars.sort();
    if (ended) evictClosed(game, events);
}

// an uprising is over when its country has no army and holds no settlement
export function endUprisings(game) {
    const st = game.state;
    for (const code of Object.keys(st.countries)) {
        if (!st.countries[code].rebel) continue;
        if (armyList(st).some((a) => a.owner === code) || Object.values(st.settlements).some((s) => s.owner === code)) continue;
        delete st.countries[code];
        st.wars = st.wars.filter((w) => !w.split("|").includes(code));
    }
}
