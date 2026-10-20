// The SQLite database, through Node's built-in node:sqlite (design.md, "Stack"): the schema, a transaction helper
// (node:sqlite has none), and every statement the server runs, prepared once. Raw SQL, no ORM.
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
    scenario TEXT NOT NULL,                     -- the scenario's id: "docs", or a folder under scenarios/
    seed INTEGER NOT NULL,
    rules_version INTEGER NOT NULL,
    human TEXT NOT NULL,                        -- the human's country (one player until milestone 6)
    status TEXT NOT NULL DEFAULT 'active',      -- active | finished
    winner TEXT,                                -- the country that won, once finished
    day INTEGER NOT NULL DEFAULT 0,             -- the last day saved
    paused INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
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
`;

export function openDb(file) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
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

    const q = {
        insertGame: db.prepare("INSERT INTO games (scenario, seed, rules_version, human) VALUES (?, ?, ?, ?)"),
        game: db.prepare("SELECT * FROM games WHERE id = ?"),
        games: db.prepare("SELECT id, scenario, human, day, status, paused, created_at, updated_at FROM games ORDER BY updated_at DESC, id DESC"),
        activeGames: db.prepare("SELECT * FROM games WHERE status = 'active' ORDER BY id"),
        finishGame: db.prepare("UPDATE games SET status = 'finished', day = ?, paused = 1, winner = ?, updated_at = datetime('now') WHERE id = ?"),
        saveProgress: db.prepare("UPDATE games SET day = ?, paused = ?, updated_at = datetime('now') WHERE id = ?"),
        insertCommand: db.prepare("INSERT INTO commands (game_id, seq, day, country, source, cmd) VALUES (?, ?, ?, ?, ?, ?)"),
        lastSeq: db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM commands WHERE game_id = ?"),
        commandsFrom: db.prepare("SELECT seq, day, country, source, cmd FROM commands WHERE game_id = ? AND day >= ? ORDER BY seq"),
        saveSnapshot: db.prepare("INSERT INTO snapshots (game_id, day, state) VALUES (?, ?, ?) ON CONFLICT (game_id) DO UPDATE SET day = excluded.day, state = excluded.state"),
        snapshot: db.prepare("SELECT day, state FROM snapshots WHERE game_id = ?"),
    };

    return { db, q, tx, addColumnIfMissing, close: () => db.close() };
}
