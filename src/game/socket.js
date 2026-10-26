// Every Socket.IO event (design.md, "Messages"). A socket belongs to a signed-in user — the handshake carries the same
// session cookie as the REST routes, and is refused without one — and joins rooms: "user:<id>" (everything addressed to
// the person), "session:<hash>" (so signing out drops the session's sockets), "lobby", and a game's rooms.
//
//   lobby:enter                   -> { ok }   the socket then hears "lobby:changed" (the tables or their seats changed),
//                                   "table:started" { id } / "table:cancelled" { id } for tables it has a seat at, and
//                                   "online" [{ username, playing }] — who has the lobby or a game open — at once and on change
//   join    { gameId }            -> { ok, gameId, scenario, me, multi, paused, tickMs, view, seats, setup, chat }
//                                   the user's seat in the game; the socket then receives "tick" { day, events, changes },
//                                   "private" { day, changes }, "paused", "presence" { country, username, state },
//                                   "chat" { id, userId, username, text, at }, "over" { day, winner, why?, defeated?, abandoned? }, "failed"
//   watch   { gameId }            -> { ok, gameId, scenario, multi, paused, tickMs, view, seats, setup, over }
//                                   a game being played, watched: the public view (no country's private part, no questions
//                                   waiting); the socket then hears "tick", "paused", "presence" and "over" — never "private"
//                                   or "chat" — and gives no orders
//   command { cmd }               -> { ok, error, events }   the country is always the user's seat's, never the client's
//   pause   { paused }            -> { ok }                  single-player games only
//   chat    { text }              -> { ok, error }
//   quit                          -> { ok, error }           give the country to the computer for good (multiplayer)
//
// Leaving a game — a closed page, a lost connection — is what makes a player "away" (rooms.js).
const reply = (ack, value) => { if (typeof ack === "function") ack(value); };

// a person may send this many chat messages in this many milliseconds, from all their tabs together
const CHAT_BURST = 5, CHAT_WINDOW_MS = 5000;
// the longest command a client may send, as JSON: a peace naming every settlement of the larger map is well under it
const COMMAND_MAX = 8000;

