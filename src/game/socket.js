// Every Socket.IO event of a live game (design.md, "Messages").
//
//   join    { gameId }            -> { ok, gameId, scenario, me, paused, tickMs, view }; the socket then receives
//                                    "tick" { day, events, changes }, "private" { day, changes }, "paused", "failed"
//   command { cmd }               -> { ok, error, events }   the country is always the player's, never the client's
//   pause   { paused }            -> { ok }
//
// No accounts yet (milestone 6): whoever opens a game plays its human country. When the last socket leaves a
// game, it pauses (RULES.md §1: leaving a single-player game pauses it).
const reply = (ack, value) => { if (typeof ack === "function") ack(value); };

export function attachSockets(io, rooms, log, tickMs) {
    io.on("connection", (socket) => {
        let room = null;

        socket.on("join", async (msg, ack) => {
            const r = rooms.get(msg?.gameId);
            if (!r) return reply(ack, { ok: false, error: "no such game" });
            try {
                await r.ready;
            } catch {
                return reply(ack, { ok: false, error: "the game could not be started" });
            }
            if (room !== r) {
                leave();
                room = r;
                room.viewers++;
            }
            socket.join([`game:${room.id}`, `game:${room.id}:${room.human}`]);
            const view = await rooms.view(room, room.human);
            log.debug("socket.join", { game: room.id, socket: socket.id });
            reply(ack, { ok: true, gameId: room.id, scenario: room.scenario, me: room.human, paused: room.paused, tickMs, view });
        });

        socket.on("command", async (msg, ack) => {
            if (!room) return reply(ack, { ok: false, error: "join a game first" });
            if (!msg || typeof msg.cmd !== "object" || msg.cmd === null) return reply(ack, { ok: false, error: "no command" });
            const r = await rooms.command(room, msg.cmd);
            reply(ack, { ok: r.ok, error: r.error, events: r.events });
        });

        socket.on("pause", (msg, ack) => {
            if (!room) return reply(ack, { ok: false, error: "join a game first" });
            rooms.setPaused(room, Boolean(msg?.paused));
            reply(ack, { ok: true });
        });

        function leave() {
            if (!room) return;
            socket.leave(`game:${room.id}`);
            socket.leave(`game:${room.id}:${room.human}`);
            if (--room.viewers <= 0) { room.viewers = 0; rooms.setPaused(room, true); }
            room = null;
        }
        socket.on("disconnect", leave);
    });
}
