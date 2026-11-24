// How strong the computer players are (TODO.md #30, #31): a game's level, chosen by its host as the table is made and kept with the
// game (src/db.js, games.ai_level) — and, if the host chooses, another for the Empire's members (games.ai_empire): the German
// states' computer players at that level, the rest at the game's. A level is what the layers read from a country's character
// (index.js puts it there as `fl.level`, worked out at each think, as a country may become a German state or cease to be), so a
// stronger player is the same code with other switches, not another AI. A game's commands are saved and replayed without the AI,
// so a level changes no replay.
//   normal  the computer as it has long been
//   medium  besides, it fights beside its allies (war.js): an allied army at a town or an enemy army is counted with its own, so it
//           storms and attacks with them where it would not alone; and a town of an ally's an enemy marches on is defended
//           before it is besieged, as its own are
//   hard    as medium, for now; #31's other half (more aggressive late in the game) is to come
export const AI_LEVELS = ["normal", "medium", "hard"];
const LEVELS = {
    normal: { name: "normal", allies: false },
    medium: { name: "medium", allies: true },
    hard: { name: "hard", allies: true },
};
export const levelOf = (name) => LEVELS[name] ?? LEVELS.normal;
