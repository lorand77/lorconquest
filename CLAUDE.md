# LorConquest

Real-time grand strategy on a map of Mitteleuropa, 1440–1650: up to 4 people and the computer
running 45 countries, one game day every 0.1 s. Node 24; Express and Socket.IO are the only
dependencies.

- [docs/RULES.md](docs/RULES.md) — the rules. The engine implements them; where they are silent,
  decide, and write the reading into RULES.md in the same commit.
- [scenarios/mitteleuropa/SCENARIO.md](scenarios/mitteleuropa/SCENARIO.md) and its `scenario.json` — the default scenario, the map.
  scenario.json and map.svg are generated: edit SCENARIO.md or map-base.svg and run `node tools/map.js`.
- [docs/design.md](docs/design.md) — how the software works and why. Read it before changing
  `src/engine/`; when a decision changes, change it there in the same commit.
- [docs/plan.md](docs/plan.md) — the milestones and where we are.
- [docs/setup.md](docs/setup.md) — running it, putting it online (EC2, pm2, Caddy), backups, accounts by hand, monitoring.
- `scenarios/` — every scenario, a folder each, its id the folder's name (`node tools/map.js scenarios/<name>`, which may leave out the
  folder of the default, `mitteleuropa`); `lorciv-temporary-import/`
  is an earlier game kept for reference, not part of this one.

## Commands

- `npm test` — the whole suite. Run it before calling anything done. `TEST_LOG=1` shows the server's
  logs, which the tests silence.
- `npm run dev` — the server at http://localhost:3002/ (sign in or register, then the lobby), restarting
  on changes; `npm start` without. Settings are environment variables, all in `src/config.js`; the
  database is `data/lorconquest.sqlite`.
- `node tools/simulate.js [--games N --years N --seed N --scenario mitteleuropa --jobs N]` — AI-only games, headless, in parallel: wins by
  country, wars, peaces, refused commands, timing. `SIM_DEBUG=1` prints every refused command. What it showed: `experiments/`.
- `AI_SEEDS=6 AI_YEARS=60 AI_SCENARIO=historical-1440 node --test test/ai/ai.test.js` — the AI games of the suite, bigger.
- `node tools/user.js password|delete <name>` — set a password, or delete an account for good; `node tools/backup.js [folder]` — a
  consistent copy of the database while the server runs (`scripts/backup.sh` is the nightly job). See docs/setup.md.
- `node tools/run.js <script>` — play a scripted game in the terminal; the format is at the top of
  `tools/run.js`, examples in `test/wars/`.
- `node tools/bench.js [--years N]` — time a game day with every country at war.
- `FUZZ_SEEDS=40 FUZZ_YEARS=20 node --test test/engine/fuzz.test.js` — the big random-play sweep.
- `node tools/map.js [folder] [mountains]` — rebuild a scenario's map.svg, scenario.json and the
  generated parts of its SCENARIO.md.

## Layout

- `src/engine/` — the rules, which run unchanged in Node and the browser. `index.js` is what
  everything else imports; `commands.js` is the one way player actions get in; `day.js` is the one
  way time moves on. The module list is in design.md, *The engine*.
- `src/app.js` builds the server (Express, Socket.IO, the database, every game) without listening;
  `src/server.js` listens. `src/db.js` is the database (node:sqlite): schema and every query.
- `src/preload.js` (the pages served with a modulepreload tag for every module their script needs), `src/health.js` (`/health`), `src/retention.js` (tables and chat tidied hourly; started by `server.js` only), `src/accounts.js` (what
  `tools/user.js` does), `src/game/results.js` (how a finished game ranks its people).
- `src/auth/` — accounts: `routes.js` (register, login, logout, me), `session.js` (the cookie and the sessions table, shared by REST
  and the socket handshake), `password.js` (scrypt), `origin.js` (the same-origin check), `throttle.js`, `usernamePolicy.js`.
- `src/friends/routes.js` (friends, as in LorCiv); `src/achievements/` — achievements: `catalogue.js` (the regular ones; a
  scenario's own are in its SCENARIO.md), `analyze.js` (a finished game played over, what each person did), `worker.js` (where
  that runs), `service.js` (the queue, awarding, `AWARDS_VERSION`), `routes.js`. The page side is `public/js/achievements.js`.
- `src/engine/` also holds diplomacy: `relations.js` (who is allied, subject or friend), `opinion.js` (the computer's
  formulas, pure), `diplomacy.js` (wars, peace, subjects, the Empire), `diplomacy-day.js`, `victory.js`, `elimination.js` (a country with no
  settlement left is out of the game: its forces vanish, its wars and agreements end).
