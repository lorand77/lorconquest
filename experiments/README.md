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

## 7. Who wins, and how (2026-10-22)

Computer-only games to the end, both scenarios at rules version 14: `node tools/simulate.js --games 36 --jobs 5` and
`--games 18 --jobs 6 --scenario historical-1440`, run side by side (26 and 31 minutes). The simulator now says how each game
was won: by reaching the scenario's number of settlements (its own and its vassals' count 1, its protectorates' ½), or on time,
with the most at the start of 1650.

| | Mitteleuropa: Balanced, 36 games | Mitteleuropa: Historical 1440, 18 games |
|---|---|---|
| Winners | SAX 8, BAV 6, BRB 5, GDA 5, WAR 3, LIT 2, POZ 2, SCH 2, RUH 1, AUS 1, BOH 1 | **BUR 7**, SAX 3, BOH 3, TEU 2, POL 2, LUS 1 |
| By reaching the target | 0 (target 45 of 87) | 0 (target 85 of 168) |
| On time, in 1650 | 36 | 18 |
| The winner's settlements in 1650: mean (least–most) | 21.6 (11–30) | 33.3 (21–43) |
| The runner-up's, mean | 14.5 | 24.9 |
| A game: wars declared (+ joined), captures, countries eliminated | 47.1 (+27.3), 115, 18.9 of 45 | 63.8 (+90.1), 271, 36.1 of 74 |
| AI a day: mean, p95, slowest; engine a day | 1.3, 3.2, 50 ms; 1.3 ms | 3.6, 8.9, 61 ms; 4.2 ms |

**No game ends early.** The best any computer did was two-thirds of the target (SAX and BRB 30 of 45 on Balanced, BUR 43 of 85
on the historical map). The computers fight a lot, but a winner holds about a quarter of the map at the end (a fifth on the
historical one), with a runner-up not far behind: alliances, coalitions against a warmonger and peaces of at most six settlements
keep anyone from running away with it. Against people this is not necessarily so, but among computers the end year decides.

**Balanced is spread out; the historical map is not.** On Balanced eleven countries won, none more than 8 of 36 games (Saxony,
then Bavaria); on the historical map Burgundy, second only to Poland in people at the start (90K to 100K), won 7 of 18 and declared the most wars (204,
against Bohemia's 144).

## 8. Siege guns, posts, the capital, a small navy (2026-10-26)

The computer players learned what they could not do (`src/ai/`, design.md): in a war with a real country they buy cannons
(a hundred once their law allows 2,000 soldiers, up to three hundreds) and their hosts take them on in whole hundreds; a host
storms an enemy sharpshooter post at its pass, and stops at one on its way to do so; a country that loses its capital names
its largest city; at sea they build cogs for the straits between their land and an enemy's and patrol only where they are the
stronger, and they research no warships. Fixed on the way: an army alone at a pass or before an enemy town was taken for a
garrison and never given another order. Same commands as section 7, the usual 24 + 8 games side by side (18 and 20 minutes).

| | Balanced, 24 games (section 7: 36) | Historical 1440, 8 games (section 7: 18) |
|---|---|---|
| Winners | PRU 4, RUH 4, POZ 3, BAV 3, SAX 2, BRB 2, SCH 2, WAR, MEC, MAG, AUS 1 (SAX 8, BAV 6, BRB 5, GDA 5 …) | BUR 3, HUN 2, TEU, SAX, POL 1 (BUR 7, SAX 3, BOH 3 …) |
| Won on time / by the target | 24 / 0 (36 / 0) | 8 / 0 (18 / 0) |
| Winner's settlements, mean (least–most); runner-up | 21.6 (12.5–36); 14.4 (21.6 (11–30); 14.5) | 32.9 (28–41.5); 26.6 (33.3 (21–43); 24.9) |
| Captures a game | 126 (115) | 316 (271) |
| Wars declared (+ joined); countries eliminated | 45.8 (+24.2); 19.3 (47.1 (+27.3); 18.9) | 66.1 (+96.3); 37.8 (63.8 (+90.1); 36.1) |
| AI a day: mean, p95, slowest | 1.5, 4.1, 43 ms (1.3, 3.2, 50) | 4.4, 11.3, **198** ms (3.6, 8.9, 61) |

**More captures, the same shape of game.** Cannons and storming hosts take about a tenth more towns on Balanced and a sixth more
on the historical map, but no game ends early and the winners hold what they held before. Balanced spreads its wins wider
still: eleven winners, none above 4 of 24. Burgundy still leads the historical map, 3 of 8.

**What the new behaviour does in a game** (one-off probes of 120 years): new capitals 9 to 31 a game; cannons bought 1,000 to
2,800 and taken on a dozen to three dozen times. Posts and the navy almost never come up: in 120 years no army was shot at a
pass (posts stand in their owner's land, where its enemies seldom march), a war across a strait went on for about one year on
the historical map and none on Balanced, and no two enemy fleets were ever in one zone with one at sea — every fleet stays in
port — so there was nothing to patrol against. The behaviour is there, and tested, for when it does.

**Timing.** The AI's mean day is a little dearer and one day of the historical games took 198 ms, twice the tick's budget —
once in 613,200 days (p99 16 ms). Worth watching: the likely cost is a route worked out per host to look for posts on its way.
