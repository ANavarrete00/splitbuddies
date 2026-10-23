#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="${SPLITBUDDIES_CONTAINER:-splitbuddies}"
BACKUP_DIR="${SPLITBUDDIES_BACKUP_DIR:-$HOME/splitbuddies-backups}"
IMAGE="${SPLITBUDDIES_IMAGE:-localhost/splitbuddies:local}"
APP_UID="${SPLITBUDDIES_APP_UID:-1000}"
APP_GID="${SPLITBUDDIES_APP_GID:-1000}"
DATABASE="/data/splitbuddies.sqlite"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
CANDIDATE="/data/.splitbuddies-restore-$TIMESTAMP-$$.sqlite"
NEW_DATABASE="/data/.splitbuddies-new-$TIMESTAMP-$$.sqlite"
OLD_DATABASE="/data/.splitbuddies-pre-restore-$TIMESTAMP-$$.sqlite"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

die() {
    echo "ERROR: $*" >&2
    exit 1
}

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 /path/to/backup.sqlite" >&2
    exit 2
fi

command -v podman >/dev/null 2>&1 || die "Podman is not installed."

BACKUP_FILE="$(realpath -- "$1")"
[[ -f "$BACKUP_FILE" && -r "$BACKUP_FILE" ]] ||
    die "Backup file does not exist or is not readable: $BACKUP_FILE"

podman container exists "$CONTAINER" ||
    die "Container '$CONTAINER' does not exist."

[[ "$(podman inspect --format '{{.State.Running}}' "$CONTAINER")" == "true" ]] ||
    die "Container '$CONTAINER' must be running before restore."

echo "Backup selected: $BACKUP_FILE"
echo "Target container: $CONTAINER"
echo
echo "WARNING: Restoring replaces the app's current database."
echo "A safety backup will be created first."
echo

read -r -p "Type RESTORE to continue: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || die "Restore cancelled."

cleanup_candidate() {
    podman exec "$CONTAINER" rm -f \
        "$CANDIDATE" "$CANDIDATE-wal" "$CANDIDATE-shm" \
        "$NEW_DATABASE" "$NEW_DATABASE-wal" "$NEW_DATABASE-shm" \
        >/dev/null 2>&1 || true
}
trap cleanup_candidate EXIT

echo "Copying the selected backup into the container for validation..."
podman cp "$BACKUP_FILE" "$CONTAINER:$CANDIDATE" ||
    die "Could not copy the selected backup into the container."

echo "Validating the selected backup..."
podman exec "$CONTAINER" node --input-type=module -e '
import Database from "better-sqlite3";
const path = process.argv[1];
const db = new Database(path, { readonly: true, fileMustExist: true });
try {
    const result = db.pragma("integrity_check");
    if (result.length !== 1 || result[0].integrity_check !== "ok") {
        throw new Error("SQLite integrity check failed: " + JSON.stringify(result));
    }
    const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ?"
    ).all("table", "sqlite_%");
    if (tables.length === 0) throw new Error("No application tables found.");
    console.log("SQLite integrity check: ok");
    console.log(`Application tables: ${tables.length}`);
} finally {
    db.close();
}
' "$CANDIDATE" || die "Selected backup failed validation."

echo
echo "Creating a safety backup of the current database..."
"$SCRIPT_DIR/backup.sh"

echo
echo "Stopping the application container..."
podman stop "$CONTAINER" >/dev/null ||
    die "Could not stop the application container."

echo "Installing the validated database..."
if ! podman run --rm \
    --volumes-from "$CONTAINER" \
    --user 0:0 \
    --entrypoint node \
    "$IMAGE" \
    --input-type=module -e '
import fs from "node:fs";
import Database from "better-sqlite3";

const candidate = process.argv[1];
const database = process.argv[2];
const newDatabase = process.argv[3];
const oldDatabase = process.argv[4];

let db;
try {
    db = new Database(candidate, { readonly: true, fileMustExist: true });
    const result = db.pragma("integrity_check");
    if (result.length !== 1 || result[0].integrity_check !== "ok") {
        throw new Error("Candidate failed integrity check.");
    }
    db.close();
    db = null;

    const appUid = Number(process.argv[5]);
    const appGid = Number(process.argv[6]);
    if (!Number.isInteger(appUid) || !Number.isInteger(appGid)) {
        throw new Error("Invalid application UID/GID.");
    }

    let oldMoved = false;
    try {
        fs.copyFileSync(candidate, newDatabase);
        fs.chownSync(newDatabase, appUid, appGid);
        fs.chmodSync(newDatabase, 0o644);

        fs.renameSync(database, oldDatabase);
        oldMoved = true;
        fs.renameSync(newDatabase, database);

        for (const suffix of ["-wal", "-shm"]) {
            try { fs.unlinkSync(database + suffix); }
            catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }

        fs.unlinkSync(candidate);
        console.log("Database file replaced successfully.");
    } catch (error) {
        if (oldMoved && fs.existsSync(oldDatabase)) {
            try {
                for (const suffix of ["", "-wal", "-shm"]) {
                    try { fs.unlinkSync(database + suffix); }
                    catch (removeError) {
                        if (removeError.code !== "ENOENT") throw removeError;
                    }
                }
                fs.renameSync(oldDatabase, database);
                console.error("Installation failed; previous database restored.");
            } catch (rollbackError) {
                console.error("CRITICAL: Automatic recovery failed:", rollbackError);
                console.error("Do not start the app or delete database files until recovery is reviewed.");
            }
        }
        throw error;
    }
} finally {
    if (db) db.close();
}
' "$CANDIDATE" "$DATABASE" "$NEW_DATABASE" "$OLD_DATABASE" "$APP_UID" "$APP_GID"
then
    echo "ERROR: Restore failed. The app container is stopped." >&2
    echo "The previous database file, if renamed, is preserved in the volume." >&2
    echo "Safety backup files are in: $BACKUP_DIR" >&2
    exit 1
