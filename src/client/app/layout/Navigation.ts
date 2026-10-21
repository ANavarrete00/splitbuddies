export type AppRoute =
    | 'dashboard'
    | 'groups'
    | 'friends'
    | 'notifications'
    | 'settings';

interface NavigationItem {
    route: AppRoute;
    label: string;
}

const navigationItems: NavigationItem[] = [
    {
        route: 'dashboard',
        label: 'Dashboard',
    },
    {
        route: 'groups',
        label: 'Groups',
    },
    {
        route: 'friends',
        label: 'Friends',
    },
    {
        route: 'notifications',
        label: 'Notifications',
    },
    {
        route: 'settings',
        label: 'Settings',
    },
];

export function renderNavigation(activeRoute: AppRoute, unreadNotificationCount: number): string {
    return `
        <nav class="app-navigation" aria-label="Main navigation">
            <ul>
                ${navigationItems
                    .map((item) => `
                        <li>
                            <button class="navigation-item 
                                ${item.route === activeRoute
                                    ? 'active'
                                    : ''
                                }" type="button" data-route="${item.route}">
                                    ${item.label}
                                    ${item.route === 'notifications' && unreadNotificationCount > 0
                                        ? `<span aria-label="${unreadNotificationCount} unread notifications">(${unreadNotificationCount})</span>`
                                        : ''
                                    }
                            </button>
                        </li>
                    `)
                  .join('')}
            </ul>
        </nav>
    `;
}