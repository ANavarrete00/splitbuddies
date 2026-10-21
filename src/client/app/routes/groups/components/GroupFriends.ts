import type { Friendship } from '../../../../api/friends';

export class GroupFriends {
    render(
        availableFriends: Friendship[],
        selectedFriendIds: Set<string>,
        addingFriendsToGroup: boolean,
        isOwner: boolean,
    ): string {
        if(
            !isOwner) {
            return '';
        }

        return `
            <form id="add-group-members-form">
                ${availableFriends.length === 0
                    ? '<p>All of your friends are already members of this group.</p>'
                    : availableFriends.map((friendship) => `
                        <label class="group-friend-option">
                            <input type="checkbox" name="friend_id" value="${escapeHtml(friendship.user.id)}"
                                ${selectedFriendIds.has(friendship.user.id)
                                    ? 'checked'
                                    : ''
                                }
                            />
                            <span>
                                ${escapeHtml(friendship.user.username)}
                            </span>
                        </label>
                    `).join('')
                }
                <div class="modal-actions">
                    ${availableFriends.length > 0
                        ? `<button type="submit" class="action-button"
                            ${
                                addingFriendsToGroup
                                    ? 'disabled'
                                    : ''
                            }
                        >
                            ${
                                addingFriendsToGroup
                                    ? 'Adding...'
                                    : 'Add selected friends'
                            }
                        </button>
                        `
                        : ''
                    }
                </div>

                <p id="add-group-members-error" class="form-error" hidden></p>
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
