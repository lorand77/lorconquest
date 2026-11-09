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

## 9. The computer does all a player can (2026-10-26)

The rest of what a player can do was taught to the computer (design.md, *The computer players*): proclaiming regions, the bank,
soldiers raised armed, stopping a march into land closed by a peace, peace terms that free a loser's subjects and make the loser
a vassal or protectorate (or the loser a protectorate, to save its land), asking for military access, guaranteeing a weak
neighbour, cancelling access, breaking a pact with a rival it would crush, and at sea blockades, merging and splitting fleets,
and warships against a stronger enemy fleet. The usual run, 36 + 18 games side by side (29 and 37 minutes), against section 7
(the same size, before sections 8 and 9) and section 8 (siege guns and the rest, 24 + 8 games).

| | Balanced, 36 games | Historical 1440, 18 games |
|---|---|---|
| Winners | BRB 8, RUH 7, BAV 5, AUS 3, GDA 3, PRU 2, POZ 2, six once | BUR 7, BOH 4, POM 3, AUS, BRU, BRA, HUN 1 |
| Won on time / by the target | 36 / 0 | 18 / 0 |
| Winner's settlements, mean (least–most); runner-up | 19.8 (8–33.5); 12.2 — section 7: 21.6; 14.5 | 32.3 (17–44.5); 23.7 — section 7: 33.3; 24.9 |
| Captures a game (section 7 / 8) | **95.6** (115 / 126) | 283 (271 / 316) |
| Subjects made a game (section 7) | **27.4** (21.6) | **52.2** (34.1) |
| Countries eliminated (section 7) | **13.0** (18.9) | **30.5** (36.1) |
| Wars declared (+ joined) (section 7) | 39.9 (+24.8) (47.1 (+27.3)) | 67.7 (+99.6) (63.8 (+90.1)) |
| AI a day: mean, p95, slowest (section 7) | 1.8, 4.2, 88 ms (1.3, 3.2, 50) | 5.2, 12.8, **170** ms (3.6, 8.9, 61) |

**Vassals instead of graves.** With subjects as a term of peace, a winner far ahead takes the loser as its vassal or protectorate
rather than its last towns: subjects made rise by a quarter on Balanced and by half on the historical map, countries eliminated
fall by a third and a sixth, and on Balanced captures fall back below section 7. Victory counts a vassal's towns in full and a
protectorate's at half, so the winners end about where they did; no game ends early. Burgundy still wins the historical map
most often (7 of 18, as in section 7); Balanced is led by Brandenburg and the Ruhr (8 and 7 of 36), thirteen winners in all.

**What the new behaviour does in a game** (one-off probes of 120 years): deposits 56 to 102 and withdrawals 63 to 242, blockades 3
to 13, armies stopped on the way 4 to 145, access cancelled 1 to 6, armed raisings 150 to 370. A split fleet merged back before
it could sail (39 splits and 38 merges in one historical game) until merging waits while a strait is short of ships. Two
refusals the run showed were fixed after it: a repayment decided before the same think's spending, and a second offer to become
a subject after the first was signed.

**Timing.** The AI's day is dearer again: on the historical map the mean is 5.2 ms (p99 17.5 ms), and the slowest day 170 ms, over
the tick's budget once or twice in 1,379,700 days. Section 8 suggested where it goes; worth looking at before more is added.

## 10. Subjects by demand (2026-11-05)

The computer asked for subjects about 3 times a century, and never turned its own protectorate into a vassal (design.md,
*The computer players*). Now it upgrades its protectorates first, asks on 30% of its thinks instead of 15% (still only at
peace and where a yes is 35% likely or more), and may have up to `subjectCap` subjects by demand: 3, one more for every 10
settlements it counts toward victory, two more for a diplomat, which now asks whatever its aggression. The rules around it
had changed just before: a yes adds warmonger score, a rival never agrees, and nobody agrees to a country at 75% of victory
(RULES.md §10). Balanced only, 24 games of 210 years, against the commit before, side by side (16 and 18 minutes).

