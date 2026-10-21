
import {
    getGroups,
    getGroupBalances,
    type Group,
    type GroupBalance,
} from '../../../api/groups';

interface DashboardGroup {
    group: Group;
    balance: GroupBalance | null;
    failed: boolean;
}

export class Dashboard {
    private readonly root: HTMLDivElement;
    private readonly userId: string;
    private readonly onChange: () => void;
    private readonly onGroupSelected: (groupId: string) => void;
    private readonly onNavigate: (route: 'groups' | 'friends') => void;

    private groups: DashboardGroup[] = [];
    private loaded = false;
    private loading = false;
    private errorMessage = '';

    constructor(root: HTMLDivElement, userId: string, onChange: () => void, onGroupSelected: (groupId: string) => void, onNavigate: (route: 'groups' | 'friends') => void) {
        this.root = root;
        this.userId = userId;
        this.onChange = onChange;
        this.onGroupSelected = onGroupSelected;
        this.onNavigate = onNavigate;
    }

    reset(): void {
        this.groups = [];
        this.loaded = false;
        this.loading = false;
        this.errorMessage = '';
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    isLoading(): boolean {
        return this.loading;
    }

    hasError(): boolean {
        return this.errorMessage !== '';
    }

    async load(): Promise<void> {
        if(this.loading || this.loaded) {
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        try {
            const groups = await getGroups();

            const results = await Promise.all(
                groups.map(async (group): Promise<DashboardGroup> => {
                    try {
                        const balances = await getGroupBalances(group.id);

                        return {
                            group,
                            balance: balances.find(
                                (balance) => balance.userId === this.userId,
                            ) ?? null,
                            failed: false,
                        };
                    } 
                    catch (error) {
                        console.error(
                            `Failed to load balance for group ${group.id}:`,
                            error,
                        );

                        return {group, balance: null, failed: true};
                    }
                }),
            );

            this.groups = results;
            this.loaded = true;
        } 
        catch (error) {
            console.error('Failed to load dashboard:', error);
            this.errorMessage = 'Unable to load your dashboard. Please try again.';
        } 
        finally {
            this.loading = false;
            this.onChange();
        }
    }

    render(): string {
        if(this.errorMessage) {
            return `
                <section class="page dashboard">
                    <h2>Dashboard</h2>
                    <div class="card">
                        <p>${this.escapeHtml(this.errorMessage)}</p>
                        <button type="button" data-dashboard-action="retry">
                            Try again
                        </button>
                    </div>
                </section>
            `;
        }

        if(!this.loaded) {
            return `
                <section class="page dashboard">
                    <h2>Dashboard</h2>
                    <div class="card">
                        <p>${this.errorMessage || 'Loading your financial overview...'}</p>
                        ${this.errorMessage
                            ? '<button type="button" data-dashboard-action="retry">Try again</button>'
                            : ''}
                    </div>
                </section>
            `;
        }

        const balances = this.groups
            .map((item) => item.balance)
            .filter((balance): balance is GroupBalance => balance !== null);

        const netBalance = balances.reduce(
            (total, balance) => total + balance.netBalanceCents,
            0,
        );

        const owedToYou = balances.reduce(
            (total, balance) =>
                total + Math.max(0, balance.netBalanceCents),
            0,
        );

        const youOwe = balances.reduce(
            (total, balance) =>
                total + Math.max(0, -balance.netBalanceCents),
            0,
        );

        const hasFailedGroups = this.groups.some((item) => item.failed);

        return `
            <section class="page dashboard">
                <div class="dashboard-heading">
                    <div>
                        <h2>Dashboard</h2>
                        <p>Your shared expenses at a glance.</p>
                    </div>
                </div>

                ${hasFailedGroups ? `
                    <div class="card dashboard-notice">
                        <p>
                            Some group balances couldn't be loaded.
                            Totals below include only successfully loaded balances.
                        </p>
                    </div>
                ` : ''}

                <div class="dashboard-summary">
                    <div class="card dashboard-net">
                        <p class="dashboard-label">Overall net balance</p>
                        <p class="dashboard-amount ${
                            netBalance > 0
                                ? 'balance-positive'
                                : netBalance < 0
                                    ? 'balance-negative'
                                    : 'balance-settled'
                        }">
                            ${this.formatMoney(netBalance)}
                        </p>
                        <p class="dashboard-caption">
                            Across your successfully loaded groups
                        </p>
                    </div>

                    <div class="card dashboard-stat">
                        <p class="dashboard-label">You're owed</p>
                        <p class="dashboard-amount balance-positive">
                            ${this.formatMoney(owedToYou)}
                        </p>
                    </div>

                    <div class="card dashboard-stat">
                        <p class="dashboard-label">You owe</p>
                        <p class="dashboard-amount balance-negative">
                            ${this.formatMoney(youOwe)}
                        </p>
                    </div>
                </div>

                <div class="dashboard-section-heading">
                    <h3>Your group balances</h3>
                    <button
                        type="button"
                        class="dashboard-text-button"
                        data-dashboard-route="groups"
                    >
                        View all groups
                    </button>
                </div>

                ${this.groups.length === 0
                    ? `
                        <div class="card dashboard-empty">
                            <h3>No groups yet</h3>
                            <p>Create a group to start tracking shared expenses.</p>
                            <button
                                type="button"
                                class="action-button"
                                data-dashboard-route="groups"
                            >
                                Go to groups
                            </button>
                        </div>
                    `
                    : this.groups.map((item) => `
                        <button
                            type="button"
                            class="card dashboard-group"
                            data-dashboard-group="${this.escapeHtml(item.group.id)}"
                        >
                            <span class="dashboard-group-info">
                                <strong>${this.escapeHtml(item.group.name)}</strong>
                                <span class="dashboard-caption">
                                    ${item.failed
                                        ? 'Balance unavailable'
                                        : item.balance
                                            ? item.balance.netBalanceCents > 0
                                                ? 'You are owed overall'
                                                : item.balance.netBalanceCents < 0
                                                    ? 'You owe overall'
                                                    : 'Settled up'
                                            : 'No balance returned for your account'}
                                </span>
                            </span>

                            <span class="${
                                item.balance
                                    ? item.balance.netBalanceCents > 0
                                        ? 'balance-positive'
                                        : item.balance.netBalanceCents < 0
                                            ? 'balance-negative'
                                            : 'balance-settled'
                                    : ''
                            }">
                                ${item.failed || !item.balance
                                    ? '—'
                                    : this.formatMoney(item.balance.netBalanceCents)}
                            </span>
                        </button>
                    `).join('')}

                <div class="dashboard-section-heading">
                    <h3>Quick access</h3>
                </div>

                <div class="dashboard-shortcuts">
                    <button type="button" class="card dashboard-shortcut" data-dashboard-route="groups">
                        <strong>Groups</strong>
                        <span>Manage shared expenses</span>
                    </button>

                    <button type="button" class="card dashboard-shortcut" data-dashboard-route="friends">
                        <strong>Friends</strong>
                        <span>Manage your friends</span>
                    </button>
                </div>
            </section>
        `;
    }

    attachEvents(): void {
        this.root.querySelector<HTMLButtonElement>('[data-dashboard-action="retry"]')
            ?.addEventListener('click', () => {
                void this.load();
            });

        this.root.querySelectorAll<HTMLButtonElement>('[data-dashboard-group]').forEach((button) => {
            button.addEventListener('click', () => {
                const groupId = button.dataset.dashboardGroup;

                if(groupId) {
                    this.onGroupSelected(groupId);
                }
            });
        });

        this.root.querySelectorAll<HTMLButtonElement>('[data-dashboard-route]').forEach((button) => {
            button.addEventListener('click', () => {
                const route = button.dataset.dashboardRoute;

                if(route === 'groups' || route === 'friends') {
                    this.onNavigate(route);
                }
            });
        });
    }

    private formatMoney(cents: number): string {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD',
        }).format(cents / 100);
    }

    private escapeHtml(value: string): string {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }
}
