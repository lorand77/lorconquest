// The running games (design.md, "Threads"): one worker thread each (src/game/worker.js), started for a new game
// and, when the server boots, for every active game in the database. The main thread owns the database: it saves
// the commands, snapshots and progress each worker sends, and passes each day's changes on to the sockets in the
// game's room — the public part to everyone in "game:<id>", each country's private part to "game:<id>:<code>".
// A game always starts paused: a new one waits for its player, a resumed one for its player to come back.
import { Worker } from "node:worker_threads";
import { RULES_VERSION } from "../engine/index.js";

const WORKER = new URL("./worker.js", import.meta.url);
// progress (the day reached) is saved at least this often, in days, and whenever there is something else to save
const PROGRESS_EVERY = 10;

export function createRooms({ db, scenarios, io, log, tickMs, statsEvery }) {
    const live = new Map();

    function launch(row, { snapshot = null, commands = [] } = {}) {
        const scenario = scenarios.get(row.scenario);
        if (!scenario) throw new Error(`game ${row.id}: no scenario ${row.scenario}`);
        const worker = new Worker(WORKER, {
            workerData: { scenario: scenario.data, seed: row.seed, snapshot, log: commands, day: row.day, humans: [row.human], tickMs, statsEvery, paused: true },
        });
        const room = {
            id: row.id, human: row.human, scenario: row.scenario, worker, paused: true, day: row.day,
            seq: db.q.lastSeq.get(row.id).seq, savedDay: row.day, pending: new Map(), nextReq: 1, viewers: 0,
        };
        room.ready = new Promise((resolve, reject) => { room.onReady = resolve; room.onFail = reject; });
        room.ready.catch(() => {});
        worker.on("message", (m) => onMessage(room, m));
        worker.on("error", (err) => {
            log.error("game.worker_failed", { game: room.id, err });
            room.onFail(err);
            for (const p of room.pending.values()) p({ ok: false, error: "the game stopped" });
            live.delete(room.id);
            io.to(`game:${room.id}`).emit("failed", { error: "the game stopped" });
        });
        live.set(row.id, room);
        return room;
    }

    function save(room, { day, commands = [], snapshot = null }, force = false) {
        room.day = day;
        if (!commands.length && !snapshot && !force && day - room.savedDay < PROGRESS_EVERY) return;
        db.tx(() => {
            for (const c of commands) db.q.insertCommand.run(room.id, ++room.seq, c.day, c.country, c.source, JSON.stringify(c.cmd));
            if (snapshot) db.q.saveSnapshot.run(room.id, snapshot.day, snapshot.state);
            db.q.saveProgress.run(day, room.paused ? 1 : 0, room.id);
        });
        room.savedDay = day;
    }

    function onMessage(room, m) {
        switch (m.type) {
            case "ready":
                room.day = m.day;
                room.onReady();
                break;
            case "tick":
                save(room, m);
                io.to(`game:${room.id}`).emit("tick", { day: m.day, events: m.events, changes: m.pub });
                for (const [code, changes] of Object.entries(m.priv)) io.to(`game:${room.id}:${code}`).emit("private", { day: m.day, changes });
                break;
            case "reply":
            case "view": {
                const resolve = room.pending.get(m.reqId);
                room.pending.delete(m.reqId);
                if (resolve) resolve(m);
                break;
            }
            case "paused":
                room.paused = m.paused;
                save(room, { day: m.day }, true);
                io.to(`game:${room.id}`).emit("paused", { paused: m.paused, day: m.day });
                break;
            case "stats":
                log.info("game.timing", { game: room.id, days: m.days, mean_ms: Number(m.mean.toFixed(3)), max_ms: Number(m.max.toFixed(3)), budget_ms: tickMs });
                break;
            case "stopped":
                save(room, m, true);
                if (room.onStopped) room.onStopped();
                break;
        }
    }

    // ask the worker something and wait for its answer
    function ask(room, message) {
        return new Promise((resolve) => {
            const reqId = room.nextReq++;
            room.pending.set(reqId, resolve);
            room.worker.postMessage({ ...message, reqId });
        });
    }

    return {
        get: (id) => live.get(Number(id)),

        // a new single-player game on `scenario` as `country`; resolves to its id once it is running
        async create({ scenario, country, seed }) {
            const { lastInsertRowid: id } = db.q.insertGame.run(scenario, seed, RULES_VERSION, country);
            const room = launch(db.q.game.get(id));
            await room.ready;
            log.info("game.created", { game: id, scenario, country, seed });
            return id;
        },

        // every active game back into memory, each from its latest snapshot and the commands after it
        resumeAll() {
            for (const row of db.q.activeGames.all()) {
                try {
                    if (row.rules_version !== RULES_VERSION) throw new Error(`played under rules version ${row.rules_version}, this server plays ${RULES_VERSION}`);
                    const snap = db.q.snapshot.get(row.id);
                    const commands = db.q.commandsFrom.all(row.id, snap ? snap.day : 0).map((c) => ({ day: c.day, cmd: JSON.parse(c.cmd) }));
                    const room = launch(row, { snapshot: snap ? snap.state : null, commands });
                    room.ready.then(() => log.info("game.resumed", { game: row.id, day: row.day, from: snap ? snap.day : 0, commands: commands.length }));
                } catch (err) {
                    log.error("game.resume_failed", { game: row.id, err });
                }
            }
        },

        list: () => db.q.games.all().map((r) => ({ ...r, paused: Boolean(r.paused), live: live.has(r.id) })),

        // a human's command; the country is always the game's human's, whatever the client sent
        command: (room, cmd) => ask(room, { type: "command", country: room.human, source: "human", cmd }),
        view: (room, country) => ask(room, { type: "view", country }).then((m) => m.view),
        setPaused: (room, paused) => room.worker.postMessage({ type: "pause", paused }),

        // stop every game, saving where each got to
        async close() {
            await Promise.all([...live.values()].map((room) => new Promise((resolve) => {
                const done = () => { clearTimeout(timer); room.worker.terminate().then(resolve, resolve); };
                const timer = setTimeout(done, 3000);
                room.onStopped = done;
                room.worker.postMessage({ type: "stop" });
            })));
            live.clear();
        },
    };
}