| | New, 24 games | Before, 24 games |
|---|---|---|
| Winners | BAV 7, BRB 6, AUS 5, POZ 2, WAR 2, SCH 2 | BRB 5, HUN 3, GDA 3, BAV 3, AUS 2, POZ 2, six once |
| Won by the target / on time | **7** / 17 (1505, 1507, 1515, 1520, 1528, 1537, 1641) | 1 / 23 (1593) |
| Winner's settlements, mean (least–most); runner-up | **36.4** (10–47.2); 14.6 | 22.6 (11–45); 12.3 |
| Subjects made a game | **45.5** | 30.0 |
| Countries left at the end | **20.7** | 32.2 |
| Captures, battles a game | 107, 125 | 99, 115 |
| Wars declared (+ joined) | 41.7 (+20.3) | 46.4 (+15.5) |
| AI a day: mean, p99, slowest | 2.0, 8.7, 50 ms | 2.1, 8.6, 62 ms |

**What it did.** Demands are now a real way to grow: subjects made rise by half, and the vassals of ten years are integrated,
so fewer countries are left. The leaders pull away — the winner ends with 36 settlements on average rather than 23 — and 7
games in 24 end early with a winner at the target (one did before). Wars and captures barely move; the growth is
the diplomacy's. **The cost is variety:** six countries win, all among the largest at the start (Bavaria, Brandenburg, Austria at
50K), where twelve did; the rest of the field is swallowed sooner. Refusals are as rare as before; the demand refused for
being made on the think that declared war on the same country is gone.

## 11. How strong the computer players are: the A/A test (2026-11-06)

Averages (wars, captures, winners) show what the computer players do, not whether one version plays better than another. A
review of the AI suggested matched games against a frozen opponent; `tools/strength.js` plays them: the working copy's `src/ai`
(the candidate) against a commit's (the baseline), both on today's engine, in two ways — **one**: for each seed a control game,
every country on the baseline, then one game for each of nine test countries with that country alone on the candidate
(Bavaria, Brandenburg, Austria, Saxony, Prussia, Elsass-Lothringen, Jena, Gdańsk, Hamburg: large to small, inland and coastal,
every character); **halves**: the 45 countries dealt into two halves of like size, the candidate playing one, then the other.
Seeds 101 to 110, never used for tuning; Balanced, 210 years. Before any change of the AI, the **A/A test**: the commit against
itself, the candidate's diplomacy dice salted — the same play, a little other luck. 120 games, 42 minutes.

| | A/A: the same AI, other dice |
|---|---|
| One country, settlements at the end, candidate less baseline (mean of 10 seeds, 95%) | **−0.03** [−3.71, +3.65] |
| — the same, the peak / held at the end | −0.79 [−4.18, +2.61] / 0.00 [−2.94, +2.94] |
| — by country (half-width of the interval) | ±19 Bavaria, ±16 Brandenburg, ±11 Austria, ±7 Saxony, ±5 Prussia, ±4 Gdańsk, ±1 the small |
| One country, wins (candidate / baseline) | 9 / 9 of 90 |
| Halves, settlements held, the candidate's half less the baseline's | −9.35 [−23.66, +4.96] |
| Halves, games won (candidate's half / baseline's) | 4 / 16 of 20 |
| Refused orders a game, the test country | 0.32 / 0.32 |
| Thinking a country-day (µs) | 69.5 salted / 47.5 — the salt's proxy, not the play |

**No bias:** the same computer players come out level, as they should — the mean is 0 to a hundredth, the wins 9 and 9. Unsalted,
they play the very same games to the last coin (test/tools/strength.test.js).

**The noise is large.** One country's luck changes who wins the whole game — in one seed the control's winner was Schleswig and
the salted games' Hungary, Austria and Schleswig — so a single country's result swings by up to ±19 settlements. Over the nine
countries and ten seeds the interval is ±3.7 settlements a country: **a change must move the average test country by about 4
settlements at the end to show** with this run; anything less is not measured by it. The halves are noisier still (±14).

**The halves' wins are luck.** With the original dice, Bavaria and Austria — both in half A — won 8 of the 10 control games;
salting half B left A that luck (A won all 10), salting A took it away (4 of 10, their usual share: 12 of 24 in section 10).
The settlements' interval holds 0; the count of wins by half is not a measure with 10 seeds, and the report says so.

