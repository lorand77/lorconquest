// The tables and the running games (design.md, "Threads", "Players"). A game starts as a *table* in the lobby: people take
// seats — a country each, first come — and the host starts it, with seats still open if they like; the computer plays
// every country nobody took. The seats then are the game's humans for good.
//
// A started game has one worker thread (src/game/worker.js). The main thread owns the database: it saves the commands,
// snapshots and progress each worker sends, and passes each day's changes on to the sockets in the game's room — the
// public part to everyone in "game:<id>", each country's private part to "game:<id>:<code>".
//
// With one person a game is single-player: free pause, and it pauses when they leave and waits for them. With two or
// more it is multiplayer (RULES.md §1): the clock stands still for the first minute and never stops again, and
//   * a player who is away — no socket in the game — has a caretaker at once, and the full computer player after AWAY_MS;
//   * one who comes back has their country back at once, whichever of the two had it;
//   * one who quits gives it to the full computer player for good;
//   * when every player has quit or been away over AWAY_MS the game is over: abandoned;
//   * a player whose country is eliminated (RULES.md §10) is out: they may watch to the end, but give no orders, and are placed
//     after everyone still in. When every player's country is out the worker ends the game as a defeat, as it ends a
//     single-player game when its player's country falls.
// Nothing about who is away is saved: a game resumed after a restart begins with every player away, from that moment.
//
// A single-player game is not kept in memory for nothing: when its player has been gone for IDLE_MS its worker stops, the
// game saved where it stood, and it is brought back from its snapshot and log when they open it again — as after a restart,
// which is why a restart brings back only the games with several people.
import { Worker } from "node:worker_threads";
import { RULES_VERSION } from "../engine/index.js";
import { rankHumans } from "./results.js";

const WORKER = new URL("./worker.js", import.meta.url);
// progress (the day reached) is saved at least this often, in days, and whenever there is something else to save
const PROGRESS_EVERY = 10;
const CHAT_MAX = 300;

