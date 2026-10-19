// The engine's public face: what the server, the browser, tests and tools import. The engine runs the same in
// Node and the browser (design.md, "The engine"): no Node-only or browser-only APIs, no clock, no Math.random.

export { Game, replay, resume } from "./game.js";
export { COMMAND_TYPES, applyCommand } from "./commands.js";
export { RULES_VERSION, FORMAT, atWar, armiesAt, armyList, canEnter, ownerOf, soldiersOf } from "./state.js";
export { WEAPONS, MULTIPLIER, menOf, militaryPower, power } from "./army.js";
export { COOLDOWN_DAYS } from "./battle.js";
export { siegeDays, situation } from "./fighting.js";
export { positionOf, progress, routeFor } from "./movement.js";
export { START_YEAR, YEAR_DAYS, MONTH_NAMES, dateOf, dayOf, formatDate, longDate, parseDate } from "./calendar.js";
export { describeEvent, eventCountries, placeName } from "./text.js";
export { buildMap, legKey } from "./map.js";
