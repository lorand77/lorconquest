// Finishing (docs/plan.md, milestone 7): how a game's end is kept — who placed where, the fingerprint of the final state —
// the replay that must end exactly as the game did, the leaderboard, single-player games let go from memory and brought back,
// the health check, housekeeping, the owner's tools, and that what the privacy page says is what the server does.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backup } from "../../tools/backup.js";
import { changePassword, deleteAccount, planDeletion } from "../../src/accounts.js";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import config from "../../src/config.js";
import { fingerprint, replay, scores } from "../../src/engine/index.js";
import { rankHumans } from "../../src/game/results.js";
import { api, connect, emitAck, newGame, signIn, startServer, tempDb, waitFor } from "./helpers.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, what, timeoutMs = 8000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { const v = await check(); if (v) return v; await wait(10); }
    throw new Error(`gave up waiting for ${what}`);
}

// a scenario where 6 settlements win, so a game ends quickly: the computer countries' wars decide who gets there first
function quickRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lc-root-"));
    fs.mkdirSync(path.join(root, "scenarios", "mitteleuropa"), { recursive: true });
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "scenario.json"), JSON.stringify({ ...scenario, victory: { settlements: 6, endYear: 1700 } }));
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "SCENARIO.md"), "# SCENARIO: TEST\n");
    return root;
}

// two people play a game to its end in the quick scenario; resolves to the server, its game id and what was seen
async function finishedGame(server, [[a, ca], [b, cb]] = [["alice", "BAV"], ["bobby", "ULM"]], seed = 5) {
    const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: ca, seed }, a);
    await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: cb }, b);
    assert.equal((await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, a)).status, 200);
    const sa = await connect(server, a), sb = await connect(server, b);
    const over = waitFor(sa, "over", () => true, 30000);
    await emitAck(sa, "join", { gameId: made.body.id });
    await emitAck(sb, "join", { gameId: made.body.id });
    return { id: made.body.id, over: await over };
}

