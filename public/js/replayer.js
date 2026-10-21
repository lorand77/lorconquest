// Plays a finished game over with the engine the page already has (design.md, "Replays"): the game is made from its seed
// and humans, and each day its logged commands are applied and the day advanced — exactly as the server did, so the
// states come out the same. Seeking back restores the nearest keyframe (a snapshot kept every few years as the replay runs)
// and plays on from there. At the last day the state's fingerprint is compared with the one the server stored when the game
// ended. Pure, apart from the engine: tested in Node on real games.
import { Game, fingerprint } from "/engine/index.js";

// data: what GET /api/games/:id/replay gave — { seed, humans: [{ country }], endDay, resultHash, log: [{ day, cmd }] }
export function createReplayer(scenario, data, { keyEvery = 730 } = {}) {
    const log = data.log, humans = data.humans.map((h) => h.country);
    let game = Game.create(scenario, { seed: data.seed, humans });
    let next = 0;                                   // the first logged command not yet applied
    const keyframes = new Map([[0, game.snapshot()]]);

    const firstFrom = (day) => { let i = 0; while (i < log.length && log[i].day < day) i++; return i; };

    // one day: the commands logged for today, then the day itself; returns the day's events
    function stepDay() {
        const events = [];
        for (; next < log.length && log[next].day === game.day; next++) {
            const r = game.command(log[next].cmd);
            if (!r.ok) throw new Error(`replay: day ${game.day}: ${r.error}`);
            events.push(...r.events);
        }
        events.push(...game.advance());
        if (game.day % keyEvery === 0 && !keyframes.has(game.day)) keyframes.set(game.day, game.snapshot());
        return events;
    }

    const replayer = {
        get game() { return game; },
        get state() { return game.state; },
        get day() { return game.day; },
        endDay: data.endDay,
        get done() { return game.day >= data.endDay; },

        // up to `days` days on, stopping at the end; returns the events
        advance(days) {
            const events = [];
            for (let i = 0; i < days && !replayer.done; i++) events.push(...stepDay());
            return events;
        },

        // to `day`, from a keyframe if that is nearer than playing on from here; returns the events passed over when going on
        seek(day, chunk = Infinity) {
            day = Math.max(0, Math.min(day, data.endDay));
            if (day < game.day) {
                const at = Math.max(...[...keyframes.keys()].filter((d) => d <= day));
                game = Game.restore(scenario, keyframes.get(at));
                next = firstFrom(game.day);
            }
            const events = [];
            for (let i = 0; i < chunk && game.day < day; i++) events.push(...stepDay());
            return events;
        },

        // the last day reached: does the state come out as the game's did? null when the server stored no fingerprint
        // (a game that was abandoned) or the replay is not at the end
        verified() {
            if (!replayer.done || !data.resultHash) return null;
            return fingerprint(game.snapshot()) === data.resultHash;
        },
    };
    return replayer;
}
