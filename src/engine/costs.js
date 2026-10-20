// The prices, techs, laws and durations of RULES.md §3, §4, §8 and §9, as data. Money and research are in the same
// unit as the rules' "M": 0.1M is 100,000. Durations are in whole game days.
import { MONTH, YEAR_DAYS } from "./calendar.js";

export const BUILDING_PRICE = { walls: 100000, library: 75000, workshop: 75000, market: 75000, courthouse: 50000 };
export const BUILDINGS = Object.keys(BUILDING_PRICE);

// weapons bought by the thousand, into the reserve
export const WEAPON_PRICE = { swords: 25000, pikes: 30000, cavalry: 60000, handCannons: 50000, arquebuses: 70000, muskets: 100000 };
export const CANNON_PRICE = 100000;          // per 100
export const SHARPSHOOTER_PRICE = 15000;     // per 100
export const PEOPLE_PRICE = 100000;          // per 1000
export const MERCENARY_PRICE = 50000;        // per 1000
export const SHIP_PRICE = { cogs: 100000, carracks: 200000, galleons: 330000, menOfWar: 500000 };   // per 10
export const SHIP_POWER = { cogs: 1, carracks: 3, galleons: 5, menOfWar: 8 };
export const SHIPS = Object.keys(SHIP_PRICE);
export const CREW_PER_SHIP = 50;

// the tech tree (RULES.md §4): cost in millions of R times the scenario's x, and what must be unlocked first
export const TECHS = {
    handCannons: { cost: 1.5, needs: "swords" },
    arquebuses: { cost: 2, needs: "handCannons" },
    muskets: { cost: 3.5, needs: "arquebuses" },
    sharpshooters: { cost: 1, needs: "arquebuses" },
    carracks: { cost: 3, needs: "cogs" },
    galleons: { cost: 8, needs: "carracks" },
    menOfWar: { cost: 12, needs: "galleons" },
};
export const START_TECHS = ["swords", "pikes", "cavalry", "cannons", "cogs"];

export const LAWS = {
    feudal: { name: "Feudal levy", army: 0.05, navy: 0.025, penalty: 0 },
    standing: { name: "Standing army", army: 0.075, navy: 0.03, penalty: 0.03 },
    militarized: { name: "Militarized", army: 0.10, navy: 0.04, penalty: 0.06 },
    mass: { name: "Mass levy", army: 0.15, navy: 0.05, penalty: 0.15 },
    barrel: { name: "Scrape the barrel", army: 0.22, navy: 0.07, penalty: 0.40 },
};

export const REGIONS_NEEDED = 1;
export const WORKSHOP_MONEY = 3500;
export const MARKET_BONUS = 0.15;
export const SOLDIER_UPKEEP = 5;
export const MERCENARY_UPKEEP = 15;
export const LOAN_CHUNK = 50000;
export const LOAN_RATE = 0.08;
export const BANK_RATE_MONTHLY = 0.0025;
export const MAX_LIBRARIES = 10;
export const LIBRARY_BONUS = 0.05;
export const SHARPSHOOTERS_PER_PASS = 500;        // times x

const days = (months) => Math.round(months * MONTH);
export const TRAIN_CAPITAL_DAYS = days(3);
export const TRAIN_OTHER_DAYS = days(6);
export const MERCENARY_DAYS = days(1);
export const LAW_DAYS = 5 * YEAR_DAYS;
export const DEFAULT_BAN_DAYS = 20 * YEAR_DAYS;
export const DEBT_DAYS = 10 * YEAR_DAYS;
export const CORING_DAYS = 20 * YEAR_DAYS;
export const STRAIT_DAYS = days(3);
