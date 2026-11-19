// The computer as a candidate for the Empire's crown (RULES.md §10, The Emperor; src/engine/empire.js). Once an election is called it
// looks, once, at what the seven votes would do: the electors already voting for it, and for each of the others what turning it
// would cost — the points between its score and the one the elector prefers, at 2,000 × x a point, no more than a promise can
// count (30). If the cheapest of them would give it a majority for at most 30% of its treasury, it promises those; otherwise it
// spends nothing, for a promise is paid whoever wins. Electors who vote for themselves, and a person's who has chosen, are not for
// sale. How electors vote is the engine's (voteOf), not the computer's: nothing here decides an election, it only bids.

import { PROMISE_MAX, PROMISE_MONEY, candidatesOf, electorScore, electorsOf, voteOf } from "../engine/index.js";

// the most of its treasury a computer candidate spends on an election
const BUDGET = 0.3;

export function promiseOrders(game, code) {
    const st = game.state, emp = st.empire;
    if (!emp?.called || emp.promises[code] || st.humans.includes(code)) return [];
    const candidates = candidatesOf(game);
    if (!candidates.includes(code)) return [];
    const electors = electorsOf(game), unit = PROMISE_MONEY * game.map.x;
    let mine = 0;
    const offers = [];
    for (const e of electors) {
        if (!e.holder) continue;
        const now = voteOf(game, e, candidates);
        if (now === code) { mine++; continue; }
        if (!now || now === e.holder || e.holder === code || (st.humans.includes(e.holder) && emp.choices[e.holder])) continue;
        const gap = Math.floor(electorScore(game, e.holder, now, e.settlement) - electorScore(game, e.holder, code, e.settlement)) + 1;
        if (gap > PROMISE_MAX) continue;
        offers.push({ settlement: e.settlement, money: Math.max(1, gap) * unit });
    }
    const need = Math.floor(electors.length / 2) + 1 - mine;
    if (need <= 0 || offers.length < need) return [];
    const buy = offers.sort((a, b) => a.money - b.money || a.settlement - b.settlement).slice(0, need);
    if (buy.reduce((n, o) => n + o.money, 0) > BUDGET * Math.max(0, st.countries[code].treasury)) return [];
    return buy.map((o) => ({ type: "promise", country: code, elector: o.settlement, money: o.money }));
}
