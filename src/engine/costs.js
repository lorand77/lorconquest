// The prices, techs, laws and durations of RULES.md §3, §4, §8 and §9, as data. Money and research are in the same
// unit as the rules' "M": 0.1M is 100,000. Durations are in whole game days.
import { MONTH, YEAR_DAYS } from "./calendar.js";

export const BUILDING_PRICE = { walls: 100000, library: 75000, workshop: 75000, market: 75000, courthouse: 50000, university: 200000, starFort: 250000 };
export const BUILDINGS = Object.keys(BUILDING_PRICE);

// weapons bought by the thousand, into the reserve
export const WEAPON_PRICE = { swords: 25000, pikes: 30000, cavalry: 60000, handCannons: 50000, arquebuses: 70000, muskets: 100000 };
export const CANNON_PRICE = 100000;          // per 100
export const SHARPSHOOTER_PRICE = 15000;     // per 100
export const PEOPLE_PRICE = 50000;           // per 1000
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
    // the trace italienne: bastions that cannon cannot batter down as they do old walls — a Star fort (RULES.md §3, §6). `from`: the
    // year it may be researched from, whatever the research: its age, not its price, holds it back
    fortifications: { cost: 2.5, needs: "arquebuses", from: 1520 },
};
export const START_TECHS = ["swords", "pikes", "cavalry", "cannons", "cogs"];

// growth: the share of the people's growth a settlement keeps (the young men under arms raise no families); unrest: added to the
// yearly chance of peasants rising (RULES.md §9) — what makes the two harshest laws a measure for a war, not a way of life
export const LAWS = {
    feudal: { name: "Feudal levy", army: 0.05, navy: 0.025, penalty: 0, growth: 1, unrest: 0 },
    standing: { name: "Standing army", army: 0.075, navy: 0.03, penalty: 0.03, growth: 1, unrest: 0 },
    militarized: { name: "Militarized", army: 0.10, navy: 0.04, penalty: 0.06, growth: 1, unrest: 0 },
    mass: { name: "Mass levy", army: 0.15, navy: 0.05, penalty: 0.15, growth: 0.5, unrest: 0.05 },
    barrel: { name: "Scrape the barrel", army: 0.22, navy: 0.07, penalty: 0.40, growth: 0, unrest: 0.15 },
};

export const REGIONS_NEEDED = 1;
export const WORKSHOP_MONEY = 7000;
export const MARKET_BONUS = 0.15;
// the capital's own (RULES.md §2): money a year and soldiers on the army cap (experiments/README.md, 23), the same for every country — a large part of a
// small one's, next to nothing of a large one's
export const CAPITAL_MONEY = 10000;
export const CAPITAL_SOLDIERS = 500;
export const SOLDIER_UPKEEP = 5;
export const MERCENARY_UPKEEP = 15;
export const LOAN_CHUNK = 50000;
export const LOAN_RATE = 0.08;
export const BANK_RATE_MONTHLY = 0.0025;
export const MAX_LIBRARIES = 10;
// a university (RULES.md §3, §4): +10% of the R a year each, up to three a country, beside the libraries' +50%
export const MAX_UNIVERSITIES = 3, UNIVERSITY_BONUS = 0.10;
export const LIBRARY_BONUS = 0.05;
export const SHARPSHOOTERS_PER_PASS = 500;        // times x

const days = (months) => Math.round(months * MONTH);
export const TRAIN_CAPITAL_DAYS = days(3);
export const TRAIN_OTHER_DAYS = days(6);
export const MERCENARY_DAYS = days(1);
// the mercenaries for hire in the whole world (RULES.md §8): 1% of its people until 1490, rising to 2% by 1600 (the Landsknechts, and
// war growing); hired men are gone from it until dismissed or deserting, the dead for good — it fills again by a tenth of its size a
// year. A settlement takes at most this many being hired at once
export const MERCENARY_SHARE = 0.01, MERCENARY_SHARE_LATE = 0.02, MERCENARY_GROWS = [1490, 1600], MERCENARY_REFILL = 0.1;
export const HIRE_ROOM = { town: 1000, city: 2000, capital: 4000 };
export const LAW_DAYS = 5 * YEAR_DAYS;          // after a change, the next to a law allowing more soldiers
export const LAW_DOWN_DAYS = YEAR_DAYS;         // … and to one allowing fewer: an emergency is cheap to leave (RULES.md §9)
// the first day `country` may change its law to `to`: never sooner than LAW_DAYS after the last change for one allowing more
// soldiers, LAW_DOWN_DAYS for one allowing fewer; 0 if it has never changed it
export const lawChangeDay = (country, to) => (country.lawDay === null || country.lawDay === undefined ? 0
    : country.lawDay + (LAWS[to].army < LAWS[country.law ?? "feudal"].army ? LAW_DOWN_DAYS : LAW_DAYS));
export const DEFAULT_BAN_DAYS = 20 * YEAR_DAYS;
export const DEBT_DAYS = 10 * YEAR_DAYS;
export const CORING_DAYS = 20 * YEAR_DAYS;
export const STRAIT_DAYS = days(2);
// a voyage by sea lane (RULES.md §8): through at most this many sea zones, the one it sets out in counted; an army fights at
// this share of its strength on the day it lands, unless its side blockades the port
export const SEA_ZONES_MAX = 3;
export const LANDING = 0.75;
