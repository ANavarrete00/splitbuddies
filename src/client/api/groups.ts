import { request } from './client';

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

export interface Settlement {
    id: string;
    group_id: string;
    from_user_id: string;
    to_user_id: string;
    amount_cents: number;
    settled_at: string;
}

export interface GroupSettlementSuggestionsResponse {
    suggestions: {
        fromUserId: string;
        toUserId: string;
        amountCents: number;
    }[];
}

interface GroupsResponse {groups: Group[];}
interface GroupResponse {group: Group;}
interface GroupDetailResponse {group: Group;}
interface GroupMembersResponse {members: GroupMember[];}
interface AddGroupMembersResponse {members: GroupMember[];}
interface UpdateGroupMemberSharePercentageResponse {member: GroupMember;}
interface GroupBalancesResponse {balances: GroupBalance[];}
interface GroupSettlementsResponse {settlements: Settlement[];}
interface GroupSettlementResponse {settlement: Settlement;}

export async function getGroups(): Promise<Group[]> {
    const response = await request<GroupsResponse>('/api/groups');

    return response.groups;
}

export async function createGroup(name: string): Promise<Group> {
    const response = await request<GroupResponse>('/api/groups',
        {
            method: 'POST',
            body: JSON.stringify({ name }),
        },
    );

    return response.group;
}

export async function updateGroup(groupId: string, name: string): Promise<Group> {
	const response = await request<GroupResponse>(`/api/groups/${encodeURIComponent(groupId)}`,
		{
			method: 'PATCH',
			body: JSON.stringify({
				name,
			}),
		},
	);

	return response.group;
}

export async function deleteGroup(groupId: string): Promise<void> {
	await request<{success: boolean}>(`/api/groups/${encodeURIComponent(groupId)}`,
		{
			method: 'DELETE',
		},
	);
}

export async function changeGroupStatus(groupId: string, action: 'pause' | 'resume' | 'complete'): Promise<Group> {
    const response = await request<GroupResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/${action}`,
        {
            method: 'POST',
        },
    );

    return response.group;
}

export async function getGroup(groupId: string): Promise<Group> {
    const response = await request<GroupDetailResponse>(
        `/api/groups/${encodeURIComponent(groupId)}`,
    );

    return response.group;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const response = await request<GroupMembersResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/members`,
    );

    return response.members;
}

export async function addFriendsToGroup(groupId: string, friendIds: string[]): Promise<GroupMember[]> {
    const response = await request<AddGroupMembersResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/members`,
        {
            method: 'POST',
            body: JSON.stringify({
                friend_ids: friendIds,
            }),
        },
    );

    return response.members;
}

export async function updateGroupMemberSharePercentage(groupId: string, userId: string, sharePercentageBasisPoints: number): Promise<GroupMember> {
    const response = await request<UpdateGroupMemberSharePercentageResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/share-percentage`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                share_percentage_basis_points: sharePercentageBasisPoints,
            }),
        },
    );

    return response.member;
}

export async function updateGroupBalanceVisibility(groupId: string, balanceVisibility: 'private' | 'group'): Promise<Group> {
    const response = await request<{ group: Group }>(
        `/api/groups/${encodeURIComponent(groupId)}/balance-visibility`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                balanceVisibility,
            }),
        },
    );

    return response.group;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
	await request<{success: boolean}>(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
		{
			method: 'DELETE',
		},
	);
}

export async function leaveGroup(groupId: string): Promise<void> {
	await request<{success: boolean}>(`/api/groups/${encodeURIComponent(groupId)}/leave`,
		{
			method: 'POST',
		},
	);
}

export async function getGroupBalances(groupId: string): Promise<GroupBalance[]> {
    const response = await request<GroupBalancesResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/balances`,
    );

    return response.balances;
}

export async function getGroupSettlementSuggestions(groupId: string): Promise<GroupSettlementSuggestionsResponse['suggestions']> {
    const response = await request<GroupSettlementSuggestionsResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/settlement-suggestions`,
    );
    return response.suggestions;
}

export async function getGroupSettlements(groupId: string): Promise<Settlement[]> {
    const response = await request<GroupSettlementsResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/settlements`,
    );
    return response.settlements;
}

export async function createGroupSettlement(groupId: string, fromUserId: string, toUserId: string, amountCents: number): Promise<Settlement> {
    const response = await request<GroupSettlementResponse>(
        `/api/groups/${encodeURIComponent(groupId)}/settlements`,
        {
            method: 'POST',
            body: JSON.stringify({
                from_user_id: fromUserId,
                to_user_id: toUserId,
                amount_cents: amountCents,
            }),
        },
    );

    return response.settlement;
}

export async function deleteGroupSettlement(groupId: string, settlementId: string): Promise<void> {
    await request<{success: boolean}>(
        `/api/groups/${encodeURIComponent(groupId)}/settlements/${encodeURIComponent(settlementId)}`,
        {
            method: 'DELETE',
        },
    );
}
