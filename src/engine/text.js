// How the game reads in English: events as lines of text and places by name, for the runner in the terminal and
// the event feed on screen alike.

const fmt = (n) => Math.round(n).toLocaleString("en-GB");

// "48 Ulm", "pass P6", or "the road 37 Munich–48 Ulm" for a leg key
export function placeName(map, key) {
    if (String(key).includes("|")) return `the road ${String(key).split("|").map((k) => placeName(map, k)).join("–")}`;
    const n = map.nodes.get(String(key));
    return n.kind === "pass" ? `pass ${n.id}` : `${n.id} ${n.name}`;
}

export function describeEvent(map, e) {
    const place = (key) => placeName(map, key);
    const side = (s) => `${s.countries.join("+")} ${fmt(s.men)} men${s.cannons ? ` ${s.cannons} cannons` : ""} (×${s.roll}, power ${fmt(s.power)})`;
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
        default: return JSON.stringify(e);
    }
}

// the countries an event concerns, for filtering a player's feed
export function eventCountries(e) {
    switch (e.type) {
        case "war": return [e.country, e.target];
        case "capture": return [e.from, e.to];
        case "siegeStart": case "siegeLifted": return [e.by];
        case "surrender": return [e.owner, e.by];
        case "battle": return [...e.a.countries, ...e.b.countries];
        default: return e.owner ? [e.owner] : [];
    }
}
