// How settlements are lost, and where the loser's strength was when they were (experiments/README.md, 21), for simulate.js: which
// of the computer players' failings costs them land, to choose what to improve before measuring it. Every settlement a real
// country loses — peasant rebels' losses aside — is counted by how it went:
//
//   storm        taken by storm
//   siege        starved out
//   undefended   walked into: nobody in it
//   peace        handed over in a peace
//   rebels       taken by peasant rebels
//
// and each of the first three, lost by force to a real country, by why — the state at the end of the day it fell:
//
//   outmatched   the loser's whole military power under 2/3 of the taker's, or less in all its armies than took the place:
//                there was nothing it could have sent
//   near         its armies within REACH days of the place (by the roads it may take) were at least as strong as the taker's
//                force there, and it was lost anyway: a relief not sent, or sent and beaten
//   fronts       not enough near, but enough elsewhere, while at war with two real countries or more: its strength on another front
//   away         not enough near, but enough elsewhere, at war with one: its strength out of place
//
// with how far the loser's largest army was, in days. A vassal integrated is no loss (counted apart). A game's figures are its
// own; lossSummary gives a run's: the mean a game, and each kind's share of the losses.
import { isRebel, menOf, militaryPower, militaryPowerOf } from "../src/engine/index.js";
import { armyList } from "../src/engine/state.js";
import { reachFrom } from "../src/ai/util.js";

export const REACH = 60;
export const HOWS = ["storm", "siege", "undefended", "peace", "rebels"];
export const WHYS = ["outmatched", "near", "fronts", "away"];

const realFoes = (st, code) => st.wars.map((w) => w.split("|")).filter((w) => w.includes(code)).map((w) => w.find((x) => x !== code)).filter((c) => !isRebel(st, c));

// why a settlement `s` fell by force from `from` to `to` (above), and how far `from`'s largest army was
export function whyLost(game, s, from, to) {
    const st = game.state, key = String(s.id);
    const taker = armyList(st).filter((a) => a.owner === to && a.at === key).reduce((n, a) => n + militaryPower(a), 0);
    const own = armyList(st).filter((a) => a.owner === from && menOf(a) > 0);
    const dist = reachFrom(game, from, key), where = (a) => a.at ?? a.march?.to;
    const near = own.filter((a) => (dist.get(where(a)) ?? Infinity) <= REACH).reduce((n, a) => n + militaryPower(a), 0);
    const total = own.reduce((n, a) => n + militaryPower(a), 0);
    const host = own.sort((a, b) => menOf(b) - menOf(a) || a.id - b.id)[0];
    const hostDays = host ? dist.get(where(host)) ?? null : null;
    let why;
    if (militaryPowerOf(st, from) < (2 / 3) * militaryPowerOf(st, to) || total < taker) why = "outmatched";
    else if (near >= taker) why = "near";
    else why = realFoes(st, from).length >= 2 ? "fronts" : "away";
    return { why, hostDays };
}

const empty = () => ({ how: Object.fromEntries(HOWS.map((h) => [h, 0])), why: Object.fromEntries(WHYS.map((w) => [w, 0])), hostDays: [], integrated: 0 });

// the losses of one game: day(events) after each day is played, result() at the end
export function lossSampler(game) {
    const out = empty();
    return {
        day(events) {
            const st = game.state;
            for (const e of events) {
                if (e.type === "integrated") { out.integrated += e.settlements; continue; }
                if (e.type !== "capture" || !st.countries[e.from] || isRebel(st, e.from)) continue;
                if (isRebel(st, e.to)) { out.how.rebels++; continue; }
                const how = e.how === "peace" ? "peace" : e.how === "storm" ? "storm" : e.how === "siege" ? "siege" : "undefended";
                out.how[how]++;
                if (how === "peace") continue;
                const { why, hostDays } = whyLost(game, st.settlements[e.settlement], e.from, e.to);
                out.why[why]++;
                if (hostDays !== null) out.hostDays.push(hostDays);
            }
        },
        result: () => ({ ...out, hostDays: [...out.hostDays] }),
    };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const pct = (k, n) => (n ? `${Math.round(100 * k / n)}%` : "—");

// a run's games: each kind's mean a game and share
export function lossSummary(results) {
    const ls = results.map((r) => r.losses).filter(Boolean), n = Math.max(1, ls.length);
    const total = (part, k) => ls.reduce((s, l) => s + l[part][k], 0);
    const lost = HOWS.reduce((s, h) => s + total("how", h), 0), byForce = WHYS.reduce((s, w) => s + total("why", w), 0);
    const per = (k) => (k / n).toFixed(1);
    const NAMES = { storm: "by storm", siege: "starved out", undefended: "walked into, empty", peace: "in a peace", rebels: "to peasant rebels",
        outmatched: "outmatched: nothing it could have sent", near: `enough of its own within ${REACH} days, lost anyway`,
        fronts: "its strength elsewhere, at war on two fronts or more", away: "its strength elsewhere, in one war" };
    const lines = [`settlements lost (${ls.length} games; a game, and the share):`];
    lines.push(`  ${HOWS.map((h) => `${NAMES[h]} ${per(total("how", h))} (${pct(total("how", h), lost)})`).join(", ")}`);
    lines.push(`  lost by force to a country, why (${per(byForce)} a game):`);
    for (const w of WHYS) lines.push(`    ${NAMES[w].padEnd(56)} ${per(total("why", w)).padStart(6)}  ${pct(total("why", w), byForce).padStart(4)}`);
    const days = ls.flatMap((l) => l.hostDays);
    lines.push(`  the loser's largest army, when one fell by force: median ${median(days) ?? "—"} days away; within ${REACH} days ${pct(days.filter((d) => d <= REACH).length, days.length)}`);
    lines.push(`  vassals' settlements integrated (no loss): ${per(ls.reduce((s, l) => s + l.integrated, 0))} a game`);
    return lines.join("\n");
}
