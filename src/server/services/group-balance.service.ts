import type { Expense } from '../repositories/expenses.repository.ts';
import type { GroupMember } from '../repositories/groups.repository.ts';
import type { Settlement } from '../repositories/settlements.repository.ts';

export interface GroupBalance {
	userId: string;
	username: string;
	totalPaidCents: number;
	sharePercentageBasisPoints: number;
	fairShareCents: number;
	excludedShareCents: number;
	totalOwedCents: number;
	netBalanceCents: number;
}

export class GroupBalanceService {
	calculateBalances(members: GroupMember[], expenses: Expense[], settlements: Settlement[]): GroupBalance[] {
		if(members.length === 0) {
			return [];
		}

		const memberIds = new Set(
			members.map((member) => member.user_id),
		);

		// A group with no configured percentages uses an equal split.
		// Once percentages are configured, every member must have an
		// explicit percentage and the total must equal exactly 100%.
		const hasConfiguredPercentage = members.some(
			(member) => member.share_percentage_basis_points > 0,
		);

		let sharePercentages: Map<string, number>;

		if(!hasConfiguredPercentage) {
			sharePercentages = this.createEqualSharePercentages(members);
		}
		else {
			const totalBasisPoints = members.reduce(
				(total, member) => total + member.share_percentage_basis_points,
				0,
			);

			if(totalBasisPoints !== 10000) {
				throw new Error(
					'Group member share percentages must total 100%',
				);
			}

			sharePercentages = new Map(
				members.map((member) => [
					member.user_id,
					member.share_percentage_basis_points,
				]),
			);
		}

		const totalPaidByMember = new Map<string, number>();
		const excludedShareByMember = new Map<string, number>();

		for(const member of members) {
			totalPaidByMember.set(member.user_id, 0);
			excludedShareByMember.set(member.user_id, 0);
		}

		let includedAmountCents = 0;

		for(const expense of expenses) {
			if(!memberIds.has(expense.paid_by_uid)) {
				throw new Error(
					`Expense payer ${expense.paid_by_uid} is not a member of the group`,
				);
			}

			// Payment credit is based on the full expense amount. An excluded
			// amount is still money the payer actually paid.
			totalPaidByMember.set(
				expense.paid_by_uid,
				totalPaidByMember.get(expense.paid_by_uid)! + expense.amount_cents,
			);

			const excludedAmountCents = expense.excluded_amount_cents;

			// The excluded portion is assigned directly to its specified
			// debtors and therefore does not participate in the normal
			// percentage-based split.
			for(const exclusion of expense.exclusions ?? []) {
				if(!memberIds.has(exclusion.user_id)) {
					throw new Error(
						`Expense exclusion member ${exclusion.user_id} is not a member of the group`,
					);
				}

				excludedShareByMember.set(
					exclusion.user_id,
					excludedShareByMember.get(exclusion.user_id)! + exclusion.amount_cents,
				);
			}

			includedAmountCents += expense.amount_cents - excludedAmountCents;
		}

		const fairShareByMember = this.allocatePercentageAmount(includedAmountCents, members, sharePercentages);

		const netBalanceByMember = new Map<string, number>();

		for(const member of members) {
			const fairShareCents = fairShareByMember.get(member.user_id)!;
			const excludedShareCents = excludedShareByMember.get(member.user_id)!;
			const totalOwedCents = fairShareCents + excludedShareCents;
			const totalPaidCents = totalPaidByMember.get(member.user_id)!;

			netBalanceByMember.set(
				member.user_id,
				totalPaidCents - totalOwedCents,
			);
		}

		for(const settlement of settlements) {
			if(!memberIds.has(settlement.from_user_id)) {
				throw new Error(
					`Settlement sender ${settlement.from_user_id} is not a member of the group`,
				);
			}

			if(!memberIds.has(settlement.to_user_id)) {
				throw new Error(
					`Settlement recipient ${settlement.to_user_id} is not a member of the group`,
				);
			}

			netBalanceByMember.set(
				settlement.from_user_id,
				netBalanceByMember.get(settlement.from_user_id)! + settlement.amount_cents,
			);

			netBalanceByMember.set(
				settlement.to_user_id,
				netBalanceByMember.get(settlement.to_user_id)! - settlement.amount_cents,
			);
		}

		return members.map((member) => {
			const fairShareCents = fairShareByMember.get(member.user_id)!;
			const excludedShareCents = excludedShareByMember.get(member.user_id)!;
			const totalOwedCents = fairShareCents + excludedShareCents;
			const totalPaidCents = totalPaidByMember.get(member.user_id)!;

			return {
				userId: member.user_id,
				username: member.username,
				totalPaidCents,
				sharePercentageBasisPoints: sharePercentages.get(member.user_id)!,
				fairShareCents,
				excludedShareCents,
				totalOwedCents,
				netBalanceCents: netBalanceByMember.get(member.user_id)!,
			};
		});
	}

	private createEqualSharePercentages(members: GroupMember[]): Map<string, number> {
		const basePercentage = Math.floor(10000 / members.length);
		const remainder = 10000 % members.length;

		return new Map(
			members.map((member, index) => [
				member.user_id,
				basePercentage + (index < remainder ? 1 : 0),
			]),
		);
	}

	private allocatePercentageAmount(amountCents: number, members: GroupMember[], sharePercentages: Map<string, number>): Map<string, number> {
		const allocations = new Map<string, number>();
		const fractionalRemainders: Array<{userId: string; remainder: number;}> = [];

		let allocatedCents = 0;

		for(const member of members) {
			const basisPoints = sharePercentages.get(member.user_id)!;
			const numerator = amountCents * basisPoints;
			const cents = Math.floor(numerator / 10000);
			const remainder = numerator % 10000;

			allocations.set(member.user_id, cents);
			fractionalRemainders.push({
				userId: member.user_id,
				remainder,
			});

			allocatedCents += cents;
		}

		// Percentage multiplication can produce fractional cents. Distribute
		// the remaining cents deterministically so the allocations always
		// add up exactly to the included expense amount.
		let remainingCents = amountCents - allocatedCents;

		fractionalRemainders.sort((a, b) => {
			if(b.remainder !== a.remainder) {
				return b.remainder - a.remainder;
			}

			return a.userId.localeCompare(b.userId);
		});

		for(let index = 0; index < fractionalRemainders.length && remainingCents > 0; index++) {
			const userId = fractionalRemainders[index].userId;

			allocations.set(
				userId,
				allocations.get(userId)! + 1,
			);

			remainingCents--;
		}

		return allocations;
	}
}