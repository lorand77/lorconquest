// One battle (RULES.md §5): both sides' power with every weapon rule and their dice, who wins, and the losses —
// applied to every army on both sides and to their countries' population. Empty armies are removed. What
// happens next, retreats or captures, is up to the caller. Also the battle cooldown (§8).

import { applyLosses, combine, isEmpty, lossesFor, menOf, peopleLost, power, stopsCavalry } from "./army.js";
import { MONTH } from "./calendar.js";
import { LANDING } from "./costs.js";
import { battleRoll } from "./random.js";
import { fleetList, isFriend, killPeople, removeArmy } from "./state.js";

// one resolution per pair of armies per 3 months
export const COOLDOWN_DAYS = Math.round(3 * MONTH);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// an army split off from another, or merged into one, is the same troops: `to` takes on every cooldown `from` has, the longer
// of the two where both have one (RULES.md §8, Battle cooldown) — or a part split off a beaten army could fight again at once.
// Armies and fleets share ids, and the cooldowns with them.
export function inheritCooldowns(state, from, to) {
    for (const [key, until] of Object.entries(state.cooldowns)) {
        const [x, y] = key.split("|").map(Number);
        if (x !== from && y !== from) continue;
        const other = x === from ? y : x;
        if (other === to) continue;
        const k = pairKey(other, to);
        state.cooldowns[k] = Math.max(state.cooldowns[k] ?? -1, until);
    }
}

// may these sides fight today? Yes if any pair of their armies is off cooldown.
export function mayFight(state, sideA, sideB) {
    for (const a of sideA) for (const b of sideB) if ((state.cooldowns[pairKey(a.id, b.id)] ?? -1) <= state.day) return true;
    return false;
}

// the share of men, cannons and weapons each side loses (RULES.md §5): the winner (P_loser ÷ P_winner) × 10%, the
// loser (P_winner ÷ P_loser) × 25%, at most all of them. Equal zeros count as 1:1.
export function damage(pw, pl) {
    return {
        winner: pw === 0 ? 0.1 : pl / pw * 0.1,
        loser: pl === 0 ? (pw === 0 ? 0.25 : 1) : Math.min(1, pw / pl * 0.25),
    };
}

// what a side fights at for its armies just ashore (RULES.md §8, Sea lanes): an army that landed from the sea today counts at
// LANDING, its share of the side's men weighed — unless a fleet of its own side blockades the port it landed at, cutting it off
// and covering the landing
function landing(st, armies) {
    const men = armies.reduce((n, x) => n + menOf(x), 0);
    if (!men) return 1;
    const covered = (x) => fleetList(st).some((f) => f.order?.type === "blockade" && String(f.order.port) === x.at && !f.port && !f.moving
        && (f.owner === x.owner || isFriend(st, x.owner, f.owner)));
    const ashore = armies.filter((x) => x.landed === st.day && x.at && !covered(x)).reduce((n, x) => n + menOf(x), 0);
    return 1 - (1 - LANDING) * ashore / men;
}

// a: the attacking side's armies, b: the defending side's; `defenceB` the defender's multiplier (a pass ×2, a
// settlement ×1.2, walls ×1.8); `plainCavalry` where cavalry has no bonus for both (storms, passes); `tie` the
// side that wins equal power. Returns the battle event.
export function fight(game, { kind, place, a, b, defenceB = 1, plainCavalry = false, tie }) {
    const st = game.state;
    const mixA = combine(a), mixB = combine(b);
    const cavA = plainCavalry || stopsCavalry(mixB.men) ? 1 : 1.4;
    const cavB = plainCavalry || stopsCavalry(mixA.men) ? 1 : 1.4;
    const rollA = battleRoll(st), rollB = battleRoll(st);
    const landA = landing(st, a), landB = landing(st, b);
    const pa = power(mixA, cavA) * rollA * landA, pb = power(mixB, cavB) * rollB * defenceB * landB;
    const winner = pa > pb ? "a" : pb > pa ? "b" : tie;
    const { winner: winPct, loser: losePct } = winner === "a" ? damage(pa, pb) : damage(pb, pa);
    const side = (armies, mix, p, roll) => ({
        countries: [...new Set(armies.map((x) => x.owner))], armies: armies.map((x) => x.id),
        men: armies.reduce((n, x) => n + menOf(x), 0), cannons: mix.cannons, power: p, roll, dead: 0, cannonsLost: 0,
    });
    const ev = { type: "battle", kind, day: st.day, place, winner, a: side(a, mixA, pa, rollA), b: side(b, mixB, pb, rollB), destroyed: [] };
    if (landA < 1) ev.a.landing = landA;
    if (landB < 1) ev.b.landing = landB;
    for (const [armies, pct, s] of [[a, winner === "a" ? winPct : losePct, ev.a], [b, winner === "b" ? winPct : losePct, ev.b]]) {
        for (const army of armies) {
            const loss = lossesFor(army, pct);
            applyLosses(army, loss);
            killPeople(st, army.owner, peopleLost(loss));
            s.dead += loss.dead + loss.crew;
            s.cannonsLost += loss.cannons;
            if (isEmpty(army)) { removeArmy(st, army); ev.destroyed.push(army.id); }
        }
    }
    for (const x of a) for (const y of b) st.cooldowns[pairKey(x.id, y.id)] = st.day + COOLDOWN_DAYS;
    return ev;
}
