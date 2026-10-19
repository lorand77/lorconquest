# LorConquest — Design

How the software will work and why. The game's rules are in [RULES.md](RULES.md), the map in
[SCENARIO.md](SCENARIO.md) and its data file [scenario.json](scenario.json); this file is about
the program that runs them. When a decision changes, change it here.

**Status: planning.** Nothing is built yet. The order is strategy, then stack, then a plan, and
only then code. LorCiv (`lorciv-temporary-import/`, a turn-based game on the same stack) is here
only as a reference for the approach.

---

## 1. What is decided

### The game in one paragraph

Real-time grand strategy you can pause in single player: one game day every 0.1 s, a game year
in 36.5 s, 1440 to 1650 in about two hours. 45 countries on a map of 87 settlements, up to 4 of
them human, the rest run by the computer. Almost everything takes months — a march about 10 s,
training 9–18 s, a siege longer — so a network delay of 100–200 ms is a day or two of game time
and does not matter. This is not a fast RTS: no client-side prediction, no rollback.

### Stack

LorCiv's: **Node 24, Express 5, Socket.IO, better-sqlite3, plain JavaScript in the browser** — no
bundler, no framework, no build step.

- The game is small — 87 settlements, 45 countries, a few hundred armies and fleets — so the
  processor is not the limit; keeping the clock steady is. Node does that well with one thread
  per game (below).
- One language on both sides: the browser can use the same rule code for previews (what a
  purchase costs, how long a march takes) without ever deciding anything.
- Socket.IO gives rooms, replies to messages and automatic reconnects, which a live game needs.
- LorCiv's generic parts — accounts, sessions, database layer, logging, page shell, deployment —
  carry over (see *Reuse from LorCiv*).

Considered and not chosen: TypeScript (would need a build step for the browser), Colyseus (a
multiplayer framework that dictates how state is declared and offers nothing for command logs or
replays), a Go or Elixir server (built for far more load than this, and the rules could not be
shared with the browser), and one player's browser hosting the game (the game dies with the tab).

### The server runs the game

The server holds the only real copy of each game: the clock, the rules and the computer players.
Players send **commands** ("move army 12 to Prague", "set tax 2.4"); the server checks each one,
applies it and sends every client what changed. Clients draw the game and send commands — never
more.

Not chosen: clients running the same simulation from the same commands. That needs every
browser to compute bit for bit what the server does, and each slip is a desync that is hard to
find. With the server alone running the rules, only Node has to agree with itself.

### Players

- **Single player:** one human, free pause, one speed — no ×2 or ×4. Leaving pauses the game;
  its snapshot is saved, its worker stops, and it is rebuilt when the player comes back, the
  same way as after a restart.
- **Multiplayer:** up to 4 humans, the computer running every other country. Each player picks
  a free country, first come; the host may start with seats still open, and the computer takes
  them. For the first minute the clock stands still while players look around and give first
  orders; after that, no pauses (RULES.md §1). Players can chat, as in LorCiv.
- **Disconnects** (multiplayer): a **caretaker** takes the country over at once; after
  **2 minutes** away the full computer player does. A player who comes back takes the country
  back at the next tick. The 2 minutes is a server setting, tunable without touching the engine.
- **A multiplayer game ends when no human is left** — every one has quit, or been away longer
  than 2 minutes.
- **A computer country can win** (SCENARIO.md, *Victory*); then every human loses. The
  leaderboard still ranks the humans of a game among themselves.

**The caretaker** defends with the armies the country already has: it moves them within its own
and friendly land to meet invaders, sorties when the odds favour it, and joins wars its allies
call it into (refusing would end the alliance, which cannot be undone). It buys nothing, borrows
nothing, changes no setting, declares no war, makes no peace, signs no agreement and lets offers
from other humans expire. Nothing it does commits the player to anything they could not have
chosen themselves.

### Time

**One tick is one game day, every 100 ms.** The game day — an integer counted from 1 January
1440 — is the only clock the rules know; the engine never reads the wall clock.

- **The engine has no timer.** It exposes "advance one day"; the server's loop calls it every
  100 ms. Tests and AI-only simulations call it as fast as they like.
- **A late tick** is caught up by running the missed days at once, up to 5 (half a second). If
  the loop falls further behind, the backlog is dropped and game time slips behind wall time
  rather than skipping days.
