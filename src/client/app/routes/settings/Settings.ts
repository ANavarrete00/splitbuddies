
import {
    getNotificationPreferences,
    setNotificationPreference,
    type NotificationPreference,
} from '../../../api/notifications';

import { updateUsername, updatePassword } from '../../../api/auth';

export class Settings {
    private readonly root: HTMLDivElement;
    private readonly onUsernameChange: (username:string) => void;
    private preferences: NotificationPreference[] = [];
    private loaded = false;
    private loading = false;

    constructor(root: HTMLDivElement, onUsernameChange: (username: string) => void) {
        this.root = root;
        this.onUsernameChange = onUsernameChange;
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    reset(): void {
        this.preferences = [];
        this.loaded = false;
    }

    async load(): Promise<void> {
        if(this.loading) {
            return;
        }

        this.loading = true;

        try {
            this.preferences = await getNotificationPreferences();
            this.loaded = true;
        } finally {
            this.loading = false;
        }
    }

    render(username: string, email: string, friendCode: string): string {
        if(!this.loaded) {
            return `
                <section class="page">
                    <h2>Settings</h2>
                    <div class="card">
                        <p>Loading settings...</p>
                    </div>
                </section>
            `;
        }

        return `
            <section class="page">
                <h2>Settings</h2>

                <div class="card">
                    <h3>Account</h3>
                    
                    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                    <p><strong>Friend code:</strong> ${escapeHtml(friendCode)}</p>

                    <form id="username-form">
                        <label for="settings-username">Username</label>
                        <input
                            id="settings-username"
                            name="username"
                            type="text"
                            value="${escapeHtml(username)}"
                            minlength="3"
                            maxlength="50"
                            required
                        >
                        <button type="submit">Change username</button>
                        <p id="username-status" role="status"></p>
                    </form>

                    <form id="password-form">
                        <h3>Change password</h3>

                        <label for="current-password">Current password</label>
                        <input
                            id="current-password"
                            name="currentPassword"
                            type="password"
                            autocomplete="current-password"
                            required
                        >

                        <label for="new-password">New password</label>
                        <input
                            id="new-password"
                            name="newPassword"
                            type="password"
                            autocomplete="new-password"
                            minlength="12"
                            maxlength="128"
                            required
                        >

                        <label for="confirm-password">Confirm new password</label>
                        <input
                            id="confirm-password"
                            name="confirmPassword"
                            type="password"
                            autocomplete="new-password"
                            minlength="12"
                            maxlength="128"
                            required
                        >

                        <button type="submit">Change password</button>
                        <p id="password-status" role="status"></p>
                    </form>
                </div>

                <div class="card">
                    <div class="section-header">
                        <h3>Notification preferences</h3>
                    </div>
                    <p>Choose which notifications you want to receive.</p>

                    ${this.preferences.map((preference) => `
                        <p>
                            <label>
                                <input type="checkbox" data-notification-preference="${escapeHtml(preference.notification_type)}"
                                    ${preference.enabled ? 'checked' : ''}
                                >
                                ${notificationTypeLabel(preference.notification_type)}
                            </label>
                        </p>
                    `).join('')}
                </div>
            </section>
        `;
    }

    attachEvents(): void {
        this.root.querySelectorAll<HTMLInputElement>('[data-notification-preference]').forEach((input) => {
            input.addEventListener('change', async () => {
                const notificationType = input.dataset.notificationPreference;

                if(!notificationType) {
                    return;
                }

                const previousValue = !input.checked;
                input.disabled = true;

                try {
                    const updatedPreference = await setNotificationPreference(
                        notificationType,
                        input.checked,
                    );

                    this.preferences = this.preferences.map((preference) =>
                        preference.notification_type === updatedPreference.notification_type
                            ? updatedPreference
                            : preference,
                    );
                } 
                catch (error) {
                    console.error('Failed to update notification preference:', error);
                    input.checked = previousValue;
                } 
                finally {
                    input.disabled = false;
                }
            });
        });

        const usernameForm = this.root.querySelector<HTMLFormElement>('#username-form');
        usernameForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const input = usernameForm.querySelector<HTMLInputElement>('#settings-username');
            const status = usernameForm.querySelector<HTMLParagraphElement>('#username-status');
            const button = usernameForm.querySelector<HTMLButtonElement>('button[type="submit"]');

            if (!input || !status || !button) return;

            const username = input.value.trim();
            if (username.length < 3 || username.length > 50) {
                status.textContent = 'Username must be between 3 and 50 characters.';
                return;
            }

            button.disabled = true;
            status.textContent = 'Updating username...';

            try {
                const user = await updateUsername(username);
                this.onUsernameChange(user.username);
            } 
            catch (error) {
                status.textContent = error instanceof Error
                    ? error.message
                    : 'Failed to update username.';
            } 
            finally {
                button.disabled = false;
            }
        });

        const passwordForm = this.root.querySelector<HTMLFormElement>('#password-form');
        passwordForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const currentInput = passwordForm.querySelector<HTMLInputElement>('#current-password');
            const newInput = passwordForm.querySelector<HTMLInputElement>('#new-password');
            const confirmInput = passwordForm.querySelector<HTMLInputElement>('#confirm-password');
            const status = passwordForm.querySelector<HTMLParagraphElement>('#password-status');
            const button = passwordForm.querySelector<HTMLButtonElement>('button[type="submit"]');

            if (!currentInput || !newInput || !confirmInput || !status || !button) {
                return;
            }

            if (newInput.value !== confirmInput.value) {
                status.textContent = 'New passwords do not match.';
                return;
            }

            if (newInput.value.length < 12 || newInput.value.length > 128) {
                status.textContent = 'New password must be between 12 and 128 characters.';
                return;
            }

            button.disabled = true;
            status.textContent = 'Updating password...';

            try {
                await updatePassword(currentInput.value, newInput.value);

                passwordForm.reset();
                status.textContent = 'Password changed successfully.';
            } 
            catch (error) {
                status.textContent = error instanceof Error
                    ? error.message
                    : 'Failed to change password.';
            } 
            finally {
                button.disabled = false;
            }
        });
    }
}

function notificationTypeLabel(type: string): string {
    switch (type) {
        case 'expense_added':
            return 'Expense added';
        case 'expense_edited':
            return 'Expense edited';
        case 'expense_deleted':
            return 'Expense deleted';
        case 'settlement_created':
            return 'Settlement recorded';
        case 'settlement_deleted':
            return 'Settlement deleted';
        case 'friend_request':
            return 'Friend request received';
        case 'group_added':
            return 'Added to a group';
        case 'group_removed':
            return 'Removed from a group';
        case 'expense_excluded':
            return 'Added to an expense exclusion';
        default:
            return type;
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
