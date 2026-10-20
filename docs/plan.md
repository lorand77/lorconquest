# LorConquest — Plan

The order in which the game gets built. The rules are in [RULES.md](RULES.md), the map in
[SCENARIO.md](SCENARIO.md), and how the software works in [design.md](design.md). This file
says what to build when, and how to tell each step is done.

**Status:** milestones 1 to 5 are done (2026-10-20); milestone 6, multiplayer, is next.

## How we work

- **Every milestone ends with something you can run and check.** It is done when its *Check*
  passes and `npm test` is green, not when the code is written.
- **The rules engine comes first, headless.** The server, the screen and the AI are built on an
  engine that already works and is tested without any of them.
- **The risky parts come early.** The real-time loop gets loaded with 44 countries in milestone 2,
  long before the real AI exists.
- **Docs move with the code.** A rule question answered while building goes into RULES.md; a
  design decision goes into design.md, in the same commit.
- **From milestone 2 on, games are saved and replayed from their command log,** so any change
  that makes the same commands play out differently bumps the rules version (design.md, *Saving,
  restarting, replays*).

## Milestones

| # | Milestone | You can… |
|---|---|---|
| 1 | The engine | run a scripted war in the terminal and read what happened |
| 2 | The live game | play armies on the map in the browser, against placeholder countries |
| 3 | Running a country | run a country's money, research, laws and fleets for decades |
| 4 | Diplomacy | declare wars with allies, sign agreements, make peace, take subjects |
| 5 | Computer players | play a whole single-player game against real computer countries |
| 6 | Multiplayer | play with up to 4 people, signed in, from the lobby |
| 7 | Finishing | watch replays, see the leaderboard, play it online |

---

### 1. The engine

The rules for armies, headless: no server, no screen, no AI.

**Delivers**
- **Project setup:** `package.json` with no dependencies, `node --test`, the folder layout, and a
  repo `CLAUDE.md` with the conventions from design.md.
- **Loading the scenario** from `scenario.json`, and the starting state from RULES.md §2:
  treasuries, cores, capitals, a sword-armed garrison in every settlement.
- **Time:** the day counter, the 365-day calendar, month and year boundaries; the seeded random
  numbers kept in the game state.
- **Commands:** the one validator, accept or reject with a reason; the command log.
- **Movement:** finding routes through land the army may enter; march times with river and pass
  delays at an even pace; stopping where an enemy stands; head-on meetings on routes; capturing
  undefended settlements; beginning sieges at defended ones; splitting and merging armies.
- **Battles:** the power formula with every weapon rule (pike and shot, cavalry, cannons and
  crews); defence and walls; losses; ties; armies fighting together; marching retreats; the
  3-month cooldown; the dead taken from population.
- **Sieges:** length, disease, sortie, storm with the d6 roll, surrender.
- **Supply attrition.**
- **War, minimally:** a table of who is at war with whom, set by a `declare war` command. Allies,
  agreements and peace wait for milestone 4.
- **Saving:** a snapshot of the whole game, and loading it back.
- **A runner:** `node tools/run.js <script>` plays a game from a script of commands at given days
  and prints what happened, as fast as the machine allows.

**Check**
- Tests for every formula, against the worked examples in RULES.md.
- A snapshot plus the commands after it gives exactly the state of an unbroken run.
- The runner plays scripted wars that read right, for example Bavaria taking Ulm, and a siege of
  Vienna with a sortie.
- A tick with every country's armies on the move is timed, so the budget is known before the AI.

**Decided at the start:** the engine is ES modules, and men are whole with losses rounded to the
nearest man (design.md, *The engine*).

**Done.** `npm test` checks the formulas against RULES.md on a tiny map with loaded dice, the
starting state, replays from snapshots, and four scripted wars on the real map (`test/wars/`:
Bavaria storming Ulm, a head-on meeting, a pass held at ×2, Vienna relieved and sortieing).
`tools/bench.js` puts a game day with every country at war at about 0.1 ms on average and 3 ms at
worst, against the 100 ms it has in play. The rule readings it needed are in RULES.md: turning back
and stopping, what retreating armies may do, relief forces, the cooldown, arrival ties.

**Not in it:** money, the shop, research, laws, fleets, diplomacy beyond war, the AI.

---

### 2. The live game

The engine running in real time on the server, shown in the browser.

**Started with** a sketch of the game screen, now design.md's *The game screen*.

