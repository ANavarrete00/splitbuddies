import type { Expense } from '../../../../api/expenses';
import type { GroupMember } from '../../../../api/groups';

import { ExpenseExclusions } from './ExpenseExclusions';

export class ExpenseCard {
    private readonly groupMembers: GroupMember[];
    private readonly expenseExclusions: ExpenseExclusions;

    constructor(groupMembers: GroupMember[]) {
        this.groupMembers = groupMembers;
        this.expenseExclusions = new ExpenseExclusions(groupMembers);
    }

    render(expense: Expense, isExpanded: boolean, canManage: boolean, isEditing: boolean, isDeleting: boolean, deleteError: string): string {
        return `
            <div class="expense-card">
                <button type="button" class="expense-header" data-expense-id="${escapeHtml(expense.id)}">
                    <div>
                        <strong>
                            ${escapeHtml(expense.title)}
                        </strong>
                        <span>
                            Paid by ${escapeHtml(expense.paid_by)}
                        </span>
                    </div>

                    <div>
                        <strong>
                            $${(expense.amount_cents / 100).toFixed(2)}
                        </strong>
                        <span>
                            ${formatExpenseDate(expense.occurred_at)}
                        </span>
                    </div>

                    <span class="expense-expand-icon">
                        ${isExpanded ? '▲' : '▼'}
                    </span>
                </button>

                ${isExpanded
                    ? this.renderDetails(expense, canManage, isEditing, isDeleting, deleteError)
                    : ''
                }
            </div>
        `;
    }

    setupExclusionInputs(form: HTMLFormElement): void {
        this.expenseExclusions.setupInputs(form);
    }

    getExclusions(form: HTMLFormElement): {user_id: string; amount_cents: number;}[] {
        return this.expenseExclusions.getExclusions(form);
    }
    renderEditForm(expense: Expense): string {
        return `
            <form
                class="expense-details expense-edit-form"
                data-edit-expense-form="${escapeHtml(expense.id)}"
            >
                <label>
                    Title
                    <input
                        type="text"
                        name="title"
                        value="${escapeHtml(expense.title)}"
                        required
                        maxlength="200"
                    />
                </label>

                <label>
                    Description
                    <textarea
                        name="description"
                        rows="3"
                    >${escapeHtml(expense.description ?? '')}</textarea>
                </label>

                <label>
                    Amount
                    <input
                        type="number"
                        name="amount"
                        min="0.01"
                        step="0.01"
                        value="${(expense.amount_cents / 100).toFixed(2)}"
                        required
                    />
                </label>

                <label>
                    Excluded amount
                    <input
                        type="number"
                        name="excluded_amount"
                        min="0"
                        step="0.01"
                        value="${(expense.excluded_amount_cents / 100).toFixed(2)}"
                    />
                </label>

                ${this.expenseExclusions.render(expense.exclusions ?? [])}

                <label>
                    Tax amount
                    <input
                        type="number"
                        name="tax"
                        min="0"
                        step="0.01"
                        value="${(expense.tax_cents / 100).toFixed(2)}"
                    />
                </label>

                <label>
                    Tax rate (%)
                    <input
                        type="number"
                        name="tax_rate"
                        min="0"
                        step="0.01"
                        value="${
                            expense.tax_rate_basis_points === null
                                ? ''
                                : (expense.tax_rate_basis_points / 100).toFixed(2)
                        }"
                    />
                </label>

                <label>
                    Paid by
                    <select name="paid_by_uid" required>
                        <option value="">Select a member</option>
                        ${this.groupMembers.map((member) => `
                            <option
                                value="${escapeHtml(member.user_id)}"
                                ${member.user_id === expense.paid_by_uid
                                    ? 'selected'
                                    : ''
                                }
                            >
                                ${escapeHtml(member.username)}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Date
                    <input
                        type="date"
                        name="occurred_at"
                        value="${escapeHtml(expense.occurred_at)}"
                        required
                    />
                </label>

                <div class="expense-actions">
                    <button type="submit" class="action-button"
                        data-save-expense-id="${escapeHtml(expense.id)}"
                    >
                        Save changes
                    </button>

                    <button type="button"
                        data-cancel-edit-expense-id="${escapeHtml(expense.id)}"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        `;
    }

    private renderDetails(expense: Expense, canManage: boolean, isEditing: boolean, isDeleting: boolean, deleteError: string): string {
        if(isEditing) {
            return '';
        }

        return `
            <div class="expense-details">
                ${expense.description
                    ? `
                        <div class="expense-detail-row">
                            <span>Description</span>
                            <strong>${escapeHtml(expense.description)}</strong>
                        </div>
                    `
                    : ''
                }

                <div class="expense-detail-row">
                    <span>Amount</span>
                    <strong>
                        $${(expense.amount_cents / 100).toFixed(2)}
                    </strong>
                </div>

                <div class="expense-detail-row">
                    <span>Excluded amount</span>
                    <strong>
                        $${(expense.excluded_amount_cents / 100).toFixed(2)}
                    </strong>
                </div>

                <div class="expense-detail-row">
                    <span>Tax</span>
                    <strong>
                        $${(expense.tax_cents / 100).toFixed(2)}
                    </strong>
                </div>

                ${expense.tax_rate_basis_points !== null
                    ? `
                        <div class="expense-detail-row">
                            <span>Tax rate</span>
                            <strong>
                                ${(expense.tax_rate_basis_points / 100).toFixed(2)}%
                            </strong>
                        </div>
                    `
                    : ''
                }

                <div class="expense-detail-row">
                    <span>Paid by</span>
                    <strong>${escapeHtml(expense.paid_by)}</strong>
                </div>

                <div class="expense-detail-row">
                    <span>Date</span>
                    <strong>${formatExpenseDate(expense.occurred_at)}</strong>
                </div>

                <div class="expense-detail-row">
                    <span>Created by</span>
                    <strong>${escapeHtml(expense.created_by)}</strong>
                </div>

                ${canManage
                    ? `
                        <div class="expense-actions">
                            <button type="button" data-edit-expense-id="${escapeHtml(expense.id)}">
                                Edit
                            </button>

                            <button type="button" data-delete-expense-id="${escapeHtml(expense.id)}">
                                Delete
                            </button>
                        </div>
                    `
                    : ''
                }

                ${isDeleting
                    ? `
                        <div class="expense-delete-confirmation">
                            <p>Delete this expense? This cannot be undone.</p>

                            ${deleteError
                                ? `<p class="form-error">${escapeHtml(deleteError)}</p>`
                                : ''
                            }

                            <button type="button" data-cancel-delete-expense-id="${escapeHtml(expense.id)}">
                                Cancel
                            </button>

                            <button type="button" data-confirm-delete-expense-id="${escapeHtml(expense.id)}">
                                Delete
                            </button>
                        </div>
                    `
                    : ''
                }
            </div>
        `;
    }

    
}

function formatExpenseDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);

    if(Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        },
    );
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}