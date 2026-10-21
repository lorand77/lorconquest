// Throttling for /api/login and /api/register (from LorCiv). Both hash a password, which is deliberately expensive, so
// without limits anyone could guess passwords without end, make accounts by the thousand, or keep the processor busy
// hashing. Two defences, both in memory (a restart forgets them, fine for one server): sliding windows per client
// address for failed logins and for sign-ups, and a cap on hashes running at once — a request over it is refused,
// not queued.
function createLimiter(max, windowMs) {
    const hits = new Map();
    const recent = (key, now) => {
        const kept = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
        if (kept.length) hits.set(key, kept);
        else hits.delete(key);
        return kept;
    };
    return {
        blocked: (key) => recent(key, Date.now()).length >= max,
        hit(key) {
            const now = Date.now();
            hits.set(key, [...recent(key, now), now]);
        },
        sweep() {
            const now = Date.now();
            for (const key of [...hits.keys()]) recent(key, now);
        },
    };
}

export function createThrottles({ windowMs, loginMax, registerMax, hashMax }) {
    const loginFailures = createLimiter(loginMax, windowMs), registrations = createLimiter(registerMax, windowMs);
    const timer = setInterval(() => { loginFailures.sweep(); registrations.sweep(); }, 60 * 1000);
    timer.unref();
    let inFlight = 0;
    return {
        loginFailures, registrations,
        // claim one of the hash slots: a release function, or null when all are taken
        acquireHashSlot() {
            if (inFlight >= hashMax) return null;
            inFlight++;
            let released = false;
            return () => { if (!released) { released = true; inFlight--; } };
        },
        stop: () => clearInterval(timer),
    };
}
