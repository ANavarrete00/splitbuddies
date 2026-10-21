import type { Expense } from '../../../../api/expenses';
import type { GroupMember } from '../../../../api/groups';
import { ExpenseExclusions } from './ExpenseExclusions';

export class ExpenseForm {
    private readonly expenseExclusions: ExpenseExclusions;

    constructor(groupMembers: GroupMember[]) {
        this.expenseExclusions = new ExpenseExclusions(groupMembers);
    }

    render(
        members: GroupMember[],
        today: string,
        creatingExpense: boolean,
        expenseMessage: string,
        expenseError: string,
    ): string {
        return `
            <form id="add-expense-form">
                ${expenseMessage
                    ? `<p class="form-success">${escapeHtml(expenseMessage)}</p>`
                    : ''
                }

                ${expenseError
                    ? `<p class="form-error">${escapeHtml(expenseError)}</p>`
                    : ''
                }

                <label>
                    Title
                    <input type="text" name="title" required maxlength="200"/>
                </label>

                <label>
                    Description
                    <textarea name="description" rows="3"></textarea>
                </label>

                <label>
                    Amount
                    <input type="number" name="amount" min="0.01" step="0.01" required/>
                </label>

                <label>
                    Excluded amount
                    <input type="number" name="excluded_amount" min="0" step="0.01" value="0"/>
                </label>

                ${this.expenseExclusions.render()}

                <label>
                    Tax amount
                    <input type="number" name="tax" min="0" step="0.01" value="0"/>
                </label>

                <label>
                    Tax rate (%)
                    <input type="number" name="tax_rate" min="0" step="0.01"/>
                </label>

                <label>
                    Paid by
                    <select name="paid_by_uid" required>
                        <option value="">Select a member</option>
                        ${members.map((member) => `
                            <option value="${escapeHtml(member.user_id)}">
                                ${escapeHtml(member.username)}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Date
                    <input type="date" name="occurred_at" value="${today}" required/>
                </label>

                <div class="modal-actions">
                    <button type="submit" class="action-button"
                        ${creatingExpense ? 'disabled' : ''}
                    >
                        ${creatingExpense
                            ? 'Adding expense...'
                            : 'Add expense'
                        }
                    </button>
                </div>
            </form>
        `;
    }

    renderEdit(
        expense: Expense,
        members: GroupMember[],
        isDeleting: boolean,
    ): string {
        return `
            <form data-edit-expense-form data-expense-id="${escapeHtml(expense.id)}">
                <h4>Edit Expense</h4>

                <label>
                    Title
                    <input type="text" name="title" value="${escapeHtml(expense.title)}" required maxlength="200"/>
                </label>

                <label>
                    Description
                    <textarea name="description" rows="3">${escapeHtml(expense.description ?? '')}</textarea>
                </label>

                <label>
                    Amount
                    <input type="number" name="amount" min="0.01" step="0.01" value="${(expense.amount_cents / 100).toFixed(2)}" required/>
                </label>

                <label>
                    Excluded amount
                    <input type="number" name="excluded_amount" min="0" step="0.01" value="${(expense.excluded_amount_cents / 100).toFixed(2)}"/>
                </label>

                ${this.expenseExclusions.render(expense.exclusions)}

                <label>
                    Tax amount
                    <input type="number" name="tax" min="0" step="0.01" value="${(expense.tax_cents / 100).toFixed(2)}"/>
                </label>

                <label>
                    Tax rate (%)
                    <input type="number" name="tax_rate" min="0" step="0.01" value="${expense.tax_rate_basis_points === null
                            ? ''
                            : (expense.tax_rate_basis_points / 100).toFixed(2)
                    }"/>
                </label>

                <label>
                    Paid by
                    <select name="paid_by_uid" required>
                        <option value="">Select a member</option>
                        ${members.map((member) => `
                            <option
                                value="${escapeHtml(member.user_id)}"
                                ${member.user_id === expense.paid_by_uid ? 'selected' : ''}
                            >
                                ${escapeHtml(member.username)}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Date
                    <input type="date" name="occurred_at" value="${expense.occurred_at.slice(0, 10)}" required/>
                </label>

                <div class="expense-actions">
                    <button type="submit" class="action-button">
                        Save Changes
                    </button>
                    <button type="button" data-cancel-edit-expense>
                        Cancel
                    </button>
                    ${
                        isDeleting
                            ? `
                                <button type="button" data-confirm-delete-expense>
                                    Delete Expense
                                </button>
                                <button type="button" data-cancel-delete-expense>
                                    Cancel Delete
                                </button>
                            `
                            : ''
                    }
                </div>
            </form>
        `;
    }

    setupInputs(form: HTMLFormElement): void {
        this.expenseExclusions.setupInputs(form);
    }

    getExclusions(form: HTMLFormElement) {
        return this.expenseExclusions.getExclusions(form);
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