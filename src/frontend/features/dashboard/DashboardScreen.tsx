import { Building2, CheckCircle2, Clock, MapPin, Package, ShieldCheck, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getRoleLabel, rolePermissions } from '@/backend/lib/rbac'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import Skeleton from '@/components/ui/Skeleton'
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

function MetricCard({
	label,
	value,
	detail,
	isLoading,
	highlight,
	icon: Icon,
}: {
	label: string
	value: number
	detail: string
	isLoading: boolean
	highlight?: boolean
	icon: LucideIcon
}) {
	return (
		<article className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<div className="flex items-start justify-between gap-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
				<div
					className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105 ${
						highlight ? 'bg-accent-light text-accent' : 'bg-primary-light text-primary'
					}`}
				>
					<Icon className="h-5 w-5" />
				</div>
			</div>
			<div className="mt-3">
				{isLoading ? (
					<Skeleton className="h-8 w-16" />
				) : (
					<h3 className={`text-2xl font-semibold ${highlight ? 'text-accent' : 'text-text-primary'}`}>{value.toLocaleString()}</h3>
				)}
			</div>
			<p className="mt-2 text-sm text-text-muted">{detail}</p>
		</article>
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

	const availableCount = equipment?.filter((item) => item.status === 'available').length ?? 0
	const borrowedCount = equipment?.filter((item) => item.status === 'borrowed').length ?? 0
	const pendingBorrow = borrowRecords?.filter((row) => row.status === 'pending').length ?? 0
	const pendingMaintenance = maintenanceRequests?.filter((row) => row.status === 'pending').length ?? 0

	const stats =
		user.role === 'super_admin'
			? [
					{ label: 'Departments', value: departments?.length ?? 0, detail: 'Institution-wide coverage', isLoading: departmentsLoading, icon: Building2 },
					{ label: 'Facilities', value: facilities?.length ?? 0, detail: 'Buildings, rooms, and labs', isLoading: facilitiesLoading, icon: MapPin },
					{ label: 'Inventory Items', value: equipment?.length ?? 0, detail: 'Cataloged assets', isLoading: equipmentLoading, icon: Package },
					{ label: 'Available Assets', value: availableCount, detail: 'Ready for use', isLoading: equipmentLoading, icon: CheckCircle2 },
					{ label: 'Borrowed Assets', value: borrowedCount, detail: 'Currently checked out', isLoading: equipmentLoading, icon: Clock },
					{ label: 'Pending Approvals', value: pendingBorrow + pendingMaintenance, detail: 'Awaiting action', isLoading: borrowLoading || maintenanceLoading, icon: Wrench },
					{ label: 'Registered Users', value: profiles?.length ?? 0, detail: 'Active + pending accounts', isLoading: profilesLoading, icon: Users },
				]
			: [
					{ label: 'Facilities', value: facilities?.length ?? 0, detail: 'Accessible rooms and labs', isLoading: facilitiesLoading, icon: MapPin },
					{ label: 'Inventory Items', value: equipment?.length ?? 0, detail: 'Scoped asset records', isLoading: equipmentLoading, icon: Package },
					{ label: 'Available Assets', value: availableCount, detail: 'Ready for use', isLoading: equipmentLoading, icon: CheckCircle2 },
					{ label: 'Pending Approvals', value: pendingBorrow + pendingMaintenance, detail: 'Borrowing and maintenance', isLoading: borrowLoading || maintenanceLoading, icon: Wrench },
				]

	return (
		<div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
			<div className="space-y-6">
				<div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-primary-hover p-6 text-white shadow-sm">
					<div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-2xl" />
					<div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
					<div className="relative flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Role Overview</p>
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
						<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
							<ShieldCheck className="h-6 w-6 text-accent" />
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
					{stats.map((stat, index) => (
						<MetricCard key={stat.label} {...stat} highlight={index === 0} />
					))}
				</div>

				<Card title="Recent Maintenance" subtitle="Latest requests">
					{maintenanceLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					) : maintenanceRequests && maintenanceRequests.length > 0 ? (
						<div className="space-y-3">
							{maintenanceRequests.slice(0, 4).map((request) => (
								<div key={request.id} className="flex items-center gap-4 rounded-xl border border-border bg-bg p-4 transition hover:border-primary-light">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
										<Wrench className="h-5 w-5" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate font-semibold text-text-primary">{request.equipment?.equipment_name ?? request.facilities?.name ?? 'Untitled'}</p>
										<p className="text-sm text-text-muted">Requested by {request.requester?.full_name ?? '—'}</p>
									</div>
									<StatusChip tone={request.status === 'completed' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}>{request.status.replace('_', ' ')}</StatusChip>
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-text-muted">No maintenance requests yet.</p>
					)}
				</Card>
			</div>

			<aside className="space-y-6">
				<Card title="Quick Profile" subtitle="User profile section">
					<div className="flex items-center gap-4 rounded-xl border border-border bg-bg p-4">
						<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-base font-semibold text-white shadow-sm ring-2 ring-accent/40">
							{user.profilePicture}
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
						{permissions.map((permission) => (
							<li key={permission} className="flex items-start gap-2.5 rounded-xl border border-border bg-bg px-4 py-3 text-text-muted">
								<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
								<span>{permission}</span>
							</li>
						))}
					</ul>
				</Card>
			</aside>
		</div>
	)
}
