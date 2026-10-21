import { randomUUID } from 'node:crypto';

import { db } from '../db/database.ts';

export interface UserRecord {
    id: string;
    username: string;
    email: string;
    friend_code: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
}

export interface CreateUserInput {
    username: string;
    email: string;
    friend_code: string;
    password_hash: string;
}

export function createUser(input: CreateUserInput): UserRecord {
  const id = randomUUID();

  db.prepare(`
      INSERT INTO users (
          id,
          username,
          email,
          friend_code,
          password_hash
      )
      VALUES (?, ?, ?, ?, ?)
  `)
  .run(
    id,
      input.username,
      input.email,
      input.friend_code,
      input.password_hash,
  );

  const user = db.prepare(`
      SELECT
          id,
          username,
          email,
          friend_code,
          password_hash,
          created_at,
          updated_at
      FROM users
      WHERE id = ?
  `)
  .get(id) as UserRecord | undefined;

  if(
    !user) {
      throw new Error('Failed to retrieve created user');
  }

  return user;
}

export function getUserById(id: string): UserRecord | null {
  const user = db.prepare(`
      SELECT
          id,
          username,
          email,
          friend_code,
          password_hash,
          created_at,
          updated_at
      FROM users
      WHERE id = ?
  `)
  .get(id) as UserRecord | undefined;

  return user ?? null;
}

export function getUserByEmail(email: string): UserRecord | null {
  const user = db.prepare(`
      SELECT
          id,
          username,
          email,
          friend_code,
          password_hash,
          created_at,
          updated_at
      FROM users
      WHERE email = ?
  `)
  .get(email) as UserRecord | undefined;

  return user ?? null;
}

export function getUserByUsername(username: string): UserRecord | null {
  const user = db.prepare(`
      SELECT
          id,
          username,
          email,
          friend_code,
          password_hash,
          created_at,
          updated_at
      FROM users
      WHERE username = ?
  `)
  .get(username) as UserRecord | undefined;

  return user ?? null;
}

export function getUserByFriendCode(friendCode: string): UserRecord | null {
  const user = db.prepare(`
      SELECT
          id,
          username,
          email,
          friend_code,
          password_hash,
          created_at,
          updated_at
      FROM users
      WHERE friend_code = ?
  `)
  .get(friendCode) as UserRecord | undefined;

  return user ?? null;
}

export function updateUsername(userId: string, username: string): UserRecord | null {
    return db.transaction(() => {
        db.prepare(`
            UPDATE users
            SET
                username = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(username, userId);

        db.prepare(`
            UPDATE group_members
            SET username = ?
            WHERE user_id = ?
        `).run(username, userId);

        return getUserById(userId);
    })();
}

export function updatePasswordHash(userId: string, passwordHash: string): UserRecord | null {
    db.prepare(`
        UPDATE users
        SET
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(passwordHash, userId);

    return getUserById(userId);
}
