import {
    addFriendsToGroup,
    updateGroup,
    deleteGroup,
    getGroup,
    getGroupMembers,
    leaveGroup,
    removeGroupMember,
    updateGroupMemberSharePercentage,
    updateGroupBalanceVisibility,
    getGroupBalances,
    getGroupSettlements,
    createGroupSettlement,
    deleteGroupSettlement,
    getGroupSettlementSuggestions,
    changeGroupStatus,
    type Group,
    type GroupMember,
    type GroupBalance,
    type Settlement,
} from '../../../api/groups';
import { 
    createExpense, 
    getGroupExpenses, 
    updateExpense,
    deleteExpense,
    type Expense, 
} from '../../../api/expenses';
import { getFriends, type Friendship, } from '../../../api/friends.ts';
import { Modal } from './components/Modal.ts';
import { ExpenseCard } from './components/ExpenseCard';
import { ExpenseForm } from './components/ExpenseForm';
import { GroupMembers } from './components/GroupMembers';
import { GroupFriends } from './components/GroupFriends';
import { GroupHeader } from './components/GroupHeader';
import { GroupSettings } from './components/GroupSettings.ts';
import { GroupBalances } from './components/GroupBalances.ts';
import { GroupSettlements } from './components/GroupSettlements.ts';
import { SettleUpForm } from './components/SettleUpForm.ts';

export class GroupDetails {
    private readonly root: HTMLDivElement;
    private readonly userId: string;
    private readonly modal: Modal;
    private readonly onBack: () => void;
    private readonly onChange: () => void;

    private activeModal: 'expense' | 'edit-expense' | 'friends' | 'settlement' | null = null;
    private collapsedSections = new Set<string>(['members', 'settlement-history', 'expenses']);

    private expandedExpenseId: string | null = null;
    private editingExpenseId: string | null = null;
    private deletingExpenseId: string | null = null;

    private selectedGroup: Group | null = null;
    private selectedGroupMembers: GroupMember[] = [];
    private friends: Friendship[] = [];

    private balances: GroupBalance[] = [];
    private groupBalancesError = '';
    private groupBalancesLoading = false;
    private groupBalances = new GroupBalances();

    private settlements: Settlement[] = [];
    private groupSettlements = new GroupSettlements();
    private settlementSuggestions: {
        fromUserId: string;
        toUserId: string;
        amountCents: number;
    }[] = [];
    private creatingSettlement = false;
    private settlementError = '';
    private settleUpForm = new SettleUpForm();

    private groupMembersMessage = '';
    private groupMembersError = '';
    private selectedFriendIds = new Set<string>();
    private addingFriendsToGroup = false;
    private groupMembers = new GroupMembers();
    private groupFriends = new GroupFriends();
    private groupHeader = new GroupHeader();

    private groupSettings = new GroupSettings();
    private groupSettingsOpen = false;
    private savingGroupSettings = false;
    private groupSettingsError = '';

    private expenses: Expense[] = [];
    private expenseMessage = '';
    private expenseError = '';
    private expenseDeleteError = '';
    private creatingExpense = false;
    private expenseCard = new ExpenseCard([]);
    private expenseForm = new ExpenseForm([]);

    private deletingGroup = false;
    private leavingGroup = false;
    private removingMemberId: string | null = null;
    private updatingMemberSharePercentageId: string | null = null;

    constructor(root: HTMLDivElement, userId: string, onBack: () => void, onChange: () => void) {
        this.root = root;
        this.userId = userId;
        this.modal = new Modal(this.root);
        this.onBack = onBack;
        this.onChange = onChange;
    }

