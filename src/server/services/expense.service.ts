import { randomUUID } from 'node:crypto';

import type { Expense } from '../repositories/expenses.repository.ts';
import { ExpensesRepository } from '../repositories/expenses.repository.ts';
import { getUserById } from '../repositories/users.repository.ts';
import { GroupsRepository } from '../repositories/groups.repository.ts';
import { NotificationsService } from './notification.service.ts';

export interface CreateExpenseInput {
	groupId: string;
	title: string;
	description?: string;
	amountCents: number;
	excludedAmountCents?: number;
	exclusions?: ExpenseExclusionInput[];
	taxCents?: number;
	taxRateBasisPoints?: number;
	paidBy: string;
    paidByUid: string;
	createdBy: string;
    createdByUid: string;
	occurredAt: string;
}

export interface ExpenseExclusionInput {
	userId: string;
	amountCents: number;
}

export class ExpenseService {
	private readonly repository: ExpensesRepository;
	private readonly groupsRepository: GroupsRepository;
	private readonly notificationsService: NotificationsService;

	constructor(repository: ExpensesRepository, groupsRepository: GroupsRepository, notificationsService: NotificationsService) {
		this.repository = repository;
		this.groupsRepository = groupsRepository;
		this.notificationsService = notificationsService;
	}

	private ensureGroupAllowsExpenseChanges(groupStatus: 'active' | 'paused' | 'completed'): void {
		if(groupStatus === 'paused') {
			throw new Error('Expenses cannot be changed while the group is paused');
		}

		if(groupStatus === 'completed') {
			throw new Error('Expenses cannot be changed in a completed group');
		}
	}

	private canManageExpense(expense: Expense, userId: string, username: string): boolean {
		const membership = this.groupsRepository.getMember(expense.group_id, userId, username);

		if(!membership) {
			throw new Error('You are not a member of this group');
		}

		if(membership.role === 'owner') {
			return true;
		}

		if(expense.created_by_uid === userId) {
			return true;
		}

		if(expense.paid_by_uid === userId) {
			return true;
		}

		return false;
	}

	private validateExclusions(groupId: string, excludedAmountCents: number, exclusions: ExpenseExclusionInput[] = []): void {
		if(excludedAmountCents === 0) {
			if(exclusions.length > 0) {
				throw new Error(
					'Expense exclusions cannot be assigned when the excluded amount is zero',
				);
			}

			return;
		}

		if(exclusions.length === 0) {
			throw new Error(
				'Excluded expense amount must be assigned to at least one group member',
			);
		}

		const assignedUserIds = new Set<string>();
		let totalAssignedCents = 0;

		for (const exclusion of exclusions) {
			if(assignedUserIds.has(exclusion.userId)) {
				throw new Error(
					'Each group member can only be assigned once per expense',
				);
			}

			assignedUserIds.add(exclusion.userId);

			if(!Number.isInteger(exclusion.amountCents) || exclusion.amountCents <= 0) {
				throw new Error(
					'Excluded expense amounts must be positive integers',
				);
			}

			const user = getUserById(exclusion.userId);

			if(!user) {
				throw new Error('Excluded expense member not found');
			}

			const membership = this.groupsRepository.getMember(groupId, exclusion.userId, user.username);

			if(!membership) {
				throw new Error(
					'Excluded expense member must be a member of the group',
				);
			}

			totalAssignedCents += exclusion.amountCents;
		}

		if(totalAssignedCents !== excludedAmountCents) {
			throw new Error(
				'Excluded expense assignments must equal the excluded expense amount',
			);
		}
	}

