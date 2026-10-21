# LorConquest — Design

How the software will work and why. The game's rules are in [RULES.md](RULES.md), the map in
[SCENARIO.md](../scenarios/mitteleuropa/SCENARIO.md) and its data file [scenario.json](../scenarios/mitteleuropa/scenario.json); this file is about
the program that runs them. When a decision changes, change it here.

**Status: built through milestone 6** (see [plan.md](plan.md)); what each part does is in its section
below, written when it was built. LorCiv (`lorciv-temporary-import/`, a turn-based game on the same stack) was
the reference for the approach and the source of what was reused.

---

## 1. What is decided

### The game in one paragraph

Real-time grand strategy you can pause in single player: one game day every 0.1 s, a game year
in 36.5 s, 1440 to 1650 in about two hours. 45 countries on a map of 87 settlements, up to 4 of
them human, the rest run by the computer. Almost everything takes months — a march about 10 s,
training 9–18 s, a siege longer — so a network delay of 100–200 ms is a day or two of game time
and does not matter. This is not a fast RTS: no client-side prediction, no rollback.

### Stack

LorCiv's, nearly: **Node 24, Express 5, Socket.IO, SQLite through Node's built-in `node:sqlite`,
plain JavaScript in the browser** — no bundler, no framework, no build step. Express and Socket.IO
are the only dependencies.

- The game is small — 87 settlements, 45 countries, a few hundred armies and fleets — so the
  processor is not the limit; keeping the clock steady is. Node does that well with one thread
  per game (below).
- One language on both sides: the browser can use the same rule code for previews (what a
  purchase costs, how long a march takes) without ever deciding anything.
- Socket.IO gives rooms, replies to messages and automatic reconnects, which a live game needs.
- LorCiv's generic parts — accounts, sessions, database layer, logging, page shell, deployment —
  carry over (see *Reuse from LorCiv*).
- `node:sqlite` rather than LorCiv's `better-sqlite3`: the same synchronous prepared statements,
  with no dependency and no native module to compile and rebuild (LorCiv's setup notes warn about
  that twice). It has no transaction helper, so the database layer has its own, and LorCiv's
  session store, made for `better-sqlite3`, is replaced by a small one of our own (milestone 6).
  Node's documentation does not call it stable yet; we pin Node 24.

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

**What was built** (milestone 6; `src/auth/`, `src/game/rooms.js`, `socket.js`, `routes.js`, `public/index.html` and `login.html`):

- **Tables.** A game starts as a table: a person opens one on a scenario in the seat of a country; up to three more take a
  free country each, first come; the host starts it whenever they like, and the computer plays every country nobody took.
  A table is a row of `games` with status `lobby`, its seats rows of `game_seats`; starting it makes the seats the
  game's humans for good (the same list a replay is given). One person, one seat per game; a seat can be given up
  until the start (the host cancels instead). "Play alone" opens a table and starts it at once.
- **Single player** (one seat): free pause; the last socket leaving pauses the game and it waits, resumed whenever the
  player opens it again, after a restart too.
- **Several people:** the clock stands still for `SETUP_MS` (a minute) from the start while orders are accepted, then runs
  and no one can pause it. Everyone begins *away*, with a caretaker, until their page joins.
- **Away and back.** A player is "present" while any socket of theirs is in the game. The last one leaving makes them
  *away*: a caretaker defends at once and, after `AWAY_MS` (two minutes), the full computer player takes the country
  (*full*). Opening the game again, at either stage, gives the country back at once. `presence` tells the others. The
  worker is told by the message of milestone 5 (`{ type: "caretaker", country, mode }`).
- **Quitting** (`quit`) gives the country to the full computer player for good: that seat cannot be joined again.
- **The game is abandoned** — status `abandoned`, its worker stopped — when every seat has quit or been away longer than
  `AWAY_MS`. A game won by a country is finished as before (a computer can win, and then every human has lost).
- **Restarts.** Nothing about who is away is saved. A resumed multiplayer game runs on at once, every player away from
  that moment, so players have `AWAY_MS` to reconnect before the computer has their countries and, if none does, the
  game is abandoned. A resumed single-player game waits, paused, as before.
- **Chat** is per game: any seated player, 300 characters, five a few seconds, kept in `chat_messages`, the last 50 sent
  on joining.

