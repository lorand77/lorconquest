// The panels of running a country (design.md, "The game screen"): the Country tab (money, tax, research, law, bank,
// loans, regions), the Shop tab (buildings, forces, weapons, people, sharpshooters, ships and what is queued), the
// Research tab, the panel of a selected fleet, and an army's equipment. Every control sends a command to the server,
// whose engine decides; the numbers shown come from the browser's copy of the engine (economyOf and its friends),
// run on the mirrored state, so they are the server's own formulas. Nothing here changes the game.
import { BUILDING_PRICE, CANNON_PRICE, LAWS, LAW_DAYS, MERCENARY_PRICE, PEOPLE_PRICE, SHARPSHOOTERS_PER_PASS, SHARPSHOOTER_PRICE, SHIPS, SHIP_PRICE,
    TECHS, TRAIN_CAPITAL_DAYS, TRAIN_OTHER_DAYS, WEAPONS, WEAPON_PRICE, economyOf, isCore, longDate, techCost } from "/engine/index.js";
import { formatNumber } from "./mirror.js";

const n = formatNumber;
const money = (x) => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : n(x));
const pct = (x) => `${Math.round(x * 100)}%`;
const WEAPON_NAMES = { unarmed: "unarmed", swords: "swords", pikes: "pikes", cavalry: "cavalry", handCannons: "hand cannons", arquebuses: "arquebuses", muskets: "muskets" };
const SHIP_NAMES = { cogs: "cogs", carracks: "carracks", galleons: "galleons", menOfWar: "men-of-war" };
const TECH_NAMES = { handCannons: "Hand cannons", arquebuses: "Arquebuses", muskets: "Muskets", sharpshooters: "Sharpshooters", carracks: "Carracks", galleons: "Galleons", menOfWar: "Men-of-war" };

const section = (ctx, title, ...children) => ctx.make("section", { class: "block" }, ctx.make("h3", {}, title), ...children);
const line = (ctx, label, value, cls = "") => ctx.make("div", { class: `kv ${cls}` }, ctx.make("span", {}, label), ctx.make("b", {}, value));
const row = (ctx, ...children) => ctx.make("div", { class: "row" }, ...children);

function select(ctx, options, value) {
    const sel = ctx.make("select", {}, ...options.map(([v, label]) => ctx.make("option", { value: String(v), ...(String(v) === String(value) ? { selected: "selected" } : {}) }, label)));
    return sel;
}
const numberInput = (ctx, value, min, max, step = 1) => ctx.make("input", { type: "number", min, max, step, value });

// a command sent, then the panels redrawn at once
const act = (ctx, cmd) => async () => { const r = await ctx.send(cmd()); ctx.redraw(); return r; };

