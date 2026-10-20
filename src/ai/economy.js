// The computer player's yearly economy (docs/design.md, "The computer players", strategy layer): tax, the research
// slider and what to research, the law, loans and which buildings to buy. It keeps a reserve of a third of a year's money,
// taxes lightly in peace and harder in war, and spends what is above the reserve on the buildings that pay.
import { BUILDING_PRICE, LAW_DAYS, LOAN_CHUNK, MAX_LIBRARIES, TECHS, economyOf, militaryPowerOf, neighboursOf } from "../engine/index.js";
import { enemiesOf, exposed, nextToEnemy, ownSettlements, reserveOf } from "./util.js";

// how much stronger than the country its strongest neighbour is (0 with no neighbour)
export function threatRatio(game, code) {
    const st = game.state, mine = Math.max(1, militaryPowerOf(st, code));
    return Math.max(0, ...neighboursOf(game, code).map((c) => militaryPowerOf(st, c))) / mine;
}

// the tech to research next: guns first, then ships for a country that has them
const TECH_ORDER = ["handCannons", "arquebuses", "sharpshooters", "muskets", "carracks", "galleons", "menOfWar"];
function nextTech(game, code) {
    const st = game.state, c = st.countries[code];
    const ships = Object.values(st.fleets).some((f) => f.owner === code);
    return TECH_ORDER.find((t) => !c.techs.includes(t) && c.techs.includes(TECHS[t].needs) && (ships || !["carracks", "galleons", "menOfWar"].includes(t)));
}

export function economyOrders(game, code, fl, ctx) {
    const st = game.state, c = st.countries[code], e = economyOf(game, code), out = [];
    const enemies = enemiesOf(st, code), atWarNow = enemies.length > 0, reserve = reserveOf(e);
    const cmd = (type, rest = {}) => out.push({ type, country: code, ...rest });

    // tax: none above 2 in peace, a little in war, more if the treasury needs it
    let tax = atWarNow ? 2.2 : 2.0;
    if (e.moneyPerYear < 0 || c.treasury < 0) tax = 2.5;
    else if (atWarNow && c.treasury < 0.5 * reserve) tax = 2.4;
    if (tax !== c.tax) cmd("setTax", { tax });

    // research: less when poor and at war, more when rich and at peace
    let slider = 50;
    if (c.treasury < 0 || (atWarNow && c.treasury < reserve)) slider = 20;
    else if (c.treasury > 6 * reserve) slider = 100;
    else if (!atWarNow && c.treasury > 3 * reserve) slider = 70;
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
    if (atWarNow && c.treasury < 0.5 * reserve && c.loans < 0.7 * e.loanLimit && e.moneyPerYear > 0) {
        cmd("borrow", { chunks: Math.min(4, Math.max(1, Math.ceil((reserve - c.treasury) / LOAN_CHUNK))) });
    } else if (c.loans > 0 && spare > c.loans + reserve) {
        const chunks = Math.min(Math.floor(c.loans / LOAN_CHUNK), Math.floor(spare / LOAN_CHUNK / 2) || 1);
        cmd("repay", { chunks });
        ctx.budget -= chunks * LOAN_CHUNK;
    }

    // buildings: courthouses where a settlement is not core for it (it becomes core after 20 years held), then walls at the front in war, libraries, workshops, markets
    const own = ownSettlements(st, code).sort((a, b) => b.pop - a.pop || a.id - b.id);
    const buy = (building, s) => {
        if (s[building] || ctx.budget < BUILDING_PRICE[building]) return false;
        ctx.budget -= BUILDING_PRICE[building];
        cmd("buyBuilding", { building, settlement: s.id });
        return true;
    };
    let bought = 0;
    for (const s of own) if (bought < 2 && !s.cores.includes(code) && buy("courthouse", s)) bought++;
    if (atWarNow) for (const s of own) if (bought < 2 && nextToEnemy(game, code, String(s.id)) && s.pop >= 15000 && buy("walls", s)) bought++;
    const libraries = own.filter((s) => s.library).length;
    if (libraries < MAX_LIBRARIES && fl.builder > 0.4) for (const s of own) if (bought < 2 && !s.library && buy("library", s)) { bought++; break; }
    for (const s of own) if (bought < 2 && !s.workshop && buy("workshop", s)) { bought++; break; }
    for (const s of own) if (bought < 2 && s.workshop && !s.market && buy("market", s)) { bought++; break; }
    for (const s of own) if (bought < 2 && !s.walls && exposed(game, code, String(s.id)) && s.pop >= 20000 && fl.builder > 0.6 && buy("walls", s)) { bought++; break; }
    return out;
}
