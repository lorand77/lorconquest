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

## 19. Mercenaries hired while a war is prepared (2026-11-10)

A war is planned some 40 days before it is declared (design.md, *The computer players*). Its mercenaries were hired only once it
began, and arrived a month later; now a country preparing a war hires them already — as if at war, against the planned target's
strength, at its largest core town on the target's border — and keeps them while the plan stands. Against eac20b5 (section 18's
garrisons committed), the new defaults: 140 games (68, then a restart, then the other 72 resumed; 12 at a time, the other
containers closed).

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | +3.9 [−2.3, +10.0] | 4 / 3 | 12 / 12 |
| Brandenburg | +2.3 [−6.7, +11.3] | 7 / 5 | 14 / 15 |
| Austria | −0.3 [−2.0, +1.4] | 4 / 4 | 13 / 13 |
| Saxony | −2.9 [−7.1, +1.4] | 3 / 4 | 12 / 12 |
| Prussia | +1.8 [−2.5, +6.1] | 2 / 2 | 10 / 10 |
| Gdańsk | exactly 0: it plans no wars | — | 11 / 11 |
| **All** | **+0.8 [−1.4, +3.0]** | 20 / 18 of 120 | |

**What it showed: nothing measurable.** The mercenaries hired are few — one or two thousand, and only by a country that is rich or
facing a stronger target — against armies of tens of thousands, and a war's first weeks seldom decide it. Refused orders the same
(0.33 and 0.34 a game). Harmless, and what a planner would do; not a gain these 20 seeds can see.

## 20. Allies relieve each other's sieges (2026-11-10)

