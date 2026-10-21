import { randomUUID } from 'node:crypto';

import type { Group, GroupMember } from '../repositories/groups.repository.ts';
import { GroupsRepository } from '../repositories/groups.repository.ts';
import { FriendsRepository } from '../repositories/friends.repository.ts';
import { ExpensesRepository } from '../repositories/expenses.repository.ts';
import { GroupBalanceService } from './group-balance.service.ts';
import { SettlementsRepository } from '../repositories/settlements.repository.ts';
import { NotificationsService } from './notification.service.ts';

export interface SettlementSuggestion {
    fromUserId: string;
    toUserId: string;
    amountCents: number;
}
export class GroupService {
    private readonly repository: GroupsRepository;
    private readonly friendsRepository: FriendsRepository;
    private readonly expensesRepository: ExpensesRepository;
    private readonly balanceService: GroupBalanceService;
    private readonly settlementsRepository: SettlementsRepository;
    private readonly notificationsService: NotificationsService;

    constructor(repository: GroupsRepository, friendsRepository: FriendsRepository, expensesRepository: ExpensesRepository, balanceService: GroupBalanceService, settlementsRepository: SettlementsRepository, notificationsServie: NotificationsService) {
        this.repository = repository;
        this.friendsRepository = friendsRepository;
        this.expensesRepository = expensesRepository;
        this.balanceService = balanceService;
        this.settlementsRepository = settlementsRepository;
        this.notificationsService = notificationsServie;
    }

    createGroup(name: string, userId: string, username: string): Group {
        const normalizedName = name.trim();

        if(!normalizedName) {
            throw new Error('Group name is required');
        }

        if(normalizedName.length > 100) {
            throw new Error(
                'Group name must be 100 characters or fewer',
            );
        }

        const groupId = randomUUID();

        // The group and its owner membership must be created together;
        // otherwise a successful group insert could leave an unusable group.
        const createGroup = this.repository.createGroup.bind(this.repository);
        const addMember = this.repository.addMember.bind(this.repository);

        return this.repository.runInTransaction(() => {
            const group = createGroup(groupId, normalizedName, userId);

            addMember(group.id, userId, username, 'owner');

            return group;
        });
    }

    updateGroup(groupId: string, name: string, requestingUserId: string, requestingUsername: string): Group {
        this.ensureGroupIsNotCompleted(groupId);

        const requester = this.requireMembership(
            groupId,
            requestingUserId,
            requestingUsername,
        );

        if(requester.role !== 'owner') {
            throw new Error('Only the group owner can edit the group');
        }

        const normalizedName = name.trim();

        if(!normalizedName) {
            throw new Error('Group name is required');
        }

        if(normalizedName.length > 100) {
            throw new Error(
                'Group name must be 100 characters or fewer',
            );
        }

        return this.repository.updateGroup(
            groupId,
            normalizedName,
        );
    }

    deleteGroup(groupId: string, requestingUserId: string, requestingUsername: string): void {
        this.ensureGroupIsNotCompleted(groupId);

        const requester = this.requireMembership(groupId, requestingUserId, requestingUsername);
        if(requester.role !== 'owner') {
            throw new Error('Only the group owner can delete the group');
        }

        const group = this.repository.getGroupById(groupId);
        if(!group) {
            throw new Error('Group not found');
        }

        const members = this.repository.getMembers(groupId);
        for(const member of members) {
            if(member.user_id === requestingUserId) {
                continue;
            }

            this.notificationsService.createNotification(member.user_id, 'group_deleted', 'Group deleted',
                `${requestingUsername} deleted the group "${group.name}".`,
                requestingUserId,
            );
        }

        this.repository.deleteGroup(groupId);
    }

    getGroup(groupId: string, userId: string, username: string): Group {
        this.requireMembership(groupId, userId, username);

        const group = this.repository.getGroupById(groupId);

        if(!group) {
            throw new Error('Group not found');
        }

        return group;
    }

