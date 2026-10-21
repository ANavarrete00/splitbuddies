import type { Expense } from '../../../../api/expenses';
import type { GroupMember } from '../../../../api/groups';

export class ExpenseExclusions {
    private readonly groupMembers: GroupMember[];

    constructor(groupMembers: GroupMember[]) {
        this.groupMembers = groupMembers;
    }

    render(exclusions: Expense['exclusions'] = []): string {
        return `
            <div class="expense-exclusions" data-exclusions-container>
                <h4>Excluded amount assignments</h4>
                <p>
                    Select the members responsible for the excluded amount
                    and enter each person's portion.
                </p>

                ${this.groupMembers.map((member) => {
                    const exclusion = exclusions.find(
                        (item) => item.user_id === member.user_id,
                    );

                    return `
                        <label class="expense-exclusion-option">
                            <input
                                type="checkbox"
                                data-exclusion-user-id="${escapeHtml(member.user_id)}"
                                ${exclusion ? 'checked' : ''}
                            />
                            <span>
                                ${escapeHtml(member.username)}
                            </span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                data-exclusion-amount-user-id="${escapeHtml(member.user_id)}"
                                value="${
                                    exclusion
                                        ? (exclusion.amount_cents / 100).toFixed(2)
                                        : ''
                                }"
                                ${exclusion ? '' : 'disabled'}
                            />
                        </label>
                    `;
                }).join('')}

                <p>
                    Assigned:
                    $<span data-exclusion-total>0.00</span>
                </p>
            </div>
        `;
    }

    setupInputs(form: HTMLFormElement): void {
        const excludedAmountInput = form.querySelector<HTMLInputElement>(
            '[name="excluded_amount"]',
        );

        const exclusionsContainer = form.querySelector<HTMLElement>(
            '[data-exclusions-container]',
        );

        const updateExclusionState = (): void => {
            if(!excludedAmountInput || !exclusionsContainer) {
                return;
            }

            const excludedAmount = Number(excludedAmountInput.value ?? 0);
            const hasExcludedAmount = Number.isFinite(excludedAmount) &&
                excludedAmount > 0;

            exclusionsContainer.hidden = !hasExcludedAmount;
        };

        const exclusionCheckboxes = form.querySelectorAll<HTMLInputElement>(
            '[data-exclusion-user-id]',
        );

        exclusionCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                const userId = checkbox.dataset.exclusionUserId;

                if(!userId) {
                    return;
                }

                const amountInput = form.querySelector<HTMLInputElement>(
                    `[data-exclusion-amount-user-id="${CSS.escape(userId)}"]`,
                );

                if(!amountInput) {
                    return;
                }

                amountInput.disabled = !checkbox.checked;

                if(!checkbox.checked) {
                    amountInput.value = '';
                }

                this.updateTotal(form);
            });
        });

        const exclusionAmountInputs = form.querySelectorAll<HTMLInputElement>(
            '[data-exclusion-amount-user-id]',
        );

        exclusionAmountInputs.forEach((input) => {
            input.addEventListener('input', () => {
                this.updateTotal(form);
            });
        });

        excludedAmountInput?.addEventListener('input', () => {
            updateExclusionState();
            this.updateTotal(form);
        });

        updateExclusionState();
        this.updateTotal(form);
    }

    getExclusions(form: HTMLFormElement): {user_id: string; amount_cents: number;}[] {
        const checkboxes = form.querySelectorAll<HTMLInputElement>(
            '[data-exclusion-user-id]:checked',
        );

        return Array.from(checkboxes).flatMap((checkbox) => {
            const userId = checkbox.dataset.exclusionUserId;

            if(!userId) {
                return [];
            }

            const amountInput = form.querySelector<HTMLInputElement>(
                `[data-exclusion-amount-user-id="${CSS.escape(userId)}"]`,
            );

            if(!amountInput) {
                return [];
            }

            const amount = Number(amountInput.value);

            if(!Number.isFinite(amount) || amount <= 0) {
                return [];
            }

            return [{
                user_id: userId,
                amount_cents: Math.round(amount * 100),
            }];
        });
    }

    private updateTotal(form: HTMLFormElement): void {
        const totalElement = form.querySelector<HTMLElement>(
            '[data-exclusion-total]',
        );

        if(!totalElement) {
            return;
        }

        const checkedInputs = form.querySelectorAll<HTMLInputElement>(
            '[data-exclusion-user-id]:checked',
        );

        let totalCents = 0;

        checkedInputs.forEach((checkbox) => {
            const userId = checkbox.dataset.exclusionUserId;

            if(!userId) {
                return;
            }

            const amountInput = form.querySelector<HTMLInputElement>(
                `[data-exclusion-amount-user-id="${CSS.escape(userId)}"]`,
            );

            if(!amountInput) {
                return;
            }

            const amount = Number(amountInput.value);

            if(Number.isFinite(amount) && amount > 0) {
                totalCents += Math.round(amount * 100);
            }
        });

        totalElement.textContent = (totalCents / 100).toFixed(2);
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