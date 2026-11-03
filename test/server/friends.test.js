// Friends (src/friends/routes.js): a request, accepted or declined; asking back accepts; only the two people of a row touch
// it; someone else's friends are the accepted ones only; an account's friendships go with it.
import test from "node:test";
import assert from "node:assert/strict";
import { deleteAccount } from "../../src/accounts.js";
import { api, connect, emitAck, startServer, tempDb } from "./helpers.js";

test("friends: asked and accepted, asked back, declined, withdrawn, ended; seen only by the two, and gone with an account", async () => {
    const server = await startServer({ dbPath: tempDb() });
    try {
        for (const u of ["alice", "bobby", "carol"]) await api(server, "GET", "/api/me", null, u);   // the three accounts
        const ask = await api(server, "POST", "/api/friends/requests", { username: "Bobby" }, "alice");   // any case
        assert.deepEqual([ask.status, ask.body.status], [201, "pending"]);
        assert.equal((await api(server, "POST", "/api/friends/requests", { username: "bobby" }, "alice")).status, 409);   // asked already
        assert.equal((await api(server, "POST", "/api/friends/requests", { username: "alice" }, "alice")).status, 400);
        assert.equal((await api(server, "POST", "/api/friends/requests", { username: "nobody" }, "alice")).status, 404);
        // bobby sees it to answer, alice as sent; carol may not touch it
        const bob = (await api(server, "GET", "/api/friends", null, "bobby")).body;
        assert.deepEqual([bob.incoming.map((r) => r.username), bob.friends.length], [["alice"], 0]);
        assert.deepEqual((await api(server, "GET", "/api/friends", null, "alice")).body.outgoing.map((r) => r.username), ["bobby"]);
        assert.equal((await api(server, "POST", `/api/friends/requests/${ask.body.id}/accept`, null, "carol")).status, 404);
        assert.equal((await api(server, "POST", `/api/friends/requests/${ask.body.id}/accept`, null, "alice")).status, 409);   // not hers to accept
        assert.equal((await api(server, "POST", `/api/friends/requests/${ask.body.id}/accept`, null, "bobby")).status, 200);
        assert.deepEqual((await api(server, "GET", "/api/friends", null, "alice")).body.friends.map((f) => f.username), ["bobby"]);
        // carol asks alice; alice asking carol back accepts it
        await api(server, "POST", "/api/friends/requests", { username: "alice" }, "carol");
        const back = await api(server, "POST", "/api/friends/requests", { username: "carol" }, "alice");
        assert.equal(back.body.status, "accepted");
        // anyone sees alice's friends, never her requests
        assert.deepEqual((await api(server, "GET", "/api/friends/user/alice", null, "bobby")).body.friends.map((f) => f.username), ["bobby", "carol"]);
        // ended by either; an account deleted takes its friendships with it
        assert.equal((await api(server, "DELETE", `/api/friends/${back.body.id}`, null, "carol")).status, 200);
        assert.equal(deleteAccount(server.app.db, "bobby").ok, true);
        assert.deepEqual((await api(server, "GET", "/api/friends", null, "alice")).body, { friends: [], incoming: [], outgoing: [] });
        assert.equal((await api(server, "GET", "/api/friends", null, null)).status, 401);
    } finally {
        await server.close();
    }
});

test("a room for the host's friends: only they see it, take a seat and watch its game; anyone else is refused, and the replay stays public", async () => {
    const server = await startServer({ dbPath: tempDb(), setupMs: 0 });
    try {
        // alice and bobby are friends; carol is not
        for (const who of ["alice", "bobby", "carol"]) await api(server, "GET", "/api/me", null, who);
        await api(server, "POST", "/api/friends/requests", { username: "bobby" }, "alice");
        const asked = (await api(server, "GET", "/api/friends", null, "bobby")).body.incoming[0];
        await api(server, "POST", `/api/friends/requests/${asked.id}/accept`, {}, "bobby");
        const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "BAV", seed: 5, visibility: "friends" }, "alice");
        assert.equal(made.status, 201);
        const tables = async (who) => (await api(server, "GET", "/api/tables", null, who)).body.map((t) => t.id);
        assert.deepEqual([await tables("alice"), await tables("bobby"), await tables("carol")], [[made.body.id], [made.body.id], []]);
        assert.match((await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: "SAX" }, "carol")).body.error, /host's friends/);
        assert.equal((await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: "ULM" }, "bobby")).status, 200);
        assert.match((await api(server, "POST", `/api/tables/${made.body.id}/visibility`, { visibility: "public" }, "bobby")).body.error, /only the host/);
        // started: in the live games and watchable for the friends, not for carol
        await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, "alice");
        const live = async (who) => (await api(server, "GET", "/api/live", null, who)).body.map((g) => g.id);
        assert.deepEqual([await live("bobby"), await live("carol")], [[made.body.id], []]);
        const c = await connect(server, "carol");
        assert.match((await emitAck(c, "watch", { gameId: made.body.id })).error, /host's friends/);
        // a public room, made friends-only by its host while it waits, disappears for carol
        const open = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "AUS", seed: 6 }, "bobby");
        assert.ok((await tables("carol")).includes(open.body.id));
        await api(server, "POST", `/api/tables/${open.body.id}/visibility`, { visibility: "friends" }, "bobby");
        assert.ok(!(await tables("carol")).includes(open.body.id));
    } finally {
        await server.close();
    }
});
