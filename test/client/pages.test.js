// The pages and what they use of the lobby's logic. There is no browser in the development container, so these check what
// can be checked without one: the logic in lobbylogic.js, and that each page and its script agree — every element a script
// looks for is in the page, every import resolves, and no page breaks the content security policy.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DIR, formatCountdown, freeCountries, gameLine, presenceText, sortBoard, statsOf, tableActions } from "../../public/js/lobbylogic.js";

const publicDir = path.join(import.meta.dirname, "..", "..", "public");
const read = (f) => fs.readFileSync(path.join(publicDir, f), "utf8");

test("the setup clock reads minutes and seconds, and never goes below zero", () => {
    assert.deepEqual([60000, 65000, 59001, 1, 0, -500].map(formatCountdown), ["1:00", "1:05", "1:00", "0:01", "0:00", "0:00"]);
});

test("a seat is shown as here, away (with who plays for the player), or gone", () => {
    assert.deepEqual(["present", "away", "full", "quit", "whatever"].map(presenceText),
        ["here", "away — a caretaker defends", "away — the computer plays", "has left", "not here"]);
});

const scenario = { countries: [{ code: "BAV", name: "Bavaria" }, { code: "ULM", name: "Ulm" }, { code: "AUS", name: "Austria" }, { code: "SAX", name: "Saxony" }, { code: "BOH", name: "Bohemia" }] };
const table = (seats, hostId = 1) => ({ id: 7, hostId, host: "alice", seats });

test("a table offers the free countries by name, and the buttons that suit who is looking", () => {
    const t = table([{ country: "BAV", username: "alice" }, { country: "ULM", username: "bobby" }]);
    assert.deepEqual(freeCountries(scenario, t).map((c) => c.code), ["AUS", "BOH", "SAX"]);
    const host = tableActions(t, { id: 1, username: "alice" }, scenario);
    assert.deepEqual([host.host, host.canJoin, host.canLeave, host.canStart, host.canCancel, host.computerCountries], [true, false, false, true, true, 3]);
    const guest = tableActions(t, { id: 2, username: "bobby" }, scenario);
    assert.deepEqual([guest.host, guest.canJoin, guest.canLeave, guest.canStart, guest.canCancel], [false, false, true, false, false]);
    const stranger = tableActions(t, { id: 3, username: "carol" }, scenario);
    assert.deepEqual([stranger.canJoin, stranger.canLeave, stranger.canStart, stranger.free.length], [true, false, false, 3]);
    // a full table, or one with nothing left to take, offers no seat
    const full = table(["BAV", "ULM", "AUS", "SAX"].map((country, i) => ({ country, username: `p${i}` })));
    assert.equal(tableActions(full, { id: 9, username: "carol" }, scenario).canJoin, false);
});

test("a game's line says where it stands: one going can be opened (even if the server let it go from memory), one over is watched", () => {
    const g = { id: 1, status: "active", live: true, people: 1 };
    assert.deepEqual(gameLine(g, "Mitteleuropa", "Bavaria", "1 January 1441"), { text: "Mitteleuropa, Bavaria, 1 January 1441", open: true, replay: false });
    assert.deepEqual(gameLine({ ...g, people: 3, live: false }, "Mitteleuropa", "Bavaria", "d"), { text: "Mitteleuropa, Bavaria, 3 people, d", open: true, replay: false });
    const won = gameLine({ ...g, status: "finished", winner: "AUS" }, "M", "B", "d");
    assert.match(won.text, /won by AUS/);                                                  // the code, when no name is given
    assert.match(gameLine({ status: "finished", winner: "AUS", people: 1 }, "Mitteleuropa", "Bavaria", "1 January 1500", "Austria").text, /won by Austria$/);
    assert.deepEqual([won.open, won.replay], [false, true]);
    const gone = gameLine({ ...g, status: "abandoned" }, "M", "B", "d");
    assert.match(gone.text, /abandoned/);
    assert.deepEqual([gone.open, gone.replay], [false, true]);
});

