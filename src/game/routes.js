// The game's REST routes, under /api. Everything but the scenarios needs a signed-in user (src/auth).
//
//   GET  /api/scenarios          the scenarios to play: [{ id, name, countries: [{ code, name, pop }] }]
//   GET  /api/tables             the tables waiting for people: [{ id, scenario, host, hostId, seats: [{ country, username }] }]
//   POST /api/tables             { scenario, country, seed?, solo? } -> { id }   a table with you in the seat of `country`;
//                                with solo, started at once as a single-player game
//   POST /api/tables/:id/join    { country } -> { ok }     take a free country at a table
//   POST /api/tables/:id/leave   -> { ok }                 give your seat up (the host cancels instead)
//   POST /api/tables/:id/cancel  -> { ok }                 the host takes the table down
//   POST /api/tables/:id/start   -> { ok, id }             the host starts the game; seats left open are the computer's
//   GET  /api/live               the games being played now, to watch: [{ id, scenario, day, multi, paused, people, mine }]
//   GET  /api/games              the games you have a seat in: [{ id, scenario, status, winner, day, country, people, live }]
//   GET  /api/games/:id/replay   a finished or abandoned game, to play over in the browser: its seed, humans and every command,
//                                with the fingerprint its final state must have; 409 while it is going on or if it was played
//                                under other rules (src/game/rooms.js, replayOf)
//   GET  /api/leaderboard        every account, ranked over the games it finished (rooms.js, leaderboard)
//   GET  /api/players/:name      another person's profile: { username, joined, row, games } — their leaderboard row and their games
//                                that are over, never the ones still going (rooms.js, player); 404 for no such account
import crypto from "node:crypto";
import express from "express";
import { requireAuth } from "../auth/session.js";

export function gameRoutes(rooms, scenarios) {
    const router = express.Router();
    const fail = (res, error) => res.status(400).json({ error });

    router.get("/scenarios", (req, res) => {
        res.json([...scenarios.values()].map((s) => ({
            id: s.id, name: s.name, countries: s.data.countries.map((c) => ({ code: c.code, name: c.name, pop: c.pop })),
        })));
    });

    router.use(requireAuth);

    router.get("/tables", (req, res) => res.json(rooms.tables()));

    router.post("/tables", async (req, res) => {
        const { scenario, country, solo } = req.body ?? {};
        let seed = req.body?.seed;
        if (seed === undefined || seed === null || seed === "") seed = crypto.randomInt(0, 2 ** 32);
        if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) return fail(res, "the seed must be a whole number from 0 to 4294967295");
        const made = rooms.createTable({ userId: req.user.id, scenario, country, seed });
        if (made.error) return fail(res, made.error);
        if (solo) {
            const started = await rooms.startTable(made.id, req.user.id);
            if (started.error) return fail(res, started.error);
        }
        res.status(201).json({ id: made.id, started: Boolean(solo) });
    });

    router.post("/tables/:id/join", (req, res) => {
        const r = rooms.joinTable(req.params.id, req.user.id, req.body?.country);
        if (r.error) return fail(res, r.error);
        res.json({ ok: true });
    });

    router.post("/tables/:id/leave", (req, res) => {
        const r = rooms.leaveTable(req.params.id, req.user.id);
        if (r.error) return fail(res, r.error);
        res.json({ ok: true });
    });

    router.post("/tables/:id/cancel", (req, res) => {
        const r = rooms.cancelTable(req.params.id, req.user.id);
        if (r.error) return fail(res, r.error);
        res.json({ ok: true });
    });

    router.post("/tables/:id/start", async (req, res) => {
        const r = await rooms.startTable(req.params.id, req.user.id);
        if (r.error) return fail(res, r.error);
        res.json({ ok: true, id: r.id });
    });

    router.get("/games", (req, res) => res.json(rooms.gamesOf(req.user.id)));
    router.get("/live", (req, res) => res.json(rooms.liveGames(req.user.id)));

    router.get("/games/:id/replay", (req, res) => {
        const r = rooms.replayOf(req.params.id);
        if (r.error) return res.status(r.status).json({ error: r.error });
        res.json(r.replay);
    });

    router.get("/leaderboard", (req, res) => res.json(rooms.leaderboard()));
    router.get("/players/:name", (req, res) => {
        const p = rooms.player(req.params.name);
        return p ? res.json(p) : res.status(404).json({ error: "no such player" });
    });

    return router;
}
