import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/middleware.js';
import type { ExpenseService } from '../services/expense.service.ts';

export async function expensesRoutes(server: FastifyInstance, expenseService: ExpenseService): Promise<void> {
	server.post<{
		Body: {
			group_id: string;
			title: string;
			description?: string;
			amount_cents: number;
			excluded_amount_cents?: number;
			exclusions?: {
				user_id: string;
				amount_cents: number;
			}[];
			tax_cents?: number;
			tax_rate_basis_points?: number;
			paid_by: string;
            paid_by_uid: string;
			occurred_at: string;
		};
	}>('/api/expenses', {
		preHandler: authenticate,
		schema: {
			body: {
				type: 'object',
				required: [
					'group_id',
					'title',
					'amount_cents',
					'paid_by',
					'paid_by_uid',
					'occurred_at',
				],
				additionalProperties: false,
				properties: {
					group_id: {
						type: 'string',
						minLength: 1,
					},
					title: {
						type: 'string',
						minLength: 1,
					},
					description: {
						type: 'string',
					},
					amount_cents: {
						type: 'integer',
						minimum: 1,
					},
					excluded_amount_cents: {
						type: 'integer',
						minimum: 0,
					},
					exclusions: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							required: [
								'user_id',
								'amount_cents',
							],
							properties: {
								user_id: {
									type: 'string',
									minLength: 1,
								},
								amount_cents: {
									type: 'integer',
									minimum: 1,
								},
							},
						},
					},
					tax_cents: {
						type: 'integer',
						minimum: 0,
					},
					tax_rate_basis_points: {
						type: 'integer',
						minimum: 0,
					},
					paid_by: {
						type: 'string',
						minLength: 1,
					},
					paid_by_uid: {
						type: 'string',
						minLength: 1,
					},
					occurred_at: {
						type: 'string',
						minLength: 1,
					},
				},
			},
		},
	}, async (request, reply) => {
		try {
			const expense = expenseService.createExpense({
				groupId: request.body.group_id,
				title: request.body.title,
				description: request.body.description,
				amountCents: request.body.amount_cents,
				excludedAmountCents: request.body.excluded_amount_cents,
				exclusions: request.body.exclusions?.map((exclusion) => ({
					userId: exclusion.user_id,
					amountCents: exclusion.amount_cents,
				})),
				taxCents: request.body.tax_cents,
				taxRateBasisPoints: request.body.tax_rate_basis_points,
				paidBy: request.body.paid_by,
                paidByUid: request.body.paid_by_uid,
				createdBy: request.user.username,
                createdByUid: request.user.id,
				occurredAt: request.body.occurred_at,
			});

			return reply.code(201).send({
				expense,
			});
		} 
        catch (error) {
			if(error instanceof Error) {
				const badRequestErrors = [
					'Expense title is required',
					'Expense amount must be a positive integer',
					'Invalid excluded expense amount',
					'Invalid tax amount',
					'Invalid tax rate',
				];

				if(badRequestErrors.includes(error.message)) {
					return reply.code(400).send({
						error: error.message,
					});
				}

				if(error.message === 'Group not found' ||
					error.message === 'Payer not found'
				) {
					return reply.code(404).send({
						error: error.message,
					});
				}

				if(error.message === 'Only group members can create expenses' ||
					error.message === 'Payer must be a member of the group'
				) {
					return reply.code(403).send({
						error: error.message,
					});
				}

				if(error.message === 'Expenses cannot be changed while the group is paused' ||
					error.message === 'Expenses cannot be changed in a completed group'
				) {
					return reply.code(409).send({
						error: error.message,
					})
				}
			}

			request.log.error(error);

			return reply.code(500).send({
				error: 'Internal server error',
			});
		}
	});

	server.get<{Params: {id: string;};}>('/api/expenses/:id', {
		preHandler: authenticate,
	}, async (request, reply) => {
		try {
			return {
				expense: expenseService.getExpense(
					request.params.id,
					request.user.id,
                    request.user.username,
				),
			};
		} 
        catch (error) {
			if(error instanceof Error &&
				error.message === 'Expense not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message === 'You are not a member of this group'
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

	server.get<{Params: {groupId: string;};}>('/api/groups/:groupId/expenses', {
		preHandler: authenticate,
	}, async (request, reply) => {
		try {
			return {
				expenses: expenseService.listExpenses(
					request.params.groupId,
					request.user.id,
                    request.user.username,
				),
			};
		} 
        catch (error) {
			if(error instanceof Error &&
				error.message === 'Group not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message === 'You are not a member of this group'
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

	server.patch<{
		Params: {
			id: string;
		};
		Body: {
			title: string;
			description?: string;
			amount_cents: number;
			excluded_amount_cents?: number;
			exclusions?: {
				user_id: string;
				amount_cents: number;
			}[];
			tax_cents?: number;
			tax_rate_basis_points?: number;
			paid_by: string;
			paid_by_uid: string;
			occurred_at: string;
		};
	}>('/api/expenses/:id', {
		preHandler: authenticate,
		schema: {
			body: {
				type: 'object',
				required: [
					'title',
					'amount_cents',
					'paid_by',
					'paid_by_uid',
					'occurred_at',
				],
				additionalProperties: false,
				properties: {
					title: {
						type: 'string',
						minLength: 1,
					},
					description: {
						type: 'string',
					},
					amount_cents: {
						type: 'integer',
						minimum: 1,
					},
					excluded_amount_cents: {
						type: 'integer',
						minimum: 0,
					},
					exclusions: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							required: [
								'user_id',
								'amount_cents',
							],
							properties: {
								user_id: {
									type: 'string',
									minLength: 1,
								},
								amount_cents: {
									type: 'integer',
									minimum: 1,
								},
							},
						},
					},
					tax_cents: {
						type: 'integer',
						minimum: 0,
					},
					tax_rate_basis_points: {
						type: 'integer',
						minimum: 0,
					},
					paid_by: {
						type: 'string',
						minLength: 1,
					},
					paid_by_uid: {
						type: 'string',
						minLength: 1,
					},
					occurred_at: {
						type: 'string',
						minLength: 1,
					},
				},
			},
		},
	}, async (request, reply) => {
		try {
			const expense = expenseService.updateExpense(
				request.params.id,
				request.user.id,
				request.user.username,
				{
					title: request.body.title,
					description: request.body.description,
					amountCents: request.body.amount_cents,
					excludedAmountCents: request.body.excluded_amount_cents,
					exclusions: request.body.exclusions?.map((exclusion) => ({
						userId: exclusion.user_id,
						amountCents: exclusion.amount_cents,
					})),
					taxCents: request.body.tax_cents,
					taxRateBasisPoints: request.body.tax_rate_basis_points,
					paidBy: request.body.paid_by,
					paidByUid: request.body.paid_by_uid,
					occurredAt: request.body.occurred_at,
				},
			);

			return {
				expense,
			};
		} 
		catch (error) {
			if(error instanceof Error) {
				const badRequestErrors = [
					'Expense title is required',
					'Expense amount must be a positive integer',
					'Invalid excluded expense amount',
					'Invalid tax amount',
					'Invalid tax rate',
				];

				if(badRequestErrors.includes(error.message)) {
					return reply.code(400).send({
						error: error.message,
					});
				}

				if(error.message === 'Expense not found' ||
					error.message === 'Payer not found'
				) {
					return reply.code(404).send({
						error: error.message,
					});
				}

				if(error.message === 'You are not a member of this group' ||
					error.message === 'You are not allowed to modify this expense'
				) {
					return reply.code(403).send({
						error: error.message,
					});
				}

				if(error.message === 'Payer must be a member of the group') {
					return reply.code(403).send({
						error: error.message,
					});
				}

				if(error.message === 'Expenses cannot be changed while the group is paused' ||
					error.message === 'Expenses cannot be changed in a completed group'
				) {
					return reply.code(409).send({
						error: error.message,
					})
				}
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
	}>('/api/expenses/:id', {
		preHandler: authenticate,
	}, async (request, reply) => {
		try {
			expenseService.deleteExpense(
				request.params.id,
				request.user.id,
				request.user.username,
			);

			return {
				success: true,
			};
		} 
		catch (error) {
			if(error instanceof Error &&
				error.message === 'Expense not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(error instanceof Error && (error.message === 'You are not a member of this group' || 
				error.message === 'You are not allowed to modify this expense')
			) {
				return reply.code(403).send({
					error: error.message,
				});
			}

			if(error instanceof Error && (error.message === 'Expenses cannot be changed while the group is paused' ||
					error.message === 'Expenses cannot be changed in a completed group')
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
}