// each page with the script that drives it
const PAGES = [["login.html", "login.js"], ["index.html", "lobby.js"], ["game.html", "game.js"], ["replay.html", "replay.js"], ["leaderboard.html", "leaderboard.js"],
    ["profile.html", "profile.js"], ["customize.html", "customize.js"]];

test("every element a page's script looks for is in the page", () => {
    for (const [html, script] of PAGES) {
        const page = read(html), code = read(`js/${script}`);
        const ids = new Set([...page.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));
        for (const m of code.matchAll(/\$\("([\w-]+)"\)/g)) assert.ok(ids.has(m[1]), `${script} uses #${m[1]}, which ${html} does not have`);
    }
});

test("every import in the pages' scripts resolves, to a file of ours or the engine", () => {
    for (const file of fs.readdirSync(path.join(publicDir, "js"))) {
        for (const m of read(`js/${file}`).matchAll(/from "([^"]+)"/g)) {
            const target = m[1];
            const found = target.startsWith("/engine/") ? fs.existsSync(path.join(publicDir, "..", "src", target))
                : fs.existsSync(path.join(publicDir, "js", target));
            assert.ok(found, `${file} imports ${target}`);
        }
    }
    for (const [html, script] of PAGES) assert.match(read(html), new RegExp(`src="/js/${script}"`), `${html} loads ${script}`);
});

test("no page has an inline script, an inline handler or a javascript: link: the policy allows scripts only from files", () => {
    for (const f of fs.readdirSync(publicDir).filter((x) => x.endsWith(".html"))) {
        const page = read(f);
        assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/i, `${f} has an inline script`);
        assert.doesNotMatch(page, /\son\w+\s*=/i, `${f} has an inline handler`);
        assert.doesNotMatch(page, /javascript:/i, `${f} has a javascript: URL`);
    }
});

test("My Profile's stats: games played, going, finished and won, alone or with people, and the places from the leaderboard", () => {
    const games = [
        { status: "finished", country: "BAV", winner: "BAV", people: 1 },
        { status: "finished", country: "SAX", winner: "AUS", people: 3 },
        { status: "finished", country: "BRB", winner: "BRB", people: 2 },
        { status: "active", country: "BAV", winner: null, people: 1 },
        { status: "abandoned", country: "HUN", winner: null, people: 2 },
        { status: "lobby", country: "POL", winner: null, people: 2 },               // a room not started: no game yet
    ];
    assert.deepEqual(statsOf(games, { firsts: 1, averagePlace: 1.5 }),
        { games: 5, going: 1, finished: 3, abandoned: 1, won: 2, winRate: 67, alone: 2, withOthers: 3, firsts: 1, averagePlace: 1.5 });
    assert.deepEqual(statsOf([]), { games: 0, going: 0, finished: 0, abandoned: 0, won: 0, winRate: null, alone: 0, withOthers: 0, firsts: 0, averagePlace: null });
});

