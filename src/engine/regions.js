// Proclaiming a region (SCENARIO.md, Special coring; RULES.md §2): may a country do it now, and which settlements would become
// its core. One answer for the command (commands-country.js, proclaim), the computer (src/ai/economy.js) and the Country tab
// (public/js/panels.js). A capital of the country — in a union any of them — lies in the region, and it and its vassals hold all
// of it; or, for a region with `needs` (the Roman Empire), the settlements it names and that many of the region in all, those
// named among them — and then every settlement of the region becomes its core, held or not.
import { isVassal, overlordOf } from "./relations.js";
import { capitalsOf } from "./state.js";

// held by the country or one of its vassals (not a protectorate, which keeps its own diplomacy), as for winning
const oursFor = (st, code) => (owner) => owner === code || (isVassal(st, owner) && overlordOf(st, owner) === code);

// how far a country is with a region: { held, needed, named (the needed settlements it lacks), capital (one of its capitals is
// in it), fresh (the settlements that would become core), error (why it may not proclaim it now, or null) }
export function proclaimCheck(game, code, region) {
    const st = game.state, c = st.countries[code], ours = oursFor(st, code);
    const held = region.settlements.filter((id) => ours(st.settlements[id]?.owner)).length;
    const needed = region.needs?.count ?? region.settlements.length;
    const named = (region.needs?.settlements ?? []).filter((id) => !ours(st.settlements[id]?.owner));
    const capital = capitalsOf(st, code).some((id) => region.settlements.includes(id));
    const fresh = region.settlements.filter((id) => !st.settlements[id].cores.includes(code));
    const name = (id) => game.map.scenario.settlements.find((s) => s.id === id)?.name ?? id;
    let error = null;
    // a region only the Emperor may proclaim (the Kaiserreich), with the crown's authority at least so high
    const emp = st.empire, crown = region.emperor;
    if (crown && emp?.emperor !== code) error = `only the Emperor may proclaim ${region.name}`;
    else if (crown && emp.authority < crown.authority) error = `${region.name} needs Imperial Authority of ${crown.authority}; it is ${Math.floor(emp.authority)}`;
    else if (!capital) error = c?.seats?.length ? "one of your capitals must lie within the region" : "your capital must lie within the region";
    else if (!region.needs && held < needed) error = `you and your vassals must control all of ${region.name}; ${needed - held} settlements are not yours or theirs`;
    else if (named.length) error = `you and your vassals must control ${named.map(name).join(" and ")} to proclaim ${region.name}`;
    else if (held < needed) error = `you and your vassals must control ${needed} of ${region.name}'s ${region.settlements.length} settlements; you hold ${held}`;
    else if (!fresh.length) error = `${region.name} is already core`;
    return { held, needed, named, capital, fresh, error };
}
