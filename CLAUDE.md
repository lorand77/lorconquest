# LorConquest

Real-time grand strategy on a map of Mitteleuropa, 1440–1650: up to 4 people and the computer
running 45 countries, one game day every 0.1 s. Node 24, no dependencies.

- [docs/RULES.md](docs/RULES.md) — the rules. The engine implements them; where they are silent,
  decide, and write the reading into RULES.md in the same commit.
- [docs/SCENARIO.md](docs/SCENARIO.md) and `docs/scenario.json` — the map. scenario.json and
  map.svg are generated: edit SCENARIO.md or map-base.svg and run `node tools/map.js`.
- [docs/design.md](docs/design.md) — how the software works and why. Read it before changing
  `src/engine/`; when a decision changes, change it there in the same commit.
- [docs/plan.md](docs/plan.md) — the milestones and where we are.
- `scenarios/` — other scenarios (`node tools/map.js scenarios/<name>`); `lorciv-temporary-import/`
  is an earlier game kept for reference, not part of this one.

## Commands

- `npm test` — the whole suite. Run it before calling anything done.
- `node tools/run.js <script>` — play a scripted game in the terminal; the format is at the top of
  `tools/run.js`, examples in `test/wars/`.
- `node tools/bench.js [--years N]` — time a game day with every country at war.
- `node tools/map.js [folder] [mountains]` — rebuild a scenario's map.svg, scenario.json and the
  generated parts of its SCENARIO.md.

## Layout

- `src/engine/` — the rules, as ES modules (`.mjs`) that run unchanged in Node and the browser.
  `index.mjs` is what everything else imports; `commands.mjs` is the one way player actions get
  in; `day.mjs` is the one way time moves on. The module list is in design.md, *The engine*.
- `tools/` — the runner, the bench, the map tools. CommonJS.
- `test/engine/` — engine tests on the tiny map in `test/helpers/tiny.js`; `test/wars/` — scripted
  wars on the real map.

## Conventions

- No dependencies. Node built-ins first; if a package seems necessary, ask.
- The engine: no Node-only or browser-only APIs, no clock (`Date`, timers), no `Math.random` —
  randomness comes from `state.rng`. The state stays plain JSON. A test scans for this.
- Everything else is CommonJS `.js`. Everywhere: `"use strict"` (implied in `.mjs`), double
  quotes, semicolons, 4-space indent.
- Every module opens with a comment saying what it does and why. Keep that up.
- Never trust the client: legality is decided by the engine's validator on the server.
- Commit subjects are short and imperative.

## Gotchas

- Anything that makes the same commands on the same seed play out differently must bump
  `RULES_VERSION` in `src/engine/state.mjs`, or saved games and replays break. A change to the
  shape of the state bumps `FORMAT`.
- Iteration order is part of the rules: the state's objects are keyed by whole-number ids, which
  JavaScript keeps in order; anything else that is iterated is sorted first.
- Tests that need a battle's numbers load the dice with `rig()` from `test/helpers/tiny.js`.
- A leg's days come from scenario.json's years, which are rounded to 0.01: up to two days off the
  exact length. Fine for play; don't expect exact days from the map's lengths.
