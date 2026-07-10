import type { Role } from '@/backend/types/school'

export const roleLabels: Record<Role, string> = {
	super_admin: 'Super Administrator',
	department_admin: 'Department Administrator',
	staff: 'Staff',
}

export const rolePermissions: Record<Role, string[]> = {
	super_admin: [
		'Full CRUD on all modules',
		'Manage every department',
		'Assign roles and departments',
		'Activate or deactivate accounts',
		'Reset passwords',
		'View all reports and audit logs',
		'Backup and restore data',
	],
	department_admin: [
		'Manage department facilities and inventory',
		'Approve borrowing requests',
		'Approve maintenance requests',
		'View department reports only',
		'Assign inventory to rooms',
		'Manage department staff accounts',
	],
	staff: [
		'View department inventory',
		'Search inventory',
		'Submit borrow requests',
		'Return borrowed equipment',
		'Submit maintenance requests',
		'View request history',
	],
}

export function getRoleLabel(role: Role) {
	return roleLabels[role]
}