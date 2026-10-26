// What each person did in one finished game, found by playing it over from its log (design.md, "Achievements"): the game is
// made from its seed and humans and each day's logged commands applied before the day advances, as the worker did and as the
// replay page does (public/js/replayer.js), and the events are watched for each person's country. Pure apart from the engine:
// it runs in a worker thread (worker.js) and is tested in Node.
//
// A seat counts only up to the day its person quit (after that the computer played the country). The answer:
//   { ok, error?, why, seats: { <country>: { feats: [key], captures, battles } } }
// where `feats` are the regular achievements earned in the game (catalogue.js; those that need the win among them) and the
// scenario's own, and `why` is how the game was won ("reached" or "end"). A game that cannot be played over exactly — its log
// refused, or its final state not the stored one — answers ok: false, and is awarded only what the results say.
import { Game, START_YEAR, TECHS, YEAR_DAYS, fingerprint } from "../engine/index.js";
import { BY_KEY as A, scenarioAchievements } from "./catalogue.js";

const SEA = new Set(["naval", "strait"]);
const LAND = (e) => !SEA.has(e.kind) && e.kind !== "post";

// job: { scenarioId, scenario, seed, humans: [code], log: [{ day, cmd }], endDay, resultHash, seats: [{ country, quitDay }] }
export function analyzeGame(job) {
    const { scenario, log } = job;
    const game = Game.create(scenario, { seed: job.seed, humans: job.humans });
    const capitals = new Map(scenario.countries.map((c) => [c.code, c.capital]));
    const goals = scenarioAchievements(job.scenarioId, scenario);
    const allTechs = Object.keys(TECHS);
    const seats = new Map(job.seats.map((s) => [s.country, {
        quitDay: s.quitDay ?? Infinity, feats: new Set(), captures: 0, cored: 0, lostAny: false, lostCapital: false,
        met: new Map(),                     // scenario achievement key -> clause -> the first day it was met
    }]));
    let why = null, winner = null;
    const lastTaker = new Map();            // country -> who last took a settlement of its

    const note = (seat, key, clause, day) => { const m = seat.met.get(key) ?? new Map(); if (!m.has(clause)) m.set(clause, day); seat.met.set(key, m); };
    const holds = (code, ids) => ids.every((id) => game.state.settlements[id]?.owner === code);

    function watch(events) {
        const st = game.state;
        let owners = false, subjects = false;
        for (const e of events) {
            if (e.type === "capture") { lastTaker.set(e.from, e.to); owners = true; }
            if (e.type === "peace") {
                owners = true; subjects = true;
                for (const id of e.terms?.take ?? []) lastTaker.set(e.with, e.country);
                for (const id of e.terms?.give ?? []) lastTaker.set(e.country, e.with);
            }
            if (e.type === "subject" || e.type === "freedom") subjects = true;
            if (e.type === "victory") { why = e.why; winner = e.country; }
            for (const [code, s] of seats) {
                if (e.day >= s.quitDay) continue;
                const mine = (side) => side?.countries?.includes(code);
                const won = e.type === "battle" && ((e.winner === "a" && mine(e.a)) || (e.winner === "b" && mine(e.b)));
                switch (e.type) {
                    case "capture":
                        if (e.to === code) {
                            s.captures++;
                            if (e.from !== code && capitals.get(e.from) === e.settlement) s.feats.add("capital_punishment");
                            if (s.captures >= A.warlord.n) s.feats.add("warlord");
                        }
                        if (e.from === code) { s.lostAny = true; if (capitals.get(code) === e.settlement) s.lostCapital = true; }
                        break;
                    case "peace": {
                        // the side named first takes `take` and gives `give`
                        const lost = e.country === code ? e.terms?.give ?? [] : e.with === code ? e.terms?.take ?? [] : [];
                        const got = e.country === code ? e.terms?.take ?? [] : e.with === code ? e.terms?.give ?? [] : [];
                        if (lost.length) { s.lostAny = true; if (lost.includes(capitals.get(code))) s.lostCapital = true; }
                        if (got.length >= A.diktat.n) s.feats.add("diktat");
                        break;
                    }
                    case "eliminated":
                        if (lastTaker.get(e.country) === code) {
                            s.feats.add("kingslayer");
                            for (const g of goals) if (g.goal.eliminate?.includes(e.country)) note(s, g.key, `eliminate ${e.country}`, e.day);
                        }
                        break;
                    case "battle":
                        if (!won) break;
                        s.battles = (s.battles ?? 0) + 1;
                        if (SEA.has(e.kind)) s.feats.add("admiral");
                        if (LAND(e)) {
                            const [me, them] = e.winner === "a" ? [e.a, e.b] : [e.b, e.a];
                            if (me.men > 0 && them.men >= A.against_the_odds.n * me.men) s.feats.add("against_the_odds");
                        }
                        if (e.kind === "relief") s.feats.add("relief");
                        if (e.kind === "storm" && e.winner === "a" && e.a.cannons > 0) s.feats.add("thunder");
                        break;
                    case "proclaimed":
                        if (e.country !== code) break;
                        s.feats.add("proclaimed");
                        for (const g of goals) if (g.goal.proclaim === e.region) note(s, g.key, "proclaim", e.day);
                        break;
                    case "cored":
                        if (e.country === code && ++s.cored >= A.rightful.n) s.feats.add("rightful");
                        break;
                    case "tech":
                        if (e.country === code && allTechs.every((t) => st.countries[code].techs.includes(t))) s.feats.add("scholar");
                        break;
                    case "empire":
                        if (e.country !== code) break;
                        for (const g of goals) if (g.goal.empire && e.joined >= g.goal.empire) note(s, g.key, "empire", e.day);
                        break;
                }
            }
        }
        // what is checked against the state: subjects held at once, settlements held at once
        for (const [code, s] of seats) {
            if (st.day >= s.quitDay) continue;
            if (subjects && Object.values(st.countries).filter((c) => c.overlord === code && (c.out ?? null) === null).length >= A.overlord.n) s.feats.add("overlord");
            if (owners || st.day === 0) for (const g of goals) if (g.goal.hold && holds(code, g.goal.hold)) note(s, g.key, "hold", st.day);
        }
    }

    // play it over: each day's commands, then the day — and the commands of the last day, should a command have ended it
    let next = 0, error = null;
    watch([]);
    const apply = () => {
        for (; next < log.length && log[next].day === game.day; next++) {
            const r = game.command(log[next].cmd);
            if (!r.ok) throw Object.assign(new Error(r.error), { refused: true });
            watch(r.events);
        }
    };
    try {
        while (game.day < job.endDay) { apply(); watch(game.advance()); }
        apply();
        if (next < log.length) error = "refused";
        else if (job.resultHash && fingerprint(game.snapshot()) !== job.resultHash) error = "mismatch";
    } catch (err) {
        error = err.refused ? "refused" : "threw";
    }
    if (error) return { ok: false, error, day: game.day };

    // what needs the end: the win, the scenario's own
    const st = game.state, byDay = (year) => (year - START_YEAR) * YEAR_DAYS;
    const out = {};
    for (const [code, s] of seats) {
        const stayed = s.quitDay === Infinity, won = stayed && winner === code, alive = stayed && (st.countries[code].out ?? null) === null;
        if (won) {
            if (why === "reached") s.feats.add("by_the_sword");
            if (!s.lostAny) s.feats.add("unbroken");
            if (s.lostCapital) s.feats.add("comeback");
        }
        for (const g of goals) {
            const goal = g.goal, met = s.met.get(g.key) ?? new Map();
            if (goal.as && !goal.as.includes(code)) continue;
            if ((goal.win && !won) || (goal.survive && !alive) || (goal.keep && !(stayed && holds(code, goal.keep)))) continue;
            const clauses = [...(goal.proclaim ? ["proclaim"] : []), ...(goal.hold ? ["hold"] : []), ...(goal.empire ? ["empire"] : []), ...(goal.eliminate ?? []).map((c) => `eliminate ${c}`)];
            if (!clauses.every((c) => met.has(c))) continue;
            const when = Math.max(0, ...clauses.map((c) => met.get(c)), ...(goal.win ? [st.day] : []));
            if (goal.by && when >= byDay(goal.by)) continue;
            s.feats.add(g.key);
        }
        out[code] = { feats: [...s.feats], captures: s.captures, battles: s.battles ?? 0 };
    }
    return { ok: true, why, seats: out };
}
