import { db } from '../db/database.ts';

export interface AuthSessionRecord {
    id: number;
    user_id: string;
    token_hash: string;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
}

export interface CreateAuthSessionInput {
    user_id: string;
    token_hash: string;
    expires_at: string;
}

export function createAuthSession(input: CreateAuthSessionInput): AuthSessionRecord {
    const result = db.prepare(`
        INSERT INTO auth_sessions (
            user_id,
            token_hash,
            expires_at
        )
        VALUES (?, ?, ?)
    `)
    .run(
        input.user_id,
        input.token_hash,
        input.expires_at,
    );

    const session = db.prepare(`
        SELECT
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            last_used_at
        FROM auth_sessions
        WHERE id = ?
    `)
    .get(result.lastInsertRowid) as AuthSessionRecord | undefined;

    if(
        !session) {
        throw new Error('Failed to retrieve created auth session');
    }

    return session;
}

export function getAuthSessionByTokenHash(tokenHash: string): AuthSessionRecord | null {
    const session = db.prepare(`
        SELECT
            id,
            user_id,
            token_hash,
            created_at,
            expires_at,
            last_used_at
        FROM auth_sessions
        WHERE token_hash = ?
    `)
    .get(tokenHash) as AuthSessionRecord | undefined;

    return session ?? null;
}

export function updateAuthSessionLastUsed(sessionId: number): void {
    db.prepare(`
        UPDATE auth_sessions
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `)
    .run(sessionId);
}

export function deleteAuthSession(sessionId: number): void {
    db.prepare(`
        DELETE FROM auth_sessions
        WHERE id = ?
    `)
    .run(sessionId);
}

export function deleteAuthSessionByTokenHash(tokenHash: string): void {
    db.prepare(`
        DELETE FROM auth_sessions
        WHERE token_hash = ?
    `)
    .run(tokenHash);
}

export function deleteExpiredAuthSessions(): number {
    const result = db.prepare(`
        DELETE FROM auth_sessions
        WHERE expires_at <= CURRENT_TIMESTAMP
    `)
    .run();

    return result.changes;
}

export function deleteOtherAuthSessions(userId: string, currentSessionId: number): number {
    const result = db.prepare(`
        DELETE FROM auth_sessions
        WHERE user_id = ?
          AND id != ?
    `).run(userId, currentSessionId);

    return result.changes;
}