- **While paused** (single player, and the multiplayer setup minute) the loop keeps applying
  commands, so purchases and orders show at once, but does not advance the day.

### One game, one loop

Every tick, in this order:

1. **Apply queued commands** in the order they arrived — humans, computer players and caretakers
   alike. Each is checked against the state *now*, not when the player clicked, so money spent in
   between is caught. The sender gets an accept or a reject with a reason.
2. **Advance one day:** marches and arrivals, battles, sieges, training. Monthly and yearly steps
   (money, supply, disease, growth, random events) run on their boundaries.
3. **Let the computer countries due this tick think.** Their commands join the queue for the next
   tick, like anyone's.
4. **Send each client one message** with the day's changes.
5. **Log** the commands applied this tick; save a snapshot once per game year.

A game is a single loop, so two commands never run at the same time. Concurrency inside a game is
only ordering: no locks, no races.

### Threads

- **The main thread** runs the web server, sessions, sockets, the lobby and the database.
- **Each running game has its own worker thread** with the engine, the loop and its computer
  players. A slow game slows only itself, a game that crashes does not take the server down, and
  games spread over every processor core.
- They talk by messages. **In:** commands (with the sender's country and a request id), players
  connecting and disconnecting, pause and resume. **Out:** each tick's changes (the main thread
  fans them out to sockets), replies to commands, commands and snapshots to save, game over.
- **The main thread owns the database** — one writer, and a worker never waits on the disk. A
  snapshot is tens of kilobytes once every 36.5 s; the command log is a few rows a second.

If there are ever too many games for one thread each, a fixed pool of workers with several games
each replaces it without touching the engine.

### The computer players

**They run inside the game's loop, in the game's worker**, a few countries per tick.

- **A computer player is a player.** It reads the state and sends commands through the same queue
  as a human; it never changes the state directly. That keeps it honest, gives it the same
  checks, and lets it move to a thread of its own later if it grows heavy.
- **Staggered:** each computer country has its own next-think day, spread so that about 3 of the
  44 think in any tick, each every 10–20 days (1–2 s).
- **Three layers**, so the expensive thinking is rare and the reactions are fast:

| Layer | How often | Decides |
|---|---|---|
| Strategy | about once a game year (~36 s), staggered | war targets, alliances, conscription law, tax, research, building plans, loans |
| Operations | every 10–20 days (1–2 s) | where armies go, sieges, buying men and weapons, peace offers |
| Reflex | the tick after an event | war declared on it, an enemy army entering its land, a lost battle, a chance to sortie, a call to arms |

- **Answering proposals is rules, not AI.** RULES.md §10 gives the formulas by which a computer
  country accepts peace, alliances, pacts and subject demands; the engine applies them in the
  same tick. The AI decides only what to propose, declare and do.
- **It can rebuild its plans from the game state.** A restart or a takeover from a human
  mid-game then needs nothing extra.
- **Budget:** a tick, rules and computer players together, should take a small fraction of its
  100 ms. To be measured, not assumed.
- Difficulty, and whether it means a slower reaction, is decided later.

### Questions with a deadline

Some things wait for an answer while the clock runs: a call to arms, an offer from one human to
another, peace terms between humans. Each becomes a **pending question** with a deadline in game
days. Whoever controls the country — human, caretaker or computer — answers with a command; when
the deadline passes, the default applies. Computer players answer on their reflex layer.

- **Calls to arms:** a human who has not answered within 6 months joins (RULES.md §10).
- **Offers between humans** — peace terms, agreements, subject demands: one side proposes, the
  other accepts or refuses; a counter-offer is a new offer, and haggling happens in chat.
  Unanswered, an offer lapses. Its deadline is a server setting, starting at 6 months like calls
  to arms.

### Saving, restarting, replays

- **The command log** holds every applied command — human, computer, caretaker, and the server's
  own (a country changing hands between a human and the computer) — with the day it was applied
  and its place in that day's order.
- **A snapshot** of the whole game is saved once a game year.
- **The engine is deterministic:** its random numbers come from a seeded generator kept in the
  game state, and nothing in it reads the time or iterates in an undefined order. Since only the
  server runs the rules, only Node has to agree with itself.