**So:** the one-country mode is the measure, and the tool now plays nothing else: the halves, and a hook for a scripted player
against both versions, were taken out after this run to keep it simple. To see smaller effects, more seeds (the interval narrows with their square root:
40 seeds for ±1.8) or shorter games, whose noise would need an A/A test of its own.

## 12. The subjects by demand, measured (2026-11-07)

Section 10's change (d40e132, "major AI improvement") against the commit before it (9a84479), with `tools/strength.js`: each of
the nine test countries alone on the new AI, against its seed's control game on the old. Seeds 101–110, 210 years, 100 games in
43 minutes.

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | **+15.5** [+1.1, +29.8] | 5 / 3 | 10 / 8 |
| Austria | +6.9 [−4.3, +18.2] | 2 / 1 | 9 / 7 |
| Brandenburg | −0.6 [−13.5, +12.4] | 1 / 2 | 6 / 5 |
| Saxony, Prussia, Gdańsk | −1.0, −0.8, +0.3 (each interval holds 0) | 1 / 2 | 15 / 16 |
| Elsass-Lothringen, Jena, Hamburg | exactly 0: the same games | — | — |
| All | +2.3 [−0.6, +5.1] | 9 / 8 of 90 | |

**What it showed.** The change helps the large: Bavaria ends 15 settlements up and survives every game, Austria likely gains,
both lose a few more cores (more land, more fronts). The small play the very same games — a demand needs a country twice its
neighbour's size, which they never are — so three rows of zeros pull the average under the noise of section 11 (±3.7): +2.3,
likely real, not shown. Refused orders the same (0.27 and 0.29 a game).

**The cost line misleads:** the candidate's 107 µs a country-day against the baseline's 52 is each version's fixed daily work
(reading the whole state) spread over one country against forty-four. Whole-AI time is `simulate.js`'s: 2.0 ms a day new, 2.1
old (section 10).

**For next time** the tool's defaults are the six countries a change of play can reach — Bavaria, Brandenburg, Austria, Saxony,
Prussia, Gdańsk — and 20 seeds (101–120): 140 games, about an hour. Section 11's noise was for nine countries and ten seeds; the
new defaults' would need an A/A test of their own.

## 13. Raising by the hundred, modernising old guns (2026-11-08)

The computer now raises the last of what its law allows by the hundred, once there is room for fewer than 1000 (it left that
room empty), and when rich gives its hand cannons and arquebuses the best gun researched, the worst first (it re-armed only the
unarmed and old swords). The working copy against 341acf3 with `tools/strength.js`'s new defaults: six countries, seeds
101–120, 210 years — 140 games, 48 minutes.

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | −6.3 [−18.1, +5.6] | 4 / 7 | 12 / 15 |
| Brandenburg | +4.6 [−3.8, +13.1] | 5 / 2 | 13 / 12 |
| Austria | −0.2 [−11.5, +11.2] | 5 / 4 | 14 / 14 |
| Saxony | +2.6 [−2.8, +7.9] | 2 / 1 | 10 / 8 |
| Prussia | −0.9 [−5.4, +3.6] | 1 / 1 | 8 / 9 |
| Gdańsk | −1.9 [−4.7, +0.8] | 0 / 0 | 11 / 17 |
| All | **−0.3 [−3.6, +2.9]** | 17 / 15 of 120 | |

**What it showed: nothing measurable, as expected.** Both changes are small in a game: the hundreds fill a few hundred places in
the first months, and old guns are replaced only late, by the rich. The interval (±3.3) is about the ±3.6 section 12 estimated
for these defaults from section 11's A/A test. Every country's interval holds 0. Gdańsk's survival is the one thing to watch:
paired by seed, it fell only on the new AI in 7 seeds and survived only on it in 1 (p ≈ 0.07 — one such among six countries and
several measures is what chance gives). Refused orders a game 0.55 against 0.48. They are kept as what the computer should do
anyway; they are not a gain in strength that ten or twenty seeds can see.

## 14. Muskets alone for the rich (2026-11-08)

Rich and with muskets, the computer gives up pike and shot for muskets alone — raised with them, the unarmed armed with them, an
army's pikes all made muskets at once (a third pikes ties all muskets in battle, man for man; all muskets cannot fall under the
third and counts for more on paper). Against 65a53ee, the new defaults (six countries, seeds 101–120): 140 games, 48 minutes.

