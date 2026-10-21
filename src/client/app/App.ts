import { logout, type User, } from '../api/auth';

import { renderAppLayout, } from './layout/AppLayout';

import type { AppRoute, } from './layout/Navigation';

import { Dashboard } from './routes/dashboard/Dashboard.ts';

import { Groups } from './routes/groups/Groups.ts';
import { GroupDetails } from './routes/groups/GroupDetails';
import type { Group } from '../api/groups';

import { Friends, } from './routes/friends/Friends';

import { Notifications } from './routes/notifications/Notifications.ts';
import { getUnreadNotificationCount } from '../api/notifications.ts';

import { Settings } from './routes/settings/Settings.ts';

export class App {
    private readonly root: HTMLDivElement;

    private user: User;
    private activeRoute: AppRoute = 'dashboard';
    private onLogout: () => void;

    private readonly dashboardPage: Dashboard;

    private readonly groupsPage: Groups;
    private selectedGroup: Group | null = null;
    private readonly groupDetailsPage: GroupDetails;

    private readonly friendsPage: Friends;

    private readonly notificationsPage: Notifications;
    private unreadNotificationCount = 0;
    private notificationPollingInterval: ReturnType<typeof setInterval> | null = null;
    private disposed = false;

    private readonly settingsPage: Settings;

    constructor(root: HTMLDivElement, user: User, onLogout: () => void) {
        this.root = root;
        this.user = user;
        this.onLogout = onLogout;
        
        this.dashboardPage = new Dashboard(this.root, this.user.id, () => this.render(), (groupId) => {
                this.activeRoute = 'groups';
                void this.loadGroupDetails(groupId);
            },
            (route) => {
                this.activeRoute = route;

                if(route === 'groups') {
                    this.selectedGroup = null;
                }

                this.render();
            },
        )

        this.groupsPage = new Groups(this.root, (groupId) => {
                void this.loadGroupDetails(groupId);
            },
            () => {
                this.render();
            }
        );

        this.groupDetailsPage = new GroupDetails(this.root, this.user.id, () => {
            void this.handleGroupBack();
        },
        () => {
            void this.handleGroupChange();
        });

        this.friendsPage = new Friends(this.root, () => this.render());

        this.notificationsPage = new Notifications(this.root, async () => {
            await this.refreshUnreadNotificationCount(false);
            this.render();
        });

        this.settingsPage = new Settings(this.root, (username) => {
            this.user = {...this.user, username}
            this.render();
        });

        this.startNotificationPolling();
    }

    render(): void {
        if(this.disposed) {
            return;
        }

        this.root.innerHTML = renderAppLayout(this.user, this.activeRoute, this.renderRoute(), this.unreadNotificationCount);
        this.attachEvents();

        if(this.activeRoute === 'dashboard' && !this.dashboardPage.isLoaded() && !this.dashboardPage.isLoading() && !this.dashboardPage.hasError()) {
            void this.loadDashboard();
        }

        if(this.activeRoute === 'groups' && !this.selectedGroup && !this.groupsPage.isLoaded()) {
            void this.loadGroups();
        }

        if(this.activeRoute === 'friends' && !this.friendsPage.isLoaded()) {
            void this.loadFriends();
        }

        if(this.activeRoute === 'notifications' && !this.notificationsPage.isLoaded()) {
            void this.loadNotifications();
        }
    }

    dispose(): void {
        this.disposed = true;

        if(this.notificationPollingInterval !== null) {
            clearInterval(this.notificationPollingInterval);
            this.notificationPollingInterval = null;
        }
    }

    // Request Data
    private async loadDashboard(): Promise<void> {
        await this.dashboardPage.load();

        if(this.activeRoute === 'dashboard') {
            this.render();
        }
    }

    private async loadGroups(): Promise<void> {
        await this.groupsPage.load();

        if(this.activeRoute === 'groups' && !this.selectedGroup) {
            this.render();
        }
    }
    
    private async loadGroupDetails(groupId: string): Promise<void> {
        await this.groupDetailsPage.load(groupId);

        this.selectedGroup = this.groupDetailsPage.getGroup();

        this.render();
    }

    private async loadFriends(): Promise<void> {
        await this.friendsPage.load();

        if(this.activeRoute === 'friends') {
            this.render();
        }
    }

