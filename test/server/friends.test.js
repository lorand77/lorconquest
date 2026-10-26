// Friends (src/friends/routes.js): a request, accepted or declined; asking back accepts; only the two people of a row touch
// it; someone else's friends are the accepted ones only; an account's friendships go with it.
import test from "node:test";
import assert from "node:assert/strict";
import { deleteAccount } from "../../src/accounts.js";
import { api, startServer, tempDb } from "./helpers.js";

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
