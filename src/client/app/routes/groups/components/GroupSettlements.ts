import type { GroupMember, Settlement } from '../../../../api/groups';

export class GroupSettlements {
    render(
        settlements: Settlement[],
        members: GroupMember[],
        userId: string,
    ): string {
        if(settlements.length === 0) {
            return '<p>No settlements recorded.</p>';
        }

        const memberNames = new Map(
            members.map((member) => [
                member.user_id,
                member.username,
            ]),
        );

        return `
            <div class="list">
                ${settlements.map((settlement) => {
                    const fromUsername = memberNames.get(
                        settlement.from_user_id,
                    ) ?? 'Unknown user';

                    const toUsername = memberNames.get(
                        settlement.to_user_id,
                    ) ?? 'Unknown user';

                    return `
                        <div class="list-item">
                            <div>
                                <strong>${escapeHtml(fromUsername)}</strong>
                                <p>
                                    paid ${escapeHtml(toUsername)}
                                </p>
                            </div>

                            <div>
                                <strong>
                                    $${(settlement.amount_cents / 100).toFixed(2)}
                                </strong>
                                <p>
                                    ${escapeHtml(
                                        formatSettlementDate(settlement.settled_at),
                                    )}
                                </p>
                                ${settlement.from_user_id === userId || settlement.to_user_id === userId
                                    ? `<button type="button" data-delete-settlement-id="${escapeHtml(settlement.id)}">Delete</button>`
                                    : ''
                                }
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

function formatSettlementDate(value: string): string {
    const date = new Date(value);

    if(Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}