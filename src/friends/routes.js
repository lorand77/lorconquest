// Friends (design.md, "Friends"), as in LorCiv. A friendship is one row between two people: a request until the one asked
// accepts it. Asking someone who has asked you already accepts their request. Only the two people of a row see or touch it —
// the one asked accepts or declines, the one who asked withdraws, either ends a friendship; anyone else gets a 404. Someone
// else's accepted friends are seen on their profile, never their requests. Every change sends "friends:changed" to both
// people's sockets (their user:<id> rooms): a nudge to fetch again, the answer here being the truth. People are named by
// their username, as the profiles and the leaderboard name them. Mounted at /api/friends.
//
//   GET    /api/friends                    -> { friends, incoming, outgoing }: [{ id, username, since }]
//   GET    /api/friends/user/:name         -> { friends }   someone else's, accepted only
//   POST   /api/friends/requests           { username } -> { ok, status: "pending" | "accepted", id }
//   POST   /api/friends/requests/:id/accept
//   POST   /api/friends/requests/:id/decline
//   DELETE /api/friends/:id                end a friendship, or withdraw a request of yours
import express from "express";
import { requireAuth } from "../auth/session.js";

export function friendRoutes({ db, io }) {
    const router = express.Router();
    router.use(requireAuth);
    const fail = (res, status, error) => res.status(status).json({ error });

    // a person by name (any case), not a deleted account
    const person = (name) => {
        const u = typeof name === "string" ? db.q.userByNameLoose.get(name) : null;
        return u && !u.username.startsWith("deleted-") ? u : null;
    };
    const view = (row) => ({ id: row.id, username: row.other, since: row.responded_at ?? row.created_at });
    function listFor(userId) {
        const out = { friends: [], incoming: [], outgoing: [] };
        for (const row of db.q.friendshipsOf.all(userId, userId, userId)) {
            if (row.status === "accepted") out.friends.push(view(row));
            else if (row.addressee_id === userId) out.incoming.push(view(row));
            else out.outgoing.push(view(row));
        }
        return out;
    }
    const changed = (...ids) => { for (const id of ids) io.to(`user:${id}`).emit("friends:changed"); };

    router.get("/friends", (req, res) => res.json(listFor(req.user.id)));

    // someone else's friends, for their profile: the accepted only — who asked whom is theirs alone
    router.get("/friends/user/:name", (req, res) => {
        const u = person(req.params.name);
        if (!u) return fail(res, 404, "no such player");
        res.json({ friends: listFor(u.id).friends });
    });

    router.post("/friends/requests", (req, res) => {
        const me = req.user.id, to = person(req.body?.username);
        if (!to) return fail(res, 404, "no such player");
        if (to.id === me) return fail(res, 400, "you cannot be your own friend");
        const row = db.q.findFriendship.get(me, to.id, to.id, me);
        if (row) {
            if (row.status === "accepted") return fail(res, 409, "you are friends already");
            if (row.requester_id === me) return fail(res, 409, "you have asked already");
            db.q.acceptFriendRequest.run(row.id);                 // they asked first: asking back accepts
            changed(me, to.id);
            return res.json({ ok: true, status: "accepted", id: row.id });
        }
        const made = db.q.createFriendRequest.run(me, to.id);
        changed(me, to.id);
        res.status(201).json({ ok: true, status: "pending", id: Number(made.lastInsertRowid) });
    });

    // a row the person asking is one of the two of, or a 404
    const own = (req, res) => {
        const row = db.q.friendshipById.get(Number(req.params.id));
        if (!row || (row.requester_id !== req.user.id && row.addressee_id !== req.user.id)) { fail(res, 404, "no such request"); return null; }
        return row;
    };

    router.post("/friends/requests/:id/accept", (req, res) => {
        const row = own(req, res);
        if (!row) return;
        if (row.status !== "pending" || row.addressee_id !== req.user.id) return fail(res, 409, "nothing to accept");
        db.q.acceptFriendRequest.run(row.id);
        changed(row.requester_id, row.addressee_id);
        res.json({ ok: true });
    });

    router.post("/friends/requests/:id/decline", (req, res) => {
        const row = own(req, res);
        if (!row) return;
        if (row.status !== "pending" || row.addressee_id !== req.user.id) return fail(res, 409, "nothing to decline");
        db.q.deleteFriendship.run(row.id);
        changed(row.requester_id, row.addressee_id);
        res.json({ ok: true });
    });

    // either may end a friendship; a request only the one who asked withdraws (the one asked declines)
    router.delete("/friends/:id", (req, res) => {
        const row = own(req, res);
        if (!row) return;
        if (row.status === "pending" && row.requester_id !== req.user.id) return fail(res, 409, "decline a request made to you");
        db.q.deleteFriendship.run(row.id);
        changed(row.requester_id, row.addressee_id);
        res.json({ ok: true });
    });
    return router;
}
