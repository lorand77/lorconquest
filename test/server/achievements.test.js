// Achievements (design.md, "Achievements"): what playing a finished game over finds (src/achievements/analyze.js, on the tiny
// map), and the server awarding a finished game — the record, the result, the toast, the profile's list, a game under other
// rules awarded without its replay, and an account's achievements going with it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import scenario from "../../scenarios/mitteleuropa/scenario.json" with { type: "json" };
import { Game, fingerprint } from "../../src/engine/index.js";
import { analyzeGame } from "../../src/achievements/analyze.js";
import { deleteAccount } from "../../src/accounts.js";
import { tinyScenario } from "../helpers/tiny.js";
import { api, connect, emitAck, startServer, tempDb, waitFor } from "./helpers.js";

// CCC, a human with 8,000 men at Six, takes DDD's only settlement, Seven, by storm; the log is what the server would keep
function stormSeven() {
    const sc = tinyScenario();
    sc.settlements.find((s) => s.id === 6).pop = 200000;
    sc.achievements = [
        { id: "seven", name: "Seven", icon: "7", desc: "As CCC, hold Seven in the first year.", goal: { as: ["CCC"], hold: [7], by: 1441 } },
        { id: "too-late", name: "Too Late", icon: "⌛", desc: "Hold Seven before the game begins.", goal: { hold: [7], by: 1440 } },
        { id: "gone", name: "Gone", icon: "💀", desc: "Take DDD's last settlement.", goal: { eliminate: ["DDD"] } },
        { id: "other", name: "Other", icon: "?", desc: "As AAA, hold Seven.", goal: { as: ["AAA"], hold: [7] } },
        { id: "alive", name: "Alive", icon: "♥", desc: "Survive holding Seven.", goal: { survive: true, keep: [7] } },
    ];
    const game = Game.create(sc, { seed: 1, humans: ["CCC"] });
    const log = [];
    const cmd = (c) => { const r = game.command(c); assert.ok(r.ok, r.error); log.push({ day: game.day, cmd: c }); };
    cmd({ type: "declareWar", country: "CCC", target: "DDD" });
    cmd({ type: "move", country: "CCC", army: 6, to: 7 });
    while (game.day < 40) game.advance();
    cmd({ type: "storm", country: "CCC", army: 6 });
    while (game.day < 60) game.advance();
    assert.equal(game.state.settlements[7].owner, "CCC");
    const job = { scenarioId: "tiny", scenario: sc, seed: 1, humans: ["CCC"], log, endDay: game.day, resultHash: fingerprint(game.snapshot()), seats: [{ country: "CCC", quitDay: null }] };
    return { job };
}

test("playing a game over finds what each person did: a capital and a last settlement taken, a battle, the scenario's own goals", () => {
    const { job } = stormSeven();
    const r = analyzeGame(job);
    assert.equal(r.ok, true);
    const ccc = r.seats.CCC;
    assert.equal(ccc.captures, 1);
    assert.ok(ccc.battles >= 1);
    for (const key of ["capital_punishment", "kingslayer", "tiny:seven", "tiny:gone", "tiny:alive"]) assert.ok(ccc.feats.includes(key), key);
    for (const key of ["tiny:too-late", "tiny:other", "thunder", "by_the_sword", "unbroken"]) assert.ok(!ccc.feats.includes(key), key);
    // a person who quit counts only up to that day; a log that does not end as the game did is not trusted
    assert.deepEqual(analyzeGame({ ...job, seats: [{ country: "CCC", quitDay: 10 }] }).seats.CCC.feats, []);
    assert.deepEqual([analyzeGame({ ...job, resultHash: "wrong" }).ok, analyzeGame({ ...job, resultHash: "wrong" }).error], [false, "mismatch"]);
    assert.equal(analyzeGame({ ...job, log: [{ day: 0, cmd: { type: "storm", country: "CCC", army: 6 } }] }).error, "refused");
});

