// The pages and what they use of the lobby's logic. There is no browser in the development container, so these check what
// can be checked without one: the logic in lobbylogic.js, and that each page and its script agree — every element a script
// looks for is in the page, every import resolves, and no page breaks the content security policy.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatCountdown, freeCountries, gameLine, presenceText, tableActions } from "../../public/js/lobbylogic.js";

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
    assert.match(won.text, /won by AUS/);
    assert.deepEqual([won.open, won.replay], [false, true]);
    const gone = gameLine({ ...g, status: "abandoned" }, "M", "B", "d");
    assert.match(gone.text, /abandoned/);
    assert.deepEqual([gone.open, gone.replay], [false, true]);
});

// each page with the script that drives it
const PAGES = [["login.html", "login.js"], ["index.html", "lobby.js"], ["game.html", "game.js"], ["replay.html", "replay.js"], ["leaderboard.html", "leaderboard.js"]];

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
