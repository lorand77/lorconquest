// The commands of running a country (design.md §3; RULES.md §2-§4, §8, §9): tax, research, laws, the bank and
// loans, the shop, raising and equipping forces, and special coring. Each handler is given the game and the
// command, whose `country` is the one giving it, and answers { ok, events } or { ok: false, error }.
//
//   setTax { tax }  setSlider { slider }  setLaw { law }  research { tech }  setCapital { settlement }
//   deposit { amount }  withdraw { amount }  borrow { chunks }  repay { chunks }  defaultOnLoans {}
//   buyBuilding { building, settlement }  buyWeapons { weapon, lots }  buyPeople { lots }
//   buySharpshooters { pass, lots }  buyShips { kind, port, lots }
//   raise { settlement, kind: "soldiers" | "crew", lots }  hireMercenaries { settlement, lots }
//   equip { army, from, to, n }  equipCannons { army, n }  disband { army, men, cannons, crew }
//   dismissMercenaries { army, n }  proclaim { region }
import { CREW_PER_CANNON, WEAPONS, menOf, takeMen } from "./army.js";
import { longDate } from "./calendar.js";
import { afford, done, money, ownArmy, positive, refuse, whole } from "./command-util.js";
import { BUILDINGS, BUILDING_PRICE, CANNON_PRICE, DEFAULT_BAN_DAYS, LAWS, LAW_DAYS, LOAN_CHUNK, MAX_LIBRARIES, MERCENARY_DAYS,
    MERCENARY_PRICE, PEOPLE_PRICE, SHARPSHOOTER_PRICE, SHARPSHOOTERS_PER_PASS, SHIPS, SHIP_PRICE, TECHS, TRAIN_CAPITAL_DAYS,
    TRAIN_OTHER_DAYS, WEAPON_PRICE } from "./costs.js";
import { armyCapOf, armySoldiersOf, desert, economyOf, mercenariesOf, ownedBy, techCost, unlockTech } from "./economy.js";
import { newFleet, isCore, ownerOf } from "./state.js";

const mine = (game, cmd) => game.state.countries[cmd.country];
const near = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-9;

// the settlement a command names, if it is the country's own
function ownSettlement(game, cmd, id = cmd.settlement) {
    const s = game.state.settlements[id];
    return s && s.owner === cmd.country ? { s } : { error: `${id} is not ${cmd.country}'s settlement` };
}

// the weapons of one kind bought in lots: swords to muskets by the thousand, cannons by the hundred
const LOT = (weapon) => (weapon === "cannons" ? 100 : 1000);
const PRICE = (weapon) => (weapon === "cannons" ? CANNON_PRICE : WEAPON_PRICE[weapon]);
const unlocked = (c, tech) => c.techs.includes(tech);

