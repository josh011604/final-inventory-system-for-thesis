import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, LogOut, Search, Sun, Moon } from 'lucide-react'
import { isRouteAllowed, navItemsForRole } from '@/frontend/config/navigation'
import { getRoleLabel } from '@/backend/lib/rbac'
import type { SchoolUser, ThemeMode } from '@/backend/types/school'

type AppShellProps = {
	user: SchoolUser
	theme: ThemeMode
	onToggleTheme: () => void
	onLogout: () => void
	notificationCount?: number
}

function Breadcrumbs({ path }: { path: string }) {
	const segments = path.split('/').filter(Boolean)
	const label = (segment: string) => segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

	return (
		<nav className="flex items-center gap-2 text-sm text-text-muted">
			<Link to="/dashboard" className="hover:text-primary">
				BISU FIMS
			</Link>
			{segments.map((segment, index) => (
				<span key={segment} className="flex items-center gap-2">
					<span>/</span>
					<span className={index === segments.length - 1 ? 'font-semibold text-text-primary' : ''}>{label(segment)}</span>
				</span>
			))}
		</nav>
	)
}

export default function AppShell({ user, theme, onToggleTheme, onLogout, notificationCount = 0 }: AppShellProps) {
	const location = useLocation()
	const [profileMenuOpen, setProfileMenuOpen] = useState(false)
	const profileMenuRef = useRef<HTMLDivElement>(null)
	const items = navItemsForRole(user.role)

	useEffect(() => {
		setProfileMenuOpen(false)
	}, [location.pathname])

	useEffect(() => {
		if (!profileMenuOpen) return

		const handlePointerDown = (event: PointerEvent) => {
			if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
				setProfileMenuOpen(false)
			}
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setProfileMenuOpen(false)
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [profileMenuOpen])

	return (
		<div className="flex min-h-screen bg-bg text-text-primary">
			<aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r border-border bg-surface md:w-64">
				<div className="flex h-16 items-center justify-center gap-3 border-b border-border px-2 md:justify-start md:px-5">
					<img src="/bisu-logo.png" alt="BISU seal" className="h-9 w-9 shrink-0 md:h-10 md:w-10" />
					<div className="hidden md:block">
						<p className="font-serif text-base leading-tight text-text-primary">
							<span className="font-semibold">BISU</span> <span className="font-normal text-text-muted">FIMS</span>
						</p>
						<p className="text-xs text-text-muted">Facilities &amp; Inventory</p>
					</div>
				</div>

				<nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4 md:px-3">
					{items.map((item) => {
						const Icon = item.icon
						const active = location.pathname.startsWith(item.path)
						return (
							<NavLink
								key={item.path}
								to={item.path}
								className={`group flex items-center justify-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition md:justify-start ${
									active
										? 'border-accent bg-gradient-to-r from-primary-light to-transparent text-primary shadow-sm'
										: 'border-transparent text-text-muted hover:border-accent/40 hover:bg-primary-light hover:text-primary'
								}`}
								title={item.label}
							>
								<Icon className={`h-5 w-5 shrink-0 transition group-hover:scale-110 ${active ? 'text-accent' : ''}`} />
								<span className="hidden md:inline">{item.label}</span>
							</NavLink>
						)
					})}
				</nav>
			</aside>

			<div className="flex min-h-screen flex-1 flex-col pl-16 md:pl-64">
				<header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur-xl sm:px-6">
					<Breadcrumbs path={location.pathname} />

					<div className="ml-auto flex items-center gap-2 sm:gap-3">
						<label className="relative hidden sm:block">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
							<input
								type="search"
								placeholder="Search..."
								className="w-48 rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-surface md:w-64"
							/>
						</label>

						<button
							type="button"
							onClick={onToggleTheme}
							className="rounded-lg border border-border p-2 text-text-muted transition hover:border-primary hover:text-primary"
							aria-label="Toggle theme"
						>
							{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
						</button>

						<button type="button" className="relative rounded-lg border border-border p-2 text-text-muted transition hover:border-primary hover:text-primary" aria-label="Notifications">
							<Bell className="h-5 w-5" />
							{notificationCount > 0 ? (
								<span className="absolute -right-1 -top-1 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-sm shadow-danger/40">
									{notificationCount > 9 ? '9+' : notificationCount}
								</span>
							) : null}
						</button>

						<div className="relative" ref={profileMenuRef}>
							<button
								type="button"
								onClick={() => setProfileMenuOpen((current) => !current)}
								className="flex items-center gap-2 rounded-lg border border-border py-1.5 pl-1.5 pr-3 transition hover:border-primary hover:shadow-sm"
							>
								<span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-hover text-xs font-semibold text-white shadow-sm">
									{user.profilePicture}
								</span>
								<span className="hidden text-left text-sm sm:block">
									<span className="block font-semibold leading-tight">{user.fullName}</span>
									<span className="block text-xs text-text-muted leading-tight">{getRoleLabel(user.role)}</span>
								</span>
							</button>

							{profileMenuOpen ? (
								<div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg">
									<div className="px-3 py-2">
										<p className="text-sm font-semibold">{user.fullName}</p>
										<p className="text-xs text-text-muted">{user.department}</p>
									</div>
									<button
										type="button"
										onClick={onLogout}
										className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger transition hover:bg-danger/10"
									>
										<LogOut className="h-4 w-4" />
										Logout
									</button>
								</div>
							) : null}
						</div>
					</div>
				</header>

				<main className="flex-1 p-4 sm:p-6">
					{isRouteAllowed(location.pathname, user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />}
				</main>
			</div>
		</div>
	)
}
