import type { Role } from '@/backend/types/school'

export const roleLabels: Record<Role, string> = {
	super_admin: 'Super Administrator',
	department_admin: 'Department Administrator',
	// The stored role value stays 'staff' (DB check constraint, RLS policies,
	// edge functions, and usernames like bscs.staff all key off it) — only
	// what's displayed to users changed.
	staff: 'Faculty',
	student: 'Student',
}

export function getRoleLabel(role: Role) {
	return roleLabels[role]
}