export const countryCommands = {
    setTax(game, cmd) {
        const t = cmd.tax;
        if (typeof t !== "number" || t < 2 || t > 3 || !near(t, 0.1)) return refuse("the tax is from 2 to 3 in steps of 0.1");
        mine(game, cmd).tax = Math.round(t * 10) / 10;
        return done();
    },

    setSlider(game, cmd) {
        const v = cmd.slider;
        if (!Number.isInteger(v) || v < 0 || v > 100 || v % 10) return refuse("the research slider is from 0% to 100% in steps of 10%");
        mine(game, cmd).slider = v;
        return done();
    },

    setLaw(game, cmd) {
        const c = mine(game, cmd), st = game.state;
        if (!Object.hasOwn(LAWS, cmd.law)) return refuse(`no law ${cmd.law}`);
        if (c.law === cmd.law) return refuse(`${LAWS[c.law].name} is already the law`);
        if (c.lawDay !== null && st.day - c.lawDay < LAW_DAYS) return refuse(`the law cannot change again until ${longDate(c.lawDay + LAW_DAYS)}`);
        c.law = cmd.law;
        c.lawDay = st.day;
        return done([{ type: "law", day: st.day, country: c.code, law: cmd.law }]);
    },

    research(game, cmd) {
        const c = mine(game, cmd), tech = cmd.tech;
        if (!Object.hasOwn(TECHS, tech)) return refuse(`no tech ${tech}`);
        if (unlocked(c, tech)) return refuse(`${tech} is already unlocked`);
        if (!unlocked(c, TECHS[tech].needs)) return refuse(`${tech} needs ${TECHS[tech].needs} first`);
        c.target = tech;
        const events = [];
        unlockTech(game, c.code, events);
        return done(events);
    },

    setCapital(game, cmd) {
        const st = game.state, c = mine(game, cmd);
        if (st.settlements[c.capital]?.owner === c.code) return refuse("your capital still stands");
        const { s, error } = ownSettlement(game, cmd);
        if (error) return refuse(error);
        const cities = ownedBy(st, c.code).filter((x) => game.map.scenario.settlements.find((y) => y.id === x.id).type === "city");
        if (cities.length && !cities.includes(s)) return refuse("name a city as the capital: you own one");
        c.capital = s.id;
        return done([{ type: "capital", day: st.day, country: c.code, settlement: s.id }]);
    },

    deposit(game, cmd) {
        const c = mine(game, cmd), a = cmd.amount;
        if (typeof a !== "number" || !(a > 0) || !Number.isFinite(a)) return refuse("deposit a positive amount");
        const why = afford(c, a);
        if (why) return refuse(why);
        c.treasury -= a;
        c.bank += a;
        return done();
    },

    withdraw(game, cmd) {
        const c = mine(game, cmd), a = cmd.amount;
        if (typeof a !== "number" || !(a > 0) || !Number.isFinite(a)) return refuse("withdraw a positive amount");
        if (a > c.bank) return refuse(`the bank holds ${money(c.bank)}`);
        c.bank -= a;
        c.treasury += a;
        return done();
    },

    borrow(game, cmd) {
        const c = mine(game, cmd), st = game.state;
        if (!positive(cmd.chunks)) return refuse("borrow a whole number of chunks of 0.05M");
        if (st.day < c.noBorrowUntil) return refuse(`no banker will lend to you until ${longDate(c.noBorrowUntil)}`);
        const e = economyOf(game, c.code), amount = cmd.chunks * LOAN_CHUNK;
        if (c.loans + amount > e.loanLimit) return refuse(`loans may total 2 years of settlement money: ${money(e.loanLimit)}; you owe ${money(c.loans)}`);
        c.loans += amount;
        c.treasury += amount;
        return done();
    },

    repay(game, cmd) {
        const c = mine(game, cmd);
        if (!positive(cmd.chunks)) return refuse("repay a whole number of chunks of 0.05M");
        const amount = cmd.chunks * LOAN_CHUNK;
        if (amount > c.loans) return refuse(`you owe ${money(c.loans)}`);
        const why = afford(c, amount);
        if (why) return refuse(why);
        c.loans -= amount;
        c.treasury -= amount;
        return done();
    },

    // as Spain did six times: every loan is cancelled, nothing is sold, no banker lends again for 20 years, and half
    // the mercenaries, paid from those loans, desert at once (RULES.md §2)
    defaultOnLoans(game, cmd) {
        const c = mine(game, cmd), st = game.state, events = [{ type: "default", day: st.day, country: c.code, owed: c.loans }];
        if (c.loans <= 0) return refuse("you owe nothing");
        c.loans = 0;
        c.noBorrowUntil = st.day + DEFAULT_BAN_DAYS;
        desert(game, c.code, 0.5, events);
        return done(events);
    },

    buyBuilding(game, cmd) {
        const c = mine(game, cmd);
        if (!BUILDINGS.includes(cmd.building)) return refuse(`no building ${cmd.building}`);
        const { s, error } = ownSettlement(game, cmd);
        if (error) return refuse(error);
        if (s[cmd.building]) return refuse(`${cmd.settlement} has its ${cmd.building} already`);
        if (cmd.building === "library" && ownedBy(game.state, c.code).filter((x) => x.library).length >= MAX_LIBRARIES) return refuse(`${MAX_LIBRARIES} libraries are the most that count`);
        const why = afford(c, BUILDING_PRICE[cmd.building]);
        if (why) return refuse(why);
        c.treasury -= BUILDING_PRICE[cmd.building];
        s[cmd.building] = true;
        return done();
    },

    buyWeapons(game, cmd) {
        const c = mine(game, cmd), w = cmd.weapon;
        if (!Object.hasOwn(c.reserve, w)) return refuse(`no weapon ${w}`);
        if (!positive(cmd.lots)) return refuse("buy a whole number of lots");
        if (!unlocked(c, w)) return refuse(`${w} is not unlocked yet`);
        const cost = cmd.lots * PRICE(w);
        const why = afford(c, cost);
        if (why) return refuse(why);
        c.treasury -= cost;
        c.reserve[w] += cmd.lots * LOT(w);
        return done();
    },

    // 1000 people, spread over the country's settlements in proportion to their pop (RULES.md §3)
    buyPeople(game, cmd) {
        const c = mine(game, cmd), owned = ownedBy(game.state, c.code);
        if (!positive(cmd.lots)) return refuse("buy a whole number of lots of 1000 people");
        const total = owned.reduce((n, s) => n + s.pop, 0);
        if (!total) return refuse("you have no settlements");
        const why = afford(c, cmd.lots * PEOPLE_PRICE);
        if (why) return refuse(why);
        c.treasury -= cmd.lots * PEOPLE_PRICE;
        for (const s of owned) s.pop += cmd.lots * 1000 * s.pop / total;
        return done();
    },

    buySharpshooters(game, cmd) {
        const st = game.state, c = mine(game, cmd), key = String(cmd.pass);
        if (game.map.nodes.get(key)?.kind !== "pass") return refuse(`no pass ${cmd.pass}`);
        if (ownerOf(game, key) !== c.code) return refuse(`pass ${key} lies in the land of ${ownerOf(game, key)}`);
        if (!positive(cmd.lots)) return refuse("buy a whole number of lots of 100");
        if (!unlocked(c, "sharpshooters")) return refuse("sharpshooters are not unlocked yet");
        const n = cmd.lots * 100, held = st.posts[key]?.n ?? 0, most = SHARPSHOOTERS_PER_PASS * game.map.x;
        if (held + n > most) return refuse(`a pass holds at most ${most} sharpshooters; this one has ${held}`);
        if (armySoldiersOf(st, c.code) + n > armyCapOf(st, c.code)) return refuse("that is more soldiers than your law allows");
        const why = afford(c, cmd.lots * SHARPSHOOTER_PRICE);
        if (why) return refuse(why);
        c.treasury -= cmd.lots * SHARPSHOOTER_PRICE;
        st.posts[key] = { owner: c.code, n: held + n };
        return done();
    },

    // ten ships of a kind in a port of the country, joining a fleet there or forming one (RULES.md §3)
    buyShips(game, cmd) {
        const st = game.state, c = mine(game, cmd), kind = cmd.kind;
        if (!SHIPS.includes(kind)) return refuse(`no ship ${kind}`);
        if (!positive(cmd.lots)) return refuse("buy a whole number of lots of 10 ships");
        if (!unlocked(c, kind)) return refuse(`${kind} are not unlocked yet`);
        const { s, error } = ownSettlement(game, cmd, cmd.port);
        if (error) return refuse(error);
        const node = game.map.nodes.get(String(s.id));
        if (!node.port) return refuse(`${s.id} is not a port`);
        const why = afford(c, cmd.lots * SHIP_PRICE[kind]);
        if (why) return refuse(why);
        c.treasury -= cmd.lots * SHIP_PRICE[kind];
        const fleet = Object.values(st.fleets).find((f) => f.owner === c.code && f.port === s.id) ?? newFleet(st, c.code, {}, s.id, node.zone);
        fleet.ships[kind] += cmd.lots * 10;
        return done([{ type: "ships", day: st.day, country: c.code, fleet: fleet.id, port: s.id, kind, n: cmd.lots * 10 }]);
    },

    // soldiers or cannon crew, free, trained in a core settlement: 3 months in the capital, 6 elsewhere (RULES.md §8)
    raise(game, cmd) {
        const st = game.state, c = mine(game, cmd);
        if (!["soldiers", "crew"].includes(cmd.kind)) return refuse("raise soldiers or crew");
        if (!positive(cmd.lots)) return refuse("raise a whole number of lots of 1000");
        const { s, error } = ownSettlement(game, cmd);
        if (error) return refuse(error);
        if (!isCore(st, s, c.code)) return refuse(`${s.id} is not core: men are trained only in core settlements`);
        const n = cmd.lots * 1000;
        if (armySoldiersOf(st, c.code) + n > armyCapOf(st, c.code)) return refuse("that is more soldiers than your law allows");
        if (economyOf(game, c.code).civilians < n) return refuse("not enough civilians");
        const capital = st.settlements[c.capital]?.owner === c.code && c.capital === s.id;
        c.training.push({ settlement: s.id, kind: cmd.kind, n, ready: st.day + (capital ? TRAIN_CAPITAL_DAYS : TRAIN_OTHER_DAYS) });
        return done();
    },

    // 1000 mercenaries, with pikes, a month later, at a core settlement; at most as many as the army cap (RULES.md §8)
    hireMercenaries(game, cmd) {
        const st = game.state, c = mine(game, cmd);
        if (!positive(cmd.lots)) return refuse("hire a whole number of lots of 1000");
        const { s, error } = ownSettlement(game, cmd);
        if (error) return refuse(error);
        if (!isCore(st, s, c.code)) return refuse(`${s.id} is not core`);
        const n = cmd.lots * 1000, hiring = c.hires.reduce((x, h) => x + h.n, 0);
        if (mercenariesOf(st, c.code) + hiring + n > armyCapOf(st, c.code)) return refuse("you may hire at most as many mercenaries as your army cap");
        const why = afford(c, cmd.lots * MERCENARY_PRICE);
        if (why) return refuse(why);
        c.treasury -= cmd.lots * MERCENARY_PRICE;
        c.hires.push({ settlement: s.id, n, ready: st.day + MERCENARY_DAYS });
        return done();
    },

    // change the weapons of `n` men, instantly, wherever the army is: the new ones come from the reserve, the old go
    // back to it (RULES.md §8)
    equip(game, cmd) {
        const c = mine(game, cmd), { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        const { from, to, n } = cmd;
        if (!WEAPONS.includes(from) || !WEAPONS.includes(to) || from === to) return refuse("name two different weapons, or unarmed");
        if (!positive(n)) return refuse("equip a whole number of men");
        if (n > army.men[from]) return refuse(`army ${army.id} has ${army.men[from]} ${from}`);
        if (to !== "unarmed" && c.reserve[to] < n) return refuse(`the reserve holds ${c.reserve[to]} ${to}`);
        army.men[from] -= n;
        army.men[to] += n;
        if (to !== "unarmed") c.reserve[to] -= n;
        if (from !== "unarmed") c.reserve[from] += n;
        return done();
    },

    // cannons from the reserve, as far as the army's crew allow (n < 0 returns them)
    equipCannons(game, cmd) {
        const c = mine(game, cmd), { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        const n = cmd.n;
        if (!Number.isInteger(n) || n === 0) return refuse("equip a whole number of cannons");
        if (n > 0) {
            if (c.reserve.cannons < n) return refuse(`the reserve holds ${c.reserve.cannons} cannons`);
            if ((army.cannons + n) * CREW_PER_CANNON > army.crew) return refuse(`every cannon needs ${CREW_PER_CANNON} crew; army ${army.id} has ${army.crew}`);
        } else if (-n > army.cannons) return refuse(`army ${army.id} has ${army.cannons} cannons`);
        army.cannons += n;
        c.reserve.cannons -= n;
        return done();
    },

    // men and crew go home, their weapons and cannons to the reserve (RULES.md §8); never mercenaries — dismiss those
    disband(game, cmd) {
        const c = mine(game, cmd), { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        const cannons = cmd.cannons ?? 0, crew = cmd.crew ?? 0, men = cmd.men ?? {};
        let total = 0;
        for (const [w, n] of Object.entries(men)) {
            if (!WEAPONS.includes(w)) return refuse(`no weapon ${w}`);
            if (!whole(n) || n > army.men[w]) return refuse(`army ${army.id} has ${army.men[w]} ${w}`);
            total += n;
        }
        if (total > menOf(army) - army.mercs) return refuse("mercenaries are dismissed, not disbanded");
        if (!whole(cannons) || cannons > army.cannons) return refuse(`army ${army.id} has ${army.cannons} cannons`);
        if (!whole(crew) || crew > army.crew) return refuse(`army ${army.id} has ${army.crew} crew`);
        if ((army.cannons - cannons) * CREW_PER_CANNON > army.crew - crew) return refuse(`every cannon needs ${CREW_PER_CANNON} crew`);
        if (!total && !cannons && !crew) return refuse("nothing to disband");
        for (const [w, n] of Object.entries(men)) {
            army.men[w] -= n;
            if (w !== "unarmed") c.reserve[w] += n;
        }
        army.cannons -= cannons;
        army.crew -= crew;
        c.reserve.cannons += cannons;
        if (!menOf(army) && !army.cannons && !army.crew) delete game.state.armies[army.id];
        return done();
    },

    dismissMercenaries(game, cmd) {
        const c = mine(game, cmd), { army, error } = ownArmy(game, cmd);
        if (error) return refuse(error);
        if (!positive(cmd.n) || cmd.n > army.mercs) return refuse(`army ${army.id} has ${army.mercs} mercenaries`);
        const taken = takeMen(army, cmd.n, ["pikes", ...WEAPONS]);
        for (const w of WEAPONS) if (w !== "unarmed") c.reserve[w] += taken[w];
        army.mercs -= cmd.n;
        if (!menOf(army) && !army.cannons && !army.crew) delete game.state.armies[army.id];
        return done();
    },

    // special coring (SCENARIO.md): the capital lies in the region and the country holds all of it; every settlement
    // in it becomes core at once, with no courthouse and no wait
    proclaim(game, cmd) {
        const st = game.state, c = mine(game, cmd);
        const region = (game.map.scenario.formables ?? []).find((f) => f.id === cmd.region);
        if (!region) return refuse(`no region ${cmd.region}`);
        if (!region.settlements.includes(c.capital) || st.settlements[c.capital]?.owner !== c.code) return refuse("your capital must lie within the region");
        const missing = region.settlements.filter((id) => st.settlements[id]?.owner !== c.code);
        if (missing.length) return refuse(`you must control all of ${region.name}; ${missing.length} settlements are not yours`);
        const fresh = region.settlements.filter((id) => !st.settlements[id].cores.includes(c.code));
        if (!fresh.length) return refuse(`${region.name} is already core`);
        for (const id of fresh) st.settlements[id].cores.push(c.code);
        return done([{ type: "proclaimed", day: st.day, country: c.code, region: region.id, settlements: fresh.length }]);
    },
};
