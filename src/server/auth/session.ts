import { createHash, randomBytes } from 'node:crypto';

const SESSION_TOKEN_BYTES = 32;
const SESSION_DURATION_DAYS = 30;

export function generateSessionToken(): string {
    return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token: string): string {
    return createHash('sha256')
        .update(token)
        .digest('hex');
}

export function getSessionExpiration(): string {
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS,);

    return expiresAt.toISOString();
}