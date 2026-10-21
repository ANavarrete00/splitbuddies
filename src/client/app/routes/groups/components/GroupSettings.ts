import type { Group } from '../../../../api/groups';

export interface GroupSettingsValues {
    name: string;
    balanceVisibility: 'private' | 'group';
}

export class GroupSettings {
    render(
        group: Group,
        saving: boolean,
        error: string,
    ): string {
        return `
            <div class="modal-backdrop" data-group-settings-backdrop>
                <div class="modal" role="dialog" aria-modal="true" aria-labelledby="group-settings-title" data-group-settings-dialog>
                    <div class="modal-header">
                        <h2 id="group-settings-title">Group Settings</h2>
                        <button type="button" class="modal-close" aria-label="Close" data-close-group-settings>×</button>
                    </div>

                    <div class="modal-content">
                        ${error
                            ? `<p class="form-error">${escapeHtml(error)}</p>`
                            : ''
                        }

                        <form id="group-settings-form">
                            <div class="form-group">
                                <label for="group-settings-name">Group name</label>
                                <input id="group-settings-name" name="name" type="text" value="${escapeHtml(group.name)}" required>
                            </div>

                            <fieldset class="form-group">
                                <legend>Balance visibility</legend>

                                <label>
                                    <input type="radio" name="balanceVisibility" value="private" ${group.balance_visibility === 'private' ? 'checked' : ''}>
                                    Private
                                </label>

                                <p>
                                    Members can only see their own balance.
                                </p>

                                <label>
                                    <input type="radio" name="balanceVisibility" value="group" ${group.balance_visibility === 'group' ? 'checked' : ''}>
                                    Group-wide
                                </label>

                                <p>
                                    Members can see everyone's balance.
                                </p>
                            </fieldset>

                            <div class="modal-actions">
                                <button type="button" data-close-group-settings>
                                    Cancel
                                </button>

                                <button type="submit" class="action-button" ${saving ? 'disabled' : ''}>
                                    ${saving ? 'Saving...' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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
