import type Database from 'better-sqlite3';

export interface Settlement {
	id: string;
	group_id: string;
	from_user_id: string;
	to_user_id: string;
	amount_cents: number;
	settled_at: string;
}

export class SettlementsRepository {
	private readonly db: Database.Database
    
    constructor(db: Database.Database) {
        this.db = db;
    }

	createSettlement(id: string, groupId: string, fromUserId: string, toUserId: string, amountCents: number): Settlement {
		this.db.prepare(`
			INSERT INTO settlements (
				id,
				group_id,
				from_user_id,
				to_user_id,
				amount_cents
			)
			VALUES (?, ?, ?, ?, ?)
		`).run(
			id,
			groupId,
			fromUserId,
			toUserId,
			amountCents,
		);

		return this.getSettlement(id)!;
	}

	getSettlement(id: string): Settlement | undefined {
		return this.db.prepare(`
			SELECT
				id,
				group_id,
				from_user_id,
				to_user_id,
				amount_cents,
				settled_at
			FROM settlements
			WHERE id = ?
		`).get(id) as Settlement | undefined;
	}

	getSettlements(groupId: string): Settlement[] {
		return this.db.prepare(`
			SELECT
				id,
				group_id,
				from_user_id,
				to_user_id,
				amount_cents,
				settled_at
			FROM settlements
			WHERE group_id = ?
			ORDER BY settled_at ASC, id ASC
		`).all(groupId) as Settlement[];
	}

	deleteSettlement(groupId: string, settlementId: string): boolean {
		const result = this.db.prepare(`
			DELETE FROM settlements
			WHERE id = ?
				AND group_id = ?
		`).run(
			settlementId,
			groupId,
		);

		return result.changes > 0;
	}
}