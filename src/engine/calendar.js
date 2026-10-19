// The game calendar (RULES.md §1): day 0 is 1 January 1440, every year has 365 days with the usual months and
// no leap years. The engine counts whole days only; dates are for people.

export const START_YEAR = 1440;
export const YEAR_DAYS = 365;
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH = YEAR_DAYS / 12;              // days in "a month" when the rules give a duration in months
const MONTH_START = [0];                          // day of the year each month starts on
for (const d of MONTH_DAYS) MONTH_START.push(MONTH_START[MONTH_START.length - 1] + d);

// { year, month 1-12, day 1-31 } of a game day
export function dateOf(day) {
    const year = START_YEAR + Math.floor(day / YEAR_DAYS);
    const d = day - (year - START_YEAR) * YEAR_DAYS;
    let m = 0;
    while (MONTH_START[m + 1] <= d) m++;
    return { year, month: m + 1, day: d - MONTH_START[m] + 1 };
}

export function dayOf(year, month = 1, day = 1) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > MONTH_DAYS[month - 1]) {
        throw new Error(`no such date: ${year}-${month}-${day}`);
    }
    return (year - START_YEAR) * YEAR_DAYS + MONTH_START[month - 1] + day - 1;
}

// the start of each month (and of each year) is its 1st (RULES.md §1)
export const isMonthStart = (day) => dateOf(day).day === 1;

const pad = (n) => String(n).padStart(2, "0");
export function formatDate(day) {
    const d = dateOf(day);
    return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

// "1440-03-12" -> game day
export function parseDate(text) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(text).trim());
    if (!m) throw new Error(`not a date: ${text}`);
    return dayOf(Number(m[1]), Number(m[2]), Number(m[3]));
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "12 March 1442"
export function longDate(day) {
    const d = dateOf(day);
    return `${d.day} ${MONTH_NAMES[d.month - 1]} ${d.year}`;
}
