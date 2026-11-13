// How a finished game ranks its people (docs/design.md, "Replays and results"; plan.md, milestone 7): among themselves, first
// those whose country was still in the game at the end, by how it stood — settlements (a subject counts for its overlord, as in
// the victory table), then people; then those whose country was eliminated, the later first; last those who quit and gave
// their country to the computer, the later quitter first. One who quit when no other person was still in — the last to leave a
// game the others had been eliminated from or left — counts as still in: they outlasted everyone. People who rule one country
// after a union (`plays`, RULES.md §10) stand with it and share its place. Pure, tested without a server.
export function rankHumans(seats, table) {
    const ruled = (s) => s.plays ?? s.country;
    const standing = (s) => table[ruled(s)] ?? { settlements: 0, pop: 0 };
    const gone = (s) => s.quitDay ?? s.outDay;
    const last = (s) => s.quitDay != null && seats.every((o) => o === s || (gone(o) != null && gone(o) <= s.quitDay));
    const group = (s) => (last(s) ? 0 : s.quitDay != null ? 2 : s.outDay != null ? 1 : 0);
    const ordered = [...seats].sort((a, b) => {
        if (group(a) !== group(b)) return group(a) - group(b);
        if (group(a) === 2) return b.quitDay - a.quitDay || (a.country < b.country ? -1 : 1);
        if (group(a) === 1) return b.outDay - a.outDay || (a.country < b.country ? -1 : 1);
        const x = standing(a), y = standing(b);
        return y.settlements - x.settlements || y.pop - x.pop || (ruled(a) < ruled(b) ? -1 : ruled(a) > ruled(b) ? 1 : a.country < b.country ? -1 : 1);
    });
    // a fellow ruler, still in, next to one: the same place
    const places = [];
    ordered.forEach((s, i) => {
        const prev = ordered[i - 1];
        places.push(prev && group(prev) === 0 && group(s) === 0 && ruled(prev) === ruled(s) ? places[i - 1] : i + 1);
    });
    return ordered.map((s, i) => ({ country: s.country, place: places[i], settlements: standing(s).settlements, pop: Math.round(standing(s).pop) }));
}