    listGroups(userId: string): Group[] {
        return this.repository.getGroupsForUser(userId);
    }

    getMembers( groupId: string, userId: string, username: string): GroupMember[] {
        this.requireMembership(groupId, userId, username);

        return this.repository.getMembers(groupId);
    }

    addMember(groupId: string, userId: string, username: string, requestingUserId: string): GroupMember {
        const requester = this.requireMembership(groupId, requestingUserId, username);

        if(requester.role !== 'owner') {
            throw new Error('Only the group owner can add members');
        }

        return this.repository.addMember(groupId, userId, username);
    }

    updateMemberSharePercentage(groupId: string, userId: string, sharePercentageBasisPoints: number, requestingUserId: string): GroupMember {
        this.ensureGroupIsNotCompleted(groupId);

        const members = this.repository.getMembers(groupId);
        const requester = members.find((member) => member.user_id === requestingUserId);

        if(!requester) {
            throw new Error('Group membership required');
        }

        if(requester.role !== 'owner') {
            throw new Error('Only the group owner can update member share percentages');
        }

        if(!Number.isInteger(sharePercentageBasisPoints) ||
            sharePercentageBasisPoints < 0 ||
            sharePercentageBasisPoints > 10000
        ) {
            throw new Error('Share percentage must be between 0% and 100%');
        }

        const member = members.find((groupMember) => groupMember.user_id === userId);

        if(!member) {
            throw new Error('Group member not found');
        }

        return this.repository.updateMemberSharePercentage(groupId, userId, sharePercentageBasisPoints);
    }

    addFriendsToGroup(groupId: string, requestingUserId: string, friendIds: string[]): GroupMember[] {
        const group = this.repository.getGroupById(groupId);
        if(!group) {
            throw new Error('Group not found');
        }
        if(group.status === 'paused') {
            throw new Error('Friends cannot be added while the group is paused');
        }
        if(group.status === 'completed') {
            throw new Error('Completed groups cannot be modified');
        }

        if(friendIds.length === 0) {
            throw new Error('At least one friend is required');
        }

        // Remove duplicate IDs so selecting the same friend twice cannot
        // cause a UNIQUE constraint failure during the transation
        const uniqueFriendIds = [...new Set(friendIds)];

        return this.repository.runInTransaction(() => {
            const group = this.repository.getGroupById(groupId);

            if(!group) {
                throw new Error('Group not found');
            }

            // getMember() currently also checks username, so the owner
			// lookup below is performed separately using the group's
			// existing member records.
			const members = this.repository.getMembers(groupId);
            const requester = members.find((member) => member.user_id == requestingUserId);

			if(!requester) {
				throw new Error('Group membership required');
			}

			if(requester.role !== 'owner') {
				throw new Error('Only the group owner can add members');
			}

			const friends = this.friendsRepository.getFriendsForUser(requestingUserId);

			const friendsById = new Map(friends.map((friend) => [
                friend.user.id, 
                friend.user,
            ]));

			const existingMemberIds = new Set(members.map((member) => member.user_id));

			const membersToAdd: GroupMember[] = [];

			for (const friendId of uniqueFriendIds) {
				const friend = friendsById.get(friendId);

				if(!friend) {
					throw new Error('One or more selected users are not friends');
				}

				if(existingMemberIds.has(friendId)) {
					throw new Error(`${friend.username} is already a member of this group`);
				}

				const member = this.repository.addMember(groupId, friend.id, friend.username);

                this.notificationsService.createNotification(member.user_id, 'group_added', 'Added to group', 
                    `${requester.username} added you to ${group.name}.`,
                    requestingUserId,
                )

				membersToAdd.push(member);
				existingMemberIds.add(friendId);
			}

			return membersToAdd;
        });
    }

