import { Building2, CheckCircle2, Clock, MapPin, Package, ShieldCheck, Sparkles, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getRoleLabel, rolePermissions } from '@/backend/lib/rbac'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import Skeleton from '@/components/ui/Skeleton'
import AlertsPanel from '@/frontend/features/dashboard/AlertsPanel'
import {
	useBorrowRecords,
	useDepartments,
	useEquipment,
	useFacilities,
	useMaintenanceRequests,
	useProfiles,
} from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

type DashboardScreenProps = {
	user: SchoolUser
}

type MetricTone = 'primary' | 'accent' | 'info' | 'success' | 'warning' | 'danger'

const metricToneClass: Record<MetricTone, { icon: string; value: string; glow: string; bar: string }> = {
	primary: { icon: 'bg-primary-light text-primary', value: 'text-primary', glow: 'hover:shadow-primary/20', bar: 'bg-primary' },
	accent: { icon: 'bg-accent-light text-accent', value: 'text-accent', glow: 'hover:shadow-accent/20', bar: 'bg-accent' },
	info: { icon: 'bg-info/10 text-info', value: 'text-info', glow: 'hover:shadow-info/20', bar: 'bg-info' },
	success: { icon: 'bg-success/10 text-success', value: 'text-success', glow: 'hover:shadow-success/20', bar: 'bg-success' },
	warning: { icon: 'bg-warning/10 text-warning', value: 'text-warning', glow: 'hover:shadow-warning/20', bar: 'bg-warning' },
	danger: { icon: 'bg-danger/10 text-danger', value: 'text-danger', glow: 'hover:shadow-danger/20', bar: 'bg-danger' },
}