export function attachSockets({ io, rooms, sessions, log, tickMs }) {
    // who is online — has the lobby or a game open — for the lobby's list: per person, what each of their sockets has open.
    // Kept in memory only; a person is online while any of their sockets is in the lobby or a game, and playing while one
    // is in a game.
    const online = new Map();                               // user id -> { username, sockets: Map(socket id -> "lobby" | "game") }
    const onlineList = () => [...online.values()]
        .map((u) => ({ username: u.username, playing: [...u.sockets.values()].includes("game") }))
        .sort((a, b) => (a.username < b.username ? -1 : 1));
    let told = "";
    const tellOnline = () => {
        const list = onlineList(), json = JSON.stringify(list);
        if (json === told) return;
        told = json;
        io.to("lobby").emit("online", list);
    };
    const mark = (user, socketId, what) => {
        let u = online.get(user.id);
        if (!u) online.set(user.id, (u = { username: user.username, sockets: new Map() }));
        if (what) u.sockets.set(socketId, what);
        else u.sockets.delete(socketId);
        if (!u.sockets.size) online.delete(user.id);
        tellOnline();
    };

    // who is asking: the session of the cookie, or nobody, and then the handshake is refused
    io.use((socket, next) => {
        const user = sessions.userOf(socket.request.headers);
        if (!user) return next(new Error("sign in first"));
        socket.user = user;
        next();
    });

    // the chat's burst limit is a person's, whichever of their tabs they write from
    const saidBy = new Map();

    io.on("connection", (socket) => {
        const { user } = socket;
        let room = null, seat = null, watching = null;
        socket.join([`user:${user.id}`, `session:${user.hash}`]);

        // a handler that fails answers the caller and logs, never takes the server down
        const on = (event, handler) => socket.on(event, async (msg, ack) => {
            // a session that has ended since the handshake ends the socket
            if (!sessions.userOf(socket.request.headers)) { socket.disconnect(true); return; }
            try {
                await handler(msg, ack);
            } catch (err) {
                log.error("socket.handler_failed", { event, err });
                reply(ack, { ok: false, error: "Server error." });
            }
        });

        on("lobby:enter", (msg, ack) => {
            socket.join("lobby");
            mark(user, socket.id, "lobby");
            socket.emit("online", onlineList());
            reply(ack, { ok: true });
        });

        on("join", async (msg, ack) => {
            const r = await rooms.open(msg?.gameId, user.id);
            if (!r) return reply(ack, { ok: false, error: "no such game" });
            try {
                await r.ready;
            } catch {
                return reply(ack, { ok: false, error: "the game could not be started" });
            }
            // a page closed while the game was being brought back: its socket must not be counted as a player there
            if (socket.disconnected) return;
            if (room !== r) leave();
            const joined = rooms.attach(r, user.id, socket.id);
            if (joined.error) return reply(ack, { ok: false, error: joined.error });
            room = r;
            seat = joined.seat;
            if (watching) { socket.leave(`watch:${watching}`); watching = null; }
            mark(user, socket.id, "game");
            socket.join([`game:${room.id}`, `game:${room.id}:${seat.country}`]);
            const view = await rooms.view(room, seat.country);
            log.debug("socket.join", { game: room.id, socket: socket.id, country: seat.country });
            reply(ack, {
                ok: true, gameId: room.id, scenario: room.scenario, me: seat.country, multi: room.multi, paused: room.paused, tickMs, view,
                seats: rooms.seatList(room), setup: Math.max(0, room.setupUntil - Date.now()), chat: rooms.chatOf(room),
                over: room.over ?? null,
            });
        });

        on("watch", async (msg, ack) => {
            const r = rooms.get(msg?.gameId);
            if (!r || r.over || r.ending || r.unloading) return reply(ack, { ok: false, error: "that game is not being played now" });
            try { await r.ready; } catch { return reply(ack, { ok: false, error: "that game is not being played now" }); }
            if (socket.disconnected) return;
            if (room) leave();
            if (watching) socket.leave(`watch:${watching}`);
            watching = r.id;
            socket.join(`watch:${r.id}`);
            mark(user, socket.id, "lobby");                         // online, not playing
            const view = await rooms.view(r, null);
            reply(ack, {
                ok: true, gameId: r.id, scenario: r.scenario, multi: r.multi, paused: r.paused, tickMs, view,
                seats: rooms.seatList(r), setup: Math.max(0, r.setupUntil - Date.now()), over: r.over ?? null,
            });
        });

        on("command", async (msg, ack) => {
            if (!room) return reply(ack, { ok: false, error: "join a game first" });
            if (!msg || typeof msg.cmd !== "object" || msg.cmd === null) return reply(ack, { ok: false, error: "no command" });
            // every command is kept in the game's log as it came: one padded with junk would fill the disk
            if (JSON.stringify(msg.cmd).length > COMMAND_MAX) return reply(ack, { ok: false, error: "that command is too long" });
            const r = await rooms.command(room, seat.country, msg.cmd);
            reply(ack, { ok: r.ok, error: r.error, events: r.events });
        });

        on("pause", (msg, ack) => {
            if (!room) return reply(ack, { ok: false, error: "join a game first" });
            if (room.multi) return reply(ack, { ok: false, error: "a game with other people never pauses" });
            rooms.setPaused(room, Boolean(msg?.paused));
            reply(ack, { ok: true });
        });

        on("chat", (msg, ack) => {
            if (!room) return reply(ack, { ok: false, error: "join a game first" });
            const now = Date.now(), said = saidBy.get(user.id) ?? [];
            saidBy.set(user.id, said);
            while (said.length && now - said[0] > CHAT_WINDOW_MS) said.shift();
            if (said.length >= CHAT_BURST) return reply(ack, { ok: false, error: "slow down" });
            said.push(now);
            reply(ack, rooms.say(room, user.id, msg?.text));
        });

        on("quit", (msg, ack) => {
            if (!room) return reply(ack, { ok: false, error: "join a game first" });
            const r = rooms.quit(room, user.id);
            if (r.ok) leave();
            reply(ack, r);
        });

        function leave() {
            if (!room) return;
            socket.leave(`game:${room.id}`);
            socket.leave(`game:${room.id}:${seat.country}`);
            rooms.detach(room, user.id, socket.id);
            room = null;
            seat = null;
            mark(user, socket.id, socket.rooms.has("lobby") ? "lobby" : null);
        }
        socket.on("disconnect", () => { leave(); mark(user, socket.id, null); });
    });
}
