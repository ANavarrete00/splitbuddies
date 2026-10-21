export const notificationTypes = [
	'expense_added',
	'expense_edited',
	'expense_deleted',
	'expense_excluded',
	'settlement_created',
	'settlement_deleted',
	'group_added',
	'group_removed',
	'group_deleted',
	'group_status_changed',
	'friend_request',
] as const;

export type NotificationType = typeof notificationTypes[number];