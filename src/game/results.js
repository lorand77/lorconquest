// How a finished game ranks its people (docs/design.md, "Replays and results"; plan.md, milestone 7): among themselves, first
// those whose country was still in the game at the end, by how it stood — settlements (a subject counts for its overlord, as in
// the victory table), then people; then those whose country was eliminated, the later first; last those who quit and gave
// their country to the computer, the later quitter first. Pure, so it is tested without a server.
export function rankHumans(seats, table) {
    const standing = (s) => table[s.country] ?? { settlements: 0, pop: 0 };
    const group = (s) => (s.quitDay != null ? 2 : s.outDay != null ? 1 : 0);
    const ordered = [...seats].sort((a, b) => {
        if (group(a) !== group(b)) return group(a) - group(b);
        if (group(a) === 2) return b.quitDay - a.quitDay || (a.country < b.country ? -1 : 1);
        if (group(a) === 1) return b.outDay - a.outDay || (a.country < b.country ? -1 : 1);
        const x = standing(a), y = standing(b);
        return y.settlements - x.settlements || y.pop - x.pop || (a.country < b.country ? -1 : 1);
    });
    return ordered.map((s, i) => ({ country: s.country, place: i + 1, settlements: standing(s).settlements, pop: Math.round(standing(s).pop) }));
}
