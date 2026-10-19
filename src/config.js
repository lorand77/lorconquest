// Every setting the environment can change, in one place; nothing else reads process.env. Tests pass their own
// values to createApp instead (src/app.js).
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");

// a whole-number setting; unset or unreadable falls back to the default, an explicit 0 is kept
function intEnv(name, fallback) {
    const n = parseInt(process.env[name], 10);
    return Number.isFinite(n) ? n : fallback;
}

export default {
    ROOT,
    // LorCiv has 3001 and LorChess 3000 on the same machine
    PORT: intEnv("PORT", 3002),
    // the single SQLite file, created on first run
    DB_PATH: process.env.DB_PATH || path.join(ROOT, "data", "lorconquest.sqlite"),
    // real time per game day (RULES.md §1)
    TICK_MS: intEnv("TICK_MS", 100),
    // how often each game logs how long its days take, in game days
    STATS_EVERY_DAYS: intEnv("STATS_EVERY_DAYS", 365),
    // silent, error, warn, info or debug (src/log.js)
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
};
