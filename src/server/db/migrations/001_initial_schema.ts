
import type Database from 'better-sqlite3';

export function up(db: Database.Database): void {
    db.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            friend_code TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE auth_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL,
            last_used_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE friendships (
            id TEXT PRIMARY KEY,
            requester_id TEXT NOT NULL,
            addressee_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
            CHECK (requester_id != addressee_id),
            UNIQUE (requester_id, addressee_id)
        );

        CREATE TABLE groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            currency TEXT NOT NULL DEFAULT 'USD',
            balance_visibility TEXT NOT NULL DEFAULT 'private'
                CHECK (balance_visibility IN ('private', 'group')),
            status TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'completed')),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
        );

        CREATE TABLE group_members (
            group_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'member')),
            joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            share_percentage_basis_points INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (group_id, user_id),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE expenses (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            excluded_amount_cents INTEGER NOT NULL DEFAULT 0
                CHECK (
                    excluded_amount_cents >= 0
                    AND excluded_amount_cents <= amount_cents
                ),
            tax_cents INTEGER NOT NULL DEFAULT 0
                CHECK (tax_cents >= 0 AND tax_cents <= amount_cents),
            tax_rate_basis_points INTEGER
                CHECK (tax_rate_basis_points >= 0),
            paid_by TEXT NOT NULL,
            paid_by_uid TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_by_uid TEXT NOT NULL,
            occurred_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (paid_by_uid) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (created_by_uid) REFERENCES users(id) ON DELETE RESTRICT
        );

        CREATE TABLE expense_exclusions (
            id TEXT PRIMARY KEY,
            expense_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
        );

        CREATE TABLE settlements (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            from_user_id TEXT NOT NULL,
            to_user_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE RESTRICT,
            CHECK (from_user_id != to_user_id),
            CHECK (amount_cents > 0)
        );

        CREATE TABLE notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            actor_user_id TEXT,
            title TEXT NOT NULL,
            message TEXT,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE notification_preferences (
            user_id TEXT NOT NULL,
            notification_type TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
            PRIMARY KEY (user_id, notification_type),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_auth_sessions_user_id
            ON auth_sessions(user_id);
        CREATE INDEX idx_auth_sessions_expires_at
            ON auth_sessions(expires_at);

        CREATE INDEX idx_friendships_requester
            ON friendships(requester_id);
        CREATE INDEX idx_friendships_addressee
            ON friendships(addressee_id);
        CREATE INDEX idx_friendships_status
            ON friendships(status);

        CREATE INDEX idx_group_members_user_id
            ON group_members(user_id);

        CREATE INDEX idx_expenses_group_id
            ON expenses(group_id);
        CREATE INDEX idx_expenses_paid_by_uid
            ON expenses(paid_by_uid);
        CREATE INDEX idx_expenses_created_by_uid
            ON expenses(created_by_uid);
        CREATE INDEX idx_expenses_occurred_at
            ON expenses(occurred_at);

        CREATE INDEX idx_expense_exclusions_expense_id
            ON expense_exclusions(expense_id);
        CREATE INDEX idx_expense_exclusions_user_id
            ON expense_exclusions(user_id);

        CREATE INDEX idx_settlements_group_id
            ON settlements(group_id);
        CREATE INDEX idx_settlements_from_user
            ON settlements(from_user_id);
        CREATE INDEX idx_settlements_to_user
            ON settlements(to_user_id);

        CREATE INDEX idx_notifications_user
            ON notifications(user_id);
        CREATE INDEX idx_notifications_unread
            ON notifications(user_id, read_at);
        CREATE INDEX idx_notifications_created
            ON notifications(created_at);

        CREATE INDEX idx_notification_preferences_user
            ON notification_preferences(user_id);
    `);
}

export function down(db: Database.Database): void {
    db.exec(`
        DROP TABLE IF EXISTS notification_preferences;
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS settlements;
        DROP TABLE IF EXISTS expense_exclusions;
        DROP TABLE IF EXISTS expenses;
        DROP TABLE IF EXISTS group_members;
        DROP TABLE IF EXISTS groups;
        DROP TABLE IF EXISTS friendships;
        DROP TABLE IF EXISTS auth_sessions;
        DROP TABLE IF EXISTS users;
    `);
}
