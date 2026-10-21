import type Database from 'better-sqlite3';

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
    exclusions?: ExpenseExclusion[];
}

export interface ExpenseExclusion {
	id: string;
	expense_id: string;
	user_id: string;
	amount_cents: number;
	created_at: string;
}

export class ExpensesRepository {
	private readonly db: Database.Database;

	constructor(db: Database.Database) {
		this.db = db;
	}

	create(expense: Omit<Expense, 'exclusions'>): Expense {
		this.db.prepare(`
            INSERT INTO expenses (
                id,
                group_id,
                title,
                description,
                amount_cents,
                excluded_amount_cents,
                tax_cents,
                tax_rate_basis_points,
                paid_by,
                paid_by_uid,
                created_by,
                created_by_uid,
                occurred_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
            expense.id,
            expense.group_id,
            expense.title,
            expense.description,
            expense.amount_cents,
            expense.excluded_amount_cents,
            expense.tax_cents,
            expense.tax_rate_basis_points,
            expense.paid_by,
            expense.paid_by_uid,
            expense.created_by,
            expense.created_by_uid,
            expense.occurred_at,
        );

		return this.getById(expense.id)!;
	}

    createWithExclusions(expense: Omit<Expense, 'exclusions'>, exclusions: ExpenseExclusion[]): Expense {
		const transaction = this.db.transaction(() => {
			this.db.prepare(`
				INSERT INTO expenses (
					id,
					group_id,
					title,
					description,
					amount_cents,
					excluded_amount_cents,
					tax_cents,
					tax_rate_basis_points,
					paid_by,
					paid_by_uid,
					created_by,
					created_by_uid,
					occurred_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				expense.id,
				expense.group_id,
				expense.title,
				expense.description,
				expense.amount_cents,
				expense.excluded_amount_cents,
				expense.tax_cents,
				expense.tax_rate_basis_points,
				expense.paid_by,
				expense.paid_by_uid,
				expense.created_by,
				expense.created_by_uid,
				expense.occurred_at,
			);

			for (const exclusion of exclusions) {
				this.createExclusion(exclusion);
			}
		});

		transaction();

		return this.getById(expense.id)!;
	}

	getById(id: string): Expense | null {
		const expense = this.db.prepare(`
            SELECT
                id,
                group_id,
                title,
                description,
                amount_cents,
                excluded_amount_cents,
                tax_cents,
                tax_rate_basis_points,
                paid_by,
                paid_by_uid,
                created_by,
                created_by_uid,
                occurred_at,
                created_at,
                updated_at
            FROM expenses
            WHERE id = ?
        `)
        .get(id) as Expense | undefined;

        if(!expense) {
			return null;
		}

		return {
			...expense,
			exclusions: this.getExclusions(expense.id),
		};
	}

	listForGroup(groupId: string): Expense[] {
        const expenses = this.db.prepare(`
            SELECT
                id,
                group_id,
                title,
                description,
                amount_cents,
                excluded_amount_cents,
                tax_cents,
                tax_rate_basis_points,
                paid_by,
                paid_by_uid,
                created_by,
                created_by_uid,
                occurred_at,
                created_at,
                updated_at
            FROM expenses
            WHERE group_id = ?
            ORDER BY occurred_at DESC, created_at DESC
        `)
        .all(groupId) as Omit<Expense, 'exclusions'>[];

		return expenses.map((expense) => ({
			...expense,
			exclusions: this.getExclusions(expense.id),
		}));
	}

    update(expense: Omit<Expense, 'exclusions'>): Expense {
        this.db.prepare(`
            UPDATE expenses
            SET
                title = ?,
                description = ?,
                amount_cents = ?,
                excluded_amount_cents = ?,
                tax_cents = ?,
                tax_rate_basis_points = ?,
                paid_by = ?,
                paid_by_uid = ?,
                occurred_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            expense.title,
            expense.description,
            expense.amount_cents,
            expense.excluded_amount_cents,
            expense.tax_cents,
            expense.tax_rate_basis_points,
            expense.paid_by,
            expense.paid_by_uid,
            expense.occurred_at,
            expense.id,
        );

        return this.getById(expense.id)!;
    }

    delete(id: string): void {
        this.db.prepare(`
            DELETE FROM expenses
            WHERE id = ?
        `).run(id);
    }

    getExclusions(expenseId: string): ExpenseExclusion[] {
		return this.db.prepare(`
			SELECT
				id,
				expense_id,
				user_id,
				amount_cents,
				created_at
			FROM expense_exclusions
			WHERE expense_id = ?
			ORDER BY created_at ASC, id ASC
		`)
		.all(expenseId) as ExpenseExclusion[];
	}

	createExclusion(exclusion: ExpenseExclusion): ExpenseExclusion {
		this.db.prepare(`
			INSERT INTO expense_exclusions (
				id,
				expense_id,
				user_id,
				amount_cents
			)
			VALUES (?, ?, ?, ?)
		`).run(
			exclusion.id,
			exclusion.expense_id,
			exclusion.user_id,
			exclusion.amount_cents,
		);

		return this.db.prepare(`
			SELECT
				id,
				expense_id,
				user_id,
				amount_cents,
				created_at
			FROM expense_exclusions
			WHERE id = ?
		`).get(exclusion.id) as ExpenseExclusion;
	}

	deleteExclusions(expenseId: string): void {
		this.db.prepare(`
			DELETE FROM expense_exclusions
			WHERE expense_id = ?
		`).run(expenseId);
	}

    updateWithExclusions(expense: Omit<Expense, 'exclusions'>, exclusions: ExpenseExclusion[]): Expense {
		const transaction = this.db.transaction(() => {
			this.db.prepare(`
				UPDATE expenses
				SET
					title = ?,
					description = ?,
					amount_cents = ?,
					excluded_amount_cents = ?,
					tax_cents = ?,
					tax_rate_basis_points = ?,
					paid_by = ?,
					paid_by_uid = ?,
					occurred_at = ?,
					updated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`).run(
				expense.title,
				expense.description,
				expense.amount_cents,
				expense.excluded_amount_cents,
				expense.tax_cents,
				expense.tax_rate_basis_points,
				expense.paid_by,
				expense.paid_by_uid,
				expense.occurred_at,
				expense.id,
			);

			// Replacing the assignments keeps the expense's exclusions
			// synchronized with the new excluded amount when an expense
			// is edited.
			this.deleteExclusions(expense.id);

			for (const exclusion of exclusions) {
				this.createExclusion(exclusion);
			}
		});

		transaction();

		return this.getById(expense.id)!;
	}
}