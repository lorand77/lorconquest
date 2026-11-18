// A scenario's page on the Rules page (rules.js), written as Markdown for markdown.js from its scenario.json — so it is always
// what the game plays: what wins, what its x makes things cost, how 1440 stands (wars, agreements), the regions to proclaim and
// the new states they make, the Empire, the faiths, its achievements and its countries. The computer's characters are left out:
// they are how it plays, not rules. Pure, and tested in Node.
import { RELIGION_NAMES, SHARPSHOOTERS_PER_PASS, TECHS } from "/engine/index.js";
import { TECH_NAMES } from "./panels.js";

const fmt = (n) => Math.round(n).toLocaleString("en-US");
// a tech by name; the ones every country starts with (swords, cogs) by their own, capitalised
const techName = (t) => TECH_NAMES[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
const millions = (r) => `${Number((r / 1e6).toFixed(2))}M`;
const list = (codes, name) => codes.map(name).join(", ");
// a table cell may not hold a "|"
const cell = (s) => String(s).replace(/\|/g, "/");

const AGREEMENTS = { military: "Military alliance", defensive: "Defensive alliance", pact: "Non-aggression pact", access: "Military access" };

// the page, as Markdown; `name` is the scenario's name as the lobby shows it
export function scenarioPage(sc, name) {
    const country = new Map(sc.countries.map((c) => [c.code, c]));
    const countryName = (code) => country.get(code)?.name ?? code;
    const place = new Map(sc.settlements.map((s) => [s.id, s.name]));
    const x = sc.scaleX ?? 1, out = [`# ${name}`];
    if (sc.about) out.push(sc.about);

    // what wins
    out.push("## Winning",
        `Hold **${sc.victory.settlements}** of the map's ${sc.settlements.length} settlements — your vassals' count, a protectorate's half — or have the most at the start of **${sc.victory.endYear}**. ${sc.countries.length} countries; if a computer country wins, every person loses.`);

    // what x does here
    out.push(`## Scale: x = ${x}`,
        `This scenario's **x** multiplies tech costs, starting treasuries, the flat research every country gets, the sharpshooters a pass holds, the cannons that count against walls and the ships needed to cross a strait ([the scaling note](#rules)). Shop prices are the same everywhere.`,
        "| Technology | Needs | Cost |", "|---|---|---|",
        ...Object.entries(TECHS).map(([t, d]) => `| ${techName(t)} | ${techName(d.needs)} | ${millions(d.cost * 1e6 * x)} R |`),
        "",
        `- Research: **${fmt(10000 * x)} R** a year for every country, whatever its slider.`,
        `- Treasury at the start: **${x === 1 ? "" : `${x} × `}pop × 2** — ${fmt(x * 10000 * 2)} for a country of one town.`,
        `- Crossing a strait: **${sc.straitShips ?? 10 * x}** of your ships in its sea zone.`,
        `- A mountain pass holds at most **${fmt(SHARPSHOOTERS_PER_PASS * x)}** sharpshooters; every **${fmt(100 * x)}** cannons a besieger brings weaken the walls.`);

    // 1440
    const wars = sc.start?.wars ?? [], agreements = sc.start?.agreements ?? [], subjects = sc.start?.subjects ?? [], walled = sc.settlements.filter((s) => s.walls);
    if (wars.length || agreements.length || subjects.length || walled.length) {
        out.push("## The situation at the start");
        if (wars.length) out.push("**Wars**", "", ...wars.map((w) => `- ${w.name}: ${list(w.attackers, countryName)} against ${list(w.defenders, countryName)}`), "");
        if (agreements.length) out.push("**Agreements**", "", ...agreements.map((a) => a.kind === "guarantee"
            ? `- ${countryName(a.a)} guarantees ${countryName(a.b)}`
            : `- ${AGREEMENTS[a.kind] ?? a.kind}: ${countryName(a.a)} and ${countryName(a.b)}${a.yearsLeft ? `, ${a.yearsLeft} years left` : ""}`), "");
        if (subjects.length) out.push("**Subjects**", "", ...subjects.map((x) => `- ${countryName(x.subject)}, ${x.kind} of ${countryName(x.overlord)}`), "");
        if (walled.length) out.push(`**Walled from the start:** ${walled.map((s) => s.name).join(", ")}.`);
    }

    // the regions to proclaim
    const regions = sc.formables ?? [];
    if (regions.length) {
        out.push("## Regions to proclaim",
            "Hold all of a region, with your capital in it, and you may proclaim it: every settlement in it becomes your core at once. Some make a new state, which renames your country. A region that needs only part of it is proclaimed with that part, and then every settlement in it is your core, held or not — each one you take later is core the day it falls.",
            "| Region | Settlements | Becomes |", "|---|---|---|",
            // a region proclaimed with part of it (its Needs) says what, and is too large to list
            ...regions.map((f) => `| ${cell(f.name)} | ${f.needs ? `${f.settlements.length} settlements — hold **${f.needs.count}**, with ${f.needs.settlements.map((id) => place.get(id) ?? id).join(" and ")}` : cell(f.settlements.map((id) => place.get(id) ?? id).join(", "))} | ${f.becomes ? cell(f.becomes.name) : "—"} |`));
    }

    // the Empire
    if (sc.empire?.needed) {
        const inside = sc.settlements.filter((s) => s.hre).length;
        out.push("## The Holy Roman Empire",
            `${inside} settlements lie in the Empire. Hold **${sc.empire.needed}** of them and you may demand it, once in a game: every German state becomes your protectorate or joins a league against you ([the rules](#rules-10)).`);
    }

    // the faiths
    const faiths = [...new Set(sc.countries.map((c) => c.religion).filter(Boolean))];
    if (faiths.length) {
        out.push("## Religions",
            `A country's faith sets part of the computer's opinion of it; land of another faith takes longer to comply and rises more readily ([the rules](#rules-2)). A settlement's people keep the faith of its owner in 1440, unless the scenario gives them their own: ${sc.settlements.filter((x) => x.faith).length} settlements here.`,
            "| Faith | Countries |", "|---|---|",
            ...faiths.map((f) => {
                const of = sc.countries.filter((c) => c.religion === f);
                return `| ${RELIGION_NAMES[f] ?? f} | ${of.length > 30 ? `${of.length} countries — every one not listed here` : cell(of.map((c) => c.name).join(", "))} |`;
            }));
        // the Reformation, and who leans to it (RULES.md §2)
        const leans = sc.countries.filter((c) => c.leans), bulwarks = sc.countries.filter((c) => c.bulwark);
        out.push(`From **31 October 1517** a Catholic or Hussite country may adopt the Reformation and turn Protestant, with its core land of its old faith: the church lands bring a year of its settlement money, Catholics then think the worse of it, and its peasants are restless for 5 years.${leans.length ? ` The computer does so only in the lands where it happened, until 1600 — those of ${leans.map((c) => c.name).join(", ")}.` : ""}${bulwarks.length ? ` These never do, as the computer plays them: ${bulwarks.map((c) => c.name).join(", ")}.` : ""}`);
    }

    // its own achievements
    if (sc.achievements?.length) {
        out.push("## Achievements of this scenario", "| | Achievement | |", "|---|---|---|",
            ...sc.achievements.map((a) => `| ${a.icon ?? ""} | ${cell(a.name)} | ${cell(a.desc ?? "")} |`));
    }

    // the countries, largest first
    out.push("## Countries", `| Country | Capital | Settlements | People${faiths.length ? " | Faith" : ""} |`, `|---|---|---|---${faiths.length ? "|---" : ""}|`,
        ...[...sc.countries].sort((a, b) => b.pop - a.pop || (a.name < b.name ? -1 : 1)).map((c) =>
            `| ${cell(c.name)} | ${cell(place.get(c.capital) ?? "—")} | ${c.settlements.length} | ${fmt(c.pop)}${faiths.length ? ` | ${RELIGION_NAMES[c.religion] ?? "—"}` : ""} |`));
    return out.join("\n\n").replace(/\n\n(?=\|)/g, "\n").replace(/\n\n(?=- )/g, "\n");
}
