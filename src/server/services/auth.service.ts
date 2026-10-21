import { randomUUID } from 'node:crypto';

import { createUser, getUserByEmail, getUserById, updateUsername, updatePasswordHash } from '../repositories/users.repository.ts';

import { createAuthSession, deleteAuthSessionByTokenHash, deleteOtherAuthSessions } from '../repositories/auth-sessions.repository.ts';

import { generateSessionToken, getSessionExpiration, hashSessionToken } from '../auth/session.ts';

import { hashPassword, verifyPassword } from '../auth/password.ts';

export interface PublicUser {
    id: string;
    username: string;
    email: string;
    friend_code: string;
    created_at: string;
    updated_at: string;
}

export interface RegisterInput {
    username: string;
    email: string;
    password: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface AuthResult {
    user: PublicUser;
    sessionToken: string;
    expiresAt: string;
}

function toPublicUser(user: {
    id: string;
    username: string;
    email: string;
    friend_code: string;
    created_at: string;
    updated_at: string;
}): PublicUser {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        friend_code: user.friend_code,
        created_at: user.created_at,
        updated_at: user.updated_at,
    };
}

function generateFriendCode(): string {
    return randomUUID()
        .replace(/-/g, '')
        .slice(0, 8)
        .toUpperCase();
}

export async function register(input: RegisterInput): Promise<AuthResult> {
    const existingEmail = getUserByEmail(input.email);

    if(existingEmail) {
        throw new Error('Unable to create account');
    }

    const passwordHash = await hashPassword(input.password);
    const friendCode = generateFriendCode();

    const user = createUser({
        username: input.username,
        email: input.email,
        friend_code: friendCode,
        password_hash: passwordHash,
    });

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiration();

    createAuthSession({user_id: user.id, token_hash: tokenHash, expires_at: expiresAt,});

    return {
      user: toPublicUser(user),
      sessionToken,
      expiresAt,
    };
}

export async function login(input: LoginInput): Promise<AuthResult> {
    const user = getUserByEmail(input.email);

    if(!user) {
        throw new Error('Invalid email or password');
    }

    const passwordValid = await verifyPassword(
        input.password,
        user.password_hash,
    );

    if(!passwordValid) {
        throw new Error('Invalid email or password');
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiration();

    createAuthSession({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
    });

    return {
        user: toPublicUser(user),
        sessionToken,
        expiresAt,
    };
}

export function logout(sessionToken: string): void {
    const tokenHash = hashSessionToken(sessionToken);

    deleteAuthSessionByTokenHash(tokenHash);
}

export function getPublicUserById(userId: string): PublicUser | null {
    const user = getUserById(userId);

    if(!user) {
        return null;
    }

    return toPublicUser(user);
}

export function changeUsername(userId: string, username: string): PublicUser {
    const user = updateUsername(userId, username);

    if (!user) {
        throw new Error('User not found');
    }

    return toPublicUser(user);
}

export async function changePassword(userId: string,currentSessionId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = getUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
        throw new Error('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = updatePasswordHash(userId, passwordHash);
    if (!updatedUser) {
        throw new Error('User not found');
    }

    deleteOtherAuthSessions(userId, currentSessionId);
}