A country at war with an ally's enemy now weighs relieving the ally's besieged settlements as it weighs its own — worth 30 plus a
thousandth of the people, less the further away (÷ 1 + days / 40) — and values its ally's settlements in danger at 1.5 times. Against
84e0768, the commit before (30328eb's war.js is the only change of src/ai between them), on rules 39: 140 games, 6 at a time.

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | −0.2 [−0.5, +0.1] | 4 / 4 | 14 / 15 |
| Brandenburg | +1.9 [−2.1, +5.9] | 11 / 10 | 18 / 17 |
| Austria | +0.0 [−0.0, +0.0] | 0 / 0 | 13 / 13 |
| Saxony | +0.1 [−0.1, +0.2] | 2 / 2 | 10 / 9 |
| Prussia | exactly 0 | 1 / 1 | 11 / 11 |
| Gdańsk | −0.2 [−0.5, +0.2] | 0 / 0 | 14 / 14 |
| **All** | **+0.3 [−0.4, +1.0]** | 18 / 17 of 120 | |

**What it showed: nothing measurable, because it seldom happens.** Most games on the new AI were the old game to the last
settlement: an ally besieged within reach, with forces free to go, is rare. Brandenburg, the country most often in alliances
at war, is where it shows, within the noise. Refused orders the same (0.23 a game). The cost line rose (96 against 35
microseconds a country-day), but that line is not to be trusted for one country (tools/strength.js); `simulate.js`'s whole-AI
time is the measure if it matters.

## 21. How settlements are lost (2026-11-11)

`tools/losses.js`, new in simulate.js: every settlement a country loses, by how — and, lost by force to a country, why, from the
state at the end of the day it fell. 24 games of Mitteleuropa, seeds 1–24, 210 years (all 24 won: BRB 6, SCH 4, PRU 4, …), on
the working copy after section 20 and the computer joining its protectorates' wars; 6 at a time, 9 minutes.

| How | A game | Share |
|---|---|---|
| By storm | 58.4 | 63% |
| Walked into, nobody in it | 10.2 | 11% |
| Starved out by a siege | 1.2 | 1% |
| In a peace | 22.8 | 25% |
| To peasant rebels | 0.2 | 0% |

| Lost by force to a country (69.8 a game), why | A game | Share |
|---|---|---|
| Outmatched: its whole power under 2/3 of the taker's, or less in all its armies than took the place | 27.9 | 40% |
| Enough of its own within 60 days, lost anyway | 10.0 | 14% |
| Its strength elsewhere, at war on two fronts or more | 15.8 | 23% |
| Its strength elsewhere, in one war | 16.1 | 23% |

The loser's largest army was a median 143 days from the place when it fell; within 60 days in 18% of the cases.

**What it showed.** Towns are stormed, not starved: a siege nearly always ends in a storm first, so a defence is the garrison
and what can reach it within weeks, not months. Nearly half the force losses (46%) were of a country that had the strength,
but elsewhere — half of those while fighting on another front (C, one host per front), half in a single war with its host far
off, most likely attacking while its own towns were stormed behind it. One in nine losses was a town nobody held: the
settlements behind the border keep no garrison (section 17), and are walked into once the border moves or a host slips past.
A quarter go in peace treaties, the cost of losing the war rather than of a town. Read with care: the state is the day's end,
so a host beaten in the field the same day is gone and the loss counts as outmatched; and "enough within 60 days" does not say
whether it could have come in time for a storm.

## 22. A token garrison behind the border (2026-11-11)

Section 21: one loss in nine was a town nobody held. A settlement behind the border (every route from it leading to the country's
own land) sent its whole garrison to the staging settlement; now it keeps 200 armed men, and is not behind the border at all while
an enemy force is within 60 days of it (then it keeps the inner towns' 1.5%). Against 5600e0b, on rules 40: 140 games, 6 at a time,
64 minutes.

| Country | Settlements at the end, new less old (95%) | Wins new / old | Survived new / old |
|---|---|---|---|
| Bavaria | +0.5 [−0.3, +1.2] | 6 / 6 | 14 / 14 |
| Brandenburg | −0.5 [−3.2, +2.3] | 3 / 3 | 14 / 14 |
| Austria | +1.3 [+0.2, +2.4] | 3 / 3 | 13 / 12 |
| Saxony | +0.2 [−0.3, +0.6] | 4 / 4 | 12 / 12 |
| Prussia | −3.5 [−9.0, +1.9] | 1 / 2 | 7 / 6 |
| Gdańsk | 0.0 [−0.5, +0.5] | 0 / 0 | 16 / 16 |
| **All** | **−0.4 [−1.4, +0.7]** | 17 / 18 of 120 | |

The loss report of the same 24 games as section 21, every country on the new code: towns walked into 10.2 → 7.1 a game, but
stormed 58.4 → 64.8, and lost by force to a country 69.8 → 73.0.

**What it showed: nothing gained** (taken out again). The token stops raiding parties, which take only empty towns, but a host storms a town of 200
as easily as it walks into an empty one: the town is lost the same, by storm. One country of six clear of zero (Austria) is what
chance gives. Refused orders the same (0.34). The cost line rose (87 against 34 microseconds a country-day; the line is not to be
trusted, but the 60-day look from every town behind the border at war is real work).

## 23. Buildings worth more, conquests paying as they settle, people at half price (2026-11-11)

Rules 42: a Workshop +7,000 (was 3,500), a Market +25% (was 15%); a settlement not core pays its non-core half × its compliance
(nothing the day it falls, all of it after 20 years); 1,000 people 50,000 (was 100,000); and (rules 41) the Empire's vote near
victory. The same 24 games as section 21 (seeds 1–24, 210 years, Mitteleuropa), 6 at a time, 12 minutes.

| | Section 21 (rules 40) | Rules 42 |
|---|---|---|
| Wins | BRB 6, SCH 4, PRU 4, BAV 3, SAX 3, RUH, AUS, HUN, WAR 1 — 9 countries | **BAV 11, BRB 7, SAX 5, SCH 1 — 4 countries** |
| By reaching 45 / on time | 15 / 9 | 16 / 8 |
| Captures a game | 92.8 | 82.4 |
| Land churn (captures per settlement a century) | 0.76 [0.63, 0.89] | 0.70 [0.58, 0.82] |
| Lost by force to a country, a game | 69.8 | 61.9 |
| War exposure | 3.4% | 3.2% |
| Mobilization | 7.73% | 7.75% |
| Military burden | 19.1% [18.4, 19.7] | **17.0% [16.5, 17.6]** |
| AI / engine ms a day | 1.3 / 0.9 | 1.7 / 1.1 |

Money and people (3 games each, the whole map): 1490 3.6–4.0M a year (3.2–3.6M before), 1540 6.3–6.4M (4.5–5.0M), 1590
8.5–9.6M (6.9M); people 1540 2.4–2.5M (2.1–2.4M). The computer still builds a workshop and a market nearly everywhere by 1490.
Soldiers about the same (1540: 160–179K, 170–200K before).

**What it showed.** Conquest slowed a little — a tenth fewer captures, churn down within the noise — and money rose by a third
by 1540 while armies did not: the burden of the armies fell from 19% to 17% of settlement money. But the winners narrowed from
nine countries to four, Bavaria 11 of 24. Whether that is the rules (buildings and markets favour the rich, slower conquests
favour the large starters) or these seeds is not known from 24 games.

Then seeds 25–48 on both, old rules (5600e0b, rules 40) and new, 3 at a time each:

| Seeds 25–48 | Rules 40 | Rules 42 |
|---|---|---|
| Wins | AUS 7, BRB 6, BAV 4, SAX 2, PRU 2, SCH, BOH, WAR 1 — 8 countries | SAX 6, BRB 4, BAV 4, AUS 3, SCH 3, PRU 3, HUN 1 — 7 countries |
| By reaching 45 / on time | 14 / 10 | 17 / 7 |
| Captures a game | 89.8 | 83.0 |
| Land churn | 0.75 [0.62, 0.89] | 0.66 [0.58, 0.75] |
| Military burden | 19.2% [18.5, 19.9] | 17.4% [16.8, 18.1] |
| Lost in a peace / walked into, a game | 21.0 / 10.1 | 17.5 / 8.0 |

All 48 seeds: rules 40 — BRB 12, AUS 8, BAV 7, PRU 6, SCH 5, SAX 5, WAR 2, RUH, HUN, BOH 1 (10 countries, the first three 27 of 48);
rules 42 — BAV 15, BRB 11, SAX 11, SCH 4, AUS 3, PRU 3, HUN 1 (7 countries, the first three 37 of 48).

**And so:** seeds 1–24's Bavaria (11 of 24) was mostly those seeds — 4 of 24 in the next — but over all 48 the new rules lean
somewhat to the big starters: three countries win three games in four (against a little over half), Bavaria and Saxony gain,
Austria loses. Less conquest (captures −8 to −11%, churn −0.06 to −0.09), more money and the same armies (burden −2 points, outside
the noise both times), and slightly more games won by reaching 45 (33 against 29 of 48).

Then rules 44: the Market back to +15% (the Workshop's +7,000 kept), and the capital's own 10,000 a year (no tribute on it) and
1,000 on the army cap, the same for every country. Seeds 25–48 again, 6 at a time, 15 minutes:

| Seeds 25–48 | Rules 40 | Rules 42 | Rules 44 |
|---|---|---|---|
| Wins | AUS 7, BRB 6, BAV 4, SAX 2, PRU 2, SCH, BOH, WAR 1 | SAX 6, BRB 4, BAV 4, AUS 3, SCH 3, PRU 3, HUN 1 | AUS 8, BAV 5, BRB 3, GDA 2, SAX 2, WAR 2, BOH 1, RUH 1 |
| Countries that win / the first three's wins | 8 / 17 | 7 / 14 | 8 / 16 |
| By reaching 45 / on time | 14 / 10 | 17 / 7 | **11 / 13** |
| Countries left at the end | 19.0 | 19.1 | 20.4 |
| Wars declared / captures a game | 35.0 / 89.8 | 33.8 / 83.0 | 38.9 / 97.8 |
| Land churn | 0.75 | 0.66 | 0.72 |
| Mobilization | 7.75% | 7.83% | **9.78%** [9.46, 10.11] |
| Military burden | 19.2% | 17.4% | **21.2%** [20.4, 22.0] |

**What it showed.** The winners spread again (eight countries, Gdańsk, Warsaw and the Ruhr among them), fewer games were won by
reaching 45 and more on time, and a few more countries lived to the end: the runaway is slower. But every country raises the
capital's 1,000 — 45,000 more men under arms at the start — and spends the 10,000 on them: mobilization up two points, the burden
of the armies back above where it was, and more wars and captures than under either earlier rule. The small countries are
stronger; the world is more armed.

Then rules 45: the capital's soldiers halved, 500 on the army cap (its 10,000 a year kept). Seeds 25–48, 6 at a time, 15 minutes:

| Seeds 25–48 | Rules 40 | Rules 44 (1,000) | Rules 45 (500) |
|---|---|---|---|
| Wins | AUS 7, BRB 6, BAV 4, SAX 2, PRU 2, SCH, BOH, WAR 1 | AUS 8, BAV 5, BRB 3, GDA 2, SAX 2, WAR 2, BOH, RUH 1 | BRB 6, SCH 4, BAV 4, AUS 4, SAX 2, WAR 2, GDA, RUH 1 |
| Countries that win / the first three's wins | 8 / 17 | 8 / 16 | 8 / 14 |
| By reaching 45 / on time | 14 / 10 | 11 / 13 | 14 / 10 |
| Countries left at the end | 19.0 | 20.4 | **20.9** |
| Wars declared / captures a game | 35.0 / 89.8 | 38.9 / 97.8 | 40.5 / 100.0 |
| Mobilization | 7.75% | 9.78% | 8.71% [8.51, 8.92] |
| Military burden | 19.2% | 21.2% | **18.9%** [18.4, 19.5] |

**What it showed.** Halving the capital's soldiers kept what the bonus was for — winners as spread (eight countries, the first
three 14 of 24, fewer than ever), the most countries alive at the end — while the burden of the armies came back to where it
was under rules 40, mobilization half-way. More wars and captures than before stay: the small countries, stronger, are fought
over rather than swallowed.

Then rules 46: the capital's 10,000 a year alone, no soldiers. Seeds 25–48, 6 at a time, 13 minutes:

| Seeds 25–48 | Rules 40 | Rules 44 (+1,000) | Rules 45 (+500) | Rules 46 (money only) |
|---|---|---|---|---|
| Wins | AUS 7, BRB 6, BAV 4, SAX 2, PRU 2, SCH, BOH, WAR 1 | AUS 8, BAV 5, BRB 3, GDA 2, SAX 2, WAR 2, BOH, RUH 1 | BRB 6, SCH 4, BAV 4, AUS 4, SAX 2, WAR 2, GDA, RUH 1 | BRB 9, BAV 4, AUS 3, RUH 2, PRU 2, WAR, BOH, GDA, SCH 1 |
| Countries that win / the first three's wins | 8 / 17 | 8 / 16 | 8 / 14 | 9 / 16 |
| By reaching 45 / on time | 14 / 10 | 11 / 13 | 14 / 10 | 11 / 13 |
| Countries left at the end | 19.0 | 20.4 | **20.9** | 19.1 |
| Wars declared / captures a game | 35.0 / 89.8 | 38.9 / 97.8 | 40.5 / 100.0 | 37.9 / 91.8 |
| Bloodiness | 0.61 | 0.63 | 0.69 | **0.54** |
| Mobilization | 7.75% | 9.78% | 8.71% | 7.86% |
| Military burden | 19.2% | 21.2% | 18.9% | 17.1% |

**What it showed.** Money alone does not keep the small countries alive — as many fall as under rules 40 (19.1 left at the end,
against 20.9 with the 500 soldiers): what a small country lacks is men it may raise, not money. It makes the world calmer — the
fewest dead, captures near rules 40, armies the smallest share of the money — and the winners as many, but Brandenburg 9 of 24.

Kept: rules 45's +500 (as rules 47, the same rules as 45 — the number moved on past the money-only trial).

## 24. Europe's warmonger scale (2026-11-16)

Europe 1440 (445 settlements, 118 countries, x = 3, rules 57: the Reformation, coalitions only of neighbours of a bearable faith
and only against their warmonger). The warmonger score a settlement adds, × the scenario's scale (RULES.md §10). Seeds 1–6, 210
years, 6 at a time, about 25 minutes each; each variant a copy of scenario.json with the scale and the victory number changed.

| Scale, victory | Ended early | Wins | War exposure by period | Land churn by period | AI slowest day |
|---|---|---|---|---|---|
| 1 (no scale), 180 — rules 56, before | 0 of 6 | BUR 4, FRA 1, OTT 1 | 5.8% → 2.8% → 2.5% | 0.78 → 0.22 → 0.19 | 105 ms |
| 0.25, 180 | 1 (OTT 1588) | OTT 4, BUR 2 | 12.8% → 7.7% → 8.2% | 1.53 → 0.60 → 0.48 | 394 ms |
| 0.25, 115 | 5 (1499–1586) | BUR 2, OTT 2, FRA, POL | 12.5% → 11.5% → — | 1.39 → 1.13 → — | 127 ms |
| 0.4, 115 | 3 (1506–1602) | OTT 2, FRA 2, BUR, ENG | 12.8% → 10.4% → 7.1% | 1.27 → 0.82 → 0.34 | 106 ms |
| 0.6, 115 | 3 (1558–1623) | FRA 2, OTT 2, BUR, VEN | 8.9% → 6.1% → — | 0.97 → 0.39 → — | 80 ms |
| 1, 115 | 4 (1524–1603) | FRA 3, OTT 2, BUR | 7.3% → 3.9% → 1.2% | 0.77 → 0.25 → 0.08 | 83 ms |
| 0.5, 150 | 1 (FRA 1559) | FRA 3, OTT 2, ENG | 10.4% → 4.5% → 3.0% | 1.16 → 0.35 → 0.21 | 194 ms |

(— : too few games still going after 1575 to say.) At 0.5 and 150 the winners on time held 97–127, 23 to 53 short.

**What it showed.** The warmonger score had been the brake on war after 1500: a computer country plans no war while its score
is high, and one war's conquests kept a large country out for decades. Halving it keeps the map at war through the 1500s; a
quarter ends games in a few decades, and makes the computer slower. No scale stops games ending early at 115: the target, not
the scale, decides that. Chosen: 0.5. Then 0.5 with 180 (seeds 1–6): FRA 3, LIT, POL, BUR — no Ottoman win — every game to 1650, winners 80–153; war
exposure 8.5% → 4.3% → 4.4%, land churn 0.91 → 0.37 → 0.35, the computer 8.8 ms a day, 119 ms at its slowest. The victory number
was then set to 227, half the map as on the other two (52% and 51%): nobody held half of Europe in these two centuries, so a
game is mostly decided in 1650, by the most.

## 25. Training a tenth of a settlement at once, and land only for land won (2026-11-19)

**What changed.** A settlement trains at most a tenth of its people at once (RULES.md §8), and the computer spreads a levy over
its capital, the town its armies gather at and its largest settlements; a peace gives land only up to what was taken in the war
(RULES.md §10), the strength part of the war score buying money, freedom or a subject, and a losing computer offers one
settlement and money together.

**Run.** `node tools/strength.js --baseline fc4fc02 --candidate working --seeds 20 --years 210 --jobs 6 --label raise-land`
(Mitteleuropa, seeds 101–120; the baseline is the computer before the levy was spread, both on today's rules), 140 games in 32
minutes: `strength/2026-11-19-raise-land.json`.

**What it showed: a little stronger, within the noise, and the old computer stumbling.** One country on the candidate ends
+1.73 settlements [−1.59, +5.04]; wins 19 against 15 of 120; Brandenburg (+9.4) and Saxony (+6.5) gain most, none loses clearly.
The baseline, raising its whole levy in one place, is refused 50.8 orders a game, the candidate 2.0. The cost line (60.8 against
19.0 microseconds a country-day) is the one-country artefact of sections 20 and 22: timed whole, 60 years of seed 101 take
the computer 14.7 s on the candidate and 16.8 s on the baseline, with about the same armies (121 and 126, 127,000 and 119,000
men).

## 26. Sea lanes (2026-11-19)

**What changed.** Armies sail from port to port up to three sea zones away, with 10 × x ships at both ends and no enemy fleet at sea
on the way, 2 months a zone, at ×0.75 the day they land unless their side blockades the port (RULES.md §8); straits take 2 months.
The computer's march estimates count voyages, and against the nearest enemy it cannot reach by land or strait its navy holds both
ends of the shortest voyage.

**Run.** `node tools/strength.js --baseline 8db9ae2 --candidate working --seeds 20 --years 210 --jobs 4 --label sea-lanes`
(Mitteleuropa, seeds 101–120; the baseline the computer before sea lanes, both on today's rules — the baseline's armies may sail
too, the engine finding the routes, but its navy never holds a landing's ends): `strength/2026-11-19-sea-lanes.json`.

**What it showed: nothing for the inland countries, a loss for Prussia.** One country on the candidate ends −1.05 settlements
[−2.33, +0.23]; wins 12 against 17 of 120. Saxony plays the very same games (+0.00), Bavaria, Austria, Brandenburg and Gdańsk
within a settlement of zero; Prussia −6.47 [−13.67, +0.72], winning 1 game against 4 and surviving in 5 against 8. Refused orders
the same (0.59 and 0.65). On this map, of six zones and 21 ports, a landing is rare; where it costs, it is the Baltic coast, whose
navy now holds the ends of a voyage against enemies across the sea — cogs bought, ships kept at sea — while its land front is
next door. (Europe, 3 games of 50 years: 92–161 landings a game, the Ottomans, England and Castile most; the computer's day no
slower, 7.6 against 7.9 ms, its slowest 47–57 against 44–49.)

## 27. Landings only without a land front (2026-11-22)

**What changed.** The computer plans a landing only when no enemy borders it or its subjects by land or strait, and buys cogs only
for straits, never for a landing (TODO.md #25, after section 26's loss for Prussia).

**Run.** `node tools/strength.js --baseline 8db9ae2 --candidate working --seeds 20 --years 210 --jobs 4 --label landings`
(Mitteleuropa, seeds 101–120; the baseline the computer before sea lanes, both on today's rules — which since section 26 also
train a fifth of a capital's people at once): `strength/2026-11-22-landings.json`.

**What it showed: the loss is gone.** Prussia ends +1.25 settlements [−3.83, +6.33] (−6.47 in section 26), surviving in 5 games
against 2; no country is below zero beyond the noise — Bavaria +0.88, Brandenburg +0.76, Austria −0.05, Saxony +1.48, Gdańsk +2.05.
All: +1.06 [−0.05, +2.17] settlements a country, wins 15 against 15 of 120, refused orders the same (1.97 and 1.94).

## 28. A faster computer: worked out once a think (2026-11-22)

**What changed.** No decision: the computer gives the same orders, to the fingerprint, and only works them out with less
repetition (TODO.md #11). Measured first with `node tools/simulate.js --slow N` (a new flag: the computer's time by part and by why a
country acted, and the slowest days with who cost most) and Node's CPU profiler on a Europe game. What the profile showed: the
leader and the standings sorted afresh for every country that asked, several times a think (13% of the computer's time), and the
whole state looked through again and again for one country's armies, fleets, settlements, subjects, enemies and rebels (about a
quarter). These are now worked out once a think (`memo.js`, `memoTable`), each handed out in the order a look through everything would
give; and a region with none of a country's capitals in it is not checked in full for a proclamation.

It also showed that the spikes on the 1st of each month were not the computer's: simulate.js had counted its own war measures,
which look at every country's economy monthly, as the computer's time. It no longer does — figures for the computer's time before
this section are a little high, most of all their slowest days.

**Check.** Four AI-only games played before and after — Mitteleuropa seeds 1–3 for 100 years, Europe seed 1 for 20 — end in the
same state, fingerprint for fingerprint (f21997bb, afdb4ca1, c5f97160, bf73c646), with the same 9,568, 8,919, 9,822 and 11,839 orders.

**What it showed.** The computer's time a day:

| | Before | After |
|---|---|---|
| Mitteleuropa, mean (3 games of 100 years) | 0.68–0.74 ms | 0.42–0.45 ms |
| Europe, mean (seed 1, 20 years) | 7.55 ms | 3.31 ms |
| Europe 1440–1455: mean, p95, p99, slowest | 7.5, 13.8, 17.8, 35 ms | 3.1, 6.5, 9.6, 21 ms |

The slowest days left are one great power's full think — France on its first, Hungary's diplomacy at 6 ms — not anything
shared: the time is now spread over the war (38%), diplomacy (29%), the economy (15%) and the forces (10%).

## 29. Mercenaries for hire: the world's companies and a settlement's room (2026-11-22)

**What changed.** The world has 1% of its people in companies for hire until 1490, rising to 2% by 1600; hiring takes from them,
dismissals and desertion give back, the dead are gone, and they fill again by a tenth a year. A settlement takes at most 1,000
being hired at once (a city 2,000, a capital 4,000). The computer hires within both, counting what countries that think earlier
in the same tick have hired (TODO.md #36; RULES.md §8).

**Run.** `node /tmp/probe/mercs.mjs mitteleuropa <seed> 210`, seeds 1–3: the companies sampled each month.

**What it showed: they bind, now and then.** The computer hires a great many mercenaries over a game — 231,000, 454,000 and
652,000 — with up to 50,000–100,000 in service at once, late, against companies of 55,000–114,000. Under 1,000 were for hire in
1.3–2.2% of the months, under a quarter of the companies in 2.3–4.4%: in a general war the companies run out, otherwise there are
enough. No hire was refused.

## 30. The medium level: fighting beside allies (2026-11-24)

**What changed.** At the medium level (src/ai/levels.js) the computer counts the allied armies at war with a place's owner with its
own: those standing at a town for a storm or a battle on arrival, those on their way too for a siege; and it defends an ally's
town an enemy marches on before it is besieged (TODO.md #31). Normal plays as before, to the fingerprint.

**Run.** `node tools/strength.js --candidate working --level medium --seeds 20 --years 210 --jobs 3 --label allies` (Mitteleuropa,
seeds 101–120; each test country alone at medium, every other country at normal): `strength/2026-11-24-allies.json`.

**What it showed: nothing measurable, at a cost.** −0.10 settlements a country [−1.52, +1.31]; wins 18 against 16 of 120; every
country within the noise (Austria −2.50, Saxony +1.91, Brandenburg +1.56). Refused orders a little more (0.71 against 0.63 a game).
The thinking cost 40.5 µs a country-day against 9.1: the allied armies looked for anew for every settlement weighed. Two things to
do: index them once a think (the same orders, cheaper), and measure the level where it is meant to work — every country at
medium, or the Empire's members together — since here a medium country's allies play at normal and never come to it.

**The Empire's members at medium (`createAI({ empireLevel: "medium" })`, the rest at normal).** Europe, 3 seeds each way, 210
years: the German states held 38 of the Empire's 96 towns at the end at medium against 48 at normal, outsiders took 125 against 41 —
one seed's 256 captures most of it, and three pairs no more than chance. Mitteleuropa, 10 seeds each way: the Empire's 55 towns all
in German hands in every game (the map has hardly any outsiders), and the battles fought by allies together as rare at either level
— a storm and a battle a game, medium less normal −0.1 [−1.5, +1.3] and −0.3 [−1.6, +1.0]. The level counts allies who happen to be
beside it, and they almost never are: to fight together, the computer must go where its allies fight.

**Joining allies' sieges, at medium.** An enemy town an ally besieges now draws a medium army harder (×1.5 more) and from further (its
worth halving at 80 days, not 40), to storm it together or join the siege — while no town of its own is besieged or marched on.
Normal unchanged, to the fingerprint. The same 10 Mitteleuropa pairs: storms fought by allies together 1.5 a game against 1.1, +0.4
[−1.2, +2.0]; battles −0.3 [−1.5, +0.9]; nothing else moved. The right way, and too little to tell: an ally besieging a town within
reach of a free host of 800 men or more, with nothing of its own threatened, is a rare moment.

**How often there is anything to fight together over** (`/tmp/probe/chances.mjs`: 5 Mitteleuropa games of 210 years, every country
every 30 days, all at normal). At war: 10,055 checks; alongside an ally against the same enemy, 35% of them; an ally besieging a town
of an enemy of ours, 2.1%; one of our free hosts (800 men or more, standing, not shut in) within 120 days of it, 0.3% — 33 checks,
26 of them in one game, and none of our towns besieged in 30. Allies fight the same wars on different fronts: the moment medium
waits for comes about six times a game, all countries together. To fight together they must choose the same front first.

**The ally's front, at medium.** An enemy town within 120 days of an ally's armies out in the field (at war with its owner) is worth up
to three times as much to a medium army, and drawn from further (warOrders, `frontOf`); normal unchanged, to the fingerprint. The
same 10 Mitteleuropa pairs, the Empire's members at medium: storms by allies together 1.2 a game against 1.1, +0.1 [−1.2, +1.4];
battles 1.6 against 1.3, +0.3 [−1.5, +2.1]. Every country at medium, 5 games: an ally besieging a town of our enemy's, 3.9% of the
time at war against 2.1% — the front draws allies into each other's wars — but one of our free hosts within 120 days of it, 0.34%
against 0.33%, as rare as before. On this map allies meet a shared enemy from opposite sides; the computer alone cannot bring them
together. Kept: it plays no worse by any measure, and costs nothing more.

**Taken out.** None of the three — counting allies, joining their sieges, their front — measured stronger or changed how often
allies fight together, so the medium level was removed for simplicity: war.js is as before it, and normal plays the same.
