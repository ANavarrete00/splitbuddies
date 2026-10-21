import {
    getNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    deleteAllNotifications,
    deleteNotification,
    type Notification,
} from '../../../api/notifications';

export class Notifications {
    private readonly root: HTMLDivElement;
    private readonly onChange: () => void;

    private notifications: Notification[] = [];
    private loaded = false;
    private loading = false;

    constructor(root: HTMLDivElement, onChange: () => void) {
        this.root = root;
        this.onChange = onChange;
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    reset(): void {
        this.notifications = [];
        this.loaded = false;
    }

    async load(): Promise<void> {
        if(
            this.loading) {
            return;
        }

        this.loading = true;

        try {
            const [notifications] = await Promise.all([getNotifications()]);

            this.notifications = notifications;
            this.loaded = true;
        } 
        finally {
            this.loading = false;
        }
    }

    render(): string {
        if(!this.loaded) {
            return `
                <section class="page">
                    <h2>Notifications</h2>
                    <div class="card">
                        <p>Loading notifications...</p>
                    </div>
                </section>
            `;
        }

        const unreadCount = this.notifications.filter(
            (notification) => notification.read_at === null,
        ).length;

        return `
            <section class="page">
                <h2>Notifications</h2>

                <div class="card">
                    <div>
                        <div class="section-header">
                            <h3>Notifications</h3>
                        </div>

                        <p>
                            ${
                                unreadCount === 0
                                    ? 'You have no unread notifications.'
                                    : `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`
                            }
                        </p>
                    </div>

                    ${this.notifications.length > 0
                        ? `${unreadCount > 0
                                ? `
                                    <button type="button" data-notification-action="mark-all-read">
                                        Mark all as read
                                    </button>
                                `
                                : ''
                            }
                            <button type="button" data-notification-action="delete-all">
                                Delete all
                            </button>
                        `
                        : ''
                    }
                </div>

                ${
                    this.notifications.length === 0
                        ? `
                            <div class="card">
                                <p>You don't have any notifications yet.</p>
                            </div>
                        `
                        : this.notifications
                            .map((notification) => this.renderNotification(notification))
                            .join('')
                }
            </section>
        `;
    }

    attachEvents(): void {
        const markAllButton = this.root.querySelector<HTMLButtonElement>('[data-notification-action="mark-all-read"]');
        markAllButton?.addEventListener('click', async () => {
            markAllButton.disabled = true;

            try {
                await markAllNotificationsAsRead();

                this.notifications = this.notifications.map((notification) => ({
                    ...notification,
                    read_at: notification.read_at ?? new Date().toISOString(),
                }));

                this.renderPage();
            } catch (error) {
                console.error('Failed to mark notifications as read:', error);
                markAllButton.disabled = false;
            }
        });

        const deleteAllButton = this.root.querySelector<HTMLButtonElement>('[data-notification-action="delete-all"]');
        deleteAllButton?.addEventListener('click', async () => {
            if(!window.confirm('Delete all notifications?')) {
                return;
            }

            deleteAllButton.disabled = true;

            try {
                await deleteAllNotifications();

                this.notifications = [];

                this.renderPage();
            } 
            catch (error) {
                console.error('Failed to delete all notifications:', error);
                deleteAllButton.disabled = false;
            }
        });

        this.root.querySelectorAll<HTMLButtonElement>('[data-notification-id]').forEach((button) => {
            button.addEventListener('click', async () => {
                const notificationId = button.dataset.notificationId;

                if(!notificationId) {
                    return;
                }

                button.disabled = true;

                try {
                    await markNotificationAsRead(notificationId);

                    this.notifications = this.notifications.map((notification) =>
                        notification.id === notificationId
                            ? {
                                ...notification,
                                read_at: notification.read_at ?? new Date().toISOString(),
                            }
                            : notification,
                    );

                    this.renderPage();
                } 
                catch (error) {
                    console.error('Failed to mark notification as read:', error);
                    button.disabled = false;
                }
            });
        });

        this.root.querySelectorAll<HTMLButtonElement>('[data-notification-delete-id]').forEach((button) => {
            button.addEventListener('click', async () => {
                const notificationId = button.dataset.notificationDeleteId;

                if(!notificationId) {
                    return;
                }

                button.disabled = true;

                try {
                    await deleteNotification(notificationId);

                    this.notifications = this.notifications.filter(
                        (notification) => notification.id !== notificationId,
                    );

                    this.renderPage();
                } 
                catch (error) {
                    console.error('Failed to delete notification:', error);
                    button.disabled = false;
                }
            });
        });
    }

    private renderPage(): void {
        this.onChange();
    }

    private renderNotification(notification: Notification): string {
        const isUnread = notification.read_at === null;

        return `
            <div class="card">
                <h3>${escapeHtml(notification.title)}</h3>
                ${
                    notification.message
                        ? `<p>${escapeHtml(notification.message)}</p>`
                        : ''
                }
                <p>
                    <small>${formatNotificationDate(notification.created_at)}</small>
                </p>

                ${isUnread
                    ? `
                        <button type="button" data-notification-id="${escapeHtml(notification.id)}">
                            Mark as read
                        </button>
                    `
                    : '<p><small>Read</small></p>'
                }
                <button type="button" data-notification-delete-id="${escapeHtml(notification.id)}">
                    Delete
                </button>
            </div>
        `;
    }
}

function formatNotificationDate(value: string): string {
    const date = new Date(value);

    if(Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}