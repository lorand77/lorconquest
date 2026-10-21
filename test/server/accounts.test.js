// Accounts and sessions (docs/plan.md, milestone 6): signing up and in over REST, the cookie, who may open a socket,
// the throttles, and what a stolen copy of the database would hold.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { io as ioClient } from "socket.io-client";
import { openDb } from "../../src/db.js";
import { api, connect, emitAck, newGame, signIn, startServer, tempDb } from "./helpers.js";

const post = (server, path, body, headers = {}) => fetch(server.baseUrl + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const cookieOf = (res) => res.headers.getSetCookie()[0];

test("registering signs in, with a cookie no script can read; the password and the token are never stored as they are", async () => {
    const dbPath = tempDb();
    const server = await startServer({ dbPath });
    try {
        const res = await post(server, "/api/register", { username: "alice", password: "correct horse" });
        assert.equal(res.status, 201);
        assert.deepEqual(await res.json(), { id: 1, username: "alice" });
        const set = cookieOf(res);
        assert.match(set, /^lc_session=[\w-]{40,}; Max-Age=604800; Path=\/; HttpOnly; SameSite=Lax$/);
        const me = await fetch(server.baseUrl + "/api/me", { headers: { Cookie: set.split(";")[0] } });
        assert.deepEqual(await me.json(), { id: 1, username: "alice" });
        assert.equal((await fetch(server.baseUrl + "/api/me")).status, 401);
        const db = new DatabaseSync(dbPath);
        const user = db.prepare("SELECT password_hash FROM users").get();
        assert.match(user.password_hash, /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
        assert.equal(user.password_hash.includes("correct horse"), false);
        const token = set.split(";")[0].split("=")[1];
        const rows = db.prepare("SELECT token_hash FROM sessions").all();
        assert.equal(rows.length, 1);
        assert.notEqual(rows[0].token_hash, token);
        db.close();
    } finally {
        await server.close();
    }
});

test("a name and a password must pass the rules, and a name is taken whatever its case", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const bad = async (username, password, status) => assert.equal((await post(server, "/api/register", { username, password })).status, status, `${username}/${password}`);
        await bad("ab", "long enough", 400);                    // too short
        await bad("has space", "long enough", 400);
        await bad("alice", "short", 400);
        await bad("alice", "x".repeat(129), 400);
        await bad(42, "long enough", 400);
        await bad("Admin_1", "long enough", 400);               // passes for staff
        await bad("fuck_you", "long enough", 400);
        await bad("lorraine", "long enough", 400);              // the site's own prefix
        await bad("alice", "long enough", 201);
        await bad("ALICE", "long enough", 409);
        await bad("alice", "other password", 409);
    } finally {
        await server.close();
    }
});

test("signing in: one answer for a wrong password and an unknown name; signing out ends the session", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        await post(server, "/api/register", { username: "alice", password: "correct horse" });
        const wrong = await post(server, "/api/login", { username: "alice", password: "wrong horse" });
        const unknown = await post(server, "/api/login", { username: "nobody", password: "wrong horse" });
        assert.deepEqual([wrong.status, unknown.status], [401, 401]);
        assert.deepEqual(await wrong.json(), await unknown.json());
        assert.equal((await post(server, "/api/login", { username: "alice" })).status, 401);
        assert.equal((await post(server, "/api/login", { username: "alice", password: "x".repeat(500) })).status, 401);
        const ok = await post(server, "/api/login", { username: "alice", password: "correct horse" });
        assert.equal(ok.status, 200);
        const cookie = cookieOf(ok).split(";")[0];
        assert.equal((await fetch(server.baseUrl + "/api/me", { headers: { Cookie: cookie } })).status, 200);
        const out = await post(server, "/api/logout", {}, { Cookie: cookie });
        assert.match(cookieOf(out), /Max-Age=0/);
        assert.equal((await fetch(server.baseUrl + "/api/me", { headers: { Cookie: cookie } })).status, 401, "the old cookie is dead");
    } finally {
        await server.close();
    }
});

test("a session expires; the server forgets expired ones", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const cookie = await signIn(server, "alice");
        assert.equal((await api(server, "GET", "/api/me", null, "alice")).status, 200);
        server.app.db.db.exec("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'");
        assert.equal((await fetch(server.baseUrl + "/api/me", { headers: { Cookie: cookie } })).status, 401);
        server.app.sessions.sweep();
        assert.equal(server.app.db.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
    } finally {
        await server.close();
    }
});

test("everything but the scenarios needs someone signed in", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        assert.equal((await api(server, "GET", "/api/scenarios", null, null)).status, 200);
        for (const [method, url] of [["GET", "/api/tables"], ["GET", "/api/games"], ["POST", "/api/tables"], ["POST", "/api/tables/1/join"], ["POST", "/api/tables/1/start"]]) {
            assert.equal((await api(server, method, url, method === "POST" ? {} : null, null)).status, 401, `${method} ${url}`);
        }
    } finally {
        await server.close();
    }
});