// ---------- Country ----------
export function countryTab(ctx) {
    const { state, game, me, make } = ctx;
    const c = state.countries[me], e = economyOf(game, me), day = state.day;
    const out = [];

    const taxLabel = make("b", {}, c.tax.toFixed(1));
    const tax = make("input", { type: "range", min: 20, max: 30, step: 1, value: Math.round(c.tax * 10) });
    tax.addEventListener("input", () => { taxLabel.textContent = (tax.value / 10).toFixed(1); });
    tax.addEventListener("change", act(ctx, () => ({ type: "setTax", tax: Number(tax.value) / 10 })));
    const slider = make("input", { type: "range", min: 0, max: 100, step: 10, value: c.slider });
    const sliderLabel = make("b", {}, `${c.slider}%`);
    slider.addEventListener("input", () => { sliderLabel.textContent = `${slider.value}%`; });
    slider.addEventListener("change", act(ctx, () => ({ type: "setSlider", slider: Number(slider.value) })));

    out.push(section(ctx, "Money",
        line(ctx, "Settlement money a year", money(e.settlementMoney)),
        line(ctx, "Soldiers' upkeep", `−${money(e.upkeep)}`),
        e.mercenaryUpkeep ? line(ctx, "Mercenaries' upkeep", `−${money(e.mercenaryUpkeep)}`) : "",
        e.interest ? line(ctx, "Loan interest", `−${money(e.interest)}`) : "",
        line(ctx, "Money a year", `${e.moneyPerYear >= 0 ? "+" : "−"}${money(Math.abs(e.moneyPerYear))}`, e.moneyPerYear < 0 ? "bad" : "good"),
        line(ctx, "Treasury", money(c.treasury), c.treasury < 0 ? "bad" : ""),
        c.bank ? line(ctx, "In the bank", money(c.bank)) : "",
        c.loans ? line(ctx, "Loans", `${money(c.loans)} of ${money(e.loanLimit)}`) : "",
        c.debtSince !== null ? make("p", { class: "bad" }, `In debt since ${longDate(c.debtSince)}: bankruptcy 10 years on if it is over ${money(e.pop * 10)}.`) : "",
        row(ctx, make("label", {}, "Tax ", taxLabel), tax),
        make("p", { class: "hint" }, `The chance of peasants rising each year, at this tax kept all year: ${pct((c.tax - 2) ** 2 * 0.25)}.`),
        row(ctx, make("label", {}, "Research ", sliderLabel), slider),
        line(ctx, "Research a year", `${money(e.rPerYear)} R${e.libraries ? ` (${e.libraries} libraries: +${e.libraries * 5}%)` : ""}`)));

    // the law: caps and the income it costs
    const law = select(ctx, Object.entries(LAWS).map(([k, l]) => [k, `${l.name}: army ${pct(l.army)}, navy ${pct(l.navy)}, income −${pct(l.penalty)}`]), c.law);
    const wait = c.lawDay !== null && day - c.lawDay < LAW_DAYS ? `The law can change again on ${longDate(c.lawDay + LAW_DAYS)}.` : "";
    law.addEventListener("change", act(ctx, () => ({ type: "setLaw", law: law.value })));
    out.push(section(ctx, "People and law",
        line(ctx, "People", n(e.pop)),
        line(ctx, "Soldiers", `${n(e.armySoldiers)} of ${n(e.armyCap)} allowed`, e.armySoldiers > e.armyCap ? "bad" : ""),
        e.crewAtSea ? line(ctx, "Ship crew at sea", `${n(e.crewAtSea)} of ${n(e.navyCap)} allowed`) : line(ctx, "Navy cap", n(e.navyCap)),
        line(ctx, "Mercenaries", `${n(e.mercenaries)} (at most ${n(e.armyCap)})`),
        e.rebels ? line(ctx, "Rebels under arms", n(e.rebels), "bad") : "",
        line(ctx, "Civilians", n(e.civilians)),
        row(ctx, law), wait ? make("p", { class: "hint" }, wait) : ""));

    // the bank and loans
    const amount = numberInput(ctx, 10000, 1, 100000000, 1000);
    out.push(section(ctx, "Bank and loans",
        row(ctx, amount,
            make("button", { onclick: act(ctx, () => ({ type: "deposit", amount: Number(amount.value) })) }, "Deposit"),
            make("button", { onclick: act(ctx, () => ({ type: "withdraw", amount: Number(amount.value) })) }, "Withdraw")),
        make("p", { class: "hint" }, "The bank pays 0.25% a month. Loans cost 8% a year, in chunks of 0.05M, up to two years of settlement money."),
        row(ctx,
            make("button", { onclick: act(ctx, () => ({ type: "borrow", chunks: 1 })) }, "Borrow 0.05M"),
            make("button", { onclick: act(ctx, () => ({ type: "repay", chunks: 1 })) }, "Repay 0.05M"),
            c.loans ? make("button", { class: "danger", onclick: async () => { if (confirm("Default? Every loan is cancelled, no banker will lend for 20 years, and half your mercenaries desert.")) { await ctx.send({ type: "defaultOnLoans" }); ctx.redraw(); } } }, "Default") : "")));

    // special coring
    const regions = (game.map.scenario.formables ?? []).filter((f) => f.settlements.includes(c.capital));
    if (regions.length) {
        out.push(section(ctx, "Regions to proclaim", make("p", { class: "hint" }, "Your capital is in each; you must hold all of it. Every settlement in it then becomes core at once."),
            ...regions.map((f) => {
                const held = f.settlements.filter((id) => state.settlements[id]?.owner === me), core = f.settlements.filter((id) => state.settlements[id]?.cores.includes(me));
                const ready = held.length === f.settlements.length && core.length < f.settlements.length;
                return row(ctx, make("span", {}, `${f.name}: ${held.length} of ${f.settlements.length} held${core.length === f.settlements.length ? ", all core" : ""}`),
                    ready ? make("button", { class: "primary", onclick: act(ctx, () => ({ type: "proclaim", region: f.id })) }, "Proclaim") : "");
            })));
    }

    // a lost capital
    if (state.settlements[c.capital]?.owner !== me) {
        const own = Object.values(state.settlements).filter((s) => s.owner === me);
        const cities = own.filter((s) => game.map.scenario.settlements.find((x) => x.id === s.id).type === "city");
        const pick = select(ctx, (cities.length ? cities : own).map((s) => [s.id, ctx.name(String(s.id))]), (cities.length ? cities : own)[0]?.id);
        out.push(section(ctx, "Capital lost", make("p", { class: "bad" }, "Name a new capital: a city if you own one."), row(ctx, pick, make("button", { class: "primary", onclick: act(ctx, () => ({ type: "setCapital", settlement: Number(pick.value) })) }, "Name it"))));
    }
    return out;
}