    render(): string {
        if(!this.selectedGroup) {
            return `
                <section class="page">
                    <h2>Loading group...</h2>
                    <div class="card">
                        <p>Loading group details...</p>
                    </div>
                </section>
            `;
        }

        const isOwner = this.selectedGroup.created_by === this.userId;
        const isCompleted = this.selectedGroup.status === 'completed';

        const existingMemberIds = new Set(
            this.selectedGroupMembers.map((member) => member.user_id),
        );

        const availableFriends = this.friends.filter(
            (friendship) => !existingMemberIds.has(friendship.user.id),
        );

        const today = new Date().toISOString().slice(0, 10);

        return `
            <button type="button" class="action-button" id="back-to-groups">← Back to Groups</button>
            <section class="page">

                ${this.groupHeader.render(
                    this.selectedGroup,
                    isOwner,
                    this.deletingGroup,
                    this.leavingGroup,
                )}

                ${this.groupMembersMessage
                    ? `<p class="form-success">${escapeHtml(this.groupMembersMessage)}</p>`
                    : ''
                }

                ${this.groupMembersError
                    ? `<p class="form-error">${escapeHtml(this.groupMembersError)}</p>`
                    : ''
                }

                <div class="card">
                    <div class="section-header">
                        <button type="button" data-section-toggle="members">
                            ${this.collapsedSections.has('members') ? '▲' : '▼'} 
                            <h3>Members</h3>
                        </button>

                        ${isOwner && !isCompleted
                            ? `
                                <button type="button" class="action-button" data-open-add-friends>
                                    + Add Friends
                                </button>
                            `
                            : ''
                        }
                    </div>

                    ${this.collapsedSections.has('members')
                        ? ''
                        : this.groupMembers.render(
                            this.selectedGroupMembers,
                            isOwner,
                            this.userId,
                            this.removingMemberId,
                            this.updatingMemberSharePercentageId,
                            isCompleted,
                        )
                    }
                </div>

                <div class="card">
                    <div class="section-header">
                        <button type="button" data-section-toggle="expenses">
                            ${this.collapsedSections.has('expenses') ? '▲' : '▼'}
                            <h3>Expenses</h3>
                        </button>

                        ${!isCompleted
                            ? `
                                <button type="button" class="action-button" data-open-add-expense>
                                    + Add Expense
                                </button>
                            `
                            : ''
                        }
                        
                    </div>

                    ${this.collapsedSections.has('expenses')
                        ? ''
                        : this.expenses.length === 0
                            ? '<p>No expenses yet.</p>'
                            : this.expenses.map((expense) => this.expenseCard.render(
                                expense,
                                this.expandedExpenseId === expense.id,
                                this.canManageExpense(expense),
                                this.editingExpenseId === expense.id,
                                this.deletingExpenseId === expense.id,
                                this.expenseDeleteError,
                            )).join('')}
                </div>

                <div class="card">
                    <div class="section-header">
                        <button type="button" data-section-toggle="balances">
                            ${this.collapsedSections.has('balances') ? '▲' : '▼'}
                            <h3>Balances</h3>
                        </button>

                        ${!isCompleted
                            ? `
                                <button type="button" class="action-button" data-open-settle-up>
                                    Settle Up
                                </button>
                            `
                            :''
                        }
                        
                    </div>

                    ${this.collapsedSections.has('balances')
                        ? ''
                        : this.groupBalancesError
                            ? `<p class="form-error">${escapeHtml(this.groupBalancesError)}</p>`
                            : this.groupBalancesLoading
                                ? '<p>Loading balances...</p>'
                                : this.balances.length === 0
                                    ? '<p>No balances to display.</p>'
                                    : this.groupBalances.render(this.balances)
                    }
                </div>

                <div class="card">
                    <div class="section-header">
                        <button type="button" data-section-toggle="settlement-history">
                            ${this.collapsedSections.has('settlement-history') ? '▲' : '▼'}
                            <h3>Settlement History</h3>
                        </button>
                    </div>

                    ${this.collapsedSections.has('settlement-history')
                        ? ''
                        : this.groupSettlements.render(
                            this.settlements,
                            this.selectedGroupMembers,
                            this.userId,
                    )}
                </div>

                ${this.activeModal === 'expense'
                    ? this.modal.render({
                        title: 'Add Expense',
                        content: this.expenseForm.render(
                            this.selectedGroupMembers,
                            today,
                            this.creatingExpense,
                            this.expenseMessage,
                            this.expenseError,
                        ),
                    })
                    : ''
                }

                ${this.activeModal === 'edit-expense' && this.editingExpenseId
                    ? (() => {
                        const expense = this.expenses.find(
                            (item) => item.id === this.editingExpenseId,
                        );

                        return expense
                            ? this.modal.render({
                                title: 'Edit Expense',
                                content: `
                                    ${this.expenseError
                                        ? `<p class="form-error">${escapeHtml(this.expenseError)}</p>`
                                        : ''
                                    }
                                    ${this.expenseCard.renderEditForm(expense)}
                                `,
                            })
                            : '';
                    })()
                    : ''
                }

                ${this.activeModal === 'friends'
                    ? this.modal.render({
                        title: 'Add Friends',
                        content: this.groupFriends.render(
                            availableFriends,
                            this.selectedFriendIds,
                            this.addingFriendsToGroup,
                            isOwner,
                        ),
                    })
                    : ''
                }

                ${this.activeModal === 'settlement'
                ? this.modal.render({
                    title: 'Settle Up',
                    content: this.settleUpForm.render(
                        this.selectedGroupMembers,
                        this.settlementSuggestions,
                        this.creatingSettlement,
                        this.settlementError,
                    ),
                })
                : ''
            }

                ${this.groupSettingsOpen && isOwner
                    ? this.groupSettings.render(
                        this.selectedGroup,
                        this.savingGroupSettings,
                        this.groupSettingsError,
                    )
                    : ''
                }
            </section>
        `;
    }

    private canManageExpense(expense: Expense): boolean {
        if(!this.selectedGroup || this.selectedGroup.status === 'completed') {
            return false;
        }

        if(this.selectedGroup.created_by === this.userId) {
            return true;
        }

        if(expense.created_by_uid === this.userId) {
            return true;
        }

        if(expense.paid_by_uid === this.userId) {
            return true;
        }

        return false;
    }

    async load(groupId: string): Promise<void> {
        try {
            const [group, members, friends, expenses, balances, settlements, settlementSuggestions] = await Promise.all([
                getGroup(groupId),
                getGroupMembers(groupId),
                getFriends(),
                getGroupExpenses(groupId),
                getGroupBalances(groupId),
                getGroupSettlements(groupId),
                getGroupSettlementSuggestions(groupId),
            ]);

            this.deletingGroup = false;
            this.leavingGroup = false;
            this.selectedGroup = group;
            this.selectedGroupMembers = members;
            this.expenseCard = new ExpenseCard(members);
            this.expenseForm = new ExpenseForm(members);

            this.friends = friends;

            this.selectedFriendIds.clear();
            this.groupMembersMessage = '';
            this.groupMembersError = '';

            this.expenses = expenses;
            this.expenseMessage = '';
            this.expenseError = '';

            this.balances = balances;
            this.settlements = settlements;
            this.settlementSuggestions = settlementSuggestions;
            this.groupBalancesError = '';
            this.groupBalancesLoading = false;
        }
        catch (error) {
            console.error(
                'Failed to load group details:',
                error,
            );

            this.groupBalancesError = error instanceof Error
                ? error.message
                : 'Failed to load group balances.';
            this.groupBalancesLoading = false;
        }
    }