    removeMember(groupId: string, userId: string, requestingUserId: string, requestingUsername: string): void {
        this.ensureGroupIsNotCompleted(groupId);

        const requester = this.requireMembership(groupId, requestingUserId, requestingUsername);

        if(userId === requester.user_id) {
            throw new Error('The group owner cannot leave the group');
        }

        if(requester.role !== 'owner') {
            throw new Error(
                'Only the group owner can remove another member',
            );
        }

        const members = this.repository.getMembers(groupId);
        const member = members.find((groupMember) => groupMember.user_id === userId);

        if(!member) {
            throw new Error('Group member not found');
        }

        if(member.role === 'owner') {
            throw new Error('The group owner cannot be removed');
        }

        this.repository.removeMember(groupId, userId);
        this.notificationsService.createNotification(member.user_id, 'group_removed', 'Removed from group',
            `${requester.username} removed you from ${this.repository.getGroupById(groupId)?.name ?? 'a group'}.`,
            requestingUserId,
        )
    }

    leaveGroup(groupId: string, userId: string, username: string): void {
        this.ensureGroupIsNotCompleted(groupId);
        
        const member = this.requireMembership(groupId, userId, username);

        if(member.role === 'owner') {
            throw new Error('The group owner cannot leave the group');
        }

        this.repository.removeMember(groupId, userId);
    }

    getBalances(groupId: string, userId: string, username: string) {
        const group = this.repository.getGroupById(groupId);

        if(!group) {
            throw new Error('Group not found');
        }

        const membership = this.repository.getMember(groupId, userId, username);

        if(!membership) {
            throw new Error('Group membership required');
        }

        const members = this.repository.getMembers(groupId);
        const expenses = this.expensesRepository.listForGroup(groupId);
        const settlements = this.settlementsRepository.getSettlements(groupId);

        const balances = this.balanceService.calculateBalances(
            members,
            expenses,
            settlements,
        );

        if(group.balance_visibility === 'private') {
            return balances.filter(
                (balance) => balance.userId === userId,
            );
        }

        return balances;
    }

    updateBalanceVisibility(groupId: string, balanceVisibility: 'private' | 'group', requestingUserId: string): Group {
        this.ensureGroupIsNotCompleted(groupId);

        const group = this.repository.getGroupById(groupId);

        if(!group) {
            throw new Error('Group not found');
        }

        const members = this.repository.getMembers(groupId);
        const requester = members.find(
            (member) => member.user_id === requestingUserId,
        );

        if(!requester) {
            throw new Error('Group membership required');
        }

        if(requester.role !== 'owner') {
            throw new Error(
                'Only the group owner can update group settings',
            );
        }

        if(balanceVisibility !== 'private' && balanceVisibility !== 'group') {
            throw new Error('Invalid balance visibility');
        }

        return this.repository.updateBalanceVisibility(
            groupId,
            balanceVisibility,
        );
    }

    getSettlementSuggestions(groupId: string, userId: string, username: string): SettlementSuggestion[] {
        const group = this.repository.getGroupById(groupId);
        if(!group) {
            throw new Error('Group not found');
        }

        const membership = this.repository.getMember(groupId, userId, username);
        if(!membership) {
            throw new Error('Group membership required');
        }

        const members = this.repository.getMembers(groupId);
        const expenses = this.expensesRepository.listForGroup(groupId);
        const settlements = this.settlementsRepository.getSettlements(groupId);

        const balances = this.balanceService.calculateBalances(members, expenses, settlements);

        const requestingUserBalance = balances.find(
            (balance) => balance.userId === userId,
        );

        if(!requestingUserBalance || requestingUserBalance.netBalanceCents === 0) {
            return [];
        }

        const debtors = balances
            .filter((balance) => balance.netBalanceCents < 0)
            .map((balance) => ({
                userId: balance.userId,
                remainingCents: -balance.netBalanceCents,
            }));

        const creditors = balances
            .filter((balance) => balance.netBalanceCents > 0)
            .map((balance) => ({
                userId: balance.userId,
                remainingCents: balance.netBalanceCents,
            }));

        const suggestions: SettlementSuggestion[] = [];
        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const debtor = debtors[debtorIndex];
            const creditor = creditors[creditorIndex];
            const amountCents = Math.min(debtor.remainingCents, creditor.remainingCents);

            if(amountCents > 0 && (
                debtor.userId === userId ||
                creditor.userId === userId
            )) {
                suggestions.push({
                    fromUserId: debtor.userId,
                    toUserId: creditor.userId,
                    amountCents,
                });
            }

            debtor.remainingCents -= amountCents;
            creditor.remainingCents -= amountCents;

            if(debtor.remainingCents === 0) {
                debtorIndex++;
            }

            if(creditor.remainingCents === 0) {
                creditorIndex++;
            }
        }

