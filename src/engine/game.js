// A game: the map, the state, and the log of every command applied, with the day it was applied on. The one
// object the server, the browser, tests and tools hold. A game replays exactly from its seed and its log, and a
// snapshot carries on exactly where it was taken.

import { applyCommand } from "./commands.js";
import { advanceDay } from "./day.js";
import { buildMap } from "./map.js";
import { FORMAT, RULES_VERSION, initialState } from "./state.js";

export class Game {
    constructor(map, state) {
        this.map = map;
        this.state = state;
        this.log = [];
    }

    static create(scenario, { seed = 1 } = {}) {
        const map = buildMap(scenario);
        return new Game(map, initialState(map, seed));
    }

    // from a snapshot (a string or a parsed object) of a game on the same scenario
    static restore(scenario, snapshot) {
        const state = JSON.parse(typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot));
        if (state.format !== FORMAT) throw new Error(`snapshot format ${state.format}, this engine reads ${FORMAT}`);
        if (state.rulesVersion !== RULES_VERSION) throw new Error(`snapshot of rules version ${state.rulesVersion}, this engine plays ${RULES_VERSION}`);
        return new Game(buildMap(scenario), state);
    }

    get day() {
        return this.state.day;
    }

    // apply a command now, before the next day; logged if accepted
    command(cmd) {
        const result = applyCommand(this, cmd);
        if (result.ok) this.log.push({ day: this.state.day, cmd: JSON.parse(JSON.stringify(cmd)) });
        return result;
    }

    // one day on; returns its events
    advance() {
        return advanceDay(this);
    }

    snapshot() {
        return JSON.stringify(this.state);
    }
}

// a game rebuilt from its seed and command log, up to `untilDay`: each day's commands are applied, then the day
// is advanced, exactly as when it was played
export function replay(scenario, seed, log, untilDay) {
    const game = Game.create(scenario, { seed });
    let i = 0;
    for (;;) {
        for (; i < log.length && log[i].day === game.day; i++) {
            const r = game.command(log[i].cmd);
            if (!r.ok) throw new Error(`replay: day ${game.day}: ${r.error}`);
        }
        if (game.day >= untilDay) return game;
        game.advance();
    }
}
