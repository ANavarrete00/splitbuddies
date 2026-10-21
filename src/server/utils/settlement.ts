export const TOTAL_SHARE_BASIS_POINTS = 10_000;

export interface SettlementMember {
	id: string;
	username: string;
}

export interface SettlementExpense {
	paid_by_uid: string;
	amount_cents: number;
}

export interface SettlementShare {
	user_id: string;
	percentage_basis_points: number;
}

export type BalanceStatus = 'creditor' | 'debtor' | 'settled';

export interface MemberBalance {
	user_id: string;
	username: string;
	total_paid_cents: number;
	share_cents: number;
	net_cents: number;
	status: BalanceStatus;
}

export interface SettlementTransfer {
	from_user_id: string;
	from_username: string;
	to_user_id: string;
	to_username: string;
	amount_cents: number;
}

/* Creates the default equal split for all group members.

Percentages are stored as basis points:
10,000 = 100%.

When the members cannot divide 100% evenly, the extra basis
points are distributed from the beginning of the member list.
This guarantees that the shares always total exactly 100%. */

export function createEqualShares(members: SettlementMember[],): SettlementShare[] {
	if(members.length === 0) {
		return [];
	}

	const baseShare = Math.floor(TOTAL_SHARE_BASIS_POINTS / members.length,);

	const remainder = TOTAL_SHARE_BASIS_POINTS % members.length;

	return members.map((member, index) => ({
		user_id: member.id,
		percentage_basis_points: baseShare + (index < remainder ? 1 : 0),
	}));
}

/* Calculates each member's balance from the group's expenses
and the percentage shares chosen for settlement.

Positive net = creditor.
Negative net = debtor.
Zero net = settled. */

export function calculateBalances(members: SettlementMember[], expenses: SettlementExpense[], shares: SettlementShare[],): MemberBalance[] {
	validateShares(members, shares,);

	const memberIds = new Set(members.map((member) => member.id),);

	const totalPaidByUser = new Map<string, number>();

	for (const member of members) {
		totalPaidByUser.set(member.id, 0,);
	}

	let totalExpenseCents = 0;

	for (const expense of expenses) {
		if(!memberIds.has(expense.paid_by_uid)) {
			throw new Error(
				`Expense payer ${expense.paid_by_uid} is not a member of the group`,
			);
		}

		if(!Number.isInteger(expense.amount_cents) || expense.amount_cents < 0) {
			throw new Error(
				'Expense amount must be a non-negative integer number of cents',
			);
		}

		const currentPaid = totalPaidByUser.get(expense.paid_by_uid,) ?? 0;

		totalPaidByUser.set(expense.paid_by_uid, currentPaid + expense.amount_cents,);

		totalExpenseCents += expense.amount_cents;
	}

	const shareAmounts = calculateShareAmounts(
		totalExpenseCents,
		members,
		shares,
	);

	return members.map((member) => {
		const totalPaidCents = totalPaidByUser.get(member.id) ?? 0;
		const shareCents = shareAmounts.get(member.id) ?? 0;
		const netCents = totalPaidCents - shareCents;

		return {
			user_id: member.id,
			username: member.username,
			total_paid_cents: totalPaidCents,
			share_cents: shareCents,
			net_cents: netCents,
			status: getBalanceStatus(netCents),
		};
	});
}

/**
 * Turns the calculated balances into suggested payments.
 *
 * Creditors are matched against debtors until all balances reach
 * zero. The largest remaining balances are matched first, which
 * keeps the number of suggested transfers reasonably small.
 */
