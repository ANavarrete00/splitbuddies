import type { FastifyInstance } from 'fastify';

import { authenticate } from '../auth/middleware.js';
import type { GroupService } from '../services/group.service.js';
import type { SettlementsService } from '../services/settlements.service.js';

export async function groupsRoutes(server: FastifyInstance, groupService: GroupService, settlementsService: SettlementsService): Promise<void> {
    // Create a new group for the authenticated user
    server.post<{
        Body: {
            name: string;
        };
    }>('/api/groups', {
        preHandler: authenticate,
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                additionalProperties: false,
                properties: {
                    name: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 100,
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const group = groupService.createGroup(
                request.body.name,
                request.user.id,
                request.user.username,
        );

        return reply.code(201).send({
            group,
        });
        } 
        catch (error) {
            if(error instanceof Error && 
                (
                    error.message === 'Group name is required' ||
                    error.message === 'Group name must be 100 characters or fewer'
                )
            ) {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    // Get all groups that the authenticated user belongs to
    server.get('/api/groups', {
        preHandler: authenticate,
    }, async (request) => {
        return {
            groups: groupService.listGroups(
                request.user.id,
            ),
        };
    });

    // Get the details of a selected group
    server.get<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            return {
                group: groupService.getGroup(
                    request.params.id,
                    request.user.id,
                    request.user.username,
                ),
            };
        } 
        catch (error) {
            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: 'Group membership required',
                });
            }

            if(
                error instanceof Error &&
                error.message === 'Group not found'
            ) {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    // Update the name of an existing group
    server.patch<{
        Params: {
            id: string;
        };
        Body: {
            name: string;
        };
    }>('/api/groups/:id', {
        preHandler: authenticate,
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                additionalProperties: false,
                properties: {
                    name: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 100,
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const group = groupService.updateGroup(
                request.params.id,
                request.body.name,
                request.user.id,
                request.user.username,
            );

            return {group,};
        }
        catch (error) {
            if(error instanceof Error &&
                (
                    error.message === 'Group name is required' ||
                    error.message === 'Group name must be 100 characters or fewer'
                )
            ) {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                error.message === 'Only the group owner can edit the group'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Completed groups cannot be modified') {
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

    server.patch<{
        Params: {
            id: string;
        };
        Body: {
            balanceVisibility: 'private' | 'group';
        };
    }>('/api/groups/:id/balance-visibility', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            return {
                group: groupService.updateBalanceVisibility(
                    request.params.id,
                    request.body.balanceVisibility,
                    request.user.id,
                ),
            };
        }
        catch (error) {
            if(error instanceof Error && error.message === 'Group not found') {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            if(error instanceof Error && error.message === 'Group membership required') {
                return reply.code(403).send({
                    error: 'Group membership required',
                });
            }

            if(error instanceof Error && error.message === 'Only the group owner can update group settings') {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Invalid balance visibility') {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Completed groups cannot be modified') {
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
    
    // Pause, resume, or complete a group
    for (const action of ['pause', 'resume', 'complete'] as const) {
        server.post<{
            Params: { id: string };
        }>(`/api/groups/:id/${action}`, {
            preHandler: authenticate,
        }, async (request, reply) => {
            try {
                let group;

                if(action === 'pause') {
                    group = groupService.pauseGroup(
                        request.params.id,
                        request.user.id,
                        request.user.username,
                    );
                } else if(action === 'resume') {
                    group = groupService.resumeGroup(
                        request.params.id,
                        request.user.id,
                        request.user.username,
                    );
                } else {
                    group = groupService.completeGroup(
                        request.params.id,
                        request.user.id,
                        request.user.username,
                    );
                }

                return reply.send({ group });
            } catch (error) {
                if(!(error instanceof Error)) {
                    request.log.error(error);
                    return reply.code(500).send({
                        error: 'Internal server error',
                    });
                }

                if(error.message === 'Group not found') {
                    return reply.code(404).send({
                        error: error.message,
                    });
                }

                if(
                    error.message === 'Group membership required' ||
                    error.message === 'Only the group owner can change group status'
                ) {
                    return reply.code(403).send({
                        error: error.message,
                    });
                }

                if(
                    error.message === 'A completed group cannot be changed' ||
                    error.message === 'Group is already paused' ||
                    error.message === 'Group is already active' ||
                    error.message === 'Pause the group before completing it' ||
                    error.message === 'Only an active group can be paused' ||
                    error.message === 'Only a paused group can be resumed' ||
                    error.message === 'All group balances must be settled before completing the group'
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

    // Delete a group and its associated group records
    server.delete<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            groupService.deleteGroup(
                request.params.id,
                request.user.id,
                request.user.username,
            );

            return {success: true,};
        }
        catch (error) {
            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                error.message === 'Only the group owner can delete the group'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Completed groups cannot be modified') {
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

    // Get all members of a group
    server.get<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id/members', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            return {
                members: groupService.getMembers(
                    request.params.id,
                    request.user.id,
                    request.user.username,
                ),
            };
        } 
        catch (error) {
            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: 'Group membership required',
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    // Add one or more friends to the group
	server.post<{
		Params: {
			id: string;
		};
		Body: {
			friend_ids: string[];
		};
	}>('/api/groups/:id/members', {
		preHandler: authenticate,
		schema: {
			body: {
				type: 'object',
				required: ['friend_ids'],
				additionalProperties: false,
				properties: {
					friend_ids: {
						type: 'array',
						minItems: 1,
						items: {
							type: 'string',
							minLength: 1,
						},
					},
				},
			},
		},
	}, async (request, reply) => {
		try {
			const members = groupService.addFriendsToGroup(
				request.params.id,
				request.user.id,
				request.body.friend_ids,
			);

			return reply.code(201).send({
				members,
			});
		} 
        catch (error) {
			if(error instanceof Error &&
				error.message === 'Group not found'
			) {
				return reply.code(404).send({
					error: 'Group not found',
				});
			}

			if(error instanceof Error &&
				error.message === 'Group membership required'
			) {
				return reply.code(403).send({
					error: 'Group membership required',
				});
			}

			if(error instanceof Error &&
				error.message === 'Only the group owner can add members'
			) {
				return reply.code(403).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message === 'One or more selected users are not friends'
			) {
				return reply.code(400).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message.includes('is already a member of this group')
			) {
				return reply.code(409).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message === 'At least one friend is required'
			) {
				return reply.code(400).send({
					error: error.message,
				});
			}

            if(error instanceof Error && (
                error.message === 'Completed groups cannot be modified' ||
                error.message === 'Friends cannot be added while the group is paused'
            )) {
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

    // Update a group member's share percentage
	server.patch<{
		Params: {
			id: string;
			userId: string;
		};
		Body: {
			share_percentage_basis_points: number;
		};
	}>('/api/groups/:id/members/:userId/share-percentage', {
		preHandler: authenticate,
		schema: {
			body: {
				type: 'object',
				required: ['share_percentage_basis_points'],
				additionalProperties: false,
				properties: {
					share_percentage_basis_points: {
						type: 'integer',
						minimum: 0,
						maximum: 10000,
					},
				},
			},
		},
	}, async (request, reply) => {
		try {
			const member = groupService.updateMemberSharePercentage(
				request.params.id,
				request.params.userId,
				request.body.share_percentage_basis_points,
				request.user.id,
			);

			return reply.send({
				member,
			});
		}
		catch (error) {
			if(error instanceof Error &&
				error.message === 'Group membership required'
			) {
				return reply.code(403).send({
					error: 'Group membership required',
				});
			}

			if(error instanceof Error &&
				error.message === 'Only the group owner can update member share percentages'
			) {
				return reply.code(403).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message === 'Group member not found'
			) {
				return reply.code(404).send({
					error: error.message,
				});
			}

			if(error instanceof Error &&
				error.message === 'Share percentage must be between 0% and 100%'
			) {
				return reply.code(400).send({
					error: error.message,
				});
			}

            if(error instanceof Error && error.message === 'Completed groups cannot be modified') {
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

    // Remove a member from the group
    server.delete<{
        Params: {
            id: string;
            userId: string;
        };
    }>('/api/groups/:id/members/:userId', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            groupService.removeMember(
                request.params.id,
                request.params.userId,
                request.user.id,
                request.user.username,
            );

            return {success: true,};
        }
        catch (error) {
            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                error.message === 'Only the group owner can remove another member'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                error.message === 'Group member not found'
            ) {
                return reply.code(404).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                (
                    error.message === 'The group owner cannot leave the group' ||
                    error.message === 'The group owner cannot be removed'
                )
            ) {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Completed groups cannot be modified') {
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

    // Allow a non-owner member to leave the group 
    server.post<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id/leave', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            groupService.leaveGroup(
                request.params.id,
                request.user.id,
                request.user.username,
            );

            return {success: true,};
        }
        catch (error) {
            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error &&
                error.message === 'The group owner cannot leave the group'
            ) {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Completed groups cannot be modified') {
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

    // Get the calculated balances for all members of a group
    server.get<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id/balances', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            return {
                balances: groupService.getBalances(
                    request.params.id,
                    request.user.id,
                    request.user.username,
                ),
            };
        }
        catch (error) {
            if(error instanceof Error && error.message === 'Group not found') {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            if(error instanceof Error &&
                error.message === 'Group membership required'
            ) {
                return reply.code(403).send({
                    error: 'Group membership required',
                });
            }

            if(error instanceof Error &&
                error.message === 'Group member share percentages must total 100%'
            ) {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    // Get settlement suggestions involving the authenticated user
    server.get<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id/settlement-suggestions', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            return {
                suggestions: groupService.getSettlementSuggestions(
                    request.params.id,
                    request.user.id,
                    request.user.username,
                ),
            };
        }
        catch (error) {
            if(error instanceof Error && error.message === 'Group not found') {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            if(error instanceof Error && error.message === 'Group membership required') {
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

    // Get all settlements for a group
    server.get<{
        Params: {
            id: string;
        };
    }>('/api/groups/:id/settlements', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            return {
                settlements: settlementsService.getSettlements(
                    request.params.id,
                    request.user.id,
                ),
            };
        }
        catch (error) {
            if(error instanceof Error && error.message === 'Group not found') {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            if(error instanceof Error && error.message === 'You are not a member of this group') {
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

    // Record a settlement between two group members
    server.post<{
        Params: {
            id: string;
        };
        Body: {
            from_user_id: string;
            to_user_id: string;
            amount_cents: number;
        };
    }>('/api/groups/:id/settlements', {
        preHandler: authenticate,
        schema: {
            body: {
                type: 'object',
                required: [
                    'from_user_id',
                    'to_user_id',
                    'amount_cents',
                ],
                additionalProperties: false,
                properties: {
                    from_user_id: {
                        type: 'string',
                        minLength: 1,
                    },
                    to_user_id: {
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
    }, async (request, reply) => {
        try {
            const settlement = settlementsService.createSettlement(
                request.params.id,
                request.body.from_user_id,
                request.body.to_user_id,
                request.body.amount_cents,
                request.user.id,
            );

            return reply.code(201).send({
                settlement,
            });
        }
        catch (error) {
            if(error instanceof Error && error.message === 'Group not found') {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            if(error instanceof Error && error.message === 'You are not a member of this group') {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && (
                error.message === 'Settlement sender is not a member of this group' ||
                error.message === 'Settlement recipient is not a member of this group')
            ) {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Settlement participants must be different users') {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Settlement amount must be a positive number of cents') {
                return reply.code(400).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Settlements cannot be changed in a completed group') {
                return reply.code(409).send({
                    error: error.message,
                })
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    // Delete a recorded settlement
    server.delete<{
        Params: {
            id: string;
            settlementId: string;
        };
    }>('/api/groups/:id/settlements/:settlementId', {
        preHandler: authenticate,
    }, async (request, reply) => {
        try {
            settlementsService.deleteSettlement(
                request.params.id,
                request.params.settlementId,
                request.user.id,
            );

            return {
                success: true,
            };
        }
        catch (error) {
            if(error instanceof Error && error.message === 'Group not found') {
                return reply.code(404).send({
                    error: 'Group not found',
                });
            }

            if(error instanceof Error && error.message === 'You are not a member of this group') {
                return reply.code(403).send({
                    error: error.message,
                });
            }

            if(error instanceof Error && error.message === 'Settlement not found') {
                return reply.code(404).send({
                    error: 'Settlement not found',
                });
            }

            if(error instanceof Error && error.message === 'Settlements cannot be changed in a completed group') {
                return reply.code(409).send({
                    error: error.message,
                })
            }
            
            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });
}