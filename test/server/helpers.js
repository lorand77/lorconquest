// Boots the real server in-process on a random port, against a database of the test's own, with short ticks so
// games run fast; signing in (a default user, "tester", unless a test names another); and Socket.IO helpers. Servers can be started one after another on the same database, which
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

// a folder to start a server in (startServer's `root`) whose Mitteleuropa gives `codes` ten times their people — and so ten times
// their garrisons: the computer, which attacks only at good odds, leaves them alone, and the people who play them in a test,
// giving no orders, are not swept off the map in the second or two a test runs (a day takes 2 ms)
export function sturdyRoot(codes) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lc-root-"));
    dirs.push(root);
    const from = path.join(import.meta.dirname, "..", "..", "scenarios", "mitteleuropa"), to = path.join(root, "scenarios", "mitteleuropa");
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
    const data = JSON.parse(fs.readFileSync(path.join(to, "scenario.json"), "utf8"));
    for (const x of data.settlements) if (codes.includes(x.country)) x.pop *= 10;
    fs.writeFileSync(path.join(to, "scenario.json"), JSON.stringify(data));
    return root;
}

// { baseUrl, app, close }; `lines`, if given, collects every log line at info and up
export async function startServer({ dbPath, tickMs = 2, statsEvery = 365, lines, root, setupMs = 0, awayMs = 60000, emptyMs = 600000, idleMs = 600000, stallMs, trustProxy, limits = { loginMax: 1000, registerMax: 1000 } } = {}) {
    const level = lines ? "info" : process.env.TEST_LOG ? "debug" : "silent";
    const logger = log.createLogger({ level, write: lines ? (t) => lines.push(t) : (t) => process.stdout.write(t) });
    const app = createApp({ dbPath, tickMs, statsEvery, log: logger, setupMs, awayMs, emptyMs, idleMs, limits, ...(stallMs !== undefined ? { stallMs } : {}), ...(trustProxy !== undefined ? { trustProxy } : {}), ...(root ? { root } : {}) });
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
    const sockets = new Set();
    return {
        baseUrl, app, sockets, cookies: new Map(),
        close: async () => {
            for (const s of sockets) s.close();
            await app.close();
        },
    };
}

// the cookie of a signed-in user: registers the name the first time (and signs in if it exists already)
export async function signIn(server, name = "tester", password = "secret-pass") {
    if (!server.cookies.has(name)) {
        let res = await fetch(server.baseUrl + "/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: name, password }) });
        if (res.status === 409) res = await fetch(server.baseUrl + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: name, password }) });
        if (!res.ok) throw new Error(`sign in as ${name}: ${res.status} ${await res.text()}`);
        server.cookies.set(name, res.headers.getSetCookie()[0].split(";")[0]);
    }
    return server.cookies.get(name);
}

// a request as `who` (a signed-in name; null for nobody)
export async function api(server, method, url, body, who = "tester") {
    const headers = body ? { "Content-Type": "application/json" } : {};
    if (who) headers.Cookie = await signIn(server, who);
    const res = await fetch(server.baseUrl + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
}

// a solo game (started at once) as `who`; resolves to its id
export async function newGame(server, body = { scenario: "mitteleuropa", country: "BAV", seed: 5 }, who = "tester") {
    const res = await api(server, "POST", "/api/tables", { ...body, solo: true }, who);
    if (res.status !== 201) throw new Error(`new game: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id;
}

// a socket signed in as `who`
export async function connect(server, who = "tester") {
    const cookie = await signIn(server, who);
    const socket = ioClient(server.baseUrl, { transports: ["websocket"], reconnection: false, forceNew: true, extraHeaders: { cookie } });
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
