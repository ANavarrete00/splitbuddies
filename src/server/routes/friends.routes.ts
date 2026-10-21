import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/middleware.js';
import type { FriendService } from '../services/friend.service.ts';

export async function friendsRoutes(server: FastifyInstance,friendService: FriendService): Promise<void> {
	server.post<{
		Body: {
			friend_code: string;
		};
	}>('/api/friends/requests', {
		preHandler: authenticate,
		schema: {
			body: {
				type: 'object',
				required: ['friend_code'],
				additionalProperties: false,
				properties: {
					friend_code: {
						type: 'string',
						minLength: 1,
					},
				},
			},
		},
	}, async (request, reply) => {
		try {
			const friendship = friendService.sendRequest(
				request.user.id,
				request.body.friend_code,
			);

			return reply.code(201).send({
				friendship,
			});
		} 
        catch (error) {
			if(
				error instanceof Error &&
				(
					error.message === 'Friend code is required' ||
					error.message === 'User not found'
				)
			) {
				return reply.code(400).send({
					error: error.message,
				});
			}

			if(
				error instanceof Error &&
				(
					error.message ===
						'You cannot send a friend request to yourself' ||
					error.message ===
						'A friend request already exists' ||
					error.message ===
						'You are already friends with this user' ||
					error.message ===
						'This friendship is blocked' ||
					error.message ===
						'This friend request was previously declined'
				)
			) {
				return reply.code(409).send({
					error: error.message,
				});
			}

			request.log.error(error);

			return reply.code(500).send({
				error: 'Internal server error',
			});
		}
	});

	server.get('/api/friends/requests', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			requests: friendService.listPendingRequests(
				request.user.id,
			),
		};
	});

	server.post<{
		Params: {
			id: string;
		};
	}>('/api/friends/requests/:id/accept', {
		preHandler: authenticate,
	}, async (request, reply) => {
		try {
			const friendship = friendService.acceptRequest(
				request.params.id,
				request.user.id,
			);

			return {
				friendship,
			};
		} catch (error) {
			if(
				error instanceof Error &&
				error.message === 'Friend request not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(
				error instanceof Error &&
				(
					error.message ===
						'Friend request is no longer pending' ||
					error.message ===
						'Only the recipient can accept this request'
				)
			) {
				return reply.code(403).send({
					error: error.message,
				});
			}

			request.log.error(error);

			return reply.code(500).send({
				error: 'Internal server error',
			});
		}
	});

	server.post<{
		Params: {
			id: string;
		};
	}>('/api/friends/requests/:id/decline', {
		preHandler: authenticate,
	}, async (request, reply) => {
		try {
			const friendship = friendService.declineRequest(
				request.params.id,
				request.user.id,
			);

			return {
				friendship,
			};
		} catch (error) {
			if(
				error instanceof Error &&
				error.message === 'Friend request not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(
				error instanceof Error &&
				(
					error.message ===
						'Friend request is no longer pending' ||
					error.message ===
						'Only the recipient can decline this request'
				)
			) {
				return reply.code(403).send({
					error: error.message,
				});
			}

			request.log.error(error);

			return reply.code(500).send({
				error: 'Internal server error',
			});
		}
	});

	server.delete<{
		Params: {
			id: string;
		};
	}>('/api/friends/:id', {
		preHandler: authenticate,
	}, async (request, reply) => {
		try {
			friendService.removeFriend(
				request.user.id,
				request.params.id,
			);

			return reply.code(204).send();
		} catch (error) {
			if(
				error instanceof Error &&
				error.message === 'Friendship not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(
				error instanceof Error &&
				error.message === 'Unable to remove friendship'
			) {
				return reply.code(409).send({
					error: error.message,
				});
			}

			request.log.error(error);

			return reply.code(500).send({
				error: 'Internal server error',
			});
		}
	});

	server.get('/api/friends', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			friends: friendService.listFriends(
				request.user.id,
			),
		};
	});
}