**Accounts.** A person registers with a name (3–20 letters, digits, underscore; LorCiv's policy of reserved and offensive
names, converted) and a password (6–128 characters) and is signed in. Passwords are hashed with `scrypt` from
`node:crypto` (parameters stored with each hash). A session is a random 32-byte token in an `HttpOnly`, `SameSite=Lax`
cookie (`Secure` and a `__Host-` name in production); the database holds only its SHA-256, with an expiry of 7 days. REST
reads it from the `Cookie` header, so does the socket handshake. Logging out, or signing in again, ends the old session
and drops its sockets. Every request that changes something, and every socket, must come from the page's own origin;
login failures and sign-ups are throttled per address, and only two passwords hash at once. Games from before accounts
(the development page's) had no owner and are put away (status `aborted`) when the database is first opened by this
version.

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

In the code: `src/game/worker.js` is a game's thread, and lists the messages each way at its top;
`src/game/rooms.js` starts the workers, saves what they send and passes it to the sockets
(`src/game/socket.js`). A game always starts paused — a new one waits for its player, a resumed one
for its player to come back.

### The computer players

**They run inside the game's loop, in the game's worker**, a few countries per tick.

- **Their dice are their own.** A computer player never draws from the game's random state
  (`state.rng`): its commands are logged and a replay applies them without running it, so if it
  drew from the game's dice, a replay's battles would come out differently. It seeds its own from
  the game's seed, its country and the day — and its schedule is a function of the day alone, so
  a restarted game picks it up with nothing saved.

- **A computer player is a player.** It reads the state and sends commands through the same queue
  as a human; it never changes the state directly. That keeps it honest, gives it the same
  checks, and lets it move to a thread of its own later if it grows heavy.
- **Staggered:** every computer country thinks every 15 days (1.5 s), on a day of its own, so that about 3 of the
  45 think in any tick. The period is the same for all, deliberately: with different periods a country would get more chances to
  plan a war or ask for peace than another (it began as 10–20 days, a side effect of the stagger, and was made equal).
- **Three layers**, so the expensive thinking is rare and the reactions are fast:

| Layer | How often | Decides |
|---|---|---|
| Strategy | about once a game year (~36 s), staggered | war targets, alliances, conscription law, tax, research, building plans, loans |
| Operations | every 15 days (1.5 s) | where armies go, sieges, buying men and weapons, peace offers |
| Reflex | the tick after an event | war declared on it, an enemy army entering its land, a lost battle, a chance to sortie, a call to arms |

- **Answering proposals is rules, not AI.** RULES.md §10 gives the formulas by which a computer
  country accepts peace, alliances, pacts and subject demands; the engine applies them in the
  same tick. The AI decides only what to propose, declare and do.
- **It can rebuild its plans from the game state.** A restart or a takeover from a human
  mid-game then needs nothing extra.
- **Budget:** a tick, rules and computer players together takes about 1 ms on the Mitteleuropa map and
  about 3 ms on the historical one (the slowest day about 15–30 ms), against 100 ms — measured by
  `tools/simulate.js`, which every AI-only game reports.
- Difficulty, and whether it means a slower reaction, is decided later.

**What was built** (`src/ai/`; `index.js` is the entry, `createAI({ seed, humans })`, whose `orders(game, events)`
the worker calls after each day and whose `setCaretaker(country, mode)` it passes on from the server):

- **A character** (`characters.js`, `util.js` `flavorOf`): the one its scenario gives it, varied a little each game — see
  *Characters and rivalries*, below.
- **A think** (`index.js`) is, in order: answer the questions put to it (`caretaker.js`), then the forces
  (`forces.js`), the economy with what is left of the budget (`economy.js`), diplomacy (`diplomacy.js`) and
  war (`war.js`). The forces and the economy share one budget (the treasury less a reserve of a third of a year's
  money, or a tenth at war), so a think never orders what it cannot pay.
- **Economy:** tax 2, a little more at war and 2.5 when in the red (3 when it is also losing money); the research slider by what the treasury
  allows; the research order (guns, sharpshooters, then ships for a country that has them); the law by
  threat, at most once in 5 years; loans only in war, repaid when fat. **In distress** — in the red *and* losing money, as a
  country is that borrowed in a war and then lost its land — it sends home the soldiers above its law's cap and, after a
  year in debt, defaults on its loans (the rule that allows it once in 20 years), rather than sit in debt until interest eats it; courthouses, then libraries, workshops,
  markets and walls from the surplus.
- **Forces:** soldiers up to the law (most of it in peace, all of it at war or under threat); the unarmed armed
  with pikes (a third of the armed) and the best shot researched; old swords replaced when rich; mercenaries — which
  stand on top of the army cap — hired in a war as money allows and sent home in peace; sharpshooters at the
  passes facing others; and what is left of a hoard buys people, so money is used and not piled up.
- **War:** every settlement keeps a garrison (4% of its people where an enemy could come from, 1.5% inland); the
  armed men over that split off, gather at a staging settlement beside the front and merge into one host. The
  host marches on the settlement with the best value for its days — by storm if it outmatches the garrison
  ×1.2 (×1.8 behind walls) by a margin, else by siege — or on an enemy army it is much stronger than, or to the
  relief of a besieged settlement of its own. Garrisons sortie when they outmatch the besiegers. All of it is
  read from the state and nothing is remembered: a split gives an army its id only when applied, so the think
  that splits is followed by one on the next tick (the reflex layer) that moves what was made.
- **Diplomacy:** peace is asked for when a war has run its course — dictating terms (settlements next to its land,
  its own cores first) when far ahead and the war gains something, a white peace after two years of stalemate,
  money and then settlements to buy it when losing; the computer asks only what the other side's formula (the
  engine's pure `peaceAnswer`, `agreementAnswer`, `demandChance`) would accept, since the same proposal may be
  made once in 5 years. Wars are *planned*: a neighbour it outmatches, with nothing binding them, gets a 40-day
  muster before the declaration, dropped if it stops being a good idea; a warlike country seeks no pacts. Also
  defensive alliances and pacts with neighbours, military alliances against a common enemy, subjects demanded of
  much weaker neighbours, and the Empire proposed once when it holds enough. To a human it asks once a year, and
  not while a question stands.
- **Reflexes:** the country looks at its war again on the tick after a siege begins or a war is declared or joined
  or a battle is fought involving it.
- **The caretaker** (`caretaker.js`) is exactly what the *Players* section says: it joins the wars its allies call
  it into, sorties, and moves the armies it has against enemy armies in its own and friendly land; it buys, borrows,
  changes, declares, proposes and signs nothing, and lets the other questions expire. `setCaretaker(country, "full")`
  hands the country to the full AI, which also answers peace and agreement offers by formula. Commands from either
  are logged as source `caretaker`; who gives them when is milestone 6's business (a worker message
  `{ type: "caretaker", country, mode }`, and `rooms.setCaretaker`).
