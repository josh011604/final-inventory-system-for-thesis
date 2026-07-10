import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthScreen from '@/frontend/features/auth/AuthScreen'
import DashboardScreen from '@/frontend/features/dashboard/DashboardScreen'
import AppShell from '@/components/layout/AppShell'
import ComingSoonPage from '@/components/ui/ComingSoonPage'
import DepartmentsPage from '@/frontend/features/departments/DepartmentsPage'
import FacilitiesPage from '@/frontend/features/facilities/FacilitiesPage'
import InventoryPage from '@/frontend/features/inventory/InventoryPage'
import BorrowingPage from '@/frontend/features/borrowing/BorrowingPage'
import MaintenancePage from '@/frontend/features/maintenance/MaintenancePage'
import UsersPage from '@/frontend/features/users/UsersPage'
import NotificationsPage from '@/frontend/features/notifications/NotificationsPage'
import AuditLogsPage from '@/frontend/features/audit-logs/AuditLogsPage'
import { supabase } from '@/backend/lib/supabase/client'
import { signOut } from '@/backend/lib/supabase/auth'
import type { Role, SchoolUser, ThemeMode } from '@/backend/types/school'
import { usePersistentState } from '@/backend/hooks/usePersistentState'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
		},
	},
})

function initialsFor(fullName: string) {
	const initials = fullName
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase()
	return initials || 'ST'
}

// Only ever returns *active* accounts — an inactive/pending-activation
// profile must be treated identically to "no profile found" by every
// caller, otherwise a newly self-registered (status='inactive') user with a
// valid Supabase session would get full dashboard access.
async function loadActiveUser(userId: string): Promise<SchoolUser | null> {
	const { data, error } = await supabase
		.from('profiles')
		.select('id, full_name, employee_id, department_id, position, email, username, role, status, departments(name)')
		.eq('id', userId)
		.eq('status', 'active')
		.maybeSingle()

	if (error || !data) {
		return null
	}

	return {
		id: data.id,
		fullName: data.full_name,
		employeeId: data.employee_id,
		departmentId: data.department_id,
		department: data.departments?.name ?? '',
		position: data.position,
		email: data.email,
		username: data.username,
		role: data.role as Role,
		status: 'Active',
		profilePicture: initialsFor(data.full_name),
	}
}

export default function App() {
	const [theme, setTheme] = usePersistentState<ThemeMode>('school-theme', 'light')
	const [activeUser, setActiveUser] = useState<SchoolUser | null>(null)
	const [sessionChecked, setSessionChecked] = useState(false)
	const [sessionMessage, setSessionMessage] = useState<string | null>(null)

	useEffect(() => {
		document.documentElement.dataset.theme = theme
		document.body.dataset.theme = theme
	}, [theme])

	useEffect(() => {
		let cancelled = false

		supabase.auth.getSession().then(async ({ data }) => {
			const userId = data.session?.user.id
			const user = userId ? await loadActiveUser(userId) : null

			if (userId && !user) {
				await signOut()
			}

			if (!cancelled) {
				setActiveUser(user)
				setSessionChecked(true)
			}
		})

		const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
			if (event === 'SIGNED_OUT') {
				setActiveUser(null)
				return
			}

			const userId = session?.user.id
			const user = userId ? await loadActiveUser(userId) : null

			if (userId && !user) {
				setSessionMessage('This account is inactive or pending activation. Contact a Super Administrator.')
				await signOut()
				setActiveUser(null)
				return
			}

			setSessionMessage(null)
			setActiveUser(user)
		})

		return () => {
			cancelled = true
			subscription.subscription.unsubscribe()
		}
	}, [])

	const logout = async () => {
		await signOut()
		setSessionMessage('You have been logged out successfully.')
	}

	const toggleTheme = () => {
		setTheme(theme === 'light' ? 'dark' : 'light')
	}

	const sessionBanner = sessionMessage ? (
		<div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-3xl rounded-2xl border border-primary-light bg-primary-light px-4 py-3 text-sm text-primary shadow-lg">
			{sessionMessage}
		</div>
	) : null

	if (!sessionChecked) {
		return null
	}

	if (!activeUser) {
		return (
			<QueryClientProvider client={queryClient}>
				<BrowserRouter>
					{sessionBanner}
					<AuthScreen />
				</BrowserRouter>
			</QueryClientProvider>
		)
	}

	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				{sessionBanner}
				<Routes>
					<Route element={<AppShell user={activeUser} theme={theme} onToggleTheme={toggleTheme} onLogout={logout} />}>
						<Route path="/dashboard" element={<DashboardScreen user={activeUser} />} />
						<Route path="/departments" element={<DepartmentsPage />} />
						<Route path="/facilities" element={<FacilitiesPage user={activeUser} />} />
						<Route path="/inventory" element={<InventoryPage user={activeUser} />} />
						<Route path="/borrowing" element={<BorrowingPage user={activeUser} />} />
						<Route path="/maintenance" element={<MaintenancePage user={activeUser} />} />
						<Route path="/users" element={<UsersPage user={activeUser} />} />
						<Route path="/reports" element={<ComingSoonPage title="Reports" />} />
						<Route path="/notifications" element={<NotificationsPage />} />
						<Route path="/audit-logs" element={<AuditLogsPage />} />
						<Route path="/settings" element={<ComingSoonPage title="System Settings" />} />
						<Route path="/backup" element={<ComingSoonPage title="Backup & Restore" />} />
						<Route path="*" element={<Navigate to="/dashboard" replace />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</QueryClientProvider>
	)
}
