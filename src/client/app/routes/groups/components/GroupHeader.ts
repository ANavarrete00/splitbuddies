import type { Group } from '../../../../api/groups';

export class GroupHeader {
    render(
        group: Group,
        isOwner: boolean,
        deletingGroup: boolean,
        leavingGroup: boolean,
    ): string {
        return `
            <div class="section-header">
                <div>
                    <h2>${escapeHtml(group.name)}</h2>
                    <p>
                        Group status:
                        <strong>${escapeHtml(group.status)}</strong>
                    </p>
                </div>

                ${isOwner && group.status !== 'completed'
                    ? `
                        <div>
                            ${group.status === 'active'
                                ?`
                                    <button type="button" class="action-button" data-pause-group>
                                        Pause Group
                                    </button>
                                `
                                : group.status === 'paused'
                                    ?`
                                        <button type="button" class="action-button" data-resume-group>
                                            Resume Group
                                        </button>
                                        <button type="button" class="action-button" data-complete-group>
                                            Complete Group
                                        </button>
                                    `
                                    : ''
                            }
                            <button type="button" class="action-button" data-edit-group>
                                Group Settings
                            </button>
                            <button type="button" class="action-button" data-delete-group>
                                Delete Group
                            </button>
                        </div>
                    `
                    :group.status === 'completed'
                        ?''
                        : leavingGroup
                            ? `
                                <div>
                                    <p>Are you sure you want to leave this group?</p>

                                    <div>
                                        <button type="button" class="action-button" data-confirm-leave-group>
                                            Leave Group
                                        </button>
                                        <button type="button" data-cancel-leave-group>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            `
                            : `
                                <button type="button" class="action-button" data-leave-group>
                                    Leave Group
                                </button>
                            `
                }
            </div>

            ${deletingGroup
                ? `
                    <div>
                        <p>
                            Are you sure you want to delete
                            <strong>${escapeHtml(group.name)}</strong>?
                        </p>
                        <p>This will permanently delete the group and its expenses.</p>

                        <div>
                            <button type="button" class="action-button" data-confirm-delete-group>
                                Delete Group
                            </button>
                            <button type="button" data-cancel-delete-group>
                                Cancel
                            </button>
                        </div>
                    </div>
                `
                : ''
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