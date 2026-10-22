// Raising forces (RULES.md §8): soldiers and cannon crew are trained in a core settlement, 3 months in the capital
// and 6 elsewhere, and mercenaries arrive a month after they are hired. Each waits in the country's queue — men
// in training already pay upkeep and count on the army cap — and appears in its settlement when ready, joining an
// army of the country there or forming a new one, carrying the weapons set aside for them when they were raised. If the
// settlement was captured or stopped being core before then, training is cancelled, the men come home and their weapons
// go back to the reserve; a hire is cancelled and its money lost.
import { emptyMen } from "./army.js";
import { armiesAt, isCore, isRebel, newArmy } from "./state.js";

// men join the country's army inside the settlement (not one outside its walls, not one retreating), else form one
export function joinArmy(state, owner, key, { men = emptyMen(), crew = 0, mercs = 0 }) {
    const army = armiesAt(state, key).find((a) => a.owner === owner && !a.relief && !a.retreating);
    if (!army) return newArmy(state, owner, key, men, 0, crew, mercs);
    for (const w of Object.keys(men)) army.men[w] += men[w];
    army.crew += crew;
    army.mercs += mercs;
    return army;
}

// the weapons set aside for men in training go back to the reserve
const unqueue = (c, t) => { if (t.weapon && t.weapon !== "unarmed") c.reserve[t.weapon] += t.n; };

// a captured settlement's queued training and hires are cancelled
export function cancelAt(state, settlement) {
    for (const c of Object.values(state.countries)) {
        if (isRebel(state, c.code)) continue;
        for (const t of c.training) if (t.settlement === settlement) unqueue(c, t);
        c.training = c.training.filter((t) => t.settlement !== settlement);
        c.hires = c.hires.filter((h) => h.settlement !== settlement);
    }
}

// everyone whose time is up appears (or is cancelled), in the order of their ready days
export function forcesDay(game, events) {
    const st = game.state;
    for (const code of Object.keys(st.countries).sort()) {
        const c = st.countries[code];
        if (isRebel(st, code)) continue;
        for (const [list, kind] of [[c.training, "training"], [c.hires, "hires"]]) {
            const due = list.filter((t) => t.ready <= st.day).sort((a, b) => a.ready - b.ready);
            if (!due.length) continue;
            c[kind] = list.filter((t) => t.ready > st.day);
            for (const t of due) {
                const s = st.settlements[t.settlement];
                if (s.owner !== code || (kind === "training" && !isCore(st, s, code))) {
                    events.push({ type: "cancelled", day: st.day, country: code, settlement: t.settlement, what: kind === "hires" ? "hire" : "training", n: t.n });
                    if (kind === "training") unqueue(c, t);
                    continue;
                }
                let army;
                if (kind === "hires") {
                    const men = emptyMen();
                    men.pikes = t.n;
                    army = joinArmy(st, code, String(t.settlement), { men, mercs: t.n });
                } else if (t.kind === "crew") army = joinArmy(st, code, String(t.settlement), { crew: t.n });
                else {
                    const men = emptyMen();
                    men[t.weapon ?? "unarmed"] = t.n;
                    army = joinArmy(st, code, String(t.settlement), { men });
                }
                events.push({ type: "ready", day: st.day, country: code, settlement: t.settlement, what: kind === "hires" ? "mercenaries" : t.kind, n: t.n, army: army.id });
            }
        }
    }
}