test("every signed-in page but the game and the replay has the shell; the rail lists Play, My Profile, Stats, My Games, Customize, Leaderboard", () => {
    for (const [html, script] of [["index.html", "lobby.js"], ["profile.html", "profile.js"], ["customize.html", "customize.js"], ["leaderboard.html", "leaderboard.js"]]) {
        assert.match(read(html), /<body class="shell">/, `${html} reserves the room for the shell`);
        assert.match(read(`js/${script}`), /mountShell\(/, `${script} builds the shell`);
    }
    const shell = read("js/shell.js");
    assert.deepEqual([...shell.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Play", "My Profile", "Stats", "My Games", "Achievements", "Friends", "Customize", "Leaderboard"]);
});

test("the leaderboard sorts by any column, either way; each row keeps its rank, and no average place comes last", () => {
    const rows = [   // as the server ranks them
        { username: "ann", games: 5, shared: 3, firsts: 2, averagePlace: 1.5, victories: 1 },
        { username: "Bob", games: 9, shared: 2, firsts: 1, averagePlace: 2, victories: 3 },
        { username: "cid", games: 2, shared: 0, firsts: 0, averagePlace: null, victories: 0 },
        { username: "dee", games: 0, shared: 0, firsts: 0, averagePlace: null, victories: 0 },
    ];
    const names = (key, dir) => sortBoard(rows, key, dir).map((r) => r.username);
    assert.deepEqual(names("rank"), ["ann", "Bob", "cid", "dee"]);
    assert.deepEqual(sortBoard(rows, "games").map((r) => [r.username, r.rank]), [["Bob", 2], ["ann", 1], ["cid", 3], ["dee", 4]]);   // most first, rank kept
    assert.deepEqual(names("games", "asc"), ["dee", "cid", "ann", "Bob"]);
    assert.deepEqual(names("victories"), ["Bob", "ann", "cid", "dee"]);
    assert.deepEqual(names("averagePlace"), ["ann", "Bob", "cid", "dee"]);                  // the best first; none last
    assert.deepEqual(names("averagePlace", "desc"), ["Bob", "ann", "cid", "dee"]);          // still last the other way
    assert.deepEqual(names("username"), ["ann", "Bob", "cid", "dee"]);                      // A to Z, whatever the case
    assert.deepEqual(names("username", "desc"), ["dee", "cid", "Bob", "ann"]);
    assert.deepEqual([DEFAULT_DIR.games, DEFAULT_DIR.averagePlace, DEFAULT_DIR.username], ["desc", "asc", "asc"]);
});

test("an achievement's card: greyed while locked, how far along the next tier, gold-edged at the top, with when and the replay", async () => {
    const { card, tierLine } = await import("../../public/js/achievements.js");
    const tiered = { key: "wins", name: "Victorious", icon: "🏅", tiers: [3, 10, 50], max: 3, desc: "Win 10 games." };
    assert.equal(tierLine({ ...tiered, tier: 0, tierName: null, progress: 2 }), "2 / 3");
    assert.equal(tierLine({ ...tiered, tier: 1, tierName: "Bronze", progress: 4 }), "Bronze · 4 / 10");
    assert.equal(tierLine({ ...tiered, tier: 3, tierName: "Gold", progress: 60 }), "Gold");
    assert.equal(tierLine({ key: "laurels", tiers: null, tier: 1, max: 1 }), null);
    const make = (tag, props = {}, ...children) => ({ tag, props, children });
    const text = (n) => (typeof n === "string" ? n : n.children.map(text).join(""));
    const locked = card(make, { key: "laurels", name: "Laurels", icon: "🏆", tier: 0, max: 1, desc: "Win a game.", tiers: null, earnedAt: null, gameId: null });
    assert.equal(locked.props.class, "ach-card locked");
    const won = card(make, { key: "laurels", name: "Laurels", icon: "🏆", tier: 1, max: 1, desc: "Win a game.", tiers: null, earnedAt: "2026-10-26 12:00:00", gameId: 7 });
    assert.equal(won.props.class, "ach-card maxed");
    assert.match(text(won), /Earned 26 October 2026 · replay/);
});

test("every page's make() leaves out an attribute given as undefined, null or false: disabled=\"undefined\" would still disable", () => {
    const js = path.join(import.meta.dirname, "..", "..", "public", "js");
    for (const file of fs.readdirSync(js).filter((f) => f.endsWith(".js"))) {
        const src = fs.readFileSync(path.join(js, file), "utf8");
        if (!/const make = \(tag, props/.test(src)) continue;
        assert.match(src, /else if \(v !== undefined && v !== null && v !== false\) e\.setAttribute\(k, v\);/, `${file}'s make() sets every attribute it is given`);
    }
});
