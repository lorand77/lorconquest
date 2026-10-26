// Achievements (design.md, "Achievements"): what each person earned, decided on the server when a game finishes
// (catalogue.js is what exists). Only a finished game's people with a place (results.js) earn from it. Three kinds of check:
//
//   in the game   played over from its log in a worker thread (worker.js, analyze.js): a capital taken, a battle won
//                 outnumbered, a region proclaimed, the scenario's own goals... and the wins that need how (By the Sword).
//   the result    the winner, the end day, the people at the table, the country's size at the start: Blitz, Crowded Table.
//   the record    the person's finished games up to this one: games, wins, settlements taken, battles won, three in a row.
//
// rooms.js calls gameEnded() when a game finishes, and start() runs at boot, queueing every finished game not yet awarded by
// this version of the awarding (AWARDS_VERSION): that is the backfill, and it also catches a game a restart cut short.
// Games are done one at a time, oldest first. Awarding only ever raises a tier, so doing a game twice is harmless. A game
// played under other rules (RULES_VERSION) cannot be played over exactly: it is awarded what the result and record say.
// Anything newly earned goes to the person's sockets as "achievements:earned", fully described, for the toast.
import { Worker } from "node:worker_threads";
import { RULES_VERSION, YEAR_DAYS } from "../engine/index.js";
import { ACHIEVEMENTS, BY_KEY as A, GROUPS, describe, maxTier, scenarioAchievements, tierFor, tierName } from "./catalogue.js";

// Bump when the catalogue gains achievements that games already awarded could have earned: at the next boot every finished
// game is awarded again (games.awards_version), which only ever adds. 1: the first catalogue; 2: five more historical ones; 3: a Germany in each scenario.
export const AWARDS_VERSION = 3;

const WORKER = new URL("./worker.js", import.meta.url);

