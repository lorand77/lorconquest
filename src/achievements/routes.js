// The achievements API (design.md, "Achievements"): what a person has earned, for the profile's Achievements tab — open to
// anyone signed in, like the rest of a profile. Each answer is fully described (service.js, listFor): every achievement
// there is, grouped, with the tier held, when and in which game, and the counts behind the tiered ones.
//
//   GET /api/achievements              your own
//   GET /api/achievements/user/:name   anyone's (a deleted account is a 404)
import express from "express";
import { requireAuth } from "../auth/session.js";

export function achievementRoutes({ db, achievements }) {
    const router = express.Router();
    router.use(requireAuth);
    router.get("/achievements", (req, res) => res.json(achievements.listFor(req.user.id)));
    router.get("/achievements/user/:name", (req, res) => {
        const u = db.q.userByNameLoose.get(String(req.params.name));
        if (!u || u.username.startsWith("deleted-")) return res.status(404).json({ error: "no such player" });
        res.json(achievements.listFor(u.id));
    });
    return router;
}