test("a socket needs a session: none, a made-up one and a signed-out one are all refused", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const open = (extraHeaders) => new Promise((resolve) => {
            const s = ioClient(server.baseUrl, { transports: ["websocket"], reconnection: false, forceNew: true, extraHeaders });
            server.sockets.add(s);
            s.once("connect", () => resolve("connected"));
            s.once("connect_error", (e) => resolve(e.message));
        });
        assert.equal(await open({}), "sign in first");
        assert.equal(await open({ cookie: "lc_session=made-up" }), "sign in first");
        const cookie = await signIn(server, "alice");
        assert.equal(await open({ cookie }), "connected");
        // signing out drops the sockets of that session
        const s = await connect(server, "alice");
        const gone = new Promise((resolve) => s.once("disconnect", resolve));
        await api(server, "POST", "/api/logout", {}, "alice");
        await gone;
        assert.equal(await open({ cookie }), "sign in first");
    } finally {
        await server.close();
    }
});

test("a page on another site cannot act with the cookie, by REST or by socket", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const cookie = await signIn(server, "alice");
        const host = new URL(server.baseUrl).host;
        const evil = await post(server, "/api/tables", { scenario: "mitteleuropa", country: "BAV" }, { Cookie: cookie, Origin: "https://evil.example" });
        assert.equal(evil.status, 403);
        assert.equal((await post(server, "/api/tables", { scenario: "mitteleuropa", country: "BAV" }, { Cookie: cookie, Origin: "null" })).status, 403);
        assert.equal((await post(server, "/api/tables", { scenario: "mitteleuropa", country: "BAV" }, { Cookie: cookie, Origin: `http://${host}` })).status, 201);
        assert.equal((await fetch(server.baseUrl + "/api/me", { headers: { Cookie: cookie, Origin: "https://evil.example" } })).status, 200, "reads stay open: the other site cannot see the answer");
        const refused = await new Promise((resolve) => {
            const s = ioClient(server.baseUrl, { transports: ["websocket"], reconnection: false, forceNew: true, extraHeaders: { cookie, origin: "https://evil.example" } });
            server.sockets.add(s);
            s.once("connect", () => resolve("connected"));
            s.once("connect_error", () => resolve("refused"));
        });
        assert.equal(refused, "refused");
    } finally {
        await server.close();
    }
});

test("too many wrong passwords from one address are throttled, and so are too many sign-ups", async () => {
    const server = await startServer({ dbPath: tempDb(), limits: { loginMax: 3, registerMax: 2, windowMs: 60000 } });
    try {
        assert.equal((await post(server, "/api/register", { username: "alice", password: "correct horse" })).status, 201);
        for (let i = 0; i < 3; i++) assert.equal((await post(server, "/api/login", { username: "alice", password: "nope nope" })).status, 401);
        assert.equal((await post(server, "/api/login", { username: "alice", password: "nope nope" })).status, 429);
        assert.equal((await post(server, "/api/login", { username: "alice", password: "correct horse" })).status, 429, "even the right one, for now");
        assert.equal((await post(server, "/api/register", { username: "bobby", password: "correct horse" })).status, 201);
        assert.equal((await post(server, "/api/register", { username: "carol", password: "correct horse" })).status, 429);
    } finally {
        await server.close();
    }
});

test("games from before accounts have no host and no seats: they are put away at boot", () => {
    const file = tempDb();
    const old = new DatabaseSync(file);
    old.exec(`CREATE TABLE games (id INTEGER PRIMARY KEY, scenario TEXT NOT NULL, seed INTEGER NOT NULL, rules_version INTEGER NOT NULL, human TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active', winner TEXT, day INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
        INSERT INTO games (scenario, seed, rules_version, human) VALUES ('docs', 1, 3, 'BAV');
        INSERT INTO games (scenario, seed, rules_version, human, status) VALUES ('docs', 2, 3, 'ULM', 'finished');`);
    old.close();
    const db = openDb(file);
    assert.deepEqual(db.db.prepare("SELECT id, status FROM games ORDER BY id").all().map((g) => [g.id, g.status]), [[1, "aborted"], [2, "finished"]]);
    assert.deepEqual(db.q.activeGames.all(), []);
    // the default scenario's old id, from when it lived in docs/, is its folder's name now
    assert.deepEqual(db.db.prepare("SELECT DISTINCT scenario FROM games").all().map((r) => r.scenario), ["mitteleuropa"]);
    db.close();
});

test("the sign-in of a solo game: the game is the user's, and no one else may open it", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        const id = await newGame(server, undefined, "alice");
        const bob = await connect(server, "bob");
        const r = await emitAck(bob, "join", { gameId: id });
        assert.deepEqual([r.ok, r.error], [false, "you have no seat in this game"]);
        assert.deepEqual((await api(server, "GET", "/api/games", null, "bob")).body, []);
        assert.equal((await api(server, "GET", "/api/games", null, "alice")).body.length, 1);
    } finally {
        await server.close();
    }
});