// ---------- Shop ----------
export function shopTab(ctx) {
    const { state, game, me, make } = ctx;
    const c = state.countries[me], e = economyOf(game, me), x = game.map.x;
    const out = [line(ctx, "Treasury", money(c.treasury), c.treasury < 0 ? "bad" : "")];
    const own = Object.values(state.settlements).filter((s) => s.owner === me);
    const core = own.filter((s) => isCore(state, s, me));
    const settlementOptions = (list) => list.map((s) => [s.id, ctx.name(String(s.id))]);
    const capital = state.settlements[c.capital]?.owner === me ? c.capital : null;

    // buildings, in the settlement selected on the map
    const sel = ctx.sel?.kind === "place" ? state.settlements[ctx.sel.key] : null;
    if (sel && sel.owner === me) {
        out.push(section(ctx, `Buildings in ${ctx.name(String(sel.id))}`, make("div", { class: "buttons" },
            ...Object.keys(BUILDING_PRICE).map((b) => (sel[b] ? make("span", { class: "owned" }, `✓ ${b}`)
                : make("button", { onclick: act(ctx, () => ({ type: "buyBuilding", building: b, settlement: sel.id })) }, `${b} ${money(BUILDING_PRICE[b])}`))))));
    } else out.push(make("p", { class: "hint" }, "Select one of your settlements on the map to build walls, a library, workshop, market or courthouse there."));

    // raising soldiers and crew
    const rs = select(ctx, settlementOptions(core), capital ?? core[0]?.id), rk = select(ctx, [["soldiers", "soldiers"], ["crew", "cannon crew"]], "soldiers"), rl = numberInput(ctx, 1, 1, 50);
    out.push(section(ctx, "Raise soldiers (free)",
        row(ctx, rs, rk, rl, make("span", {}, "× 1000")),
        make("p", { class: "hint" }, `Trained in a core settlement: ${Math.round(TRAIN_CAPITAL_DAYS / 30.4)} months in the capital, ${Math.round(TRAIN_OTHER_DAYS / 30.4)} elsewhere. Soldiers now ${n(e.armySoldiers)} of ${n(e.armyCap)}.`),
        make("button", { onclick: act(ctx, () => ({ type: "raise", settlement: Number(rs.value), kind: rk.value, lots: Number(rl.value) })) }, "Raise")));

    // mercenaries
    const ms = select(ctx, settlementOptions(core), capital ?? core[0]?.id), ml = numberInput(ctx, 1, 1, 50);
    out.push(section(ctx, "Hire mercenaries",
        row(ctx, ms, ml, make("span", {}, `× 1000, ${money(MERCENARY_PRICE)} each; they arrive in a month with pikes; 15 upkeep a man`)),
        make("button", { onclick: act(ctx, () => ({ type: "hireMercenaries", settlement: Number(ms.value), lots: Number(ml.value) })) }, "Hire")));

    // weapons into the reserve
    const weaponRows = Object.keys(WEAPON_PRICE).map((w) => {
        const have = c.techs.includes(w);
        return row(ctx, make("span", { class: "w" }, `${WEAPON_NAMES[w]}: ${n(c.reserve[w])} in reserve`),
            have ? make("button", { onclick: act(ctx, () => ({ type: "buyWeapons", weapon: w, lots: 1 })) }, `+1000 · ${money(WEAPON_PRICE[w])}`) : make("span", { class: "hint" }, "not unlocked"));
    });
    weaponRows.push(row(ctx, make("span", { class: "w" }, `cannons: ${n(c.reserve.cannons)} in reserve`), make("button", { onclick: act(ctx, () => ({ type: "buyWeapons", weapon: "cannons", lots: 1 })) }, `+100 · ${money(CANNON_PRICE)}`)));
    out.push(section(ctx, "Weapons", ...weaponRows, make("p", { class: "hint" }, "Equip an army from the reserve in its own panel. Each cannon needs 10 crew.")));

    out.push(section(ctx, "People", row(ctx, make("button", { onclick: act(ctx, () => ({ type: "buyPeople", lots: 1 })) }, `Buy 1000 people · ${money(PEOPLE_PRICE)}`))));

    // sharpshooters at your passes
    const passes = game.map.scenario.passes.filter((p) => state.settlements[p.land]?.owner === me);
    if (c.techs.includes("sharpshooters") && passes.length) {
        const ps = select(ctx, passes.map((p) => [p.id, `${p.id}${state.posts[p.id] ? ` (${state.posts[p.id].n})` : ""}`]), passes[0].id), pl = numberInput(ctx, 1, 1, 5);
        out.push(section(ctx, "Sharpshooters",
            row(ctx, ps, pl, make("span", {}, `× 100, ${money(SHARPSHOOTER_PRICE)} each; at most ${SHARPSHOOTERS_PER_PASS * x} a pass`)),
            make("button", { onclick: act(ctx, () => ({ type: "buySharpshooters", pass: ps.value, lots: Number(pl.value) })) }, "Station")));
    }

    // ships in your ports
    const ports = own.filter((s) => game.map.nodes.get(String(s.id)).port);
    if (ports.length) {
        const kinds = SHIPS.filter((k) => c.techs.includes(k));
        const bp = select(ctx, settlementOptions(ports), ports.find((s) => s.id === capital)?.id ?? ports[0].id), bk = select(ctx, kinds.map((k) => [k, `${SHIP_NAMES[k]} · ${money(SHIP_PRICE[k])} for 10`]), kinds[0]), bl = numberInput(ctx, 1, 1, 20);
        out.push(section(ctx, "Ships",
            row(ctx, bp, bk, bl, make("span", {}, "× 10")),
            make("p", { class: "hint" }, "Ships in port need no crew; at sea each takes 50, within the navy cap."),
            make("button", { onclick: act(ctx, () => ({ type: "buyShips", port: Number(bp.value), kind: bk.value, lots: Number(bl.value) })) }, "Build")));
    }

    // what is on its way
    const queue = [...c.training.map((t) => `${n(t.n)} ${t.kind === "crew" ? "cannon crew" : "soldiers"} at ${ctx.name(String(t.settlement))}, ready ${longDate(t.ready)}`),
        ...c.hires.map((h) => `${n(h.n)} mercenaries at ${ctx.name(String(h.settlement))}, arriving ${longDate(h.ready)}`)];
    if (queue.length) out.push(section(ctx, "On their way", make("ul", { class: "queue" }, ...queue.map((q) => make("li", {}, q)))));
    return out;
}