- **What it leaves out:** fleets and naval war (it only keeps the starting ships), cannons and crews, the
  historical scenario's Emperor (which the engine does not have either), and any memory of grudges beyond what
  the engine's opinion already keeps.
- **The simulation tool** (`tools/simulate.js`) plays AI-only games headless, in parallel on worker threads,
  and reports wins by country, wars, peaces, captures, the commands the engine refused and the time a day took.
  What it showed goes in `experiments/`.

### Characters and rivalries

Each computer country plays to a **character** its scenario gives it from history (SCENARIO.md, *Characters*), and holds
**rivalries** with the countries it fought for generations (SCENARIO.md, *Rivalries*). Both are the AI's, not rules: a person
playing the country is free of them, and the engine never reads them — so changing them bumps no rules version, and replays
are untouched (their computer commands are in the log).

- **Six characters** (`src/ai/characters.js`), each three numbers the AI reads: *aggression* (how readily it plans a war, how
  weak a target must be, whether it runs two wars, whether it seeks pacts), *friendliness* (how often it proposes alliances)
  and *builder* (libraries and walls).

  | Character | Aggression | Friendliness | Builder | |
  |---|---|---|---|---|
  | conqueror | 0.90 | 0.40 | 0.45 | expands by war, two at a time when it can, and seeks no pacts |
  | zealot | 0.85 | 0.30 | 0.35 | a crusading order or a cause in arms: fights, and trusts few |
  | opportunist | 0.65 | 0.55 | 0.50 | attacks whoever is weak enough, and keeps its hands free of pacts |
  | diplomat | 0.45 | 0.95 | 0.55 | allies, and gains by marriage and demand more than by war |
  | defender | 0.30 | 0.70 | 0.65 | holds what it has: walls, alliances, rarely a war of its own |
  | merchant | 0.30 | 0.60 | 0.95 | builds and trades, signs pacts, and pays its way |

- **Noise:** each game moves every number by up to 0.12 either way, from the seed — a country keeps its nature without being
  scripted, and a diplomat never becomes as warlike as a conqueror. A country a scenario gives no character (the tiny test map,
  a new scenario) gets one rolled at random, as before.
