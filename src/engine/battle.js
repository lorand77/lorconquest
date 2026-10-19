// One battle (RULES.md §5): both sides' power with every weapon rule and their dice, who wins, and the losses —
// applied to every army on both sides and to their countries' population. Empty armies are removed. What
// happens next, retreats or captures, is up to the caller. Also the battle cooldown (§8).

import { applyLosses, combine, isEmpty, lossesFor, menOf, power, stopsCavalry } from "./army.js";
import { MONTH } from "./calendar.js";
import { battleRoll } from "./random.js";
import { killPeople, removeArmy } from "./state.js";

// one resolution per pair of armies per 3 months
export const COOLDOWN_DAYS = Math.round(3 * MONTH);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

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

// a: the attacking side's armies, b: the defending side's; `defenceB` the defender's multiplier (a pass ×2, a
// settlement ×1.2, walls ×1.8); `plainCavalry` where cavalry has no bonus for both (storms, passes); `tie` the
// side that wins equal power. Returns the battle event.
export function fight(game, { kind, place, a, b, defenceB = 1, plainCavalry = false, tie }) {
    const st = game.state;
    const mixA = combine(a), mixB = combine(b);
    const cavA = plainCavalry || stopsCavalry(mixB.men) ? 1 : 1.4;
    const cavB = plainCavalry || stopsCavalry(mixA.men) ? 1 : 1.4;
    const rollA = battleRoll(st), rollB = battleRoll(st);
    const pa = power(mixA, cavA) * rollA, pb = power(mixB, cavB) * rollB * defenceB;
    const winner = pa > pb ? "a" : pb > pa ? "b" : tie;
    const { winner: winPct, loser: losePct } = winner === "a" ? damage(pa, pb) : damage(pb, pa);
    const side = (armies, mix, p, roll) => ({
        countries: [...new Set(armies.map((x) => x.owner))], armies: armies.map((x) => x.id),
        men: armies.reduce((n, x) => n + menOf(x), 0), cannons: mix.cannons, power: p, roll, dead: 0, cannonsLost: 0,
    });
    const ev = { type: "battle", kind, day: st.day, place, winner, a: side(a, mixA, pa, rollA), b: side(b, mixB, pb, rollB), destroyed: [] };
    for (const [armies, pct, s] of [[a, winner === "a" ? winPct : losePct, ev.a], [b, winner === "b" ? winPct : losePct, ev.b]]) {
        for (const army of armies) {
            const loss = lossesFor(army, pct);
            applyLosses(army, loss);
            killPeople(st, army.owner, loss.dead + loss.crew);
            s.dead += loss.dead + loss.crew;
            s.cannonsLost += loss.cannons;
            if (isEmpty(army)) { removeArmy(st, army); ev.destroyed.push(army.id); }
        }
    }
    for (const x of a) for (const y of b) st.cooldowns[pairKey(x.id, y.id)] = st.day + COOLDOWN_DAYS;
    return ev;
}
