// How a finished game ranks its people (docs/design.md, "Players"; plan.md, milestone 7): among themselves, by how their
// countries stood at the end — settlements (a subject counts for its overlord, as in the victory table), then people. A
// player who quit gave their country to the computer and is placed after everyone who stayed, the later quitter first.
// Pure, so it is tested without a server.
export function rankHumans(seats, table) {
    const standing = (s) => table[s.country] ?? { settlements: 0, pop: 0 };
    const ordered = [...seats].sort((a, b) => {
        if ((a.quitDay === null) !== (b.quitDay === null)) return a.quitDay === null ? -1 : 1;
        if (a.quitDay !== null) return b.quitDay - a.quitDay || (a.country < b.country ? -1 : 1);
        const x = standing(a), y = standing(b);
        return y.settlements - x.settlements || y.pop - x.pop || (a.country < b.country ? -1 : 1);
    });
    return ordered.map((s, i) => ({ country: s.country, place: i + 1, settlements: standing(s).settlements, pop: Math.round(standing(s).pop) }));
}