- **A varied spread, enforced:** `tools/map.js` refuses a scenario where any character has more than 30% of the countries or
  fewer than two, or where conquerors and zealots together are more than 30% — history is full of warlike powers, and a map of
  them would be one war. Mitteleuropa has 11 defenders, 11 merchants, 8 diplomats, 6 opportunists, 5 conquerors and 4 zealots;
  the historical scenario 17, 18, 11, 13, 9 and 6.
- **Rivalries** bend the AI's diplomacy (`diplomacy.js`): of the neighbours a country is strong enough to attack, a rival
  scores half as much again as a target; and it is never proposed anything. A rival's own proposals are still answered by the
  engine's formula, like anyone's, since answers are rules. Mitteleuropa has 16 rivalries, the historical scenario 23. Rivalries
  do *not* make a country attack at worse odds, hold out longer for peace or seek its rival's enemies as allies: all three
  were tried, and turned wars between rivals into wars between alliance blocs that the biggest country won
  (experiments/README.md, 5).

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
- **A snapshot** of the whole game is saved at the start of every game year; only the latest is
  kept. The log alone rebuilds a game from its seed; the snapshot makes a restart quick.
- **The database** (`src/db.js`): `games` (scenario, seed, rules version, the human's country, the
  day reached, paused), `commands` (the log: day, country, human or computer, the command as JSON)
  and `snapshots`. Commands and snapshots are written in the tick they happen; the day reached at
  least every 10 days, and whenever the game pauses or the server stops.
- **The engine is deterministic:** its random numbers come from a seeded generator kept in the
  game state, and nothing in it reads the time or iterates in an undefined order. Since only the
  server runs the rules, only Node has to agree with itself.
- **Restart:** each running game loads its last snapshot and re-applies the logged commands after
  it, without running the computer players, to the exact tick. The clock resumes when the first
  human reconnects; if none does within 2 minutes, a multiplayer game ends. A single-player game
  stays paused until its player returns.
- **Replays** of finished games need the rules only — not the AI, because its commands are in the
  log. Changing the AI never breaks an old replay. Changing the rules does: like LorCiv, every
  game records the rules version it was played under. What was built is in *Replays and results*, below.
- **A single-player game is not kept in memory for nothing** (milestone 7): when its player has been away for `IDLE_MS` (10
  minutes) its worker stops, the game saved where it stood, and the next time they open it it is brought back from its
  snapshot and log — as after a restart. So a restart brings back only the games with several people, which run on at once.
  Only someone with a seat in a game can make the server load it.

### Replays and results

A game that ends — won, or the end date — tells the server three things in its last message: who won, how every country
stands (`scores`: settlements, a subject counting for its overlord, then people), and a **fingerprint** of the final state
(FNV-1a over the snapshot's text, `src/engine/hash.js`). The server stores the fingerprint with the game and ranks the people
in it (`src/game/results.js`): by how their country stood, with anyone who quit placed after everyone who stayed, the later
quitter first. (An abandoned game has no result.)

- **The leaderboard** (`GET /api/leaderboard`, `public/leaderboard.html`) counts, per person and over finished games: the games,
  those with other people in them, how often they came first among those people, their average place there, and their
  *victories* — their country winning the whole game, a game alone included. It is ordered by firsts, then victories, then
  the average place. A deleted account is left off.
- **A replay** (`GET /api/games/:id/replay`, `public/replay.html`) is, for anyone signed in, a finished or abandoned game's seed,
  humans (a deleted player shows as "deleted"), every command with its day, its last day and its fingerprint — 2 MB of JSON for
  a game of 210 years, a tenth of that compressed. The browser makes the game from the seed with the engine it already has
  and plays the log back (`public/js/replayer.js`): each day its commands, then the day, exactly as the server did. It keeps a
  snapshot every two years to go back to a day quickly, goes forward in chunks so the page stays alive, and at the last day
  compares its own fingerprint with the server's: "This replay ends exactly as the game did", or a warning that it did not. The
  warning matters because the design leans on one engine agreeing with itself: a browser whose arithmetic differs from Node's
  would play the log out differently. The server answers 409 for a game still going, and for one played under another rules
  version, which cannot be replayed exactly.
- **The map** is drawn by the same code on the game page and the replay page (`public/js/mapdraw.js`, pure functions of a state
  and a day, tested in Node).

### Operations

How it is run is in [setup.md](setup.md); the program's parts for it are:

- **`/health`** (`src/health.js`): 200 `{ ok: true }`, or 503 and the reason in the log, when the database does not read, the
  disk holding it is under 10% free, or a game that should be ticking (not paused, not over) has not ticked for
  `HEALTH_STALL_MS` (15 s) — a stuck loop is the failure pm2 cannot see. No sign-in and no log line: it is polled.
- **Housekeeping** (`src/retention.js`, started by `server.js` only): hourly, tables nobody started are taken down after
  `TABLE_HOURS` (24), and the chat of games that ended is deleted `CHAT_RETENTION_DAYS` (30) after they did — the privacy page
  says so. Expired sessions are swept hourly too.
- **The owner's tools:** `tools/backup.js` (a consistent copy of the database with `VACUUM INTO`, taken while the server runs;
  `scripts/backup.sh` sends it to Backblaze B2 and prunes), and `tools/user.js` (set a password; delete an account — which
  empties and renames it `deleted-<id>`, deletes its chat and sessions, puts away its single-player games and tables, and
  refuses while a game with other people is going). The logic is `src/accounts.js`, tested.