export function createAchievements({ db, scenarios, io, log }) {
    // every achievement there is: the regular ones, then each scenario's own
    const own = [...scenarios.values()].flatMap((s) => scenarioAchievements(s.id, s.data));
    const all = new Map([...ACHIEVEMENTS, ...own].map((a) => [a.key, a]));
    const queue = [];
    let current = null, worker = null, waiters = [], stopped = false;

    // ---------- the queue ----------

    function gameEnded(gameId) {
        if (stopped || current?.gameId === gameId || queue.includes(gameId)) return;
        queue.push(gameId);
        pump();
    }

    function start() {
        for (const { id } of db.q.unawardedGames.all(AWARDS_VERSION)) gameEnded(id);
    }

    function pump() {
        while (!current) {
            const gameId = queue.shift();
            if (gameId === undefined) {
                const done = waiters;
                waiters = [];
                for (const resolve of done) resolve();
                return;
            }
            let job;
            try {
                job = jobFor(gameId);
            } catch (err) {
                log.error("achievements.failed", { game: gameId, err });
                continue;
            }
            if (!job) continue;
            current = job;
            if (job.replay) {
                const w = thread();
                w.ref();
                w.postMessage(job.replay);
            } else finish({ gameId, ok: false, error: job.why });
        }
    }

    // what the worker needs to play a game over, or why it cannot; null when there is nothing to do (not finished, already
    // awarded, or nobody it counts for — marked done here)
    function jobFor(gameId) {
        const g = db.q.game.get(gameId);
        if (!g || g.status !== "finished" || g.awards_version >= AWARDS_VERSION) return null;
        const seats = db.q.awardSeats.all(gameId);
        if (!seats.length) { db.q.markAwarded.run(AWARDS_VERSION, gameId); return null; }
        const scenario = scenarios.get(g.scenario);
        if (!scenario) return { gameId, why: "scenario" };
        if (g.rules_version !== RULES_VERSION) return { gameId, why: "rules" };
        const quits = new Map(db.q.seatQuits.all(gameId).map((r) => [r.country, r.quit_day]));
        return {
            gameId, replay: {
                gameId, scenarioId: g.scenario, scenario: scenario.data, seed: g.seed, endDay: g.day, resultHash: g.result_hash,
                humans: db.q.seats.all(gameId).map((s) => s.country),
                seats: seats.map((s) => ({ country: s.country, quitDay: quits.get(s.country) ?? null })),
                log: db.q.allCommands.all(gameId).map((c) => ({ day: c.day, cmd: JSON.parse(c.cmd) })),
            },
        };
    }

    function thread() {
        if (worker) return worker;
        const w = new Worker(WORKER);
        w.on("message", (res) => { if (w === worker) finish(res); });
        // the worker died (not a game that failed to play over: analyze answers those): the game is awarded without its
        // replay, and the next job gets a new worker
        w.on("error", (err) => {
            if (w !== worker) return;
            worker = null;
            log.error("achievements.failed", { game: current?.gameId, err });
            if (current) finish({ gameId: current.gameId, ok: false, error: "worker" });
        });
        worker = w;
        return w;
    }

    function finish(res) {
        const job = current;
        current = null;
        worker?.unref();
        if (stopped) return;
        try {
            award(job.gameId, res);
        } catch (err) {
            log.error("achievements.failed", { game: job.gameId, err });       // not marked awarded: the next boot tries again
        }
        pump();
    }

    // resolves once nothing is queued or being played over (the tests wait on it)
    const idle = () => new Promise((resolve) => { if (!current && !queue.length) resolve(); else waiters.push(resolve); });

    async function stop() {
        stopped = true;
        queue.length = 0;
        current = null;
        const w = worker;
        worker = null;
        if (w) await w.terminate();
        for (const resolve of waiters) resolve();
        waiters = [];
    }

    // ---------- awarding ----------

    // one finished game's achievements from the worker's answer, in one transaction with the mark that it is done
    function award(gameId, res) {
        if (!res.ok) log.warn("achievements.replay_failed", { game: gameId, error: res.error, day: res.day });
        const g = db.q.game.get(gameId), scenario = scenarios.get(g.scenario)?.data;
        const ref = { gameId, at: g.updated_at };
        const earned = new Map(), people = new Map();
        db.tx(() => {
            for (const s of db.q.awardSeats.all(gameId)) {
                people.set(s.user_id, s.username);
                const seen = res.ok ? res.seats[s.country] : null;
                if (seen) db.q.setSeatFeats.run(seen.captures, seen.battles, gameId, s.country);
                const keys = seen ? [...seen.feats] : [];
                if (g.winner === s.country && s.quit_day === null) {
                    if (g.day <= A.blitz.n * YEAR_DAYS) keys.push("blitz");
                    const start = scenario?.countries.find((c) => c.code === s.country);
                    if (start && start.settlements.length <= A.small_beginnings.n) keys.push("small_beginnings");
                    if (s.people >= A.crowded_table.n) keys.push("crowded_table");
                }
                for (const key of keys) if (all.has(key)) give(earned, s.user_id, key, 1, ref);
            }
            db.q.markAwarded.run(AWARDS_VERSION, gameId);
            for (const userId of people.keys()) awardRecord(earned, userId, ref);
        });
        for (const [userId, list] of earned) {
            log.info("achievements.earned", { user: userId, name: people.get(userId), game: gameId, keys: list.map((a) => a.key + (a.tierName ? `:${a.tier}` : "")).join(",") });
            io?.to(`user:${userId}`).emit("achievements:earned", list);
        }
    }

    // what a person's finished games, up to `ref`'s, have earned
    function awardRecord(earned, userId, ref) {
        const games = db.q.achievementRecord.all({ userId, gameId: ref.gameId, at: ref.at });
        const won = games.filter((x) => x.won).length;
        const sum = (k) => games.reduce((n, x) => n + x[k], 0);
        give(earned, userId, "games_played", tierFor(A.games_played, games.length), ref);
        give(earned, userId, "wins", tierFor(A.wins, won), ref);
        give(earned, userId, "captures", tierFor(A.captures, sum("captures")), ref);
        give(earned, userId, "battles", tierFor(A.battles, sum("battles")), ref);
        if (won) give(earned, userId, "laurels", 1, ref);
        let run = 0;
        for (const x of games) {
            run = x.won ? run + 1 : 0;
            if (run >= A.hat_trick.n) { give(earned, userId, "hat_trick", 1, ref); break; }
        }
    }

    // `key` at `tier` for a person; anything new (a first award or a higher tier) goes into `earned` as the toast shows it
    function give(earned, userId, key, tier, ref) {
        if (tier < 1) return;
        const before = db.q.userAchievement.get(userId, key);
        const info = db.q.awardAchievement.run({ userId, key, tier, at: ref.at, gameId: ref.gameId });
        if (!info.changes) return;
        if (!earned.has(userId)) earned.set(userId, []);
        const a = all.get(key);
        earned.get(userId).push({ key, name: a.name, icon: a.icon, tier, tierName: tierName(a, tier), desc: describe(a, tier), upgraded: Boolean(before) });
    }

    // ---------- reading ----------

    // a person's achievements as the profile shows them: every group with every achievement, earned or not — the regular
    // ones, then each scenario's own — and the counts behind the tiered ones
    function listFor(userId) {
        const got = new Map(db.q.achievementsOf.all(userId).map((r) => [r.key, r]));
        const games = db.q.achievementRecord.all({ userId, gameId: null, at: null });
        const progress = {
            games_played: games.length, wins: games.filter((x) => x.won).length,
            captures: games.reduce((n, x) => n + x.captures, 0), battles: games.reduce((n, x) => n + x.battles, 0),
        };
        const item = (a) => {
            const r = got.get(a.key), tier = r?.tier ?? 0, max = maxTier(a);
            return {
                key: a.key, name: a.name, icon: a.icon, tier, max, tierName: tier ? tierName(a, tier) : null,
                // the next tier's goal while there is one, else the tier held
                desc: describe(a, Math.min(tier + 1, max)), tiers: a.tiers ?? null, progress: progress[a.key] ?? null,
                earnedAt: r?.earned_at ?? null, gameId: r?.game_id ?? null,
            };
        };
        const groups = [
            ...GROUPS.map((x) => ({ key: x.key, title: x.title, items: ACHIEVEMENTS.filter((a) => a.group === x.key).map(item) })),
            ...[...scenarios.values()].map((s) => ({ key: `scenario:${s.id}`, title: s.name, items: own.filter((a) => a.group === `scenario:${s.id}`).map(item) })),
        ].filter((x) => x.items.length);
        // one taken out of the catalogue since (a region a scenario no longer has) is neither shown nor counted
        return { groups, earned: [...got.keys()].filter((k) => all.has(k)).length, total: all.size };
    }

    return { gameEnded, start, idle, stop, listFor };
}
