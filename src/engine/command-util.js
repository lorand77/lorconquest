// What every command handler needs: the answer shapes, whole-number checks, and finding the army or fleet a
// command names — which must be the giving country's own.
import { isRebel } from "./state.js";

export const refuse = (error) => ({ ok: false, error });
export const done = (events = []) => ({ ok: true, events });
export const whole = (n) => Number.isInteger(n) && n >= 0;
export const positive = (n) => Number.isInteger(n) && n > 0;
export const money = (n) => Math.round(n).toLocaleString("en-GB");

// the army a command names, if it is the country's and free to take orders
export function ownArmy(game, cmd, { atPlace = false, id = cmd.army } = {}) {
    const army = game.state.armies[id];
    if (!army) return { error: `no army ${id}` };
    if (army.owner !== cmd.country) return { error: `army ${army.id} is not ${cmd.country}'s` };
    if (army.retreating) return { error: `army ${army.id} is retreating and takes no orders` };
    if (atPlace && !army.at) return { error: `army ${army.id} is on the march` };
    return { army };
}

export function ownFleet(game, cmd, { id = cmd.fleet } = {}) {
    const fleet = game.state.fleets[id];
    if (!fleet) return { error: `no fleet ${id}` };
    if (fleet.owner !== cmd.country) return { error: `fleet ${fleet.id} is not ${cmd.country}'s` };
    return { fleet };
}

// a country the player may give orders for: not peasant rebels
export const isPlayable = (state, code) => Boolean(state.countries[code]) && !isRebel(state, code);

// can the country pay? "You may not buy anything that would take your treasury below zero" (RULES.md §2)
export function afford(country, amount) {
    return country.treasury - amount >= 0 ? null : `that costs ${money(amount)}, and the treasury holds ${money(country.treasury)}`;
}