**Delivers**
- **The server:** Express and Socket.IO, with LorCiv's `config.js`, `log.js`, the
  `app.js`/`server.js` split and test helpers.
- **One worker thread per game:** the 100 ms tick, the catch-up rule, pause; commands in, each
  tick's changes out.
- **Saving:** the command log and a snapshot every game year in SQLite (`node:sqlite`). A restarted server
  resumes every game at the exact day it was on.
- **Country colours:** picked by `tools/map.js` so neighbours differ, with a Colour column in
  SCENARIO.md to override (design.md, *The map on screen*).
- **The screen:** `map.svg` with lands coloured by owner, armies drawn and moving smoothly from
  their march data, the date, pause. Orders: select an army, move it, besiege, storm, sortie,
  split, merge. Previews (march time, whether an order is allowed) from the engine in the browser.
- **Per-player views:** each player gets the public changes and only their own private ones.
- **Placeholder countries:** the 44 others give random legal orders on the staggered schedule of
  the real AI, so the loop carries the real load.
- **No accounts yet:** a development page starts a game as any country.

**Check**
- A single-player game played in the browser: march, fight, besiege, take settlements.
- With 44 placeholder countries the tick stays inside its budget, measured and logged.
- Restarting the server mid-game resumes it at the same day, with nothing lost.

**Depends on:** 1.

**Done.** `npm test` boots the real server on throwaway databases and plays games over sockets: a
player's view holds no dice and no other country's treasury; commands are always the player's
country's; the client's copy, kept from each day's changes, matches the game exactly; leaving
pauses the game; a restarted server resumes it at the same day with the same state, and the saved
log alone rebuilds it from the seed. With 44 placeholder countries a day takes about 0.4 ms in its
worker, logged as `game.timing`, against its 100 ms. Not checked by machine: the screen in a
browser — there is none in the development container — so the first game played by hand is the
real check of the page.

---

### 3. Running a country

Everything a country does apart from fighting and diplomacy.

**Delivers**
- **Money:** settlement money, tax and its uprising chance, upkeep, paid monthly; the bank, loans
  and default; debt and bankruptcy.
- **Research:** the slider, choosing a tech, libraries.
- **The shop:** buildings, weapons and cannons into the reserve, equipping armies, people,
  sharpshooters at passes, ships at ports.
- **Raising forces:** soldiers and cannon crew trained in core settlements (faster in the
  capital); mercenaries; sending men home.
- **Conscription laws** and the army and navy caps.
- **The land:** population growth, coring and courthouses, special coring, losing and naming a
  capital.
- **Random events:** harvest, plague, peasant uprisings with their rebel armies.
- **Fleets:** sailing between zones, ports, crews, blockade, patrol, naval battles, crossing
  straits.
- **Panels on screen** for all of it.

**Check**
- Tests for every formula, against RULES.md's examples and tables.
- A country run for 50 game years in the browser: its money, research and army add up by hand.

**Decided first:** the starting ships are one fleet of cogs in the capital's port (or the lowest-numbered
port); a captured settlement stays core for every country that had it core (both in RULES.md).

**Depends on:** 2.

**Done.** Every rule above is in the engine, with tests worked out by hand on a tiny map with a sea, two
ports, a strait and a region, and a script that runs Bavaria for three years on the real map. The state of
a game with a country running its economy replays exactly from its commands. A random-play fuzz of 40
games of 20 years each found one real bug (a company of mercenaries that all deserted left an empty army
behind), now fixed and tested. A game day with everyone at war and all of this takes about 0.15 ms
against its 100 ms; with 44 placeholder countries a server game takes about 0.5 ms. The Country, Shop and
Research tabs, the fleet panel and an army's equipment are tested against a fake element; as in milestone
2 the page itself has not been opened in a browser.

---

### 4. Diplomacy

All of RULES.md §10, and the end of the game.

**Delivers**
- **War:** declaring it; defensive allies and guarantors joining; calls to arms as questions with
  a deadline (an unanswered human joins after 6 months).
- **Agreements:** both alliances, guarantees, military access, non-aggression pacts, truces;
  breaking them; neutral land closed.
- **Subjects:** vassals and protectorates, tribute, breaking free.
- **Peace:** terms of settlements, money and subjects. Computer countries answer by the formula;
  offers between humans wait with a deadline.
- **The computer countries' side, as rules:** warmonger scores, opinion, accepting proposals,
  coalitions, subject demands.
- **The Empire:** the proposal and the League.
- **Victory:** 45 settlements or the end date.
- **On screen:** the diplomacy panel, offers, notifications.

