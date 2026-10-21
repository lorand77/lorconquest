// Passwords, hashed with scrypt from node:crypto (LorCiv used argon2, a package this project may not add). The stored
// form carries its own parameters, so they can be raised later and old hashes still verify:
//   scrypt$N$r$p$salt$hash   (salt and hash in hex)
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const N = 16384, R = 8, P = 1, KEY_BYTES = 64;

export async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, KEY_BYTES, { N, r: R, p: P });
    return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
    const [kind, n, r, p, salt, hash] = String(stored).split("$");
    if (kind !== "scrypt" || !hash) return false;
    const want = Buffer.from(hash, "hex");
    const key = await scrypt(password, Buffer.from(salt, "hex"), want.length, { N: Number(n), r: Number(r), p: Number(p) });
    return key.length === want.length && crypto.timingSafeEqual(key, want);
}
