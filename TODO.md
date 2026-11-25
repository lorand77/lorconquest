# TODO

What is still to do, by priority. Each item has a number that never changes — "do 26 and 31" — and a tag for its area and a
rough size (S, M, L). An item is deleted in the commit that finishes it: git history is the archive. New items take the next free
number. Moved here from GitHub issue #1 (its open items only) on 2026-11-21.

## Now


## Next

- [ ] #30 Hard and normal computer players — AI, L. The ground is laid: a game's level (src/ai/levels.js, games.ai_level, `fl.level`,
  `--level` in simulate.js and strength.js) and the lobby's choice, hidden (lobbylogic.js, AI_LEVEL_CHOICE); the hard level itself with #31
- [ ] #31 Smarter computer players: more aggressive late in the game, as the hard level (src/ai/levels.js) — AI, L. Better troop
  movement with allies was tried as a medium level and taken out: it measured no stronger (experiments/, 30)

## Later

- [ ] #37 More buildings, such as a university — rules, M
- [ ] #39 Better replay — replay, M
- [ ] #49 Support games of previous versions: replays (and what else needs them) of games played under an older RULES_VERSION, which are refused now — keep the old engines — replay, L
- [ ] #42 A smaller version of the Europe map — map, L
- [ ] #53 A map of Italy — map, L

## Ideas

- [ ] #54 An easter egg: play as rebels — start an uprising in a country and lead it — rules, screen, M
- [ ] #43 A world map — map, L
- [ ] #44 Music — screen, M

