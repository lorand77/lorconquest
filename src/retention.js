// Housekeeping the running server does by itself: tables nobody started are taken down after TABLE_HOURS, and a game's chat
// is deleted CHAT_RETENTION_DAYS after the game ends (the privacy page promises it; a negative setting keeps it for ever).
// Started from src/server.js only, so the tests, which boot src/app.js, do not run it on their own.
import config from "./config.js";

const HOUR_MS = 60 * 60 * 1000;

export function startRetention(rooms, log, { tableHours = config.TABLE_HOURS, chatDays = config.CHAT_RETENTION_DAYS } = {}) {
    const run = () => {
        try {
            rooms.sweepTables(tableHours);
            rooms.sweepChat(chatDays);
        } catch (err) {
            log.error("retention.failed", { err });
        }
    };
    run();
    const timer = setInterval(run, HOUR_MS);
    timer.unref();
    return () => clearInterval(timer);
}
