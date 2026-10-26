// The achievement catalogue (design.md, "Achievements"): what exists, what it is called and what it takes. The regular ones
// are here and hold in every scenario; a scenario adds its own in its SCENARIO.md ("## Achievements", read by tools/map.js
// into scenario.json), keyed "<scenario>:<id>". The server decides what was earned (analyze.js, service.js) and sends the
// browser each achievement already described, so the page needs no copy of this.
//
// Fields of a regular achievement:
//   key    stable id, stored in user_achievements.key
//   name, icon, group (a key of GROUPS)
//   desc   its description; {n} is the threshold (`n`, or the tier's)
//   n      the threshold of a one-shot achievement that has one; analyze.js checks against this same number
//   tiers  the thresholds of a tiered one (Bronze, Silver, Gold), counted over a person's games (service.js)
//   game   true when it is decided by replaying the game (analyze.js); the rest come from results and the record

export const TIER_NAMES = ["Bronze", "Silver", "Gold"];

export const GROUPS = [
    { key: "victory", title: "Victory" },
    { key: "conquest", title: "Conquest" },
    { key: "realm", title: "Realm" },
    { key: "milestones", title: "Milestones" },
];

export const ACHIEVEMENTS = [
    // ---- victory ----
    { key: "laurels", name: "Laurels", icon: "🏆", group: "victory", desc: "Win a game." },
    { key: "by_the_sword", name: "By the Sword", icon: "⚔️", group: "victory", game: true, desc: "Win by reaching the scenario's number of settlements, not on time." },
    { key: "blitz", name: "Blitz", icon: "⚡", group: "victory", n: 100, desc: "Win within {n} years of the start." },
    { key: "small_beginnings", name: "From Small Beginnings", icon: "🌱", group: "victory", n: 2, desc: "Win with a country that began with at most {n} settlements." },
    { key: "unbroken", name: "Unbroken", icon: "🛡️", group: "victory", game: true, desc: "Win without ever losing a settlement." },
    { key: "comeback", name: "Comeback", icon: "🔄", group: "victory", game: true, desc: "Win after losing your capital." },
    { key: "crowded_table", name: "Crowded Table", icon: "🍻", group: "victory", n: 3, desc: "Win a game with at least {n} people at the table." },
    { key: "hat_trick", name: "Hat Trick", icon: "🎩", group: "victory", n: 3, desc: "Win {n} games in a row." },

    // ---- conquest ----
    { key: "capital_punishment", name: "Capital Punishment", icon: "🏰", group: "conquest", game: true, desc: "Take another country's capital." },
    { key: "kingslayer", name: "Kingslayer", icon: "💀", group: "conquest", game: true, desc: "Take a country's last settlement." },
    { key: "against_the_odds", name: "Against the Odds", icon: "🐕", group: "conquest", game: true, n: 2, desc: "Win a battle on land outnumbered {n} to 1." },
    { key: "relief", name: "Relief Force", icon: "🎺", group: "conquest", game: true, desc: "Win a battle that relieves a siege." },
    { key: "thunder", name: "Thunder of Guns", icon: "💥", group: "conquest", game: true, desc: "Storm a settlement with cannons in the army." },
    { key: "admiral", name: "Admiral", icon: "⚓", group: "conquest", game: true, desc: "Win a battle at sea." },
    { key: "warlord", name: "Warlord", icon: "🗡️", group: "conquest", game: true, n: 20, desc: "Take {n} settlements in one game." },

    // ---- realm ----
    { key: "overlord", name: "Overlord", icon: "👑", group: "realm", game: true, n: 3, desc: "Have {n} subjects at once." },
    { key: "proclaimed", name: "A Crown Proclaimed", icon: "📜", group: "realm", game: true, desc: "Proclaim a region (Special coring)." },
    { key: "diktat", name: "Diktat", icon: "✍️", group: "realm", game: true, n: 3, desc: "Make a peace that takes {n} settlements." },
    { key: "rightful", name: "Rightful Ruler", icon: "⚖️", group: "realm", game: true, n: 10, desc: "Make {n} settlements core with courthouses in one game." },
    { key: "scholar", name: "Scholar", icon: "📚", group: "realm", game: true, desc: "Research every technology in one game." },

    // ---- milestones (tiered, over every game a person finished) ----
    { key: "games_played", name: "Veteran", icon: "🎖️", group: "milestones", tiers: [5, 25, 100], desc: "Finish {n} games." },
    { key: "wins", name: "Victorious", icon: "🏅", group: "milestones", tiers: [3, 10, 50], desc: "Win {n} games." },
    { key: "captures", name: "Conqueror", icon: "🏴", group: "milestones", tiers: [25, 100, 500], desc: "Take {n} settlements." },
    { key: "battles", name: "Battle-Hardened", icon: "🪖", group: "milestones", tiers: [25, 100, 500], desc: "Win {n} battles." },
];

export const BY_KEY = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]));

// a scenario's own, as catalogue entries: key "<scenario>:<id>", in a group of their own
export function scenarioAchievements(scenarioId, data) {
    return (data.achievements ?? []).map((a) => ({ key: `${scenarioId}:${a.id}`, name: a.name, icon: a.icon, group: `scenario:${scenarioId}`, desc: a.desc, goal: a.goal }));
}

export const maxTier = (a) => (a.tiers ? a.tiers.length : 1);

// one tier's description (a one-shot has only tier 1)
export function describe(a, tier = 1) {
    const t = Math.max(1, Math.min(tier, maxTier(a)));
    return a.desc.replace("{n}", String(a.tiers ? a.tiers[t - 1] : a.n));
}

// "Gold" and so on for a tiered achievement; null for a one-shot
export const tierName = (a, tier) => (a.tiers ? TIER_NAMES[Math.max(1, Math.min(tier, a.tiers.length)) - 1] : null);

// the highest tier `value` reaches, 0 for none
export function tierFor(a, value) {
    if (!a.tiers) return value ? 1 : 0;
    let t = 0;
    for (let i = 0; i < a.tiers.length; i++) if (value >= a.tiers[i]) t = i + 1;
    return t;
}