	createExpense(input: CreateExpenseInput): Expense {
		const title = input.title.trim();
		if(!title) {
			throw new Error('Expense title is required');
		}

		if(!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
			throw new Error('Expense amount must be a positive integer');
		}

		const excludedAmountCents = input.excludedAmountCents ?? 0;
		if(!Number.isInteger(excludedAmountCents) ||
			excludedAmountCents < 0 ||
			excludedAmountCents > input.amountCents
		) {
			throw new Error('Invalid excluded expense amount');
		}

		this.validateExclusions(input.groupId, excludedAmountCents, input.exclusions);

		const taxCents = input.taxCents ?? 0;
		if(!Number.isInteger(taxCents) ||
			taxCents < 0 ||
			taxCents > input.amountCents
		) {
			throw new Error('Invalid tax amount');
		}

		if(input.taxRateBasisPoints !== undefined &&
			(
				!Number.isInteger(input.taxRateBasisPoints) ||
				input.taxRateBasisPoints < 0
			)
		) {
			throw new Error('Invalid tax rate');
		}

		const group = this.groupsRepository.getGroupById(input.groupId);
		if(!group) {
			throw new Error('Group not found');
		}

		this.ensureGroupAllowsExpenseChanges(group.status);

		const creatorMembership = this.groupsRepository.getMember(input.groupId, input.createdByUid, input.createdBy);
		if(!creatorMembership) {
			throw new Error('Only group members can create expenses');
		}

		const payerMembership = this.groupsRepository.getMember(input.groupId, input.paidByUid, input.paidBy);
		if(!payerMembership) {
			throw new Error('Payer must be a member of the group');
		}

		const payer = getUserById(input.paidByUid);
		if(!payer) {
			throw new Error('Payer not found');
		}

		const expense: Expense = {
			id: randomUUID(),
			group_id: input.groupId,
			title,
			description: input.description?.trim() || null,
			amount_cents: input.amountCents,
			excluded_amount_cents: excludedAmountCents,
			tax_cents: taxCents,
			tax_rate_basis_points: input.taxRateBasisPoints ?? null,
			paid_by: input.paidBy,
            paid_by_uid: input.paidByUid,
			created_by: input.createdBy,
            created_by_uid: input.createdByUid,
			occurred_at: input.occurredAt,
			created_at: '',
			updated_at: '',
		};

		const exclusions = (input.exclusions ?? []).map((exclusion) => ({
			id: randomUUID(),
			expense_id: expense.id,
			user_id: exclusion.userId,
			amount_cents: exclusion.amountCents,
			created_at: '',
		}));

		const createdExpense = this.repository.createWithExclusions(expense, exclusions);
		const members = this.groupsRepository.getMembers(input.groupId);

		// create expense notification for all group members except for the user who created the expense.
		for (const member of members) {
			if(member.user_id === input.createdByUid) {
				continue;
			}

			this.notificationsService.createNotification(
				member.user_id,
				'expense_added',
				'New expense added',
				`${input.createdBy} added "${title}" expense to ${group.name}.`,
				input.createdByUid,
			);
		}

		return createdExpense;
	}

	getExpense(expenseId: string, userId: string, username: string): Expense {
		const expense = this.repository.getById(expenseId);

		if(!expense) {
			throw new Error('Expense not found');
		}

		const membership = this.groupsRepository.getMember(
			expense.group_id,
			userId,
            username,
		);

		if(!membership) {
			throw new Error('You are not a member of this group');
		}

		return expense;
	}

	listExpenses(groupId: string, userId: string, username: string): Expense[] {
		const group = this.groupsRepository.getGroupById(groupId);

		if(!group) {
			throw new Error('Group not found');
		}

		const membership = this.groupsRepository.getMember(
			groupId,
			userId,
            username
		);

		if(!membership) {
			throw new Error('You are not a member of this group');
		}

		return this.repository.listForGroup(groupId);
	}

