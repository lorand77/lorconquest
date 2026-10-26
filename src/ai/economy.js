// The computer player's yearly economy (docs/design.md, "The computer players", strategy layer): tax, the research
// slider and what to research, the law, loans and which buildings to buy. It keeps a reserve of a third of a year's money,
// taxes lightly in peace and harder in war, and spends what is above the reserve on the buildings that pay. A country in
// distress — in the red and losing money, as one that borrowed in a war and then lost its land is — taxes as much as it may,
// sends home the soldiers its law no longer allows (forces.js), and after a year of it defaults on its loans, which the
// rules allow once in 20 years, rather than sit in debt until the bankers' interest has eaten it.
import { BUILDING_PRICE, CORING_DAYS, LAW_DAYS, LOAN_CHUNK, MAX_LIBRARIES, TECHS, YEAR_DAYS, economyOf, isVassal, militaryPowerOf, neighboursOf, overlordOf } from "../engine/index.js";
import { navalNeed } from "./navy.js";
import { exposed, nextToEnemy, ownSettlements, reserveOf, threatsOf } from "./util.js";

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

    // research: less when poor and at war, more when rich (the bank counts) and at peace
    const wealth = c.treasury + (c.bank ?? 0);
    let slider = 50;
    if (c.treasury < 0 || (atWarNow && c.treasury < reserve)) slider = 20;
    else if (wealth > 6 * reserve) slider = 100;
    else if (!atWarNow && wealth > 3 * reserve) slider = 70;
    if (slider !== c.slider) cmd("setSlider", { slider });
    if (!c.target) { const t = nextTech(game, code); if (t) cmd("research", { tech: t }); }

    // the law: more soldiers when at war or when a neighbour is strong; more again against a stronger enemy or two
    const mine = Math.max(1, militaryPowerOf(st, code)), strongestEnemy = Math.max(0, ...enemies.filter((x) => !st.countries[x].rebel).map((x) => militaryPowerOf(st, x)));
    let law = "feudal";
    if (atWarNow || threatRatio(game, code) > 1.3) law = "standing";
    if ((atWarNow && strongestEnemy > 1.5 * mine) || enemies.filter((x) => !st.countries[x].rebel).length >= 2) law = "militarized";
    if (law !== c.law && (c.lawDay === null || st.day - c.lawDay >= LAW_DAYS)) cmd("setLaw", { law });

    // loans: borrow in war when the treasury is thin; repay when it is fat
    const spare = c.treasury - reserve;
    if (c.loans > 0 && c.treasury < 0 && e.moneyPerYear < 0 && c.debtSince !== null && st.day - c.debtSince >= YEAR_DAYS) {
        cmd("defaultOnLoans");
    } else if (atWarNow && c.treasury < 0.5 * reserve && c.loans < 0.7 * e.loanLimit && e.moneyPerYear > 0 && st.day >= c.noBorrowUntil) {
        cmd("borrow", { chunks: Math.min(4, Math.max(1, Math.ceil((reserve - c.treasury) / LOAN_CHUNK))) });
    } else if (c.loans > 0 && spare > c.loans + reserve) {
        // what this think has spent already (forces: men raised armed, weapons) is gone by the time the repayment is applied
        const chunks = Math.min(Math.floor(c.loans / LOAN_CHUNK), Math.floor(spare / LOAN_CHUNK / 2) || 1, Math.floor(Math.max(0, ctx.budget) / LOAN_CHUNK));
        if (chunks > 0) { cmd("repay", { chunks }); ctx.budget -= chunks * LOAN_CHUNK; }
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
