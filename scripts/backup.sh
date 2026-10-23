#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="${SPLITBUDDIES_CONTAINER:-splitbuddies}"
BACKUP_DIR="${SPLITBUDDIES_BACKUP_DIR:-$HOME/splitbuddies-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/splitbuddies-$TIMESTAMP.sqlite"
CONTAINER_TMP="/tmp/splitbuddies-backup-$TIMESTAMP-$$.sqlite"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

command -v podman >/dev/null 2>&1 ||
    die "Podman is not installed."

podman container exists "$CONTAINER" ||
    die "Container '$CONTAINER' does not exist."

[[ "$(podman inspect --format '{{.State.Running}}' "$CONTAINER")" == "true" ]] ||
    die "Container '$CONTAINER' is not running."

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

[[ ! -e "$BACKUP_FILE" ]] ||
    die "Backup already exists: $BACKUP_FILE"

cleanup() {
    podman exec "$CONTAINER" rm -f "$CONTAINER_TMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating a consistent SQLite backup from '$CONTAINER'..."

podman exec "$CONTAINER" node --input-type=module -e '
import Database from "better-sqlite3";

const destination = process.argv[1];
const sourcePath = process.env.DATABASE_PATH || "/data/splitbuddies.sqlite";

let source;
let backup;

try {
    source = new Database(sourcePath, {
        readonly: true,
        fileMustExist: true
    });

    await source.backup(destination);
    source.close();
    source = null;

    backup = new Database(destination, {
        readonly: true,
        fileMustExist: true
    });

    const result = backup.pragma("integrity_check");
    if (result.length !== 1 || result[0].integrity_check !== "ok") {
        throw new Error("SQLite integrity check failed: " +
            JSON.stringify(result));
    }

    const tables = backup.prepare(
        "SELECT name FROM sqlite_master " +
        "WHERE type = ? AND name NOT LIKE ? ORDER BY name"
    ).all("table", "sqlite_%");

    if (tables.length === 0) {
        throw new Error("Backup contains no application tables.");
    }

    console.log("SQLite integrity check: ok");
    console.log(`Application tables: ${tables.length}`);
} finally {
    if (backup) backup.close();
    if (source) source.close();
}
' "$CONTAINER_TMP" || die "SQLite backup or integrity check failed."

echo "Copying verified backup to the host..."
podman cp "$CONTAINER:$CONTAINER_TMP" "$BACKUP_FILE" ||
    die "Could not copy backup to the host."

[[ -s "$BACKUP_FILE" ]] || die "Backup file is empty."
chmod 600 "$BACKUP_FILE"

echo
echo "Backup completed successfully."
echo "File: $BACKUP_FILE"
du -h "$BACKUP_FILE"
