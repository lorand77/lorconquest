// Who stands where to whom (RULES.md §10), as pure questions over the state's agreements and subjects: alliances,
// guarantees, military access, overlords and subjects, and who counts as a friend. No dependencies, so the state
// itself can use it to decide where an army may go.
//
// state.agreements: [{ kind, a, b, since, until }] — kind "defensive", "military", "pact" and "truce" are between
// both; "guarantee": a guarantees b; "access": a gives b military access. `until` is a day or null for ever.

const both = (x, a, b) => (x.a === a && x.b === b) || (x.a === b && x.b === a);

export const hasAgreement = (state, kind, a, b) => state.agreements.some((x) => x.kind === kind && (kind === "guarantee" || kind === "access" ? x.a === a && x.b === b : both(x, a, b)));
export const agreementsBetween = (state, a, b) => state.agreements.filter((x) => both(x, a, b));
// allied by either kind of alliance
export const allied = (state, a, b) => hasAgreement(state, "defensive", a, b) || hasAgreement(state, "military", a, b);
export const alliesOf = (state, code) => [...new Set(state.agreements.filter((x) => (x.kind === "defensive" || x.kind === "military") && (x.a === code || x.b === code)).map((x) => (x.a === code ? x.b : x.a)))].sort();
export const guarantorsOf = (state, code) => state.agreements.filter((x) => x.kind === "guarantee" && x.b === code).map((x) => x.a).sort();

export const overlordOf = (state, code) => state.countries[code]?.overlord ?? null;
export const subjectKind = (state, code) => state.countries[code]?.subjectKind ?? null;
export const subjectsOf = (state, code) => Object.keys(state.countries).sort().filter((c) => state.countries[c].overlord === code);
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
