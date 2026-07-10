import {
	LayoutDashboard,
	Building2,
	Package,
	ArrowRightLeft,
	Wrench,
	Users,
	FileBarChart2,
	Bell,
	ScrollText,
	Settings,
	DatabaseBackup,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/backend/types/school'

export type NavItem = {
	label: string
	icon: LucideIcon
	path: string
	roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
	{ label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['super_admin', 'department_admin', 'staff'] },
	{ label: 'Departments', icon: Building2, path: '/departments', roles: ['super_admin'] },
	{ label: 'Facilities', icon: Building2, path: '/facilities', roles: ['super_admin', 'department_admin', 'staff'] },
	{ label: 'Inventory', icon: Package, path: '/inventory', roles: ['super_admin', 'department_admin', 'staff'] },
	{ label: 'Borrowing', icon: ArrowRightLeft, path: '/borrowing', roles: ['super_admin', 'department_admin', 'staff'] },
	{ label: 'Maintenance', icon: Wrench, path: '/maintenance', roles: ['super_admin', 'department_admin', 'staff'] },
	{ label: 'Users', icon: Users, path: '/users', roles: ['super_admin', 'department_admin'] },
	{ label: 'Reports', icon: FileBarChart2, path: '/reports', roles: ['super_admin', 'department_admin'] },
	{ label: 'Notifications', icon: Bell, path: '/notifications', roles: ['super_admin', 'department_admin', 'staff'] },
	{ label: 'Audit Logs', icon: ScrollText, path: '/audit-logs', roles: ['super_admin'] },
	{ label: 'System Settings', icon: Settings, path: '/settings', roles: ['super_admin'] },
	{ label: 'Backup & Restore', icon: DatabaseBackup, path: '/backup', roles: ['super_admin'] },
]

export function navItemsForRole(role: Role) {
	return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function isRouteAllowed(path: string, role: Role) {
	const item = NAV_ITEMS.find((entry) => entry.path === path)
	return item ? item.roles.includes(role) : true
}