- **Restart:** each running game loads its last snapshot and re-applies the logged commands after
  it, without running the computer players, to the exact tick. The clock resumes when the first
  human reconnects; if none does within 2 minutes, a multiplayer game ends. A single-player game
  stays paused until its player returns.
- **Replays** of finished games need the rules only — not the AI, because its commands are in the
  log. Changing the AI never breaks an old replay. Changing the rules does: like LorCiv, every
  game records the rules version it was played under.

### Messages

- **Client to server:** commands, each with a request id; the reply carries the same id.
- **Server to client:** the full state on joining (the first load, a reload and a reconnect all
  use it — no separate catch-up), then one message per tick with the day and its changes.
- **Army positions are not sent each tick.** An army moves at an even pace along a route
  (RULES.md §8), so a march is known from its route, start day and arrival day; the client
  animates it from that. The server finds head-on meetings the same way: two enemy marches on
  the same route in opposite directions meet on the day their positions cross.
- **What each player sees:** the map, every army and fleet, and what RULES.md says is shown to
  everyone (warmonger scores) are public. A country's treasury, research, tax, slider, loans,
  weapons reserve and the computer countries' opinions are private to it. The worker sends
  each tick's public changes to everyone and each country's private changes to its player only;
  the full state on joining is filtered the same way.

### The engine

The rules live in one set of files, the **engine**, that runs in two places: inside each game's
worker on the server, where it decides everything, and in the browser, where it only previews —
what a purchase costs, how long a march takes, whether an order is allowed — before the command
is sent. It therefore uses no Node-only and no browser-only APIs, reads no clock and keeps its
random numbers in the game state. It loads `scenario.json` and knows nothing of sockets, the
database or the screen. `test/engine/determinism.test.js` checks the files for anything that
would break that.

- **ES modules** (`src/engine/*.mjs`): the browser loads them as modules with no build step, and
  the rest of the code, CommonJS as in LorCiv, `require`s them directly (Node 24 can).
- **One entry point,** `index.mjs`. A game is a `Game` (`game.mjs`): the map built from the
  scenario, the state, and the log of accepted commands with the day of each. `command(cmd)`
  applies one through the validator (`commands.mjs`) or refuses it with a reason; `advance()` moves
  one day (`day.mjs`) and returns its events; `snapshot()` is the state as JSON, `Game.restore` and
  `replay` rebuild a game from a snapshot or from its seed and log.
- **The state is plain JSON:** countries, settlements, armies (by id; the starting garrisons are
  numbered like their settlements), wars, battle cooldowns, the day and the random state
  (mulberry32, one 32-bit word). `RULES_VERSION` and `FORMAT` in `state.mjs` are stamped on every
  state and checked on restore.
- **The map** (`map.mjs`) is the scenario as a graph: settlements and passes are places, keyed
  `"37"` and `"P3"`; land routes are legs, two either side of a pass, one per pair of places. A
  leg takes its route's years × 365 days, rounded to a whole day.
- **Where an army is:** at a place (`at`), or on a leg (`march`: from, to, start day, end day),
  moving evenly — so its position on any day is arithmetic, and head-on meetings are found from
  the day two marches cross. Start and end may be fractions of a day.
- **Whole numbers:** men, cannons and crews are whole. A loss is a share of the army: the total
  is rounded to the nearest man and spread over its weapons by largest remainder; cannons are
  rounded separately and each takes 10 crew with it. Population, treasury and money keep their
  fractions inside the engine and are only rounded for people.
- **The modules:** `calendar`, `random`, `army` (what an army is worth, losses), `map`, `state`,
  `movement` (marching, turning back, retreats), `battle` (one battle and the cooldown),
  `fighting` (arrivals, sieges, storms, sorties, relief, passes, head-on meetings), `supply`
  (monthly disease and hunger), `day`, `commands`, `game`.

### The map on screen

`map.svg` is shown as it is. Its shapes carry ids — `land-ID` for each settlement's land,
`route-…`, `settlement-…`, `pass-…`, `sea-…` — so the client recolours lands as they change hands
and draws armies and fleets on a layer above. No canvas renderer.

### Reuse from LorCiv

Copied when a milestone needs it, not up front:

- **From the start:** `config.js`, `log.js`, the `app.js`/`server.js` split, the test helpers.
- **With the lobby:** accounts and sessions (`src/auth/`), the database layer (`src/db/`, raw
  SQL, `addColumnIfMissing` migrations), the page shell, login and theme, the lobby skeleton,
  chat.
- **Later:** leaderboard, profiles, friends, achievements, replays page; `health.js`,
  `scripts/backup.sh` and the deployment in `docs/setup.md`.
- **Not reused:** the whole game — `src/shared/`, the turn logic in `src/game/rooms.js`, the
  canvas renderer, the game page.

LorCiv's conventions carry over too: CommonJS, `"use strict"`, no new dependencies without
asking, raw SQL prepared statements, a comment at the top of every module, never trusting the
client.

### Testing

- `node --test`, as in LorCiv (`npm test`).
- **Engine tests** on a tiny map worked out by hand (`test/helpers/tiny.js`), with the dice loaded
  where a number matters (`rig`), so every power and loss can be checked against RULES.md's
  formulas; the starting state on the real map.
- **Scripted wars** (`test/wars/*.txt`) played by the runner (`tools/run.js`) on the real map,
  checked for their outcome.
- **Replays:** the same script gives the same game to the last die, and a snapshot plus the
  commands after it gives exactly the unbroken game.
- **Golden games:** a fixed seed and command log must end in a known state. A change that breaks
  one either is a bug or needs the rules version bumped. (From milestone 2, when games are saved.)
- **Timing:** `tools/bench.js` plays years of every country at war with armies sent about at
  random and prints the time per game day.
- **AI-only games**, headless and at full speed (no 100 ms wait), many at once: for crashes,
  balance and timing.
- **Integration tests** boot the server and connect socket clients, as in LorCiv.

### Development environment

Node 24 is installed; nothing is added to `.devcontainer/devcontainer.json`. The map tools are Node too:
`tools/map.js` builds `scenario.json` and `map.svg` from a scenario folder, and
`scenarios/historical-1440/make-base.js` drew that scenario's first map from real geography. The repo has no Perl.

---

## 2. Open questions

Settled answers move into §1, or into RULES.md where they are rules. Each is needed by the milestone
named (see [plan.md](plan.md)).

1. **The game screen** (before milestone 2): where the map, the panels and the notifications go,
   and how an order is given — select an army, then click where it should go?
2. **Where the starting ships lie** (milestone 3). RULES.md §2 gives a coastal country pop ÷ 2000
   cogs but not in which of its ports.
3. **Cores after a capture** (milestone 3). Does a settlement stay core for the country that
   loses it, so that retaking it makes it core again? The engine keeps each settlement's list of
   cores untouched by captures until this is settled.

---

## 3. Commands (draft)

Every order and purchase in RULES.md, as commands. Each is checked on the server when applied.

| Group | Command | Rules |
|---|---|---|
| Army | move (to a settlement or pass, by a route or a strait; on arrival besiege, or storm) | §6, §8 |
| | stop | §8 |
| | besiege · storm a settlement · sortie (garrison only) | §6 |
| | storm a sharpshooter post | §5 |
| | split · merge | §8 |
| | equip weapons from the reserve | §8 |
| | equip cannons from the reserve (one per 10 crew) | §3 |
| | send men or crew home (weapons and cannons to the reserve) | §8 |
| Fleet | move to a neighbouring sea zone · enter or leave a port | §8 |
| | blockade a port · patrol | §7 |
| | split · merge | §8 |
| Country | raise soldiers or cannon crew at a core settlement · hire mercenaries · dismiss mercenaries | §3, §8 |
| | buy weapons and cannons (to the reserve), people | §3 |
| | buy sharpshooters at a pass you own · buy ships at a port | §3, §8 |
| | buy a building in a settlement (walls, library, workshop, market, courthouse) | §3 |
| | set tax · set research slider · change conscription law | §2, §4, §9 |
| | deposit · withdraw · borrow · repay · default | §2 |
| | choose the tech to research | §4 |
| | name a new capital | §2 |
| | proclaim a region (special coring) | SCENARIO |
| Diplomacy | declare war · answer a call to arms | §10 |
| | propose an agreement · cancel military access · break an agreement | §10 |
| | demand a subject · propose peace with terms · answer an offer | §10 |
| | propose the Empire (once ever) | SCENARIO |
| Game | pause · resume (single player) | §1 |