    private async loadNotifications(): Promise<void> {
        await this.notificationsPage.load();

        if(this.activeRoute === 'notifications') {
            this.render();
        }
    }

    private async refreshUnreadNotificationCount(renderWhenChanged = true): Promise<void> {
        try {
            const unreadCount = await getUnreadNotificationCount();

            if(this.disposed) {
                return;
            }
            
            if(unreadCount !== this.unreadNotificationCount) {
                this.unreadNotificationCount = unreadCount;
                if(renderWhenChanged){
                    this.render();
                }
            }
        } 
        catch(error) {
            console.error('Failed to refresh notification count:', error);
        }
    }

    private async loadSettings(): Promise<void> {
        await this.settingsPage.load();

        if(this.activeRoute === 'settings') {
            this.render();
        }
    }

    private startNotificationPolling(): void {
        void this.refreshUnreadNotificationCount();

        if(this.notificationPollingInterval !==null) {
            clearInterval(this.notificationPollingInterval);
        } 

        this.notificationPollingInterval = setInterval(() => {
            if(!this.disposed) {
                void this.refreshUnreadNotificationCount();
            }
        }, 30_000);
    }

    // Return to the Groups page and refresh the group list after leaving or deleting a group.
    private async handleGroupBack(): Promise<void> {
        this.selectedGroup = null;

        await this.groupsPage.reload();

        this.render();
    }

    // Refresh the Groups page after a group is edited or its membership changes.
    private async handleGroupChange(): Promise<void> {
        await this.groupsPage.reload();
        this.render();
    }
    
    // Route user for each tab
    private renderRoute(): string {
        switch (this.activeRoute) {
            case 'dashboard':
                return this.dashboardPage.render();

            case 'groups':
                if(
                    this.selectedGroup) {
                    return this.renderGroupDetails();
                }

                return this.renderGroups();

            case 'friends':
                return this.friendsPage.render();

            case 'notifications':
                return this.notificationsPage.render();

            case 'settings':
                return this.settingsPage.render(this.user.username, this.user.email, this.user.friend_code);
        }
    }

    // Render Pages
    private renderGroupDetails(): string {
        return this.groupDetailsPage.render();
    }

    private renderGroups(): string {
        return this.groupsPage.render();
    }

    private attachEvents(): void {
        const navigationItems = this.root.querySelectorAll<HTMLButtonElement>('[data-route]');
        navigationItems.forEach((button) => {
            button.addEventListener('click', async () => {
                const route = button.dataset.route as AppRoute;
                this.activeRoute = route;

                if(route === 'groups') {
                    this.selectedGroup = null;
                    this.groupsPage.reset();
                    this.render();
                    await this.loadGroups();
                    return;
                }

                if(route === 'friends') {
                    this.friendsPage.reset();
                    // render() detects the reset state and starts loading friends.
                    this.render();
                    return;
                }

                if(route === 'notifications') {
                    this.notificationsPage.reset();
                    // render() detects the reset state and starts loading notifications.
                    this.render();
                    return;
                }

                if(route === 'settings' && !this.settingsPage.isLoaded()) {
                    void this.loadSettings();
                }

                this.render();
            });
        });

        if(this.activeRoute === 'dashboard') {
            this.dashboardPage.attachEvents();
        }

        if(this.activeRoute === 'groups' && !this.selectedGroup) {
            this.groupsPage.attachEvents();
        }

        if(this.activeRoute === 'groups' && this.selectedGroup) {
            this.groupDetailsPage.attachEvents();
        }

        if(this.activeRoute === 'friends') {
            this.friendsPage.attachEvents();
        }

        if(this.activeRoute === 'notifications') {
            this.notificationsPage.attachEvents();
        }

        if(this.activeRoute === 'settings') {
            this.settingsPage.attachEvents();
        }
        
        const logoutButton = this.root.querySelector<HTMLButtonElement>('#logout-button');
        logoutButton?.addEventListener('click', async () => {
            logoutButton.disabled = true;

            try {
              await logout();
              this.onLogout();
            } 
            catch (error) {
                console.error('Logout failed:', error);

                logoutButton.disabled = false;
            }
        });
    }
}

/*
function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
*/
