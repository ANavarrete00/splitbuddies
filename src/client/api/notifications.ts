import { request } from './client';

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    actor_user_id: string | null;
    title: string;
    message: string | null;
    read_at: string | null;
    created_at: string;
}

export interface NotificationPreference {
    notification_type: string;
    enabled: boolean;
}

interface NotificationsResponse {
    notifications: Notification[];
}

interface UnreadCountResponse {
    count: number;
}

interface PreferencesResponse {
    preferences: NotificationPreference[];
}

interface PreferenceResponse {
    preference: NotificationPreference;
}

export async function getNotifications(): Promise<Notification[]> {
    const response = await request<NotificationsResponse>(
        '/api/notifications',
    );

    return response.notifications;
}

export async function getUnreadNotificationCount(): Promise<number> {
    const response = await request<UnreadCountResponse>(
        '/api/notifications/unread-count',
    );

    return response.count;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    await request<{success: boolean}>(
        `/api/notifications/${encodeURIComponent(notificationId)}/read`,
        {
            method: 'PATCH',
        },
    );
}

export async function markAllNotificationsAsRead(): Promise<number> {
    const response = await request<{updated: number}>(
        '/api/notifications/read-all',
        {
            method: 'POST',
        },
    );

    return response.updated;
}

export async function deleteNotification(notificationId: string): Promise<void> {
    await request<{success: boolean}>(
        `/api/notifications/${encodeURIComponent(notificationId)}`,
        {
            method: 'DELETE',
        },
    );
}

export async function deleteAllNotifications(): Promise<number> {
    const response = await request<{deleted: number}>(
        '/api/notifications',
        {
            method: 'DELETE',
        },
    );

    return response.deleted;
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
    const response = await request<PreferencesResponse>(
        '/api/notifications/preferences',
    );

    return response.preferences;
}

export async function setNotificationPreference(notificationType: string, enabled: boolean): Promise<NotificationPreference> {
    const response = await request<PreferenceResponse>(
        `/api/notifications/preferences/${encodeURIComponent(notificationType)}`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                enabled,
            }),
        },
    );

    return response.preference;
}