- **Behind the proxy** the client's address is the one Caddy forwards (`TRUST_PROXY=1` in production), which the login throttle
  counts; port 3002 must therefore stay closed to the world, or anyone could forge it.
- **The terms and privacy pages** (`public/terms.html`, `public/privacy.html`) state what the code does, and a test holds the
  checkable parts true: no password or chat text in a log, an address only in the line for a throttled request, chat kept 30
  days. A change to what is stored, shown or kept changes the page in the same commit.

### Messages

- **Client to server:** `join`, `command`, `pause` (single-player only), `chat`, `quit` and `lobby:enter`, each
  answered (Socket.IO's acknowledgement stands in for a request id). The country of a command is always that of
  the user's seat, set by the server, never the client's. A socket belongs to a signed-in user: the handshake
  carries the session cookie and is refused without one.
- **Server to client:** the full view on joining (the first load, a reload and a reconnect all
  use it — no separate catch-up; it also carries the seats, the seconds left of the setup minute and the
  recent chat), then `tick` every day with its changes and events, `private`
  when the player's own private part changes, `paused`, `presence` (a player here, away, or gone), `chat`, and
  `over`; in the lobby `lobby:changed`, `table:started` and `table:cancelled`. Each list is in
  `src/game/socket.js`; what changed is worked out in the worker (`src/game/view.js`), entity by
  entity, so a day sends only what moved.
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

- **ES modules,** like all the code (`"type": "module"` in package.json): the browser loads the
  engine's files as they are, with no build step, and the server imports the same files.
- **One entry point,** `index.js`. A game is a `Game` (`game.js`): the map built from the
  scenario, the state, and the log of accepted commands with the day of each. `command(cmd)`
  applies one through the validator (`commands.js`) or refuses it with a reason; `advance()` moves
  one day (`day.js`) and returns its events; `snapshot()` is the state as JSON, `Game.restore` and
  `replay` rebuild a game from a snapshot or from its seed and log.
- **The state is plain JSON:** countries, settlements, armies (by id; the starting garrisons are
  numbered like their settlements), wars, battle cooldowns, the day and the random state
  (mulberry32, one 32-bit word). `RULES_VERSION` and `FORMAT` in `state.js` are stamped on every
  state and checked on restore.
- **The map** (`map.js`) is the scenario as a graph: settlements and passes are places, keyed
  `"37"` and `"P3"`; land routes are legs, two either side of a pass, one per pair of places. A
  leg takes its route's years × 365 days, rounded to a whole day.
- **Where an army is:** at a place (`at`), or on a leg (`march`: from, to, start day, end day),
  moving evenly — so its position on any day is arithmetic, and head-on meetings are found from
  the day two marches cross. Start and end may be fractions of a day.
- **Whole numbers:** men, cannons and crews are whole. A loss is a share of the army: the total
  is rounded to the nearest man and spread over its weapons by largest remainder; cannons are
  rounded separately and each takes 10 crew with it. Population, treasury and money keep their
  fractions inside the engine and are only rounded for people.
- **The modules:** `calendar`, `random`, `costs` (prices, techs, laws and durations as data), `army` (what
  an army is worth, losses, mercenaries), `map` (places, legs, straits, sea zones), `state`,
  `movement` (marching, turning back, retreats, straits), `battle` (one battle and the cooldown),
  `fighting` (arrivals, sieges, storms, sorties, relief, passes, head-on meetings), `supply`
  (monthly disease and hunger), `economy` (soldiers, caps, money, the monthly step), `forces`
  (training and hires), `naval` (fleets, patrols, blockades, straits), `passes` (sharpshooters),
  `events` (harvest, plague, uprisings and the rebels), `relations` (who is allied, guaranteed, subject or
  friend — pure questions over the state), `opinion` (military power, neighbours, opinion, and the formulas by which a
  computer answers), `diplomacy` (wars, joining, peace, subjects, the Empire, coalitions), `diplomacy-day`
  (expiries, unanswered questions, subjects breaking free, the yearly step), `victory`, `day`, `command-util`,
  `commands` (war and armies), `commands-country`, `commands-naval`, `commands-diplomacy`, `text` (events in
  English), `game`.
- **Diplomacy in the state:** `agreements` (kind, the two countries, since, until); each country's `warmonger`,
  `overlord` and `subjectKind`; `wars` (pairs, as before) with `warInfo` — each pair's attacking side, the people
  each had at the start and has taken since; `memory` (when each pair last fought, who broke an agreement, who
  refused whom, which proposal was made when, who has demanded the Empire); `offers`, the questions waiting for a
  human; `humans`, the countries people play — a proposal to one waits for its answer, to every other the computer
  answers at once; and `winner`. All but the offers are public: they are what the world can see.
- **The computer's side is rules, not AI:** `opinion.js` is pure, so a replay agrees with the game, and the browser
  runs the very same functions to tell a player what to expect (the war score and price of a peace, the bar an alliance
  must reach, the chance of a demand). A country's private settings that the browser does not have stand in as the
  starting ones. What a computer *chooses to propose* is the AI of milestone 5.
- **A country** in the state holds its `treasury`, `bank`, `loans`, `tax`, research `slider`, `law`,
  `techs`, the `target` tech and the R in store, its weapon `reserve`, and the queues of men being trained
  and mercenaries on their way. Its `taxSum` adds the tax in force each day, for the year's average. Of
  this the public part is only its name and capital; the rest is private (see *Messages*).
- **A settlement** also holds its buildings, the day it has been held from, and its **cores** — the
  countries it is core for, which a capture does not change. **A fleet** is in a port or at sea in a zone,
  with the ships of each kind, an optional order and, while sailing, `moving`. **Sharpshooter posts** are
  kept by pass: `posts[pass] = { owner, n }`. **Peasant rebels** are a country with `rebel: true` and
  `of`, the country they rose against; casualties among them are casualties of that country's people.
- **Money, people and R keep their fractions;** only men, cannons, ships and crews are whole. Every
  yearly amount is paid at the start of each month, a twelfth at a time, from the state that day. The
  browser runs the same `economyOf` on its copy of the state to show a player their own figures.
- **Events that need dice** (the yearly harvest, plague and uprising) draw three numbers from the game's
  random state per country, always, so that what one country rolls never changes what another does.
  The rebels' marches need none, so they are not logged.
- **A replay needs only the commands:** everything else — rebels, training arriving, fleets sailing,
  the monthly step — follows from the state and the day.

### The map on screen

`map.svg` is shown as it is. Its shapes carry ids — `land-ID` for each settlement's land,
`route-…`, `settlement-…`, `pass-…`, `sea-…` — so the client recolours lands as they change hands
and draws armies and fleets on a layer above. No canvas renderer.

**Settlements show no numbers** — the game never shows a settlement's id. Each marker is a red pill (rounded for a town,
square-cornered for a city) holding a short form of the name, 3 or 4 letters in mixed case ("Vie", "Kön", "FrO" for Frankfurt
(Oder)), generated by `tools/abbreviations.js` and unique within the scenario, the larger places choosing first; there is no
hand-written override. The full name is drawn beside the marker too, where it overlaps no other marker, name or country label
(`tools/map.js` reports any that cannot avoid one), hidden in the file: the game page shows names only when zoomed in to twice
the whole map or more (`mapview.js` adds the class `zoomed`). Ids remain what the SCENARIO.md tables and `tools/run.js`
scripts use.

