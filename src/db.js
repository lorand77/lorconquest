// The SQLite database, through Node's built-in node:sqlite (design.md, "Stack"): the schema, a transaction helper
// (node:sqlite has none), and every statement the server runs, prepared once. Raw SQL, no ORM.
//
// People: accounts (users), their sessions (the cookie's token is kept only as a hash), the seats of a game (which
// person plays which country) and the game's chat. A game starts as a table in the lobby, where people take seats, and
// the host starts it; the seats are then the game's humans, for good.
//
// A game is saved as its command log — every command applied, human or computer, with its day and place in the
// order — plus a snapshot of the whole state at the start of every game year (only the latest is kept). The log
// alone rebuilds the game from its seed; the snapshot makes a restart quick.
//
// openDb is given the file to open, so tests can use throwaway databases and restart against the same one.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY,
    scenario TEXT NOT NULL,                     -- the scenario's id: its folder under scenarios/ ("mitteleuropa", ...)
    seed INTEGER NOT NULL,
    rules_version INTEGER NOT NULL,
    human TEXT NOT NULL,                        -- the host's country; the seats (game_seats) say who plays what
    status TEXT NOT NULL DEFAULT 'active',      -- lobby (a table) | active | finished | abandoned (no person left) | aborted
    winner TEXT,                                -- the country that won, once finished
    day INTEGER NOT NULL DEFAULT 0,             -- the last day saved
    paused INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                -- scrypt (src/auth/password.js)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,                -- sha-256 of the cookie's token: a stolen database holds no live session
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS game_seats (
    game_id INTEGER NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users (id),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (game_id, country),
    UNIQUE (game_id, user_id)                   -- one country per person per game
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_game ON chat_messages (game_id, id);
CREATE TABLE IF NOT EXISTS commands (
    game_id INTEGER NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,                       -- its place in the game's log, from 1
    day INTEGER NOT NULL,                       -- the day it was applied on
    country TEXT NOT NULL,
    source TEXT NOT NULL,                       -- human | computer | caretaker (a computer playing a human's country)
    cmd TEXT NOT NULL,                          -- the command, as JSON
    PRIMARY KEY (game_id, seq)
);
CREATE TABLE IF NOT EXISTS snapshots (
    game_id INTEGER PRIMARY KEY REFERENCES games (id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    state TEXT NOT NULL
);
-- friends (src/friends/routes.js): one row a pair, a request until the one asked accepts it
CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users (id),
    addressee_id INTEGER NOT NULL REFERENCES users (id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    responded_at TEXT,
    UNIQUE (requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id);
-- achievements (src/achievements/): what each person has earned, at the highest tier reached, and the game that earned it
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INTEGER NOT NULL REFERENCES users (id),
    key TEXT NOT NULL,                          -- a key of src/achievements/catalogue.js, or "<scenario>:<id>"
    tier INTEGER NOT NULL DEFAULT 1,
    earned_at TEXT NOT NULL,                    -- when the game that earned it (this tier) ended
    game_id INTEGER REFERENCES games (id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, key)
);
`;

export function openDb(file) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    // a second writer (tools/user.js, a backup's checkpoint) makes a save wait, not fail and take every game down
    const db = new DatabaseSync(file, { timeout: 5000 });
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.exec(SCHEMA);

    // run `fn` in one transaction: all of it is written, or none
    const tx = (fn) => {
        db.exec("BEGIN");
        try {
            const result = fn();
            db.exec("COMMIT");
            return result;
        } catch (err) {
            db.exec("ROLLBACK");
            throw err;
        }
    };

    // CREATEs cannot add a column to an existing table: migrations do it here, so an older database picks the
    // column up on the next boot (LorCiv's pattern).
    const addColumnIfMissing = (table, column, definition) => {
        if (db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)) return false;
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        return true;
    };

    // a column added since the first databases
    addColumnIfMissing("games", "winner", "TEXT");
    addColumnIfMissing("games", "host_id", "INTEGER REFERENCES users (id)");
    // how a game ended: the fingerprint of its final state (src/engine/hash.js), and each seat's standing (src/game/results.js)
    addColumnIfMissing("games", "result_hash", "TEXT");
    addColumnIfMissing("game_seats", "place", "INTEGER");
    addColumnIfMissing("game_seats", "settlements", "REAL");
    addColumnIfMissing("game_seats", "pop", "REAL");
    addColumnIfMissing("game_seats", "quit_day", "INTEGER");
    addColumnIfMissing("game_seats", "out_day", "INTEGER");                          // the day its country was eliminated
    // achievements (src/achievements/service.js): which version of the awarding a finished game has had, and what each seat
    // did in it (from playing it over; null when it could not be)
    addColumnIfMissing("games", "awards_version", "INTEGER NOT NULL DEFAULT 0");
    addColumnIfMissing("game_seats", "captures", "INTEGER");
    addColumnIfMissing("game_seats", "battles", "INTEGER");
    // the default scenario lived in docs/ and had the id "docs" until it moved to scenarios/mitteleuropa
    db.exec("UPDATE games SET scenario = 'mitteleuropa' WHERE scenario = 'docs'");
    // games from before accounts (the development page's) have no host and no seats: nobody can open them now
    db.exec("UPDATE games SET status = 'aborted' WHERE host_id IS NULL AND status IN ('active', 'lobby')");

    const q = {
        insertUser: db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)"),
        userByName: db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?"),
        userByNameNoCase: db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE"),
        userById: db.prepare("SELECT id, username, created_at FROM users WHERE id = ?"),
        insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
        sessionUser: db.prepare("SELECT u.id, u.username, u.created_at AS joined FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"),
        deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
        // what an account deletion needs (src/accounts.js)
        userByNameLoose: db.prepare("SELECT id, username, created_at FROM users WHERE username = ? COLLATE NOCASE"),
        setPassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
        activeSeatsOf: db.prepare("SELECT g.id, (SELECT COUNT(*) FROM game_seats WHERE game_id = g.id) AS seated FROM games g JOIN game_seats s ON s.game_id = g.id WHERE s.user_id = ? AND g.status = 'active'"),
        tablesHostedBy: db.prepare("SELECT id FROM games WHERE status = 'lobby' AND host_id = ?"),
        releaseLobbySeats: db.prepare("DELETE FROM game_seats WHERE user_id = ? AND game_id IN (SELECT id FROM games WHERE status = 'lobby')"),
        deleteChatOf: db.prepare("DELETE FROM chat_messages WHERE user_id = ?"),
        // friendships (src/friends/routes.js): the row between two people, whichever asked
        findFriendship: db.prepare("SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)"),
        friendshipById: db.prepare("SELECT * FROM friendships WHERE id = ?"),
        createFriendRequest: db.prepare("INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)"),
        acceptFriendRequest: db.prepare("UPDATE friendships SET status = 'accepted', responded_at = datetime('now') WHERE id = ? AND status = 'pending'"),
        deleteFriendship: db.prepare("DELETE FROM friendships WHERE id = ?"),
        deleteFriendshipsOf: db.prepare("DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?"),
        // every friendship and request of a person, with the other: friends first, then by name; a deleted account left out
        friendshipsOf: db.prepare(`SELECT f.id, f.status, f.created_at, f.responded_at, f.requester_id, f.addressee_id, u.username AS other
            FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
            WHERE (f.requester_id = ? OR f.addressee_id = ?) AND u.username NOT LIKE 'deleted-%'
            ORDER BY f.status = 'accepted' DESC, u.username COLLATE NOCASE`),
        deleteSessionsOf: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
        scrubUser: db.prepare("UPDATE users SET username = 'deleted-' || id, password_hash = '' WHERE id = ?"),
        deletionSummary: db.prepare(`SELECT
                (SELECT COUNT(*) FROM game_seats s JOIN games g ON g.id = s.game_id WHERE s.user_id = ?1 AND g.status IN ('finished', 'abandoned')) AS games,
                (SELECT COUNT(*) FROM games WHERE status = 'lobby' AND host_id = ?1) AS tables,
                (SELECT COUNT(*) FROM chat_messages WHERE user_id = ?1) AS chat`),
        deleteExpiredSessions: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),

        insertGame: db.prepare("INSERT INTO games (scenario, seed, rules_version, human, status, host_id) VALUES (?, ?, ?, ?, ?, ?)"),
        game: db.prepare("SELECT * FROM games WHERE id = ?"),
        // the tables waiting for people, each with its host's name and how many seats are taken
        tables: db.prepare(`SELECT g.id, g.scenario, g.host_id, h.username AS host, g.created_at,
                (SELECT COUNT(*) FROM game_seats WHERE game_id = g.id) AS seated
            FROM games g JOIN users h ON h.id = g.host_id WHERE g.status = 'lobby' ORDER BY g.id DESC`),
        // every game a person has a seat in
        gamesOf: db.prepare(`SELECT g.id, g.scenario, g.status, g.winner, g.day, g.paused, g.host_id, s.country, g.updated_at,
                (SELECT COUNT(*) FROM game_seats WHERE game_id = g.id) AS seated
            FROM games g JOIN game_seats s ON s.game_id = g.id WHERE s.user_id = ? AND g.status != 'aborted' ORDER BY g.updated_at DESC, g.id DESC`),
        activeGames: db.prepare("SELECT * FROM games WHERE status = 'active' ORDER BY id"),
        setStatus: db.prepare("UPDATE games SET status = ?, updated_at = datetime('now') WHERE id = ?"),
        finishGame: db.prepare("UPDATE games SET status = 'finished', day = ?, paused = 1, winner = ?, result_hash = ?, updated_at = datetime('now') WHERE id = ?"),
        setResult: db.prepare("UPDATE game_seats SET place = ?, settlements = ?, pop = ? WHERE game_id = ? AND country = ?"),
        markQuit: db.prepare("UPDATE game_seats SET quit_day = ? WHERE game_id = ? AND user_id = ?"),
        seatQuits: db.prepare("SELECT country, quit_day, out_day FROM game_seats WHERE game_id = ?"),
        markOut: db.prepare("UPDATE game_seats SET out_day = ? WHERE game_id = ? AND country = ?"),
        // the leaderboard: every account, with what it did over the finished games it played (none for one that has finished
        // none). A game counts for "firsts" and the average place only with two or more people in it; a "victory" is their
        // country winning the whole game while they still played it (one who quit and left it to the computer has no victory).
        leaderboard: db.prepare(`SELECT u.username,
                COUNT(f.game_id) AS games,
                COALESCE(SUM(f.many), 0) AS shared,
                COALESCE(SUM(f.many AND f.place = 1), 0) AS firsts,
                COALESCE(SUM(CASE WHEN f.many THEN f.place ELSE 0 END), 0) AS place_sum,
                COALESCE(SUM(f.won), 0) AS victories
            FROM users u LEFT JOIN (
                SELECT s.user_id, s.game_id, s.place, (SELECT COUNT(*) FROM game_seats x WHERE x.game_id = g.id) > 1 AS many, g.winner = s.country AND s.quit_day IS NULL AS won
                FROM game_seats s JOIN games g ON g.id = s.game_id
                WHERE g.status = 'finished' AND s.place IS NOT NULL
            ) f ON f.user_id = u.id
            WHERE u.username NOT LIKE 'deleted-%'
            GROUP BY u.id`),
        replayGame: db.prepare("SELECT id, scenario, seed, rules_version, status, winner, day, result_hash FROM games WHERE id = ?"),
        allCommands: db.prepare("SELECT day, country, source, cmd FROM commands WHERE game_id = ? ORDER BY seq"),
        // chat of games that ended (or never began) more than N days ago
        deleteOldChat: db.prepare("DELETE FROM chat_messages WHERE game_id IN (SELECT id FROM games WHERE status IN ('finished', 'abandoned', 'aborted') AND updated_at < datetime('now', ?))"),
        // tables that have waited longer than this
        staleTables: db.prepare("SELECT id FROM games WHERE status = 'lobby' AND created_at < datetime('now', ?)"),
        abandonGame: db.prepare("UPDATE games SET status = 'abandoned', day = ?, paused = 1, updated_at = datetime('now') WHERE id = ?"),
        saveProgress: db.prepare("UPDATE games SET day = ?, paused = ?, updated_at = datetime('now') WHERE id = ? AND status = 'active'"),          // a game over keeps when it ended

        insertSeat: db.prepare("INSERT INTO game_seats (game_id, country, user_id) VALUES (?, ?, ?)"),
        deleteSeat: db.prepare("DELETE FROM game_seats WHERE game_id = ? AND user_id = ?"),
        seats: db.prepare("SELECT s.country, s.user_id, u.username FROM game_seats s JOIN users u ON u.id = s.user_id WHERE s.game_id = ? ORDER BY s.joined_at, s.rowid"),
        seatOfUser: db.prepare("SELECT country FROM game_seats WHERE game_id = ? AND user_id = ?"),

        insertChat: db.prepare("INSERT INTO chat_messages (game_id, user_id, text) VALUES (?, ?, ?)"),
        chatById: db.prepare("SELECT m.id, m.user_id, u.username, m.text, m.created_at FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?"),
        chatOf: db.prepare("SELECT m.id, m.user_id, u.username, m.text, m.created_at FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.game_id = ? ORDER BY m.id DESC LIMIT ?"),

        insertCommand: db.prepare("INSERT INTO commands (game_id, seq, day, country, source, cmd) VALUES (?, ?, ?, ?, ?, ?)"),
        lastSeq: db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM commands WHERE game_id = ?"),
        commandsFrom: db.prepare("SELECT seq, day, country, source, cmd FROM commands WHERE game_id = ? AND day >= ? ORDER BY seq"),
        saveSnapshot: db.prepare("INSERT INTO snapshots (game_id, day, state) VALUES (?, ?, ?) ON CONFLICT (game_id) DO UPDATE SET day = excluded.day, state = excluded.state"),
        snapshot: db.prepare("SELECT day, state FROM snapshots WHERE game_id = ?"),

        // achievements (src/achievements/service.js)
        unawardedGames: db.prepare("SELECT id FROM games WHERE status = 'finished' AND awards_version < ? ORDER BY updated_at, id"),
        markAwarded: db.prepare("UPDATE games SET awards_version = ? WHERE id = ?"),
        awardSeats: db.prepare(`SELECT s.country, s.user_id, u.username, s.place, s.quit_day, (SELECT COUNT(*) FROM game_seats x WHERE x.game_id = s.game_id) AS people
            FROM game_seats s JOIN users u ON u.id = s.user_id WHERE s.game_id = ? AND s.place IS NOT NULL AND u.username NOT LIKE 'deleted-%'`),
        setSeatFeats: db.prepare("UPDATE game_seats SET captures = ?, battles = ? WHERE game_id = ? AND country = ?"),
        // a person's finished games in the order they ended, up to one (or all, with null): what the record counts
        achievementRecord: db.prepare(`SELECT g.id, g.winner = s.country AND s.quit_day IS NULL AS won, COALESCE(s.captures, 0) AS captures, COALESCE(s.battles, 0) AS battles
            FROM game_seats s JOIN games g ON g.id = s.game_id
            WHERE s.user_id = :userId AND g.status = 'finished' AND s.place IS NOT NULL AND g.awards_version > 0
              AND (:gameId IS NULL OR g.updated_at < :at OR (g.updated_at = :at AND g.id <= :gameId))
            ORDER BY g.updated_at, g.id`),
        userAchievement: db.prepare("SELECT tier FROM user_achievements WHERE user_id = ? AND key = ?"),
        // only ever raises a tier
        awardAchievement: db.prepare(`INSERT INTO user_achievements (user_id, key, tier, earned_at, game_id) VALUES (:userId, :key, :tier, :at, :gameId)
            ON CONFLICT (user_id, key) DO UPDATE SET tier = excluded.tier, earned_at = excluded.earned_at, game_id = excluded.game_id WHERE excluded.tier > user_achievements.tier`),
        achievementsOf: db.prepare("SELECT key, tier, earned_at, game_id FROM user_achievements WHERE user_id = ? ORDER BY earned_at, key"),
        deleteAchievementsOf: db.prepare("DELETE FROM user_achievements WHERE user_id = ?"),
    };

    return { db, q, tx, addColumnIfMissing, close: () => db.close() };
}
