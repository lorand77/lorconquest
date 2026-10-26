// Builds the Express app and the HTTP server with Socket.IO attached, opens the database and brings every active
// game back, but does not listen: src/server.js listens, and the tests boot this very thing on a random port with
// their own database. Taken from LorCiv's app.js.
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import express from "express";
import { Server } from "socket.io";
import config from "./config.js";
import { allowSocketRequest, requireSameOrigin } from "./auth/origin.js";
import { authRoutes } from "./auth/routes.js";
import { createSessions } from "./auth/session.js";
import { createThrottles } from "./auth/throttle.js";
import { openDb } from "./db.js";
import { health } from "./health.js";
import { createRooms } from "./game/rooms.js";
import { gameRoutes } from "./game/routes.js";
import { friendRoutes } from "./friends/routes.js";
import { loadScenarios } from "./game/scenarios.js";
import { attachSockets } from "./game/socket.js";
import defaultLog from "./log.js";
import { preloadPages } from "./preload.js";

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

// `setupMs` and `awayMs` are the multiplayer minute and the two minutes (RULES.md §1); `limits` the login throttles (config.js)
export function createApp({
    dbPath = config.DB_PATH, tickMs = config.TICK_MS, statsEvery = config.STATS_EVERY_DAYS, root = config.ROOT, log = defaultLog,
    setupMs = config.SETUP_MS, awayMs = config.AWAY_MS, maxHumans = config.MAX_HUMANS, idleMs = config.IDLE_MS, production = config.PRODUCTION, limits = {},
    trustProxy = config.TRUST_PROXY, stallMs = config.HEALTH_STALL_MS,
} = {}) {
    const db = openDb(dbPath);
    const sessions = createSessions({ db, name: config.SESSION_COOKIE, days: config.SESSION_DAYS, production });
    const throttles = createThrottles({
        windowMs: config.AUTH_WINDOW_MS, loginMax: config.LOGIN_MAX_FAILURES, registerMax: config.REGISTER_MAX, hashMax: config.HASH_MAX_CONCURRENT, ...limits,
    });
    sessions.sweep();
    const sweeper = setInterval(() => sessions.sweep(), 60 * 60 * 1000);
    sweeper.unref();
    const scenarios = loadScenarios(root);
    const app = express();
    app.disable("x-powered-by");
    // behind Caddy the client's address is the one it forwards (and https is known from X-Forwarded-Proto)
    if (trustProxy) app.set("trust proxy", trustProxy);
    app.use(securityHeaders);

    // ahead of the log and the session: an uptime check every few minutes needs neither
    app.get("/health", (req, res) => healthCheck(req, res));

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
    // a page on another site must not act with the user's cookie, and who is asking is known from here on
    app.use("/api", requireSameOrigin(log), (req, res, next) => sessions.middleware(req, res, next));

    const server = http.createServer(app);
    // messages over 512 bytes are compressed (permessage-deflate, which Caddy's encode does not do for a websocket): a day of
    // the historical scenario can be 10 KB or more, ten times a second, and a player's answers queue behind it on a slow line;
    // compressed it is a seventh of that
    const io = new Server(server, { allowRequest: allowSocketRequest(log), perMessageDeflate: { threshold: 512 } });
    const rooms = createRooms({ db, scenarios, io, log, tickMs, statsEvery, setupMs, awayMs, maxHumans, idleMs });
    const healthCheck = health({ db, rooms, log, dbPath, stallMs });
    app.use("/api", authRoutes({ db, sessions, throttles, io }));
    app.use("/api", gameRoutes(rooms, scenarios));
    app.use("/api", friendRoutes({ db, io }));

    // the engine, for the browser's previews: the very files the server runs
    app.use("/engine", express.static(path.join(root, "src", "engine")));
    // each scenario's map and data
    app.get("/scenario/:id/:file", (req, res) => {
        const s = scenarios.get(req.params.id);
        if (!s || !["map.svg", "scenario.json"].includes(req.params.file)) return res.status(404).end();
        res.sendFile(path.join(s.dir, req.params.file));
    });
    // the pages, each with every module its script needs to load at once (preload.js); then the rest of public/
    app.use(preloadPages(root, production));
    app.use(express.static(path.join(root, "public")));

    // errors no handler dealt with: logged with their stack, answered with neither
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        const status = err.status >= 400 && err.status < 500 ? err.status : 500;
        if (status === 500) (req.log || log).error("http.unhandled", { err });
        res.status(status).json({ error: status === 500 ? "Server error." : "Bad request." });
    });

    attachSockets({ io, rooms, sessions, log, tickMs });
    rooms.resumeAll();

    async function close() {
        clearInterval(sweeper);
        throttles.stop();
        await rooms.close();
        server.closeAllConnections();
        await new Promise((resolve) => io.close(() => resolve()));
        db.close();
    }

    return { app, server, io, rooms, db, scenarios, sessions, close };
}
