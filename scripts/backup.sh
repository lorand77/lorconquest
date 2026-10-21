#!/bin/bash
# The nightly backup (docs/setup.md, "backing up"): a consistent copy of the database, sent to Backblaze B2, old ones pruned.
# Cron, as the lorconquest user:
#   0 3 * * * /home/lorconquest/lorconquest/scripts/backup.sh >> /home/lorconquest/backups/backup.log 2>&1
set -e
export PATH=/usr/local/bin:/usr/bin:/bin
cd "$(dirname "$0")/.."

# the copy is made by Node's own sqlite (tools/backup.js), so the sqlite3 program is not needed; it keeps 7 days here
FILE=$(node --env-file-if-exists=.env tools/backup.js "$HOME/backups" --keep-days 7)
rclone copy "$FILE" b2:lorconquest-backups/

# and 30 days there (the privacy page promises at most 90)
rclone delete b2:lorconquest-backups/ --min-age 30d --b2-hard-delete

echo "$(date) backup OK: $FILE"
