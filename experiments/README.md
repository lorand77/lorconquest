# Experiments

What `tools/simulate.js` showed about the computer players, and what was changed because of it. Each entry says what was
run, what came out, and what it led to. Re-run with e.g. `node tools/simulate.js --games 24 --years 210 --jobs 8`
(about 7 minutes); `SIM_DEBUG=1` prints every command the engine refused.

## 1. First full sweeps (2026-10-20, milestone 5)

Every country played by `src/ai`, seeds 1–24, 1440 to the 1650 end date.

| | Mitteleuropa (`docs`), 24 games | Historical 1440, 8 games |
|---|---|---|
| Games that ran to the end without an error | 24 of 24 | 8 of 8 |
| Wars declared / joined, per game | 17 / 6.5 | 7.6 / 11.6 |
| Peaces, per game | 23.5 | 23.4 |
| Settlements captured, per game | 34 | 37 |
| Countries left at the end | 35.5 of 45 | 66 of ~75 |
| AI time per game day | 1.0 ms (slowest day 33 ms) | 2.8 ms (slowest 30 ms) |
| Commands refused by the engine, per game | about 3 | about 4 |

Nobody reaches the victory threshold (45 settlements); every game is decided at the end date by the most settlements.

**Winners, Mitteleuropa:** RUH 5, PRU 4, WAR 3, BRB 3, GDA 3, SCH 2, and LDK, BAV, BOH, LIT 1 each — ten different winners
in 24 games, the richest starts (RUH, PRU, GDA) a little ahead of the rest. **Historical:** TEU 3, HUN 2, BOH, BUR, POL 1.
These are small samples; a ±2 on a count of 5 is noise. Hold any balance change until a sweep of 50+ games says the same.

**Most wars declared:** the countries with the most aggressive characters (`flavorOf`) and room to grow — SCH, PRU, STO, NOR,
WAR, GDA. Countries boxed in by stronger neighbours rarely declare anything, which is as intended.

## 2. What the first runs found, and the fixes

- **Bankruptcy for ever.** 2,800 `bankruptcy` events a game: a country with no settlement left kept a negative treasury, and
  every month the engine "sold it up" again. An engine bug, not the AI's: a landless country now has no monthly step
  (RULES.md §2; rules version 4).
- **No wars at all.** Pacts with every neighbour (the AI signed them freely) ruled every neighbour out as a target, and the
  strength bar was 1.8×. Now a warlike country (aggression above 0.6) seeks no pacts unless threatened, and the bar is
  1.1–1.4×. Wars went from 0.1 to about 20 per 100 years.
- **Money piled up** — 41 years of income in the treasury by 1590, since a country has only a handful of buildings to
  buy. Added: mercenaries in a war (they come on top of the army cap), sharpshooters at exposed passes, the research slider
  at 100% when rich, and people (1,000 for 0.1M) from what is left. Treasuries now sit near 1.7 years of income.
- **Recruits never armed** when no gun was researched yet (a duplicate key in an object literal sent the pikes to zero).
  Found by the unit test, not by the sweeps — which is why each layer has one.
- **A peace that gained nothing.** A country far ahead asked for peace with a siege half done, taking only money. It now
  waits for a siege that ends within 200 days, and a dictated peace must take at least one settlement (a white peace waits
  for two years of stalemate).
- **Refusals** fell from thousands a game (equip on retreating armies; sharpshooters over the army cap, from a negative
  lot count) to the odd race — two countries proposing the same pact on the same day, a treasury spent between a think and
  its command.

## 3. Open questions for the next sweep

- **Pace.** About 17 wars and 34 conquests in 210 years is moderate; whether it is *enough* for a human playing 1 hour of
  game per 2 minutes of real time can only be told by playing. The knobs: the plan chance in `diplomacy.js`
  (`0.03 + 0.1 × aggression` per think), the strength bars, and the 40-day muster.
- **People as a money sink** makes populations grow faster than the rules' 1% a year; men in all armies roughly doubled over
  150 years. Watch whether it makes late-game countries too hard to conquer.
- **Navies.** The AI never sails; the straits stay shut to it. Not measured, since it changes nothing it does.
- **Cannons.** Never bought; sieges are long (pop ÷ 20,000 years). A siege-heavy AI would take cities faster.

## 4. Every country thinks every 15 days (2026-10-22)

The first schedule gave each country its own period, 10 to 20 days, from a hash of its code: a side effect of staggering, not a
choice. But the war-planning roll, the peace and alliance proposals and the re-targeting of armies all happen once per think, so
a country with a 10-day period had twice the chances of one with 20. Now every country thinks every 15 days, on a day of its own
(`THINK_DAYS` in `src/ai/util.js`); the load is spread the same, about 3 countries a tick.

Checked with the same 24 games on the Mitteleuropa map: 18.4 wars declared (17.4 before), 25.7 peaces (23.5), 35.0 captures
(34.1), AI time 0.9 ms a day (0.9 before); eleven different winners (ten before), RUH again the most (5), the rest spread. Nothing
that is not within the noise of two samples of 24. I did not first measure how much the old unequal periods skewed the results.

