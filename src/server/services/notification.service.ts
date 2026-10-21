import { randomUUID } from 'crypto';
import type { NotificationsRepository } from '../repositories/notifications.repository.ts';
import {
    notificationTypes,
    type NotificationType,
} from '../notifications/types.ts';

export class NotificationsService {
    private readonly notificationsRepository: NotificationsRepository;

    constructor(notificationsRepository: NotificationsRepository) {
        this.notificationsRepository = notificationsRepository;
    }

    createNotification(userId: string, type: NotificationType, title: string, message: string | null = null, actorUserId: string | null = null) {
        const preference = this.notificationsRepository.getPreference(userId, type);

        if(!preference.enabled) {
            return null;
        }

        return this.notificationsRepository.createNotification(
            randomUUID(),
            userId,
            type,
            actorUserId,
            title,
            message,
        );
    }

    getNotifications(userId: string) {
        return this.notificationsRepository.getNotifications(userId);
    }

    getUnreadCount(userId: string): number {
        return this.notificationsRepository.getUnreadCount(userId);
    }

    markAsRead(userId: string, notificationId: string): boolean {
        return this.notificationsRepository.markAsRead(userId, notificationId);
    }

    markAllAsRead(userId: string): number {
        return this.notificationsRepository.markAllAsRead(userId);
    }

    deleteNotification(userId: string, notificationId: string): boolean {
        return this.notificationsRepository.deleteNotification(userId, notificationId);
    }

    deleteAllNotifications(userId: string): number {
        return this.notificationsRepository.deleteAllNotifications(userId);
    }

    getPreferences(userId: string) {
        const storedPreferences = new Map(
            this.notificationsRepository.getPreferences(userId).map((preference) => [
                preference.notification_type,
                preference.enabled,
            ]),
        );

        return notificationTypes.map((notificationType) => ({
            notification_type: notificationType,
            enabled: storedPreferences.get(notificationType) ?? true,
        }));
    }

    setPreference(userId: string, notificationType: NotificationType, enabled: boolean) {
        return this.notificationsRepository.setPreference(userId, notificationType, enabled);
    }
}