    getGroup(): Group | null {
        return this.selectedGroup;
    }

    private async refreshGroupBalances(): Promise<void> {
        if(!this.selectedGroup) {
            return;
        }

        this.groupBalancesLoading = true;
        this.groupBalancesError = '';

        this.onChange();

        try {
            // when a settlement or balance is recorded/deleted, both need to be updated together
            const [balances, settlements, settlementSuggestions] = await Promise.all([
                getGroupBalances(this.selectedGroup.id),
                getGroupSettlements(this.selectedGroup.id),
                getGroupSettlementSuggestions(this.selectedGroup.id),
            ]);

            this.balances = balances;
            this.settlements = settlements;
            this.settlementSuggestions = settlementSuggestions;
        }
        catch (error) {
            console.error(
                'Failed to load group balances:',
                error,
            );

            this.groupBalancesError = error instanceof Error
                ? error.message
                : 'Failed to load group balances.';
        }
        finally {
            this.groupBalancesLoading = false;
            this.onChange();
        }
    }

    // Handlers
    attachEvents(): void {
        // Handle returning to the Groups page
        const backToGroupsButton = this.root.querySelector<HTMLButtonElement>('#back-to-groups');
        backToGroupsButton?.addEventListener('click', () => {
            this.selectedGroup = null;
            this.selectedGroupMembers = [];
            this.expenses = [];
            this.balances = [];
            this.groupBalancesError = '';
            this.onBack();
        });

        const addExpenseButton = this.root.querySelector<HTMLButtonElement>('[data-open-add-expense]');
        addExpenseButton?.addEventListener('click', () => {
            this.activeModal = 'expense';
            this.expenseMessage = '';
            this.expenseError = '';
            this.onChange();
        });

        const addFriendsButton = this.root.querySelector<HTMLButtonElement>('[data-open-add-friends]');
        addFriendsButton?.addEventListener('click', () => {
            this.activeModal = 'friends';
            this.groupMembersMessage = '';
            this.groupMembersError = '';
            this.onChange();
        });

        const settleUpButton = this.root.querySelector<HTMLButtonElement>('[data-open-settle-up]');
        settleUpButton?.addEventListener('click', () => {
            this.activeModal = 'settlement';
            this.settlementError = '';
            this.onChange();
        });

        // Handle expanding and collapsing group sections
        const sectionToggles = this.root.querySelectorAll<HTMLButtonElement>('[data-section-toggle]');
        sectionToggles.forEach((button) => {
            button.addEventListener('click', () => {
                const section = button.dataset.sectionToggle;

                if(!section) {
                    return;
                }

                if(this.collapsedSections.has(section)) {
                    this.collapsedSections.delete(section);
                }
                else {
                    this.collapsedSections.add(section);
                }

                this.onChange();
            });
        });

        // Handle expanding and collapsing an expense
        const expenseHeaders = this.root.querySelectorAll<HTMLButtonElement>('[data-expense-id]');
        expenseHeaders.forEach((header) => {
            header.addEventListener('click', () => {
                const expenseId = header.dataset.expenseId;

                if(!expenseId) {
                    return;
                }

                this.expandedExpenseId = this.expandedExpenseId === expenseId
                    ? null
                    : expenseId;

                this.editingExpenseId = null;
                this.deletingExpenseId = null;
                this.expenseError = '';

                this.onChange();
            });
        });

        // Handle opening an expense for editing
        const editExpenseButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-edit-expense-id]');
        editExpenseButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const expenseId = button.dataset.editExpenseId;

                if(!expenseId) {
                    return;
                }

                this.editingExpenseId = expenseId;
                this.deletingExpenseId = null;
                this.expenseError = '';
                this.expenseMessage = '';
                this.activeModal = 'edit-expense';

