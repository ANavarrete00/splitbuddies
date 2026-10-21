import type Database from 'better-sqlite3';
import type { NotificationType } from '../notifications/types.ts';

export interface Notification {
        id: string;
        user_id: string;
        type: NotificationType;
        actor_user_id: string | null;
        title: string;
        message: string | null;
        read_at: string | null;
        created_at: string;
}

export interface NotificationPreference {
        user_id: string;
        notification_type: NotificationType;
        enabled: boolean;
}

export class NotificationsRepository {
        private readonly db: Database.Database
    
    constructor(db: Database.Database) {
        this.db = db;
    }

    createNotification(id: string, userId: string, type: NotificationType, actorUserId: string | null, title: string, message: string | null): Notification {
        this.db.prepare(`
            INSERT INTO notifications (
                id,
                user_id,
                type,
                actor_user_id,
                title,
                message
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, userId, type, actorUserId, title, message);

        return this.getNotification(id)!;
    }

    getNotification(id: string): Notification | undefined {
        return this.db.prepare(`
            SELECT
                id,
                user_id,
                type,
                actor_user_id,
                title,
                message,
                read_at,
                created_at
            FROM notifications
            WHERE id = ?
        `).get(id) as Notification | undefined;
    }

    getNotifications(userId: string): Notification[] {
        return this.db.prepare(`
            SELECT
                id,
                user_id,
                type,
                actor_user_id,
                title,
                message,
                read_at,
                created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
        `).all(userId) as Notification[];
    }

    getUnreadCount(userId: string): number {
        const result = this.db.prepare(`
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE user_id = ?
                AND read_at IS NULL
        `).get(userId) as { count: number };

        return result.count;
    }

    markAsRead(userId: string, notificationId: string): boolean {
        const result = this.db.prepare(`
            UPDATE notifications
            SET read_at = CURRENT_TIMESTAMP
            WHERE id = ?
                AND user_id = ?
                AND read_at IS NULL
        `).run(
                notificationId,
                userId,
        );

        return result.changes > 0;
    }

    markAllAsRead(userId: string): number {
        const result = this.db.prepare(`
            UPDATE notifications
            SET read_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
                AND read_at IS NULL
        `).run(userId);

        return result.changes;
    }

    deleteNotification(userId: string, notificationId: string): boolean {
        const result = this.db.prepare(`
            DELETE FROM notifications
            WHERE id = ?
                AND user_id = ?
        `).run(notificationId, userId);

        return result.changes > 0;
    }

    deleteAllNotifications(userId: string): number {
        const result = this.db.prepare(`
            DELETE FROM notifications
            WHERE user_id = ?
        `).run(userId);

        return result.changes;
    }

    getPreference(userId: string, notificationType: NotificationType): NotificationPreference {
        const result = this.db.prepare(`
            SELECT
                user_id,
                notification_type,
                enabled
            FROM notification_preferences
            WHERE user_id = ?
                AND notification_type = ?
        `).get(userId, notificationType) as {
            user_id: string;
            notification_type: NotificationType;
            enabled: number;
        } | undefined;

        if(
            !result) {
            return {
                user_id: userId,
                notification_type: notificationType,
                enabled: true,
            };
        }

        return {
            user_id: result.user_id,
            notification_type: result.notification_type,
            enabled: result.enabled === 1,
        };
    }

    getPreferences(userId: string): NotificationPreference[] {
        return this.db.prepare(`
            SELECT
                user_id,
                notification_type,
                enabled
            FROM notification_preferences
            WHERE user_id = ?
            ORDER BY notification_type ASC
        `).all(userId).map((row) => {
            const preference = row as {
                user_id: string;
                notification_type: NotificationType;
                enabled: number;
            };

            return {
                user_id: preference.user_id,
                notification_type: preference.notification_type,
                enabled: preference.enabled === 1,
            };
        });
    }

    setPreference(userId: string, notificationType: NotificationType, enabled: boolean): NotificationPreference {
        this.db.prepare(`
            INSERT INTO notification_preferences (
                user_id,
                notification_type,
                enabled
            )
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, notification_type)
            DO UPDATE SET enabled = excluded.enabled
        `).run(userId, notificationType, enabled ? 1 : 0);

        return this.getPreference(
            userId,
            notificationType,
        );
    }
}