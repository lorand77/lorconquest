// Sessions, shared by Express and the Socket.IO handshake — one way of knowing who is asking. LorCiv used express-session
// and a session-store package; this project has neither, so a session is a random token in a cookie, kept in the
// database as its SHA-256 hash (a copy of the database holds no live session) with an expiry. No cookie-parsing package
// either: the one cookie is read from the header by hand.
import crypto from "node:crypto";

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

// the value of cookie `name` in a Cookie header
export function readCookie(header, name) {
    for (const part of String(header ?? "").split(";")) {
        const i = part.indexOf("=");
        if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
    }
    return null;
}

export function createSessions({ db, name, days, production }) {
    const maxAge = days * 24 * 60 * 60;
    // HttpOnly: no script can read it; SameSite=Lax: other sites' pages do not send it; Secure in production, where the
    // __Host- name requires it
    const attributes = `Path=/; HttpOnly; SameSite=Lax${production ? "; Secure" : ""}`;

    return {
        // a new session for the user: sets the cookie on `res` and returns the token's hash (its name in the database)
        start(res, user) {
            const token = crypto.randomBytes(32).toString("base64url");
            const hash = sha256(token);
            db.q.insertSession.run(hash, user.id, new Date(Date.now() + maxAge * 1000).toISOString());
            res.append("Set-Cookie", `${name}=${token}; Max-Age=${maxAge}; ${attributes}`);
            return hash;
        },

        // who a request, or a socket's handshake, comes from: { id, username, joined, hash } or null
        userOf(headers) {
            const token = readCookie(headers.cookie, name);
            if (!token) return null;
            const hash = sha256(token);
            const user = db.q.sessionUser.get(hash, new Date().toISOString());
            return user ? { id: user.id, username: user.username, joined: user.joined, hash } : null;
        },

        end(res, hash) {
            if (hash) db.q.deleteSession.run(hash);
            res.append("Set-Cookie", `${name}=; Max-Age=0; ${attributes}`);
        },

        sweep: () => db.q.deleteExpiredSessions.run(new Date().toISOString()),

        // Express middleware: req.user is the signed-in user or null
        middleware(req, res, next) {
            req.user = this.userOf(req.headers);
            next();
        },
    };
}

// a route that needs someone signed in
export function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Sign in first." });
    next();
}