                this.onChange();
            });
        });

        // Handle canceling an expense edit
        const cancelEditButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-cancel-edit-expense-id]');
        cancelEditButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.editingExpenseId = null;
                this.expenseError = '';
                this.activeModal = null;

                this.onChange();
            });
        });

        // Handle opening the expense deletion confirmation
        const deleteExpenseButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-delete-expense-id]');
        deleteExpenseButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const expenseId = button.dataset.deleteExpenseId;

                if(!expenseId) {
                    return;
                }

                this.deletingExpenseId = expenseId;
                this.expenseDeleteError = '';
                this.onChange();
            });
        });

        // Handle canceling the expense deletion confirmation
        const cancelDeleteButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-cancel-delete-expense-id]');
        cancelDeleteButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.deletingExpenseId = null;
                this.expenseDeleteError = '';
                this.onChange();
            });
        });

        // Handle confirming permanent deletion of an expense
        const confirmDeleteButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-confirm-delete-expense-id]');
        confirmDeleteButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const expenseId = button.dataset.confirmDeleteExpenseId;

                if(!expenseId) {
                    return;
                }

                await this.handleDeleteExpense(expenseId);
            });
        });

        // Handle submitting changes to an existing expense
        const editExpenseForms = this.root.querySelectorAll<HTMLFormElement>('[data-edit-expense-form]');
        editExpenseForms.forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();

                const expenseId = form.dataset.editExpenseForm;

                if(!expenseId) {
                    return;
                }

                await this.handleUpdateExpense(
                    expenseId,
                    form,
                );
            });
        });

        // Handle creating a new expense
        const addExpenseForm = this.root.querySelector<HTMLFormElement>('#add-expense-form');
        addExpenseForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            if(!this.selectedGroup) {
                return;
            }

            const formData = new FormData(addExpenseForm);

            const title = String(formData.get('title') ?? '').trim();
            const description = String(formData.get('description') ?? '').trim();
            const amount = Number(formData.get('amount'));
            const excludedAmount = Number(formData.get('excluded_amount') ?? 0);
            const tax = Number(formData.get('tax') ?? 0);
            const taxRate = formData.get('tax_rate');
            const paidByUid = String(formData.get('paid_by_uid') ?? '');
            const occurredAt = String(formData.get('occurred_at') ?? '');
            const exclusions = this.expenseForm.getExclusions(addExpenseForm);

            if(!title) {
                this.expenseError = 'Expense title is required.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            if(!Number.isFinite(amount) || amount <= 0) {
                this.expenseError = 'Enter a valid expense amount.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            if(!paidByUid) {
                this.expenseError = 'Select who paid for the expense.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            const payer = this.selectedGroupMembers.find(
                (member) => member.user_id === paidByUid,
            );

            if(!payer) {
                this.expenseError = 'Selected payer is not a member of this group.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            const amountCents = Math.round(amount * 100);
            const excludedAmountCents = Math.round(excludedAmount * 100);
            const taxCents = Math.round(tax * 100);

            const taxRateBasisPoints = taxRate === ''
                ? undefined
                : Math.round(Number(taxRate) * 100);

            if(
                !Number.isFinite(excludedAmountCents) || excludedAmountCents < 0 || excludedAmountCents > amountCents) {
                this.expenseError = 'Excluded amount cannot be greater than the expense amount.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            if(excludedAmountCents === 0 && exclusions.length > 0) {
                this.expenseError = 'Remove excluded expense assignments when the excluded amount is zero.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            if(excludedAmountCents > 0) {
                if(exclusions.length === 0) {
                    this.expenseError = 'Select at least one member to assign the excluded amount to.';
                    this.expenseMessage = '';
                    this.onChange();

                    return;
                }

                const totalExclusionCents = exclusions.reduce(
                    (total, exclusion) => total + exclusion.amount_cents,
                    0,
                );

                if(totalExclusionCents !== excludedAmountCents) {
                    this.expenseError = 'Excluded expense assignments must equal the excluded amount.';
                    this.expenseMessage = '';
                    this.onChange();

                    return;
                }
            }

            if(!Number.isFinite(taxCents) || taxCents < 0 || taxCents > amountCents) {
                this.expenseError = 'Tax amount cannot be greater than the expense amount.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            if(taxRateBasisPoints !== undefined && (!Number.isFinite(taxRateBasisPoints) || taxRateBasisPoints < 0)
            ) {
                this.expenseError = 'Enter a valid tax rate.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            if(!occurredAt) {
                this.expenseError = 'Select an expense date.';
                this.expenseMessage = '';
                this.onChange();

                return;
            }

            this.creatingExpense = true;
            this.expenseError = '';

            this.onChange();

            try {
                const expense = await createExpense({
                    group_id: this.selectedGroup.id,
                    title,
                    description: description || undefined,
                    amount_cents: amountCents,
                    excluded_amount_cents: excludedAmountCents,
                    exclusions,
                    tax_cents: taxCents,
                    tax_rate_basis_points: taxRateBasisPoints,
                    paid_by: payer.username,
                    paid_by_uid: payer.user_id,
                    occurred_at: occurredAt,
                });

                this.expenses = [
                    expense,
                    ...this.expenses,
                ];

                // Update balance after expense creation
                await this.refreshGroupBalances();

                this.expenseMessage = 'Expense added successfully.';
                this.expenseError = '';
                this.activeModal = null;
            }
            catch (error) {
                console.error(
                    'Failed to create expense:',
                    error,
                );

                this.expenseError = error instanceof Error
                    ? error.message
                    : 'Failed to add the expense.';
                this.expenseMessage = '';
            }
            finally {
                this.creatingExpense = false;
                this.onChange();
            }
        });

        const addExpenseFormWithExclusions = this.root.querySelector<HTMLFormElement>('#add-expense-form');
        if(addExpenseFormWithExclusions) {
            this.expenseForm.setupInputs(addExpenseFormWithExclusions);
        }

        const editExpenseFormsWithExclusions = this.root.querySelectorAll<HTMLFormElement>('[data-edit-expense-form]');
        editExpenseFormsWithExclusions.forEach((form) => {
            this.expenseCard.setupExclusionInputs(form);
        });

        // Handle recording a settlement
        const settleUpForm = this.root.querySelector<HTMLFormElement>('#settle-up-form');
        settleUpForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            if(!this.selectedGroup) {
                return;
            }

            const formData = new FormData(settleUpForm);
            const fromUserId = String(formData.get('from_user_id') ?? '');
            const toUserId = String(formData.get('to_user_id') ?? '');
            const amount = Number(formData.get('amount'));

            if(!fromUserId || !toUserId) {
                this.settlementError = 'Select who paid and who received the payment.';
                this.onChange();
                return;
            }

            if(fromUserId === toUserId) {
                this.settlementError = 'The payer and recipient must be different members.';
                this.onChange();
                return;
            }

            if(!Number.isFinite(amount) || amount <= 0) {
                this.settlementError = 'Enter a valid settlement amount.';
                this.onChange();
                return;
            }

            const amountCents = Math.round(amount * 100);

            if(!Number.isSafeInteger(amountCents) || amountCents <= 0) {
                this.settlementError = 'Enter a valid settlement amount.';
                this.onChange();
                return;
            }

            this.creatingSettlement = true;
            this.settlementError = '';
            this.onChange();

            try {
                await createGroupSettlement(this.selectedGroup.id, fromUserId, toUserId, amountCents);

                await this.refreshGroupBalances();

                this.activeModal = null;
                this.creatingSettlement = false;
                this.settlementError = '';
                this.onChange();
            }
            catch (error) {
                console.error('Failed to record settlement:', error);

                this.settlementError = error instanceof Error
                    ? error.message
                    : 'Failed to record settlement.';
                this.creatingSettlement = false;
                this.onChange();
            }
        });

        // Handle selecting a suggested settlement
        const settlementSuggestions = this.root.querySelectorAll<HTMLButtonElement>('[data-settlement-from]');
        settlementSuggestions.forEach((button) => {button.addEventListener('click', () => {
                const fromUserId = button.dataset.settlementFrom;
                const toUserId = button.dataset.settlementTo;
                const amountCents = Number(button.dataset.settlementAmount);

                if(
                    !fromUserId ||
                    !toUserId ||
                    !Number.isSafeInteger(amountCents) ||
                    amountCents <= 0
                ) {
                    return;
                }

                const form = this.root.querySelector<HTMLFormElement>(
                    '#settle-up-form',
                );

                if(!form) {
                    return;
                }

                const fromSelect = form.elements.namedItem(
                    'from_user_id',
                ) as HTMLSelectElement | null;

                const toSelect = form.elements.namedItem(
                    'to_user_id',
                ) as HTMLSelectElement | null;

                const amountInput = form.elements.namedItem(
                    'amount',
                ) as HTMLInputElement | null;

                if(!fromSelect || !toSelect || !amountInput) {
                    return;
                }

                fromSelect.value = fromUserId;
                toSelect.value = toUserId;
                amountInput.value = (amountCents / 100).toFixed(2);
            });
        });

        // Handle opening the settlement deletion confirmation
        const deleteSettlementButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-delete-settlement-id]');
        deleteSettlementButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const settlementId = button.dataset.deleteSettlementId;

                if(!settlementId) {
                    return;
                }

                if(!confirm('Are you sure you want to delete this settlement?')) {
                    return;
                }

                await this.handleDeleteSettlement(settlementId);
            });
        });

        // Handle adding friends to the group
        const addGroupMembersForm = this.root.querySelector<HTMLFormElement>('#add-group-members-form');
        addGroupMembersForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const selectedInputs = addGroupMembersForm.querySelectorAll<HTMLInputElement>(
                'input[name="friend_id"]:checked',
            );

            const friendIds = Array.from(selectedInputs).map(
                (input) => input.value,
            );

            const errorElement = addGroupMembersForm.querySelector<HTMLParagraphElement>(
                '#add-group-members-error',
            );

            if(friendIds.length === 0) {
                if(errorElement) {
                    errorElement.textContent = 'Select at least one friend.';
                    errorElement.hidden = false;
                }

                return;
            }

            if(!this.selectedGroup) {
                return;
            }

            this.selectedFriendIds = new Set(friendIds);
            this.addingFriendsToGroup = true;
            this.groupMembersError = '';

            this.onChange();

            try {
                const addedMembers = await addFriendsToGroup(
                    this.selectedGroup.id,
                    friendIds,
                );

                this.selectedGroupMembers = [
                    ...this.selectedGroupMembers,
                    ...addedMembers,
                ];

                // Update balance after adding members
                await this.refreshGroupBalances();

                this.selectedFriendIds.clear();
                this.activeModal = null;
                this.groupMembersMessage = addedMembers.length === 1
                    ? 'Friend added to the group.'
                    : `${addedMembers.length} friends added to the group.`;
                this.groupMembersError = '';
            }
            catch (error) {
                console.error(
                    'Failed to add friends to group:',
                    error,
                );

                this.groupMembersError = error instanceof Error
                    ? error.message
                    : 'Failed to add friends to the group.';
                this.groupMembersMessage = '';
            }
            finally {
                this.addingFriendsToGroup = false;
                this.onChange();
            }
        });

        // Handle opening the group edit form.
        const editGroupButton = this.root.querySelector<HTMLButtonElement>('[data-edit-group]');
        editGroupButton?.addEventListener('click', () => {
            this.groupSettingsOpen = true;
            this.groupSettingsError = '';

            this.onChange();
        });

        // Handle submitting changes to the group name.
        const groupSettingsForm = this.root.querySelector<HTMLFormElement>('#group-settings-form');
        groupSettingsForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            await this.handleUpdateGroupSettings(groupSettingsForm);
        });

        const closeGroupSettingsButtons = this.root.querySelectorAll<HTMLElement>('[data-close-group-settings]');
        closeGroupSettingsButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.groupSettingsOpen = false;
                this.groupSettingsError = '';
                this.onChange();
            });
        });

        const groupSettingsBackdrop = this.root.querySelector<HTMLElement>('[data-group-settings-backdrop]');
        groupSettingsBackdrop?.addEventListener('click', (event) => {
            if(event.target !== groupSettingsBackdrop) {
                return;
            }

            this.groupSettingsOpen = false;
            this.groupSettingsError = '';
            this.onChange();
        });

        // Handle pausing the group.
        const pauseGroupButton = this.root.querySelector<HTMLButtonElement>('[data-pause-group]');
        pauseGroupButton?.addEventListener('click', async () => {
            await this.handleChangeGroupStatus('pause');
        });

        // Handle resuming the group.
        const resumeGroupButton = this.root.querySelector<HTMLButtonElement>('[data-resume-group]');
        resumeGroupButton?.addEventListener('click', async () => {
            await this.handleChangeGroupStatus('resume');
        });

        // Handle completing the group.
        const completeGroupButton = this.root.querySelector<HTMLButtonElement>('[data-complete-group]');
        completeGroupButton?.addEventListener('click', async () => {
            await this.handleChangeGroupStatus('complete');
        });

        // Handle opening the delete-group confirmation.
        const deleteGroupButton = this.root.querySelector<HTMLButtonElement>('[data-delete-group]');
        deleteGroupButton?.addEventListener('click', () => {
            this.deletingGroup = true;
            this.groupMembersError = '';
            this.groupMembersMessage = '';

            this.onChange();
        });

        // Handle cancelling the delete-group confirmation.
        const cancelDeleteGroupButton = this.root.querySelector<HTMLButtonElement>('[data-cancel-delete-group]');
        cancelDeleteGroupButton?.addEventListener('click', () => {
            this.deletingGroup = false;
            this.groupMembersError = '';

            this.onChange();
        });

        // Handle confirming permanent deletion of the group.
        const confirmDeleteGroupButton = this.root.querySelector<HTMLButtonElement>('[data-confirm-delete-group]');
        confirmDeleteGroupButton?.addEventListener('click', async () => {
            await this.handleDeleteGroup();
        });

        // Handle opening the leave-group confirmation.
        const leaveGroupButton = this.root.querySelector<HTMLButtonElement>('[data-leave-group]');
        leaveGroupButton?.addEventListener('click', () => {
            this.leavingGroup = true;
            this.groupMembersError = '';
            this.groupMembersMessage = '';

            this.onChange();
        });

        // Handle cancelling the leave-group confirmation.
        const cancelLeaveGroupButton = this.root.querySelector<HTMLButtonElement>('[data-cancel-leave-group]');
        cancelLeaveGroupButton?.addEventListener('click', () => {
            this.leavingGroup = false;
            this.groupMembersError = '';

            this.onChange();
        });

        // Handle confirming that the current user wants to leave the group.
        const confirmLeaveGroupButton = this.root.querySelector<HTMLButtonElement>('[data-confirm-leave-group]');
        confirmLeaveGroupButton?.addEventListener('click', async () => {
            await this.handleLeaveGroup();
        });

        // Handle opening the remove-member confirmation for a specific member.
        const removeMemberButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-remove-member-id]');
        removeMemberButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const userId = button.dataset.removeMemberId;

                if(!userId) {
                    return;
                }

                this.removingMemberId = userId;
                this.groupMembersError = '';
                this.groupMembersMessage = '';

                this.onChange();
            });
        });

        // Handle saving a member's group-level share percentage.
        const saveSharePercentageButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-save-share-percentage-member-id]');
        saveSharePercentageButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = button.dataset.saveSharePercentageMemberId;

                if(!userId) {
                    return;
                }

                const input = this.root.querySelector<HTMLInputElement>(
                    `[data-share-percentage-member-id="${CSS.escape(userId)}"]`,
                );

                if(!input) {
                    return;
                }

                const percentage = Number(input.value);

                if(!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
                    this.groupMembersError = 'Share percentage must be between 0% and 100%.';
                    this.groupMembersMessage = '';
                    this.onChange();

                    return;
                }

                if(!this.selectedGroup) {
                    return;
                }

                const sharePercentageBasisPoints = Math.round(percentage * 100);

                this.updatingMemberSharePercentageId = userId;
                this.groupMembersError = '';
                this.groupMembersMessage = '';

                this.onChange();

                try {
                    const updatedMember = await updateGroupMemberSharePercentage(this.selectedGroup.id, userId, sharePercentageBasisPoints);

                    this.selectedGroupMembers = this.selectedGroupMembers.map((member) =>
                        member.user_id === updatedMember.user_id
                            ? updatedMember
                            : member,
                    );

                    // Update balace after percentage update
                    await this.refreshGroupBalances();

                    this.groupMembersMessage = 'Share percentage updated successfully.';
                    this.groupMembersError = '';
                }
                catch (error) {
                    console.error('Failed to update member share percentage:', error);

                    this.groupMembersError = error instanceof Error
                        ? error.message
                        : 'Failed to update the share percentage.';
                    this.groupMembersMessage = '';
                }
                finally {
                    this.updatingMemberSharePercentageId = null;
                    this.onChange();
                }
            });
        });

        // Handle cancelling the remove-member confirmation.
        const cancelRemoveMemberButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-cancel-remove-member-id]');
        cancelRemoveMemberButtons.forEach((button) => {
            button.addEventListener('click', () => {
                this.removingMemberId = null;
                this.groupMembersError = '';

                this.onChange();
            });
        });

        // Handle confirming removal of a specific group member.
        const confirmRemoveMemberButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-confirm-remove-member-id]');
        confirmRemoveMemberButtons.forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = button.dataset.confirmRemoveMemberId;

                if(!userId) {
                    return;
                }

                await this.handleRemoveMember(userId);
            });
        });

        if(this.activeModal) {
            this.modal.attachEvents(() => {
                this.activeModal = null;
                this.onChange();
            });
        }
    }

    private async handleUpdateExpense(expenseId: string, form: HTMLFormElement): Promise<void> {
        const expense = this.expenses.find(
            (item) => item.id === expenseId,
        );

        if(!expense) {
            return;
        }

        const formData = new FormData(form);

        const title = String(formData.get('title') ?? '').trim();
        const description = String(formData.get('description') ?? '').trim();
        const amount = Number(formData.get('amount'));
        const excludedAmount = Number(formData.get('excluded_amount') ?? 0);
        const tax = Number(formData.get('tax') ?? 0);
        const taxRate = formData.get('tax_rate');
        const paidByUid = String(formData.get('paid_by_uid') ?? '');
        const occurredAt = String(formData.get('occurred_at') ?? '');
        const exclusions = this.expenseCard.getExclusions(form);

        if(!title) {
            this.expenseError = 'Expense title is required.';
            this.onChange();

            return;
        }

        if(!Number.isFinite(amount) || amount <= 0) {
            this.expenseError = 'Enter a valid expense amount.';
            this.onChange();

            return;
        }

        if(!paidByUid) {
            this.expenseError = 'Select who paid for the expense.';
            this.onChange();

            return;
        }

        const payer = this.selectedGroupMembers.find(
            (member) => member.user_id === paidByUid,
        );

        if(!payer) {
            this.expenseError = 'Selected payer is not a member of this group.';
            this.onChange();

            return;
        }

        const amountCents = Math.round(amount * 100);
        const excludedAmountCents = Math.round(excludedAmount * 100);
        const taxCents = Math.round(tax * 100);

        const taxRateBasisPoints = taxRate === ''
            ? undefined
            : Math.round(Number(taxRate) * 100);

        if(!Number.isFinite(excludedAmountCents) || excludedAmountCents < 0 || excludedAmountCents > amountCents) {
            this.expenseError = 'Excluded amount cannot be greater than the expense amount.';
            this.onChange();

            return;
        }

        if(excludedAmountCents === 0 && exclusions.length > 0) {
            this.expenseError = 'Remove excluded expense assignments when the excluded amount is zero.';
            this.onChange();

            return;
        }

        if(excludedAmountCents > 0) {
            if(exclusions.length === 0) {
                this.expenseError = 'Select at least one member to assign the excluded amount to.';
                this.onChange();

                return;
            }

            const totalExclusionCents = exclusions.reduce(
                (total, exclusion) => total + exclusion.amount_cents,
                0,
            );

            if(totalExclusionCents !== excludedAmountCents) {
                this.expenseError = 'Excluded expense assignments must equal the excluded amount.';
                this.onChange();

                return;
            }
        }

        if(!Number.isFinite(taxCents) || taxCents < 0 || taxCents > amountCents) {
            this.expenseError = 'Tax amount cannot be greater than the expense amount.';
            this.onChange();

            return;
        }

        if(taxRateBasisPoints !== undefined && (!Number.isFinite(taxRateBasisPoints) || taxRateBasisPoints < 0)) {
            this.expenseError = 'Enter a valid tax rate.';
            this.onChange();

            return;
        }

        if(!occurredAt) {
            this.expenseError = 'Select an expense date.';
            this.onChange();

            return;
        }

        this.expenseError = '';

        try {
            const updatedExpense = await updateExpense(
                expenseId,
                {
                    group_id: expense.group_id,
                    title,
                    description: description || undefined,
                    amount_cents: amountCents,
                    excluded_amount_cents: excludedAmountCents,
                    exclusions,
                    tax_cents: taxCents,
                    tax_rate_basis_points: taxRateBasisPoints,
                    paid_by: payer.username,
                    paid_by_uid: payer.user_id,
                    occurred_at: occurredAt,
                },
            );

            this.expenses = this.expenses.map((item) =>
                item.id === updatedExpense.id
                    ? updatedExpense
                    : item,
            );

            // Update balance after expense update
            await this.refreshGroupBalances();

            this.editingExpenseId = null;
            this.expenseError = '';
            this.expenseMessage = 'Expense updated successfully.';
            this.activeModal = null;
        }
        catch (error) {
            console.error(
                'Failed to update expense:',
                error,
            );

            this.expenseError = error instanceof Error
                ? error.message
                : 'Failed to update the expense.';
        }

        this.onChange();
    }

    private async handleChangeGroupStatus(action: 'pause' | 'resume' | 'complete'): Promise<void> {
        if (!this.selectedGroup) {
            return;
        }

        const groupId = this.selectedGroup.id;
        this.groupMembersError = '';

        try {
            const updatedGroup = await changeGroupStatus(groupId, action);
            this.selectedGroup = updatedGroup;

            await this.refreshGroupBalances();
        } 
        catch (error) {
            console.error(
                `Failed to ${action} group:`,
                error,
            );

            this.groupMembersError = error instanceof Error
                ? error.message
                : `Failed to ${action} group.`;
        } 
        finally {
            this.onChange();
        }
    }

    private async handleDeleteExpense(expenseId: string): Promise<void> {
        this.expenseDeleteError = '';

        try {
            await deleteExpense(expenseId);
            this.expenseDeleteError = '';
            this.expenses = this.expenses.filter(
                (expense) => expense.id !== expenseId,
            );

            // Update balance after expense deletion 
            await this.refreshGroupBalances();

            this.expandedExpenseId = null;
            this.editingExpenseId = null;
            this.deletingExpenseId = null;
            this.expenseMessage = 'Expense deleted successfully.';
        }
        catch (error) {
            console.error(
                'Failed to delete expense:',
                error,
            );

            this.expenseDeleteError = error instanceof Error
                ? error.message
                : 'Failed to delete the expense.';
        }

        this.onChange();
    }

    // Update the group's settings.
    private async handleUpdateGroupSettings(form: HTMLFormElement): Promise<void> {
        if(!this.selectedGroup) {
            return;
        }

        const formData = new FormData(form);
        const name = String(formData.get('name') ?? '').trim();
        const balanceVisibility = String(
            formData.get('balanceVisibility') ?? '',
        );

        if(!name) {
            this.groupSettingsError = 'Group name is required.';
            this.onChange();
            return;
        }

        if(balanceVisibility !== 'private' && balanceVisibility !== 'group') {
            this.groupSettingsError = 'Invalid balance visibility.'
            this.onChange();
            return;
        }

        this.savingGroupSettings = true;
        this.groupSettingsError = '';

        this.onChange();

        try {
            const updatedGroup = await updateGroup(this.selectedGroup.id, name)

            const updatedGroupWithVisibility = 
                updatedGroup.balance_visibility === balanceVisibility
                    ? updatedGroup
                    : await updateGroupBalanceVisibility(this.selectedGroup.id, balanceVisibility
                );

            this.selectedGroup = updatedGroupWithVisibility;
            this.groupSettingsOpen = false;
            this.groupSettingsError = '';

            await this.refreshGroupBalances();
        }
        catch (error) {
            console.error(
                'Failed to update group settings:',
                error,
            );

            this.groupSettingsError = error instanceof Error
                ? error.message
                : 'Failed to update group settings.';
        }
        finally {
            this.savingGroupSettings = false;
            this.onChange();
        }
    }

    // Permanently delete the group and its associated expenses.
    private async handleDeleteGroup(): Promise<void> {
        if(!this.selectedGroup) {
            return;
        }

        try {
            await deleteGroup(this.selectedGroup.id);

            this.onBack();
        }
        catch (error) {
            console.error(
                'Failed to delete group:',
                error,
            );

            this.groupMembersError = error instanceof Error
                ? error.message
                : 'Failed to delete the group.';

            this.deletingGroup = false;
            this.onChange();
        }
    }

    // Remove a member from the group without deleting their account or expenses.
    private async handleRemoveMember(userId: string): Promise<void> {
        if(!this.selectedGroup) {
            return;
        }

        this.removingMemberId = userId;
        this.groupMembersError = '';
        this.groupMembersMessage = '';

        this.onChange();

        try {
            await removeGroupMember(
                this.selectedGroup.id,
                userId,
            );

            // Refresh the member list so the removed member disappears
            // while preserving the group's existing expenses and history.
            this.selectedGroupMembers = await getGroupMembers(
                this.selectedGroup.id,
            );

            // Update balance after removing a member
            await this.refreshGroupBalances();

            this.groupMembersMessage = 'Member removed successfully.';
        }
        catch (error) {
            console.error(
                'Failed to remove group member:',
                error,
            );

            this.groupMembersError = error instanceof Error
                ? error.message
                : 'Failed to remove the group member.';
            this.groupMembersMessage = '';
        }
        finally {
            this.removingMemberId = null;
            this.onChange();
        }
    }

    // Leave the group without deleting the user's account or expenses.
    private async handleLeaveGroup(): Promise<void> {
            if(!this.selectedGroup) {
                return;
            }

            try {
                await leaveGroup(this.selectedGroup.id);

                this.onBack();
            }
            catch (error) {
                console.error(
                    'Failed to leave group:',
                    error,
                );

                this.groupMembersError = error instanceof Error
                    ? error.message
                    : 'Failed to leave the group.';

                this.leavingGroup = false;
                this.onChange();
            }
    }

    // Delete a settlement
    private async handleDeleteSettlement(settlementId: string): Promise<void> {
        this.settlementError = '';

        if(!this.selectedGroup) {
            return;
        }

        try {
            await deleteGroupSettlement(
                this.selectedGroup.id,
                settlementId,
            );

            this.settlements = this.settlements.filter(
                (settlement) => settlement.id !== settlementId,
            );

            // Update balance after settlement deletion
            await this.refreshGroupBalances();

            this.settlementError = '';
        }
        catch (error) {
            console.error(
                'Failed to delete settlement:',
                error,
            );

            this.settlementError = error instanceof Error
                ? error.message
                : 'Failed to delete the settlement.';
        }

        this.onChange();
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