export function createRooms({ db, scenarios, io, log, tickMs, statsEvery, setupMs, awayMs, maxHumans, idleMs }) {
    const live = new Map();
    let closing = false;

    function launch(row, { snapshot = null, commands = [] } = {}) {
        const scenario = scenarios.get(row.scenario);
        if (!scenario) throw new Error(`game ${row.id}: no scenario ${row.scenario}`);
        const seatRows = db.q.seats.all(row.id);
        if (!seatRows.length) throw new Error(`game ${row.id} has no seats`);
        const multi = seatRows.length > 1;
        const humans = seatRows.map((s) => s.country);
        const worker = new Worker(WORKER, {
            workerData: {
                scenario: scenario.data, seed: row.seed, snapshot, log: commands, day: row.day, humans, tickMs, statsEvery, paused: true,
                // a multiplayer game begins with every player away
                caretakers: multi ? humans.map((c) => [c, "caretaker"]) : [],
            },
        });
        const room = {
            id: row.id, host: row.host_id, scenario: row.scenario, worker, paused: true, day: row.day, multi,
            seq: db.q.lastSeq.get(row.id).seq, savedDay: row.day, pending: new Map(), nextReq: 1,
            seats: new Map(seatRows.map((s) => [s.country, { country: s.country, userId: s.user_id, username: s.username, sockets: new Set(), state: multi ? "away" : "idle", timer: null }])),
            setupUntil: 0, timers: new Set(), lastTick: performance.now(),
        };
        room.gone = new Promise((resolve) => { room.onGone = resolve; });
        room.ready = new Promise((resolve, reject) => { room.onReady = resolve; room.onFail = reject; });
        room.ready.catch(() => {});
        worker.on("message", (m) => onMessage(room, m));
        worker.on("error", (err) => {
            log.error("game.worker_failed", { game: room.id, err });
            room.onFail(err);
            for (const p of room.pending.values()) p({ ok: false, error: "the game stopped" });
            clearTimers(room);
            live.delete(room.id);
            io.to(`game:${room.id}`).emit("failed", { error: "the game stopped" });
        });
        live.set(row.id, room);
        // the players of a multiplayer game are away until they join; the two minutes run from when the game is running.
        // A single-player game nobody opens is let go after a while.
        room.ready.then(() => {
            room.lastTick = performance.now();
            if (multi) { for (const seat of room.seats.values()) if (seat.state === "away" && !seat.timer) seat.timer = later(room, awayMs, () => becomeFull(room, seat)); }
            else room.idleTimer = later(room, idleMs, () => unload(room));
        }, () => {});
        return room;
    }

    // a timer of the room's, cleared with it and never holding the process open
    function later(room, ms, fn) {
        if (closing) return null;
        const t = setTimeout(() => { room.timers.delete(t); fn(); }, ms);
        t.unref();
        room.timers.add(t);
        return t;
    }

    function clearTimers(room) {
        for (const t of room.timers) clearTimeout(t);
        room.timers.clear();
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
                room.lastTick = performance.now();
                save(room, m);
                for (const e of m.events) if (e.type === "eliminated" && room.seats.has(e.country)) seatOut(room, room.seats.get(e.country), e.day);
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
                room.lastTick = performance.now();
                save(room, { day: m.day }, true);
                io.to(`game:${room.id}`).emit("paused", { paused: m.paused, day: m.day });
                break;
            case "over":
                // the game is won (SCENARIO.md, Victory): saved as finished, and never resumed
                // or every person's country is out: a defeat for all of them, finished with no winner
                db.q.finishGame.run(m.day, m.winner, m.hash ?? null, room.id);
                recordResult(room, m.scores);
                room.paused = true;
                room.over = m.winner ?? "defeat";
                clearTimers(room);
                io.to(`game:${room.id}`).emit("over", { day: m.day, winner: m.winner, why: m.why, defeated: Boolean(m.defeated) });
                log.info("game.over", { game: room.id, winner: m.winner, defeated: Boolean(m.defeated), humans: [...room.seats.keys()], day: m.day });
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

    // ---------- people in a game ----------

    const seatView = (seat) => ({ country: seat.country, username: seat.username, state: seat.state });
    const tell = (room, seat) => io.to(`game:${room.id}`).emit("presence", seatView(seat));
    const caretaker = (room, country, mode) => room.worker.postMessage({ type: "caretaker", country, mode });
    const setPaused = (room, paused) => room.worker.postMessage({ type: "pause", paused });

    // the player has been away too long: the full computer player takes the country
    function becomeFull(room, seat) {
        seat.timer = null;
        seat.state = "full";
        caretaker(room, seat.country, "full");
        tell(room, seat);
        log.info("game.seat_full", { game: room.id, country: seat.country });
        checkEnd(room);
    }

    // a player's country is eliminated: they are out, and may watch to the end. (In a single-player game the worker ends the game.)
    function seatOut(room, seat, day) {
        db.q.markOut.run(day, room.id, seat.country);
        if (!room.multi || seat.state === "out") return;
        if (seat.timer) { clearTimeout(seat.timer); room.timers.delete(seat.timer); seat.timer = null; }
        seat.state = "out";
        tell(room, seat);
        log.info("game.seat_out", { game: room.id, country: seat.country, day });
        checkEnd(room);
    }

    // a multiplayer game with nobody left playing in it ends: abandoned — unless every country is out, when the worker ends
    // it as a defeat
    function checkEnd(room) {
        if (!room.multi || room.over || room.ending) return;
        const seats = [...room.seats.values()];
        if (seats.every((s) => s.state === "out")) return;
        if (seats.some((s) => s.state === "present" || s.state === "away")) return;
        room.ending = true;
        db.q.abandonGame.run(room.day, room.id);
        io.to(`game:${room.id}`).emit("over", { day: room.day, winner: null, abandoned: true });
        log.info("game.abandoned", { game: room.id, day: room.day });
        retire(room);
    }

    // each person's standing in a game that is over, among the people (results.js), kept for the leaderboard
    function recordResult(room, table) {
        if (!table) return;
        const rows = new Map(db.q.seatQuits.all(room.id).map((r) => [r.country, r]));
        const seats = [...room.seats.keys()].map((country) => ({ country, quitDay: rows.get(country)?.quit_day ?? null, outDay: rows.get(country)?.out_day ?? null }));
        db.tx(() => { for (const r of rankHumans(seats, table)) db.q.setResult.run(r.place, r.settlements, r.pop, room.id, r.country); });
    }

    // let a single-player game go from memory: saved where it stands, and brought back when its player opens it again
    function unload(room) {
        if (room.over || room.ending || room.unloading || closing) return;
        room.unloading = true;
        log.info("game.unloaded", { game: room.id, day: room.day });
        retire(room);
    }

    // stop a game's worker for good, saving where it got to
    function retire(room) {
        clearTimers(room);
        const done = () => { room.worker.terminate().catch(() => {}); live.delete(room.id); room.onGone(); };
        const timer = setTimeout(done, 3000);
        timer.unref();
        room.onStopped = () => { clearTimeout(timer); done(); };
        room.worker.postMessage({ type: "stop" });
    }

    // a socket of the player's joins the game: they have their country back, at once
    function attach(room, userId, socketId) {
        const seat = [...room.seats.values()].find((s) => s.userId === userId);
        if (!seat) return { error: "you have no seat in this game" };
        if (seat.state === "quit") return { error: "you left this game" };
        if (room.ending) return { error: "this game is over: nobody was left" };
        seat.sockets.add(socketId);
        if (seat.state === "out") return { seat };              // watching: their country is no more
        if (room.idleTimer) { clearTimeout(room.idleTimer); room.timers.delete(room.idleTimer); room.idleTimer = null; }
        if (seat.state !== "present") {
            if (seat.timer) { clearTimeout(seat.timer); room.timers.delete(seat.timer); seat.timer = null; }
            if (room.multi) caretaker(room, seat.country, null);
            seat.state = "present";
            tell(room, seat);
            log.info("game.seat_back", { game: room.id, country: seat.country });
        }
        return { seat };
    }

    // a socket of the player's leaves (or is lost)
    function detach(room, userId, socketId) {
        if (closing) return;
        const seat = [...room.seats.values()].find((s) => s.userId === userId);
        if (!seat || !seat.sockets.delete(socketId) || seat.sockets.size || seat.state !== "present") return;          // (one who is out only watched)
        if (!room.multi) {
            // leaving a single-player game pauses it; it waits for the player to come back
            seat.state = "idle";
            setPaused(room, true);
            if (!room.over) room.idleTimer = later(room, idleMs, () => unload(room));
            return;
        }
        if (room.over || room.ending) return;                       // nothing is left to look after
        seat.state = "away";
        caretaker(room, seat.country, "caretaker");
        seat.timer = later(room, awayMs, () => becomeFull(room, seat));
        tell(room, seat);
        log.info("game.seat_away", { game: room.id, country: seat.country });
    }

    // a player gives their country to the computer for good
    function quit(room, userId) {
        const seat = [...room.seats.values()].find((s) => s.userId === userId);
        if (!seat) return { ok: false, error: "you have no seat in this game" };
        if (!room.multi) return { ok: false, error: "a single-player game just waits for you: close the page" };
        if (seat.state === "quit" || seat.state === "out") return { ok: true };
        db.q.markQuit.run(room.day, room.id, userId);
        if (seat.timer) { clearTimeout(seat.timer); room.timers.delete(seat.timer); seat.timer = null; }
        seat.state = "quit";
        seat.sockets.clear();
        caretaker(room, seat.country, "full");
        tell(room, seat);
        log.info("game.seat_quit", { game: room.id, country: seat.country });
        checkEnd(room);
        return { ok: true };
    }

    // an active game from its latest snapshot and the commands after it
    function resume(row) {
        try {
            if (row.rules_version !== RULES_VERSION) throw new Error("played under rules version " + row.rules_version + ", this server plays " + RULES_VERSION);
            const snap = db.q.snapshot.get(row.id);
            const commands = db.q.commandsFrom.all(row.id, snap ? snap.day : 0).map((c) => ({ day: c.day, cmd: JSON.parse(c.cmd) }));
            const room = launch(row, { snapshot: snap ? snap.state : null, commands });
            // a multiplayer game does not pause: it runs on at once, and its players are away until they are back
            room.ready.then(() => {
                log.info("game.resumed", { game: row.id, day: row.day, from: snap ? snap.day : 0, commands: commands.length });
                if (room.multi) setPaused(room, false);
            }, () => {});
            return room;
        } catch (err) {
            log.error("game.resume_failed", { game: row.id, err });
            return null;
        }
    }

    // ---------- tables ----------

    const table = (id) => {
        const row = db.q.game.get(Number(id));
        return row && row.status === "lobby" ? row : null;
    };
    const tellLobby = () => io.to("lobby").emit("lobby:changed");

    function seatsOf(id) {
        return db.q.seats.all(id).map((s) => ({ country: s.country, username: s.username, userId: s.user_id }));
    }

    function validCountry(scenario, country) {
        return scenarios.get(scenario)?.data.countries.some((c) => c.code === country);
    }

    return {
        get: (id) => live.get(Number(id)),

        // a new table, the host in the seat of `country`
        createTable({ userId, scenario, country, seed }) {
            if (!scenarios.has(scenario)) return { error: `no scenario ${scenario}` };
            if (!validCountry(scenario, country)) return { error: `no country ${country} in ${scenario}` };
            const id = db.tx(() => {
                const { lastInsertRowid } = db.q.insertGame.run(scenario, seed, RULES_VERSION, country, "lobby", userId);
                db.q.insertSeat.run(lastInsertRowid, country, userId);
                return Number(lastInsertRowid);
            });
            log.info("table.created", { game: id, scenario, host: userId, country });
            tellLobby();
            return { id };
        },

        // the tables waiting for people, each with who sits where
        tables: () => db.q.tables.all().map((t) => ({ id: t.id, scenario: t.scenario, host: t.host, hostId: t.host_id, createdAt: t.created_at, seats: seatsOf(t.id).map(({ country, username }) => ({ country, username })) })),

        joinTable(id, userId, country) {
            const row = table(id);
            if (!row) return { error: "that room is gone or its game has started" };
            if (!validCountry(row.scenario, country)) return { error: `no country ${country} in ${row.scenario}` };
            const seats = seatsOf(row.id);
            if (seats.some((s) => s.userId === userId)) return { error: "you already have a seat in this room" };
            if (seats.length >= maxHumans) return { error: `a game has at most ${maxHumans} people` };
            if (seats.some((s) => s.country === country)) return { error: `${country} is taken` };
            db.q.insertSeat.run(row.id, country, userId);
            log.info("table.joined", { game: row.id, user: userId, country });
            tellLobby();
            return { ok: true };
        },

        leaveTable(id, userId) {
            const row = table(id);
            if (!row) return { error: "that room is gone or its game has started" };
            if (row.host_id === userId) return { error: "the host cancels the room instead" };
            if (!db.q.seatOfUser.get(row.id, userId)) return { error: "you have no seat in this room" };
            db.q.deleteSeat.run(row.id, userId);
            log.info("table.left", { game: row.id, user: userId });
            tellLobby();
            return { ok: true };
        },

        cancelTable(id, userId) {
            const row = table(id);
            if (!row) return { error: "that room is gone or its game has started" };
            if (row.host_id !== userId) return { error: "only the host cancels a room" };
            db.q.setStatus.run("aborted", row.id);
            log.info("table.cancelled", { game: row.id, host: userId });
            for (const s of seatsOf(row.id)) io.to(`user:${s.userId}`).emit("table:cancelled", { id: row.id });
            tellLobby();
            return { ok: true };
        },

        // the host starts the game, with seats still open if they like: the computer takes them. Resolves once it runs.
        async startTable(id, userId) {
            const row = table(id);
            if (!row) return { error: "that room is gone or its game has started" };
            if (row.host_id !== userId) return { error: "only the host starts a game" };
            db.q.setStatus.run("active", row.id);
            const room = launch(db.q.game.get(row.id));
            try {
                await room.ready;
            } catch (err) {
                db.q.setStatus.run("aborted", row.id);
                return { error: "the game could not be started" };
            }
            // two or more people: the clock stands still for a minute (RULES.md §1), then runs for good
            if (room.multi) {
                room.setupUntil = Date.now() + setupMs;
                later(room, setupMs, () => { room.setupUntil = 0; if (!room.over && !room.ending) setPaused(room, false); });
            }
            log.info("game.started", { game: row.id, scenario: row.scenario, humans: [...room.seats.keys()], multi: room.multi });
            for (const s of room.seats.values()) io.to(`user:${s.userId}`).emit("table:started", { id: row.id });
            tellLobby();
            return { ok: true, id: row.id };
        },

        // a game in memory, or brought back from its snapshot and the commands after it — for someone with a seat in it, so
        // that nobody can make the server load other people's games: null if there is no such game going
        async open(id, userId) {
            id = Number(id);
            let room = live.get(id);
            while (room?.unloading) { await room.gone; room = live.get(id); }     // one being let go is let go first
            if (room) return room;
            const row = db.q.game.get(id);
            return row?.status === "active" && db.q.seatOfUser.get(id, userId) ? resume(row) : null;
        },

        // after a restart, the games with several people are brought back at once — they run on without waiting for anyone;
        // a single-player game waits to be opened (open)
        resumeAll() {
            for (const row of db.q.activeGames.all()) {
                if (db.q.seats.all(row.id).length > 1) resume(row);
            }
        },

        // a replay: everything a browser needs to play a finished game over with the engine it already has
        replayOf(id) {
            const g = db.q.replayGame.get(Number(id));
            if (!g) return { status: 404, error: "no such game" };
            if (g.status !== "finished" && g.status !== "abandoned") return { status: 409, error: "that game is still being played" };
            if (g.rules_version !== RULES_VERSION) return { status: 409, error: "that game was played under rules version " + g.rules_version + ", and this server plays " + RULES_VERSION + ", so it cannot be replayed exactly" };
            const seats = db.q.seats.all(g.id);
            return {
                status: 200, replay: {
                    id: g.id, scenario: g.scenario, seed: g.seed, rulesVersion: g.rules_version, endDay: g.day, winner: g.winner, resultHash: g.result_hash,
                    humans: seats.map((x) => ({ country: x.country, username: x.username.startsWith("deleted-") ? "deleted" : x.username })),
                    log: db.q.allCommands.all(g.id).map((c) => ({ day: c.day, country: c.country, source: c.source, cmd: JSON.parse(c.cmd) })),
                },
            };
        },

        // everyone, ranked over the games they finished: most firsts among people, then victories, the best average place,
        // the most games; those who have finished none come last, by name
        leaderboard: () => db.q.leaderboard.all().map(boardRow).sort((x, y) => y.firsts - x.firsts || y.victories - x.victories || (x.averagePlace ?? 99) - (y.averagePlace ?? 99) || y.games - x.games || (x.username < y.username ? -1 : 1)),

        // games that should be ticking and have not for this long (in ms): the loop is stuck (src/health.js)
        stalled: (ms) => [...live.values()].filter((r) => !r.paused && !r.over && !r.ending && !r.unloading && performance.now() - r.lastTick > ms).map((r) => r.id),

        // housekeeping, run daily by the server (src/retention.js)
        sweepTables(hours) {
            const stale = db.q.staleTables.all("-" + hours + " hours");
            for (const t of stale) {
                db.q.setStatus.run("aborted", t.id);
                for (const x of seatsOf(t.id)) io.to("user:" + x.userId).emit("table:cancelled", { id: t.id });
            }
            if (stale.length) { log.info("table.expired", { tables: stale.length, hours }); tellLobby(); }
            return stale.length;
        },
        sweepChat(days) {
            const removed = days < 0 ? 0 : db.q.deleteOldChat.run("-" + days + " days").changes;
            if (removed) log.info("chat.retention", { removed, days });
            return removed;
        },

        // another person's profile, as anyone signed in may see it: their name, when they joined, their leaderboard row and the
        // games of theirs that are over (finished or abandoned, whose replays anyone may watch) — not the ones still going.
        // Null for no such account, or one deleted.
        player(name) {
            const u = typeof name === "string" ? db.q.userByNameLoose.get(name) : null;
            if (!u || u.username.startsWith("deleted-")) return null;
            const row = db.q.leaderboard.all().find((r) => r.username === u.username);
            const games = db.q.gamesOf.all(u.id).filter((g) => g.status === "finished" || g.status === "abandoned")
                .map((g) => ({ id: g.id, scenario: g.scenario, status: g.status, winner: g.winner, day: g.day, country: g.country, people: g.seated }));
            return { username: u.username, joined: u.created_at, row: row ? boardRow(row) : null, games };
        },

        // the games a person has a seat in
        gamesOf: (userId) => db.q.gamesOf.all(userId).map((g) => ({
            id: g.id, scenario: g.scenario, status: g.status, winner: g.winner, day: g.day, country: g.country, people: g.seated,
            live: live.has(g.id), paused: Boolean(g.paused),
        })),

        seatOf: (id, userId) => db.q.seatOfUser.get(Number(id), userId)?.country ?? null,
        seatList: (room) => [...room.seats.values()].map(seatView),
        chatOf: (room, limit = 50) => db.q.chatOf.all(room.id, limit).reverse().map(chatView),
        say(room, userId, text) {
            text = typeof text === "string" ? text.trim() : "";
            if (!text || text.length > CHAT_MAX) return { ok: false, error: `a message is 1 to ${CHAT_MAX} characters` };
            const { lastInsertRowid } = db.q.insertChat.run(room.id, userId, text);
            const msg = chatView(db.q.chatById.get(Number(lastInsertRowid)));
            io.to(`game:${room.id}`).emit("chat", msg);
            return { ok: true };
        },
        attach, detach, quit,

        // a person's command, in the country of their seat
        command: (room, country, cmd) => ask(room, { type: "command", country, source: "human", cmd }),
        view: (room, country) => ask(room, { type: "view", country }).then((m) => m.view),
        setPaused,
        setCaretaker: caretaker,

        // stop every game, saving where each got to
        async close() {
            closing = true;
            await Promise.all([...live.values()].map((room) => new Promise((resolve) => {
                clearTimers(room);
                const done = () => { clearTimeout(timer); room.worker.terminate().then(resolve, resolve); };
                const timer = setTimeout(done, 3000);
                room.onStopped = done;
                room.worker.postMessage({ type: "stop" });
            })));
            live.clear();
        },
    };
}

// a person's row of the leaderboard, from the query's sums
const boardRow = (r) => ({
    username: r.username, games: r.games, shared: r.shared, firsts: r.firsts, victories: r.victories,
    averagePlace: r.shared ? Math.round(r.place_sum / r.shared * 100) / 100 : null,
});
const chatView = (m) => ({ id: m.id, userId: m.user_id, username: m.username, text: m.text, at: m.created_at });