// ---------- Research ----------
export function researchTab(ctx) {
    const { state, game, me, make } = ctx;
    const c = state.countries[me], e = economyOf(game, me);
    const out = [section(ctx, "Research",
        line(ctx, "R in store", n(c.r)),
        line(ctx, "R a year", n(e.rPerYear)),
        make("p", { class: "hint" }, "Choose one tech at a time. It unlocks the moment your R covers its cost, which is taken from the store; unspent R banks."))];
    const rows = Object.entries(TECHS).map(([id, t]) => {
        const cost = techCost(game, id), have = c.techs.includes(id), open = !have && c.techs.includes(t.needs), target = c.target === id;
        const bar = make("div", { class: "bar" }, make("i", { style: `width:${Math.min(100, (c.r / cost) * 100).toFixed(1)}%` }));
        return make("div", { class: `tech${have ? " done" : ""}${target ? " target" : ""}` },
            make("div", { class: "row" }, make("b", {}, TECH_NAMES[id]), make("span", { class: "hint" }, have ? "unlocked" : `${money(cost)} R · needs ${TECH_NAMES[t.needs] ?? t.needs}`)),
            ...(target ? [bar] : []),
            ...(open && !target ? [make("button", { onclick: act(ctx, () => ({ type: "research", tech: id })) }, "Research")] : []),
            ...(target ? [make("span", { class: "hint" }, "being researched")] : []));
    });
    out.push(section(ctx, "Technologies", ...rows));
    return out;
}

