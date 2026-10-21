import type Database from 'better-sqlite3';

export interface Group {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    balance_visibility: 'private' | 'group';
    status: 'active' | 'paused' | 'completed';
}

export interface GroupMember {
    group_id: string;
    user_id: string;
    username: string;
    role: 'owner' | 'member';
    share_percentage_basis_points: number;
    joined_at: string;
}

export class GroupsRepository {
    private readonly db: Database.Database;
    
    constructor(db: Database.Database) {
        this.db = db;
    }

    runInTransaction<T>(callback: () => T): T {
        return this.db.transaction(callback)();
    }

    createGroup(id: string, name: string, createdBy: string): Group {
        this.db.prepare(`
            INSERT INTO groups (
                id,
                name,
                created_by
            )
            VALUES (?, ?, ?)
        `)
        .run(id, name, createdBy);

        return this.getGroupById(id)!;
    }

    updateGroup(id: string, name: string): Group {
        this.db.prepare(`
            UPDATE groups
            SET
                name = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `)
        .run(name, id);

        return this.getGroupById(id)!;
    }

    updateBalanceVisibility(groupId: string, balanceVisibility: 'private' | 'group'): Group {
        this.db.prepare(`
            UPDATE groups
            SET
                balance_visibility = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `)
        .run(balanceVisibility, groupId);

        return this.getGroupById(groupId)!;
    }

    updateStatus(groupId: string, status: Group['status']): Group {
        this.db.prepare(`
            UPDATE groups
            SET
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, groupId);

        const group = this.getGroupById(groupId);
        if(!group) {
            throw new Error('Group not found');
        }

        return group;
    }

    pauseGroup(groupId: string): Group {
        return this.updateStatus(groupId, 'paused');
    }

    resumeGroup(groupId: string): Group {
        return this.updateStatus(groupId, 'active');
    }

    completeGroup(groupId: string): Group {
        return this.updateStatus(groupId, 'completed');
    }

    deleteGroup(id: string): void {
        this.db.transaction(() => {
            // Expenses are historical records tied to the group, so they are
            // removed only when the entire group is intentionally deleted.
            this.db.prepare(`
                DELETE FROM expenses
                WHERE group_id = ?
            `)
            .run(id);

            // Membership records belong to the group and can be removed
            // independently of the users they represent.
            this.db.prepare(`
                DELETE FROM group_members
                WHERE group_id = ?
            `)
            .run(id);

            this.db.prepare(`
                DELETE FROM groups
                WHERE id = ?
            `)
            .run(id);
        })();
    }

    getGroupById(id: string): Group | null {
        const group = this.db.prepare(`
            SELECT
                id,
                name,
                created_by,
                created_at,
                updated_at,
                balance_visibility,
                status
            FROM groups
            WHERE id = ?
        `)
        .get(id) as Group | undefined;

        return group ?? null;
    }

    getGroupsForUser(userId: string): Group[] {
        return this.db.prepare(`
            SELECT
                g.id,
                g.name,
                g.created_by,
                g.created_at,
                g.updated_at,
                g.balance_visibility,
                g.status
            FROM groups g
            INNER JOIN group_members gm
            ON gm.group_id = g.id
            WHERE gm.user_id = ?
            ORDER BY g.created_at DESC
        `)
        .all(userId) as Group[];
    }

    addMember(groupId: string, userId: string, username: string, role: 'owner' | 'member' = 'member'): GroupMember {
        this.db.prepare(`
            INSERT INTO group_members (
                group_id,
                user_id,
                username,
                role
            )
            VALUES (?, ?, ?, ?)
        `)
        .run(groupId, userId, username, role);

        return this.getMember(groupId, userId, username)!;
    }

    removeMember(groupId: string, userId: string): void {
        this.db.prepare(`
            DELETE FROM group_members
            WHERE group_id = ?
            AND user_id = ?
        `)
        .run(groupId, userId);
    }

    getMember(groupId: string, userId: string, username: string): GroupMember | null {
        const member = this.db.prepare(`
            SELECT
                group_id,
                user_id,
                username,
                role,
                share_percentage_basis_points,
                joined_at
            FROM group_members
            WHERE group_id = ?
            AND user_id = ?
            AND username = ?
        `)
        .get(groupId, userId, username) as GroupMember | undefined;

        return member ?? null;
    }

    updateMemberSharePercentage(groupId: string, userId: string, sharePercentageBasisPoints: number): GroupMember {
        this.db.prepare(`
            UPDATE group_members
            SET share_percentage_basis_points = ?
            WHERE group_id = ?
            AND user_id = ?
        `)
        .run(sharePercentageBasisPoints, groupId, userId);

        const member = this.db.prepare(`
            SELECT
                group_id,
                user_id,
                username,
                role,
                share_percentage_basis_points,
                joined_at
            FROM group_members
            WHERE group_id = ?
            AND user_id = ?
        `)
        .get(groupId, userId) as GroupMember | undefined;

        if(
            !member) {
            throw new Error('Group member not found');
        }

        return member;
    }

    getMembers(groupId: string): GroupMember[] {
        return this.db.prepare(`
            SELECT
                group_id,
                user_id,
                username,
                role,
                share_percentage_basis_points,
                joined_at
            FROM group_members
            WHERE group_id = ?
            ORDER BY joined_at ASC
        `)
        .all(groupId) as GroupMember[];
    }
}
