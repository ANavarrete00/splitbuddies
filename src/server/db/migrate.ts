import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type Database from 'better-sqlite3';
import { db } from './database.ts';

// Use the concrete better-sqlite3 type here so the migration
// interface does not reference the imported `db` instance in its own type.
type Migration = {
    up: (db: Database.Database) => void;
    down: (db: Database.Database) => void;
};

db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

const migrationsDir = join(import.meta.dirname, 'migrations');

const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.ts'))
    .sort();

for (const filename of files) {
    const alreadyApplied = db.prepare(`
        SELECT 1
        FROM schema_migrations
        WHERE filename = ?
    `)
    .get(filename);

    if(alreadyApplied) {
        continue;
    }

    console.log(`Applying migration: ${filename}`);

    const migrationPath = pathToFileURL(join(migrationsDir, filename)).href;

    const migration = (await import(migrationPath)) as Migration;

    const transaction = db.transaction(() => {
        migration.up(db);

        db.prepare(`
            INSERT INTO schema_migrations (filename)
            VALUES (?)
        `).run(filename);
    });

    transaction();

    console.log(`Applied migration: ${filename}`);
}

console.log('Database migrations complete.');