| | Muskets alone |
|---|---|
| All, settlements at the end, new less old (95%) | −0.8 [−2.3, +0.7] |
| By country | every interval holds 0; Austria −2.5, Brandenburg −1.6, Saxony +1.3 |
| Wins new / old | 15 / 17 of 120 |
| Refused orders a game | **2.80** against 0.55 |

**Nothing measurable in strength** — it comes late, to the rich. **The refusals were two bugs**, found with `SIM_DEBUG=1` and fixed
after the run: sharpshooters were bought with army-cap room the same think's raising by the hundred (section 13) had already
taken (234 refusals in one game), and a muster split armies the same think had re-armed (it now waits a think, as for armies it
disbanded men from). Two games of the same seeds then refused 10 orders between them, from more than 270.

## 15. Looking at the war every 5 days, and defending before the siege (2026-11-08)

At war a country now looks at its war every 5 days between its thinks (it looked every 15, and after events), and meets a march
on a town of its before the siege: a host that gets there first and makes the town hold goes there — scored above relieving a
siege already begun — one in such a town that would fall without it stays, and a core town no host can reach in time gets
mercenaries, if they arrive first (design.md, *The computer players*). With them, the two fixes of section 14. Against d44a490,
the new defaults: 140 games, 56 minutes. (The rules were 38's: the harsh laws' growth and unrest, which no computer country uses.)

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old | Cores lost |
|---|---|---|---|---|
| Bavaria | +0.9 [−8.5, +10.3] | 5 / 5 | 17 / 15 | −2.6 |
| Brandenburg | **+12.6** [+5.1, +20.0] | 8 / 3 | 17 / 13 | −2.2 |
| Austria | +0.9 [−6.8, +8.6] | 2 / 1 | 13 / 14 | −1.6 |
| Saxony | −0.9 [−6.2, +4.3] | 1 / 2 | 9 / 11 | −4.4 |
| Prussia | +3.3 [−3.4, +10.0] | 2 / 1 | 9 / 6 | −3.2 |
| Gdańsk | +0.9 [−1.6, +3.3] | 0 / 1 | 13 / 16 | −1.0 |
| **All** | **+2.9 [+0.1, +5.8]** | 18 / 13 of 120 | 78 / 75 | **−2.5 [−4.0, −0.9]** |

**The first change the benchmark shows.** The candidate country ends nearly three settlements up on average, the interval clear of
0, and **loses fewer of its core towns in every one of the six** — 2.5 a game fewer, the interval clear of 0 too: the very thing
defending before the siege is for. Brandenburg, a conqueror at the centre of the map with neighbours on every side, gains most
(+12.6); survival is a little better, within the noise. Refused orders 0.46 a game against the baseline's 1.80 (the baseline still
had section 14's two bugs). Whole-AI cost is to be read from `simulate.js`: two games of seeds 105–106 took 0.8 ms a day.

## 16. The computer uses the harsh laws (2026-11-08)

Rules 38 made Mass levy and Scrape the barrel cost growth and peace at home, and stepping down cheap (RULES.md §9). The computer
now climbs a ladder (`lawFor`): Mass levy for a war fought for its life — an enemy side twice its strength, a core town besieged,
a quarter of its first towns lost — and Scrape the barrel for a last stand — its capital besieged or lost, or half its cores gone,
against 2.5 times its strength — each only if two years of its cost are covered by its treasury and loan room; down from them as
soon as the danger passes, from the milder laws after a year of peace (it waited five years either way). In three games of seeds
101–103 every country together chose Mass levy 13 to 39 times and Scrape the barrel 2 to 7; it never had before. Against 5df8d60,
the new defaults: 140 games, 49 minutes.

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | −0.0 [−6.0, +5.9] | 6 / 5 | 19 / 18 |
| Brandenburg | +4.3 [−4.5, +13.0] | 7 / 5 | 14 / 14 |
| Austria | +1.7 [−1.8, +5.3] | 3 / 2 | 16 / 15 |
| Saxony | −0.7 [−10.9, +9.6] | 5 / 4 | 14 / 10 |
| Prussia | +6.5 [−1.2, +14.2] | 5 / 0 | 10 / 8 |
| Gdańsk | −0.8 [−2.6, +1.0] | 0 / 0 | 15 / 15 |
| **All** | **+1.8 [−1.3, +5.0]** | **26 / 16** of 120 | 88 / 80 |