// a scenario where 6 settlements win, so a game ends quickly (as in finishing.test.js)
function quickRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lc-root-"));
    fs.mkdirSync(path.join(root, "scenarios", "mitteleuropa"), { recursive: true });
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "scenario.json"), JSON.stringify({ ...scenario, victory: { settlements: 6, endYear: 1700 } }));
    fs.writeFileSync(path.join(root, "scenarios", "mitteleuropa", "SCENARIO.md"), "# SCENARIO: MITTELEUROPA\n");
    return root;
}

test("a finished game is played over and awarded: the record, the result, a toast to the person, the profile's list", async () => {
    const server = await startServer({ dbPath: tempDb(), root: quickRoot() });
    const { db, achievements } = server.app;
    try {
        const made = await api(server, "POST", "/api/tables", { scenario: "mitteleuropa", country: "BAV", seed: 5 }, "alice");
        await api(server, "POST", `/api/tables/${made.body.id}/join`, { country: "ULM" }, "bobby");
        await api(server, "POST", `/api/tables/${made.body.id}/start`, {}, "alice");
        const sa = await connect(server, "alice"), sb = await connect(server, "bobby");
        const over = waitFor(sa, "over", () => true, 30000);
        await emitAck(sa, "join", { gameId: made.body.id });
        await emitAck(sb, "join", { gameId: made.body.id });
        await over;
        await achievements.idle();
        const id = made.body.id, g = db.q.game.get(id);
        assert.equal(g.awards_version >= 1, true);
        const seats = db.db.prepare("SELECT country, captures, battles FROM game_seats WHERE game_id = ?").all(id);
        assert.ok(seats.every((s) => s.captures !== null && s.battles !== null), "the replay counted what each seat did");

        // say alice's Bavaria won (as if it had): awarded again, she has the win, Blitz, and a toast saying so
        db.db.prepare("UPDATE games SET winner = 'BAV', awards_version = 0 WHERE id = ?").run(id);
        const toast = waitFor(sa, "achievements:earned", (list) => list.some((a) => a.key === "laurels"));
        achievements.gameEnded(id);
        await achievements.idle();
        const earned = await toast;
        assert.deepEqual(earned.find((a) => a.key === "laurels"), { key: "laurels", name: "Laurels", icon: "🏆", tier: 1, tierName: null, desc: "Win a game.", upgraded: false });
        assert.ok(earned.some((a) => a.key === "blitz"));

        const mine = (await api(server, "GET", "/api/achievements", null, "alice")).body;
        assert.deepEqual(mine.groups.map((x) => x.title), ["Victory", "Conquest", "Realm", "Milestones", "Mitteleuropa"]);
        const item = (list, key) => list.groups.flatMap((x) => x.items).find((a) => a.key === key);
        assert.deepEqual([item(mine, "laurels").tier, item(mine, "laurels").gameId], [1, id]);
        assert.deepEqual([item(mine, "games_played").tier, item(mine, "games_played").progress, item(mine, "games_played").desc], [0, 1, "Finish 5 games."]);
        assert.equal(item(mine, "mitteleuropa:north-star").tier, 0);
        const theirs = (await api(server, "GET", "/api/achievements/user/ALICE", null, "bobby")).body;
        assert.equal(item(theirs, "laurels").tier, 1);
        assert.equal(item((await api(server, "GET", "/api/achievements", null, "bobby")).body, "laurels").tier, 0);
        assert.equal((await api(server, "GET", "/api/achievements/user/nobody", null, "bobby")).status, 404);

        // a game under other rules cannot be played over: awarded from its result and the record alone
        db.db.prepare("UPDATE games SET rules_version = 1, awards_version = 0 WHERE id = ?").run(id);
        achievements.gameEnded(id);
        await achievements.idle();
        assert.equal(db.q.game.get(id).awards_version >= 1, true);

        // an account deleted takes its achievements with it
        deleteAccount(db, "alice");
        assert.equal(db.db.prepare("SELECT COUNT(*) AS n FROM user_achievements WHERE user_id = (SELECT id FROM users WHERE username LIKE 'deleted-%')").get().n, 0);
    } finally {
        await server.close();
    }
});
