import type Database from 'better-sqlite3';

export interface Friendship {
    id: string;
    requester_id: string;
    addressee_id: string;
    status: 'pending' | 'accepted' | 'declined' | 'blocked';
    created_at: string;
    updated_at: string;
}

export interface PublicFriendUser {
	id: string;
	username: string;
	friend_code: string;
}

export interface FriendshipWithUser extends Friendship {
	user: PublicFriendUser;
}

export class FriendsRepository {
    private readonly db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    createRequest(id: string, requesterId: string, addresseeId: string): Friendship {
        this.db.prepare(`
            INSERT INTO friendships (
                id,
                requester_id,
                addressee_id
            )
            VALUES (?, ?, ?)
        `)
        .run(
            id,
            requesterId,
            addresseeId,
        );

        return this.getById(id)!;
    }

    getById(id: string): Friendship | null {
        const friendship = this.db.prepare(`
            SELECT
                id,
                requester_id,
                addressee_id,
                status,
                created_at,
                updated_at
            FROM friendships
            WHERE id = ?
        `)
        .get(id) as Friendship | undefined;

        return friendship ?? null;
    }

    getBetweenUsers(userId: string, otherUserId: string): Friendship | null {
        const friendship = this.db.prepare(`
            SELECT
                id,
                requester_id,
                addressee_id,
                status,
                created_at,
                updated_at
            FROM friendships
            WHERE
            (
                requester_id = ?
                AND addressee_id = ?
            )
            OR (
                requester_id = ?
                AND addressee_id = ?
            )
            LIMIT 1
        `)
        .get(
            userId,
            otherUserId,
            otherUserId,
            userId,
        ) as Friendship | undefined;

        return friendship ?? null;
    }

    getFriendsForUser(userId: string): FriendshipWithUser[] {
        const rows = this.db.prepare(`
            SELECT
                f.id,
                f.requester_id,
                f.addressee_id,
                f.status,
                f.created_at,
                f.updated_at,
                u.id AS user_id,
                u.username AS user_username,
                u.friend_code AS user_friend_code
            FROM friendships f
            INNER JOIN users u
                ON u.id = CASE
                    WHEN f.requester_id = ?
                    THEN f.addressee_id
                    ELSE f.requester_id
                END
            WHERE
                (
                    f.requester_id = ?
                    OR f.addressee_id = ?
                )
                AND f.status = 'accepted'
            ORDER BY f.created_at DESC
        `)
        .all(
            userId,
            userId,
            userId,
        ) as Array<
            Friendship & {
                user_id: string;
                user_username: string;
                user_friend_code: string;
            }
        >;

        return rows.map((friendship) => ({
            id: friendship.id,
            requester_id: friendship.requester_id,
            addressee_id: friendship.addressee_id,
            status: friendship.status,
            created_at: friendship.created_at,
            updated_at: friendship.updated_at,
            user: {
                id: friendship.user_id,
                username: friendship.user_username,
                friend_code: friendship.user_friend_code,
            },
        }));
    }

    getPendingRequestsForUser(userId: string): FriendshipWithUser[] {
        const rows = this.db.prepare(`
            SELECT
                f.id,
                f.requester_id,
                f.addressee_id,
                f.status,
                f.created_at,
                f.updated_at,
                u.id AS user_id,
                u.username AS user_username,
                u.friend_code AS user_friend_code
            FROM friendships f
            INNER JOIN users u
                ON u.id = f.requester_id
            WHERE
                f.addressee_id = ?
                AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `)
        .all(userId) as Array<
            Friendship & {
                user_id: string;
                user_username: string;
                user_friend_code: string;
            }
        >;

        return rows.map((friendship) => ({
            id: friendship.id,
            requester_id: friendship.requester_id,
            addressee_id: friendship.addressee_id,
            status: friendship.status,
            created_at: friendship.created_at,
            updated_at: friendship.updated_at,
            user: {
                id: friendship.user_id,
                username: friendship.user_username,
                friend_code: friendship.user_friend_code,
            },
        }));
    }

    updateStatus(id: string, status: Friendship['status']): Friendship | null {
        this.db.prepare(`
            UPDATE friendships
            SET
            status = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `)
        .run(
            status,
            id,
        );

        return this.getById(id);
    }

    removeFriendship(id: string): boolean {
        const result = this.db.prepare(`
            DELETE FROM friendships
            WHERE id = ?
                AND status = 'accepted'
        `).run(id);

        return result.changes > 0;
    }
}