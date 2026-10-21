import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/middleware.js';
import {
	notificationTypes,
	type NotificationType,
} from '../notifications/types.ts';
import type { NotificationsService } from '../services/notification.service.ts';

export async function NotificationsRoutes(server: FastifyInstance, notificationsService: NotificationsService): Promise<void> {
	// Gets all notifications with userId
	server.get('/api/notifications', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			notifications: notificationsService.getNotifications(
				request.user.id,
			),
		};
	});

	// Gets unread count
	server.get('/api/notifications/unread-count', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			count: notificationsService.getUnreadCount(
				request.user.id,
			),
		};
	});

	// Mark one as read
	server.patch<{
		Params: {
			id: string;
		};
	}>('/api/notifications/:id/read', {
		preHandler: authenticate,
	}, async (request, reply) => {
		const marked = notificationsService.markAsRead(
			request.user.id,
			request.params.id,
		);

		if(!marked) {
			return reply.code(404).send({
				error: 'Notification not found',
			});
		}

		return {
			success: true,
		};
	});

	// Delete one notification
	server.delete<{
		Params: {
			id: string;
		};
	}>('/api/notifications/:id', {
		preHandler: authenticate,
	}, async (request, reply) => {
		const deleted = notificationsService.deleteNotification(request.user.id, request.params.id);

		if(!deleted) {
			return reply.code(404).send({
				error: 'Notification not found',
			});
		}

		return {
			success: true,
		};
	});

	// Delete all notifications
	server.delete('/api/notifications', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			deleted: notificationsService.deleteAllNotifications(request.user.id)
		};
	});

	// Mark all as read
	server.post('/api/notifications/read-all', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			updated: notificationsService.markAllAsRead(
				request.user.id,
			),
		};
	});

	// Get all preferences for user
	server.get('/api/notifications/preferences', {
		preHandler: authenticate,
	}, async (request) => {
		return {
			preferences: notificationsService.getPreferences(
				request.user.id,
			),
		};
	});

	// Update preferences for user
	server.patch<{
		Params: {
			type: string;
		};
		Body: {
			enabled: boolean;
		};
	}>('/api/notifications/preferences/:type', {
		preHandler: authenticate,
		schema: {
			params: {
				type: 'object',
				required: ['type'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						minLength: 1,
					},
				},
			},
			body: {
				type: 'object',
				required: ['enabled'],
				additionalProperties: false,
				properties: {
					enabled: {
						type: 'boolean',
					},
				},
			},
		},
	}, async (request, reply) => {
		if(!notificationTypes.includes(
			request.params.type as NotificationType,
		)) {
			return reply.code(400).send({
				error: 'Invalid notification type',
			});
		}

		const preference = notificationsService.setPreference(
			request.user.id,
			request.params.type as NotificationType,
			request.body.enabled,
		);

		return {
			preference,
		};
	});

}