test("a finished game keeps its standings, ranked among its people, and the fingerprint of its final state", async () => {
    const root = quickRoot();
    const server = await startServer({ dbPath: tempDb(), root });
    try {
        const { id, over } = await finishedGame(server);
        const game = server.app.db.q.game.get(id);
        assert.deepEqual([game.status, game.winner], ["finished", over.winner]);
        assert.match(game.result_hash, /^[0-9a-f]{8}$/);
        // the replay, rebuilt from the log alone, ends exactly as the game did: the same fingerprint, the same standings
        const log = server.app.db.q.allCommands.all(id).map((c) => ({ day: c.day, cmd: JSON.parse(c.cmd) }));
        const rebuilt = replay(JSON.parse(fs.readFileSync(path.join(root, "scenarios", "mitteleuropa", "scenario.json"), "utf8")), game.seed, log, game.day, ["BAV", "ULM"]);
        assert.equal(rebuilt.day, game.day);
        assert.equal(fingerprint(rebuilt.snapshot()), game.result_hash);
        const seats = server.app.db.db.prepare("SELECT country, place, settlements, pop FROM game_seats WHERE game_id = ? ORDER BY place").all(id);
        const expected = rankHumans([{ country: "BAV", quitDay: null }, { country: "ULM", quitDay: null }], scores(rebuilt.state));
        assert.deepEqual(seats.map((s) => [s.country, s.place, s.settlements]), expected.map((r) => [r.country, r.place, r.settlements]));
        assert.deepEqual(seats.map((s) => s.place), [1, 2]);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("the leaderboard lists everyone and counts the games finished: firsts among people, average place, victories", async () => {
    const root = quickRoot();
    const server = await startServer({ dbPath: tempDb(), root });
    try {
        // everyone is on it, a game finished or not
        assert.deepEqual((await api(server, "GET", "/api/leaderboard", null, "alice")).body, [{ username: "alice", games: 0, shared: 0, firsts: 0, victories: 0, averagePlace: null }]);
        assert.equal((await api(server, "GET", "/api/leaderboard", null, null)).status, 401);
        const { id } = await finishedGame(server);
        const rows = (await api(server, "GET", "/api/leaderboard", null, "alice")).body;
        const placed = server.app.db.db.prepare("SELECT u.username, s.place, s.country FROM game_seats s JOIN users u ON u.id = s.user_id WHERE s.game_id = ?").all(id);
        const first = placed.find((p) => p.place === 1), second = placed.find((p) => p.place === 2);
        assert.deepEqual(rows.map((r) => [r.username, r.games, r.shared, r.firsts]), [[first.username, 1, 1, 1], [second.username, 1, 1, 0]]);
        assert.deepEqual(rows.map((r) => r.averagePlace), [1, 2]);
        // one who has finished no game comes after, by name
        await api(server, "GET", "/api/me", null, "zed");
        await api(server, "GET", "/api/me", null, "carl");
        assert.deepEqual((await api(server, "GET", "/api/leaderboard", null, "alice")).body.map((r) => [r.username, r.games]).slice(2), [["carl", 0], ["zed", 0]]);
        const winner = server.app.db.q.game.get(id).winner;
        assert.equal(rows.reduce((n, r) => n + r.victories, 0), placed.some((p) => p.country === winner) ? 1 : 0, "a victory only if a person's country won");
        // an account that was deleted is not on it
        assert.equal(deleteAccount(server.app.db, second.username).ok, true);
        const after = (await api(server, "GET", "/api/leaderboard", null, first.username)).body.map((r) => r.username);
        assert.deepEqual([after.includes(second.username), after[0]], [false, first.username]);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a player who quit is placed after those who stayed, whatever their country made of itself", () => {
    const table = { A: { settlements: 9, pop: 5 }, B: { settlements: 3, pop: 5 }, C: { settlements: 6, pop: 5 } };
    assert.deepEqual(rankHumans([{ country: "A", quitDay: 100 }, { country: "B", quitDay: null }, { country: "C", quitDay: null }], table).map((r) => [r.country, r.place]), [["C", 1], ["B", 2], ["A", 3]]);
    // the later quitter is placed above the earlier; ties go to the larger population, then the code
    assert.deepEqual(rankHumans([{ country: "A", quitDay: 100 }, { country: "B", quitDay: 900 }], table).map((r) => r.country), ["B", "A"]);
    assert.deepEqual(rankHumans([{ country: "X", quitDay: null }, { country: "Y", quitDay: null }], { X: { settlements: 4, pop: 10 }, Y: { settlements: 4, pop: 20 } }).map((r) => r.country), ["Y", "X"]);
    assert.deepEqual(rankHumans([{ country: "Z", quitDay: null }], {}).map((r) => [r.place, r.settlements]), [[1, 0]]);
    // a player whose country fell comes after those still in and before those who quit, the later to fall first
    assert.deepEqual(rankHumans([{ country: "A", quitDay: 50, outDay: null }, { country: "B", quitDay: null, outDay: 300 }, { country: "C", quitDay: null, outDay: null }, { country: "D", quitDay: null, outDay: 900 }], table).map((r) => r.country), ["C", "D", "B", "A"]);
});

test("a replay is given for a finished game only, to anyone signed in, and only if the rules are the ones it was played under", async () => {
    const root = quickRoot();
    const server = await startServer({ dbPath: tempDb(), root });
    try {
        const going = await newGame(server, undefined, "carol");
        assert.deepEqual((({ status, body }) => [status, body.error])(await api(server, "GET", `/api/games/${going}/replay`, null, "carol")), [409, "that game is still being played"]);
        assert.equal((await api(server, "GET", "/api/games/999/replay", null, "carol")).status, 404);
        const { id } = await finishedGame(server);
        assert.equal((await api(server, "GET", `/api/games/${id}/replay`, null, null)).status, 401);
        // anyone signed in may watch, not only those who played
        const r = (await api(server, "GET", `/api/games/${id}/replay`, null, "carol")).body;
        const game = server.app.db.q.game.get(id);
        assert.deepEqual([r.id, r.scenario, r.seed, r.endDay, r.winner, r.resultHash, r.rulesVersion], [id, "mitteleuropa", game.seed, game.day, game.winner, game.result_hash, game.rules_version]);
        assert.deepEqual(r.humans, [{ country: "BAV", username: "alice" }, { country: "ULM", username: "bobby" }]);
        assert.ok(r.log.length > 0 && r.log.every((c) => Number.isInteger(c.day) && c.cmd.type && c.country));
        assert.equal(JSON.stringify(r).includes("password"), false);
        // played under other rules: it cannot be replayed exactly, and says so
        server.app.db.db.prepare("UPDATE games SET rules_version = rules_version - 1 WHERE id = ?").run(id);
        const old = await api(server, "GET", `/api/games/${id}/replay`, null, "carol");
        assert.equal(old.status, 409);
        assert.match(old.body.error, /played under rules version \d+, and this server plays \d+/);
        // the games list sends a finished game to its replay
        assert.deepEqual((await api(server, "GET", "/api/games", null, "alice")).body.map((g) => g.status), ["finished"]);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a single-player game whose player has gone is let go from memory, saved, and comes back where it stood", async () => {
    const dbPath = tempDb();
    let server = await startServer({ dbPath, idleMs: 150 });
    let id, before;
    try {
        id = await newGame(server, undefined, "alice");
        const s = await connect(server, "alice");
        await emitAck(s, "join", { gameId: id });
        await emitAck(s, "command", { cmd: { type: "setTax", tax: 2.5 } });
        await emitAck(s, "pause", { paused: false });
        await wait(300);
        before = (await emitAck(s, "join", { gameId: id })).view.day;
        assert.ok(before > 20);
        s.close();
        await until(() => !server.app.rooms.get(id), "the game to be let go");
        assert.equal(server.app.db.q.game.get(id).status, "active", "still a game going");
        assert.ok(server.app.db.q.game.get(id).day >= before, "saved where it stood");
        // someone else cannot make the server load it
        const other = await connect(server, "bobby");
        assert.equal((await emitAck(other, "join", { gameId: id })).error, "no such game");
        assert.equal(server.app.rooms.get(id), undefined);
        // the player returns: it is back, paused, with what they had set
        const s2 = await connect(server, "alice");
        const j = await emitAck(s2, "join", { gameId: id });
        assert.deepEqual([j.ok, j.paused, j.view.countries.BAV.tax], [true, true, 2.5]);
        assert.ok(j.view.day >= before - 20 && j.view.day <= before + 300, "from about where it stood");
        assert.ok(server.app.rooms.get(id));
        // coming back in time stops the timer: still there after the idle time has passed
        s2.close();
        await wait(60);
        const s3 = await connect(server, "alice");
        await emitAck(s3, "join", { gameId: id });
        await wait(300);
        assert.ok(server.app.rooms.get(id), "a player present keeps it");
    } finally {
        await server.close();
    }
    // and after a restart a single-player game waits to be opened, where one with several people runs on at once
    server = await startServer({ dbPath, idleMs: 100000 });
    try {
        await wait(200);
        assert.equal(server.app.rooms.get(id), undefined, "not brought back until opened");
        const s = await connect(server, "alice");
        assert.equal((await emitAck(s, "join", { gameId: id })).ok, true);
        assert.ok(server.app.rooms.get(id));
    } finally {
        await server.close();
    }
});

test("/health: up when the database reads, the disk has room and every game that should be ticking does; no sign-in, no log line", async () => {
    const lines = [];
    const server = await startServer({ dbPath: tempDb(), lines });
    try {
        const res = await fetch(server.baseUrl + "/health");
        assert.deepEqual([res.status, await res.json()], [200, { ok: true }]);
        const id = await newGame(server, undefined, "alice");
        const s = await connect(server, "alice");
        await emitAck(s, "join", { gameId: id });
        await emitAck(s, "pause", { paused: false });
        await wait(50);
        assert.equal((await fetch(server.baseUrl + "/health")).status, 200, "a game that is ticking is healthy");
        assert.equal(lines.some((l) => l.includes("/health")), false, "an uptime check leaves no log line");
    } finally {
        await server.close();
    }
    // a game that should be running and has not ticked for too long (here: for longer than nothing) is not healthy
    const stuck = await startServer({ dbPath: tempDb(), lines, stallMs: -1 });
    try {
        const id = await newGame(stuck, undefined, "alice");
        const s = await connect(stuck, "alice");
        await emitAck(s, "join", { gameId: id });
        assert.equal((await fetch(stuck.baseUrl + "/health")).status, 200, "paused, it is not expected to tick");
        await emitAck(s, "pause", { paused: false });
        await wait(50);
        const res = await fetch(stuck.baseUrl + "/health");
        assert.deepEqual([res.status, await res.json()], [503, { ok: false }]);
        assert.ok(lines.some((l) => l.includes("health.failed") && l.includes("game_stalled")), "and the reason goes to the log");
    } finally {
        await stuck.close();
    }
});

test("housekeeping: old chat goes (of games that ended), tables nobody started are taken down", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 100000 });
    try {
        const rooms = server.app.rooms, db = server.app.db;
        // chat in a game still going, and in one that ended long ago
        const mk = async (a, b, ca, cb) => {
            const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: ca }, a);
            await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: cb }, b);
            await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, a);
            const s = await connect(server, a);
            await emitAck(s, "join", { gameId: made.body.id });
            await emitAck(s, "chat", { text: "hello" });
            return made.body.id;
        };
        const live = await mk("alice", "bobby", "BAV", "ULM"), old = await mk("carol", "dave_d", "SAX", "BOH");
        db.db.prepare("UPDATE games SET status = 'finished', updated_at = datetime('now', '-40 days') WHERE id = ?").run(old);
        const chat = (g) => db.db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE game_id = ?").get(g).n;
        assert.equal(rooms.sweepChat(-1), 0, "a negative setting keeps it for ever");
        assert.equal(rooms.sweepChat(30), 1);
        assert.deepEqual([chat(live), chat(old)], [1, 0]);
        assert.equal(rooms.sweepChat(30), 0);
        // tables
        const t1 = (await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "AUS" }, "erin_e")).body.id;
        const t2 = (await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "HUN" }, "fred_f")).body.id;
        db.db.prepare("UPDATE games SET created_at = datetime('now', '-30 hours') WHERE id = ?").run(t1);
        const told = connect(server, "erin_e").then((s) => waitFor(s, "table:cancelled"));
        await wait(50);
        assert.equal(rooms.sweepTables(24), 1);
        assert.deepEqual((await api(server, "GET", "/api/tables", null, "fred_f")).body.map((t) => t.id), [t2]);
        assert.equal(db.q.game.get(t1).status, "aborted");
        assert.deepEqual(await told, { id: t1 });
    } finally {
        await server.close();
    }
});

