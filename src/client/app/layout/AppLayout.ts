import type { User } from '../../api/auth';
import { renderNavigation, type AppRoute, } from './Navigation';
import { renderHeader } from './Header';

export function renderAppLayout(user: User, activeRoute: AppRoute, content: string, unreadNotificationCount: number): string {
    return `
        <div class="app-shell">
            ${renderHeader(user)}

            <div class="app-body">
                ${renderNavigation(activeRoute, unreadNotificationCount)}
                <main class="app-main">
                    ${content}
                </main>
            </div>
        </div>
        `;
}