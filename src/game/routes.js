// The game's REST routes, under /api.
//
//   GET  /api/scenarios   the scenarios to play: [{ id, name, countries: [{ code, name, pop }] }]
//   GET  /api/games       every game: [{ id, scenario, human, day, status, paused, live }]
//   POST /api/games       { scenario, country, seed? } -> { id }   a new single-player game, started paused
//
// No accounts yet (milestone 6): this is the development page's way in.
import crypto from "node:crypto";
import express from "express";

export function gameRoutes(rooms, scenarios) {
    const router = express.Router();

    router.get("/scenarios", (req, res) => {
        res.json([...scenarios.values()].map((s) => ({
            id: s.id, name: s.name, countries: s.data.countries.map((c) => ({ code: c.code, name: c.name, pop: c.pop })),
        })));
    });

    router.get("/games", (req, res) => res.json(rooms.list()));

    router.post("/games", async (req, res) => {
        const { scenario, country } = req.body ?? {};
        const s = scenarios.get(scenario);
        if (!s) return res.status(400).json({ error: `no scenario ${scenario}` });
        if (!s.data.countries.some((c) => c.code === country)) return res.status(400).json({ error: `no country ${country} in ${scenario}` });
        let seed = req.body.seed;
        if (seed === undefined || seed === null || seed === "") seed = crypto.randomInt(0, 2 ** 32);
        if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) return res.status(400).json({ error: "the seed must be a whole number from 0 to 4294967295" });
        const id = await rooms.create({ scenario, country, seed });
        res.status(201).json({ id });
    });

    return router;
}