**Check**
- Tests for every formula and every way into and out of a war.
- A scripted diplomatic run: a war that pulls in allies, a coalition forming against a warmonger,
  a peace, a vassal breaking free, an Empire proposal.

**Depends on:** 3. It comes before the AI so the AI is built once, on the complete rules — the
computer countries' *answers* are rules and work here without it.

**Done.** All of §10 is in the engine except the historical scenario's Emperor machinery (design.md §2): wars between
pairs with their records, calls to arms, peace with terms and the war score, agreements and breaking them, subjects and
tribute, demands, the Empire proposal and the League, opinion, coalitions, the warmonger score, victory and the end of a
game, and the starting wars and agreements of a scenario (the historical one opens with 5 wars and 13 agreements). A
human is asked and has 6 months; a computer answers at once. The Diplomacy tab shows the engine's own formulas as
previews. A random-play fuzz now includes diplomacy on both scenarios (two big sweeps clean); it found four real bugs on
the way — a ghost army left by deserting mercenaries (milestone 3), an army "friendly" with an enemy it joined a war
against, rings of overlords, and a command that hung a finished game — all fixed and tested. As before, the page itself
has not been opened in a browser.

---

### 5. Computer players

The real AI, replacing the placeholders.

**Delivers**
- **The computer player:** reads the state and sends commands like a human, inline in the game's
  worker, on the staggered schedule, within the tick budget.
- **The three layers:** strategy (yearly), operations (every 10–20 days), reflexes (the tick after
  an event).
- **The caretaker,** for a disconnected human's country.
- **A simulation tool:** many AI-only games, headless, at full speed, with win rates by country —
  and an `experiments/` folder for what we learn from it, as in LorCiv.

**Check**
- AI-only games run 1440 to 1650 without errors, inside the tick budget.
- Computer countries expand, ally against warmongers, make peace and use their money sensibly.
- A single-player game against them is a game.

**Depends on:** 4.

**Done.** `src/ai/` is the computer player: a character per country, and on its own 10–20 day schedule a think that
raises and arms soldiers, hires mercenaries in war, runs the economy from a shared budget, asks for peace on terms the
other side's formula will accept, plans and declares wars it should win, proposes alliances and pacts, and musters,
marches, besieges, storms and sorties; the tick after a siege or a war it looks at its war again. The caretaker defends
and answers calls to arms only; the full AI can be handed a human's country (`rooms.setCaretaker`; who does that when is
milestone 6). `tools/simulate.js` plays AI-only games headless on worker threads and reports wins, wars, peaces, captures,
refused commands and timing; what it showed, and what was changed because of it, is in `experiments/`. The check as run:
games from 1440 to 1650 on both scenarios without an error or a broken invariant (`test/ai/ai.test.js`, and sweeps of
24 and 8 games), about 1 ms a day for 45 computers on the Mitteleuropa map and 3 ms on the historical one against the
100 ms; about 17 wars (and 7 joined), 23 peaces and 34 conquests a game, ten different winners in 24 games, and the commands alone
replay each game exactly. Found on the way, and fixed in the engine: a country with no land left went bankrupt every
month for ever (rules version 4, RULES.md §2). Not checked by machine: whether a game against them is *fun* — that is the
first game played by hand. **Not in it:** fleets and naval war, cannons, and the historical scenario's Emperor.

---

### 6. Multiplayer

Up to 4 people in one game, signed in.

**Delivers**
- **Accounts and sessions** from LorCiv: the database layer, login, the page shell.
- **The lobby:** tables, picking free countries first come, the host starting with seats still
  open for the computer.
- **The game rules for people:** the setup minute; disconnects (caretaker at once, the full AI
  after 2 minutes); taking a country back; the game ending when no human is left; single-player
  games paused and resumed another day.
- **Chat.**

**Check**
- Four browsers play one game.
- One player's connection is cut and restored, before and after the 2 minutes.
- The server restarts mid-game and everyone reconnects to it.

**Depends on:** 5 (the caretaker and the takeover need the AI).

---

### 7. Finishing

**Delivers**
- **Replays** of finished games from their command log, checked against the rules version.
- **The leaderboard,** ranking the humans of each game.
- **Online:** the deployment, health check and nightly backup from LorCiv's setup; terms and
  privacy pages.

**Check:** the game is online, and a finished game's replay ends exactly as the game did.

**Depends on:** 6.
