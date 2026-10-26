// The engine's public face: what the server, the browser, tests and tools import. The engine runs the same in
// Node and the browser (design.md, "The engine"): no Node-only or browser-only APIs, no clock, no Math.random.

export { Game, replay, resume } from "./game.js";
export { fingerprint } from "./hash.js";
export { COMMAND_TYPES, applyCommand } from "./commands.js";
export { RULES_VERSION, FORMAT, atWar, armiesAt, armyList, canEnter, fleetList, isCore, isFriend, isRebel, ownerOf } from "./state.js";
export { agreementsBetween, allied, alliesOf, friendly, grantsAccess, guarantorsOf, hasAgreement, isVassal, overlordOf, subjectKind, subjectsOf, wouldCycle } from "./relations.js";
export { BAR, agreementAnswer, bordering, demandChance, militaryPowerOf, need, neighboursOf, opinion, peaceAnswer, peaceCost, sizeOf, warScore } from "./opinion.js";
export { OFFER_DAYS, PACT_DAYS, PROPOSAL_DAYS, TRUCE_DAYS, germanStates, hreSettlementsOf, mayPropose, validateTerms, warJoiners } from "./diplomacy.js";
export { checkVictory, scores } from "./victory.js";
export { TRIBUTE, armyCapOf, armySoldiersOf, economyOf, manpowerOf, mercenariesOf, navyCapOf, ownedBy, popOf, rebelsOf, soldiersOf, techCost } from "./economy.js";
export { blockaded, crossable, crewAtSea, fleetPower, shipCount, shipsIn } from "./naval.js";
export * from "./costs.js";
export { CREW_PER_CANNON, WEAPONS, MULTIPLIER, menOf, militaryPower, power } from "./army.js";
export { COOLDOWN_DAYS } from "./battle.js";
export { besiegedIn, siegeDays, situation, wallDefence } from "./fighting.js";
export { positionOf, progress, routeFor } from "./movement.js";
export { START_YEAR, YEAR_DAYS, MONTH_NAMES, dateOf, dayOf, formatDate, longDate, parseDate } from "./calendar.js";
export { describeEvent, eventCountries, placeName } from "./text.js";
export { buildMap, legKey } from "./map.js";
