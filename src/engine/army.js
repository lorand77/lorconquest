// What an army is made of and what it is worth (RULES.md §3, §5): men by weapon, cannons and their crews, the
// power formula with its weapon rules, and losses as whole men. Pure arithmetic on army objects.

export const WEAPONS = ["unarmed", "swords", "pikes", "cavalry", "handCannons", "arquebuses", "muskets"];
export const MULTIPLIER = { unarmed: 0, swords: 1, pikes: 1.2, cavalry: 1.4, handCannons: 1.3, arquebuses: 1.6, muskets: 2 };
export const CREW_PER_CANNON = 10;

export function emptyMen() {
    const men = {};
    for (const w of WEAPONS) men[w] = 0;
    return men;
}

export function menOf(army) {
    let n = 0;
    for (const w of WEAPONS) n += army.men[w];
    return n;
}

export function armedOf(men) {
    let n = 0;
    for (const w of WEAPONS) if (w !== "unarmed") n += men[w];
    return n;
}

export const isEmpty = (army) => menOf(army) + army.cannons + army.crew === 0;

// every army of one side fights as one (RULES.md §5): their men and cannons added up
export function combine(armies) {
    const men = emptyMen();
    let cannons = 0;
    for (const a of armies) {
        for (const w of WEAPONS) men[w] += a.men[w];
        cannons += a.cannons;
    }
    return { men, cannons };
}

// pike and shot: at least a third of the armed men carry pikes
export const pikeAndShot = (men) => armedOf(men) > 0 && men.pikes * 3 >= armedOf(men);
// cavalry has no bonus against an army with a third pikes or half muskets
export const stopsCavalry = (men) => armedOf(men) > 0 && (men.pikes * 3 >= armedOf(men) || men.muskets * 2 >= armedOf(men));

// a side's power before the dice and any defence bonus; `cavalry` is 1.4, or 1 where cavalry has no bonus
export function power({ men, cannons }, cavalry) {
    const shot = pikeAndShot(men) ? 1.2 : 1;
    return men.swords * MULTIPLIER.swords + men.pikes * MULTIPLIER.pikes + men.cavalry * cavalry
        + (men.handCannons * MULTIPLIER.handCannons + men.arquebuses * MULTIPLIER.arquebuses + men.muskets * MULTIPLIER.muskets) * shot
        + cannons * 13 * 1.2;
}

// military power, for diplomacy (RULES.md §5): plain multipliers, no dice, no bonuses
export function militaryPower(army) {
    let p = 0;
    for (const w of WEAPONS) p += army.men[w] * MULTIPLIER[w];
    return p + army.cannons * 13 * 1.2;
}

// `dead` shared over `keys` in proportion to `counts`, in whole numbers, by largest remainder
export function shareOut(counts, keys, dead) {
    const total = keys.reduce((n, k) => n + counts[k], 0), out = {};
    let given = 0;
    const rest = [];
    for (const k of keys) {
        const q = total ? counts[k] * dead / total : 0;
        out[k] = Math.floor(q);
        given += out[k];
        rest.push([q - out[k], k]);
    }
    rest.sort((x, y) => y[0] - x[0]);
    for (let i = 0; given < dead; i++, given++) out[rest[i][1]]++;
    return out;
}

// the losses `pct` (0-1) costs an army, in whole men: the total is rounded to the nearest man and shared over the
// weapon groups; cannons are rounded on their own; each lost cannon kills its 10 crew, and crew without a cannon
// die like men. With `menOnly` (siege disease, hunger) cannons and crews are spared. `mercs` of the dead men
// were mercenaries, in proportion: their dead cost no population (RULES.md §8).
export function lossesFor(army, pct, menOnly = false) {
    const total = menOf(army);
    const dead = Math.min(total, Math.round(total * pct));
    const men = dead > 0 ? shareOut(army.men, WEAPONS, dead) : emptyMen();
    const mercs = army.mercs && total ? Math.min(army.mercs, Math.round(dead * army.mercs / total)) : 0;
    let cannons = 0, crew = 0;
    if (!menOnly) {
        cannons = Math.min(army.cannons, Math.round(army.cannons * pct));
        const idle = Math.max(0, army.crew - army.cannons * CREW_PER_CANNON);
        crew = Math.min(army.crew, cannons * CREW_PER_CANNON + Math.round(idle * pct));
    }
    return { men, dead, mercs, cannons, crew };
}

// the people a loss costs the country: its regular men and crew, not the mercenaries
export const peopleLost = (loss) => loss.dead - loss.mercs + loss.crew;

export function applyLosses(army, loss) {
    for (const w of WEAPONS) army.men[w] -= loss.men[w];
    army.cannons -= loss.cannons;
    army.crew -= loss.crew;
    army.mercs = Math.min((army.mercs ?? 0) - (loss.mercs ?? 0), menOf(army));
}

// take `n` men out of an army (RULES.md §8: dismissing mercenaries, desertion), their weapons in `order` — the
// first kind with men left, then the next; returns the weapons taken, by kind. Does not touch `mercs`.
export function takeMen(army, n, order = WEAPONS) {
    const taken = emptyMen();
    for (const w of order) {
        const k = Math.min(n, army.men[w]);
        army.men[w] -= k;
        taken[w] += k;
        n -= k;
    }
    return taken;
}