### The game screen

Desktop first. Phones are not a priority, but the habits that keep them possible cost nothing and
are kept: pointer events (one path for mouse and touch), orders by click or tap rather than hover or
right-click, nothing shown only on hover. Small-screen layouts are not built. (`public/game.html`,
`public/js/game.js`, `public/js/mapview.js`.)

- **Layout:** a top bar (the player's country, the date, pause, the treasury; money and research
  join it in milestone 3), the map filling the rest, and a column on the right with the selection
  above the event feed.
- **On the map:** lands in their owner's colour, borders redrawn where owners differ, every army
  as a marker in its owner's colour with its men on it — a column of them beside a place with
  several; marching armies glide along the roads between ticks; a ring round each besieged
  settlement fills as the siege runs. Drag to pan, wheel or +/- to zoom.
- **Orders:** click an army to select it; with one of your own selected, click a settlement, a
  pass or a land, and the route is drawn with its days and arrival date, worked out by the engine in
  the browser; [March] (or Enter) sends it, [March and storm] where the destination is an enemy
  settlement, [Cancel] (or Escape) drops it. The selected army's panel has Stop, Storm, Sortie,
  Split and Merge where they apply.
- **Running the country:** tabs above the panel — **Map** (the selection), **Country** (money and its
  parts, tax, the research slider, the law with its caps, the bank and loans, regions to proclaim, a lost
  capital), **Shop** (buildings for the selected settlement, raising soldiers, hiring mercenaries,
  weapons, people, sharpshooters, ships, and what is queued) and **Research** (the tree, the tech
  being researched). Fleets are chips on the map — in a port below its marker, at sea below the zone's
  name, gliding between zones when sailing — and their panel has the orders. Sharpshooter posts show
  beside their pass. The panels show the engine's own numbers, worked out in the browser from the
  state it holds; every control sends a command. **A panel is rebuilt only when what it shows has
  changed, and never while a hand is typing or dragging in it.**
