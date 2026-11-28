# TODO

What is still to do, by priority. Each item has a number that never changes — "do 26 and 31" — and a tag for its area and a
rough size (S, M, L). An item is deleted in the commit that finishes it: git history is the archive. New items take the next free
number. Moved here from GitHub issue #1 (its open items only) on 2026-11-21.

## Now


## Next

- [ ] #30 Hard and normal computer players — AI, L. The ground is laid: a game's level (src/ai/levels.js, games.ai_level, `fl.level`,
  `--level` in simulate.js and strength.js) and the lobby's choice, hidden (lobbylogic.js, AI_LEVEL_CHOICE); the hard level itself with #31
- [ ] #31 Smarter computer players, as the hard level (src/ai/levels.js) — AI, L. Bolder from 1550 and ganging up at 60% are in,
  and measured no stronger; harder peace terms were tried and taken out (experiments/, 30–31). Strength needs better choices —
  which wars, where to march — not bolder settings; the lobby's choice stays hidden till then (#30)

## Later

- [ ] #49 Support games of previous versions: replays (and what else needs them) of games played under an older RULES_VERSION, which are refused now — keep the old engines — replay, L
- [ ] #42 A smaller version of the Europe map — map, L
- [ ] #60 Bug: a peace deal with a rival cannot make it a vassal (found on Europe 1440: Compact) — rules, S
- [ ] #57 Armies stranded at a strait: an army waiting to cross should get ships sailed to the crossing's sea zone, and give up the move after a few refusals — in one Compact game an English army in Calais asked to cross 2,189 times (experiments/README.md, 34) — AI, M

## Ideas

- [ ] #54 An easter egg: play as rebels — start an uprising in a country and lead it — rules, screen, M
- [ ] #43 A world map — map, L
- [ ] #44 Music — screen, M

