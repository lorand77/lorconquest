// An example player for tools/strength.js (--player CODE=tools/strength-players/computer.js): its country played by the working
// copy's computer player. It shows the shape a scripted player takes — createPlayer({ seed, country, scenario }) returning
// { orders(game, events) }, the commands to give, without `country` — and checks the hook: against the baseline it should do
// as the candidate's one-country games do.
import { createAI } from "../../src/ai/index.js";

export function createPlayer({ seed, country, scenario }) {
    const ai = createAI({ seed, humans: scenario.countries.map((c) => c.code).filter((c) => c !== country) });
    return { orders: (game, events) => ai.orders(game, events).map((o) => o.cmd) };
}
