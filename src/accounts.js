// What the owner does to accounts by hand (tools/user.js): setting a password, and deleting an account for good, as the
// privacy page promises on request. There is no self-service reset or delete button.
//
// A deleted account's row cannot simply go: seats point at it, and a finished game is the other players' record too. So the
// row stays, emptied and renamed deleted-<id>: it can never sign in (an empty hash verifies nothing), shows on no
// leaderboard and as "deleted" in a replay, and the old name can be registered again. Its chat, sessions, friendships and achievements are deleted,
// tables it hosts are cancelled, seats it holds at tables are released, and its single-player games are put away. A game
// with other people still going stops the deletion: they would lose a player in the middle of it.
import { hashPassword } from "./auth/password.js";

export const MIN_PASSWORD = 6, MAX_PASSWORD = 128;

export async function changePassword(db, username, password) {
    const user = db.q.userByName.get(username);
    if (!user) return { error: "no such user: " + username };
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return { error: "a password is " + MIN_PASSWORD + "–" + MAX_PASSWORD + " characters" };
    db.q.setPassword.run(await hashPassword(password), user.id);
    return { ok: true, user };
}

// what deleting would remove, or why it cannot be done
export function planDeletion(db, username) {
    if (/^deleted-\d+$/.test(username)) return { error: username + " has already been deleted" };
    const user = db.q.userByNameLoose.get(username);
    if (!user) return { error: "no such user: " + username };
    const going = db.q.activeSeatsOf.all(user.id);
    const shared = going.filter((g) => g.seated > 1);
    if (shared.length) return { error: user.username + " is in game(s) " + shared.map((g) => "#" + g.id).join(", ") + " with other people, which are still going; nothing deleted (deactivate the account now, and delete it once they are over)" };
    return { user, solo: going.map((g) => g.id), summary: db.q.deletionSummary.get(user.id) };
}

// take an account out of the site, or bring it back. Deactivated, it cannot sign in, its sessions end (the server closes its
// open sockets within half a minute: socket.js), and it is shown nowhere — not on the leaderboard, in friends lists, as a
// profile or online; the tables it hosts are cancelled and its seats at others' released. Nothing else changes: its games,
// friendships and achievements stay, and come back with it. In a game with others going on, the computer plays its country
// as for anyone away.
export function deactivateAccount(db, username) {
    const user = db.q.userByNameLoose.get(username);
    if (!user || /^deleted-\d+$/.test(user.username)) return { error: "no such user: " + username };
    if (user.deactivated_at) return { error: user.username + " is deactivated already" };
    db.tx(() => {
        db.q.deactivateUser.run(user.id);
        db.q.deleteSessionsOf.run(user.id);
        for (const { id } of db.q.tablesHostedBy.all(user.id)) db.q.setStatus.run("aborted", id);
        db.q.releaseLobbySeats.run(user.id);
    });
    return { ok: true, user };
}
export function reactivateAccount(db, username) {
    const user = db.q.userByNameLoose.get(username);
    if (!user || /^deleted-\d+$/.test(user.username)) return { error: "no such user: " + username };
    if (!user.deactivated_at) return { error: user.username + " is not deactivated" };
    db.q.reactivateUser.run(user.id);
    return { ok: true, user };
}

export function deleteAccount(db, username) {
    const plan = planDeletion(db, username);
    if (plan.error) return plan;
    const { user } = plan;
    db.db.exec("PRAGMA secure_delete = ON");                 // what is deleted is overwritten, not left in free pages
    db.tx(() => {
        for (const id of plan.solo) db.q.setStatus.run("aborted", id);
        for (const { id } of db.q.tablesHostedBy.all(user.id)) db.q.setStatus.run("aborted", id);
        db.q.releaseLobbySeats.run(user.id);
        db.q.deleteChatOf.run(user.id);
        db.q.deleteFriendshipsOf.run(user.id, user.id);
        db.q.deleteAchievementsOf.run(user.id);
        db.q.deleteSessionsOf.run(user.id);
        db.q.scrubUser.run(user.id);
    });
    db.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");           // and folded into the file now, not left in the log
    return { ok: true, user, ...plan };
}
