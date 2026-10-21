import { randomUUID } from 'node:crypto';

import type { Friendship, FriendshipWithUser } from '../repositories/friends.repository.ts';
import { FriendsRepository } from '../repositories/friends.repository.ts';
import { getUserByFriendCode, getUserById } from '../repositories/users.repository.ts';
import { NotificationsService } from './notification.service.ts';

export class FriendService {
	private readonly repository: FriendsRepository;
	private readonly notificationsService: NotificationsService;

	constructor(repository: FriendsRepository, notificationsService: NotificationsService) {
		this.repository = repository;
		this.notificationsService = notificationsService;
	}

	sendRequest(requesterId: string,friendCode: string): Friendship {
		const normalizedFriendCode = friendCode.trim().toUpperCase();

		if(!normalizedFriendCode) {
			throw new Error('Friend code is required');
		}

		const recipient = getUserByFriendCode(
			normalizedFriendCode,
		);

		if(!recipient) {
			throw new Error('User not found');
		}

		if(recipient.id === requesterId) {
			throw new Error('You cannot send a friend request to yourself');
		}

		const existing = this.repository.getBetweenUsers(
			requesterId,
			recipient.id,
		);

		if(existing) {
			if(existing.status === 'pending') {
				throw new Error('A friend request already exists');
			}

			if(existing.status === 'accepted') {
				throw new Error('You are already friends with this user');
			}

			if(existing.status === 'blocked') {
				throw new Error('This friendship is blocked');
			}

			if(existing.status === 'declined') {
				throw new Error('This friend request was previously declined');
			}
		}

		const friendship = this.repository.createRequest(randomUUID(), requesterId, recipient.id);
		const requester = getUserById(requesterId);

		this.notificationsService.createNotification(recipient.id, 'friend_request', 'New friend request',
			`${requester?.username ?? 'Someone'} sent you a friend request.`,
			requesterId,
		)

		return friendship;
	}

	acceptRequest(friendshipId: string,userId: string): Friendship {
		const friendship = this.getPendingRequest(friendshipId);

		if(friendship.addressee_id !== userId) {
			throw new Error('Only the recipient can accept this request');
		}

		return this.repository.updateStatus(
			friendshipId,
			'accepted',
		)!;
	}

	declineRequest(friendshipId: string,userId: string): Friendship {
		const friendship = this.getPendingRequest(friendshipId);

		if(friendship.addressee_id !== userId) {
			throw new Error('Only the recipient can decline this request');
		}

		return this.repository.updateStatus(
			friendshipId,
			'declined',
		)!;
	}

	removeFriend(userId: string, friendshipId: string): void {
		const friendship = this.repository.getById(friendshipId);

		if(
			!friendship ||
			friendship.status !== 'accepted' ||
			(
				friendship.requester_id !== userId &&
				friendship.addressee_id !== userId
			)
		) {
			throw new Error('Friendship not found');
		}

		if(!this.repository.removeFriendship(friendship.id)) {
			throw new Error('Unable to remove friendship');
		}
	}

	listFriends(userId: string): FriendshipWithUser[] {
		return this.repository.getFriendsForUser(userId);
	}

	listPendingRequests(userId: string): FriendshipWithUser[] {
		return this.repository.getPendingRequestsForUser(userId);
	}

	private getPendingRequest(friendshipId: string): Friendship {
		const friendship = this.repository.getById(
			friendshipId,
		);

		if(!friendship) {
			throw new Error('Friend request not found');
		}

		if(friendship.status !== 'pending') {
			throw new Error('Friend request is no longer pending');
		}

		return friendship;
	}
}