// Builds the Express app and the HTTP server with Socket.IO attached, opens the database and brings every active
// game back, but does not listen: src/server.js listens, and the tests boot this very thing on a random port with
// their own database. Taken from LorCiv's app.js, without what waits for accounts (milestone 6).
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import config from "./config.js";
import { openDb } from "./db.js";
import { createRooms } from "./game/rooms.js";
import { gameRoutes } from "./game/routes.js";
import { loadScenarios } from "./game/scenarios.js";
import { attachSockets } from "./game/socket.js";
import defaultLog from "./log.js";

// at or over this, a request is logged as a warning
const SLOW_MS = 1000;

// every response: scripts only from files on this origin (no inline script, no onclick=), no framing, no sniffing
const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");

function securityHeaders(req, res, next) {
    res.set({
        "Content-Security-Policy": CSP,
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
    });
    next();
}

export function createApp({ dbPath = config.DB_PATH, tickMs = config.TICK_MS, statsEvery = config.STATS_EVERY_DAYS, root = config.ROOT, log = defaultLog } = {}) {
    const db = openDb(dbPath);
    const scenarios = loadScenarios(root);
    const app = express();
    app.disable("x-powered-by");
    app.use(securityHeaders);

    // one line per /api request, with the route's pattern, never the URL
    app.use("/api", (req, res, next) => {
        const started = performance.now();
        req.log = log.child({ req: crypto.randomBytes(4).toString("hex") });
        res.on("close", () => {
            const ms = Math.round(performance.now() - started), status = res.statusCode;
            req.log[status >= 500 ? "error" : ms >= SLOW_MS ? "warn" : "info"]("http.request", {
                method: req.method, route: req.route ? `/api${req.route.path}` : "unmatched", status, ms,
            });
        });
        next();
    });
    app.use(express.json());

    const server = http.createServer(app);
    const io = new Server(server);
    const rooms = createRooms({ db, scenarios, io, log, tickMs, statsEvery });
    app.use("/api", gameRoutes(rooms, scenarios));

    // the engine, for the browser's previews: the very files the server runs
    app.use("/engine", express.static(path.join(root, "src", "engine")));
    // each scenario's map and data
    app.get("/scenario/:id/:file", (req, res) => {
        const s = scenarios.get(req.params.id);
        if (!s || !["map.svg", "scenario.json"].includes(req.params.file)) return res.status(404).end();
        res.sendFile(path.join(s.dir, req.params.file));
    });
    app.use(express.static(path.join(root, "public")));

    // errors no handler dealt with: logged with their stack, answered with neither
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        const status = err.status >= 400 && err.status < 500 ? err.status : 500;
        if (status === 500) (req.log || log).error("http.unhandled", { err });
        res.status(status).json({ error: status === 500 ? "Server error." : "Bad request." });
    });

    attachSockets(io, rooms, log, tickMs);
    rooms.resumeAll();

    async function close() {
        await rooms.close();
        server.closeAllConnections();
        await new Promise((resolve) => io.close(() => resolve()));
        db.close();
    }

    return { app, server, io, rooms, db, scenarios, close };
}
