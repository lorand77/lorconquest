// The computer players (docs/design.md, "The computer players"): one AI for every country that has no person, run inline in
// the game's worker. It reads the state and gives commands like a human would, three ways at three speeds:
//   strategy    every 15 days, on a day of the country's own (util.js, thinksOn): the economy, forces, diplomacy and war;
//   operations  the same think moves armies — musters, marches, sieges;
//   reflexes    the tick after an event that touches a country (a siege begun, a war declared) it looks at its war again,
//               and the tick after a think that split or equipped anything, so what needed an army's new id can follow.
// Its dice are its own (util.js) and it keeps only what a restart may forget: wars it is preparing and when it last asked a
// human something. `orders` returns what to apply at the start of the next tick, as { country, source, cmd }.
import { economyOf, isVassal } from "../engine/index.js";
import { caretakerOrders, answerOffers } from "./caretaker.js";
import { diplomacyOrders } from "./diplomacy.js";
import { economyOrders } from "./economy.js";
import { forceOrders } from "./forces.js";
import { enemiesOf, flavorOf, reserveOf, thinksOn } from "./util.js";
import { warOrders } from "./war.js";

// what, from a day's events, a country should look at again at once
function touched(game, events) {
    const st = game.state, out = new Set();
    for (const e of events) {
        if (e.type === "siegeStart") { out.add(st.settlements[e.settlement]?.owner); out.add(e.by); }
        else if (e.type === "war") { out.add(e.country); out.add(e.target); }
        else if (e.type === "joins") out.add(e.country);
        else if (e.type === "battle") for (const c of [...(e.a?.countries ?? []), ...(e.b?.countries ?? [])]) out.add(c);
    }
    return out;
}

export function createAI({ seed, humans = [] }) {
    const memory = { plans: new Map(), asked: new Map() }, caretaken = new Map(), again = new Set(), flavors = new Map();
    // a country's character: the scenario's for it, varied by the seed (characters.js)
    const flavor = (game, code) => {
        if (!flavors.has(code)) flavors.set(code, flavorOf(seed, code, game.map.scenario.countries.find((c) => c.code === code)?.character ?? null));
        return flavors.get(code);
    };

    // the country thinks in full: forces first, then the economy with what is left, then diplomacy and the war it leads to
    function think(game, code) {
        const st = game.state, c = st.countries[code], fl = flavor(game, code), e = economyOf(game, code);
        const atWarNow = enemiesOf(st, code).length > 0;
        const ctx = { budget: c.treasury - (atWarNow ? 0.1 : 1) * reserveOf(e) }, start = ctx.budget;
        const out = [...answerOffers(game, code), ...forceOrders(game, code, fl, ctx), ...economyOrders(game, code, fl, ctx)];
        // money offered for peace is what the treasury will hold once this think's spending is applied before it
        const cash = c.treasury - (start - ctx.budget);
        const { orders, prepare } = isVassal(st, code) && !atWarNow ? { orders: [], prepare: false } : diplomacyOrders(game, code, fl, memory, cash);
        out.push(...orders, ...warOrders(game, code, fl, { prepare }));
        if (out.some((o) => ["split", "merge", "equip", "raise"].includes(o.type))) again.add(code);
        return out;
    }

    return {
        // `mode` null gives the country back to its player; "caretaker" looks after it; "full" plays it as a computer country
        setCaretaker(country, mode) {
            if (mode) caretaken.set(country, mode);
            else caretaken.delete(country);
        },

        // the orders for the end of `game.day`; `events` are the events of the day just advanced
        orders(game, events = []) {
            const st = game.state, out = [], wake = touched(game, events), followUp = new Set(again);
            again.clear();
            const landed = new Set(Object.values(st.settlements).map((s) => s.owner));
            for (const code of Object.keys(st.countries).sort()) {
                if (st.countries[code].rebel || !landed.has(code)) continue;       // peasants, and countries with no land left, play no more
                const human = humans.includes(code), mode = human ? caretaken.get(code) : "full";
                if (!mode) continue;
                const source = human ? "caretaker" : "computer";
                const give = (cmds) => { for (const cmd of cmds) out.push({ country: code, source, cmd }); };
                if (thinksOn(code, st.day)) give(mode === "caretaker" ? caretakerOrders(game, code, flavor(game, code)) : think(game, code));
                else if (wake.has(code) || followUp.has(code)) give(mode === "caretaker" ? caretakerOrders(game, code, flavor(game, code)) : warOrders(game, code, flavor(game, code), { muster: false, prepare: memory.plans.has(code) }));
            }
            return out;
        },
    };
}
