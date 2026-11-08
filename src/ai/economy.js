// The computer player's yearly economy (docs/design.md, "The computer players", strategy layer): tax, the research
// slider and what to research, the law, loans and which buildings to buy. It keeps a reserve of a third of a year's money,
// taxes lightly in peace and harder in war, and spends what is above the reserve on the buildings that pay. A country in
// distress — in the red and losing money, as one that borrowed in a war and then lost its land is — taxes as much as it may,
// sends home the soldiers its law no longer allows (forces.js), and after a year of it defaults on its loans, which the
// rules allow once in 20 years, rather than sit in debt until the bankers' interest has eaten it. A vassal of 10 years it
// integrates when it can pay.
import { BUILDING_PRICE, CORING_DAYS, LAWS, LOAN_CHUNK, MAX_LIBRARIES, SOLDIER_UPKEEP, TECHS, YEAR_DAYS, economyOf, integrateError, integratePrice, isVassal, lawChangeDay,
    manpowerOf, militaryPowerOf, neighboursOf, overlordOf, subjectsOf } from "../engine/index.js";
import { navalNeed } from "./navy.js";
import { exposed, nextToEnemy, ownSettlements, reserveOf, threatsOf } from "./util.js";

// the day the country's last war with a real country ended (0 if it never fought one)
function peaceSince(st, code) {
    return Math.max(0, ...Object.entries(st.memory.lastWar).filter(([k]) => k.split("|").includes(code)).map(([, d]) => d));
}

// the law a country wants: Feudal levy in peace; Standing army at war or under threat; Militarized against a stronger enemy or
// two; Mass levy for a war fought for its life — an enemy side twice its strength, a core town besieged, or a quarter of the
// towns it began with lost; Scrape the barrel for a last stand — its capital besieged or lost, or half its cores in enemy hands,
// against two and a half times its strength. Either only if the money will carry it: what the soldiers its new cap lets it raise
// and the law's own cut of its money cost, beyond what it earns, covered two years over by its treasury and the loans it may
// still take; else a step down
export function lawFor(game, code, e, enemies) {
    const st = game.state, c = st.countries[code], real = enemies.filter((x) => !st.countries[x].rebel);
    const mine = Math.max(1, militaryPowerOf(st, code)), theirs = real.reduce((n, x) => n + militaryPowerOf(st, x), 0);
    const strongest = Math.max(0, ...real.map((x) => militaryPowerOf(st, x)));
    const own = Object.values(st.settlements).filter((s) => s.owner === code), cores = Object.values(st.settlements).filter((s) => s.cores.includes(code));
    const started = game.map.scenario.countries.find((x) => x.code === code)?.settlements ?? [];
    const lostStart = started.length ? started.filter((id) => st.settlements[id]?.owner !== code).length / started.length : 0;
    const lostCores = cores.length ? cores.filter((s) => s.owner !== code).length / cores.length : 0;
    const capital = st.settlements[c.capital];
    const besiegedCore = own.some((s) => s.siege && s.cores.includes(code)), capitalInDanger = !capital || capital.owner !== code || Boolean(capital.siege);
    const wanted = [];
    if (real.length && (capitalInDanger || lostCores >= 0.5) && theirs >= 2.5 * mine) wanted.push("barrel");
    if (real.length && (theirs >= 2 * mine || besiegedCore || lostStart >= 0.25)) wanted.push("mass");
    if ((real.length && strongest > 1.5 * mine) || real.length >= 2) wanted.push("militarized");
    if (enemies.length || threatRatio(game, code) > 1.3) wanted.push("standing");
    // the money check, for the two harshest: the soldiers its new cap allows, at upkeep and the tax they no longer pay, and the
    // law's cut of its settlement money — beyond what it earns, two years of it covered by the treasury and its loan room
    const carries = (law) => {
        const extra = Math.max(0, LAWS[law].army * manpowerOf(st, code) - e.armySoldiers);
        const cost = extra * (SOLDIER_UPKEEP + (c.tax ?? 2)) + (LAWS[law].penalty - LAWS[c.law ?? "feudal"].penalty) * e.settlementMoney;
        const short = Math.max(0, cost - e.moneyPerYear);
        return short === 0 || c.treasury + Math.max(0, e.loanLimit - c.loans) >= 2 * short;
    };
    return wanted.find((law) => !LAWS[law].unrest || carries(law)) ?? "feudal";
}

// how much stronger than the country its strongest neighbour is (0 with no neighbour)
export function threatRatio(game, code) {
    const st = game.state, mine = Math.max(1, militaryPowerOf(st, code));
    return Math.max(0, ...neighboursOf(game, code).map((c) => militaryPowerOf(st, c))) / mine;
}

