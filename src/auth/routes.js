// Accounts, under /api (from LorCiv, without argon2 and express-session):
//
//   POST /api/register { username, password } -> { id, username }   and signs in
//   POST /api/login    { username, password } -> { id, username }
//   POST /api/logout                          -> { ok }
//   GET  /api/me                              -> { id, username, joined }, or 401 (joined: when the account was made, UTC)
import express from "express";
import { hashPassword, verifyPassword } from "./password.js";
import { requireAuth } from "./session.js";
import { usernameProblem } from "./usernamePolicy.js";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD = 6;
// no real password is longer; the cap keeps the hash from being fed megabytes
const MAX_PASSWORD = 128;
const TOO_MANY = { error: "Too many attempts. Try again later." };
const BUSY = { error: "The server is busy. Try again in a moment." };

export function authRoutes({ db, sessions, throttles, io }) {
    const router = express.Router();
    // a session's sockets leave with it
    const dropSockets = (hash) => io.in(`session:${hash}`).disconnectSockets(true);

    router.post("/register", async (req, res) => {
        try {
            if (throttles.registrations.blocked(req.ip)) {
                req.log.warn("auth.throttled", { kind: "register", ip: req.ip });
                return res.status(429).json(TOO_MANY);
            }
            const { username, password } = req.body ?? {};
            if (typeof username !== "string" || !USERNAME_RE.test(username)) return res.status(400).json({ error: "Username must be 3–20 characters: letters, digits, or underscore." });
            if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
                return res.status(400).json({ error: `Password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters.` });
            }
            // one message for every rule, so the lists cannot be probed rule by rule
            if (usernameProblem(username)) return res.status(400).json({ error: "That username isn't allowed." });
            // names that differ only in case would be indistinguishable in every list
            if (db.q.userByNameNoCase.get(username)) return res.status(409).json({ error: "Username already taken." });
            const release = throttles.acquireHashSlot();
            if (!release) return res.status(503).json(BUSY);
            throttles.registrations.hit(req.ip);
            let hash;
            try {
                hash = await hashPassword(password);
            } finally {
                release();
            }
            const user = { id: Number(db.q.insertUser.run(username, hash).lastInsertRowid), username };
            sessions.start(res, user);
            req.log.info("auth.register", { user: user.id, name: username });
            res.status(201).json(user);
        } catch (err) {
            // two sign-ups for one name can both pass the check while the first hashes
            if (err?.code === "ERR_SQLITE_ERROR" && /UNIQUE/.test(err.message)) return res.status(409).json({ error: "Username already taken." });
            req.log.error("auth.register_error", { err });
            res.status(500).json({ error: "Registration failed." });
        }
    });

    router.post("/login", async (req, res) => {
        try {
            if (throttles.loginFailures.blocked(req.ip)) {
                req.log.warn("auth.throttled", { kind: "login", ip: req.ip });
                return res.status(429).json(TOO_MANY);
            }
            const { username, password } = req.body ?? {};
            const user = typeof username === "string" ? db.q.userByName.get(username) : null;
            const candidate = String(password ?? "");
            // one failure for no such user, a wrong password and a password too long to be anyone's
            let ok = false;
            if (user && candidate.length <= MAX_PASSWORD) {
                const release = throttles.acquireHashSlot();
                if (!release) return res.status(503).json(BUSY);
                try {
                    ok = await verifyPassword(candidate, user.password_hash);
                } finally {
                    release();
                }
            }
            if (!ok) {
                throttles.loginFailures.hit(req.ip);
                // what was typed as the username is never logged: people sometimes type their password there
                req.log.info("auth.login_failed", { user: user?.id, reason: user ? "wrong_password" : "unknown_user" });
                return res.status(401).json({ error: "Invalid username or password." });
            }
            // a new session each time: whatever session the request came with is ended
            if (req.user) { db.q.deleteSession.run(req.user.hash); dropSockets(req.user.hash); }
            sessions.start(res, user);
            req.log.info("auth.login", { user: user.id });
            res.json({ id: user.id, username: user.username });
        } catch (err) {
            req.log.error("auth.login_error", { err });
            res.status(500).json({ error: "Login failed." });
        }
    });

    router.post("/logout", (req, res) => {
        if (req.user) dropSockets(req.user.hash);
        sessions.end(res, req.user?.hash);
        res.json({ ok: true });
    });

    router.get("/me", requireAuth, (req, res) => res.json({ id: req.user.id, username: req.user.username, joined: req.user.joined }));

    return router;
}
