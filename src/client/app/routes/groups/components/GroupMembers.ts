import type { GroupMember } from '../../../../api/groups';

export class GroupMembers {
    render(
        members: GroupMember[],
        isOwner: boolean,
        userId: string,
        removingMemberId: string | null,
        updatingMemberSharePercentageId: string | null,
        isCompleted: boolean,
    ): string {
        return `
            ${members.length === 0
                ? '<p>No members found.</p>'
                : members.map((member) => `
                    <div class="list-item group-member">
                        <div>
                            <strong>
                                ${escapeHtml(member.username)}
                            </strong>
                            <span>
                                ${escapeHtml(member.role)}
                            </span>

                            ${isOwner && !isCompleted && member.role !== 'owner'
                                ? `
                                    <div class="member-share-percentage">
                                        <label>
                                            Share percentage
                                            <input type="number" min="0" max="100" step="0.01"
                                                value="${member.share_percentage_basis_points / 100}"
                                                data-share-percentage-member-id="${member.user_id}"
                                            >
                                        </label>
                                        <button type="button" 
                                            data-save-share-percentage-member-id="${member.user_id}"
                                            ${updatingMemberSharePercentageId === member.user_id ? 'disabled' : ''}
                                        >
                                            ${updatingMemberSharePercentageId === member.user_id
                                                ? 'Saving...'
                                                : 'Save'
                                            }
                                        </button>
                                    </div>
                                `
                                : ''
                            }
                        </div>

                        ${isOwner && !isCompleted && member.user_id !== userId && member.role !== 'owner'
                            ? removingMemberId === member.user_id
                                ? `
                                    <div class="member-remove-confirmation">
                                        <span>Remove ${escapeHtml(member.username)}?</span>
                                        <button type="button" data-confirm-remove-member-id="${member.user_id}">
                                            Remove
                                        </button>
                                        <button type="button" data-cancel-remove-member-id="${member.user_id}">
                                            Cancel
                                        </button>
                                    </div>
                                `
                                : `
                                    <button type="button" data-remove-member-id="${member.user_id}">
                                        Remove
                                    </button>
                                `
                            : ''
                        }
                    </div>
                `).join('')
            }
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