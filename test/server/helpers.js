// Boots the real server in-process on a random port, against a database of the test's own, with short ticks so
// games run fast; and Socket.IO helpers. Servers can be started one after another on the same database, which
// is how a restart is tested. Logs are silent unless TEST_LOG is set, or a test collects them.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { io as ioClient } from "socket.io-client";
import { createApp } from "../../src/app.js";
import log from "../../src/log.js";

const dirs = [];
process.on("exit", () => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

export function tempDb() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-test-"));
    dirs.push(dir);
    return path.join(dir, "test.sqlite");
}

// { baseUrl, app, close }; `lines`, if given, collects every log line at info and up
export async function startServer({ dbPath, tickMs = 2, statsEvery = 365, lines } = {}) {
    const level = lines ? "info" : process.env.TEST_LOG ? "debug" : "silent";
    const logger = log.createLogger({ level, write: lines ? (t) => lines.push(t) : (t) => process.stdout.write(t) });
    const app = createApp({ dbPath, tickMs, statsEvery, log: logger });
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const sockets = new Set();
    return {
        baseUrl, app, sockets,
        close: async () => {
            for (const s of sockets) s.close();
            await app.close();
        },
    };
}

export async function api(server, method, url, body) {
    const res = await fetch(server.baseUrl + url, {
        method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
}

export async function newGame(server, body = { scenario: "docs", country: "BAV", seed: 5 }) {
    const res = await api(server, "POST", "/api/games", body);
    if (res.status !== 201) throw new Error(`new game: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id;
}

export function connect(server) {
    const socket = ioClient(server.baseUrl, { transports: ["websocket"], reconnection: false, forceNew: true });
    server.sockets.add(socket);
    return new Promise((resolve, reject) => {
        socket.once("connect", () => resolve(socket));
        socket.once("connect_error", reject);
    });
}

export function emitAck(socket, event, payload, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no answer to ${event}`)), timeoutMs);
        socket.emit(event, payload, (reply) => { clearTimeout(timer); resolve(reply); });
    });
}

// the first `event` whose payload passes `ok`
export function waitFor(socket, event, ok = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(event, on); reject(new Error(`no ${event} within ${timeoutMs} ms`)); }, timeoutMs);
        function on(payload) {
            if (!ok(payload)) return;
            clearTimeout(timer);
            socket.off(event, on);
            resolve(payload);
        }
        socket.on(event, on);
    });
}

// run a game until `day`, then pause it; resolves to the day it stood still on
export async function runUntil(socket, day) {
    const reached = waitFor(socket, "tick", (t) => t.day >= day);
    await emitAck(socket, "pause", { paused: false });
    await reached;
    const stopped = waitFor(socket, "paused", (p) => p.paused);
    await emitAck(socket, "pause", { paused: true });
    return (await stopped).day;
}