test("the owner's tools: a password can be set, an account deleted for good, a backup taken while the server runs", async () => {
    const dbPath = tempDb();
    const server = await startServer({ dbPath });
    try {
        const db = server.app.db;
        await signIn(server, "alice");
        // a password
        assert.match((await changePassword(db, "alice", "short")).error, /a password is 6–128/);
        assert.match((await changePassword(db, "nobody", "long enough")).error, /no such user/);
        assert.equal((await changePassword(db, "alice", "a brand new one")).ok, true);
        const login = (password) => fetch(server.baseUrl + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "alice", password }) });
        assert.equal((await login("secret-pass")).status, 401);
        assert.equal((await login("a brand new one")).status, 200);

        // a backup: one file with everything in it, replaced if taken again, old ones pruned
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-backup-"));
        const stale = path.join(dir, "lorconquest-backup-2020-01-01.sqlite");
        fs.writeFileSync(stale, "old");
        fs.utimesSync(stale, new Date(2020, 0, 1), new Date(2020, 0, 1));
        const file = backup(dbPath, dir, 7, new Date("2026-10-21T03:00:00Z"));
        assert.equal(path.basename(file), "lorconquest-backup-2026-10-21.sqlite");
        assert.deepEqual(fs.readdirSync(dir), ["lorconquest-backup-2026-10-21.sqlite"]);
        const { DatabaseSync } = await import("node:sqlite");
        const copy = new DatabaseSync(file);
        assert.equal(copy.prepare("SELECT username FROM users").get().username, "alice");
        copy.close();
        assert.equal(backup(dbPath, dir, 7, new Date("2026-10-21T04:00:00Z")), file);
        fs.rmSync(dir, { recursive: true, force: true });

        // deleting: refused while a game with other people goes on; otherwise the account is emptied and its name freed
        const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "BAV" }, "alice");
        await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: "ULM" }, "bobby");
        await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, "alice");
        assert.match(planDeletion(db, "alice").error, /with other people, which are still going/);
        assert.match(planDeletion(db, "nobody").error, /no such user/);
        const solo = await newGame(server, undefined, "carol");
        const hosted = (await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "SAX" }, "carol")).body.id;
        const sock = await connect(server, "carol");
        await emitAck(sock, "join", { gameId: solo });
        await emitAck(sock, "chat", { text: "bye" });                      // (a solo game has chat too)
        const plan = planDeletion(db, "CAROL");
        assert.deepEqual([plan.user.username, plan.solo, plan.summary.tables, plan.summary.chat], ["carol", [solo], 1, 1]);
        const gone = new Promise((resolve) => sock.once("disconnect", resolve));
        const r = deleteAccount(db, "carol");
        assert.equal(r.ok, true);
        const row = db.db.prepare("SELECT username, password_hash FROM users WHERE id = ?").get(plan.user.id);
        assert.deepEqual([row.username, row.password_hash], [`deleted-${plan.user.id}`, ""]);
        assert.deepEqual([db.q.game.get(solo).status, db.q.game.get(hosted).status], ["aborted", "aborted"]);
        assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE user_id = ?").get(plan.user.id).n, 0);
        assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(plan.user.id).n, 0);
        assert.equal((await fetch(server.baseUrl + "/api/me", { headers: { Cookie: server.cookies.get("carol") } })).status, 401);
        void gone;
        assert.match(planDeletion(db, `deleted-${plan.user.id}`).error, /already been deleted/);
        // the name can be taken again, and the old account can never sign in
        assert.equal((await fetch(server.baseUrl + "/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "carol", password: "another one" }) })).status, 201);
        assert.equal((await fetch(server.baseUrl + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `deleted-${plan.user.id}`, password: "" }) })).status, 401);
    } finally {
        await server.close();
    }
});