// the tech to research next: the guns, then — only for a country facing a stronger fleet where it has a port, the only one
// that builds anything but cogs (navy.js) — the ships
const LAND = ["handCannons", "arquebuses", "sharpshooters", "muskets"], SEA = ["carracks", "galleons", "menOfWar"];
function nextTech(game, code) {
    const c = game.state.countries[code];
    const open = (t) => !c.techs.includes(t) && c.techs.includes(TECHS[t].needs);
    return LAND.find(open) ?? (navalNeed(game, code) ? SEA.find(open) : undefined);
}

export function economyOrders(game, code, fl, ctx) {
    const st = game.state, c = st.countries[code], e = economyOf(game, code), out = [];
    const enemies = threatsOf(st, code), atWarNow = enemies.length > 0, reserve = reserveOf(e);
    const cmd = (type, rest = {}) => out.push({ type, country: code, ...rest });

    // a capital lost: the largest city held becomes the new one, or the largest settlement if it holds no city — the capital
    // trains soldiers twice as fast (RULES.md §2); retaking the old one makes it the capital again by itself
    if (st.settlements[c.capital]?.owner !== code) {
        const city = (s) => game.map.scenario.settlements.find((x) => x.id === s.id)?.type === "city";
        const pick = ownSettlements(st, code).sort((a, b) => city(b) - city(a) || b.pop - a.pop || a.id - b.id)[0];
        if (pick) cmd("setCapital", { settlement: pick.id });
    }

    // the bank: what is put by comes out when a war starts or the treasury runs thin (it pays 3% a year, RULES.md §2)
    if (c.bank > 0 && ((atWarNow && c.treasury < 2 * reserve) || c.treasury < 0.5 * reserve)) {
        const amount = Math.min(c.bank, Math.max(LOAN_CHUNK, 2 * reserve - c.treasury));
        cmd("withdraw", { amount });
        ctx.budget += amount;
    }

    // regions: one its capital lies in, held whole by it and its vassals and not all its core yet, is proclaimed (RULES.md, Special coring)
    const ours = (owner) => owner === code || (isVassal(st, owner) && overlordOf(st, owner) === code);
    for (const f of game.map.scenario.formables ?? []) {
        if (st.settlements[c.capital]?.owner !== code || !f.settlements.includes(c.capital)) continue;
        if (f.settlements.every((id) => ours(st.settlements[id]?.owner)) && f.settlements.some((id) => !st.settlements[id].cores.includes(code))) cmd("proclaim", { region: f.id });
    }

    // tax: none above 2 in peace, a little in war, more if the treasury needs it
    let tax = atWarNow ? 2.2 : 2.0;
    if (c.treasury < 0 && e.moneyPerYear < 0) tax = 3.0;
    else if (e.moneyPerYear < 0 || c.treasury < 0) tax = 2.5;
    else if (atWarNow && c.treasury < 0.5 * reserve) tax = 2.4;
    if (tax !== c.tax) cmd("setTax", { tax });

    // research: less when poor and at war, more when rich (the bank counts) and at peace — and none once there is nothing left
    // it wants: under 50% the slider adds to the money (RULES.md §4), so research with no tech to reach is money thrown away
    const wealth = c.treasury + (c.bank ?? 0);
    const tech = c.target ?? nextTech(game, code);
    let slider = 50;
    if (!tech) slider = 0;
    else if (c.treasury < 0 || (atWarNow && c.treasury < reserve)) slider = 20;
    else if (wealth > 6 * reserve) slider = 100;
    else if (!atWarNow && wealth > 3 * reserve) slider = 70;
    if (slider !== c.slider) cmd("setSlider", { slider });
    if (!c.target && tech) cmd("research", { tech });

    // the law (RULES.md §9): more soldiers when at war or when a neighbour is strong; more again against a stronger enemy or two;
    // and the two harshest only for a war fought for its life (lawFor) — if the money will carry them. Up when the rules allow
    // (five years after the last change); down from those two as soon as the danger passes and the rules allow (a year), from the
    // milder ones after a year of peace, so a war that comes back does not find it locked low for five years
    const law = lawFor(game, code, e, enemies);
    if (law !== c.law && st.day >= lawChangeDay(c, law)) {
        const down = LAWS[law].army < LAWS[c.law ?? "feudal"].army, harsh = LAWS[c.law ?? "feudal"].unrest > 0;
        if (!down || harsh || (!atWarNow && st.day - peaceSince(st, code) >= YEAR_DAYS)) cmd("setLaw", { law });
    }

    // loans: borrow in war when the treasury is thin; repay when it is fat
    const spare = c.treasury - reserve;
    if (c.loans > 0 && c.treasury < 0 && e.moneyPerYear < 0 && c.debtSince !== null && st.day - c.debtSince >= YEAR_DAYS) {
        cmd("defaultOnLoans");
    } else if (atWarNow && c.treasury < 0.5 * reserve && c.loans < 0.7 * e.loanLimit && e.moneyPerYear > 0 && st.day >= c.noBorrowUntil) {
        // no more than the bankers lend: what is left under the loan limit, in whole chunks (none at all for a small country)
        const room = Math.floor((e.loanLimit - c.loans) / LOAN_CHUNK);
        if (room > 0) cmd("borrow", { chunks: Math.min(4, room, Math.max(1, Math.ceil((reserve - c.treasury) / LOAN_CHUNK))) });
    } else if (c.loans > 0 && spare > c.loans + reserve) {
        // what this think has spent already (forces: men raised armed, weapons) is gone by the time the repayment is applied
        const chunks = Math.min(Math.floor(c.loans / LOAN_CHUNK), Math.floor(spare / LOAN_CHUNK / 2) || 1, Math.floor(Math.max(0, ctx.budget) / LOAN_CHUNK));
        if (chunks > 0) { cmd("repay", { chunks }); ctx.budget -= chunks * LOAN_CHUNK; }
    }

    // a vassal of 10 years is integrated, one a year, when the money is there (RULES.md §10, Integration): its land becomes core
    // and its armies ours, and it can no longer break free. A person's vassal is asked once a year, as the computer asks a
    // person anything (diplomacy.js, mayAsk), and not while a question of ours waits for them.
    const askable = (v) => !st.humans.includes(v) || (!st.offers.some((o) => o.from === code && o.to === v)
        && st.day - (ctx.asked?.get(`${code}>${v}>integrate`) ?? -Infinity) >= YEAR_DAYS);
    const ripe = subjectsOf(st, code).filter((v) => !integrateError(game, code, v) && integratePrice(game, v) <= ctx.budget && askable(v)).sort();
    if (ripe.length) {
        ctx.budget -= integratePrice(game, ripe[0]);
        if (st.humans.includes(ripe[0])) ctx.asked?.set(`${code}>${ripe[0]}>integrate`, st.day);
        cmd("integrate", { target: ripe[0] });
    }

    // buildings: courthouses where a settlement is compliant and not core, then walls at the front in war, libraries, workshops, markets
    const own = ownSettlements(st, code).sort((a, b) => b.pop - a.pop || a.id - b.id);
    const buy = (building, s) => {
        if (s[building] || ctx.budget < BUILDING_PRICE[building]) return false;
        ctx.budget -= BUILDING_PRICE[building];
        cmd("buyBuilding", { building, settlement: s.id });
        return true;
    };
    let bought = 0;
    // a courthouse where a settlement is not core but its people are compliant (20 years held): it becomes core at once
    for (const s of own) if (bought < 2 && !s.cores.includes(code) && st.day - s.heldSince >= CORING_DAYS && buy("courthouse", s)) bought++;
    if (atWarNow) for (const s of own) if (bought < 2 && nextToEnemy(game, code, String(s.id)) && s.pop >= 15000 && buy("walls", s)) bought++;
    const libraries = own.filter((s) => s.library).length;
    if (libraries < MAX_LIBRARIES && fl.builder > 0.4) for (const s of own) if (bought < 2 && !s.library && buy("library", s)) { bought++; break; }
    for (const s of own) if (bought < 2 && !s.workshop && buy("workshop", s)) { bought++; break; }
    for (const s of own) if (bought < 2 && s.workshop && !s.market && buy("market", s)) { bought++; break; }
    for (const s of own) if (bought < 2 && !s.walls && exposed(game, code, String(s.id)) && s.pop >= 20000 && fl.builder > 0.6 && buy("walls", s)) { bought++; break; }
    // a first holding its lead in the endgame walls every exposed settlement of 10,000 or more
    if (fl.defending) for (const s of own) if (bought < 2 && !s.walls && exposed(game, code, String(s.id)) && s.pop >= 10000 && buy("walls", s)) bought++;

    // the bank, in peace and free of loans: what is left above three reserves once this think's spending is done goes in
    const left = c.treasury - (ctx.start - ctx.budget);
    if (!atWarNow && c.loans === 0 && reserve > 0 && left > 3 * reserve + LOAN_CHUNK) cmd("deposit", { amount: Math.floor(left - 2 * reserve) });
    return out;
}
