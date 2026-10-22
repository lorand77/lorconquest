// How the game reads in English: events as lines of text and places by name, for the runner in the terminal and
// the event feed on screen alike.

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
            const extra = e.kind === "storm" && e.winner === "a" ? ` The garrison rolls ${e.escape}: ${e.escape <= 3 ? "it escapes" : "it is lost"}.` : "";
            return `${e.kind} at ${place(e.place)}: ${side(e.a)} against ${side(e.b)} — ${win.countries.join("+")} wins; dead ${win.countries.join("+")} ${fmt(win.dead)}, ${lose.countries.join("+")} ${fmt(lose.dead)}.${extra}`;
        }
        case "law": return `${e.country} changes its law to ${e.law}`;
        case "tech": return `${e.country} unlocks ${tech(e.tech)}`;
        case "harvest": return `a good harvest in ${e.country}`;
        case "plague": return `plague in ${e.country}: ${fmt(e.dead)} dead`;
        case "uprising": return `peasants rise against ${e.country} outside ${place(String(e.at))}: ${e.rebels}, ${fmt(e.men)} men`;
        case "scattered": return `army ${e.army} (${e.owner}) is beaten and scatters home`;
        case "default": return `${e.country} defaults on ${fmt(e.owed)} of loans`;
        case "desertion": return `${fmt(e.men)} mercenaries of ${e.country} desert`;
        case "bankruptcy": return `${e.country} goes bankrupt: ${e.buildings} buildings and ${fmt(e.weapons)} weapons sold`;
        case "cored": return `${place(String(e.settlement))} becomes core for ${e.country}`;
        case "proclaimed": return `${e.country} proclaims ${e.region}: ${e.settlements} settlements become core`;
        case "capital": return `${e.country} names ${place(String(e.settlement))} its capital`;
        case "ready": return `${fmt(e.n)} ${e.what} of ${e.country} are ready at ${place(String(e.settlement))} (army ${e.army})`;
        case "cancelled": return `${e.what === "hire" ? "the hire of" : "the training of"} ${fmt(e.n)} men of ${e.country} at ${place(String(e.settlement))} is cancelled`;
        case "ships": return `${e.country} buys ${e.n} ${tech(e.kind)} at ${place(String(e.port))} (fleet ${e.fleet})`;
        case "fleetInPort": return `fleet ${e.fleet} (${e.owner}) ${e.fled ? `slips out of ${place(String(e.fled))}, lost, and ` : ""}enters ${place(String(e.port))}`;
        case "fleetAtSea": return `fleet ${e.fleet} (${e.owner}) ${e.fled ? `slips out of ${place(String(e.fled))}, lost, and ` : ""}puts to sea in ${place(e.zone)}`;
        case "fleetSails": return `fleet ${e.fleet} (${e.owner}) sails from ${place(e.from)} to ${place(e.to)}, ${e.days} days`;
        case "fleetArrives": return `fleet ${e.fleet} (${e.owner}) arrives in ${place(e.zone)}`;
        case "blockade": return `fleet ${e.fleet} (${e.owner}) blockades ${place(String(e.port))}`;
        case "splitFleet": return `fleet ${e.fleet} (${e.owner}) splits off fleet ${e.into}`;
        case "mergeFleet": return `fleet ${e.fleet} (${e.owner}) joins fleet ${e.into}`;
        case "sharpshooters": return `the post at ${place(e.pass)} shoots ${fmt(e.dead)} men of army ${e.army} (${e.owner})`;
        case "postLost": return `the sharpshooters at ${place(e.pass)} die: ${fmt(e.dead)} men of ${e.owner}`;
        case "crossFailed": return `army ${e.army} (${e.owner}) cannot cross the strait in ${place(e.zone)}: ${e.why}`;
        case "joins": return `${e.country} joins the war against ${e.enemy}, on the ${e.side === "att" ? "attacking" : "defending"} side`;
        case "offer": return `${e.from} asks ${e.country}: ${e.what}`;
        case "lapsed": return `${e.from}'s ${e.kind === "call" ? "call to arms" : e.kind} to ${e.country} lapses${e.kind === "call" ? ": it joins" : ""}`;
        case "answer": {
            const why = e.what === "peace" ? ` (war score ${e.score}, price ${e.cost})` : e.bar !== undefined ? ` (opinion ${e.opinion} + need ${Math.round(e.need)} against ${e.bar})` : "";
            return `${e.country} ${e.accepted ? "accepts" : "refuses"} ${e.from}'s proposal: ${e.what}${why}`;
        }
        case "agreement": return `${e.a} and ${e.b} sign a ${e.kind === "guarantee" ? `guarantee (${e.a} guarantees ${e.b})` : e.kind === "access" ? `military access (${e.a} gives it to ${e.b})` : e.kind === "pact" ? "non-aggression pact" : `${e.kind} alliance`}${e.why ? ` ${e.why}` : ""}`;
        case "ended": return `${e.country} ends its ${e.kind} with ${e.with}`;
        case "expired": return e.against ? `the alliance of ${e.a} and ${e.b} against ${e.against} lapses: the threat is past`
            : `the ${e.kind === "pact" ? "non-aggression pact" : e.kind} between ${e.a} and ${e.b} runs out`;
        case "broke": return `${e.country} breaks an agreement: its alliances end, and the world remembers`;
        case "peace": return `${e.country} and ${e.with} make peace${[e.terms?.take?.length && `, ${e.country} takes ${e.terms.take.join(", ")}`, e.terms?.give?.length && `, ${e.country} gives ${e.terms.give.join(", ")}`, e.terms?.money && `, ${fmt(Math.abs(e.terms.money))} paid`, e.terms?.makeSubject && `, ${e.with} becomes its ${e.terms.makeSubject}`, e.terms?.becomeSubject && `, ${e.country} becomes its ${e.terms.becomeSubject}`].filter(Boolean).join("")}`;
        case "subject": return `${e.country} becomes a ${e.kind} of ${e.overlord}`;
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
        case "joins": case "offer": case "lapsed": case "answer": case "refused": return [e.country, e.enemy ?? e.from];
        case "peace": case "ended": return [e.country, e.with];
        case "agreement": case "expired": return [e.a, e.b];
        case "subject": case "freedom": return [e.country, e.overlord];
        case "eliminated": return [e.country];
        case "league": return e.members;
        case "surrender": return [e.owner, e.by];
        case "battle": return [...e.a.countries, ...e.b.countries];
        default: return e.owner ? [e.owner] : e.country ? [e.country] : [];
    }
}