	updateExpense(expenseId: string, userId: string, username: string, input: {
		title: string;
		description?: string;
		amountCents: number;
		excludedAmountCents?: number;
		exclusions?: ExpenseExclusionInput[];
		taxCents?: number;
		taxRateBasisPoints?: number;
		paidBy: string;
		paidByUid: string;
		occurredAt: string;
	}): Expense {
		const expense = this.repository.getById(expenseId);
		if(!expense) {
			throw new Error('Expense not found');
		}
		
		const group = this.groupsRepository.getGroupById(expense.group_id);
		if(!group) {
			throw new Error('Group not found');
		}

		this.ensureGroupAllowsExpenseChanges(group.status);

		if(!this.canManageExpense(expense, userId, username)) {
			throw new Error('You are not allowed to modify this expense');
		}

		const title = input.title.trim();
		if(!title) {
			throw new Error('Expense title is required');
		}

		if(!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
			throw new Error('Expense amount must be a positive integer');
		}

		const excludedAmountCents = input.excludedAmountCents ?? 0;
		if(!Number.isInteger(excludedAmountCents) ||
			excludedAmountCents < 0 ||
			excludedAmountCents > input.amountCents
		) {
			throw new Error('Invalid excluded expense amount');
		}

		this.validateExclusions(expense.group_id, excludedAmountCents, input.exclusions);

		const taxCents = input.taxCents ?? 0;
		if(!Number.isInteger(taxCents) || taxCents < 0 || taxCents > input.amountCents) {
			throw new Error('Invalid tax amount');
		}

		if(input.taxRateBasisPoints !== undefined && (!Number.isInteger(input.taxRateBasisPoints) || input.taxRateBasisPoints < 0)) {
			throw new Error('Invalid tax rate');
		}

		const payerMembership = this.groupsRepository.getMember(expense.group_id, input.paidByUid, input.paidBy);
		if(!payerMembership) {
			throw new Error('Payer must be a member of the group');
		}

		const payer = getUserById(input.paidByUid);
		if(!payer) {
			throw new Error('Payer not found');
		}

		const updatedExpense: Expense = {
			...expense,
			title,
			description: input.description?.trim() || null,
			amount_cents: input.amountCents,
			excluded_amount_cents: excludedAmountCents,
			tax_cents: taxCents,
			tax_rate_basis_points: input.taxRateBasisPoints ?? null,
			paid_by: input.paidBy,
			paid_by_uid: input.paidByUid,
			occurred_at: input.occurredAt,
		};

		const exclusions = (input.exclusions ?? []).map((exclusion) => ({
			id: randomUUID(),
			expense_id: expense.id,
			user_id: exclusion.userId,
			amount_cents: exclusion.amountCents,
			created_at: '',
		}));

		const updated = this.repository.updateWithExclusions(updatedExpense, exclusions);
		const members = this.groupsRepository.getMembers(expense.group_id);
		

		// Notify all group members except the user who edited the expense.
		for(const member of members) {
			if(member.user_id === userId) {
				continue;
			}

			this.notificationsService.createNotification(member.user_id, 'expense_edited', 'Expense updated',
				`${username} updated "${title}" expense in ${this.groupsRepository.getGroupById(expense.group_id)?.name ?? 'your group'}.`,
				userId,
			);
		}
		return updated;
	}

	deleteExpense(expenseId: string, userId: string, username: string): void {
		const expense = this.repository.getById(expenseId);
		if(!expense) {
			throw new Error('Expense not found');
		}

		if(!this.canManageExpense(expense, userId, username)) {
			throw new Error('You are not allowed to modify this expense');
		}

		const group = this.groupsRepository.getGroupById(expense.group_id);
		if(!group) {
			throw new Error('Group not found');
		}

		this.ensureGroupAllowsExpenseChanges(group.status);
		const members = this.groupsRepository.getMembers(expense.group_id);
		this.repository.delete(expenseId);

		// Notify all group members except the user who deleted the expense.
		for(const member of members) {
			if(member.user_id === userId) {
				continue;
			}

			this.notificationsService.createNotification(member.user_id, 'expense_deleted', 'Expense deleted',
				`${username} deleted "${expense.title}" expense from ${group.name}.`,
				userId,
			);
		}
	}
}