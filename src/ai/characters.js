// The characters a computer country can have (docs/design.md, "Characters and rivalries"). A scenario gives each of its
// countries one, from history (SCENARIO.md, Characters); each game then varies it a little, from the seed, so a country
// keeps its nature but is not scripted. A country a scenario says nothing about gets a character rolled at random.
//
// A character is three numbers from 0 to 1, which the rest of the AI reads (util.js, flavorOf):
//   aggression     how readily it plans a war, how weak a target must be, how many wars it runs, whether it seeks pacts
//   friendliness   how often it proposes alliances and pacts
//   builder        whether it buys libraries and walls
// The spread a scenario must keep — no character for more than 30% of its countries, every one for at least two, and the
// two warlike ones together for no more than 30% — is checked by tools/map.js, which reads the list from here.
export const CHARACTERS = {
    conqueror: { aggression: 0.9, friendliness: 0.4, builder: 0.45, text: "expands by war, two at a time when it can, and seeks no pacts" },
    zealot: { aggression: 0.85, friendliness: 0.3, builder: 0.35, text: "a crusading order or a cause in arms: fights, and trusts few" },
    opportunist: { aggression: 0.65, friendliness: 0.55, builder: 0.5, text: "attacks whoever is weak enough, and keeps its hands free of pacts" },
    diplomat: { aggression: 0.45, friendliness: 0.95, builder: 0.55, text: "allies, and gains by marriage and demand more than by war" },
    defender: { aggression: 0.3, friendliness: 0.7, builder: 0.65, text: "holds what it has: walls, alliances, rarely a war of its own" },
    merchant: { aggression: 0.3, friendliness: 0.6, builder: 0.95, text: "builds and trades, signs pacts, and pays its way" },
};
export const WARLIKE = ["conqueror", "zealot"];

// how much each game moves each number, either way
export const NOISE = 0.12;