// ---------- Fleets ----------
export function fleetPanel(ctx, f) {
    const { state, game, me, make } = ctx, zones = game.map.zones;
    const total = SHIPS.reduce((k, s) => k + f.ships[s], 0);
    const out = [make("h2", {}, ctx.swatch(f.owner), ` Fleet ${f.id} · ${state.countries[f.owner].name}`),
        make("p", { class: "men" }, SHIPS.filter((s) => f.ships[s]).map((s) => `${n(f.ships[s])} ${SHIP_NAMES[s]}`).join(" · ") || "no ships")];
    const status = f.moving ? `Sailing from ${zones.get(f.zone).name} to ${zones.get(f.moving.to).name}, there ${longDate(Math.ceil(f.moving.end))}.`
        : f.port ? `In port at ${ctx.name(String(f.port))}.`
            : `At sea in ${zones.get(f.zone).name}.${f.order ? (f.order.type === "patrol" ? " On patrol." : ` Blockading ${ctx.name(String(f.order.port))}.`) : ""}`;
    out.push(make("p", {}, status));
    if (f.owner !== me || f.moving) return out;

    const buttons = [];
    const zone = zones.get(f.zone);
    const ports = zone.ports.filter((p) => state.settlements[p]?.owner === me && p !== f.port);
    if (f.port) buttons.push(make("button", { onclick: act(ctx, () => ({ type: "sail", fleet: f.id, zone: f.zone })) }, "Put to sea"));
    if (ports.length) {
        const pick = select(ctx, ports.map((p) => [p, ctx.name(String(p))]), ports[0]);
        buttons.push(row(ctx, pick, make("button", { onclick: act(ctx, () => ({ type: "sail", fleet: f.id, port: Number(pick.value) })) }, "Enter port")));
    }
    if (zone.next.length) {
        const pick = select(ctx, zone.next.map((z) => [z, zones.get(z).name]), zone.next[0]);
        buttons.push(row(ctx, pick, make("button", { onclick: act(ctx, () => ({ type: "sail", fleet: f.id, zone: pick.value })) }, "Sail (2 months)")));
    }
    if (!f.port) {
        buttons.push(make("button", { onclick: act(ctx, () => ({ type: "patrol", fleet: f.id })) }, "Patrol"));
        const enemyPorts = zone.ports.filter((p) => state.wars.some((w) => w.split("|").includes(me) && w.split("|").includes(state.settlements[p]?.owner)));
        if (enemyPorts.length) {
            const pick = select(ctx, enemyPorts.map((p) => [p, ctx.name(String(p))]), enemyPorts[0]);
            buttons.push(row(ctx, pick, make("button", { onclick: act(ctx, () => ({ type: "blockade", fleet: f.id, port: Number(pick.value) })) }, "Blockade")));
        }
        if (f.order) buttons.push(make("button", { onclick: act(ctx, () => ({ type: "hold", fleet: f.id })) }, "Hold"));
    }
    if (total > 1) {
        const inputs = SHIPS.filter((s) => f.ships[s]).map((s) => [s, numberInput(ctx, 0, 0, f.ships[s])]);
        buttons.push(make("details", {}, make("summary", {}, "Split…"),
            ...inputs.map(([s, i]) => make("label", {}, `${SHIP_NAMES[s]} `, i)),
            make("button", { class: "primary", onclick: async () => { const ships = {}; for (const [s, i] of inputs) if (Number(i.value)) ships[s] = Number(i.value); await ctx.send({ type: "splitFleet", fleet: f.id, ships }); ctx.redraw(); } }, "Split")));
    }
    for (const o of Object.values(state.fleets).filter((x) => x.owner === me && x.id !== f.id && !x.moving && x.zone === f.zone && x.port === f.port)) {
        buttons.push(make("button", { onclick: act(ctx, () => ({ type: "mergeFleet", fleet: f.id, into: o.id })) }, `Merge into fleet ${o.id}`));
    }
    out.push(make("div", { class: "buttons vertical" }, ...buttons));
    return out;
}

