import { request } from './client';

export interface Expense {
	id: string;
	group_id: string;
	title: string;
	description: string | null;
	amount_cents: number;
	excluded_amount_cents: number;
	tax_cents: number;
	tax_rate_basis_points: number | null;
	paid_by: string;
	paid_by_uid: string;
	created_by: string;
	created_by_uid: string;
	occurred_at: string;
	created_at: string;
	updated_at: string;
	exclusions: ExpenseExclusion[];
}

export interface ExpenseExclusion {
	id: string;
	expense_id: string;
	user_id: string;
	amount_cents: number;
	created_at: string;
}

export interface CreateExpenseInput {
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
}

interface ExpenseResponse {
	expense: Expense;
}

interface ExpensesResponse {
	expenses: Expense[];
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
	const response = await request<ExpenseResponse>(
		'/api/expenses',
		{
			method: 'POST',
			body: JSON.stringify(input),
		},
	);

	return response.expense;
}

export async function getExpense(expenseId: string): Promise<Expense> {
	const response = await request<ExpenseResponse>(
		`/api/expenses/${encodeURIComponent(expenseId)}`,
	);

	return response.expense;
}

export async function getGroupExpenses(groupId: string): Promise<Expense[]> {
	const response = await request<ExpensesResponse>(
		`/api/groups/${encodeURIComponent(groupId)}/expenses`,
	);

	return response.expenses;
}

export async function updateExpense(expenseId: string, input: CreateExpenseInput): Promise<Expense> {
	const response = await request<ExpenseResponse>(
		`/api/expenses/${encodeURIComponent(expenseId)}`,
		{
			method: 'PATCH',
			body: JSON.stringify(input),
		},
	);

	return response.expense;
}

export async function deleteExpense(expenseId: string): Promise<void> {
	await request<{success: boolean}>(
		`/api/expenses/${encodeURIComponent(expenseId)}`,
		{
			method: 'DELETE',
		},
	);
}
