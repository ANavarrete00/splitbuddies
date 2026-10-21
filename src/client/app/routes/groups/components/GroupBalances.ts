import type { GroupBalance } from '../../../../api/groups';

export class GroupBalances {
    render(balances: GroupBalance[]): string {
        if(balances.length === 0) {
            return '<p>No group members yet.</p>';
        }

        return `
            <div class="list">
                ${balances.map((balance) => {
                    const netBalance = balance.netBalanceCents / 100;
                    const netBalanceClass = balance.netBalanceCents > 0
                        ? 'balance-positive'
                        : balance.netBalanceCents < 0
                            ? 'balance-negative'
                            : 'balance-settled';

                    const netBalanceText = balance.netBalanceCents > 0
                        ? `Gets back $${netBalance.toFixed(2)}`
                        : balance.netBalanceCents < 0
                            ? `Owes $${Math.abs(netBalance).toFixed(2)}`
                            : 'Settled up';

                    return `
                        <div class="list-item">
                            <div>
                                <strong>${escapeHtml(balance.username)}</strong>
                                <p>
                                    Share: ${balance.sharePercentageBasisPoints / 100}%
                                </p>
                            </div>

                            <div>
                                <p>
                                    Paid: $${(balance.totalPaidCents / 100).toFixed(2)}
                                </p>
                                <p>
                                    Owes: $${(balance.totalOwedCents / 100).toFixed(2)}
                                </p>
                                <strong class="${netBalanceClass}">
                                    ${netBalanceText}
                                </strong>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
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
