// What the lobby and the game page decide about people, kept apart from the page so it can be tested in Node (there is
// no browser in the development container): clock text, who is where, and which buttons a table offers a person.

// "1:05" for 65,000 ms; a clock that has run out reads "0:00"
export function formatCountdown(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// how a player's seat is shown to the others: here, away (a caretaker defends for them), away too long (the computer
// plays), gone for good
export const PRESENCE = {
    present: { text: "here", good: true },
    away: { text: "away — a caretaker defends", good: false },
    full: { text: "away — the computer plays", good: false },
    quit: { text: "has left", good: false },
    out: { text: "out of the game — watching", good: false },
    idle: { text: "not here", good: false },
};
export const presenceText = (state) => (PRESENCE[state] ?? PRESENCE.idle).text;

// the countries of a scenario nobody at a table has taken, by name
export function freeCountries(scenario, table) {
    const taken = new Set(table.seats.map((s) => s.country));
    return scenario.countries.filter((c) => !taken.has(c.code)).sort((a, b) => a.name.localeCompare(b.name));
}

// what `me` (a user id and name) may do at a table: take a seat, give it up, start the game, cancel the table
export function tableActions(table, me, scenario, maxHumans = 4) {
    const mine = table.seats.find((s) => s.username === me.username) ?? null;
    const host = table.hostId === me.id;
    const free = freeCountries(scenario, table);
    return {
        mine, host, free,
        canJoin: !mine && table.seats.length < maxHumans && free.length > 0,
        canLeave: Boolean(mine) && !host,
        canStart: host,
        canCancel: host,
        // what starting leaves to the computer, for the button
        computerCountries: scenario.countries.length - table.seats.length,
    };
}

// a line for one of a person's games: where it stands, and whether it can be opened
export function gameLine(game, scenarioName, countryName, dateText) {
    const people = game.people > 1 ? `, ${game.people} people` : "";
    const where = `${scenarioName}, ${countryName}${people}, ${dateText}`;
    // a finished or abandoned game is not opened but watched, as a replay
    if (game.status === "finished") return { text: game.winner ? `${where} — won by ${game.winner}` : `${where} — lost: every player's country fell`, open: false, replay: true };
    if (game.status === "abandoned") return { text: `${where} — abandoned: nobody was left`, open: false, replay: true };
    // a game that is going can always be opened: one let go from memory is brought back
    return { text: where, open: true, replay: false };
}
