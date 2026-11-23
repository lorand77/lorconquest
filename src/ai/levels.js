// How strong the computer players are (TODO.md #30): a game's level, chosen by its host as the table is made and kept with the game
// (src/db.js, games.ai_level), the same for every computer country in it. A level is what the layers read from a country's
// character (index.js puts it there as `fl.level`), so a stronger player is the same code with other numbers, not another AI.
// For now both play alike: "hard" is where #31 will make the computer stronger — more aggressive late in the game, better at moving
// troops with its allies. A game's commands are saved and replayed without the AI, so a level changes no replay.
export const AI_LEVELS = ["normal", "hard"];
const LEVELS = {
    normal: { name: "normal" },
    hard: { name: "hard" },
};
export const levelOf = (name) => LEVELS[name] ?? LEVELS.normal;
