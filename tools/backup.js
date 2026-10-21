// A backup of the database, as one file, taken while the server runs: VACUUM INTO writes a consistent copy of everything,
// the write-ahead log included. Prints the path of the file, for scripts/backup.sh to send away, and removes copies in the
// folder older than --keep-days (7).
//
//   node tools/backup.js [folder] [--keep-days N]       folder defaults to ~/backups; the file is
//                                                       lorconquest-backup-YYYY-MM-DD.sqlite (one a day: today's is replaced)
// Restoring is in docs/setup.md.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import config from "../src/config.js";

export function backup(dbPath, folder, keepDays = 7, today = new Date()) {
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, "lorconquest-backup-" + today.toISOString().slice(0, 10) + ".sqlite");
    fs.rmSync(file, { force: true });
    const db = new DatabaseSync(dbPath);
    try {
        db.exec("VACUUM INTO '" + file.replaceAll("'", "''") + "'");
    } finally {
        db.close();
    }
    for (const name of fs.readdirSync(folder)) {
        const old = path.join(folder, name);
        if (/^lorconquest-backup-.*\.sqlite$/.test(name) && Date.now() - fs.statSync(old).mtimeMs > keepDays * 86400000) fs.rmSync(old);
    }
    return file;
}

if (import.meta.filename === process.argv[1]) {
    const args = process.argv.slice(2);
    const i = args.indexOf("--keep-days");
    const keep = i >= 0 ? Number(args.splice(i, 2)[1]) : 7;
    console.log(backup(config.DB_PATH, args[0] ?? path.join(os.homedir(), "backups"), keep));
}