That sweep also found a defect the earlier ones had not met: 15 bankruptcies a game. One country (NED, in seed 3) had borrowed in a
war, lost most of its land, and was left with 10,000 a year of income against 16,000 of interest and 916 soldiers on a cap of
350 — in debt for 30 years, "sold up" by the engine every month with nothing left to sell, until it was conquered. A country in
distress now taxes at 3, sends home the soldiers above its cap (unarmed first) and, after a year in debt, defaults on its loans;
it no longer tries to borrow while the bankers refuse it. Sweeps since: 0 bankruptcies in 24 games.

## 5. Characters and rivalries (2026-10-22)

Each country now plays to a character its scenario gives it (six of them; `src/ai/characters.js`), varied by up to 0.12 per
game, and holds rivalries the scenario lists (design.md, *Characters and rivalries*). Sweeps of 24 games on Mitteleuropa and 8 on
the historical scenario, 210 years each; `tools/simulate.js --without characters|rivalries` plays one or the other off.

| Historical, 8 games | Winners | Wars joined per game |
|---|---|---|
| neither (before) | TEU 3, HUN 2, BOH, BUR, POL | 11.6 |
| characters only | TEU 3, HUN 2, POL, AUS, BOH | 16.3 |
| rivalries only (first version) | TEU 3, BUR 2, BOH 2, POL | 34.0 |
| both, first version | BUR 6–7, TEU 1–2 | 37–48 |
| both, rival only preferred ×3 | BUR 6, TEU 2 | 34.4 |
| both, rival only preferred ×1.5 (kept) | BUR 3, TEU 2, STY, BRA, HUN | 31.5 |

The characters alone change little. The first rivalries — attack a rival at a margin 0.2 smaller, hold out a year longer for
peace, ally first with a rival's other enemies — turned wars between rivals into wars between alliance blocs: Burgundy, a
conqueror ringed by five small rivals, ate them while the eastern powers, each other's rivals, bled each other. Dropping the
alliance push and the strength cap changed little; dropping the margin and the longer peace, and making the preference ×1.5
instead of ×3, brought the historical winners back to five different countries. Wars still pull in about three times as many
allies as before.

| Mitteleuropa, 24 games | Winners |
|---|---|
| neither (before) | RUH 5, SAX 4, GDA 3, WAR 3, BAV 2, BRB 2, and 5 others once |
| both, first version | BRB 9 / 7, PRU 5, RUH 3–5 … |
| both, rival only preferred ×3 | RUH 11, HUN 2, WAR 2, BRB 2, … |
| both, rival only preferred ×1.5 (kept) | **RUH 12**, HUN 2, LIT 2, WAR 2, and 6 others once |

On Mitteleuropa the Ruhr, an opportunist of 50K people among small merchants, diplomats and defenders on the Rhine, won half
the games. Made a defender instead — truer to Cleves, Jülich and Berg, which grew by marriage and inheritance — the same 24 games
had thirteen different winners: BRB 4, PRU 4, LIT 3, SCH 2, GDA 2, SAX 2, and seven others once (RUH among them); 17.6 wars
declared and 10.3 joined a game (18.4 and 7.8 before characters), 39 captures (35). AI time a day: mean 1.2 ms, p95 3.2 ms.

## 6. Fewer alliances (2026-10-22)

Declaring war on anyone brought in a crowd: one computer-only game per map, asking every five years how many countries would
join against a neighbour that declared war on each country (almost all of them its defensive allies, who join on their own).

| | year 1 | year 5 | year 25 |
|---|---|---|---|
| Mitteleuropa, before: defensive alliances / joiners on average (most) | 33 / 1.2 (6) | 89 / 6.3 (15) | 103 / 5.6 (10) |
| Mitteleuropa, sparing proposals | 8 / 0.4 (2) | 82 / 5.9 (14) | 86 / 5.5 (13) |
| Historical, before | 131 / 3.9 (12) | 302 / 10.3 (29) | 304 / 11.4 (23) |
| Historical, sparing proposals | 28 / 1.0 (2) | 233 / 7.9 (29) | 218 / 8.0 (25) |

A computer country now asks for a defensive alliance only when it feels threatened, only of a neighbour at least 80% as strong,
and neither of the two may hold two alliances already (`src/ai/diplomacy.js`). That fixed the first year. The webs that still
grow after it are not the AI's: in the same games, of the defensive alliances signed in 10 years, the computers' own proposals
made 29 (Mitteleuropa) and 43 (historical), and the **coalition rule** (RULES.md §10: every year the computer neighbours of a
warmonger with 30 or more propose an alliance to each other, every pair) made 46 and 257. They never lapse.

Then a coalition's alliances were made to lapse with their warmonger: at the start of a year once its score is under 30, or when
it is out of the game (RULES.md §10; rules version 7). Same probe, joiners against an attacker, average (most):

| | year 1 | year 5 | year 10 | year 25 | year 50 |
|---|---|---|---|---|---|
| Mitteleuropa, sparing proposals and lapsing coalitions | 0.4 (2) | 4.9 (14) | 5.0 (14) | 4.0 (9) | 3.6 (8) |
| Historical, the same | 1.0 (2) | 6.9 (25) | 7.4 (25) | 6.5 (17) | 2.7 (9) |

Better in the long run (Mitteleuropa 39 defensive alliances at year 50 against 86; historical 49 against 218), little better in
years 5 to 25: a computer conqueror's score stays over 30 for years (it falls by only 2 a year), and its coalition with it.
