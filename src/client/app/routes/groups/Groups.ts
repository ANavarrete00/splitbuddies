import {
    createGroup,
    getGroups,
    type Group,
} from '../../../api/groups';

export class Groups {
    private readonly root: HTMLDivElement;
    private groups: Group[] = [];
    private groupsLoaded = false;
    private onGroupSelected: (groupId: string) => void;
    private onGroupsChanged: () => void;

    constructor(
        root: HTMLDivElement,
        onGroupSelected: (groupId: string) => void,
        onGroupsChanged: () => void,
    ) {
        this.root = root;
        this.onGroupSelected = onGroupSelected;
        this.onGroupsChanged = onGroupsChanged;
    }

    render(): string {
        if(!this.groupsLoaded) {
            return `
                <section class="page">
                    <h2>Groups</h2>
                    <div class="card">
                        <p>Loading groups...</p>
                    </div>
                </section>
            `;
        }

        return `
            <section class="page">
                <h2>Groups</h2>
                <form id="create-group-form" class="card">
                    <h3>Create a group</h3>
                    <label for="group-name">Group name</label>
                    <input id="group-name" name="name" type="text" maxlength="100" required autocomplete="off" placeholder="e.g. Weekend trip"/>
                    <button type="submit" class="action-button">Create group</button>
                    <p id="create-group-error" class="form-error" hidden></p>
                </form>

                <div class="card">
                    <h3>Your groups</h3>
                    ${this.groups.length === 0
                        ? '<p>You aren\'t a member of any groups yet.</p>'
                        : this.groups.map((group) => `
                            <button type="button" class="group-item" data-group-id="${escapeHtml(group.id)}">
                                <h4>${escapeHtml(group.name)}</h4>
                            </button>
                        `).join('')
                    }
                </div>
            </section>
        `;
    }

    async load(): Promise<void> {
        try {
            this.groups = await getGroups();
            this.groupsLoaded = true;
        } 
        catch (error) {
            console.error(
                'Failed to load groups:',
                error,
            );
        }
    }

    isLoaded(): boolean {
        return this.groupsLoaded;
    }

    reset(): void {
        this.groups = [];
        this.groupsLoaded = false;
    }

    // Reload the groups list after a group is changed elsewhere in the app.
    async reload(): Promise<void> {
        await this.load();
    }

    attachEvents(): void {
        const createGroupForm = this.root.querySelector<HTMLFormElement>('#create-group-form');

        createGroupForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const nameInput = createGroupForm.elements.namedItem('name') as HTMLInputElement;

            const submitButton = createGroupForm.querySelector<HTMLButtonElement>('button[type="submit"]');

            const errorElement = createGroupForm.querySelector<HTMLParagraphElement>('#create-group-error');

            const name = nameInput.value.trim();

            if(!name) {
                if(errorElement) {
                    errorElement.textContent = 'Group name is required.';
                    errorElement.hidden = false;
                }

                return;
            }

            if(name.length > 100) {
                if(errorElement) {
                    errorElement.textContent = 'Group name must be 100 characters or fewer.';
                    errorElement.hidden = false;
                }

                return;
            }

            if(submitButton) {
                submitButton.disabled = true;
            }

            if(errorElement) {
                errorElement.hidden = true;
            }

            try {
                const group = await createGroup(name);

                // Add the newly created group and refresh the Groups page
                this.groups = [group,...this.groups,];

                this.onGroupsChanged();
            } 
            catch (error) {
                console.error('Failed to create group:', error);

                if(errorElement) {
                    errorElement.textContent = error instanceof Error
                        ? error.message
                        : 'Failed to create group.';
                    errorElement.hidden = false;
                }

                if(submitButton) {
                    submitButton.disabled = false;
                }
            }
        });

        const groupButtons = this.root.querySelectorAll<HTMLButtonElement>('[data-group-id]');

        groupButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const groupId = button.dataset.groupId;

                if(!groupId) {
                    return;
                }

                this.onGroupSelected(groupId);
            });
        });
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