export function calculateSettlementTransfers(
	balances: MemberBalance[],
): SettlementTransfer[] {
	const creditors = balances
		.filter((balance) => balance.net_cents > 0)
		.map((balance) => ({
			...balance,
			remaining_cents: balance.net_cents,
		}))
		.sort((a, b) => b.remaining_cents - a.remaining_cents);

	const debtors = balances
		.filter((balance) => balance.net_cents < 0)
		.map((balance) => ({
			...balance,
			remaining_cents: Math.abs(balance.net_cents),
		}))
		.sort((a, b) => b.remaining_cents - a.remaining_cents);

	const transfers: SettlementTransfer[] = [];

	let creditorIndex = 0;
	let debtorIndex = 0;

	while (
		creditorIndex < creditors.length &&
		debtorIndex < debtors.length
	) {
		const creditor = creditors[creditorIndex];
		const debtor = debtors[debtorIndex];

		const amountCents = Math.min(
			creditor.remaining_cents,
			debtor.remaining_cents,
		);

		if(amountCents > 0) {
			transfers.push({
				from_user_id: debtor.user_id,
				from_username: debtor.username,
				to_user_id: creditor.user_id,
				to_username: creditor.username,
				amount_cents: amountCents,
			});
		}

		creditor.remaining_cents -= amountCents;
		debtor.remaining_cents -= amountCents;

		if(creditor.remaining_cents === 0) {
			creditorIndex += 1;
		}

		if(debtor.remaining_cents === 0) {
			debtorIndex += 1;
		}
	}

	return transfers;
}

/**
 * Calculates both the member balances and the suggested
 * payments in a single operation.
 */
export function calculateSettlement(
	members: SettlementMember[],
	expenses: SettlementExpense[],
	shares: SettlementShare[],
): {
	balances: MemberBalance[];
	transfers: SettlementTransfer[];
} {
	const balances = calculateBalances(
		members,
		expenses,
		shares,
	);

	const transfers = calculateSettlementTransfers(
		balances,
	);

	return {
		balances,
		transfers,
	};
}

/**
 * Converts the requested percentages into exact cent amounts.
 *
 * The final member receives the remaining cents instead of having
 * their amount independently rounded. This guarantees that all
 * member shares add up exactly to the group's total expenses.
 */
function calculateShareAmounts(
	totalExpenseCents: number,
	members: SettlementMember[],
	shares: SettlementShare[],
): Map<string, number> {
	const sharesByUserId = new Map(
		shares.map((share) => [
			share.user_id,
			share,
		]),
	);

	const shareAmounts = new Map<string, number>();
	let allocatedCents = 0;

	for (let index = 0; index < members.length; index += 1) {
		const member = members[index];
		const share = sharesByUserId.get(member.id);

		if(!share) {
			throw new Error(
				`Missing settlement share for member ${member.id}`,
			);
		}

		if(index === members.length - 1) {
			shareAmounts.set(
				member.id,
				totalExpenseCents - allocatedCents,
			);

			break;
		}

		const exactShare =
			(totalExpenseCents * share.percentage_basis_points) /
			TOTAL_SHARE_BASIS_POINTS;

		const shareCents = Math.floor(exactShare);

		shareAmounts.set(
			member.id,
			shareCents,
		);

		allocatedCents += shareCents;
	}

	return shareAmounts;
}

/**
 * Validates that the settlement contains exactly one share for
 * every current group member and that all shares total 100%.
 */
function validateShares(
	members: SettlementMember[],
	shares: SettlementShare[],
): void {
	const memberIds = new Set(
		members.map((member) => member.id),
	);

	const shareIds = new Set<string>();
	let totalBasisPoints = 0;

	for (const share of shares) {
		if(shareIds.has(share.user_id)) {
			throw new Error(
				`Duplicate settlement share for member ${share.user_id}`,
			);
		}

		if(!memberIds.has(share.user_id)) {
			throw new Error(
				'Settlement share belongs to a member outside the group',
			);
		}

		if(
			!Number.isInteger(share.percentage_basis_points) ||
			share.percentage_basis_points < 0
		) {
			throw new Error(
				'Settlement percentages must be non-negative integers',
			);
		}

		shareIds.add(share.user_id);
		totalBasisPoints += share.percentage_basis_points;
	}

	if(shareIds.size !== members.length) {
		throw new Error(
			'Every group member must have a settlement share',
		);
	}

	if(totalBasisPoints !== TOTAL_SHARE_BASIS_POINTS) {
		throw new Error(
			'Settlement percentages must add up to exactly 100%',
		);
	}
}

function getBalanceStatus(netCents: number,): BalanceStatus {
	if(netCents > 0) {
		return 'creditor';
	}

	if(netCents < 0) {
		return 'debtor';
	}

	return 'settled';
}