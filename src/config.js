// Every setting the environment can change, in one place; nothing else reads process.env. Tests pass their own
// values to createApp instead (src/app.js).
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

// a whole-number setting; unset or unreadable falls back to the default, an explicit 0 is kept
function intEnv(name, fallback) {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) ? n : fallback;
}

const PRODUCTION = process.env.NODE_ENV === "production";

export default {
    ROOT,
    PRODUCTION,
    // LorCiv has 3001 and LorChess 3000 on the same machine
    PORT: intEnv("PORT", 3002),
    // the single SQLite file, created on first run
    DB_PATH: process.env.DB_PATH || path.join(ROOT, "data", "lorconquest.sqlite"),
    // real time per game day (RULES.md §1)
    TICK_MS: intEnv("TICK_MS", 100),
    // how often each game logs how long its days take, in game days
    STATS_EVERY_DAYS: intEnv("STATS_EVERY_DAYS", 365),
    // the session cookie; in production it is a __Host- cookie, which browsers accept only over HTTPS (src/auth/session.js)
    SESSION_COOKIE: PRODUCTION ? "__Host-lc_session" : "lc_session",
    SESSION_DAYS: intEnv("SESSION_DAYS", 7),
    // the throttles on /api/login and /api/register (src/auth/throttle.js): failures or sign-ups per client address in a
    // window, and how many password hashes may run at once
    AUTH_WINDOW_MS: intEnv("AUTH_WINDOW_MS", 15 * 60 * 1000),
    LOGIN_MAX_FAILURES: intEnv("LOGIN_MAX_FAILURES", 10),
    REGISTER_MAX: intEnv("REGISTER_MAX", 5),
    HASH_MAX_CONCURRENT: intEnv("HASH_MAX_CONCURRENT", 2),
    // multiplayer (RULES.md §1): the clock stands still this long after the host starts a game with two or more people;
    // a player away this long has their country played by the full computer player (a caretaker until then)
    SETUP_MS: intEnv("SETUP_MS", 60 * 1000),
    AWAY_MS: intEnv("AWAY_MS", 2 * 60 * 1000),
    // a single-player game whose player has gone is let go from memory after this long, and brought back when they return
    IDLE_MS: intEnv("IDLE_MS", 10 * 60 * 1000),
    // the proxy in front of the server (Caddy): how many hops to trust for the client's address, which the login throttle
    // and the logs use. 0 when the server is reached directly; in production 1, and port 3002 must then stay closed.
    TRUST_PROXY: intEnv("TRUST_PROXY", PRODUCTION ? 1 : 0),
    // housekeeping (src/retention.js): tables nobody started are taken down after this many hours; a game's chat is
    // deleted this many days after it ends (-1 keeps it for ever)
    TABLE_HOURS: intEnv("TABLE_HOURS", 24),
    CHAT_RETENTION_DAYS: intEnv("CHAT_RETENTION_DAYS", 30),
    // /health reports a game unhealthy when it should be running and has not ticked for this long
    HEALTH_STALL_MS: intEnv("HEALTH_STALL_MS", 15 * 1000),
    // the most people in one game
    MAX_HUMANS: intEnv("MAX_HUMANS", 4),
    // silent, error, warn, info or debug (src/log.js)
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