- **Diplomacy:** a fifth tab — questions waiting for the player (Accept, Refuse; Join a call to arms), wars with their
  war scores, the agreements held (with Break and Cancel), the player's subjects and overlord, and a country to deal
  with, picked from a list or by clicking its land. For it the tab shows its opinion of the player, who would join each
  side of a war and what a declaration breaks, each agreement with whether the computer is likely to accept and why,
  the chance of a demand, the Empire, and a **peace form**: tick the settlements to take or give, money, a subject —
  and the computer's own answer shown as you edit. A game that is won shows who won and stops.
- **Looking:** a settlement shows its owner, people, any siege and the armies there; a country's
  land shows the country, its wars and — until diplomacy in milestone 4 — a [Declare war] button.
- **Events:** the player's own and their wars', newest first (and every diplomatic event that concerns them); clicking one shows its place. A war
  declared on the player, or a siege or loss of one of their settlements, also shows as a notice
  over the map. Space pauses.
- **The development page** (`public/index.html`) starts a single-player game on any scenario as any
  country, or reopens one, until accounts and the lobby (milestone 6).

**Country colours** are picked by `tools/map.js` and written into `scenario.json`: each country gets
one, chosen so that countries sharing a border never look alike. A Colour column in SCENARIO.md's
Countries table overrides it for any country.

### Reuse from LorCiv

Copied when a milestone needs it, not up front:

- **From the start:** `config.js`, `log.js`, the `app.js`/`server.js` split, the test helpers.
- **With saving (milestone 2):** the database layer (`src/db/`, raw SQL, `addColumnIfMissing`
  migrations), moved to `node:sqlite`.
- **With the lobby (milestone 6, done):** accounts and sessions (`src/auth/`), the sign-in page, the lobby, chat — converted,
  and without the three packages LorCiv used there (argon2, express-session and its store): see *Accounts*. Not taken: the
  page shell and theme (this game has one page style), friends, achievements.
- **Later:** leaderboard, profiles, friends, achievements, replays page; `health.js`,
  `scripts/backup.sh` and the deployment in `docs/setup.md`.
- **Not reused:** the whole game — `src/shared/`, the turn logic in `src/game/rooms.js`, the
  canvas renderer, the game page.

LorCiv's conventions carry over too: no new dependencies without asking, raw SQL prepared
statements, a comment at the top of every module, never trusting the client. One exception: this
code is ES modules, not CommonJS, so whatever is copied from LorCiv is converted.

### Testing

- `node --test`, as in LorCiv (`npm test`).
- **Engine tests** on a tiny map worked out by hand (`test/helpers/tiny.js`), with the dice loaded
  where a number matters (`rig`), so every power and loss can be checked against RULES.md's
  formulas; the starting state on the real map.
- **Scripted wars** (`test/wars/*.txt`) played by the runner (`tools/run.js`) on the real map,
  checked for their outcome.
- **Replays:** the same script gives the same game to the last die, and a snapshot plus the
  commands after it gives exactly the unbroken game — also for a script that runs a country for three
  years and sees peasants rise.
- **Random play** (`test/engine/fuzz.test.js`): 45 countries giving random commands of every kind, in
  several seeded games, checking every month that nothing is NaN, negative or lost, and that a snapshot
  restores exactly. `FUZZ_SEEDS=40 FUZZ_YEARS=20 node --test test/engine/fuzz.test.js` is the big sweep
  (about 80 seconds); it found a ghost army in its first run.