// ---------- an army's equipment ----------
export function armyEquipment(ctx, a) {
    const { state, make, me } = ctx, c = state.countries[me], out = [];
    const reserve = Object.entries(c.reserve).filter(([, k]) => k > 0).map(([w, k]) => `${n(k)} ${w === "cannons" ? "cannons" : WEAPON_NAMES[w]}`);
    const have = WEAPONS.filter((w) => a.men[w]);
    // by default the unarmed are armed with the best weapon the country has that the men do not carry already
    const start = have.includes("unarmed") ? "unarmed" : have[0];
    const choices = WEAPONS.filter((w) => w === "unarmed" || c.techs.includes(w));
    const best = ["muskets", "arquebuses", "cavalry", "handCannons", "pikes", "swords"].find((w) => w !== start && choices.includes(w));
    const from = select(ctx, have.map((w) => [w, `${n(a.men[w])} ${WEAPON_NAMES[w]}`]), start);
    const to = select(ctx, choices.map((w) => [w, WEAPON_NAMES[w]]), best);
    const count = numberInput(ctx, 100, 1, 1000000, 10);
    const cannons = numberInput(ctx, 1, 1, 1000);
    out.push(make("details", { class: "equip" }, make("summary", {}, "Equip, disband, dismiss…"),
        make("p", { class: "hint" }, `Reserve: ${reserve.join(", ") || "empty"}.`),
        row(ctx, make("span", {}, "Change"), count, from, make("span", {}, "to"), to,
            make("button", { onclick: act(ctx, () => ({ type: "equip", army: a.id, from: from.value, to: to.value, n: Number(count.value) })) }, "Equip")),
        c.reserve.cannons || a.cannons ? row(ctx, cannons,
            make("button", { onclick: act(ctx, () => ({ type: "equipCannons", army: a.id, n: Number(cannons.value) })) }, "Add cannons"),
            make("button", { onclick: act(ctx, () => ({ type: "equipCannons", army: a.id, n: -Number(cannons.value) })) }, "Return cannons")) : "",
        make("div", { class: "buttons" },
            make("button", { onclick: async () => { if (confirm(`Send ${n(Number(count.value))} ${WEAPON_NAMES[from.value]} home? Their weapons go to the reserve.`)) { await ctx.send({ type: "disband", army: a.id, men: { [from.value]: Number(count.value) } }); ctx.redraw(); } } }, "Disband men"),
            a.mercs ? make("button", { onclick: act(ctx, () => ({ type: "dismissMercenaries", army: a.id, n: Math.min(a.mercs, Number(count.value)) })) }, `Dismiss mercenaries (${n(a.mercs)})`) : "")));
    return out;
}
