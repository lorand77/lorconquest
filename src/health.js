// GET /health, for the outside uptime check (docs/setup.md, "monitoring"). pm2 restarts a crashed process; this catches
// what it cannot see: the machine or the proxy down, the database unreadable, the disk filling up, and — for a real-time
// game — a game whose loop has stopped ticking. 200 { ok: true } or 503 { ok: false }, nothing else: the URL is public.
// Why it failed goes to the log (health.failed).
import fs from "node:fs";
import path from "node:path";

// below this share of the database's disk free, report unhealthy: time to clean up before SQLite cannot write
const MIN_FREE = 0.1;

export function health({ db, rooms, log, dbPath, stallMs }) {
    // reads a real table, so the query reaches the database file
    const ping = db.db.prepare("SELECT 1 FROM users LIMIT 1");
    return (req, res) => {
        try {
            ping.get();
            if (dbPath !== ":memory:") {
                const { bavail, blocks } = fs.statfsSync(path.dirname(dbPath));
                if (bavail / blocks < MIN_FREE) {
                    log.error("health.failed", { reason: "disk_low", free_pct: Math.floor((bavail / blocks) * 100) });
                    return res.status(503).json({ ok: false });
                }
            }
            const stuck = rooms.stalled(stallMs);
            if (stuck.length) {
                log.error("health.failed", { reason: "game_stalled", games: stuck });
                return res.status(503).json({ ok: false });
            }
            res.json({ ok: true });
        } catch (err) {
            log.error("health.failed", { reason: "error", err });
            res.status(503).json({ ok: false });
        }
    };
}
