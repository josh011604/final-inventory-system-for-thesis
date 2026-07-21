import type { Role } from '@/backend/types/school'

export const roleLabels: Record<Role, string> = {
	super_admin: 'Super Administrator',
	department_admin: 'Department Administrator',
	staff: 'Staff',
	student: 'Student',
}

export function getRoleLabel(role: Role) {
	return roleLabels[role]
}