// The achievements' worker thread: plays one finished game over at a time (analyze.js) off the main thread, which a long game
// would otherwise hold for half a minute. Gets a job ({ gameId, ... }, service.js), answers { gameId, ...analysis }. Never
// touches the database.
import { parentPort } from "node:worker_threads";
import { analyzeGame } from "./analyze.js";

parentPort.on("message", (job) => {
    let out;
    try {
        out = analyzeGame(job);
    } catch (err) {
        out = { ok: false, error: "threw", message: String(err?.stack ?? err) };
    }
    parentPort.postMessage({ gameId: job.gameId, ...out });
});
