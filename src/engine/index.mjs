// The engine's public face: what the server, the browser, tests and tools import. The engine runs the same in
// Node and the browser (design.md, "The engine"): no Node-only or browser-only APIs, no clock, no Math.random.

export { Game, replay } from "./game.mjs";
export { COMMAND_TYPES, applyCommand } from "./commands.mjs";
export { RULES_VERSION, FORMAT, atWar, armiesAt, armyList, canEnter, ownerOf, soldiersOf } from "./state.mjs";
export { WEAPONS, MULTIPLIER, menOf, militaryPower, power } from "./army.mjs";
export { COOLDOWN_DAYS } from "./battle.mjs";
export { siegeDays, situation } from "./fighting.mjs";
export { positionOf, progress, routeFor } from "./movement.mjs";
export { START_YEAR, YEAR_DAYS, dateOf, dayOf, formatDate, parseDate } from "./calendar.mjs";