fi


echo "Starting the application..."
HEALTHY=false

if podman start "$CONTAINER" >/dev/null; then
    echo "Waiting for the health check..."

    for _ in {1..30}; do
        if [[ "$(podman inspect --format '{{.State.Running}}' "$CONTAINER")" == "true" ]] &&
            podman exec "$CONTAINER" node --input-type=module -e '
                try {
                    const response = await fetch("http://127.0.0.1:3000/api/health");

                    if (!response.ok) {
                        throw new Error(`Health endpoint returned HTTP ${response.status}`);
                    }

                    const body = await response.json();

                    if (body.status !== "ok" || body.database !== "ok") {
                        throw new Error("Application or database health check failed");
                    }
                } catch (error) {
                    console.error(error);
                    process.exitCode = 1;
                }
            ' >/dev/null 2>&1; then
            HEALTHY=true
            break
        fi

        sleep 2
    done
else
    echo "ERROR: The app container could not be started after restore." >&2
fi

if [[ "$HEALTHY" != "true" ]]; then
    echo "ERROR: The app did not become healthy after restore." >&2
    echo "Stopping the app and attempting to restore the previous database..." >&2

    podman stop "$CONTAINER" >/dev/null 2>&1 || true

    FAILED_DATABASE="/data/.splitbuddies-failed-restore-$TIMESTAMP-$$.sqlite"

    if ! podman run --rm \
        --volumes-from "$CONTAINER" \
        --user 0:0 \
        --entrypoint node \
        "$IMAGE" \
        --input-type=module -e '
import fs from "node:fs";

const database = process.argv[1];
const oldDatabase = process.argv[2];
const failedDatabase = process.argv[3];
const appUid = Number(process.argv[4]);
const appGid = Number(process.argv[5]);

if (!fs.existsSync(oldDatabase)) {
    throw new Error("Pre-restore database is missing; cannot roll back.");
}

try {
    if (fs.existsSync(database)) fs.renameSync(database, failedDatabase);

    for (const suffix of ["-wal", "-shm"]) {
        for (const base of [database, oldDatabase, failedDatabase]) {
            try { fs.unlinkSync(base + suffix); }
            catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
    }

    fs.renameSync(oldDatabase, database);
    fs.chownSync(database, appUid, appGid);
    fs.chmodSync(database, 0o644);
    console.log("Previous database restored.");
} catch (error) {
    if (!fs.existsSync(database) && fs.existsSync(failedDatabase)) {
        try { fs.renameSync(failedDatabase, database); }
        catch (recoveryError) {
            console.error("CRITICAL: Could not recover the failed database file:", recoveryError);
        }
    }
    throw error;
}
' "$DATABASE" "$OLD_DATABASE" "$FAILED_DATABASE" "$APP_UID" "$APP_GID"
    then
        echo "CRITICAL: Automatic database rollback failed." >&2
        echo "Do not delete the database files or volume." >&2
        echo "Inspect the volume and safety backup at: $BACKUP_DIR" >&2
        exit 2
    fi

    if ! podman start "$CONTAINER" >/dev/null; then
        echo "CRITICAL: Previous database restored, but the app could not start." >&2
        exit 2
    fi

    ROLLBACK_HEALTHY=false
    for _ in {1..30}; do
        if [[ "$(podman inspect --format '{{.State.Running}}' "$CONTAINER")" == "true" ]] &&
            podman exec "$CONTAINER" node --input-type=module -e '
                try {
                    const response = await fetch("http://127.0.0.1:3000/api/health");

                    if (!response.ok) {
                        throw new Error(`Health endpoint returned HTTP ${response.status}`);
                    }

                    const body = await response.json();

                    if (body.status !== "ok" || body.database !== "ok") {
                        throw new Error("Application or database health check failed");
                    }
                }
                catch (error) {
                    console.error(error);
                    process.exitCode = 1;
                }
        ' >/dev/null 2>&1; then
            ROLLBACK_HEALTHY=true
            break
        fi
        sleep 2
    done

    if [[ "$ROLLBACK_HEALTHY" != "true" ]]; then
        echo "CRITICAL: Previous database was restored, but the app is still unhealthy." >&2
        echo "Safety backup location: $BACKUP_DIR" >&2
        exit 2
    fi

    echo "Rollback succeeded; the app is healthy on the previous database." >&2
    echo "The failed restored database, if preserved, is at: $FAILED_DATABASE" >&2
    exit 1
fi

echo "Removing temporary restore files..."
podman exec "$CONTAINER" rm -f \
    "$OLD_DATABASE" "$OLD_DATABASE-wal" "$OLD_DATABASE-shm" \
    "$NEW_DATABASE" "$NEW_DATABASE-wal" "$NEW_DATABASE-shm" \
    "$CANDIDATE" "$CANDIDATE-wal" "$CANDIDATE-shm" \
    >/dev/null 2>&1 || true

echo
echo "Restore completed successfully."
echo "Restored from: $BACKUP_FILE"
echo "The application is healthy."
