import type { ActivityItem, BorrowRequest, Facility, InventoryItem, MaintenanceRequest, Role, SchoolUser } from '@/backend/types/school'

export const roleLabels: Record<Role, string> = {
	super_admin: 'Super Administrator',
	department_admin: 'Department Administrator',
	staff: 'Staff',
}

export const roleModules: Record<Role, string[]> = {
	super_admin: [
		'Dashboard',
		'Departments',
		'Facilities',
		'Inventory',
		'Borrowing',
		'Maintenance',
		'Users',
		'Reports',
		'Notifications',
		'Audit Logs',
		'System Settings',
		'Backup & Restore',
	],
	department_admin: [
		'Dashboard',
		'Department Facilities',
		'Department Inventory',
		'Borrowing Approvals',
		'Maintenance Requests',
		'Department Staff',
		'Reports',
		'Notifications',
	],
	staff: ['Dashboard', 'Assigned Facilities', 'Inventory Search', 'Borrow Requests', 'Maintenance Requests', 'Request History', 'Notifications'],
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

export function scopeByDepartment<T extends { department: string }>(user: SchoolUser, rows: T[]) {
	return user.role === 'super_admin' ? rows : rows.filter((row) => row.department === user.department)
}

export function scopeInventory(user: SchoolUser, rows: InventoryItem[]) {
	return scopeByDepartment(user, rows)
}

export function scopeFacilities(user: SchoolUser, rows: Facility[]) {
	return scopeByDepartment(user, rows)
}

export function scopeBorrowRequests(user: SchoolUser, rows: BorrowRequest[]) {
	return scopeByDepartment(user, rows)
}

export function scopeMaintenanceRequests(user: SchoolUser, rows: MaintenanceRequest[]) {
	return scopeByDepartment(user, rows)
}

export function scopeActivities(user: SchoolUser, rows: ActivityItem[]) {
	return user.role === 'super_admin' ? rows : rows.slice(0, 4)
}

export function getScopedDepartments(user: SchoolUser, departments: string[]) {
	return user.role === 'super_admin' ? departments : [user.department]
}