- **The panels** (`test/client/panels.test.js`) run in Node against a fake element on a real game's
  view: they draw without error, show the engine's numbers, and their controls send the right commands.
  There is no browser in the development container, so the page itself is checked by playing.
- **Golden games:** a fixed seed and command log must end in a known state. A change that breaks
  one either is a bug or needs the rules version bumped. (From milestone 2, when games are saved.)
- **Timing:** `tools/bench.js` plays years of every country at war with armies sent about at
  random and prints the time per game day.
- **AI-only games**, headless and at full speed (no 100 ms wait), many at once, by `tools/simulate.js`:
  for crashes, balance and timing. `test/ai/ai.test.js` plays a few years of them every run, checking the fuzz's
  invariants every month, that the commands alone replay the game exactly (the computers' dice never touch the
  game's), that almost nothing is refused, and that a day costs a small part of its budget; `AI_SEEDS`,
  `AI_YEARS` and `AI_SCENARIO` make it bigger. It also tests each layer on the tiny map: the economy, the forces,
  a war that takes land, peace dictated and bought, asking a human, and the caretaker.
- **Integration tests** boot the server and connect socket clients, as in LorCiv.

### Development environment

Node 24 is installed; nothing is added to `.devcontainer/devcontainer.json`. The map tools are Node too:
`tools/map.js` builds `scenario.json` and `map.svg` from a scenario folder, and
`scenarios/historical-1440/make-base.js` drew that scenario's first map from real geography. The repo has no Perl.

---

## 2. Open questions

Settled answers move into §1, or into RULES.md where they are rules. Each is needed by the milestone
named (see [plan.md](plan.md)).

1. **The historical scenario's Empire** (not scheduled). Its SCENARIO.md describes an Emperor, Imperial Authority,
   electors and elections, the imperial ban, dues and five reforms. Milestone 4 builds the plain proposal both
   scenarios share (RULES.md §10) and the scenario's starting wars and agreements, not this. It is a subsystem of its own
   — worth its own milestone if that scenario is to be played in earnest.
2. **Computer fleets** (not scheduled). The computer countries keep their starting ships and never build, sail or
   fight with them; a strait it cannot cross without ships stays shut to it. Naval war would be the next thing to teach it.

---

## 3. Commands

Every order and purchase in RULES.md, as commands. Each is checked on the server when applied; the
handlers are in `src/engine/commands*.js`, and each file lists its commands' arguments at its top.

| Group | Command | Rules |
|---|---|---|
| Army | `move` (to a settlement or pass, by a route or a strait; `storm`: on arrival storm) · `stop` | §6, §8 |
| | `besiege` · `storm` a settlement · `sortie` (garrison only) | §6 |
| | `stormPost`: storm the sharpshooter post at a pass | §5 |
| | `split` · `merge` | §8 |
| | `equip` (change men's weapons from the reserve) · `equipCannons` (one per 10 crew) | §3, §8 |
| | `disband` (men or crew home, weapons and cannons to the reserve) · `dismissMercenaries` | §8 |
| Fleet | `sail` (into a port of yours, to sea, or to a neighbouring zone) | §8 |
| | `blockade` · `patrol` · `hold` | §7 |
| | `splitFleet` · `mergeFleet` | §8 |
| Country | `raise` soldiers or cannon crew at a core settlement · `hireMercenaries` | §3, §8 |
| | `buyWeapons` (and cannons) to the reserve · `buyPeople` | §3 |
| | `buySharpshooters` at a pass you own · `buyShips` at a port | §3, §8 |
| | `buyBuilding` (walls, library, workshop, market, courthouse) | §3 |
| | `setTax` · `setSlider` (research) · `setLaw` | §2, §4, §9 |
| | `deposit` · `withdraw` · `borrow` · `repay` · `defaultOnLoans` | §2 |
| | `research` (choose the tech) · `setCapital` · `proclaim` (special coring) | §4, §2, SCENARIO |
| Diplomacy | `declareWar` · `proposePeace` (with terms: take, give, money, a subject) | §10 |
| | `proposeAgreement` (defensive, military, guarantee, pact, access) · `breakAgreement` · `cancelAccess` | §10 |
| | `demandSubject` (vassal or protectorate) · `proposeEmpire` (once ever) | §10, SCENARIO |
| | `answerOffer` — a human's answer to a call to arms, a proposal, a demand or the Empire | §10 |
| Game | pause · resume (single player; not engine commands) | §1 |
