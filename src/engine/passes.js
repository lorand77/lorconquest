// Sharpshooters at mountain passes (RULES.md §5, §8). A post belongs to the country the pass lies in and is
// stationed only there: state.posts[pass] = { owner, n }. Each enemy army that arrives at the pass is fired on
// once — sharpshooters × d6 men, at most a quarter of the army — and never again while it stays or when it leaves.
// An army may storm the post: a field battle in which each sharpshooter counts 2.5 power, dug in at ×2.

import { applyLosses, combine, isEmpty, lossesFor, menOf, peopleLost, power } from "./army.js";
import { damage } from "./battle.js";
import { battleRoll, d6 } from "./random.js";
import { armiesAt, atWar, killPeople, ownerOf, removeArmy } from "./state.js";

// an enemy army arrives at `key`: if a post there fires, it takes its losses
export function fireSharpshooters(game, army, events) {
    const st = game.state, key = army.at, post = st.posts[key];
    if (!post || post.n <= 0 || !atWar(st, army.owner, post.owner)) return;
    const men = menOf(army);
    if (!men) return;
    const dmg = Math.min(post.n * d6(st), Math.floor(men / 4));
    const loss = lossesFor(army, dmg / men, true);
    applyLosses(army, loss);
    killPeople(st, army.owner, peopleLost(loss));
    events.push({ type: "sharpshooters", day: st.day, army: army.id, owner: army.owner, pass: key, dead: loss.dead });
    if (isEmpty(army)) {
        removeArmy(st, army);
        events.push({ type: "destroyed", day: st.day, army: army.id, owner: army.owner, dead: 0, why: "shot at the pass" });
    }
}

// the country's armies at the pass storm the post (RULES.md §5): sharpshooters × 2.5 × 2 × (2d6 + 4) against the
// army's power with plain cavalry. Losses as in a normal battle; the people killed in the post are lost from its
// country. The beaten army falls back (the caller sends it); a post that loses is wiped out.
export function stormPost(game, country, key, events) {
    const st = game.state, post = st.posts[key];
    const armies = armiesAt(st, key).filter((a) => a.owner === country);
    const rollA = battleRoll(st), rollB = battleRoll(st);
    const pa = power(combine(armies), 1) * rollA, pb = post.n * 2.5 * 2 * rollB;
    const winner = pa > pb ? "a" : "b";                   // equal power: the post, dug in, holds
    const dmg = winner === "a" ? damage(pa, pb) : damage(pb, pa);
    const ev = {
        type: "battle", kind: "post", day: st.day, place: key, winner, destroyed: [],
        a: { countries: [country], armies: armies.map((a) => a.id), men: armies.reduce((n, a) => n + menOf(a), 0), cannons: armies.reduce((n, a) => n + a.cannons, 0), power: pa, roll: rollA, dead: 0 },
        b: { countries: [post.owner], armies: [], men: post.n, unit: "sharpshooters", cannons: 0, power: pb, roll: rollB, dead: 0 },
    };
    for (const a of armies) {
        const loss = lossesFor(a, winner === "a" ? dmg.winner : dmg.loser);
        applyLosses(a, loss);
        killPeople(st, country, peopleLost(loss));
        ev.a.dead += loss.dead + loss.crew;
        if (isEmpty(a)) { removeArmy(st, a); ev.destroyed.push(a.id); }
    }
    // a post that loses is wiped out (RULES.md §5); one that wins loses the winner's share
    const lost = winner === "a" ? post.n : Math.min(post.n, Math.round(post.n * dmg.winner));
    killPeople(st, post.owner, lost);
    ev.b.dead = lost;
    post.n -= lost;
    if (post.n <= 0) delete st.posts[key];
    events.push(ev);
    return ev;
}

// a pass changes hands with the settlement whose land it lies in: every sharpshooter stationed there dies
export function postsLost(game, settlement, events) {
    const st = game.state;
    for (const [key, post] of Object.entries(st.posts)) {
        if (game.map.nodes.get(key).land !== settlement || ownerOf(game, key) === post.owner) continue;
        killPeople(st, post.owner, post.n);
        events.push({ type: "postLost", day: st.day, pass: key, owner: post.owner, dead: post.n });
        delete st.posts[key];
    }
}
