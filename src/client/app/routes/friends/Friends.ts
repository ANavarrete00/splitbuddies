import {
    acceptFriendRequest,
    declineFriendRequest,
    getFriends,
    getPendingRequests,
    sendFriendRequest,
    removeFriend,
    type Friendship,
} from '../../../api/friends.ts';

export class Friends {
    private readonly root: HTMLDivElement;
    private readonly onChange: () => void;

    private friends: Friendship[] = [];
    private pendingFriendRequests: Friendship[] = [];
    private friendsLoaded = false;
    private friendsMessage = '';
    private friendsError = '';

    constructor(root: HTMLDivElement, onChange: () => void) {
        this.root = root;
        this.onChange = onChange;
    }

    render(): string {
        if(!this.friendsLoaded) {
            return `
                <section class="page">
                    <h2>Friends</h2>
                    <div class="card">
                        <p>Loading friends...</p>
                    </div>
                </section>
            `;
        }

        return `
            <section class="page">
                <h2>Friends</h2>

                ${
                    this.friendsMessage
                        ? `<p class="form-success">${escapeHtml(this.friendsMessage)}</p>`
                        : ''
                }

                ${
                    this.friendsError
                        ? `<p class="form-error">${escapeHtml(this.friendsError)}</p>`
                        : ''
                }

                <form id="add-friend-form" class="card">
                    <h3>Add a friend</h3>
                    <label for="friend-code">Friend code</label>
                    <input
                        id="friend-code"
                        name="friend_code"
                        type="text"
                        required
                        autocomplete="off"
                        placeholder="e.g. A0164D0A"
                    />
                    <button type="submit" class="action-button">
                        Send friend request
                    </button>
                    <p
                        id="add-friend-error"
                        class="form-error"
                        hidden
                    ></p>
                </form>

                <div class="card">
                    <h3>Pending requests</h3>
                    ${
                        this.pendingFriendRequests.length === 0
                            ? '<p>You have no pending friend requests.</p>'
                            : this.pendingFriendRequests.map((request) => `
                                <div class="list-item friend-request" data-request-id="${escapeHtml(request.id)}">
                                    <div>
                                        <strong>
                                            ${escapeHtml(request.user.username)}
                                        </strong>
                                        <p>
                                            ${escapeHtml(request.user.friend_code)}
                                        </p>
                                    </div>

                                    <div>
                                        <button type="button" class="accept-friend-request" data-request-id="${escapeHtml(request.id)}">
                                            Accept
                                        </button>
                                        <button type="button" class="decline-friend-request" data-request-id="${escapeHtml(request.id)}">
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            `).join('')
                    }
                </div>

                <div class="card">
                    <h3>Your friends</h3>
                    ${
                        this.friends.length === 0
                            ? '<p>You have no friends yet.</p>'
                            : this.friends.map((friendship) => `
                                <div class="list-item" data-friendship-id="${escapeHtml(friendship.id)}">
                                    <div>
                                        <strong>
                                            ${escapeHtml(friendship.user.username)}
                                        </strong>
                                    </div>
                                    <button type="button" class="remove-friend" data-friendship-id="${escapeHtml(friendship.id)}">
                                        Remove friend
                                    </button>
                                </div>
                            `).join('')
                    }
                </div>
            </section>
        `;
    }

    async load(): Promise<void> {
        try {
            const [friends, pendingRequests] = await Promise.all([
                getFriends(),
                getPendingRequests(),
            ]);

            this.friends = friends;
            this.pendingFriendRequests = pendingRequests;
            this.friendsLoaded = true;
        } 
        catch (error) {
            console.error(
                'Failed to load friends:',
                error,
            );
        }
    }

    isLoaded(): boolean {
        return this.friendsLoaded;
    }

    reset(): void {
        this.friends = [];
        this.pendingFriendRequests = [];
        this.friendsLoaded = false;
        this.friendsMessage = '';
        this.friendsError = '';
    }

    attachEvents(): void {
        const addFriendForm = this.root.querySelector<HTMLFormElement>('#add-friend-form');
        addFriendForm?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(addFriendForm);
            const friendCode = String(formData.get('friend_code') ?? '').trim();

            const errorElement = this.root.querySelector<HTMLParagraphElement>('#add-friend-error');
            const submitButton = addFriendForm.querySelector<HTMLButtonElement>('button[type="submit"]');

            if(!friendCode) {
                if(errorElement) {
                    errorElement.textContent = 'Friend code is required';
                    errorElement.hidden = false;
                }

                return;
            }

            if(errorElement) {
                errorElement.hidden = true;
            }

            if(submitButton) {
                submitButton.disabled = true;
            }

            try {
                await sendFriendRequest(friendCode);

                this.friendsMessage = 'Friend request sent.';
                this.friendsError = '';
                this.friendsLoaded = false;

                this.onChange();
                await this.load();
                this.onChange();
                this.attachEvents();
            } 
            catch (error) {
                this.friendsError = error instanceof Error
                    ? error.message
                    : 'Failed to send friend request.';
                this.friendsMessage = '';
                this.onChange();
                this.attachEvents();
            }
        });

        this.root.querySelectorAll<HTMLButtonElement>('.accept-friend-request').forEach((button) => {
            button.addEventListener('click', async () => {
                const requestId = button.dataset.requestId;

                if(!requestId) {
                    return;
                }

                button.disabled = true;

                try {
                    await acceptFriendRequest(requestId);

                    this.friendsMessage = 'Friend request accepted.';
                    this.friendsError = '';
                    this.friendsLoaded = false;

                    this.onChange();
                    await this.load();
                    this.onChange();
                    this.attachEvents();
                } 
                catch (error) {
                    this.friendsError = error instanceof Error
                        ? error.message
                        : 'Failed to accept friend request.';
                    this.friendsMessage = '';
                    this.onChange();
                    this.attachEvents();
                }
            });
        });

        this.root.querySelectorAll<HTMLButtonElement>('.decline-friend-request').forEach((button) => {
            button.addEventListener('click', async () => {
                const requestId = button.dataset.requestId;

                if(!requestId) {
                    return;
                }

                button.disabled = true;

                try {
                    await declineFriendRequest(
                        requestId,
                    );

                    this.friendsMessage = 'Friend request declined.';
                    this.friendsError = '';
                    this.friendsLoaded = false;

                    this.onChange();
                    await this.load();
                    this.onChange();
                    this.attachEvents();
                } 
                catch (error) {
                    this.friendsError = error instanceof Error
                        ? error.message
                        : 'Failed to decline friend request.';
                    this.friendsMessage = '';
                    this.onChange();
                    this.attachEvents();
                }
            });
        });

        this.root.querySelectorAll<HTMLButtonElement>('.remove-friend').forEach((button) => {
            button.addEventListener('click', async () => {
                const friendshipId = button.dataset.friendshipId;

                if(!friendshipId) {
                    return;
                }

                if(!confirm('Are you sure you want to remove this friend?')) {
                    return;
                }

                button.disabled = true;

                try {
                    await removeFriend(friendshipId);

                    this.friendsMessage = 'Friend removed.';
                    this.friendsError = '';
                    this.friendsLoaded = false;

                    this.onChange();
                    await this.load();
                    this.onChange();
                    this.attachEvents();
                }
                catch (error) {
                    this.friendsError = error instanceof Error
                        ? error.message
                        : 'Failed to remove friend.';
                    this.friendsMessage = '';
                    this.onChange();
                    this.attachEvents();
                }
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
