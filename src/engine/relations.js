// Who stands where to whom (RULES.md §10), as pure questions over the state's agreements and subjects: alliances,
// guarantees, military access, overlords and subjects, and who counts as a friend. No dependencies, so the state
// itself can use it to decide where an army may go.
//
// state.agreements: [{ kind, a, b, since, until }] — kind "defensive", "military", "pact" and "truce" are between
// both; "guarantee": a guarantees b; "access": a gives b military access. `until` is a day or null for ever.

import { memoTable } from "./memo.js";

const both = (x, a, b) => (x.a === a && x.b === b) || (x.a === b && x.b === a);

// Each country's agreements, in the order of state.agreements — so every answer below comes out as a scan of the whole list
// would give it, without scanning it: these questions are asked thousands of times a day (who is whose friend), and a map of
// a hundred countries has hundreds of agreements. Kept beside the list, not in the state (which stays plain JSON), and made
// again whenever the list is another (removeAgreements makes a new one) or longer (addAgreement pushes onto it; a test may too).
const INDEX = new WeakMap(), NONE = Object.freeze([]);
function involving(state, code) {
    const list = state.agreements;
    let ix = INDEX.get(list);
    if (!ix || ix.n !== list.length) {
        const by = new Map();
        for (const x of list) for (const c of x.a === x.b ? [x.a] : [x.a, x.b]) { if (!by.has(c)) by.set(c, []); by.get(c).push(x); }
        ix = { n: list.length, by };
        INDEX.set(list, ix);
    }
    return ix.by.get(code) ?? NONE;
}

export const hasAgreement = (state, kind, a, b) => involving(state, a).some((x) => x.kind === kind && (kind === "guarantee" || kind === "access" ? x.a === a && x.b === b : both(x, a, b)));
export const agreementsBetween = (state, a, b) => involving(state, a).filter((x) => both(x, a, b));
// allied by either kind of alliance
export const allied = (state, a, b) => hasAgreement(state, "defensive", a, b) || hasAgreement(state, "military", a, b);
export const alliesOf = (state, code) => [...new Set(involving(state, code).filter((x) => x.kind === "defensive" || x.kind === "military").map((x) => (x.a === code ? x.b : x.a)))].sort();
export const guarantorsOf = (state, code) => involving(state, code).filter((x) => x.kind === "guarantee" && x.b === code).map((x) => x.a).sort();

export const overlordOf = (state, code) => state.countries[code]?.overlord ?? null;
export const subjectKind = (state, code) => state.countries[code]?.subjectKind ?? null;
// in code order; while the memory is on (memo.js), from a table of every overlord's made once
export function subjectsOf(state, code) {
    const t = memoTable("subjectsByOverlord", () => {
        const m = new Map();
        for (const c of Object.keys(state.countries).sort()) { const o = state.countries[c].overlord; if (o) { if (!m.has(o)) m.set(o, []); m.get(o).push(c); } }
        return m;
    });
    return t ? (t.get(code) ?? []).slice() : Object.keys(state.countries).sort().filter((c) => state.countries[c].overlord === code);
}
export const isVassal = (state, code) => subjectKind(state, code) === "vassal";

// would making `subject` a subject of `overlord` make a ring of overlords: is `overlord` itself, or a subject of
// a subject of, `subject`?
export function wouldCycle(state, subject, overlord) {
    for (let c = overlord, n = 0; c && n < 100; c = overlordOf(state, c), n++) if (c === subject) return true;
    return false;
}

// "its own country's, its subjects', overlord's or allies'" land (RULES.md §8): a country's friends
export const friendly = (state, a, b) => a === b || allied(state, a, b) || overlordOf(state, a) === b || overlordOf(state, b) === a;
// the land of `owner` is open to `visitor` by military access (RULES.md §10)
export const grantsAccess = (state, owner, visitor) => hasAgreement(state, "access", owner, visitor);
