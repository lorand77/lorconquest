// Accounts, by hand, on the server (docs/setup.md): set a password, or delete an account for good. Safe to run while the
// server is up (the database is in WAL mode). The password is never an argument, so it is not in shell history or `ps`: it
// is typed twice with echo off, or, with no terminal, the first line of stdin.
//
//   node tools/user.js password <name>
//   node tools/user.js delete <name>        shows what it will do and asks for the name to be typed back; no undo
import readline from "node:readline";
import config from "../src/config.js";
import { openDb } from "../src/db.js";
import { MAX_PASSWORD, MIN_PASSWORD, changePassword, deleteAccount, planDeletion } from "../src/accounts.js";

function usage(message) {
    if (message) console.error("error:", message);
    console.error("usage: node tools/user.js password <name> | delete <name>");
    process.exit(2);
}

function ask(question, { hidden = false } = {}) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        let muted = false;
        if (hidden) rl._writeToOutput = (s) => { if (!muted) process.stdout.write(s); };
        rl.question(question, (answer) => { muted = false; if (hidden) process.stdout.write("\n"); rl.close(); resolve(hidden ? answer : answer.trim()); });
        muted = hidden;
        rl.on("close", () => resolve(""));          // stdin ended with no answer
    });
}

async function readPassword() {
    if (!process.stdin.isTTY) {
        let data = "";
        process.stdin.setEncoding("utf8");
        for await (const chunk of process.stdin) data += chunk;
        return data.split(/\r?\n/)[0];
    }
    const first = await ask("New password: ", { hidden: true }), second = await ask("Repeat password: ", { hidden: true });
    if (first !== second) usage("the passwords do not match");
    return first;
}

const [command, name] = process.argv.slice(2);
if (!["password", "delete"].includes(command) || !name) usage();
const db = openDb(config.DB_PATH);

if (command === "password") {
    const password = await readPassword();
    const r = await changePassword(db, name, password);
    if (r.error) { console.error("error:", r.error.replace(/a password is .*/, "a password is " + MIN_PASSWORD + "–" + MAX_PASSWORD + " characters")); process.exit(1); }
    console.log("password updated for " + r.user.username + " (id " + r.user.id + ") in " + config.DB_PATH + "; its sessions stay signed in");
} else {
    const plan = planDeletion(db, name);
    if (plan.error) { console.error("error:", plan.error); process.exit(1); }
    const { user, summary, solo } = plan;
    console.log(user.username + " (id " + user.id + "), joined " + user.created_at.slice(0, 10));
    console.log("  kept, without the name: " + summary.games + " finished or abandoned game(s)");
    console.log("  put away: " + solo.length + " single-player game(s) still going; cancelled: " + summary.tables + " table(s) hosted");
    console.log("  deleted: " + summary.chat + " chat message(s), every session, and the seats at tables");
    console.log("The account becomes deleted-" + user.id + " and the name " + user.username + " is freed. There is no undo.");
    if (await ask("Type " + user.username + " to delete it: ") !== user.username) { console.log("not confirmed; nothing deleted"); process.exit(1); }
    const r = deleteAccount(db, name);
    if (r.error) { console.error("error:", r.error); process.exit(1); }
    console.log("deleted " + user.username + ": now deleted-" + user.id + " in " + config.DB_PATH);
}
db.close();
