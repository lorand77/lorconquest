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