test("a deleted player shows as 'deleted' in a replay, and keeps no name in the games others played", async () => {
    const root = quickRoot();
    const server = await startServer({ dbPath: tempDb(), root });
    try {
        const { id } = await finishedGame(server);
        assert.equal(deleteAccount(server.app.db, "bobby").ok, true);
        const r = (await api(server, "GET", `/api/games/${id}/replay`, null, "alice")).body;
        assert.deepEqual(r.humans.map((h) => h.username), ["alice", "deleted"]);
    } finally {
        await server.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("what the privacy page says is what the server does: no password or chat text in the logs, an address only when throttled", async () => {
    const lines = [];
    const server = await startServer({ dbPath: tempDb(), lines, limits: { loginMax: 2, registerMax: 10, windowMs: 60000 } });
    try {
        const post = (p, body) => fetch(server.baseUrl + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        await signIn(server, "alice", "hunter2-secret");                      // registers, and keeps the cookie for the helpers below
        await signIn(server, "bobby");
        await post("/api/login", { username: "alice", password: "wrong-secret-1" });
        await post("/api/login", { username: "hunter2-secret", password: "wrong-secret-2" });       // a password typed into the name box
        await post("/api/login", { username: "alice", password: "wrong-secret-3" });                  // throttled
        const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "BAV" }, "alice");
        await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: "ULM" }, "bobby");
        await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, "alice");
        const s = await connect(server, "alice");
        await emitAck(s, "join", { gameId: made.body.id });
        await emitAck(s, "chat", { text: "my private plan is Vienna" });
        await wait(50);
        const text = lines.join("\n");
        for (const secret of ["hunter2-secret", "wrong-secret", "my private plan", "secret-pass"]) assert.equal(text.includes(secret), false, `the logs hold "${secret}"`);
        const withAddress = lines.filter((l) => l.includes("127.0.0.1") || l.includes("::1"));
        assert.ok(withAddress.length >= 1 && withAddress.every((l) => l.includes("auth.throttled")), `only throttled requests log an address: ${withAddress.join(" | ")}`);
        // and what it promises about keeping things: chat 30 days, as the page says
        const page = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "public", "privacy.html"), "utf8");
        assert.equal(config.CHAT_RETENTION_DAYS, 30);
        assert.match(page, /deleted 30 days after the game ends/);
        // and what it says is kept in the browser: the sign-in cookie, and the colour scheme alone in local storage
        const js = path.join(import.meta.dirname, "..", "..", "public", "js");
        const storing = fs.readdirSync(js).filter((x) => /localStorage|sessionStorage|indexedDB|document\.cookie/.test(fs.readFileSync(path.join(js, x), "utf8")));
        assert.deepEqual(storing, ["theme.js"], "only theme.js keeps anything in the browser");
        assert.deepEqual([...new Set([...fs.readFileSync(path.join(js, "theme.js"), "utf8").matchAll(/"(lorconquest\.[\w.]+)"/g)].map((m) => m[1]))], ["lorconquest.scheme"]);
        assert.match(page, /light or the dark colours, in its local\s+storage/);
        assert.equal((await fetch(server.baseUrl + "/privacy.html")).status, 200);
        assert.equal((await fetch(server.baseUrl + "/terms.html")).status, 200);
    } finally {
        await server.close();
    }
});

test("behind the proxy the throttle counts the address Caddy forwards; without one it ignores the header", async () => {
    const post = (server, ip) => fetch(server.baseUrl + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ username: "nobody", password: "wrong-pass" }) });
    const behind = await startServer({ dbPath: tempDb(), trustProxy: 1, limits: { loginMax: 2, registerMax: 10, windowMs: 60000 } });
    try {
        assert.deepEqual([await post(behind, "1.1.1.1"), await post(behind, "1.1.1.1"), await post(behind, "1.1.1.1")].map((r) => r.status), [401, 401, 429]);
        assert.equal((await post(behind, "2.2.2.2")).status, 401, "another address has its own count");
    } finally {
        await behind.close();
    }
    const direct = await startServer({ dbPath: tempDb(), trustProxy: 0, limits: { loginMax: 2, registerMax: 10, windowMs: 60000 } });
    try {
        assert.deepEqual([await post(direct, "1.1.1.1"), await post(direct, "2.2.2.2"), await post(direct, "3.3.3.3")].map((r) => r.status), [401, 401, 429], "a made-up header buys no fresh count");
    } finally {
        await direct.close();
    }
});
