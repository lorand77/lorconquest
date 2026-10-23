// One game day (design.md, "One game, one loop") — the engine's only way forward in time. The server calls it
// every 100 ms; tests and simulations call it as fast as they like. Commands are applied between days, never
// inside one. Returns the day's events.

import { YEAR_DAYS, isMonthStart } from "./calendar.js";
import { diplomacyDay } from "./diplomacy-day.js";
import { monthly } from "./economy.js";
import { endUprisings, rebelOrders, rebelWars, yearly } from "./events.js";
import { arrive, meetings, placeBattles, settle, surrenders } from "./fighting.js";
import { forcesDay } from "./forces.js";
import { navalDay } from "./naval.js";
import { armyList, isAlive, isRebel } from "./state.js";
import { attrition } from "./supply.js";
import { checkVictory } from "./victory.js";
import { eliminations } from "./elimination.js";

export function advanceDay(game) {
    const st = game.state, events = [];
    if (st.winner) return events;                         // the game is over
    st.day += 1;
    for (const k of Object.keys(st.cooldowns)) if (st.cooldowns[k] <= st.day) delete st.cooldowns[k];
    // the tax in force today, for the year's average (RULES.md §2)
    for (const c of Object.values(st.countries)) if (!isRebel(st, c.code)) c.taxSum += c.tax;
    forcesDay(game, events);
    navalDay(game, events);
    // armies meet on the road before they get anywhere
    meetings(game, events);
    // arrivals, earliest first; at the same moment an army falling back to its refuge gets in first
    const due = armyList(st).filter((a) => a.march && a.march.end <= st.day)
        .sort((x, y) => x.march.end - y.march.end || Number(y.retreating) - Number(x.retreating) || x.id - y.id);
    for (const a of due) {
        if (!isAlive(st, a) || !a.march || a.march.end > st.day) continue;     // turned round or beaten by an earlier arrival
        a.at = a.march.to;
        a.arrived = a.march.end;
        a.march = null;
        arrive(game, a, events);
    }
    placeBattles(game, events);
    surrenders(game, events);
    rebelOrders(game, events);
    if (isMonthStart(st.day)) {
        attrition(game, events);
        if (st.day % YEAR_DAYS === 0) yearly(game, events);
        monthly(game, events);
        endUprisings(game);
    }
    diplomacyDay(game, events);
    checkVictory(game, events);
    const occupied = new Set(armyList(st).map((a) => a.at));
    for (const s of Object.values(st.settlements)) if (s.siege || occupied.has(String(s.id))) settle(game, String(s.id), events);
    eliminations(game, events);
    rebelWars(game, events);
    return events;
}
