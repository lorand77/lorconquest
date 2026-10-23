# LorConquest — setup and operations

How to run it on a development machine, and how it is put online and kept running. What the program itself does for
operations (the health check, housekeeping, the owner's tools) is in [design.md](design.md), *Operations*.

The dependencies are Express and Socket.IO, and nothing is compiled: no native module, no build step. So there is no rebuild
step after `npm ci`, as LorCiv has.

---

# Development

```
# Node 24 (the project's engines field says >=24); nothing else is needed
node --version

npm ci
npm test            # the whole suite (about a minute); TEST_LOG=1 shows the server's logs
npm run dev         # http://localhost:3002/ — restarts on changes; sign in or register, then the lobby
```

- The database is `data/lorconquest.sqlite`, made on first run (gitignored). Delete it to start afresh.
- Settings are environment variables, all declared in `src/config.js`. `npm start` and `npm run dev` read a `.env` file in the
  project folder if there is one (`node --env-file-if-exists=.env`); it is gitignored.
- There is no browser in the development container, so the pages are checked only for what a test can check
  (`test/client/pages.test.js`): the first game played by hand is the real check.
- Other tools: `node tools/simulate.js` (AI-only games), `node tools/run.js` (scripted wars), `node tools/bench.js`.

---

# Production — an Ubuntu server (AWS EC2)

LorConquest runs on the same EC2 instance as LorChess and LorCiv, as a separate process under its own system user, on its own
port, with its own database, `.env`, pm2 daemon and backups. They share nothing but the machine and Caddy.

Machine-wide pieces (Node 24, the global pm2 package, Caddy, rclone) were installed once by the LorChess setup and are not
repeated here; what follows is what LorConquest adds, plus the per-user steps, which every app user does for themselves.
`sqlite3` is **not** needed: backups are made by Node's own SQLite (`tools/backup.js`).

**Not decided by the code, to set when it goes online:** the domain (this page says `lorconquest.lorand77.dev`) and the contact
address on the terms and privacy pages (`lorconquest@lorand77.dev`) — both are written into those pages, so change them there
too if they differ.

## the user and the code

```
ssh ubuntu@IP_ADDRESS
sudo adduser --disabled-password --gecos "" lorconquest
sudo -u lorconquest -i
git clone https://github.com/lorand77/lorconquest.git
cd lorconquest
npm ci --omit=dev
```

`lorconquest` owns the code, the database and its pm2 daemon, and has no sudo. Commands starting with `sudo` run as `ubuntu`;
everything else runs as `lorconquest`.

## configure

Create `.env` in the project folder (gitignored; `npm start` loads it):

```
cat > .env <<EOF
NODE_ENV=production
EOF
chmod 600 .env
```

- `NODE_ENV=production` — names the session cookie `__Host-lc_session`, always `Secure` (a page on another `*.lorand77.dev`
  host cannot plant a cookie of that name), and turns `TRUST_PROXY` on (below). The app must then be reached over HTTPS,
  through Caddy: a request straight to port 3002 over plain HTTP gets no session cookie and cannot sign in.

There are no secrets to configure: a session is a random token the database knows only by its hash. Everything else has a
default, read in `src/config.js`; put it in `.env` only to change it:

| Setting | Default | |
|---|---|---|
| `PORT` | 3002 | the HTTP port (LorChess has 3000, LorCiv 3001); Caddy proxies to it |
| `DB_PATH` | `data/lorconquest.sqlite` | the SQLite file |
| `TRUST_PROXY` | 1 in production, else 0 | proxy hops to trust for the client's address; port 3002 **must stay closed** to the world, or the address can be forged |
| `TICK_MS` | 100 | real time per game day (RULES.md §1); do not change it on a live server |
| `SETUP_MS` | 60000 | the clock stands still this long when a game with two or more people starts |
| `AWAY_MS` | 120000 | a player away this long has the full computer player; if every player is, the game ends |
| `IDLE_MS` | 600000 | a single-player game whose player has gone is let go from memory after this long |
| `MAX_HUMANS` | 4 | people in one game |
| `TABLE_HOURS` | 24 | a table nobody started is taken down after this |
| `CHAT_RETENTION_DAYS` | 30 | chat is deleted this long after its game ends (`-1` keeps it); the privacy page says 30 |
| `HEALTH_STALL_MS` | 15000 | `/health` fails when a game that should tick has not for this long |
| `SESSION_DAYS` | 7 | how long a sign-in lasts |
| `LOGIN_MAX_FAILURES`, `REGISTER_MAX`, `AUTH_WINDOW_MS` | 10, 5, 900000 | failed sign-ins and new accounts allowed per client address in the window; past that, 429 |
| `HASH_MAX_CONCURRENT` | 2 | password hashes at once (one per vCPU); more get 503 "busy" |
| `STATS_EVERY_DAYS` | 365 | how often each game logs how long its days take |
| `LOG_LEVEL` | info | `silent`, `error`, `warn`, `info`, `debug` |

## run it under pm2

```
sudo -u lorconquest -i
cd ~/lorconquest
pm2 start npm --name lorconquest -- start

# survive a reboot
pm2 save
pm2 startup          # prints a `sudo env PATH=... pm2 startup ... -u lorconquest --hp /home/lorconquest` line: run that as ubuntu

pm2 list             # status
pm2 logs lorconquest # live logs
pm2 restart lorconquest
```

The boot service from `pm2 startup` is per user (`pm2-lorconquest`), next to the other apps'.

### log rotation

pm2 never trims its logs, so without rotation they fill the disk (and SQLite can no longer write). Install the module as
`lorconquest` too, with the settings the **privacy page promises** (logs are deleted after 14 days):

```
pm2 install pm2-logrotate
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

`retain` counts files, not days: a size-triggered rotation adds a file, so the 14 kept cover at most 14 days. Keep these in step
with the privacy page.

## https with the domain (Caddy)

Caddy is installed and serving the other apps; ports 80 and 443 are open in the EC2 firewall, and **port 3002 is not, and must
stay closed**. Add DNS (name.com): an A record, host `lorconquest`, to the server's IP. Then add a block to `/etc/caddy/Caddyfile`:

```
lorconquest.lorand77.dev {
    header Strict-Transport-Security "max-age=31536000"
    encode zstd gzip
    reverse_proxy localhost:3002
}
```

`encode` compresses what is sent: the app does not, and uncompressed a game page is about 800 KB with the historical
scenario (its map, its data and the engine), a fifth of that compressed.

and `sudo systemctl reload caddy`. Caddy passes WebSockets through with no further setting, and sends `X-Forwarded-For` and
`X-Forwarded-Proto`, which `TRUST_PROXY=1` makes the app use.

## deploying new code

```
cd ~/lorconquest && git pull && npm ci --omit=dev && pm2 restart lorconquest
```

(as one line; a failed pull or install stops it before the restart). Never `npm install` on the server: change dependencies in
development, test, commit the lockfile, deploy.

**What a restart does to games.** Every game is saved: its commands as they happen, its day at least every 10 days and when the
server stops. A restart brings back at once the games with several people, which run on without waiting; their players' pages
reconnect by themselves and take their countries back — but the players have `AWAY_MS` (two minutes) to do it, after which the
computer plays them and, if nobody is back, the game is abandoned. So restart quickly, and not mid-game if you can help it
(`pm2 logs` shows `game.*` lines; the lobby shows what is going). A single-player game waits, paused, until its player opens it.
A change to the rules (`RULES_VERSION`) makes the games in progress unplayable (`game.resume_failed` in the log) and their replays
unavailable: do not deploy one while people are playing.

## monitoring

`/health` answers 200 when the app is up, the database reads, more than 10% of the disk is free and every game that should be
ticking is; otherwise 503, with the reason in `pm2 logs` (`health.failed`: `disk_low`, `game_stalled` or `error`).

- An uptime monitor (Better Stack) on `https://lorconquest.lorand77.dev/health`, every 3 minutes.
- A heartbeat, daily with 2 hours' grace, pinged by the backup job (keep its URL out of the repo; see below).

`game.timing` lines in the log give each game's mean and slowest day against the 100 ms it has: a game that is regularly near
it is too heavy for the machine.

## backing up the database

`tools/backup.js` writes one consistent copy of the database while the server runs (`VACUUM INTO`, the write-ahead log
included) as `~/backups/lorconquest-backup-DATE.sqlite`, and keeps 7 days of them there. As `lorconquest`:

```
cd ~/lorconquest && node tools/backup.js ~/backups
```

and to B2: rclone is installed, but its configuration is per user. As `lorconquest`:

```
rclone config            # a remote named b2, bucket lorconquest-backups
```

then `crontab -e`, and add the nightly job (`scripts/backup.sh` makes the copy, sends it to B2, and deletes B2 copies older than
30 days — the privacy page promises no more than that):

```
0 3 * * * /home/lorconquest/lorconquest/scripts/backup.sh >> /home/lorconquest/backups/backup.log 2>&1 && curl -fsS -m 10 --retry 3 -o /dev/null <heartbeat URL>
```

### restoring

```
rclone copy b2:lorconquest-backups/lorconquest-backup-DATE.sqlite ~/backups/     # unless it is there already
pm2 stop lorconquest
cp ~/backups/lorconquest-backup-DATE.sqlite ~/lorconquest/data/lorconquest.sqlite
rm -f ~/lorconquest/data/lorconquest.sqlite-wal ~/lorconquest/data/lorconquest.sqlite-shm
pm2 start lorconquest
```

## accounts, by hand

There is no self-service password reset or deletion, and the site has no email address for anyone. Both are done on the
server, in the project folder, as `lorconquest`; both are safe while the app runs.

```
node tools/user.js password <name>     # asks twice, with echo off; or, with no terminal, reads one line of stdin
node tools/user.js delete <name>       # shows what it will do, asks for the name back; no undo
```

A password change leaves the person's sessions signed in. A deletion (the privacy page promises one on request) empties and
renames the account `deleted-<id>`, deletes its chat and sessions, puts away its single-player games and any table it started,
and frees the name; games with other people stay in their records, and in replays, without the name. It **refuses** while the
person is in a game with other people that is still going. Before deleting, make sure the request comes from the account's
owner: there is no email to check, so ask them to prove it from inside the account, for example by sending a chat message you
name in one of their games. Copies in B2 backups expire with the backups (30 days).

## updating Node

A Node update is machine-wide: `sudo apt update && sudo apt install --only-upgrade nodejs`, then `pm2 update` as each app's user
(each daemon keeps the old Node until told). Run `npm test` on the new Node in development first: the engine's determinism is
only promised for one engine agreeing with itself, and a finished game's replay is checked against the fingerprint made when it ended.