**What it showed: likely better, not shown.** The settlements lean up but the interval holds 0. The wins say more: paired by seed,
the country won only on the new AI in 16 games and only on the old in 6 (sign test, p ≈ 0.05), and survived only on the new in 19
against 11 (p ≈ 0.2). That fits what the laws are for — the last reserves turn a lost war into a held one, or a close race into a
win — more than a steady gain in land. Cores lost the same (−0.3 [−1.8, +1.3]); refused orders 0.40 and 0.38 a game.

## 17. Garrisons sized to the threat, and towns given up (2026-11-09)

Two changes measured together. **Garrisons to the threat:** at war, the men a garrison keeps when the rest muster are enough that
the enemy forces within 60 days are no stronger than it behind its walls (a storm a coin flip at best for them, none from a
computer, which storms at 1.35 times), 1.5% of its people with none near; it kept 4% at a border, 1.5% inside, whatever the enemy.
**Towns given up:** a town marched on that nothing can save, whose garrison buys little — a storm it would lose (1.35 times), or a
siege over within 90 days — sends its garrison to a safe town before the enemy comes, and falls empty. Against 3a2985c, the new
defaults: 140 games, 54 minutes (run four times: a container restart cut the first three short, which is why the tool now writes
each game down as it ends and resumes).

| | Garrisons and towns given up |
|---|---|
| All, settlements at the end, new less old (95%) | +0.5 [−2.2, +3.2] |
| By country | every interval holds 0: Austria +3.5, Saxony +3.3, Prussia −4.4 |
| Wins new / old | 19 / 18 of 120 |
| Survived, new less old | 0.00 [−0.08, +0.08] |
| **Cores lost, new less old** | **+1.1 [+0.0, +2.1]** |
| Refused orders a game | 0.45 / 0.37 |

**What it showed: no gain, and more cores lost.** The towns given up fall without a fight, and are counted as lost — what saving
their garrisons cost; the men saved did not win the land back. The short-siege clause (any siege under 90 days, which takes in most
towns without walls) likely gives up towns that would have held long enough for help: to be measured apart, or dropped.

## 18. Garrisons sized to the threat, alone (2026-11-09)

Section 17's garrisons without the towns given up: at war, the men a garrison keeps when the rest muster are enough that the enemy
forces within 60 days are no stronger than it behind its walls — 1.5% of its people with none near; it kept 4% at a border, 1.5%
inside, whatever the enemy. Against 3a2985c, the new defaults: 140 games (21 of them before a restart, the rest resumed: section
17's saving at work).

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | +5.2 [−2.5, +12.9] | 8 / 6 | 20 / 16 |
| Brandenburg | +6.0 [−3.4, +15.4] | 9 / 6 | 17 / 14 |
| Austria | **+15.0** [+5.3, +24.7] | 7 / 1 | 17 / 10 |
| Saxony | **+10.5** [+1.4, +19.5] | 7 / 2 | 12 / 16 |
| Prussia | −3.7 [−10.9, +3.6] | 1 / 3 | 8 / 8 |
| Gdańsk | +1.7 [−0.1, +3.4] | 0 / 0 | 16 / 13 |
| **All** | **+5.8 [+3.3, +8.2]** | **32 / 18** of 120 | **90 / 77** |

**The largest gain the benchmark has shown.** A country ends nearly six settlements up, the interval far from 0; it survives more
often (+0.11 of a game [+0.04, +0.18]); and paired by seed it won only on the new AI in 22 games, only on the old in 8 (sign test,
p ≈ 0.02). Cores lost are the same (−0.1 [−1.2, +1.1]): the gain is not in holding towns but in the men — a town far from any
enemy now keeps 1.5% of its people and sends the rest to the host, which is bigger where the war is. So section 17's "no gain" was
the towns given up cancelling this one. Refused orders 0.59 a game against 0.37.
