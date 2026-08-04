import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, LogOut, Menu, Search, Sun, Moon, UserRoundPen, X } from 'lucide-react'
import { isRouteAllowed, navItemsForRole } from '@/frontend/config/navigation'
import { getRoleLabel } from '@/backend/lib/rbac'
import { useNotifications } from '@/backend/lib/supabase/queries'
import type { SchoolUser, ThemeMode } from '@/backend/types/school'

type AppShellProps = {
	user: SchoolUser
	theme: ThemeMode
	onToggleTheme: () => void
	onLogout: () => void
}

function Breadcrumbs({ path }: { path: string }) {
	const segments = path.split('/').filter(Boolean)
	const label = (segment: string) => segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

	return (
		<nav className="flex min-w-0 items-center gap-2 text-sm text-text-muted">
			<Link to="/dashboard" className="hidden hover:text-primary sm:inline">
				BISU FIMS
			</Link>
			{segments.map((segment, index) => (
				<span key={segment} className="flex min-w-0 items-center gap-2">
					<span className="hidden sm:inline">/</span>
					<span className={`truncate ${index === segments.length - 1 ? 'font-semibold text-text-primary' : ''}`}>{label(segment)}</span>
				</span>
			))}
		</nav>
	)
}

export default function AppShell({ user, theme, onToggleTheme, onLogout }: AppShellProps) {
	const location = useLocation()
	const [profileMenuOpen, setProfileMenuOpen] = useState(false)
	const [mobileNavOpen, setMobileNavOpen] = useState(false)
	const profileMenuRef = useRef<HTMLDivElement>(null)
	const items = navItemsForRole(user.role)
	const { data: notifications } = useNotifications()
	const unreadCount = notifications?.filter((note) => !note.is_read).length ?? 0

	useEffect(() => {
		setProfileMenuOpen(false)
		setMobileNavOpen(false)
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

	useEffect(() => {
		if (!mobileNavOpen) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setMobileNavOpen(false)
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [mobileNavOpen])

	return (
		<div className="flex min-h-screen bg-bg text-text-primary">
			<div className="app-backdrop" aria-hidden="true" />

			{/* Navy rather than bg-surface, carrying the login hero's left panel
			    through into the app. Every foreground colour in here is set against
			    that fill instead of inherited: the shared text-text-primary /
			    text-text-muted tokens are near-black on the light theme and would
			    vanish. Separators are white alphas for the same reason — border-border
			    is a light-grey hairline that reads as a scratch on dark navy. */}
			<aside
				className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/10 bg-sidebar transition-transform duration-200 md:translate-x-0 ${
					mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				<div className="flex h-16 items-center justify-center gap-3 border-b border-white/10 px-2 md:justify-start md:px-5">
					<img src="/bisu-logo.png" alt="BISU seal" className="h-9 w-9 shrink-0 md:h-10 md:w-10" />
					<div className="hidden md:block">
						<p className="font-serif text-base leading-tight text-white">
							<span className="font-semibold">BISU</span> <span className="font-normal text-white/60">FIMS</span>
						</p>
						<p className="text-xs text-white/60">Facilities &amp; Inventory</p>
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
								className={`group flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition md:justify-start ${
									mobileNavOpen ? 'justify-start' : 'justify-center'
								} ${
									// The old active state faded primary-light (a pale lilac) to
									// transparent, which is invisible on navy. A white wash reads
									// on the dark fill and keeps the gold accent rail as the thing
									// that marks the current page.
									active
										? 'border-accent bg-linear-to-r from-white/15 to-transparent text-white shadow-sm'
										: 'border-transparent text-white/65 hover:border-accent/40 hover:bg-white/8 hover:text-white'
								}`}
								title={item.label}
							>
								<Icon className={`h-5 w-5 shrink-0 transition group-hover:scale-110 ${active ? 'text-accent' : ''}`} />
								<span className={`${mobileNavOpen ? 'inline' : 'hidden'} md:inline`}>{item.label}</span>
							</NavLink>
						)
					})}
				</nav>
			</aside>

			{mobileNavOpen ? (
				<div
					className="fixed inset-0 z-20 bg-black/40 md:hidden"
					aria-hidden="true"
					onClick={() => setMobileNavOpen(false)}
				/>
			) : null}

			<div className="flex min-h-screen min-w-0 flex-1 flex-col pl-0 md:pl-64">
				<header className="glass-panel-strong sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-4 sm:px-6">
					<button
						type="button"
						onClick={() => setMobileNavOpen((current) => !current)}
						className="rounded-lg border border-border p-2 text-text-muted transition hover:border-primary hover:text-primary md:hidden"
						aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
					>
						{mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>

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

						<Link
							to="/notifications"
							aria-label="Notifications"
							className={`relative rounded-lg border p-2 transition ${
								location.pathname.startsWith('/notifications')
									? 'border-primary text-primary'
									: 'border-border text-text-muted hover:border-primary hover:text-primary'
							}`}
						>
							<Bell className="h-5 w-5" />
							{unreadCount > 0 ? (
								<span className="absolute -right-1 -top-1 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-sm shadow-danger/40">
									{unreadCount > 9 ? '9+' : unreadCount}
								</span>
							) : null}
						</Link>

						<div className="relative" ref={profileMenuRef}>
							<button
								type="button"
								onClick={() => setProfileMenuOpen((current) => !current)}
								className="flex items-center gap-2 rounded-lg border border-border py-1.5 pl-1.5 pr-3 transition hover:border-primary hover:shadow-sm"
							>
								<span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-primary to-primary-hover text-xs font-semibold text-white shadow-sm">
									{user.avatarUrl ? (
										<img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
									) : (
										user.profilePicture
									)}
									{user.status === 'Active' ? (
										<span className="absolute -right-0.5 -bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-surface">
											<span className="h-1.5 w-1.5 rounded-full bg-success ring-1 ring-surface" />
										</span>
									) : null}
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
									<Link
										to="/settings"
										className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-primary transition hover:bg-primary-light hover:text-primary"
									>
										<UserRoundPen className="h-4 w-4" />
										Edit Profile
									</Link>
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

				<main className="relative z-10 flex-1 p-4 sm:p-6">
					{isRouteAllowed(location.pathname, user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />}
				</main>
			</div>
		</div>
	)
}
