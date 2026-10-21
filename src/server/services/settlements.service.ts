import { randomUUID } from 'node:crypto';
import { SettlementsRepository } from '../repositories/settlements.repository.ts';
import { GroupsRepository } from '../repositories/groups.repository.ts';
import { NotificationsService } from './notification.service.ts';
import type { Settlement } from '../repositories/settlements.repository.ts';

export class SettlementsService {
    private readonly settlementsRepository: SettlementsRepository;
    private readonly groupsRepository: GroupsRepository;
	private readonly notificationsService: NotificationsService;

	constructor(settlementsRepository: SettlementsRepository, groupsRepository: GroupsRepository, notificationsService: NotificationsService) {
        this.settlementsRepository = settlementsRepository;
        this.groupsRepository = groupsRepository;
		this.notificationsService = notificationsService;
    }

	private ensureGroupIsNotCompleted(groupId: string): void {
		const group = this.groupsRepository.getGroupById(groupId);
		if(!group) {
			throw new Error('Group not found');
		}

		if(group.status === 'completed') {
			throw new Error('Settlements cannot be changed in a completed group');
		}
	}

	createSettlement(groupId: string, fromUserId: string, toUserId: string, amountCents: number, requestingUserId: string): Settlement {
		this.ensureGroupIsNotCompleted(groupId);

		if(!Number.isInteger(amountCents) || amountCents <= 0) {
			throw new Error('Settlement amount must be a positive number of cents');
		}

		if(fromUserId === toUserId) {
			throw new Error('Settlement participants must be different users');
		}

		const members = this.groupsRepository.getMembers(groupId);
		if(members.length === 0) {
			throw new Error('Group not found');
		}

		const memberIds = new Set(members.map((member) => member.user_id));
		if(!memberIds.has(requestingUserId)) {
			throw new Error('You are not a member of this group');
		}

		if(requestingUserId !== fromUserId && requestingUserId !== toUserId) {
			throw new Error('You must be involved in the settlement');
		}

		if(!memberIds.has(fromUserId)) {
			throw new Error('Settlement sender is not a member of this group');
		}

		if(!memberIds.has(toUserId)) {
			throw new Error('Settlement recipient is not a member of this group');
		}

		const settlement = this.settlementsRepository.createSettlement(
			randomUUID(),
			groupId,
			fromUserId,
			toUserId,
			amountCents,
		);

		const group = this.groupsRepository.getGroupById(groupId);
		if(!group) {
			throw new Error('Group not found');
		}

		const requestingMember = members.find((member) => member.user_id === requestingUserId);
		if(!requestingMember) {
			throw new Error('Group membership required');
		}

		// Notify all group members except the user who created the settlement.
		for(const member of members) {
			if(member.user_id === requestingUserId) {
				continue;
			}

			this.notificationsService.createNotification(
				member.user_id,
				'settlement_created',
				'Settlement recorded',
				`${requestingMember.username} recorded a settlement in ${group.name}.`,
				requestingUserId,
			);
		}

		return settlement;
	}

	getSettlements(groupId: string, requestingUserId: string): Settlement[] {
		const members = this.groupsRepository.getMembers(groupId);

		if(members.length === 0) {
			throw new Error('Group not found');
		}

		if(!members.some((member) => member.user_id === requestingUserId)) {
			throw new Error('You are not a member of this group');
		}

		return this.settlementsRepository.getSettlements(groupId);
	}

	deleteSettlement(groupId: string, settlementId: string, requestingUserId: string): void {
		this.ensureGroupIsNotCompleted(groupId);

		const members = this.groupsRepository.getMembers(groupId);
		if(members.length === 0) {
			throw new Error('Group not found');
		}

		if(!members.some((member) => member.user_id === requestingUserId)) {
			throw new Error('You are not a member of this group');
		}

		const settlement = this.settlementsRepository.getSettlement(settlementId);
		if(!settlement || settlement.group_id !== groupId) {
			throw new Error('Settlement not found');
		}

		if(settlement.from_user_id !== requestingUserId && settlement.to_user_id !== requestingUserId) {
			throw new Error('You are not allowed to delete this settlement');
		}

		const group = this.groupsRepository.getGroupById(groupId);
		if(!group) {
			throw new Error('Group not found');
		}

		const requestingMember = members.find((member) => member.user_id === requestingUserId);
		if(!requestingMember) {
			throw new Error('Group membership required');
		}

		const deleted = this.settlementsRepository.deleteSettlement(groupId, settlementId);
		if(!deleted) {
			throw new Error('Settlement not found');
		}

		// Notify all group members except the user who deleted the settlement.
		for(const member of members) {
			if(member.user_id === requestingUserId) {
				continue;
			}

			this.notificationsService.createNotification(member.user_id, 'settlement_deleted', 'Settlement deleted',
				`${requestingMember.username} deleted a settlement from ${group.name}.`,
				requestingUserId,
			);
		}
	}
}