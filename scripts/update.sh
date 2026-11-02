#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE="splitbuddies"
BRANCH="main"
BACKUP_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/splitbuddies/backups"

log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
    printf '\nERROR: %s\n' "$*" >&2
    exit 1
}

run_backup_test() {
    command -v node >/dev/null 2>&1 ||
        fail "Node.js is required for backup testing."

    [[ -d node_modules/better-sqlite3 ]] ||
        fail "better-sqlite3 is not installed. Run npm ci first."

    local test_dir
    test_dir="$(mktemp -d)"
    trap 'rm -rf "$test_dir"' RETURN

    log "Creating a temporary SQLite database."

    TEST_DIR="$test_dir" node <<'NODE'
const Database = require("better-sqlite3");
const path = require("node:path");

async function main() {
    const dir = process.env.TEST_DIR;
    const sourcePath = path.join(dir, "source.sqlite");
    const backupPath = path.join(dir, "backup.sqlite");

    const writer = new Database(sourcePath);
    writer.exec(`
        CREATE TABLE test_data (
            id INTEGER PRIMARY KEY,
            message TEXT NOT NULL
        )
    `);
    writer.prepare(
        "INSERT INTO test_data (message) VALUES (?)"
    ).run("Split Buddies backup test");
    writer.close();

    const source = new Database(sourcePath, {
        readonly: true,
        fileMustExist: true
    });

    try {
        await source.backup(backupPath);
    } finally {
        source.close();
    }

    const backup = new Database(backupPath, {
        readonly: true,
        fileMustExist: true
    });

    try {
        const result = backup.pragma("integrity_check");
        const row = backup.prepare(
            "SELECT message FROM test_data WHERE id = 1"
        ).get();

        if (result.length !== 1 || result[0].integrity_check !== "ok") {
            throw new Error("SQLite integrity check failed.");
        }

        if (row?.message !== "Split Buddies backup test") {
            throw new Error("Backup data verification failed.");
        }
    } finally {
        backup.close();
    }

    console.log("SQLite backup created and verified successfully.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
NODE

    log "Backup test completed successfully."
}

# Always run from the repository root.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [[ "${1:-}" == "--test" ]]; then
    run_backup_test
    exit 0
fi

if [[ $# -gt 0 ]]; then
    fail "Unknown argument: $1. Use --test or run without arguments to update."
fi

# Confirm this is the application repository.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
    fail "This script must be inside the Split Buddies Git repository."

[[ -f compose.yaml ]] ||
    fail "compose.yaml was not found."

# Select the available container engine and Compose implementation.
if command -v podman >/dev/null 2>&1 &&
   command -v podman-compose >/dev/null 2>&1; then
    ENGINE="podman"
    COMPOSE=(podman-compose)
elif command -v docker >/dev/null 2>&1 &&
     docker compose version >/dev/null 2>&1; then
    ENGINE="docker"
    COMPOSE=(docker compose)
else
    fail "Install Podman with podman-compose, or Docker with the Compose plugin."
fi

compose() {
    "${COMPOSE[@]}" "$@"
}

# Only update a clean main checkout.
CURRENT_BRANCH="$(git branch --show-current)"
[[ "$CURRENT_BRANCH" == "$BRANCH" ]] ||
    fail "You are on '$CURRENT_BRANCH'. Switch to '$BRANCH' before updating."

[[ -z "$(git status --porcelain)" ]] ||
    fail "The working tree is not clean. Commit, stash, or otherwise resolve local changes first."

log "Fetching the latest $BRANCH branch."
git fetch origin "$BRANCH"
git merge-base --is-ancestor HEAD "origin/$BRANCH" ||
    fail "Local $BRANCH has commits that are not on origin/$BRANCH. Refusing to update."

# The existing application container must be running so SQLite can make
# a consistent online backup using better-sqlite3.
CONTAINER_ID="$(compose ps -q "$SERVICE")"
[[ -n "$CONTAINER_ID" ]] ||
    fail "The $SERVICE container is not running. Start it before updating."

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')-$$"
CONTAINER_BACKUP="/data/splitbuddies-backup-${TIMESTAMP}.sqlite"
HOST_BACKUP="$BACKUP_DIR/splitbuddies-${TIMESTAMP}.sqlite"

log "Creating a consistent SQLite backup."
mkdir -p "$BACKUP_DIR"

compose exec -T "$SERVICE" node -e '
const Database = require("better-sqlite3");
const source = process.env.DATABASE_PATH || "/data/splitbuddies.sqlite";
const destination = process.argv[1];
const db = new Database(source, { readonly: true, fileMustExist: true });

db.backup(destination)
  .then(() => db.close())
  .catch((error) => {
    db.close();
    console.error(error);
    process.exit(1);
  });
' "$CONTAINER_BACKUP"

cleanup_container_backup() {
    "$ENGINE" exec "$CONTAINER_ID" rm -f "$CONTAINER_BACKUP" \
        >/dev/null 2>&1 || true
}

trap cleanup_container_backup EXIT

log "Verifying the database backup inside the container."
"$ENGINE" exec "$CONTAINER_ID" node - "$CONTAINER_BACKUP" <<'NODE'
const Database = require("better-sqlite3");

const backup = new Database(process.argv[2], {
    readonly: true,
    fileMustExist: true
});

try {
    const result = backup.pragma("integrity_check");

    if (result.length !== 1 || result[0].integrity_check !== "ok") {
        throw new Error("Database backup integrity check failed.");
    }

    console.log("Container-side database backup is valid.");
} finally {
    backup.close();
}
NODE

"$ENGINE" cp "$CONTAINER_ID:$CONTAINER_BACKUP" "$HOST_BACKUP"
cleanup_container_backup
trap - EXIT

log "Database backup saved to: $HOST_BACKUP"

log "Fast-forwarding to origin/$BRANCH."
git merge --ff-only "origin/$BRANCH"

# Rebuild and recreate the application container.
# The named database volume is deliberately left untouched.
log "Building and starting the updated application."
compose up -d --build

# Wait for the container's configured health check.
log "Waiting for the application health check."
HEALTH_STATUS="unknown"

for attempt in $(seq 1 30); do
    CONTAINER_ID="$(compose ps -q "$SERVICE")"

    if [[ -n "$CONTAINER_ID" ]]; then
        HEALTH_STATUS="$(
            "$ENGINE" inspect --format '{{.State.Health.Status}}' "$CONTAINER_ID" \
                2>/dev/null || true
        )"
    fi

    if [[ "$HEALTH_STATUS" == "healthy" ]]; then
        log "Split Buddies updated successfully."
        compose ps
        exit 0
    fi

    if [[ "$HEALTH_STATUS" == "unhealthy" ]]; then
        break
    fi

    sleep 5
done

printf '\nApplication health check did not become healthy (status: %s).\n' \
    "$HEALTH_STATUS" >&2

log "Recent application logs:"
compose logs --tail=100 "$SERVICE" || true

printf '\nThe database backup is available at:\n%s\n' "$HOST_BACKUP" >&2
fail "Update needs attention. The database volume was not deleted."
