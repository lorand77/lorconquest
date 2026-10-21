// The entry point: builds the app (src/app.js) and listens. Process-level concerns live here and only here,
// because the tests boot app.js directly: crash and signal handling.
import config from "./config.js";
import log from "./log.js";
import { createApp } from "./app.js";
import { startRetention } from "./retention.js";

// an uncaught error leaves the process in an unknown state: log it, with its stack, and exit
function crash(kind, err) {
    log.error("process.crash", { kind, err });
    process.exit(1);
}
process.on("uncaughtException", (err) => crash("uncaught_exception", err));
process.on("unhandledRejection", (err) => crash("unhandled_rejection", err));

const { server, close, rooms } = createApp();
startRetention(rooms, log);

// on a stop signal every game saves the day it reached, so a restart resumes it exactly there
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
        log.info("process.stop", { signal });
        await close();
        process.exit(0);
    });
}

server.listen(config.PORT, () => {
    log.info("process.start", { node: process.version, url: `http://localhost:${config.PORT}/`, db: config.DB_PATH, tick_ms: config.TICK_MS });
});