        return suggestions;
    }

    pauseGroup(groupId: string, requestingUserId: string, requestingUsername: string): Group {
        return this.changeGroupStatus(groupId, requestingUserId, requestingUsername, 'paused');
    }

    resumeGroup(groupId: string, requestingUserId: string, requestingUsername: string): Group {
        return this.changeGroupStatus(groupId, requestingUserId, requestingUsername, 'active');
    }

    completeGroup(groupId: string, requestingUserId: string, requestingUsername: string): Group {
        return this.changeGroupStatus(groupId, requestingUserId, requestingUsername, 'completed');
    }

    private changeGroupStatus(groupId: string, requestingUserId: string, requestingUsername: string, newStatus: Group['status']): Group {
        const requester = this.requireMembership(groupId, requestingUserId, requestingUsername);
        if(requester.role !== 'owner') {
            throw new Error('Only the group owner can change group status');
        }

        const group = this.repository.getGroupById(groupId);
        if(!group) {
            throw new Error('Group not found');
        }

        if(group.status === 'completed') {
            throw new Error('A completed group cannot be changed');
        }

        if(group.status === newStatus) {
            throw new Error(`Group is already ${newStatus}`);
        }

        if(newStatus === 'paused' && group.status !== 'active') {
            throw new Error('Only an active group can be paused');
        }

        if(newStatus === 'active' && group.status !== 'paused') {
            throw new Error('Only a paused group can be resumed');
        }

        if(newStatus === 'completed' && group.status !== 'paused') {
            throw new Error('Pause the group before completing it');
        }

        if(newStatus === 'completed') {
            const members = this.repository.getMembers(groupId);
            const expenses = this.expensesRepository.listForGroup(groupId);
            const settlements = this.settlementsRepository.getSettlements(groupId);
            const balances = this.balanceService.calculateBalances(members, expenses, settlements);

            if(balances.some((balance) => balance.netBalanceCents !== 0)) {
                throw new Error('All group balances must be settled before completing the group');
            }
        }

        const updatedGroup = this.repository.updateStatus(groupId, newStatus);

        const messages = {
            paused: {
                title: 'Group paused',
                message: `${requester.username} paused the group "${group.name}". New expenses are disabled, but settlements can continue.`,
            },
            active: {
                title: 'Group resumed',
                message: `${requester.username} resumed the group "${group.name}".`,
            },
            completed: {
                title: 'Group completed',
                message: `${requester.username} completed the group "${group.name}".`,
            },
        } as const;

        const notification = messages[newStatus];

        for (const member of this.repository.getMembers(groupId)) {
            if(member.user_id === requestingUserId) {
                continue;
            }

            this.notificationsService.createNotification(member.user_id, 'group_status_changed', notification.title, notification.message, requestingUserId);
        }

        return updatedGroup;
    }

    private ensureGroupIsNotCompleted(groupId: string): void {
        const group = this.repository.getGroupById(groupId);
        if(!group) {
            throw new Error('Group not found');
        }

        if(group.status === 'completed') {
            throw new Error('Completed groups cannot be modified');
        }
    }

    private requireMembership(groupId: string, userId: string, username: string): GroupMember {
        const member = this.repository.getMember(groupId, userId, username);

        if(!member) {
            throw new Error('Group membership required');
        }

        return member;
    }
}
