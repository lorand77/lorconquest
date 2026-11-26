// How strong the computer players are (TODO.md #30, #31): a game's level, chosen by its host as the table is made and kept with the
// game (src/db.js, games.ai_level) — and, if the host chooses, another for the Empire's members (games.ai_empire): the German
// states' computer players at that level, the rest at the game's. A level is what the layers read from a country's character
// (index.js puts it there as `fl.level`, worked out at each think, as a country may become a German state or cease to be), so a
// stronger player is the same code with other switches, not another AI. A game's commands are saved and replayed without the AI,
// so a level changes no replay.
//   normal  the computer as it has long been
//   hard    bolder as the age wears on — its aggression up by `lateAggression` from LATE_FROM to the end year, as the Italian Wars
//           and the Thirty Years' War came — and quicker to gang up on a leader: at `leaderShare` of the victory target, not 75%
// (Harder peace terms — fighting on while winning, holding out while losing — were tried and taken out: no stronger, and more
// countries lost — experiments/, section 31.)
// (A medium level that fought beside its allies was tried and taken out: it measured no stronger — experiments/, section 30.)
export const AI_LEVELS = ["normal", "hard"];
export const LATE_FROM = 1550;
const LEVELS = {
    normal: { name: "normal", lateAggression: 0, leaderShare: 0.75 },
    hard: { name: "hard", lateAggression: 0.3, leaderShare: 0.6 },
};
export const levelOf = (name) => LEVELS[name] ?? LEVELS.normal;
