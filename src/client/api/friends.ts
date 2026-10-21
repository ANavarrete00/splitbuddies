import { request } from './client';

export interface FriendUser {
	id: string;
	username: string;
	friend_code: string;
}

export interface Friendship {
	id: string;
	requester_id: string;
	addressee_id: string;
	status: 'pending' | 'accepted' | 'declined' | 'blocked';
	created_at: string;
	updated_at: string;
	user: FriendUser;
}

interface FriendsResponse {
	friends: Friendship[];
}

interface RequestsResponse {
	requests: Friendship[];
}

interface FriendshipResponse {
	friendship: Friendship;
}

export async function getFriends(): Promise<Friendship[]> {
	const response = await request<FriendsResponse>(
		'/api/friends',
	);

	return response.friends;
}

export async function getPendingRequests(): Promise<Friendship[]> {
	const response = await request<RequestsResponse>(
		'/api/friends/requests',
	);

	return response.requests;
}

export async function sendFriendRequest(friendCode: string): Promise<Friendship> {
	const response = await request<FriendshipResponse>(
		'/api/friends/requests',
		{
			method: 'POST',
			body: JSON.stringify({
				friend_code: friendCode,
			}),
		},
	);

	return response.friendship;
}

export async function acceptFriendRequest(friendshipId: string): Promise<Friendship> {
	const response = await request<FriendshipResponse>(
		`/api/friends/requests/${encodeURIComponent(friendshipId)}/accept`,
		{
			method: 'POST',
		},
	);

	return response.friendship;
}

export async function declineFriendRequest(friendshipId: string): Promise<Friendship> {
	const response = await request<FriendshipResponse>(
		`/api/friends/requests/${encodeURIComponent(friendshipId)}/decline`,
		{
			method: 'POST',
		},
	);

	return response.friendship;
}

export async function removeFriend(friendshipId: string): Promise<void> {
	await request<void>(
		`/api/friends/${encodeURIComponent(friendshipId)}`,
		{
			method: 'DELETE',
		},
	);
}
