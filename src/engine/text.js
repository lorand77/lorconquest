// How the game reads in English: events as lines of text and places by name, for the runner in the terminal and
// the event feed on screen alike.

import { longDate } from "./calendar.js";

const fmt = (n) => Math.round(n).toLocaleString("en-GB");

// "48 Ulm", "pass P6", "the road 37 Munich–48 Ulm" for a leg key, or a sea zone's name
export function placeName(map, key) {
    if (map.zones.has(key)) return map.zones.get(key).name;
    if (String(key).includes("|")) return `the road ${String(key).split("|").map((k) => placeName(map, k)).join("–")}`;
    const n = map.nodes.get(String(key));
    return n.kind === "pass" ? `pass ${n.id}` : `${n.id} ${n.name}`;
}

export function describeEvent(map, e) {
    const place = (key) => placeName(map, key);
    const town = (id) => map.nodes.get(String(id))?.name ?? String(id);          // peace terms name settlements without their numbers
    const side = (s) => `${s.countries.join("+")} ${fmt(s.men)} ${s.unit ?? "men"}${s.cannons ? ` ${s.cannons} cannons` : ""} (×${s.roll}, power ${fmt(s.power)})`;
    const tech = (t) => t.replace(/([A-Z])/g, " $1").toLowerCase();
    switch (e.type) {
        case "war": return `${e.country} declares war on ${e.target}`;
        case "arrive": return `army ${e.army} (${e.owner}) halts at ${place(e.at)}`;
        case "blocked": return `army ${e.army} (${e.owner}) finds its way closed at ${place(e.at)}`;
        case "capture": return `${e.to} takes ${place(e.settlement)} from ${e.from} (${e.how})`;
        case "siegeStart": return `${e.by} besieges ${place(e.settlement)}: ${e.days} days`;
        case "siegeLifted": return `the siege of ${place(e.settlement)} is lifted`;
        case "surrender": return `${place(e.settlement)} surrenders to ${e.by}; ${fmt(e.disbanded)} men of ${e.owner} go home`;
        case "retreat": return `army ${e.army} (${e.owner}) retreats to ${place(e.to)}, ${Math.round(e.days)} days`;
        case "destroyed": return `army ${e.army} (${e.owner}) is destroyed: ${e.why}${e.dead ? `, ${fmt(e.dead)} dead` : ""}`;
        case "attrition": return `army ${e.army} (${e.owner}) loses ${fmt(e.dead)} men to ${[e.sick && "disease", e.hungry && "hunger"].filter(Boolean).join(" and ")}`;
        case "split": return `army ${e.army} (${e.owner}) splits off army ${e.into}`;
        case "merge": return `army ${e.army} (${e.owner}) joins army ${e.into}`;
        case "battle": {
            const win = e.winner === "a" ? e.a : e.b, lose = e.winner === "a" ? e.b : e.a;
            const ashore = [e.a, e.b].filter((x) => x.landing).map((x) => ` ${x.countries.join("+")}, just ashore from the sea, fights at ${Math.round(x.landing * 100)}%.`).join("");
            const extra = (e.kind === "storm" && e.winner === "a" ? ` The garrison rolls ${e.escape}: ${e.escape <= 3 ? "it escapes" : "it is lost"}.` : "") + ashore;
            return `${e.kind} at ${place(e.place)}: ${side(e.a)} against ${side(e.b)} — ${win.countries.join("+")} wins; dead ${win.countries.join("+")} ${fmt(win.dead)}, ${lose.countries.join("+")} ${fmt(lose.dead)}.${extra}`;
        }
        case "law": return `${e.country} changes its law to ${e.law}`;
        case "tech": return `${e.country} unlocks ${tech(e.tech)}`;
        case "harvest": return `a good harvest in ${e.country}`;
        case "plague": return `plague in ${e.country}: ${fmt(e.dead)} dead`;
        case "uprising": return `${e.faith ? `the ${e.faith} faithful rise` : "peasants rise"} against ${e.country} ${e.faith ? "in" : "outside"} ${place(String(e.at))}: ${fmt(e.men)} men${e.joined ? `, joining the rebels already up, ${e.rebels}` : `, ${e.rebels}`}`;
        case "scattered": return `army ${e.army} (${e.owner}) is beaten and scatters home`;
        case "default": return `${e.country} defaults on ${fmt(e.owed)} of loans`;
        case "desertion": return `${fmt(e.men)} mercenaries of ${e.country} desert`;
        case "bankruptcy": return `${e.country} goes bankrupt: ${e.buildings} buildings and ${fmt(e.weapons)} weapons sold`;
        case "cored": return `${place(String(e.settlement))} becomes core for ${e.country}`;
        case "risen": return `the rebels ${e.country} rise as a state: ${e.name}, with ${e.settlements} settlement${e.settlements === 1 ? "" : "s"}, its capital ${place(String(e.capital))}${e.war ? `, at war with ${e.of}` : ""}`;
        case "proclaimed": return `${e.country} proclaims ${e.region}: ${e.settlements} settlements become core${e.becomes ? `; ${e.was} is now ${e.becomes}` : ""}${e.hereditary ? "; the imperial crown is hereditary" : ""}`;
        case "capital": return `${e.country} names ${place(String(e.settlement))} its capital`;
        case "ready": return `${fmt(e.n)} ${e.what} of ${e.country} are ready at ${place(String(e.settlement))} (army ${e.army})`;
        case "cancelled": return `${e.what === "hire" ? "the hire of" : "the training of"} ${fmt(e.n)} men of ${e.country} at ${place(String(e.settlement))} is cancelled`;
        case "ships": return `${e.country} buys ${e.n} ${tech(e.kind)} at ${place(String(e.port))} (fleet ${e.fleet})`;
        case "fleetInPort": return `fleet ${e.fleet} (${e.owner}) ${e.fled ? `slips out of ${place(String(e.fled))}, lost, and ` : ""}enters ${place(String(e.port))}`;
        case "fleetPaidOff": return `fleet ${e.fleet} (${e.owner}) is paid off, ${fmt(e.ships)} ships: ${e.owner} has no port left${e.crew ? `, and its ${fmt(e.crew)} crew come home` : ""}`;
        case "fleetAtSea": return `fleet ${e.fleet} (${e.owner}) ${e.fled ? `slips out of ${place(String(e.fled))}, lost, and ` : ""}puts to sea in ${place(e.zone)}`;
        case "fleetSails": return `fleet ${e.fleet} (${e.owner}) sails from ${place(e.from)} to ${place(e.to)}, ${e.days} days`;
        case "fleetArrives": return `fleet ${e.fleet} (${e.owner}) arrives in ${place(e.zone)}`;
        case "blockade": return `fleet ${e.fleet} (${e.owner}) blockades ${place(String(e.port))}`;
        case "blockadeLifted": return `fleet ${e.fleet} (${e.owner}) lifts its blockade of ${place(String(e.port))}`;
        case "splitFleet": return `fleet ${e.fleet} (${e.owner}) splits off fleet ${e.into}`;
        case "mergeFleet": return `fleet ${e.fleet} (${e.owner}) joins fleet ${e.into}`;
        case "sharpshooters": return `the post at ${place(e.pass)} shoots ${fmt(e.dead)} men of army ${e.army} (${e.owner})`;
        case "postLost": return `the sharpshooters at ${place(e.pass)} die: ${fmt(e.dead)} men of ${e.owner}`;
        case "electionCalled": return `the throne is empty${e.country ? ` (${e.country})` : ""}: the electors will meet on ${longDate(e.on)}`;
        case "emperorDies": return `${e.country}'s Emperor dies`;
        case "chest": return `the Empire's war chest pays ${e.country}, the Emperor, ${fmt(e.money)} for its defence`;
        case "vacant": return `the imperial throne falls vacant${e.country ? `: ${e.country} can wear the crown no longer` : ""}`;
        case "elected": {
            const tally = (t) => Object.entries(t).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ");
            const how = e.runoff ? `first round ${tally(e.votes)}; second round ${tally(e.runoff)}` : tally(e.votes) || "no votes";
            return e.country ? `${e.country} is elected Emperor${e.country === e.previous ? " again" : ""} (${how})` : "no Emperor is elected";
        }
        case "authority": {
            const why = { peace: "a year with no war between German states", wars: "a year of wars between German states, 1 for each", defended: "the Emperor's defence of the Empire",
                kept: "land of the Empire kept by an outsider", executed: "a war of execution won", ban: "the imperial ban", capitulation: "the new Emperor's capitulation", refused: "the Emperor refusing to defend the Empire", attacked: "the Emperor attacking a German state", passed: "the crown changing hands" }[e.why] ?? e.why;
            return `the Emperor's authority ${e.delta > 0 ? "rises" : "falls"} to ${e.now} (${e.delta > 0 ? "+" : ""}${e.delta}: ${why})`;
        }
        case "ban": return `${e.country}, the Emperor, puts ${e.target} under the imperial ban: a war of execution`;
        case "reform": {
            const college = (k, name) => `${name} ${e.vote[k].yes}–${e.vote[k].no}`;
            return `${e.country} puts the ${e.name} to the Diet: ${e.passed ? "it passes" : "voted down"} (${college("electors", "electors")}, ${college("princes", "princes")}, ${college("cities", "cities")})`;
        }
        case "betrayed": return `${e.country} turns on ${e.subject}, its own protectorate: the protection is broken`;
        case "landfriede": return `${e.country} breaks the Eternal Public Peace, declaring war on ${e.target}`;
        case "defenderRefuses": return `${e.country}, the Emperor, refuses to defend ${e.ally} against ${e.enemy}`;
        case "promised": return `${e.country} promises ${e.to} ${fmt(e.money)} for its vote at the election`;
        case "crossFailed": return `army ${e.army} (${e.owner}) cannot cross the sea in ${place(e.zone)}: ${e.why}`;
        case "joins": return `${e.country} joins the war against ${e.enemy}, on the ${e.side === "att" ? "attacking" : "defending"} side`;
        case "offer": return `${e.from} asks ${e.country}: ${e.what}`;
        case "lapsed": return `${e.from}'s ${e.kind === "call" ? "call to arms" : e.kind} to ${e.country} lapses${e.kind === "call" ? ": it joins" : ""}`;
        case "answer": {
            const why = e.what === "peace" ? ` (war score ${e.score}, price ${e.cost})` : e.bar !== undefined ? ` (opinion ${e.opinion} + need ${Math.round(e.need)} against ${e.bar})` : "";
            return `${e.country} ${e.accepted ? "accepts" : "refuses"} ${e.from}'s proposal: ${e.what}${e.years ? ` for ${e.years} years` : ""}${why}`;
        }
        case "agreement": return `${e.a} and ${e.b} sign a ${e.kind === "guarantee" ? `guarantee (${e.a} guarantees ${e.b})` : e.kind === "access" ? `military access (${e.a} gives it to ${e.b})` : e.kind === "pact" ? "non-aggression pact" : `${e.kind} alliance${e.years ? ` for ${e.years} years` : ""}`}${e.why ? ` ${e.why}` : ""}`;
        case "ended": return `${e.country} ends its ${e.kind} with ${e.with}`;
        case "expired": return e.against ? `the alliance of ${e.a} and ${e.b} against ${e.against} lapses: the threat is past`
            : `the ${e.kind === "pact" ? "non-aggression pact" : e.kind === "defensive" || e.kind === "military" ? `${e.kind} alliance` : e.kind} between ${e.a} and ${e.b} runs out`;
        case "broke": return `${e.country} breaks an agreement: its alliances end, and the world remembers`;
        case "peace": return `${e.country} and ${e.with} make peace${[e.terms?.take?.length && `, ${e.country} takes ${e.terms.take.map(town).join(", ")}`, e.terms?.give?.length && `, ${e.country} gives ${e.terms.give.map(town).join(", ")}`, e.terms?.money && `, ${fmt(Math.abs(e.terms.money))} paid`, e.terms?.makeSubject && `, ${e.with} becomes its ${e.terms.makeSubject}`, e.terms?.becomeSubject && `, ${e.country} becomes its ${e.terms.becomeSubject}`].filter(Boolean).join("")}`;
        case "subject": return `${e.country} becomes a ${e.kind} of ${e.overlord}`;
        case "reformation": return `${e.country} adopts the Reformation: ${e.settlements} of its settlements turn Protestant, and the church lands bring ${fmt(e.money)}`;
        case "union": return `${e.country} and ${e.with} unite: ${e.with} becomes part of ${e.country}${e.name ? `, now ${e.name},` : ""} its ${e.settlements} settlements with it, and its ruler rules with ${e.country}'s`;
        case "integrated": return `${e.country} integrates its vassal ${e.subject}: ${e.settlements} settlements become its own`;
        case "freedom": return `${e.country} breaks free of ${e.overlord}`;
        case "eliminated": return `${e.country} is no more: its last settlement has fallen`;
        case "refused": return `${e.country} refuses ${e.from}'s demand ${e.what}`;
        case "empire": return `${e.country} demands the Empire: ${e.joined} join as protectorates, ${e.refused} refuse${e.asked ? `, ${e.asked} asked` : ""}`;
        case "league": return `${e.members.join(", ")} form the League`;
        case "victory": return `${e.country} wins with ${e.settlements} settlements${e.why === "end" ? " at the end date" : ""}`;
        default: return JSON.stringify(e);
    }
}

// the countries an event concerns, for filtering a player's feed
export function eventCountries(e) {
    switch (e.type) {
        case "war": return [e.country, e.target];
        case "capture": return [e.from, e.to];
        case "siegeStart": case "siegeLifted": return [e.by];
        case "uprising": return [e.country, e.rebels];
        case "risen": return [e.country, e.of];
        case "joins": case "offer": case "lapsed": case "answer": case "refused": return [e.country, e.enemy ?? e.from];
        case "peace": case "ended": return [e.country, e.with];
        case "agreement": case "expired": return [e.a, e.b];
        case "subject": case "freedom": return [e.country, e.overlord];
        case "integrated": return [e.country, e.subject];
        case "union": return [e.country, e.with];
        case "reformation": return [e.country];
        case "eliminated": return [e.country];
        case "league": return e.members;
        case "surrender": return [e.owner, e.by];
        case "battle": return [...e.a.countries, ...e.b.countries];
        case "promised": return [e.country, e.to];
        case "defenderRefuses": return [e.country, e.ally, e.enemy];
        case "landfriede": return [e.country, e.target];
        case "betrayed": return [e.country, e.subject];
        default: if (e.concern) return e.concern; return e.owner ? [e.owner] : e.country ? [e.country] : [];
    }
}