- `src/game/` — live games: `rooms.js` (tables and seats, a worker per game, saving, passing changes to sockets, who is
  away or back, the setup minute, abandoned games),
  `worker.js` (one game's loop), `socket.js` and `routes.js` (the events and the REST routes),
  `view.js` (what a player may see, what changed).
- `src/ai/` — the computer players: `index.js` (`createAI`: who thinks when, reflexes, the caretaker switch), `economy.js`,
  `forces.js`, `war.js`, `navy.js` (cogs for the straits its armies need, patrols where it is the stronger), `diplomacy.js`, `caretaker.js`, `characters.js` (the six characters a scenario assigns in its SCENARIO.md,
  with rivalries; `tools/map.js` checks the spread), `util.js` (their own dice, a country's character for the game, distances).
- `public/` — the pages: `game.html` with `js/game.js` (the screen), `js/mapview.js` (the SVG map),
  `js/mirror.js` (the state copy and map geometry, tested in Node), `js/panels.js` (the Country, Shop and
  Research tabs, fleets, an army's equipment), `js/diplomacy.js` (the Diplomacy tab); `index.html` is the lobby (`js/lobby.js`, with `js/lobbylogic.js` for what is tested in Node),
  `profile.html` (`js/profile.js`: Stats and My Games) and `customize.html` (`js/customize.js`: the colours), which with the leaderboard
  have LorCiv's shell (`js/shell.js`: a top bar and a rail of sections on the left), and
  `login.html` the sign-in page (`js/login.js`, `js/auth.js`); `replay.html` plays a finished game over (`js/replay.js`, with
  `js/replayer.js` — the pure part, tested against real games — and `js/mapdraw.js`, which the game page shares); `leaderboard.html`;
  `terms.html` and `privacy.html`, which must stay true of what the code does. `js/theme.js` (a plain script, not a module, in every
  page's head) applies the dark or light colours and keeps the choice in local storage, the one thing stored in the browser
  besides the sign-in cookie.
  The browser imports the engine from `/engine/`, the very files in `src/engine/`.
- `tools/` — the runner, the bench, the map tools (`map.js`, and `abbreviations.js`: the short names in the map's markers).
- `test/ai/` — each AI layer on the tiny map, the caretaker, and computer-only games on the real map (invariants every month,
  exact replay from the commands alone, the tick's budget); `test/helpers/invariants.js` is the check it shares with the fuzz.
- `test/engine/` — engine tests on the tiny map in `test/helpers/tiny.js` (a sea, two ports, a strait,
  a region), and `fuzz.test.js`, random play (`FUZZ_SEEDS`/`FUZZ_YEARS` make it bigger); `test/wars/` —
  scripted wars and a country run for years on the real map; `test/server/` — the real server on a throwaway database with 2 ms days
  (`helpers.js` signs in a default user, "tester", or any name a test gives; the multiplayer tests shorten the setup minute and
  the two minutes to milliseconds); `test/client/` — the browser's pure modules and, against a fake element, its panels
  (`loader.mjs` lets them import `/engine/` as the page does).

## Conventions

- Dependencies: Express and Socket.IO only (SQLite is Node's built-in `node:sqlite`). Node
  built-ins first; if another package seems necessary, ask.
- The engine: no Node-only or browser-only APIs, no clock (`Date`, timers), no `Math.random` —
  randomness comes from `state.rng`. The state stays plain JSON. A test scans for this.
- ES modules everywhere (`"type": "module"`): `import`/`export`, file endings in import paths,
  Node built-ins as `node:fs`, `import.meta.dirname` for the file's folder, JSON imported
  `with { type: "json" }`. Code copied from LorCiv, which is CommonJS, is converted.
- Double quotes, semicolons, 4-space indent.
- Every module opens with a comment saying what it does and why. Keep that up.
- Never trust the client: legality is decided by the engine's validator on the server.
- Commit subjects are short and imperative.
- `public/privacy.html` states what is stored, who sees it and how long it is kept, and what the logs hold. Change what the code
  does and the page in the same commit; `test/server/finishing.test.js` holds the checkable parts true.

## Gotchas

- Anything that makes the same commands on the same seed play out differently must bump
  `RULES_VERSION` in `src/engine/state.js`, or saved games and replays break. A change to the
  shape of the state bumps `FORMAT`.
- A new achievement (regular, or in a SCENARIO.md) that finished games could have earned bumps `AWARDS_VERSION` in
  `src/achievements/service.js`: the next boot awards every finished game again, which only ever adds. Achievements are
  only found in games played under the current `RULES_VERSION`; older ones get what their result and record say.
- A game's humans are its seats (`game_seats`), fixed when the host starts the table; `humans` are part of its state (`Game.create(scenario, { seed, humans })`), because a proposal to a human waits
  for its answer and to anyone else is answered at once: a replay must be given the same humans.
- Who is away or back is not saved (`rooms.js`): a resumed game with several people starts with every player away, from that
  moment. The two minutes and the setup minute are settings (`AWAY_MS`, `SETUP_MS`), which the tests shorten to milliseconds.
- A replay is only exact under the rules version the game was played under: `RULES_VERSION` is stored with each game, and the replay
  route refuses the others. The replay page compares a fingerprint of the final state (`src/engine/hash.js`) with the server's.
- No dependency may be added for accounts: passwords use `node:crypto` scrypt and sessions are our own (`src/auth/`).
- Diplomacy that can leave a country "friendly" with one it is at war with (an alliance it kept after joining the
  other side) breaks sieges, retreats and supply: `joinWar` ends such an alliance. The fuzz checks the invariants.
- Iteration order is part of the rules: the state's objects are keyed by whole-number ids, which
  JavaScript keeps in order; anything else that is iterated is sorted first.
- Tests that need a battle's numbers load the dice with `rig()` from `test/helpers/tiny.js`.
- Anything that can empty an army (losses, desertion, disbanding) must remove it, or a ghost army with
  no men stays on the map; the fuzz test checks this every month.
- Money, R and people keep fractions in the engine; show them rounded (`formatNumber`), never store them
  rounded.
- Computer players (`src/ai/`) never draw from `state.rng`: their commands are
  replayed without running them, so their dice must not touch the game's. Their schedule depends on
  the day alone (design.md, *The computer players*).
- No browser in the development container: the screen's pure logic goes in `public/js/mirror.js` and
  is tested; the rest is checked by playing.
- A leg's days come from scenario.json's years, which are rounded to 0.01: up to two days off the
  exact length. Fine for play; don't expect exact days from the map's lengths.
