import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AuthScreen from '@/frontend/features/auth/AuthScreen'
import DashboardScreen from '@/frontend/features/dashboard/DashboardScreen'
import AppShell from '@/components/layout/AppShell'
import DepartmentsPage from '@/frontend/features/departments/DepartmentsPage'
import FacilitiesPage from '@/frontend/features/facilities/FacilitiesPage'
import InventoryPage from '@/frontend/features/inventory/InventoryPage'
import BorrowingPage from '@/frontend/features/borrowing/BorrowingPage'
import BorrowHistoryPage from '@/frontend/features/borrowing/BorrowHistoryPage'
import MaintenancePage from '@/frontend/features/maintenance/MaintenancePage'
import UsersPage from '@/frontend/features/users/UsersPage'
import ReportsPage from '@/frontend/features/reports/ReportsPage'
import NotificationsPage from '@/frontend/features/notifications/NotificationsPage'
import AuditLogsPage from '@/frontend/features/audit-logs/AuditLogsPage'
import SettingsPage from '@/frontend/features/settings/SettingsPage'
import { supabase } from '@/backend/lib/supabase/client'
import { signOut } from '@/backend/lib/supabase/auth'
import type { Role, SchoolUser, ThemeMode } from '@/backend/types/school'
import { usePersistentState } from '@/backend/hooks/usePersistentState'

// Every edge function (borrow-status, maintenance-status, overdue-check,
// create-student, main-supply) returns this exact string when the caller's
// session was revoked server-side (e.g. signed out elsewhere) even though the
// locally cached JWT hasn't hit its own expiry yet. Force a clean re-login
// instead of leaving the UI signed-in-looking but silently broken.
function isSessionInvalidError(error: unknown) {
	return error instanceof Error && error.message === 'Invalid or expired session'
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
		},
	},
	queryCache: new QueryCache({
		onError: (error) => {
			if (isSessionInvalidError(error)) void supabase.auth.signOut()
		},
	}),
	mutationCache: new MutationCache({
		onError: (error) => {
			if (isSessionInvalidError(error)) void supabase.auth.signOut()
		},
	}),
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
		.select('id, full_name, employee_id, department_id, position, email, username, role, status, profile_picture_url, departments(name)')
		.eq('id', userId)
		.eq('status', 'active')
		.maybeSingle()

	if (error || !data) {
		return null
	}

	// employee_id is the legacy plaintext column; employee_id_enc (decrypted
	// server-side, see supabase/functions/profile-pii) is preferred once a
	// profile has been migrated to it. Fall back silently if the function
	// call fails so a decrypt hiccup never blocks login.
	let employeeId = data.employee_id
	const { data: piiData } = await supabase.functions.invoke('profile-pii', { body: { action: 'get' } })
	if (piiData?.data?.employee_id) {
		employeeId = piiData.data.employee_id
	}

	return {
		id: data.id,
		fullName: data.full_name,
		employeeId,
		departmentId: data.department_id,
		department: data.departments?.name ?? '',
		position: data.position,
		email: data.email,
		username: data.username,
		role: data.role as Role,
		status: 'Active',
		profilePicture: initialsFor(data.full_name),
		avatarUrl: data.profile_picture_url,
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
				// A manual logout (see `logout` below) overwrites this with its own
				// message right after signOut() resolves, so this is only the
				// message a user actually sees when something else triggered it
				// (e.g. a revoked session caught by queryClient's onError above).
				setSessionMessage('Your session has expired. Please log in again.')
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

	const updateActiveUserAvatar = (avatarUrl: string) => {
		setActiveUser((current) => (current ? { ...current, avatarUrl } : current))
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
						<Route path="/history" element={<BorrowHistoryPage user={activeUser} />} />
						<Route path="/maintenance" element={<MaintenancePage user={activeUser} />} />
						<Route path="/users" element={<UsersPage user={activeUser} />} />
						<Route path="/reports" element={<ReportsPage user={activeUser} />} />
						<Route path="/notifications" element={<NotificationsPage />} />
						<Route path="/audit-logs" element={<AuditLogsPage />} />
						<Route path="/settings" element={<SettingsPage user={activeUser} onAvatarUpdated={updateActiveUserAvatar} />} />
						<Route path="*" element={<Navigate to="/dashboard" replace />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</QueryClientProvider>
	)
}
