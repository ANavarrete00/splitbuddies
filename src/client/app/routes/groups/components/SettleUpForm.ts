import type { GroupMember } from '../../../../api/groups';

export class SettleUpForm {
    render(
        members: GroupMember[],
        suggestions: {
            fromUserId: string;
            toUserId: string;
            amountCents: number;
        }[],
        saving: boolean,
        error: string,
    ): string {
        const memberNames = new Map(members.map((member) => [
            member.user_id,
            member.username,
        ]))

        return `
            <form id="settle-up-form">
                ${error
                    ? `<p class="form-error">${escapeHtml(error)}</p>`
                    : ''
                }

                <div>
                    <h3>Suggested settlements</h3>
                    ${suggestions.length === 0
                        ? '<p>Everyone is settled up.</p>'
                        : suggestions.map((suggestion) => `
                            <button type="button" data-settlement-from="${escapeHtml(suggestion.fromUserId)}" 
                                data-settlement-to="${escapeHtml(suggestion.toUserId)}" 
                                data-settlement-amount="${suggestion.amountCents}"
                                ${saving ? 'disabled' : ''}
                            >
                                ${escapeHtml(memberNames.get(suggestion.fromUserId) ?? 'Unknown user')}
                                pays
                                ${escapeHtml(memberNames.get(suggestion.toUserId) ?? 'Unknown user')}
                                $${(suggestion.amountCents / 100).toFixed(2)}
                            </button>
                    `).join('')}
                </div>

                <label>
                    Paid by
                    <select name="from_user_id" required>
                        <option value="">Select a member</option>
                        ${members.map((member) => `
                            <option value="${escapeHtml(member.user_id)}">
                                ${escapeHtml(member.username)}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Paid to
                    <select name="to_user_id" required>
                        <option value="">Select a member</option>
                        ${members.map((member) => `
                            <option value="${escapeHtml(member.user_id)}">
                                ${escapeHtml(member.username)}
                            </option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Amount
                    <input type="number" name="amount" min="0.01" step="0.01" required/>
                </label>

                <div class="modal-actions">
                    <button type="submit" class="action-button" ${saving ? 'disabled' : ''}>
                        ${saving ? 'Recording settlement...' : 'Record settlement'}
                    </button>
                </div>
            </form>
        `;
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