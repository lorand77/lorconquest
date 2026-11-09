// How much war and how armed a game is (experiments/README.md, 18): five measures taken as a game is played, for simulate.js. Each is
// taken over the months the game lasted and the countries then living — peasant rebels aside, a country gone from the month it
// falls — so a game won in 1515 and one played to 1650 compare:
//
//   exposure      the share of people living in a country at war with a real country (peasants aside), on the 1st of each month
//   churn         settlements captured (again and again counting each time), per settlement of the map per century
//   bloodiness    soldiers killed — in battles, storms and sorties, by sharpshooters at the passes, by disease and hunger on campaign —
//                 per 1,000 people a year
//   mobilization  soldiers (in training, cannon crew, crew at sea and sharpshooters too) as a share of the people, monthly
//   burden        soldiers' and mercenaries' upkeep as a share of settlement money, monthly
//
// By era too, since a short game sees only the early centuries: 1440–1499, 1500–1574 and 1575–1650. A game's figures are its
// own; warSummary gives the mean of a run's games with a 95% interval.
import { isMonthStart } from "../src/engine/calendar.js";
import { economyOf, isRebel, popOf, soldiersOf } from "../src/engine/index.js";

const YEAR = 365;
export const ERAS = [["1440–1499", 0, 60 * YEAR], ["1500–1574", 60 * YEAR, 135 * YEAR], ["1575–1650", 135 * YEAR, Infinity]];
// the mean of a run's values with its 95% interval, by the t distribution (as strength.js's; not imported from there, which in a
// worker thread would take itself for one of its own)
const T95 = [12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.10, 2.09, 2.09, 2.08, 2.07, 2.07, 2.06, 2.06, 2.06, 2.05, 2.05, 2.05, 2.04];
export function meanCI(xs) {
    const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
    if (n < 2) return { n, mean, lo: NaN, hi: NaN };
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)), h = (T95[n - 2] ?? 1.96) * sd / Math.sqrt(n);
    return { n, mean, lo: mean - h, hi: mean + h };
}
const empty = () => ({ months: 0, exposure: 0, mobilization: 0, burden: 0, captures: 0, dead: 0, personYears: 0, settlementYears: 0 });

// what dies in an event
const deadIn = (e) => (e.type === "battle" ? (e.a?.dead ?? 0) + (e.b?.dead ?? 0)
    : e.type === "sharpshooters" || e.type === "postLost" || e.type === "attrition" ? e.dead ?? 0 : 0);

// the measures of one game: day(events) after each day is played, result() at the end
export function warSampler(game) {
    const whole = empty(), eras = ERAS.map(empty), settlements = game.map.scenario.settlements.length;
    return {
        day(events) {
            const st = game.state, era = eras[ERAS.findIndex(([, from, to]) => st.day >= from && st.day < to)], into = [whole, era];
            for (const e of events) {
                const dead = deadIn(e), captured = e.type === "capture" ? 1 : 0;
                for (const b of into) { b.dead += dead; b.captures += captured; }
            }
            if (!isMonthStart(st.day)) return;
            // the countries living now, and those at war with a real country
            const living = Object.values(st.countries).filter((c) => !c.rebel && (c.out ?? null) === null).map((c) => c.code);
            const fighting = new Set();
            for (const w of st.wars) {
                const [a, b] = w.split("|");
                if (!isRebel(st, a) && !isRebel(st, b)) { fighting.add(a); fighting.add(b); }
            }
            let people = 0, exposed = 0, soldiers = 0, upkeep = 0, money = 0;
            for (const code of living) {
                const pop = popOf(st, code);
                if (!pop) continue;
                const e = economyOf(game, code);
                people += pop;
                if (fighting.has(code)) exposed += pop;
                soldiers += soldiersOf(st, code);
                upkeep += e.upkeep + e.mercenaryUpkeep;
                money += e.settlementMoney;
            }
            if (!people) return;
            for (const b of into) {
                b.months++;
                b.exposure += exposed / people;
                b.mobilization += soldiers / people;
                b.burden += money > 0 ? upkeep / money : 0;
                b.personYears += people / 12;
                b.settlementYears += settlements / 12;
            }
        },
        result: () => ({ ...measures(whole), eras: Object.fromEntries(ERAS.map(([name], i) => [name, measures(eras[i])])) }),
    };
}

// a bucket's sums as the five measures; null for an era the game never reached
function measures(b) {
    if (!b.months) return null;
    return { years: b.months / 12, exposure: b.exposure / b.months, churn: 100 * b.captures / b.settlementYears,
        bloodiness: 1000 * b.dead / b.personYears, mobilization: b.mobilization / b.months, burden: b.burden / b.months };
}

// how each measure reads
const SHOWN = [
    ["exposure", "war exposure", (x) => `${(100 * x).toFixed(1)}%`, "of people in a country at war"],
    ["churn", "land churn", (x) => x.toFixed(2), "captures per settlement a century"],
    ["bloodiness", "bloodiness", (x) => x.toFixed(2), "killed per 1,000 people a year"],
    ["mobilization", "mobilization", (x) => `${(100 * x).toFixed(2)}%`, "of people under arms"],
    ["burden", "military burden", (x) => `${(100 * x).toFixed(1)}%`, "of settlement money on armies"],
];
const interval = (c, show) => (Number.isFinite(c.lo) ? `${show(c.mean)} [${show(c.lo)}, ${show(c.hi)}]` : show(c.mean));

// one game's measures, on a line
export const warLine = (w) => SHOWN.map(([k, name, show]) => `${name} ${show(w[k])}`).join(", ");

// a run's games: each measure's mean with its 95% interval — and, byEra, the same for each era, over the games that reached it
export function warSummary(results, { byEra = false } = {}) {
    const ws = results.map((r) => r.wars).filter(Boolean), lines = [`war and militarization (the mean of ${ws.length} games, 95% interval):`];
    for (const [k, name, show, what] of SHOWN) lines.push(`  ${name.padEnd(16)} ${interval(meanCI(ws.map((w) => w[k])), show).padEnd(30)} ${what}`);
    if (byEra) for (const [era] of ERAS) {
        const reached = ws.map((w) => w.eras[era]).filter(Boolean);
        if (!reached.length) continue;
        lines.push(`  ${era} (${reached.length} games): ${SHOWN.map(([k, name, show]) => `${name} ${interval(meanCI(reached.map((w) => w[k])), show)}`).join("; ")}`);
    }
    return lines.join("\n");
}