function MetricCard({
	label,
	value,
	detail,
	isLoading,
	tone,
	icon: Icon,
}: {
	label: string
	value: number
	detail: string
	isLoading: boolean
	tone: MetricTone
	icon: LucideIcon
}) {
	const palette = metricToneClass[tone]
	return (
		<article
			className={`group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${palette.glow}`}
		>
			<span className={`absolute inset-x-0 top-0 h-1 ${palette.bar} opacity-70 transition group-hover:opacity-100`} />
			<div className="flex items-start justify-between gap-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
				<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-110 group-hover:rotate-3 ${palette.icon}`}>
					<Icon className="h-5 w-5" />
				</div>
			</div>
			<div className="mt-3">
				{isLoading ? <Skeleton className="h-8 w-16" /> : <h3 className={`text-2xl font-semibold ${palette.value}`}>{value.toLocaleString()}</h3>}
			</div>
			<p className="mt-2 text-sm text-text-muted">{detail}</p>
		</article>
	)
}

function StatusBreakdown({ label, value, total, tone }: { label: string; value: number; total: number; tone: MetricTone }) {
	const percent = total > 0 ? Math.round((value / total) * 100) : 0
	const palette = metricToneClass[tone]
	return (
		<div>
			<div className="mb-1.5 flex items-center justify-between text-sm">
				<span className="font-medium text-text-primary">{label}</span>
				<span className="text-text-muted">
					{value.toLocaleString()} · {percent}%
				</span>
			</div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-bg">
				<div className={`h-full rounded-full ${palette.bar} transition-all duration-700`} style={{ width: `${percent}%` }} />
			</div>
		</div>
	)
}

export default function DashboardScreen({ user }: DashboardScreenProps) {
	const permissions = rolePermissions[user.role]

	const { data: departments, isLoading: departmentsLoading } = useDepartments()
	const { data: facilities, isLoading: facilitiesLoading } = useFacilities()
	const { data: equipment, isLoading: equipmentLoading } = useEquipment()
	const { data: borrowRecords, isLoading: borrowLoading } = useBorrowRecords()
	const { data: maintenanceRequests, isLoading: maintenanceLoading } = useMaintenanceRequests()
	const { data: profiles, isLoading: profilesLoading } = useProfiles()

	// Staff and department admins see only their own department's assets; the
	// super admin sees everything (including Main Supply / Central Inventory).
	const scopedEquipment = user.role === 'super_admin' ? (equipment ?? []) : (equipment ?? []).filter((item) => item.department_id === user.departmentId)

	const totalEquipment = scopedEquipment.length
	const availableCount = scopedEquipment.filter((item) => item.status === 'available').length
	const borrowedCount = scopedEquipment.filter((item) => item.status === 'borrowed').length
	const underMaintenanceCount = scopedEquipment.filter((item) => item.status === 'maintenance').length
	const otherCount = Math.max(totalEquipment - availableCount - borrowedCount - underMaintenanceCount, 0)
	const pendingBorrow = borrowRecords?.filter((row) => row.status === 'pending').length ?? 0
	const pendingMaintenance = maintenanceRequests?.filter((row) => row.status === 'pending').length ?? 0

	const stats: { label: string; value: number; detail: string; isLoading: boolean; icon: LucideIcon; tone: MetricTone }[] =
		user.role === 'super_admin'
			? [
					{ label: 'Departments', value: departments?.length ?? 0, detail: 'Institution-wide coverage', isLoading: departmentsLoading, icon: Building2, tone: 'primary' },
					{ label: 'Facilities', value: facilities?.length ?? 0, detail: 'Buildings, rooms, and labs', isLoading: facilitiesLoading, icon: MapPin, tone: 'info' },
					{ label: 'Inventory Items', value: scopedEquipment.length, detail: 'Cataloged assets', isLoading: equipmentLoading, icon: Package, tone: 'accent' },
					{ label: 'Available Assets', value: availableCount, detail: 'Ready for use', isLoading: equipmentLoading, icon: CheckCircle2, tone: 'success' },
					{ label: 'Borrowed Assets', value: borrowedCount, detail: 'Currently checked out', isLoading: equipmentLoading, icon: Clock, tone: 'warning' },
					{ label: 'Pending Approvals', value: pendingBorrow + pendingMaintenance, detail: 'Awaiting action', isLoading: borrowLoading || maintenanceLoading, icon: Wrench, tone: 'danger' },
					{ label: 'Registered Users', value: profiles?.length ?? 0, detail: 'Active + pending accounts', isLoading: profilesLoading, icon: Users, tone: 'primary' },
				]
			: [
					{ label: 'Facilities', value: facilities?.length ?? 0, detail: 'Accessible rooms and labs', isLoading: facilitiesLoading, icon: MapPin, tone: 'info' },
					{ label: 'Inventory Items', value: scopedEquipment.length, detail: 'Scoped asset records', isLoading: equipmentLoading, icon: Package, tone: 'accent' },
					{ label: 'Available Assets', value: availableCount, detail: 'Ready for use', isLoading: equipmentLoading, icon: CheckCircle2, tone: 'success' },
					{ label: 'Pending Approvals', value: pendingBorrow + pendingMaintenance, detail: 'Borrowing and maintenance', isLoading: borrowLoading || maintenanceLoading, icon: Wrench, tone: 'danger' },
				]

	return (
		<div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
			<div className="space-y-6">
				<div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-primary-hover p-6 text-white shadow-sm">
					<div
						className="pointer-events-none absolute inset-0 opacity-[0.08]"
						style={{
							backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
							backgroundSize: '18px 18px',
						}}
					/>
					<div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 animate-pulse rounded-full bg-accent/20 blur-2xl" />
					<div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
					<div className="relative flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
								<Sparkles className="h-3.5 w-3.5" />
								Role Overview
							</p>
							<h2 className="mt-2 font-serif text-2xl font-semibold">Welcome, {user.fullName}</h2>
							<p className="mt-2 max-w-xl text-sm text-white/80">
								You are signed in as <span className="font-semibold text-white">{getRoleLabel(user.role)}</span>
								{user.department ? (
									<>
										{' '}
										for <span className="font-semibold text-white">{user.department}</span>
									</>
								) : null}
								.
							</p>
						</div>
						<div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-lg ring-1 ring-white/30 backdrop-blur">
							<span className="absolute -right-1 -top-1 flex h-3 w-3">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
								<span className="relative inline-flex h-3 w-3 rounded-full bg-success ring-2 ring-primary" />
							</span>
							<ShieldCheck className="h-6 w-6 text-accent" />
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
					{stats.map((stat) => (
						<MetricCard key={stat.label} {...stat} />
					))}
				</div>

				<AlertsPanel user={user} />

				{totalEquipment > 0 ? (
					<Card title="Asset Status Breakdown" subtitle="Live inventory split">
						<div className="space-y-4">
							<StatusBreakdown label="Available" value={availableCount} total={totalEquipment} tone="success" />
							<StatusBreakdown label="Borrowed" value={borrowedCount} total={totalEquipment} tone="warning" />
							{underMaintenanceCount > 0 ? <StatusBreakdown label="Under Maintenance" value={underMaintenanceCount} total={totalEquipment} tone="info" /> : null}
							{otherCount > 0 ? <StatusBreakdown label="Damaged / Lost / Disposed" value={otherCount} total={totalEquipment} tone="danger" /> : null}
						</div>
					</Card>
				) : null}

				<Card title="Recent Maintenance" subtitle="Latest requests">
					{maintenanceLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					) : maintenanceRequests && maintenanceRequests.length > 0 ? (
						<div className="space-y-3">
							{maintenanceRequests.slice(0, 4).map((request) => {
								const tone = request.status === 'completed' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'
								const barClass = tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : 'bg-warning'
								return (
									<div
										key={request.id}
										className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-bg p-4 pl-5 transition hover:-translate-y-0.5 hover:border-primary-light hover:shadow-sm"
									>
										<span className={`absolute inset-y-0 left-0 w-1 ${barClass}`} />
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning transition group-hover:scale-110">
											<Wrench className="h-5 w-5" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-text-primary">{request.equipment?.equipment_name ?? request.facilities?.name ?? 'Untitled'}</p>
											<p className="text-sm text-text-muted">Requested by {request.requester?.full_name ?? '—'}</p>
										</div>
										<StatusChip tone={tone}>{request.status.replace('_', ' ')}</StatusChip>
									</div>
								)
							})}
						</div>
					) : (
						<p className="text-sm text-text-muted">No maintenance requests yet.</p>
					)}
				</Card>
			</div>

			<aside className="space-y-6">
				<Card title="Quick Profile" subtitle="User profile section">
					<div className="flex items-center gap-4 rounded-xl border border-border bg-bg p-4">
						<div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-base font-semibold text-white shadow-sm ring-2 ring-accent/40">
							{user.profilePicture}
							{user.status === 'Active' ? (
								<span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface">
									<span className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
								</span>
							) : null}
						</div>
						<div className="min-w-0">
							<p className="truncate font-semibold text-text-primary">{user.fullName}</p>
							<p className="truncate text-sm text-text-muted">{user.position ?? getRoleLabel(user.role)}</p>
							<div className="mt-1">
								<StatusChip tone={user.status === 'Active' ? 'success' : 'muted'}>{user.status}</StatusChip>
							</div>
						</div>
					</div>
				</Card>

				<Card title="Permissions" subtitle={`${permissions.length} granted`}>
					<ul className="space-y-2 text-sm">
						{permissions.map((permission, index) => (
							<li
								key={permission}
								className="group flex items-start gap-2.5 rounded-xl border border-border bg-bg px-4 py-3 text-text-muted transition hover:border-success/30 hover:bg-success/5"
							>
								<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-[10px] font-bold text-success transition group-hover:scale-110">
									{index + 1}
								</span>
								<span>{permission}</span>
								<CheckCircle2 className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-success opacity-0 transition group-hover:opacity-100" />
							</li>
						))}
					</ul>
				</Card>
			</aside>
		</div>
	)
}
